import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PLAN_LIMITS } from '@/lib/catalog';
import { errandKind, SPEND_LIMIT_DEFAULT, stepsFor } from '@/lib/errands';
import { isoDate } from '@/lib/dates';
import { useFamily } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Btn, Card, Chip, Field, Label, PressScale, Row, Screen, Txt } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

const IDEAS = ['Two tickets for the 7:40 movie tonight under $40', 'Flight home Nov 25, nonstop, under $200', 'A ride to the airport at 6 AM tomorrow'];

export default function NewErrand() {
  const p = useTheme();
  const params = useLocalSearchParams<{ request?: string; member?: string }>();
  const members = useFamily((s) => s.members);
  const headId = useFamily((s) => s.headId);
  const tier = useFamily((s) => s.settings.tier);
  const usage = useFamily((s) => s.usage);
  const errands = useFamily((s) => s.errands);
  const addErrand = useFamily((s) => s.addErrand);
  const bumpUsage = useFamily((s) => s.bumpUsage);
  const [request, setRequest] = useState(params.request ?? '');
  const [memberId, setMemberId] = useState(params.member ?? headId);
  const [level, setLevel] = useState<'look' | 'prepare'>('prepare');

  const limit = PLAN_LIMITS[tier].errands;
  const used = usage.day === isoDate() ? usage.errands : 0;
  const locked = limit === 0;

  const start = () => {
    if (!request.trim()) return;
    const gate = bumpUsage('errands');
    if (!gate.ok) return router.push('/plus');
    const kind = errandKind(request);
    const e = addErrand({ memberId, request: request.trim(), kind, level, status: 'working', steps: stepsFor(kind) });
    useFamily.getState().setMemberState(memberId, 'working', 'Running an errand');
    router.replace({ pathname: '/errand/[id]', params: { id: e.id } });
  };

  return (
    <Screen>
      <BackHeader title="New errand" />
      <Txt variant="title" style={{ marginTop: 6 }}>
        What should we take care of?
      </Txt>
      <Txt variant="body" style={{ marginTop: 6 }}>
        Your teammate looks it up and gets it ready. The final tap is always yours.
      </Txt>

      <View style={{ marginTop: 16 }}>
        <Field value={request} onChangeText={setRequest} placeholder="Say it like you'd text a friend" multiline />
      </View>
      <View style={{ gap: 8, marginTop: 10 }}>
        {IDEAS.map((i) => (
          <Chip key={i} label={i} small onPress={() => setRequest(i)} />
        ))}
      </View>

      <Label>Who handles it</Label>
      <Row gap={10} wrap>
        {members.map((m) => (
          <PressScale key={m.id} onPress={() => setMemberId(m.id)} accessibilityLabel={m.name} accessibilityRole="radio">
            <View style={{ alignItems: 'center', padding: 8, borderRadius: 18, borderWidth: 2, borderColor: memberId === m.id ? p.text : 'transparent', width: 78 }}>
              <MemberPebble member={m} size={40} animate={memberId === m.id} />
              <Txt variant="tiny" style={{ marginTop: 4 }} numberOfLines={1}>
                {m.name}
              </Txt>
            </View>
          </PressScale>
        ))}
      </Row>

      <Label>How far can they go?</Label>
      {(
        [
          ['look', 'Look', 'Find options and show you. Nothing gets held or bought.', 'search-outline'],
          ['prepare', 'Prepare', 'Fill the cart, check it against your request, then wait for Face ID.', 'finger-print-outline'],
        ] as const
      ).map(([id, title, sub, icon], i) => (
        <PressScale key={id} onPress={() => setLevel(id)} accessibilityRole="radio" accessibilityLabel={title}>
          <View style={[carved[i], { marginBottom: 8, padding: 14, backgroundColor: p.card, borderWidth: 2, borderColor: level === id ? p.text : 'transparent', boxShadow: level === id ? undefined : `0px 2px 0px ${p.shadow}` }]}>
            <Row gap={12}>
              <Ionicons name={icon} size={22} color={p.text} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{title}</Txt>
                <Txt variant="small">{sub}</Txt>
              </View>
              {level === id && <Ionicons name="checkmark-circle" size={22} color={p.signal} />}
            </Row>
          </View>
        </PressScale>
      ))}
      <Card tone="soft" carve={2} padding={12} style={{ marginTop: 4, opacity: 0.85 }}>
        <Row gap={10}>
          <Ionicons name="lock-closed-outline" size={16} color={p.muted} />
          <Txt variant="small" style={{ flex: 1 }}>
            Auto (no final tap) comes later, only for things you've done before, under a limit you set.
          </Txt>
        </Row>
      </Card>

      <Animated.View entering={FadeInDown.delay(150)}>
        <Card carve={3} style={{ marginTop: 16 }}>
          <Txt variant="label">Safety rails</Txt>
          {[
            `Spending limit: $${SPEND_LIMIT_DEFAULT} per errand`,
            'The cart is checked against your words by plain code, not AI',
            'Payment is never retried on its own',
            'Every booking gets a receipt and an undo window',
          ].map((t) => (
            <Row key={t} gap={8} style={{ marginTop: 8 }}>
              <Ionicons name="checkmark" size={16} color={p.success} />
              <Txt variant="small" color={p.text2} style={{ flex: 1 }}>
                {t}
              </Txt>
            </Row>
          ))}
        </Card>
      </Animated.View>

      <View style={{ marginTop: 18 }}>
        {locked ? (
          <>
            <Txt variant="small" center style={{ marginBottom: 8 }}>
              Errands come with Plus (5 a day) and Pro (30 a day).
            </Txt>
            <Btn title="See Plus" variant="signal" full onPress={() => router.push('/plus')} />
          </>
        ) : (
          <>
            <Btn title="Send them off" variant="signal" full icon="paper-plane-outline" disabled={!request.trim()} onPress={start} />
            <Txt variant="tiny" center style={{ marginTop: 8 }}>
              {used} of {limit} errands today
            </Txt>
          </>
        )}
      </View>

      {errands.length > 0 && (
        <>
          <Label>Recent errands</Label>
          {errands.slice(0, 5).map((e) => (
            <PressScale key={e.id} onPress={() => router.replace({ pathname: '/errand/[id]', params: { id: e.id } })} accessibilityLabel={e.request}>
              <Row gap={10} style={{ paddingVertical: 10 }}>
                <Ionicons name={e.status === 'booked' ? 'checkmark-circle' : e.status === 'declined' ? 'close-circle-outline' : 'time-outline'} size={18} color={e.status === 'booked' ? p.success : p.muted} />
                <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {e.request}
                </Txt>
                <Txt variant="tiny">{e.status}</Txt>
              </Row>
            </PressScale>
          ))}
        </>
      )}
    </Screen>
  );
}
