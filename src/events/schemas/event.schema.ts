import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EventDocument = HydratedDocument<Event>;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  @Prop({ default: '', trim: true, maxlength: 2000 })
  description: string;

  @Prop({ default: '', trim: true, maxlength: 100 })
  location: string;

  @Prop({ required: true, index: true })
  startsAt: Date;

  @Prop({ default: '' })
  coverImage: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  host: Types.ObjectId;

  // Everyone who RSVP'd "Going" (the host is added on creation).
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  going: Types.ObjectId[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);
