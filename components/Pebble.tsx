/**
 * The living pebble. Every teammate is one: a stone with real shading, a
 * material, a face that changes with what they're doing, and whatever they
 * like to wear. It breathes while idle, blinks, glints while working,
 * ripples while waiting on you and looks proud when it's done. Stones wear
 * smooth (and grow a little moss) with time together.
 */
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { moodFor, wearFor } from '@/lib/cosmetics';
import { useCrew } from '@/lib/store';
import type { Extra, Face, Finish, Mark, Member, MemberState, Mood, Motion, Shape } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { darken, deepen, lighten, MARK_PATHS, mix, SHAPE_CENTER, SHAPE_FACE, SHAPE_PATHS, SHAPE_SIDE, SHAPE_TOP } from './shapes';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const INK = '#1E2023';

// ── expressions, drawn in face space (eyes at ±19, -4) ─────────────────────
interface MoodDef {
  eye: 'open' | 'arc' | 'sleepy';
  es: number;
  brows: [string, string];
  mouth: string;
  fill: boolean;
  blush: number;
  tilt: number;
  lift: number;
  breath: number;
}

export const MOODS: Record<Mood, MoodDef> = {
  happy: { eye: 'open', es: 1, brows: ['M -27 -20 Q -19 -24 -11 -21', 'M 11 -21 Q 19 -24 27 -20'], mouth: 'M -8 11 Q 0 18 8 11', fill: false, blush: 0.35, tilt: 0, lift: 0, breath: 1 },
  curious: { eye: 'open', es: 1.12, brows: ['M -27 -26 Q -19 -32 -11 -27', 'M 11 -21 Q 19 -23 27 -21'], mouth: 'M -3.2 14 a 3.2 3.8 0 1 0 6.4 0 a 3.2 3.8 0 1 0 -6.4 0', fill: true, blush: 0.2, tilt: 7, lift: 0, breath: 1 },
  focused: { eye: 'open', es: 0.72, brows: ['M -28 -22 L -12 -17', 'M 12 -17 L 28 -22'], mouth: 'M -6 13 L 6 13', fill: false, blush: 0, tilt: -2, lift: 1, breath: 1.4 },
  proud: { eye: 'arc', es: 1, brows: ['M -27 -24 Q -19 -28 -11 -25', 'M 11 -25 Q 19 -28 27 -24'], mouth: 'M -10 9 Q 0 22 10 9 Z', fill: true, blush: 0.5, tilt: 0, lift: -3, breath: 1 },
  sleepy: { eye: 'sleepy', es: 0.2, brows: ['M -27 -16 Q -19 -14 -11 -17', 'M 11 -17 Q 19 -14 27 -16'], mouth: 'M -4 13 Q 0 15.5 4 13', fill: false, blush: 0.25, tilt: 4, lift: 2, breath: 0.55 },
  excited: { eye: 'open', es: 1.2, brows: ['M -27 -26 Q -19 -31 -11 -27', 'M 11 -27 Q 19 -31 27 -26'], mouth: 'M -9 9 Q 0 24 9 9 Z', fill: true, blush: 0.55, tilt: 0, lift: 0, breath: 1.3 },
  surprised: { eye: 'open', es: 1.32, brows: ['M -27 -28 Q -19 -34 -11 -29', 'M 11 -29 Q 19 -34 27 -28'], mouth: 'M -4 15 a 4 5 0 1 0 8 0 a 4 5 0 1 0 -8 0', fill: true, blush: 0.2, tilt: 0, lift: 0, breath: 1.2 },
};

// ── how each material looks ─────────────────────────────────────────────────
interface Look {
  hi: string;
  base: string;
  lo: string;
  opacity: number;
  speck: number;
  veins: number;
}

