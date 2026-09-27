import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  receiver: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  text: string;

  // Set once the receiver has opened the conversation; drives the unread
  // badge on the header's Messages button.
  @Prop({ default: false })
  read: boolean;

  // Marketplace listing the message is about ("Message seller"), shown as a
  // card in the chat.
  @Prop({ type: Types.ObjectId, ref: 'MarketplaceItem' })
  item?: Types.ObjectId;

  createdAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
