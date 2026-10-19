/**
 * A pebble gallery for checking the art while developing. Only reachable in
 * development builds (__DEV__); release builds send you home.
 */
import React from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { EXTRAS, FINISHES } from '@/lib/cosmetics';
import { SHAPES } from '@/lib/catalog';
import type { Mood } from '@/lib/types';
import { Pebble } from '@/components/Pebble';
import { Btn, Label, Row, Screen, Txt } from '@/components/ui';
import { useCrew } from '@/lib/store';

const MOODS: Mood[] = ['happy', 'curious', 'focused', 'proud', 'sleepy', 'excited', 'surprised'];

export default function Dev() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen>
      <Txt variant="title">Pebble gallery</Txt>
      <Btn
        title="Skip into the app as a guest"
        small
        style={{ marginTop: 10 }}
        onPress={() => {
          const s = useCrew.getState();
          s.setProfile({ guest: true, firstName: 'Josh' });
          s.setSettings({ tier: 'plus' });
          ['sage', 'bolt', 'pace', 'echo'].forEach((k) => s.addMember(k));
          s.updateMember('sage', { extras: ['glasses'], state: 'working', status: 'Making chain rule flashcards' });
          s.updateMember('bolt', { state: 'working', status: 'Fixing the onboarding crash', finish: 'granite' });
          s.updateMember('pace', { state: 'waiting', status: 'Wants to move your run to 6 PM', extras: ['beanie'] });
          s.updateMember('echo', { mood: 'sleepy', extras: ['bow'] });
          s.finishOnboarding();
          router.replace('/');
        }}
      />
      <Label>Moods</Label>
      <Row wrap gap={12}>
        {MOODS.map((m) => (
          <View key={m} style={{ alignItems: 'center' }}>
            <Pebble shape="round" color="#3E8EF0" mood={m} size={72} />
            <Txt variant="tiny">{m}</Txt>
          </View>
        ))}
      </Row>
      <Label>Shapes</Label>
      <Row wrap gap={12}>
        {SHAPES.map((s) => (
          <View key={s} style={{ alignItems: 'center' }}>
            <Pebble shape={s} color="#C3A3F7" size={72} extras={['beanie']} />
            <Txt variant="tiny">{s}</Txt>
          </View>
        ))}
      </Row>
      <Label>Materials</Label>
      <Row wrap gap={12}>
        {FINISHES.map((f) => (
          <View key={f.id} style={{ alignItems: 'center' }}>
            <Pebble shape="round" color="#8FCB5A" finish={f.id} size={72} />
            <Txt variant="tiny">{f.label}</Txt>
          </View>
        ))}
      </Row>
      <Label>Extras</Label>
      <Row wrap gap={12}>
        {EXTRAS.map((x) => (
          <View key={x.id} style={{ alignItems: 'center' }}>
            <Pebble shape="almond" color="#F2C94C" extras={[x.id]} size={72} />
            <Txt variant="tiny">{x.label}</Txt>
          </View>
        ))}
      </Row>
      <Label>Wear</Label>
      <Row wrap gap={12}>
        {[0.05, 0.3, 0.55, 0.8, 1].map((w) => (
          <View key={w} style={{ alignItems: 'center' }}>
            <Pebble shape="bean" color="#E58C6B" wear={w} size={72} />
            <Txt variant="tiny">{w}</Txt>
          </View>
        ))}
      </Row>
      <Label>States and sizes</Label>
      <Row wrap gap={12} align="flex-end">
        <Pebble shape="wedge" color="#FF8FB1" state="working" size={72} />
        <Pebble shape="wedge" color="#FF8FB1" state="waiting" size={72} />
        <Pebble shape="wedge" color="#FF8FB1" state="done" size={72} />
        <Pebble shape="diamond" color="#3E8EF0" size={20} />
        <Pebble shape="diamond" color="#3E8EF0" size={34} />
        <Pebble shape="diamond" color="#3E8EF0" size={56} />
        <Pebble shape="diamond" color="#3E8EF0" size={120} extras={['crown', 'glasses']} />
      </Row>
    </Screen>
  );
}
