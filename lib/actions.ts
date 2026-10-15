/**
 * What happens when you approve something a teammate proposed. Every action
 * leaves a receipt and comes with an undo.
 */
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import { isoDate } from './dates';
import { nameOf, useFamily } from './store';
import type { BlockKind, ProposedAction } from './types';

function s(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function normTime(v: unknown, fallback = '18:00'): string {
  const t = s(v);
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return fallback;
}

function normDate(v: unknown): string {
  const t = s(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/tomorrow/i.test(t)) return isoDate(new Date(Date.now() + 86400000));
  return isoDate();
}

function guessKind(title: string): BlockKind {
  const l = title.toLowerCase();
  if (/run|gym|lift|workout|swim|ride|train/.test(l)) return 'run';
  if (/study|review|exam|quiz|read|homework|flashcard/.test(l)) return 'study';
  if (/code|build|fix|ship|deploy|pr\b|bug|app/.test(l)) return 'code';
  if (/class|lecture|lab/.test(l)) return 'class';
  return 'event';
}

export interface ActionOutcome {
  text: string;
  undo?: () => void;
}

export async function runAction(action: ProposedAction, memberId: string): Promise<ActionOutcome> {
  const st = useFamily.getState();
  const who = nameOf(memberId);
  const input = action.input;

  switch (action.name) {
    case 'add_event':
    case 'add_task': {
      const title = s(input.title, 'New block');
      const block = st.addBlock({
        date: normDate(input.date),
        time: normTime(input.time, action.name === 'add_task' ? '09:00' : '18:00'),
        end: input.end ? normTime(input.end) : undefined,
        title,
        sub: s(input.location) || (action.name === 'add_task' ? 'Task' : `Placed by ${who}`),
        kind: action.name === 'add_task' ? 'task' : guessKind(title),
        by: memberId,
        location: s(input.location) || undefined,
      });
      const receipt = st.addReceipt({ memberId, text: `Added "${title}" to your calendar`, connector: 'Calendar', kind: 'did', undoable: true, undoRef: { kind: 'block', id: block.id } });
      return { text: `Added "${title}".`, undo: () => useFamily.getState().undoReceipt(receipt.id) };
    }
    case 'start_flow': {
      const task = s(input.task, 'Deep work');
      router.push({ pathname: '/flow', params: { task, sprints: String(Number(input.sprints) || 4), minutes: String(Number(input.minutes) || 50) } });
      return { text: `Flow is ready: ${task}.` };
    }
    case 'draft_message': {
      const text = s(input.text);
      const to = s(input.to);
      await Clipboard.setStringAsync(text).catch(() => {});
      st.addReceipt({ memberId, text: `Drafted a message to ${to || 'someone'} (not sent)`, connector: 'Drafts', kind: 'did', undoable: false });
      if (/@/.test(to)) {
        Linking.openURL(`mailto:${encodeURIComponent(to)}?body=${encodeURIComponent(text)}`).catch(() => {});
        return { text: 'Opened in Mail. Sending is your tap.' };
      }
      return { text: 'Copied the draft. Paste it wherever it goes; sending is always your tap.' };
    }
    case 'create_routine': {
      const name = s(input.name, 'New routine');
      st.addRoutine({ name, when: s(input.when, 'Every day at 8:00 AM'), then: s(input.then, name), memberId, on: true });
      const id = useFamily.getState().routines.at(-1)?.id ?? '';
      const receipt = st.addReceipt({ memberId, text: `Created the routine "${name}"`, connector: 'Routines', kind: 'did', undoable: true, undoRef: { kind: 'routine', id } });
      return { text: `Routine "${name}" is on.`, undo: () => useFamily.getState().undoReceipt(receipt.id) };
    }
    case 'plan_errand': {
      router.push({ pathname: '/errand/new', params: { request: s(input.request), member: memberId } });
      return { text: 'Opening the errand.' };
    }
    case 'make_flashcards': {
      const deck = s(input.deck, 'Study deck');
      const cards = Array.isArray(input.cards)
        ? (input.cards as { front?: unknown; back?: unknown }[])
            .map((c) => ({ front: s(c.front), back: s(c.back), deck }))
            .filter((c) => c.front && c.back)
        : [];
      st.addFlashcards(cards);
      const receipt = st.addReceipt({ memberId, text: `Made ${cards.length} flashcards: ${deck}`, connector: 'Flashcards', kind: 'did', undoable: true, undoRef: { kind: 'deck', id: deck } });
      return { text: `${cards.length} cards in "${deck}".`, undo: () => useFamily.getState().undoReceipt(receipt.id) };
    }
    default:
      return { text: 'Done.' };
  }
}
