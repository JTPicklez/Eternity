import React, { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { timeAgo } from '@/lib/dates';
import { useFamily } from '@/lib/store';
import { BackHeader, Badge, Btn, Card, Empty, Field, haptic, IconBtn, Label, Row, Screen, Sheet, Toggle, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

export default function Memory() {
  const p = useTheme();
  const facts = useFamily((s) => s.facts);
  const learning = useFamily((s) => s.settings.learning);
  const setSettings = useFamily((s) => s.setSettings);
  const addFact = useFamily((s) => s.addFact);
  const removeFact = useFamily((s) => s.removeFact);
  const clearFacts = useFamily((s) => s.clearFacts);
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);

  return (
    <Screen>
      <BackHeader kicker="Encrypted on this phone" title="Memory" />
      <Txt variant="body" style={{ marginTop: 4 }}>
        What your family knows about you. Forgetting here really forgets: it's deleted, not hidden.
      </Txt>

      <Card carve={0} style={{ marginTop: 14 }}>
        <Row gap={12}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Learn from chats</Txt>
            <Txt variant="small">{learning ? 'Teammates save useful facts on their own and tell you each time.' : 'Off. Teammates suggest facts and you decide what to save.'}</Txt>
          </View>
          <Toggle value={learning} onChange={(v) => { setSettings({ learning: v }); toast(v ? 'Learning is on. You will see every save.' : 'Learning is off.'); }} label="Learn from chats" />
        </Row>
      </Card>

      <Label>Tell them something</Label>
      <Row gap={8}>
        <View style={{ flex: 1 }}>
          <Field placeholder="e.g. I'm sharpest after 9 PM" value={text} onChangeText={setText} onSubmitEditing={() => { if (text.trim()) { addFact(text, 'you'); setText(''); haptic('success'); } }} />
        </View>
        <Btn title="Save" small disabled={!text.trim()} onPress={() => { addFact(text, 'you'); setText(''); haptic('success'); }} />
      </Row>

      <Label>{facts.length} things remembered</Label>
      {facts.length === 0 ? (
        <Empty title="Nothing remembered" body="Your family starts fresh every time until you save something." />
      ) : (
        <Animated.View layout={LinearTransition}>
          {facts.map((f, i) => (
            <Animated.View key={f.id} entering={FadeInDown.delay(Math.min(i, 8) * 30)} exiting={FadeOut} layout={LinearTransition}>
              <View style={[carved[i % 4], { marginBottom: 8, padding: 12, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                <Row gap={10}>
                  <Ionicons name={f.source === 'you' ? 'person-outline' : 'sparkles-outline'} size={16} color={p.muted} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="body">{f.text}</Txt>
                    <Row gap={6} style={{ marginTop: 4 }}>
                      <Badge text={f.source === 'you' ? 'You told us' : 'Learned'} color={p.card2} textColor={p.muted} />
                      <Txt variant="tiny">{timeAgo(f.at)}</Txt>
                    </Row>
                  </View>
                  <IconBtn icon="trash-outline" label={`Forget: ${f.text}`} size={36} onPress={() => { removeFact(f.id); toast('Forgotten for good.'); }} />
                </Row>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
      )}

      {facts.length > 0 && <Btn title="Forget everything in memory" variant="danger" full style={{ marginTop: 18 }} onPress={() => setConfirm(true)} />}

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Forget all of it?">
        <Txt variant="body">Every fact is deleted from this phone. Your teammates will start fresh. This can't be undone.</Txt>
        <Row gap={8} style={{ marginTop: 16 }}>
          <Btn title="Forget everything" variant="danger" onPress={() => { clearFacts(); setConfirm(false); toast('Memory cleared.'); }} />
          <Btn title="Keep it" variant="ghost" onPress={() => setConfirm(false)} />
        </Row>
      </Sheet>
    </Screen>
  );
}
