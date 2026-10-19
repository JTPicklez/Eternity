/**
 * Flashcards with real math, hints, worked steps and spaced repetition.
 * Study shows what's due today plus a few new cards; Practice all runs the
 * whole deck without changing the schedule.
 */
import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useCrew } from '@/lib/store';
import { deckStats, previewLabel, studyQueue, type Grade } from '@/lib/srs';
import type { Flashcard } from '@/lib/types';
import { MathText } from '@/components/MathText';
import { BackHeader, Btn, Card, Empty, haptic, PressScale, ProgressBar, Row, Screen, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved, fonts, memberColors } from '@/theme/tokens';

function FlipCard({ card, flipped, onFlip }: { card: Flashcard; flipped: boolean; onFlip: () => void }) {
  const p = useTheme();
  const { width } = useWindowDimensions();
  const r = useSharedValue(0);
  React.useEffect(() => {
    r.value = withSpring(flipped ? 180 : 0, { damping: 14, stiffness: 120 });
  }, [flipped, r]);
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${r.value}deg` }],
    opacity: interpolate(r.value, [0, 89, 90, 180], [1, 1, 0, 0]),
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${r.value - 180}deg` }],
    opacity: interpolate(r.value, [0, 89, 90, 180], [0, 0, 1, 1]),
  }));
  const h = Math.min(300, Math.max(220, width * 0.62));
  const face = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: h,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 32,
    borderBottomLeftRadius: 20,
    padding: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backfaceVisibility: 'hidden' as const,
  };
  return (
    <PressScale onPress={onFlip} accessibilityLabel={flipped ? 'Answer side. Tap to see the question.' : 'Question side. Tap to flip.'}>
      <View style={{ height: h }}>
        <Animated.View style={[face, { backgroundColor: p.card, boxShadow: `0px 4px 0px ${p.shadow}` }, frontStyle]} pointerEvents={flipped ? 'none' : 'auto'}>
          <Txt variant="label" style={{ position: 'absolute', top: 16 }}>
            Question
          </Txt>
          {!flipped && <MathText text={card.front} variant="h2" center />}
          <Txt variant="tiny" style={{ position: 'absolute', bottom: 14 }}>
            Tap to flip
          </Txt>
        </Animated.View>
        <Animated.View style={[face, { backgroundColor: p.stone }, backStyle]} pointerEvents={flipped ? 'auto' : 'none'}>
          <Txt variant="label" color={p.onStoneMuted} style={{ position: 'absolute', top: 16 }}>
            Answer
          </Txt>
          {flipped && <MathText text={card.back} variant="h2" center color={p.onStone} />}
        </Animated.View>
      </View>
    </PressScale>
  );
}

const GRADES: { id: Grade; label: string; variant: 'ghost' | 'signal' | 'ink' }[] = [
  { id: 'again', label: 'Again', variant: 'ghost' },
  { id: 'hard', label: 'Hard', variant: 'ghost' },
  { id: 'good', label: 'Good', variant: 'signal' },
  { id: 'easy', label: 'Easy', variant: 'ink' },
];

