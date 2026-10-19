/**
 * The Crew Room: a little room where your teammates live. Whoever is working
 * goes to the station that fits their job (desk, bookshelf, planning board,
 * errand table), anyone waiting on you comes to the front, and everyone else
 * relaxes on the rug. The window follows your real time of day, the clock
 * shows your real time, and the board fills with today's plan.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { RoomDecor } from '@/lib/store';
import type { Member } from '@/lib/types';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { MemberPebble } from './Pebble';
import { darken, lighten } from './shapes';

export const ROOM_W = 1000;
export const ROOM_H = 560;
const INK = '#1E2023';

// ── time of day ─────────────────────────────────────────────────────────────
export type Tod = 'morning' | 'day' | 'evening' | 'night';

export function todNow(hour = new Date().getHours()): Tod {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

const TOD: Record<Tod, { top: string; bot: string; sun: [number, number, string, number]; moon: number; stars: number; tint: [string, number]; beam: [string, number, string]; glow: number; cloud: number }> = {
  morning: { top: '#F4C39C', bot: '#FCE7CC', sun: [512, 206, '#FFD27A', 1], moon: 0, stars: 0, tint: ['#FFB27A', 0.08], beam: ['#FFE2B8', 0.4, '486,250 616,250 760,548 590,548'], glow: 0, cloud: 1 },
  day: { top: '#63B1E6', bot: '#CBE8F7', sun: [594, 104, '#FFF4BF', 1], moon: 0, stars: 0, tint: ['#FFFFFF', 0], beam: ['#FFF6DD', 0.32, '486,250 616,250 680,548 470,548'], glow: 0, cloud: 1 },
  evening: { top: '#5E5196', bot: '#F2A06E', sun: [604, 228, '#FF9F5A', 1], moon: 0, stars: 0.25, tint: ['#FF7A4D', 0.14], beam: ['#FFB07A', 0.3, '486,250 616,250 540,548 360,548'], glow: 0.6, cloud: 0.6 },
  night: { top: '#0C1730', bot: '#26386A', sun: [0, 0, '#FFFFFF', 0], moon: 1, stars: 1, tint: ['#0A1534', 0.4], beam: ['#9CC7E8', 0.1, '486,250 616,250 680,548 470,548'], glow: 1, cloud: 0.15 },
};

// ── where everyone goes ─────────────────────────────────────────────────────
export type Station = 'desk' | 'shelf' | 'board' | 'table';

export const STATION_INFO: Record<Station, { label: string; blurb: string }> = {
  desk: { label: 'Desk', blurb: 'Code, builds and anything on a computer' },
  shelf: { label: 'Bookshelf', blurb: 'Studying, reading and research' },
  board: { label: 'Planning board', blurb: "Today's plan and the week ahead" },
  table: { label: 'Errand table', blurb: 'Errands, orders and drafts' },
};

const STATION_SPOTS: Record<Station, { x: number; y: number }[]> = {
  desk: [{ x: 140, y: 386 }],
  shelf: [
    { x: 386, y: 506 },
    { x: 440, y: 514 },
  ],
  board: [
    { x: 730, y: 506 },
    { x: 790, y: 510 },
  ],
  table: [{ x: 846, y: 514 }],
};
const REST = [
  { x: 462, y: 519 },
  { x: 566, y: 532 },
  { x: 670, y: 517 },
];
// Up front, between the cushions, so whoever needs you isn't hidden.
const FRONT = [
  { x: 514, y: 556 },
  { x: 618, y: 556 },
  { x: 410, y: 552 },
  { x: 722, y: 552 },
];
const FLOOR = [
  { x: 300, y: 540 },
  { x: 940, y: 540 },
  { x: 250, y: 520 },
  { x: 520, y: 500 },
  { x: 615, y: 500 },
  { x: 990, y: 525 },
];

const RULES: [Station, RegExp][] = [
  ['desk', /\b(code|coding|build|dev|developer|program|app|bug|github|ship|deploy|software|computer|design)\b/i],
  ['shelf', /\b(study|studies|learn|read|reading|research|write|writing|exam|class|quiz|flashcard|language|book|tutor|homework|calc|math)\b/i],
  ['table', /\b(errand|shop|buy|order|budget|money|meal|grocer|reply|email|draft|message|book a|booking|deal|price)\b/i],
  ['board', /\b(plan|planning|calendar|schedule|week|organi[sz]e|lead|deadline|goal|project|club|routine|train|coach|fitness)\b/i],
];

export function stationFor(m: Pick<Member, 'role' | 'blurb' | 'kind'>, isLead = false): Station {
  if (isLead) return 'board';
  const text = `${m.role} ${m.blurb} ${m.kind}`;
  for (const [s, re] of RULES) if (re.test(text)) return s;
  return 'desk';
}

export interface Placement {
  x: number;
  y: number;
  station?: Station;
}

/** Decides where every teammate stands right now. */
export function placeCrew(members: Member[], leadId: string): Record<string, Placement> {
  const used: Record<Station, number> = { desk: 0, shelf: 0, board: 0, table: 0 };
  const out: Record<string, Placement> = {};
  const order: Station[] = ['desk', 'shelf', 'board', 'table'];
  let rest = 0;
  let front = 0;
  let floor = 0;
  const toRest = (m: Member) => {
    if (rest < REST.length) out[m.id] = REST[rest++];
    else out[m.id] = FLOOR[floor++ % FLOOR.length];
  };
  // Working teammates claim stations first, then the rest settle in.
  const working = members.filter((m) => m.state === 'working');
  const others = members.filter((m) => m.state !== 'working');
  working.forEach((m) => {
    const want = stationFor(m, m.id === leadId);
    const pick = [want, ...order.filter((s) => s !== want)].find((s) => used[s] < STATION_SPOTS[s].length);
    if (!pick) return toRest(m);
    out[m.id] = { ...STATION_SPOTS[pick][used[pick]++], station: pick };
  });
  others.forEach((m) => {
    if (m.state === 'waiting') {
      out[m.id] = FRONT[front++ % FRONT.length];
    } else if (m.id === leadId && used.board < STATION_SPOTS.board.length && m.state !== 'done') {
      out[m.id] = { ...STATION_SPOTS.board[used.board++], station: 'board' };
    } else toRest(m);
  });
  return out;
}

