/**
 * Errands: teammates look things up and prepare a checkout; you make the
 * final tap. The safety rails here are plain code, not AI:
 *  - the cart is compared to what you asked for, field by field
 *  - a spending limit is enforced before anything can be confirmed
 *  - payment is never retried automatically
 *  - every booking gets an undo window and a receipt
 *
 * This build simulates the sites themselves (no real bookings happen). The
 * flow, checks and Face ID gate are the real ones the live version will use.
 */
import { useCrew } from './store';
import type { Errand, ErrandStep } from './types';

export function errandKind(request: string): Errand['kind'] {
  const l = request.toLowerCase();
  if (/flight|fly|plane|airline/.test(l)) return 'flight';
  if (/movie|cinema|theater|theatre|film|tickets?/.test(l)) return 'movie';
  if (/uber|lyft|ride|taxi|car to/.test(l)) return 'ride';
  return 'other';
}

function countFrom(request: string): number | undefined {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const m = request.toLowerCase().match(/\b(\d+|one|two|three|four|five|six)\s+(seats?|tickets?|people|of us|adults?)\b/);
  if (!m) return undefined;
  return words[m[1]] ?? Number(m[1]);
}

function maxFrom(request: string): number | undefined {
  const m = request.match(/(?:under|below|max|less than|no more than)\s*\$?\s*(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : undefined;
}

function dateFrom(request: string): string | undefined {
  const l = request.toLowerCase();
  if (/tonight|today/.test(l)) return 'Today';
  if (/tomorrow/.test(l)) return 'Tomorrow';
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const d = days.find((x) => l.includes(x));
  if (d) return d.charAt(0).toUpperCase() + d.slice(1);
  return undefined;
}

export function stepsFor(kind: Errand['kind']): ErrandStep[] {
  const map: Record<Errand['kind'], string[]> = {
    movie: ['Read your request', 'Open the theater site on the Workbench', 'Find showtimes', 'Pick the best seats together', 'Build the cart'],
    flight: ['Read your request', 'Search flights on the Workbench', 'Compare fares and times', 'Hold the best option', 'Build the checkout'],
    ride: ['Read your request', 'Check pickup and drop-off', 'Compare ride options', 'Prepare the request'],
    other: ['Read your request', 'Open the site on the Workbench', 'Find the best option', 'Build the cart'],
  };
  return map[kind].map((label, i) => ({ label, status: i === 0 ? 'active' : 'todo' }));
}

/** What the simulated site comes back with. */
export function previewFor(kind: Errand['kind'], request: string): NonNullable<Errand['preview']> {
  const count = countFrom(request) ?? (kind === 'movie' ? 2 : 1);
  const date = dateFrom(request) ?? (kind === 'flight' ? 'Nov 25' : 'Today');
  const maxTotal = maxFrom(request);
  const nameMatch = request.match(/(?:see|watch|for)\s+["“]?([A-Z][\w' :]{2,40})["”]?/);
  const name = nameMatch?.[1]?.trim();
  if (kind === 'movie') {
    const each = 13.5;
    return {
      title: name ? `${name}` : 'The 7:40 PM showing',
      lines: [`${count} tickets · Row F, seats 7–${6 + count}`, `${date} at 7:40 PM · Cinemark 16`, `Tickets ${count} × $${each.toFixed(2)}`, 'Booking fee $1.50'],
      total: Math.round((count * each + 1.5) * 100) / 100,
      refund: 'Refundable until 2 hours before showtime',
      request: { date, count, maxTotal, name },
      cart: { date, count, name },
    };
  }
  if (kind === 'flight') {
    return {
      title: 'LBB → DFW nonstop',
      lines: [`${date} · 4:15 PM → 5:20 PM`, `${count} traveler${count > 1 ? 's' : ''} · Main cabin`, 'Carry-on included'],
      total: 148 * count,
      refund: 'Free cancellation for 24 hours',
      request: { date, count, maxTotal },
      cart: { date, count },
    };
  }
  if (kind === 'ride') {
    return {
      title: 'Ride to your destination',
      lines: ['Standard · 4 min away', 'Pickup: your current location', 'Estimated 14 min trip'],
      total: 16.8,
      refund: 'Free to cancel for 2 minutes',
      request: { count: 1, maxTotal },
      cart: { count: 1 },
    };
  }
  return {
    title: 'Ready to check out',
    lines: ['1 item', 'Standard delivery'],
    total: 24.99,
    refund: 'Returns within 30 days',
    request: { count: 1, maxTotal },
    cart: { count: 1 },
  };
}

/** The deterministic check. Plain comparisons, no model involved. */
export function checkCart(preview: NonNullable<Errand['preview']>, spendLimit: number): { ok: boolean; issues: string[]; passed: string[] } {
  const issues: string[] = [];
  const passed: string[] = [];
  const { request: rq, cart } = preview;
  if (rq.count != null && cart.count != null) {
    if (rq.count !== cart.count) issues.push(`You asked for ${rq.count}, the cart has ${cart.count}.`);
    else passed.push(`Quantity matches (${cart.count})`);
  }
  if (rq.date && cart.date) {
    if (rq.date !== cart.date) issues.push(`You asked for ${rq.date}, the cart says ${cart.date}.`);
    else passed.push(`Date matches (${cart.date})`);
  }
  if (rq.name && cart.name) {
    if (rq.name.toLowerCase() !== cart.name.toLowerCase()) issues.push(`The cart is for "${cart.name}", not "${rq.name}".`);
    else passed.push('Title matches');
  }
  if (rq.maxTotal != null) {
    if (preview.total > rq.maxTotal) issues.push(`$${preview.total.toFixed(2)} is over your $${rq.maxTotal} limit for this.`);
    else passed.push(`Under your $${rq.maxTotal} budget`);
  }
  if (preview.total > spendLimit) issues.push(`$${preview.total.toFixed(2)} is over your errand spending limit of $${spendLimit}.`);
  else passed.push(`Under your $${spendLimit} spending limit`);
  return { ok: issues.length === 0, issues, passed };
}

export const SPEND_LIMIT_DEFAULT = 150;

/** Walk the steps with realistic pauses, then land on the preview. */
export function runErrand(id: string, onStep?: () => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const st = useCrew.getState();
  const e = st.errands.find((x) => x.id === id);
  if (!e) return () => {};
  const steps = e.steps.length;
  for (let i = 1; i <= steps; i++) {
    timers.push(
      setTimeout(
        () => {
          const cur = useCrew.getState().errands.find((x) => x.id === id);
          if (!cur || cur.status !== 'working') return;
          const next = cur.steps.map((s, j) => ({ ...s, status: j < i ? 'done' : j === i ? 'active' : 'todo' }) as ErrandStep);
          if (i === steps) {
            const preview = previewFor(cur.kind, cur.request);
            const check = checkCart(preview, SPEND_LIMIT_DEFAULT);
            useCrew.getState().updateErrand(id, { steps: next, status: 'preview', preview, check: { ok: check.ok, issues: check.issues } });
            useCrew.getState().setMemberState(cur.memberId, 'waiting', 'Your errand is ready to review');
          } else {
            useCrew.getState().updateErrand(id, { steps: next });
          }
          onStep?.();
        },
        900 + i * 1300,
      ),
    );
  }
  return () => timers.forEach(clearTimeout);
}
