/**
 * One-off script that populates demo data: an admin account (from
 * ADMIN_EMAIL/ADMIN_PASSWORD in .env), a couple of demo users, and a few
 * posts with likes/comments so the feed isn't empty on first run.
 *
 * Run with: npm run seed
 */
import './dns-fix';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { AppModule } from './app.module';
import { User, UserDocument } from './users/schemas/user.schema';
import { Post, PostDocument } from './posts/schemas/post.schema';

async function upsertUser(
  userModel: Model<UserDocument>,
  data: { name: string; email: string; password: string; role: 'user' | 'admin'; bio?: string },
) {
  const email = data.email.toLowerCase();
  const existing = await userModel.findOne({ email });
  if (existing) {
    if (existing.role !== data.role) {
      existing.role = data.role;
      await existing.save();
    }
    return existing;
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  return userModel.create({
    name: data.name,
    email,
    password: hashedPassword,
    role: data.role,
    bio: data.bio || '',
  });
}

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const postModel = app.get<Model<PostDocument>>(getModelToken(Post.name));

  const adminEmail = configService.get<string>('ADMIN_EMAIL') || 'admin@example.com';
  const adminPassword = configService.get<string>('ADMIN_PASSWORD') || 'Admin123!';

  const admin = await upsertUser(userModel, {
    name: 'Admin',
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
    bio: 'Administrator of this Facebook prototype.',
  });
  console.log(`Admin ready: ${admin.email} / ${adminPassword}`);

  const alice = await upsertUser(userModel, {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    password: 'Password123!',
    role: 'user',
    bio: 'Coffee enthusiast and weekend hiker.',
  });
  const bob = await upsertUser(userModel, {
    name: 'Bob Smith',
    email: 'bob@example.com',
    password: 'Password123!',
    role: 'user',
    bio: 'Building things with code.',
  });
  console.log(`Demo users ready: ${alice.email}, ${bob.email} (password: Password123!)`);

  const existingPosts = await postModel.countDocuments();
  if (existingPosts === 0) {
    await postModel.create([
      {
        author: alice._id,
        content: 'Just got back from a hike, the view was incredible!',
        likes: [bob._id, admin._id],
        comments: [{ author: bob._id, content: 'Looks amazing! Where was this?' }],
      },
      {
        author: bob._id,
        content: 'Finally shipped my side project after months of work.',
        likes: [alice._id],
        comments: [
          { author: alice._id, content: 'Congrats! Would love to try it out.' },
          { author: admin._id, content: 'Nice work, Bob.' },
        ],
      },
      {
        author: admin._id,
        content: 'Welcome to the Facebook prototype! This is a demo post from the admin account.',
        likes: [alice._id, bob._id],
        comments: [],
      },
    ]);
    console.log('Seeded 3 demo posts with likes/comments.');
  } else {
    console.log(`Skipped demo posts (${existingPosts} already exist).`);
  }

  await app.close();
  console.log('Seeding complete.');
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
