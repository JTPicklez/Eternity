import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { PLAN_LIMITS, TEMPLATES } from '@/lib/catalog';
import { memberLine } from '@/lib/huddle';
import { nameOf, useFamily } from '@/lib/store';
import { FamilyLoop, type LoopSelection } from '@/components/FamilyLoop';
import { MemberPebble, Pebble } from '@/components/Pebble';
import { Btn, Card, Chip, haptic, Label, ListRow, PressScale, Row, Screen, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved, textOn } from '@/theme/tokens';

const TIER_LABEL = { free: 'Free', plus: 'Plus', pro: 'Pro', founding: 'Founding' } as const;

export default function Family() {
  const p = useTheme();
  const members = useFamily((s) => s.members);
  const headId = useFamily((s) => s.headId);
  const tier = useFamily((s) => s.settings.tier);
  const table = useFamily((s) => s.table);
  const setHead = useFamily((s) => s.setHead);
  const packs = useFamily((s) => s.charter.packs);
  const [sel, setSel] = useState<LoopSelection>({ kind: 'member', id: headId });
  const [changingHead, setChangingHead] = useState(false);

  const limit = PLAN_LIMITS[tier].seats;
  const open = limit - members.length;
  const selected = sel.kind === 'member' ? members.find((m) => m.id === sel.id) : undefined;
  const isHead = selected?.id === headId;
  const lastTable = table[table.length - 1];

  const suggestion = useMemo(() => {
    const have = new Set(members.map((m) => m.kind));
    const reasons: Record<string, string> = {
      pace: "You've got a race goal. Pace is ready to coach the training.",
      sage: 'Exams are coming. Sage turns lectures into decks overnight.',
      bolt: 'Shipping something? Bolt keeps the build green.',
      ledger: 'Building a business? Ledger keeps you on the one number that matters.',
      echo: 'Creating? Echo never misses a release day.',
      quill: 'Writing something big? Quill protects your voice.',
    };
    const order = ['sage', 'bolt', 'pace', 'ledger', 'echo', 'quill'].sort((a, b) => {
      const pa = TEMPLATES.find((t) => t.kind === a)?.pack;
      const pb = TEMPLATES.find((t) => t.kind === b)?.pack;
      return Number(!!pb && packs.includes(pb)) - Number(!!pa && packs.includes(pa));
    });
    const kind = order.find((k) => !have.has(k));
    if (!kind) return null;
    return { t: TEMPLATES.find((t) => t.kind === kind)!, reason: reasons[kind] };
  }, [members, packs]);

  return (
    <Screen>
      <Row justify="space-between" style={{ height: 48, paddingHorizontal: 4 }}>
        <Txt variant="display">Family</Txt>
        <PressScale onPress={() => router.push('/plus')} accessibilityLabel={`${members.length} of ${limit} seats, ${TIER_LABEL[tier]} plan`}>
          <View style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, borderColor: p.text, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt variant="mono" color={p.text}>
              {members.length} of {limit}
            </Txt>
            <Txt variant="small">· {TIER_LABEL[tier]}</Txt>
          </View>
        </PressScale>
      </Row>

      <Animated.View entering={FadeIn.duration(600)} style={{ marginTop: 18 }}>
        <FamilyLoop members={members} headId={headId} seatLimit={limit} selected={sel} onSelect={setSel} />
      </Animated.View>
      <Txt variant="small" center style={{ marginTop: 14 }}>
        Your family fills the loop. The head sits at the center.
      </Txt>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 14, paddingHorizontal: 2 }}>
        {members.map((m) => (
          <Chip
            key={m.id}
            label={m.id === headId ? `${m.name} · head` : m.name}
            selected={sel.kind === 'member' && sel.id === m.id}
            onPress={() => setSel({ kind: 'member', id: m.id })}
          />
        ))}
        {open > 0 && <Chip label={`${open} open seat${open === 1 ? '' : 's'}`} selected={sel.kind === 'open'} onPress={() => setSel({ kind: 'open', seat: members.length - 1 })} />}
        {limit < 10 && <Chip label={`${10 - limit} more with Plus`} selected={sel.kind === 'locked'} onPress={() => setSel({ kind: 'locked', seat: 9 })} />}
      </ScrollView>

      <Animated.View key={sel.kind === 'member' ? sel.id : sel.kind} entering={FadeInDown.duration(300)}>
        <Card carve={0} style={{ minHeight: 168 }}>
          {selected ? (
            <>
              <Row gap={14}>
                <MemberPebble member={selected} size={64} onPress={() => haptic('light')} />
                <View style={{ flex: 1 }}>
                  <Txt variant="h2">{selected.name}</Txt>
                  <Txt variant="smallStrong" color={textOn(p, selected.color)}>
                    {isHead ? 'Head of the family' : selected.role}
                  </Txt>
                </View>
              </Row>
              <Txt variant="body" style={{ marginTop: 10 }}>
                {isHead
                  ? 'Coordinates everyone and keeps your Charter. Move anyone into the center to make them head.'
                  : `${selected.state === 'working' ? 'Working now: ' : ''}${memberLine(selected)}.`}
              </Txt>
              <Row gap={8} style={{ marginTop: 12 }} wrap>
                <Btn title={isHead ? `Talk to ${selected.name}` : `Message ${selected.name}`} small onPress={() => router.push({ pathname: '/chat/[id]', params: { id: selected.id } })} />
                {isHead ? (
                  members.length > 1 && <Btn title="Change head" small variant="ghost" onPress={() => setChangingHead(true)} />
                ) : (
                  <Btn
                    title="Make head"
                    small
                    variant="ghost"
                    onPress={() => {
                      const prev = nameOf(headId);
                      setHead(selected.id);
                      haptic('success');
                      toast(`${selected.name} is head of the family now. ${prev} moved to a seat.`, { label: 'Undo', onPress: () => useFamily.getState().setHead(headId) }, selected.color);
                    }}
                  />
                )}
                <Btn title="Settings" small variant="ghost" icon="options-outline" onPress={() => router.push({ pathname: '/teammate/[id]', params: { id: selected.id } })} />
              </Row>
            </>
          ) : sel.kind === 'open' ? (
            <>
              <Row gap={14}>
                <View style={{ width: 64, height: 64, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: p.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={28} color={p.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="h2">Open seat</Txt>
                  <Txt variant="smallStrong" color={p.muted}>
                    {open} open{limit < 10 ? ` · ${10 - limit} more with Plus` : ''}
                  </Txt>
                </View>
              </Row>
              <Txt variant="body" style={{ marginTop: 10 }}>
                Shape a new teammate in the Riverbed and watch them take their place in the loop.
              </Txt>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Btn title="Open the Riverbed" small variant="signal" onPress={() => router.push('/riverbed')} />
                {limit < 10 && <Btn title="See Plus" small variant="ghost" onPress={() => router.push('/plus')} />}
              </Row>
            </>
          ) : (
            <>
              <Row gap={14}>
                <View style={{ width: 64, height: 64, borderRadius: 24, backgroundColor: p.shadow, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="lock-closed-outline" size={24} color={p.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="h2">Room for 10</Txt>
                  <Txt variant="smallStrong" color={p.muted}>
                    Plus and Pro
                  </Txt>
                </View>
              </Row>
              <Txt variant="body" style={{ marginTop: 10 }}>
                Plus opens every seat in the loop, plus routines, errands and the gold leaf finish for Founding Families.
              </Txt>
              <Btn title="See Plus" small variant="signal" style={{ marginTop: 12 }} onPress={() => router.push('/plus')} />
            </>
          )}
        </Card>
      </Animated.View>

      {suggestion && (
        <Animated.View entering={FadeInDown.delay(120)}>
          <Card tone="stone" carve={1} style={{ marginTop: 14 }}>
            <Row gap={14}>
              <Pebble shape={suggestion.t.shape} color={suggestion.t.color} mark={suggestion.t.mark} motion={suggestion.t.motion} size={58} />
              <View style={{ flex: 1 }}>
                <Txt variant="label" color={suggestion.t.color}>
                  Waiting in the Riverbed
                </Txt>
                <Txt variant="small" color={p.onStone} style={{ marginTop: 4 }}>
                  {suggestion.reason}
                </Txt>
              </View>
            </Row>
            <Btn
              title={`Meet ${suggestion.t.defaultName}`}
              small
              variant="color"
              color={suggestion.t.color}
              style={{ marginTop: 12 }}
              onPress={() => router.push({ pathname: '/riverbed', params: { kind: suggestion.t.kind } })}
            />
          </Card>
        </Animated.View>
      )}

      <Label>Together</Label>
      <Card carve={2} padding={6}>
        <ListRow icon="chatbubbles-outline" title="Family Table" sub={lastTable ? `${nameOf(lastTable.from)}: ${lastTable.text}` : 'Where your teammates work things out'} onPress={() => router.push('/table')} />
        <ListRow icon="desktop-outline" title="Workbench" sub="Each teammate's own computer. Watch them work live." onPress={() => router.push('/workbench')} />
        <ListRow icon="git-merge-outline" title="Confluence" sub="When two families meet: group projects, plans with friends" onPress={() => router.push('/confluence')} />
        <ListRow icon="repeat-outline" title="Routines" sub="When this happens, a teammate does that" onPress={() => router.push('/routines')} />
      </Card>

      <Label>Made by other families</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
        {TEMPLATES.filter((t) => t.kind !== 'aibram').map((t, i) => {
          const have = members.some((m) => m.kind === t.kind);
          return (
            <PressScale key={t.kind} onPress={() => router.push({ pathname: '/riverbed', params: { kind: t.kind } })} accessibilityLabel={`${t.defaultName}, ${t.role}`}>
              <View style={[carved[i % 4], { width: 120, padding: 12, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                <Pebble shape={t.shape} color={t.color} mark={t.mark} size={42} animate={false} />
                <Txt variant="h3" style={{ marginTop: 6 }} numberOfLines={1}>
                  {t.defaultName}
                </Txt>
                <Txt variant="tiny" numberOfLines={2}>
                  {have ? 'In your family' : t.role}
                </Txt>
              </View>
            </PressScale>
          );
        })}
      </ScrollView>

      <Sheet visible={changingHead} onClose={() => setChangingHead(false)} title="Who leads the family?">
        <Txt variant="small" style={{ marginBottom: 8 }}>
          The head sees the whole board, runs the huddle and settles conflicts at the Table.
        </Txt>
        {members.map((m) => (
          <PressScale
            key={m.id}
            onPress={() => {
              const prevHead = headId;
              setHead(m.id);
              setSel({ kind: 'member', id: m.id });
              setChangingHead(false);
              if (m.id !== prevHead) toast(`${m.name} is head now.`, { label: 'Undo', onPress: () => useFamily.getState().setHead(prevHead) }, m.color);
            }}
            accessibilityLabel={`Make ${m.name} head`}
          >
            <Row gap={12} style={{ paddingVertical: 10 }}>
              <MemberPebble member={m} size={40} animate={false} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{m.name}</Txt>
                <Txt variant="small">{m.role}</Txt>
              </View>
              {m.id === headId && <Ionicons name="checkmark-circle" size={22} color={p.signal} />}
            </Row>
          </PressScale>
        ))}
      </Sheet>
    </Screen>
  );
}
