import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useFamily, useHead } from '@/lib/store';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { MemberPebble } from './Pebble';
import { LOOP_ICON_PATH } from './shapes';
import { haptic } from './ui';

function TabIcon({ name, active, color }: { name: string; active: boolean; color: string }) {
  if (name === 'index')
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"
          fill={active ? color : 'none'}
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    );
  if (name === 'family')
    return (
      <Svg width={26} height={24} viewBox="0 0 26 24">
        <Path d={LOOP_ICON_PATH} fill="none" stroke={color} strokeWidth={active ? 2.8 : 1.8} strokeLinejoin="round" />
      </Svg>
    );
  if (name === 'browser')
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={active ? 2.4 : 1.8} />
        <Path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" stroke={color} strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
      </Svg>
    );
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} fill={active ? color : 'none'} stroke={color} strokeWidth={1.8} />
      <Path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill={active ? color : 'none'} />
    </Svg>
  );
}

const LABELS: Record<string, string> = { index: 'Today', family: 'Family', browser: 'Browse', me: 'Me' };

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const head = useHead();
  const waiting = useFamily((s) => s.members.some((m) => m.state === 'waiting'));

  const items = state.routes.map((route, index) => {
    const active = state.index === index;
    const color = active ? p.text : p.muted;
    return (
      <Pressable
        key={route.key}
        onPress={() => {
          haptic('select');
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={LABELS[route.name] ?? route.name}
        style={{ width: 64, height: 52, alignItems: 'center', justifyContent: 'center', gap: 4 }}
      >
        <TabIcon name={route.name} active={active} color={color} />
        <Text style={{ fontFamily: active ? fonts.bodyBold : fonts.bodySemi, fontSize: 11, color }} maxFontSizeMultiplier={1.2}>
          {LABELS[route.name] ?? route.name}
        </Text>
        {route.name === 'family' && waiting ? (
          <View style={{ position: 'absolute', top: 6, right: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: p.signal }} />
        ) : null}
      </Pressable>
    );
  });

  const center = (
    <Pressable
      key="center"
      onPress={() => {
        haptic('medium');
        router.push({ pathname: '/chat/[id]', params: { id: head.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Talk to ${head.name}`}
      style={{ width: 66, height: 66, marginTop: -34, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ boxShadow: `0px 6px 14px ${head.color}66`, borderRadius: 33 }}>
        <MemberPebble member={head} size={62} outline={p.text} state={head.state === 'waiting' ? 'waiting' : 'idle'} />
      </View>
    </Pressable>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12),
        backgroundColor: p.tabBg,
        borderTopWidth: 1.5,
        borderTopColor: p.shadow,
      }}
    >
      {items.slice(0, 2)}
      {center}
      {items.slice(2)}
    </View>
  );
}