const depthScale = (y: number) => 0.56 + Math.min(1, Math.max(0, (y - 384) / 160)) * 0.14;

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── the back of the room ────────────────────────────────────────────────────
const BOOK = ['#C46B4E', '#3E7CB1', '#E2B04A', '#6E9E45', '#9C7BC2', '#E9DFCC', '#2F4858', '#D98C6B'];
const BOOKS = (() => {
  const r = seeded(42);
  const out: { x: number; y: number; w: number; h: number; c: string }[] = [];
  [
    [152, 214],
    [222, 284],
    [292, 354],
    [362, 420],
  ].forEach(([top, bot], si) => {
    let x = 334;
    while (x < 432) {
      const bw = 7 + Math.floor(r() * 8);
      const bh = Math.min(bot - top - 6, 34 + Math.floor(r() * 22));
      if (x + bw > 438) break;
      if (r() < 0.1 && si !== 1) {
        x += 7;
        continue;
      }
      out.push({ x, y: bot - bh, w: bw, h: bh, c: BOOK[Math.floor(r() * BOOK.length)] });
      x += bw + 1;
    }
  });
  return out;
})();
const STARS = (() => {
  const r = seeded(7);
  return Array.from({ length: 22 }, () => ({ x: 484 + r() * 132, y: 76 + r() * 120, r: 0.6 + r() * 1.1 }));
})();
const NOTE_SLOTS = [146, 190, 234].flatMap((y) => [664, 708, 752].map((x) => ({ x, y })));
const NOTE_COLORS = ['#F2C94C', '#FF8FB1', '#9CC7E8', '#8FCB5A', '#E6DFD2', '#F2C94C'];
const BULBS = ['#FFD27A', '#FF8FB1', '#9CC7E8', '#8FCB5A', '#C3A3F7'];

