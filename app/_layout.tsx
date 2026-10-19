import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import { Stack, router, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { auth } from '@/firebase/config';
import { useCrew } from '@/lib/store';
import { configurePurchases, currentTier } from '@/lib/purchases';
import { initAds } from '@/lib/ads';
import { refreshConnectors } from '@/lib/connectors';
import { hideBootScreen } from '@/lib/boot';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { ToastHost } from '@/components/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * If any screen throws while drawing, show what happened instead of a blank
 * page. Saved data isn't touched, so "Try again" usually just works.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const dark = useColorScheme() === 'dark';
  useEffect(() => {
    hideBootScreen();
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  const bg = dark ? '#13161A' : '#EEE8DD';
  const ink = dark ? '#ECE6DA' : '#23201B';
  const well = dark ? 'rgba(236,230,218,0.08)' : 'rgba(35,32,27,0.07)';
  const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' });
  // In development, add which components it was in (without the long bundle addresses).
  const detail =
    __DEV__ && error?.stack
      ? error.stack
          .split('\n')
          .slice(0, 10)
          .map((l) => l.replace(/\s*\(?(https?|file):\/\/\S+/g, '').replace(/@$/, ''))
          .join('\n')
      : error?.message || String(error);
  return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 520 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: ink }}>Something tripped.</Text>
        <Text style={{ marginTop: 6, fontSize: 15, lineHeight: 21, color: ink, opacity: 0.75 }}>
          This screen hit an error. Your Crew, chats and memory are still saved.
        </Text>
        <ScrollView style={{ maxHeight: 240, marginTop: 16, borderRadius: 12, backgroundColor: well }} contentContainerStyle={{ padding: 12 }}>
          <Text selectable style={{ fontFamily: mono, fontSize: 12, lineHeight: 17, color: ink }}>
            {detail}
          </Text>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={() => retry()}
            accessibilityRole="button"
            style={{ backgroundColor: ink, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999 }}
          >
            <Text style={{ color: bg, fontWeight: '600', fontSize: 15 }}>Try again</Text>
          </Pressable>
          {Platform.OS === 'web' && (
            <Pressable
              onPress={() => window.location.reload()}
              accessibilityRole="button"
              style={{ borderColor: ink, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999 }}
            >
              <Text style={{ color: ink, fontWeight: '600', fontSize: 15 }}>Reload the page</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function Gate({ user, ready }: { user: User | null; ready: boolean }) {
  const segments = useSegments();
  const guest = useCrew((s) => s.guest);
  const onboarded = useCrew((s) => s.onboarded);

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    if (__DEV__ && first === 'dev') return;
    const inLogin = first === 'login';
    const inOnboarding = first === 'onboarding';
    if (!user && !guest) {
      if (!inLogin) router.replace('/login');
      return;
    }
    if (!onboarded) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }
    if (inLogin || inOnboarding) router.replace('/');
  }, [ready, user, guest, onboarded, segments]);

  return null;
}

function Shell({ user, ready }: { user: User | null; ready: boolean }) {
  const p = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(p.bg).catch(() => {});
  }, [p.bg]);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={p.mode === 'ink' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="plus" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="studio" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="flow" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="errand/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="handoff" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <Gate user={user} ready={ready} />
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [fontsOk, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  const hydrated = useCrew((s) => s.hydrated);
  const [user, setUser] = useState<User | null>(null);
  const [authKnown, setAuthKnown] = useState(false);
  // Startup must never hang: if fonts or sign-in state are slow or fail, carry on
  // with system fonts / signed-out rather than sitting on a blank screen.
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(
        auth,
        async (u) => {
          setUser(u);
          setAuthKnown(true);
          try {
            if (u) {
              const st = useCrew.getState();
              if (!st.firstName && u.displayName) st.setProfile({ firstName: u.displayName.split(' ')[0] });
              if (st.guest) st.setProfile({ guest: false });
            }
            if (u) refreshConnectors().catch(() => {});
            await configurePurchases(u?.uid ?? null);
            const tier = await currentTier();
            if (tier) useCrew.getState().setSettings({ tier });
          } catch {
            /* purchases are optional */
          }
        },
        () => setAuthKnown(true),
      );
    } catch {
      setAuthKnown(true);
    }
    initAds().catch(() => {});
    return unsub;
  }, []);

  const fontsLoaded = fontsOk || !!fontError || gaveUp;
  const ready = fontsLoaded && (hydrated || gaveUp) && (authKnown || gaveUp);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (fontsLoaded) hideBootScreen();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell user={user} ready={ready} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
