import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../common/gateway/realtime.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  imports: [UsersModule, NotificationsModule, RealtimeModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
