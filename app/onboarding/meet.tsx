import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { BounceIn, FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { PACKS, PLAN_LIMITS, templateFor } from '@/lib/catalog';
import { useCrew, useLead } from '@/lib/store';
import { MemberPebble, Pebble } from '@/components/Pebble';
import { CrewLoop } from '@/components/CrewLoop';
import { Typewriter } from '@/components/Typewriter';
import { Btn, Card, Field, haptic, Row, Screen, Toggle, Txt } from '@/components/ui';
import { Steps } from '@/components/Steps';
import { useTheme } from '@/theme/ThemeProvider';

export default function Meet() {
  const p = useTheme();
  const lead = useLead();
  const packs = useCrew((s) => s.charter.packs);
  const members = useCrew((s) => s.members);
  const leadId = useCrew((s) => s.leadId);
  const tier = useCrew((s) => s.settings.tier);
  const addMember = useCrew((s) => s.addMember);
  const renameMember = useCrew((s) => s.renameMember);
  const finishOnboarding = useCrew((s) => s.finishOnboarding);
  const clearSample = useCrew((s) => s.clearSample);

  const queue = useMemo(() => {
    const kinds = PACKS.filter((x) => packs.includes(x.id)).map((x) => x.teammate as string);
    return ['lead', ...[...new Set(kinds)].filter((k) => k !== 'aibram')];
  }, [packs]);

  const [index, setIndex] = useState(0);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [keepSample, setKeepSample] = useState(true);
  const seatLimit = PLAN_LIMITS[tier].seats;

  const current = queue[index];
  const done = index >= queue.length;
  const t = current && current !== 'lead' ? templateFor(current) : null;
  const displayName = current === 'lead' ? lead.name : (t?.defaultName ?? '');
  const full = members.length >= seatLimit;

  const next = () => {
    setNaming(false);
    setName('');
    setError('');
    setReady(false);
    setIndex((i) => i + 1);
  };

  const accept = (customName?: string) => {
    if (current === 'lead') {
      if (customName) {
        const r = renameMember(lead.id, customName);
        if (!r.ok) return setError(r.reason ?? '');
      }
      haptic('success');
      return next();
    }
    if (!t) return next();
    const r = addMember(t.kind, customName ? { name: customName } : {});
    if (!r.ok) {
      if (r.reason === 'free-limit') return setError('Free plans have 3 seats. Plus opens all 10.');
      return setError('The loop is full.');
    }
    haptic('success');
    next();
  };

  const lines =
    current === 'lead'
      ? `I'm ${lead.name}, lead of your Crew. Every teammate has a default name, but you can rename anyone. Want to call me something else?`
      : `I'm ${t?.defaultName}. I could start as your ${t?.role.toLowerCase()}, but my job is yours to write. Change it anytime in Pebble Studio. Want to call me something else?`;

  return (
    <Screen>
      <Steps step={4} />
      {!done ? (
        <View key={current} style={{ marginTop: 18 }}>
          <View style={{ alignItems: 'center', height: 190, justifyContent: 'center' }}>
            <Animated.View entering={BounceIn.duration(900)}>
              {current === 'lead' ? (
                <MemberPebble member={lead} size={150} onPress={() => haptic('light')} />
              ) : t ? (
                <Pebble shape={t.shape} color={t.color} mark={t.mark} motion={t.motion} size={150} onPress={() => haptic('light')} label={t.defaultName} />
              ) : null}
            </Animated.View>
          </View>
          <Txt variant="label" center style={{ marginTop: 8 }}>
            {current === 'lead' ? 'Crew lead' : `Starter idea: ${t?.role}`}
          </Txt>
          <Typewriter text={lines} variant="h2" style={{ marginTop: 10, textAlign: 'center' }} onDone={() => setReady(true)} />

          {ready && (
            <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 22, gap: 10 }}>
              {naming ? (
                <>
                  <Field
                    placeholder={`A name for ${displayName}`}
                    value={name}
                    onChangeText={(v) => {
                      setName(v);
                      setError('');
                    }}
                    autoFocus
                    maxLength={18}
                    returnKeyType="done"
                    onSubmitEditing={() => name.trim() && accept(name.trim())}
                  />
                  <Btn title={name.trim() ? `Call them ${name.trim()}` : 'Type a name'} variant="signal" full disabled={!name.trim()} onPress={() => accept(name.trim())} />
                  <Btn title={`Keep ${displayName}`} variant="ghost" full onPress={() => accept()} />
                </>
              ) : (
                <>
                  <Btn title={`${displayName} is perfect`} variant="signal" full onPress={() => accept()} disabled={current !== 'lead' && full} />
                  <Btn title="Give them a new name" variant="ghost" full icon="create-outline" onPress={() => setNaming(true)} disabled={current !== 'lead' && full} />
                  {current !== 'lead' && <Btn title="Not right now" variant="quiet" small style={{ alignSelf: 'center' }} onPress={next} />}
                </>
              )}
              {error ? (
                <Animated.View entering={FadeIn} exiting={FadeOut}>
                  <Txt variant="small" color={p.danger} center>
                    {error}
                  </Txt>
                  {error.includes('Plus') && <Btn title="See Plus" small variant="ghost" style={{ alignSelf: 'center', marginTop: 8 }} onPress={() => router.push('/plus')} />}
                </Animated.View>
              ) : null}
              {current !== 'lead' && full && !error ? (
                <Txt variant="small" center>
                  Your free seats are full. Plus opens all 10 seats.
                </Txt>
              ) : null}
            </Animated.View>
          )}
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(500)} style={{ marginTop: 18 }}>
          <Txt variant="title" center>
            Your Crew is ready.
          </Txt>
          <Txt variant="body" center style={{ marginTop: 8 }}>
            {members.length === 1 ? `${lead.name} has the center. Add teammates anytime from Crew.` : 'They took their seats around the loop.'}
          </Txt>
          <View style={{ marginTop: 22 }}>
            <CrewLoop members={members} leadId={leadId} seatLimit={seatLimit} />
          </View>
          <Row style={{ marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }} gap={14}>
            {members.map((m) => (
              <View key={m.id} style={{ alignItems: 'center', width: 76 }}>
                <MemberPebble member={m} size={46} />
                <Txt variant="smallStrong" style={{ marginTop: 6 }} numberOfLines={1}>
                  {m.name}
                </Txt>
              </View>
            ))}
          </Row>
          <Card carve={2} style={{ marginTop: 22 }}>
            <Row gap={12}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Start with a sample day</Txt>
                <Txt variant="small">See the Crew working on a real-looking week. Clear it in one tap whenever you want.</Txt>
              </View>
              <Toggle value={keepSample} onChange={setKeepSample} label="Start with a sample day" />
            </Row>
          </Card>
          <View style={{ marginTop: 16 }}>
            <Btn
              title="Open Today"
              variant="signal"
              full
              iconRight="arrow-forward"
              onPress={() => {
                if (!keepSample) clearSample();
                finishOnboarding();
                haptic('success');
                router.replace('/');
              }}
            />
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}
