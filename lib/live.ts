/**
 * Live data from Aibram's existing Cloud Functions (already deployed in the
 * shared Firebase project): real leave-by times and local news.
 */
import * as Location from 'expo-location';
import { getIdToken } from '@/firebase/auth';
import { FUNCTIONS_BASE } from '@/firebase/config';

const ETA_URL = `${FUNCTIONS_BASE}/getETA`;
const NEWS_URL = `${FUNCTIONS_BASE}/getMorningNews`;

let cachedOrigin: { at: number; value: string } | null = null;

async function origin(): Promise<string | null> {
  if (cachedOrigin && Date.now() - cachedOrigin.at < 10 * 60_000) return cachedOrigin.value;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getLastKnownPositionAsync();
    if (!pos) return null;
    const value = `${pos.coords.latitude},${pos.coords.longitude}`;
    cachedOrigin = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}

export async function askForLocation(): Promise<boolean> {
  try {
    const r = await Location.requestForegroundPermissionsAsync();
    return r.status === 'granted';
  } catch {
    return false;
  }
}

export async function fetchEta(destination: string): Promise<{ minutes: number; distance: string } | null> {
  try {
    const [token, from] = await Promise.all([getIdToken(), origin()]);
    if (!token || !from || !destination) return null;
    const res = await fetch(ETA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ origin: from, destination }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; durationMin?: number; distanceText?: string };
    if (!data.ok || !data.durationMin) return null;
    return { minutes: data.durationMin, distance: data.distanceText ?? '' };
  } catch {
    return null;
  }
}

export interface NewsItem {
  title: string;
  snippet?: string;
  url?: string;
  source?: string;
}

export async function fetchNews(query = 'top news today'): Promise<NewsItem[] | null> {
  try {
    const token = await getIdToken();
    if (!token) return null;
    const res = await fetch(NEWS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: NewsItem[] };
    return data.results ?? null;
  } catch {
    return null;
  }
}
