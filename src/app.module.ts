import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { FriendsModule } from './friends/friends.module';
import { MessagesModule } from './messages/messages.module';
import { StoriesModule } from './stories/stories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GroupsModule } from './groups/groups.module';
import { PagesModule } from './pages/pages.module';
import { ReelsModule } from './reels/reels.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { EventsModule } from './events/events.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // MONGO_URI is the preferred name; MONGODB_URI still works for older .env files.
        const uri = configService.get<string>('MONGO_URI') || configService.get<string>('MONGODB_URI');
        // Atlas' "Connect" dialog hands out URIs without a database path
        // (".../?retryWrites=true"), which silently connects to an empty "test"
        // database. Only when the URI names no database, fall back to
        // MONGO_DB_NAME or the app's own database.
        const hasDbInUri = /^mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(uri || '');
        return {
          uri,
          ...(hasDbInUri ? {} : { dbName: configService.get<string>('MONGO_DB_NAME') || 'facebook-clone' }),
        };
      },
    }),
    UsersModule,
    AuthModule,
    PostsModule,
    AdminModule,
    FriendsModule,
    MessagesModule,
    StoriesModule,
    NotificationsModule,
    GroupsModule,
    PagesModule,
    ReelsModule,
    MarketplaceModule,
    EventsModule,
    ReportsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
