import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { RealtimeModule } from '../common/gateway/realtime.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { Message, MessageSchema } from './schemas/message.schema';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]), UsersModule, RealtimeModule, MarketplaceModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
