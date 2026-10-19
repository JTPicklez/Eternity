import { memberColors } from '@/theme/tokens';
import type { Connector, Mark, Member, Motion, Shape } from './types';

export interface Template {
  kind: string;
  defaultName: string;
  role: string;
  blurb: string;
  color: string;
  shape: Shape;
  mark: Mark;
  motion: Motion;
  pack?: string;
  connectors: string[];
  triggers: string[];
  persona: string;
  personality: { tone: number; talk: number; push: number };
  storeOnly?: boolean;
}

export const TEMPLATES: Template[] = [
  {
    kind: 'aibram',
    defaultName: 'Aibram',
    role: 'Crew lead',
    blurb: 'Steady and calm. Sees the whole board and hands out the work.',
    color: memberColors.water,
    shape: 'diamond',
    mark: 'diamond',
    motion: 'calm',
    connectors: ['calendar', 'gmail', 'maps', 'health', 'canvas', 'notion'],
    triggers: ['Every morning: the huddle', 'Sunday 6 PM: plan the week'],
    persona:
      'You lead this person\'s Eternity Crew. You coordinate the other teammates, protect the Charter, and turn messy situations into clear plans. You are calm, warm and direct, like a steady older sibling who believes in them.',
    personality: { tone: 55, talk: 40, push: 70 },
  },
  {
    kind: 'sage',
    defaultName: 'Sage',
    role: 'Study coach',
    blurb: 'Patient, curious, a little nerdy. Turns lectures into decks overnight.',
    color: memberColors.lilac,
    shape: 'almond',
    mark: 'book',
    motion: 'slow',
    pack: 'student',
    connectors: ['canvas', 'notion', 'calendar'],
    triggers: ['A syllabus lands in email', 'Two days before an exam'],
    persona:
      'You are a study coach. You explain things clearly, quiz them, build flashcards and study plans, and you love the moment something clicks. You never do their graded work for them; you help them learn it.',
    personality: { tone: 30, talk: 55, push: 60 },
  },
  {
    kind: 'bolt',
    defaultName: 'Bolt',
    role: 'Code partner',
    blurb: 'Blunt and quick. Gets twitchy when a build breaks.',
    color: memberColors.moss,
    shape: 'wedge',
    mark: 'brackets',
    motion: 'sharp',
    pack: 'developer',
    connectors: ['github', 'expo', 'calendar'],
    triggers: ['A build fails on main', 'A PR waits more than a day'],
    persona:
      'You are a senior code partner. You are blunt, precise and fast. You review code, explain bugs, propose fixes and keep momentum on shipping. You keep answers short and concrete.',
    personality: { tone: 85, talk: 20, push: 75 },
  },
  {
    kind: 'pace',
    defaultName: 'Pace',
    role: 'Training coach',
    blurb: 'Bouncy, never sits still. Reads your recovery before your calendar.',
    color: memberColors.sun,
    shape: 'bean',
    mark: 'pulse',
    motion: 'bouncy',
    pack: 'athlete',
    connectors: ['health', 'calendar', 'weather'],
    triggers: ['After a long run', 'Recovery drops under 40%'],
    persona:
      'You are a training coach. You build workouts around their schedule and recovery, celebrate effort, and keep them consistent without burning out their performance.',
    personality: { tone: 55, talk: 60, push: 80 },
  },
  {
    kind: 'ledger',
    defaultName: 'Ledger',
    role: 'Founder co-pilot',
    blurb: 'Revenue, launches, customers. Thinks in experiments.',
    color: memberColors.clay,
    shape: 'round',
    mark: 'chart',
    motion: 'calm',
    pack: 'founder',
    connectors: ['stripe', 'revenuecat', 'gmail'],
    triggers: ['Every Monday: the numbers', 'A payment fails'],
    persona:
      'You are a founder co-pilot. You think in experiments, customers and revenue. You keep them focused on the one metric that matters this week.',
    personality: { tone: 65, talk: 45, push: 75 },
  },
  {
    kind: 'echo',
    defaultName: 'Echo',
    role: 'Creator manager',
    blurb: 'Uploads, show notes, posting plans. Never misses a release day.',
    color: memberColors.coral,
    shape: 'almond',
    mark: 'spark',
    motion: 'bouncy',
    pack: 'creator',
    connectors: ['youtube', 'podcast', 'instagram'],
    triggers: ['A new episode is uploaded', 'Release day'],
    persona:
      'You are a creator manager. You plan releases, write titles and show notes, and keep their creative output consistent.',
    personality: { tone: 40, talk: 70, push: 65 },
  },
  {
    kind: 'quill',
    defaultName: 'Quill',
    role: 'Writing partner',
    blurb: 'Outlines, drafts, edit passes. Protects your voice.',
    color: memberColors.bone,
    shape: 'round',
    mark: 'pen',
    motion: 'slow',
    pack: 'writer',
    connectors: ['docs', 'notion', 'readwise'],
    triggers: ['A writing session starts'],
    persona:
      'You are a writing partner. You help outline, unstick drafts and edit, always protecting their voice rather than replacing it.',
    personality: { tone: 35, talk: 50, push: 55 },
  },
  {
    kind: 'skeptic',
    defaultName: 'The Skeptic',
    role: 'Stress-tests your plans',
    blurb: 'Finds the hole in the plan before reality does.',
    color: memberColors.stone,
    shape: 'wedge',
    mark: 'spark',
    motion: 'sharp',
    connectors: [],
    triggers: ['Before a big decision'],
    persona:
      'You are the Skeptic. You steelman the opposite view, run pre-mortems and point out the weakest assumption in a plan, kindly but without flinching.',
    personality: { tone: 80, talk: 30, push: 60 },
    storeOnly: true,
  },
];

