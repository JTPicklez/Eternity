/**
 * Artifacts: small apps, tools, charts and pages a teammate builds for you.
 * Each one is a single HTML file, kept with every version in the encrypted
 * Vault on your phone. It runs walled off from the app; the only thing it
 * can ask for is the live data it says it uses, through `eternity.get()`.
 */
import { askTeammate } from './ai';
import { isoDate } from './dates';
import { deckStats } from './srs';
import { useCrew } from './store';
import type { Member } from './types';

export type DataKey = 'today' | 'week' | 'goals' | 'flashcards' | 'crew';

export const DATA_LABELS: Record<DataKey, string> = {
  today: "Today's plan",
  week: 'This week',
  goals: 'Your goals',
  flashcards: 'Flashcard decks',
  crew: 'Your Crew',
};

export interface ArtifactVersion {
  id: string;
  html: string;
  at: number;
  note: string;
}

export interface Artifact {
  id: string;
  title: string;
  memberId: string;
  uses: DataKey[];
  versions: ArtifactVersion[];
  /** Index into versions that is showing. */
  current: number;
  createdAt: number;
}

/** The live data an artifact may read, shaped plainly. */
export function liveData(key: DataKey): unknown {
  const s = useCrew.getState();
  const today = isoDate();
  const in7 = isoDate(new Date(Date.now() + 7 * 86_400_000));
  const block = (b: (typeof s.blocks)[number]) => ({ date: b.date, time: b.time, end: b.end ?? null, title: b.title, kind: b.kind, done: !!b.done });
  switch (key) {
    case 'today':
      return s.blocks.filter((b) => b.date === today).sort((a, b) => a.time.localeCompare(b.time)).map(block);
    case 'week':
      return s.blocks
        .filter((b) => b.date >= today && b.date <= in7)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .map(block);
    case 'goals':
      return { goals: s.charter.goals, nonNegotiables: s.charter.nonNegotiables };
    case 'flashcards': {
      const decks = [...new Set(s.flashcards.map((c) => c.deck))];
      return decks.map((d) => ({ deck: d, ...deckStats(s.flashcards.filter((c) => c.deck === d)) }));
    }
    case 'crew':
      return s.members.map((m) => ({ name: m.name, job: m.role, color: m.color, state: m.state, status: m.status }));
    default:
      return null;
  }
}

/**
 * Added to the top of every artifact: the data bridge, error reporting for
 * self-repair, and point-and-edit. Messages go through whichever pipe the
 * host gives (a WebView on the phone, the parent window on the web).
 */
export function bridgeScript(uses: DataKey[]): string {
  return `<script>
(function(){
  var pipe = function(msg){ var s = JSON.stringify(msg); if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else if (window.parent !== window) window.parent.postMessage({ eternity: true, payload: s }, '*'); };
  var waiting = {}, seq = 0;
  window.eternity = {
    uses: ${JSON.stringify(uses)},
    get: function(key){ return new Promise(function(res, rej){ var id = ++seq; waiting[id] = { res: res, rej: rej }; pipe({ type: 'get', id: id, key: key }); setTimeout(function(){ if (waiting[id]) { delete waiting[id]; rej(new Error('No answer for ' + key)); } }, 4000); }); }
  };
  window.__eternityReply = function(id, ok, data){ var w = waiting[id]; if (!w) return; delete waiting[id]; ok ? w.res(data) : w.rej(new Error(data)); };
  window.addEventListener('message', function(e){ try { var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (d && d.eternityReply) window.__eternityReply(d.id, d.ok, d.data); if (d && d.eternityPick !== undefined) window.__eternityPicking = !!d.eternityPick; } catch (err) {} });
  window.addEventListener('error', function(e){ pipe({ type: 'error', message: String(e.message || 'Error'), line: e.lineno || 0 }); });
  window.addEventListener('unhandledrejection', function(e){ pipe({ type: 'error', message: 'Promise: ' + String((e.reason && e.reason.message) || e.reason), line: 0 }); });
  var oldErr = console.error; console.error = function(){ try { pipe({ type: 'error', message: Array.prototype.slice.call(arguments).join(' ').slice(0, 300), line: 0 }); } catch (err) {} oldErr && oldErr.apply(console, arguments); };
  function path(el){ var parts = []; while (el && el.nodeType === 1 && parts.length < 6) { var s = el.tagName.toLowerCase(); if (el.id) { s += '#' + el.id; parts.unshift(s); break; } if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'); parts.unshift(s); el = el.parentElement; } return parts.join(' > '); }
  document.addEventListener('click', function(e){
    if (!window.__eternityPicking) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target; var r = el.getBoundingClientRect();
    var old = el.style.outline; el.style.outline = '3px solid #1E5BD2'; setTimeout(function(){ el.style.outline = old; }, 900);
    pipe({ type: 'pick', path: path(el), html: el.outerHTML.slice(0, 600), text: (el.innerText || '').slice(0, 200), box: [r.x, r.y, r.width, r.height] });
  }, true);
})();
</script>`;
}