function RoomBack({ decor, tod, crew, notes, now, deskBusy }: { decor: RoomDecor; tod: Tod; crew: string[]; notes: number; now: Date; deskBusy: boolean }) {
  const T = TOD[tod];
  const stripe = darken(decor.wall, 0.08);
  const h = now.getHours() % 12;
  const min = now.getMinutes();
  const hourA = ((h + min / 60) / 12) * Math.PI * 2;
  const minA = (min / 60) * Math.PI * 2;
  return (
    <>
      <Defs>
        <LinearGradient id="rm-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={T.top} />
          <Stop offset="1" stopColor={T.bot} />
        </LinearGradient>
        <LinearGradient id="rm-beam" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={T.beam[0]} stopOpacity={0.9} />
          <Stop offset="1" stopColor={T.beam[0]} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="rm-floorshade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </LinearGradient>
        <RadialGradient id="rm-cool" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#BFE6FA" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#8FD8F7" stopOpacity={0} />
        </RadialGradient>
        <ClipPath id="rm-skyclip">
          <Rect x={482} y={74} width={136} height={172} />
        </ClipPath>
      </Defs>

      {/* walls */}
      <Rect x={0} y={0} width={ROOM_W} height={384} fill={decor.wall} />
      <G opacity={0.38}>
        {Array.from({ length: 36 }, (_, i) => (
          <Rect key={i} x={i * 28} y={0} width={13} height={300} fill={stripe} />
        ))}
      </G>
      <Rect x={0} y={300} width={ROOM_W} height={84} fill={darken(decor.wall, 0.1)} />
      {Array.from({ length: 11 }, (_, i) => (
        <Rect key={i} x={45 + i * 90} y={312} width={70} height={56} rx={3} fill="none" stroke={darken(decor.wall, 0.18)} strokeWidth={1.5} />
      ))}
      <Rect x={0} y={295} width={ROOM_W} height={7} fill={darken(decor.wall, 0.2)} />
      <Rect x={0} y={376} width={ROOM_W} height={10} fill="#A88F6C" />

      {/* floor */}
      <Rect x={0} y={384} width={ROOM_W} height={166} fill="#B4875A" />
      {[404, 428, 456, 488, 524].map((y, i) => (
        <G key={y}>
          <Line x1={0} y1={y} x2={ROOM_W} y2={y} stroke="#9E7349" strokeWidth={1.2} />
          {Array.from({ length: 8 }, (_, j) => {
            const x = (i % 2 ? 60 : 0) + 40 + j * (150 + i * 30);
            const prev = [384, 404, 428, 456, 488][i];
            return x < ROOM_W ? <Line key={j} x1={x} y1={y} x2={x} y2={prev} stroke="#9E7349" strokeWidth={1} /> : null;
          })}
        </G>
      ))}
      <Rect x={0} y={384} width={ROOM_W} height={46} fill="url(#rm-floorshade)" />
      <Polygon points={T.beam[2]} fill="url(#rm-beam)" opacity={T.beam[1]} />
      <Rect x={0} y={548} width={ROOM_W} height={12} fill="#5E4029" />

      {/* rug and cushions */}
      <Ellipse cx={566} cy={520} rx={172} ry={31} fill={decor.rug} />
      <Ellipse cx={566} cy={520} rx={150} ry={24} fill="none" stroke="#EEE8DD" strokeWidth={2} strokeDasharray="2 7" opacity={0.6} />
      <Ellipse cx={566} cy={520} rx={120} ry={17} fill={lighten(decor.rug, 0.15)} opacity={0.9} />
      {(
        [
          [462, 519, '#E58C6B'],
          [566, 532, '#C3A3F7'],
          [670, 517, '#F2C94C'],
        ] as const
      ).map(([x, y, c]) => (
        <G key={x}>
          <Ellipse cx={x} cy={y + 2} rx={30} ry={9} fill={darken(c, 0.3)} />
          <Ellipse cx={x} cy={y} rx={28} ry={8} fill={c} />
          <Ellipse cx={x - 6} cy={y - 2} rx={12} ry={3} fill="#FFFFFF" opacity={0.3} />
        </G>
      ))}

      {/* string lights */}
      {decor.lights && (
        <G>
          <Path d="M 0 18 Q 250 70 500 22 Q 750 70 1000 18" fill="none" stroke="#5E4029" strokeWidth={1.6} />
          {Array.from({ length: 20 }, (_, i) => {
            const t = (i + 0.5) / 20;
            const seg = t < 0.5 ? t * 2 : (t - 0.5) * 2;
            const x = t * ROOM_W;
            const y = 18 + 4 * seg * (1 - seg) * 48 + 6;
            return <Circle key={i} cx={x} cy={y} r={4.2} fill={BULBS[i % BULBS.length]} opacity={0.6 + T.glow * 0.4} />;
          })}
        </G>
      )}

      {/* window */}
      <Rect x={440} y={50} width={220} height={6} rx={3} fill="#7A4F33" />
      <Circle cx={440} cy={53} r={6} fill="#7A4F33" />
      <Circle cx={660} cy={53} r={6} fill="#7A4F33" />
      <Rect x={470} y={62} width={160} height={196} rx={8} fill="#F1E9DA" stroke="#CDBDA3" strokeWidth={2} />
      <Rect x={482} y={74} width={136} height={172} fill="url(#rm-sky)" />
      <G clipPath="url(#rm-skyclip)">
        <G opacity={T.stars}>
          {STARS.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" />
          ))}
        </G>
        <Circle cx={T.sun[0]} cy={T.sun[1]} r={16} fill={T.sun[2]} opacity={T.sun[3]} />
        <G opacity={T.moon}>
          <Circle cx={590} cy={108} r={14} fill="#F3EEDC" />
          <Circle cx={585} cy={104} r={2.6} fill="#DCD5C0" />
          <Circle cx={594} cy={113} r={1.8} fill="#DCD5C0" />
        </G>
        {(
          [
            [508, 120, 1],
            [574, 172, 0.8],
          ] as const
        ).map(([x, y, s]) => (
          <G key={x} opacity={0.85 * T.cloud} transform={`translate(${x} ${y})`}>
            <Ellipse cx={0} cy={0} rx={18 * s} ry={7 * s} fill="#FFFFFF" />
            <Ellipse cx={10 * s} cy={-5 * s} rx={11 * s} ry={8 * s} fill="#FFFFFF" />
            <Ellipse cx={-9 * s} cy={-3 * s} rx={9 * s} ry={6 * s} fill="#FFFFFF" />
          </G>
        ))}
      </G>
      <Rect x={547} y={74} width={6} height={172} fill="#F1E9DA" />
      <Rect x={482} y={157} width={136} height={6} fill="#F1E9DA" />
      <Rect x={466} y={250} width={168} height={9} rx={3} fill="#EFE6D6" />
      <Rect x={470} y={259} width={160} height={4} fill="#000000" opacity={0.12} />
      {decor.plants && (
        <G>
          <Path d="M 596 250 L 599 236 L 617 236 L 620 250 Z" fill="#E58C6B" />
          {(
            [
              [-30, 604],
              [0, 608],
              [28, 612],
              [-12, 606],
              [14, 610],
            ] as const
          ).map(([a, x]) => (
            <Ellipse key={x} cx={x} cy={226} rx={3.4} ry={10} fill="#6FA844" transform={`rotate(${a} ${x} 236)`} />
          ))}
        </G>
      )}
      <Path d="M 446 56 L 490 56 C 482 110 494 170 482 236 C 478 252 472 262 462 268 L 446 268 Z" fill={decor.curtains} />
      <Path d="M 458 60 C 462 120 456 190 462 262 M 472 60 C 476 120 470 190 474 256" fill="none" stroke={darken(decor.curtains, 0.15)} strokeWidth={1.4} />
      <Path d="M 654 56 L 610 56 C 618 110 606 170 618 236 C 622 252 628 262 638 268 L 654 268 Z" fill={decor.curtains} />
      <Path d="M 642 60 C 638 120 644 190 638 262 M 628 60 C 624 120 630 190 626 256" fill="none" stroke={darken(decor.curtains, 0.15)} strokeWidth={1.4} />

      {/* wall art */}
      {decor.art === 'photo' && (
        <G>
          <Rect x={88} y={108} width={82} height={64} rx={3} fill="#7A4F33" />
          <Rect x={94} y={114} width={70} height={52} fill="#DCEBF4" />
          <Rect x={94} y={150} width={70} height={16} fill="#A9C98A" />
          {crew.slice(0, 4).map((c, i) => {
            const n = Math.min(4, crew.length);
            const x = 129 - ((n - 1) * 16) / 2 + i * 16;
            return (
              <G key={i}>
                <Ellipse cx={x} cy={150} rx={7.5} ry={6.5} fill={c} />
                <Circle cx={x - 2.2} cy={149} r={0.9} fill={INK} />
                <Circle cx={x + 2.2} cy={149} r={0.9} fill={INK} />
              </G>
            );
          })}
        </G>
      )}
      {decor.art === 'pennant' && (
        <G>
          <Path d="M 86 112 L 176 128 L 86 146 Z" fill="#E05A4F" />
          <Rect x={82} y={106} width={5} height={46} rx={2} fill="#7A4F33" />
          <Path d="M 100 124 L 140 129 M 100 132 L 128 133" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        </G>
      )}

      {/* clock with your real time */}
      <Circle cx={262} cy={122} r={25} fill="#F8F4EC" stroke="#7A4F33" strokeWidth={3.5} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const r2 = i % 3 ? 20 : 21.5;
        return <Line key={i} x1={262 + Math.sin(a) * 18} y1={122 - Math.cos(a) * 18} x2={262 + Math.sin(a) * r2} y2={122 - Math.cos(a) * r2} stroke="#6B6257" strokeWidth={i % 3 ? 1 : 2} />;
      })}
      <Line x1={262} y1={122} x2={262 + Math.sin(hourA) * 12} y2={122 - Math.cos(hourA) * 12} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <Line x1={262} y1={122} x2={262 + Math.sin(minA) * 18} y2={122 - Math.cos(minA) * 18} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={262} cy={122} r={2.4} fill="#B3261E" />

      {/* chair back */}
      <Rect x={108} y={316} width={66} height={72} rx={16} fill="#425261" />
      <Rect x={116} y={324} width={50} height={56} rx={11} fill="#516476" />

      {/* bookshelf */}
      <Ellipse cx={386} cy={434} rx={78} ry={6} fill="#000000" opacity={0.16} />
      <Rect x={320} y={140} width={132} height={292} rx={4} fill="#7A4F33" />
      <Rect x={330} y={152} width={112} height={268} fill="#553624" />
      {BOOKS.map((b, i) => (
        <G key={i}>
          <Rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.c} />
          <Rect x={b.x} y={b.y + 6} width={b.w} height={3} fill={darken(b.c, 0.3)} />
        </G>
      ))}
      {[214, 284, 354].map((y) => (
        <Rect key={y} x={330} y={y} width={112} height={8} fill="#8A5A3B" />
      ))}
      <Rect x={330} y={420} width={112} height={12} fill="#6A442D" />
      {decor.plants && (
        <G>
          <Path d="M 344 140 L 347 126 L 365 126 L 368 140 Z" fill="#E58C6B" />
          {(
            [
              [-35, 350],
              [-10, 354],
              [15, 358],
              [35, 362],
            ] as const
          ).map(([a, x]) => (
            <Ellipse key={x} cx={x} cy={116} rx={3.6} ry={11} fill="#5E8F3A" transform={`rotate(${a} ${x} 126)`} />
          ))}
        </G>
      )}
      <Rect x={404} y={130} width={34} height={10} fill="#3E7CB1" />
      <Rect x={408} y={121} width={28} height={9} fill="#E2B04A" />

      {/* planning board with today's plan */}
      <Rect x={648} y={116} width={156} height={176} rx={6} fill="#7A4F33" />
      <Rect x={656} y={124} width={140} height={160} fill="#C9A06E" />
      {NOTE_SLOTS.slice(0, Math.min(notes, NOTE_SLOTS.length)).map((s, i) => (
        <G key={i} transform={`translate(${s.x} ${s.y}) rotate(${((i * 37) % 11) - 5} 17 15)`}>
          <Rect x={0} y={0} width={34} height={30} rx={1.5} fill={NOTE_COLORS[i % NOTE_COLORS.length]} />
          <Rect x={5} y={10} width={22} height={2.4} fill="#000000" opacity={0.32} />
          <Rect x={5} y={15.5} width={16} height={2.4} fill="#000000" opacity={0.32} />
          <Rect x={5} y={21} width={19} height={2.4} fill="#000000" opacity={0.2} />
          <Circle cx={17} cy={4} r={2.6} fill="#B3261E" />
        </G>
      ))}

      {/* pendant lamp */}
      <Line x1={568} y1={0} x2={568} y2={30} stroke="#2F3A44" strokeWidth={2} />
      <Path d="M 551 30 L 585 30 L 597 50 L 539 50 Z" fill="#2F3A44" />
      <Ellipse cx={568} cy={51} rx={10} ry={4} fill="#FFE7B0" opacity={0.4 + T.glow * 0.6} />

      {/* the laptop lights up when someone's at the desk */}
      <Ellipse cx={226} cy={334} rx={74} ry={54} fill="url(#rm-cool)" opacity={deskBusy ? 0.5 + T.glow * 0.3 : 0} />

      {/* a big floor plant */}
      {decor.plants && (
        <G>
          <Path d="M 948 480 L 954 440 L 990 440 L 996 480 Z" fill="#C46B4E" />
          {(
            [
              [-40, 958, '#5E8F3A'],
              [-15, 966, '#6FA844'],
              [10, 974, '#5E8F3A'],
              [32, 982, '#7DB24E'],
              [-28, 970, '#7DB24E'],
            ] as const
          ).map(([a, x, c]) => (
            <Ellipse key={`${x}${a}`} cx={x} cy={404} rx={8} ry={30} fill={c} transform={`rotate(${a} ${x} 440)`} />
          ))}
        </G>
      )}
    </>
  );
}

