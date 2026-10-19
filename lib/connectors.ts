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
  actions: Record<string, { name: string; label: string; write: boolean }[]>;
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
