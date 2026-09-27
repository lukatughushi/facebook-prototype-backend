import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationType = 'like' | 'comment' | 'share' | 'friend_request' | 'friend_accept';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ enum: ['like', 'comment', 'share', 'friend_request', 'friend_accept'], required: true })
  type: NotificationType;

  @Prop({ type: Types.ObjectId, ref: 'Post' })
  post?: Types.ObjectId;

  @Prop({ default: false })
  read: boolean;

  // friend_request only: set once the recipient confirms it (declined or
  // cancelled requests have their notification deleted instead).
  @Prop({ enum: ['accepted'] })
  status?: 'accepted';

  createdAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