// ── the front: desk and errand table, drawn over whoever sits there ─────────
function RoomFront() {
  return (
    <>
      <Ellipse cx={176} cy={480} rx={142} ry={8} fill="#000000" opacity={0.16} />
      <Rect x={56} y={436} width={12} height={42} fill="#5E3A24" />
      <Rect x={284} y={436} width={12} height={42} fill="#5E3A24" />
      <Rect x={52} y={384} width={248} height={54} fill="#744A30" />
      <Rect x={196} y={394} width={92} height={36} rx={3} fill="#7E5136" stroke="#5E3A24" strokeWidth={1.5} />
      <Circle cx={242} cy={412} r={3.5} fill="#D9B27C" />
      <Rect x={64} y={394} width={120} height={36} rx={3} fill="#7E5136" stroke="#5E3A24" strokeWidth={1.5} />
      <Circle cx={124} cy={412} r={3.5} fill="#D9B27C" />
      <Rect x={40} y={372} width={272} height={14} rx={4} fill="#8A5A3B" />
      <Rect x={40} y={372} width={272} height={3} rx={1.5} fill="#A86F4A" />
      <Rect x={196} y={316} width={66} height={54} rx={5} fill="#C9CDD3" stroke="#A9AFB7" strokeWidth={1.5} />
      <Path d="M 221 345 C 221 336 228 331 233 331 C 239 331 243 336 243 343 C 243 350 238 354 232 354 C 226 354 221 351 221 345 Z" fill="#E9EDF1" />
      <Rect x={188} y={368} width={82} height={5} rx={2} fill="#A9AFB7" />
      <Rect x={78} y={352} width={17} height={20} rx={3} fill="#EEE8DD" />
      <Path d="M 95 357 C 102 357 102 367 95 367" fill="none" stroke="#EEE8DD" strokeWidth={3} />
      <Rect x={78} y={352} width={17} height={4} fill="#3E8EF0" />
      <Ellipse cx={292} cy={370} rx={14} ry={4} fill="#2F3A44" />
      <Path d="M 292 368 L 302 336 L 284 314" fill="none" stroke="#2F3A44" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 266 318 L 286 302 L 298 314 L 280 328 Z" fill="#E2B04A" />

      <Ellipse cx={920} cy={484} rx={50} ry={6} fill="#000000" opacity={0.16} />
      <Rect x={916} y={436} width={8} height={46} fill="#5E3A24" />
      <Ellipse cx={920} cy={482} rx={24} ry={5} fill="#5E3A24" />
      <Rect x={872} y={430} width={96} height={7} fill="#744A30" />
      <Ellipse cx={920} cy={430} rx={48} ry={9} fill="#8A5A3B" />
      <Path d="M 930 428 L 933 396 L 957 396 L 960 428 Z" fill="#D9B27C" />
      <Path d="M 933 396 L 957 396 L 955 403 L 935 403 Z" fill="#C49A60" />
      <Path d="M 940 396 C 940 388 950 388 950 396" fill="none" stroke="#A07A46" strokeWidth={1.6} />
      <Rect x={898} y={398} width={17} height={28} rx={3} fill={INK} />
      <Rect x={900} y={401} width={13} height={21} rx={1.5} fill="#2A3440" />
    </>
  );
}

