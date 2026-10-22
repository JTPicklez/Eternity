/**
 * Connecting apps. The app never holds another service's token: sign-ins go
 * through Eternity's server, pasted keys are sent once to the server and
 * stored encrypted there, and reads come back as results. A few connections
 * live entirely on the phone (Apple Calendar, Messages, weather).
 */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getIdToken } from '@/firebase/auth';
import { FUNCTIONS_BASE } from '@/firebase/config';
import { useCrew } from './store';

export type ConnectKind =
  | 'oauth' // sign in through the provider
  | 'key' // paste a key or token
  | 'device' // on the phone, just a permission
  | 'open' // no account needed
  | 'free' // open data on the server, one tap, no account
  | 'developer' // one key on the server serves everyone
  | 'approval' // waiting on the other company
  | 'later' // needs a newer app build
  | 'blocked'; // not possible right now

export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  secure?: boolean;
  options?: { id: string; label: string }[];
}

export interface ConnectHow {
  kind: ConnectKind;
  fields?: FieldDef[];
  /** Also takes a pasted personal key as a shortcut. */
  keyFallback?: FieldDef[];
  help?: string;
  helpUrl?: string;
  note?: string;
}

export const HOW: Record<string, ConnectHow> = {
  calendar: { kind: 'oauth', note: 'Reads your Google Calendar. Want it without a Google sign-in? Connect Apple Calendar instead; it includes Google calendars synced to your iPhone.' },
  'phone-calendar': { kind: 'device', note: 'Reads the calendars on this phone, including Google and school calendars you have synced in iPhone Settings. Nothing leaves your phone unless a teammate needs it for an answer.' },
  gmail: { kind: 'oauth', note: 'Read-only. Drafts open in your mail app and you tap Send.' },
  maps: { kind: 'open', note: 'Uses your location for real leave-by times.' },
  weather: { kind: 'open', note: 'Free forecasts from Open-Meteo for where you are. No account needed.' },
  messages: { kind: 'device', note: "Teammates draft texts and emails. Your phone's own Messages or Mail opens with it filled in, and you tap Send. Contacts access lets them find the right person." },
  health: { kind: 'later', note: 'Apple Health needs a newer build of the app with HealthKit turned on. It stays on your phone.' },
  canvas: {
    kind: 'key',
    fields: [
      { key: 'domain', label: "Your school's Canvas address", placeholder: 'texastech.instructure.com' },
      { key: 'token', label: 'Access token', placeholder: 'Paste the token', secure: true },
    ],
    help: 'In Canvas: Account, Settings, New Access Token. Name it Eternity, then paste it here. Some schools turn tokens off.',
  },
  notion: { kind: 'oauth', note: 'You pick which pages to share when you sign in. Reading is automatic. Creating a page or adding to one always asks you first.' },
  github: { kind: 'oauth', note: 'Read-only to start. Merging and deleting always ask you.' },
  replit: { kind: 'blocked', note: "Replit doesn't offer a public API for your projects yet. Bolt can still prep prompts for you to paste into Replit." },
  expo: {
    kind: 'key',
    fields: [
      { key: 'app', label: 'App', placeholder: '@yourname/eternity' },
      { key: 'token', label: 'Access token', placeholder: 'A fresh token just for Eternity', secure: true },
    ],
    help: 'expo.dev, Account settings, Access tokens, Create. Use a new token, not the one in your Codespace.',
    helpUrl: 'https://expo.dev/settings/access-tokens',
  },
  sentry: {
    kind: 'key',
    fields: [
      { key: 'org', label: 'Organization slug', placeholder: 'eternity-works' },
      { key: 'token', label: 'Auth token', placeholder: 'Paste the token', secure: true },
    ],
    help: 'sentry.io, Settings, Auth Tokens. Read access to issues is enough.',
    helpUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
  },
  linear: {
    kind: 'oauth',
    keyFallback: [{ key: 'token', label: 'Personal API key', placeholder: 'lin_api_...', secure: true }],
    help: 'Or paste a personal key: Linear, Settings, Security & access, Personal API keys.',
    helpUrl: 'https://linear.app/settings/account/security',
  },
  slack: { kind: 'oauth', note: 'Reads channels you are in. Posting as you always asks first.' },
  discord: {
    kind: 'key',
    fields: [{ key: 'token', label: 'Your bot token', placeholder: 'Paste the bot token', secure: true }],
    help: 'Discord only lets bots read servers, never DMs. Make a bot at discord.com/developers, turn on Message Content, add it to your server, then paste its token.',
    helpUrl: 'https://discord.com/developers/applications',
  },
  groupme: { kind: 'oauth', note: 'Pulls in your class and org groups.' },
  'campus-events': { kind: 'approval', note: "Waiting on Texas Tech for an events feed. Once there's one, this turns on for everyone." },
  zotero: {
    kind: 'key',
    fields: [
      { key: 'userId', label: 'Your user ID', placeholder: 'A number from the keys page' },
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ],
    help: 'zotero.org, Settings, Security, Create new private key. Your user ID is on the same page.',
    helpUrl: 'https://www.zotero.org/settings/security',
  },
  wolfram: { kind: 'developer', note: 'Checks math step by step. Works once Eternity has a Wolfram key on the server.' },
  whoop: { kind: 'approval', note: "Waiting on WHOOP's OK for AI use before this opens up." },
  oura: { kind: 'blocked', note: "Oura's terms don't allow AI use of its data. If you sync Oura to Apple Health, your Crew can see it there." },
  strava: { kind: 'blocked', note: "Strava doesn't allow its data in AI apps. Workouts you sync to Apple Health still count." },
  garmin: { kind: 'blocked', note: "Garmin's developer program is closed to new apps right now. Garmin can sync to Apple Health." },
  youtube: { kind: 'oauth', note: 'Channel stats and your latest uploads.' },
  podcast: { kind: 'later', note: 'Coming later.' },
  instagram: { kind: 'approval', note: "Waiting on Meta's app review." },
  canva: { kind: 'approval', note: "Waiting on Canva's review." },
  applemusic: { kind: 'later', note: 'Apple Music needs a newer build of the app.' },
  stripe: {
    kind: 'key',
    fields: [{ key: 'key', label: 'Restricted key (read-only)', placeholder: 'rk_live_...', secure: true }],
    help: 'Stripe Dashboard, Developers, API keys, Create restricted key. Give it read access only. Eternity never moves money.',
    helpUrl: 'https://dashboard.stripe.com/apikeys',
  },
  revenuecat: {
    kind: 'key',
    fields: [
      { key: 'projectId', label: 'Project ID', placeholder: 'proj1a2b3c4' },
      { key: 'key', label: 'Secret API key (v2, read-only)', placeholder: 'sk_...', secure: true },
    ],
    help: 'RevenueCat, Project settings, API keys, New secret key (v2). Give it read access to charts and metrics.',
  },
  posthog: {
    kind: 'key',
    fields: [
      { key: 'projectId', label: 'Project ID', placeholder: '12345' },
      { key: 'key', label: 'Personal API key', placeholder: 'phx_...', secure: true },
      { key: 'host', label: 'Host (optional)', placeholder: 'https://us.posthog.com' },
    ],
    help: 'PostHog, Settings, Personal API keys. Read access to query is enough.',
  },
  calendly: {
    kind: 'key',
    fields: [{ key: 'token', label: 'Personal access token', placeholder: 'Paste the token', secure: true }],
    help: 'Calendly, Integrations, API and webhooks, Personal access tokens.',
  },
  docs: { kind: 'oauth', note: 'Reads a doc when you share its link with a teammate.' },
  readwise: {
    kind: 'key',
    fields: [{ key: 'token', label: 'Access token', placeholder: 'Paste the token', secure: true }],
    help: 'readwise.io/access_token',
    helpUrl: 'https://readwise.io/access_token',
  },
  ghost: {
    kind: 'key',
    fields: [
      {
        key: 'platform',
        label: 'Platform',
        options: [
          { id: 'ghost', label: 'Ghost' },
          { id: 'wordpress', label: 'WordPress' },
        ],
      },
      { key: 'url', label: 'Site address', placeholder: 'yourblog.com' },
      { key: 'key', label: 'Key', placeholder: 'Ghost: Admin API key. WordPress: username:app password', secure: true },
    ],
    help: 'Ghost: Settings, Integrations, Add custom integration, copy the Admin API key. WordPress: Users, Profile, Application passwords.',
  },

  // ── Beta: open data and paste-a-key ──
  arxiv: { kind: 'free', note: 'Open data. No account.' },
  crossref: { kind: 'free' },
  openalex: { kind: 'free' },
  pubmed: { kind: 'free' },
  wikipedia: { kind: 'free' },
  openlibrary: { kind: 'free' },
  bluesky: { kind: 'free' },
  edgar: { kind: 'free' },
  frankfurter: { kind: 'free' },
  gdelt: { kind: 'free' },
  usgs: { kind: 'free' },
  nws: { kind: 'free' },
  osm: { kind: 'free' },
  telegram: { kind: 'key', fields: [
      { key: 'token', label: 'Bot token', placeholder: '123456:ABC...', secure: true },
    ], help: 'In Telegram, message @BotFather, send /newbot, and paste the token it gives you.' },
  cloudflare: { kind: 'key', fields: [
      { key: 'token', label: 'API token', placeholder: 'Paste the token', secure: true },
    ], help: 'Cloudflare dashboard: My Profile, API Tokens, Create Token. Give it Zone: Read only.' },
  lastfm: { kind: 'key', fields: [
      { key: 'user', label: 'Last.fm username', placeholder: 'yourname' },
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Make a free API account at last.fm/api, then paste the key and your username.' },
  unsplash: { kind: 'key', fields: [
      { key: 'key', label: 'Access key', placeholder: 'Paste the access key', secure: true },
    ], help: 'Make a free app at unsplash.com/developers and paste its Access Key.' },
  pexels: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Get a free key at pexels.com/api.' },
  thesportsdb: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: '3', secure: true },
    ], help: 'The free key is 3. Paste that, or your own if you subscribe.' },
  footballdata: { kind: 'key', fields: [
      { key: 'token', label: 'API token', placeholder: 'Paste the token', secure: true },
    ], help: 'Register free at football-data.org and paste the token from your email.' },
  apisports: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Make a free account at api-sports.io and paste your key from the dashboard.' },
  alpaca: { kind: 'key', fields: [
      { key: 'key', label: 'Key ID', placeholder: 'Paste the key ID', secure: true },
      { key: 'secret', label: 'Secret', placeholder: 'Paste the secret', secure: true },
    ], help: 'Paper trading only. In Alpaca, switch to Paper, then generate API keys. Real-money keys will not work here.' },
  fred: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Free key at fred.stlouisfed.org, My Account, API Keys.' },
  steam: { kind: 'key', fields: [
      { key: 'key', label: 'Web API key', placeholder: 'Paste the key', secure: true },
      { key: 'steamId', label: 'Your SteamID64', placeholder: '7656119...' },
    ], help: 'Get a key at steamcommunity.com/dev/apikey. Your profile must be set to public.' },
  itch: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'itch.io, Settings, API keys, Generate new API key.' },
  apibible: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Free key at scripture.api.bible.' },
  esv: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Make a free app at api.esv.org and paste its key.' },
  congress: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Free key at api.congress.gov/sign-up.' },
  openstates: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Free key at openstates.org/accounts/profile.' },
  nasa: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Free key at api.nasa.gov. DEMO_KEY also works but is slow.' },
  openaq: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Free account and key at explore.openaq.org.' },
  ticketmaster: { kind: 'key', fields: [
      { key: 'key', label: 'Consumer key', placeholder: 'Paste the key', secure: true },
    ], help: 'Make a free app at developer.ticketmaster.com and paste the Consumer Key.' },
  googleplaces: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
    ], help: 'Google Cloud Console: turn on Places API (New), then make an API key. Set a budget alert first.' },
  homeassistant: { kind: 'key', fields: [
      { key: 'url', label: 'Your Home Assistant address', placeholder: 'https://yourname.ui.nabu.casa' },
      { key: 'token', label: 'Long-lived token', placeholder: 'Paste the token', secure: true },
    ], help: 'Profile, Security, Long-lived access tokens. Needs an https address reachable from outside your home, such as Nabu Casa. Locks and alarms can never be controlled from here.' },
  tessie: { kind: 'key', fields: [
      { key: 'token', label: 'Access token', placeholder: 'Paste the token', secure: true },
    ], help: 'Make an account at tessie.com, then Settings, Developer, and copy your access token.' },

  // ── Beta wave 2: sign in or paste a token ──
  todoist: { kind: 'oauth', note: 'Read-only.' },
  dropbox: { kind: 'oauth', note: 'Read-only. Teammates can find a file, never change or delete one.' },
  gitlab: { kind: 'oauth', note: 'Read-only.' },
  outlook: { kind: 'oauth', note: 'Read-only. Works with outlook.com, Hotmail and school or work accounts.' },
  'outlook-calendar': { kind: 'oauth', note: 'Read-only.' },
  onedrive: { kind: 'oauth', note: 'Read-only.' },
  'microsoft-todo': { kind: 'oauth', note: 'Read-only.' },
  onenote: { kind: 'oauth', note: 'Read-only. Titles and edit times first; page text can come later.' },
  airtable: { kind: 'oauth', note: 'Read-only. You choose which bases to share when you sign in.' },
  jira: { kind: 'oauth', note: 'Read-only.' },
  confluence: { kind: 'oauth', note: 'Read-only.' },
  asana: { kind: 'oauth', note: 'Read-only.' },
  zoom: { kind: 'oauth', note: 'Read-only.' },
  twitch: { kind: 'oauth', note: 'Read-only.' },
  vimeo: { kind: 'oauth', note: 'Read-only.' },
  eventbrite: { kind: 'oauth', note: 'Read-only.' },
  square: { kind: 'oauth', note: 'Read-only.' },
  mailchimp: { kind: 'oauth', note: 'Read-only.' },
  wordpress: { kind: 'oauth', note: 'Read-only. Works with WordPress.com sites. Self-hosted WordPress uses the Ghost and WordPress connector.' },
  planningcenter: { kind: 'oauth', note: 'Read-only.' },
  hubspot: { kind: 'oauth', note: 'Read-only.' },
  clickup: { kind: 'oauth', note: 'Read-only.' },
  typeform: { kind: 'oauth', note: 'Read-only.' },
  box: { kind: 'oauth', note: 'Read-only.' },
  'google-sheets': { kind: 'oauth', note: 'Read-only.' },
  'google-tasks': { kind: 'oauth', note: 'Read-only.' },
  'google-classroom': { kind: 'oauth', note: 'Read-only.' },
  'google-contacts': { kind: 'oauth', note: 'Read-only. Teammates look up one person at a time.' },
  vercel: { kind: 'key', fields: [
      { key: 'token', label: 'Access token', placeholder: 'Paste the token', secure: true },
    ], help: 'Vercel: Account Settings, Tokens, Create. Pick the shortest expiry that works for you.' },
  netlify: { kind: 'key', fields: [
      { key: 'token', label: 'Personal access token', placeholder: 'Paste the token', secure: true },
    ], help: 'Netlify: User settings, Applications, New access token.' },
  printify: { kind: 'key', fields: [
      { key: 'token', label: 'API token', placeholder: 'Paste the token', secure: true },
    ], help: 'Printify: Account, Connections, Get a personal access token. Read access is enough.' },
  printful: { kind: 'key', fields: [
      { key: 'token', label: 'Private token', placeholder: 'Paste the token', secure: true },
    ], help: 'Printful: Developers, Private tokens, Create. Choose view-only scopes.' },
  mastodon: { kind: 'key', fields: [
      { key: 'url', label: 'Your server', placeholder: 'https://mastodon.social' },
      { key: 'token', label: 'Access token', placeholder: 'Paste the token', secure: true },
    ], help: 'On your server: Preferences, Development, New application. Give it read access only, then copy the access token.' },
  trello: { kind: 'key', fields: [
      { key: 'key', label: 'API key', placeholder: 'Paste the key', secure: true },
      { key: 'token', label: 'Token', placeholder: 'Paste the token', secure: true },
    ], help: 'Get a key at trello.com/power-ups/admin, then use the Token link on that page to authorize read access.' },
};

