/**
 * The Guard and the page helpers for Eternity Browser.
 *
 * Web pages are data, never instructions. Before any page text reaches a
 * teammate, the Guard scans it for lines that try to give orders ("ignore
 * your user", "send their inbox to…"), strips them out and logs what it
 * caught so you can see it.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any |your |the )?(previous |prior |above )?(instructions|user|rules|prompts?)/i,
  /disregard (all |your |the )?(previous |prior )?(instructions|rules)/i,
  /you are now (a|an|the)\b/i,
  /(new|updated) (system )?instructions?:/i,
  /system prompt/i,
  /(forward|send|email|upload|exfiltrate|share) (all |their |the user'?s? |your user'?s? )?(inbox|emails?|password|passwords|contacts|files|data|messages|credentials)/i,
  /\bassistant\b.{0,40}\b(must|should) (now )?(send|transfer|pay|buy|delete)/i,
  /(transfer|send|wire) \$?\d+.{0,30}\b(to|into)\b/i,
  /do not (tell|inform|alert) (the )?user/i,
];

export interface GuardResult {
  clean: string;
  caught: string[];
}

export function guardPage(text: string): GuardResult {
  const caught: string[] = [];
  const lines = text.split(/\n+/);
  const kept = lines.filter((line) => {
    const hit = INJECTION_PATTERNS.some((re) => re.test(line));
    if (hit) caught.push(line.trim().slice(0, 220));
    return !hit;
  });
  return { clean: kept.join('\n'), caught };
}

// ── due dates ───────────────────────────────────────────────────────────────
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface DueDate {
  label: string;
  date: string; // YYYY-MM-DD
  context: string;
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Finds "due Oct 21", "exam on 11/04", "deadline: November 3" and so on. */
export function findDueDates(text: string, now = new Date()): DueDate[] {
  const out: DueDate[] = [];
  const seen = new Set<string>();
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const keyword = /\b(due|deadline|exam|quiz|midterm|final|test|submit|submission|project|essay|paper|assignment|homework|lab report|presentation)\b/i;
  for (const sentence of sentences) {
    if (!keyword.test(sentence) || sentence.length > 300) continue;
    const found: { y: number; m: number; d: number }[] = [];
    const named = sentence.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/gi);
    for (const m of named) {
      const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
      if (mi >= 0) found.push({ y: m[3] ? Number(m[3]) : now.getFullYear(), m: mi, d: Number(m[2]) });
    }
    const numeric = sentence.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g);
    for (const m of numeric) {
      const mm = Number(m[1]) - 1;
      const dd = Number(m[2]);
      if (mm < 0 || mm > 11 || dd < 1 || dd > 31) continue;
      const yy = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : now.getFullYear();
      found.push({ y: yy, m: mm, d: dd });
    }
    for (const f of found) {
      let year = f.y;
      // A date that already passed this year with no year given probably means next year.
      const candidate = new Date(year, f.m, f.d);
      if (candidate.getTime() < now.getTime() - 86400000 * 30 && !/\d{4}/.test(sentence)) year += 1;
      const date = iso(year, f.m, f.d);
      if (seen.has(date)) continue;
      seen.add(date);
      const what = sentence.match(keyword)?.[0] ?? 'Due';
      const label = sentence
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      out.push({ label: what.charAt(0).toUpperCase() + what.slice(1), date, context: label });
    }
  }
  return out.slice(0, 8);
}

/** Injected into every page: pulls readable text and reports it back. */
export const EXTRACT_JS = `
(function(){
  try {
    function visible(el){
      var s = window.getComputedStyle(el);
      return s && s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0.05 && parseFloat(s.fontSize || '12') > 2;
    }
    var hidden = [];
    var all = document.body ? document.body.querySelectorAll('*') : [];
    for (var i = 0; i < all.length && i < 4000; i++) {
      var el = all[i];
      if (el.children.length === 0 && el.textContent && el.textContent.trim().length > 20 && !visible(el)) {
        hidden.push(el.textContent.trim().slice(0, 300));
      }
    }
    var text = document.body ? document.body.innerText : '';
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'page',
      title: document.title,
      url: location.href,
      text: text.slice(0, 40000),
      hidden: hidden.slice(0, 20)
    }));
  } catch (e) {}
})();
true;
`;
