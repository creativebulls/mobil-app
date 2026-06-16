import fs from 'fs';
import multer from 'multer';
import path from 'path';

import { uploadsRoot } from '../../config/env';

const uploadDir = path.join(uploadsRoot, 'profile-photos');
const postImageDir = path.join(uploadsRoot, 'posts');
const messageMediaDir = path.join(uploadsRoot, 'messages');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(postImageDir)) {
  fs.mkdirSync(postImageDir, { recursive: true });
}

if (!fs.existsSync(messageMediaDir)) {
  fs.mkdirSync(messageMediaDir, { recursive: true });
}

function createDiskStorage(destination: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, destination);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname) || '.jpg';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  });
}

const storage = createDiskStorage(uploadDir);

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Only image uploads are allowed'));
    return;
  }

  cb(null, true);
}

export const profilePhotoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const MAX_POST_IMAGES = 6;

export const postImageUpload = multer({
  storage: createDiskStorage(postImageDir),
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: MAX_POST_IMAGES },
});

function mediaFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
    return;
  }

  cb(new Error('Only image or video uploads are allowed'));
}

// Clients compress before uploading, but allow headroom for short videos.
export const messageMediaUpload = multer({
  storage: createDiskStorage(messageMediaDir),
  fileFilter: mediaFileFilter,
  limits: { fileSize: 40 * 1024 * 1024, files: 1 },
});
