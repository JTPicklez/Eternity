/**
 * The morning huddle, composed on the phone from your day (no AI call, no
 * cost). Aibram writes a richer one on demand when you pull to refresh.
 */
import { addDays, clockAmPm, isoDate, minutesOf } from './dates';
import type { Block, Member } from './types';

export interface Collision {
  date: string;
  a: Block;
  b: Block;
}

function endMinutes(b: Block): number {
  if (b.end) return minutesOf(b.end) || 24 * 60;
  return minutesOf(b.time) + 45;
}

/** Two blocks on the same day whose times overlap. */
export function findCollisions(blocks: Block[], from = new Date(), days = 7): Collision[] {
  const out: Collision[] = [];
  for (let i = 0; i < days; i++) {
    const date = isoDate(addDays(from, i));
    const day = blocks.filter((b) => b.date === date && !b.done && b.kind !== 'leave').sort((x, y) => x.time.localeCompare(y.time));
    for (let a = 0; a < day.length; a++) {
      for (let b = a + 1; b < day.length; b++) {
        if (minutesOf(day[b].time) < endMinutes(day[a])) out.push({ date, a: day[a], b: day[b] });
      }
    }
  }
  return out;
}

export function weekdayName(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const today = isoDate();
  if (date === today) return 'Today';
  if (date === isoDate(addDays(new Date(), 1))) return 'Tomorrow';
  return dt.toLocaleDateString('en-US', { weekday: 'long' });
}

export function huddleLine(blocks: Block[], now = new Date()): string {
  const today = isoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todays = blocks.filter((b) => b.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = todays.filter((b) => minutesOf(b.time) >= nowMin && !b.done);
  const leave = upcoming.find((b) => b.kind === 'leave');
  const flow = todays.find((b) => b.kind === 'flow');
  const parts: string[] = [];
  const next = upcoming.find((b) => b.kind !== 'leave');
  if (leave) parts.push(`Leave by ${clockAmPm(leave.time)}.`);
  else if (next && next.kind !== 'flow') parts.push(`Next up: ${next.title} at ${clockAmPm(next.time)}.`);
  if (flow && !flow.done && minutesOf(flow.time) >= nowMin) {
    const what = flow.title.replace(/^Flow:\s*/i, '');
    parts.push(next?.id === flow.id ? `Flow starts at ${clockAmPm(flow.time)}: ${what}. Everything else goes quiet.` : `Tonight is cleared for ${what}.`);
  }
  if (!parts.length) {
    if (!todays.length) return 'Wide open today. Tell me what you want to take on and I will find the time.';
    return 'Everything on today is handled. Want me to pull something forward from the week?';
  }
  return parts.join(' ');
}

export function placedBy(blocks: Block[], date = isoDate()): number {
  return blocks.filter((b) => b.date === date && b.by).length;
}

export function memberLine(m: Member): string {
  if (m.state === 'working') return m.status || 'Working on it';
  if (m.state === 'waiting') return m.status || 'Needs you';
  if (m.state === 'done') return m.status || 'Done';
  return m.status || 'Ready';
}
