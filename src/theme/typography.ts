/** Global text scale — tweak here to adjust app-wide font size. */
export const FONT_SCALE = 0.92;

export function scaleFont(size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    return size;
  }
  return Math.max(Math.round(size * FONT_SCALE * 10) / 10, 9);
}
