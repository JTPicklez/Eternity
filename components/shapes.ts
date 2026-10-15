import type { Mark, Shape } from '@/lib/types';

/** Living pebble outlines, all in a 100 × 100 box. */
export const SHAPE_PATHS: Record<Shape, string> = {
  diamond:
    'M50 4 C58 4 64 10 72 20 L90 40 C96 47 96 53 90 60 L72 80 C64 90 58 96 50 96 C42 96 36 90 28 80 L10 60 C4 53 4 47 10 40 L28 20 C36 10 42 4 50 4 Z',
  almond: 'M8 58 C14 30 44 12 74 16 C92 18 96 32 90 48 C82 72 54 90 28 88 C12 87 5 74 8 58 Z',
  wedge: 'M12 20 C14 10 22 6 32 8 L84 18 C92 20 96 28 94 36 L84 82 C82 92 74 96 64 94 L18 84 C9 82 5 74 7 66 Z',
  bean: 'M10 40 C14 18 36 6 60 8 C82 10 96 26 94 48 C92 64 80 70 68 66 C58 62 52 66 48 76 C44 88 30 94 20 88 C8 80 6 60 10 40 Z',
  round: 'M50 6 C76 6 95 24 94 52 C93 78 74 95 48 94 C22 93 6 74 6 49 C6 24 26 6 50 6 Z',
};

export const SHAPE_EYES: Record<Shape, [number, number, number, number]> = {
  diamond: [40, 47, 60, 47],
  almond: [42, 50, 62, 47],
  wedge: [40, 48, 62, 50],
  bean: [40, 38, 62, 36],
  round: [40, 46, 60, 46],
};

/** Where the mark sits (center) for each shape, so it lands on the body. */
export const SHAPE_CENTER: Record<Shape, [number, number]> = {
  diamond: [50, 50],
  almond: [50, 52],
  wedge: [51, 51],
  bean: [50, 40],
  round: [50, 50],
};

/** Marks drawn around (50, 50); shifted per shape with a translate. */
export const MARK_PATHS: Record<Mark, { d: string; filled?: boolean }> = {
  diamond: { d: 'M50 37 L63 50 L50 63 L37 50 Z', filled: true },
  pulse: { d: 'M28 50 L40 50 L45 39 L53 61 L58 50 L72 50' },
  book: { d: 'M30 42 Q40 37 50 43 Q60 37 70 42 L70 60 Q60 55 50 61 Q40 55 30 60 Z M50 43 L50 61' },
  brackets: { d: 'M41 37 L30 50 L41 63 M59 37 L70 50 L59 63' },
  spark: { d: 'M50 32 L54.5 45.5 L68 50 L54.5 54.5 L50 68 L45.5 54.5 L32 50 L45.5 45.5 Z', filled: true },
  chart: { d: 'M34 66 L34 56 M46 66 L46 46 M58 66 L58 52 M70 66 L70 36' },
  pen: { d: 'M34 66 L38 54 L60 32 L68 40 L46 62 Z' },
};

/** A drop of water, 24 × 24. */
export const DROP_PATH = 'M12 2.5C12 2.5 18.5 10 18.5 14.5A6.5 6.5 0 0 1 5.5 14.5C5.5 10 12 2.5 12 2.5Z';

/** The infinity loop used for the Family tab icon, 26 × 24. */
export const LOOP_ICON_PATH =
  'M7 5.5C3.5 5.5 1.5 8.5 1.5 12s2 6.5 5.5 6.5S11 15 13 12s3.5-6.5 6-6.5 5.5 3 5.5 6.5-2 6.5-5.5 6.5S15 15 13 12 10.5 5.5 7 5.5Z';

// ── color helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) r = g = b = l;
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** A deep version of a member color, for marks drawn on the pebble. */
export function deepen(hex: string, lightness = 0.26): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s] = rgbToHsl(r, g, b);
  return hslToHex(h, Math.min(1, s * 1.05 + 0.1), lightness);
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** True when a color is light enough that ink text reads on it. */
export function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
