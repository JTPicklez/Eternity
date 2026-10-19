/**
 * Bring memory over from another AI: copy a prompt, paste the answer, then
 * approve each item. Nothing is saved until you tap Save.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { IMPORT_PROMPT, IMPORT_SOURCES, parseImport, type ImportItem, type ImportSource } from '@/lib/memoryImport';
import { useCrew, useLead } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Badge, Btn, Card, Chip, Field, haptic, Label, PressScale, Row, Screen, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

type Step = 'copy' | 'paste' | 'review';

export default function MemoryImport() {
  const p = useTheme();
  const lead = useLead();
  const facts = useCrew((s) => s.facts);
  const addFacts = useCrew((s) => s.addFacts);
  const [step, setStep] = useState<Step>('copy');
  const [source, setSource] = useState<ImportSource>('ChatGPT');
  const [raw, setRaw] = useState('');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [editing, setEditing] = useState<ImportItem | null>(null);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);

  const kept = useMemo(() => items.filter((i) => i.keep), [items]);

  const copy = async () => {
    await Clipboard.setStringAsync(IMPORT_PROMPT).catch(() => {});
    haptic('success');
    setCopied(true);
    toast('Prompt copied. Paste it into your other AI.', undefined, lead.color);
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    if (text) setRaw(text);
    else toast('Nothing on the clipboard yet.');
  };

  const read = () => {
    const parsed = parseImport(raw, facts.map((f) => f.text));
    if (!parsed.length) {
      toast("I couldn't find any facts in that. Try pasting the whole answer.");
      return;
    }
    setItems(parsed);
    setStep('review');
    haptic('success');
  };

  const toggle = (id: string) => setItems((list) => list.map((i) => (i.id === id ? { ...i, keep: !i.keep } : i)));

  const save = () => {
    const n = addFacts(
      kept.map((i) => i.text),
      'imported',
      source === 'Other' ? undefined : source,
    );
    haptic('success');
    toast(n ? `Saved ${n} thing${n === 1 ? '' : 's'} to memory.` : 'All of that was already remembered.', undefined, lead.color);
    router.back();
  };

  return (
    <Screen
      footer={
        step === 'review' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 }}>
            <Btn title={kept.length ? `Save ${kept.length} to memory` : 'Pick at least one'} variant="signal" full disabled={!kept.length} onPress={save} />
          </View>
        ) : undefined
      }
    >
      <BackHeader kicker="Memory" title="Bring it from another AI" />

      <Row gap={12} style={{ marginTop: 8 }} align="flex-start">
        <MemberPebble member={lead} size={46} state={step === 'review' ? 'done' : 'idle'} />
        <Txt variant="body" style={{ flex: 1 }}>
          {step === 'copy'
            ? 'Your other assistant already knows a lot about you. Ask it to write it down, and I’ll bring over whatever you choose.'
            : step === 'paste'
              ? 'Paste the whole answer here. I read it on your phone and nothing gets saved until you say so.'
              : `Here's what I found. Tap anything to keep or skip it, or hold to edit it.`}
        </Txt>
      </Row>

      {step === 'copy' && (
        <Animated.View entering={FadeIn}>
          <Label>Where is it coming from?</Label>
          <Row gap={8} wrap>
            {IMPORT_SOURCES.map((s) => (
              <Chip key={s} label={s} small selected={source === s} onPress={() => setSource(s)} />
            ))}
          </Row>

          <Label>1. Copy this prompt</Label>
          <Card carve={1} padding={14}>
            <Txt variant="small" color={p.text2}>
              {IMPORT_PROMPT}
            </Txt>
          </Card>
          <Btn title={copied ? 'Copied' : 'Copy the prompt'} icon={copied ? 'checkmark' : 'copy-outline'} variant="signal" full style={{ marginTop: 12 }} onPress={copy} />
          <Txt variant="small" style={{ marginTop: 10, marginHorizontal: 4 }}>
            2. Paste it into {source === 'Other' ? 'your other assistant' : source} and send it. 3. Copy its answer and come back.
          </Txt>
          <Btn title="I have the answer" variant="ghost" full iconRight="arrow-forward" style={{ marginTop: 14 }} onPress={() => setStep('paste')} />
        </Animated.View>
      )}

      {step === 'paste' && (
        <Animated.View entering={FadeIn}>
          <Label>Paste the answer</Label>
          <Field
            value={raw}
            onChangeText={setRaw}
            placeholder={'- Prefers short answers with examples.\n- Is building an app called...'}
            multiline
            style={{ minHeight: 220 }}
          />
          <Row gap={8} style={{ marginTop: 12 }}>
            <Btn title="Paste" icon="clipboard-outline" variant="ghost" small onPress={paste} />
            <View style={{ flex: 1 }} />
            <Btn title="Back" variant="quiet" small onPress={() => setStep('copy')} />
          </Row>
          <Btn title="Read it" variant="signal" full style={{ marginTop: 14 }} disabled={raw.trim().length < 10} onPress={read} />
        </Animated.View>
      )}

      {step === 'review' && (
        <Animated.View entering={FadeIn}>
          <Row justify="space-between" style={{ marginTop: 18, marginBottom: 8, paddingHorizontal: 4 }}>
            <Txt variant="label">
              {kept.length} of {items.length} picked
            </Txt>
            <Row gap={4}>
              <Btn title="All" small variant="quiet" onPress={() => setItems((l) => l.map((i) => ({ ...i, keep: !i.duplicate })))} />
              <Btn title="None" small variant="quiet" onPress={() => setItems((l) => l.map((i) => ({ ...i, keep: false })))} />
            </Row>
          </Row>
          {items.map((item, idx) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(idx, 10) * 25)}>
              <PressScale
                onPress={() => toggle(item.id)}
                onLongPress={() => {
                  setEditing(item);
                  setEditText(item.text);
                }}
                accessibilityRole="checkbox"
                accessibilityLabel={item.text}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                    padding: 12,
                    marginBottom: 8,
                    borderRadius: 16,
                    backgroundColor: item.keep ? p.card : 'transparent',
                    borderWidth: 1.5,
                    borderColor: item.keep ? p.lineStrong : p.line,
                  }}
                >
                  <Ionicons name={item.keep ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={item.keep ? p.signal : p.muted} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="body" style={{ color: item.keep ? p.text : p.muted, fontFamily: item.keep ? fonts.bodyMedium : fonts.body }}>
                      {item.text}
                    </Txt>
                    {item.sensitive || item.duplicate ? (
                      <Row gap={6} style={{ marginTop: 6 }}>
                        {item.sensitive && <Badge text="Looks private, off unless you want it" color={p.card2} textColor={p.muted} />}
                        {item.duplicate && <Badge text="Already remembered" color={p.card2} textColor={p.muted} />}
                      </Row>
                    ) : null}
                  </View>
                </View>
              </PressScale>
            </Animated.View>
          ))}
          <Btn title="Paste something else" variant="quiet" small style={{ alignSelf: 'center', marginTop: 6 }} onPress={() => setStep('paste')} />
        </Animated.View>
      )}

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title="Edit before saving">
        <Field value={editText} onChangeText={setEditText} multiline autoFocus maxLength={220} />
        <Btn
          title="Done"
          variant="signal"
          full
          style={{ marginTop: 12 }}
          disabled={!editText.trim()}
          onPress={() => {
            if (!editing) return;
            setItems((l) => l.map((i) => (i.id === editing.id ? { ...i, text: editText.trim(), keep: true } : i)));
            setEditing(null);
          }}
        />
      </Sheet>
    </Screen>
  );
}
