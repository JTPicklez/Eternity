export type Shape = 'diamond' | 'almond' | 'wedge' | 'bean' | 'round';
export type Face = 'eyes' | 'sleepy' | 'faceless';
export type Mark = 'diamond' | 'book' | 'brackets' | 'pulse' | 'spark' | 'chart' | 'pen';
export type Motion = 'calm' | 'slow' | 'bouncy' | 'sharp';
/** What the stone is made of. Gold and marble are Plus. */
export type Finish = 'smooth' | 'granite' | 'glass' | 'moss' | 'glow' | 'gold' | 'marble';
/** The expression a pebble wears. Work states pick one automatically. */
export type Mood = 'happy' | 'curious' | 'focused' | 'proud' | 'sleepy' | 'excited' | 'surprised';
/** Accessories. Some are free, some are earned with time together, some are Plus. */
export type Extra =
  | 'glasses'
  | 'sunglasses'
  | 'freckles'
  | 'bow'
  | 'beanie'
  | 'sprout'
  | 'flower'
  | 'star'
  | 'crown'
  | 'partyhat';
export type Autonomy = 'suggest' | 'ask' | 'do';
export type ActionLevel = 'auto' | 'tell' | 'ask';
export type MemberState = 'idle' | 'working' | 'waiting' | 'done';
export type Tier = 'free' | 'plus' | 'pro' | 'founding';
export type ThemePref = 'system' | 'paper' | 'ink';

export interface Personality {
  tone: number; // 0 gentle .. 100 blunt
  talk: number; // 0 quiet .. 100 chatty
  push: number; // 0 steady .. 100 relentless
}

export interface Member {
  id: string;
  kind: string; // template id
  name: string;
  defaultName: string;
  role: string;
  blurb: string;
  color: string;
  shape: Shape;
  face: Face;
  mark: Mark;
  motion: Motion;
  finish: Finish;
  /** Resting expression when they aren't busy. Defaults to happy. */
  mood?: Mood;
  extras?: Extra[];
  /** Keep the stone looking brand new instead of wearing smooth over time. */
  polished?: boolean;
  personality: Personality;
  autonomy: Autonomy;
  actionLevels: Record<string, ActionLevel>;
  connectors: string[];
  triggers: string[];
  seat: number; // 0..8 around the loop, -1 = the center (lead)
  state: MemberState;
  status: string;
  joinedAt: number;
}

export interface Charter {
  goals: string[];
  nonNegotiables: string[];
  push: number;
  slammed: { triage: boolean; hours: boolean; busywork: boolean };
  autonomy: Autonomy;
  packs: string[];
}

export type BlockKind = 'leave' | 'class' | 'study' | 'code' | 'run' | 'flow' | 'event' | 'task';

export interface Block {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM 24h
  end?: string;
  title: string;
  sub?: string;
  kind: BlockKind;
  by?: string; // member id that placed it
  location?: string;
  done?: boolean;
}

export interface Receipt {
  id: string;
  at: number;
  memberId: string;
  text: string;
  connector: string;
  kind: 'did' | 'read';
  undoable: boolean;
  undone?: boolean;
  /** What undo actually reverses. */
  undoRef?: { kind: 'block' | 'routine' | 'deck'; id: string };
}

export interface ProposedAction {
  id: string;
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
  summary: string;
  detail?: string;
  status: 'pending' | 'approved' | 'declined';
  alwaysAsk?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  memberId?: string;
  text: string;
  at: number;
  actions?: ProposedAction[];
  /** The raw content blocks Claude returned, replayed so tool results line up. */
  rawContent?: unknown[];
  pending?: boolean;
  /** A sample reply (preview mode or offline), not from Claude. */
  preview?: boolean;
}

export interface TableOption {
  id: string;
  title: string;
  desc: string;
}

export interface TableMessage {
  id: string;
  from: string; // member id or 'you'
  text: string;
  at: number;
  options?: TableOption[];
  chosen?: string;
  draft?: { to: string; text: string; sent: boolean };
  actions?: ProposedAction[];
  preview?: boolean;
}

export interface Connector {
  id: string;
  name: string;
  mono: string;
  category: string;
  blurb: string;
  connected: boolean;
  plusOnly?: boolean;
  /** New and still being tested on real accounts. */
  beta?: boolean;
  unavailable?: string;
  usedBy: string[];
  packs: string[];
  caps: { label: string; level: 'auto' | 'tell' | 'ask' | 'always' }[];
}

export interface Routine {
  id: string;
  name: string;
  when: string;
  then: string;
  memberId: string;
  on: boolean;
}

export interface ErrandStep {
  label: string;
  status: 'done' | 'active' | 'todo';
}

export interface Errand {
  id: string;
  memberId: string;
  request: string;
  kind: 'movie' | 'flight' | 'ride' | 'other';
  level: 'look' | 'prepare';
  status: 'working' | 'preview' | 'paying' | 'booked' | 'stuck' | 'declined';
  steps: ErrandStep[];
  preview?: {
    title: string;
    lines: string[];
    total: number;
    refund: string;
    request: { date?: string; count?: number; maxTotal?: number; name?: string };
    cart: { date?: string; count?: number; name?: string };
  };
  check?: { ok: boolean; issues: string[] };
  bookedAt?: number;
  undoUntil?: number;
}

export interface Watch {
  id: string;
  label: string;
  memberId: string;
  site: string;
  condition: string;
  on: boolean;
  lastChecked?: number;
  hit?: boolean;
}

export interface Trail {
  id: string;
  goal: string;
  color: string;
  tabs: { id: string; title: string; url: string; summary?: string; stale?: boolean; text?: string; note?: string; savedAt?: number }[];
}

export interface GuardEvent {
  id: string;
  at: number;
  site: string;
  said: string;
  memberId: string;
}

export interface MemoryFact {
  id: string;
  text: string;
  at: number;
  source: 'you' | 'learned' | 'imported';
  /** Where an imported fact came from, like 'ChatGPT'. */
  from?: string;
}

export interface Flashcard {
  id: string;
  /** May contain math in LaTeX between $...$ or $$...$$. */
  front: string;
  back: string;
  deck: string;
  /** A nudge shown before flipping, without giving the answer away. */
  hint?: string;
  /** Worked steps from question to answer. */
  steps?: string[];
  // spaced repetition (lib/srs.ts)
  due?: number;
  interval?: number;
  ease?: number;
  reps?: number;
  lapses?: number;
}

export interface WeekLog {
  week: number; // 1..52
  hours: number[]; // per charter goal index, plus last = unplanned
}

export interface Meetup {
  id: string;
  name: string;
  purpose: string;
  people: { name: string; color: string; lead: string }[];
  status: 'negotiating' | 'proposed' | 'locked';
  proposal?: string;
}
