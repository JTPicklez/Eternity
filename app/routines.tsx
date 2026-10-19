import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PLAN_LIMITS } from '@/lib/catalog';
import { memberOrTemplate, useCrew } from '@/lib/store';
import { MemberPebble, Pebble } from '@/components/Pebble';
import { BackHeader, Btn, Chip, Empty, Field, haptic, IconBtn, Label, PressScale, Row, Screen, Sheet, Toggle, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

const WHENS = [
  'Every morning at 7:30 AM',
  'Every Sunday at 6:00 PM',
  'A syllabus PDF lands in Gmail',
  'A build fails on main',
  'Recovery drops under 40%',
  'Flow starts',
  'Two days before an exam',
  'A new episode is uploaded',
];

export default function Routines() {
  const p = useTheme();
  const params = useLocalSearchParams<{ member?: string }>();
  const routines = useCrew((s) => s.routines);
  const members = useCrew((s) => s.members);
  const leadId = useCrew((s) => s.leadId);
  const tier = useCrew((s) => s.settings.tier);
  const addRoutine = useCrew((s) => s.addRoutine);
  const updateRoutine = useCrew((s) => s.updateRoutine);
  const removeRoutine = useCrew((s) => s.removeRoutine);
  const [open, setOpen] = useState(!!params.member);
  const [when, setWhen] = useState(WHENS[0]);
  const [then, setThen] = useState('');
  const [who, setWho] = useState(params.member ?? leadId);

  const limit = PLAN_LIMITS[tier].routines;
  const active = routines.filter((r) => r.on).length;

  const toggle = (id: string, on: boolean) => {
    if (on && active >= limit) {
      toast(`Free plans run ${limit} routines at once.`, { label: 'See Plus', onPress: () => router.push('/plus') });
      return;
    }
    updateRoutine(id, { on });
  };

  return (
    <Screen>
      <BackHeader kicker={`${active} running${tier === 'free' ? ` · ${limit} on Free` : ''}`} title="Routines" right={<IconBtn icon="add" label="New routine" tone="ink" onPress={() => setOpen(true)} />} />
      <Txt variant="body" style={{ marginTop: 4 }}>
        When this happens, a teammate does that. Every run leaves a receipt.
      </Txt>
      <View style={{ marginTop: 14, gap: 10 }}>
        {routines.length === 0 ? (
          <Empty title="No routines yet" body="Automate the boring parts. Your Crew runs them in the background." action={<Btn title="New routine" small onPress={() => setOpen(true)} />} />
        ) : (
          routines.map((r, i) => {
            const m = memberOrTemplate(r.memberId, members);
            return (
              <Animated.View key={r.id} entering={FadeInDown.delay(i * 40)}>
                <PressScale onLongPress={() => { removeRoutine(r.id); toast(`Deleted "${r.name}".`, { label: 'Undo', onPress: () => addRoutine({ ...r }) }); }} accessibilityLabel={r.name}>
                  <View style={[carved[i % 4], { padding: 14, backgroundColor: p.card, opacity: r.on ? 1 : 0.65, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                    <Row gap={12} align="flex-start">
                      <MemberPebble member={m} size={36} state={r.on ? 'working' : 'idle'} animate={r.on} />
                      <View style={{ flex: 1 }}>
                        <Txt variant="h3">{r.name}</Txt>
                        <Txt variant="small" style={{ marginTop: 4 }}>
                          <Txt variant="smallStrong">When</Txt> {r.when.charAt(0).toLowerCase() + r.when.slice(1)}, <Txt variant="smallStrong">{m.name}</Txt> will {r.then}.
                        </Txt>
                      </View>
                      <Toggle value={r.on} onChange={(v) => toggle(r.id, v)} label={r.name} />
                    </Row>
                  </View>
                </PressScale>
              </Animated.View>
            );
          })
        )}
      </View>
      {routines.length > 0 && (
        <Txt variant="tiny" center style={{ marginTop: 12 }}>
          Hold a routine to delete it.
        </Txt>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title="New routine">
        <Label style={{ marginTop: 0 }}>When</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WHENS.map((w) => (
            <Chip key={w} label={w} small selected={when === w} onPress={() => setWhen(w)} />
          ))}
        </View>
        <Label>Who</Label>
        <Row gap={10} wrap>
          {members.map((m) => (
            <PressScale key={m.id} onPress={() => setWho(m.id)} accessibilityLabel={m.name}>
              <View style={{ alignItems: 'center', padding: 6, borderRadius: 16, borderWidth: 2, borderColor: who === m.id ? p.text : 'transparent', width: 70 }}>
                <MemberPebble member={m} size={34} animate={false} />
                <Txt variant="tiny" numberOfLines={1}>
                  {m.name}
                </Txt>
              </View>
            </PressScale>
          ))}
        </Row>
        <Label>Does what</Label>
        <Field placeholder="e.g. plan my week and send one summary" value={then} onChangeText={setThen} multiline />
        <Row gap={6} style={{ marginTop: 10 }}>
          <Ionicons name="lock-closed-outline" size={13} color={p.muted} />
          <Txt variant="tiny" style={{ flex: 1 }}>
            Routines still follow the always-ask rules: no sending, spending, merging or deleting without you.
          </Txt>
        </Row>
        <Btn
          title="Create routine"
          variant="signal"
          full
          style={{ marginTop: 14 }}
          disabled={!then.trim()}
          onPress={() => {
            const on = active < limit;
            addRoutine({ name: then.trim().split(' ').slice(0, 4).join(' ').replace(/^\w/, (c) => c.toUpperCase()), when, then: then.trim(), memberId: who, on });
            setThen('');
            setOpen(false);
            haptic('success');
            toast(on ? 'Routine is on.' : `Saved but paused. Free runs ${limit} at a time.`);
          }}
        />
      </Sheet>
    </Screen>
  );
}
