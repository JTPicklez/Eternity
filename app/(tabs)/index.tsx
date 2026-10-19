import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { askTeammate } from '@/lib/ai';
import { useAliveCrew } from '@/lib/alive';
import { AdBanner } from '@/lib/ads';
import { clockAmPm, dayLabel, greeting, isoDate, minutesOf } from '@/lib/dates';
import { findCollisions, huddleLine, memberLine, placedBy, weekdayName } from '@/lib/huddle';
import { fetchEta } from '@/lib/live';
import { useCrew, useLead } from '@/lib/store';
import type { Block } from '@/lib/types';
import { MemberPebble } from '@/components/Pebble';
import { BlockCard } from '@/components/BlockCard';
import { Btn, Card, Chip, Drop, Empty, haptic, PressScale, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

function AskBar() {
  const p = useTheme();
  const lead = useLead();
  const [text, setText] = useState('');
  const send = () => {
    const q = text.trim();
    if (!q) return router.push({ pathname: '/chat/[id]', params: { id: lead.id } });
    setText('');
    router.push({ pathname: '/chat/[id]', params: { id: lead.id, q } });
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: p.bg }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Ask or tell your Crew…"
        placeholderTextColor={p.muted}
        onSubmitEditing={send}
        returnKeyType="send"
        style={{
          flex: 1,
          height: 48,
          paddingHorizontal: 16,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 14,
          borderBottomRightRadius: 18,
          borderBottomLeftRadius: 14,
          borderWidth: 1.5,
          borderColor: p.lineStrong,
          backgroundColor: p.card,
          color: p.text,
          fontFamily: fonts.body,
          fontSize: 15.5,
        }}
        accessibilityLabel="Ask or tell your Crew"
        maxFontSizeMultiplier={1.3}
      />
      <PressScale onPress={send} accessibilityLabel="Send">
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: p.stone, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-up" size={22} color={p.onStone} />
        </View>
      </PressScale>
    </View>
  );
}

