/**
 * One connection: what it can do, how to connect it for real, and a quick
 * "try it" to see live data. Sign-ins and keys go to Eternity's server; the
 * phone never keeps another app's token.
 */
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CONNECTORS } from '@/lib/catalog';
import { callConnector, disconnect, howFor, isLocal, refreshConnectors, saveKey, signIn } from '@/lib/connectors';
import { timeAgo } from '@/lib/dates';
import { askForLocation } from '@/lib/live';
import { allowCalendar, allowContacts, readPhoneCalendar, readWeather } from '@/lib/phone';
import { memberOrTemplate, useCrew } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Badge, Btn, Card, Chip, Empty, Field, haptic, Label, Mono, Row, Screen, Sheet, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

const LEVEL = {
  auto: { label: 'Just does it', icon: 'flash-outline' },
  tell: { label: 'Does it and tells you', icon: 'notifications-outline' },
  ask: { label: 'Asks first', icon: 'hand-left-outline' },
  always: { label: 'Always asks. Can’t change.', icon: 'lock-closed-outline' },
} as const;

/** Turns whatever came back into a few readable lines. */
function summarize(data: unknown): string[] {
  if (data == null) return ['Nothing came back.'];
  if (typeof data === 'string') return [data.slice(0, 400)];
  const rows = Array.isArray(data) ? data : [data];
  return rows.slice(0, 6).map((r) => {
    if (typeof r !== 'object' || r === null) return String(r);
    const o = r as Record<string, unknown>;
    const main = o.title ?? o.subject ?? o.name ?? o.text ?? o.repo ?? o.event ?? o.channel ?? o.id;
    const extra = [o.start, o.due, o.from, o.course, o.state, o.count, o.value, o.updated].filter((x) => x !== undefined && x !== null && x !== '');
    const line = [main, ...extra.slice(0, 2)].filter((x) => x !== undefined).map(String).join(' · ');
    return line || JSON.stringify(o).slice(0, 160);
  });
}