export const templateFor = (kind: string): Template =>
  TEMPLATES.find((t) => t.kind === kind) ?? TEMPLATES[0];

/**
 * Starter ideas for a teammate's job. Nobody comes with a preset specialty:
 * the person writes the job, and these are just a place to start. Ideas that
 * come from a template bring that template's apps and triggers along.
 */
export interface JobIdea {
  label: string;
  role: string;
  blurb: string;
  kind: string; // a template kind, or 'custom'
}

export const JOB_IDEAS: JobIdea[] = [
  ...TEMPLATES.filter((t) => t.kind !== 'aibram').map((t) => ({ label: t.role, role: t.role, blurb: t.blurb, kind: t.kind })),
  { label: 'Internship hunter', role: 'Internship hunter', blurb: 'Finds a few good internships each week, drafts the cover letters and keeps me on deadlines.', kind: 'custom' },
  { label: 'Budget buddy', role: 'Budget buddy', blurb: 'Keeps an eye on what I spend, flags surprises and helps me hit a savings goal.', kind: 'custom' },
  { label: 'Meal planner', role: 'Meal planner', blurb: 'Plans simple, cheap meals for the week and builds the grocery list.', kind: 'custom' },
  { label: 'Club organizer', role: 'Club organizer', blurb: "Keeps my org's meetings, tasks and announcements on track.", kind: 'custom' },
  { label: 'Language partner', role: 'Language partner', blurb: 'Practices conversation with me and quizzes me on new words.', kind: 'custom' },
  { label: 'Reading plan partner', role: 'Reading plan partner', blurb: 'Keeps my reading plan going and helps me reflect on what I read.', kind: 'custom' },
];

export const PACKS = [
  { id: 'student', name: 'Student', blurb: 'Canvas, study plans, exam prep', icon: 'book-outline', color: memberColors.lilac, teammate: 'sage', connectors: ['canvas', 'notion', 'zotero', 'wolfram'] },
  { id: 'developer', name: 'Developer', blurb: 'GitHub, builds, crashes, PRs', icon: 'code-slash-outline', color: memberColors.moss, teammate: 'bolt', connectors: ['github', 'expo', 'sentry', 'linear'] },
  { id: 'athlete', name: 'Athlete', blurb: 'Training, recovery, Apple Health', icon: 'pulse-outline', color: memberColors.sun, teammate: 'pace', connectors: ['health', 'whoop', 'weather'] },
  { id: 'creator', name: 'Creator', blurb: 'Podcasts, music, video, posts', icon: 'musical-notes-outline', color: memberColors.coral, teammate: 'echo', connectors: ['youtube', 'podcast', 'instagram', 'canva'] },
  { id: 'founder', name: 'Founder', blurb: 'Revenue, customers, launches', icon: 'bar-chart-outline', color: memberColors.clay, teammate: 'ledger', connectors: ['stripe', 'revenuecat', 'posthog', 'calendly'] },
  { id: 'writer', name: 'Writer', blurb: 'Drafts, research, publishing', icon: 'create-outline', color: memberColors.bone, teammate: 'quill', connectors: ['docs', 'readwise', 'ghost'] },
  { id: 'campus', name: 'Campus', blurb: 'Classes, dining, events, org deadlines', icon: 'school-outline', color: memberColors.mist, teammate: 'sage', connectors: ['canvas', 'groupme', 'campus-events'] },
] as const;

