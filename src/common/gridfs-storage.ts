import type { Request, Response, NextFunction } from 'express';
import type { StorageEngine } from 'multer';
import { mongo, type Connection } from 'mongoose';

// Uploaded images live in MongoDB (GridFS bucket "uploads") instead of on the
// server's disk: Render's disk is wiped on every deploy/restart, the database
// isn't. Files keep their "/uploads/<filename>" paths, so the rest of the app
// doesn't know the difference.

const BUCKET = 'uploads';
let bucket: mongo.GridFSBucket | null = null;

// Called once from main.ts with the app's Mongoose connection.
export function initUploadBucket(connection: Connection) {
  bucket = new mongo.GridFSBucket(connection.db as any, { bucketName: BUCKET });
}

function getBucket() {
  if (!bucket) throw new Error('Upload storage is not initialised');
  return bucket;
}

// Multer storage engine: streams each upload into GridFS under `filename`.
export function gridFsStorage(filename: (file: Express.Multer.File) => string): StorageEngine {
  return {
    _handleFile(req, file, cb) {
      const name = filename(file);
      const upload = getBucket().openUploadStream(name, { metadata: { contentType: file.mimetype } });
      file.stream
        .pipe(upload)
        .on('error', (err) => cb(err))
        .on('finish', () => cb(null, { filename: name, size: upload.length, id: upload.id } as any));
    },
    _removeFile(req, file: any, cb) {
      if (!file.id) return cb(null);
      getBucket()
        .delete(file.id)
        .then(() => cb(null), cb);
    },
  };
}

// GET /uploads/:filename - serves a file from GridFS. Registered after the
// static /uploads handler, so files still on local disk (dev) are served first.
export async function serveUpload(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const name = decodeURIComponent(req.path.replace(/^\/+/, ''));
  if (!name || name.includes('/')) return next();
  try {
    const file = await getBucket().find({ filename: name }).sort({ uploadDate: -1 }).limit(1).next();
    if (!file) return res.status(404).json({ message: 'File not found', statusCode: 404 });

    res.setHeader('Content-Type', (file.metadata as any)?.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.length));
    // Filenames are unique per upload, so the content never changes.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (req.method === 'HEAD') return res.end();
    getBucket()
      .openDownloadStream(file._id)
      .on('error', next)
      .pipe(res);
  } catch (err) {
    next(err);
  }
}
