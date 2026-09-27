import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { Story, StorySchema } from './schemas/story.schema';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Story.name, schema: StorySchema }]), UsersModule],
  controllers: [StoriesController],
  providers: [StoriesService],
})
export class StoriesModule {}
