/**
 * Everything your Crew has built for you: little apps, trackers, charts and
 * pages. Ask for a new one here or in any chat.
 */
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { newArtifact } from '@/lib/artifacts';
import { timeAgo } from '@/lib/dates';
import { memberOrTemplate, useCrew, useLead } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { ThinkingDots } from '@/components/Thinking';
import { BackHeader, Btn, Card, Chip, Empty, Field, haptic, Label, PressScale, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

const IDEAS = ['A habit tracker for my goals', "A countdown to my next exam that reads this week's plan", 'A tip and split calculator', 'A flashcard progress chart', 'A pomodoro timer with my Crew colors'];

export default function Artifacts() {
  const p = useTheme();
  const lead = useLead();
  const members = useCrew((s) => s.members);
  const artifacts = useCrew((s) => s.artifacts);
  const addArtifact = useCrew((s) => s.addArtifact);
  const [builderId, setBuilderId] = useState(lead.id);
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const builder = members.find((m) => m.id === builderId) ?? lead;

  const make = async (what: string) => {
    if (!what.trim()) return;
    setBusy(true);
    try {
      const out = await newArtifact(builder, what.trim());
      if (!out) return toast(`${builder.name} couldn't build that one. Try describing it another way.`);
      const a = addArtifact({ title: out.title || what.trim().slice(0, 40), memberId: builder.id, uses: out.uses ?? [], html: out.html, note: 'First version' });
      haptic('success');
      setIdea('');
      router.push({ pathname: '/artifact/[id]', params: { id: a.id } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackHeader kicker="Built by your Crew" title="Artifacts" />
      <Txt variant="body" style={{ marginTop: 4 }}>
        Small apps, trackers and charts that run right here. Point at any part to change it, and every version is kept.
      </Txt>

      <Card carve={0} style={{ marginTop: 14 }}>
        <Txt variant="smallStrong">Who builds it</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
          {members.map((m) => (
            <PressScale key={m.id} onPress={() => setBuilderId(m.id)} accessibilityLabel={`${m.name} builds it`} accessibilityRole="radio">
              <View style={{ alignItems: 'center', width: 60, opacity: builderId === m.id ? 1 : 0.5 }}>
                <MemberPebble member={m} size={38} animate={builderId === m.id} />
                <Txt variant="tiny" numberOfLines={1} style={{ marginTop: 4 }}>
                  {m.name}
                </Txt>
              </View>
            </PressScale>
          ))}
        </ScrollView>
        <Field value={idea} onChangeText={setIdea} placeholder="What should it be?" multiline />
        <Row gap={8} wrap style={{ marginTop: 10 }}>
          {IDEAS.map((i) => (
            <Chip key={i} label={i} small onPress={() => setIdea(i)} />
          ))}
        </Row>
        {busy ? (
          <Row gap={10} style={{ marginTop: 14 }}>
            <MemberPebble member={builder} size={30} state="working" />
            <Txt variant="small" style={{ flex: 1 }}>
              {builder.name} is building it. Bigger ones take a minute.
            </Txt>
            <ThinkingDots color={builder.color} />
          </Row>
        ) : (
          <Btn title={`Have ${builder.name} build it`} variant="signal" full icon="construct-outline" style={{ marginTop: 14 }} disabled={!idea.trim()} onPress={() => make(idea)} />
        )}
      </Card>

      <Label>{artifacts.length ? `${artifacts.length} built` : 'Nothing built yet'}</Label>
      {artifacts.length === 0 ? (
        <Empty title="Your first one is a sentence away" body="Ask for anything small: a tracker, a calculator, a chart of your week." />
      ) : (
        artifacts.map((a, i) => {
          const m = memberOrTemplate(a.memberId, members);
          const v = a.versions[a.versions.length - 1];
          return (
            <Animated.View key={a.id} entering={FadeInDown.delay(Math.min(i, 8) * 40)}>
              <PressScale onPress={() => router.push({ pathname: '/artifact/[id]', params: { id: a.id } })} accessibilityLabel={a.title}>
                <View style={[carved[i % 4], { marginBottom: 10, padding: 14, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                  <Row gap={12}>
                    <MemberPebble member={m} size={36} animate={false} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="h3" numberOfLines={1}>
                        {a.title}
                      </Txt>
                      <Txt variant="tiny">
                        {a.versions.length} version{a.versions.length === 1 ? '' : 's'} · updated {timeAgo(v.at)}
                      </Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={p.muted} />
                  </Row>
                </View>
              </PressScale>
            </Animated.View>
          );
        })
      )}
    </Screen>
  );
}
