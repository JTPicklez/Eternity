/**
 * Your year as water rings: every week is a slice, every goal a ring. The
 * deeper the color, the more hours went into it.
 */
import React, { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { weekOfYear } from '@/lib/dates';
import { useFamily, useHead } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Card, haptic, Label, Row, Screen, Txt } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, memberColors } from '@/theme/tokens';

const GOAL_COLORS = [memberColors.water, memberColors.lilac, memberColors.moss];

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export default function Rings() {
  const p = useTheme();
  const head = useHead();
  const weeks = useFamily((s) => s.weeks);
  const goals = useFamily((s) => s.charter.goals);
  const { width } = useWindowDimensions();
  const now = weekOfYear();
  const [picked, setPicked] = useState<number>(now);

  const size = Math.min(width - 32, 380);
  const c = size / 2;
  const ringNames = goals.length ? goals.slice(0, 3) : ['Your work'];
  const rings = ringNames.length;
  const inner = size * 0.2;
  const step = (size * 0.4 - inner) / rings;

  const byWeek = useMemo(() => new Map(weeks.map((w) => [w.week, w])), [weeks]);
  const totals = ringNames.map((_, i) => Math.round(weeks.reduce((a, w) => a + (w.hours[i] ?? 0), 0)));
  const pickedLog = byWeek.get(picked);
  const year = new Date().getFullYear();

  return (
    <Screen>
      <BackHeader kicker={String(year)} title="Your year" />
      <Txt variant="body" style={{ marginTop: 4, paddingHorizontal: 4 }}>
        Every slice is a week. Every ring is a goal. Tap a week.
      </Txt>

      <Animated.View entering={FadeIn.duration(800)} style={{ alignItems: 'center', marginTop: 16 }}>
        <Svg width={size} height={size}>
          {ringNames.map((_, i) => {
            const r = inner + step * (i + 0.5);
            return <Circle key={`bg${i}`} cx={c} cy={c} r={r} stroke={p.card2} strokeWidth={step - 4} fill="none" />;
          })}
          {Array.from({ length: 52 }).map((_, wi) => {
            const w = wi + 1;
            const a0 = (wi / 52) * 360 + 0.8;
            const a1 = ((wi + 1) / 52) * 360 - 0.8;
            const log = byWeek.get(w);
            return (
              <G key={w}>
                {ringNames.map((__, i) => {
                  const r = inner + step * (i + 0.5);
                  const h = log?.hours[i] ?? 0;
                  const future = w > now;
                  const intensity = future ? 0 : Math.min(1, h / 14);
                  return (
                    <Path
                      key={i}
                      d={arc(c, c, r, a0, a1)}
                      stroke={future ? p.line : GOAL_COLORS[i % 3]}
                      strokeOpacity={future ? 0.6 : 0.15 + intensity * 0.85}
                      strokeWidth={step - 6}
                      fill="none"
                      onPress={() => {
                        if (!future) {
                          setPicked(w);
                          haptic('select');
                        }
                      }}
                    />
                  );
                })}
                {w === picked && (
                  <Path d={arc(c, c, inner + step * rings + 6, a0, a1)} stroke={p.text} strokeWidth={4} strokeLinecap="round" fill="none" />
                )}
              </G>
            );
          })}
          {[1, 14, 27, 40].map((w) => {
            const a = (((w - 1) / 52) * 360 - 90) * (Math.PI / 180);
            const r = inner + step * rings + 16;
            return (
              <SvgText key={w} x={c + r * Math.cos(a)} y={c + r * Math.sin(a) + 4} fontSize={10} fontFamily={fonts.mono} fill={p.muted} textAnchor="middle">
                {['JAN', 'APR', 'JUL', 'OCT'][[1, 14, 27, 40].indexOf(w)]}
              </SvgText>
            );
          })}
        </Svg>
        <View style={{ position: 'absolute', top: c - 34, left: (size - 68) / 2 + (width - 32 - size) / 2 + 0 }} pointerEvents="none">
          <MemberPebble member={head} size={68} />
        </View>
      </Animated.View>

      <Animated.View key={picked} entering={FadeInDown.duration(300)}>
        <Card carve={0} style={{ marginTop: 16 }}>
          <Row justify="space-between">
            <Txt variant="h2">Week {picked}</Txt>
            {picked === now && <Txt variant="smallStrong" color={p.signalText}>This week</Txt>}
          </Row>
          {ringNames.map((g, i) => (
            <Row key={g} gap={10} style={{ marginTop: 10 }}>
              <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: GOAL_COLORS[i % 3] }} />
              <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                {g}
              </Txt>
              <Txt variant="mono">{pickedLog?.hours[i] ?? 0}h</Txt>
            </Row>
          ))}
        </Card>
      </Animated.View>

      <Label>This year so far</Label>
      <Row gap={10}>
        {ringNames.map((g, i) => (
          <View key={g} style={{ flex: 1, padding: 12, borderRadius: 18, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }}>
            <View style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: GOAL_COLORS[i % 3] }} />
            <Txt variant="h2" style={{ marginTop: 8 }}>
              {totals[i]}h
            </Txt>
            <Txt variant="tiny" numberOfLines={2}>
              {g}
            </Txt>
          </View>
        ))}
      </Row>
      <Txt variant="tiny" center style={{ marginTop: 16 }}>
        Flow sessions add to your first goal automatically.
      </Txt>
    </Screen>
  );
}
