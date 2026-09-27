import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Comment, CommentSchema, Reaction, ReactionSchema, mergeLegacyLikes, serializeComments } from '../../common/reactions';

@Schema({ _id: false })
export class MusicTrack {
  @Prop({ trim: true, default: 'Original audio' })
  title: string;

  @Prop({ trim: true, default: '' })
  artist: string;
}

export const MusicTrackSchema = SchemaFactory.createForClass(MusicTrack);

export type ReelDocument = HydratedDocument<Reel>;

// A short vertical video for the Watch tab.
@Schema({ timestamps: true })
export class Reel {
  @Prop({ required: true })
  videoUrl: string;

  // Still frame shown before the video loads.
  @Prop({ default: '' })
  posterUrl: string;

  @Prop({ default: '', trim: true, maxlength: 300 })
  caption: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  author: Types.ObjectId;

  @Prop({ type: [ReactionSchema], default: [] })
  reactions: Reaction[];

  // Everyone who reacted (mirrors `reactions`; older data only has this).
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likes: Types.ObjectId[];

  // One entry per share; the share posts reference this reel.
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  shares: Types.ObjectId[];

  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];

  @Prop({ type: MusicTrackSchema, default: () => ({}) })
  musicTrack: MusicTrack;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: false, select: false })
  seeded: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReelSchema = SchemaFactory.createForClass(Reel);
ReelSchema.index({ createdAt: -1 });

ReelSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    ret.reactions = mergeLegacyLikes(ret);
    delete ret.likes;
    ret.comments = serializeComments(ret.comments);
    return ret;
  },
});
