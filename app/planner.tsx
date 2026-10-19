import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { askTeammate } from '@/lib/ai';
import { addDays, clockAmPm, isoDate, minutesOf, pad } from '@/lib/dates';
import { findCollisions, weekdayName, type Collision } from '@/lib/huddle';
import { useCrew, useLead } from '@/lib/store';
import type { Block, BlockKind } from '@/lib/types';
import { BlockCard, KIND_ICON } from '@/components/BlockCard';
import { RichText } from '@/components/RichText';
import { ThinkingDots } from '@/components/Thinking';
import { BackHeader, Btn, Card, Chip, Empty, Field, haptic, IconBtn, Label, PressScale, Row, Screen, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

function toTime(min: number) {
  const m = Math.max(0, Math.min(23 * 60 + 59, min));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function duration(b: Block) {
  return b.end ? Math.max(15, minutesOf(b.end) - minutesOf(b.time)) : 45;
}

function plansFor(c: Collision) {
  const aEnd = minutesOf(c.a.end ?? toTime(minutesOf(c.a.time) + 45));
  const bDur = duration(c.b);
  const aDur = duration(c.a);
  const later = aEnd + 15;
  const earlier = Math.max(6 * 60, minutesOf(c.b.time) - aDur - 15);
  return [
    {
      id: 'A',
      title: `${c.b.title} right after`,
      desc: `${c.a.title} stays at ${clockAmPm(c.a.time)}. ${c.b.title} moves to ${clockAmPm(toTime(later))}–${clockAmPm(toTime(later + bDur))}.`,
      apply: () => useCrew.getState().updateBlock(c.b.id, { time: toTime(later), end: toTime(later + bDur) }),
      undo: () => useCrew.getState().updateBlock(c.b.id, { time: c.b.time, end: c.b.end }),
    },
    {
      id: 'B',
      title: `${c.a.title} earlier`,
      desc: `${c.a.title} moves to ${clockAmPm(toTime(earlier))}–${clockAmPm(toTime(earlier + aDur))}. ${c.b.title} keeps ${clockAmPm(c.b.time)}.`,
      apply: () => useCrew.getState().updateBlock(c.a.id, { time: toTime(earlier), end: toTime(earlier + aDur) }),
      undo: () => useCrew.getState().updateBlock(c.a.id, { time: c.a.time, end: c.a.end }),
    },
  ];
}

type Bucket = 'Must' | 'Should' | 'Could';

export default function Planner() {
  const p = useTheme();
  const { fix } = useLocalSearchParams<{ fix?: string }>();
  const lead = useLead();
  const blocks = useCrew((s) => s.blocks);
  const goals = useCrew((s) => s.charter.goals);
  const addBlock = useCrew((s) => s.addBlock);
  const updateBlock = useCrew((s) => s.updateBlock);
  const removeBlock = useCrew((s) => s.removeBlock);
  const addReceipt = useCrew((s) => s.addReceipt);
  const start = useMemo(() => new Date(), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDate(addDays(start, i))), [start]);
  const collisions = useMemo(() => findCollisions(blocks, start), [blocks, start]);
  const [day, setDay] = useState(() => (fix && collisions[0] ? collisions[0].date : days[0]));
  const [adding, setAdding] = useState(false);
  const [triage, setTriage] = useState(false);
  const [aiTriage, setAiTriage] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const dayBlocks = blocks.filter((b) => b.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const dayCollisions = collisions.filter((c) => c.date === day);

  // new block form
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('18:00');
  const [mins, setMins] = useState(60);
  const [kind, setKind] = useState<BlockKind>('study');

  const weekBlocks = blocks.filter((b) => days.includes(b.date) && !b.done && b.kind !== 'leave');
  const bucketOf = (b: Block): Bucket => {
    const l = b.title.toLowerCase();
    if (b.kind === 'class' || /exam|quiz|due|demo|deadline|interview/.test(l)) return 'Must';
    if (goals.some((g) => g.toLowerCase().split(/\W+/).some((w) => w.length > 3 && l.includes(w)))) return 'Must';
    if (b.kind === 'study' || b.kind === 'code' || b.kind === 'flow') return 'Should';
    if (b.kind === 'run') return 'Should';
    return 'Could';
  };

  const askTriage = async () => {
    setThinking(true);
    const summary = weekBlocks.map((b) => `${b.date} ${clockAmPm(b.time)} ${b.title} (${b.kind})`).join('\n');
    const res = await askTeammate({
      member: lead,
      history: [],
      task: 'plan',
      deep: true,
      text: `I'm slammed. Triage my week against my Charter goals. Keep me moving toward the goals; make it lighter, not smaller. Say what to protect, what to shrink, what to move and what the Crew can take off my plate. Be concrete and short.\n\nThis week:\n${summary || '(nothing scheduled yet)'}`,
    });
    setAiTriage(res.text);
    setThinking(false);
  };

  return (
    <Screen>
      <BackHeader
        title="This week"
        right={<IconBtn icon="add" label="Add a block" tone="ink" onPress={() => setAdding(true)} />}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
        {days.map((d, i) => {
          const on = d === day;
          const count = blocks.filter((b) => b.date === d).length;
          const clash = collisions.some((c) => c.date === d);
          const date = addDays(start, i);
          return (
            <PressScale key={d} onPress={() => setDay(d)} accessibilityLabel={`${weekdayName(d)}, ${count} blocks${clash ? ', has a conflict' : ''}`} hapticKind="select">
              <View style={[carved[i % 4], { width: 62, paddingVertical: 10, alignItems: 'center', backgroundColor: on ? p.stone : p.card, boxShadow: on ? undefined : `0px 2px 0px ${p.shadow}` }]}>
                <Txt variant="label" color={on ? p.onStoneMuted : p.muted} style={{ letterSpacing: 0.8 }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </Txt>
                <Txt variant="h2" color={on ? p.onStone : p.text} style={{ marginTop: 2 }}>
                  {date.getDate()}
                </Txt>
                <Row gap={3} style={{ marginTop: 4, height: 8 }}>
                  {Array.from({ length: Math.min(count, 4) }).map((_, j) => (
                    <View key={j} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: clash && j === 0 ? p.danger : on ? p.onStoneMuted : p.lineStrong }} />
                  ))}
                </Row>
              </View>
            </PressScale>
          );
        })}
      </ScrollView>

      {dayCollisions.map((c) => (
        <Animated.View key={`${c.a.id}-${c.b.id}`} entering={FadeInDown}>
          <Card tone="stone" carve={1} style={{ marginTop: 12 }}>
            <Txt variant="label" color={p.mode === 'paper' ? '#8FD8F7' : '#1A4DB3'}>
              {weekdayName(c.date)} doesn't fit. Yet.
            </Txt>
            <Txt variant="body" color={p.onStoneMuted} style={{ marginTop: 6 }}>
              {c.a.title} and {c.b.title} overlap. {lead.name}'s two plans:
            </Txt>
            {plansFor(c).map((plan) => (
              <PressScale
                key={plan.id}
                onPress={() => {
                  plan.apply();
                  addReceipt({ memberId: lead.id, text: `Fixed a conflict on ${weekdayName(c.date)}: ${plan.title}`, connector: 'Calendar', kind: 'did', undoable: false });
                  haptic('success');
                  toast('Fixed. Both blocks fit now.', { label: 'Undo', onPress: plan.undo }, lead.color);
                }}
                accessibilityLabel={`Plan ${plan.id}: ${plan.title}`}
              >
                <View style={{ marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: p.mode === 'paper' ? '#2A2D31' : '#DDD5C8' }}>
                  <Row gap={8}>
                    <Txt variant="smallStrong" color={p.mode === 'paper' ? '#5CC8F2' : '#1E5BD2'}>
                      {plan.id}
                    </Txt>
                    <Txt variant="bodyStrong" color={p.onStone} style={{ flex: 1 }}>
                      {plan.title}
                    </Txt>
                    <Ionicons name="arrow-forward" size={16} color={p.onStone} />
                  </Row>
                  <Txt variant="small" color={p.onStoneMuted} style={{ marginTop: 4 }}>
                    {plan.desc}
                  </Txt>
                </View>
              </PressScale>
            ))}
            <Btn title="Talk it through at the Table" small variant="stoneGhost" style={{ marginTop: 12 }} onPress={() => router.push('/table')} />
          </Card>
        </Animated.View>
      ))}

      <Row justify="space-between" style={{ marginTop: 20, paddingHorizontal: 4 }}>
        <Txt variant="h2">{weekdayName(day)}</Txt>
        <Txt variant="small">{dayBlocks.length} blocks</Txt>
      </Row>
      <Animated.View layout={LinearTransition} style={{ gap: 8, marginTop: 10 }}>
        {dayBlocks.length === 0 ? (
          <Empty title="Wide open" body="Nothing here yet. Add a block or ask your Crew to fill it with what matters." action={<Btn title="Add a block" small onPress={() => setAdding(true)} />} />
        ) : (
          dayBlocks.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              index={i}
              onPress={() => updateBlock(b.id, { done: !b.done })}
              onLongPress={() => {
                removeBlock(b.id);
                toast(`Removed "${b.title}"`, { label: 'Undo', onPress: () => addBlock({ ...b }) });
              }}
              onFlow={() => router.push({ pathname: '/flow', params: { task: b.title } })}
            />
          ))
        )}
      </Animated.View>

      <Card carve={2} style={{ marginTop: 22 }}>
        <Row gap={12}>
          <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: p.stone, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="flash" size={20} color={p.onStone} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="h3">Slammed?</Txt>
            <Txt variant="small">Triage the week against your goals. Lighter, not smaller.</Txt>
          </View>
        </Row>
        <Btn title="Triage my week" small variant="signal" style={{ marginTop: 12 }} onPress={() => setTriage(true)} />
      </Card>

      <Sheet visible={triage} onClose={() => setTriage(false)} title="Triage">
        {(['Must', 'Should', 'Could'] as Bucket[]).map((bucket) => {
          const items = weekBlocks.filter((b) => bucketOf(b) === bucket);
          return (
            <View key={bucket} style={{ marginBottom: 14 }}>
              <Row justify="space-between">
                <Txt variant="label">{bucket === 'Must' ? 'Protect' : bucket === 'Should' ? 'Keep, maybe shrink' : 'Move or hand off'}</Txt>
                <Txt variant="mono">{items.length}</Txt>
              </Row>
              {items.length === 0 ? (
                <Txt variant="small" style={{ marginTop: 6 }}>
                  Nothing here.
                </Txt>
              ) : (
                items.map((b) => (
                  <Row key={b.id} gap={10} style={{ paddingVertical: 8 }}>
                    <Ionicons name={KIND_ICON[b.kind]} size={16} color={p.muted} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">{b.title}</Txt>
                      <Txt variant="tiny">
                        {weekdayName(b.date)} · {clockAmPm(b.time)}
                      </Txt>
                    </View>
                    {bucket === 'Could' && (
                      <Btn
                        title="Next week"
                        small
                        variant="ghost"
                        onPress={() => {
                          const [y, m, d] = b.date.split('-').map(Number);
                          updateBlock(b.id, { date: isoDate(addDays(new Date(y, m - 1, d), 7)) });
                          toast(`Moved "${b.title}" to next week.`, { label: 'Undo', onPress: () => useCrew.getState().updateBlock(b.id, { date: b.date }) });
                        }}
                      />
                    )}
                  </Row>
                ))
              )}
            </View>
          );
        })}
        <Card tone="soft" carve={1} padding={14}>
          <Row gap={8}>
            <Txt variant="h3" style={{ flex: 1 }}>
              {lead.name}'s take
            </Txt>
            {!aiTriage && !thinking && <Btn title="Ask" small onPress={askTriage} />}
          </Row>
          {thinking ? (
            <View style={{ marginTop: 10 }}>
              <ThinkingDots color={lead.color} />
            </View>
          ) : aiTriage ? (
            <View style={{ marginTop: 8 }}>
              <RichText text={aiTriage} size={14.5} />
            </View>
          ) : (
            <Txt variant="small" style={{ marginTop: 4 }}>
              Gets a real plan for the week, weighed against your Charter.
            </Txt>
          )}
        </Card>
      </Sheet>

      <Sheet visible={adding} onClose={() => setAdding(false)} title={`Add to ${weekdayName(day)}`}>
        <Field placeholder="What is it?" value={title} onChangeText={setTitle} autoFocus />
        <Label style={{ marginTop: 14 }}>Starts</Label>
        <Row wrap gap={8}>
          {['07:00', '09:00', '12:00', '15:00', '18:00', '19:00', '21:00'].map((t) => (
            <Chip key={t} label={clockAmPm(t)} small selected={time === t} onPress={() => setTime(t)} />
          ))}
        </Row>
        <Label style={{ marginTop: 14 }}>For</Label>
        <Row wrap gap={8}>
          {[30, 45, 60, 90, 120, 240].map((m) => (
            <Chip key={m} label={m < 60 ? `${m} min` : `${m / 60} h`} small selected={mins === m} onPress={() => setMins(m)} />
          ))}
        </Row>
        <Label style={{ marginTop: 14 }}>Kind</Label>
        <Row wrap gap={8}>
          {(['study', 'code', 'run', 'class', 'event', 'task', 'flow'] as BlockKind[]).map((k) => (
            <Chip key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} icon={KIND_ICON[k]} small selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </Row>
        <Btn
          title="Add block"
          variant="signal"
          full
          style={{ marginTop: 18 }}
          disabled={!title.trim()}
          onPress={() => {
            addBlock({ date: day, time, end: toTime(minutesOf(time) + mins), title: title.trim(), kind });
            setTitle('');
            setAdding(false);
            haptic('success');
            toast('Added.');
          }}
        />
      </Sheet>
    </Screen>
  );
}
