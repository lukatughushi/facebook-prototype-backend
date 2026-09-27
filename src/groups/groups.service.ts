import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from './schemas/group.schema';
import { CreateGroupDto } from './dto/create-group.dto';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (ids: Types.ObjectId[] = [], id: string) => ids.some((x) => x.toString() === id);

@Injectable()
export class GroupsService {
  constructor(@InjectModel(Group.name) private groupModel: Model<GroupDocument>) {}

  // Summary shape shared by list and detail: counts instead of id arrays.
  private summary(g: GroupDocument, viewerId: string) {
    return {
      _id: g._id,
      name: g.name,
      description: g.description,
      category: g.category,
      privacy: g.privacy,
      coverImage: g.coverImage,
      memberCount: g.members.length,
      isMember: has(g.members, viewerId),
      isAdmin: has(g.admins, viewerId),
      createdAt: g.createdAt,
    };
  }

  async list(viewerId: string, opts: { mine?: boolean; q?: string }) {
    const filter: Record<string, unknown> = {};
    if (opts.mine) filter.members = new Types.ObjectId(viewerId);
    if (opts.q?.trim()) filter.name = { $regex: escapeRegex(opts.q.trim()), $options: 'i' };
    const groups = await this.groupModel.find(filter).limit(100);
    return {
      groups: groups
        .map((g) => this.summary(g, viewerId))
        .sort((a, b) => Number(b.isMember) - Number(a.isMember) || b.memberCount - a.memberCount),
    };
  }

  async findOne(id: string, viewerId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Group not found');
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Group not found');
    const summary = this.summary(group, viewerId);
    await group.populate([
      { path: 'admins', select: 'name avatar' },
      { path: 'members', select: 'name avatar', perDocumentLimit: 12 },
    ]);
    return { group: { ...summary, admins: group.admins, previewMembers: group.members } };
  }

  async create(viewerId: string, dto: CreateGroupDto, coverImage: string) {
    const me = new Types.ObjectId(viewerId);
    const group = await this.groupModel.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      category: dto.category?.trim() || 'Community',
      privacy: dto.privacy || 'public',
      coverImage,
      members: [me],
      admins: [me],
    });
    return { group: this.summary(group, viewerId) };
  }

  async join(id: string, viewerId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Group not found');
    const group = await this.groupModel.findByIdAndUpdate(
      id,
      { $addToSet: { members: new Types.ObjectId(viewerId) } },
      { new: true },
    );
    if (!group) throw new NotFoundException('Group not found');
    return { group: this.summary(group, viewerId) };
  }

  async leave(id: string, viewerId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Group not found');
    const oid = new Types.ObjectId(viewerId);
    const group = await this.groupModel.findByIdAndUpdate(id, { $pull: { members: oid, admins: oid } }, { new: true });
    if (!group) throw new NotFoundException('Group not found');
    return { group: this.summary(group, viewerId) };
  }

  // Private groups the viewer can't see into (used to filter feeds).
  async hiddenGroupIds(viewerId: string) {
    return this.groupModel.find({ privacy: 'private', members: { $ne: new Types.ObjectId(viewerId) } }).distinct('_id');
  }

  async isPrivate(groupId: string) {
    return !!(await this.groupModel.exists({ _id: groupId, privacy: 'private' }));
  }

  async isMember(groupId: string, viewerId: string) {
    if (!Types.ObjectId.isValid(groupId)) return false;
    return !!(await this.groupModel.exists({ _id: groupId, members: new Types.ObjectId(viewerId) }));
  }
}