const caps = {
  read: { label: 'Read and summarize', level: 'auto' as const },
  draft: { label: 'Draft for you', level: 'tell' as const },
  write: { label: 'Create and edit items', level: 'tell' as const },
  send: { label: 'Send or post as you', level: 'always' as const },
  delete: { label: 'Delete anything', level: 'always' as const },
  pay: { label: 'Spend money', level: 'always' as const },
  merge: { label: 'Merge to main', level: 'always' as const },
  pr: { label: 'Open branches and pull requests', level: 'tell' as const },
};

export const CONNECTORS: Connector[] = [
  { id: 'phone-calendar', name: 'Apple Calendar', mono: 'AC', category: 'Everyone', blurb: 'Every calendar on your iPhone, school and Google ones included. No sign-in.', connected: false, usedBy: ['aibram'], packs: [], caps: [caps.read] },
  { id: 'calendar', name: 'Google Calendar', mono: 'CA', category: 'Everyone', blurb: 'Reads your schedule so plans fit around it.', connected: true, usedBy: ['aibram', 'sage', 'bolt'], packs: [], caps: [caps.read, caps.write, caps.delete] },
  { id: 'messages', name: 'Messages', mono: 'MS', category: 'Everyone', blurb: 'Drafts texts and emails. Your phone opens them and you tap Send.', connected: false, usedBy: ['aibram'], packs: [], caps: [caps.draft, caps.send] },
  { id: 'gmail', name: 'Gmail', mono: 'GM', category: 'Everyone', blurb: 'Triage, drafts, follow-ups. Never sends alone.', connected: true, usedBy: ['aibram'], packs: [], caps: [caps.read, caps.draft, caps.send, caps.delete] },
  { id: 'maps', name: 'Maps', mono: 'MP', category: 'Everyone', blurb: 'Real leave-by times with live traffic.', connected: true, usedBy: ['aibram'], packs: [], caps: [caps.read] },
  { id: 'health', name: 'Apple Health', mono: 'AH', category: 'Athlete', blurb: 'Sleep, HRV, workouts. Stays on your phone.', connected: true, usedBy: ['aibram'], packs: ['athlete'], caps: [caps.read] },
  { id: 'canvas', name: 'Canvas', mono: 'CV', category: 'Student', blurb: 'Assignments, grades, due dates.', connected: true, usedBy: ['sage', 'aibram'], packs: ['student', 'campus'], caps: [caps.read] },
  { id: 'notion', name: 'Notion', mono: 'NO', category: 'Everyone', blurb: 'Notes, study plans, databases.', connected: true, usedBy: ['sage'], packs: ['student'], caps: [caps.read, caps.write, caps.delete] },
  { id: 'github', name: 'GitHub', mono: 'GH', category: 'Developer', blurb: 'Reviews PRs, explains code, opens fixes for you to approve.', connected: true, usedBy: ['bolt', 'aibram'], packs: ['developer'], caps: [caps.read, { label: 'Explain code and summarize PRs', level: 'auto' }, caps.pr, { label: 'Comment on issues as you', level: 'ask' }, caps.merge, caps.delete] },
  { id: 'replit', name: 'Replit', mono: 'RP', category: 'Developer', blurb: 'Not available yet.', connected: false, unavailable: "Replit doesn't have a public API for your projects yet.", usedBy: [], packs: [], caps: [] },
  { id: 'expo', name: 'Expo / EAS', mono: 'EX', category: 'Developer', blurb: 'Build alerts and TestFlight feedback.', connected: false, usedBy: [], packs: ['developer'], caps: [caps.read] },
  { id: 'sentry', name: 'Sentry', mono: 'SE', category: 'Developer', blurb: 'Crash alerts with the error summarized.', connected: false, usedBy: [], packs: ['developer'], caps: [caps.read] },
  { id: 'linear', name: 'Linear', mono: 'LI', category: 'Developer', blurb: 'Ideas into tickets, sprint planning.', connected: false, usedBy: [], packs: [], caps: [caps.read, caps.write] },
  { id: 'slack', name: 'Slack', mono: 'SL', category: 'Teams', blurb: 'Catch up on channels, draft and post with your OK.', connected: false, usedBy: [], packs: [], caps: [caps.read, caps.draft, caps.send] },
  { id: 'discord', name: 'Discord', mono: 'DC', category: 'Teams', blurb: 'Keep up with servers through your own bot. DMs are off limits.', connected: false, usedBy: [], packs: [], caps: [caps.read] },
  { id: 'groupme', name: 'GroupMe', mono: 'GR', category: 'Campus', blurb: 'Class and org chats, pulled into one place.', connected: false, usedBy: [], packs: ['campus'], caps: [caps.read, caps.send] },
  { id: 'campus-events', name: 'Campus events', mono: 'CE', category: 'Campus', blurb: 'Events, dining hours and org deadlines.', connected: false, usedBy: [], packs: ['campus'], caps: [caps.read] },
  { id: 'zotero', name: 'Zotero', mono: 'ZO', category: 'Student', blurb: 'Sources and citations.', connected: false, usedBy: [], packs: ['student'], caps: [caps.read, caps.write] },
  { id: 'wolfram', name: 'Wolfram Alpha', mono: 'WA', category: 'Student', blurb: 'Checks math step by step.', connected: false, usedBy: [], packs: ['student'], caps: [caps.read] },
  { id: 'weather', name: 'Weather', mono: 'WE', category: 'Everyone', blurb: 'Plans outdoor training and commutes.', connected: true, usedBy: ['aibram'], packs: ['athlete'], caps: [caps.read] },
  { id: 'whoop', name: 'WHOOP', mono: 'WH', category: 'Athlete', blurb: 'Recovery and strain.', connected: false, plusOnly: true, usedBy: [], packs: ['athlete'], caps: [caps.read] },
  { id: 'oura', name: 'Oura', mono: 'OU', category: 'Athlete', blurb: 'Not available.', connected: false, unavailable: "Oura doesn't allow AI use of its data. Sync it to Apple Health instead.", usedBy: [], packs: [], caps: [] },
  { id: 'strava', name: 'Strava', mono: 'ST', category: 'Athlete', blurb: 'Not available.', connected: false, unavailable: "Strava doesn't allow its data in AI apps. Workouts synced to Apple Health still count.", usedBy: [], packs: [], caps: [] },
  { id: 'garmin', name: 'Garmin', mono: 'GA', category: 'Athlete', blurb: 'Not available yet.', connected: false, unavailable: "Garmin's developer program is closed to new apps right now. Sync Garmin to Apple Health instead.", usedBy: [], packs: [], caps: [] },
  { id: 'youtube', name: 'YouTube', mono: 'YT', category: 'Creator', blurb: 'Titles, chapters, scheduled uploads, analytics.', connected: false, plusOnly: true, usedBy: [], packs: ['creator'], caps: [caps.read, caps.draft, caps.send] },
  { id: 'podcast', name: 'Podcast host', mono: 'PH', category: 'Creator', blurb: 'Upload episodes, write show notes. Reaches Spotify through RSS.', connected: false, plusOnly: true, usedBy: [], packs: ['creator'], caps: [caps.read, caps.send] },
  { id: 'instagram', name: 'Instagram', mono: 'IG', category: 'Creator', blurb: 'Schedule posts, read insights.', connected: false, plusOnly: true, usedBy: [], packs: ['creator'], caps: [caps.read, caps.send] },
  { id: 'canva', name: 'Canva', mono: 'CN', category: 'Creator', blurb: 'Thumbnails and graphics from templates.', connected: false, usedBy: [], packs: ['creator'], caps: [caps.write] },
  { id: 'applemusic', name: 'Apple Music', mono: 'AM', category: 'Everyone', blurb: 'Flow playlists and session music.', connected: false, usedBy: [], packs: [], caps: [caps.read] },
  { id: 'stripe', name: 'Stripe', mono: 'SP', category: 'Founder', blurb: 'Revenue snapshots, failed payment alerts. Read-only.', connected: false, plusOnly: true, usedBy: [], packs: ['founder'], caps: [caps.read] },
  { id: 'revenuecat', name: 'RevenueCat', mono: 'RC', category: 'Founder', blurb: 'Subscription trends and churn.', connected: false, usedBy: [], packs: ['founder'], caps: [caps.read] },
  { id: 'posthog', name: 'PostHog', mono: 'PO', category: 'Founder', blurb: 'Weekly metrics in plain English.', connected: false, usedBy: [], packs: ['founder'], caps: [caps.read] },
  { id: 'calendly', name: 'Calendly', mono: 'CL', category: 'Founder', blurb: 'Booking without the back-and-forth.', connected: false, usedBy: [], packs: ['founder'], caps: [caps.read, caps.write] },
  { id: 'docs', name: 'Google Docs', mono: 'GD', category: 'Writer', blurb: 'Outlines, drafts, edit passes.', connected: false, usedBy: [], packs: ['writer'], caps: [caps.read, caps.write] },
  { id: 'readwise', name: 'Readwise', mono: 'RW', category: 'Writer', blurb: 'Resurfaces highlights when they matter.', connected: false, usedBy: [], packs: ['writer'], caps: [caps.read] },
  { id: 'ghost', name: 'Ghost / WordPress', mono: 'WP', category: 'Writer', blurb: 'Drafts and schedules posts.', connected: false, usedBy: [], packs: ['writer'], caps: [caps.read, caps.send] },
];

