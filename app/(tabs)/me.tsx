import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { auth } from '@/firebase/config';
import { logOut } from '@/firebase/auth';
import { pushWords } from '@/lib/catalog';
import { useFamily, useHead } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { Badge, Btn, Card, IconBtn, Label, ListRow, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

const TIER_NAME = { free: 'Free', plus: 'Eternity Plus', pro: 'Eternity Pro', founding: 'Founding Family' } as const;

export default function Me() {
  const p = useTheme();
  const head = useHead();
  const firstName = useFamily((s) => s.firstName);
  const guest = useFamily((s) => s.guest);
  const charter = useFamily((s) => s.charter);
  const tier = useFamily((s) => s.settings.tier);
  const settings = useFamily((s) => s.settings);
  const counts = useFamily(
    useShallow((s) => ({ facts: s.facts.length, routines: s.routines.filter((r) => r.on).length, receipts: s.receipts.length, connected: s.connected.length })),
  );
  const sample = useFamily((s) => s.sample);
  const loadSample = useFamily((s) => s.loadSample);
  const clearSample = useFamily((s) => s.clearSample);
  const setProfile = useFamily((s) => s.setProfile);
  const email = auth.currentUser?.email;

  return (
    <Screen>
      <Row justify="space-between" style={{ height: 48, paddingHorizontal: 4 }}>
        <Txt variant="display">Me</Txt>
        <IconBtn icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </Row>

      <Animated.View entering={FadeInDown}>
        <Card carve={0} style={{ marginTop: 10 }}>
          <Row gap={14}>
            <View style={{ width: 58, height: 58, borderRadius: 22, backgroundColor: p.stone, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="title" color={p.onStone}>
                {(firstName || '?').charAt(0).toUpperCase()}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="h2">{firstName || 'You'}</Txt>
              <Txt variant="small" numberOfLines={1}>
                {guest ? 'Preview mode (no account)' : (email ?? 'Signed in')}
              </Txt>
            </View>
            <Badge text={TIER_NAME[tier]} color={tier === 'founding' ? '#D4AF5A' : tier === 'free' ? p.card2 : p.signal} textColor={tier === 'free' ? p.text : tier === 'founding' ? '#1E2023' : p.onSignal} />
          </Row>
          {tier === 'free' && (
            <Btn title="See Plus" small variant="signal" style={{ marginTop: 14 }} icon="sparkles-outline" onPress={() => router.push('/plus')} />
          )}
        </Card>
      </Animated.View>

      <Label>Your Charter</Label>
      <Card carve={1} onPress={() => router.push('/charter')} accessibilityLabel="Edit your Charter">
        <Row gap={12} align="flex-start">
          <MemberPebble member={head} size={40} animate={false} />
          <View style={{ flex: 1 }}>
            {charter.goals.length ? (
              charter.goals.map((g, i) => (
                <Row key={g} gap={8} style={{ marginBottom: 4 }}>
                  <Txt variant="mono" color={p.signalText}>
                    0{i + 1}
                  </Txt>
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>
                    {g}
                  </Txt>
                </Row>
              ))
            ) : (
              <Txt variant="bodyStrong">No goals yet</Txt>
            )}
            <Txt variant="small" style={{ marginTop: 4 }}>
              {pushWords(charter.push)}
            </Txt>
          </View>
          <Ionicons name="create-outline" size={18} color={p.muted} />
        </Row>
      </Card>

      <Label>Your family's access</Label>
      <Card carve={2} padding={6}>
        <ListRow icon="link-outline" title="Connections" sub={`${counts.connected} connected`} onPress={() => router.push('/connect')} />
        <ListRow icon="repeat-outline" title="Routines" sub={`${counts.routines} running`} onPress={() => router.push('/routines')} />
        <ListRow icon="receipt-outline" title="Receipts" sub="Everything your family read or did" onPress={() => router.push('/receipts')} />
        <ListRow icon="bookmark-outline" title="Memory" sub={`${counts.facts} things remembered · learning ${settings.learning ? 'on' : 'off'}`} onPress={() => router.push('/memory')} />
        <ListRow icon="shield-checkmark-outline" title="Trust & privacy" sub="What we promise, and how to check" onPress={() => router.push('/trust')} />
      </Card>

      <Label>Progress</Label>
      <Card carve={3} padding={6}>
        <ListRow icon="ribbon-outline" title="Weekly review" sub="Your grade, your wins, one decision" onPress={() => router.push('/review')} />
        <ListRow icon="ellipse-outline" title="Your year" sub="Every week as water rings" onPress={() => router.push('/rings')} />
        <ListRow icon="albums-outline" title="Flashcards" onPress={() => router.push('/flashcards')} />
        <ListRow icon="bag-handle-outline" title="Errands" sub="Look, prepare, you tap" onPress={() => router.push('/errand/new')} />
      </Card>

      <Label>Sample day</Label>
      <Card carve={0} padding={14}>
        <Txt variant="small">{sample ? 'You are looking at a sample day. Clear it to start fresh with your own.' : 'Bring back the sample day to see every feature working.'}</Txt>
        <Btn
          title={sample ? 'Clear sample day' : 'Load sample day'}
          small
          variant="ghost"
          style={{ marginTop: 10 }}
          onPress={() => {
            if (sample) clearSample();
            else loadSample();
            toast(sample ? 'Sample cleared.' : 'Sample day loaded.');
          }}
        />
      </Card>

      <View style={{ marginTop: 26, gap: 8 }}>
        {guest ? (
          <Btn title="Create an account" variant="signal" full onPress={() => setProfile({ guest: false })} />
        ) : (
          <Btn
            title="Sign out"
            variant="ghost"
            full
            onPress={async () => {
              await logOut();
              toast('Signed out. Your family stays encrypted on this phone.');
            }}
          />
        )}
      </View>
      <Txt variant="tiny" center style={{ marginTop: 22 }}>
        Eternity 1.0 · An Eternity Works app
      </Txt>
    </Screen>
  );
}