function lookFor(color: string, finish: Finish, wear: number): Look {
  let base = color;
  let hi = lighten(color, 0.42);
  let lo = darken(color, 0.36);
  if (finish === 'granite') {
    base = mix(color, '#8E8A84', 0.4);
    hi = lighten(base, 0.3);
    lo = darken(base, 0.42);
  } else if (finish === 'glass') {
    base = lighten(color, 0.22);
    hi = lighten(color, 0.68);
    lo = mix(color, '#1F3550', 0.3);
  } else if (finish === 'marble') {
    base = mix(color, '#F4F1EA', 0.55);
    hi = '#FFFFFF';
    lo = darken(base, 0.25);
  }
  const speck = { smooth: 0.26, granite: 0.72, glass: 0, moss: 0.2, glow: 0.2, gold: 0.22, marble: 0.1 }[finish] ?? 0.26;
  const veins = { smooth: 0.45, granite: 0.15, glass: 0, moss: 0.25, glow: 0.3, gold: 0.3, marble: 0 }[finish] ?? 0.4;
  return {
    hi,
    base,
    lo,
    opacity: finish === 'glass' ? 0.8 : 1,
    speck: speck * (1 - wear * 0.6),
    veins: veins * (1 - wear * 0.5),
  };
}

/** A small seeded random so a stone's speckles stay put between launches. */
function seeded(seed: number) {
  let s = Math.abs(seed) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h;
}

function makeSpecks(seed: number, count: number) {
  const r = seeded(seed);
  const out: { x: number; y: number; r: number; light: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    do {
      x = 50 + (r() * 2 - 1) * 46;
      y = 50 + (r() * 2 - 1) * 46;
    } while (((x - 50) / 47) ** 2 + ((y - 50) / 47) ** 2 > 0.95);
    out.push({ x, y, r: 0.5 + r() * 1.3, light: r() < 0.32 });
  }
  return out;
}

export interface PebbleProps {
  shape: Shape;
  color: string;
  face?: Face;
  mark?: Mark;
  finish?: Finish;
  motion?: Motion;
  state?: MemberState;
  /** Resting expression; work states override it unless `mood` is given. */
  restingMood?: Mood;
  /** Force an expression. */
  mood?: Mood;
  extras?: Extra[];
  /** 0 brand new .. 1 worn smooth with moss. */
  wear?: number;
  /** Seeds the speckle pattern so each stone is its own. */
  seed?: string;
  size?: number;
  /** Force eyes on or off; defaults to the person's setting. */
  eyes?: boolean;
  animate?: boolean;
  outline?: string;
  shadow?: boolean;
  /** Squish and make a face when tapped. On by default when tappable. */
  reacts?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  label?: string;
  style?: ViewStyle;
}

let gradientSeq = 0;

// The drawing reaches past the layout box so hats and ripples have room.
const VB = 128; // the pebble's own box: 100 units plus 14 on each side
const OUT = 1.3; // the drawing is 30% bigger than the layout box, centered

