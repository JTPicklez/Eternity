import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { askTeammate } from '@/lib/ai';
import { runAction } from '@/lib/actions';
import { rewardedAvailable, showRewarded } from '@/lib/ads';
import { PLAN_LIMITS, templateFor } from '@/lib/catalog';
import { isoDate, shortTime } from '@/lib/dates';
import { useFamily, useMember } from '@/lib/store';
import type { ChatMessage, ProposedAction } from '@/lib/types';
import { MemberPebble } from '@/components/Pebble';
import { ProposalCard } from '@/components/ProposalCard';
import { RichText } from '@/components/RichText';
import { ThinkingDots } from '@/components/Thinking';
import { Badge, Btn, Chip, haptic, IconBtn, PressScale, Row, Sheet, Txt, ListRow } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const EMPTY: ChatMessage[] = [];

const STARTERS: Record<string, string[]> = {
  aibram: ['Plan my week around my goals', 'I am slammed. Triage for me', 'Block 2 hours tomorrow for deep work', 'What should I do next?'],
  sage: ['Quiz me on the chain rule', 'Make flashcards for my bio exam', 'Build a study plan for Friday', 'Explain derivatives like I am new'],
  bolt: ['Why would a React Native app crash on launch?', 'Review my approach to auth', 'Plan the demo build for Friday', 'Lock in: 3 hours of code tonight'],
  pace: ['Plan my training week', 'Add an easy 5 km run at 6 pm', 'I slept badly. Adjust today', 'Build me a half marathon plan'],
  ledger: ['What should I measure this week?', 'Draft a launch plan', 'Help me price my app', 'Find my first 100 customers'],
  echo: ['Plan next week of posts', 'Write titles for my next video', 'Draft show notes', 'Set a release-day routine'],
  quill: ['Outline my essay', 'Unstick my intro', 'Edit for clarity, keep my voice', 'Start a 45 minute writing Flow'],
  skeptic: ['Poke holes in my plan', 'Run a pre-mortem on my launch', 'What am I assuming?', 'Steelman the other side'],
};

