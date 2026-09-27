import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StoryDocument = HydratedDocument<Story>;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Story {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  author: Types.ObjectId;

  @Prop({ required: true })
  image: string;

  @Prop({ default: '', maxlength: 300 })
  text: string;

  @Prop({ required: true, default: () => new Date(Date.now() + TWENTY_FOUR_HOURS_MS) })
  expiresAt: Date;

  createdAt?: Date;
}

export const StorySchema = SchemaFactory.createForClass(Story);

// TTL index - MongoDB automatically deletes a story once expiresAt is reached.
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
