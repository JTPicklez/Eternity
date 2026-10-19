/**
 * Spaced repetition for flashcards, a light version of SM-2. Each answer
 * schedules the card: missed cards come back in 10 minutes, known ones wait
 * longer each time. "Mastered" means it's not due for three weeks or more.
 */
import type { Flashcard } from './types';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

const MIN = 60_000;
const DAY = 86_400_000;

export interface Schedule {
  due: number;
  interval: number; // days
  ease: number;
  reps: number;
  lapses: number;
}

export function scheduleOf(c: Flashcard): Schedule {
  return { due: c.due ?? 0, interval: c.interval ?? 0, ease: c.ease ?? 2.5, reps: c.reps ?? 0, lapses: c.lapses ?? 0 };
}

export function review(c: Flashcard, grade: Grade, now = Date.now()): Schedule {
  const s = scheduleOf(c);
  if (grade === 'again') {
    return { due: now + 10 * MIN, interval: 0, ease: Math.max(1.3, s.ease - 0.2), reps: 0, lapses: s.lapses + 1 };
  }
  let interval: number;
  let ease = s.ease;
  if (grade === 'hard' && s.reps === 0) {
    // A new card that was hard: see it again in an hour.
    return { due: now + 60 * MIN, interval: 0, ease: Math.max(1.3, s.ease - 0.15), reps: 0, lapses: s.lapses };
  }
  if (grade === 'hard') {
    interval = Math.max(1, Math.round(Math.max(1, s.interval) * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  } else if (grade === 'good') {
    interval = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(Math.max(1, s.interval) * ease);
  } else {
    interval = s.reps === 0 ? 3 : Math.round(Math.max(1, s.interval) * ease * 1.3);
    ease = ease + 0.15;
  }
  return { due: now + interval * DAY, interval, ease, reps: s.reps + 1, lapses: s.lapses };
}

/** What each button will do, for the little label under it. */
export function previewLabel(c: Flashcard, grade: Grade): string {
  const next = review(c, grade, 0);
  if (next.interval === 0) return next.due >= 60 * MIN ? '1 hr' : '10 min';
  if (next.interval === 1) return '1 day';
  if (next.interval < 30) return `${next.interval} days`;
  const months = Math.round(next.interval / 30);
  return `${months} mo`;
}

export const isNew = (c: Flashcard) => !c.reps && !c.due;
export const isDue = (c: Flashcard, now = Date.now()) => !isNew(c) && (c.due ?? 0) <= now;
export const isMastered = (c: Flashcard) => (c.interval ?? 0) >= 21;

/** Today's study queue: everything due, then up to `newLimit` new cards. */
export function studyQueue(cards: Flashcard[], newLimit = 20, now = Date.now()): Flashcard[] {
  const due = cards.filter((c) => isDue(c, now)).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
  const fresh = cards.filter(isNew).slice(0, newLimit);
  return [...due, ...fresh];
}

export function deckStats(cards: Flashcard[], now = Date.now()) {
  return {
    total: cards.length,
    due: cards.filter((c) => isDue(c, now)).length,
    fresh: cards.filter(isNew).length,
    mastered: cards.filter(isMastered).length,
  };
}
