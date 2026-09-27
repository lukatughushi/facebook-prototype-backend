import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RealtimeGateway } from '../common/gateway/realtime.gateway';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';

const SENDER_FIELDS = 'name avatar';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private readonly gateway: RealtimeGateway,
  ) {}

  // Called by other modules (Posts, Friends) when something notification-worthy
  // happens. Never notifies a user about their own action.
  async notify(recipientId: string, senderId: string, type: NotificationType, postId?: string) {
    if (recipientId === senderId) return;

    const notification = await this.notificationModel.create({
      recipient: recipientId,
      sender: senderId,
      type,
      post: postId,
    });
    const populated = await notification.populate('sender', SENDER_FIELDS);

    const unreadCount = await this.notificationModel.countDocuments({ recipient: recipientId, read: false });
    this.gateway.emitToUser(recipientId, 'notification', { notification: populated, unreadCount });
  }

  async list(userId: string) {
    const notifications = await this.notificationModel
      .find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('sender', SENDER_FIELDS);
    return { notifications };
  }

  async unreadCount(userId: string) {
    const count = await this.notificationModel.countDocuments({ recipient: userId, read: false });
    return { count };
  }

  async markRead(id: string, userId: string) {
    await this.notificationModel.updateOne({ _id: id, recipient: userId }, { read: true });
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string) {
    await this.notificationModel.updateMany({ recipient: userId, read: false }, { read: true });
    return { message: 'All notifications marked as read' };
  }

  async remove(id: string, userId: string) {
    await this.notificationModel.deleteOne({ _id: id, recipient: userId });
    return this.unreadCount(userId);
  }

  // Keeps friend_request notifications in step with the request itself:
  // accepted -> marked read + status 'accepted'; rejected/cancelled -> deleted.
  // Pushes the new unread count so every open tab updates its badge.
  async resolveFriendRequest(recipientId: string, senderId: string, outcome: 'accepted' | 'removed') {
    const filter = { recipient: recipientId, sender: senderId, type: 'friend_request' };
    if (outcome === 'accepted') {
      await this.notificationModel.updateMany(filter, { read: true, status: 'accepted' });
    } else {
      await this.notificationModel.deleteMany(filter);
    }
    const { count } = await this.unreadCount(recipientId);
    this.gateway.emitToUser(recipientId, 'notifications:sync', { unreadCount: count });
    return count;
  }

  async clearAll(userId: string) {
    await this.notificationModel.deleteMany({ recipient: userId });
    return { count: 0 };
  }
}
