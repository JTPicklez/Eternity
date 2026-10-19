/**
 * Pebble Studio: where teammates are made and dressed up. You write their
 * job (starter ideas are optional), then pick the shape, color, material,
 * face and anything they wear. Everything shows live on the stage, and you
 * can poke them.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { BounceIn, FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { COLORS, JOB_IDEAS, MARKS, MOTIONS, PLAN_LIMITS, SHAPES, templateFor } from '@/lib/catalog';
import { daysTogether, EXTRAS, FINISHES, lockFor, RESTING_MOODS, toggleExtra, wearFor, wearLabel } from '@/lib/cosmetics';
import { useCrew } from '@/lib/store';
import type { Extra, Face, Finish, Mark, Mood, Motion, Shape } from '@/lib/types';
import { Pebble } from '@/components/Pebble';
import { BackHeader, Badge, Btn, Card, Chip, Field, haptic, Label, PressScale, Ripples, Row, Screen, Segmented, Toggle, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

interface Draft {
  kind: string;
  name: string;
  role: string;
  blurb: string;
  shape: Shape;
  color: string;
  face: Face;
  mood: Mood;
  mark: Mark;
  finish: Finish;
  motion: Motion;
  extras: Extra[];
  polished: boolean;
}

type Tab = 'job' | 'look' | 'extras';

const POKES = ['Hi!', 'Hehe, that tickles.', 'Boop.', "I'm awake, I promise.", 'Again? Okay.', 'Ready when you are.'];

function blank(): Draft {
  return {
    kind: 'custom',
    name: '',
    role: '',
    blurb: '',
    shape: 'round',
    color: COLORS[5].color,
    face: 'eyes',
    mood: 'happy',
    mark: 'spark',
    finish: 'smooth',
    motion: 'calm',
    extras: [],
    polished: false,
  };
}

function fromKind(kind: string): Draft {
  if (kind === 'custom') return blank();
  const t = templateFor(kind);
  return { ...blank(), kind: t.kind, name: t.defaultName, role: t.role, blurb: t.blurb, shape: t.shape, color: t.color, mark: t.mark, motion: t.motion };
}

export default function PebbleStudio() {
  const p = useTheme();
  const params = useLocalSearchParams<{ id?: string; kind?: string; tab?: Tab }>();
  const members = useCrew((s) => s.members);
  const leadId = useCrew((s) => s.leadId);
  const tier = useCrew((s) => s.settings.tier);
  const addMember = useCrew((s) => s.addMember);
  const updateMember = useCrew((s) => s.updateMember);
  const renameMember = useCrew((s) => s.renameMember);
  const editing = params.id ? members.find((m) => m.id === params.id) : undefined;

  const [draft, setDraft] = useState<Draft>(() =>
    editing
      ? {
          kind: editing.kind,
          name: editing.name,
          role: editing.role,
          blurb: editing.blurb,
          shape: editing.shape,
          color: editing.color,
          face: editing.face === 'sleepy' ? 'eyes' : editing.face,
          mood: editing.face === 'sleepy' ? 'sleepy' : (editing.mood ?? 'happy'),
          mark: editing.mark,
          finish: editing.finish,
          motion: editing.motion,
          extras: editing.extras ?? [],
          polished: !!editing.polished,
        }
      : params.kind
        ? fromKind(params.kind)
        : blank(),
  );
  const [tab, setTab] = useState<Tab>(params.tab ?? (editing ? 'look' : 'job'));
  const [error, setError] = useState('');
  const [born, setBorn] = useState<string | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const pokeIdx = useRef(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    },
    [],
  );

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    haptic('select');
  };

  const days = editing ? daysTogether(editing) : 0;
  const wear = draft.polished ? 0.08 : editing ? wearFor({ joinedAt: editing.joinedAt, polished: false }) : 0.05;
  const limit = PLAN_LIMITS[tier].seats;
  const full = !editing && members.length >= limit;
  const isLead = editing?.id === leadId;

  const poke = () => {
    setBubble(POKES[pokeIdx.current++ % POKES.length]);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 1600);
  };

  const pickIdea = (idea: (typeof JOB_IDEAS)[number]) => {
    haptic('select');
    setDraft((d) => {
      const t = idea.kind !== 'custom' ? templateFor(idea.kind) : null;
      return {
        ...d,
        kind: idea.kind,
        role: idea.role,
        blurb: idea.blurb,
        // An idea from a template brings its look only if they haven't picked one yet.
        ...(t && !editing && d.kind === 'custom' && !d.name ? { name: t.defaultName, shape: t.shape, color: t.color, mark: t.mark, motion: t.motion } : {}),
      };
    });
  };

  const save = () => {
    setError('');
    const name = draft.name.trim();
    if (!name) {
      setTab('job');
      return setError('Give them a name.');
    }
    if (!draft.role.trim() && !isLead) {
      setTab('job');
      return setError("What's their job? A few words is plenty.");
    }
    const look = {
      shape: draft.shape,
      color: draft.color,
      face: draft.face,
      mood: draft.mood,
      mark: draft.mark,
      finish: draft.finish,
      motion: draft.motion,
      extras: draft.extras,
      polished: draft.polished,
    };
    if (editing) {
      if (name !== editing.name) {
        const r = renameMember(editing.id, name);
        if (!r.ok) return setError(r.reason ?? '');
      }
      updateMember(editing.id, { ...look, role: draft.role.trim() || editing.role, blurb: draft.blurb.trim() });
      haptic('success');
      toast(`${name} looks great.`, undefined, draft.color);
      router.back();
      return;
    }
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return setError(`Someone in your Crew is already called ${name}.`);
    const fromTemplate = draft.kind !== 'custom';
    const r = addMember(draft.kind, {
      ...look,
      kind: draft.kind,
      name,
      role: draft.role.trim(),
      blurb: draft.blurb.trim(),
      ...(fromTemplate ? {} : { connectors: [], triggers: [] }),
    });
    if (!r.ok || !r.member) return setError(r.reason === 'free-limit' ? 'Free plans have 3 seats. Plus opens all 10.' : 'The loop is full.');
    haptic('success');
    setBorn(r.member.id);
  };

  if (born) {
    const m = members.find((x) => x.id === born);
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Ripples size={360} />
          <Animated.View entering={BounceIn.duration(1000)}>
            <Pebble
              shape={draft.shape}
              color={draft.color}
              face={draft.face}
              mark={draft.mark}
              finish={draft.finish}
              motion={draft.motion}
              extras={draft.extras}
              wear={0.05}
              size={170}
              state="done"
              seed={born}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(600)} style={{ alignItems: 'center' }}>
            <Txt variant="title" center style={{ marginTop: 24 }}>
              {m?.name ?? draft.name} took a seat.
            </Txt>
            <Txt variant="body" center style={{ marginTop: 8, maxWidth: 300 }}>
              They know your Charter and the job you gave them. Say hi, or hand them something to do.
            </Txt>
            <Row gap={8} style={{ marginTop: 22 }}>
              <Btn
                title={`Say hi to ${m?.name ?? draft.name}`}
                variant="signal"
                onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: born, q: 'Hi! What can you do for me?' } })}
              />
              <Btn title="Back to Crew" variant="ghost" onPress={() => router.replace('/crew')} />
            </Row>
          </Animated.View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      ripples={false}
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, gap: 6 }}>
          {error ? (
            <Txt variant="small" color={p.danger} center>
              {error}
            </Txt>
          ) : null}
          {full ? (
            <Btn title="Your seats are full. See Plus" variant="signal" full onPress={() => router.push('/plus')} />
          ) : (
            <Btn title={editing ? 'Save changes' : 'Bring them to life'} variant="signal" full icon={editing ? 'checkmark' : 'sparkles'} onPress={save} />
          )}
        </View>
      }
    >
      <BackHeader title={editing ? `Customize ${editing.name}` : 'Pebble Studio'} kicker={editing ? 'Pebble Studio' : 'Make a teammate'} />

      {/* the stage */}
      <View style={{ alignItems: 'center', height: 236, justifyContent: 'center', marginTop: 4 }}>
        <Ripples size={340} corner="topLeft" />
        {bubble ? (
          <Animated.View
            entering={FadeIn.duration(120)}
            exiting={FadeOut.duration(200)}
            style={{ position: 'absolute', top: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }}
          >
            <Txt variant="smallStrong">{bubble}</Txt>
          </Animated.View>
        ) : null}
        <Pebble
          shape={draft.shape}
          color={draft.color}
          face={draft.face}
          restingMood={draft.mood}
          mark={draft.mark}
          finish={draft.finish}
          motion={draft.motion}
          extras={draft.extras}
          wear={wear}
          seed={editing?.id ?? 'studio'}
          size={150}
          onPress={poke}
          label={`Poke ${draft.name || 'your pebble'}`}
          style={{ marginTop: 26 }}
        />
      </View>
      <Txt variant="h2" center>
        {draft.name || 'Unnamed'}
      </Txt>
      <Txt variant="small" center numberOfLines={2} style={{ marginHorizontal: 24 }}>
        {isLead ? 'Crew lead' : draft.role || 'What do they do? You decide.'}
      </Txt>

      <View style={{ marginTop: 16 }}>
        <Segmented<Tab>
          options={[
            { id: 'job', label: 'Job' },
            { id: 'look', label: 'Look' },
            { id: 'extras', label: 'Extras' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'job' && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Label>Name</Label>
          <Field value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="What should they be called?" maxLength={18} />

          <Label>{isLead ? 'Their job (they also lead the Crew)' : 'Their job'}</Label>
          <Field
            value={draft.role}
            onChangeText={(v) => setDraft((d) => ({ ...d, role: v }))}
            placeholder="A few words, like 'Internship hunter'"
            maxLength={40}
          />
          <Label>What they're best at</Label>
          <Field
            value={draft.blurb}
            onChangeText={(v) => setDraft((d) => ({ ...d, blurb: v }))}
            placeholder="How they help. 'Finds 5 internships a week, drafts the cover letters, keeps me on deadlines.'"
            multiline
            maxLength={280}
          />

          <Label>Need ideas?</Label>
          <Txt variant="small" style={{ marginTop: -6, marginBottom: 10, marginHorizontal: 4 }}>
            Tap one to start from it, then change any word. Nobody is stuck with a preset.
          </Txt>
          <Row gap={8} wrap>
            {JOB_IDEAS.map((idea) => (
              <Chip key={idea.label} label={idea.label} small selected={draft.role === idea.role} onPress={() => pickIdea(idea)} />
            ))}
          </Row>
        </Animated.View>
      )}

      {tab === 'look' && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Label>Shape</Label>
          <Row gap={8} justify="space-between">
            {SHAPES.map((s) => (
              <PressScale key={s} onPress={() => set('shape', s)} accessibilityLabel={`${s} shape`} accessibilityRole="radio">
                <View style={{ padding: 6, borderRadius: 16, borderWidth: 2, borderColor: draft.shape === s ? p.text : 'transparent' }}>
                  <Pebble shape={s} color={draft.color} face={draft.face} restingMood={draft.mood} finish={draft.finish} size={46} animate={false} shadow={false} />
                </View>
              </PressScale>
            ))}
          </Row>

          <Label>Color</Label>
          <Row gap={10} wrap>
            {COLORS.map((c) => (
              <PressScale key={c.color} onPress={() => set('color', c.color)} accessibilityLabel={c.label} accessibilityRole="radio">
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: c.color, borderWidth: 3, borderColor: draft.color === c.color ? p.text : 'transparent' }} />
                  <Txt variant="tiny">{c.label}</Txt>
                </View>
              </PressScale>
            ))}
          </Row>

          <Label>Material</Label>
          <Row gap={8} wrap>
            {FINISHES.map((f) => {
              const lock = lockFor(f, tier, days);
              return (
                <PressScale key={f.id} onPress={() => (lock.locked ? router.push('/plus') : set('finish', f.id))} accessibilityLabel={f.label}>
                  <View style={{ alignItems: 'center', width: 74, gap: 4, opacity: lock.locked ? 0.6 : 1 }}>
                    <View style={{ padding: 4, borderRadius: 16, borderWidth: 2, borderColor: draft.finish === f.id ? p.text : 'transparent' }}>
                      <Pebble shape="round" color={draft.color} finish={f.id} size={46} eyes={false} face="faceless" mark={draft.mark} animate={f.id === 'glow'} wear={wear} shadow={false} />
                    </View>
                    <Txt variant="tiny" center>
                      {f.label}
                    </Txt>
                    {lock.locked && <Badge text="Plus" color={p.card2} textColor={p.text} />}
                  </View>
                </PressScale>
              );
            })}
          </Row>

          <Label>Face</Label>
          <Row gap={8} wrap>
            {RESTING_MOODS.map((m) => {
              const on = m.id === 'faceless' ? draft.face === 'faceless' : draft.face !== 'faceless' && draft.mood === m.id;
              return (
                <Chip
                  key={m.id}
                  label={m.label}
                  selected={on}
                  onPress={() => {
                    haptic('select');
                    setDraft((d) => (m.id === 'faceless' ? { ...d, face: 'faceless' } : { ...d, face: 'eyes', mood: m.id as Mood }));
                  }}
                />
              );
            })}
          </Row>
          <Txt variant="small" style={{ marginTop: 8, marginHorizontal: 4 }}>
            This is their resting face. While they work, wait on you or finish something, their face changes on its own.
          </Txt>

          {draft.face === 'faceless' && (
            <>
              <Label>Mark</Label>
              <Row gap={8} wrap>
                {MARKS.map((m) => (
                  <PressScale key={m} onPress={() => set('mark', m)} accessibilityLabel={`${m} mark`} accessibilityRole="radio">
                    <View style={{ padding: 4, borderRadius: 14, borderWidth: 2, borderColor: draft.mark === m ? p.text : 'transparent' }}>
                      <Pebble shape={draft.shape} color={draft.color} face="faceless" mark={m} size={40} animate={false} eyes={false} shadow={false} />
                    </View>
                  </PressScale>
                ))}
              </Row>
            </>
          )}

          <Label>Motion</Label>
          <Row gap={8} wrap>
            {MOTIONS.map((m) => (
              <Chip key={m.id} label={m.label} selected={draft.motion === m.id} onPress={() => set('motion', m.id)} />
            ))}
          </Row>
        </Animated.View>
      )}

      {tab === 'extras' && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Label>Things to wear</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {EXTRAS.map((x) => {
              const lock = lockFor(x, tier, days);
              const on = draft.extras.includes(x.id);
              return (
                <PressScale
                  key={x.id}
                  onPress={() => {
                    if (lock.locked) {
                      if (lock.reason === 'plus') router.push('/plus');
                      else toast(`${x.label} unlocks after ${x.days} days together. ${lock.daysLeft} to go.`, undefined, draft.color);
                      return;
                    }
                    setDraft((d) => ({ ...d, extras: toggleExtra(d.extras, x.id) }));
                    haptic('select');
                  }}
                  accessibilityLabel={x.label}
                  accessibilityRole="checkbox"
                >
                  <View
                    style={{
                      width: 104,
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderRadius: 18,
                      borderWidth: 2,
                      borderColor: on ? p.text : p.line,
                      backgroundColor: p.card,
                      opacity: lock.locked ? 0.62 : 1,
                    }}
                  >
                    <Pebble
                      shape={draft.shape}
                      color={draft.color}
                      face={draft.face}
                      restingMood={draft.mood}
                      finish={draft.finish}
                      extras={[x.id]}
                      size={50}
                      animate={false}
                      shadow={false}
                      wear={wear}
                    />
                    <Txt variant="tiny" center style={{ marginTop: 8, fontFamily: fonts.bodySemi, color: p.text }}>
                      {x.label}
                    </Txt>
                    {lock.locked ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                        <Ionicons name={lock.reason === 'plus' ? 'star' : 'time-outline'} size={11} color={p.muted} />
                        <Txt variant="tiny">{lock.reason === 'plus' ? 'Plus' : `${x.days} days`}</Txt>
                      </View>
                    ) : on ? (
                      <Ionicons name="checkmark-circle" size={14} color={p.signal} style={{ marginTop: 3 }} />
                    ) : null}
                  </View>
                </PressScale>
              );
            })}
          </View>
          <Txt variant="small" style={{ marginTop: 10, marginHorizontal: 4 }}>
            One thing per spot: a new hat swaps out the old one.
          </Txt>

          <Label>Time together</Label>
          <Card carve={1} padding={14}>
            <Row gap={12}>
              <Ionicons name="hourglass-outline" size={20} color={p.text} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{draft.polished ? 'Kept polished' : wearLabel(wear)}</Txt>
                <Txt variant="small">
                  {editing ? `${days} day${days === 1 ? '' : 's'} together. ` : ''}Stones wear smooth with time, and a little moss grows after a few months. Some extras unlock along the way.
                </Txt>
              </View>
            </Row>
            <Row justify="space-between" style={{ marginTop: 12 }}>
              <Txt variant="smallStrong">Keep them polished</Txt>
              <Toggle value={draft.polished} onChange={(v) => setDraft((d) => ({ ...d, polished: v }))} label="Keep them polished" />
            </Row>
          </Card>
        </Animated.View>
      )}

    </Screen>
  );
}
