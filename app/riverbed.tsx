/**
 * The Riverbed: where teammates are shaped. Pick a starting point, then
 * shape, color, face, mark, finish and motion. Changes show live.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { BounceIn, FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { COLORS, FINISHES, MARKS, MOTIONS, PLAN_LIMITS, SHAPES, TEMPLATES, templateFor } from '@/lib/catalog';
import { useFamily } from '@/lib/store';
import type { Face, Finish, Mark, Motion, Shape } from '@/lib/types';
import { Pebble } from '@/components/Pebble';
import { BackHeader, Badge, Btn, Card, Chip, Field, haptic, Label, PressScale, Ripples, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

interface Draft {
  kind: string;
  name: string;
  role: string;
  blurb: string;
  shape: Shape;
  color: string;
  face: Face;
  mark: Mark;
  finish: Finish;
  motion: Motion;
}

function fromTemplate(kind: string): Draft {
  if (kind === 'custom') {
    return { kind: 'custom', name: '', role: '', blurb: '', shape: 'round', color: COLORS[5].color, face: 'eyes', mark: 'spark', finish: 'matte', motion: 'calm' };
  }
  const t = templateFor(kind);
  return { kind: t.kind, name: t.defaultName, role: t.role, blurb: t.blurb, shape: t.shape, color: t.color, face: 'eyes', mark: t.mark, finish: 'matte', motion: t.motion };
}

export default function Riverbed() {
  const p = useTheme();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const members = useFamily((s) => s.members);
  const tier = useFamily((s) => s.settings.tier);
  const addMember = useFamily((s) => s.addMember);
  const updateMember = useFamily((s) => s.updateMember);
  const renameMember = useFamily((s) => s.renameMember);
  const editing = params.id ? members.find((m) => m.id === params.id) : undefined;

  const [draft, setDraft] = useState<Draft>(() =>
    editing
      ? { kind: editing.kind, name: editing.name, role: editing.role, blurb: editing.blurb, shape: editing.shape, color: editing.color, face: editing.face, mark: editing.mark, finish: editing.finish, motion: editing.motion }
      : fromTemplate(params.kind ?? (members.some((m) => m.kind === 'sage') ? 'bolt' : 'sage')),
  );
  const [error, setError] = useState('');
  const [born, setBorn] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setPulse((x) => x + 1);
    haptic('select');
  };

  const limit = PLAN_LIMITS[tier].seats;
  const full = !editing && members.length >= limit;
  const paid = tier !== 'free';
  const templates = useMemo(() => TEMPLATES.filter((t) => t.kind !== 'aibram'), []);

  const create = () => {
    setError('');
    const name = draft.name.trim();
    if (!name) return setError('Give them a name.');
    if (draft.kind === 'custom' && !draft.role.trim()) return setError('Tell them what they do.');
    if (editing) {
      if (name !== editing.name) {
        const r = renameMember(editing.id, name);
        if (!r.ok) return setError(r.reason ?? '');
      }
      updateMember(editing.id, { shape: draft.shape, color: draft.color, face: draft.face, mark: draft.mark, finish: draft.finish, motion: draft.motion, role: draft.role || editing.role, blurb: draft.blurb || editing.blurb });
      haptic('success');
      toast(`${name} looks great.`, undefined, draft.color);
      router.back();
      return;
    }
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return setError(`Someone in your family is already called ${name}.`);
    const r = addMember(draft.kind, {
      kind: draft.kind,
      name,
      role: draft.role.trim() || templateFor(draft.kind).role,
      blurb: draft.blurb.trim() || templateFor(draft.kind).blurb,
      shape: draft.shape,
      color: draft.color,
      face: draft.face,
      mark: draft.mark,
      finish: draft.finish,
      motion: draft.motion,
      ...(draft.kind === 'custom' ? { connectors: [], triggers: [] } : {}),
    });
    if (!r.ok || !r.member) return setError(r.reason === 'free-limit' ? 'Free families have 3 seats. Plus opens all 10.' : 'The loop is full.');
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
            <Pebble shape={draft.shape} color={draft.color} face={draft.face} mark={draft.mark} finish={draft.finish} motion={draft.motion} size={170} state="done" />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(600)} style={{ alignItems: 'center' }}>
            <Txt variant="title" center style={{ marginTop: 24 }}>
              {m?.name ?? draft.name} took a seat.
            </Txt>
            <Txt variant="body" center style={{ marginTop: 8, maxWidth: 300 }}>
              They know your Charter already. Say hi, or give them something to do.
            </Txt>
            <Row gap={8} style={{ marginTop: 22 }}>
              <Btn title={`Say hi to ${m?.name ?? draft.name}`} variant="signal" onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: born, q: 'Hi! What can you do for me?' } })} />
              <Btn title="Back to Family" variant="ghost" onPress={() => router.replace('/family')} />
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
            <Btn title={editing ? 'Save changes' : 'Bring them to life'} variant="signal" full icon={editing ? 'checkmark' : 'water'} onPress={create} />
          )}
        </View>
      }
    >
      <BackHeader title={editing ? `Reshape ${editing.name}` : 'The Riverbed'} kicker={editing ? undefined : 'Shape a teammate'} />

      <View style={{ alignItems: 'center', height: 220, justifyContent: 'center', marginTop: 4 }}>
        <Ripples size={340} corner="topLeft" />
        <Animated.View key={pulse} entering={ZoomIn.springify().damping(9)}>
          <Pebble shape={draft.shape} color={draft.color} face={draft.face} mark={draft.mark} finish={draft.finish} motion={draft.motion} size={160} onPress={() => haptic('light')} />
        </Animated.View>
      </View>
      <Txt variant="h2" center>
        {draft.name || 'Unnamed'}
      </Txt>
      <Txt variant="small" center>
        {draft.role || 'What do they do?'}
      </Txt>

      {!editing && (
        <>
          <Label>Start from</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {templates.map((t) => (
              <Chip key={t.kind} label={t.defaultName} selected={draft.kind === t.kind} onPress={() => setDraft(fromTemplate(t.kind))} />
            ))}
            <Chip label="From scratch" icon="sparkles-outline" selected={draft.kind === 'custom'} onPress={() => setDraft(fromTemplate('custom'))} />
          </ScrollView>
        </>
      )}

      <Label>Name</Label>
      <Field value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="What should they be called?" maxLength={18} />
      {(draft.kind === 'custom' || editing) && (
        <View style={{ gap: 10, marginTop: 10 }}>
          <Field value={draft.role} onChangeText={(v) => setDraft((d) => ({ ...d, role: v }))} placeholder="Their job, like 'Internship hunter'" maxLength={40} />
          <Field
            value={draft.blurb}
            onChangeText={(v) => setDraft((d) => ({ ...d, blurb: v }))}
            placeholder="How they work. 'Finds 5 internships a week, drafts the cover letters, keeps me on deadlines.'"
            multiline
            maxLength={240}
          />
        </View>
      )}

      <Label>Shape</Label>
      <Row gap={8} justify="space-between">
        {SHAPES.map((s) => (
          <PressScale key={s} onPress={() => set('shape', s)} accessibilityLabel={`${s} shape`} accessibilityRole="radio">
            <View style={{ padding: 6, borderRadius: 16, borderWidth: 2, borderColor: draft.shape === s ? p.text : 'transparent' }}>
              <Pebble shape={s} color={draft.color} face={draft.face} mark={draft.mark} size={48} animate={false} />
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

      <Label>Face</Label>
      <Row gap={8}>
        <Chip label="Eyes" selected={draft.face === 'eyes'} onPress={() => set('face', 'eyes')} />
        <Chip label="Sleepy" selected={draft.face === 'sleepy'} onPress={() => set('face', 'sleepy')} />
        <Chip label="Faceless" selected={draft.face === 'faceless'} onPress={() => set('face', 'faceless')} />
      </Row>

      <Label>Mark</Label>
      <Txt variant="small" style={{ marginTop: -6, marginBottom: 10, marginHorizontal: 4 }}>
        Shows when eyes are off or the face is faceless.
      </Txt>
      <Row gap={8} wrap>
        {MARKS.map((m) => (
          <PressScale key={m} onPress={() => set('mark', m)} accessibilityLabel={`${m} mark`} accessibilityRole="radio">
            <View style={{ padding: 4, borderRadius: 14, borderWidth: 2, borderColor: draft.mark === m ? p.text : 'transparent' }}>
              <Pebble shape={draft.shape} color={draft.color} face="faceless" mark={m} size={40} animate={false} eyes={false} />
            </View>
          </PressScale>
        ))}
      </Row>

      <Label>Finish</Label>
      <Row gap={8} wrap>
        {FINISHES.map((f) => {
          const locked = f.plus && !paid;
          return (
            <PressScale key={f.id} onPress={() => (locked ? router.push('/plus') : set('finish', f.id))} accessibilityLabel={f.label}>
              <View style={{ alignItems: 'center', width: 70, gap: 4, opacity: locked ? 0.6 : 1 }}>
                <View style={{ padding: 4, borderRadius: 16, borderWidth: 2, borderColor: draft.finish === f.id ? p.text : 'transparent' }}>
                  <Pebble shape="round" color={draft.color} finish={f.id} size={44} eyes={false} face="faceless" mark={draft.mark} animate={f.id === 'glow'} />
                </View>
                <Txt variant="tiny" center>
                  {f.label}
                </Txt>
                {locked && <Badge text="Plus" color={p.card2} textColor={p.text} />}
              </View>
            </PressScale>
          );
        })}
      </Row>

      <Label>Motion</Label>
      <Row gap={8} wrap>
        {MOTIONS.map((m) => (
          <Chip key={m.id} label={m.label} selected={draft.motion === m.id} onPress={() => set('motion', m.id)} />
        ))}
      </Row>

      <Animated.View entering={FadeIn.delay(200)}>
        <Card tone="soft" carve={2} style={{ marginTop: 22 }} padding={14}>
          <Row gap={10} align="flex-start">
            <Ionicons name="information-circle-outline" size={18} color={p.text} />
            <Txt variant="small" color={p.text2} style={{ flex: 1 }}>
              No mouths, no limbs, no accessories. Just a living stone with a job. Everyone reads your Charter and follows the same always-ask rules.
            </Txt>
          </Row>
        </Card>
      </Animated.View>
    </Screen>
  );
}