export default function Flashcards() {
  const p = useTheme();
  const cards = useCrew((s) => s.flashcards);
  const removeDeck = useCrew((s) => s.removeDeck);
  const resetDeck = useCrew((s) => s.resetDeck);
  const gradeCard = useCrew((s) => s.gradeCard);
  const decks = useMemo(() => [...new Set(cards.map((c) => c.deck))], [cards]);
  const [deck, setDeck] = useState<string | null>(null);
  const [mode, setMode] = useState<'study' | 'practice'>('study');
  const [queue, setQueue] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [steps, setSteps] = useState(true);
  const [tally, setTally] = useState({ knew: 0, again: 0 });
  const [menu, setMenu] = useState<string | null>(null);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const card = queue[i] ? byId.get(queue[i]) : undefined;

  const start = (d: string, m: 'study' | 'practice') => {
    const list = cards.filter((c) => c.deck === d);
    const ids = (m === 'study' ? studyQueue(list) : list).map((c) => c.id);
    if (!ids.length) {
      toast('Nothing due right now. Nice. Practice all if you want a run anyway.', { label: 'Practice', onPress: () => start(d, 'practice') });
      return;
    }
    setDeck(d);
    setMode(m);
    setQueue(ids);
    setI(0);
    setFlipped(false);
    setHint(false);
    setTally({ knew: 0, again: 0 });
  };

  const answer = (grade: Grade) => {
    if (!card) return;
    haptic(grade === 'again' ? 'light' : 'success');
    if (mode === 'study') gradeCard(card.id, grade);
    if (grade === 'again') {
      setTally((t) => ({ ...t, again: t.again + 1 }));
      // See it again before the session ends.
      setQueue((q) => (q.slice(i + 1).includes(card.id) ? q : [...q, card.id]));
    } else setTally((t) => ({ ...t, knew: t.knew + 1 }));
    setFlipped(false);
    setHint(false);
    setTimeout(() => setI((x) => x + 1), 120);
  };

  if (!deck) {
    return (
      <Screen>
        <BackHeader title="Flashcards" />
        {decks.length === 0 ? (
          <Empty
            title="No decks yet"
            body="Ask a teammate to make some, or tap Flashcards on any page in Eternity Browser."
            action={<Btn title="Open Browse" small onPress={() => router.push('/browser')} />}
          />
        ) : (
          decks.map((d, k) => {
            const st = deckStats(cards.filter((c) => c.deck === d));
            return (
              <Animated.View key={d} entering={FadeInDown.delay(k * 60)}>
                <View
                  style={[
                    carved[k % 4],
                    {
                      marginTop: 12,
                      padding: 16,
                      backgroundColor: p.card,
                      borderLeftWidth: 6,
                      borderLeftColor: [memberColors.lilac, memberColors.water, memberColors.moss, memberColors.sun][k % 4],
                      boxShadow: `0px 2px 0px ${p.shadow}`,
                    },
                  ]}
                >
                  <Row justify="space-between" align="flex-start">
                    <View style={{ flex: 1 }}>
                      <Txt variant="h3">{d}</Txt>
                      <Txt variant="small">
                        {st.total} cards · {st.due} due · {st.fresh} new · {st.mastered} mastered
                      </Txt>
                    </View>
                    <PressScale onPress={() => setMenu(d)} accessibilityLabel={`More for ${d}`}>
                      <Ionicons name="ellipsis-horizontal" size={20} color={p.muted} />
                    </PressScale>
                  </Row>
                  <View style={{ marginTop: 10 }}>
                    <ProgressBar value={st.total ? st.mastered / st.total : 0} color={memberColors.moss} height={6} />
                  </View>
                  <Row gap={8} style={{ marginTop: 12 }}>
                    <Btn title={st.due + Math.min(st.fresh, 20) ? `Study ${st.due + Math.min(st.fresh, 20)}` : 'All caught up'} small icon="play" disabled={!(st.due + st.fresh)} onPress={() => start(d, 'study')} />
                    <Btn title="Practice all" small variant="ghost" onPress={() => start(d, 'practice')} />
                  </Row>
                </View>
              </Animated.View>
            );
          })
        )}
        <Txt variant="small" center style={{ marginTop: 18, marginHorizontal: 12 }}>
          Cards you know come back less often. Missed ones come back in 10 minutes.
        </Txt>

        <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu ?? ''}>
          <Btn
            title="Start this deck over"
            variant="ghost"
            full
            icon="refresh"
            onPress={() => {
              if (menu) resetDeck(menu);
              toast('Progress reset. Every card is new again.');
              setMenu(null);
            }}
          />
          <Btn
            title="Delete deck"
            variant="danger"
            full
            style={{ marginTop: 10 }}
            onPress={() => {
              if (menu) removeDeck(menu);
              toast(`Deleted "${menu}".`);
              setMenu(null);
            }}
          />
        </Sheet>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title={deck} kicker={mode === 'study' ? 'Study' : 'Practice all'} onBack={() => setDeck(null)} />
      <View style={{ marginTop: 8 }}>
        <ProgressBar value={queue.length ? Math.min(i, queue.length) / queue.length : 0} color={memberColors.lilac} />
        <Txt variant="mono" style={{ marginTop: 6 }}>
          {Math.min(i + 1, queue.length)} / {queue.length}
        </Txt>
      </View>
      {card ? (
        <Animated.View key={`${card.id}-${i}`} entering={FadeIn.duration(250)} style={{ marginTop: 18 }}>
          <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />

          {!flipped && card.hint ? (
            hint ? (
              <Animated.View entering={FadeIn}>
                <Card tone="soft" carve={1} padding={14} style={{ marginTop: 14 }}>
                  <Row gap={8} align="flex-start">
                    <Ionicons name="bulb-outline" size={18} color={p.text} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <MathText text={card.hint} />
                    </View>
                  </Row>
                </Card>
              </Animated.View>
            ) : (
              <Btn title="Need a hint?" variant="quiet" small icon="bulb-outline" style={{ alignSelf: 'center', marginTop: 10 }} onPress={() => setHint(true)} />
            )
          ) : null}

          {flipped && card.steps?.length ? (
            <Animated.View entering={FadeIn}>
              <PressScale onPress={() => setSteps((s) => !s)} accessibilityLabel={steps ? 'Hide worked steps' : 'Show worked steps'}>
                <Row gap={6} style={{ marginTop: 16, marginBottom: 6, paddingHorizontal: 4 }}>
                  <Txt variant="label">Worked steps</Txt>
                  <Ionicons name={steps ? 'chevron-up' : 'chevron-down'} size={14} color={p.muted} />
                </Row>
              </PressScale>
              {steps && (
                <Card carve={2} padding={12}>
                  {card.steps.map((st, k) => (
                    <Row key={k} gap={10} align="flex-start" style={{ paddingVertical: 6 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 8, backgroundColor: p.card2, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                        <Txt variant="tiny" style={{ fontFamily: fonts.monoMedium, color: p.text }}>
                          {k + 1}
                        </Txt>
                      </View>
                      <View style={{ flex: 1 }}>
                        <MathText text={st} />
                      </View>
                    </Row>
                  ))}
                </Card>
              )}
            </Animated.View>
          ) : null}

          {flipped ? (
            mode === 'study' ? (
              <Row gap={8} style={{ marginTop: 18 }}>
                {GRADES.map((g) => (
                  <View key={g.id} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <Btn title={g.label} variant={g.variant} small full onPress={() => answer(g.id)} />
                    <Txt variant="tiny">{previewLabel(card, g.id)}</Txt>
                  </View>
                ))}
              </Row>
            ) : (
              <Row gap={10} style={{ marginTop: 18 }}>
                <Btn title="Again" variant="ghost" icon="refresh" style={{ flex: 1 }} full onPress={() => answer('again')} />
                <Btn title="Got it" variant="signal" icon="checkmark" style={{ flex: 1 }} full onPress={() => answer('good')} />
              </Row>
            )
          ) : (
            <Btn title="Show answer" variant="ink" full style={{ marginTop: 18 }} onPress={() => setFlipped(true)} />
          )}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown}>
          <Card carve={1} style={{ marginTop: 20, alignItems: 'center' }}>
            <Ionicons name="trophy-outline" size={40} color={memberColors.sun} />
            <Txt variant="title" style={{ marginTop: 10 }}>
              {mode === 'study' ? 'Done for today.' : 'Deck done.'}
            </Txt>
            <Txt variant="body" center style={{ marginTop: 6 }}>
              You knew {tally.knew}. {tally.again ? `${tally.again} came back around.` : 'Clean sweep.'}
              {mode === 'study' ? ' The ones you missed will be back soon.' : ''}
            </Txt>
            <Row gap={8} style={{ marginTop: 16 }}>
              <Btn title="Practice all" variant="ghost" onPress={() => start(deck, 'practice')} />
              <Btn title="All decks" onPress={() => setDeck(null)} />
            </Row>
          </Card>
        </Animated.View>
      )}
    </Screen>
  );
}
