/**
 * One-off migration to the seven Facebook reactions. The first design had
 * "celebrate" and "insight"; those map to Care and Wow. Safe to re-run.
 *
 *   npm run migrate:reactions
 */
import '../dns-fix';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { Reel, ReelDocument } from '../reels/schemas/reel.schema';

const RENAMES: Record<string, string> = { celebrate: 'care', insight: 'wow' };

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const models: [string, Model<any>][] = [
    ['posts', app.get<Model<PostDocument>>(getModelToken(Post.name))],
    ['reels', app.get<Model<ReelDocument>>(getModelToken(Reel.name))],
  ];
  for (const [label, model] of models) {
    for (const [from, to] of Object.entries(RENAMES)) {
      const res = await model.collection.updateMany(
        { 'reactions.type': from },
        { $set: { 'reactions.$[r].type': to } },
        { arrayFilters: [{ 'r.type': from }] },
      );
      console.log(`${label}: ${from} -> ${to}: ${res.modifiedCount} document(s)`);
    }
  }
  await app.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
