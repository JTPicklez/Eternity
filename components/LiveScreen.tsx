/**
 * A teammate's Workbench screen, drawn live: their own sandboxed browser in
 * the cloud. This build animates a scripted session; the live version streams
 * the real cloud browser here.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './ui';

export interface ScriptStep {
  url: string;
  log: string;
  x: number; // 0..1 cursor target
  y: number;
  typing?: string;
  highlight?: number; // which skeleton row lights up
}

export const SCRIPTS: Record<string, ScriptStep[]> = {
  bolt: [
    { url: 'github.com/you/northwind/issues/41', log: 'Opened the crash report', x: 0.3, y: 0.3, highlight: 1 },
    { url: 'github.com/you/northwind/blob/main/app/onboarding.tsx', log: 'Found the undefined user on first launch', x: 0.62, y: 0.55, highlight: 3 },
    { url: 'replit.com/@you/northwind', log: 'Wrote a guard for the missing profile', x: 0.4, y: 0.62, typing: 'if (!user) return <Splash />;', highlight: 4 },
    { url: 'replit.com/@you/northwind/console', log: 'Ran the tests: 41 passed', x: 0.75, y: 0.24, highlight: 2 },
    { url: 'github.com/you/northwind/pull/42', log: 'Opened PR #42 for you to review', x: 0.5, y: 0.8, highlight: 5 },
  ],
  aibram: [
    { url: 'google.com/travel/flights', log: 'Searched LBB to DFW on Nov 25', x: 0.4, y: 0.22, typing: 'LBB → DFW · Nov 25', highlight: 0 },
    { url: 'google.com/travel/flights?sort=price', log: 'Sorted by price, nonstop only', x: 0.78, y: 0.3, highlight: 1 },
    { url: 'aa.com/booking/choose-flights', log: 'Opened the $148 nonstop at 4:15 PM', x: 0.5, y: 0.5, highlight: 3 },
    { url: 'aa.com/booking/review', log: 'Filled traveler details from your profile', x: 0.35, y: 0.66, highlight: 4 },
    { url: 'aa.com/booking/review', log: 'Stopped before payment. Your tap is next.', x: 0.62, y: 0.85, highlight: 5 },
  ],
  sage: [
    { url: 'canvas.northfield.edu/courses/1411/files', log: "Opened Monday's lecture slides", x: 0.3, y: 0.3, highlight: 1 },
    { url: 'canvas.northfield.edu/courses/1411/files/week8.pdf', log: 'Read 42 slides on the chain rule', x: 0.55, y: 0.5, highlight: 2 },
    { url: 'tutorial.math.lamar.edu/classes/calci/chainrule', log: 'Cross-checked three worked examples', x: 0.45, y: 0.6, highlight: 3 },
    { url: 'notion.so/calc-deck', log: 'Wrote 24 flashcards into your Calc deck', x: 0.5, y: 0.72, typing: "d/dx f(g(x)) = f'(g(x))·g'(x)", highlight: 4 },
  ],
  default: [
    { url: 'duckduckgo.com/?q=best+options', log: 'Searched for options', x: 0.4, y: 0.25, typing: 'best options', highlight: 0 },
    { url: 'example-reviews.com/compare', log: 'Compared the top three', x: 0.6, y: 0.5, highlight: 2 },
    { url: 'example-reviews.com/compare#notes', log: 'Wrote a short summary for you', x: 0.45, y: 0.75, highlight: 4 },
  ],
};

export function LiveScreen({
  script,
  color,
  driving,
  idle,
  onStep,
  height = 260,
}: {
  script: ScriptStep[];
  color: string;
  driving?: boolean;
  /** Asleep: no job, nothing moving. */
  idle?: boolean;
  onStep?: (i: number) => void;
  height?: number;
}) {
  const p = useTheme();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [w, setW] = useState(300);
  const cx = useSharedValue(0.5);
  const cy = useSharedValue(0.5);

  useEffect(() => {
    if (driving || idle) return;
    const t = setTimeout(() => setI((x) => (x + 1 < script.length ? x + 1 : x)), 3200);
    return () => clearTimeout(t);
  }, [i, driving, idle, script.length]);

  useEffect(() => {
    const s = script[i];
    if (!s) return;
    onStep?.(i);
    cx.value = withTiming(s.x, { duration: 900, easing: Easing.inOut(Easing.cubic) });
    cy.value = withTiming(s.y, { duration: 900, easing: Easing.inOut(Easing.cubic) });
    setTyped('');
    if (s.typing) {
      let n = 0;
      const t = setInterval(() => {
        n += 1;
        setTyped(s.typing!.slice(0, n));
        if (n >= s.typing!.length) clearInterval(t);
      }, 55);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const cursor = useAnimatedStyle(() => ({
    transform: [{ translateX: cx.value * (w - 20) }, { translateY: 34 + cy.value * (height - 54) }],
  }));
  const step = script[Math.min(i, script.length - 1)];

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: driving ? p.signal : idle ? p.line : p.text }}
    >
      <View style={{ height: 30, backgroundColor: '#ECE7DF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E58C6B' }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F2C94C' }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8FCB5A' }} />
        <View style={{ flex: 1, height: 18, borderRadius: 6, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 6 }}>
          <Txt variant="tiny" color="#5A544C" numberOfLines={1} style={{ fontSize: 10 }}>
            {step?.url}
          </Txt>
        </View>
        <Ionicons name="lock-closed" size={10} color="#5A544C" />
      </View>
      <View style={{ padding: 12, gap: 9 }}>
        {[0.6, 0.9, 0.75, 0.5, 0.85, 0.4].map((frac, r) => (
          <View
            key={r}
            style={{
              height: r === 0 ? 16 : 11,
              width: `${frac * 100}%`,
              borderRadius: 5,
              backgroundColor: step?.highlight === r ? color : '#E9E3D8',
              opacity: step?.highlight === r ? 0.9 : 1,
            }}
          />
        ))}
        {typed ? (
          <View style={{ marginTop: 4, padding: 8, borderRadius: 8, borderWidth: 1.5, borderColor: color, backgroundColor: '#FAFAF7' }}>
            <Txt variant="mono" color="#1E2023" style={{ fontSize: 11 }}>
              {typed}
              <Txt variant="mono" color={color}>
                ▍
              </Txt>
            </Txt>
          </View>
        ) : null}
      </View>
      {idle && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 30, bottom: 0, backgroundColor: 'rgba(238,232,221,0.75)', alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="smallStrong" color="#5A544C">
            Asleep
          </Txt>
        </View>
      )}
      {!driving && !idle && (
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, cursor]} pointerEvents="none">
          <Ionicons name="navigate" size={20} color="#1E2023" style={{ transform: [{ rotate: '-45deg' }] }} />
          <View style={{ position: 'absolute', left: 14, top: 14, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: color }}>
            <Txt variant="tiny" color="#1E2023" style={{ fontSize: 10 }}>
              working
            </Txt>
          </View>
        </Animated.View>
      )}
      {driving && (
        <View style={{ position: 'absolute', bottom: 8, right: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: p.signal }}>
          <Txt variant="tiny" color={p.onSignal}>
            You're driving
          </Txt>
        </View>
      )}
    </View>
  );
}
