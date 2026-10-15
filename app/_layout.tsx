import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
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
import { useFamily } from '@/lib/store';
import { configurePurchases, currentTier } from '@/lib/purchases';
import { initAds } from '@/lib/ads';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { ToastHost } from '@/components/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate({ user, ready }: { user: User | null; ready: boolean }) {
  const segments = useSegments();
  const guest = useFamily((s) => s.guest);
  const onboarded = useFamily((s) => s.onboarded);

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
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
        <Stack.Screen name="riverbed" options={{ animation: 'slide_from_bottom' }} />
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
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  const hydrated = useFamily((s) => s.hydrated);
  const [user, setUser] = useState<User | null>(null);
  const [authKnown, setAuthKnown] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthKnown(true);
      if (u) {
        const st = useFamily.getState();
        if (!st.firstName && u.displayName) st.setProfile({ firstName: u.displayName.split(' ')[0] });
        if (st.guest) st.setProfile({ guest: false });
      }
      await configurePurchases(u?.uid ?? null);
      const tier = await currentTier();
      if (tier) useFamily.getState().setSettings({ tier });
    });
    initAds();
    return unsub;
  }, []);

  const ready = fontsLoaded && hydrated && authKnown;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

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
