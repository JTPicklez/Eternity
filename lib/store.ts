/**
 * One store for the whole crew. Everything persisted goes through the Vault
 * (lib/vault.ts), so what lands on disk is encrypted with a key that never
 * leaves the phone.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { destroyVaultKey, vaultStorage } from './vault';
import { memberFromTemplate, PLAN_LIMITS, templateFor, CONNECTORS } from './catalog';
import { isoDate, uid, weekOfYear } from './dates';
import { review, type Grade } from './srs';
import type { Artifact } from './artifacts';
import {
  sampleBlocks, sampleMeetups, sampleFacts, sampleFlashcards, sampleGuard, sampleReceipts, sampleRoutines,
  sampleTable, sampleTrails, sampleWatches, sampleWeeks,
} from './demo';
import type {
  Block, Charter, ChatMessage, Meetup, Errand, Flashcard, GuardEvent, Member, MemoryFact, ProposedAction, Receipt,
  Routine, TableMessage, ThemePref, Tier, Trail, Watch, WeekLog,
} from './types';

// The key keeps its original name so data saved before the Crew rename still loads.
export const STORE_KEY = 'eternity.family.v1';

export interface Settings {
  theme: ThemePref;
  eyes: boolean;
  tier: Tier;
  privateSession: boolean;
  learning: boolean;
  haptics: boolean;
  sound: 'rain' | 'forest' | 'off';
  ambient: boolean; // the water background moves
}

/** How the Crew Room is decorated. */
export interface RoomDecor {
  wall: string;
  rug: string;
  curtains: string;
  plants: boolean;
  /** String lights along the ceiling (Plus). */
  lights: boolean;
  art: 'photo' | 'pennant' | 'none';
  time: 'auto' | 'morning' | 'day' | 'evening' | 'night';
}

export const DEFAULT_ROOM: RoomDecor = {
  wall: '#E4D8C5',
  rug: '#557C9C',
  curtains: '#9CC7E8',
  plants: true,
  lights: false,
  art: 'photo',
  time: 'auto',
};

export interface FlowSession {
  id: string;
  at: number;
  minutes: number;
  task: string;
  sprints: number;
}

export interface Review {
  week: number;
  grade: string;
  decision: string;
  at: number;
}

export interface CrewState {
  // not persisted
  hydrated: boolean;

  // who
  firstName: string;
  guest: boolean;
  onboarded: boolean;
  sample: boolean;

  charter: Charter;
  members: Member[];
  leadId: string;

  blocks: Block[];
  receipts: Receipt[];
  chats: Record<string, ChatMessage[]>;
  table: TableMessage[];
  connected: string[];
  /** Connections that are really signed in on the server, by connector id. */
  live: Record<string, { account: string | null; at: number }>;
  serverAvailable: Record<string, boolean>;
  serverActions: Record<string, { name: string; label: string; write: boolean }[]>;
  /** What the phone itself told us (calendar, weather), for teammates' context. */
  phone: { events: { title: string; start: string; end?: string; where?: string }[]; weather?: string; at: number };
  routines: Routine[];
  errands: Errand[];
  watches: Watch[];
  trails: Trail[];
  guard: GuardEvent[];
  facts: MemoryFact[];
  flashcards: Flashcard[];
  artifacts: Artifact[];
  weeks: WeekLog[];
  meetups: Meetup[];
  flowSessions: FlowSession[];
  reviews: Review[];
  settings: Settings;
  room: RoomDecor;
  usage: { day: string; messages: number; errands: number };
  seenTips: string[];

  // actions
  setHydrated: (v: boolean) => void;
  setProfile: (p: { firstName?: string; guest?: boolean }) => void;
  finishOnboarding: () => void;
  setCharter: (c: Partial<Charter>) => void;

  addMember: (kind: string, overrides?: Partial<Member>) => { ok: boolean; reason?: string; member?: Member };
  updateMember: (id: string, patch: Partial<Member>) => void;
  removeMember: (id: string) => void;
  renameMember: (id: string, name: string) => { ok: boolean; reason?: string };
  setLead: (id: string) => void;
  setMemberState: (id: string, state: Member['state'], status?: string) => void;

