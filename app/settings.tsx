import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useFamily, useHead } from '@/lib/store';
import type { Tier, ThemePref } from '@/lib/types';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Card, Chip, Label, ListRow, Row, Screen, Segmented, Toggle, Txt } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export default function Settings() {
  const p = useTheme();
  const head = useHead();
  const s = useFamily((st) => st.settings);
  const setSettings = useFamily((st) => st.setSettings);

  const row = (title: string, sub: string, value: boolean, onChange: (v: boolean) => void) => (
    <Row style={{ padding: 10 }} gap={12}>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        <Txt variant="small">{sub}</Txt>
      </View>
      <Toggle value={value} onChange={onChange} label={title} />
    </Row>
  );

  return (
    <Screen>
      <BackHeader title="Settings" />

      <Label>Look</Label>
      <Segmented<ThemePref>
        options={[
          { id: 'system', label: 'System' },
          { id: 'paper', label: 'Paper' },
          { id: 'ink', label: 'Ink' },
        ]}
        value={s.theme}
        onChange={(v) => setSettings({ theme: v })}
      />
      <Card carve={0} style={{ marginTop: 12 }} padding={6}>
        <Row style={{ padding: 10 }} gap={12}>
          <MemberPebble member={head} size={44} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Eyes on teammates</Txt>
            <Txt variant="small">Off shows each teammate's mark instead.</Txt>
          </View>
          <Toggle value={s.eyes} onChange={(v) => setSettings({ eyes: v })} label="Eyes on teammates" />
        </Row>
        {row('Moving water', 'Ripples drift slowly in the background.', s.ambient, (v) => setSettings({ ambient: v }))}
        {row('Haptics', 'Little taps when things happen.', s.haptics, (v) => setSettings({ haptics: v }))}
      </Card>

      <Label>Flow sound</Label>
      <Row gap={8}>
        {(['rain', 'forest', 'off'] as const).map((x) => (
          <Chip key={x} label={x === 'rain' ? 'Rain' : x === 'forest' ? 'Forest' : 'Silence'} selected={s.sound === x} onPress={() => setSettings({ sound: x })} />
        ))}
      </Row>

      <Label>Privacy</Label>
      <Card carve={1} padding={6}>
        {row('Private session', 'Nothing saved or remembered while it is on.', s.privateSession, (v) => setSettings({ privateSession: v }))}
        {row('Learn from chats', 'Off means teammates only suggest what to remember.', s.learning, (v) => setSettings({ learning: v }))}
        <ListRow icon="shield-checkmark-outline" title="Trust & privacy" onPress={() => router.push('/trust')} />
      </Card>

      {__DEV__ && (
        <>
          <Label>Developer</Label>
          <Card carve={2}>
            <Txt variant="small">Preview a plan locally (development builds only).</Txt>
            <Row gap={8} wrap style={{ marginTop: 10 }}>
              {(['free', 'plus', 'pro', 'founding'] as Tier[]).map((t) => (
                <Chip key={t} label={t} small selected={s.tier === t} onPress={() => setSettings({ tier: t })} />
              ))}
            </Row>
          </Card>
        </>
      )}
      <Txt variant="tiny" center style={{ marginTop: 22 }} color={p.muted}>
        Eternity 1.0
      </Txt>
    </Screen>
  );
}
