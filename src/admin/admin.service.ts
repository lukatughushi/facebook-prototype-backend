import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
  ) {}

  async getStats() {
    const [totalUsers, totalPosts, commentAgg, activeUsers, totalAdmins] = await Promise.all([
      this.userModel.countDocuments(),
      this.postModel.countDocuments(),
      this.postModel.aggregate([
        { $project: { commentCount: { $size: '$comments' } } },
        { $group: { _id: null, totalComments: { $sum: '$commentCount' } } },
      ]),
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({ role: 'admin' }),
    ]);

    return {
      totalUsers,
      totalPosts,
      totalComments: commentAgg[0]?.totalComments || 0,
      activeUsers,
      blockedUsers: totalUsers - activeUsers,
      totalAdmins,
    };
  }

  async listUsers() {
    const users = await this.userModel.find().sort({ createdAt: -1 });
    return { users };
  }

  async toggleUserStatus(targetId: string, requesterId: string) {
    if (targetId === requesterId) {
      throw new BadRequestException('You cannot block your own account');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');

    user.isActive = !user.isActive;
    await user.save();
    return { user };
  }

  async changeUserRole(targetId: string, requesterId: string, dto: UpdateRoleDto) {
    if (targetId === requesterId) {
      throw new BadRequestException('You cannot change your own role');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');

    user.role = dto.role;
    await user.save();
    return { user };
  }

  async deleteUser(targetId: string, requesterId: string) {
    if (targetId === requesterId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');

    await Promise.all([this.postModel.deleteMany({ author: user._id }), user.deleteOne()]);
    return { message: 'User deleted' };
  }

  async listPosts() {
    const posts = await this.postModel.find().sort({ createdAt: -1 }).populate('author', 'name avatar email');
    return { posts };
  }

  async deletePost(postId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    await post.deleteOne();
    return { message: 'Post deleted' };
  }
}
