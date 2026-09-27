import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { GroupsModule } from '../groups/groups.module';
import { PagesModule } from '../pages/pages.module';
import { Post, PostSchema } from './schemas/post.schema';
import { Reel, ReelSchema } from '../reels/schemas/reel.schema';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  // Reel is registered here too (for sharing reels) so ReelsModule can
  // import PostsModule without a circular dependency.
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Reel.name, schema: ReelSchema },
    ]),
    NotificationsModule,
    GroupsModule,
    PagesModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [MongooseModule, PostsService],
})
export class PostsModule {}
