// The brand/accent colour is admin-managed (config key `theme.brand_color`).
// The whole palette below is derived from a single base hex so changing one
// value re-themes every button, link and gradient. See `applyBrandColor`, which
// is invoked at app startup (custom entry in index.js) before any StyleSheet is
// evaluated, and mirrors the value into the live `colors`/`gradients` objects.

export const DEFAULT_BRAND = '#52BAD7';

function clampChannel(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => clampChannel(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Blend `hex` toward `target` by `amount` (0..1). */
function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount,
  );
}

const lighten = (hex: string, amount: number) => mix(hex, '#FFFFFF', amount);
const darken = (hex: string, amount: number) => mix(hex, '#000000', amount);

export function isValidHex(hex: unknown): hex is string {
  return typeof hex === 'string' && /^#?[0-9a-fA-F]{6}$/.test(hex.trim());
}

function normalizeHex(hex: string): string {
  return '#' + hex.replace('#', '').toUpperCase();
}

// Colours that don't depend on the brand (neutrals, whites, semantic).
const FIXED_COLORS = {
  white: '#FFFFFF',
  text: '#1B2A30',
  textSecondary: '#5C7782',
  textOnGradient: '#FFFFFF',
  dotInactive: 'rgba(255, 255, 255, 0.45)',
  dotActive: '#FFFFFF',
  card: 'rgba(255, 255, 255, 0.92)',
  inputBackground: 'rgba(255, 255, 255, 0.95)',
  inputGray: '#F2F2F2',
  surfaceMuted: '#F7F7F7',
  surfaceMutedBorder: '#DCDADA',
  facebook: '#1877F2',
  buttonDisabled: '#E5E5E5',
  labelGray: '#9CA3AF',
  danger: '#E5484D',
};

function brandColors(brand: string) {
  return {
    background: mix(brand, '#FFFFFF', 0.94),
    primary: brand,
    primaryLight: lighten(brand, 0.18),
    primaryDark: darken(brand, 0.18),
    accent: brand,
    accentSoft: lighten(brand, 0.55),
    border: mix(brand, '#FFFFFF', 0.8),
    buttonPurple: brand,
    inputFocus: brand,
    brand,
    buttonActive: brand,
  };
}

// Mutable singleton: consumers import this object and read its properties.
// `applyBrandColor` mutates it in place so render-time reads pick up the value.
export const colors = {
  ...FIXED_COLORS,
  ...brandColors(DEFAULT_BRAND),
};

type GradientConfig = {
  colors: readonly [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

function brandGradient(brand: string): [string, string] {
  return [brand, darken(brand, 0.22)];
}

function softGradient(brand: string): [string, string] {
  return [lighten(brand, 0.86), lighten(brand, 0.78)];
}

export const gradients: Record<string, GradientConfig> = {
  screen: {
    colors: brandGradient(DEFAULT_BRAND),
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  screenSoft: {
    colors: softGradient(DEFAULT_BRAND),
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  button: {
    colors: brandGradient(DEFAULT_BRAND),
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  card: {
    colors: brandGradient(DEFAULT_BRAND),
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  illustration: {
    colors: ['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.12)'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
};

/**
 * Re-theme the app from a single brand hex. Mutates the shared `colors` and
 * `gradients` objects in place. Call this as early as possible (before route
 * StyleSheets evaluate) so module-level styles pick up the colour on cold start.
 * Invalid input is ignored, leaving the current palette untouched.
 */
export function applyBrandColor(hex?: unknown): boolean {
  if (!isValidHex(hex)) {
    return false;
  }
  const brand = normalizeHex(hex.trim());
  Object.assign(colors, brandColors(brand));
  gradients.screen.colors = brandGradient(brand);
  gradients.button.colors = brandGradient(brand);
  gradients.card.colors = brandGradient(brand);
  gradients.screenSoft.colors = softGradient(brand);
  return true;
}