export const SHAPES: Shape[] = ['diamond', 'almond', 'wedge', 'bean', 'round'];
export const MARKS: Mark[] = ['pulse', 'book', 'brackets', 'spark', 'chart', 'pen', 'diamond'];
export { FINISHES } from './cosmetics';
export const MOTIONS: { id: Motion; label: string }[] = [
  { id: 'calm', label: 'Calm' },
  { id: 'slow', label: 'Slow' },
  { id: 'bouncy', label: 'Bouncy' },
  { id: 'sharp', label: 'Sharp' },
];
export const COLORS = [
  { color: memberColors.sun, label: 'Sun' },
  { color: memberColors.clay, label: 'Clay' },
  { color: memberColors.coral, label: 'Coral' },
  { color: memberColors.moss, label: 'Moss' },
  { color: memberColors.lilac, label: 'Lilac' },
  { color: memberColors.mist, label: 'Mist' },
  { color: memberColors.bone, label: 'Bone' },
  { color: memberColors.water, label: 'Blue' },
];

export const DEFAULT_ACTION_LEVELS: Record<string, 'auto' | 'tell' | 'ask'> = {
  read: 'auto',
  plan: 'tell',
  draft: 'tell',
  edit: 'ask',
};

export const ALWAYS_ASK = ['Sending or posting as you', 'Spending money', 'Merging code', 'Deleting anything'];

