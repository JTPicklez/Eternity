import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

function Dot({ delay, color }: { delay: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 }), withTiming(0, { duration: 360 })), -1));
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]} />;
}

/** Three drops bobbing on the water. */
export function ThinkingDots({ color }: { color?: string }) {
  const p = useTheme();
  const c = color ?? p.muted;
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', height: 14 }} accessibilityLabel="Thinking">
      <Dot delay={0} color={c} />
      <Dot delay={140} color={c} />
      <Dot delay={280} color={c} />
    </View>
  );
}
