/**
 * Bringing memory over from another AI. The person copies a prompt into the
 * other assistant, pastes its answer back, and approves each item before
 * anything is saved. Parsing happens on the phone; nothing is sent anywhere.
 */

export const IMPORT_SOURCES = ['ChatGPT', 'Gemini', 'Claude', 'Copilot', 'Other'] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

export const IMPORT_PROMPT = `I'm setting up a new assistant app called Eternity and want it to know me the way you do. Please list everything you know or remember about me that would help a new assistant help me well: my name, what I do, my goals and projects, how I like to work, routines, preferences, how I like answers written, and the people or things I mention often.

Rules for the list:
- One short fact per line, starting with "- ".
- Third person, plain sentences, like "- Prefers short answers with examples."
- Only things I actually told you or that you're confident about.
- Leave out passwords, account or ID numbers, and anything about health, money, religion, politics, relationships or other private topics.

Put the whole list in a single code block so I can copy it.`;

export interface ImportItem {
  id: string;
  text: string;
  keep: boolean;
  /** Looks private, so it starts unchecked. */
  sensitive: boolean;
  /** Already remembered, so it starts unchecked. */
  duplicate: boolean;
}

// Words that suggest a private topic. Matching items start unchecked; the
// person can still keep them on purpose.
const SENSITIVE =
  /\b(diagnos\w*|disorder|therap\w*|medicat\w*|prescri\w*|illness|disease|surgery|pregnan\w*|depress\w*|anxiety|adhd|autis\w*|bipolar|ptsd|salary|income|debt|loan|credit score|net worth|bank account|ssn|social security|passport|password|religio\w*|church|mosque|synagogue|faith|political|democrat|republican|liberal|conservative|sexual\w*|gay|lesbian|bisexual|transgender|immigra\w*|visa status|arrest\w*|convict\w*)\b/i;

function cleanLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*•‣◦▪]|\d+[.)]|\[[ x]\])\s+/i, '') // bullets, numbers, checkboxes
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turns whatever the other AI said into a list of candidate facts. */
export function parseImport(raw: string, existing: string[]): ImportItem[] {
  // Prefer what's inside a code block when there is one.
  const fenced = [...raw.matchAll(/```[a-z-]*\n?([\s\S]*?)```/gi)].map((m) => m[1]).join('\n');
  const body = fenced.trim() ? fenced : raw;
  const have = new Set(existing.map((t) => t.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: ImportItem[] = [];

  for (const rawLine of body.split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    if (/^#{1,6}\s/.test(rawLine.trim())) continue; // markdown headings
    if (/:$/.test(line) && line.length < 48) continue; // "Work:" style labels
    if (line.length < 8) continue;
    if (/^(here('| i)s|sure|okay|of course|i don't|i do not|let me know|hope this)/i.test(line)) continue; // chatter
    // Short values keep their label ("Name: Joshua"); full sentences don't need it.
    const labeled = line.match(/^([A-Za-z][\w /&]{1,24}):\s+(.+)$/);
    const useValue = labeled && labeled[2].trim().split(/\s+/).length >= 4;
    const text = (useValue ? labeled[2] : line).replace(/\s*\.?$/, '.').replace(/\.\.$/, '.');
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const duplicate = have.has(key) || have.has(key.replace(/\.$/, ''));
    const sensitive = SENSITIVE.test(text);
    out.push({ id: `imp${out.length}`, text: text.slice(0, 220), keep: !sensitive && !duplicate, sensitive, duplicate });
    if (out.length >= 80) break;
  }
  return out;
}
