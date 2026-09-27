import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RealtimeGateway } from '../common/gateway/realtime.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';

const SENDER_FIELDS = 'name avatar';
const ITEM_FIELDS = 'title price imageUrls status';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly gateway: RealtimeGateway,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  private threadFilter(a: string, b: string) {
    return {
      $or: [
        { sender: a, receiver: b },
        { sender: b, receiver: a },
      ],
    };
  }

  // Who may talk to whom: friends always; otherwise only inside an existing
  // conversation, or a buyer opening one about the other person's listing.
  private async canMessage(userId: string, otherId: string, itemId?: string) {
    if (!Types.ObjectId.isValid(otherId)) throw new NotFoundException('User not found');
    const [other, user] = await Promise.all([this.userModel.findById(otherId), this.userModel.findById(userId)]);
    if (!other) throw new NotFoundException('User not found');
    if (user?.friends.some((id) => id.toString() === otherId)) return true;
    if (await this.messageModel.exists(this.threadFilter(userId, otherId))) return true;
    return !!itemId && userId !== otherId && (await this.marketplaceService.isSeller(itemId, otherId));
  }

  // One row per person the user has chatted with: the other user, the latest
  // message and how many of their messages are still unread. Newest first.
  async listConversations(userId: string) {
    // sender/receiver may be stored as strings or ObjectIds (the schema's
    // `Types.ObjectId` prop type persists plain strings), so match both and
    // compare as strings.
    const ids = [userId, new Types.ObjectId(userId)];

    const rows = await this.messageModel.aggregate([
      { $match: { $or: [{ sender: { $in: ids } }, { receiver: { $in: ids } }] } },
      { $addFields: { senderStr: { $toString: '$sender' }, receiverStr: { $toString: '$receiver' } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$senderStr', userId] }, '$receiverStr', '$senderStr'] },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: { $cond: [{ $and: [{ $eq: ['$receiverStr', userId] }, { $ne: ['$read', true] }] }, 1, 0] },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      { $addFields: { otherId: { $toObjectId: '$_id' } } },
      { $lookup: { from: 'users', localField: 'otherId', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          user: { _id: '$user._id', name: '$user.name', avatar: '$user.avatar' },
          lastMessage: { _id: '$lastMessage._id', text: '$lastMessage.text', sender: '$lastMessage.senderStr', receiver: '$lastMessage.receiverStr', createdAt: '$lastMessage.createdAt' },
          unreadCount: 1,
        },
      },
    ]);

    const unreadTotal = rows.reduce((sum, row) => sum + row.unreadCount, 0);
    return { conversations: rows, unreadTotal };
  }

  // Non-friends without a conversation just get an empty thread (a buyer
  // opening a chat from Marketplace); nothing private is exposed.
  async getConversation(userId: string, otherId: string) {
    if (!(await this.canMessage(userId, otherId))) return { messages: [] };

    const messages = await this.messageModel
      .find(this.threadFilter(userId, otherId))
      .sort({ createdAt: 1 })
      .populate('sender', SENDER_FIELDS)
      .populate('item', ITEM_FIELDS);

    return { messages };
  }

  // Marks everything `otherId` sent to `userId` as read.
  async markRead(userId: string, otherId: string) {
    const { modifiedCount } = await this.messageModel.updateMany(
      { sender: otherId, receiver: userId, read: { $ne: true } },
      { read: true },
    );
    if (modifiedCount > 0) {
      this.gateway.emitToUser(userId, 'messagesRead', { userId: otherId });
    }
    return { updated: modifiedCount };
  }

  async sendMessage(senderId: string, receiverId: string, dto: SendMessageDto) {
    if (!(await this.canMessage(senderId, receiverId, dto.itemId))) {
      throw new ForbiddenException('You can only message your friends');
    }

    const message = await this.messageModel.create({
      sender: senderId,
      receiver: receiverId,
      text: dto.text.trim(),
      ...(dto.itemId ? { item: new Types.ObjectId(dto.itemId) } : {}),
    });
    const populated = await message.populate([
      { path: 'sender', select: SENDER_FIELDS },
      { path: 'item', select: ITEM_FIELDS },
    ]);

    this.gateway.emitToUser(receiverId, 'newMessage', { message: populated });
    this.gateway.emitToUser(senderId, 'newMessage', { message: populated });

    return { message: populated };
  }
}
