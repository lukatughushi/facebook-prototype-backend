import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument, ReactionType } from './schemas/post.schema';
import { Reel, ReelDocument } from '../reels/schemas/reel.schema';
import { applyReaction, editCommentOrReply, findCommentOrReply } from '../common/reactions';
import { ShareDto } from './dto/share.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { GroupsService } from '../groups/groups.service';
import { PagesService } from '../pages/pages.service';

const AUTHOR_FIELDS = 'name avatar';

// What a share embeds from its original.
const SHARED_POST = {
  path: 'sharedPost',
  select: 'author content image audience page group createdAt',
  populate: [
    { path: 'author', select: AUTHOR_FIELDS },
    { path: 'page', select: 'name avatar' },
    { path: 'group', select: 'name privacy' },
  ],
};
const SHARED_REEL = {
  path: 'sharedReel',
  select: 'videoUrl posterUrl caption author musicTrack createdAt',
  populate: { path: 'author', select: AUTHOR_FIELDS },
};

export interface FeedQuery {
  author?: string;
  group?: string;
  page?: string;
  // "1": only posts the viewer saved.
  saved?: string;
  // "1": the viewer's own posts from more than a week ago.
  memories?: string;
  // Cursor: only posts created strictly before this ISO timestamp.
  before?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 10;
const MEMORY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LIMIT = 50;
const oid = (id: string) => new Types.ObjectId(id);

const idOf = (user: UserDocument) => (user as any)._id.toString();

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Reel.name) private reelModel: Model<ReelDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly groupsService: GroupsService,
    private readonly pagesService: PagesService,
  ) {}

  private populateAll(query: any) {
    return query
      .populate('author', AUTHOR_FIELDS)
      .populate('group', 'name privacy')
      .populate('page', 'name avatar category')
      .populate('comments.author', AUTHOR_FIELDS)
      .populate('comments.replies.author', AUTHOR_FIELDS)
      .populate(SHARED_POST)
      .populate(SHARED_REEL);
  }

  private async findOrThrow(postId: string) {
    if (!Types.ObjectId.isValid(postId)) throw new NotFoundException('Post not found');
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async populatedComments(post: PostDocument) {
    await post.populate([
      { path: 'comments.author', select: AUTHOR_FIELDS },
      { path: 'comments.replies.author', select: AUTHOR_FIELDS },
    ]);
    return { comments: (post.toJSON() as any).comments };
  }

  // Conditions a post must meet for `viewer` to see it: Public posts from
  // everyone, "Friends" posts only from the viewer and their friends, and
  // nothing from private groups the viewer isn't in. Admins see everything.
  private async visibility(viewer: UserDocument): Promise<Record<string, unknown>[]> {
    if (viewer.role === 'admin') return [];
    const and: Record<string, unknown>[] = [
      { $or: [{ audience: { $ne: 'Friends' } }, { author: { $in: [(viewer as any)._id, ...(viewer.friends || [])] } }] },
    ];
    const hidden = await this.groupsService.hiddenGroupIds(idOf(viewer));
    if (hidden.length) and.push({ group: { $nin: hidden } });
    return and;
  }

  // GET /posts/:id - one post, if the viewer may see it (notification links,
  // "Copy link").
  async findOne(postId: string, viewer: UserDocument) {
    if (!Types.ObjectId.isValid(postId)) throw new NotFoundException('Post not found');
    const and = await this.visibility(viewer);
    const post = await this.populateAll(this.postModel.findOne({ $and: [{ _id: oid(postId) }, ...and] }));
    if (!post) throw new NotFoundException("This post isn't available");
    return { post };
  }

  // Who reacted, for the reactions dialog: [{ user: { _id, name, avatar }, type }].
  async reactions(postId: string, viewer: UserDocument) {
    const { post } = await this.findOne(postId, viewer);
    const list = (post.toJSON() as any).reactions as { user: any; type: ReactionType }[];
    const users = await this.postModel.db
      .model('User')
      .find({ _id: { $in: list.map((r) => r.user) } })
      .select(AUTHOR_FIELDS)
      .lean();
    const byId = new Map(users.map((u: any) => [String(u._id), u]));
    return {
      reactions: list
        .map((r) => ({ user: byId.get(String(r.user?._id ?? r.user)), type: r.type }))
        .filter((r) => r.user),
    };
  }

  // Toggles the post in the caller's saved list.
  async toggleSave(postId: string, user: UserDocument) {
    await this.findOrThrow(postId);
    const saved = (user.savedPosts || []).some((id) => id.toString() === postId);
    await user.updateOne(saved ? { $pull: { savedPosts: oid(postId) } } : { $push: { savedPosts: { $each: [oid(postId)], $position: 0 } } });
    return { saved: !saved };
  }

  // Newest-first, cursor-paginated feed of posts visible to the viewer.
  // Filters: author (profile timeline - excludes posts made as a page),
  // group, page, saved, memories. Returns `nextCursor` while more posts remain.
  async getFeed(viewer: UserDocument, q: FeedQuery = {}) {
    const ids = [q.author, q.group, q.page].filter(Boolean) as string[];
    if (ids.some((id) => !Types.ObjectId.isValid(id))) return { posts: [], nextCursor: null };

    const and = await this.visibility(viewer);
    if (q.saved === '1') and.push({ _id: { $in: viewer.savedPosts || [] } });
    else and.push({ hiddenFromFeed: { $ne: true } });
    if (q.memories === '1') {
      and.push({ author: (viewer as any)._id, page: null, createdAt: { $lt: new Date(Date.now() - MEMORY_AGE_MS) } });
    }
    if (q.author) and.push({ author: oid(q.author), page: null });
    if (q.group) and.push({ group: oid(q.group) });
    if (q.page) and.push({ page: oid(q.page) });
    if (q.before) {
      const before = new Date(q.before);
      if (isNaN(before.getTime())) throw new BadRequestException('Invalid cursor');
      and.push({ createdAt: { $lt: before } });
    }

    const limit = Math.min(Math.max(Number(q.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const posts = await this.populateAll(
      this.postModel
        .find(and.length ? { $and: and } : {})
        .sort({ createdAt: -1 })
        .limit(limit),
    );
    const nextCursor = posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null;
    return { posts, nextCursor };
  }

  // Posting into a group requires membership; posting as a page requires
  // being one of its admins.
  async create(userId: string, dto: CreatePostDto, imagePath?: string) {
    if (dto.group && !(await this.groupsService.isMember(dto.group, userId))) {
      throw new ForbiddenException('Join the group to post in it');
    }
    if (dto.page && !(await this.pagesService.isAdmin(dto.page, userId))) {
      throw new ForbiddenException('Only page admins can post as this page');
    }
    const post = await this.postModel.create({
      author: new Types.ObjectId(userId),
      content: dto.content || '',
      image: imagePath || '',
      audience: dto.audience || 'Public',
      ...(dto.group ? { group: oid(dto.group) } : {}),
      ...(dto.page ? { page: oid(dto.page) } : {}),
    });
    const populated = await post.populate([
      { path: 'author', select: AUTHOR_FIELDS },
      { path: 'group', select: 'name privacy' },
      { path: 'page', select: 'name avatar category' },
    ]);
    return { post: populated };
  }

  async update(postId: string, user: UserDocument, dto: UpdatePostDto) {
    const post = await this.findOrThrow(postId);

    const isOwner = post.author.toString() === idOf(user);
    if (!isOwner && user.role !== 'admin') {
      throw new ForbiddenException('Not authorized to edit this post');
    }

    const content = dto.content.trim();
    if (content !== post.content) {
      post.content = content;
      post.editedAt = new Date();
      await post.save();
    }
    return { post: await this.populatedPost(post._id) };
  }

  // Sets the caller's reaction. Reacting with the type you already have (or
  // with no type) removes it, like Facebook's Like button toggle.
  async react(postId: string, userId: string, type?: ReactionType | null) {
    const post = await this.findOrThrow(postId);
    const { mine, added } = applyReaction(post, userId, type, true);
    await post.save();

    if (added) {
      await this.notificationsService.notify(post.author.toString(), userId, 'like', postId);
    }
    return { reactions: post.toJSON().reactions, mine };
  }

  toggleLike(postId: string, userId: string) {
    return this.react(postId, userId, 'like');
  }

  private async populatedPost(id: Types.ObjectId) {
    return this.populateAll(this.postModel.findById(id));
  }

  // Sharing creates a new post on the sharer's timeline that references the
  // original. Shares of shares point at the root; reel shares delegate to
  // shareReel. Only public content outside private groups can be shared
  // (your own posts always can).
  async share(postId: string, user: UserDocument, dto: ShareDto) {
    const userId = idOf(user);
    let root = await this.findOrThrow(postId);
    if (root.sharedReel) return this.shareReel(root.sharedReel.toString(), user, dto);
    if (root.sharedPost) {
      const original = await this.postModel.findById(root.sharedPost);
      if (!original) throw new NotFoundException("The original post isn't available anymore");
      root = original;
    }

    const own = root.author.toString() === userId;
    if (!own && root.audience === 'Friends') throw new ForbiddenException('Only public posts can be shared');
    if (!own && root.group && (await this.groupsService.isPrivate(root.group.toString()))) {
      throw new ForbiddenException("Posts from private groups can't be shared");
    }

    const created = await this.postModel.create({
      author: new Types.ObjectId(userId),
      content: dto.content?.trim() || '',
      audience: dto.audience || 'Public',
      sharedPost: root._id,
    });
    await this.postModel.updateOne({ _id: root._id }, { $push: { shares: new Types.ObjectId(userId) } });
    await this.notificationsService.notify(root.author.toString(), userId, 'share', root._id.toString());

    return { post: await this.populatedPost(created._id), sharesCount: root.shares.length + 1 };
  }

  async shareReel(reelId: string, user: UserDocument, dto: ShareDto) {
    const userId = idOf(user);
    if (!Types.ObjectId.isValid(reelId)) throw new NotFoundException('Reel not found');
    const reel = await this.reelModel.findByIdAndUpdate(reelId, { $push: { shares: new Types.ObjectId(userId) } }, { new: true });
    if (!reel) throw new NotFoundException("The original reel isn't available anymore");

    const created = await this.postModel.create({
      author: new Types.ObjectId(userId),
      content: dto.content?.trim() || '',
      audience: dto.audience || 'Public',
      sharedReel: reel._id,
    });
    await this.notificationsService.notify(reel.author.toString(), userId, 'share');

    return { post: await this.populatedPost(created._id), sharesCount: reel.shares.length };
  }

  async addComment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.findOrThrow(postId);

    post.comments.push({ author: new Types.ObjectId(userId), content: dto.content.trim() } as any);
    await post.save();
    await this.notificationsService.notify(post.author.toString(), userId, 'comment', postId);

    return this.populatedComments(post);
  }

  async addReply(postId: string, commentId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.findOrThrow(postId);
    const comment = (post.comments as any).id(commentId);
    if (!comment) throw new NotFoundException('Comment not found');

    comment.replies.push({ author: new Types.ObjectId(userId), content: dto.content.trim() });
    await post.save();
    await this.notificationsService.notify(post.author.toString(), userId, 'comment', postId);

    return this.populatedComments(post);
  }

  // Reacts to a comment or a reply (ids are unique across both, so one
  // endpoint serves both). Same type again removes the reaction.
  async reactToComment(postId: string, commentId: string, userId: string, type?: ReactionType | null) {
    const post = await this.findOrThrow(postId);
    const found = findCommentOrReply(post, commentId);
    if (!found) throw new NotFoundException('Comment not found');
    applyReaction(found.target, userId, type);
    await post.save();
    return this.populatedComments(post);
  }

  // Edits a comment or a reply (ids are unique across both).
  async editComment(postId: string, commentId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.findOrThrow(postId);
    editCommentOrReply(post, commentId, userId, dto.content);
    await post.save();
    return this.populatedComments(post);
  }

  // Public post announcing a new profile picture / cover photo.
  // With `backfill`, the post is for a photo set before photo posts existed:
  // kept out of feeds and dated `createdAt` (the photo's upload time if known).
  async createProfilePhotoPost(
    userId: string,
    image: string,
    kind: 'avatar' | 'cover',
    backfill?: { createdAt?: Date },
  ) {
    const created = await this.postModel.create({
      author: new Types.ObjectId(userId),
      image,
      audience: 'Public',
      profileUpdate: kind,
      ...(backfill ? { hiddenFromFeed: true, ...(backfill.createdAt ? { createdAt: backfill.createdAt } : {}) } : {}),
    });
    return this.populatedPost(created._id);
  }

  // The photo post for `postId` if it still exists and shows `image`.
  async findProfilePhotoPost(postId: unknown, image: string) {
    if (!postId || !Types.ObjectId.isValid(String(postId))) return null;
    const post = await this.postModel.findById(postId).select('image');
    if (!post || post.image !== image) return null;
    return this.populatedPost(post._id);
  }

  async removeById(postId: unknown) {
    await this.postModel.deleteOne({ _id: postId });
  }

  async remove(postId: string, user: UserDocument) {
    const post = await this.findOrThrow(postId);

    const isOwner = post.author.toString() === idOf(user);
    if (!isOwner && user.role !== 'admin') {
      throw new ForbiddenException('Not authorized to delete this post');
    }

    await post.deleteOne();
    return { message: 'Post deleted' };
  }
}
