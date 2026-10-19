/**
 * Where a sign-in comes back to. In a web popup it hands the result to the
 * window that opened it; on a phone it finishes the connection and moves on.
 */
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { finishFromUrl } from '@/lib/connectors';
import { Btn, Screen, Txt } from '@/components/ui';
import { MemberPebble } from '@/components/Pebble';
import { useLead } from '@/lib/store';

// In a web popup this posts the address back to the opener and closes.
WebBrowser.maybeCompleteAuthSession();

export default function Connected() {
  const lead = useLead();
  const params = useLocalSearchParams<{ connector?: string; status?: string; reason?: string; token?: string }>();
  const [msg, setMsg] = useState('Finishing up…');
  const [done, setDone] = useState<null | boolean>(null);

  useEffect(() => {
    // A popup closes itself above; this runs when the app itself landed here.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) return;
    (async () => {
      const url = Linking.createURL('connected', { queryParams: params as Record<string, string> });
      try {
        const r = await finishFromUrl(url);
        setDone(r.ok);
        setMsg(r.ok ? 'Connected. Your Crew can use it now.' : (r.reason ?? 'That didn’t connect.'));
        if (r.ok && r.connector) setTimeout(() => router.replace({ pathname: '/connector/[id]', params: { id: r.connector! } }), 900);
      } catch (e) {
        setDone(false);
        setMsg((e as Error).message);
      }
    })();
  }, [params]);

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: 90, gap: 16 }}>
        <MemberPebble member={lead} size={110} state={done ? 'done' : done === false ? 'idle' : 'working'} />
        <Txt variant="h2" center>
          {msg}
        </Txt>
        {done === false ? <Btn title="Back to Connections" variant="ghost" onPress={() => router.replace('/connect')} /> : null}
      </View>
    </Screen>
  );
}
