import React, { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { haptic } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Press and hold to commit. A ring of water fills while you hold. */
export function HoldButton({
  title,
  doneTitle,
  done,
  onComplete,
  duration = 1200,
}: {
  title: string;
  doneTitle?: string;
  done?: boolean;
  onComplete: () => void;
  duration?: number;
}) {
  const p = useTheme();
  const progress = useSharedValue(done ? 1 : 0);
  const ticks = useRef<ReturnType<typeof setInterval> | null>(null);
  const R = 15;
  const C = 2 * Math.PI * R;
  const ring = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - progress.value) }));

  const finish = () => {
    if (ticks.current) clearInterval(ticks.current);
    haptic('success');
    onComplete();
  };

  return (
    <Pressable
      disabled={done}
      onPressIn={() => {
        haptic('light');
        ticks.current = setInterval(() => haptic('select'), 220);
        progress.value = withTiming(1, { duration, easing: Easing.linear }, (ok) => {
          if (ok) runOnJS(finish)();
        });
      }}
      onPressOut={() => {
        if (ticks.current) clearInterval(ticks.current);
        if (progress.value < 1) {
          cancelAnimation(progress);
          progress.value = withTiming(0, { duration: 250 });
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={done ? (doneTitle ?? title) : `${title}. Press and hold.`}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => finish()}
    >
      <View
        style={{
          height: 56,
          borderRadius: 18,
          backgroundColor: done ? p.success : p.stone,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <Svg width={36} height={36} viewBox="0 0 36 36">
          <Circle cx={18} cy={18} r={R} stroke={p.mode === 'paper' ? '#4A4D52' : '#B9B0A2'} strokeWidth={3} fill="none" />
          <AnimatedCircle
            cx={18}
            cy={18}
            r={R}
            stroke={done ? '#FFFFFF' : p.mode === 'paper' ? '#5CC8F2' : '#1E5BD2'}
            strokeWidth={3.5}
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
            animatedProps={ring}
          />
        </Svg>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15.5, color: done ? '#FFFFFF' : p.onStone }}>{done ? (doneTitle ?? title) : title}</Text>
      </View>
    </Pressable>
  );
}
