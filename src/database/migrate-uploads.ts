/**
 * One-off migration: copies images from the local backend/uploads folder into
 * MongoDB GridFS, where the deployed API serves them from. Files already in
 * GridFS are skipped, so it's safe to re-run.
 *
 *   npm run migrate:uploads
 */
import '../dns-fix';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, mongo } from 'mongoose';
import { createReadStream, readdirSync } from 'fs';
import { extname, join } from 'path';
import { pipeline } from 'stream/promises';
import { AppModule } from '../app.module';

const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');
const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const connection = app.get<Connection>(getConnectionToken());
  const bucket = new mongo.GridFSBucket(connection.db as any, { bucketName: 'uploads' });

  let copied = 0;
  let skipped = 0;
  for (const name of readdirSync(UPLOAD_DIR)) {
    const contentType = TYPES[extname(name).toLowerCase()];
    if (!contentType) continue;
    if (await bucket.find({ filename: name }).limit(1).hasNext()) {
      skipped++;
      continue;
    }
    await pipeline(createReadStream(join(UPLOAD_DIR, name)), bucket.openUploadStream(name, { metadata: { contentType } }));
    copied++;
  }
  console.log(`Uploads: ${copied} copied to GridFS, ${skipped} already there.`);
  await app.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
