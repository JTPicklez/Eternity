import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from './config';

export async function signUpWithEmail(email: string, password: string, firstName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (firstName.trim()) await updateProfile(cred.user, { displayName: firstName.trim() });
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signInWithGoogleIdToken(idToken: string, accessToken?: string) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const cred = await signInWithCredential(auth, credential);
  return cred.user;
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim());

export const logOut = () => signOut(auth);

export async function deleteAccount() {
  if (auth.currentUser) await deleteUser(auth.currentUser);
}

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/** Friendly words for Firebase's error codes. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return "That email doesn't look right.";
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return "That email and password don't match.";
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in.';
    case 'auth/weak-password':
      return 'Use at least 6 characters for your password.';
    case 'auth/too-many-requests':
      return 'Too many tries. Give it a minute.';
    case 'auth/network-request-failed':
      return "Can't reach the internet right now.";
    default:
      return 'Something went wrong. Try again.';
  }
}
