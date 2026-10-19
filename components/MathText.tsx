/**
 * Text that may contain math. Plain text renders as normal app text; text
 * with LaTeX ($...$) is typeset by MathDom.
 */
import React from 'react';
import { Platform, View, type StyleProp, type TextStyle } from 'react-native';
import { hasMath, mathToPlain } from '@/lib/mathText';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './ui';
import MathDom from './MathDom';

type Variant = 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small';

const SIZES: Record<Variant, { size: number; weight: number }> = {
  h2: { size: 22, weight: 700 },
  h3: { size: 16.5, weight: 700 },
  body: { size: 15.5, weight: 400 },
  bodyStrong: { size: 15.5, weight: 600 },
  small: { size: 13.5, weight: 400 },
};

export function MathText({
  text,
  variant = 'body',
  color,
  center,
  style,
}: {
  text: string;
  variant?: Variant;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const p = useTheme();
  if (!hasMath(text)) {
    return (
      <Txt variant={variant} color={color} center={center} style={style}>
        {text}
      </Txt>
    );
  }
  const { size, weight } = SIZES[variant];
  return (
    <View style={[{ alignSelf: 'stretch' }, style as object]} accessible accessibilityLabel={mathToPlain(text)}>
      <MathDom
        text={text}
        color={color ?? p.text}
        size={size}
        weight={weight}
        align={center ? 'center' : 'left'}
        dom={Platform.OS === 'web' ? undefined : { matchContents: true, scrollEnabled: false, style: { backgroundColor: 'transparent' } }}
      />
    </View>
  );
}
