/**
 * Firebase, shared with Aibram (project aibram-9c44f). Eternity only uses it
 * for sign-in and to call the Cloud Functions. Chats and memory never go to
 * Firestore; they stay encrypted on the phone.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// These values are public by design (they identify the project, they don't grant access).
const firebaseConfig = {
  apiKey: 'AIzaSyDnc29fCjzhM2VV_8UltTTgvEQE-tCsZ6A',
  authDomain: 'aibram-9c44f.firebaseapp.com',
  projectId: 'aibram-9c44f',
  storageBucket: 'aibram-9c44f.firebasestorage.app',
  messagingSenderId: '430696585996',
  appId: '1:430696585996:web:9c0e5a5003dd1d18cdc729',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// getReactNativePersistence only exists in Firebase's React Native build, which
// Metro picks on iOS and Android. TypeScript reads the web types, so load it here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

function makeAuth(): Auth {
  if (Platform.OS === 'web') return getAuth(app);
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast refresh: auth was already initialized.
    return getAuth(app);
  }
}

export const auth = makeAuth();

export const FUNCTIONS_BASE = 'https://us-central1-aibram-9c44f.cloudfunctions.net';