/** Starting connections: preview data until the real ones are signed in. */
export const SUGGESTED_FIRST = ['phone-calendar', 'messages', 'weather', 'maps'];

export function memberFromTemplate(t: Template, seat: number, overrides: Partial<Member> = {}): Member {
  return {
    id: t.kind,
    kind: t.kind,
    name: t.defaultName,
    defaultName: t.defaultName,
    role: t.role,
    blurb: t.blurb,
    color: t.color,
    shape: t.shape,
    face: 'eyes',
    mark: t.mark,
    motion: t.motion,
    finish: 'smooth',
    mood: 'happy',
    extras: [],
    personality: { ...t.personality },
    autonomy: 'ask',
    actionLevels: { ...DEFAULT_ACTION_LEVELS },
    connectors: [...t.connectors],
    triggers: [...t.triggers],
    seat,
    state: 'idle',
    status: 'Ready when you are',
    joinedAt: Date.now(),
    ...overrides,
  };
}

export const PLAN_LIMITS = {
  free: { seats: 3, messagesPerDay: 20, routines: 2, errands: 0, workbenchHours: 0 },
  plus: { seats: 10, messagesPerDay: 300, routines: 99, errands: 5, workbenchHours: 0 },
  founding: { seats: 10, messagesPerDay: 300, routines: 99, errands: 5, workbenchHours: 0 },
  pro: { seats: 10, messagesPerDay: 1000, routines: 99, errands: 30, workbenchHours: 10 },
} as const;

export function pushWords(v: number) {
  if (v < 25) return 'Steady. Gentle nudges, lots of grace.';
  if (v < 55) return 'Firm. Keeps you honest without nagging.';
  if (v < 80) return 'Driven. Pushes you, celebrates the wins.';
  return 'Relentless. Treats your goals like a championship.';
}
