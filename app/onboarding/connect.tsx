import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { CONNECTORS, PACKS } from '@/lib/catalog';
import { useCrew } from '@/lib/store';
import { askForLocation } from '@/lib/live';
import { Badge, Btn, Card, haptic, Mono, PressScale, Row, Screen, Txt } from '@/components/ui';
import { Steps } from '@/components/Steps';
import { useTheme } from '@/theme/ThemeProvider';

export default function ConnectStep() {
  const p = useTheme();
  const packs = useCrew((s) => s.charter.packs);
  const connected = useCrew((s) => s.connected);
  const toggle = useCrew((s) => s.toggleConnector);
  const tier = useCrew((s) => s.settings.tier);
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(() => {
    const wanted = new Set<string>(['calendar', 'gmail', 'maps', 'weather']);
    PACKS.filter((x) => packs.includes(x.id)).forEach((x) => x.connectors.forEach((c) => wanted.add(c)));
    return CONNECTORS.filter((c) => wanted.has(c.id) && !c.unavailable);
  }, [packs]);

  const connect = (id: string) => {
    if (connected.includes(id)) {
      toggle(id);
      return;
    }
    setBusy(id);
    if (id === 'maps') askForLocation();
    setTimeout(() => {
      toggle(id);
      setBusy(null);
      haptic('success');
    }, 900);
  };

  return (
    <Screen
      footer={
        <View style={{ paddingHorizontal: 16, paddingBottom: 18, paddingTop: 8 }}>
          <Btn title="Meet your Crew" variant="signal" full iconRight="arrow-forward" onPress={() => router.push('/onboarding/meet')} />
        </View>
      }
    >
      <Steps step={3} />
      <Txt variant="title" style={{ marginTop: 12 }}>
        Give them the keys you choose.
      </Txt>
      <Txt variant="body" style={{ marginTop: 8 }}>
        Each connection says exactly what your Crew can read and do. Sending, spending, merging and deleting always come back to you.
      </Txt>

      <Card tone="soft" carve={1} style={{ marginTop: 16 }} padding={14}>
        <Row gap={10} align="flex-start">
          <Ionicons name="flask-outline" size={18} color={p.text} />
          <Txt variant="small" style={{ flex: 1 }} color={p.text2}>
            Turning one on here starts it with sample data. To use your real accounts, open Me, Connections later and sign in to each one.
          </Txt>
        </Row>
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        {list.map((c, i) => {
          const on = connected.includes(c.id);
          const locked = c.plusOnly && tier === 'free';
          return (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 40)}>
              <Card carve={i} padding={14}>
                <Row gap={12}>
                  <Mono text={c.mono} on={on} />
                  <View style={{ flex: 1 }}>
                    <Row gap={8}>
                      <Txt variant="bodyStrong">{c.name}</Txt>
                      {c.plusOnly && <Badge text="Plus" color={p.card2} textColor={p.text} />}
                    </Row>
                    <Txt variant="small">{c.blurb}</Txt>
                  </View>
                  {busy === c.id ? (
                    <ActivityIndicator color={p.signal} />
                  ) : on ? (
                    <PressScale onPress={() => connect(c.id)} accessibilityLabel={`Disconnect ${c.name}`}>
                      <Animated.View entering={ZoomIn}>
                        <Ionicons name="checkmark-circle" size={30} color={p.success} />
                      </Animated.View>
                    </PressScale>
                  ) : (
                    <Btn
                      title={locked ? 'Plus' : 'Connect'}
                      small
                      variant={locked ? 'ghost' : 'ink'}
                      onPress={() => (locked ? router.push('/plus') : connect(c.id))}
                    />
                  )}
                </Row>
              </Card>
            </Animated.View>
          );
        })}
      </View>
      <Txt variant="tiny" center style={{ marginTop: 16 }}>
        Strava doesn't allow its data in AI apps, so it isn't here. Garmin is coming.
      </Txt>
    </Screen>
  );
}
