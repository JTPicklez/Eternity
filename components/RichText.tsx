import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { hasMath } from '@/lib/mathText';
import { MathText } from './MathText';

/** Just enough markdown for chat: paragraphs, bullets, numbered lists, **bold** and $math$. */
export function RichText({ text, color, size = 15.5 }: { text: string; color?: string; size?: number }) {
  const p = useTheme();
  const c = color ?? p.text;

  const inline = (line: string, key: string) => {
    // Lines with LaTeX get typeset; everything else stays plain app text.
    if (hasMath(line)) return <MathText key={key} text={line} color={c} />;
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return (
      <Text key={key} style={{ fontFamily: fonts.body, fontSize: size, lineHeight: size * 1.45, color: c }} maxFontSizeMultiplier={1.4} selectable>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**'))
            return (
              <Text key={i} style={{ fontFamily: fonts.bodySemi }}>
                {part.slice(2, -2)}
              </Text>
            );
          if (part.startsWith('`') && part.endsWith('`'))
            return (
              <Text key={i} style={{ fontFamily: fonts.mono, fontSize: size - 1.5 }}>
                {part.slice(1, -1)}
              </Text>
            );
          return part.replace(/^#{1,4}\s+/, '');
        })}
      </Text>
    );
  };

  // Keep $$...$$ blocks that span lines together.
  const lines = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => m.replace(/\n/g, ' ')).split('\n');
  return (
    <View style={{ gap: 6 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (bullet || numbered) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 2 }}>
              <Text style={{ fontFamily: fonts.monoMedium, fontSize: size - 1, lineHeight: size * 1.45, color: p.muted, minWidth: 14 }}>
                {numbered ? `${numbered[1]}.` : '•'}
              </Text>
              <View style={{ flex: 1 }}>{inline(numbered ? numbered[2] : bullet![1], `l${i}`)}</View>
            </View>
          );
        }
        return inline(line, `p${i}`);
      })}
    </View>
  );
}
