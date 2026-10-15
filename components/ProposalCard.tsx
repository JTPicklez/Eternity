import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ACTION_META } from '@/lib/ai';
import type { ProposedAction } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';
import { Btn, Row, Txt, type IconName } from './ui';

/** A teammate's proposed action: nothing happens until you approve it. */
export function ProposalCard({
  action,
  color,
  onApprove,
  onDecline,
}: {
  action: ProposedAction;
  color: string;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const p = useTheme();
  const meta = ACTION_META[action.name] ?? { verb: 'Do this', icon: 'flash-outline' };
  const decided = action.status !== 'pending';
  return (
    <Animated.View entering={FadeInDown.springify()} style={[carved[1], { marginTop: 8, backgroundColor: p.card, borderWidth: 2, borderColor: decided ? p.line : p.text, padding: 14, opacity: action.status === 'declined' ? 0.6 : 1 }]}>
      <Row gap={10}>
        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={meta.icon as IconName} size={18} color="#1E2023" />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="label">{meta.verb}</Txt>
          <Txt variant="bodyStrong" numberOfLines={3}>
            {action.summary}
          </Txt>
        </View>
      </Row>
      {action.detail ? (
        <Txt variant="small" style={{ marginTop: 8 }} numberOfLines={6}>
          {action.detail}
        </Txt>
      ) : null}
      {action.alwaysAsk && !decided ? (
        <Row gap={6} style={{ marginTop: 8 }}>
          <Ionicons name="lock-closed-outline" size={13} color={p.muted} />
          <Txt variant="tiny">This always asks you first. Your tap is the final one.</Txt>
        </Row>
      ) : null}
      {decided ? (
        <Row gap={6} style={{ marginTop: 10 }}>
          <Ionicons name={action.status === 'approved' ? 'checkmark-circle' : 'close-circle'} size={16} color={action.status === 'approved' ? p.success : p.muted} />
          <Txt variant="smallStrong" color={action.status === 'approved' ? p.success : p.muted}>
            {action.status === 'approved' ? 'Approved' : 'Not now'}
          </Txt>
        </Row>
      ) : (
        <Row gap={8} style={{ marginTop: 12 }}>
          <Btn title="Approve" small icon="checkmark" onPress={onApprove} />
          <Btn title="Not now" small variant="ghost" onPress={onDecline} />
        </Row>
      )}
    </Animated.View>
  );
}