export default function Today() {
  const p = useTheme();
  useAliveCrew();
  const insets = useSafeAreaInsets();
  const lead = useLead();
  const firstName = useCrew((s) => s.firstName);
  const members = useCrew((s) => s.members);
  const blocks = useCrew((s) => s.blocks);
  const sample = useCrew((s) => s.sample);
  const tier = useCrew((s) => s.settings.tier);
  const receipts = useCrew((s) => s.receipts);
  const updateBlock = useCrew((s) => s.updateBlock);
  const removeBlock = useCrew((s) => s.removeBlock);
  const addBlock = useCrew((s) => s.addBlock);
  const clearSample = useCrew((s) => s.clearSample);
  const [now, setNow] = useState(new Date());
  const [huddle, setHuddle] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [etas, setEtas] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const today = isoDate(now);
  const todays = useMemo(() => blocks.filter((b) => b.date === today).sort((a, b) => a.time.localeCompare(b.time)), [blocks, today]);
  const collisions = useMemo(() => findCollisions(blocks, now), [blocks, now]);
  const line = huddle ?? huddleLine(blocks, now);
  const doneToday = receipts.filter((r) => r.kind === 'did' && !r.undone && r.at > now.getTime() - 86400000).length;

  // Real leave-by times when a block has a place and location is allowed.
  useEffect(() => {
    todays
      .filter((b) => b.location && !etas[b.id])
      .slice(0, 3)
      .forEach((b) => {
        fetchEta(b.location!).then((r) => {
          if (r) setEtas((x) => ({ ...x, [b.id]: `${r.minutes} min` }));
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todays.length]);

  const refresh = async () => {
    setRefreshing(true);
    const res = await askTeammate({
      member: lead,
      history: [],
      text: 'Give me my huddle for today in two short sentences: what to do next and anything that needs me. No lists.',
      task: 'huddle',
    });
    if (res.text) setHuddle(res.text);
    setRefreshing(false);
  };

  const toggleDone = (b: Block) => {
    updateBlock(b.id, { done: !b.done });
    if (!b.done) {
      haptic('success');
      toast(`Nice. "${b.title}" is done.`, { label: 'Undo', onPress: () => useCrew.getState().updateBlock(b.id, { done: false }) });
    }
  };

  const remove = (b: Block) => {
    removeBlock(b.id);
    toast(`Removed "${b.title}"`, { label: 'Undo', onPress: () => addBlock({ ...b }) });
  };

  const collision = collisions[0];
  const shown = members.slice(0, 6);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nextIndex = todays.findIndex((b) => !b.done && minutesOf(b.time) >= nowMin);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.signal} />}
      footer={<AskBar />}
      contentStyle={{ paddingBottom: 24 + insets.bottom * 0 }}
    >
      <Animated.View entering={FadeIn.duration(500)} style={{ paddingHorizontal: 4 }}>
        <Txt variant="mono" style={{ letterSpacing: 1.2 }}>
          {dayLabel(now)}
        </Txt>
        <Txt variant="display" style={{ marginTop: 6 }}>
          {greeting(now)}, {firstName || 'friend'}.
        </Txt>
        <Txt variant="body" style={{ marginTop: 10 }}>
          {line}
        </Txt>
      </Animated.View>

      {sample && (
        <Animated.View entering={FadeInDown.delay(100)}>
          <Card tone="soft" carve={2} padding={12} style={{ marginTop: 14 }}>
            <Row gap={10}>
              <Ionicons name="sparkles-outline" size={18} color={p.text} />
              <Txt variant="small" color={p.text2} style={{ flex: 1 }}>
                This is a sample day so you can see your Crew at work.
              </Txt>
              <Btn
                title="Clear it"
                small
                variant="ghost"
                onPress={() => {
                  clearSample();
                  toast('Sample cleared. Your day is all yours.');
                }}
              />
            </Row>
          </Card>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(150)}>
        <Card carve={0} style={{ marginTop: 16 }} padding={12}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
            {shown.map((m) => (
              <PressScale
                key={m.id}
                onPress={() => router.push({ pathname: '/teammate/[id]', params: { id: m.id } })}
                style={{ width: '33.33%', alignItems: 'center' }}
                accessibilityLabel={`${m.name}: ${memberLine(m)}`}
              >
                <MemberPebble member={m} size={56} />
                <Txt variant="h3" style={{ marginTop: 6 }} numberOfLines={1}>
                  {m.name}
                </Txt>
                <Txt variant="tiny" center numberOfLines={2} style={{ marginTop: 2, paddingHorizontal: 4 }} color={m.state === 'waiting' ? p.signalText : p.muted}>
                  {memberLine(m)}
                </Txt>
              </PressScale>
            ))}
            {members.length < 3 && (
              <PressScale onPress={() => router.push('/studio')} style={{ width: '33.33%', alignItems: 'center' }} accessibilityLabel="Add a teammate">
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 22,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: p.lineStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={26} color={p.muted} />
                </View>
                <Txt variant="h3" style={{ marginTop: 6 }}>
                  Add
                </Txt>
                <Txt variant="tiny">a teammate</Txt>
              </PressScale>
            )}
          </View>
        </Card>
      </Animated.View>

      {collision ? (
        <Animated.View entering={FadeInDown.delay(220)}>
          <Card tone="stone" carve={1} style={{ marginTop: 14 }} padding={18}>
            <Row gap={8}>
              <Drop size={18} color={p.mode === 'paper' ? '#5CC8F2' : '#1E5BD2'} />
              <Txt variant="label" color={p.mode === 'paper' ? '#8FD8F7' : '#1A4DB3'}>
                Heads up
              </Txt>
            </Row>
            <Txt variant="h2" color={p.onStone} style={{ marginTop: 8, fontSize: 24, lineHeight: 27 }}>
              {weekdayName(collision.date)} doesn't fit. Yet.
            </Txt>
            <Txt variant="body" color={p.onStoneMuted} style={{ marginTop: 8 }}>
              {collision.a.title} and {collision.b.title} both want {clockAmPm(collision.b.time)}. {lead.name} has plans that cover both.
            </Txt>
            <Row style={{ marginTop: 14 }} gap={8}>
              <Btn title="See the plans" small variant="water" onPress={() => router.push({ pathname: '/planner', params: { fix: '1' } })} />
              <Btn title="Talk it through" small variant="stoneGhost" onPress={() => router.push('/table')} />
            </Row>
          </Card>
        </Animated.View>
      ) : null}

      <Row justify="space-between" align="flex-end" style={{ marginTop: 24, paddingHorizontal: 4 }}>
        <Txt variant="h2" style={{ fontSize: 24 }}>
          Today
        </Txt>
        <Txt variant="small">{placedBy(blocks, today) ? `${placedBy(blocks, today)} placed by your Crew` : `${todays.length} blocks`}</Txt>
      </Row>

      <View style={{ marginTop: 12, gap: 8 }}>
        {todays.length === 0 ? (
          <Empty
            title="Nothing on today yet"
            body={`Tell ${lead.name} what you're taking on and it'll find the time.`}
            action={<Btn title="Plan my day" small variant="signal" onPress={() => router.push({ pathname: '/chat/[id]', params: { id: lead.id, q: 'Help me plan today.' } })} />}
          />
        ) : (
          todays.map((b, i) => (
            <View key={b.id}>
              {i === nextIndex && (
                <Row gap={6} style={{ marginLeft: 54, marginBottom: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.signal }} />
                  <Txt variant="tiny" color={p.signalText}>
                    Up next
                  </Txt>
                </Row>
              )}
              <BlockCard
                block={b}
                index={i}
                eta={etas[b.id] ?? (b.kind === 'leave' && sample ? '12 min' : null)}
                onPress={() => toggleDone(b)}
                onLongPress={() => remove(b)}
                onFlow={() => router.push({ pathname: '/flow', params: { task: b.title.replace(/^Flow:\s*/i, ''), blockId: b.id } })}
              />
            </View>
          ))
        )}
      </View>
      {todays.length > 0 && (
        <Txt variant="tiny" center style={{ marginTop: 10 }}>
          Tap to finish a block. Hold to remove it.
        </Txt>
      )}

      <Row wrap gap={8} style={{ marginTop: 22 }}>
        <Chip label="Week planner" icon="calendar-outline" onPress={() => router.push('/planner')} />
        <Chip label="Flow" icon="water-outline" onPress={() => router.push('/flow')} />
        <Chip label="Crew Table" icon="chatbubbles-outline" onPress={() => router.push('/table')} />
        <Chip label="Messages" icon="chatbubble-ellipses-outline" onPress={() => router.push('/messages')} />
        <Chip label="Crew Room" icon="home-outline" onPress={() => router.push('/room')} />
        <Chip label="Weekly review" icon="ribbon-outline" onPress={() => router.push('/review')} />
        <Chip label="Your year" icon="ellipse-outline" onPress={() => router.push('/rings')} />
        <Chip label="Errands" icon="bag-handle-outline" onPress={() => router.push('/errand/new')} />
      </Row>

      {doneToday > 0 && (
        <Card carve={3} style={{ marginTop: 16 }} onPress={() => router.push('/receipts')} padding={14}>
          <Row gap={12}>
            <Ionicons name="receipt-outline" size={20} color={p.text} />
            <Txt variant="bodyStrong" style={{ flex: 1 }}>
              Your Crew did {doneToday} {doneToday === 1 ? 'thing' : 'things'} today
            </Txt>
            <Txt variant="smallStrong" color={p.signalText}>
              Receipts
            </Txt>
          </Row>
        </Card>
      )}

      <AdBanner tier={tier} />
    </Screen>
  );
}
