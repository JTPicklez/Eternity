import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { clock } from '@/lib/dates';
import { memberOrTemplate, useFamily } from '@/lib/store';
import type { Block, BlockKind } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';
import { Pebble } from './Pebble';
import { Badge, Btn, Drop, PressScale, Txt, type IconName } from './ui';

export const KIND_ICON: Record<BlockKind, IconName> = {
  leave: 'car-outline',
  class: 'school-outline',
  study: 'book-outline',
  code: 'code-slash-outline',
  run: 'walk-outline',
  flow: 'water-outline',
  event: 'calendar-outline',
  task: 'checkbox-outline',
};

export function BlockCard({
  block,
  index,
  eta,
  onPress,
  onLongPress,
  onFlow,
  showTime = true,
}: {
  block: Block;
  index: number;
  eta?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
  onFlow?: () => void;
  showTime?: boolean;
}) {
  const p = useTheme();
  const members = useFamily((s) => s.members);
  const by = block.by ? memberOrTemplate(block.by, members) : null;
  const isFlow = block.kind === 'flow';
  const sub = [block.sub, block.end && !block.sub?.includes('until') ? `until ${clock(block.end)}` : null, by ? `placed by ${by.name}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45)} layout={LinearTransition} style={{ flexDirection: 'row', gap: 10 }}>
      {showTime && (
        <Txt variant="mono" color={isFlow ? p.signalText : p.muted} style={{ width: 44, paddingTop: 15 }}>
          {clock(block.time)}
        </Txt>
      )}
      <PressScale onPress={onPress} onLongPress={onLongPress} style={{ flex: 1 }} accessibilityLabel={`${block.title}${block.done ? ', done' : ''}`}>
        <View
          style={[
            carved[index % 4],
            {
              padding: 14,
              backgroundColor: p.card,
              opacity: block.done ? 0.55 : 1,
              ...(isFlow ? { borderWidth: 2, borderColor: p.text } : { boxShadow: `0px 2px 0px ${p.shadow}` }),
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isFlow ? <Drop size={16} /> : <Ionicons name={KIND_ICON[block.kind]} size={15} color={p.muted} />}
                <Txt variant="bodyStrong" style={{ flex: 1, textDecorationLine: block.done ? 'line-through' : 'none' }} numberOfLines={2}>
                  {block.title}
                </Txt>
              </View>
              {sub ? (
                <Txt variant="small" style={{ marginTop: 3 }} numberOfLines={2}>
                  {sub}
                </Txt>
              ) : null}
            </View>
            {block.done ? (
              <Ionicons name="checkmark-circle" size={24} color={p.success} />
            ) : eta ? (
              <Badge text={eta} />
            ) : by ? (
              <Pebble shape={by.shape} color={by.color} face={by.face} mark={by.mark} size={28} animate={false} />
            ) : null}
          </View>
          {isFlow && !block.done && onFlow ? (
            <Btn title="Dive in" small style={{ marginTop: 10 }} onPress={onFlow} icon="water" />
          ) : null}
        </View>
      </PressScale>
    </Animated.View>
  );
}
