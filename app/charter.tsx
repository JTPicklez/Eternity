import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PACKS, pushWords } from '@/lib/catalog';
import { useCrew } from '@/lib/store';
import type { Autonomy } from '@/lib/types';
import { BackHeader, Btn, Card, Chip, Field, IconBtn, Label, Row, Screen, Segmented, StoneSlider, Toggle, Txt } from '@/components/ui';
import { HoldButton } from '@/components/HoldButton';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

export default function CharterEdit() {
  const p = useTheme();
  const charter = useCrew((s) => s.charter);
  const setCharter = useCrew((s) => s.setCharter);
  const [goals, setGoals] = useState(charter.goals);
  const [rules, setRules] = useState(charter.nonNegotiables);
  const [push, setPush] = useState(charter.push);
  const [slammed, setSlammed] = useState(charter.slammed);
  const [autonomy, setAutonomy] = useState<Autonomy>(charter.autonomy);
  const [packs, setPacks] = useState(charter.packs);
  const [newGoal, setNewGoal] = useState('');
  const [newRule, setNewRule] = useState('');

  return (
    <Screen>
      <BackHeader kicker="The rules your Crew plays by" title="Your Charter" />

      <Label>Goals (up to 3)</Label>
      <Card carve={0} padding={10}>
        {goals.map((g, i) => (
          <Row key={g} gap={10} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
            <Txt variant="mono" color={p.signalText}>
              0{i + 1}
            </Txt>
            <Txt variant="bodyStrong" style={{ flex: 1 }}>
              {g}
            </Txt>
            <IconBtn icon="close" label={`Remove ${g}`} size={32} onPress={() => setGoals(goals.filter((x) => x !== g))} />
          </Row>
        ))}
        {goals.length < 3 && (
          <Row gap={8} style={{ marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Field placeholder="Add a goal" value={newGoal} onChangeText={setNewGoal} />
            </View>
            <Btn
              title="Add"
              small
              disabled={!newGoal.trim()}
              onPress={() => {
                setGoals([...goals, newGoal.trim()]);
                setNewGoal('');
              }}
            />
          </Row>
        )}
      </Card>

      <Label>Never move these</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {rules.map((r) => (
          <Chip key={r} label={r} selected onPress={() => setRules(rules.filter((x) => x !== r))} icon="close" />
        ))}
      </View>
      <Row gap={8} style={{ marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Field placeholder="Add a non-negotiable" value={newRule} onChangeText={setNewRule} />
        </View>
        <Btn
          title="Add"
          small
          disabled={!newRule.trim()}
          onPress={() => {
            setRules([...rules, newRule.trim()]);
            setNewRule('');
          }}
        />
      </Row>

      <Label>Push</Label>
      <Card carve={1}>
        <StoneSlider value={push} onChange={setPush} left="Steady" right="Relentless" />
        <Txt variant="bodyStrong" style={{ marginTop: 12 }}>
          {pushWords(push)}
        </Txt>
      </Card>

      <Label>When I'm slammed</Label>
      <Card carve={2} padding={6}>
        {(
          [
            ['triage', 'Triage for me'],
            ['hours', 'Find me hours'],
            ['busywork', 'Take the busywork'],
          ] as const
        ).map(([key, title]) => (
          <Row key={key} style={{ padding: 10 }} gap={12}>
            <Txt variant="bodyStrong" style={{ flex: 1 }}>
              {title}
            </Txt>
            <Toggle value={slammed[key]} onChange={(v) => setSlammed({ ...slammed, [key]: v })} label={title} />
          </Row>
        ))}
      </Card>

      <Label>On their own</Label>
      <Segmented
        options={[
          { id: 'suggest', label: 'Suggest' },
          { id: 'ask', label: 'Ask first' },
          { id: 'do', label: 'Just do it' },
        ]}
        value={autonomy}
        onChange={setAutonomy}
      />

      <Label>Worlds</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PACKS.map((pk) => (
          <Chip
            key={pk.id}
            label={pk.name}
            icon={pk.icon as never}
            selected={packs.includes(pk.id)}
            color={packs.includes(pk.id) ? pk.color : undefined}
            onPress={() => setPacks(packs.includes(pk.id) ? packs.filter((x) => x !== pk.id) : [...packs, pk.id])}
          />
        ))}
      </View>

      <Row gap={8} style={{ marginTop: 22, marginBottom: 10 }}>
        <Ionicons name="information-circle-outline" size={16} color={p.muted} />
        <Txt variant="small" style={{ flex: 1 }}>
          Every teammate reads the new Charter the next time they act.
        </Txt>
      </Row>
      <HoldButton
        title="Hold to re-sign"
        onComplete={() => {
          setCharter({ goals, nonNegotiables: rules, push, slammed, autonomy, packs });
          toast('Charter updated. The Crew has it.');
          router.back();
        }}
      />
    </Screen>
  );
}
