/**
 * Little notes that float up from the bottom: "Done. Undo" and friends.
 * Every action a teammate takes shows one, so nothing happens silently.
 */
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeOutDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Drop, haptic } from './ui';

interface ToastItem {
  id: number;
  text: string;
  action?: { label: string; onPress: () => void };
  color?: string;
  duration: number;
}

interface ToastState {
  current: ToastItem | null;
  show: (t: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => void;
  hide: () => void;
}

let seq = 0;

export const useToast = create<ToastState>((set) => ({
  current: null,
  show: (t) => {
    haptic(t.action ? 'success' : 'light');
    set({ current: { ...t, id: ++seq, duration: t.duration ?? (t.action ? 6000 : 3200) } });
  },
  hide: () => set({ current: null }),
}));

export const toast = (text: string, action?: ToastItem['action'], color?: string) =>
  useToast.getState().show({ text, action, color });

export function ToastHost() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const current = useToast((s) => s.current);
  const hide = useToast((s) => s.hide);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(hide, current.duration);
    return () => clearTimeout(t);
  }, [current, hide]);

  if (!current) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 96, alignItems: 'center' }}>
      <Animated.View
        key={current.id}
        entering={SlideInDown.springify().damping(16)}
        exiting={FadeOutDown.duration(160)}
        accessibilityLiveRegion="polite"
        style={{
          maxWidth: 420,
          marginHorizontal: 16,
          alignSelf: 'stretch',
          backgroundColor: p.stone,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 16,
          borderBottomRightRadius: 22,
          borderBottomLeftRadius: 14,
          paddingVertical: 12,
          paddingLeft: 14,
          paddingRight: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0px 8px 24px rgba(0,0,0,0.18)',
        }}
      >
        <Drop size={16} color={current.color ?? (p.mode === 'paper' ? '#5CC8F2' : '#1E5BD2')} />
        <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14.5, color: p.onStone }} maxFontSizeMultiplier={1.3}>
          {current.text}
        </Text>
        {current.action ? (
          <Pressable
            onPress={() => {
              current.action?.onPress();
              hide();
            }}
            style={{ paddingHorizontal: 12, height: 34, borderRadius: 11, justifyContent: 'center', backgroundColor: p.onStone }}
            accessibilityRole="button"
            accessibilityLabel={current.action.label}
          >
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: p.stone }}>{current.action.label}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
