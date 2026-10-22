/**
 * Connectors: signing in to other apps and reading from them on the person's
 * behalf. Every token lives here on the server, encrypted, in a Firestore
 * collection the app can never read. The app only ever sees the results.
 *
 *   connectorStart        begins an OAuth sign-in, returns the provider's page
 *   eternityOAuthCallback the provider sends the person back here
 *   connectorSave         stores a pasted key or token (after testing it)
 *   connectorCall         runs one allowed action with the stored token
 *   connectorStatus       what's connected, and what this server is set up for
 *   connectorDisconnect   deletes the token (and revokes it where possible)
 *
 * Setup (once): two secrets.
 *   CONNECTOR_KEY   32 random bytes, base64. Make one with: openssl rand -base64 32
 *   CONNECTOR_APPS  a JSON file with each developer app's client ID and secret.
 *                   See functions/connector-apps.example.json, then:
 *                   firebase functions:secrets:set CONNECTOR_APPS --data-file functions/connector-apps.json
 *
 * Rules: reads run on their own. Anything that writes, sends, posts, spends,
 * merges or deletes only runs when the app says the person approved it.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const CONNECTOR_KEY = defineSecret('CONNECTOR_KEY');
const CONNECTOR_APPS = defineSecret('CONNECTOR_APPS');
const SECRETS = [CONNECTOR_KEY, CONNECTOR_APPS];

const CALLBACK_URL = 'https://us-central1-aibram-9c44f.cloudfunctions.net/eternityOAuthCallback';

// ── config and crypto ──────────────────────────────────────────────────────
function apps() {
  try {
    return JSON.parse(CONNECTOR_APPS.value() || '{}') || {};
  } catch {
    return {};
  }
}

function sealKey() {
  const k = Buffer.from(String(CONNECTOR_KEY.value() || ''), 'base64');
  if (k.length !== 32) throw new Error('CONNECTOR_KEY must be 32 random bytes in base64 (openssl rand -base64 32)');
  return k;
}

function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sealKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function unseal(s) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', sealKey(), Buffer.from(s.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(s.tag, 'base64'));
  const out = Buffer.concat([decipher.update(Buffer.from(s.data, 'base64')), decipher.final()]);
  return JSON.parse(out.toString('utf8'));
}

const tokenDoc = (uid, connector) => db.collection('connectorTokens').doc(`${uid}_${connector}`);
const stateDoc = (state) => db.collection('connectorStates').doc(state);

// ── providers ──────────────────────────────────────────────────────────────
const G = (s) => `https://www.googleapis.com/auth/${s}`;

const OAUTH = {
  google: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    revoke: 'https://oauth2.googleapis.com/revoke',
    params: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', response_type: 'code' },
  },
  github: { auth: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', params: {} },
  notion: { auth: 'https://api.notion.com/v1/oauth/authorize', token: 'https://api.notion.com/v1/oauth/token', params: { owner: 'user', response_type: 'code' }, basic: true, json: true },
  slack: { auth: 'https://slack.com/oauth/v2/authorize', token: 'https://slack.com/api/oauth.v2.access', params: {}, userScope: true },
  linear: { auth: 'https://linear.app/oauth/authorize', token: 'https://api.linear.app/oauth/token', params: { response_type: 'code', prompt: 'consent' }, scopeSep: ',' },
  groupme: { auth: 'https://oauth.groupme.com/oauth/authorize', implicit: true, params: {} },
  // ── Wave 2 providers. Each needs a developer app (see connector-apps.example.json). ──
  todoist: { auth: 'https://todoist.com/oauth/authorize', token: 'https://todoist.com/oauth/access_token', params: {}, scopeSep: ',' },
  dropbox: { auth: 'https://www.dropbox.com/oauth2/authorize', token: 'https://api.dropboxapi.com/oauth2/token', params: { token_access_type: 'offline', response_type: 'code' } },
  gitlab: { auth: 'https://gitlab.com/oauth/authorize', token: 'https://gitlab.com/oauth/token', params: { response_type: 'code' } },
  microsoft: { auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', params: { response_type: 'code', response_mode: 'query', prompt: 'select_account' } },
  airtable: { auth: 'https://airtable.com/oauth2/v1/authorize', token: 'https://airtable.com/oauth2/v1/token', params: { response_type: 'code' }, pkce: true, basicForm: true },
  atlassian: { auth: 'https://auth.atlassian.com/authorize', token: 'https://auth.atlassian.com/oauth/token', params: { audience: 'api.atlassian.com', response_type: 'code', prompt: 'consent' }, jsonBody: true },
  asana: { auth: 'https://app.asana.com/-/oauth_authorize', token: 'https://app.asana.com/-/oauth_token', params: { response_type: 'code' } },
  zoom: { auth: 'https://zoom.us/oauth/authorize', token: 'https://zoom.us/oauth/token', params: { response_type: 'code' }, basicForm: true },
  twitch: { auth: 'https://id.twitch.tv/oauth2/authorize', token: 'https://id.twitch.tv/oauth2/token', params: { response_type: 'code' }, needsClientId: true },
  vimeo: { auth: 'https://api.vimeo.com/oauth/authorize', token: 'https://api.vimeo.com/oauth/access_token', params: { response_type: 'code' }, basicForm: true },
  eventbrite: { auth: 'https://www.eventbrite.com/oauth/authorize', token: 'https://www.eventbrite.com/oauth/token', params: { response_type: 'code' } },
  square: { auth: 'https://connect.squareup.com/oauth2/authorize', token: 'https://connect.squareup.com/oauth2/token', params: { session: 'false' }, jsonBody: true },
  mailchimp: { auth: 'https://login.mailchimp.com/oauth2/authorize', token: 'https://login.mailchimp.com/oauth2/token', params: { response_type: 'code' } },
  wordpress: { auth: 'https://public-api.wordpress.com/oauth2/authorize', token: 'https://public-api.wordpress.com/oauth2/token', params: { response_type: 'code' }, keep: ['blog_id', 'blog_url'] },
  planningcenter: { auth: 'https://api.planningcenteronline.com/oauth/authorize', token: 'https://api.planningcenteronline.com/oauth/token', params: { response_type: 'code' } },
  hubspot: { auth: 'https://app.hubspot.com/oauth/authorize', token: 'https://api.hubapi.com/oauth/v1/token', params: {} },
  clickup: { auth: 'https://app.clickup.com/api', token: 'https://api.clickup.com/api/v2/oauth/token', params: {} },
  typeform: { auth: 'https://api.typeform.com/oauth/authorize', token: 'https://api.typeform.com/oauth/token', params: {} },
  box: { auth: 'https://account.box.com/api/oauth2/authorize', token: 'https://api.box.com/oauth2/token', params: { response_type: 'code' } },
};

/** How each connector signs in. `fields` are what the person pastes. */
const CONNECTORS = {
  calendar: { kind: 'oauth', provider: 'google', scopes: [G('calendar.events.readonly')] },
  gmail: { kind: 'oauth', provider: 'google', scopes: [G('gmail.readonly')] },
  docs: { kind: 'oauth', provider: 'google', scopes: [G('documents.readonly')] },
  youtube: { kind: 'oauth', provider: 'google', scopes: [G('youtube.readonly')] },
  github: { kind: 'oauth', provider: 'github', scopes: [] },
  notion: { kind: 'oauth', provider: 'notion', scopes: [] },
  slack: { kind: 'oauth', provider: 'slack', scopes: ['channels:read', 'channels:history', 'groups:read', 'groups:history', 'chat:write'] },
  linear: { kind: 'oauth', provider: 'linear', scopes: ['read', 'issues:create'], fields: ['token'] },
  groupme: { kind: 'oauth', provider: 'groupme', scopes: [], fields: ['token'] },
  sentry: { kind: 'key', fields: ['token', 'org'] },
  zotero: { kind: 'key', fields: ['key', 'userId'] },
  readwise: { kind: 'key', fields: ['token'] },
  posthog: { kind: 'key', fields: ['key', 'projectId', 'host'] },
  expo: { kind: 'key', fields: ['token', 'app'] },
  revenuecat: { kind: 'key', fields: ['key', 'projectId'] },
  stripe: { kind: 'key', fields: ['key'] },
  canvas: { kind: 'key', fields: ['token', 'domain'] },
  calendly: { kind: 'key', fields: ['token'] },
  ghost: { kind: 'key', fields: ['url', 'key', 'platform'] },
  discord: { kind: 'key', fields: ['token'] },
  wolfram: { kind: 'developer' },
  // Wave 2 (Beta): sign in with the service. Reads only for now.
  todoist: { kind: 'oauth', provider: 'todoist', scopes: ['data:read'] },
  dropbox: { kind: 'oauth', provider: 'dropbox', scopes: [] },
  gitlab: { kind: 'oauth', provider: 'gitlab', scopes: ['read_api'] },
  outlook: { kind: 'oauth', provider: 'microsoft', scopes: ['offline_access', 'User.Read', 'Mail.Read'] },
  'outlook-calendar': { kind: 'oauth', provider: 'microsoft', scopes: ['offline_access', 'User.Read', 'Calendars.Read'] },
  onedrive: { kind: 'oauth', provider: 'microsoft', scopes: ['offline_access', 'User.Read', 'Files.Read'] },
  'microsoft-todo': { kind: 'oauth', provider: 'microsoft', scopes: ['offline_access', 'User.Read', 'Tasks.Read'] },
  onenote: { kind: 'oauth', provider: 'microsoft', scopes: ['offline_access', 'User.Read', 'Notes.Read'] },
  airtable: { kind: 'oauth', provider: 'airtable', scopes: ['data.records:read', 'schema.bases:read'] },
  jira: { kind: 'oauth', provider: 'atlassian', scopes: ['read:jira-work', 'read:jira-user', 'offline_access'] },
  confluence: { kind: 'oauth', provider: 'atlassian', scopes: ['read:confluence-content.all', 'search:confluence', 'offline_access'] },
  asana: { kind: 'oauth', provider: 'asana', scopes: [] },
  zoom: { kind: 'oauth', provider: 'zoom', scopes: [] },
  twitch: { kind: 'oauth', provider: 'twitch', scopes: ['user:read:follows'] },
  vimeo: { kind: 'oauth', provider: 'vimeo', scopes: ['public', 'private'] },
  eventbrite: { kind: 'oauth', provider: 'eventbrite', scopes: [] },
  square: { kind: 'oauth', provider: 'square', scopes: ['PAYMENTS_READ', 'ORDERS_READ'] },
  mailchimp: { kind: 'oauth', provider: 'mailchimp', scopes: [] },
  wordpress: { kind: 'oauth', provider: 'wordpress', scopes: [] },
  planningcenter: { kind: 'oauth', provider: 'planningcenter', scopes: ['services'] },
  hubspot: { kind: 'oauth', provider: 'hubspot', scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'] },
  clickup: { kind: 'oauth', provider: 'clickup', scopes: [] },
  typeform: { kind: 'oauth', provider: 'typeform', scopes: ['accounts:read', 'forms:read', 'responses:read'] },
  box: { kind: 'oauth', provider: 'box', scopes: [] },
  'google-sheets': { kind: 'oauth', provider: 'google', scopes: [G('spreadsheets.readonly')] },
  'google-tasks': { kind: 'oauth', provider: 'google', scopes: [G('tasks.readonly')] },
  'google-classroom': { kind: 'oauth', provider: 'google', scopes: [G('classroom.courses.readonly'), G('classroom.coursework.me.readonly')] },
  'google-contacts': { kind: 'oauth', provider: 'google', scopes: [G('contacts.readonly')] },
  // Wave 2 (Beta): paste your own token.
  vercel: { kind: 'key', fields: ['token'] },
  netlify: { kind: 'key', fields: ['token'] },
  printify: { kind: 'key', fields: ['token'] },
  printful: { kind: 'key', fields: ['token'] },
  mastodon: { kind: 'key', fields: ['url', 'token'] },
  trello: { kind: 'key', fields: ['key', 'token'] },
  // Beta: open data, nothing to paste.
  arxiv: { kind: 'key', fields: [] },
  crossref: { kind: 'key', fields: [] },
  openalex: { kind: 'key', fields: [] },
  pubmed: { kind: 'key', fields: [] },
  wikipedia: { kind: 'key', fields: [] },
  openlibrary: { kind: 'key', fields: [] },
  bluesky: { kind: 'key', fields: [] },
  edgar: { kind: 'key', fields: [] },
  frankfurter: { kind: 'key', fields: [] },
  gdelt: { kind: 'key', fields: [] },
  usgs: { kind: 'key', fields: [] },
  nws: { kind: 'key', fields: [] },
  osm: { kind: 'key', fields: [] },
  // Beta: paste your own key.
  telegram: { kind: 'key', fields: ['token'] },
  cloudflare: { kind: 'key', fields: ['token'] },
  lastfm: { kind: 'key', fields: ['user', 'key'] },
  unsplash: { kind: 'key', fields: ['key'] },
  pexels: { kind: 'key', fields: ['key'] },
  thesportsdb: { kind: 'key', fields: ['key'] },
  footballdata: { kind: 'key', fields: ['token'] },
  apisports: { kind: 'key', fields: ['key'] },
  alpaca: { kind: 'key', fields: ['key', 'secret'] },
  fred: { kind: 'key', fields: ['key'] },
  steam: { kind: 'key', fields: ['key', 'steamId'] },
  itch: { kind: 'key', fields: ['key'] },
  apibible: { kind: 'key', fields: ['key'] },
  esv: { kind: 'key', fields: ['key'] },
  congress: { kind: 'key', fields: ['key'] },
  openstates: { kind: 'key', fields: ['key'] },
  nasa: { kind: 'key', fields: ['key'] },
  openaq: { kind: 'key', fields: ['key'] },
  ticketmaster: { kind: 'key', fields: ['key'] },
  googleplaces: { kind: 'key', fields: ['key'] },
  homeassistant: { kind: 'key', fields: ['url', 'token'] },
  tessie: { kind: 'key', fields: ['token'] },
};

function providerApp(provider) {
  const a = apps()[provider];
  return a && a.clientId && (a.clientSecret || OAUTH[provider].implicit) ? a : null;
}

function scopesFor(connector) {
  const c = CONNECTORS[connector];
  const override = apps()[c.provider] && apps()[c.provider].scopes && apps()[c.provider].scopes[connector];
  return Array.isArray(override) ? override : c.scopes;
}

/** Is this connector usable on this server right now? */
function available(connector) {
  const c = CONNECTORS[connector];
  if (!c) return false;
  if (c.kind === 'key') return true;
  if (c.kind === 'developer') return !!(apps().wolfram && apps().wolfram.appId);
  return !!providerApp(c.provider) || !!c.fields;
}

// ── small HTTP helper ──────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(url, { method = 'GET', token, headers = {}, json, form, basic, timeout = 15000 } = {}) {
  const h = { Accept: 'application/json', 'User-Agent': 'Eternity/1.0', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (basic) h.Authorization = `Basic ${Buffer.from(basic).toString('base64')}`;
  let body;
  if (json !== undefined) {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    h['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { method, headers: h, body, signal: ctl.signal });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { text };
    }
    if (!res.ok) throw new ApiError(res.status, (data && (data.message || data.error_description || data.error)) || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const clip = (v, n = 300) => {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

function httpsUrl(raw) {
  let u = String(raw || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  if (!/^https:\/\//i.test(u)) throw new ApiError(400, 'Use an https address.');
  return u;
}

// Ghost Admin API keys are "id:secret" and need a short-lived HS256 token.
function ghostJwt(key) {
  const [id, secret] = String(key).split(':');
  if (!id || !secret) throw new ApiError(400, 'A Ghost Admin API key looks like id:secret.');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT', kid: id });
  const body = b64({ iat: now, exp: now + 300, aud: '/admin/' });
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

// Notion page ids are 32 hex characters, with or without dashes.
function notionId(raw) {
  const id = String(raw || '').replace(/[^a-f0-9]/gi, '');
  return id.length === 32 ? id : '';
}

// Plain text to Notion paragraph blocks: one per line, long lines split at 2000 characters.
function notionParagraphs(text) {
  const blocks = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    for (let i = 0; i < t.length && blocks.length < 50; i += 2000) {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: t.slice(i, i + 2000) } }] } });
    }
  }
  return blocks;
}

// ── helpers for the newer connectors ───────────────────────────────────────
const CONTACT = 'eternityworks2026@gmail.com';
const OPEN_UA = { 'User-Agent': `Eternity/1.0 (${CONTACT})` };
const enc = encodeURIComponent;

/** A required text parameter, trimmed and length-limited. */
function need(p, key, max = 200) {
  const v = String((p && p[key]) || '').trim();
  if (!v) throw new ApiError(400, `Missing ${key}.`);
  return v.slice(0, max);
}
const opt = (p, key, max = 200) => String((p && p[key]) || '').trim().slice(0, max);
const howMany = (p, d = 8, max = 20) => Math.min(max, Math.max(1, Number(p && p.limit) || d));
const slug = (s) => String(s || '').replace(/[^\w.-]/g, '');
const xmlTag = (s, tag) => {
  const m = String(s).match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
};
const plain = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
const todayStr = () => new Date().toISOString().slice(0, 10);


// ── helpers for the sign-in batch ──────────────────────────────────────────
const graph = (a, path, extra = {}) => api(`https://graph.microsoft.com/v1.0${path}`, { token: a.token, ...extra });
const atlassianSite = async (a) => {
  const sites = await api('https://api.atlassian.com/oauth/token/accessible-resources', { token: a.token });
  const s = Array.isArray(sites) ? sites[0] : null;
  if (!s) throw new ApiError(404, 'No Atlassian site was shared with Eternity.');
  return s;
};
const mailchimpBase = async (a) => {
  const m = await api('https://login.mailchimp.com/oauth2/metadata', { headers: { Authorization: `OAuth ${a.token}` } });
  if (!m.api_endpoint) throw new ApiError(502, 'Mailchimp did not say where your account lives.');
  return String(m.api_endpoint).replace(/\/$/, '');
};
const cents = (n, cur) => (typeof n === 'number' ? `${(n / 100).toFixed(2)} ${cur || ''}`.trim() : null);

// ── what each connector can do ─────────────────────────────────────────────
// write: true means it changes something and needs the person's approval.
const day = 86400000;
const iso = (ms) => new Date(ms).toISOString();

const ACTIONS = {
  calendar: {
    upcoming: {
      label: 'Upcoming events',
      run: async (a, p) => {
        const days = Math.min(14, Number(p.days) || 3);
        const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', timeMin: iso(Date.now()), timeMax: iso(Date.now() + days * day), maxResults: '40' });
        const d = await api(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, { token: a.token });
        return (d.items || []).map((e) => ({ title: clip(e.summary, 120), start: (e.start && (e.start.dateTime || e.start.date)) || '', end: (e.end && (e.end.dateTime || e.end.date)) || '', where: clip(e.location, 80) }));
      },
    },
  },
  gmail: {
    inbox: {
      label: 'Recent important email',
      run: async (a, p) => {
        const q = new URLSearchParams({ maxResults: String(Math.min(15, Number(p.max) || 10)), q: clip(p.query || 'in:inbox newer_than:3d -category:promotions -category:social', 200) });
        const list = await api(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`, { token: a.token });
        const ids = (list.messages || []).slice(0, 15);
        const msgs = await Promise.all(
          ids.map((m) =>
            api(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { token: a.token }).catch(() => null),
          ),
        );
        return msgs.filter(Boolean).map((m) => {
          const h = Object.fromEntries(((m.payload && m.payload.headers) || []).map((x) => [x.name.toLowerCase(), x.value]));
          return { from: clip(h.from, 80), subject: clip(h.subject, 140), date: h.date || '', snippet: clip(m.snippet, 200), unread: (m.labelIds || []).includes('UNREAD') };
        });
      },
    },
  },
  docs: {
    read: {
      label: 'Read a Google Doc',
      run: async (a, p) => {
        const id = String(p.documentId || p.url || '').match(/[-\w]{25,}/);
        if (!id) throw new ApiError(400, 'Give me the doc link.');
        const d = await api(`https://docs.googleapis.com/v1/documents/${id[0]}`, { token: a.token });
        const text = ((d.body && d.body.content) || [])
          .map((b) => (b.paragraph ? (b.paragraph.elements || []).map((e) => (e.textRun ? e.textRun.content : '')).join('') : ''))
          .join('');
        return { title: d.title, text: clip(text, 12000) };
      },
    },
  },
  youtube: {
    channel: {
      label: 'Channel stats and latest uploads',
      run: async (a) => {
        const ch = await api('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true', { token: a.token });
        const c = (ch.items || [])[0];
        if (!c) return { channel: null };
        const uploads = c.contentDetails && c.contentDetails.relatedPlaylists && c.contentDetails.relatedPlaylists.uploads;
        const pl = uploads ? await api(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=5&playlistId=${uploads}`, { token: a.token }) : { items: [] };
        return {
          channel: c.snippet.title,
          subscribers: c.statistics.subscriberCount,
          views: c.statistics.viewCount,
          latest: (pl.items || []).map((v) => ({ title: clip(v.snippet.title, 120), published: v.snippet.publishedAt })),
        };
      },
    },
  },
  github: {
    repos: {
      label: 'Your repos',
      run: async (a) => {
        const d = await api('https://api.github.com/user/repos?sort=updated&per_page=20', { token: a.token, headers: { 'X-GitHub-Api-Version': '2022-11-28' } });
        return d.map((r) => ({ repo: r.full_name, private: r.private, updated: r.updated_at, openIssues: r.open_issues_count }));
      },
    },
    pulls: {
      label: 'Open pull requests',
      run: async (a, p) => {
        const repo = String(p.repo || '').replace(/[^\w.\-/]/g, '');
        if (!repo.includes('/')) throw new ApiError(400, 'Which repo? Like owner/name.');
        const d = await api(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=10`, { token: a.token, headers: { 'X-GitHub-Api-Version': '2022-11-28' } });
        return d.map((x) => ({ number: x.number, title: clip(x.title, 140), author: x.user && x.user.login, updated: x.updated_at, draft: x.draft }));
      },
    },
    issues: {
      label: 'Open issues',
      run: async (a, p) => {
        const repo = String(p.repo || '').replace(/[^\w.\-/]/g, '');
        if (!repo.includes('/')) throw new ApiError(400, 'Which repo? Like owner/name.');
        const d = await api(`https://api.github.com/repos/${repo}/issues?state=open&per_page=15`, { token: a.token, headers: { 'X-GitHub-Api-Version': '2022-11-28' } });
        return d.filter((x) => !x.pull_request).map((x) => ({ number: x.number, title: clip(x.title, 140), labels: (x.labels || []).map((l) => l.name) }));
      },
    },
  },
  notion: {
    search: {
      label: 'Search your pages',
      run: async (a, p) => {
        const d = await api('https://api.notion.com/v1/search', { method: 'POST', token: a.token, headers: { 'Notion-Version': '2022-06-28' }, json: { query: clip(p.query || '', 100), page_size: 10 } });
        return (d.results || []).map((r) => {
          const titleProp = r.properties && Object.values(r.properties).find((x) => x.type === 'title');
          const title = titleProp ? (titleProp.title || []).map((t) => t.plain_text).join('') : (r.title || []).map((t) => t.plain_text).join('');
          return { id: r.id, type: r.object, title: clip(title || 'Untitled', 120), edited: r.last_edited_time, url: r.url };
        });
      },
    },
    read: {
      label: 'Read a page',
      run: async (a, p) => {
        const id = String(p.pageId || '').replace(/[^a-f0-9-]/gi, '');
        if (!id) throw new ApiError(400, 'Which page?');
        const d = await api(`https://api.notion.com/v1/blocks/${id}/children?page_size=100`, { token: a.token, headers: { 'Notion-Version': '2022-06-28' } });
        const text = (d.results || [])
          .map((b) => {
            const rich = b[b.type] && b[b.type].rich_text;
            return Array.isArray(rich) ? rich.map((t) => t.plain_text).join('') : '';
          })
          .filter(Boolean)
          .join('\n');
        return { text: clip(text, 12000) };
      },
    },
    create: {
      label: 'Create a page',
      write: true,
      run: async (a, p) => {
        const parent = notionId(p.parentId);
        const title = clip(String(p.title || '').trim(), 200);
        if (!parent || !title) throw new ApiError(400, 'Need a title and a page to put it in.');
        const blocks = notionParagraphs(p.text);
        const d = await api('https://api.notion.com/v1/pages', {
          method: 'POST',
          token: a.token,
          headers: { 'Notion-Version': '2022-06-28' },
          json: {
            parent: { page_id: parent },
            properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
            ...(blocks.length ? { children: blocks } : {}),
          },
        });
        return { created: true, id: d.id, url: d.url };
      },
    },
    append: {
      label: 'Add to a page',
      write: true,
      run: async (a, p) => {
        const id = notionId(p.pageId);
        const blocks = notionParagraphs(p.text);
        if (!id || !blocks.length) throw new ApiError(400, 'Need a page and something to add.');
        await api(`https://api.notion.com/v1/blocks/${id}/children`, {
          method: 'PATCH',
          token: a.token,
          headers: { 'Notion-Version': '2022-06-28' },
          json: { children: blocks },
        });
        return { added: true, blocks: blocks.length };
      },
    },
  },
  slack: {
    channels: {
      label: 'Your channels',
      run: async (a) => {
        const d = await api('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200', { token: a.token });
        if (!d.ok) throw new ApiError(400, d.error || 'Slack said no');
        return (d.channels || []).filter((c) => c.is_member).map((c) => ({ id: c.id, name: c.name, private: c.is_private }));
      },
    },
    history: {
      label: 'Recent messages in a channel',
      run: async (a, p) => {
        const channel = String(p.channel || '').replace(/[^A-Z0-9]/gi, '');
        if (!channel) throw new ApiError(400, 'Which channel?');
        const d = await api(`https://slack.com/api/conversations.history?channel=${channel}&limit=${Math.min(15, Number(p.limit) || 15)}`, { token: a.token });
        if (!d.ok) throw new ApiError(400, d.error || 'Slack said no');
        return (d.messages || []).map((m) => ({ who: m.user || m.username || 'bot', text: clip(m.text, 400), at: m.ts }));
      },
    },
    post: {
      label: 'Post a message as you',
      write: true,
      run: async (a, p) => {
        const channel = String(p.channel || '').replace(/[^A-Z0-9]/gi, '');
        const text = clip(p.text, 3000);
        if (!channel || !text) throw new ApiError(400, 'Need a channel and a message.');
        const d = await api('https://slack.com/api/chat.postMessage', { method: 'POST', token: a.token, json: { channel, text } });
        if (!d.ok) throw new ApiError(400, d.error || 'Slack said no');
        return { posted: true, ts: d.ts };
      },
    },
  },
  linear: {
    mine: {
      label: 'Your open issues',
      run: async (a) => {
        const d = await api('https://api.linear.app/graphql', {
          method: 'POST',
          headers: { Authorization: a.oauth ? `Bearer ${a.token}` : a.token },
          json: { query: '{ viewer { name assignedIssues(first: 20, filter: { state: { type: { nin: ["completed", "canceled"] } } }) { nodes { identifier title dueDate priority state { name } } } } }' },
        });
        const v = d.data && d.data.viewer;
        return (v ? v.assignedIssues.nodes : []).map((i) => ({ id: i.identifier, title: clip(i.title, 140), state: i.state && i.state.name, due: i.dueDate, priority: i.priority }));
      },
    },
    create: {
      label: 'Create an issue',
      write: true,
      run: async (a, p) => {
        const auth = { Authorization: a.oauth ? `Bearer ${a.token}` : a.token };
        let teamId = p.teamId;
        if (!teamId) {
          const t = await api('https://api.linear.app/graphql', { method: 'POST', headers: auth, json: { query: '{ teams(first: 1) { nodes { id } } }' } });
          teamId = t.data && t.data.teams.nodes[0] && t.data.teams.nodes[0].id;
        }
        const d = await api('https://api.linear.app/graphql', {
          method: 'POST',
          headers: auth,
          json: {
            query: 'mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier url } } }',
            variables: { input: { teamId, title: clip(p.title, 200), description: clip(p.description || '', 4000) } },
          },
        });
        return d.data && d.data.issueCreate;
      },
    },
  },
  groupme: {
    groups: {
      label: 'Your groups',
      run: async (a) => {
        const d = await api(`https://api.groupme.com/v3/groups?per_page=20&omit=memberships`, { headers: { 'X-Access-Token': a.token } });
        return (d.response || []).map((g) => ({ id: g.id, name: g.name, last: clip(g.messages && g.messages.preview && g.messages.preview.text, 160) }));
      },
    },
    messages: {
      label: 'Recent messages in a group',
      run: async (a, p) => {
        const id = String(p.groupId || '').replace(/\D/g, '');
        if (!id) throw new ApiError(400, 'Which group?');
        const d = await api(`https://api.groupme.com/v3/groups/${id}/messages?limit=20`, { headers: { 'X-Access-Token': a.token } });
        return ((d.response && d.response.messages) || []).map((m) => ({ who: m.name, text: clip(m.text, 300), at: m.created_at }));
      },
    },
  },
  sentry: {
    issues: {
      label: 'Unresolved errors from the last day',
      run: async (a) => {
        const org = String(a.org || '').replace(/[^\w-]/g, '');
        const d = await api(`https://sentry.io/api/0/organizations/${org}/issues/?query=is:unresolved&statsPeriod=24h&limit=10`, { token: a.token });
        return d.map((i) => ({ title: clip(i.title, 160), count: i.count, users: i.userCount, project: i.project && i.project.slug, last: i.lastSeen }));
      },
    },
  },
  zotero: {
    recent: {
      label: 'Recently added sources',
      run: async (a) => {
        const id = String(a.userId || '').replace(/\D/g, '');
        const d = await api(`https://api.zotero.org/users/${id}/items/top?limit=15&sort=dateModified&format=json`, { headers: { 'Zotero-API-Key': a.key } });
        return d.map((i) => ({ title: clip(i.data.title, 160), type: i.data.itemType, creators: (i.data.creators || []).slice(0, 3).map((c) => c.lastName || c.name).join(', '), date: i.data.date }));
      },
    },
  },
  readwise: {
    highlights: {
      label: 'Recent highlights',
      run: async (a) => {
        const d = await api('https://readwise.io/api/v2/highlights/?page_size=15', { headers: { Authorization: `Token ${a.token}` } });
        return (d.results || []).map((h) => ({ text: clip(h.text, 400), note: clip(h.note, 200), at: h.highlighted_at }));
      },
    },
  },
  posthog: {
    week: {
      label: 'Top events this week',
      run: async (a) => {
        const host = httpsUrl(a.host || 'https://us.posthog.com');
        const id = String(a.projectId || '').replace(/\D/g, '');
        const d = await api(`${host}/api/projects/${id}/query/`, {
          method: 'POST',
          token: a.key,
          json: { query: { kind: 'HogQLQuery', query: 'select event, count() as n from events where timestamp > now() - interval 7 day group by event order by n desc limit 10' } },
        });
        return (d.results || []).map((r) => ({ event: r[0], count: r[1] }));
      },
    },
  },
  expo: {
    builds: {
      label: 'Latest builds',
      run: async (a) => {
        const d = await api('https://api.expo.dev/graphql', {
          method: 'POST',
          token: a.token,
          json: {
            query: 'query($fullName: String!) { app { byFullName(fullName: $fullName) { builds(offset: 0, limit: 5) { status platform createdAt appVersion } } } }',
            variables: { fullName: String(a.app || '').replace(/^@?/, '@') },
          },
        });
        return (d.data && d.data.app && d.data.app.byFullName && d.data.app.byFullName.builds) || [];
      },
    },
  },
  revenuecat: {
    overview: {
      label: 'Subscription overview',
      run: async (a) => {
        const id = String(a.projectId || '').replace(/[^\w-]/g, '');
        const d = await api(`https://api.revenuecat.com/v2/projects/${id}/metrics/overview`, { token: a.key });
        return (d.metrics || []).map((m) => ({ name: m.name, value: m.value, unit: m.unit, period: m.period }));
      },
    },
  },
  stripe: {
    snapshot: {
      label: 'Revenue this week and failed payments',
      run: async (a) => {
        const since = Math.floor((Date.now() - 7 * day) / 1000);
        const tx = await api(`https://api.stripe.com/v1/balance_transactions?limit=100&created[gte]=${since}`, { token: a.key });
        const charges = await api(`https://api.stripe.com/v1/charges?limit=50&created[gte]=${since}`, { token: a.key });
        const gross = (tx.data || []).filter((t) => t.type === 'charge' || t.type === 'payment').reduce((s, t) => s + t.amount, 0);
        const failed = (charges.data || []).filter((c) => c.status === 'failed');
        return { currency: ((tx.data || [])[0] || {}).currency || 'usd', grossCents: gross, failed: failed.length, failedReasons: failed.slice(0, 5).map((c) => c.failure_message) };
      },
    },
  },
  canvas: {
    todo: {
      label: "What's due",
      run: async (a) => {
        const base = httpsUrl(a.domain);
        const d = await api(`${base}/api/v1/users/self/todo?per_page=30`, { token: a.token });
        return d.map((t) => ({ course: t.context_name, title: clip(t.assignment ? t.assignment.name : t.title, 160), due: t.assignment ? t.assignment.due_at : null, type: t.type }));
      },
    },
    upcoming: {
      label: 'Upcoming events',
      run: async (a) => {
        const base = httpsUrl(a.domain);
        const d = await api(`${base}/api/v1/users/self/upcoming_events`, { token: a.token });
        return d.map((e) => ({ title: clip(e.title, 160), start: e.start_at, course: e.context_name }));
      },
    },
  },
  calendly: {
    upcoming: {
      label: 'Upcoming bookings',
      run: async (a) => {
        const me = await api('https://api.calendly.com/users/me', { token: a.token });
        const q = new URLSearchParams({ user: me.resource.uri, min_start_time: iso(Date.now()), count: '10', sort: 'start_time:asc', status: 'active' });
        const d = await api(`https://api.calendly.com/scheduled_events?${q}`, { token: a.token });
        return (d.collection || []).map((e) => ({ name: e.name, start: e.start_time, end: e.end_time }));
      },
    },
  },
  ghost: {
    drafts: {
      label: 'Your drafts',
      run: async (a) => {
        const base = httpsUrl(a.url);
        if (a.platform === 'wordpress') {
          const d = await api(`${base}/wp-json/wp/v2/posts?status=draft&per_page=10&context=edit`, { basic: a.key });
          return d.map((x) => ({ title: clip(x.title && (x.title.raw || x.title.rendered), 140), modified: x.modified }));
        }
        const d = await api(`${base}/ghost/api/admin/posts/?limit=10&filter=status:draft`, { headers: { Authorization: `Ghost ${ghostJwt(a.key)}`, 'Accept-Version': 'v5.0' } });
        return (d.posts || []).map((x) => ({ title: clip(x.title, 140), updated: x.updated_at }));
      },
    },
  },
  discord: {
    servers: {
      label: 'Servers your bot is in',
      run: async (a) => {
        const d = await api('https://discord.com/api/v10/users/@me/guilds', { headers: { Authorization: `Bot ${a.token}` } });
        return d.map((g) => ({ id: g.id, name: g.name }));
      },
    },
    channels: {
      label: 'Channels in a server',
      run: async (a, p) => {
        const id = String(p.serverId || '').replace(/\D/g, '');
        const d = await api(`https://discord.com/api/v10/guilds/${id}/channels`, { headers: { Authorization: `Bot ${a.token}` } });
        return d.filter((c) => c.type === 0).map((c) => ({ id: c.id, name: c.name }));
      },
    },
    history: {
      label: 'Recent messages in a channel',
      run: async (a, p) => {
        const id = String(p.channelId || '').replace(/\D/g, '');
        const d = await api(`https://discord.com/api/v10/channels/${id}/messages?limit=20`, { headers: { Authorization: `Bot ${a.token}` } });
        return d.map((m) => ({ who: m.author && m.author.username, text: clip(m.content, 300), at: m.timestamp }));
      },
    },
  },
  wolfram: {
    ask: {
      label: 'Check math step by step',
      run: async (_a, p) => {
        const appId = apps().wolfram && apps().wolfram.appId;
        if (!appId) throw new ApiError(503, 'Wolfram is not set up on the server yet.');
        const q = new URLSearchParams({ input: clip(p.input, 500), appid: appId, maxchars: '3000' });
        const res = await fetch(`https://www.wolframalpha.com/api/v1/llm-api?${q}`);
        const text = await res.text();
        if (!res.ok) throw new ApiError(res.status, clip(text, 200));
        return { text: clip(text, 3000) };
      },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // BETA: open data. No account and no key, so connecting is one tap.
  // `params` tells the teammate what to send. `demo` powers "Try it".
  // ════════════════════════════════════════════════════════════════════════
  arxiv: {
    search: {
      label: 'Search arXiv papers',
      params: 'query',
      demo: { query: 'protein folding' },
      run: async (_a, p) => {
        const terms = need(p, 'query')
          .split(/\s+/)
          .slice(0, 8)
          .map((t) => `all:${enc(t)}`)
          .join('+AND+');
        const d = await api(`https://export.arxiv.org/api/query?search_query=${terms}&start=0&max_results=${howMany(p, 6, 15)}&sortBy=relevance`, { headers: OPEN_UA });
        return String(d.text || '')
          .split('<entry>')
          .slice(1)
          .map((e) => ({ title: clip(xmlTag(e, 'title'), 200), summary: clip(xmlTag(e, 'summary'), 400), published: xmlTag(e, 'published').slice(0, 10), url: xmlTag(e, 'id') }));
      },
    },
  },
  crossref: {
    search: {
      label: 'Find papers and DOIs',
      params: 'query',
      demo: { query: 'sleep and memory in students' },
      run: async (_a, p) => {
        const d = await api(`https://api.crossref.org/works?query=${enc(need(p, 'query'))}&rows=${howMany(p, 6, 15)}&select=title,DOI,author,issued,container-title&mailto=${enc(CONTACT)}`, { headers: OPEN_UA });
        return ((d.message && d.message.items) || []).map((w) => ({
          title: clip((w.title || [])[0], 200),
          doi: w.DOI,
          journal: (w['container-title'] || [])[0],
          year: w.issued && w.issued['date-parts'] && w.issued['date-parts'][0] && w.issued['date-parts'][0][0],
          authors: (w.author || []).slice(0, 3).map((x) => [x.given, x.family].filter(Boolean).join(' ')).join(', '),
        }));
      },
    },
  },
  openalex: {
    search: {
      label: 'Search scholarly works',
      params: 'query',
      demo: { query: 'spaced repetition' },
      run: async (_a, p) => {
        const d = await api(`https://api.openalex.org/works?search=${enc(need(p, 'query'))}&per-page=${howMany(p, 6, 15)}&select=display_name,publication_year,cited_by_count,doi&mailto=${enc(CONTACT)}`, { headers: OPEN_UA });
        return (d.results || []).map((w) => ({ title: clip(w.display_name, 200), year: w.publication_year, cited: w.cited_by_count, doi: w.doi }));
      },
    },
  },
  pubmed: {
    search: {
      label: 'Search PubMed',
      params: 'query',
      demo: { query: 'sleep deprivation and exam performance' },
      run: async (_a, p) => {
        const s = await api(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${howMany(p, 6, 12)}&term=${enc(need(p, 'query'))}`, { headers: OPEN_UA });
        const ids = (s.esearchresult && s.esearchresult.idlist) || [];
        if (!ids.length) return [];
        const d = await api(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`, { headers: OPEN_UA });
        return ids.map((id) => {
          const r = (d.result || {})[id] || {};
          return { title: clip(r.title, 220), journal: r.source, date: r.pubdate, authors: (r.authors || []).slice(0, 3).map((x) => x.name).join(', '), url: `https://pubmed.ncbi.nlm.nih.gov/${id}/` };
        });
      },
    },
  },
  wikipedia: {
    search: {
      label: 'Search Wikipedia',
      params: 'query',
      demo: { query: 'photosynthesis' },
      run: async (_a, p) => {
        const d = await api(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=${howMany(p, 6, 10)}&format=json&origin=*&srsearch=${enc(need(p, 'query'))}`, { headers: OPEN_UA });
        return ((d.query && d.query.search) || []).map((x) => ({ title: x.title, snippet: clip(plain(x.snippet), 200) }));
      },
    },
    summary: {
      label: 'Summary of a Wikipedia page',
      params: 'title',
      run: async (_a, p) => {
        const d = await api(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(need(p, 'title').replace(/ /g, '_'))}`, { headers: OPEN_UA });
        return { title: d.title, summary: clip(d.extract, 1500), url: d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page };
      },
    },
  },
  openlibrary: {
    search: {
      label: 'Search books',
      params: 'query',
      demo: { query: 'the pragmatic programmer' },
      run: async (_a, p) => {
        const d = await api(`https://openlibrary.org/search.json?limit=${howMany(p, 6, 12)}&fields=title,author_name,first_publish_year,key&q=${enc(need(p, 'query'))}`, { headers: OPEN_UA });
        return (d.docs || []).map((b) => ({ title: clip(b.title, 160), authors: (b.author_name || []).slice(0, 3).join(', '), year: b.first_publish_year, url: b.key ? `https://openlibrary.org${b.key}` : null }));
      },
    },
  },
  bluesky: {
    posts: {
      label: "A person's recent public posts",
      params: 'handle (like name.bsky.social)',
      demo: { handle: 'bsky.app' },
      run: async (_a, p) => {
        const d = await api(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?limit=${howMany(p, 10, 20)}&actor=${enc(slug(need(p, 'handle')))}`, { headers: OPEN_UA });
        return (d.feed || []).map((f) => ({ text: clip(f.post && f.post.record && f.post.record.text, 300), at: f.post && f.post.record && f.post.record.createdAt, likes: f.post && f.post.likeCount }));
      },
    },
  },
  edgar: {
    filings: {
      label: 'Recent SEC filings for a company',
      params: 'ticker',
      demo: { ticker: 'AAPL' },
      run: async (_a, p) => {
        const t = need(p, 'ticker', 12).toUpperCase().replace(/[^A-Z.-]/g, '');
        const idx = await api('https://www.sec.gov/files/company_tickers.json', { headers: OPEN_UA });
        const row = Object.values(idx || {}).find((r) => r && r.ticker === t);
        if (!row) throw new ApiError(404, `No company found for ${t}.`);
        const cik = String(row.cik_str).padStart(10, '0');
        const d = await api(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: OPEN_UA });
        const r = (d.filings && d.filings.recent) || { form: [] };
        return {
          company: d.name,
          filings: r.form.slice(0, 10).map((form, i) => ({
            form,
            date: r.filingDate[i],
            what: clip(r.primaryDocDescription && r.primaryDocDescription[i], 80),
            url: `https://www.sec.gov/Archives/edgar/data/${Number(row.cik_str)}/${String(r.accessionNumber[i]).replace(/-/g, '')}/${r.primaryDocument[i]}`,
          })),
        };
      },
    },
  },
  frankfurter: {
    rates: {
      label: 'Exchange rates',
      params: 'base (like USD), symbols (like EUR,GBP)',
      demo: { base: 'USD', symbols: 'EUR,GBP,JPY' },
      run: async (_a, p) => {
        const q = new URLSearchParams({ base: (opt(p, 'base', 3) || 'USD').toUpperCase().replace(/[^A-Z]/g, '') });
        const symbols = opt(p, 'symbols', 60).toUpperCase().replace(/[^A-Z,]/g, '');
        if (symbols) q.set('symbols', symbols);
        let d;
        try {
          d = await api(`https://api.frankfurter.dev/v1/latest?${q}`, { headers: OPEN_UA });
        } catch {
          d = await api(`https://api.frankfurter.app/latest?${q}`, { headers: OPEN_UA });
        }
        return { date: d.date, base: d.base, rates: d.rates };
      },
    },
  },
  gdelt: {
    news: {
      label: 'News coverage on a topic',
      params: 'query',
      demo: { query: 'student loans' },
      run: async (_a, p) => {
        const d = await api(`https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&maxrecords=${howMany(p, 10, 20)}&timespan=2d&sort=hybridrel&query=${enc(need(p, 'query'))}`, { headers: OPEN_UA });
        return (d.articles || []).map((x) => ({ title: clip(x.title, 160), site: x.domain, at: x.seendate, url: x.url }));
      },
    },
  },
  usgs: {
    quakes: {
      label: 'Recent earthquakes',
      params: 'minMagnitude',
      run: async (_a, p) => {
        const min = Math.max(0, Number(p && p.minMagnitude) || 4);
        const d = await api('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson', { headers: OPEN_UA });
        return (d.features || [])
          .map((f) => f.properties)
          .filter((x) => x && x.mag >= min)
          .slice(0, 12)
          .map((x) => ({ magnitude: x.mag, place: x.place, at: iso(x.time), url: x.url }));
      },
    },
  },
  nws: {
    alerts: {
      label: 'Active weather alerts for a US state',
      params: 'state (two letters, like TX)',
      demo: { state: 'TX' },
      run: async (_a, p) => {
        const area = need(p, 'state', 2).toUpperCase().replace(/[^A-Z]/g, '');
        const d = await api(`https://api.weather.gov/alerts/active?area=${area}`, { headers: { ...OPEN_UA, Accept: 'application/geo+json' } });
        return (d.features || []).slice(0, 12).map((f) => ({ event: f.properties.event, severity: f.properties.severity, where: clip(f.properties.areaDesc, 120), headline: clip(f.properties.headline, 160), ends: f.properties.ends }));
      },
    },
  },
  osm: {
    places: {
      label: 'Find a place or address',
      params: 'query',
      demo: { query: 'Eiffel Tower' },
      run: async (_a, p) => {
        const d = await api(`https://nominatim.openstreetmap.org/search?format=json&limit=${howMany(p, 5, 8)}&q=${enc(need(p, 'query'))}`, { headers: OPEN_UA });
        return (Array.isArray(d) ? d : []).map((x) => ({ name: clip(x.display_name, 160), lat: x.lat, lon: x.lon, kind: x.type }));
      },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // BETA: paste a key. Each person brings their own, so nothing to register.
  // ════════════════════════════════════════════════════════════════════════
  telegram: {
    updates: {
      label: 'Recent messages to your bot',
      run: async (a) => {
        if (!/^\d+:[\w-]+$/.test(a.token || '')) throw new ApiError(400, 'A Telegram bot token looks like 123456:ABC...');
        const d = await api(`https://api.telegram.org/bot${a.token}/getUpdates?limit=20`);
        return (d.result || []).filter((u) => u.message).map((u) => ({ who: u.message.from && u.message.from.first_name, chat: (u.message.chat && (u.message.chat.title || u.message.chat.first_name)) || '', text: clip(u.message.text, 300), at: iso(u.message.date * 1000) }));
      },
    },
  },
  cloudflare: {
    zones: {
      label: 'Your sites on Cloudflare',
      run: async (a) => {
        const d = await api('https://api.cloudflare.com/client/v4/zones?per_page=20', { token: a.token });
        return (d.result || []).map((z) => ({ name: z.name, status: z.status, plan: z.plan && z.plan.name }));
      },
    },
  },
  lastfm: {
    recent: {
      label: 'Recently played tracks',
      run: async (a) => {
        const d = await api(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&format=json&limit=10&user=${enc(a.user)}&api_key=${enc(a.key)}`);
        if (d.error) throw new ApiError(400, d.message || 'Last.fm said no');
        const t = (d.recenttracks && d.recenttracks.track) || [];
        return (Array.isArray(t) ? t : [t]).map((x) => ({ track: clip(x.name, 120), artist: x.artist && x.artist['#text'], at: (x.date && x.date['#text']) || (x['@attr'] && x['@attr'].nowplaying ? 'now playing' : '') }));
      },
    },
  },
  unsplash: {
    search: {
      label: 'Search free photos',
      params: 'query',
      demo: { query: 'study desk' },
      run: async (a, p) => {
        const d = await api(`https://api.unsplash.com/search/photos?per_page=${howMany(p, 6, 12)}&query=${enc(need(p, 'query'))}`, { headers: { Authorization: `Client-ID ${a.key}` } });
        return (d.results || []).map((x) => ({ about: clip(x.alt_description, 120), photographer: x.user && x.user.name, image: x.urls && x.urls.regular, page: x.links && x.links.html }));
      },
    },
  },
  pexels: {
    search: {
      label: 'Search free photos',
      params: 'query',
      demo: { query: 'study desk' },
      run: async (a, p) => {
        const d = await api(`https://api.pexels.com/v1/search?per_page=${howMany(p, 6, 12)}&query=${enc(need(p, 'query'))}`, { headers: { Authorization: a.key } });
        return (d.photos || []).map((x) => ({ about: clip(x.alt, 120), photographer: x.photographer, image: x.src && x.src.large, page: x.url }));
      },
    },
  },
  thesportsdb: {
    team: {
      label: 'Find a team',
      params: 'name',
      demo: { name: 'Dallas Cowboys' },
      run: async (a, p) => {
        const d = await api(`https://www.thesportsdb.com/api/v1/json/${slug(a.key)}/searchteams.php?t=${enc(need(p, 'name'))}`);
        return (d.teams || []).slice(0, 5).map((t) => ({ id: t.idTeam, name: t.strTeam, league: t.strLeague, stadium: t.strStadium }));
      },
    },
    next: {
      label: "A team's next games",
      params: 'teamId',
      run: async (a, p) => {
        const d = await api(`https://www.thesportsdb.com/api/v1/json/${slug(a.key)}/eventsnext.php?id=${slug(need(p, 'teamId', 12))}`);
        return (d.events || []).slice(0, 8).map((e) => ({ game: e.strEvent, date: e.dateEvent, time: e.strTime }));
      },
    },
    last: {
      label: "A team's last results",
      params: 'teamId',
      run: async (a, p) => {
        const d = await api(`https://www.thesportsdb.com/api/v1/json/${slug(a.key)}/eventslast.php?id=${slug(need(p, 'teamId', 12))}`);
        return (d.results || []).slice(0, 8).map((e) => ({ game: e.strEvent, date: e.dateEvent, home: e.intHomeScore, away: e.intAwayScore }));
      },
    },
  },
  footballdata: {
    today: {
      label: "Today's football matches",
      run: async (a) => {
        const d = await api('https://api.football-data.org/v4/matches', { headers: { 'X-Auth-Token': a.token } });
        return (d.matches || []).slice(0, 25).map((m) => ({ league: m.competition && m.competition.name, home: m.homeTeam && m.homeTeam.name, away: m.awayTeam && m.awayTeam.name, at: m.utcDate, status: m.status, score: m.score && m.score.fullTime }));
      },
    },
  },
  apisports: {
    today: {
      label: "Today's football fixtures",
      run: async (a) => {
        const d = await api(`https://v3.football.api-sports.io/fixtures?date=${todayStr()}`, { headers: { 'x-apisports-key': a.key } });
        if (d.errors && Object.keys(d.errors).length) throw new ApiError(400, Object.values(d.errors)[0] || 'API-Sports said no');
        return (d.response || []).slice(0, 30).map((f) => ({ league: f.league && f.league.name, home: f.teams && f.teams.home.name, away: f.teams && f.teams.away.name, at: f.fixture && f.fixture.date, status: f.fixture && f.fixture.status && f.fixture.status.short, goals: f.goals }));
      },
    },
  },
  alpaca: {
    account: {
      label: 'Paper trading account',
      run: async (a) => {
        const d = await api('https://paper-api.alpaca.markets/v2/account', { headers: { 'APCA-API-KEY-ID': a.key, 'APCA-API-SECRET-KEY': a.secret } });
        return { status: d.status, equity: d.equity, cash: d.cash, buyingPower: d.buying_power, currency: d.currency };
      },
    },
    positions: {
      label: 'Paper trading positions',
      run: async (a) => {
        const d = await api('https://paper-api.alpaca.markets/v2/positions', { headers: { 'APCA-API-KEY-ID': a.key, 'APCA-API-SECRET-KEY': a.secret } });
        return (Array.isArray(d) ? d : []).slice(0, 20).map((x) => ({ symbol: x.symbol, qty: x.qty, marketValue: x.market_value, unrealizedPL: x.unrealized_pl }));
      },
    },
  },
  fred: {
    series: {
      label: 'An economic data series',
      params: 'seriesId (like CPIAUCSL, UNRATE, GDP)',
      demo: { seriesId: 'UNRATE' },
      run: async (a, p) => {
        const d = await api(`https://api.stlouisfed.org/fred/series/observations?file_type=json&sort_order=desc&limit=6&series_id=${enc(slug(need(p, 'seriesId', 40)))}&api_key=${enc(a.key)}`);
        return (d.observations || []).map((o) => ({ date: o.date, value: o.value }));
      },
    },
  },
  steam: {
    recent: {
      label: 'Games played in the last two weeks',
      run: async (a) => {
        const d = await api(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?count=10&key=${enc(a.key)}&steamid=${enc(a.steamId)}`);
        return ((d.response && d.response.games) || []).map((g) => ({ game: g.name, hoursLastTwoWeeks: Math.round(((g.playtime_2weeks || 0) / 60) * 10) / 10, hoursTotal: Math.round((g.playtime_forever || 0) / 60) }));
      },
    },
    library: {
      label: 'Most played games',
      run: async (a) => {
        const d = await api(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?include_appinfo=1&key=${enc(a.key)}&steamid=${enc(a.steamId)}`);
        return ((d.response && d.response.games) || [])
          .sort((x, y) => (y.playtime_forever || 0) - (x.playtime_forever || 0))
          .slice(0, 15)
          .map((g) => ({ game: g.name, hours: Math.round((g.playtime_forever || 0) / 60) }));
      },
    },
  },
  itch: {
    games: {
      label: 'Your games and their numbers',
      run: async (a) => {
        const d = await api(`https://itch.io/api/1/${slug(a.key)}/my-games`);
        if (d.errors) throw new ApiError(400, (d.errors || [])[0] || 'itch.io said no');
        return (d.games || []).slice(0, 15).map((g) => ({ title: clip(g.title, 120), views: g.views_count, downloads: g.downloads_count, purchases: g.purchases_count }));
      },
    },
  },
  apibible: {
    search: {
      label: 'Search the Bible',
      params: 'query, version (like WEB or KJV, optional)',
      demo: { query: 'love' },
      run: async (a, p) => {
        const headers = { 'api-key': a.key };
        const list = await api('https://rest.api.bible/v1/bibles?language=eng', { headers });
        const want = (opt(p, 'version', 12) || 'WEB').toUpperCase();
        const bibles = list.data || [];
        const b = bibles.find((x) => String(x.abbreviation).toUpperCase() === want) || bibles[0];
        if (!b) throw new ApiError(404, 'No English Bible found for this key.');
        const d = await api(`https://rest.api.bible/v1/bibles/${b.id}/search?limit=5&query=${enc(need(p, 'query'))}`, { headers });
        return { version: b.abbreviation, verses: ((d.data && d.data.verses) || []).map((v) => ({ ref: v.reference, text: clip(plain(v.text), 400) })) };
      },
    },
  },
  esv: {
    passage: {
      label: 'Read a passage (ESV)',
      params: 'ref (like John 3:16-21)',
      demo: { ref: 'Psalm 23' },
      run: async (a, p) => {
        const q = new URLSearchParams({ q: need(p, 'ref', 80), 'include-headings': 'false', 'include-footnotes': 'false', 'include-short-copyright': 'true' });
        const d = await api(`https://api.esv.org/v3/passage/text/?${q}`, { headers: { Authorization: `Token ${a.key}` } });
        return { ref: d.canonical, text: clip((d.passages || [])[0], 2500) };
      },
    },
  },
  congress: {
    bills: {
      label: 'Recently updated federal bills',
      run: async (a) => {
        const d = await api(`https://api.congress.gov/v3/bill?format=json&limit=10&sort=updateDate+desc&api_key=${enc(a.key)}`);
        return (d.bills || []).map((b) => ({ bill: `${b.type} ${b.number}`, congress: b.congress, title: clip(b.title, 200), latest: b.latestAction && `${b.latestAction.actionDate}: ${clip(b.latestAction.text, 160)}` }));
      },
    },
  },
  openstates: {
    bills: {
      label: 'State bills',
      params: 'state (like Texas), query (optional)',
      demo: { state: 'Texas' },
      run: async (a, p) => {
        const q = new URLSearchParams({ jurisdiction: need(p, 'state', 40), per_page: '10', sort: 'latest_action_desc' });
        if (opt(p, 'query')) q.set('q', opt(p, 'query'));
        const d = await api(`https://v3.openstates.org/bills?${q}`, { headers: { 'X-API-KEY': a.key } });
        return (d.results || []).map((b) => ({ bill: b.identifier, title: clip(b.title, 200), latest: b.latest_action_description, date: b.latest_action_date }));
      },
    },
  },
  nasa: {
    apod: {
      label: 'Astronomy picture of the day',
      run: async (a) => {
        const d = await api(`https://api.nasa.gov/planetary/apod?api_key=${enc(a.key)}`);
        return { title: d.title, date: d.date, about: clip(d.explanation, 600), image: d.url };
      },
    },
    asteroids: {
      label: "Asteroids passing Earth today",
      run: async (a) => {
        const day0 = todayStr();
        const d = await api(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${day0}&end_date=${day0}&api_key=${enc(a.key)}`);
        const rows = (d.near_earth_objects && d.near_earth_objects[day0]) || [];
        return rows.slice(0, 10).map((n) => ({ name: n.name, hazardous: n.is_potentially_hazardous_asteroid, widthMeters: Math.round(n.estimated_diameter && n.estimated_diameter.meters ? n.estimated_diameter.meters.estimated_diameter_max : 0), moonDistances: n.close_approach_data && n.close_approach_data[0] && Math.round(Number(n.close_approach_data[0].miss_distance.lunar)) }));
      },
    },
  },
  openaq: {
    near: {
      label: 'Air quality near a place',
      params: 'lat, lon',
      demo: { lat: 40.71, lon: -74.0 },
      run: async (a, p) => {
        const lat = Number(p && p.lat);
        const lon = Number(p && p.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new ApiError(400, 'Missing lat and lon.');
        const headers = { 'X-API-Key': a.key };
        const locs = await api(`https://api.openaq.org/v3/locations?limit=1&radius=25000&coordinates=${lat},${lon}`, { headers });
        const loc = (locs.results || [])[0];
        if (!loc) return [];
        const sensors = Object.fromEntries((loc.sensors || []).map((s) => [s.id, s.parameter || {}]));
        const d = await api(`https://api.openaq.org/v3/locations/${loc.id}/latest`, { headers });
        return (d.results || []).map((r) => {
          const par = sensors[r.sensorsId] || {};
          return { station: loc.name, measure: par.displayName || par.name, value: r.value, unit: par.units, at: r.datetime && r.datetime.utc };
        });
      },
    },
  },
  ticketmaster: {
    events: {
      label: 'Find events',
      params: 'query, city (both optional)',
      demo: { query: 'concert' },
      run: async (a, p) => {
        const q = new URLSearchParams({ apikey: a.key, size: '10', sort: 'date,asc' });
        if (opt(p, 'query')) q.set('keyword', opt(p, 'query'));
        if (opt(p, 'city')) q.set('city', opt(p, 'city'));
        const d = await api(`https://app.ticketmaster.com/discovery/v2/events.json?${q}`);
        const ev = (d._embedded && d._embedded.events) || [];
        return ev.map((e) => ({ name: clip(e.name, 120), date: e.dates && e.dates.start && e.dates.start.localDate, where: e._embedded && e._embedded.venues && e._embedded.venues[0] && e._embedded.venues[0].name, url: e.url }));
      },
    },
  },
  googleplaces: {
    search: {
      label: 'Search for places',
      params: 'query',
      demo: { query: 'coffee shops near campus' },
      run: async (a, p) => {
        const d = await api('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'X-Goog-Api-Key': a.key, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.regularOpeningHours.openNow' },
          json: { textQuery: need(p, 'query'), maxResultCount: 8 },
        });
        return (d.places || []).map((x) => ({ name: x.displayName && x.displayName.text, address: x.formattedAddress, rating: x.rating, ratings: x.userRatingCount, openNow: x.regularOpeningHours && x.regularOpeningHours.openNow }));
      },
    },
  },
  homeassistant: {
    states: {
      label: 'Your devices and sensors',
      run: async (a) => {
        const d = await api(`${httpsUrl(a.url)}/api/states`, { token: a.token });
        const keep = ['light', 'switch', 'sensor', 'binary_sensor', 'climate', 'lock', 'cover', 'media_player'];
        return (Array.isArray(d) ? d : [])
          .filter((s) => keep.includes(String(s.entity_id).split('.')[0]))
          .slice(0, 40)
          .map((s) => ({ id: s.entity_id, name: s.attributes && s.attributes.friendly_name, state: s.state, unit: s.attributes && s.attributes.unit_of_measurement }));
      },
    },
    switch: {
      label: 'Turn a light, switch, scene or script on or off',
      write: true,
      params: 'entityId (like light.desk), on (true or false)',
      run: async (a, p) => {
        const id = need(p, 'entityId', 80);
        const m = id.match(/^(light|switch|scene|script|input_boolean)\.[\w]+$/);
        if (!m) throw new ApiError(400, 'Only lights, switches, scenes and scripts can be switched from here. Locks, alarms and doors never can.');
        const service = p.on === false || p.on === 'false' ? 'turn_off' : 'turn_on';
        await api(`${httpsUrl(a.url)}/api/services/${m[1]}/${service}`, { method: 'POST', token: a.token, json: { entity_id: id } });
        return { done: true, entity: id, now: service === 'turn_on' ? 'on' : 'off' };
      },
    },
  },
  tessie: {
    cars: {
      label: 'Your car: battery, charging, locked',
      run: async (a) => {
        const d = await api('https://api.tessie.com/vehicles?only_active=true', { token: a.token });
        return (d.results || []).slice(0, 5).map((v) => {
          const s = v.last_state || {};
          return {
            name: (s.display_name || v.display_name || 'Car') + (v.vin ? ` (${String(v.vin).slice(-4)})` : ''),
            batteryPercent: s.charge_state && s.charge_state.battery_level,
            charging: s.charge_state && s.charge_state.charging_state,
            locked: s.vehicle_state && s.vehicle_state.locked,
          };
        });
      },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // BETA wave 2: sign in with the service. Reads only for now.
  // ════════════════════════════════════════════════════════════════════════
  todoist: {
    tasks: {
      label: 'Your open tasks',
      run: async (a) => {
        const d = await api('https://api.todoist.com/api/v1/tasks?limit=30', { token: a.token });
        return (d.results || (Array.isArray(d) ? d : [])).slice(0, 30).map((t) => ({ task: clip(t.content, 160), due: t.due && (t.due.date || t.due.string), priority: t.priority, labels: t.labels }));
      },
    },
    projects: {
      label: 'Your projects',
      run: async (a) => {
        const d = await api('https://api.todoist.com/api/v1/projects?limit=30', { token: a.token });
        return (d.results || (Array.isArray(d) ? d : [])).map((x) => ({ id: x.id, name: x.name }));
      },
    },
  },
  dropbox: {
    files: {
      label: 'List files in a folder',
      params: 'path (like /School, blank for the top)',
      run: async (a, p) => {
        const path = opt(p, 'path', 300);
        const d = await api('https://api.dropboxapi.com/2/files/list_folder', { method: 'POST', token: a.token, json: { path: path && path !== '/' ? (path.startsWith('/') ? path : `/${path}`) : '', limit: 30 } });
        return (d.entries || []).map((e) => ({ name: e.name, kind: e['.tag'], modified: e.server_modified, size: e.size }));
      },
    },
    search: {
      label: 'Search your files',
      params: 'query',
      run: async (a, p) => {
        const d = await api('https://api.dropboxapi.com/2/files/search_v2', { method: 'POST', token: a.token, json: { query: need(p, 'query'), options: { max_results: 10 } } });
        return (d.matches || []).map((m) => { const x = (m.metadata && m.metadata.metadata) || {}; return { name: x.name, path: x.path_display, modified: x.server_modified }; });
      },
    },
  },
  gitlab: {
    projects: {
      label: 'Your recently active projects',
      run: async (a) => {
        const d = await api('https://gitlab.com/api/v4/projects?membership=true&simple=true&order_by=last_activity_at&per_page=10', { token: a.token });
        return (Array.isArray(d) ? d : []).map((x) => ({ name: x.path_with_namespace, lastActivity: x.last_activity_at, url: x.web_url }));
      },
    },
    mrs: {
      label: 'Merge requests assigned to you',
      run: async (a) => {
        const d = await api('https://gitlab.com/api/v4/merge_requests?state=opened&scope=assigned_to_me&per_page=10', { token: a.token });
        return (Array.isArray(d) ? d : []).map((x) => ({ title: clip(x.title, 160), repo: x.references && x.references.full, url: x.web_url }));
      },
    },
    issues: {
      label: 'Issues assigned to you',
      run: async (a) => {
        const d = await api('https://gitlab.com/api/v4/issues?state=opened&scope=assigned_to_me&per_page=10', { token: a.token });
        return (Array.isArray(d) ? d : []).map((x) => ({ title: clip(x.title, 160), repo: x.references && x.references.full, due: x.due_date, url: x.web_url }));
      },
    },
  },
  outlook: {
    inbox: {
      label: 'Latest inbox messages',
      run: async (a) => {
        const q = new URLSearchParams({ $top: '10', $select: 'subject,from,receivedDateTime,bodyPreview,isRead', $orderby: 'receivedDateTime desc' });
        const d = await graph(a, `/me/mailFolders/inbox/messages?${q}`);
        return (d.value || []).map((m) => ({ from: m.from && m.from.emailAddress && (m.from.emailAddress.name || m.from.emailAddress.address), subject: clip(m.subject, 140), at: m.receivedDateTime, unread: !m.isRead, preview: clip(m.bodyPreview, 220) }));
      },
    },
    search: {
      label: 'Search your mail',
      params: 'query',
      run: async (a, p) => {
        const q = new URLSearchParams({ $top: '10', $select: 'subject,from,receivedDateTime,bodyPreview', $search: `"${need(p, 'query', 120).replace(/"/g, '')}"` });
        const d = await graph(a, `/me/messages?${q}`);
        return (d.value || []).map((m) => ({ from: m.from && m.from.emailAddress && (m.from.emailAddress.name || m.from.emailAddress.address), subject: clip(m.subject, 140), at: m.receivedDateTime, preview: clip(m.bodyPreview, 220) }));
      },
    },
  },
  'outlook-calendar': {
    upcoming: {
      label: 'Upcoming events',
      params: 'days (default 3)',
      run: async (a, p) => {
        const days = Math.min(14, Number(p && p.days) || 3);
        const q = new URLSearchParams({ startDateTime: new Date().toISOString(), endDateTime: new Date(Date.now() + days * day).toISOString(), $top: '25', $orderby: 'start/dateTime', $select: 'subject,start,end,location,isAllDay' });
        const d = await graph(a, `/me/calendarView?${q}`, { headers: { Prefer: 'outlook.timezone="UTC"' } });
        return (d.value || []).map((e) => ({ title: clip(e.subject, 140), startUtc: e.start && e.start.dateTime, endUtc: e.end && e.end.dateTime, where: e.location && e.location.displayName, allDay: e.isAllDay }));
      },
    },
  },
  onedrive: {
    recent: {
      label: 'Recently used files',
      run: async (a) => {
        const d = await graph(a, '/me/drive/recent?$top=12');
        return (d.value || []).map((f) => ({ name: f.name, modified: f.lastModifiedDateTime, url: f.webUrl }));
      },
    },
    files: {
      label: 'Files at the top of your OneDrive',
      run: async (a) => {
        const d = await graph(a, '/me/drive/root/children?$top=30&$select=name,size,lastModifiedDateTime,folder,webUrl');
        return (d.value || []).map((f) => ({ name: f.name, folder: !!f.folder, modified: f.lastModifiedDateTime, url: f.webUrl }));
      },
    },
  },
  'microsoft-todo': {
    tasks: {
      label: 'Your open to-dos',
      run: async (a) => {
        const lists = await graph(a, '/me/todo/lists?$top=5');
        const out = [];
        for (const l of (lists.value || []).slice(0, 4)) {
          const q = new URLSearchParams({ $filter: "status ne 'completed'", $top: '15' });
          const t = await graph(a, `/me/todo/lists/${slug(l.id)}/tasks?${q}`);
          for (const x of t.value || []) out.push({ list: l.displayName, task: clip(x.title, 140), due: x.dueDateTime && x.dueDateTime.dateTime, importance: x.importance });
        }
        return out;
      },
    },
  },
  onenote: {
    pages: {
      label: 'Recently edited notes',
      run: async (a) => {
        const d = await graph(a, '/me/onenote/pages?$top=10&$orderby=lastModifiedDateTime desc&$select=title,lastModifiedDateTime,links');
        return (d.value || []).map((x) => ({ title: clip(x.title, 140), modified: x.lastModifiedDateTime }));
      },
    },
  },
  airtable: {
    bases: {
      label: 'Your bases',
      run: async (a) => {
        const d = await api('https://api.airtable.com/v0/meta/bases', { token: a.token });
        return (d.bases || []).slice(0, 20).map((b) => ({ id: b.id, name: b.name }));
      },
    },
    records: {
      label: 'Rows from a table',
      params: 'baseId, table (name or id)',
      run: async (a, p) => {
        const d = await api(`https://api.airtable.com/v0/${slug(need(p, 'baseId', 30))}/${enc(need(p, 'table', 80))}?maxRecords=${howMany(p, 10, 25)}`, { token: a.token });
        return (d.records || []).map((r) => r.fields);
      },
    },
  },
  jira: {
    issues: {
      label: 'Jira issues',
      params: 'jql (optional, defaults to your open issues)',
      run: async (a, p) => {
        const s = await atlassianSite(a);
        const jql = opt(p, 'jql', 400) || 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';
        const d = await api(`https://api.atlassian.com/ex/jira/${slug(s.id)}/rest/api/3/search/jql`, { method: 'POST', token: a.token, json: { jql, maxResults: 15, fields: ['summary', 'status', 'priority', 'duedate'] } });
        return (d.issues || []).map((i) => ({ key: i.key, summary: clip(i.fields && i.fields.summary, 160), status: i.fields && i.fields.status && i.fields.status.name, due: i.fields && i.fields.duedate }));
      },
    },
  },
  confluence: {
    search: {
      label: 'Search Confluence pages',
      params: 'query',
      run: async (a, p) => {
        const s = await atlassianSite(a);
        const q = new URLSearchParams({ cql: `text ~ "${need(p, 'query', 100).replace(/"/g, '')}"`, limit: '8' });
        const d = await api(`https://api.atlassian.com/ex/confluence/${slug(s.id)}/wiki/rest/api/search?${q}`, { token: a.token });
        return (d.results || []).map((r) => ({ title: clip(r.title, 140), excerpt: clip(plain(r.excerpt), 200), modified: r.lastModified }));
      },
    },
  },
  asana: {
    tasks: {
      label: 'Tasks assigned to you',
      run: async (a) => {
        const me = await api('https://app.asana.com/api/1.0/users/me', { token: a.token });
        const ws = me.data && me.data.workspaces && me.data.workspaces[0];
        if (!ws) return [];
        const d = await api(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${slug(ws.gid)}&completed_since=now&limit=25&opt_fields=name,due_on`, { token: a.token });
        return (d.data || []).map((t) => ({ task: clip(t.name, 160), due: t.due_on }));
      },
    },
  },
  zoom: {
    meetings: {
      label: 'Upcoming meetings',
      run: async (a) => {
        const d = await api('https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=15', { token: a.token });
        return (d.meetings || []).map((m) => ({ topic: clip(m.topic, 140), startsAt: m.start_time, minutes: m.duration, joinUrl: m.join_url }));
      },
    },
  },
  twitch: {
    following: {
      label: 'Followed channels that are live',
      run: async (a) => {
        const h = { 'Client-Id': a.clientId };
        const me = await api('https://api.twitch.tv/helix/users', { token: a.token, headers: h });
        const id = me.data && me.data[0] && me.data[0].id;
        if (!id) return [];
        const d = await api(`https://api.twitch.tv/helix/streams/followed?first=15&user_id=${slug(id)}`, { token: a.token, headers: h });
        return (d.data || []).map((s) => ({ channel: s.user_name, game: s.game_name, title: clip(s.title, 120), viewers: s.viewer_count }));
      },
    },
  },
  vimeo: {
    videos: {
      label: 'Your videos and plays',
      run: async (a) => {
        const d = await api('https://api.vimeo.com/me/videos?per_page=10&fields=name,link,created_time,stats.plays', { token: a.token, headers: { Accept: 'application/vnd.vimeo.*+json;version=3.4' } });
        return (d.data || []).map((v) => ({ title: clip(v.name, 120), plays: v.stats && v.stats.plays, made: v.created_time, url: v.link }));
      },
    },
  },
  eventbrite: {
    events: {
      label: 'Events you organize',
      run: async (a) => {
        const orgs = await api('https://www.eventbriteapi.com/v3/users/me/organizations/', { token: a.token });
        const org = orgs.organizations && orgs.organizations[0];
        if (!org) return [];
        const d = await api(`https://www.eventbriteapi.com/v3/organizations/${slug(org.id)}/events/?order_by=start_desc&page_size=10`, { token: a.token });
        return (d.events || []).map((e) => ({ name: clip(e.name && e.name.text, 140), starts: e.start && e.start.local, status: e.status, url: e.url }));
      },
    },
  },
  square: {
    payments: {
      label: 'Recent payments',
      run: async (a) => {
        const d = await api('https://connect.squareup.com/v2/payments?limit=10&sort_order=DESC', { token: a.token, headers: { 'Square-Version': '2024-10-17' } });
        return (d.payments || []).map((x) => ({ at: x.created_at, amount: cents(x.amount_money && x.amount_money.amount, x.amount_money && x.amount_money.currency), status: x.status }));
      },
    },
  },
  mailchimp: {
    campaigns: {
      label: 'Recent campaigns and how they did',
      run: async (a) => {
        const base = await mailchimpBase(a);
        const d = await api(`${base}/3.0/campaigns?count=8&sort_field=send_time&sort_dir=DESC`, { token: a.token });
        return (d.campaigns || []).map((c) => ({ title: clip(c.settings && c.settings.title, 120), status: c.status, sent: c.send_time, opens: c.report_summary && c.report_summary.open_rate, clicks: c.report_summary && c.report_summary.click_rate }));
      },
    },
    audiences: {
      label: 'Your audiences',
      run: async (a) => {
        const base = await mailchimpBase(a);
        const d = await api(`${base}/3.0/lists?count=10`, { token: a.token });
        return (d.lists || []).map((l) => ({ name: l.name, members: l.stats && l.stats.member_count }));
      },
    },
  },
  wordpress: {
    posts: {
      label: 'Your recent posts and drafts',
      run: async (a) => {
        if (!a.blog_id) throw new ApiError(400, 'Sign in again and pick a WordPress.com site.');
        const d = await api(`https://public-api.wordpress.com/rest/v1.1/sites/${slug(a.blog_id)}/posts?number=10&status=publish,draft&fields=title,status,date,URL`, { token: a.token });
        return (d.posts || []).map((x) => ({ title: clip(plain(x.title), 140), status: x.status, date: x.date, url: x.URL }));
      },
    },
  },
  planningcenter: {
    plans: {
      label: 'Upcoming service plans',
      run: async (a) => {
        const types = await api('https://api.planningcenteronline.com/services/v2/service_types?per_page=4', { token: a.token });
        const out = [];
        for (const t of (types.data || []).slice(0, 3)) {
          const d = await api(`https://api.planningcenteronline.com/services/v2/service_types/${slug(t.id)}/plans?filter=future&per_page=3&order=sort_date`, { token: a.token });
          for (const x of d.data || []) out.push({ service: t.attributes && t.attributes.name, title: x.attributes && (x.attributes.title || x.attributes.dates), date: x.attributes && x.attributes.sort_date });
        }
        return out;
      },
    },
  },
  hubspot: {
    contacts: {
      label: 'Recent contacts',
      run: async (a) => {
        const d = await api('https://api.hubapi.com/crm/v3/objects/contacts?limit=10&properties=firstname,lastname,email,company', { token: a.token });
        return (d.results || []).map((c) => ({ name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' '), email: c.properties.email, company: c.properties.company }));
      },
    },
    deals: {
      label: 'Recent deals',
      run: async (a) => {
        const d = await api('https://api.hubapi.com/crm/v3/objects/deals?limit=10&properties=dealname,amount,dealstage', { token: a.token });
        return (d.results || []).map((x) => ({ deal: x.properties.dealname, amount: x.properties.amount, stage: x.properties.dealstage }));
      },
    },
  },
  clickup: {
    tasks: {
      label: 'Tasks in your workspace',
      run: async (a) => {
        const h = { Authorization: a.token };
        const t = await api('https://api.clickup.com/api/v2/team', { headers: h });
        const team = t.teams && t.teams[0];
        if (!team) return [];
        const d = await api(`https://api.clickup.com/api/v2/team/${slug(team.id)}/task?page=0&order_by=due_date`, { headers: h });
        return (d.tasks || []).slice(0, 20).map((x) => ({ task: clip(x.name, 140), status: x.status && x.status.status, due: x.due_date ? iso(Number(x.due_date)).slice(0, 10) : null }));
      },
    },
  },
  typeform: {
    forms: {
      label: 'Your forms',
      run: async (a) => {
        const d = await api('https://api.typeform.com/forms?page_size=12', { token: a.token });
        return (d.items || []).map((f) => ({ id: f.id, title: clip(f.title, 120), updated: f.last_updated_at }));
      },
    },
    responses: {
      label: 'Latest answers to a form',
      params: 'formId',
      run: async (a, p) => {
        const d = await api(`https://api.typeform.com/forms/${slug(need(p, 'formId', 30))}/responses?page_size=10`, { token: a.token });
        return (d.items || []).map((r) => ({ at: r.submitted_at, answers: (r.answers || []).slice(0, 6).map((x) => clip(x.text || x.email || x.number || (x.choice && x.choice.label) || x.boolean, 120)) }));
      },
    },
  },
  box: {
    files: {
      label: 'Files at the top of your Box',
      run: async (a) => {
        const d = await api('https://api.box.com/2.0/folders/0/items?limit=30&fields=name,type,modified_at', { token: a.token });
        return (d.entries || []).map((e) => ({ name: e.name, kind: e.type, modified: e.modified_at }));
      },
    },
    search: {
      label: 'Search your Box',
      params: 'query',
      run: async (a, p) => {
        const d = await api(`https://api.box.com/2.0/search?limit=10&query=${enc(need(p, 'query'))}`, { token: a.token });
        return (d.entries || []).map((e) => ({ name: e.name, kind: e.type, modified: e.modified_at }));
      },
    },
  },
  'google-sheets': {
    read: {
      label: 'Read cells from a spreadsheet',
      params: 'spreadsheetId, range (like Sheet1!A1:D20)',
      run: async (a, p) => {
        const d = await api(`https://sheets.googleapis.com/v4/spreadsheets/${slug(need(p, 'spreadsheetId', 80))}/values/${enc(need(p, 'range', 80))}`, { token: a.token });
        return { range: d.range, rows: (d.values || []).slice(0, 40) };
      },
    },
  },
  'google-tasks': {
    tasks: {
      label: 'Your open Google Tasks',
      run: async (a) => {
        const lists = await api('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=5', { token: a.token });
        const out = [];
        for (const l of (lists.items || []).slice(0, 4)) {
          const t = await api(`https://tasks.googleapis.com/tasks/v1/lists/${slug(l.id)}/tasks?showCompleted=false&maxResults=15`, { token: a.token });
          for (const x of t.items || []) out.push({ list: l.title, task: clip(x.title, 140), due: x.due });
        }
        return out;
      },
    },
  },
  'google-classroom': {
    work: {
      label: 'Your classes and upcoming coursework',
      run: async (a) => {
        const c = await api('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&studentId=me&pageSize=8', { token: a.token });
        const out = [];
        for (const course of (c.courses || []).slice(0, 5)) {
          const w = await api(`https://classroom.googleapis.com/v1/courses/${slug(course.id)}/courseWork?pageSize=5&orderBy=dueDate%20desc`, { token: a.token }).catch(() => ({}));
          for (const x of w.courseWork || []) out.push({ course: course.name, title: clip(x.title, 140), due: x.dueDate ? `${x.dueDate.year}-${String(x.dueDate.month).padStart(2, '0')}-${String(x.dueDate.day).padStart(2, '0')}` : null });
        }
        return out;
      },
    },
  },
  'google-contacts': {
    people: {
      label: 'Find a contact',
      params: 'query',
      run: async (a, p) => {
        const d = await api(`https://people.googleapis.com/v1/people:searchContacts?pageSize=8&readMask=names,emailAddresses,phoneNumbers&query=${enc(need(p, 'query', 80))}`, { token: a.token });
        return (d.results || []).map((r) => ({ name: r.person.names && r.person.names[0] && r.person.names[0].displayName, email: r.person.emailAddresses && r.person.emailAddresses[0] && r.person.emailAddresses[0].value, phone: r.person.phoneNumbers && r.person.phoneNumbers[0] && r.person.phoneNumbers[0].value }));
      },
    },
  },
  vercel: {
    deployments: {
      label: 'Recent deployments',
      run: async (a) => {
        const d = await api('https://api.vercel.com/v6/deployments?limit=10', { token: a.token });
        return (d.deployments || []).map((x) => ({ project: x.name, state: x.state, at: x.created ? iso(x.created) : null, url: x.url ? `https://${x.url}` : null }));
      },
    },
  },
  netlify: {
    sites: {
      label: 'Your sites',
      run: async (a) => {
        const d = await api('https://api.netlify.com/api/v1/sites?per_page=15', { token: a.token });
        return (Array.isArray(d) ? d : []).map((s) => ({ name: s.name, url: s.ssl_url || s.url, updated: s.updated_at, published: s.published_deploy && s.published_deploy.state }));
      },
    },
  },
  printify: {
    orders: {
      label: 'Recent orders',
      run: async (a) => {
        const shops = await api('https://api.printify.com/v1/shops.json', { token: a.token });
        const shop = Array.isArray(shops) ? shops[0] : null;
        if (!shop) return [];
        const d = await api(`https://api.printify.com/v1/shops/${slug(shop.id)}/orders.json?limit=10`, { token: a.token });
        return (d.data || []).map((o) => ({ shop: shop.title, status: o.status, at: o.created_at, items: (o.line_items || []).length, total: cents(o.total_price, 'USD') }));
      },
    },
  },
  printful: {
    orders: {
      label: 'Recent orders',
      run: async (a) => {
        const d = await api('https://api.printful.com/orders?limit=10', { token: a.token });
        return (d.result || []).map((o) => ({ status: o.status, at: o.created ? iso(o.created * 1000) : null, items: (o.items || []).length, recipient: o.recipient && o.recipient.country_code }));
      },
    },
  },
  mastodon: {
    home: {
      label: 'Your home timeline',
      run: async (a) => {
        const d = await api(`${httpsUrl(a.url)}/api/v1/timelines/home?limit=15`, { token: a.token });
        return (Array.isArray(d) ? d : []).map((s) => ({ who: s.account && s.account.acct, text: clip(plain(s.content), 280), at: s.created_at }));
      },
    },
  },
  trello: {
    boards: {
      label: 'Your boards',
      run: async (a) => {
        const d = await api(`https://api.trello.com/1/members/me/boards?fields=name,url,dateLastActivity&key=${enc(a.key)}&token=${enc(a.token)}`);
        return (Array.isArray(d) ? d : []).slice(0, 20).map((b) => ({ name: b.name, lastActivity: b.dateLastActivity, url: b.url }));
      },
    },
    due: {
      label: 'Cards assigned to you',
      run: async (a) => {
        const d = await api(`https://api.trello.com/1/members/me/cards?fields=name,due,url&key=${enc(a.key)}&token=${enc(a.token)}`);
        return (Array.isArray(d) ? d : []).slice(0, 25).map((c) => ({ card: clip(c.name, 140), due: c.due }));
      },
    },
  },
};

/** A cheap call that proves a pasted key works, and who it belongs to. */
const VERIFY = {
  linear: (a) => api('https://api.linear.app/graphql', { method: 'POST', headers: { Authorization: a.oauth ? `Bearer ${a.token}` : a.token }, json: { query: '{ viewer { name } }' } }).then((d) => d.data && d.data.viewer && d.data.viewer.name),
  groupme: (a) => api('https://api.groupme.com/v3/users/me', { headers: { 'X-Access-Token': a.token } }).then((d) => d.response && d.response.name),
  sentry: (a) => ACTIONS.sentry.issues.run(a).then(() => a.org),
  zotero: (a) => ACTIONS.zotero.recent.run(a).then(() => `Zotero library ${a.userId}`),
  readwise: (a) => api('https://readwise.io/api/v2/auth/', { headers: { Authorization: `Token ${a.token}` } }).then(() => 'Readwise'),
  posthog: (a) => ACTIONS.posthog.week.run(a).then(() => `PostHog project ${a.projectId}`),
  expo: (a) => ACTIONS.expo.builds.run(a).then(() => a.app),
  revenuecat: (a) => ACTIONS.revenuecat.overview.run(a).then(() => `RevenueCat ${a.projectId}`),
  stripe: (a) => {
    if (/^sk_/.test(a.key)) throw new ApiError(400, 'Use a restricted key (rk_...), not your secret key. Give it read-only access.');
    return api('https://api.stripe.com/v1/balance', { token: a.key }).then(() => 'Stripe (read-only)');
  },
  canvas: (a) => api(`${httpsUrl(a.domain)}/api/v1/users/self`, { token: a.token }).then((d) => d.name),
  calendly: (a) => api('https://api.calendly.com/users/me', { token: a.token }).then((d) => d.resource && d.resource.name),
  ghost: (a) => ACTIONS.ghost.drafts.run(a).then(() => httpsUrl(a.url).replace(/^https:\/\//, '')),
  discord: (a) => api('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${a.token}` } }).then((d) => d.username),
};

// Beta connectors check a pasted key by running their first read with a harmless example.
for (const [name, set] of Object.entries(ACTIONS)) {
  if (VERIFY[name] || !CONNECTORS[name] || !CONNECTORS[name].fields || !CONNECTORS[name].fields.length) continue;
  const first = Object.values(set).find((d) => !d.write);
  if (first) VERIFY[name] = (a) => first.run(a, first.demo || {}).then(() => name === 'homeassistant' ? httpsUrl(a.url).replace(/^https:\/\//, '') : 'Connected');
}

/** Who signed in, shown on the connection page. */
async function accountFor(connector, provider, a, raw) {
  try {
    if (provider === 'github') return (await api('https://api.github.com/user', { token: a.token })).login;
    if (provider === 'slack') return raw && raw.team && raw.team.name;
    if (provider === 'notion') return raw && raw.workspace_name;
    if (provider === 'linear') return VERIFY.linear(a);
    if (provider === 'google') return 'Google account';
  } catch {
    /* the label is a nicety */
  }
  return null;
}

/** Exchanges a code or refresh token. Providers differ in how they want the client secret. */
async function tokenRequest(cfg, app, form, verifier) {
  const body = { ...form };
  if (verifier) body.code_verifier = verifier;
  if (cfg.json) return api(cfg.token, { method: 'POST', basic: `${app.clientId}:${app.clientSecret}`, json: body });
  if (cfg.jsonBody) return api(cfg.token, { method: 'POST', json: { ...body, client_id: app.clientId, client_secret: app.clientSecret } });
  if (cfg.basicForm) return api(cfg.token, { method: 'POST', basic: `${app.clientId}:${app.clientSecret}`, form: body });
  return api(cfg.token, { method: 'POST', form: { ...body, client_id: app.clientId, client_secret: app.clientSecret } });
}

// ── tokens ─────────────────────────────────────────────────────────────────
async function loadAuth(uid, connector) {
  const snap = await tokenDoc(uid, connector).get();
  if (!snap.exists) throw new ApiError(404, `${connector} isn't connected.`);
  const row = snap.data();
  let a = unseal(row.sealed);
  // Refresh expiring OAuth tokens (Google, GitHub Apps).
  if (a.refreshToken && a.expiresAt && Date.now() > a.expiresAt - 60_000) {
    const cfg = OAUTH[row.provider];
    const app = providerApp(row.provider);
    if (cfg && app) {
      const d = await tokenRequest(cfg, app, { grant_type: 'refresh_token', refresh_token: a.refreshToken });
      a = { ...a, token: d.access_token, expiresAt: d.expires_in ? Date.now() + d.expires_in * 1000 : null, refreshToken: d.refresh_token || a.refreshToken };
      await tokenDoc(uid, connector).set({ sealed: seal(a), refreshedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  return a;
}

async function storeAuth(uid, connector, provider, a, account) {
  await tokenDoc(uid, connector).set({
    uid,
    connector,
    provider: provider || null,
    account: account || null,
    sealed: seal(a),
    connectedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/** Runs one action. Used by connectorCall and by teammates (reads only). */
async function runConnector(uid, connector, action, params = {}, approved = false) {
  const def = ACTIONS[connector] && ACTIONS[connector][action];
  if (!def) throw new ApiError(400, `Unknown action ${connector}.${action}`);
  if (def.write && !approved) throw new ApiError(403, 'That changes something, so it needs your approval first.');
  const a = connector === 'wolfram' ? {} : await loadAuth(uid, connector);
  return def.run(a, params || {});
}

/** The connectors this person has, with what teammates may read. Cached briefly. */
const listCache = new Map();
async function liveConnectors(uid) {
  const hit = listCache.get(uid);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const snap = await db.collection('connectorTokens').where('uid', '==', uid).get();
  const value = snap.docs.map((d) => d.data().connector).filter((c) => ACTIONS[c]);
  if (apps().wolfram && apps().wolfram.appId) value.push('wolfram');
  listCache.set(uid, { at: Date.now(), value });
  return value;
}

/** A line per connection for the teammate's instructions. */
function describeReads(list) {
  return list
    .map((c) => {
      const reads = Object.entries(ACTIONS[c] || {}).filter(([, d]) => !d.write);
      return `${c}: ${reads.map(([k, d]) => `${k} (${d.label}${d.params ? '; send ' + d.params : ''})`).join(', ')}`;
    })
    .join('\n');
}

// ── shared request plumbing ────────────────────────────────────────────────
async function verifyUser(req) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

function fail(res, e) {
  if (!(e instanceof ApiError)) console.error('connectors:', e && e.name);
  let status = e instanceof ApiError && e.status >= 400 && e.status < 600 ? e.status : e instanceof ApiError ? 400 : 500;
  // A provider saying 401 means their key is bad, not that the person's Eternity sign-in is.
  if (status === 401) status = 400;
  res.status(status).json({ error: e instanceof ApiError ? e.message : 'Something went wrong on our side.' });
}

function allowedReturn(url) {
  const u = String(url || '');
  if (/^(eternity|exp|exps):\/\//i.test(u)) return true;
  try {
    const origin = new URL(u).origin;
    const extra = apps().webOrigins || [];
    return /^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https:\/\/[\w-]+\.(web\.app|firebaseapp\.com)$/.test(origin) || extra.includes(origin);
  } catch {
    return false;
  }
}

const withQuery = (url, q) => `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(q)}`;

function page(res, title, body) {
  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(
      `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:-apple-system,system-ui,sans-serif;background:#EEE8DD;color:#1E2023;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center"><div style="max-width:420px">${body}</div></body>`,
    );
}

// ── the functions ──────────────────────────────────────────────────────────
exports.connectorStart = onRequest({ secrets: SECRETS, cors: true, memory: '256MiB' }, async (req, res) => {
  try {
    if (req.method !== 'POST') return void res.status(405).json({ error: 'Use POST' });
    const user = await verifyUser(req);
    if (!user) return void res.status(401).json({ error: 'Sign in again' });
    const { connector, returnUrl } = req.body || {};
    const c = CONNECTORS[connector];
    if (!c || c.kind !== 'oauth') throw new ApiError(400, 'That one connects with a key, not a sign-in.');
    const app = providerApp(c.provider);
    if (!app) throw new ApiError(503, `${connector} sign-in isn't set up on the server yet.`);
    if (!allowedReturn(returnUrl)) throw new ApiError(400, 'Bad return address.');
    const cfg = OAUTH[c.provider];
    const state = crypto.randomBytes(24).toString('base64url');
    const verifier = cfg.pkce ? crypto.randomBytes(48).toString('base64url') : null;
    await stateDoc(state).set({ uid: user.uid, connector, returnUrl, createdAt: Date.now(), ...(verifier ? { verifier } : {}) });
    const scopes = scopesFor(connector);
    const q = { client_id: app.clientId, redirect_uri: CALLBACK_URL, state, ...cfg.params };
    if (verifier) {
      q.code_challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      q.code_challenge_method = 'S256';
    }
    if (scopes.length) {
      if (cfg.userScope) q.user_scope = scopes.join(',');
      else q.scope = scopes.join(cfg.scopeSep || ' ');
    }
    // GroupMe can't carry our state, so its callback hands the token to the app instead.
    const url = cfg.implicit ? `${cfg.auth}?client_id=${encodeURIComponent(app.clientId)}` : `${cfg.auth}?${new URLSearchParams(q)}`;
    res.status(200).json({ url });
  } catch (e) {
    fail(res, e);
  }
});

exports.eternityOAuthCallback = onRequest({ secrets: SECRETS, cors: false, memory: '256MiB' }, async (req, res) => {
  const { code, state, error } = req.query || {};
  // GroupMe returns the token right in the address.
  if (req.query && req.query.access_token && !state) {
    const token = String(req.query.access_token).replace(/[^\w-]/g, '');
    const deep = `eternity://connected?${new URLSearchParams({ connector: 'groupme', token })}`;
    const web = (apps().webOrigins || [])[0];
    page(
      res,
      'GroupMe connected',
      `<h2>Almost there</h2><p>Tap below to finish connecting GroupMe in Eternity.</p><p><a href="${deep}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#1E5BD2;color:#fff;text-decoration:none;font-weight:600">Open Eternity</a></p>${web ? `<p><a href="${web}/connected?${new URLSearchParams({ connector: 'groupme', token })}">Using Eternity on the web?</a></p>` : ''}<script>setTimeout(function(){location.href=${JSON.stringify(deep)}},300)</script>`,
    );
    return;
  }
  let st = null;
  try {
    if (!state) throw new ApiError(400, 'Missing state');
    const snap = await stateDoc(String(state)).get();
    if (!snap.exists) throw new ApiError(400, 'This sign-in link expired. Try again from the app.');
    st = snap.data();
    await stateDoc(String(state)).delete();
    if (Date.now() - st.createdAt > 15 * 60_000) throw new ApiError(400, 'This sign-in link expired. Try again from the app.');
    if (error) throw new ApiError(400, String(error) === 'access_denied' ? 'You cancelled the sign-in.' : String(error));
    const c = CONNECTORS[st.connector];
    const cfg = OAUTH[c.provider];
    const app = providerApp(c.provider);
    const form = { grant_type: 'authorization_code', code: String(code || ''), redirect_uri: CALLBACK_URL };
    const raw = await tokenRequest(cfg, app, form, st.verifier);
    if (c.provider === 'slack' && !raw.ok) throw new ApiError(400, raw.error || 'Slack said no');
    const tok = c.provider === 'slack' ? raw.authed_user && raw.authed_user.access_token : raw.access_token;
    if (!tok) throw new ApiError(400, 'No token came back.');
    const a = {
      token: tok,
      oauth: true,
      refreshToken: raw.refresh_token || null,
      expiresAt: raw.expires_in ? Date.now() + Number(raw.expires_in) * 1000 : null,
      scope: raw.scope || (raw.authed_user && raw.authed_user.scope) || null,
    };
    if (cfg.needsClientId) a.clientId = app.clientId;
    for (const k of cfg.keep || []) if (raw[k] !== undefined) a[k] = String(raw[k]);
    const account = await accountFor(st.connector, c.provider, a, raw);
    await storeAuth(st.uid, st.connector, c.provider, a, account);
    listCache.delete(st.uid);
    if (allowedReturn(st.returnUrl)) return void res.redirect(302, withQuery(st.returnUrl, { connector: st.connector, status: 'ok' }));
    page(res, 'Connected', `<h2>Connected</h2><p>${st.connector} is connected. You can close this and go back to Eternity.</p>`);
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Something went wrong.';
    if (!(e instanceof ApiError)) console.error('oauth callback:', e && e.name);
    if (st && allowedReturn(st.returnUrl)) return void res.redirect(302, withQuery(st.returnUrl, { connector: st.connector, status: 'error', reason: msg }));
    page(res, 'Not connected', `<h2>That didn't connect</h2><p>${msg.replace(/[<>]/g, '')}</p><p>Go back to Eternity and try again.</p>`);
  }
});

exports.connectorSave = onRequest({ secrets: SECRETS, cors: true, memory: '256MiB' }, async (req, res) => {
  try {
    if (req.method !== 'POST') return void res.status(405).json({ error: 'Use POST' });
    const user = await verifyUser(req);
    if (!user) return void res.status(401).json({ error: 'Sign in again' });
    const { connector, fields } = req.body || {};
    const c = CONNECTORS[connector];
    if (!c || !c.fields) throw new ApiError(400, "That one doesn't take a key.");
    const a = {};
    for (const f of c.fields) {
      const v = String((fields && fields[f]) || '').trim();
      if (!v && !(f === 'host' || f === 'platform')) throw new ApiError(400, `Missing ${f}.`);
      if (v.length > 600) throw new ApiError(400, `${f} is too long.`);
      a[f] = v;
    }
    if (connector === 'ghost') a.platform = a.platform === 'wordpress' ? 'wordpress' : 'ghost';
    let account = null;
    try {
      account = VERIFY[connector] ? await VERIFY[connector](a) : null;
    } catch (e) {
      const s = e instanceof ApiError ? e.status : 0;
      throw new ApiError(400, s === 401 || s === 403 ? "That key didn't work. Check it and try again." : e.message || "Couldn't check that key.");
    }
    await storeAuth(user.uid, connector, null, a, account);
    listCache.delete(user.uid);
    res.status(200).json({ ok: true, account });
  } catch (e) {
    fail(res, e);
  }
});

exports.connectorCall = onRequest({ secrets: SECRETS, cors: true, memory: '256MiB', timeoutSeconds: 60 }, async (req, res) => {
  try {
    if (req.method !== 'POST') return void res.status(405).json({ error: 'Use POST' });
    const user = await verifyUser(req);
    if (!user) return void res.status(401).json({ error: 'Sign in again' });
    const { connector, action, params, approved } = req.body || {};
    const data = await runConnector(user.uid, connector, action, params, approved === true);
    res.status(200).json({ ok: true, data });
  } catch (e) {
    fail(res, e);
  }
});

exports.connectorStatus = onRequest({ secrets: SECRETS, cors: true, memory: '256MiB' }, async (req, res) => {
  try {
    const user = await verifyUser(req);
    if (!user) return void res.status(401).json({ error: 'Sign in again' });
    const snap = await db.collection('connectorTokens').where('uid', '==', user.uid).get();
    const connected = snap.docs.map((d) => {
      const x = d.data();
      return { connector: x.connector, account: x.account || null, connectedAt: x.connectedAt ? x.connectedAt.toMillis() : null };
    });
    const availability = Object.fromEntries(Object.keys(CONNECTORS).map((k) => [k, available(k)]));
    const actions = Object.fromEntries(Object.entries(ACTIONS).map(([k, v]) => [k, Object.entries(v).map(([name, d]) => ({ name, label: d.label, write: !!d.write, params: d.params || null, demo: d.demo || null }))]));
    res.status(200).json({ connected, available: availability, actions });
  } catch (e) {
    fail(res, e);
  }
});

exports.connectorDisconnect = onRequest({ secrets: SECRETS, cors: true, memory: '256MiB' }, async (req, res) => {
  try {
    if (req.method !== 'POST') return void res.status(405).json({ error: 'Use POST' });
    const user = await verifyUser(req);
    if (!user) return void res.status(401).json({ error: 'Sign in again' });
    const { connector } = req.body || {};
    const ref = tokenDoc(user.uid, String(connector || ''));
    const snap = await ref.get();
    if (snap.exists) {
      const row = snap.data();
      try {
        const a = unseal(row.sealed);
        if (row.provider === 'google') await fetch(`${OAUTH.google.revoke}?token=${encodeURIComponent(a.refreshToken || a.token)}`, { method: 'POST' });
        if (row.provider === 'slack') await api('https://slack.com/api/auth.revoke', { token: a.token });
      } catch {
        /* deleting our copy is what matters */
      }
      await ref.delete();
    }
    listCache.delete(user.uid);
    res.status(200).json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

module.exports.runConnector = runConnector;
module.exports.liveConnectors = liveConnectors;
module.exports.describeReads = describeReads;
module.exports.CONNECTOR_SECRETS = SECRETS;
module.exports.ACTIONS = ACTIONS;
