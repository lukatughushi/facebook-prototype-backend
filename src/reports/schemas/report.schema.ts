import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReportDocument = HydratedDocument<Report>;

export const REPORT_CONTENT_TYPES = [
  'post',
  'photo',
  'video',
  'reel',
  'marketplace',
  'group',
  'page',
  'profile',
  'comment',
] as const;
export type ReportContentType = (typeof REPORT_CONTENT_TYPES)[number];

export const REPORT_REASONS = [
  'harassment',
  'spam',
  'hate_speech',
  'nudity',
  'false_information',
  'intellectual_property',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// Where a reported comment lives, so reviewers can open it in context.
export const REPORT_PARENT_TYPES = ['post', 'reel'] as const;

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reporterId: Types.ObjectId;

  @Prop({ required: true, enum: REPORT_CONTENT_TYPES })
  contentType: ReportContentType;

  // Id of the reported document; not a ref since it spans several collections.
  @Prop({ type: Types.ObjectId, required: true, index: true })
  targetId: Types.ObjectId;

  @Prop({ type: String, enum: REPORT_PARENT_TYPES })
  parentType?: (typeof REPORT_PARENT_TYPES)[number];

  @Prop({ type: Types.ObjectId })
  parentId?: Types.ObjectId;

  @Prop({ required: true, enum: REPORT_REASONS })
  reason: ReportReason;

  // The reporter's own description of the problem (optional).
  @Prop({ default: '', trim: true, maxlength: 1000 })
  comment: string;

  @Prop({ default: 'pending', enum: ['pending', 'resolved'], index: true })
  status: 'pending' | 'resolved';

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
// Lookup for "has this person already reported this, still pending?".
ReportSchema.index({ reporterId: 1, contentType: 1, targetId: 1 });
