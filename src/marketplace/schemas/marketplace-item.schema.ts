import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const MARKET_CATEGORIES = ['Electronics', 'Vehicles', 'Apparel', 'Furniture', 'Property', 'Hobbies'] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

export const CONDITIONS = ['New', 'Used - Like new', 'Used - Good', 'Used - Fair'] as const;
export type Condition = (typeof CONDITIONS)[number];

export type MarketplaceItemDocument = HydratedDocument<MarketplaceItem>;

@Schema({ timestamps: true, collection: 'marketplaceitems' })
export class MarketplaceItem {
  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  // Whole currency units (USD).
  @Prop({ required: true, min: 0, index: true })
  price: number;

  @Prop({ required: true, enum: MARKET_CATEGORIES, index: true })
  category: MarketCategory;

  @Prop({ enum: CONDITIONS, default: 'Used - Good' })
  condition: Condition;

  @Prop({ required: true, trim: true, maxlength: 100 })
  location: string;

  @Prop({ default: '', trim: true, maxlength: 2000 })
  description: string;

  // First image is the listing's cover.
  @Prop({ type: [String], default: [] })
  imageUrls: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  seller: Types.ObjectId;

  @Prop({ enum: ['available', 'sold'], default: 'available' })
  status: 'available' | 'sold';

  @Prop({ default: false, select: false })
  seeded: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MarketplaceItemSchema = SchemaFactory.createForClass(MarketplaceItem);
MarketplaceItemSchema.index({ createdAt: -1 });
