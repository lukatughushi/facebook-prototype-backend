import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { gridFsStorage } from './gridfs-storage';

const allowedTypes = /jpeg|jpg|png|gif|webp/;

// Shared multer options for every image-upload endpoint (avatars, cover
// photos, post images): stored in MongoDB GridFS and served at
// /uploads/<filename>, 5MB cap, image-only.
export const multerOptions = {
  storage: gridFsStorage((file) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return `${file.fieldname}-${uniqueSuffix}${extname(file.originalname).toLowerCase()}`;
  }),
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const extOk = allowedTypes.test(extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new BadRequestException('Only image files (jpeg, jpg, png, gif, webp) are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};
