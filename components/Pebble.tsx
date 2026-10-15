/**
 * The living pebble. Every teammate is one: a smooth river stone with a color,
 * a shape, optional eyes and a mark, that breathes while idle, glints while
 * working, ripples while waiting on you and settles when it's done.
 */
import React, { memo, useEffect } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
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
import { useFamily } from '@/lib/store';
import type { Face, Finish, Mark, Member, MemberState, Motion, Shape } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { deepen, MARK_PATHS, SHAPE_CENTER, SHAPE_EYES, SHAPE_PATHS } from './shapes';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface PebbleProps {
  shape: Shape;
  color: string;
  face?: Face;
  mark?: Mark;
  finish?: Finish;
  motion?: Motion;
  state?: MemberState;
  size?: number;
  /** Force eyes on or off; defaults to the person's setting. */
  eyes?: boolean;
  animate?: boolean;
  outline?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  label?: string;
  style?: ViewStyle;
}

let gradientSeq = 0;

function PebbleBase({
  shape,
  color,
  face = 'eyes',
  mark = 'diamond',
  finish = 'matte',
  motion = 'calm',
  state = 'idle',
  size = 56,
  eyes,
  animate = true,
  outline,
  onPress,
  onLongPress,
  label,
  style,
}: PebbleProps) {
  const palette = useTheme();
  const eyesSetting = useFamily((s) => s.settings.eyes);
  const reduced = useReducedMotion();
  const live = animate && !reduced;
  const showEyes = (eyes ?? eyesSetting) && face !== 'faceless';
  const ids = React.useMemo(() => ++gradientSeq, []);

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
    if (motion === 'calm' || motion === 'slow') {
      const half = motion === 'calm' ? 2250 : 3250;
      scale.value = withRepeat(
        withSequence(withTiming(1.045, { duration: half, easing: ease }), withTiming(1, { duration: half, easing: ease })),
        -1,
      );
    } else if (motion === 'bouncy') {
      lift.value = withRepeat(
        withSequence(
          withTiming(-0.12, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 900 }),
        ),
        -1,
      );
    } else if (motion === 'sharp') {
      tilt.value = withRepeat(
        withSequence(
          withDelay(2600, withTiming(-7, { duration: 90 })),
          withTiming(5, { duration: 110 }),
          withTiming(0, { duration: 140 }),
        ),
        -1,
      );
    }
  }, [live, motion, scale, lift, tilt]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value * size },
      { scale: scale.value },
      { scaleX: squish.value === 1 ? 1 : 2 - squish.value },
      { scaleY: squish.value },
      { rotate: `${tilt.value}deg` },
    ],
  }));

  // ── blink ────────────────────────────────────────────────────────────────
  const blink = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(blink);
    blink.value = 1;
    if (!live || !showEyes) return;
    const wait = 3800 + Math.round(Math.random() * 2400);
    blink.value = withRepeat(
      withSequence(withDelay(wait, withTiming(0.1, { duration: 80 })), withTiming(1, { duration: 120 })),
      -1,
    );
  }, [live, showEyes, blink]);

  const sleepy = face === 'sleepy';
  const eyeRx = sleepy ? 6 : 5.5;
  const eyeRy = sleepy ? 3.4 : 8;
  const eyeProps = useAnimatedProps(() => ({ ry: eyeRy * blink.value }));
  const eyeProps2 = useAnimatedProps(() => ({ ry: eyeRy * blink.value }));

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
    onPress?.();
  };

  const d = SHAPE_PATHS[shape];
  const [e1x, e1y, e2x, e2y] = SHAPE_EYES[shape];
  const [cx, cy] = SHAPE_CENTER[shape];
  const markDef = MARK_PATHS[mark];
  const markColor = mark === 'diamond' ? '#EEE8DD' : deepen(color);
  const pad = 14;

  const body = (
    <Animated.View style={[{ width: size, height: size }, bodyStyle]}>
      <Svg width={size} height={size} viewBox={`${-pad} ${-pad} ${100 + pad * 2} ${100 + pad * 2}`} style={{ overflow: 'visible' }}>
        <Defs>
          <RadialGradient id={`glow${ids}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.85} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`stone${ids}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.28} />
            <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.2} />
          </LinearGradient>
          <LinearGradient id={`gold${ids}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#F6E3A1" />
            <Stop offset="50%" stopColor="#D4AF5A" />
            <Stop offset="100%" stopColor="#9C7A2B" />
          </LinearGradient>
        </Defs>

        {finish === 'glow' && <AnimatedCircle cx={50} cy={52} r={62} fill={`url(#glow${ids})`} animatedProps={glowProps} />}

        {state === 'waiting' && (
          <>
            <AnimatedCircle cx={50} cy={50} fill="none" stroke={palette.glow} strokeWidth={4} animatedProps={ringA} />
            <AnimatedCircle cx={50} cy={50} fill="none" stroke={palette.glow} strokeWidth={4} animatedProps={ringB} />
          </>
        )}

        <Path
          d={d}
          fill={color}
          fillOpacity={finish === 'glass' ? 0.78 : 1}
          stroke={outline ?? (finish === 'gold' ? `url(#gold${ids})` : undefined)}
          strokeWidth={outline ? 3 : finish === 'gold' ? 6 : 0}
          strokeLinejoin="round"
        />

        {(finish === 'stone' || finish === 'gold') && <Path d={d} fill={`url(#stone${ids})`} />}
        {finish === 'stone' && (
          <G opacity={0.22}>
            <Circle cx={30} cy={62} r={1.6} fill="#1E2023" />
            <Circle cx={64} cy={70} r={1.2} fill="#1E2023" />
            <Circle cx={72} cy={34} r={1.4} fill="#FFFFFF" />
            <Circle cx={38} cy={28} r={1} fill="#FFFFFF" />
            <Circle cx={56} cy={80} r={1.5} fill="#1E2023" />
          </G>
        )}
        {finish === 'glass' && (
          <>
            <Path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.65} strokeWidth={2.5} />
            <Ellipse cx={34} cy={30} rx={12} ry={6} fill="#FFFFFF" opacity={0.45} transform="rotate(-28 34 30)" />
          </>
        )}
        {finish === 'gold' && (
          <G>
            <Circle cx={70} cy={30} r={2.2} fill="#F6E3A1" />
            <Circle cx={28} cy={70} r={1.6} fill="#D4AF5A" />
            <Circle cx={62} cy={76} r={1.2} fill="#F6E3A1" />
          </G>
        )}

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

        {showEyes ? (
          <G>
            <AnimatedEllipse cx={e1x} cy={e1y} rx={eyeRx} fill={palette.pebbleInk} animatedProps={eyeProps} />
            <AnimatedEllipse cx={e2x} cy={e2y} rx={eyeRx} fill={palette.pebbleInk} animatedProps={eyeProps2} />
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
        )}

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
    <Pressable
      onPress={press}
      onLongPress={onLongPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      {body}
    </Pressable>
  );
}

export const Pebble = memo(PebbleBase);

export function MemberPebble({
  member,
  ...rest
}: { member: Member } & Omit<PebbleProps, 'shape' | 'color' | 'face' | 'mark' | 'motion'>) {
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
      label={rest.label ?? member.name}
    />
  );
}
