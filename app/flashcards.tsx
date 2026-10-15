import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useFamily } from '@/lib/store';
import { BackHeader, Btn, Card, Empty, haptic, PressScale, ProgressBar, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved, memberColors } from '@/theme/tokens';

function FlipCard({ front, back, flipped, onFlip }: { front: string; back: string; flipped: boolean; onFlip: () => void }) {
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
  const h = Math.min(300, width * 0.7);
  const face = { position: 'absolute' as const, left: 0, right: 0, height: h, borderTopLeftRadius: 30, borderTopRightRadius: 22, borderBottomRightRadius: 32, borderBottomLeftRadius: 20, padding: 24, alignItems: 'center' as const, justifyContent: 'center' as const, backfaceVisibility: 'hidden' as const };
  return (
    <PressScale onPress={onFlip} accessibilityLabel={flipped ? `Answer: ${back}` : `Question: ${front}. Tap to flip.`}>
      <View style={{ height: h }}>
        <Animated.View style={[face, { backgroundColor: p.card, boxShadow: `0px 4px 0px ${p.shadow}` }, frontStyle]}>
          <Txt variant="label">Question</Txt>
          <Txt variant="h2" center style={{ marginTop: 12 }}>
            {front}
          </Txt>
          <Txt variant="tiny" style={{ position: 'absolute', bottom: 16 }}>
            Tap to flip
          </Txt>
        </Animated.View>
        <Animated.View style={[face, { backgroundColor: p.stone }, backStyle]}>
          <Txt variant="label" color={p.onStoneMuted}>
            Answer
          </Txt>
          <Txt variant="h2" center color={p.onStone} style={{ marginTop: 12 }}>
            {back}
          </Txt>
        </Animated.View>
      </View>
    </PressScale>
  );
}

export default function Flashcards() {
  const p = useTheme();
  const cards = useFamily((s) => s.flashcards);
  const removeDeck = useFamily((s) => s.removeDeck);
  const decks = useMemo(() => [...new Set(cards.map((c) => c.deck))], [cards]);
  const [deck, setDeck] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [again, setAgain] = useState<string[]>([]);
  const [knew, setKnew] = useState(0);

  const list = useMemo(() => cards.filter((c) => c.deck === deck), [cards, deck]);
  const queue = useMemo(() => [...list, ...list.filter((c) => again.includes(c.id))], [list, again]);
  const card = queue[i];

  const next = (gotIt: boolean) => {
    haptic(gotIt ? 'success' : 'light');
    if (gotIt) setKnew((k) => k + 1);
    else if (card && !again.includes(card.id)) setAgain((a) => [...a, card.id]);
    setFlipped(false);
    setTimeout(() => setI((x) => x + 1), 120);
  };

  if (!deck) {
    return (
      <Screen>
        <BackHeader title="Flashcards" />
        {decks.length === 0 ? (
          <Empty title="No decks yet" body="Ask Sage to make some, or tap Flashcards on any page in Eternity Browser." action={<Btn title="Open Browse" small onPress={() => router.push('/browser')} />} />
        ) : (
          decks.map((d, k) => {
            const n = cards.filter((c) => c.deck === d).length;
            return (
              <Animated.View key={d} entering={FadeInDown.delay(k * 60)}>
                <View style={[carved[k % 4], { marginTop: 12, padding: 16, backgroundColor: p.card, borderLeftWidth: 6, borderLeftColor: [memberColors.lilac, memberColors.water, memberColors.moss, memberColors.sun][k % 4], boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                  <Txt variant="h3">{d}</Txt>
                  <Txt variant="small">{n} cards</Txt>
                  <Row gap={8} style={{ marginTop: 12 }}>
                    <Btn title="Study" small icon="play" onPress={() => { setDeck(d); setI(0); setAgain([]); setKnew(0); setFlipped(false); }} />
                    <Btn title="Delete" small variant="ghost" onPress={() => { removeDeck(d); toast(`Deleted "${d}".`); }} />
                  </Row>
                </View>
              </Animated.View>
            );
          })
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title={deck} onBack={() => setDeck(null)} />
      <View style={{ marginTop: 8 }}>
        <ProgressBar value={queue.length ? Math.min(i, queue.length) / queue.length : 0} color={memberColors.lilac} />
        <Txt variant="mono" style={{ marginTop: 6 }}>
          {Math.min(i + 1, queue.length)} / {queue.length}
        </Txt>
      </View>
      {card ? (
        <Animated.View key={`${card.id}-${i}`} entering={FadeIn.duration(250)} style={{ marginTop: 18 }}>
          <FlipCard front={card.front} back={card.back} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          {flipped ? (
            <Row gap={10} style={{ marginTop: 18 }}>
              <Btn title="Again" variant="ghost" icon="refresh" style={{ flex: 1 }} full onPress={() => next(false)} />
              <Btn title="Got it" variant="signal" icon="checkmark" style={{ flex: 1 }} full onPress={() => next(true)} />
            </Row>
          ) : (
            <Btn title="Show answer" variant="ink" full style={{ marginTop: 18 }} onPress={() => setFlipped(true)} />
          )}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown}>
          <Card carve={1} style={{ marginTop: 20, alignItems: 'center' }}>
            <Ionicons name="trophy-outline" size={40} color={memberColors.sun} />
            <Txt variant="title" style={{ marginTop: 10 }}>
              Deck done.
            </Txt>
            <Txt variant="body" center style={{ marginTop: 6 }}>
              You knew {knew} on the first try. {again.length ? `${again.length} came back around.` : 'Clean sweep.'}
            </Txt>
            <Row gap={8} style={{ marginTop: 16 }}>
              <Btn title="Again" variant="ghost" onPress={() => { setI(0); setAgain([]); setKnew(0); }} />
              <Btn title="All decks" onPress={() => setDeck(null)} />
            </Row>
          </Card>
        </Animated.View>
      )}
    </Screen>
  );
}
