/**
 * The Crew Room screen: watch your teammates work, tap one to see what
 * they're up to, tap a station to jump there, and decorate the place.
 */
import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { isoDate } from '@/lib/dates';
import { useCrew } from '@/lib/store';
import { CrewRoom, placeCrew, STATION_INFO, todNow, type Station } from '@/components/CrewRoom';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Badge, Btn, Card, haptic, Label, PressScale, Row, Screen, Segmented, Sheet, Toggle, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { textOn } from '@/theme/tokens';

const WALLS = ['#E4D8C5', '#DCE6EC', '#E9DCE6', '#DDE6D5', '#F0E2C8', '#2E3440'];
const RUGS = ['#557C9C', '#B85C4B', '#6E9E45', '#9C7BC2', '#D9A441', '#3E4A57'];
const CURTAINS = ['#9CC7E8', '#F2C94C', '#FF8FB1', '#8FCB5A', '#E6DFD2', '#C3A3F7'];

const TOD_WORD = { morning: 'Morning', day: 'Afternoon', evening: 'Evening', night: 'Night' } as const;

const STATE_WORD = { idle: 'Relaxing', working: 'Working', waiting: 'Needs you', done: 'Just finished' } as const;

export default function Room() {
  const p = useTheme();
  const { height: winH } = useWindowDimensions();
  const members = useCrew((s) => s.members);
  const leadId = useCrew((s) => s.leadId);
  const decor = useCrew((s) => s.room);
  const setRoom = useCrew((s) => s.setRoom);
  const tier = useCrew((s) => s.settings.tier);
  const blocks = useCrew((s) => s.blocks);
  const [selected, setSelected] = useState<string | null>(null);
  const [decorating, setDecorating] = useState(false);

  const today = isoDate();
  const notes = blocks.filter((b) => b.date === today && !b.done).length;
  const roomH = Math.max(280, Math.min(420, winH * 0.46));
  const tod = decor.time === 'auto' ? todNow() : decor.time;
  const places = useMemo(() => placeCrew(members, leadId), [members, leadId]);
  const sel = members.find((m) => m.id === selected);
  const paid = tier !== 'free';

  const goStation = (s: Station) => {
    haptic('light');
    if (s === 'desk') router.push('/workbench');
    else if (s === 'shelf') router.push('/flashcards');
    else if (s === 'board') router.push('/planner');
    else router.push('/errand/new');
  };

  const swatches = (list: string[], value: string, onPick: (c: string) => void, label: string) => (
    <Row gap={10} wrap>
      {list.map((c) => (
        <PressScale key={c} onPress={() => onPick(c)} accessibilityLabel={`${label} ${c}`} accessibilityRole="radio">
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c, borderWidth: 3, borderColor: value === c ? p.text : p.line }} />
        </PressScale>
      ))}
    </Row>
  );

  return (
    <Screen ripples={false}>
      <BackHeader
        kicker={`${TOD_WORD[tod]} in the`}
        title="Crew Room"
        right={<Btn title="Decorate" small variant="ghost" icon="color-palette-outline" onPress={() => setDecorating(true)} />}
      />

      <Animated.View entering={FadeIn.duration(500)} style={{ marginTop: 8 }}>
        <CrewRoom
          members={members}
          leadId={leadId}
          decor={decor}
          notes={notes}
          height={roomH}
          selectedId={selected}
          onSelect={setSelected}
          onStation={goStation}
        />
      </Animated.View>

      {sel ? (
        <Animated.View key={sel.id} entering={FadeInDown.duration(250)}>
          <Card carve={0} style={{ marginTop: 14 }}>
            <Row gap={14}>
              <MemberPebble member={sel} size={58} />
              <View style={{ flex: 1 }}>
                <Txt variant="h2">{sel.name}</Txt>
                <Txt variant="smallStrong" color={textOn(p, sel.color)}>
                  {sel.id === leadId ? 'Crew lead' : sel.role}
                </Txt>
              </View>
              <Badge text={STATE_WORD[sel.state]} color={sel.state === 'waiting' ? p.signal : p.card2} textColor={sel.state === 'waiting' ? p.onSignal : p.text} />
            </Row>
            <Txt variant="body" style={{ marginTop: 10 }}>
              {sel.status}
              {places[sel.id]?.station ? ` · at the ${STATION_INFO[places[sel.id].station!].label.toLowerCase()}` : ''}
            </Txt>
            <Row gap={8} style={{ marginTop: 12 }} wrap>
              <Btn title={sel.state === 'waiting' ? 'See what they need' : `Message ${sel.name}`} small variant={sel.state === 'waiting' ? 'signal' : 'ink'} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: sel.id } })} />
              <Btn title="Customize" small variant="ghost" icon="color-palette-outline" onPress={() => router.push({ pathname: '/studio', params: { id: sel.id } })} />
            </Row>
          </Card>
        </Animated.View>
      ) : (
        <Txt variant="small" center style={{ marginTop: 14, marginHorizontal: 12 }}>
          Tap a pebble to see what they're doing. Tap the desk, bookshelf, board or table to jump there.
        </Txt>
      )}

      <Label>Who's where</Label>
      <Card carve={2} padding={8}>
        {members.map((m) => {
          const place = places[m.id];
          return (
            <PressScale key={m.id} onPress={() => setSelected(m.id)} accessibilityLabel={`${m.name}, ${STATE_WORD[m.state]}`}>
              <Row gap={12} style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
                <MemberPebble member={m} size={34} animate={false} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{m.name}</Txt>
                  <Txt variant="small" numberOfLines={1}>
                    {m.status}
                  </Txt>
                </View>
                <Txt variant="tiny">{place?.station ? STATION_INFO[place.station].label : STATE_WORD[m.state]}</Txt>
              </Row>
            </PressScale>
          );
        })}
      </Card>

      <Sheet visible={decorating} onClose={() => setDecorating(false)} title="Decorate">
        <Label style={{ marginTop: 4 }}>Walls</Label>
        {swatches(WALLS, decor.wall, (c) => setRoom({ wall: c }), 'Wall')}
        <Label>Rug</Label>
        {swatches(RUGS, decor.rug, (c) => setRoom({ rug: c }), 'Rug')}
        <Label>Curtains</Label>
        {swatches(CURTAINS, decor.curtains, (c) => setRoom({ curtains: c }), 'Curtains')}
        <Label>On the wall</Label>
        <Segmented
          options={[
            { id: 'photo', label: 'Crew photo' },
            { id: 'pennant', label: 'Pennant' },
            { id: 'none', label: 'Nothing' },
          ]}
          value={decor.art}
          onChange={(v) => setRoom({ art: v })}
        />
        <Label>Time of day</Label>
        <Segmented
          options={[
            { id: 'auto', label: 'Real' },
            { id: 'morning', label: 'Morn' },
            { id: 'day', label: 'Day' },
            { id: 'evening', label: 'Eve' },
            { id: 'night', label: 'Night' },
          ]}
          value={decor.time}
          onChange={(v) => setRoom({ time: v })}
        />
        <Row justify="space-between" style={{ marginTop: 18 }}>
          <Txt variant="bodyStrong">Plants</Txt>
          <Toggle value={decor.plants} onChange={(v) => setRoom({ plants: v })} label="Plants" />
        </Row>
        <Row justify="space-between" style={{ marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Txt variant="bodyStrong">String lights</Txt>
              {!paid && <Ionicons name="star" size={13} color={p.muted} />}
            </Row>
            <Txt variant="small">{paid ? 'They glow when it gets dark.' : 'A Plus extra.'}</Txt>
          </View>
          <Toggle
            value={decor.lights}
            onChange={(v) => {
              if (!paid) {
                toast('String lights come with Plus.', { label: 'See Plus', onPress: () => router.push('/plus') });
                return;
              }
              setRoom({ lights: v });
            }}
            label="String lights"
          />
        </Row>
        <Btn title="Done" variant="signal" full style={{ marginTop: 20 }} onPress={() => setDecorating(false)} />
      </Sheet>
    </Screen>
  );
}