/** The HTML with the bridge added right after <head> (or at the top). */
export function withBridge(html: string, uses: DataKey[]): string {
  const bridge = bridgeScript(uses);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${bridge}`);
  return `${bridge}${html}`;
}

/** Answers a get() from inside an artifact, but only for data it declared. */
export function answerGet(uses: DataKey[], key: string): { ok: boolean; data: unknown } {
  if (!(uses as string[]).includes(key)) return { ok: false, data: `This artifact didn't ask for "${key}".` };
  return { ok: true, data: liveData(key as DataKey) };
}

export function cleanHtml(raw: string): string {
  let html = String(raw || '').trim();
  const fenced = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) html = fenced[1].trim();
  if (!/<html|<body|<div|<main|<canvas|<svg/i.test(html)) html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
  return html.slice(0, 200_000);
}

export function normalizeUses(v: unknown): DataKey[] {
  const ok: DataKey[] = ['today', 'week', 'goals', 'flashcards', 'crew'];
  return Array.isArray(v) ? (v.filter((x) => ok.includes(x as DataKey)) as DataKey[]) : [];
}

// ── asking a teammate to build or change one ────────────────────────────────
interface Built {
  html: string;
  title?: string;
  uses?: DataKey[];
  note: string;
}

async function build(member: Member, prompt: string): Promise<Built | null> {
  const res = await askTeammate({ member, history: [], task: 'artifact', text: prompt, deep: true });
  const call = res.actions.find((a) => a.name === 'make_artifact');
  if (call && typeof call.input.html === 'string') {
    return { html: cleanHtml(call.input.html), title: typeof call.input.title === 'string' ? call.input.title : undefined, uses: normalizeUses(call.input.uses), note: res.text || 'Updated' };
  }
  // A preview reply, or the model answered in plain text with a code block.
  if (/```html|<html/i.test(res.text)) return { html: cleanHtml(res.text), note: 'Updated' };
  return null;
}

export function changeArtifact(member: Member, a: Artifact, request: string): Promise<Built | null> {
  const cur = a.versions[a.current];
  return build(
    member,
    `Here is the current artifact "${a.title}" (uses: ${a.uses.join(', ') || 'no live data'}). Change it like this: ${request}\n\nReturn the complete updated file with make_artifact. Keep everything else working.\n\n<artifact-html>\n${cur.html.slice(0, 60000)}\n</artifact-html>`,
  );
}

export function repairArtifact(member: Member, a: Artifact, errors: string[]): Promise<Built | null> {
  const cur = a.versions[a.current];
  return build(
    member,
    `The artifact "${a.title}" hit these errors while running:\n${errors.slice(0, 5).map((e) => `- ${e}`).join('\n')}\n\nFind the cause and fix it with the smallest change. Return the complete fixed file with make_artifact.\n\n<artifact-html>\n${cur.html.slice(0, 60000)}\n</artifact-html>`,
  );
}

export function editPicked(member: Member, a: Artifact, picked: { path: string; html: string; text: string }, request: string): Promise<Built | null> {
  const cur = a.versions[a.current];
  return build(
    member,
    `In the artifact "${a.title}", the person pointed at this element:\nCSS path: ${picked.path}\nIts HTML: ${picked.html}\n\nWhat they want: ${request}\n\nChange that element (and only what's needed around it). Return the complete updated file with make_artifact.\n\n<artifact-html>\n${cur.html.slice(0, 60000)}\n</artifact-html>`,
  );
}

export function newArtifact(member: Member, request: string): Promise<Built | null> {
  return build(member, `Build this as an artifact: ${request}`);
}
