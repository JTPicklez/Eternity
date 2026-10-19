/**
 * Everything a pebble can wear or be made of, and how it's unlocked.
 *
 * Free things are free. Some are earned with time together (the days since a
 * teammate joined). A few are Plus perks. Founding Crews get the Plus ones too.
 */
import type { Extra, Finish, Member, Mood, Tier } from './types';

export type Slot = 'head' | 'side' | 'face' | 'cheek';

export interface ExtraDef {
  id: Extra;
  label: string;
  slot: Slot;
  /** Days together before it unlocks. */
  days?: number;
  plus?: boolean;
}

export const EXTRAS: ExtraDef[] = [
  { id: 'glasses', label: 'Glasses', slot: 'face' },
  { id: 'freckles', label: 'Freckles', slot: 'cheek' },
  { id: 'bow', label: 'Bow', slot: 'side' },
  { id: 'beanie', label: 'Beanie', slot: 'head' },
  { id: 'sprout', label: 'Sprout', slot: 'head', days: 7 },
  { id: 'flower', label: 'Flower', slot: 'side', days: 30 },
  { id: 'star', label: 'Gold star', slot: 'side', days: 90 },
  { id: 'sunglasses', label: 'Shades', slot: 'face', plus: true },
  { id: 'crown', label: 'Crown', slot: 'head', plus: true },
  { id: 'partyhat', label: 'Party hat', slot: 'head', plus: true },
];

export const extraDef = (id: Extra) => EXTRAS.find((e) => e.id === id)!;

export const FINISHES: { id: Finish; label: string; plus?: boolean }[] = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'granite', label: 'Granite' },
  { id: 'glass', label: 'Frosted glass' },
  { id: 'moss', label: 'Mossy' },
  { id: 'glow', label: 'Glow' },
  { id: 'gold', label: 'Gold vein', plus: true },
  { id: 'marble', label: 'Marble', plus: true },
];

export const RESTING_MOODS: { id: Mood | 'faceless'; label: string }[] = [
  { id: 'happy', label: 'Happy' },
  { id: 'curious', label: 'Curious' },
  { id: 'proud', label: 'Proud' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'faceless', label: 'No face' },
];

export const DAY = 86_400_000;

export function daysTogether(member: Pick<Member, 'joinedAt'>, now = Date.now()): number {
  return Math.max(0, Math.floor((now - (member.joinedAt || now)) / DAY));
}

/**
 * How worn smooth a stone is, 0 (brand new) to 1. Grows fast at first and
 * slowly after: about a third after two weeks, half after two months.
 */
export function wearFromDays(days: number): number {
  return Math.min(1, 0.05 + 0.16 * Math.log(1 + days / 3));
}

export function wearFor(member: Pick<Member, 'joinedAt' | 'polished'>, now = Date.now()): number {
  if (member.polished) return 0.08;
  return wearFromDays(daysTogether(member, now));
}

export function wearLabel(w: number): string {
  if (w < 0.2) return 'Brand new';
  if (w < 0.45) return 'A few weeks together';
  if (w < 0.7) return 'A few months together';
  return 'Worn smooth, years together';
}

export const hasPlusPerks = (tier: Tier) => tier !== 'free';

export type Lock = { locked: false } | { locked: true; reason: 'plus' } | { locked: true; reason: 'days'; daysLeft: number };

export function lockFor(def: { plus?: boolean; days?: number }, tier: Tier, days: number): Lock {
  if (def.plus && !hasPlusPerks(tier)) return { locked: true, reason: 'plus' };
  if (def.days && days < def.days) return { locked: true, reason: 'days', daysLeft: def.days - days };
  return { locked: false };
}

/** Wearing one thing per slot: picking a hat swaps out the other hat. */
export function toggleExtra(current: Extra[] | undefined, id: Extra): Extra[] {
  const list = current ?? [];
  if (list.includes(id)) return list.filter((x) => x !== id);
  const slot = extraDef(id).slot;
  return [...list.filter((x) => extraDef(x)?.slot !== slot), id];
}

/** What a teammate's face shows right now: work states pick the mood. */
export function moodFor(state: Member['state'] | undefined, resting: Mood | undefined, face?: Member['face']): Mood {
  if (state === 'working') return 'focused';
  if (state === 'waiting') return 'curious';
  if (state === 'done') return 'proud';
  if (face === 'sleepy') return 'sleepy';
  return resting ?? 'happy';
}
