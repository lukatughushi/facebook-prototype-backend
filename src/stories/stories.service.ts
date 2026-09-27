import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryDocument } from './schemas/story.schema';
import { CreateStoryDto } from './dto/create-story.dto';
import { User, UserDocument } from '../users/schemas/user.schema';

const AUTHOR_FIELDS = 'name avatar';
const SAMPLE_AUTHORS = 8;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StoriesService {
  // In-flight top-up, shared so concurrent feed loads don't each insert a batch.
  private refill: Promise<void> | null = null;

  constructor(
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(userId: string, dto: CreateStoryDto, imagePath?: string) {
    if (!imagePath) {
      throw new BadRequestException('A story requires an image');
    }

    const story = await this.storyModel.create({
      author: userId,
      image: imagePath,
      text: dto.text || '',
    });
    const populated = await story.populate('author', AUTHOR_FIELDS);
    return { story: populated };
  }

  async findActive(viewer: UserDocument) {
    await this.ensureSampleStories(viewer);

    // `author` is stored as an ObjectId (seed data) or a string (created in
    // the app), so exclude muted people in both forms.
    const muted = (viewer.mutedUsers || []).map(String);
    const excluded = [...muted, ...muted.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id))];
    const stories = await this.storyModel
      .find({ expiresAt: { $gt: new Date() }, ...(muted.length ? { author: { $nin: excluded } } : {}) })
      .sort({ createdAt: 1 })
      .populate('author', AUTHOR_FIELDS);
    return { stories };
  }

  // Seeded stories expire after 24h (TTL index), so a demo database ends up
  // with none a day after `npm run seed:mock`. When nobody but the viewer
  // has a live story, post a fresh batch from their friends (falling back
  // to any other users). Rows are marked `seeded` so the seed script's
  // cleanup removes them too.
  private async ensureSampleStories(viewer: UserDocument) {
    if (!this.refill) {
      this.refill = this.topUpStories(viewer).finally(() => (this.refill = null));
    }
    await this.refill;
  }

  private async topUpStories(viewer: UserDocument) {
    const me = (viewer as any)._id as Types.ObjectId;
    const now = Date.now();
    const othersLive = await this.storyModel.exists({
      expiresAt: { $gt: new Date(now) },
      author: { $nin: [me, me.toString()] },
    });
    if (othersLive) return;

    const toIds = (ids: unknown[] = []) =>
      ids.map(String).filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const muted = toIds(viewer.mutedUsers);
    const pickAuthors = (match: object) =>
      this.userModel.aggregate<{ _id: Types.ObjectId }>([
        { $match: { ...match, _id: { $nin: [me, ...muted] } } },
        { $sample: { size: SAMPLE_AUTHORS } },
        { $project: { _id: 1 } },
      ]);
    let authors = await pickAuthors({ _id: { $in: toIds(viewer.friends) } });
    if (!authors.length) authors = await pickAuthors({});
    if (!authors.length) return;

    const docs = authors.flatMap(({ _id }, i) =>
      Array.from({ length: 1 + Math.floor(Math.random() * 3) }, (_, j) => {
        const createdAt = new Date(now - (5 + Math.floor(Math.random() * 600)) * 60000);
        return {
          author: _id,
          image: `https://picsum.photos/seed/story-${now}-${i}-${j}/540/960`,
          text: '',
          createdAt,
          expiresAt: new Date(createdAt.getTime() + TWENTY_FOUR_HOURS_MS),
          seeded: true,
          __v: 0,
        };
      }),
    );
    // Raw insert: the schema would drop `seeded` and overwrite createdAt.
    await this.storyModel.collection.insertMany(docs);
  }

  async setMuted(user: UserDocument, targetId: string, muted: boolean) {
    if (!Types.ObjectId.isValid(targetId)) throw new NotFoundException('User not found');
    const me = (user as any)._id.toString();
    if (targetId === me) throw new BadRequestException("You can't mute your own stories");
    if (muted && !(await this.userModel.exists({ _id: targetId }))) throw new NotFoundException('User not found');

    const oid = new Types.ObjectId(targetId);
    const update = muted ? { $addToSet: { mutedUsers: oid } } : { $pull: { mutedUsers: { $in: [oid, targetId] } } };
    const updated = await this.userModel.findByIdAndUpdate(me, update, { new: true }).select('mutedUsers');
    return { mutedUsers: updated?.mutedUsers || [] };
  }

  async remove(storyId: string, user: UserDocument) {
    const story = await this.storyModel.findById(storyId);
    if (!story) throw new NotFoundException('Story not found');

    const isOwner = story.author.toString() === (user as any)._id.toString();
    if (!isOwner && user.role !== 'admin') {
      throw new ForbiddenException('Not authorized to delete this story');
    }

    await story.deleteOne();
    return { message: 'Story deleted' };
  }
}
