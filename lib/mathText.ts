/**
 * Finding math in text. Teammates write math in LaTeX between $...$ (inline)
 * or $$...$$ (on its own line); \( \) and \[ \] work too.
 */

export type MathSegment = { kind: 'text'; value: string } | { kind: 'math'; value: string; display: boolean };

// $$...$$, \[...\], \(...\) and $...$ (a $ followed by a space or digit-only
// price like "$20" is left alone).
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/g;

export function splitMath(text: string): MathSegment[] {
  const out: MathSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(MATH_RE)) {
    const inline = m[4];
    // "$5 and $10" is money, not math.
    if (inline !== undefined && /^\d+(?:[.,]\d+)?$/.test(inline.trim())) continue;
    if (m.index! > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
    const tex = (m[1] ?? m[2] ?? m[3] ?? inline ?? '').trim();
    out.push({ kind: 'math', value: tex, display: m[1] !== undefined || m[2] !== undefined });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

export function hasMath(text: string | undefined | null): boolean {
  if (!text) return false;
  return splitMath(text).some((s) => s.kind === 'math');
}

/** A plain-text version for screen readers and previews. */
export function mathToPlain(text: string): string {
  return splitMath(text)
    .map((s) =>
      s.kind === 'text'
        ? s.value
        : s.value
            .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
            .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
            .replace(/\\(cdot|times)/g, '·')
            .replace(/\\left|\\right/g, '')
            .replace(/\\([a-zA-Z]+)/g, '$1')
            .replace(/[{}]/g, ''),
    )
    .join('');
}
