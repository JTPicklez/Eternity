import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PLAN_LIMITS } from '@/lib/catalog';
import { useFamily } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { LiveScreen, SCRIPTS } from '@/components/LiveScreen';
import { BackHeader, Badge, Btn, Card, LiveDot, ProgressBar, Row, Screen, Txt } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export default function Workbench() {
  const p = useTheme();
  const members = useFamily((s) => s.members);
  const tier = useFamily((s) => s.settings.tier);
  const hours = PLAN_LIMITS[tier].workbenchHours;
  const working = members.filter((m) => m.state === 'working');

  return (
    <Screen>
      <BackHeader kicker="Each teammate's own computer" title="Workbench" />
      <Txt variant="body" style={{ marginTop: 6 }}>
        When a job needs a real browser, a teammate opens their own sandboxed computer in the cloud. Watch live, take the wheel anytime, or stop everything with one tap.
      </Txt>

      <Card carve={1} style={{ marginTop: 14 }}>
        <Row justify="space-between">
          <Txt variant="bodyStrong">Workbench hours</Txt>
          {hours ? <Txt variant="mono">2.4 of {hours} h this month</Txt> : <Badge text="Pro" color={p.card2} textColor={p.text} />}
        </Row>
        {hours ? (
          <View style={{ marginTop: 10 }}>
            <ProgressBar value={2.4 / hours} />
          </View>
        ) : (
          <>
            <Txt variant="small" style={{ marginTop: 6 }}>
              Live Workbench sessions come with Pro. You can watch a demo session now.
            </Txt>
            <Btn title="See Pro" small variant="ghost" style={{ marginTop: 10 }} onPress={() => router.push('/plus')} />
          </>
        )}
      </Card>

      {working.length > 0 && (
        <Btn
          title="Stop all work"
          variant="danger"
          icon="stop-circle-outline"
          full
          style={{ marginTop: 14 }}
          onPress={() => {
            working.forEach((m) => useFamily.getState().setMemberState(m.id, 'idle', 'Stopped by you'));
            useFamily.getState().errands.filter((e) => e.status === 'working').forEach((e) => useFamily.getState().updateErrand(e.id, { status: 'declined' }));
          }}
        />
      )}

      <View style={{ marginTop: 16, gap: 14 }}>
        {members.map((m, i) => {
          const script = SCRIPTS[m.kind] ?? SCRIPTS.default;
          const live = m.state === 'working';
          return (
            <Animated.View key={m.id} entering={FadeInDown.delay(i * 70)}>
              <Card carve={i} onPress={() => router.push({ pathname: '/workbench/[id]', params: { id: m.id } })} accessibilityLabel={`${m.name}'s Workbench`}>
                <Row gap={10}>
                  <MemberPebble member={m} size={38} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3">{m.name}'s computer</Txt>
                    <Txt variant="tiny">{live ? m.status : 'Idle. Asleep until there is a job.'}</Txt>
                  </View>
                  {live ? <LiveDot /> : <Ionicons name="moon-outline" size={16} color={p.muted} />}
                </Row>
                <View style={{ marginTop: 12 }}>
                  <LiveScreen script={script} color={m.color} height={150} idle={!live} />
                </View>
              </Card>
            </Animated.View>
          );
        })}
      </View>
      <Txt variant="tiny" center style={{ marginTop: 16 }}>
        Workbench computers never see your passwords. When a site needs you, you get a "Your turn" prompt.
      </Txt>
    </Screen>
  );
}
