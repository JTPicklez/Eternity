import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ALWAYS_ASK, CONNECTORS } from '@/lib/catalog';
import { timeAgo } from '@/lib/dates';
import { useCrew, useMember } from '@/lib/store';
import type { ActionLevel, Autonomy } from '@/lib/types';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Badge, Btn, Card, Chip, Empty, Field, haptic, Label, PressScale, Row, Screen, Segmented, Sheet, StoneSlider, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { textOn } from '@/theme/tokens';

const LEVEL_ROWS: { key: string; label: string; sub: string }[] = [
  { key: 'read', label: 'Reading', sub: 'Your calendar, notes, assignments' },
  { key: 'plan', label: 'Planning', sub: 'Moving and adding blocks' },
  { key: 'draft', label: 'Drafting', sub: 'Messages, docs, flashcards' },
  { key: 'edit', label: 'Editing', sub: 'Changing things in your apps' },
];

export default function Teammate() {
  const p = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const member = useMember(id);
  const leadId = useCrew((s) => s.leadId);
  const connected = useCrew((s) => s.connected);
  const receipts = useCrew((s) => s.receipts);
  const updateMember = useCrew((s) => s.updateMember);
  const renameMember = useCrew((s) => s.renameMember);
  const removeMember = useCrew((s) => s.removeMember);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!member) {
    return (
      <Screen>
        <BackHeader />
        <Empty title="Not in your Crew" body="This teammate may have been removed." />
      </Screen>
    );
  }

  const isLead = member.id === leadId;
  const mine = receipts.filter((r) => r.memberId === member.id).slice(0, 5);
  const available = CONNECTORS.filter((c) => connected.includes(c.id));

  const saveName = (value: string) => {
    const r = renameMember(member.id, value);
    if (!r.ok) return setError(r.reason ?? '');
    haptic('success');
    setRenaming(false);
    toast(`Say hi to ${value.trim()}.`, undefined, member.color);
  };

  return (
    <Screen>
      <BackHeader
        right={<Btn title="Message" small onPress={() => router.push({ pathname: '/chat/[id]', params: { id: member.id } })} />}
      />
      <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', marginTop: 8 }}>
        <MemberPebble member={member} size={130} onPress={() => haptic('light')} />
        <PressScale
          onPress={() => {
            setName(member.name);
            setError('');
            setRenaming(true);
          }}
          accessibilityLabel={`Rename ${member.name}`}
        >
          <Row gap={8} style={{ marginTop: 16 }}>
            <Txt variant="title">{member.name}</Txt>
            <Ionicons name="create-outline" size={20} color={p.muted} />
          </Row>
        </PressScale>
        <Row gap={8} style={{ marginTop: 6 }}>
          <Txt variant="smallStrong" color={textOn(p, member.color)}>
            {isLead ? 'Crew lead' : member.role}
          </Txt>
          {member.name !== member.defaultName && <Badge text={`was ${member.defaultName}`} color={p.card2} textColor={p.muted} />}
        </Row>
        <Btn title="Customize in Pebble Studio" small variant="ghost" icon="color-palette-outline" style={{ marginTop: 14, alignSelf: 'center' }} onPress={() => router.push({ pathname: '/studio', params: { id: member.id } })} />
      </Animated.View>

      <Label>Their job</Label>
      <Card carve={2}>
        <Txt variant="bodyStrong">{member.role || 'No job written yet'}</Txt>
        <Txt variant="body" style={{ marginTop: 4 }}>
          {member.blurb || "Write what they're best at and they'll work that way."}
        </Txt>
        <Btn
          title="Edit their job"
          small
          variant="quiet"
          icon="create-outline"
          style={{ marginTop: 6 }}
          onPress={() => router.push({ pathname: '/studio', params: { id: member.id, tab: 'job' } })}
        />
      </Card>

      <Label>Personality</Label>
      <Card carve={0}>
        <Txt variant="smallStrong">How they talk to you</Txt>
        <View style={{ marginTop: 10 }}>
          <StoneSlider value={member.personality.tone} onChange={(v) => updateMember(member.id, { personality: { ...member.personality, tone: v } })} left="Gentle" right="Blunt" color={member.color} />
        </View>
        <Txt variant="smallStrong" style={{ marginTop: 18 }}>
          How much they say
        </Txt>
        <View style={{ marginTop: 10 }}>
          <StoneSlider value={member.personality.talk} onChange={(v) => updateMember(member.id, { personality: { ...member.personality, talk: v } })} left="Quiet" right="Chatty" color={member.color} />
        </View>
        <Txt variant="smallStrong" style={{ marginTop: 18 }}>
          How hard they push
        </Txt>
        <View style={{ marginTop: 10 }}>
          <StoneSlider value={member.personality.push} onChange={(v) => updateMember(member.id, { personality: { ...member.personality, push: v } })} left="Steady" right="Relentless" color={member.color} />
        </View>
      </Card>

      <Label>On their own</Label>
      <Segmented<Autonomy>
        options={[
          { id: 'suggest', label: 'Suggest' },
          { id: 'ask', label: 'Ask first' },
          { id: 'do', label: 'Just do it' },
        ]}
        value={member.autonomy}
        onChange={(v) => updateMember(member.id, { autonomy: v })}
      />
      <Card carve={1} style={{ marginTop: 12 }} padding={12}>
        {LEVEL_ROWS.map((row) => (
          <View key={row.key} style={{ paddingVertical: 8 }}>
            <Row justify="space-between">
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{row.label}</Txt>
                <Txt variant="tiny">{row.sub}</Txt>
              </View>
            </Row>
            <View style={{ marginTop: 8 }}>
              <Segmented<ActionLevel>
                options={[
                  { id: 'auto', label: 'Just do it' },
                  { id: 'tell', label: 'Do and tell' },
                  { id: 'ask', label: 'Ask me' },
                ]}
                value={member.actionLevels[row.key] ?? 'ask'}
                onChange={(v) => updateMember(member.id, { actionLevels: { ...member.actionLevels, [row.key]: v } })}
              />
            </View>
          </View>
        ))}
        <View style={{ marginTop: 8, padding: 12, borderRadius: 14, backgroundColor: p.card2 }}>
          <Row gap={8}>
            <Ionicons name="lock-closed" size={14} color={p.text} />
            <Txt variant="smallStrong">Always asks you, no matter what</Txt>
          </Row>
          {ALWAYS_ASK.map((a) => (
            <Txt key={a} variant="small" style={{ marginTop: 4, marginLeft: 22 }}>
              {a}
            </Txt>
          ))}
        </View>
      </Card>

      <Label>What they can reach</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {available.map((c) => {
          const on = member.connectors.includes(c.id);
          return (
            <Chip
              key={c.id}
              label={c.name}
              selected={on}
              color={on ? member.color : undefined}
              onPress={() => updateMember(member.id, { connectors: on ? member.connectors.filter((x) => x !== c.id) : [...member.connectors, c.id] })}
            />
          );
        })}
        <Chip label="Connect more" icon="add" onPress={() => router.push('/connect')} />
      </View>

      <Label>What wakes them up</Label>
      <Card carve={2} padding={12}>
        {member.triggers.map((t) => (
          <Row key={t} gap={10} style={{ paddingVertical: 6 }}>
            <Ionicons name="flash-outline" size={16} color={textOn(p, member.color)} />
            <Txt variant="body" style={{ flex: 1 }}>
              {t}
            </Txt>
          </Row>
        ))}
        <Btn title="Add a routine" small variant="quiet" icon="add" onPress={() => router.push({ pathname: '/routines', params: { member: member.id } })} />
      </Card>

      <Label>Recent receipts</Label>
      <Card carve={3} padding={12}>
        {mine.length === 0 ? (
          <Txt variant="small">Nothing yet. Everything {member.name} does shows up here.</Txt>
        ) : (
          mine.map((r) => (
            <Row key={r.id} gap={10} style={{ paddingVertical: 6 }} align="flex-start">
              <Ionicons name={r.kind === 'read' ? 'eye-outline' : 'checkmark-done-outline'} size={16} color={p.muted} style={{ marginTop: 3 }} />
              <View style={{ flex: 1 }}>
                <Txt variant="body" style={{ textDecorationLine: r.undone ? 'line-through' : 'none' }}>
                  {r.text}
                </Txt>
                <Txt variant="tiny">
                  {r.connector} · {timeAgo(r.at)}
                </Txt>
              </View>
            </Row>
          ))
        )}
        <Btn title="All receipts" small variant="quiet" onPress={() => router.push('/receipts')} />
      </Card>

      {!isLead && (
        <Btn title={`Remove ${member.name} from the Crew`} variant="danger" full style={{ marginTop: 26 }} onPress={() => setConfirmRemove(true)} />
      )}

      <Sheet visible={renaming} onClose={() => setRenaming(false)} title={`Rename ${member.name}`}>
        <Txt variant="small" style={{ marginBottom: 10 }}>
          Names stay unique in your Crew so you always know who's talking.
        </Txt>
        <Field
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError('');
          }}
          placeholder={member.defaultName}
          autoFocus
          maxLength={18}
          onSubmitEditing={() => saveName(name)}
        />
        {error ? (
          <Txt variant="small" color={p.danger} style={{ marginTop: 8 }}>
            {error}
          </Txt>
        ) : null}
        <Btn title="Save name" variant="signal" full style={{ marginTop: 12 }} onPress={() => saveName(name)} disabled={!name.trim()} />
        {member.name !== member.defaultName && (
          <Btn title={`Go back to ${member.defaultName}`} variant="ghost" full style={{ marginTop: 8 }} onPress={() => saveName(member.defaultName)} />
        )}
      </Sheet>

      <Sheet visible={confirmRemove} onClose={() => setConfirmRemove(false)} title={`Remove ${member.name}?`}>
        <Txt variant="body">Their seat opens up and their chat is deleted from your phone. Blocks they placed stay on your calendar.</Txt>
        <Row gap={8} style={{ marginTop: 16 }}>
          <Btn
            title="Remove"
            variant="danger"
            onPress={() => {
              setConfirmRemove(false);
              removeMember(member.id);
              toast(`${member.name} left the Crew.`);
              router.back();
            }}
          />
          <Btn title="Keep them" variant="ghost" onPress={() => setConfirmRemove(false)} />
        </Row>
      </Sheet>
    </Screen>
  );
}
