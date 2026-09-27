import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GroupDocument = HydratedDocument<Group>;

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ default: '', maxlength: 1000 })
  description: string;

  // Topic used for browsing, e.g. "Tech", "Sports", "Photography".
  @Prop({ default: 'Community', trim: true })
  category: string;

  @Prop({ enum: ['public', 'private'], default: 'public' })
  privacy: 'public' | 'private';

  @Prop({ default: '' })
  coverImage: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true })
  members: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  admins: Types.ObjectId[];

  // Marks mock data so the mock seed can remove only what it created.
  @Prop({ default: false, select: false })
  seeded: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
