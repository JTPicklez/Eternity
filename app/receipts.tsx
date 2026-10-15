import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { shortTime } from '@/lib/dates';
import { memberOrTemplate, useFamily } from '@/lib/store';
import type { Receipt } from '@/lib/types';
import { Pebble } from '@/components/Pebble';
import { BackHeader, Btn, Empty, Label, Row, Screen, Segmented, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

function dayKey(at: number) {
  const d = new Date(at);
  const today = new Date();
  const y = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function Receipts() {
  const p = useTheme();
  const receipts = useFamily((s) => s.receipts);
  const members = useFamily((s) => s.members);
  const undoReceipt = useFamily((s) => s.undoReceipt);
  const [filter, setFilter] = useState<'all' | 'did' | 'read'>('all');

  const groups = useMemo(() => {
    const list = receipts.filter((r) => filter === 'all' || r.kind === filter);
    const map = new Map<string, Receipt[]>();
    list.forEach((r) => {
      const k = dayKey(r.at);
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    return [...map.entries()];
  }, [receipts, filter]);

  return (
    <Screen>
      <BackHeader kicker="Nothing happens silently" title="Receipts" />
      <Txt variant="body" style={{ marginTop: 4, marginBottom: 12 }}>
        Everything your family read or did, in order. Undo anything that can be undone.
      </Txt>
      <Segmented
        options={[
          { id: 'all', label: 'All' },
          { id: 'did', label: 'Did' },
          { id: 'read', label: 'Read' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {groups.length === 0 ? (
        <Empty title="No receipts yet" body="When a teammate reads or does something, it lands here." />
      ) : (
        groups.map(([day, list]) => (
          <View key={day}>
            <Label>{day}</Label>
            {list.map((r, i) => {
              const m = memberOrTemplate(r.memberId, members);
              return (
                <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(i, 8) * 30)}>
                  <View style={[carved[i % 4], { marginBottom: 8, padding: 12, backgroundColor: p.card, opacity: r.undone ? 0.55 : 1, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                    <Row gap={10} align="flex-start">
                      <Pebble shape={m.shape} color={m.color} mark={m.mark} face={m.face} size={30} animate={false} />
                      <View style={{ flex: 1 }}>
                        <Txt variant="body" style={{ textDecorationLine: r.undone ? 'line-through' : 'none' }}>
                          {r.text}
                        </Txt>
                        <Row gap={6} style={{ marginTop: 4 }}>
                          <Ionicons name={r.kind === 'read' ? 'eye-outline' : 'checkmark-done-outline'} size={13} color={p.muted} />
                          <Txt variant="tiny">
                            {m.name} · {r.connector} · {shortTime(r.at)}
                            {r.undone ? ' · undone' : ''}
                          </Txt>
                        </Row>
                      </View>
                      {r.undoable && !r.undone && (
                        <Btn
                          title="Undo"
                          small
                          variant="ghost"
                          onPress={() => {
                            undoReceipt(r.id);
                            toast('Undone.');
                          }}
                        />
                      )}
                    </Row>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        ))
      )}
    </Screen>
  );
}
