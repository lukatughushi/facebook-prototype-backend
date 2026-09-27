import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

const uploadDir = join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedTypes = /jpeg|jpg|png|gif|webp/;

// Shared multer options for every image-upload endpoint (avatars, cover
// photos, post images): disk storage under /uploads, 5MB cap, image-only.
export const multerOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const extOk = allowedTypes.test(extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new BadRequestException('Only image files (jpeg, jpg, png, gif, webp) are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};