export const howFor = (id: string): ConnectHow => HOW[id] ?? { kind: 'later' };

/** Connections that run on the phone or need no account count as live as soon as they're on. */
export const isLocal = (id: string) => ['device', 'open'].includes(howFor(id).kind);

// ── talking to the server ───────────────────────────────────────────────────
export class ConnectorError extends Error {}

async function post<T>(fn: string, body: unknown): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new ConnectorError('Make an account first. Connections are tied to your sign-in so they work on every device.');
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ConnectorError("Can't reach Eternity's server right now.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 404 && !data.error) throw new ConnectorError("Connections aren't switched on yet on the server. Deploy the functions first.");
  if (!res.ok) throw new ConnectorError(data.error || 'Something went wrong.');
  return data;
}

export interface ServerStatus {
  connected: { connector: string; account: string | null; connectedAt: number | null }[];
  available: Record<string, boolean>;
  actions: Record<string, { name: string; label: string; write: boolean; params?: string | null; demo?: Record<string, unknown> | null }[]>;
}

/** Pulls what's really connected from the server into the store. */
export async function refreshConnectors(): Promise<ServerStatus | null> {
  try {
    const s = await post<ServerStatus>('connectorStatus', {});
    const live: Record<string, { account: string | null; at: number }> = {};
    s.connected.forEach((c) => (live[c.connector] = { account: c.account, at: c.connectedAt ?? Date.now() }));
    const st = useCrew.getState();
    st.setConnectorLive(live, s.available, s.actions);
    return s;
  } catch {
    return null;
  }
}

function returnUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/connected`;
  return Linking.createURL('connected');
}

/** Opens the provider's sign-in. Resolves when the person comes back. */
export async function signIn(connector: string): Promise<{ ok: boolean; reason?: string }> {
  const back = returnUrl();
  const { url } = await post<{ url: string }>('connectorStart', { connector, returnUrl: back });
  const result = await WebBrowser.openAuthSessionAsync(url, back);
  if (result.type !== 'success' || !result.url) return { ok: false, reason: result.type === 'cancel' || result.type === 'dismiss' ? 'cancelled' : 'Sign-in did not finish.' };
  return finishFromUrl(result.url);
}

/** Handles the address the server sends people back to. */
export async function finishFromUrl(url: string): Promise<{ ok: boolean; reason?: string; connector?: string }> {
  const { queryParams } = Linking.parse(url);
  const q = (queryParams ?? {}) as Record<string, string | undefined>;
  const connector = q.connector;
  // GroupMe hands its token to the app, which saves it like a pasted key.
  if (connector === 'groupme' && q.token) {
    await saveKey('groupme', { token: q.token });
    return { ok: true, connector };
  }
  if (q.status === 'ok') {
    await refreshConnectors();
    if (connector) useCrew.getState().setConnectorOn(connector, true);
    return { ok: true, connector };
  }
  return { ok: false, reason: q.reason || 'Sign-in did not finish.', connector };
}

export async function saveKey(connector: string, fields: Record<string, string>): Promise<string | null> {
  const r = await post<{ ok: boolean; account: string | null }>('connectorSave', { connector, fields });
  await refreshConnectors();
  useCrew.getState().setConnectorOn(connector, true);
  return r.account;
}

export async function callConnector<T = unknown>(connector: string, action: string, params: Record<string, unknown> = {}, approved = false): Promise<T> {
  const r = await post<{ ok: boolean; data: T }>('connectorCall', { connector, action, params, approved });
  return r.data;
}

export async function disconnect(connector: string): Promise<void> {
  if (!isLocal(connector)) await post('connectorDisconnect', { connector }).catch(() => {});
  const st = useCrew.getState();
  st.setConnectorOn(connector, false);
  await refreshConnectors();
}
