/**
 * Ink & Water design tokens.
 *
 * Two modes share one structure: Paper (cream page, ink type) and Ink
 * (deep blue-black page, paper type). The "signal" color is water blue and
 * is reserved for things that are alive or need you. Member colors are each
 * teammate's identity and stay the same in both modes.
 */

export type Mode = 'paper' | 'ink';

export interface Palette {
  mode: Mode;
  bg: string;
  card: string;
  card2: string;
  line: string;
  lineStrong: string;
  text: string;
  text2: string;
  muted: string;
  /** The "ink stone" card: inverted against the page for important moments. */
  stone: string;
  onStone: string;
  onStoneMuted: string;
  signal: string;
  signalText: string;
  onSignal: string;
  glow: string;
  glint: string;
  danger: string;
  success: string;
  tabBg: string;
  shadow: string;
  ripple: string;
  /** Text color on any colored pebble (eyes, marks). */
  pebbleInk: string;
}

export const paper: Palette = {
  mode: 'paper',
  bg: '#EEE8DD',
  card: '#F8F4EC',
  card2: '#EAE2D5',
  line: '#E2D9CB',
  lineStrong: '#D2C7B5',
  text: '#1E2023',
  text2: '#3A3631',
  muted: '#6B6257',
  stone: '#1E2023',
  onStone: '#EEE8DD',
  onStoneMuted: '#D8D0C3',
  signal: '#1E5BD2',
  signalText: '#1A4DB3',
  onSignal: '#F7F3EC',
  glow: '#3E8EF0',
  glint: '#E3F5FF',
  danger: '#B3261E',
  success: '#1F6B3A',
  tabBg: '#F4EFE6',
  shadow: '#DDD3C3',
  ripple: 'rgba(30, 32, 35, 0.10)',
  pebbleInk: '#1E2023',
};

export const ink: Palette = {
  mode: 'ink',
  bg: '#13161A',
  card: '#1C2025',
  card2: '#22272E',
  line: '#2A2F36',
  lineStrong: '#343A42',
  text: '#EEE8DD',
  text2: '#D5D7D3',
  muted: '#9AA0A6',
  stone: '#EEE8DD',
  onStone: '#1E2023',
  onStoneMuted: '#3A3631',
  signal: '#5CC8F2',
  signalText: '#8FD8F7',
  onSignal: '#13161A',
  glow: '#5CC8F2',
  glint: '#E3F5FF',
  danger: '#FF8C8C',
  success: '#8FCB5A',
  tabBg: '#101317',
  shadow: '#0B0D10',
  ripple: 'rgba(143, 216, 247, 0.12)',
  pebbleInk: '#1E2023',
};

/** Teammate identity colors. */
export const memberColors = {
  water: '#3E8EF0',
  lilac: '#C3A3F7',
  moss: '#8FCB5A',
  sun: '#F2C94C',
  clay: '#E58C6B',
  coral: '#FF8FB1',
  bone: '#E6DFD2',
  stone: '#9E968A',
  mist: '#9CC7E8',
} as const;

/** Darker versions of member colors for text on the paper page. */
export const memberTextOnPaper: Record<string, string> = {
  '#3E8EF0': '#1A4DB3',
  '#C3A3F7': '#6A43C2',
  '#8FCB5A': '#3F7A1C',
  '#F2C94C': '#8A6A00',
  '#E58C6B': '#A4482A',
  '#FF8FB1': '#B0305A',
  '#E6DFD2': '#5A544C',
  '#9E968A': '#5A544C',
  '#9CC7E8': '#2F6A93',
  '#D4AF5A': '#7A5C12',
};

export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemi: 'Geist_600SemiBold',
  bodyBold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

/** Hand-cut corner sets so cards never feel perfectly machined. */
export const carved = [
  { borderTopLeftRadius: 30, borderTopRightRadius: 22, borderBottomRightRadius: 32, borderBottomLeftRadius: 20 },
  { borderTopLeftRadius: 22, borderTopRightRadius: 32, borderBottomRightRadius: 24, borderBottomLeftRadius: 30 },
  { borderTopLeftRadius: 24, borderTopRightRadius: 18, borderBottomRightRadius: 26, borderBottomLeftRadius: 16 },
  { borderTopLeftRadius: 16, borderTopRightRadius: 24, borderBottomRightRadius: 18, borderBottomLeftRadius: 22 },
] as const;

export function textOn(palette: Palette, memberColor: string): string {
  if (palette.mode === 'ink') return memberColor;
  return memberTextOnPaper[memberColor] ?? palette.text;
}