  addBlock: (b: Omit<Block, 'id'>) => Block;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  removeBlock: (id: string) => void;

  addReceipt: (r: Omit<Receipt, 'id' | 'at'>) => Receipt;
  undoReceipt: (id: string) => void;

  appendChat: (memberId: string, m: Omit<ChatMessage, 'id' | 'at'> & { id?: string }) => string;
  updateChat: (memberId: string, id: string, patch: Partial<ChatMessage>) => void;
  setActionStatus: (memberId: string, messageId: string, actionId: string, status: ProposedAction['status']) => void;
  clearChat: (memberId: string) => void;

  appendTable: (m: Omit<TableMessage, 'id' | 'at'>) => string;
  chooseTableOption: (messageId: string, optionId: string) => void;
  sendTableDraft: (messageId: string) => void;
  setTableAction: (messageId: string, actionId: string, status: ProposedAction['status']) => void;

  toggleConnector: (id: string) => void;
  setConnectorOn: (id: string, on: boolean) => void;
  setConnectorLive: (
    live: CrewState['live'],
    available: CrewState['serverAvailable'],
    actions: CrewState['serverActions'],
  ) => void;
  setPhone: (p: Partial<CrewState['phone']>) => void;

  addRoutine: (r: Omit<Routine, 'id'>) => void;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  removeRoutine: (id: string) => void;

  addErrand: (e: Omit<Errand, 'id'>) => Errand;
  updateErrand: (id: string, patch: Partial<Errand>) => void;

  addWatch: (w: Omit<Watch, 'id'>) => void;
  updateWatch: (id: string, patch: Partial<Watch>) => void;
  removeWatch: (id: string) => void;

  addTrail: (goal: string, color: string) => Trail;
  addTrailTab: (trailId: string, tab: { title: string; url: string; summary?: string; text?: string }) => void;
  updateTrailTab: (trailId: string, tabId: string, patch: { summary?: string; note?: string }) => void;
  removeTrailTab: (trailId: string, tabId: string) => void;
  removeTrail: (id: string) => void;

  addGuard: (g: Omit<GuardEvent, 'id' | 'at'>) => void;

  addFact: (text: string, source: MemoryFact['source']) => void;
  /** Saves several at once (skips ones already remembered). Returns how many were new. */
  addFacts: (texts: string[], source: MemoryFact['source'], from?: string) => number;
  removeFact: (id: string) => void;
  clearFacts: () => void;

  addFlashcards: (cards: Omit<Flashcard, 'id'>[]) => void;
  addArtifact: (a: { title: string; memberId: string; uses: Artifact['uses']; html: string; note?: string }) => Artifact;
  addArtifactVersion: (id: string, v: { html: string; note: string; title?: string; uses?: Artifact['uses'] }) => void;
  setArtifactCurrent: (id: string, index: number) => void;
  removeArtifact: (id: string) => void;
  removeDeck: (deck: string) => void;
  gradeCard: (id: string, grade: Grade) => void;
  resetDeck: (deck: string) => void;

  logFlow: (s: Omit<FlowSession, 'id' | 'at'>) => void;
  saveReview: (r: Omit<Review, 'at'>) => void;

  addMeetup: (c: Omit<Meetup, 'id'>) => void;
  updateMeetup: (id: string, patch: Partial<Meetup>) => void;

  setSettings: (s: Partial<Settings>) => void;
  setRoom: (r: Partial<RoomDecor>) => void;
  bumpUsage: (kind: 'messages' | 'errands') => { ok: boolean; used: number; limit: number };
  markTip: (id: string) => void;

  clearSample: () => void;
  loadSample: () => void;
  forgetEverything: () => Promise<void>;
}

const emptyCharter: Charter = {
  goals: [],
  nonNegotiables: [],
  push: 70,
  slammed: { triage: true, hours: true, busywork: true },
  autonomy: 'ask',
  packs: [],
};

const defaultSettings: Settings = {
  theme: 'system',
  eyes: true,
  tier: 'free',
  privateSession: false,
  learning: false,
  haptics: true,
  sound: 'rain',
  ambient: true,
};