export default function Chat() {
  const p = useTheme();
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const member = useMember(id);
  const messages = useFamily((s) => (id ? (s.chats[id] ?? EMPTY) : EMPTY));
  const appendChat = useFamily((s) => s.appendChat);
  const setActionStatus = useFamily((s) => s.setActionStatus);
  const clearChat = useFamily((s) => s.clearChat);
  const addFact = useFamily((s) => s.addFact);
  const settings = useFamily((s) => s.settings);
  const usage = useFamily((s) => s.usage);
  const setSettings = useFamily((s) => s.setSettings);
  const setMemberState = useFamily((s) => s.setMemberState);
  const headId = useFamily((s) => s.headId);
  const guest = useFamily((s) => s.guest);

  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [menu, setMenu] = useState(false);
  const [suggestedMemories, setSuggestedMemories] = useState<string[]>([]);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const sentQ = useRef(false);

  const limit = PLAN_LIMITS[settings.tier].messagesPerDay;
  const used = usage.day === isoDate() ? usage.messages : 0;
  const capped = used >= limit;

  const send = useCallback(
    async (raw?: string) => {
      const value = (raw ?? text).trim();
      if (!value || !member || thinking) return;
      setText('');
      haptic('light');
      const history = useFamily.getState().chats[member.id] ?? [];
      appendChat(member.id, { role: 'user', text: value });
      setThinking(true);
      setMemberState(member.id, 'working', 'Thinking it through');
      const res = await askTeammate({ member, history, text: value, deep: /plan|strategy|week|review|why/i.test(value) && value.length > 60 });
      setThinking(false);
      setMemberState(member.id, res.actions.length ? 'waiting' : 'idle', res.actions.length ? 'Waiting on your OK' : 'Ready when you are');
      appendChat(member.id, {
        role: 'assistant',
        memberId: member.id,
        text: res.text || (res.actions.length ? 'Here you go:' : '…'),
        rawContent: res.actions.length ? res.rawContent : undefined,
        actions: res.actions.length ? res.actions : undefined,
        preview: res.preview || undefined,
      });
      if (res.memories.length) {
        const st = useFamily.getState();
        if (st.settings.learning && !st.settings.privateSession) {
          res.memories.forEach((m) => addFact(m, 'learned'));
          toast(`Saved to memory: ${res.memories[0]}`, { label: 'Undo', onPress: () => {
            const f = useFamily.getState().facts.find((x) => x.text === res.memories[0]);
            if (f) useFamily.getState().removeFact(f.id);
          } });
        } else if (!st.settings.privateSession) {
          setSuggestedMemories(res.memories);
        }
      }
      haptic(res.actions.length ? 'medium' : 'light');
    },
    [text, member, thinking, appendChat, setMemberState, addFact],
  );

  useEffect(() => {
    if (q && !sentQ.current && member) {
      sentQ.current = true;
      send(q);
    }
  }, [q, member, send]);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, thinking]);

  if (!member) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Txt variant="h2">That teammate isn't in your family.</Txt>
        <Btn title="Back" style={{ marginTop: 12 }} onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const decide = async (msg: ChatMessage, action: ProposedAction, approve: boolean) => {
    setActionStatus(member.id, msg.id, action.id, approve ? 'approved' : 'declined');
    setMemberState(member.id, 'idle', approve ? 'On it' : 'Ready when you are');
    if (!approve) return;
    const out = await runAction(action, member.id);
    setMemberState(member.id, 'done', out.text);
    toast(out.text, out.undo ? { label: 'Undo', onPress: out.undo } : undefined, member.color);
  };

  const starters = STARTERS[member.kind] ?? STARTERS.aibram;
  const isHead = member.id === headId;

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = item.role === 'user';
    const preview = item.preview;
    return (
      <Animated.View entering={FadeInUp.duration(260)} style={{ marginBottom: 12, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        {mine ? (
          <View
            style={{
              maxWidth: '84%',
              backgroundColor: p.stone,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 18,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 6,
            }}
          >
            <RichText text={item.text} color={p.onStone} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, maxWidth: '92%' }}>
            <MemberPebble member={member} size={30} state="idle" animate={false} />
            <View style={{ flex: 1 }}>
              <View
                style={{
                  backgroundColor: p.card,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 20,
                  borderBottomLeftRadius: 18,
                  borderBottomRightRadius: 22,
                  boxShadow: `0px 2px 0px ${p.shadow}`,
                }}
              >
                <RichText text={item.text} />
              </View>
              {item.actions?.map((a) => (
                <ProposalCard key={a.id} action={a} color={member.color} onApprove={() => decide(item, a, true)} onDecline={() => decide(item, a, false)} />
              ))}
              <Row gap={8} style={{ marginTop: 4, marginLeft: 4 }}>
                <Txt variant="tiny">{shortTime(item.at)}</Txt>
                {preview ? <Badge text="Preview reply" color={p.card2} textColor={p.muted} /> : null}
              </Row>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 60, borderBottomWidth: 1.5, borderBottomColor: p.line }}>
        <IconBtn icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <PressScale onPress={() => router.push({ pathname: '/teammate/[id]', params: { id: member.id } })} style={{ flex: 1 }} accessibilityLabel={`${member.name} settings`}>
          <Row gap={10}>
            <MemberPebble member={member} size={40} state={thinking ? 'working' : undefined} />
            <View style={{ flex: 1 }}>
              <Txt variant="h3" numberOfLines={1}>
                {member.name}
              </Txt>
              <Txt variant="tiny" numberOfLines={1} color={thinking ? p.signalText : p.muted}>
                {thinking ? 'Thinking…' : isHead ? 'Head of the family' : member.role}
              </Txt>
            </View>
          </Row>
        </PressScale>
        {settings.privateSession && <Ionicons name="eye-off-outline" size={18} color={p.signalText} accessibilityLabel="Private session on" />}
        <IconBtn icon="ellipsis-horizontal" label="Chat options" onPress={() => setMenu(true)} />
      </View>

      {settings.privateSession && (
        <View style={{ backgroundColor: p.stone, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Txt variant="small" color={p.onStone}>
            Private session. Nothing from this chat is saved or remembered.
          </Txt>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }}>
              <MemberPebble member={member} size={110} />
              <Txt variant="title" center style={{ marginTop: 18 }}>
                {member.name}
              </Txt>
              <Txt variant="body" center style={{ marginTop: 6, maxWidth: 300 }}>
                {templateFor(member.kind).blurb}
              </Txt>
              {guest && (
                <Txt variant="tiny" center style={{ marginTop: 10, maxWidth: 280 }}>
                  Preview mode: replies are samples. Make an account from Me to talk for real.
                </Txt>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                {starters.map((s) => (
                  <Chip key={s} label={s} onPress={() => send(s)} />
                ))}
              </View>
            </Animated.View>
          }
          ListFooterComponent={
            <>
              {thinking && (
                <Animated.View entering={FadeIn} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <MemberPebble member={member} size={30} state="working" />
                  <View style={{ backgroundColor: p.card, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16 }}>
                    <ThinkingDots color={member.color} />
                  </View>
                </Animated.View>
              )}
              {suggestedMemories.length > 0 && (
                <Animated.View entering={FadeInUp} style={{ backgroundColor: p.card2, borderRadius: 18, padding: 12, marginBottom: 12 }}>
                  <Row gap={8}>
                    <Ionicons name="bookmark-outline" size={16} color={p.text} />
                    <Txt variant="smallStrong">Remember this?</Txt>
                  </Row>
                  {suggestedMemories.map((m) => (
                    <Row key={m} gap={8} style={{ marginTop: 8 }}>
                      <Txt variant="small" color={p.text2} style={{ flex: 1 }}>
                        {m}
                      </Txt>
                      <Btn
                        title="Save"
                        small
                        onPress={() => {
                          addFact(m, 'you');
                          setSuggestedMemories((x) => x.filter((y) => y !== m));
                          toast('Saved to memory.');
                        }}
                      />
                      <IconBtn icon="close" label="Don't save" size={34} onPress={() => setSuggestedMemories((x) => x.filter((y) => y !== m))} />
                    </Row>
                  ))}
                  <Txt variant="tiny" style={{ marginTop: 8 }}>
                    Learning is off, so nothing is remembered unless you say so.
                  </Txt>
                </Animated.View>
              )}
            </>
          }
        />

        {capped ? (
          <View style={{ padding: 16, gap: 10, borderTopWidth: 1.5, borderTopColor: p.line }}>
            <Txt variant="bodyStrong">That's today's {limit} messages on Free.</Txt>
            <Row gap={8}>
              {rewardedAvailable && (
                <Btn
                  title="Watch an ad for 10 more"
                  small
                  variant="ghost"
                  icon="play-circle-outline"
                  onPress={async () => {
                    const ok = await showRewarded();
                    if (ok) {
                      useFamily.setState((s) => ({ usage: { ...s.usage, messages: Math.max(0, s.usage.messages - 10) } }));
                      toast('10 more messages today. Thanks for watching.');
                    }
                  }}
                />
              )}
              <Btn title="See Plus" small variant="signal" onPress={() => router.push('/plus')} />
            </Row>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1.5, borderTopColor: p.line }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`Message ${member.name}`}
              placeholderTextColor={p.muted}
              multiline
              style={{
                flex: 1,
                minHeight: 46,
                maxHeight: 140,
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
              accessibilityLabel={`Message ${member.name}`}
              maxFontSizeMultiplier={1.3}
            />
            <PressScale onPress={() => send()} disabled={!text.trim() || thinking} accessibilityLabel="Send">
              <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: text.trim() ? member.color : p.card2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-up" size={22} color={text.trim() ? '#1E2023' : p.muted} />
              </View>
            </PressScale>
          </View>
        )}
        {settings.tier === 'free' && !capped && used > limit * 0.6 ? (
          <Txt variant="tiny" center style={{ paddingBottom: 6 }}>
            {limit - used} messages left today
          </Txt>
        ) : null}
      </KeyboardAvoidingView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={`${member.name}`}>
        <ListRow
          icon="person-circle-outline"
          title="Teammate settings"
          sub="Name, look, personality and permissions"
          onPress={() => {
            setMenu(false);
            router.push({ pathname: '/teammate/[id]', params: { id: member.id } });
          }}
        />
        <ListRow
          icon={settings.privateSession ? 'eye-outline' : 'eye-off-outline'}
          title={settings.privateSession ? 'End private session' : 'Start a private session'}
          sub={settings.privateSession ? 'Messages from this session will be thrown away' : 'Nothing saved, nothing remembered'}
          onPress={() => {
            setSettings({ privateSession: !settings.privateSession });
            setMenu(false);
            toast(settings.privateSession ? 'Private session ended. Those messages are gone.' : 'Private session on.');
          }}
        />
        <ListRow
          icon="trash-outline"
          title="Clear this chat"
          sub="Removes it from your phone"
          danger
          onPress={() => {
            clearChat(member.id);
            setMenu(false);
            toast('Chat cleared.');
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}
