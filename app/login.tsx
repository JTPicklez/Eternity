import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { authErrorMessage, resetPassword, signInWithEmail, signInWithGoogleIdToken, signUpWithEmail } from '@/firebase/auth';
import { useCrew } from '@/lib/store';
import { templateFor } from '@/lib/catalog';
import { Pebble } from '@/components/Pebble';
import { Btn, Field, Ripples, Screen, Segmented, Spacer, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { CONFIG } from '@/lib/config';
import { passkeysSupported, signInWithPasskey } from '@/lib/passkeys';
import { useTheme } from '@/theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

// Same Firebase project as Aibram, so the web client is shared. Google needs a
// separate iOS OAuth client for Eternity's bundle id (com.joshuat8808.Eternity);
// put it in lib/config.ts once it's created and the Google button appears.
const GOOGLE_WEB_CLIENT_ID = CONFIG.google.webClientId;
const GOOGLE_IOS_CLIENT_ID = CONFIG.google.iosClientId;

function GoogleButton({ onError }: { onError: (m: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  });
  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token ?? response.authentication?.idToken;
    if (!idToken) return;
    setLoading(true);
    signInWithGoogleIdToken(idToken, response.authentication?.accessToken)
      .catch((e: { code?: string }) => onError(authErrorMessage(e.code ?? '')))
      .finally(() => setLoading(false));
  }, [response, onError]);
  return <Btn title="Continue with Google" icon="logo-google" variant="ghost" full loading={loading} disabled={!request} onPress={() => promptAsync()} />;
}

export default function Login() {
  const p = useTheme();
  const setProfile = useCrew((s) => s.setProfile);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const aibram = templateFor('aibram');
  const googleReady = Platform.OS === 'web' || !!GOOGLE_IOS_CLIENT_ID;

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) return setError('Email and password, please.');
    if (mode === 'signup' && !name.trim()) return setError('What should your Crew call you?');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    setLoading(true);
    try {
      if (mode === 'signup') {
        setProfile({ firstName: name.trim().split(' ')[0] });
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e) {
      setError(authErrorMessage((e as { code?: string }).code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen ripples={false} contentStyle={{ paddingTop: 30 }}>
      <Ripples size={420} />
      <Ripples corner="bottomLeft" size={360} />
      <Animated.View entering={FadeInUp.duration(700)} style={{ alignItems: 'center', marginTop: 10 }}>
        <Pebble shape={aibram.shape} color={aibram.color} mark={aibram.mark} motion="calm" size={112} finish="glow" />
        <Txt variant="label" style={{ marginTop: 18 }}>
          An Eternity Works app
        </Txt>
        <Txt variant="display" center style={{ marginTop: 8, fontSize: 44, lineHeight: 46 }}>
          Eternity
        </Txt>
        <Txt variant="body" center style={{ marginTop: 10, maxWidth: 300 }}>
          A Crew of AI teammates that make the work lighter, not smaller.
        </Txt>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(250).duration(600)} style={{ marginTop: 28, gap: 12 }}>
        <Segmented
          options={[
            { id: 'signup', label: 'New here' },
            { id: 'signin', label: 'Sign in' },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setError('');
          }}
        />
        {mode === 'signup' && <Field placeholder="First name" value={name} onChangeText={setName} autoComplete="given-name" textContentType="givenName" />}
        <Field placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signup' ? 'newPassword' : 'password'}
          onSubmitEditing={submit}
        />
        {error ? (
          <Txt variant="small" color={p.danger} accessibilityLiveRegion="polite">
            {error}
          </Txt>
        ) : null}
        <Btn title={mode === 'signup' ? 'Start my Crew' : 'Welcome back'} variant="signal" full loading={loading} onPress={submit} />
        {googleReady && <GoogleButton onError={setError} />}
        {mode === 'signin' && passkeysSupported() && (
          <Btn
            title="Sign in with a passkey"
            variant="ghost"
            full
            icon="finger-print-outline"
            onPress={async () => {
              setError('');
              try {
                await signInWithPasskey();
              } catch (e) {
                const m = (e as Error).message;
                if (m !== 'cancelled') setError(m);
              }
            }}
          />
        )}
        {mode === 'signin' && (
          <Btn
            title="Forgot password?"
            variant="quiet"
            small
            onPress={async () => {
              if (!email.trim()) return setError('Type your email first and I will send a reset link.');
              try {
                await resetPassword(email);
                toast('Reset link sent. Check your inbox.');
              } catch (e) {
                setError(authErrorMessage((e as { code?: string }).code ?? ''));
              }
            }}
          />
        )}
      </Animated.View>

      <Spacer h={18} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Btn
          title="Look around first"
          variant="quiet"
          iconRight="arrow-forward"
          onPress={() => setProfile({ guest: true, firstName: name.trim().split(' ')[0] || '' })}
        />
        <Txt variant="tiny" center style={{ maxWidth: 300 }}>
          Preview mode uses sample replies. Make an account to talk to the real Crew.
        </Txt>
      </View>
    </Screen>
  );
}
