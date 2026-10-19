/**
 * Passkeys on the website. The browser makes or uses the passkey; Eternity's
 * server checks it and returns a one-time Firebase sign-in token.
 */
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { signInWithCustomToken } from 'firebase/auth';
import { getIdToken } from '@/firebase/auth';
import { auth, FUNCTIONS_BASE } from '@/firebase/config';

export const passkeysSupported = (): boolean => {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
};

async function call<T>(fn: string, body: unknown, withAuth: boolean): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const token = await getIdToken();
    if (!token) throw new Error('Sign in first.');
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function friendly(e: unknown): Error {
  const name = (e as { name?: string }).name;
  if (name === 'NotAllowedError' || name === 'AbortError') return new Error('cancelled');
  if (name === 'InvalidStateError') return new Error('This device already has a passkey for your account.');
  return e instanceof Error ? e : new Error('That passkey didn’t work.');
}

/** Adds a passkey to the signed-in account. */
export async function addPasskey(name = 'Passkey'): Promise<void> {
  const { options } = await call<{ options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('passkeyRegisterStart', {}, true);
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (e) {
    throw friendly(e);
  }
  await call('passkeyRegisterFinish', { response, name }, true);
}

/** Signs in with any passkey saved for Eternity. */
export async function signInWithPasskey(): Promise<void> {
  const { options, ticket } = await call<{ options: Parameters<typeof startAuthentication>[0]['optionsJSON']; ticket: string }>('passkeyLoginStart', {}, false);
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (e) {
    throw friendly(e);
  }
  const { token } = await call<{ token: string }>('passkeyLoginFinish', { ticket, response }, false);
  await signInWithCustomToken(auth, token);
}
