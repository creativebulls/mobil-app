import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import sharp from 'sharp';

import { env, uploadsRoot } from '../../config/env';
import { resolveAbsoluteMediaUrl } from '../utils/mediaUrl';

/** Bump when badge artwork/layout changes so cached PNGs regenerate. */
const BADGE_LAYOUT_VERSION = 'v2';

const AVATAR_SIZE = 256;
const BADGE_SIZE = 58;
const BADGE_ICON_SIZE = 34;
const BADGE_RADIUS = 14;
/** How far the badge overlaps the avatar circle at the bottom-right corner. */
const BADGE_OVERLAP = 12;
const BRAND_RGB = { r: 82, g: 186, b: 215 };

const BADGE_ASSET = path.join(__dirname, '../../assets/notification-app-badge.png');
const OUTPUT_DIR = path.join(uploadsRoot, 'notification-avatars');

function publicAvatarUrl(filename: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}/uploads/notification-avatars/${filename}`;
}

function circleMaskSvg(size: number): Buffer {
  const radius = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#fff"/></svg>`,
  );
}

function roundedRectMaskSvg(width: number, height: number, radius: number): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
}

async function buildBadgeLayer(): Promise<Buffer> {
  const icon = await sharp(BADGE_ASSET)
    .resize(BADGE_ICON_SIZE, BADGE_ICON_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const filled = await sharp({
    create: {
      width: BADGE_SIZE,
      height: BADGE_SIZE,
      channels: 4,
      background: { ...BRAND_RGB, alpha: 1 },
    },
  })
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toBuffer();

  const ring = await sharp(filled)
    .extend({
      top: 3,
      bottom: 3,
      left: 3,
      right: 3,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  return sharp(ring)
    .resize(BADGE_SIZE, BADGE_SIZE)
    .composite([{ input: roundedRectMaskSvg(BADGE_SIZE, BADGE_SIZE, BADGE_RADIUS), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function badgePosition(): { top: number; left: number } {
  return {
    top: AVATAR_SIZE - BADGE_SIZE + BADGE_OVERLAP,
    left: AVATAR_SIZE - BADGE_SIZE + BADGE_OVERLAP,
  };
}

async function buildDefaultBadgedIcon(): Promise<string> {
  const filename = `${BADGE_LAYOUT_VERSION}-default-app-icon.png`;
  const outPath = path.join(OUTPUT_DIR, filename);
  const cachedUrl = publicAvatarUrl(filename);

  try {
    await fs.access(outPath);
    return cachedUrl;
  } catch {
    // generate below
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const badge = await buildBadgeLayer();
  const { top, left } = badgePosition();

  await sharp({
    create: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      channels: 4,
      background: { r: 228, g: 236, b: 242, alpha: 1 },
    },
  })
    .composite([{ input: badge, top, left }])
    .png()
    .toFile(outPath);

  return cachedUrl;
}

/**
 * Builds a circular profile photo with the CRAVE app badge at the bottom-right,
 * matching the messenger-style notification mock (rounded avatar + corner logo).
 */
export async function buildBadgedNotificationAvatar(
  avatarUrl: string | null | undefined,
): Promise<string | null> {
  const absolute = resolveAbsoluteMediaUrl(avatarUrl);
  if (!absolute) {
    return buildDefaultBadgedIcon();
  }

  const hash = crypto
    .createHash('sha256')
    .update(`${BADGE_LAYOUT_VERSION}:${absolute}`)
    .digest('hex')
    .slice(0, 20);
  const filename = `${BADGE_LAYOUT_VERSION}-${hash}.png`;
  const outPath = path.join(OUTPUT_DIR, filename);
  const cachedUrl = publicAvatarUrl(filename);

  try {
    await fs.access(outPath);
    return cachedUrl;
  } catch {
    // generate below
  }

  try {
    const response = await fetch(absolute, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      return absolute;
    }

    const avatarBuffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const avatarCircle = await sharp(avatarBuffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .composite([{ input: circleMaskSvg(AVATAR_SIZE), blend: 'dest-in' }])
      .png()
      .toBuffer();

    const badge = await buildBadgeLayer();
    const { top, left } = badgePosition();

    await sharp(avatarCircle)
      .composite([{ input: badge, top, left }])
      .png()
      .toFile(outPath);

    return cachedUrl;
  } catch {
    return absolute;
  }
}