// ── evening and night light ─────────────────────────────────────────────────
function RoomLight({ tod, decor }: { tod: Tod; decor: RoomDecor }) {
  const T = TOD[tod];
  return (
    <>
      <Defs>
        <RadialGradient id="rm-warm" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFD9A0" stopOpacity={0.95} />
          <Stop offset="0.45" stopColor="#FFC27A" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#FFC27A" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={ROOM_W} height={ROOM_H} fill={T.tint[0]} opacity={T.tint[1]} />
      <Ellipse cx={568} cy={120} rx={300} ry={230} fill="url(#rm-warm)" opacity={T.glow * 0.45} />
      <Ellipse cx={276} cy={340} rx={120} ry={90} fill="url(#rm-warm)" opacity={T.glow * 0.5} />
      {decor.lights && <Rect x={0} y={0} width={ROOM_W} height={90} fill="#FFD27A" opacity={T.glow * 0.08} />}
    </>
  );
}

// ── a teammate in the room ──────────────────────────────────────────────────
function RoomMate({
  member,
  place,
  scale,
  selected,
  onPress,
}: {
  member: Member;
  place: Placement;
  scale: number;
  selected: boolean;
  onPress: () => void;
}) {
  const p = useTheme();
  const reduced = useReducedMotion();
  const depth = depthScale(place.y);
  const size = 150 * depth * scale;
  const tx = useSharedValue(place.x * scale - size / 2);
  const ty = useSharedValue(place.y * scale - size * 0.86);
  const hop = useSharedValue(0);

  useEffect(() => {
    const x = place.x * scale - size / 2;
    const y = place.y * scale - size * 0.86;
    if (reduced) {
      tx.value = x;
      ty.value = y;
      return;
    }
    const dist = Math.hypot(x - tx.value, y - ty.value);
    const duration = Math.min(1600, 400 + dist * 4);
    tx.value = withTiming(x, { duration, easing: Easing.inOut(Easing.quad) });
    ty.value = withTiming(y, { duration, easing: Easing.inOut(Easing.quad) });
    if (dist > 4) {
      const hops = Math.max(1, Math.round(duration / 320));
      const seq = Array.from({ length: hops }, () => [withTiming(-size * 0.12, { duration: 150 }), withTiming(0, { duration: 150 })]).flat();
      hop.value = withSequence(...seq);
    }
  }, [place.x, place.y, scale, size, reduced, tx, ty, hop]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value + hop.value }] }));

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      {selected || member.state === 'waiting' ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(160)}
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: size * 1.02,
            left: Math.max(4 - place.x * scale + size / 2, Math.min(size / 2 - 80, ROOM_W * scale - 164 - place.x * scale + size / 2)),
            width: 160,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: 10,
              backgroundColor: member.state === 'waiting' ? p.signal : '#FFFDF7',
              boxShadow: '0px 2px 6px rgba(0,0,0,0.18)',
            }}
          >
            <Text
              numberOfLines={2}
              style={{ fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, color: member.state === 'waiting' ? p.onSignal : INK, textAlign: 'center' }}
            >
              {member.state === 'waiting' && !selected ? 'Needs you' : `${member.name}: ${member.status}`}
            </Text>
          </View>
        </Animated.View>
      ) : null}
      <MemberPebble member={member} size={size} shadow onPress={onPress} />
    </Animated.View>
  );
}

