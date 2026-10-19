/**
 * The Crew loop: an infinity sign with nine seats and the lead at the
 * center crossing. Members fill seats in order, nearest the center first.
 */
import React, { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useCrew } from '@/lib/store';
import type { Member } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { deepen, MARK_PATHS } from './shapes';
import { haptic } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SEG = 64.25;
const GAP = 13;
const RO = 76;
const RI = 44;
const CY = 100;

function pt(cx: number, r: number, a: number): string {
  const t = (a * Math.PI) / 180;
  return `${(cx + r * Math.cos(t)).toFixed(1)} ${(CY + r * Math.sin(t)).toFixed(1)}`;
}

function sector(cx: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${pt(cx, RO, a0)} A${RO} ${RO} 0 ${large} 1 ${pt(cx, RO, a1)} L${pt(cx, RI, a1)} A${RI} ${RI} 0 ${large} 0 ${pt(cx, RI, a0)} Z`;
}

interface SeatDef {
  id: string;
  d: string;
  eye: [number, number];
}

const DEFS: Record<string, SeatDef> = {};
[0, 1, 2, 3].forEach((i) => {
  const a0 = 32 + i * (SEG + GAP);
  const mid = ((a0 + SEG / 2) * Math.PI) / 180;
  DEFS[`L${i}`] = { id: `L${i}`, d: sector(120, a0, a0 + SEG), eye: [120 + 60 * Math.cos(mid), CY + 60 * Math.sin(mid)] };
  const b0 = 212 + i * (SEG + GAP);
  const midB = ((b0 + SEG / 2) * Math.PI) / 180;
  DEFS[`R${i}`] = { id: `R${i}`, d: sector(280, b0, b0 + SEG), eye: [280 + 60 * Math.cos(midB), CY + 60 * Math.sin(midB)] };
});
DEFS.AL = { id: 'AL', d: 'M97 106 C99 88 122 79 141 86 C151 90 148 104 136 112 C121 121 95 121 97 106 Z', eye: [122, 101] };

/** Seat number (0..8) to its place on the loop, nearest the center first. */
export const SEAT_ORDER = ['L3', 'R0', 'L2', 'R1', 'L1', 'R2', 'L0', 'R3', 'AL'];

export type LoopSelection = { kind: 'member'; id: string } | { kind: 'open'; seat: number } | { kind: 'locked'; seat: number };

export function CrewLoop({
  members,
  leadId,
  seatLimit,
  selected,
  onSelect,
  compact,
}: {
  members: Member[];
  leadId: string;
  seatLimit: number; // total Crew size allowed (lead included)
  selected?: LoopSelection | null;
  onSelect?: (s: LoopSelection) => void;
  compact?: boolean;
}) {
  const p = useTheme();
  const eyesOn = useCrew((s) => s.settings.eyes);
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const w = Math.min(compact ? 260 : 380, width - 32);
  const h = (w * 172) / 340;
  const lead = members.find((m) => m.id === leadId);

  const ripple = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    ripple.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.out(Easing.quad) }), -1);
    pulse.value = withRepeat(withSequence(withTiming(0.55, { duration: 900 }), withTiming(1, { duration: 900 })), -1);
  }, [reduced, ripple, pulse]);
  const ringProps = useAnimatedProps(() => ({ r: 30 * (0.7 + 0.85 * ripple.value), opacity: 0.9 * (1 - ripple.value) }));
  const workingProps = useAnimatedProps(() => ({ opacity: pulse.value }));

  const bySeat = new Map<number, Member>();
  members.forEach((m) => {
    if (m.id !== leadId && m.seat >= 0) bySeat.set(m.seat, m);
  });

  const isSel = (s: LoopSelection) => {
    if (!selected) return false;
    if (s.kind === 'member' && selected.kind === 'member') return s.id === selected.id;
    if (s.kind !== 'member' && selected.kind !== 'member') return s.seat === selected.seat;
    return false;
  };

  const pick = (s: LoopSelection) => {
    haptic('select');
    onSelect?.(s);
  };

  const leadSel = selected?.kind === 'member' && selected.id === leadId;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={w} height={h} viewBox="30 14 340 172" style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id="seatShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.22} />
          </LinearGradient>
        </Defs>
        <G fill="none" stroke={p.ripple} strokeWidth={1.2}>
          <Ellipse cx={200} cy={100} rx={186} ry={100} />
          <Ellipse cx={200} cy={100} rx={206} ry={114} />
        </G>
        {SEAT_ORDER.map((id, seat) => {
          const def = DEFS[id];
          const m = bySeat.get(seat);
          const available = seat < seatLimit - 1;
          const sel: LoopSelection = m ? { kind: 'member', id: m.id } : available ? { kind: 'open', seat } : { kind: 'locked', seat };
          const fill = m ? m.color : available ? p.card2 : p.shadow;
          const chosen = isSel(sel);
          const stroke = chosen ? p.text : m ? m.color : available ? p.lineStrong : p.shadow;
          const P = m?.state === 'working' ? AnimatedPath : Path;
          return (
            <G key={id}>
              <P
                d={def.d}
                fill={fill}
                stroke={stroke}
                strokeWidth={chosen ? 7 : m ? 7 : 2}
                strokeDasharray={!m && available && !chosen ? '6 6' : undefined}
                strokeLinejoin="round"
                onPress={() => pick(sel)}
                {...(m?.state === 'working' ? { animatedProps: workingProps } : {})}
              />
              {m ? <Path d={def.d} fill="url(#seatShade)" pointerEvents="none" /> : null}
              {m && eyesOn && m.face !== 'faceless' ? (
                <G pointerEvents="none">
                  <Ellipse cx={def.eye[0] - 5} cy={def.eye[1] - 1} rx={2.7} ry={m.face === 'sleepy' || m.mood === 'sleepy' ? 1.6 : 4} fill={p.pebbleInk} />
                  <Ellipse cx={def.eye[0] + 5} cy={def.eye[1] - 1} rx={2.7} ry={m.face === 'sleepy' || m.mood === 'sleepy' ? 1.6 : 4} fill={p.pebbleInk} />
                  {m.face !== 'sleepy' && m.mood !== 'sleepy' ? (
                    <>
                      <Circle cx={def.eye[0] - 5.9} cy={def.eye[1] - 2.6} r={0.95} fill="#FFFFFF" />
                      <Circle cx={def.eye[0] + 4.1} cy={def.eye[1] - 2.6} r={0.95} fill="#FFFFFF" />
                    </>
                  ) : null}
                  <Path
                    d={
                      m.state === 'working'
                        ? `M${def.eye[0] - 2.5} ${def.eye[1] + 6} L${def.eye[0] + 2.5} ${def.eye[1] + 6}`
                        : `M${def.eye[0] - 3} ${def.eye[1] + 5} Q${def.eye[0]} ${def.eye[1] + 8.5} ${def.eye[0] + 3} ${def.eye[1] + 5}`
                    }
                    fill="none"
                    stroke={p.pebbleInk}
                    strokeWidth={1.4}
                    strokeLinecap="round"
                  />
                </G>
              ) : null}
              {m && (!eyesOn || m.face === 'faceless') ? (
                <G pointerEvents="none" transform={`translate(${def.eye[0] - 7} ${def.eye[1] - 7}) scale(0.14)`}>
                  <Path
                    d={MARK_PATHS[m.mark].d}
                    fill={MARK_PATHS[m.mark].filled ? deepen(m.color) : 'none'}
                    stroke={MARK_PATHS[m.mark].filled ? 'none' : deepen(m.color)}
                    strokeWidth={9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </G>
              ) : null}
              {!m && available ? (
                <G pointerEvents="none">
                  <Path
                    d={`M${def.eye[0] - 5} ${def.eye[1]} L${def.eye[0] + 5} ${def.eye[1]} M${def.eye[0]} ${def.eye[1] - 5} L${def.eye[0]} ${def.eye[1] + 5}`}
                    stroke={p.muted}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </G>
              ) : null}
              {!m && !available ? (
                <G pointerEvents="none">
                  <Path
                    d={`M${def.eye[0] - 4} ${def.eye[1] - 1} L${def.eye[0] + 4} ${def.eye[1] - 1} L${def.eye[0] + 4} ${def.eye[1] + 5} L${def.eye[0] - 4} ${def.eye[1] + 5} Z M${def.eye[0] - 2.5} ${def.eye[1] - 1} L${def.eye[0] - 2.5} ${def.eye[1] - 4} Q${def.eye[0]} ${def.eye[1] - 7} ${def.eye[0] + 2.5} ${def.eye[1] - 4} L${def.eye[0] + 2.5} ${def.eye[1] - 1}`}
                    fill="none"
                    stroke={p.muted}
                    strokeWidth={1.4}
                    strokeLinejoin="round"
                    opacity={0.7}
                  />
                </G>
              ) : null}
            </G>
          );
        })}
        <AnimatedCircle cx={200} cy={100} fill="none" stroke={lead?.color ?? p.glow} strokeWidth={2} animatedProps={ringProps} />
        <Path
          d="M200 76 L224 100 L200 124 L176 100 Z"
          fill={lead?.color ?? '#3E8EF0'}
          stroke={leadSel ? p.text : (lead?.color ?? '#3E8EF0')}
          strokeWidth={10}
          strokeLinejoin="round"
          onPress={() => lead && pick({ kind: 'member', id: lead.id })}
        />
        <Path d="M200 76 L224 100 L200 124 L176 100 Z" fill="url(#seatShade)" pointerEvents="none" />
        {eyesOn && lead?.face !== 'faceless' ? (
          <G pointerEvents="none">
            <Ellipse cx={195} cy={98} rx={2.5} ry={3.8} fill={p.pebbleInk} />
            <Ellipse cx={205} cy={98} rx={2.5} ry={3.8} fill={p.pebbleInk} />
            <Circle cx={194.2} cy={96.5} r={0.9} fill="#FFFFFF" />
            <Circle cx={204.2} cy={96.5} r={0.9} fill="#FFFFFF" />
            <Path d="M197 104 Q200 107 203 104" fill="none" stroke={p.pebbleInk} strokeWidth={1.3} strokeLinecap="round" />
          </G>
        ) : (
          <Path d="M200 93 L207 100 L200 107 L193 100 Z" fill="#EEE8DD" pointerEvents="none" />
        )}
      </Svg>
    </View>
  );
}
