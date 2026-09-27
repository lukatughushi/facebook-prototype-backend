import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostsModule } from '../posts/posts.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Reel, ReelSchema } from './schemas/reel.schema';
import { ReelsController } from './reels.controller';
import { ReelsService } from './reels.service';

@Module({
  // PostsModule provides sharing (a shared reel becomes a post).
  imports: [
    MongooseModule.forFeature([
      { name: Reel.name, schema: ReelSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PostsModule,
  ],
  controllers: [ReelsController],
  providers: [ReelsService],
  exports: [MongooseModule],
})
export class ReelsModule {}