// ── the room ────────────────────────────────────────────────────────────────
export function CrewRoom({
  members,
  leadId,
  decor,
  notes,
  height,
  selectedId,
  onSelect,
  onStation,
}: {
  members: Member[];
  leadId: string;
  decor: RoomDecor;
  /** How many sticky notes on the board (today's plan). */
  notes: number;
  height: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onStation?: (s: Station) => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const scale = height / ROOM_H;
  const width = ROOM_W * scale;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const tod: Tod = decor.time === 'auto' ? todNow(now.getHours()) : decor.time;
  const places = useMemo(() => placeCrew(members, leadId), [members, leadId]);
  const deskBusy = Object.values(places).some((pl) => pl.station === 'desk');
  // Draw back to front so nearer pebbles overlap farther ones.
  const ordered = [...members].sort((a, b) => (places[a.id]?.y ?? 0) - (places[b.id]?.y ?? 0));
  const seated = ordered.filter((m) => places[m.id]?.station === 'desk');
  const standing = ordered.filter((m) => places[m.id]?.station !== 'desk');

  const hotspots: { s: Station; x: number; y: number; w: number; h: number }[] = [
    { s: 'desk', x: 40, y: 300, w: 272, h: 180 },
    { s: 'shelf', x: 320, y: 110, w: 132, h: 322 },
    { s: 'board', x: 648, y: 116, w: 156, h: 176 },
    { s: 'table', x: 872, y: 390, w: 100, h: 92 },
  ];

  const scene = (
    <View style={{ width, height, overflow: 'hidden', borderRadius: 22 }}>
      <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={{ position: 'absolute' }}>
        <RoomBack decor={decor} tod={tod} crew={members.map((m) => m.color)} notes={notes} now={now} deskBusy={deskBusy} />
      </Svg>
      {hotspots.map((h) => (
        <Pressable
          key={h.s}
          onPress={() => onStation?.(h.s)}
          accessibilityRole="button"
          accessibilityLabel={STATION_INFO[h.s].label}
          style={{ position: 'absolute', left: h.x * scale, top: h.y * scale, width: h.w * scale, height: h.h * scale }}
        />
      ))}
      {seated.map((m) => (
        <RoomMate key={m.id} member={m} place={places[m.id]} scale={scale} selected={selectedId === m.id} onPress={() => onSelect?.(selectedId === m.id ? null : m.id)} />
      ))}
      <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={{ position: 'absolute' }} pointerEvents="none">
        <RoomFront />
      </Svg>
      {standing.map((m) => (
        <RoomMate key={m.id} member={m} place={places[m.id]} scale={scale} selected={selectedId === m.id} onPress={() => onSelect?.(selectedId === m.id ? null : m.id)} />
      ))}
      <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={{ position: 'absolute' }} pointerEvents="none">
        <RoomLight tod={tod} decor={decor} />
      </Svg>
    </View>
  );

  if (width <= screenW - 32) return <View style={{ alignItems: 'center' }}>{scene}</View>;
  // Wider than the screen: scroll sideways, starting at the middle of the room.
  const middle = (width - screenW) / 2 + 16;
  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => scroller.current?.scrollTo({ x: middle, animated: false })}
      style={{ marginHorizontal: -16 }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {scene}
    </ScrollView>
  );
}
