import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { PLAN_LIMITS, TEMPLATES } from '@/lib/catalog';
import { memberLine } from '@/lib/huddle';
import { nameOf, useCrew } from '@/lib/store';
import { CrewLoop, type LoopSelection } from '@/components/CrewLoop';
import { MemberPebble, Pebble } from '@/components/Pebble';
import { Btn, Card, Chip, haptic, Label, ListRow, PressScale, Row, Screen, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved, textOn } from '@/theme/tokens';

const TIER_LABEL = { free: 'Free', plus: 'Plus', pro: 'Pro', founding: 'Founding' } as const;

export default function Crew() {
  const p = useTheme();
  const members = useCrew((s) => s.members);
  const leadId = useCrew((s) => s.leadId);
  const tier = useCrew((s) => s.settings.tier);
  const table = useCrew((s) => s.table);
  const setLead = useCrew((s) => s.setLead);
  const packs = useCrew((s) => s.charter.packs);
  const [sel, setSel] = useState<LoopSelection>({ kind: 'member', id: leadId });
  const [changingLead, setChangingLead] = useState(false);

  const limit = PLAN_LIMITS[tier].seats;
  const open = limit - members.length;
  const selected = sel.kind === 'member' ? members.find((m) => m.id === sel.id) : undefined;
  const isLead = selected?.id === leadId;
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
        <Txt variant="display">Crew</Txt>
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
        <CrewLoop members={members} leadId={leadId} seatLimit={limit} selected={sel} onSelect={setSel} />
      </Animated.View>
      <Txt variant="small" center style={{ marginTop: 14 }}>
        Your Crew fills the loop. The lead sits at the center.
      </Txt>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 14, paddingHorizontal: 2 }}>
        {members.map((m) => (
          <Chip
            key={m.id}
            label={m.id === leadId ? `${m.name} · lead` : m.name}
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
                    {isLead ? 'Crew lead' : selected.role}
                  </Txt>
                </View>
              </Row>
              <Txt variant="body" style={{ marginTop: 10 }}>
                {isLead
                  ? 'Coordinates everyone and keeps your Charter. Move anyone into the center to make them lead.'
                  : `${selected.state === 'working' ? 'Working now: ' : ''}${memberLine(selected)}.`}
              </Txt>
              <Row gap={8} style={{ marginTop: 12 }} wrap>
                <Btn title={isLead ? `Talk to ${selected.name}` : `Message ${selected.name}`} small onPress={() => router.push({ pathname: '/chat/[id]', params: { id: selected.id } })} />
                {isLead ? (
                  members.length > 1 && <Btn title="Change lead" small variant="ghost" onPress={() => setChangingLead(true)} />
                ) : (
                  <Btn
                    title="Make lead"
                    small
                    variant="ghost"
                    onPress={() => {
                      const prev = nameOf(leadId);
                      setLead(selected.id);
                      haptic('success');
                      toast(`${selected.name} leads the Crew now. ${prev} moved to a seat.`, { label: 'Undo', onPress: () => useCrew.getState().setLead(leadId) }, selected.color);
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
                Make a new pebble in Pebble Studio, give them a job, and watch them take their seat.
              </Txt>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Btn title="Open Pebble Studio" small variant="signal" onPress={() => router.push('/studio')} />
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
                Plus opens every seat in the loop, plus more routines, errands, and Plus-only materials and extras in Pebble Studio.
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
                  A starter idea
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
              onPress={() => router.push({ pathname: '/studio', params: { kind: suggestion.t.kind } })}
            />
          </Card>
        </Animated.View>
      )}

      <Label>Together</Label>
      <Card carve={2} padding={6}>
        <ListRow icon="home-outline" title="Crew Room" sub="Watch them work and hang out. Decorate it your way." onPress={() => router.push('/room')} />
        <ListRow icon="chatbubbles-outline" title="Crew Table" sub={lastTable ? `${nameOf(lastTable.from)}: ${lastTable.text}` : 'Where your teammates work things out'} onPress={() => router.push('/table')} />
        <ListRow icon="desktop-outline" title="Workbench" sub="Each teammate's own computer. Watch them work live." onPress={() => router.push('/workbench')} />
        <ListRow icon="git-merge-outline" title="Meetup" sub="When two Crews meet: group projects, plans with friends" onPress={() => router.push('/meetup')} />
        <ListRow icon="repeat-outline" title="Routines" sub="When this happens, a teammate does that" onPress={() => router.push('/routines')} />
      </Card>

      <Label>Starter ideas</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
        <PressScale onPress={() => router.push('/studio')} accessibilityLabel="Start a blank pebble">
          <View style={[carved[3], { width: 120, padding: 12, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
            <Pebble shape="round" color={p.mode === 'ink' ? '#9E968A' : '#E6DFD2'} size={42} animate={false} restingMood="curious" />
            <Txt variant="h3" style={{ marginTop: 6 }} numberOfLines={1}>
              Blank pebble
            </Txt>
            <Txt variant="tiny" numberOfLines={2}>
              You write the job
            </Txt>
          </View>
        </PressScale>
        {TEMPLATES.filter((t) => t.kind !== 'aibram').map((t, i) => {
          const have = members.some((m) => m.kind === t.kind);
          return (
            <PressScale key={t.kind} onPress={() => router.push({ pathname: '/studio', params: { kind: t.kind } })} accessibilityLabel={`${t.defaultName}, ${t.role}`}>
              <View style={[carved[i % 4], { width: 120, padding: 12, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                <Pebble shape={t.shape} color={t.color} mark={t.mark} size={42} animate={false} />
                <Txt variant="h3" style={{ marginTop: 6 }} numberOfLines={1}>
                  {t.defaultName}
                </Txt>
                <Txt variant="tiny" numberOfLines={2}>
                  {have ? 'In your Crew' : t.role}
                </Txt>
              </View>
            </PressScale>
          );
        })}
      </ScrollView>

      <Sheet visible={changingLead} onClose={() => setChangingLead(false)} title="Who leads the Crew?">
        <Txt variant="small" style={{ marginBottom: 8 }}>
          The lead sees the whole board, runs the huddle and settles conflicts at the Table.
        </Txt>
        {members.map((m) => (
          <PressScale
            key={m.id}
            onPress={() => {
              const prevLead = leadId;
              setLead(m.id);
              setSel({ kind: 'member', id: m.id });
              setChangingLead(false);
              if (m.id !== prevLead) toast(`${m.name} is lead now.`, { label: 'Undo', onPress: () => useCrew.getState().setLead(prevLead) }, m.color);
            }}
            accessibilityLabel={`Make ${m.name} lead`}
          >
            <Row gap={12} style={{ paddingVertical: 10 }}>
              <MemberPebble member={m} size={40} animate={false} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{m.name}</Txt>
                <Txt variant="small">{m.role}</Txt>
              </View>
              {m.id === leadId && <Ionicons name="checkmark-circle" size={22} color={p.signal} />}
            </Row>
          </PressScale>
        ))}
      </Sheet>
    </Screen>
  );
}
