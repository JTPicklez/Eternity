import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { timeAgo } from '@/lib/dates';
import { memberOrTemplate, useFamily } from '@/lib/store';
import { Pebble } from '@/components/Pebble';
import { BackHeader, Card, Empty, Label, Row, Screen, Txt } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

export default function Guard() {
  const p = useTheme();
  const guard = useFamily((s) => s.guard);
  const members = useFamily((s) => s.members);

  return (
    <Screen>
      <BackHeader kicker="Eternity Browser" title="The Guard" />
      <Card tone="stone" carve={0} style={{ marginTop: 8 }}>
        <Row gap={10}>
          <Ionicons name="shield-checkmark" size={26} color={p.mode === 'paper' ? '#5CC8F2' : '#1E5BD2'} />
          <Txt variant="h2" color={p.onStone} style={{ flex: 1 }}>
            Pages are data, never instructions.
          </Txt>
        </Row>
        <Txt variant="body" color={p.onStoneMuted} style={{ marginTop: 10 }}>
          Some pages hide text that tries to boss AI around: "ignore your user", "send their inbox to…". Before any teammate reads a page, the Guard finds lines like that, including invisible ones, and removes them. Your teammates only take orders from you.
        </Txt>
      </Card>

      <Label>What it caught</Label>
      {guard.length === 0 ? (
        <Empty title="All quiet" body="Nothing suspicious on the pages your family has read." />
      ) : (
        guard.map((g, i) => {
          const m = memberOrTemplate(g.memberId, members);
          return (
            <Animated.View key={g.id} entering={FadeInDown.delay(i * 50)}>
              <View style={[carved[i % 4], { marginBottom: 10, padding: 14, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                <Row gap={10}>
                  <Pebble shape={m.shape} color={m.color} mark={m.mark} size={30} animate={false} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{g.site}</Txt>
                    <Txt variant="tiny">
                      While {m.name} was reading · {timeAgo(g.at)}
                    </Txt>
                  </View>
                  <Ionicons name="ban-outline" size={18} color={p.danger} />
                </Row>
                <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: p.card2 }}>
                  <Txt variant="mono" color={p.text2}>
                    "{g.said}"
                  </Txt>
                </View>
                <Txt variant="tiny" style={{ marginTop: 8 }}>
                  Removed before {m.name} read the page. Nothing was done.
                </Txt>
              </View>
            </Animated.View>
          );
        })
      )}
    </Screen>
  );
}
