import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CONNECTORS } from '@/lib/catalog';
import { timeAgo } from '@/lib/dates';
import { memberOrTemplate, useFamily } from '@/lib/store';
import { Pebble } from '@/components/Pebble';
import { BackHeader, Btn, Card, Empty, haptic, Label, Mono, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

const LEVEL = {
  auto: { label: 'Just does it', icon: 'flash-outline' },
  tell: { label: 'Does it and tells you', icon: 'notifications-outline' },
  ask: { label: 'Asks first', icon: 'hand-left-outline' },
  always: { label: 'Always asks. Can’t change.', icon: 'lock-closed-outline' },
} as const;

export default function ConnectorDetail() {
  const p = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = CONNECTORS.find((x) => x.id === id);
  const connected = useFamily((s) => s.connected);
  const members = useFamily((s) => s.members);
  const receipts = useFamily((s) => s.receipts);
  const tier = useFamily((s) => s.settings.tier);
  const toggle = useFamily((s) => s.toggleConnector);

  if (!c) {
    return (
      <Screen>
        <BackHeader />
        <Empty title="Not found" />
      </Screen>
    );
  }
  const on = connected.includes(c.id);
  const users = members.filter((m) => m.connectors.includes(c.id));
  const mine = receipts.filter((r) => r.connector.toLowerCase() === c.name.toLowerCase()).slice(0, 6);
  const locked = c.plusOnly && tier === 'free';

  return (
    <Screen>
      <BackHeader kicker={c.category} title={c.name} />
      <Row gap={14} style={{ marginTop: 8 }}>
        <Mono text={c.mono} size={60} on={on} />
        <View style={{ flex: 1 }}>
          <Txt variant="h2">{c.name}</Txt>
          <Txt variant="small">{on ? 'Connected' : c.unavailable ? 'Not available' : 'Not connected'}</Txt>
        </View>
      </Row>
      <Txt variant="body" style={{ marginTop: 12 }}>
        {c.unavailable ?? c.blurb}
      </Txt>

      {!c.unavailable && (
        <>
          <Label>What your family can do here</Label>
          <Card carve={0} padding={12}>
            {c.caps.map((cap) => (
              <Row key={cap.label} gap={10} style={{ paddingVertical: 8 }}>
                <Ionicons name={LEVEL[cap.level].icon} size={18} color={cap.level === 'always' ? p.text : p.muted} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{cap.label}</Txt>
                  <Txt variant="tiny">{LEVEL[cap.level].label}</Txt>
                </View>
              </Row>
            ))}
          </Card>

          <Label>Who uses it</Label>
          {users.length === 0 ? (
            <Txt variant="small" style={{ marginHorizontal: 4 }}>
              No teammate has it yet. Turn it on from a teammate's page.
            </Txt>
          ) : (
            <Row gap={14} wrap>
              {users.map((m) => {
                const mm = memberOrTemplate(m.id, members);
                return (
                  <View key={m.id} style={{ alignItems: 'center', width: 70 }}>
                    <Pebble shape={mm.shape} color={mm.color} mark={mm.mark} size={40} animate={false} />
                    <Txt variant="tiny" style={{ marginTop: 4 }}>
                      {mm.name}
                    </Txt>
                  </View>
                );
              })}
            </Row>
          )}

          <Label>Reading receipts</Label>
          <Card carve={2} padding={12}>
            {mine.length === 0 ? (
              <Txt variant="small">Every time a teammate reads or changes something here, it shows up in this list.</Txt>
            ) : (
              mine.map((r) => (
                <Row key={r.id} gap={10} style={{ paddingVertical: 6 }}>
                  <Ionicons name={r.kind === 'read' ? 'eye-outline' : 'checkmark-done-outline'} size={16} color={p.muted} />
                  <Txt variant="small" color={p.text2} style={{ flex: 1 }}>
                    {r.text}
                  </Txt>
                  <Txt variant="tiny">{timeAgo(r.at)}</Txt>
                </Row>
              ))
            )}
          </Card>

          <View style={{ marginTop: 22 }}>
            {locked ? (
              <Btn title="Comes with Plus" variant="signal" full onPress={() => router.push('/plus')} />
            ) : (
              <Btn
                title={on ? `Disconnect ${c.name}` : `Connect ${c.name}`}
                variant={on ? 'danger' : 'signal'}
                full
                onPress={() => {
                  toggle(c.id);
                  haptic(on ? 'warning' : 'success');
                  toast(on ? `${c.name} disconnected. Its access is gone.` : `${c.name} connected.`);
                }}
              />
            )}
          </View>
        </>
      )}
    </Screen>
  );
}
