import fs from 'fs';
import multer from 'multer';
import path from 'path';

import { uploadsRoot } from '../../config/env';

const uploadDir = path.join(uploadsRoot, 'profile-photos');
const postImageDir = path.join(uploadsRoot, 'posts');
const messageMediaDir = path.join(uploadsRoot, 'messages');
const groupPhotoDir = path.join(uploadsRoot, 'group-photos');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(postImageDir)) {
  fs.mkdirSync(postImageDir, { recursive: true });
}

if (!fs.existsSync(messageMediaDir)) {
  fs.mkdirSync(messageMediaDir, { recursive: true });
}

if (!fs.existsSync(groupPhotoDir)) {
  fs.mkdirSync(groupPhotoDir, { recursive: true });
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

function postMediaFilter(
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

// Posts accept photos and short videos. Videos need more headroom than photos.
export const postImageUpload = multer({
  storage: createDiskStorage(postImageDir),
  fileFilter: postMediaFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: MAX_POST_IMAGES * 2 },
});

// Common document/file types allowed as chat attachments (in addition to
// image/video/audio which are matched by mime prefix below).
const ALLOWED_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/gzip',
  'application/json',
  'text/plain',
  'text/csv',
  'application/octet-stream',
]);

function mediaFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype.startsWith('audio/') ||
    ALLOWED_FILE_MIME_TYPES.has(file.mimetype)
  ) {
    cb(null, true);
    return;
  }

  cb(new Error('This file type is not supported'));
}

// Clients compress media before uploading, but allow headroom for short videos
// and document attachments.
export const messageMediaUpload = multer({
  storage: createDiskStorage(messageMediaDir),
  fileFilter: mediaFileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

export const groupPhotoUpload = multer({
  storage: createDiskStorage(groupPhotoDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
