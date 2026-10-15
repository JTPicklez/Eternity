import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useFamily } from '@/lib/store';
import { pushWords } from '@/lib/catalog';
import type { Autonomy } from '@/lib/types';
import { Btn, Card, Chip, Field, Label, Row, Screen, Segmented, StoneSlider, Toggle, Txt } from '@/components/ui';
import { HoldButton } from '@/components/HoldButton';
import { Steps } from '@/components/Steps';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const RULE_IDEAS = ['Sleep at least 7 hours', 'Sunday dinner with family', 'Gym 4 times a week', 'Church on Sunday', 'No meetings before 9', 'Date night Fridays'];

export default function CharterScreen() {
  const p = useTheme();
  const charter = useFamily((s) => s.charter);
  const setCharter = useFamily((s) => s.setCharter);
  const firstName = useFamily((s) => s.firstName);
  const [rules, setRules] = useState<string[]>(charter.nonNegotiables);
  const [custom, setCustom] = useState('');
  const [push, setPush] = useState(charter.push);
  const [slammed, setSlammed] = useState(charter.slammed);
  const [autonomy, setAutonomy] = useState<Autonomy>(charter.autonomy);
  const [signed, setSigned] = useState(false);

  const toggleRule = (r: string) => setRules((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]));

  return (
    <Screen>
      <Steps step={2} />
      <Txt variant="label" style={{ marginTop: 12 }}>
        The Charter
      </Txt>
      <Txt variant="title" style={{ marginTop: 6 }}>
        The rules your family plays by.
      </Txt>
      <Txt variant="body" style={{ marginTop: 8 }}>
        Every teammate reads this before they act. Change it anytime from Me.
      </Txt>

      <Label>We are going after</Label>
      <Card carve={0}>
        {charter.goals.map((g, i) => (
          <Row key={g} style={{ paddingVertical: 6 }} gap={12}>
            <Txt variant="mono" color={p.signalText}>
              0{i + 1}
            </Txt>
            <Txt variant="bodyStrong" style={{ flex: 1 }}>
              {g}
            </Txt>
          </Row>
        ))}
      </Card>

      <Label>Never move these</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[...new Set([...rules, ...RULE_IDEAS])].map((r) => (
          <Chip key={r} label={r} selected={rules.includes(r)} onPress={() => toggleRule(r)} />
        ))}
      </View>
      <Row style={{ marginTop: 10 }} gap={8}>
        <View style={{ flex: 1 }}>
          <Field placeholder="Add your own" value={custom} onChangeText={setCustom} />
        </View>
        <Btn
          title="Add"
          small
          disabled={!custom.trim()}
          onPress={() => {
            toggleRule(custom.trim());
            setCustom('');
          }}
        />
      </Row>

      <Label>How hard should we push?</Label>
      <Card carve={1}>
        <StoneSlider value={push} onChange={setPush} left="Steady" right="Relentless" />
        <Txt variant="bodyStrong" style={{ marginTop: 12 }}>
          {pushWords(push)}
        </Txt>
        <Txt variant="small" style={{ marginTop: 4 }}>
          Your family will never tell you to stop chasing. They make the load lighter.
        </Txt>
      </Card>

      <Label>When I'm slammed</Label>
      <Card carve={2} padding={6}>
        {(
          [
            ['triage', 'Triage for me', 'Put the week in order of what matters most.'],
            ['hours', 'Find me hours', 'Pull time from low-value blocks and protect it.'],
            ['busywork', 'Take the busywork', 'Drafts, filing, reminders, flashcards: handled.'],
          ] as const
        ).map(([key, title, sub]) => (
          <Row key={key} style={{ padding: 10 }} gap={12}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{title}</Txt>
              <Txt variant="small">{sub}</Txt>
            </View>
            <Toggle value={slammed[key]} onChange={(v) => setSlammed({ ...slammed, [key]: v })} label={title} />
          </Row>
        ))}
      </Card>

      <Label>How much can they do on their own?</Label>
      <Segmented
        options={[
          { id: 'suggest', label: 'Suggest' },
          { id: 'ask', label: 'Ask first' },
          { id: 'do', label: 'Just do it' },
        ]}
        value={autonomy}
        onChange={setAutonomy}
      />
      <Txt variant="small" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {autonomy === 'suggest'
          ? 'They suggest. You decide everything.'
          : autonomy === 'ask'
            ? 'They prepare it and ask before anything changes.'
            : 'Small things just happen, with a receipt and an undo. Sending, spending, merging and deleting always ask.'}
      </Txt>

      <Card tone="stone" carve={3} style={{ marginTop: 26 }}>
        <Txt variant="label" color={p.mode === 'paper' ? '#8FD8F7' : '#1A4DB3'}>
          Signed
        </Txt>
        <Txt
          variant="h2"
          color={p.onStone}
          style={{ marginTop: 6, fontFamily: signed ? fonts.display : fonts.displayBold, opacity: signed ? 1 : 0.35 }}
        >
          {firstName || 'You'}
        </Txt>
        {signed ? (
          <Animated.View entering={ZoomIn.springify()}>
            <Txt variant="small" color={p.onStoneMuted} style={{ marginTop: 6 }}>
              Your family has it. Let's set up their access.
            </Txt>
          </Animated.View>
        ) : (
          <Txt variant="small" color={p.onStoneMuted} style={{ marginTop: 6 }}>
            Hold below to sign.
          </Txt>
        )}
      </Card>
      <View style={{ marginTop: 12 }}>
        <HoldButton
          title="Hold to sign the Charter"
          doneTitle="Signed"
          done={signed}
          onComplete={() => {
            setSigned(true);
            setCharter({ nonNegotiables: rules, push, slammed, autonomy });
          }}
        />
      </View>
      {signed && (
        <Animated.View entering={FadeIn.delay(300)} style={{ marginTop: 12 }}>
          <Btn title="Next: connect your stuff" variant="signal" full iconRight="arrow-forward" onPress={() => router.push('/onboarding/connect')} />
        </Animated.View>
      )}
    </Screen>
  );
}
