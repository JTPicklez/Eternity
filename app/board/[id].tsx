/**
 * A research board: pages saved for one goal or project. Ask a question
 * across everything on it, get a summary of the whole board, and keep a
 * note on each page. Page text is kept encrypted on the phone.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { askTeammate } from '@/lib/ai';
import { timeAgo } from '@/lib/dates';
import { wrapPage } from '@/lib/guard';
import { useCrew, useLead } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { RichText } from '@/components/RichText';
import { ThinkingDots } from '@/components/Thinking';
import { BackHeader, Btn, Card, Chip, Empty, Field, IconBtn, Label, PressScale, Row, Screen, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

function host(url: string) {
  return url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
}

export default function Board() {
  const p = useTheme();
  const lead = useLead();
  const { id } = useLocalSearchParams<{ id: string }>();
  const board = useCrew((s) => s.trails.find((t) => t.id === id));
  const removeTrailTab = useCrew((s) => s.removeTrailTab);
  const removeTrail = useCrew((s) => s.removeTrail);
  const updateTrailTab = useCrew((s) => s.updateTrailTab);
  const addReceipt = useCrew((s) => s.addReceipt);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);

  if (!board) {
    return (
      <Screen>
        <BackHeader />
        <Empty title="Board not found" />
      </Screen>
    );
  }

  const withText = board.tabs.filter((t) => t.text || t.summary || t.note);

  const ask = async (q: string) => {
    if (!withText.length) return toast('Save a few pages to this board first.');
    setThinking(true);
    setAnswer(null);
    const per = Math.max(1500, Math.floor(16000 / withText.length));
    const res = await askTeammate({
      member: lead,
      history: [],
      task: 'page',
      text: `This is my research board "${board.goal}". ${q}\n\nUse every page below, compare where it helps, and name which page each point comes from.\n\n${withText
        .map((t) => wrapPage({ title: t.title, url: t.url, text: [t.note ? `My note: ${t.note}` : '', t.text ?? t.summary ?? ''].filter(Boolean).join('\n') }, per))
        .join('\n\n')}`,
    });
    setAnswer(res.text || 'Nothing to add.');
    addReceipt({ memberId: lead.id, text: `Read ${withText.length} pages on "${board.goal}"`, connector: 'Browser', kind: 'read', undoable: false });
    setThinking(false);
  };

  return (
    <Screen>
      <BackHeader kicker="Research board" title={board.goal} right={<IconBtn icon="trash-outline" label="Delete board" onPress={() => setConfirm(true)} />} />

      <Card carve={1} style={{ marginTop: 8 }}>
        <Row gap={12}>
          <MemberPebble member={lead} size={44} state={thinking ? 'working' : 'idle'} />
          <Txt variant="small" style={{ flex: 1 }}>
            Ask anything across the {board.tabs.length} page{board.tabs.length === 1 ? '' : 's'} on this board.
          </Txt>
        </Row>
        <View style={{ marginTop: 12 }}>
          <Field value={question} onChangeText={setQuestion} placeholder="What do these say about…" onSubmitEditing={() => question.trim() && ask(question)} />
        </View>
        <Row gap={8} wrap style={{ marginTop: 10 }}>
          {['Summarize the board', 'Where do they disagree?', "What's missing?", 'Make me a plan from this'].map((q) => (
            <Chip key={q} label={q} small onPress={() => ask(q)} />
          ))}
        </Row>
        <Btn title="Ask" variant="signal" full style={{ marginTop: 12 }} disabled={!question.trim() || thinking} onPress={() => ask(question)} />
        {thinking ? (
          <Row gap={10} style={{ marginTop: 14 }}>
            <ThinkingDots color={lead.color} />
            <Txt variant="small">Reading the board…</Txt>
          </Row>
        ) : null}
        {answer ? (
          <Animated.View entering={FadeInUp} style={{ marginTop: 14, backgroundColor: p.card2, borderRadius: 16, padding: 14 }}>
            <RichText text={answer} />
          </Animated.View>
        ) : null}
      </Card>

      <Label>Pages</Label>
      {board.tabs.length === 0 ? (
        <Empty title="Nothing saved yet" body="Open a page in Browse and tap Save to board." />
      ) : (
        board.tabs.map((t, i) => (
          <Animated.View key={t.id} entering={FadeInDown.delay(Math.min(i, 8) * 40)}>
            <View style={{ marginBottom: 10, padding: 14, borderRadius: 18, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }}>
              <PressScale onPress={() => router.push({ pathname: '/browser', params: { open: t.url, at: String(Date.now()) } })} accessibilityLabel={`Open ${t.title}`}>
                <Row gap={8}>
                  <Ionicons name="document-text-outline" size={16} color={p.muted} />
                  <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
                    {t.title}
                  </Txt>
                  <Ionicons name="open-outline" size={16} color={p.muted} />
                </Row>
                <Txt variant="tiny" style={{ marginLeft: 24, marginTop: 2 }}>
                  {host(t.url)}
                  {t.savedAt ? ` · saved ${timeAgo(t.savedAt)}` : ''}
                  {t.text ? '' : ' · link only'}
                </Txt>
              </PressScale>
              {t.note ? (
                <Txt variant="small" style={{ marginTop: 8, marginLeft: 24 }}>
                  {t.note}
                </Txt>
              ) : null}
              <Row gap={4} style={{ marginTop: 6, marginLeft: 16 }}>
                <Btn
                  title={t.note ? 'Edit note' : 'Add a note'}
                  small
                  variant="quiet"
                  onPress={() => {
                    setNoteFor(t.id);
                    setNote(t.note ?? '');
                  }}
                />
                <Btn title="Remove" small variant="quiet" onPress={() => removeTrailTab(board.id, t.id)} />
              </Row>
            </View>
          </Animated.View>
        ))
      )}

      <Sheet visible={!!noteFor} onClose={() => setNoteFor(null)} title="Your note">
        <Field value={note} onChangeText={setNote} placeholder="Why this page matters" multiline autoFocus />
        <Btn
          title="Save note"
          variant="signal"
          full
          style={{ marginTop: 12 }}
          onPress={() => {
            if (noteFor) updateTrailTab(board.id, noteFor, { note: note.trim() });
            setNoteFor(null);
          }}
        />
      </Sheet>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Delete this board?">
        <Txt variant="body">The saved pages and notes on it are deleted from this phone.</Txt>
        <Row gap={8} style={{ marginTop: 16 }}>
          <Btn
            title="Delete"
            variant="danger"
            onPress={() => {
              removeTrail(board.id);
              setConfirm(false);
              router.back();
            }}
          />
          <Btn title="Keep it" variant="ghost" onPress={() => setConfirm(false)} />
        </Row>
      </Sheet>
    </Screen>
  );
}
