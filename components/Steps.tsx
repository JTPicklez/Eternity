import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { IconBtn, Txt } from './ui';

/** Progress for onboarding: five drops that fill as you go. */
export function Steps({ step, total = 5, back = true }: { step: number; total?: number; back?: boolean }) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44 }}>
      {back ? <IconBtn icon="chevron-back" label="Back" onPress={() => router.back()} /> : <View style={{ width: 40 }} />}
      <View style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              width: i === step ? 26 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i <= step ? p.signal : p.lineStrong,
            }}
          />
        ))}
      </View>
      <View style={{ width: 40, alignItems: 'flex-end' }}>
        <Txt variant="mono">
          {step + 1}/{total}
        </Txt>
      </View>
    </View>
  );
}
