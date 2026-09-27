import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Page, PageDocument } from './schemas/page.schema';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (ids: Types.ObjectId[] = [], id: string) => ids.some((x) => x.toString() === id);

@Injectable()
export class PagesService {
  constructor(@InjectModel(Page.name) private pageModel: Model<PageDocument>) {}

  private summary(p: PageDocument, viewerId: string) {
    return {
      _id: p._id,
      name: p.name,
      category: p.category,
      description: p.description,
      avatar: p.avatar,
      coverImage: p.coverImage,
      followerCount: p.followers.length,
      isFollowing: has(p.followers, viewerId),
      isAdmin: has(p.admins, viewerId),
      createdAt: p.createdAt,
    };
  }

  async list(viewerId: string, opts: { mine?: boolean; q?: string }) {
    const filter: Record<string, unknown> = {};
    if (opts.mine) filter.followers = new Types.ObjectId(viewerId);
    if (opts.q?.trim()) filter.name = { $regex: escapeRegex(opts.q.trim()), $options: 'i' };
    const pages = await this.pageModel.find(filter).limit(100);
    return {
      pages: pages
        .map((p) => this.summary(p, viewerId))
        .sort((a, b) => Number(b.isFollowing) - Number(a.isFollowing) || b.followerCount - a.followerCount),
    };
  }

  async findOne(id: string, viewerId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Page not found');
    const page = await this.pageModel.findById(id);
    if (!page) throw new NotFoundException('Page not found');
    const summary = this.summary(page, viewerId);
    await page.populate([
      { path: 'admins', select: 'name avatar' },
      { path: 'followers', select: 'name avatar', perDocumentLimit: 12 },
    ]);
    return { page: { ...summary, admins: page.admins, previewFollowers: page.followers } };
  }

  async toggleFollow(id: string, viewerId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Page not found');
    const page = await this.pageModel.findById(id);
    if (!page) throw new NotFoundException('Page not found');
    const oid = new Types.ObjectId(viewerId);
    const update = has(page.followers, viewerId) ? { $pull: { followers: oid } } : { $addToSet: { followers: oid } };
    const updated = await this.pageModel.findByIdAndUpdate(id, update, { new: true });
    return { page: this.summary(updated as PageDocument, viewerId) };
  }

  async isAdmin(pageId: string, viewerId: string) {
    if (!Types.ObjectId.isValid(pageId)) return false;
    return !!(await this.pageModel.exists({ _id: pageId, admins: new Types.ObjectId(viewerId) }));
  }
}
