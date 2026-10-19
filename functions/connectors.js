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
      const d = await api(cfg.token, { method: 'POST', form: { grant_type: 'refresh_token', refresh_token: a.refreshToken, client_id: app.clientId, client_secret: app.clientSecret } });
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
      return `${c}: ${reads.map(([k, d]) => `${k} (${d.label})`).join(', ')}`;
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
    await stateDoc(state).set({ uid: user.uid, connector, returnUrl, createdAt: Date.now() });
    const scopes = scopesFor(connector);
    const q = { client_id: app.clientId, redirect_uri: CALLBACK_URL, state, ...cfg.params };
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
    let raw;
    if (cfg.json) raw = await api(cfg.token, { method: 'POST', basic: `${app.clientId}:${app.clientSecret}`, json: form });
    else raw = await api(cfg.token, { method: 'POST', form: { ...form, client_id: app.clientId, client_secret: app.clientSecret } });
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
    const actions = Object.fromEntries(Object.entries(ACTIONS).map(([k, v]) => [k, Object.entries(v).map(([name, d]) => ({ name, label: d.label, write: !!d.write }))]));
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
