/**
 * The Family Table: one thread where your teammates talk to each other in
 * front of you. Conflicts get surfaced honestly, and the head brings you
 * options. You make the call.
 */
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { askTeammate } from '@/lib/ai';
import { runAction } from '@/lib/actions';
import { addDays, isoDate, shortTime } from '@/lib/dates';
import { memberOrTemplate, nameOf, useFamily, useHead } from '@/lib/store';
import type { TableMessage } from '@/lib/types';
import { Pebble } from '@/components/Pebble';
import { ProposalCard } from '@/components/ProposalCard';
import { RichText } from '@/components/RichText';
import { ThinkingDots } from '@/components/Thinking';
import { Badge, Btn, Chip, haptic, IconBtn, PressScale, Row, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved, fonts, textOn } from '@/theme/tokens';

const PROMPTS = ["What's at risk this week?", 'Who has time Thursday night?', 'I just got a new assignment due Monday', 'Plan my Saturday'];

/** The sample conflict resolves into real calendar changes. */
function applySampleChoice(optionId: string) {
  const st = useFamily.getState();
  const tomorrow = isoDate(addDays(new Date(), 1));
  const demo = st.blocks.find((b) => b.date === tomorrow && /demo prep/i.test(b.title));
  const calc = st.blocks.find((b) => b.date === tomorrow && /calc quiz review/i.test(b.title));
  if (optionId === 'A') {
    if (calc) st.updateBlock(calc.id, { time: '18:30', end: '20:00', sub: 'With Sage · before 9 like you asked' });
    if (demo) st.updateBlock(demo.id, { time: '20:15', end: '23:59', sub: 'With Bolt · 4 focused hours' });
  } else {
    if (demo) st.updateBlock(demo.id, { time: '12:00', end: '15:30', sub: 'With Bolt · instead of lunch' });
    if (calc) st.updateBlock(calc.id, { time: '19:00', end: '20:30', sub: 'With Sage · done before 9' });
  }
  st.addReceipt({ memberId: st.headId, text: 'Rearranged tomorrow so demo prep and Calc review both fit', connector: 'Calendar', kind: 'did', undoable: false });
}

