'use dom';
/**
 * Typeset math with KaTeX. This is an Expo DOM component: on the web it
 * renders inline, on iPhone it runs in a small web view sized to fit. KaTeX
 * writes MathML, which browsers and WebKit draw natively, so no fonts or
 * stylesheets need to be bundled.
 */
import React from 'react';
import katex from 'katex';
import { IS_DOM, type DOMProps } from 'expo/dom';
import { splitMath } from '@/lib/mathText';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function textToHtml(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

function renderMathHtml(text: string): string {
  return splitMath(text)
    .map((seg) => {
      if (seg.kind === 'text') return textToHtml(seg.value);
      try {
        return katex.renderToString(seg.value, { output: 'mathml', throwOnError: false, displayMode: seg.display, strict: false });
      } catch {
        return `<code>${escapeHtml(seg.value)}</code>`;
      }
    })
    .join('');
}

export default function MathDom({
  text,
  color = '#1E2023',
  size = 18,
  align = 'left',
  weight = 400,
}: {
  text: string;
  color?: string;
  size?: number;
  align?: 'left' | 'center';
  weight?: number;
  dom?: DOMProps;
}) {
  const html = renderMathHtml(text);
  return (
    <div
      style={{
        color,
        fontSize: size,
        lineHeight: 1.45,
        textAlign: align,
        fontWeight: weight,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        margin: 0,
        padding: 0,
        background: 'transparent',
        overflowWrap: 'anywhere',
        WebkitTextSizeAdjust: '100%',
      }}
    >
      <style>{`${IS_DOM ? 'html, body { margin: 0; padding: 0; background: transparent; }' : ''}
        math { font-size: 1.12em; }
        math[display="block"] { margin: 0.35em 0; }
        code { font-family: ui-monospace, Menlo, monospace; font-size: 0.9em; }
      `}</style>
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
