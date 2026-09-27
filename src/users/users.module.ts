import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { PostsModule } from '../posts/posts.module';

@Module({
  // PostsModule doesn't depend on UsersModule, so this import is not circular.
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), PostsModule],
  controllers: [UsersController],
  // Re-exporting MongooseModule lets other modules (Auth, Admin) inject
  // Model<User> just by importing UsersModule, without re-registering the schema.
  exports: [MongooseModule],
})
export class UsersModule {}