export default function Table() {
  const p = useTheme();
  const head = useHead();
  const members = useFamily((s) => s.members);
  const table = useFamily((s) => s.table);
  const sample = useFamily((s) => s.sample);
  const appendTable = useFamily((s) => s.appendTable);
  const chooseTableOption = useFamily((s) => s.chooseTableOption);
  const sendTableDraft = useFamily((s) => s.sendTableDraft);
  const setTableAction = useFamily((s) => s.setTableAction);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<FlatList<TableMessage>>(null);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [table.length, thinking]);

  const ask = async (value: string) => {
    const q = value.trim();
    if (!q || thinking) return;
    setText('');
    appendTable({ from: 'you', text: q });
    setThinking(true);
    const transcript = useFamily
      .getState()
      .table.slice(-12)
      .map((m) => `${nameOf(m.from)}: ${m.text}${m.options ? ` [options: ${m.options.map((o) => o.title).join(' / ')}]` : ''}${m.chosen ? ` (chose ${m.chosen})` : ''}`)
      .join('\n');
    const res = await askTeammate({
      member: head,
      history: [],
      task: 'table',
      text: `Family Table so far:\n${transcript}\n\nAs head of the family, answer the person's latest message for the whole family. If teammates' needs collide, say so honestly and give two options.`,
    });
    setThinking(false);
    appendTable({
      from: head.id,
      text: res.text || 'Here are two ways to do it:',
      options: res.options.length ? res.options.map((o, i) => ({ id: String.fromCharCode(65 + i), title: o.title, desc: o.desc })) : undefined,
      actions: res.actions.length ? res.actions : undefined,
      preview: res.preview || undefined,
    });
    haptic('medium');
  };

  const choose = (m: TableMessage, optionId: string) => {
    chooseTableOption(m.id, optionId);
    haptic('success');
    const opt = m.options?.find((o) => o.id === optionId);
    const isSampleConflict = sample && m.options?.some((o) => o.title === 'Split the night');
    if (isSampleConflict) {
      applySampleChoice(optionId);
      setTimeout(() => {
        appendTable({ from: head.id, text: `Locked in: ${opt?.title}. Tomorrow is rearranged and both blocks are protected.` });
        if (members.some((x) => x.id === 'sage'))
          appendTable({
            from: 'sage',
            text: 'Want me to tell Prof. Lee you will be at office hours Thursday instead of Wednesday?',
            draft: { to: 'Prof. Lee', text: 'Hi Professor Lee, could I come to office hours Thursday instead of Wednesday this week? Thank you!', sent: false },
          });
        toast('Tomorrow is rearranged.', { label: 'See it', onPress: () => router.push('/planner') }, head.color);
      }, 500);
    } else {
      ask(`Let's go with ${optionId}: ${opt?.title}.`);
    }
  };

  const renderItem = ({ item, index }: { item: TableMessage; index: number }) => {
    if (item.from === 'you') {
      return (
        <Animated.View entering={FadeInUp} style={{ alignItems: 'flex-end', marginBottom: 12 }}>
          <View style={{ maxWidth: '84%', backgroundColor: p.stone, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: 6 }}>
            <RichText text={item.text} color={p.onStone} />
          </View>
        </Animated.View>
      );
    }
    const m = memberOrTemplate(item.from, members);
    const isHead = item.from === head.id;
    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 3) * 60)} style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Pebble shape={m.shape} color={m.color} face={m.face} mark={m.mark} motion={m.motion} size={34} animate={false} />
        <View style={{ flex: 1 }}>
          <Row gap={6}>
            <Txt variant="smallStrong" color={textOn(p, m.color)}>
              {m.name}
            </Txt>
            {isHead && <Badge text="Head" color={p.card2} textColor={p.muted} />}
            {m.visiting && <Badge text="Sample" color={p.card2} textColor={p.muted} />}
            <Txt variant="tiny">{shortTime(item.at)}</Txt>
          </Row>
          <View style={[carved[index % 4], { marginTop: 4, backgroundColor: p.card, padding: 12, boxShadow: `0px 2px 0px ${p.shadow}`, borderLeftWidth: 4, borderLeftColor: m.color }]}>
            <RichText text={item.text} />
          </View>
          {item.options?.map((o) => {
            const chosen = item.chosen === o.id;
            const faded = !!item.chosen && !chosen;
            return (
              <PressScale key={o.id} onPress={() => !item.chosen && choose(item, o.id)} disabled={!!item.chosen && !chosen} accessibilityLabel={`Option ${o.id}: ${o.title}`}>
                <View
                  style={[
                    carved[(index + 1) % 4],
                    {
                      marginTop: 8,
                      padding: 14,
                      backgroundColor: chosen ? p.signal : p.card,
                      borderWidth: 2,
                      borderColor: chosen ? p.signal : p.text,
                      opacity: faded ? 0.4 : 1,
                    },
                  ]}
                >
                  <Row gap={10}>
                    <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: chosen ? p.onSignal : p.stone, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt variant="smallStrong" color={chosen ? p.signal : p.onStone}>
                        {o.id}
                      </Txt>
                    </View>
                    <Txt variant="bodyStrong" color={chosen ? p.onSignal : undefined} style={{ flex: 1 }}>
                      {o.title}
                    </Txt>
                    {chosen && (
                      <Animated.View entering={ZoomIn}>
                        <Ionicons name="checkmark-circle" size={22} color={p.onSignal} />
                      </Animated.View>
                    )}
                  </Row>
                  <Txt variant="small" color={chosen ? p.onSignal : undefined} style={{ marginTop: 6 }}>
                    {o.desc}
                  </Txt>
                </View>
              </PressScale>
            );
          })}
          {item.actions?.map((a) => (
            <ProposalCard
              key={a.id}
              action={a}
              color={m.color}
              onApprove={async () => {
                setTableAction(item.id, a.id, 'approved');
                const out = await runAction(a, item.from);
                toast(out.text, out.undo ? { label: 'Undo', onPress: out.undo } : undefined, m.color);
              }}
              onDecline={() => setTableAction(item.id, a.id, 'declined')}
            />
          ))}
          {item.draft ? (
            <View style={[carved[2], { marginTop: 8, backgroundColor: p.card2, padding: 12 }]}>
              <Txt variant="label">Draft to {item.draft.to}</Txt>
              <Txt variant="body" style={{ marginTop: 6 }}>
                {item.draft.text}
              </Txt>
              {item.draft.sent ? (
                <Row gap={6} style={{ marginTop: 10 }}>
                  <Ionicons name="checkmark-circle" size={16} color={p.success} />
                  <Txt variant="smallStrong" color={p.success}>
                    Copied for you to send
                  </Txt>
                </Row>
              ) : (
                <Row gap={8} style={{ marginTop: 10 }}>
                  <Btn
                    title="Copy to send"
                    small
                    icon="copy-outline"
                    onPress={async () => {
                      await Clipboard.setStringAsync(item.draft!.text);
                      sendTableDraft(item.id);
                      toast('Copied. Sending is your tap.');
                    }}
                  />
                  <Txt variant="tiny" style={{ flex: 1 }}>
                    Your family never sends as you.
                  </Txt>
                </Row>
              )}
            </View>
          ) : null}
          {item.preview ? (
            <Txt variant="tiny" style={{ marginTop: 4 }}>
              Preview reply
            </Txt>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: p.line }}>
        <Row gap={6} style={{ height: 52 }}>
          <IconBtn icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={{ flex: 1 }}>
            <Txt variant="h3">Family Table</Txt>
            <Txt variant="tiny">Everyone talks here. You decide.</Txt>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {members.slice(0, 5).map((m, i) => (
              <View key={m.id} style={{ marginLeft: i ? -10 : 0 }}>
                <Pebble shape={m.shape} color={m.color} face={m.face} mark={m.mark} size={30} animate={false} outline={p.bg} />
              </View>
            ))}
          </View>
        </Row>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={table}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Txt variant="h2" center>
                The table is quiet.
              </Txt>
              <Txt variant="body" center>
                Bring something to the whole family and watch them work it out.
              </Txt>
            </Animated.View>
          }
          ListFooterComponent={
            thinking ? (
              <Row gap={10} style={{ marginBottom: 12 }}>
                <Pebble shape={head.shape} color={head.color} mark={head.mark} size={34} state="working" />
                <View style={{ backgroundColor: p.card, padding: 12, borderRadius: 14 }}>
                  <ThinkingDots color={head.color} />
                </View>
                <Txt variant="tiny">The family is huddling…</Txt>
              </Row>
            ) : null
          }
        />
        <View style={{ paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: p.line }}>
          <FlatList
            horizontal
            data={PROMPTS}
            keyExtractor={(x) => x}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            renderItem={({ item }) => <Chip label={item} small onPress={() => ask(item)} />}
          />
          <Row gap={8} style={{ paddingBottom: 10 }} align="flex-end">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Bring something to the table"
              placeholderTextColor={p.muted}
              multiline
              style={{
                flex: 1,
                minHeight: 46,
                maxHeight: 120,
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 12,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: p.lineStrong,
                backgroundColor: p.card,
                color: p.text,
                fontFamily: fonts.body,
                fontSize: 15.5,
              }}
              accessibilityLabel="Message the whole family"
            />
            <PressScale onPress={() => ask(text)} disabled={!text.trim() || thinking} accessibilityLabel="Send to the family">
              <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: text.trim() ? p.stone : p.card2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-up" size={22} color={text.trim() ? p.onStone : p.muted} />
              </View>
            </PressScale>
          </Row>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
