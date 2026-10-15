/**
 * Ads (web build: none). ads.native.tsx is the iOS/Android version.
 * Free plans see one small, non-personalized banner. Paid plans see none.
 */
import React from 'react';
import type { Tier } from './types';

export async function initAds(): Promise<void> {}

export function AdBanner(_props: { tier: Tier }): React.ReactElement | null {
  return null;
}

export const rewardedAvailable = false;

/** Shows a short ad; resolves true if the person watched it through. */
export async function showRewarded(): Promise<boolean> {
  return false;
}
