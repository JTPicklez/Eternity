import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { BounceIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { askTeammate } from '@/lib/ai';
import { addDays, isoDate, weekOfYear } from '@/lib/dates';
import { useCrew, useLead } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { RichText } from '@/components/RichText';
import { ThinkingDots } from '@/components/Thinking';
import { BackHeader, Btn, Card, haptic, Label, PressScale, ProgressBar, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved, memberColors } from '@/theme/tokens';

const GOAL_COLORS = [memberColors.water, memberColors.lilac, memberColors.moss];

function gradeFor(score: number) {
  if (score >= 0.93) return 'A';
  if (score >= 0.87) return 'A-';
  if (score >= 0.82) return 'B+';
  if (score >= 0.75) return 'B';
  if (score >= 0.68) return 'B-';
  if (score >= 0.6) return 'C+';
  return 'C';
}

export default function Review() {
  const p = useTheme();
  const lead = useLead();
  const blocks = useCrew((s) => s.blocks);
  const receipts = useCrew((s) => s.receipts);
  const flowSessions = useCrew((s) => s.flowSessions);
  const weeks = useCrew((s) => s.weeks);
  const goals = useCrew((s) => s.charter.goals);
  const reviews = useCrew((s) => s.reviews);
  const saveReview = useCrew((s) => s.saveReview);
  const week = weekOfYear();
  const saved = reviews.find((r) => r.week === week);
  const [decision, setDecision] = useState<string | null>(saved?.decision ?? null);
  const [ai, setAi] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const stats = useMemo(() => {
    const from = isoDate(addDays(new Date(), -6));
    const today = isoDate();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const started = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) <= nowMin;
    // Only blocks whose time has come count toward the grade.
    const past = blocks.filter((b) => b.date >= from && (b.date < today || (b.date === today && started(b.time))) && b.kind !== 'leave');
    const done = past.filter((b) => b.done).length;
    const weekStart = Date.now() - 7 * 86400000;
    const flowMin = flowSessions.filter((f) => f.at > weekStart).reduce((a, f) => a + f.minutes, 0);
    const log = weeks.find((w) => w.week === week);
    const goalHours = goals.map((_, i) => log?.hours[i] ?? 0);
    const actions = receipts.filter((r) => r.at > weekStart && r.kind === 'did' && !r.undone).length;
    const completion = past.length ? done / past.length : 0.8;
    const goalScore = Math.min(1, goalHours.reduce((a, h) => a + h, 0) / Math.max(1, goals.length * 8));
    const score = 0.55 * completion + 0.35 * goalScore + 0.1 * Math.min(1, flowMin / 240);
    return { past: past.length, done, flowMin, goalHours, actions, grade: gradeFor(score), score };
  }, [blocks, flowSessions, weeks, goals, receipts, week]);

  const wins = blocks.filter((b) => b.done).slice(-4);
  const options = [
    { id: 'mornings', title: 'Protect mornings for the hardest goal', desc: 'Your best blocks finished before noon. Lock 8 to 10 AM for it next week.' },
    { id: 'flow', title: 'Add one more Flow night', desc: 'Flow nights moved the needle most. Add Tuesday 8 to 11 PM.' },
  ];

  const getFull = async () => {
    setThinking(true);
    const res = await askTeammate({
      member: lead,
      history: [],
      task: 'review',
      deep: true,
      text: `Write my weekly review. Week ${week}. Blocks finished: ${stats.done}/${stats.past}. Flow minutes: ${stats.flowMin}. Hours toward goals: ${goals.map((g, i) => `${g}: ${stats.goalHours[i]}h`).join('; ') || 'none set'}. Crew actions: ${stats.actions}. Grade it honestly against my Charter, name the one win, the one thing that slipped, and the one decision for next week. Keep it tight and encouraging without sugarcoating.`,
    });
    setAi(res.text);
    setThinking(false);
  };

  return (
    <Screen>
      <BackHeader kicker={`Week ${week}`} title="Weekly review" />

      <Animated.View entering={FadeInDown}>
        <Card tone="stone" carve={0} style={{ marginTop: 8, alignItems: 'center' }} padding={22}>
          <MemberPebble member={lead} size={54} state="done" />
          <Txt variant="label" color={p.onStoneMuted} style={{ marginTop: 12 }}>
            Graded on your Charter
          </Txt>
          <Animated.View entering={BounceIn.delay(300).duration(900)}>
            <Txt variant="display" color={p.onStone} style={{ fontSize: 84, lineHeight: 90, marginTop: 4 }}>
              {stats.grade}
            </Txt>
          </Animated.View>
          <Txt variant="body" color={p.onStoneMuted} center>
            {stats.score >= 0.82 ? 'A strong week. You moved the big rocks.' : stats.score >= 0.68 ? 'Solid. A few things slipped, nothing that can’t be won back.' : 'A tough one. Next week is set up to be lighter.'}
          </Txt>
        </Card>
      </Animated.View>

      <Row gap={10} style={{ marginTop: 12 }}>
        {[
          { k: `${stats.done}/${stats.past || 0}`, l: 'blocks done' },
          { k: `${Math.round((stats.flowMin / 60) * 10) / 10}h`, l: 'in Flow' },
          { k: String(stats.actions), l: 'things handled' },
        ].map((x, i) => (
          <View key={x.l} style={[carved[i], { flex: 1, padding: 12, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
            <Txt variant="h2">{x.k}</Txt>
            <Txt variant="tiny">{x.l}</Txt>
          </View>
        ))}
      </Row>

      {goals.length > 0 && (
        <>
          <Label>Toward your goals</Label>
          <Card carve={1}>
            {goals.map((g, i) => (
              <View key={g} style={{ marginBottom: i < goals.length - 1 ? 14 : 0 }}>
                <Row justify="space-between">
                  <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {g}
                  </Txt>
                  <Txt variant="mono">{stats.goalHours[i]}h</Txt>
                </Row>
                <View style={{ marginTop: 8 }}>
                  <ProgressBar value={stats.goalHours[i] / 12} color={GOAL_COLORS[i % 3]} />
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {wins.length > 0 && (
        <>
          <Label>Wins</Label>
          <Card carve={2} padding={12}>
            {wins.map((b) => (
              <Row key={b.id} gap={10} style={{ paddingVertical: 6 }}>
                <Ionicons name="checkmark-circle" size={18} color={p.success} />
                <Txt variant="body" style={{ flex: 1 }}>
                  {b.title}
                </Txt>
              </Row>
            ))}
          </Card>
        </>
      )}

      <Label>One decision for next week</Label>
      {options.map((o, i) => {
        const chosen = decision === o.title;
        return (
          <PressScale
            key={o.id}
            onPress={() => {
              setDecision(o.title);
              saveReview({ week, grade: stats.grade, decision: o.title });
              haptic('success');
              toast(`${lead.name} will set it up for next week.`, undefined, lead.color);
            }}
            accessibilityLabel={o.title}
          >
            <View style={[carved[i + 2], { marginBottom: 8, padding: 14, backgroundColor: chosen ? p.signal : p.card, borderWidth: 2, borderColor: chosen ? p.signal : p.text, opacity: decision && !chosen ? 0.5 : 1 }]}>
              <Row gap={10}>
                <Txt variant="bodyStrong" color={chosen ? p.onSignal : undefined} style={{ flex: 1 }}>
                  {o.title}
                </Txt>
                {chosen && (
                  <Animated.View entering={ZoomIn}>
                    <Ionicons name="checkmark-circle" size={22} color={p.onSignal} />
                  </Animated.View>
                )}
              </Row>
              <Txt variant="small" color={chosen ? p.onSignal : undefined} style={{ marginTop: 4 }}>
                {o.desc}
              </Txt>
            </View>
          </PressScale>
        );
      })}

      <Card tone="soft" carve={3} style={{ marginTop: 12 }}>
        <Row gap={10}>
          <Txt variant="h3" style={{ flex: 1 }}>
            {lead.name}'s full review
          </Txt>
          {!ai && !thinking && <Btn title="Write it" small onPress={getFull} />}
        </Row>
        {thinking ? (
          <View style={{ marginTop: 10 }}>
            <ThinkingDots color={lead.color} />
          </View>
        ) : ai ? (
          <View style={{ marginTop: 8 }}>
            <RichText text={ai} size={14.5} />
          </View>
        ) : (
          <Txt variant="small" style={{ marginTop: 4 }}>
            Honest, short, and pointed at next week.
          </Txt>
        )}
      </Card>

      <Btn title="See your year" variant="ghost" full icon="ellipse-outline" style={{ marginTop: 18 }} onPress={() => router.push('/rings')} />
    </Screen>
  );
}
