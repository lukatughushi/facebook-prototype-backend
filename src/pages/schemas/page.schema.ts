import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PageDocument = HydratedDocument<Page>;

@Schema({ timestamps: true })
export class Page {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  // e.g. "Brand", "Community", "Public figure".
  @Prop({ default: 'Community', trim: true })
  category: string;

  @Prop({ default: '', maxlength: 1000 })
  description: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: '' })
  coverImage: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true })
  followers: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  admins: Types.ObjectId[];

  // Marks mock data so the mock seed can remove only what it created.
  @Prop({ default: false, select: false })
  seeded: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PageSchema = SchemaFactory.createForClass(Page);
