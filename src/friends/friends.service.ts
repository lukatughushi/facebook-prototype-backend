import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../common/gateway/realtime.gateway';

const PUBLIC_FIELDS = 'name avatar bio';

// Demo activity: every AUTO_FRIEND_REQUEST_INTERVAL_MS (default 60s) each
// signed-in (socket-connected) real user gets a friend request from a random
// seeded user they aren't connected to yet. Stops topping up once a user has
// AUTO_FRIEND_REQUEST_MAX_PENDING pending requests. AUTO_FRIEND_REQUESTS=false
// turns it off.
const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MAX_PENDING = 20;

@Injectable()
export class FriendsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FriendsService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: RealtimeGateway,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get('AUTO_FRIEND_REQUESTS') === 'false') return;
    const interval = Number(this.config.get('AUTO_FRIEND_REQUEST_INTERVAL_MS')) || DEFAULT_INTERVAL_MS;
    this.timer = setInterval(() => this.sendAutoRequests(), interval);
    this.logger.log(`Auto friend requests every ${interval / 1000}s`);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async sendAutoRequests() {
    if (this.ticking) return;
    this.ticking = true;
    const maxPending = Number(this.config.get('AUTO_FRIEND_REQUEST_MAX_PENDING')) || DEFAULT_MAX_PENDING;
    try {
      for (const userId of this.gateway.onlineUserIds()) {
        if (!Types.ObjectId.isValid(userId)) continue;
        const target = await this.userModel.findById(userId).select('+seeded friends friendRequests');
        if (!target || target.seeded || target.friendRequests.length >= maxPending) continue;

        const targetId = target._id as Types.ObjectId;
        const exclude = [targetId, ...target.friends, ...target.friendRequests.map((r) => r.from)];
        const [candidate] = await this.userModel.aggregate([
          {
            $match: {
              seeded: true,
              isActive: { $ne: false },
              _id: { $nin: exclude },
              // skip people this user has already sent a request to
              'friendRequests.from': { $ne: targetId },
            },
          },
          { $sample: { size: 1 } },
          { $project: { _id: 1 } },
        ]);
        if (candidate) await this.sendRequest(candidate._id.toString(), userId);
      }
    } catch (err) {
      this.logger.warn(`Auto friend request failed: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  private async getUserOrThrow(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async sendRequest(fromId: string, toId: string) {
    if (fromId === toId) throw new BadRequestException('You cannot friend yourself');

    const [from, to] = await Promise.all([this.getUserOrThrow(fromId), this.getUserOrThrow(toId)]);

    if (to.friends.some((id) => id.toString() === fromId)) {
      throw new BadRequestException('You are already friends');
    }
    if (to.friendRequests.some((r) => r.from.toString() === fromId)) {
      throw new BadRequestException('Friend request already sent');
    }
    if (from.friendRequests.some((r) => r.from.toString() === toId)) {
      throw new BadRequestException('This user already sent you a request - accept it instead');
    }

    to.friendRequests.push({ from: new Types.ObjectId(fromId) } as any);
    await to.save();

    await this.notificationsService.notify(toId, fromId, 'friend_request');
    return { message: 'Friend request sent' };
  }

  async cancelRequest(fromId: string, toId: string) {
    const to = await this.getUserOrThrow(toId);
    to.friendRequests = to.friendRequests.filter((r) => r.from.toString() !== fromId) as any;
    await to.save();
    await this.notificationsService.resolveFriendRequest(toId, fromId, 'removed');
    return { message: 'Friend request cancelled' };
  }

  async acceptRequest(currentUserId: string, requesterId: string) {
    const [me, requester] = await Promise.all([
      this.getUserOrThrow(currentUserId),
      this.getUserOrThrow(requesterId),
    ]);

    const hasRequest = me.friendRequests.some((r) => r.from.toString() === requesterId);
    if (!hasRequest) {
      // Stale notification (request already handled): bring it up to date.
      const alreadyFriends = me.friends.some((id) => id.toString() === requesterId);
      await this.notificationsService.resolveFriendRequest(currentUserId, requesterId, alreadyFriends ? 'accepted' : 'removed');
      throw new BadRequestException('No pending request from this user');
    }

    me.friendRequests = me.friendRequests.filter((r) => r.from.toString() !== requesterId) as any;
    if (!me.friends.some((id) => id.toString() === requesterId)) {
      me.friends.push(new Types.ObjectId(requesterId));
    }
    if (!requester.friends.some((id) => id.toString() === currentUserId)) {
      requester.friends.push(new Types.ObjectId(currentUserId));
    }

    await Promise.all([me.save(), requester.save()]);
    const unreadCount = await this.notificationsService.resolveFriendRequest(currentUserId, requesterId, 'accepted');
    await this.notificationsService.notify(requesterId, currentUserId, 'friend_accept');
    return { message: 'Friend request accepted', unreadCount };
  }

  async rejectRequest(currentUserId: string, requesterId: string) {
    const me = await this.getUserOrThrow(currentUserId);
    me.friendRequests = me.friendRequests.filter((r) => r.from.toString() !== requesterId) as any;
    await me.save();
    const unreadCount = await this.notificationsService.resolveFriendRequest(currentUserId, requesterId, 'removed');
    return { message: 'Friend request rejected', unreadCount };
  }

  async removeFriend(currentUserId: string, otherId: string) {
    const [me, other] = await Promise.all([this.getUserOrThrow(currentUserId), this.getUserOrThrow(otherId)]);

    me.friends = me.friends.filter((id) => id.toString() !== otherId) as any;
    other.friends = other.friends.filter((id) => id.toString() !== currentUserId) as any;

    await Promise.all([me.save(), other.save()]);
    return { message: 'Friend removed' };
  }

  async listFriends(userId: string) {
    const user = await this.userModel.findById(userId).populate('friends', PUBLIC_FIELDS);
    return { friends: user?.friends || [] };
  }

  async listRequests(userId: string) {
    const user = await this.userModel.findById(userId).populate('friendRequests.from', PUBLIC_FIELDS);
    return { requests: user?.friendRequests || [] };
  }

  // Relationship of `viewerId` towards `targetId`, used by the frontend to
  // render the right button: Add Friend / Friends / Accept-Reject / Sent.
  async getRelationship(viewerId: string, targetId: string) {
    if (viewerId === targetId) return { status: 'self' };

    const [viewer, target] = await Promise.all([this.getUserOrThrow(viewerId), this.getUserOrThrow(targetId)]);

    if (viewer.friends.some((id) => id.toString() === targetId)) {
      return { status: 'friends' };
    }
    if (target.friendRequests.some((r) => r.from.toString() === viewerId)) {
      return { status: 'request_sent' };
    }
    if (viewer.friendRequests.some((r) => r.from.toString() === targetId)) {
      return { status: 'request_received' };
    }
    return { status: 'none' };
  }
}