function PebbleBase({
  shape,
  color,
  face = 'eyes',
  mark = 'diamond',
  finish = 'smooth',
  motion = 'calm',
  state = 'idle',
  restingMood,
  mood: forcedMood,
  extras,
  wear = 0.35,
  seed,
  size = 56,
  eyes,
  animate = true,
  outline,
  shadow,
  reacts,
  onPress,
  onLongPress,
  label,
  style,
}: PebbleProps) {
  const palette = useTheme();
  const eyesSetting = useCrew((s) => s.settings.eyes);
  const reduced = useReducedMotion();
  const live = animate && !reduced;
  const showFace = (eyes ?? eyesSetting) && face !== 'faceless';
  const ids = useMemo(() => ++gradientSeq, []);
  const detail = size >= 44 ? 2 : size >= 26 ? 1 : 0;
  const withShadow = shadow ?? size >= 36;
  const has = (x: Extra) => !!extras?.includes(x);

  // a quick face after a poke
  const [poked, setPoked] = useState<Mood | null>(null);
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pokeTimer.current) clearTimeout(pokeTimer.current);
    },
    [],
  );

  const mood: Mood = poked ?? forcedMood ?? moodFor(state, restingMood, face);
  const M = MOODS[mood];

  // ── body motion ──────────────────────────────────────────────────────────
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const tilt = useSharedValue(0);
  const squish = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(lift);
    cancelAnimation(tilt);
    scale.value = 1;
    lift.value = 0;
    tilt.value = 0;
    if (!live) return;
    const ease = Easing.inOut(Easing.sin);
    const breath = M.breath;
    if (motion === 'calm' || motion === 'slow') {
      const half = (motion === 'calm' ? 2250 : 3250) / breath;
      scale.value = withRepeat(
        withSequence(withTiming(1.04, { duration: half, easing: ease }), withTiming(1, { duration: half, easing: ease })),
        -1,
      );
    } else if (motion === 'bouncy') {
      lift.value = withRepeat(
        withSequence(
          withTiming(-0.12, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 900 / breath }),
        ),
        -1,
      );
    } else if (motion === 'sharp') {
      tilt.value = withRepeat(
        withSequence(withDelay(2600, withTiming(-7, { duration: 90 })), withTiming(5, { duration: 110 }), withTiming(0, { duration: 140 })),
        -1,
      );
    }
  }, [live, motion, M.breath, scale, lift, tilt]);

  // Breathing stretches a little taller than it widens, like the sample.
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value * size },
      { scaleX: (1 + (scale.value - 1) * 0.5) * (squish.value === 1 ? 1 : 2 - squish.value) },
      { scaleY: scale.value * squish.value },
      { rotate: `${tilt.value}deg` },
    ],
  }));

  // ── blink ────────────────────────────────────────────────────────────────
  const blink = useSharedValue(1);
  const canBlink = live && showFace && M.eye === 'open' && detail > 0;
  useEffect(() => {
    cancelAnimation(blink);
    blink.value = 1;
    if (!canBlink) return;
    const wait = 3200 + Math.round(Math.random() * 2600);
    blink.value = withRepeat(withSequence(withDelay(wait, withTiming(0.08, { duration: 80 })), withTiming(1, { duration: 110 })), -1);
  }, [canBlink, blink]);

  const esx = M.eye === 'sleepy' ? 1.05 : M.es > 1 ? 1 + (M.es - 1) * 0.6 : 1;
  const esy = M.eye === 'sleepy' ? 0.2 : M.es;
  const eyeRx = 6.4 * esx;
  const eyeRy = 8.4 * esy;
  const eyeA = useAnimatedProps(() => ({ ry: eyeRy * blink.value }));
  const eyeB = useAnimatedProps(() => ({ ry: eyeRy * blink.value }));
  const hiA = useAnimatedProps(() => ({ r: 2.3 * blink.value }));
  const hiB = useAnimatedProps(() => ({ r: 2.3 * blink.value }));

  // ── working glint ────────────────────────────────────────────────────────
  const glint = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(glint);
    glint.value = 0;
    if (state !== 'working' || !live) return;
    glint.value = withRepeat(withTiming(-300, { duration: 2200, easing: Easing.linear }), -1);
  }, [state, live, glint]);
  const glintProps = useAnimatedProps(() => ({ strokeDashoffset: glint.value }));

  // ── waiting ripples ──────────────────────────────────────────────────────
  const ripple = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(ripple);
    ripple.value = 0;
    if (state !== 'waiting' || !live) return;
    ripple.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1);
  }, [state, live, ripple]);
  const ringA = useAnimatedProps(() => ({ r: 46 * (0.7 + 0.85 * ripple.value), opacity: 0.9 * (1 - ripple.value) }));
  const ringB = useAnimatedProps(() => {
    const t = (ripple.value + 0.5) % 1;
    return { r: 46 * (0.7 + 0.85 * t), opacity: 0.9 * (1 - t) };
  });

  // ── glow finish ──────────────────────────────────────────────────────────
  const glow = useSharedValue(0.45);
  useEffect(() => {
    cancelAnimation(glow);
    if (finish !== 'glow' || !live) return;
    glow.value = withRepeat(withSequence(withTiming(0.75, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1);
  }, [finish, live, glow]);
  const glowProps = useAnimatedProps(() => ({ opacity: glow.value }));

  const press = () => {
    squish.value = withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, { damping: 6, stiffness: 260 }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if ((reacts ?? true) && showFace) {
      const faces: Mood[] = mood === 'sleepy' ? ['surprised'] : ['excited', 'surprised', 'happy'];
      setPoked(faces[Math.floor(Math.random() * faces.length)]);
      if (pokeTimer.current) clearTimeout(pokeTimer.current);
      pokeTimer.current = setTimeout(() => setPoked(null), 900);
    }
    onPress?.();
  };

  // ── geometry ─────────────────────────────────────────────────────────────
  const d = SHAPE_PATHS[shape];
  const [fx, fy, fk, fr] = SHAPE_FACE[shape];
  const [tx, ty, tr, tw] = SHAPE_TOP[shape];
  const [sx, sy, sr] = SHAPE_SIDE[shape];
  const [cx, cy] = SHAPE_CENTER[shape];
  const markDef = MARK_PATHS[mark];
  const markColor = mark === 'diamond' ? '#EEE8DD' : deepen(color);
  const look = lookFor(color, finish, wear);
  const specks = useMemo(() => (detail === 2 ? makeSpecks(hashString(seed ?? `${color}${shape}`), 24) : []), [detail, seed, color, shape]);
  const scratch = finish === 'glass' ? 0 : Math.max(0, (0.35 - wear) / 0.35) * 0.6;
  const moss = finish === 'moss' ? 1 : finish === 'glass' || finish === 'gold' || finish === 'marble' ? 0 : Math.max(0, (wear - 0.55) / 0.45) * 0.85;
  const gloss = Math.max(0, Math.min(1, 0.26 + wear * 0.34 + (finish === 'glass' ? 0.2 : 0) - (finish === 'granite' ? 0.14 : 0)));
  const specOp = Math.max(0, Math.min(1, 0.5 + wear * 0.4 - (finish === 'granite' ? 0.28 : 0)));
  const k = `p${ids}`;

  const span = VB * OUT;
  const off = (span - VB) / 2;
  const drawSize = size * OUT;

  const faceGroup = showFace ? (
    <G transform={`translate(${fx} ${fy + M.lift * fk}) rotate(${fr}) scale(${fk})`}>
      {detail > 0 && M.blush > 0 && (
        <G opacity={M.blush}>
          <Ellipse cx={-31} cy={8} rx={8.5} ry={5} fill={`url(#${k}blush)`} />
          <Ellipse cx={31} cy={8} rx={8.5} ry={5} fill={`url(#${k}blush)`} />
        </G>
      )}
      {has('freckles') && detail > 0 && (
        <G fill={darken(color, 0.45)} opacity={0.7}>
          <Circle cx={-33} cy={5} r={1.3} />
          <Circle cx={-28} cy={9} r={1.2} />
          <Circle cx={-35} cy={11} r={1.1} />
          <Circle cx={33} cy={5} r={1.3} />
          <Circle cx={28} cy={9} r={1.2} />
          <Circle cx={35} cy={11} r={1.1} />
        </G>
      )}
      {M.eye === 'arc' ? (
        <G fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round">
          <Path d="M -25.5 -2.2 Q -19 -10.5 -12.5 -2.2" />
          <Path d="M 12.5 -2.2 Q 19 -10.5 25.5 -2.2" />
        </G>
      ) : (
        <G>
          <AnimatedEllipse cx={-19} cy={-4} rx={eyeRx} fill={INK} animatedProps={eyeA} />
          <AnimatedEllipse cx={19} cy={-4} rx={eyeRx} fill={INK} animatedProps={eyeB} />
          {M.eye === 'open' && detail > 0 && (
            <>
              <AnimatedCircle cx={-21} cy={-4 - 3.4 * esy} fill="#FFFFFF" animatedProps={hiA} />
              <AnimatedCircle cx={17} cy={-4 - 3.4 * esy} fill="#FFFFFF" animatedProps={hiB} />
              {detail === 2 && (
                <>
                  <Circle cx={-16.8} cy={-4 + 2.8 * esy} r={1} fill="#FFFFFF" opacity={0.75} />
                  <Circle cx={21.2} cy={-4 + 2.8 * esy} r={1} fill="#FFFFFF" opacity={0.75} />
                </>
              )}
            </>
          )}
        </G>
      )}
      {detail > 0 && (
        <G fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round">
          <Path d={M.brows[0]} />
          <Path d={M.brows[1]} />
        </G>
      )}
      {detail > 0 && <Path d={M.mouth} fill={M.fill ? INK : 'none'} stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
      {has('glasses') && (
        <G fill="none" stroke={INK} strokeWidth={2}>
          <Circle cx={-19} cy={-4} r={11.5} fill="#FFFFFF" fillOpacity={0.14} />
          <Circle cx={19} cy={-4} r={11.5} fill="#FFFFFF" fillOpacity={0.14} />
          <Path d="M -8 -6 Q 0 -10 8 -6" />
          <Path d="M -30 -6 L -40 -9 M 30 -6 L 40 -9" strokeLinecap="round" />
        </G>
      )}
      {has('sunglasses') && (
        <G>
          <Path d="M -33 -13 L -6 -13 Q -4 -13 -5 -9 L -7 -1 Q -9 6 -16 6 L -23 6 Q -31 6 -33 -2 Z" fill={INK} />
          <Path d="M 33 -13 L 6 -13 Q 4 -13 5 -9 L 7 -1 Q 9 6 16 6 L 23 6 Q 31 6 33 -2 Z" fill={INK} />
          <Path d="M -6 -10 Q 0 -13 6 -10" fill="none" stroke={INK} strokeWidth={2.2} />
          <Path d="M -28 -9 L -20 -9 M 14 -9 L 22 -9" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" />
        </G>
      )}
    </G>
  ) : (
    <G transform={`translate(${cx - 50} ${cy - 50})`}>
      <Path
        d={markDef.d}
        fill={markDef.filled ? markColor : 'none'}
        stroke={markDef.filled ? 'none' : markColor}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );

  const body = (
    <Animated.View style={[{ width: size, height: size }, bodyStyle]}>
      <Svg
        width={drawSize}
        height={drawSize}
        viewBox={`${-14 - off} ${-14 - off} ${span} ${span}`}
        style={{ position: 'absolute', left: (size - drawSize) / 2, top: (size - drawSize) / 2 }}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id={`${k}body`} cx="38%" cy="30%" r="80%" fx="30%" fy="22%">
            <Stop offset="0" stopColor={look.hi} />
            <Stop offset="0.5" stopColor={look.base} />
            <Stop offset="1" stopColor={look.lo} />
          </RadialGradient>
          <LinearGradient id={`${k}shade`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
            <Stop offset="0.48" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.78" stopColor="#000000" stopOpacity={0.06} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.3} />
          </LinearGradient>
          <RadialGradient id={`${k}soft`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${k}shadow`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity={finish === 'glass' ? 0.3 : 0.24} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${k}blush`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FF7FA6" stopOpacity={0.95} />
            <Stop offset="1" stopColor="#FF7FA6" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${k}glow`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.85} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${k}gold`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F6E3A1" />
            <Stop offset="0.5" stopColor="#D4AF5A" />
            <Stop offset="1" stopColor="#9C7A2B" />
          </LinearGradient>
          <ClipPath id={`${k}clip`}>
            <Path d={d} />
          </ClipPath>
        </Defs>

        {withShadow && <Ellipse cx={50} cy={97} rx={40} ry={7} fill={`url(#${k}shadow)`} />}

        {finish === 'glow' && <AnimatedCircle cx={50} cy={52} r={62} fill={`url(#${k}glow)`} animatedProps={glowProps} />}

        {state === 'waiting' && (
          <>
            <AnimatedCircle cx={50} cy={50} fill="none" stroke={palette.glow} strokeWidth={4} animatedProps={ringA} />
            <AnimatedCircle cx={50} cy={50} fill="none" stroke={palette.glow} strokeWidth={4} animatedProps={ringB} />
          </>
        )}

        <G transform={`rotate(${M.tilt} 50 96)`}>
          {has('sprout') && (
            <G transform={`translate(${tx} ${ty}) rotate(${tr})`}>
              <Path d="M 0 6 C 0 -2 1 -8 2 -14" fill="none" stroke="#4F8A2B" strokeWidth={2.6} strokeLinecap="round" />
              <Path d="M 2 -14 C -6 -21 -13 -16 -11 -10 C -5 -8 -1 -10 2 -14 Z" fill="#7DBA4A" />
              <Path d="M 2 -14 C 9 -24 19 -19 17 -12 C 11 -9 6 -10 2 -14 Z" fill="#96D15E" />
            </G>
          )}

          <Path
            d={d}
            fill={detail === 0 ? look.base : `url(#${k}body)`}
            fillOpacity={look.opacity}
            stroke={outline}
            strokeWidth={outline ? 3 : 0}
            strokeLinejoin="round"
          />

          {detail > 0 && (
            <G clipPath={`url(#${k}clip)`}>
              {detail === 2 && look.veins > 0.01 && (
                <G fill="none" strokeLinecap="round" opacity={look.veins}>
                  <Path d="M 6 38 C 26 48 46 30 66 42 S 90 52 98 46" stroke={lighten(color, 0.6)} strokeWidth={1.1} />
                  <Path d="M 2 70 C 24 76 44 64 64 74 S 86 72 98 64" stroke={darken(color, 0.45)} strokeWidth={0.8} />
                </G>
              )}
              {detail === 2 && look.speck > 0.01 && (
                <G opacity={look.speck}>
                  {specks.map((s, i) => (
                    <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.light ? '#FFFFFF' : darken(color, 0.55)} />
                  ))}
                </G>
              )}
              {detail === 2 && scratch > 0.01 && (
                <G fill="none" stroke="#FFFFFF" strokeWidth={0.8} strokeLinecap="round" opacity={scratch}>
                  <Path d="M 74 24 l 7 -3 M 78 31 l 6 -2 M 18 74 l 7 2 M 66 80 l 5 -2 M 86 56 l 4 3" />
                </G>
              )}
              {finish === 'marble' && (
                <G fill="none" strokeLinecap="round">
                  <Path d="M 4 30 C 24 18 38 46 60 36 S 86 18 100 30" stroke={darken(look.base, 0.32)} strokeWidth={1.6} opacity={0.5} />
                  <Path d="M 0 62 C 22 52 40 76 62 64 S 86 56 100 70" stroke={darken(look.base, 0.25)} strokeWidth={1.1} opacity={0.45} />
                  <Path d="M 14 86 C 36 76 56 92 82 80" stroke="#FFFFFF" strokeWidth={1.4} opacity={0.7} />
                </G>
              )}
              {moss > 0.01 && (
                <G opacity={moss}>
                  <Path d="M -4 52 C -4 26 16 4 44 2 C 50 10 42 15 36 20 C 30 25 28 31 20 34 C 14 37 8 42 -4 52 Z" fill="#5E8F3A" />
                  <Path d="M -4 50 C -1 30 14 12 38 6 C 35 13 27 18 22 24 C 17 30 9 37 -4 50 Z" fill="#7DB24E" />
                  {detail === 2 && (
                    <G fill="#A9D873">
                      <Circle cx={8} cy={34} r={1.3} />
                      <Circle cx={16} cy={24} r={1.1} />
                      <Circle cx={26} cy={14} r={1.2} />
                      <Circle cx={36} cy={9} r={0.9} />
                      <Circle cx={12} cy={42} r={1} />
                    </G>
                  )}
                </G>
              )}
              {finish === 'gold' && (
                <Path
                  d="M 58 2 L 54 14 L 61 24 L 55 36 L 63 48 L 57 60 M 61 24 L 72 27 L 76 37"
                  fill="none"
                  stroke={`url(#${k}gold)`}
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              <Rect x={-10} y={-10} width={120} height={120} fill={`url(#${k}shade)`} opacity={finish === 'glass' ? 0.5 : 1} />
              {finish === 'glass' && (
                <>
                  <Rect x={-10} y={-10} width={120} height={120} fill="#FFFFFF" opacity={0.1} />
                  <Path d={d} fill="none" stroke="#FFFFFF" strokeWidth={5} opacity={0.55} />
                </>
              )}
            </G>
          )}

          {finish === 'gold' && <Path d={d} fill="none" stroke={`url(#${k}gold)`} strokeWidth={2.5} strokeLinejoin="round" />}

          {/* the shine */}
          <Ellipse
            cx={32}
            cy={27}
            rx={(15 + wear * 7) * 0.62}
            ry={6}
            fill={`url(#${k}soft)`}
            opacity={detail === 0 ? 0.3 : gloss}
            transform="rotate(-24 32 27)"
          />
          {detail > 0 && <Ellipse cx={26} cy={22} rx={3.4} ry={1.9} fill="#FFFFFF" opacity={specOp} transform="rotate(-28 26 22)" />}

          {state === 'working' && (
            <AnimatedPath
              d={d}
              fill="none"
              stroke={palette.mode === 'ink' ? palette.glint : palette.signal}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray="40 260"
              animatedProps={glintProps}
            />
          )}

          {faceGroup}

          {/* hats */}
          {(has('beanie') || has('crown') || has('partyhat')) && (
            <G transform={`translate(${tx} ${ty}) rotate(${tr}) scale(${tw} 1)`}>
              {has('beanie') && (
                <G>
                  <Path d="M -24 10 C -24 -8 -12 -16 0 -16 C 12 -16 24 -8 24 10 Z" fill="#E8735A" />
                  <Path d="M -26 5 Q 0 11 26 5 L 26 12 Q 0 18 -26 12 Z" fill="#C9563F" />
                  {detail > 0 && <Path d="M -12 -12 L -12 6 M 0 -15 L 0 7 M 12 -12 L 12 6" stroke="#D96650" strokeWidth={1.2} />}
                  <Circle cx={0} cy={-17} r={5} fill="#F4E9DA" />
                </G>
              )}
              {has('crown') && (
                <G>
                  <Path
                    d="M -16 5 L -18 -12 L -9 -4 L 0 -17 L 9 -4 L 18 -12 L 16 5 Z"
                    fill={`url(#${k}gold)`}
                    stroke="#9C7A2B"
                    strokeWidth={1}
                    strokeLinejoin="round"
                  />
                  <Circle cx={0} cy={-1} r={2.4} fill="#E05A7A" />
                  <Circle cx={-9} cy={1} r={1.6} fill="#5CC8F2" />
                  <Circle cx={9} cy={1} r={1.6} fill="#8FCB5A" />
                </G>
              )}
              {has('partyhat') && (
                <G transform="rotate(8)">
                  <Path d="M -12 7 L 0 -26 L 12 7 Z" fill="#9C7BC2" />
                  <Path d="M -9.3 -0.4 L 9.3 -0.4 L 10.4 2.6 L -10.4 2.6 Z M -5.6 -10.6 L 5.6 -10.6 L 6.7 -7.6 L -6.7 -7.6 Z" fill="#F2C94C" />
                  <Circle cx={0} cy={-27} r={3.6} fill="#FF8FB1" />
                </G>
              )}
            </G>
          )}

          {/* side pieces */}
          {(has('bow') || has('flower') || has('star')) && (
            <G transform={`translate(${sx} ${sy}) rotate(${sr})`}>
              {has('bow') && (
                <G>
                  <Path d="M 0 0 C -8 -9 -14 -4 -12 2 C -10 7 -4 5 0 0 Z" fill="#FF6F91" />
                  <Path d="M 0 0 C 8 -9 14 -4 12 2 C 10 7 4 5 0 0 Z" fill="#FF6F91" />
                  <Circle cx={0} cy={0} r={2.8} fill="#E04F74" />
                </G>
              )}
              {has('flower') && (
                <G>
                  {[0, 72, 144, 216, 288].map((a) => (
                    <Circle
                      key={a}
                      cx={4.4 * Math.cos((a * Math.PI) / 180)}
                      cy={4.4 * Math.sin((a * Math.PI) / 180)}
                      r={3.6}
                      fill="#FFFFFF"
                      stroke="#F1D7DF"
                      strokeWidth={0.6}
                    />
                  ))}
                  <Circle cx={0} cy={0} r={2.8} fill="#F2C94C" />
                </G>
              )}
              {has('star') && (
                <Path d="M0 -9 L2.3 -2.3 L9 0 L2.3 2.3 L0 9 L-2.3 2.3 L-9 0 L-2.3 -2.3 Z" fill="#F2C94C" stroke="#C9A227" strokeWidth={0.8} strokeLinejoin="round" />
              )}
            </G>
          )}
        </G>

        {state === 'done' && (
          <G>
            <Circle cx={86} cy={14} r={13} fill={palette.success} stroke={palette.bg} strokeWidth={3} />
            <Path d="M80 14 L84.5 18.5 L92 10" fill="none" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </G>
        )}
      </Svg>
    </Animated.View>
  );

  if (!onPress && !onLongPress) {
    return (
      <View style={style} accessible={!!label} accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable onPress={press} onLongPress={onLongPress} style={style} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      {body}
    </Pressable>
  );
}

export const Pebble = memo(PebbleBase);

/** A teammate's pebble, dressed the way the person set them up. */
export function MemberPebble({
  member,
  ...rest
}: { member: Member } & Omit<PebbleProps, 'shape' | 'color' | 'face' | 'mark' | 'motion' | 'restingMood' | 'extras' | 'seed'>) {
  return (
    <Pebble
      {...rest}
      shape={member.shape}
      color={member.color}
      face={member.face}
      mark={member.mark}
      finish={rest.finish ?? member.finish}
      motion={member.motion}
      state={rest.state ?? member.state}
      restingMood={member.mood}
      extras={member.extras}
      wear={rest.wear ?? wearFor(member)}
      seed={member.id}
      label={rest.label ?? member.name}
    />
  );
}
