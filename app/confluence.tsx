/**
 * Confluence: where two rivers meet. Your head teammate talks to a friend's
 * head teammate to plan something together, sharing only free times, never
 * your calendar, chats or memory.
 */
import React, { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { addDays, isoDate } from '@/lib/dates';
import { useFamily, useHead } from '@/lib/store';
import type { Confluence } from '@/lib/types';
import { MemberPebble, Pebble } from '@/components/Pebble';
import { BackHeader, Btn, Card, Empty, Field, haptic, Label, LiveDot, Row, Screen, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved, memberColors } from '@/theme/tokens';

function Negotiation({ c }: { c: Confluence }) {
  const p = useTheme();
  const head = useHead();
  const updateConfluence = useFamily((s) => s.updateConfluence);
  const addBlock = useFamily((s) => s.addBlock);
  const addReceipt = useFamily((s) => s.addReceipt);
  const [lines, setLines] = useState<{ who: string; color: string; text: string }[]>([]);

  useEffect(() => {
    if (c.status !== 'negotiating') return;
    const others = c.people;
    const script = [
      { who: head.name, color: head.color, text: 'Sharing free windows only: Tue after 6, Wed 3 to 5, Thu after 4.' },
      { who: others[0]?.head ?? 'Juno', color: others[0]?.color ?? memberColors.coral, text: `${others[0]?.name ?? 'Maya'} is free Tue 7 to 9 and Thu 4 to 6.` },
      { who: others[1]?.head ?? 'Atlas', color: others[1]?.color ?? memberColors.clay, text: `${others[1]?.name ?? 'Theo'} has lab Thursday until 5. Tuesday works.` },
      { who: head.name, color: head.color, text: 'Proposal: Tuesday 7:00 to 8:30 PM in the library, and Thursday 5:15 to 6:15 PM on a call.' },
    ];
    const timers = script.map((l, i) =>
      setTimeout(() => {
        setLines((x) => [...x, l]);
        haptic('select');
        if (i === script.length - 1) updateConfluence(c.id, { status: 'proposed', proposal: 'Tue 7:00–8:30 PM in the library · Thu 5:15–6:15 PM on a call' });
      }, 900 + i * 1600),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  const lock = () => {
    const tue = (() => {
      const d = new Date();
      const diff = (2 - d.getDay() + 7) % 7 || 7;
      return isoDate(addDays(d, diff));
    })();
    const thu = (() => {
      const d = new Date();
      const diff = (4 - d.getDay() + 7) % 7 || 7;
      return isoDate(addDays(d, diff));
    })();
    addBlock({ date: tue, time: '19:00', end: '20:30', title: c.name, sub: 'Library · with ' + c.people.map((x) => x.name).join(', '), kind: 'event', by: head.id });
    addBlock({ date: thu, time: '17:15', end: '18:15', title: `${c.name} (call)`, sub: 'Split the work', kind: 'event', by: head.id });
    addReceipt({ memberId: head.id, text: `Locked two meetings for ${c.name}`, connector: 'Confluence', kind: 'did', undoable: false });
    updateConfluence(c.id, { status: 'locked' });
    haptic('success');
    toast('Locked in for everyone.', undefined, head.color);
  };

  return (
    <View>
      {c.status === 'negotiating' && lines.length === 0 && (
        <Row gap={8} style={{ marginTop: 10 }}>
          <LiveDot color={p.signal} />
          <Txt variant="small">The heads are meeting…</Txt>
        </Row>
      )}
      {lines.map((l, i) => (
        <Animated.View key={i} entering={FadeInUp}>
          <Row gap={8} style={{ marginTop: 10 }} align="flex-start">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color, marginTop: 6 }} />
            <View style={{ flex: 1 }}>
              <Txt variant="smallStrong">{l.who}</Txt>
              <Txt variant="small" color={p.text2}>
                {l.text}
              </Txt>
            </View>
          </Row>
        </Animated.View>
      ))}
      {c.status === 'proposed' && (
        <Animated.View entering={ZoomIn.springify()}>
          <View style={{ marginTop: 14, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: p.text }}>
            <Txt variant="label">Proposal</Txt>
            <Txt variant="bodyStrong" style={{ marginTop: 4 }}>
              {c.proposal}
            </Txt>
            <Txt variant="tiny" style={{ marginTop: 4 }}>
              Everyone has to say yes. Nothing goes on anyone's calendar until then.
            </Txt>
            <Row gap={8} style={{ marginTop: 10 }}>
              <Btn title="Lock it in" small variant="signal" onPress={lock} />
              <Btn title="Try other times" small variant="ghost" onPress={() => updateConfluence(c.id, { status: 'negotiating' })} />
            </Row>
          </View>
        </Animated.View>
      )}
      {c.status === 'locked' && (
        <Row gap={8} style={{ marginTop: 12 }}>
          <Ionicons name="checkmark-circle" size={18} color={p.success} />
          <Txt variant="smallStrong" color={p.success}>
            Locked: {c.proposal}
          </Txt>
        </Row>
      )}
    </View>
  );
}

export default function ConfluenceScreen() {
  const p = useTheme();
  const head = useHead();
  const confluences = useFamily((s) => s.confluences);
  const addConfluence = useFamily((s) => s.addConfluence);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [friends, setFriends] = useState('');

  return (
    <Screen>
      <BackHeader kicker="When families meet" title="Confluence" />
      <Card tone="stone" carve={0} style={{ marginTop: 8 }}>
        <Row gap={0} style={{ marginBottom: 10 }}>
          <MemberPebble member={head} size={44} />
          <View style={{ marginLeft: -10 }}>
            <Pebble shape="almond" color={memberColors.coral} mark="spark" size={44} />
          </View>
          <View style={{ marginLeft: -10 }}>
            <Pebble shape="round" color={memberColors.clay} mark="chart" size={44} />
          </View>
        </Row>
        <Txt variant="h2" color={p.onStone}>
          Two rivers, one plan.
        </Txt>
        <Txt variant="body" color={p.onStoneMuted} style={{ marginTop: 6 }}>
          {head.name} meets your friends' heads to plan group projects, study sessions or trips. They trade free times only. Never calendars, chats or memory.
        </Txt>
        <Btn title="Start a Confluence" small variant="water" style={{ marginTop: 12 }} onPress={() => setOpen(true)} />
      </Card>

      <Label>Your confluences</Label>
      {confluences.length === 0 ? (
        <Empty title="None yet" body="Start one and send the invite to a friend on Eternity." />
      ) : (
        confluences.map((c, i) => (
          <Animated.View key={c.id} entering={FadeInDown.delay(i * 60)}>
            <View style={[carved[i % 4], { marginBottom: 12, padding: 14, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
              <Txt variant="h3">{c.name}</Txt>
              <Txt variant="small">{c.purpose}</Txt>
              <Row gap={6} wrap style={{ marginTop: 8 }}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: head.color }}>
                  <Txt variant="tiny" color="#1E2023">
                    You · {head.name}
                  </Txt>
                </View>
                {c.people.map((x) => (
                  <View key={x.name} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: x.color }}>
                    <Txt variant="tiny" color="#1E2023">
                      {x.name} · {x.head}
                    </Txt>
                  </View>
                ))}
              </Row>
              <Negotiation c={c} />
            </View>
          </Animated.View>
        ))
      )}
      <Txt variant="tiny" center style={{ marginTop: 10 }}>
        Preview build: friends' families are simulated until invites go live.
      </Txt>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Start a Confluence">
        <View style={{ gap: 10 }}>
          <Field placeholder="Name it (e.g. Bio lab group)" value={name} onChangeText={setName} />
          <Field placeholder="What should the heads figure out?" value={purpose} onChangeText={setPurpose} />
          <Field placeholder="Friends' first names, comma separated" value={friends} onChangeText={setFriends} />
        </View>
        <Btn
          title="Start and send invite"
          variant="signal"
          full
          style={{ marginTop: 14 }}
          disabled={!name.trim() || !friends.trim()}
          onPress={async () => {
            const names = friends.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 4);
            const heads = ['Juno', 'Atlas', 'Wren', 'Orin'];
            const colors = [memberColors.coral, memberColors.clay, memberColors.mist, memberColors.sun];
            addConfluence({ name: name.trim(), purpose: purpose.trim() || 'Find a time that works for everyone', people: names.map((n, i) => ({ name: n, color: colors[i % 4], head: heads[i % 4] })), status: 'negotiating' });
            setOpen(false);
            setName('');
            setPurpose('');
            setFriends('');
            Share.share({ message: `Join my Confluence "${name.trim()}" on Eternity. Our families will find a time that works.` }).catch(() => {});
          }}
        />
      </Sheet>
    </Screen>
  );
}
