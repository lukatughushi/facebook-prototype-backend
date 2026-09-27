import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reel, ReelDocument } from './schemas/reel.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ReactionType, applyReaction, countReactions, editCommentOrReply, findCommentOrReply } from '../common/reactions';

const PERSON = 'name avatar';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

@Injectable()
export class ReelsService {
  constructor(
    @InjectModel(Reel.name) private reelModel: Model<ReelDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // Client shape: per-type counts + the viewer's own reaction, instead of
  // the full list of who reacted.
  private shape(reel: ReelDocument, viewerId: string) {
    const r = reel.toJSON() as any;
    const reactions: { user: any; type: ReactionType }[] = r.reactions;
    delete r.reactions;
    delete r.shares;
    return {
      ...r,
      reactionCounts: countReactions(reactions),
      reactionsCount: reactions.length,
      myReaction: reactions.find((x) => String(x.user?._id ?? x.user) === viewerId)?.type || null,
      commentsCount: r.comments.reduce((n: number, c: any) => n + 1 + c.replies.length, 0),
      sharesCount: reel.shares.length,
    };
  }

  private async findOrThrow(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Reel not found');
    const reel = await this.reelModel.findById(id);
    if (!reel) throw new NotFoundException('Reel not found');
    return reel;
  }

  private async commentsOf(reel: ReelDocument) {
    await reel.populate([
      { path: 'comments.author', select: PERSON },
      { path: 'comments.replies.author', select: PERSON },
    ]);
    const json = reel.toJSON() as any;
    return { comments: json.comments, commentsCount: json.comments.reduce((n: number, c: any) => n + 1 + c.replies.length, 0) };
  }

  // Newest first, cursor-paginated like the post feed. The Watch feed (no
  // `author`) skips reels the viewer hid and authors they muted.
  async list(viewerId: string, q: { before?: string; limit?: number; author?: string }) {
    const filter: Record<string, unknown> = {};
    if (q.author) {
      if (!Types.ObjectId.isValid(q.author)) return { reels: [], nextCursor: null };
      filter.author = new Types.ObjectId(q.author);
    } else {
      const prefs = await this.userModel.findById(viewerId).select('hiddenReels mutedReelAuthors').lean();
      if (prefs?.hiddenReels?.length) filter._id = { $nin: prefs.hiddenReels };
      if (prefs?.mutedReelAuthors?.length) filter.author = { $nin: prefs.mutedReelAuthors };
    }
    if (q.before) {
      const before = new Date(q.before);
      if (isNaN(before.getTime())) throw new BadRequestException('Invalid cursor');
      filter.createdAt = { $lt: before };
    }
    const limit = Math.min(Math.max(Number(q.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const reels = await this.reelModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', PERSON)
      .populate('comments.author', PERSON)
      .populate('comments.replies.author', PERSON);
    return {
      reels: reels.map((r) => this.shape(r, viewerId)),
      nextCursor: reels.length === limit ? reels[reels.length - 1].createdAt!.toISOString() : null,
    };
  }

  // "Not interested": keep this reel out of the viewer's Watch feed.
  async hide(id: string, viewerId: string) {
    const reel = await this.findOrThrow(id);
    await this.userModel.updateOne({ _id: viewerId }, { $addToSet: { hiddenReels: reel._id } });
    return { message: 'Reel hidden', reelId: reel._id };
  }

  async unhide(id: string, viewerId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Reel not found');
    await this.userModel.updateOne({ _id: viewerId }, { $pull: { hiddenReels: new Types.ObjectId(id) } });
    return { message: 'Reel restored', reelId: id };
  }

  // "Mute author": hide every reel from this person in the Watch feed.
  async muteAuthor(authorId: string, viewerId: string) {
    if (!Types.ObjectId.isValid(authorId)) throw new NotFoundException('User not found');
    if (authorId === viewerId) throw new BadRequestException("You can't mute yourself");
    await this.userModel.updateOne({ _id: viewerId }, { $addToSet: { mutedReelAuthors: new Types.ObjectId(authorId) } });
    return { message: 'Author muted', authorId };
  }

  async unmuteAuthor(authorId: string, viewerId: string) {
    if (!Types.ObjectId.isValid(authorId)) throw new NotFoundException('User not found');
    await this.userModel.updateOne({ _id: viewerId }, { $pull: { mutedReelAuthors: new Types.ObjectId(authorId) } });
    return { message: 'Author unmuted', authorId };
  }

  // One reel (deep links to reels older than the first page of the feed).
  async findOne(id: string, viewerId: string) {
    const reel = await this.findOrThrow(id);
    await reel.populate([
      { path: 'author', select: PERSON },
      { path: 'comments.author', select: PERSON },
      { path: 'comments.replies.author', select: PERSON },
    ]);
    return { reel: this.shape(reel, viewerId) };
  }

  // Set/switch/remove the viewer's reaction (same type again removes it).
  async react(id: string, viewerId: string, type?: ReactionType | null) {
    const reel = await this.findOrThrow(id);
    applyReaction(reel, viewerId, type, true);
    await reel.save();
    const s = this.shape(reel, viewerId);
    return { reactionCounts: s.reactionCounts, reactionsCount: s.reactionsCount, myReaction: s.myReaction };
  }

  async addComment(id: string, viewerId: string, content: string) {
    const reel = await this.findOrThrow(id);
    reel.comments.push({ author: new Types.ObjectId(viewerId), content: content.trim() } as any);
    await reel.save();
    return this.commentsOf(reel);
  }

  async addReply(id: string, commentId: string, viewerId: string, content: string) {
    const reel = await this.findOrThrow(id);
    const comment = (reel.comments as any).id(commentId);
    if (!comment) throw new NotFoundException('Comment not found');
    comment.replies.push({ author: new Types.ObjectId(viewerId), content: content.trim() });
    await reel.save();
    return this.commentsOf(reel);
  }

  async reactToComment(id: string, commentId: string, viewerId: string, type?: ReactionType | null) {
    const reel = await this.findOrThrow(id);
    const found = findCommentOrReply(reel, commentId);
    if (!found) throw new NotFoundException('Comment not found');
    applyReaction(found.target, viewerId, type);
    await reel.save();
    return this.commentsOf(reel);
  }

  async editComment(id: string, commentId: string, viewerId: string, content: string) {
    const reel = await this.findOrThrow(id);
    editCommentOrReply(reel, commentId, viewerId, content);
    await reel.save();
    return this.commentsOf(reel);
  }

  // Called once per reel per session by the player.
  async view(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Reel not found');
    const reel = await this.reelModel.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
    if (!reel) throw new NotFoundException('Reel not found');
    return { views: reel.views };
  }
}