function freshCrew(): Pick<CrewState, 'members' | 'leadId'> {
  const aibram = memberFromTemplate(templateFor('aibram'), -1, { status: 'Watching the week' });
  return { members: [aibram], leadId: aibram.id };
}

function sampleData() {
  return {
    sample: true,
    blocks: sampleBlocks(),
    receipts: sampleReceipts(),
    table: sampleTable(),
    routines: sampleRoutines(),
    watches: sampleWatches(),
    trails: sampleTrails(),
    guard: sampleGuard(),
    facts: sampleFacts(),
    flashcards: sampleFlashcards(),
    weeks: sampleWeeks(weekOfYear()),
    meetups: sampleMeetups(),
  };
}

function emptyData() {
  return {
    sample: false,
    blocks: [] as Block[],
    receipts: [] as Receipt[],
    table: [] as TableMessage[],
    routines: [] as Routine[],
    watches: [] as Watch[],
    trails: [] as Trail[],
    guard: [] as GuardEvent[],
    facts: [] as MemoryFact[],
    flashcards: [] as Flashcard[],
    weeks: [] as WeekLog[],
    meetups: [] as Meetup[],
  };
}

const initialState = () => ({
  hydrated: false,
  firstName: '',
  guest: false,
  onboarded: false,
  charter: emptyCharter,
  ...freshCrew(),
  ...sampleData(),
  artifacts: [] as Artifact[],
  chats: {} as Record<string, ChatMessage[]>,
  connected: CONNECTORS.filter((c) => c.connected).map((c) => c.id),
  live: {} as CrewState['live'],
  serverAvailable: {} as Record<string, boolean>,
  serverActions: {} as CrewState['serverActions'],
  phone: { events: [], at: 0 } as CrewState['phone'],
  errands: [] as Errand[],
  flowSessions: [] as FlowSession[],
  reviews: [] as Review[],
  settings: defaultSettings,
  room: DEFAULT_ROOM,
  usage: { day: isoDate(), messages: 0, errands: 0 },
  seenTips: [] as string[],
});

const normalize = (s: string) => s.trim().toLowerCase();

const FINISH_RENAMES: Record<string, string> = { matte: 'smooth', stone: 'granite' };

/** Brings data saved by an older version of the app up to date. */
export function migrateSaved(persisted: unknown, version: number): CrewState {
  const s = { ...((persisted ?? {}) as Record<string, unknown>) };
  if (version < 2) {
    if ('headId' in s && !('leadId' in s)) s.leadId = s.headId;
    delete s.headId;
    if ('confluences' in s && !('meetups' in s)) s.meetups = s.confluences;
    delete s.confluences;
    if (Array.isArray(s.meetups)) {
      s.meetups = (s.meetups as { people?: Record<string, unknown>[] }[]).map((c) => ({
        ...c,
        people: (c.people ?? []).map(({ head, ...rest }) => ({ ...rest, lead: rest.lead ?? head })),
      }));
    }
    if (Array.isArray(s.members)) {
      s.members = (s.members as Record<string, unknown>[]).map((m) => ({
        ...m,
        finish: FINISH_RENAMES[String(m.finish)] ?? m.finish,
      }));
    }
  }
  return s as unknown as CrewState;
}

/** The chats as they were before a private session started. */
let lastSavedChats: Record<string, ChatMessage[]> = {};

