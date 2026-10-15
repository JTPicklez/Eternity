import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { checkCart, runErrand, SPEND_LIMIT_DEFAULT } from '@/lib/errands';
import { memberOrTemplate, useFamily } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Btn, Card, Empty, haptic, LiveDot, ProgressBar, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

const UNDO_MINUTES = 5;

export default function ErrandScreen() {
  const p = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const errand = useFamily((s) => s.errands.find((e) => e.id === id));
  const members = useFamily((s) => s.members);
  const updateErrand = useFamily((s) => s.updateErrand);
  const addReceipt = useFamily((s) => s.addReceipt);
  const setMemberState = useFamily((s) => s.setMemberState);
  const [now, setNow] = useState(Date.now());
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!errand || errand.status !== 'working') return;
    return runErrand(errand.id, () => haptic('select'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errand?.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!errand) {
    return (
      <Screen>
        <BackHeader />
        <Empty title="Errand not found" />
      </Screen>
    );
  }

  const m = memberOrTemplate(errand.memberId, members);
  const doneSteps = errand.steps.filter((s) => s.status === 'done').length;
  const check = errand.preview ? checkCart(errand.preview, SPEND_LIMIT_DEFAULT) : null;
  const undoLeft = errand.undoUntil ? Math.max(0, Math.round((errand.undoUntil - now) / 1000)) : 0;

  const book = async () => {
    setAuthError('');
    if (!errand.preview || !check?.ok) return;
    // The final tap: Face ID (or passcode). Nothing is paid for without it.
    if (Platform.OS !== 'web') {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = has && (await LocalAuthentication.isEnrolledAsync());
      if (enrolled) {
        const r = await LocalAuthentication.authenticateAsync({ promptMessage: `Pay $${errand.preview.total.toFixed(2)}?`, cancelLabel: 'Not now' });
        if (!r.success) {
          setAuthError("Not confirmed, so nothing happened.");
          return;
        }
      }
    }
    updateErrand(errand.id, { status: 'paying' });
    haptic('medium');
    setTimeout(() => {
      const at = Date.now();
      updateErrand(errand.id, { status: 'booked', bookedAt: at, undoUntil: at + UNDO_MINUTES * 60_000 });
      setMemberState(errand.memberId, 'done', 'Errand done');
      addReceipt({ memberId: errand.memberId, text: `Booked: ${errand.preview!.title} ($${errand.preview!.total.toFixed(2)})`, connector: 'Errands', kind: 'did', undoable: false });
      haptic('success');
    }, 1600);
  };

  const cancel = () => {
    updateErrand(errand.id, { status: 'declined', undoUntil: undefined });
    addReceipt({ memberId: errand.memberId, text: `Cancelled: ${errand.preview?.title ?? errand.request}`, connector: 'Errands', kind: 'did', undoable: false });
    setMemberState(errand.memberId, 'idle', 'Ready when you are');
    toast('Cancelled. Nothing was charged.');
  };

  return (
    <Screen>
      <BackHeader kicker="Errand" title={errand.request} />

      <Card carve={0} style={{ marginTop: 8 }}>
        <Row gap={12}>
          <MemberPebble member={m} size={52} state={errand.status === 'working' ? 'working' : errand.status === 'preview' ? 'waiting' : errand.status === 'booked' ? 'done' : 'idle'} />
          <View style={{ flex: 1 }}>
            <Txt variant="h3">{m.name}</Txt>
            <Txt variant="small">
              {errand.status === 'working'
                ? 'On the Workbench now'
                : errand.status === 'preview'
                  ? errand.level === 'look'
                    ? 'Found it. Take a look.'
                    : 'Ready for your final tap'
                  : errand.status === 'paying'
                    ? 'Confirming with the site…'
                    : errand.status === 'booked'
                      ? 'Done. Receipt saved.'
                      : 'Stopped'}
            </Txt>
          </View>
          {errand.status === 'working' && <LiveDot />}
        </Row>
        <View style={{ marginTop: 14 }}>
          <ProgressBar value={errand.status === 'working' ? doneSteps / errand.steps.length : 1} color={m.color} />
        </View>
        <View style={{ marginTop: 12, gap: 8 }}>
          {errand.steps.map((s, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 60)}>
              <Row gap={10}>
                {s.status === 'done' ? (
                  <Ionicons name="checkmark-circle" size={18} color={p.success} />
                ) : s.status === 'active' && errand.status === 'working' ? (
                  <LiveDot color={p.signal} />
                ) : (
                  <Ionicons name="ellipse-outline" size={18} color={p.lineStrong} />
                )}
                <Txt variant={s.status === 'active' ? 'bodyStrong' : 'body'} color={s.status === 'todo' ? p.muted : undefined}>
                  {s.label}
                </Txt>
              </Row>
            </Animated.View>
          ))}
        </View>
        {errand.status === 'working' && (
          <Row gap={8} style={{ marginTop: 14 }}>
            <Btn title="Watch it work" small variant="ghost" icon="desktop-outline" onPress={() => router.push({ pathname: '/workbench/[id]', params: { id: errand.memberId, errand: errand.id } })} />
            <Btn
              title="Stop"
              small
              variant="danger"
              icon="stop-circle-outline"
              onPress={() => {
                updateErrand(errand.id, { status: 'declined' });
                setMemberState(errand.memberId, 'idle', 'Stopped');
                toast('Stopped. Nothing was held or bought.');
              }}
            />
          </Row>
        )}
      </Card>

      {errand.preview && errand.status !== 'working' && (
        <Animated.View entering={FadeInDown.springify()}>
          <Card tone="outline" carve={1} style={{ marginTop: 14 }}>
            <Txt variant="label">{errand.level === 'look' ? 'What I found' : 'Your cart'}</Txt>
            <Txt variant="h2" style={{ marginTop: 6 }}>
              {errand.preview.title}
            </Txt>
            {errand.preview.lines.map((l) => (
              <Txt key={l} variant="body" style={{ marginTop: 4 }}>
                {l}
              </Txt>
            ))}
            <Row justify="space-between" style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1.5, borderTopColor: p.line }}>
              <Txt variant="bodyStrong">Total</Txt>
              <Txt variant="h2">${errand.preview.total.toFixed(2)}</Txt>
            </Row>
            <Txt variant="small" style={{ marginTop: 4 }}>
              {errand.preview.refund}
            </Txt>
          </Card>

          {check && errand.level === 'prepare' && (
            <Card carve={2} style={{ marginTop: 12 }}>
              <Row gap={8}>
                <Ionicons name="shield-checkmark-outline" size={18} color={check.ok ? p.success : p.danger} />
                <Txt variant="bodyStrong">{check.ok ? 'Checked against what you asked' : 'Something doesn’t match'}</Txt>
              </Row>
              {check.passed.map((t) => (
                <Row key={t} gap={8} style={{ marginTop: 8 }}>
                  <Ionicons name="checkmark" size={16} color={p.success} />
                  <Txt variant="small" color={p.text2}>
                    {t}
                  </Txt>
                </Row>
              ))}
              {check.issues.map((t) => (
                <Row key={t} gap={8} style={{ marginTop: 8 }} align="flex-start">
                  <Ionicons name="alert-circle" size={16} color={p.danger} />
                  <Txt variant="small" color={p.danger} style={{ flex: 1 }}>
                    {t}
                  </Txt>
                </Row>
              ))}
              <Txt variant="tiny" style={{ marginTop: 10 }}>
                This check is plain code comparing the cart to your words. No AI decides it.
              </Txt>
            </Card>
          )}

          {errand.status === 'preview' && errand.level === 'prepare' && (
            <View style={{ marginTop: 16, gap: 8 }}>
              {check?.ok ? (
                <Btn title={`Pay $${errand.preview.total.toFixed(2)} with Face ID`} variant="signal" full icon="finger-print" onPress={book} />
              ) : (
                <Btn title="Can't book until it matches" variant="ghost" full disabled />
              )}
              <Btn title="Not this one" variant="ghost" full onPress={cancel} />
              {authError ? (
                <Txt variant="small" color={p.danger} center>
                  {authError}
                </Txt>
              ) : null}
            </View>
          )}
          {errand.status === 'preview' && errand.level === 'look' && (
            <View style={{ marginTop: 16, gap: 8 }}>
              <Btn title="Have them prepare it" variant="signal" full onPress={() => updateErrand(errand.id, { level: 'prepare' })} />
              <Btn title="Done looking" variant="ghost" full onPress={cancel} />
            </View>
          )}
          {errand.status === 'paying' && (
            <Animated.View entering={FadeIn} style={{ marginTop: 16, alignItems: 'center', gap: 8 }}>
              <LiveDot color={p.signal} />
              <Txt variant="small">Confirming with the site. If it fails, nothing is retried on its own.</Txt>
            </Animated.View>
          )}
          {errand.status === 'booked' && (
            <Animated.View entering={ZoomIn.springify()}>
              <Card tone="stone" carve={3} style={{ marginTop: 14, alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={44} color={p.mode === 'paper' ? '#8FCB5A' : p.success} />
                <Txt variant="h2" color={p.onStone} style={{ marginTop: 8 }}>
                  Booked.
                </Txt>
                <Txt variant="small" color={p.onStoneMuted} center style={{ marginTop: 4 }}>
                  Verified on the site after paying. Receipt saved.
                </Txt>
                {undoLeft > 0 && (
                  <Btn
                    title={`Undo (${Math.floor(undoLeft / 60)}:${String(undoLeft % 60).padStart(2, '0')})`}
                    small
                    variant="stoneGhost"
                    style={{ marginTop: 12, alignSelf: 'center' }}
                    onPress={cancel}
                  />
                )}
              </Card>
            </Animated.View>
          )}
          {errand.status === 'declined' && (
            <Txt variant="small" center style={{ marginTop: 14 }}>
              Stopped. Nothing was held or charged.
            </Txt>
          )}
        </Animated.View>
      )}

      <Txt variant="tiny" center style={{ marginTop: 20 }}>
        Preview build: sites are simulated and nothing is actually booked or charged.
      </Txt>
    </Screen>
  );
}
