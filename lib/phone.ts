/**
 * Things that live on the phone itself: the calendars synced to it, the
 * weather where you are, your contacts, and the Messages and Mail
 * composers. None of these need an account, only a permission.
 */
import { Linking, Platform, Share } from 'react-native';
import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import { clockAmPm, isoDate } from './dates';
import { useCrew } from './store';

// ── calendar ────────────────────────────────────────────────────────────────
export async function allowCalendar(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const r = await Calendar.requestCalendarPermissionsAsync();
    return r.status === 'granted';
  } catch {
    return false;
  }
}

export async function readPhoneCalendar(days = 3) {
  if (Platform.OS === 'web') return [];
  const perm = await Calendar.getCalendarPermissionsAsync();
  if (perm.status !== 'granted') return [];
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const start = new Date();
  const end = new Date(Date.now() + days * 86_400_000);
  const events = await Calendar.getEventsAsync(
    cals.map((c) => c.id),
    start,
    end,
  );
  return events
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 40)
    .map((e) => ({ title: e.title, start: new Date(e.startDate).toISOString(), end: new Date(e.endDate).toISOString(), where: e.location || undefined, allDay: e.allDay }));
}

// ── weather (Open-Meteo, free, no key) ──────────────────────────────────────
const CODES: [number[], string][] = [
  [[0], 'clear'],
  [[1, 2], 'partly cloudy'],
  [[3], 'cloudy'],
  [[45, 48], 'foggy'],
  [[51, 53, 55, 56, 57], 'drizzly'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'rainy'],
  [[71, 73, 75, 77, 85, 86], 'snowy'],
  [[95, 96, 99], 'stormy'],
];
const sky = (code: number) => CODES.find(([list]) => list.includes(code))?.[1] ?? 'mixed';

export async function readWeather(): Promise<string | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!pos) return null;
    const q = new URLSearchParams({
      latitude: pos.coords.latitude.toFixed(3),
      longitude: pos.coords.longitude.toFixed(3),
      current: 'temperature_2m,weather_code,wind_speed_10m',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      timezone: 'auto',
      forecast_days: '2',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
    if (!res.ok) return null;
    const d = (await res.json()) as {
      current: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
      daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; weather_code: number[] };
    };
    const now = `${Math.round(d.current.temperature_2m)}°F and ${sky(d.current.weather_code)} now`;
    const today = `today ${Math.round(d.daily.temperature_2m_min[0])} to ${Math.round(d.daily.temperature_2m_max[0])}°F, ${d.daily.precipitation_probability_max[0]}% chance of rain`;
    const tomorrow = `tomorrow ${sky(d.daily.weather_code[1])}, high ${Math.round(d.daily.temperature_2m_max[1])}°F`;
    return `${now}, ${today}, ${tomorrow}.`;
  } catch {
    return null;
  }
}

/** Refreshes what teammates know from the phone. Cheap; safe to call often. */
export async function refreshPhone(force = false) {
  const st = useCrew.getState();
  if (!force && Date.now() - st.phone.at < 15 * 60_000) return;
  const on = st.connected;
  const [events, weather] = await Promise.all([
    on.includes('phone-calendar') ? readPhoneCalendar().catch(() => []) : Promise.resolve([]),
    on.includes('weather') ? readWeather() : Promise.resolve(null),
  ]);
  st.setPhone({ events, weather: weather ?? undefined });
}

/** Short lines for a teammate's context. */
export function phoneContext(): string[] {
  const { phone, connected } = useCrew.getState();
  const out: string[] = [];
  if (connected.includes('weather') && phone.weather) out.push(`Weather: ${phone.weather}`);
  if (connected.includes('phone-calendar')) {
    phone.events.slice(0, 15).forEach((e) => {
      const d = new Date(e.start);
      const day = isoDate(d) === isoDate() ? 'Today' : isoDate(d);
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      out.push(`Calendar: ${day} ${clockAmPm(hhmm)} ${e.title}${e.where ? ` at ${e.where}` : ''}`);
    });
  }
  return out;
}

// ── contacts ────────────────────────────────────────────────────────────────
export async function allowContacts(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const r = await Contacts.requestPermissionsAsync();
    return r.status === 'granted';
  } catch {
    return false;
  }
}

/** Finds a phone number or email for a name, if contacts access is on. */
export async function lookupContact(name: string): Promise<{ name: string; phone?: string; email?: string } | null> {
  if (Platform.OS === 'web' || !name.trim()) return null;
  try {
    const perm = await Contacts.getPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const { data } = await Contacts.getContactsAsync({ name: name.trim(), fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails] });
    const c = data[0];
    if (!c) return null;
    return { name: c.name, phone: c.phoneNumbers?.[0]?.number, email: c.emails?.[0]?.email };
  } catch {
    return null;
  }
}

// ── compose ─────────────────────────────────────────────────────────────────
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const looksLikePhone = (s: string) => /^[+()\d\s.-]{7,}$/.test(s.trim());

/**
 * Opens the phone's own composer with the draft filled in. The person taps
 * Send; Eternity never sends a text or email on its own.
 */
export async function openComposer(draft: { to: string; text: string; channel?: 'text' | 'email' | 'any'; subject?: string }): Promise<string> {
  let to = draft.to.trim();
  let channel = draft.channel ?? 'any';
  if (channel === 'any') channel = looksLikeEmail(to) ? 'email' : 'text';
  // A name like "Mom" becomes a number or email from Contacts, when allowed.
  if (to && !looksLikeEmail(to) && !looksLikePhone(to)) {
    const c = await lookupContact(to);
    if (c) to = channel === 'email' ? (c.email ?? to) : (c.phone ?? c.email ?? to);
  }

  if (channel === 'email') {
    if (Platform.OS !== 'web' && (await MailComposer.isAvailableAsync().catch(() => false))) {
      await MailComposer.composeAsync({ recipients: looksLikeEmail(to) ? [to] : [], subject: draft.subject ?? '', body: draft.text });
      return 'Opened in Mail. Sending is your tap.';
    }
    await Linking.openURL(`mailto:${looksLikeEmail(to) ? encodeURIComponent(to) : ''}?subject=${encodeURIComponent(draft.subject ?? '')}&body=${encodeURIComponent(draft.text)}`).catch(() => {});
    return 'Opened your mail app. Sending is your tap.';
  }

  if (Platform.OS !== 'web' && (await SMS.isAvailableAsync().catch(() => false))) {
    await SMS.sendSMSAsync(looksLikePhone(to) ? [to] : [], draft.text);
    return 'Opened in Messages. Sending is your tap.';
  }
  await Share.share({ message: draft.text }).catch(() => {});
  return 'Opened the share sheet. Pick where it goes.';
}