export default function ConnectorDetail() {
  const p = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = CONNECTORS.find((x) => x.id === id);
  const connected = useCrew((s) => s.connected);
  const live = useCrew((s) => (id ? s.live[id] : undefined));
  const available = useCrew((s) => (id ? s.serverAvailable[id] : undefined));
  const actions = useCrew((s) => (id ? s.serverActions[id] : undefined));
  const members = useCrew((s) => s.members);
  const receipts = useCrew((s) => s.receipts);
  const tier = useCrew((s) => s.settings.tier);
  const guest = useCrew((s) => s.guest);
  const setConnectorOn = useCrew((s) => s.setConnectorOn);
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState<null | 'fields' | 'fallback'>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [tried, setTried] = useState<string[] | null>(null);

  useEffect(() => {
    if (!guest) refreshConnectors();
  }, [guest]);

  if (!c || !id) {
    return (
      <Screen>
        <BackHeader />
        <Empty title="Not found" />
      </Screen>
    );
  }

  const how = howFor(c.id);
  const on = connected.includes(c.id);
  const isLive = !!live || (isLocal(c.id) && on) || (how.kind === 'developer' && on && !!available);
  const users = members.filter((m) => m.connectors.includes(c.id));
  const mine = receipts.filter((r) => r.connector.toLowerCase() === c.name.toLowerCase()).slice(0, 6);
  const locked = c.plusOnly && tier === 'free';
  const fields = pasting === 'fallback' ? how.keyFallback : how.fields;

  const status = c.unavailable || how.kind === 'blocked' ? 'Not available' : isLive ? `Live${live?.account ? ` · ${live.account}` : ''}` : on ? 'On with sample data' : 'Not connected';

  const doSignIn = async () => {
    setBusy(true);
    try {
      const r = await signIn(c.id);
      if (r.ok) {
        haptic('success');
        toast(`${c.name} is connected for real.`);
      } else if (r.reason !== 'cancelled') toast(r.reason ?? 'That didn’t connect.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doSave = async () => {
    setError('');
    setBusy(true);
    try {
      const account = await saveKey(c.id, values);
      haptic('success');
      setPasting(null);
      setValues({});
      toast(how.kind === 'free' ? `${c.name} is on.` : `${c.name} connected${account ? ` as ${account}` : ''}. The key is stored encrypted on Eternity's server, not on this phone.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doLocal = async () => {
    setBusy(true);
    try {
      let ok = true;
      if (c.id === 'phone-calendar') ok = await allowCalendar();
      else if (c.id === 'messages') await allowContacts();
      else if (c.id === 'weather') ok = !!(await readWeather());
      else if (c.id === 'maps') ok = await askForLocation();
      if (!ok) {
        toast(c.id === 'phone-calendar' ? 'Calendar access is off. You can turn it on in iPhone Settings, Eternity.' : 'Location is off, so this can’t work yet.');
        return;
      }
      setConnectorOn(c.id, true);
      haptic('success');
      toast(`${c.name} is on.`);
    } finally {
      setBusy(false);
    }
  };

  const tryIt = async () => {
    setBusy(true);
    setTried(null);
    try {
      if (c.id === 'phone-calendar') {
        const ev = await readPhoneCalendar(3);
        setTried(ev.length ? ev.slice(0, 6).map((e) => `${new Date(e.start).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${e.title}`) : ['Nothing in the next three days.']);
      } else if (c.id === 'weather') {
        setTried([(await readWeather()) ?? 'Couldn’t get the weather right now.']);
      } else {
        const first = actions?.find((a) => !a.write);
        if (!first) return void setTried(['Nothing to try for this one yet.']);
        const data = await callConnector(c.id, first.name, (first as { demo?: Record<string, unknown> | null }).demo ?? {});
        setTried(summarize(data));
      }
    } catch (e) {
      setTried([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  const connectArea = () => {
    if (c.unavailable || how.kind === 'blocked') return null;
    if (locked) return <Btn title="Comes with Plus" variant="signal" full onPress={() => router.push('/plus')} />;
    if (isLive) {
      return (
        <View style={{ gap: 10 }}>
          {(how.kind !== 'device' || c.id === 'phone-calendar') && c.id !== 'messages' && c.id !== 'maps' ? (
            <Btn title="Try it" icon="flash-outline" variant="ink" full loading={busy} onPress={tryIt} />
          ) : null}
          <Btn
            title={`Disconnect ${c.name}`}
            variant="danger"
            full
            onPress={async () => {
              await disconnect(c.id);
              haptic('warning');
              setTried(null);
              toast(`${c.name} disconnected. ${isLocal(c.id) ? '' : 'Its key is deleted from the server.'}`);
            }}
          />
        </View>
      );
    }
    if (how.kind === 'device' || how.kind === 'open') {
      return <Btn title={`Turn on ${c.name}`} variant="signal" full loading={busy} onPress={doLocal} />;
    }
    const needsAccount = guest && (how.kind === 'oauth' || how.kind === 'key' || how.kind === 'free');
    if (needsAccount) {
      return (
        <Card tone="soft" carve={1} padding={14}>
          <Txt variant="small">Real connections are tied to your account so they work on every device. Make one first; it takes a minute.</Txt>
          <Btn title="Make an account" small variant="signal" style={{ marginTop: 10 }} onPress={() => router.push('/login')} />
        </Card>
      );
    }
    if (how.kind === 'oauth') {
      return (
        <View style={{ gap: 10 }}>
          {available === false ? (
            <Card tone="soft" carve={1} padding={14}>
              <Txt variant="small">Sign-in for {c.name} isn't switched on yet. It turns on once its developer app is added to Eternity's server.</Txt>
            </Card>
          ) : (
            <Btn title={`Sign in to ${c.name}`} variant="signal" full icon="log-in-outline" loading={busy} onPress={doSignIn} />
          )}
          {how.keyFallback ? <Btn title="Paste a personal key instead" variant="ghost" full onPress={() => setPasting('fallback')} /> : null}
          {!on ? (
            <Btn title="Use sample data for now" variant="quiet" small style={{ alignSelf: 'center' }} onPress={() => setConnectorOn(c.id, true)} />
          ) : null}
        </View>
      );
    }
    if (how.kind === 'free') {
      return <Btn title={`Turn on ${c.name}`} variant="signal" full loading={busy} onPress={doSave} />;
    }
    if (how.kind === 'key') {
      return <Btn title={`Connect ${c.name}`} variant="signal" full icon="key-outline" onPress={() => setPasting('fields')} />;
    }
    if (how.kind === 'developer') {
      return available ? (
        <Btn title={`Turn on ${c.name}`} variant="signal" full onPress={() => setConnectorOn(c.id, true)} />
      ) : (
        <Card tone="soft" carve={1} padding={14}>
          <Txt variant="small">{how.note}</Txt>
        </Card>
      );
    }
    // approval or later: allow the preview so the Crew can show how it would work
    return (
      <Btn
        title={on ? 'Turn off sample data' : 'Try it with sample data'}
        variant="ghost"
        full
        onPress={() => {
          setConnectorOn(c.id, !on);
          toast(on ? `${c.name} sample data is off.` : `${c.name} is on with sample data until the real connection is ready.`);
        }}
      />
    );
  };

  return (
    <Screen>
      <BackHeader kicker={c.category} title={c.name} />
      <Row gap={14} style={{ marginTop: 8 }}>
        <Mono text={c.mono} size={60} on={on || isLive} />
        <View style={{ flex: 1 }}>
          <Txt variant="h2">{c.name}</Txt>
          <Row gap={6} style={{ marginTop: 4 }}>
            <Badge text={status} color={isLive ? p.success : p.card2} textColor={isLive ? '#FFFFFF' : p.text} />
            {c.beta ? <Badge text="Beta" color={p.card2} textColor={p.muted} /> : null}
          </Row>
        </View>
      </Row>
      <Txt variant="body" style={{ marginTop: 12 }}>
        {c.unavailable ?? c.blurb}
      </Txt>
      {c.beta ? (
        <Txt variant="small" style={{ marginTop: 6 }}>
          Beta: this one works, but it is new and still being tested on real accounts. If something looks off, tell us.
        </Txt>
      ) : null}
      {how.note && !c.unavailable ? (
        <Txt variant="small" style={{ marginTop: 6 }}>
          {how.note}
        </Txt>
      ) : null}

      <View style={{ marginTop: 18 }}>{connectArea()}</View>

      {tried ? (
        <Animated.View entering={FadeIn}>
          <Card carve={3} padding={12} style={{ marginTop: 12 }}>
            <Txt variant="label" style={{ marginBottom: 6 }}>
              Live from {c.name}
            </Txt>
            {tried.map((line, i) => (
              <Txt key={i} variant="small" color={p.text2} style={{ paddingVertical: 3 }}>
                {line}
              </Txt>
            ))}
          </Card>
        </Animated.View>
      ) : null}

      {!c.unavailable && how.kind !== 'blocked' && (
        <>
          <Label>What your Crew can do here</Label>
          <Card carve={0} padding={12}>
            {c.caps.map((cap) => (
              <Row key={cap.label} gap={10} style={{ paddingVertical: 8 }}>
                <Ionicons name={LEVEL[cap.level].icon} size={18} color={cap.level === 'always' ? p.text : p.muted} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{cap.label}</Txt>
                  <Txt variant="tiny">{LEVEL[cap.level].label}</Txt>
                </View>
              </Row>
            ))}
          </Card>

          <Label>Who uses it</Label>
          {users.length === 0 ? (
            <Txt variant="small" style={{ marginHorizontal: 4 }}>
              No teammate has it yet. Turn it on from a teammate's page.
            </Txt>
          ) : (
            <Row gap={14} wrap>
              {users.map((m) => {
                const mm = memberOrTemplate(m.id, members);
                return (
                  <View key={m.id} style={{ alignItems: 'center', width: 70 }}>
                    <MemberPebble member={mm} size={40} animate={false} />
                    <Txt variant="tiny" style={{ marginTop: 4 }}>
                      {mm.name}
                    </Txt>
                  </View>
                );
              })}
            </Row>
          )}

          <Label>Reading receipts</Label>
          <Card carve={2} padding={12}>
            {mine.length === 0 ? (
              <Txt variant="small">Every time a teammate reads or changes something here, it shows up in this list.</Txt>
            ) : (
              mine.map((r) => (
                <Row key={r.id} gap={10} style={{ paddingVertical: 6 }}>
                  <Ionicons name={r.kind === 'read' ? 'eye-outline' : 'checkmark-done-outline'} size={16} color={p.muted} />
                  <Txt variant="small" color={p.text2} style={{ flex: 1 }}>
                    {r.text}
                  </Txt>
                  <Txt variant="tiny">{timeAgo(r.at)}</Txt>
                </Row>
              ))
            )}
          </Card>
        </>
      )}

      <Sheet visible={!!pasting} onClose={() => setPasting(null)} title={`Connect ${c.name}`}>
        {how.help ? (
          <Txt variant="small" style={{ marginBottom: 12 }}>
            {how.help}
          </Txt>
        ) : null}
        {how.helpUrl ? (
          <Btn title="Open the page with the key" small variant="ghost" icon="open-outline" style={{ marginBottom: 12 }} onPress={() => Linking.openURL(how.helpUrl!)} />
        ) : null}
        <View style={{ gap: 12 }}>
          {(fields ?? []).map((f) =>
            f.options ? (
              <View key={f.key} style={{ gap: 6 }}>
                <Txt variant="smallStrong">{f.label}</Txt>
                <Row gap={8}>
                  {f.options.map((o) => (
                    <Chip key={o.id} label={o.label} small selected={(values[f.key] ?? f.options![0].id) === o.id} onPress={() => setValues((v) => ({ ...v, [f.key]: o.id }))} />
                  ))}
                </Row>
              </View>
            ) : (
              <Field
                key={f.key}
                label={f.label}
                placeholder={f.placeholder}
                value={values[f.key] ?? ''}
                onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                secureTextEntry={f.secure}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ),
          )}
        </View>
        {error ? (
          <Txt variant="small" color={p.danger} style={{ marginTop: 10 }}>
            {error}
          </Txt>
        ) : null}
        <Txt variant="tiny" style={{ marginTop: 12 }}>
          Eternity checks the key once, then stores it encrypted on its server. It never sits on your phone, and you can delete it anytime.
        </Txt>
        <Btn title="Check and connect" variant="signal" full style={{ marginTop: 12 }} loading={busy} onPress={doSave} />
      </Sheet>
    </Screen>
  );
}
