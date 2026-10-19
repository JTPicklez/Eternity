/**
 * "Your turn": a Workbench teammate hit a sign-in page. You sign in yourself
 * on the secure page; the teammate never sees or stores the password, then
 * picks up where it left off.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { memberOrTemplate, useCrew } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { BackHeader, Btn, Card, Field, haptic, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

export default function Handoff() {
  const p = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const members = useCrew((s) => s.members);
  const leadId = useCrew((s) => s.leadId);
  const m = memberOrTemplate(id ?? leadId, members);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [done, setDone] = useState(false);

  return (
    <Screen>
      <BackHeader title="Your turn" />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <MemberPebble member={m} size={80} state="waiting" />
        <Txt variant="title" center style={{ marginTop: 14 }}>
          {m.name} needs you for a second.
        </Txt>
        <Txt variant="body" center style={{ marginTop: 6 }}>
          github.com wants you to sign in. Do it yourself below. {m.name} can't see what you type and never stores passwords.
        </Txt>
      </View>

      {done ? (
        <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center', marginTop: 30, gap: 10 }}>
          <Ionicons name="checkmark-circle" size={56} color={p.success} />
          <Txt variant="h2">Handed back.</Txt>
          <Txt variant="small" center>
            {m.name} is continuing from the page you signed in to.
          </Txt>
          <Btn title="Back to the Workbench" variant="signal" onPress={() => router.back()} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn}>
          <Card tone="outline" carve={1} style={{ marginTop: 20 }}>
            <Row gap={8}>
              <Ionicons name="lock-closed" size={14} color={p.success} />
              <Txt variant="tiny" color={p.success}>
                Secure page · github.com · only you can type here
              </Txt>
            </Row>
            <View style={{ gap: 10, marginTop: 12 }}>
              <Field placeholder="Username or email" value={user} onChangeText={setUser} autoCapitalize="none" />
              <Field placeholder="Password" value={pass} onChangeText={setPass} secureTextEntry />
            </View>
          </Card>
          <Btn
            title="I'm signed in. Hand it back"
            variant="signal"
            full
            style={{ marginTop: 14 }}
            disabled={!user || !pass}
            onPress={() => {
              setPass('');
              setDone(true);
              haptic('success');
              toast(`${m.name} has it from here.`, undefined, m.color);
            }}
          />
          <Btn title="Not now. Stop the job" variant="ghost" full style={{ marginTop: 8 }} onPress={() => router.back()} />
          <Txt variant="tiny" center style={{ marginTop: 14 }}>
            Preview build: this sign-in is a demo and isn't sent anywhere.
          </Txt>
        </Animated.View>
      )}
    </Screen>
  );
}
