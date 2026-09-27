import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  Comment,
  CommentSchema,
  Reaction,
  ReactionSchema,
  mergeLegacyLikes,
  serializeComments,
} from '../../common/reactions';

export { REACTION_TYPES, ReactionType } from '../../common/reactions';

export const AUDIENCES = ['Public', 'Friends'] as const;
export type Audience = (typeof AUDIENCES)[number];

export type PostDocument = HydratedDocument<Post>;

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ trim: true, maxlength: 5000, default: '' })
  content: string;

  @Prop({ default: '' })
  image: string;

  @Prop({ enum: AUDIENCES, default: 'Public' })
  audience: Audience;

  // Set when the post was made inside a group ("Author ▸ Group").
  @Prop({ type: Types.ObjectId, ref: 'Group', index: true })
  group?: Types.ObjectId;

  // Set when the post was published as a page; `author` is then the page
  // admin who wrote it, and clients show the page as the poster.
  @Prop({ type: Types.ObjectId, ref: 'Page', index: true })
  page?: Types.ObjectId;

  // A share: this post re-publishes another post or a reel (always the
  // original - sharing a share points at its root). If the original is later
  // deleted the reference stays and clients show "content unavailable".
  @Prop({ type: Types.ObjectId, ref: 'Post', index: true })
  sharedPost?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Reel', index: true })
  sharedReel?: Types.ObjectId;

  // Set on the posts created automatically when someone changes their
  // profile picture or cover photo (clients show "updated their ...").
  @Prop({ enum: ['avatar', 'cover'] })
  profileUpdate?: 'avatar' | 'cover';

  // Created on demand for a profile/cover photo that predates photo posts, so
  // it can be reacted to / commented on. Reachable by id, never listed in feeds.
  @Prop({ default: false })
  hiddenFromFeed?: boolean;

  @Prop({ default: false, select: false })
  seeded: boolean;

  // Users who reacted with any type. Kept in sync with `reactions` so older
  // readers (admin stats, seed data) keep working.
  // `ref` must sit on the @Prop itself (not nested inside the array
  // element) for populate() to recognize this as a ref array.
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likes: Types.ObjectId[];

  @Prop({ type: [ReactionSchema], default: [] })
  reactions: Reaction[];

  // One entry per share (a user who shares twice counts twice, as on
  // Facebook); the share posts themselves reference this post.
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  shares: Types.ObjectId[];

  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];

  // Set when the author edits the text (clients show "(edited)"); kept
  // separate from updatedAt, which reactions and comments also bump.
  @Prop()
  editedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ createdAt: -1 });

// A post needs text, an image, or something it shares.
PostSchema.pre('validate', function (next) {
  if (!this.content?.trim() && !this.image && !this.sharedPost && !this.sharedReel) {
    return next(new Error('Post must have text content or an image'));
  }
  next();
});

PostSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    // Posts liked before reactions existed only have `likes`; surface those
    // as "like" reactions so the client has a single source of truth.
    ret.reactions = mergeLegacyLikes(ret);
    ret.comments = serializeComments(ret.comments);
    return ret;
  },
});
