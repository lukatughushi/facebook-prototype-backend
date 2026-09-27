import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { MARKET_CATEGORIES, MarketplaceItem, MarketplaceItemDocument } from './schemas/marketplace-item.schema';
import { CreateListingDto } from './dto/create-listing.dto';

const SELLER_LIST = 'name avatar';
const SELLER_DETAIL = 'name avatar city createdAt';
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ListingQuery {
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  seller?: string;
  limit?: string;
}

@Injectable()
export class MarketplaceService {
  constructor(@InjectModel(MarketplaceItem.name) private itemModel: Model<MarketplaceItemDocument>) {}

  private async findOrThrow(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Listing not found');
    const item = await this.itemModel.findById(id);
    if (!item) throw new NotFoundException('Listing not found');
    return item;
  }

  private assertOwner(item: MarketplaceItemDocument, user: UserDocument, allowAdmin = false) {
    const isOwner = item.seller.toString() === (user as any)._id.toString();
    if (!isOwner && !(allowAdmin && user.role === 'admin')) {
      throw new ForbiddenException('Only the seller can change this listing');
    }
  }

  // Newest first. Search matches title/description; price bounds inclusive.
  async list(q: ListingQuery) {
    const filter: Record<string, unknown> = {};
    if (q.q?.trim()) {
      const rx = { $regex: escapeRegex(q.q.trim()), $options: 'i' };
      filter.$or = [{ title: rx }, { description: rx }, { location: rx }];
    }
    if (q.category && q.category !== 'All') {
      if (!(MARKET_CATEGORIES as readonly string[]).includes(q.category)) throw new BadRequestException('Unknown category');
      filter.category = q.category;
    }
    const min = q.minPrice !== undefined && q.minPrice !== '' ? Number(q.minPrice) : undefined;
    const max = q.maxPrice !== undefined && q.maxPrice !== '' ? Number(q.maxPrice) : undefined;
    if ((min !== undefined && isNaN(min)) || (max !== undefined && isNaN(max))) throw new BadRequestException('Invalid price');
    if (min !== undefined || max !== undefined) {
      filter.price = { ...(min !== undefined ? { $gte: min } : {}), ...(max !== undefined ? { $lte: max } : {}) };
    }
    if (q.seller) {
      if (!Types.ObjectId.isValid(q.seller)) return { items: [] };
      filter.seller = new Types.ObjectId(q.seller);
    }
    const limit = Math.min(Math.max(Number(q.limit) || 60, 1), 100);
    const items = await this.itemModel.find(filter).sort({ createdAt: -1 }).limit(limit).populate('seller', SELLER_LIST);
    return { items };
  }

  async findOne(id: string) {
    const item = await this.findOrThrow(id);
    await item.populate('seller', SELLER_DETAIL);
    return { item };
  }

  async create(userId: string, dto: CreateListingDto, files: Express.Multer.File[] = []) {
    if (!files.length) throw new BadRequestException('Add at least one photo');
    const item = await this.itemModel.create({
      ...dto,
      description: dto.description || '',
      imageUrls: files.map((f) => `/uploads/${f.filename}`),
      seller: new Types.ObjectId(userId),
    });
    await item.populate('seller', SELLER_DETAIL);
    return { item };
  }

  async setStatus(id: string, user: UserDocument, status: 'available' | 'sold') {
    const item = await this.findOrThrow(id);
    this.assertOwner(item, user);
    item.status = status;
    await item.save();
    await item.populate('seller', SELLER_DETAIL);
    return { item };
  }

  async remove(id: string, user: UserDocument) {
    const item = await this.findOrThrow(id);
    this.assertOwner(item, user, true);
    await item.deleteOne();
    return { message: 'Listing deleted' };
  }

  // Used by messaging: is `sellerId` the seller of listing `itemId`?
  async isSeller(itemId: string, sellerId: string) {
    if (!Types.ObjectId.isValid(itemId)) return false;
    return !!(await this.itemModel.exists({ _id: itemId, seller: new Types.ObjectId(sellerId) }));
  }
}
