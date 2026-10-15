import React, { useEffect, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Txt } from './ui';

/** Types text out a few characters at a time, like someone talking. */
export function Typewriter({
  text,
  variant = 'h2',
  speed = 22,
  delay = 0,
  onDone,
  style,
  color,
}: {
  text: string;
  variant?: 'display' | 'title' | 'h2' | 'h3' | 'body' | 'bodyStrong';
  speed?: number;
  delay?: number;
  onDone?: () => void;
  style?: StyleProp<TextStyle>;
  color?: string;
}) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);

  useEffect(() => {
    if (reduced) {
      setN(text.length);
      onDone?.();
      return;
    }
    setN(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i = Math.min(text.length, i + 2);
      setN(i);
      if (i < text.length) timer = setTimeout(tick, speed + (/[.,!?]/.test(text[i - 1] ?? '') ? 160 : 0));
      else onDone?.();
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduced]);

  return (
    <Txt variant={variant} style={style} color={color} accessibilityLabel={text}>
      {text.slice(0, n)}
      <Txt variant={variant} color="transparent">
        {text.slice(n)}
      </Txt>
    </Txt>
  );
}
