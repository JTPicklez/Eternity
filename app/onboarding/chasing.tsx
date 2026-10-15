import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { PACKS } from '@/lib/catalog';
import { useFamily } from '@/lib/store';
import { Btn, Chip, Field, PressScale, Row, Screen, Txt } from '@/components/ui';
import { Steps } from '@/components/Steps';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

const GOAL_IDEAS = [
  'Raise my GPA to a 3.8',
  'Ship my app this semester',
  'Run a half marathon',
  'Grow my channel to 10K',
  'Land a summer internship',
  'Get my first 100 customers',
  'Finish my novel draft',
];

export default function Chasing() {
  const p = useTheme();
  const charter = useFamily((s) => s.charter);
  const setCharter = useFamily((s) => s.setCharter);
  const [packs, setPacks] = useState<string[]>(charter.packs);
  const [goals, setGoals] = useState<string[]>(charter.goals);
  const [custom, setCustom] = useState('');

  const togglePack = (id: string) => setPacks((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const toggleGoal = (g: string) =>
    setGoals((x) => (x.includes(g) ? x.filter((y) => y !== g) : x.length >= 3 ? x : [...x, g]));

  return (
    <Screen
      footer={
        <View style={{ paddingHorizontal: 16, paddingBottom: 18, paddingTop: 8 }}>
          <Btn
            title={goals.length ? 'Write the Charter' : 'Pick at least one goal'}
            variant="signal"
            full
            disabled={!goals.length}
            iconRight="arrow-forward"
            onPress={() => {
              setCharter({ packs, goals });
              router.push('/onboarding/charter');
            }}
          />
        </View>
      }
    >
      <Steps step={1} />
      <Txt variant="title" style={{ marginTop: 12 }}>
        What are you chasing?
      </Txt>
      <Txt variant="body" style={{ marginTop: 8 }}>
        Pick your worlds. Each one brings a teammate and the right connections.
      </Txt>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
        {PACKS.map((pack, i) => {
          const on = packs.includes(pack.id);
          return (
            <Animated.View key={pack.id} entering={FadeInDown.delay(i * 50)} style={{ width: '48%', flexGrow: 1 }}>
              <PressScale onPress={() => togglePack(pack.id)} accessibilityRole="checkbox" accessibilityLabel={pack.name} hapticKind="select">
                <View
                  style={[
                    carved[i % 4],
                    {
                      padding: 14,
                      minHeight: 104,
                      backgroundColor: on ? pack.color : p.card,
                      borderWidth: 2,
                      borderColor: on ? p.text : 'transparent',
                      boxShadow: on ? undefined : `0px 3px 0px ${p.shadow}`,
                    },
                  ]}
                >
                  <Row justify="space-between">
                    <Ionicons name={pack.icon as never} size={22} color={on ? '#1E2023' : p.text} />
                    {on && <Ionicons name="checkmark-circle" size={20} color="#1E2023" />}
                  </Row>
                  <Txt variant="h3" color={on ? '#1E2023' : undefined} style={{ marginTop: 10 }}>
                    {pack.name}
                  </Txt>
                  <Txt variant="small" color={on ? '#2A2622' : undefined}>
                    {pack.blurb}
                  </Txt>
                </View>
              </PressScale>
            </Animated.View>
          );
        })}
      </View>

      <Txt variant="h2" style={{ marginTop: 28 }}>
        Your big goals
      </Txt>
      <Txt variant="small" style={{ marginTop: 4 }}>
        Up to three. Your family measures everything against these.
      </Txt>
      <Animated.View layout={LinearTransition.springify()} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {[...new Set([...goals, ...GOAL_IDEAS])].map((g) => (
          <Chip key={g} label={g} selected={goals.includes(g)} onPress={() => toggleGoal(g)} />
        ))}
      </Animated.View>
      <Row style={{ marginTop: 12 }} gap={8}>
        <View style={{ flex: 1 }}>
          <Field
            placeholder="Or write your own"
            value={custom}
            onChangeText={setCustom}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (custom.trim()) {
                toggleGoal(custom.trim());
                setCustom('');
              }
            }}
          />
        </View>
        <Btn
          title="Add"
          small
          disabled={!custom.trim() || goals.length >= 3}
          onPress={() => {
            toggleGoal(custom.trim());
            setCustom('');
          }}
        />
      </Row>
      <Txt variant="mono" style={{ marginTop: 10 }}>
        {goals.length}/3 picked
      </Txt>
    </Screen>
  );
}
