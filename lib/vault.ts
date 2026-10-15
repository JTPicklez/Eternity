/**
 * The Vault: on-phone encryption for everything Eternity saves.
 *
 * Chats, memory, the Charter and receipts are encrypted with a random key
 * that lives in the iPhone Keychain (expo-secure-store). What lands in
 * storage is ciphertext, and nothing in this file ever sends the key or the
 * plaintext anywhere. Algorithm: XSalsa20-Poly1305 (tweetnacl secretbox).
 */
import nacl from 'tweetnacl';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

const KEY_NAME = 'eternity.vault.key.v1';

// tweetnacl needs a secure random source. Hermes doesn't always expose
// crypto.getRandomValues, so feed it from expo-crypto instead.
nacl.setPRNG((x: Uint8Array, n: number) => {
  const r = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = r[i];
});

// ── tiny encoders (no extra dependencies) ─────────────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return new Uint8Array(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    let code: number;
    if (b < 0x80) code = b;
    else if (b < 0xe0) code = ((b & 31) << 6) | (bytes[i++] & 63);
    else if (b < 0xf0) code = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else code = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 1023));
    } else out += String.fromCharCode(code);
  }
  return out;
}

// ── key management ────────────────────────────────────────────────────────
let cachedKey: Uint8Array | null = null;

async function readKey(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(KEY_NAME) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY_NAME);
}

async function writeKey(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(KEY_NAME, value);
    } catch {
      /* private mode: key lives in memory only */
    }
    return;
  }
  await SecureStore.setItemAsync(KEY_NAME, value);
}

export async function getVaultKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;
  const existing = await readKey();
  if (existing) {
    cachedKey = fromBase64(existing);
    return cachedKey;
  }
  const fresh = nacl.randomBytes(nacl.secretbox.keyLength);
  await writeKey(toBase64(fresh));
  cachedKey = fresh;
  return fresh;
}

/** Destroys the key. Anything encrypted with it can never be read again. */
export async function destroyVaultKey(): Promise<void> {
  cachedKey = null;
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(KEY_NAME);
    } catch {
      /* nothing to remove */
    }
    return;
  }
  await SecureStore.deleteItemAsync(KEY_NAME);
}

/** A human-friendly recovery key, shown once on the Trust screen. */
export async function getRecoveryKey(): Promise<string> {
  const key = await getVaultKey();
  const hex = Array.from(key)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return hex.match(/.{1,8}/g)?.join('-') ?? hex;
}

export async function encryptString(plain: string): Promise<string> {
  const key = await getVaultKey();
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(utf8Encode(plain), nonce, key);
  return JSON.stringify({ v: 1, n: toBase64(nonce), c: toBase64(box) });
}

export async function decryptString(blob: string): Promise<string | null> {
  try {
    const parsed = JSON.parse(blob) as { v: number; n: string; c: string };
    if (parsed.v !== 1) return null;
    const key = await getVaultKey();
    const opened = nacl.secretbox.open(fromBase64(parsed.c), fromBase64(parsed.n), key);
    return opened ? utf8Decode(opened) : null;
  } catch {
    return null;
  }
}

/**
 * Zustand storage adapter: everything persisted goes through the Vault.
 * Writes are batched (a burst of changes becomes one encrypted write).
 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();

// During web pre-rendering there is no browser storage at all.
const noStorage = Platform.OS === 'web' && typeof window === 'undefined';

export const vaultStorage: StateStorage = {
  getItem: async (name) => {
    if (noStorage) return null;
    const blob = await AsyncStorage.getItem(name);
    if (!blob) return null;
    return decryptString(blob);
  },
  setItem: (name, value) => {
    if (noStorage) return;
    const prior = pending.get(name);
    if (prior) clearTimeout(prior);
    pending.set(
      name,
      setTimeout(() => {
        pending.delete(name);
        encryptString(value)
          .then((blob) => AsyncStorage.setItem(name, blob))
          .catch(() => {});
      }, 350),
    );
  },
  removeItem: async (name) => {
    const prior = pending.get(name);
    if (prior) clearTimeout(prior);
    pending.delete(name);
    if (noStorage) return;
    await AsyncStorage.removeItem(name);
  },
};
