/**
 * Trust: plain promises, each with a way to check it.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { deleteAccount, logOut } from '@/firebase/auth';
import { getRecoveryKey } from '@/lib/vault';
import { addPasskey, passkeysSupported } from '@/lib/passkeys';
import { useCrew } from '@/lib/store';
import { BackHeader, Btn, Card, haptic, Label, PressScale, Row, Screen, Sheet, Txt, type IconName } from '@/components/ui';
import { HoldButton } from '@/components/HoldButton';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

const PROMISES: { icon: IconName; title: string; body: string; check: string; route?: string }[] = [
  { icon: 'lock-closed-outline', title: 'Your chats are encrypted on your phone', body: 'Chats, memory, your Charter and receipts are locked with a key that lives in your iPhone Keychain.', check: 'Your recovery key below is that key. It never leaves this phone unless you copy it.' },
  { icon: 'eye-off-outline', title: "We don't keep your conversations", body: 'Messages pass through our server to reach Claude and are never written to our database or logs.', check: 'The server code is open in the project (functions/index.js). It stores your plan and a message count, nothing else.' },
  { icon: 'school-outline', title: 'Your data never trains AI', body: "Eternity uses Anthropic's API, which doesn't train on API traffic. We don't use the modes that keep data longer.", check: "Anthropic's commercial terms say API inputs and outputs aren't used for training." },
  { icon: 'receipt-outline', title: 'Nothing happens silently', body: 'Every read and every action leaves a receipt, with undo when it can be undone.', check: 'Open Receipts and filter to Read.', route: '/receipts' },
  { icon: 'hand-left-outline', title: 'Your tap is always the final one', body: 'Sending, spending, merging and deleting always ask. Errands stop at a preview and need Face ID.', check: 'Look at any teammate: the always-ask list is locked.' },
  { icon: 'bookmark-outline', title: 'Learning is off until you turn it on', body: 'Teammates suggest what to remember. You decide.', check: 'Memory shows every fact and where it came from.', route: '/memory' },
  { icon: 'trash-outline', title: 'Forgetting really forgets', body: 'Deleting a memory or your account erases it. No soft delete.', check: 'Use Forget everything below and the vault key is destroyed with it.' },
  { icon: 'megaphone-outline', title: 'Ads are never personalized', body: 'Free plans see one small ad. Ad networks get nothing about your Crew, chats or interests.', check: 'Ads are requested with non-personalized only, every time.' },
  { icon: 'shield-checkmark-outline', title: 'Web pages can’t boss your Crew around', body: 'The Guard strips hidden instructions from pages before a teammate reads them.', check: 'See everything it caught.', route: '/guard' },
];

export default function Trust() {
  const p = useTheme();
  const forget = useCrew((s) => s.forgetEverything);
  const guest = useCrew((s) => s.guest);
  const privateSession = useCrew((s) => s.settings.privateSession);
  const setSettings = useCrew((s) => s.setSettings);
  const [open, setOpen] = useState<number | null>(0);
  const [key, setKey] = useState<string | null>(null);
  const [wipe, setWipe] = useState(false);

  return (
    <Screen>
      <BackHeader kicker="Promises you can check" title="Trust & privacy" />
      <Txt variant="body" style={{ marginTop: 4 }}>
        Plain promises. Tap one to see how to check it.
      </Txt>

      <View style={{ marginTop: 14, gap: 8 }}>
        {PROMISES.map((pr, i) => (
          <Animated.View key={pr.title} entering={FadeInDown.delay(i * 40)}>
            <PressScale onPress={() => setOpen(open === i ? null : i)} accessibilityLabel={pr.title}>
              <View style={[carved[i % 4], { padding: 14, backgroundColor: p.card, boxShadow: `0px 2px 0px ${p.shadow}` }]}>
                <Row gap={12}>
                  <Ionicons name={pr.icon} size={20} color={p.text} />
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>
                    {pr.title}
                  </Txt>
                  <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={16} color={p.muted} />
                </Row>
                {open === i && (
                  <Animated.View entering={FadeIn}>
                    <Txt variant="body" style={{ marginTop: 8 }}>
                      {pr.body}
                    </Txt>
                    <View style={{ marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: p.card2 }}>
                      <Txt variant="label">How to check</Txt>
                      <Txt variant="small" color={p.text2} style={{ marginTop: 4 }}>
                        {pr.check}
                      </Txt>
                    </View>
                    {pr.route && <Btn title="Show me" small variant="quiet" iconRight="arrow-forward" onPress={() => router.push(pr.route as never)} />}
                  </Animated.View>
                )}
              </View>
            </PressScale>
          </Animated.View>
        ))}
      </View>

      <Label>Private session</Label>
      <Card carve={1}>
        <Txt variant="body">Talk without leaving a trace. Nothing from a private session is saved, remembered or used later.</Txt>
        <Btn title={privateSession ? 'End private session' : 'Start a private session'} small variant={privateSession ? 'signal' : 'ghost'} icon="eye-off-outline" style={{ marginTop: 12 }} onPress={() => { setSettings({ privateSession: !privateSession }); toast(privateSession ? 'Private session ended. Those messages are gone.' : 'Private session on.'); }} />
      </Card>

      {passkeysSupported() && !guest ? (
        <>
          <Label>Passkey</Label>
          <Card carve={0}>
            <Txt variant="body">Sign in to the Eternity website with Face ID, Touch ID or a security key. No password to type or leak.</Txt>
            <Btn
              title="Add a passkey"
              small
              variant="ghost"
              icon="finger-print-outline"
              style={{ marginTop: 12 }}
              onPress={async () => {
                try {
                  await addPasskey('Passkey');
                  haptic('success');
                  toast('Passkey added. Next time, sign in with it.');
                } catch (e) {
                  const m = (e as Error).message;
                  if (m !== 'cancelled') toast(m);
                }
              }}
            />
          </Card>
        </>
      ) : null}

      <Label>Your recovery key</Label>
      <Card tone="stone" carve={2}>
        <Txt variant="small" color={p.onStoneMuted}>
          The key that unlocks your vault. Keep it somewhere safe; anyone with it and your backup could read your Crew's data.
        </Txt>
        {key ? (
          <Animated.View entering={FadeIn}>
            <Txt variant="mono" color={p.onStone} style={{ marginTop: 12, fontSize: 13, lineHeight: 20 }} selectable>
              {key}
            </Txt>
            <Row gap={8} style={{ marginTop: 12 }}>
              <Btn title="Copy" small variant="onStone" icon="copy-outline" onPress={async () => { await Clipboard.setStringAsync(key); toast('Copied. Paste it somewhere safe.'); }} />
              <Btn title="Hide" small variant="stoneGhost" onPress={() => setKey(null)} />
            </Row>
          </Animated.View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <HoldButton title="Hold to reveal" onComplete={async () => setKey(await getRecoveryKey())} duration={900} />
          </View>
        )}
      </Card>

      <Label>Coming next: Eternity Vault</Label>
      <Card tone="soft" carve={3}>
        <Txt variant="body">A sealed server where even we can't read your requests while they're processed, with a public log so anyone can verify the code it runs.</Txt>
      </Card>

      <Btn title="Forget everything" variant="danger" full icon="trash-outline" style={{ marginTop: 26 }} onPress={() => setWipe(true)} />
      <Sheet visible={wipe} onClose={() => setWipe(false)} title="Forget everything?">
        <Txt variant="body">This deletes your Crew, chats, memory, receipts and settings from this phone{guest ? '' : ', and deletes your account'}. It can't be undone.</Txt>
        <View style={{ marginTop: 16 }}>
          <HoldButton
            title="Hold to erase it all"
            onComplete={async () => {
              setWipe(false);
              haptic('warning');
              await forget();
              if (!guest) {
                try {
                  await deleteAccount();
                } catch {
                  await logOut().catch(() => {});
                }
              }
              toast('Everything is gone.');
            }}
          />
        </View>
        <Btn title="Keep everything" variant="ghost" full style={{ marginTop: 10 }} onPress={() => setWipe(false)} />
      </Sheet>
    </Screen>
  );
}
