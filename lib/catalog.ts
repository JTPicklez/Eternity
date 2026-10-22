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
  // Beta connectors: new, working, and still being tested on real accounts.
  { id: 'arxiv', name: 'arXiv', mono: 'AX', category: 'Research', blurb: 'Search new research papers in physics, math and computer science.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'crossref', name: 'Crossref', mono: 'CR', category: 'Research', blurb: 'Find papers and their DOIs for citations.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'openalex', name: 'OpenAlex', mono: 'OA', category: 'Research', blurb: 'Search scholarly works and how often they are cited.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'pubmed', name: 'PubMed', mono: 'PM', category: 'Research', blurb: 'Search medical and life science research.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'wikipedia', name: 'Wikipedia', mono: 'WK', category: 'Student', blurb: 'Look things up and pull a clean summary.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'openlibrary', name: 'Open Library', mono: 'OL', category: 'Student', blurb: 'Search books by title or author.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'bluesky', name: 'Bluesky', mono: 'BS', category: 'Creator', blurb: 'Read a person\'s recent public posts.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'edgar', name: 'SEC EDGAR', mono: 'ED', category: 'Founder', blurb: 'Recent filings for any public company.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'frankfurter', name: 'Exchange rates', mono: 'FX', category: 'Everyone', blurb: 'Current currency exchange rates.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'gdelt', name: 'GDELT News', mono: 'GD', category: 'Everyone', blurb: 'News coverage on any topic from the last two days.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'usgs', name: 'USGS Earthquakes', mono: 'EQ', category: 'Civic', blurb: 'Recent earthquakes around the world.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'nws', name: 'Weather alerts', mono: 'WA', category: 'Civic', blurb: 'Active National Weather Service alerts for a US state.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'osm', name: 'OpenStreetMap', mono: 'OS', category: 'Everyone', blurb: 'Find a place or address.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'telegram', name: 'Telegram', mono: 'TG', category: 'Teams', blurb: 'Read messages sent to your own bot.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'cloudflare', name: 'Cloudflare', mono: 'CF', category: 'Developer', blurb: 'See your sites and their status.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'lastfm', name: 'Last.fm', mono: 'LF', category: 'Creator', blurb: 'See what you have been listening to.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'unsplash', name: 'Unsplash', mono: 'UN', category: 'Creator', blurb: 'Search free photos for projects.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'pexels', name: 'Pexels', mono: 'PX', category: 'Creator', blurb: 'Search free photos for projects.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'thesportsdb', name: 'TheSportsDB', mono: 'SD', category: 'Sports', blurb: 'Find teams, upcoming games and recent scores.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'footballdata', name: 'Football-Data', mono: 'FD', category: 'Sports', blurb: 'Today\'s football (soccer) matches from major leagues.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'apisports', name: 'API-Sports', mono: 'AS', category: 'Sports', blurb: 'Today\'s football fixtures and scores.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'alpaca', name: 'Alpaca (paper)', mono: 'AP', category: 'Money', blurb: 'Practice trading with fake money. See your paper account and positions.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'fred', name: 'FRED', mono: 'FR', category: 'Money', blurb: 'Economic data: unemployment, inflation, GDP and more.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'steam', name: 'Steam', mono: 'ST', category: 'Everyone', blurb: 'See what you have been playing and for how long.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'itch', name: 'itch.io', mono: 'IT', category: 'Creator', blurb: 'Views, downloads and purchases for your games.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'apibible', name: 'API.Bible', mono: 'BI', category: 'Everyone', blurb: 'Search Bible passages.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'esv', name: 'ESV Bible', mono: 'EV', category: 'Everyone', blurb: 'Read passages from the English Standard Version.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'congress', name: 'Congress.gov', mono: 'CG', category: 'Civic', blurb: 'Recently updated federal bills.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'openstates', name: 'Open States', mono: 'OP', category: 'Civic', blurb: 'Search state legislature bills.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'nasa', name: 'NASA', mono: 'NA', category: 'Everyone', blurb: 'The astronomy picture of the day and asteroids passing Earth.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'openaq', name: 'OpenAQ', mono: 'AQ', category: 'Civic', blurb: 'Air quality readings near any place.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'ticketmaster', name: 'Ticketmaster', mono: 'TM', category: 'Everyone', blurb: 'Find concerts, games and shows near you.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'googleplaces', name: 'Google Places', mono: 'GP', category: 'Everyone', blurb: 'Search for places, ratings and whether they are open.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'homeassistant', name: 'Home Assistant', mono: 'HA', category: 'Home', blurb: 'See your devices and sensors. Switching a light or scene always asks you.', connected: false, usedBy: [], packs: [], caps: [caps.read, caps.write], beta: true },
  { id: 'tessie', name: 'Tessie', mono: 'TS', category: 'Everyone', blurb: 'Battery, charging and lock status for your Tesla. Read-only.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'todoist', name: 'Todoist', mono: 'TD', category: 'Everyone', blurb: 'Your open tasks and projects.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'dropbox', name: 'Dropbox', mono: 'DB', category: 'Everyone', blurb: 'Find and list files in your Dropbox.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'gitlab', name: 'GitLab', mono: 'GL', category: 'Developer', blurb: 'Your projects, merge requests and issues.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'outlook', name: 'Outlook Mail', mono: 'OM', category: 'Everyone', blurb: 'Read and search your Outlook inbox. Drafts open in your mail app.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'outlook-calendar', name: 'Outlook Calendar', mono: 'OC', category: 'Everyone', blurb: 'Your Outlook schedule, so plans fit around it.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'onedrive', name: 'OneDrive', mono: 'OD', category: 'Student', blurb: 'Find recent files and what is in your OneDrive.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'microsoft-todo', name: 'Microsoft To Do', mono: 'MT', category: 'Student', blurb: 'Your open to-dos from every list.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'onenote', name: 'OneNote', mono: 'ON', category: 'Student', blurb: 'Find your recently edited notes.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'airtable', name: 'Airtable', mono: 'AT', category: 'Founder', blurb: 'Read your bases and the rows in a table.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'jira', name: 'Jira', mono: 'JI', category: 'Developer', blurb: 'Your assigned issues, or any search you ask for.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'confluence', name: 'Confluence', mono: 'CN', category: 'Teams', blurb: 'Search your team wiki.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'asana', name: 'Asana', mono: 'AN', category: 'Teams', blurb: 'Tasks assigned to you.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'zoom', name: 'Zoom', mono: 'ZM', category: 'Everyone', blurb: 'Your upcoming meetings and join links.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'twitch', name: 'Twitch', mono: 'TW', category: 'Creator', blurb: 'Which channels you follow are live right now.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'vimeo', name: 'Vimeo', mono: 'VM', category: 'Creator', blurb: 'Your videos and how many plays they have.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'eventbrite', name: 'Eventbrite', mono: 'EB', category: 'Founder', blurb: 'Events you organize.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'square', name: 'Square', mono: 'SQ', category: 'Founder', blurb: 'Recent payments at your business.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'mailchimp', name: 'Mailchimp', mono: 'MC', category: 'Founder', blurb: 'Campaign results and audience sizes.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'wordpress', name: 'WordPress.com', mono: 'WP', category: 'Writer', blurb: 'Your recent posts and drafts on WordPress.com sites.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'planningcenter', name: 'Planning Center', mono: 'PC', category: 'Teams', blurb: 'Upcoming service plans for your church or group.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'hubspot', name: 'HubSpot', mono: 'HS', category: 'Founder', blurb: 'Recent contacts and deals.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'clickup', name: 'ClickUp', mono: 'CU', category: 'Teams', blurb: 'Tasks across your workspace.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'typeform', name: 'Typeform', mono: 'TF', category: 'Founder', blurb: 'Your forms and the latest answers.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'box', name: 'Box', mono: 'BX', category: 'Student', blurb: 'Find files in your Box.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'google-sheets', name: 'Google Sheets', mono: 'GS', category: 'Everyone', blurb: 'Read cells from a spreadsheet you point to.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'google-tasks', name: 'Google Tasks', mono: 'GT', category: 'Everyone', blurb: 'Your open tasks from every list.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'google-classroom', name: 'Google Classroom', mono: 'GC', category: 'Student', blurb: 'Your classes and upcoming coursework.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'google-contacts', name: 'Google Contacts', mono: 'GO', category: 'Everyone', blurb: 'Look up a phone number or email from your contacts.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'vercel', name: 'Vercel', mono: 'VC', category: 'Developer', blurb: 'Recent deployments and whether they passed.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'netlify', name: 'Netlify', mono: 'NL', category: 'Developer', blurb: 'Your sites and their latest deploy.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'printify', name: 'Printify', mono: 'PF', category: 'Founder', blurb: 'Recent orders from your print-on-demand shop.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'printful', name: 'Printful', mono: 'PL', category: 'Founder', blurb: 'Recent orders from your print-on-demand store.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'mastodon', name: 'Mastodon', mono: 'MA', category: 'Creator', blurb: 'Your home timeline.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
  { id: 'trello', name: 'Trello', mono: 'TR', category: 'Teams', blurb: 'Your boards and the cards assigned to you.', connected: false, usedBy: [], packs: [], caps: [caps.read], beta: true },
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
