import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CONNECTORS, PACKS } from '@/lib/catalog';
import { isLocal, refreshConnectors } from '@/lib/connectors';
import { useCrew } from '@/lib/store';
import { BackHeader, Badge, Chip, Field, haptic, Label, Mono, PressScale, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

const CATEGORIES = ['All', 'Everyone', 'Student', 'Developer', 'Athlete', 'Creator', 'Founder', 'Writer', 'Teams', 'Campus', 'Research', 'Sports', 'Civic', 'Money', 'Home'];

export default function Connect() {
  const p = useTheme();
  const connected = useCrew((s) => s.connected);
  const live = useCrew((s) => s.live);
  const guest = useCrew((s) => s.guest);
  useEffect(() => {
    if (!guest) refreshConnectors();
  }, [guest]);
  const toggle = useCrew((s) => s.toggleConnector);
  const packs = useCrew((s) => s.charter.packs);
  const setCharter = useCrew((s) => s.setCharter);
  const tier = useCrew((s) => s.settings.tier);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  const list = useMemo(
    () =>
      CONNECTORS.filter((c) => (cat === 'All' || c.category === cat) && (!q.trim() || `${c.name} ${c.blurb}`.toLowerCase().includes(q.toLowerCase()))),
    [cat, q],
  );

  return (
    <Screen>
      <BackHeader kicker={`${connected.length} connected`} title="Connections" />
      <Txt variant="body" style={{ marginTop: 4 }}>
        Every connection shows exactly what your Crew can read and do. Tap one to set its limits.
      </Txt>

      <Label>Packs</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {PACKS.map((pk, i) => {
          const on = packs.includes(pk.id);
          return (
            <PressScale
              key={pk.id}
              onPress={() => {
                if (on) {
                  setCharter({ packs: packs.filter((x) => x !== pk.id) });
                  return;
                }
                setCharter({ packs: [...packs, pk.id] });
                pk.connectors.forEach((c) => {
                  const def = CONNECTORS.find((x) => x.id === c);
                  if (def && !def.unavailable && !(def.plusOnly && tier === 'free') && !useCrew.getState().connected.includes(c)) toggle(c);
                });
                haptic('success');
                toast(`${pk.name} pack added.`);
              }}
              accessibilityLabel={`${pk.name} pack`}
            >
              <View style={[carved[i % 4], { width: 150, padding: 14, backgroundColor: on ? pk.color : p.card, boxShadow: on ? undefined : `0px 2px 0px ${p.shadow}` }]}>
                <Row justify="space-between">
                  <Ionicons name={pk.icon as never} size={20} color={on ? '#1E2023' : p.text} />
                  {on && <Ionicons name="checkmark-circle" size={18} color="#1E2023" />}
                </Row>
                <Txt variant="h3" color={on ? '#1E2023' : undefined} style={{ marginTop: 8 }}>
                  {pk.name}
                </Txt>
                <Txt variant="tiny" color={on ? '#2A2622' : undefined} numberOfLines={2}>
                  {pk.blurb}
                </Txt>
              </View>
            </PressScale>
          );
        })}
      </ScrollView>

      <Label>All connections</Label>
      <Field placeholder="Search connections" value={q} onChangeText={setQ} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 10 }}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} small selected={cat === c} onPress={() => setCat(c)} />
        ))}
      </ScrollView>
      <View style={{ gap: 8 }}>
        {list.map((c, i) => {
          const on = connected.includes(c.id);
          const isLive = !!live[c.id] || (on && isLocal(c.id));
          return (
            <Animated.View key={c.id} entering={FadeInDown.delay(Math.min(i, 10) * 30)}>
              <PressScale onPress={() => router.push({ pathname: '/connector/[id]', params: { id: c.id } })} accessibilityLabel={`${c.name}${on ? ', connected' : ''}`}>
                <View style={[carved[i % 4], { padding: 12, backgroundColor: p.card, opacity: c.unavailable ? 0.6 : 1, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                  <Row gap={12}>
                    <Mono text={c.mono} on={on} />
                    <View style={{ flex: 1 }}>
                      <Row gap={6}>
                        <Txt variant="bodyStrong">{c.name}</Txt>
                        {c.plusOnly && <Badge text="Plus" color={p.card2} textColor={p.text} />}
                        {isLive ? <Badge text="Live" color={p.success} textColor="#FFFFFF" /> : on ? <Badge text="Sample" color={p.card2} textColor={p.muted} /> : c.beta ? <Badge text="Beta" color={p.card2} textColor={p.muted} /> : null}
                      </Row>
                      <Txt variant="small" numberOfLines={2}>
                        {c.unavailable ?? c.blurb}
                      </Txt>
                    </View>
                    {on ? <Ionicons name="checkmark-circle" size={22} color={p.success} /> : <Ionicons name="chevron-forward" size={18} color={p.muted} />}
                  </Row>
                </View>
              </PressScale>
            </Animated.View>
          );
        })}
      </View>
      <Txt variant="tiny" center style={{ marginTop: 16 }}>
        Live means your real data. Sample means it's on with practice data until you sign in.
      </Txt>
    </Screen>
  );
}
