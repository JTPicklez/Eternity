/**
 * Talking to Claude through the callFamily Cloud Function.
 *
 * The API key lives only on the server. The app sends the signed-in user's
 * Firebase ID token; the function checks it, picks the model for their plan,
 * applies daily caps and calls Claude. Nothing here or on the server logs
 * the content of a conversation.
 *
 * When there's no account (preview mode) or the function can't be reached,
 * teammates answer with a clearly labelled preview reply instead.
 */
import { getIdToken } from '@/firebase/auth';
import { FUNCTIONS_BASE } from '@/firebase/config';
import { templateFor } from './catalog';
import { clockAmPm, isoDate } from './dates';
import { useFamily } from './store';
import type { ChatMessage, Member, ProposedAction } from './types';

export const CALL_FAMILY_URL = `${FUNCTIONS_BASE}/callFamily`;

export type Task = 'chat' | 'table' | 'huddle' | 'page' | 'flashcards' | 'review' | 'plan';

export interface AiResult {
  text: string;
  rawContent: unknown[];
  actions: ProposedAction[];
  memories: string[];
  options: { title: string; desc: string }[];
  preview: boolean;
  model?: string;
  limited?: { used: number; limit: number };
}

// ── what each proposed action looks like on its card ────────────────────────
export const ACTION_META: Record<string, { verb: string; icon: string; alwaysAsk?: boolean }> = {
  add_event: { verb: 'Add to your calendar', icon: 'calendar-outline' },
  add_task: { verb: 'Add a task', icon: 'checkbox-outline' },
  start_flow: { verb: 'Start a Flow session', icon: 'water-outline' },
  draft_message: { verb: 'Draft a message', icon: 'mail-outline', alwaysAsk: true },
  create_routine: { verb: 'Create a routine', icon: 'repeat-outline' },
  plan_errand: { verb: 'Start an errand', icon: 'bag-handle-outline', alwaysAsk: true },
  make_flashcards: { verb: 'Make flashcards', icon: 'albums-outline' },
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

export function describeAction(name: string, input: Record<string, unknown>): { summary: string; detail?: string } {
  const title = str(input.title);
  switch (name) {
    case 'add_event': {
      const when = [input.date ? str(input.date) : 'today', input.time ? clockAmPm(str(input.time)) : ''].filter(Boolean).join(' at ');
      return { summary: `"${title}"`, detail: `${when}${input.end ? ` until ${clockAmPm(str(input.end))}` : ''}${input.location ? ` · ${str(input.location)}` : ''}` };
    }
    case 'add_task':
      return { summary: `"${title}"`, detail: input.date ? `Due ${str(input.date)}` : 'Today' };
    case 'start_flow':
      return { summary: `${str(input.task) || 'Deep work'}`, detail: `${Number(input.sprints) || 4} sprints of ${Number(input.minutes) || 50} minutes` };
    case 'draft_message':
      return { summary: `To ${str(input.to) || 'someone'}`, detail: str(input.text) };
    case 'create_routine':
      return { summary: str(input.name) || 'New routine', detail: `When ${str(input.when)}, ${str(input.then)}` };
    case 'plan_errand':
      return { summary: str(input.request), detail: 'Look and prepare only. You make the final tap.' };
    case 'make_flashcards':
      return { summary: str(input.deck) || 'New deck', detail: `${Array.isArray(input.cards) ? input.cards.length : 0} cards` };
    default:
      return { summary: name };
  }
}

// ── parsing what comes back ─────────────────────────────────────────────────
const MEMORY_RE = /```eternity-memory\s*([\s\S]*?)```/g;
const OPTIONS_RE = /```eternity-options\s*([\s\S]*?)```/g;

export function parseBlocks(text: string): { clean: string; memories: string[]; options: { title: string; desc: string }[] } {
  const memories: string[] = [];
  const options: { title: string; desc: string }[] = [];
  let clean = text.replace(MEMORY_RE, (_m, body: string) => {
    body
      .split('\n')
      .map((l) => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean)
      .forEach((l) => memories.push(l));
    return '';
  });
  clean = clean.replace(OPTIONS_RE, (_m, body: string) => {
    try {
      const parsed = JSON.parse(body.trim()) as { title?: string; desc?: string }[];
      parsed.forEach((o) => o.title && options.push({ title: o.title, desc: o.desc ?? '' }));
    } catch {
      /* ignore malformed options */
    }
    return '';
  });
  return { clean: clean.replace(/\n{3,}/g, '\n\n').trim(), memories, options };
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

function toResult(content: ContentBlock[], extra: Partial<AiResult> = {}): AiResult {
  const text = content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
  const { clean, memories, options } = parseBlocks(text);
  const actions: ProposedAction[] = content
    .filter((b) => b.type === 'tool_use' && b.name && b.id)
    .map((b) => {
      const input = b.input ?? {};
      const d = describeAction(b.name!, input);
      return {
        id: `a_${b.id}`,
        toolUseId: b.id!,
        name: b.name!,
        input,
        summary: d.summary,
        detail: d.detail,
        status: 'pending' as const,
        alwaysAsk: ACTION_META[b.name!]?.alwaysAsk,
      };
    });
  return { text: clean, rawContent: content, actions, memories, options, preview: false, ...extra };
}

// ── history ─────────────────────────────────────────────────────────────────
const RESULT_TEXT = {
  approved: 'Approved and completed. This is already done. Do not propose it again.',
  declined: 'The person declined this action. Do not propose the same thing again unless they ask again.',
  pending: 'Still waiting on the person to confirm. Not decided yet.',
};

/**
 * Turns the on-phone chat into the shape Claude expects: alternating turns,
 * starting with the person, and every tool_use answered by a tool_result.
 */
export function buildHistory(messages: ChatMessage[], nextUserText?: string, maxTurns = 24) {
  const recent = messages.filter((m) => !m.pending && (m.text || m.rawContent)).slice(-maxTurns);
  const out: { role: 'user' | 'assistant'; content: unknown }[] = [];
  let carry: unknown[] = []; // tool_results waiting for the next user turn

  const pushUser = (blocks: unknown[]) => {
    const last = out[out.length - 1];
    if (last && last.role === 'user' && Array.isArray(last.content)) (last.content as unknown[]).push(...blocks);
    else out.push({ role: 'user', content: blocks });
  };

  for (const m of recent) {
    if (m.role === 'assistant') {
      if (out.length === 0) continue; // must start with the person
      if (carry.length) {
        pushUser(carry);
        carry = [];
      }
      const hasTools = Array.isArray(m.rawContent) && (m.rawContent as ContentBlock[]).some((b) => b.type === 'tool_use');
      const content = hasTools ? m.rawContent : m.text || '…';
      const last = out[out.length - 1];
      if (last.role === 'assistant') {
        // two assistant turns in a row: merge text only
        if (!hasTools && typeof last.content === 'string') last.content = `${last.content}\n\n${m.text}`;
        else out.push({ role: 'user', content: [{ type: 'text', text: '(continue)' }] }, { role: 'assistant', content });
      } else out.push({ role: 'assistant', content });
      if (hasTools) {
        carry = (m.rawContent as ContentBlock[])
          .filter((b) => b.type === 'tool_use')
          .map((b) => {
            const action = m.actions?.find((a) => a.toolUseId === b.id);
            return { type: 'tool_result', tool_use_id: b.id, content: RESULT_TEXT[action?.status ?? 'pending'] };
          });
      }
    } else {
      const blocks: unknown[] = [...carry, { type: 'text', text: m.text }];
      carry = [];
      pushUser(blocks);
    }
  }
  if (nextUserText) {
    pushUser([...carry, { type: 'text', text: nextUserText }]);
    carry = [];
  } else if (carry.length) pushUser([...carry, { type: 'text', text: '(continue)' }]);
  return out;
}

// ── context the teammate gets ───────────────────────────────────────────────
export function buildContext(member: Member) {
  const s = useFamily.getState();
  const today = isoDate();
  const todays = s.blocks
    .filter((b) => b.date === today)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((b) => `${clockAmPm(b.time)}${b.end ? `–${clockAmPm(b.end)}` : ''} ${b.title}${b.done ? ' (done)' : ''}`);
  const upcoming = s.blocks
    .filter((b) => b.date > today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 12)
    .map((b) => `${b.date} ${clockAmPm(b.time)} ${b.title}`);
  const t = templateFor(member.kind);
  return {
    firstName: s.firstName || 'there',
    now: new Date().toString(),
    member: {
      name: member.name,
      defaultName: member.defaultName,
      role: member.role,
      persona:
        member.kind === 'custom'
          ? `You are ${member.name}, a teammate whose job is: ${member.role}. How you work: ${member.blurb}`
          : t.persona,
      personality: member.personality,
      autonomy: member.autonomy,
      isHead: member.id === s.headId,
    },
    family: s.members.map((m) => ({ name: m.name, role: m.role, head: m.id === s.headId })),
    charter: s.charter,
    // Saved facts only; nothing is learned silently unless the person turned learning on.
    memory: s.settings.privateSession ? [] : s.facts.slice(0, 40).map((f) => f.text),
    learning: s.settings.learning && !s.settings.privateSession,
    today: todays,
    upcoming,
    connected: s.connected,
  };
}

// ── the call ────────────────────────────────────────────────────────────────
export async function askTeammate({
  member,
  history,
  text,
  task = 'chat',
  extra,
  deep,
}: {
  member: Member;
  history: ChatMessage[];
  text: string;
  task?: Task;
  extra?: Record<string, unknown>;
  deep?: boolean;
}): Promise<AiResult> {
  const s = useFamily.getState();
  const gate = s.bumpUsage('messages');
  if (!gate.ok) {
    return {
      text: `That's the ${gate.limit} messages included today on your plan. I'll be right here tomorrow, or Plus lifts the cap now.`,
      rawContent: [],
      actions: [],
      memories: [],
      options: [],
      preview: false,
      limited: { used: gate.used, limit: gate.limit },
    };
  }

  const token = s.guest ? null : await getIdToken();
  if (!token) return simulate(member, text, task);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    const res = await fetch(CALL_FAMILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        task,
        deep: !!deep,
        context: buildContext(member),
        messages: buildHistory(history, text),
        extra,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 429) {
      const data = (await res.json().catch(() => ({}))) as { used?: number; limit?: number };
      return {
        text: "That's everything included today on your plan. Plus lifts the cap, or I'll pick this up tomorrow.",
        rawContent: [],
        actions: [],
        memories: [],
        options: [],
        preview: false,
        limited: { used: data.used ?? 0, limit: data.limit ?? 0 },
      };
    }
    if (!res.ok) return simulate(member, text, task);
    const data = (await res.json()) as { content?: ContentBlock[]; model?: string };
    return toResult(data.content ?? [], { model: data.model });
  } catch {
    return simulate(member, text, task);
  }
}

// ── preview replies (no account, offline, or the function isn't deployed) ───
function previewTime(text: string): string | undefined {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return undefined;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
}

function titleFrom(text: string, fallback: string): string {
  const cleaned = text
    .replace(/^(please|can you|could you|hey|yo|ok)[,\s]+/i, '')
    .replace(/\b(add|schedule|put|remind me to|remind me|block out|block|set up|book|plan)\b/gi, '')
    .replace(/\b\d+(\.\d+)?\s*(hours?|hrs?|minutes?|mins?)\b/gi, '')
    .replace(/\b(at|on)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b(today|tomorrow|tonight|this (morning|afternoon|evening))\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(for|to|a|an)\s+/i, '')
    .replace(/[?.!]+$/, '')
    .trim();
  const t = cleaned.length > 3 ? cleaned : fallback;
  return t.charAt(0).toUpperCase() + t.slice(1, 60);
}

function durationMinutes(text: string): number | undefined {
  const m = text.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return /^h/i.test(m[2]) ? Math.round(n * 60) : Math.round(n);
}

export function simulate(member: Member, text: string, task: Task = 'chat'): AiResult {
  const lower = text.toLowerCase();
  const first = useFamily.getState().firstName || 'friend';
  const content: ContentBlock[] = [];
  const say = (t: string) => content.push({ type: 'text', text: t });
  const tool = (name: string, input: Record<string, unknown>) =>
    content.push({ type: 'tool_use', id: `toolu_preview_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, input });

  const tomorrow = /tomorrow/.test(lower);
  const date = isoDate(tomorrow ? new Date(Date.now() + 86400000) : new Date());

  if (task === 'table') {
    say(`Here's how I'd split it so nobody loses their block.`);
    say(
      '```eternity-options\n' +
        JSON.stringify([
          { title: 'Stack them', desc: 'Study first while you are fresh, then the build block right after with a 15 minute reset.' },
          { title: 'Split the day', desc: 'Build block at lunch, study block in the evening. Both get full attention.' },
        ]) +
        '\n```',
    );
  } else if (/\b(flight|movie|ticket|uber|lyft|ride|book|reserve|order)\b/.test(lower)) {
    say(`On it. I'll look and get everything ready, then you make the final tap with Face ID. Nothing gets paid for without you.`);
    tool('plan_errand', { request: text });
  } else if (/\b(schedule|block|add|put|remind)\b/.test(lower) && (/\b(tomorrow|tonight|today|at \d|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower) || !!previewTime(text))) {
    const time = previewTime(text) ?? (/tonight/.test(lower) ? '20:00' : '18:00');
    const mins = durationMinutes(text) ?? 60;
    const [h, mm] = time.split(':').map(Number);
    const endMin = Math.min(23 * 60 + 59, h * 60 + mm + mins);
    const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    say(`Here's the block. Approve it and it goes on your calendar.`);
    tool('add_event', { title: titleFrom(text, 'Focus block'), date, time, end });
  } else if (/\b(focus|flow|deep work|lock in|grind)\b/.test(lower)) {
    say(`Let's go. I'll quiet everything else and keep the clock.`);
    tool('start_flow', { task: titleFrom(text, 'Deep work'), sprints: 4, minutes: 50 });
  } else if (/\b(every|each|routine|whenever)\b/.test(lower)) {
    say(`That's a good one to automate. Here's the routine. You can pause it anytime.`);
    tool('create_routine', { name: titleFrom(text, 'New routine'), when: 'Every weekday at 8:00 AM', then: text });
  } else if (/\b(email|text|message|reply|dm)\b/.test(lower)) {
    say(`Drafted. I won't send it; that's always your call.`);
    tool('draft_message', { to: 'your professor', text: `Hi, quick question about this week: ${text.replace(/^(email|text|message)\s*/i, '')}. Thanks so much!` });
  } else if (/\b(flashcards?|quiz me|study deck)\b/.test(lower)) {
    say(`Here's a starter deck. Flip through it in Flashcards.`);
    tool('make_flashcards', {
      deck: titleFrom(text.replace(/flashcards?|make|quiz me|on|about/gi, ''), 'Study deck'),
      cards: [
        { front: 'What is the main idea?', back: 'Write it in one sentence before you look anything up.' },
        { front: 'Why does it matter?', back: 'Connect it to something you already know.' },
        { front: 'Give an example', back: 'Make it concrete. Examples stick.' },
      ],
    });
  } else if (/\b(add|schedule|remind|block|put|calendar|meeting|study|run|gym|class)\b/.test(lower) || previewTime(text)) {
    const time = previewTime(text) ?? '18:00';
    say(`Done thinking. Here's the block. Approve it and it goes on your calendar.`);
    tool('add_event', { title: titleFrom(text, 'New block'), date, time });
  } else if (/\b(stressed|overwhelmed|too much|behind|slammed)\b/.test(lower)) {
    say(
      `Okay ${first}, let's make it lighter, not smaller. Give me the three things that are due soonest and I'll put them in order, find the time for each, and take the busywork off your plate.`,
    );
  } else if (/\b(hi|hey|hello|yo|sup|morning)\b/.test(lower)) {
    say(`Hey ${first}. I'm ${member.name}. ${member.blurb} What are we taking on?`);
  } else {
    const t = templateFor(member.kind);
    say(
      `${member.kind === 'bolt' ? 'Short version:' : 'Here is how I see it.'} ${
        member.kind === 'sage'
          ? "Let's break it into the idea, one worked example and a quick self-test."
          : member.kind === 'bolt'
            ? 'reproduce it, isolate it, fix the smallest thing, then test the edge.'
            : member.kind === 'pace'
              ? 'consistency beats intensity. Pick the session you can hit today and lock it in.'
              : 'pick the one thing that moves the goal most this week, give it a protected block, and let me handle the rest.'
      } Ask me to schedule it and I'll find the time.`,
    );
    void t;
  }
  return { ...toResult(content), preview: true };
}