export const useCrew = create<CrewState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setHydrated: (v) => set({ hydrated: v }),
      setProfile: (p) => set((s) => ({ firstName: p.firstName ?? s.firstName, guest: p.guest ?? s.guest })),
      finishOnboarding: () => set({ onboarded: true }),
      setCharter: (c) => set((s) => ({ charter: { ...s.charter, ...c } })),

      // ── crew ──────────────────────────────────────────────────────────────
      addMember: (kind, overrides = {}) => {
        const s = get();
        const limit = PLAN_LIMITS[s.settings.tier].seats;
        if (s.members.length >= limit) {
          return { ok: false, reason: s.settings.tier === 'free' ? 'free-limit' : 'full' };
        }
        const taken = new Set(s.members.filter((m) => m.seat >= 0).map((m) => m.seat));
        let seat = 0;
        while (taken.has(seat) && seat < 9) seat++;
        if (seat >= 9) return { ok: false, reason: 'full' };
        const t = templateFor(kind);
        const exists = s.members.some((m) => m.id === kind);
        let name = overrides.name ?? t.defaultName;
        const names = new Set(s.members.map((m) => normalize(m.name)));
        if (names.has(normalize(name))) {
          let i = 2;
          while (names.has(normalize(`${name} ${i}`))) i++;
          name = `${name} ${i}`;
        }
        const member = memberFromTemplate(t, seat, {
          ...overrides,
          id: exists || kind === 'custom' ? uid('m') : kind,
          name,
          state: 'idle',
          status: 'Just joined',
        });
        set({ members: [...s.members, member] });
        return { ok: true, member };
      },

      updateMember: (id, patch) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

      removeMember: (id) =>
        set((s) => {
          if (id === s.leadId) return s;
          const chats = { ...s.chats };
          delete chats[id];
          return { members: s.members.filter((m) => m.id !== id), chats };
        }),

      renameMember: (id, raw) => {
        const name = raw.trim().replace(/\s+/g, ' ');
        if (!name) return { ok: false, reason: 'Give them a name first.' };
        if (name.length > 18) return { ok: false, reason: 'Keep it under 18 characters.' };
        const clash = get().members.find((m) => m.id !== id && normalize(m.name) === normalize(name));
        if (clash) return { ok: false, reason: `${clash.name} already has that name. Names stay unique so you always know who's talking.` };
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, name } : m)) }));
        return { ok: true };
      },

      setLead: (id) =>
        set((s) => {
          if (id === s.leadId) return s;
          const next = s.members.find((m) => m.id === id);
          if (!next) return s;
          const freedSeat = next.seat;
          return {
            leadId: id,
            members: s.members.map((m) => {
              if (m.id === id) return { ...m, seat: -1 };
              if (m.id === s.leadId) return { ...m, seat: freedSeat };
              return m;
            }),
          };
        }),

      setMemberState: (id, state, status) =>
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, state, status: status ?? m.status } : m)),
        })),

      // ── day ───────────────────────────────────────────────────────────────
      addBlock: (b) => {
        const block = { ...b, id: uid('b') };
        set((s) => ({ blocks: [...s.blocks, block] }));
        return block;
      },
      updateBlock: (id, patch) => set((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      removeBlock: (id) => set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) })),

      addReceipt: (r) => {
        const receipt = { ...r, id: uid('r'), at: Date.now() };
        set((s) => ({ receipts: [receipt, ...s.receipts].slice(0, 300) }));
        return receipt;
      },
      undoReceipt: (id) =>
        set((s) => {
          const r = s.receipts.find((x) => x.id === id);
          const receipts = s.receipts.map((x) => (x.id === id ? { ...x, undone: true } : x));
          if (!r?.undoRef) return { receipts };
          const { kind, id: ref } = r.undoRef;
          if (kind === 'block') return { receipts, blocks: s.blocks.filter((b) => b.id !== ref) };
          if (kind === 'routine') return { receipts, routines: s.routines.filter((x) => x.id !== ref) };
          return { receipts, flashcards: s.flashcards.filter((f) => f.deck !== ref) };
        }),

      // ── chat ──────────────────────────────────────────────────────────────
      appendChat: (memberId, m) => {
        const id = m.id ?? uid('c');
        const msg: ChatMessage = { ...m, id, at: Date.now() };
        set((s) => ({ chats: { ...s.chats, [memberId]: [...(s.chats[memberId] ?? []), msg].slice(-200) } }));
        return id;
      },
      updateChat: (memberId, id, patch) =>
        set((s) => ({
          chats: { ...s.chats, [memberId]: (s.chats[memberId] ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) },
        })),
      setActionStatus: (memberId, messageId, actionId, status) =>
        set((s) => ({
          chats: {
            ...s.chats,
            [memberId]: (s.chats[memberId] ?? []).map((m) =>
              m.id !== messageId ? m : { ...m, actions: m.actions?.map((a) => (a.id === actionId ? { ...a, status } : a)) },
            ),
          },
        })),
      clearChat: (memberId) => set((s) => ({ chats: { ...s.chats, [memberId]: [] } })),

      // ── table ─────────────────────────────────────────────────────────────
      appendTable: (m) => {
        const id = uid('tm');
        set((s) => ({ table: [...s.table, { ...m, id, at: Date.now() }].slice(-120) }));
        return id;
      },
      chooseTableOption: (messageId, optionId) =>
        set((s) => ({ table: s.table.map((t) => (t.id === messageId ? { ...t, chosen: optionId } : t)) })),
      sendTableDraft: (messageId) =>
        set((s) => ({
          table: s.table.map((t) => (t.id === messageId && t.draft ? { ...t, draft: { ...t.draft, sent: true } } : t)),
        })),

      setTableAction: (messageId, actionId, status) =>
        set((s) => ({
          table: s.table.map((t) =>
            t.id !== messageId ? t : { ...t, actions: t.actions?.map((a) => (a.id === actionId ? { ...a, status } : a)) },
          ),
        })),

      // ── connectors, routines ─────────────────────────────────────────────
      toggleConnector: (id) =>
        set((s) => ({
          connected: s.connected.includes(id) ? s.connected.filter((c) => c !== id) : [...s.connected, id],
        })),

      setConnectorOn: (id, on) =>
        set((s) => ({ connected: on ? (s.connected.includes(id) ? s.connected : [...s.connected, id]) : s.connected.filter((c) => c !== id) })),
      setConnectorLive: (live, available, actions) => set({ live, serverAvailable: available, serverActions: actions }),
      setPhone: (p) => set((s) => ({ phone: { ...s.phone, ...p, at: Date.now() } })),

      addRoutine: (r) => set((s) => ({ routines: [...s.routines, { ...r, id: uid('rt') }] })),
      updateRoutine: (id, patch) => set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      removeRoutine: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),

      // ── errands ──────────────────────────────────────────────────────────
      addErrand: (e) => {
        const errand = { ...e, id: uid('e') };
        set((s) => ({ errands: [errand, ...s.errands].slice(0, 50) }));
        return errand;
      },
      updateErrand: (id, patch) => set((s) => ({ errands: s.errands.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

      // ── browser ──────────────────────────────────────────────────────────
      addWatch: (w) => set((s) => ({ watches: [...s.watches, { ...w, id: uid('w') }] })),
      updateWatch: (id, patch) => set((s) => ({ watches: s.watches.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      removeWatch: (id) => set((s) => ({ watches: s.watches.filter((w) => w.id !== id) })),

      addTrail: (goal, color) => {
        const trail: Trail = { id: uid('t'), goal, color, tabs: [] };
        set((s) => ({ trails: [trail, ...s.trails] }));
        return trail;
      },
      addTrailTab: (trailId, tab) =>
        set((s) => ({
          trails: s.trails.map((t) =>
            t.id !== trailId || t.tabs.some((x) => x.url === tab.url)
              ? t
              : { ...t, tabs: [{ ...tab, text: tab.text?.slice(0, 8000), id: uid('tab'), savedAt: Date.now() }, ...t.tabs].slice(0, 40) },
          ),
        })),
      updateTrailTab: (trailId, tabId, patch) =>
        set((s) => ({
          trails: s.trails.map((t) => (t.id === trailId ? { ...t, tabs: t.tabs.map((x) => (x.id === tabId ? { ...x, ...patch } : x)) } : t)),
        })),
      removeTrailTab: (trailId, tabId) =>
        set((s) => ({ trails: s.trails.map((t) => (t.id === trailId ? { ...t, tabs: t.tabs.filter((x) => x.id !== tabId) } : t)) })),
      removeTrail: (id) => set((s) => ({ trails: s.trails.filter((t) => t.id !== id) })),

      addGuard: (g) => set((s) => ({ guard: [{ ...g, id: uid('g'), at: Date.now() }, ...s.guard].slice(0, 100) })),

      // ── memory ───────────────────────────────────────────────────────────
      addFact: (text, source) => {
        const t = text.trim();
        if (!t) return;
        set((s) =>
          s.facts.some((f) => normalize(f.text) === normalize(t))
            ? s
            : { facts: [{ id: uid('f'), text: t, at: Date.now(), source }, ...s.facts].slice(0, 400) },
        );
      },
      addFacts: (texts, source, from) => {
        const s = get();
        const seen = new Set(s.facts.map((f) => normalize(f.text)));
        const fresh: MemoryFact[] = [];
        const now = Date.now();
        texts.forEach((raw, i) => {
          const t = raw.trim();
          if (!t || seen.has(normalize(t))) return;
          seen.add(normalize(t));
          fresh.push({ id: uid('f'), text: t, at: now - i, source, ...(from ? { from } : {}) });
        });
        if (fresh.length) set({ facts: [...fresh, ...s.facts].slice(0, 400) });
        return fresh.length;
      },
      removeFact: (id) => set((s) => ({ facts: s.facts.filter((f) => f.id !== id) })),
      clearFacts: () => set({ facts: [] }),

      addFlashcards: (cards) => set((s) => ({ flashcards: [...s.flashcards, ...cards.map((c) => ({ ...c, id: uid('fc') }))] })),
      removeDeck: (deck) => set((s) => ({ flashcards: s.flashcards.filter((f) => f.deck !== deck) })),
      addArtifact: ({ title, memberId, uses, html, note }) => {
        const a: Artifact = {
          id: uid('art'),
          title: title.slice(0, 80) || 'Untitled',
          memberId,
          uses,
          versions: [{ id: uid('v'), html, at: Date.now(), note: note || 'First version' }],
          current: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ artifacts: [a, ...s.artifacts].slice(0, 60) }));
        return a;
      },
      addArtifactVersion: (id, v) =>
        set((s) => ({
          artifacts: s.artifacts.map((a) => {
            if (a.id !== id) return a;
            // Keep the last 30 versions; that's the timeline.
            const versions = [...a.versions, { id: uid('v'), html: v.html, at: Date.now(), note: v.note.slice(0, 140) }].slice(-30);
            return { ...a, title: v.title ? v.title.slice(0, 80) : a.title, uses: v.uses ?? a.uses, versions, current: versions.length - 1 };
          }),
        })),
      setArtifactCurrent: (id, index) => set((s) => ({ artifacts: s.artifacts.map((a) => (a.id === id ? { ...a, current: Math.max(0, Math.min(index, a.versions.length - 1)) } : a)) })),
      removeArtifact: (id) => set((s) => ({ artifacts: s.artifacts.filter((a) => a.id !== id) })),

      gradeCard: (id, grade) =>
        set((s) => ({ flashcards: s.flashcards.map((f) => (f.id === id ? { ...f, ...review(f, grade) } : f)) })),
      resetDeck: (deck) =>
        set((s) => ({
          flashcards: s.flashcards.map((f) =>
            f.deck === deck ? { ...f, due: undefined, interval: undefined, ease: undefined, reps: undefined, lapses: undefined } : f,
          ),
        })),

      logFlow: (session) =>
        set((s) => {
          const week = weekOfYear();
          const hours = session.minutes / 60;
          const weeks = s.weeks.some((w) => w.week === week)
            ? s.weeks.map((w) => {
                if (w.week !== week) return w;
                const next = [...w.hours];
                next[0] = Math.round(((next[0] ?? 0) + hours) * 10) / 10;
                return { ...w, hours: next };
              })
            : [...s.weeks, { week, hours: [Math.round(hours * 10) / 10, 0, 0, 0] }];
          return { flowSessions: [{ ...session, id: uid('fl'), at: Date.now() }, ...s.flowSessions].slice(0, 300), weeks };
        }),
      saveReview: (r) => set((s) => ({ reviews: [{ ...r, at: Date.now() }, ...s.reviews.filter((x) => x.week !== r.week)] })),

      addMeetup: (c) => set((s) => ({ meetups: [{ ...c, id: uid('cf') }, ...s.meetups] })),
      updateMeetup: (id, patch) =>
        set((s) => ({ meetups: s.meetups.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      // ── settings ─────────────────────────────────────────────────────────
      setSettings: (patch) =>
        set((s) => {
          // Ending a private session throws its messages away, like it promised.
          const endingPrivate = s.settings.privateSession && patch.privateSession === false;
          return { settings: { ...s.settings, ...patch }, ...(endingPrivate ? { chats: lastSavedChats } : {}) };
        }),

      setRoom: (patch) => set((s) => ({ room: { ...s.room, ...patch } })),

      bumpUsage: (kind) => {
        const s = get();
        const today = isoDate();
        const usage = s.usage.day === today ? s.usage : { day: today, messages: 0, errands: 0 };
        const limits = PLAN_LIMITS[s.settings.tier];
        const limit = kind === 'messages' ? limits.messagesPerDay : limits.errands;
        if (usage[kind] >= limit) return { ok: false, used: usage[kind], limit };
        const next = { ...usage, [kind]: usage[kind] + 1 };
        set({ usage: next });
        return { ok: true, used: next[kind], limit };
      },

      markTip: (id) => set((s) => (s.seenTips.includes(id) ? s : { seenTips: [...s.seenTips, id] })),

      clearSample: () =>
        set((s) => ({
          ...emptyData(),
          members: s.members.map((m) => ({ ...m, state: 'idle' as const, status: 'Ready when you are' })),
        })),
      loadSample: () => set(() => sampleData()),

      forgetEverything: async () => {
        lastSavedChats = {};
        await AsyncStorage.removeItem(STORE_KEY);
        await destroyVaultKey().catch(() => {});
        set({ ...initialState(), ...emptyData(), hydrated: true });
      },
    }),
    {
      name: STORE_KEY,
      version: 2,
      storage: createJSONStorage(() => vaultStorage),
      // v1 → v2: family became Crew (headId → leadId, confluences → meetups) and
      // two finishes were renamed (matte → smooth, stone → granite).
      migrate: (persisted, version) => migrateSaved(persisted, version),
      // Keep new settings fields (added in later versions) when old data loads.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<CrewState>;
        return {
          ...current,
          ...saved,
          settings: { ...current.settings, ...(saved.settings ?? {}) },
          room: { ...current.room, ...(saved.room ?? {}) },
          hydrated: current.hydrated,
        };
      },
      partialize: (s) => {
        const { hydrated: _h, ...rest } = s;
        const persisted = Object.fromEntries(
          Object.entries(rest).filter(([, v]) => typeof v !== 'function'),
        ) as Partial<CrewState>;
        // Private sessions never touch the disk: keep the last saved chats instead.
        if (s.settings.privateSession) persisted.chats = lastSavedChats;
        else lastSavedChats = s.chats;
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state) lastSavedChats = state.chats;
        state?.setHydrated(true);
      },
    },
  ),
);

// If storage is empty or unreadable, still mark the store ready.
setTimeout(() => {
  if (!useCrew.getState().hydrated) useCrew.getState().setHydrated(true);
}, 2500);

// ── selectors and helpers ──────────────────────────────────────────────────
export const useLead = () => useCrew((s) => s.members.find((m) => m.id === s.leadId) ?? s.members[0]);
export const useMember = (id?: string) => useCrew((s) => s.members.find((m) => m.id === id));
export const useSettings = () => useCrew((s) => s.settings);

export function memberById(id?: string): Member | undefined {
  const s = useCrew.getState();
  return s.members.find((m) => m.id === id);
}

export function nameOf(id?: string): string {
  if (!id || id === 'you') return 'You';
  return memberById(id)?.name ?? templateFor(id).defaultName;
}

export function isPaid(tier: Tier) {
  return tier !== 'free';
}

/**
 * A member if they're in the Crew, otherwise a stand-in built from the
 * template (used by the sample day so Sage and Bolt still look like themselves).
 */
export function memberOrTemplate(id: string, members: Member[]): Member & { visiting?: boolean } {
  const found = members.find((m) => m.id === id);
  if (found) return found;
  return { ...memberFromTemplate(templateFor(id), 0), visiting: true };
}
