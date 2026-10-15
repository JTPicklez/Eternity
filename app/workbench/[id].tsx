import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { memberOrTemplate, useFamily } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { LiveScreen, SCRIPTS } from '@/components/LiveScreen';
import { BackHeader, Btn, Card, haptic, Label, LiveDot, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

export default function WorkbenchLive() {
  const p = useTheme();
  const { id } = useLocalSearchParams<{ id: string; errand?: string }>();
  const members = useFamily((s) => s.members);
  const setMemberState = useFamily((s) => s.setMemberState);
  const m = memberOrTemplate(id ?? 'aibram', members);
  const script = SCRIPTS[m.kind] ?? SCRIPTS.default;
  const [driving, setDriving] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [elapsed] = useState(() => Date.now());

  return (
    <Screen>
      <BackHeader kicker="Workbench" title={`${m.name}'s computer`} right={!stopped ? <LiveDot /> : undefined} />

      <Row gap={10} style={{ marginTop: 6 }}>
        <MemberPebble member={m} size={40} state={stopped ? 'idle' : driving ? 'waiting' : 'working'} />
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{stopped ? 'Stopped' : driving ? 'You have the wheel' : m.status || 'Working'}</Txt>
          <Txt variant="tiny">Sandboxed cloud browser · started {Math.max(1, Math.round((Date.now() - elapsed) / 60000))} min ago</Txt>
        </View>
      </Row>

      <View style={{ marginTop: 14 }}>
        {stopped ? (
          <Card tone="soft" carve={1} style={{ height: 260, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="stop-circle-outline" size={40} color={p.muted} />
            <Txt variant="h3" style={{ marginTop: 8 }}>
              Session ended
            </Txt>
            <Txt variant="small" center>
              The computer was wiped. Nothing was submitted.
            </Txt>
          </Card>
        ) : (
          <LiveScreen script={script} color={m.color} driving={driving} onStep={(i) => setLog((l) => (l.includes(script[i].log) ? l : [...l, script[i].log]))} />
        )}
      </View>

      {!stopped && (
        <Row gap={8} style={{ marginTop: 12 }}>
          <Btn
            title={driving ? `Hand it back to ${m.name}` : 'Take the wheel'}
            variant={driving ? 'signal' : 'ink'}
            icon={driving ? 'return-up-back-outline' : 'hand-left-outline'}
            onPress={() => {
              haptic('medium');
              setDriving((d) => !d);
              toast(driving ? `${m.name} picked up where you left off.` : `${m.name} paused. You're driving.`, undefined, m.color);
            }}
          />
          <Btn
            title="Stop"
            variant="danger"
            icon="stop-circle-outline"
            onPress={() => {
              setStopped(true);
              setMemberState(m.id, 'idle', 'Stopped by you');
              haptic('warning');
            }}
          />
        </Row>
      )}

      <Btn title="Simulate a sign-in wall" small variant="quiet" icon="key-outline" style={{ marginTop: 10 }} onPress={() => router.push({ pathname: '/handoff', params: { id: m.id } })} />

      <Label>What {m.name} did</Label>
      <Card carve={2} padding={12}>
        {log.length === 0 ? (
          <Txt variant="small">Starting up…</Txt>
        ) : (
          log.map((l, i) => (
            <Animated.View key={l} entering={FadeInUp}>
              <Row gap={10} style={{ paddingVertical: 6 }} align="flex-start">
                <Txt variant="mono" style={{ width: 22 }}>
                  {String(i + 1).padStart(2, '0')}
                </Txt>
                <Txt variant="body" style={{ flex: 1 }}>
                  {l}
                </Txt>
              </Row>
            </Animated.View>
          ))
        )}
      </Card>

      <Animated.View entering={FadeInDown.delay(300)}>
        <Card tone="soft" carve={3} style={{ marginTop: 14 }} padding={14}>
          <Row gap={10} align="flex-start">
            <Ionicons name="shield-checkmark-outline" size={18} color={p.text} />
            <Txt variant="small" color={p.text2} style={{ flex: 1 }}>
              Pages on the Workbench go through the Guard. Payments stop at a preview, and every session is recorded as a replay you can watch later.
            </Txt>
          </Row>
        </Card>
      </Animated.View>
      <Txt variant="tiny" center style={{ marginTop: 14 }}>
        Preview build: this session is a scripted demo of the live view.
      </Txt>
    </Screen>
  );
}
