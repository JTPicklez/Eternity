/**
 * Passkeys. On the website they sign you in with Face ID, Touch ID or a
 * security key (passkeys.web.ts). On iPhone the app uses your Apple or email
 * sign-in for now; passkeys there need a newer build.
 */
export const passkeysSupported = (): boolean => false;

export async function addPasskey(_name?: string): Promise<void> {
  throw new Error('Add a passkey from the Eternity website.');
}

export async function signInWithPasskey(): Promise<void> {
  throw new Error('Passkeys work on the Eternity website for now.');
}
