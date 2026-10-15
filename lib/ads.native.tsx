/**
 * AdMob, non-personalized only. Eternity never shares what's in your family
 * with an ad network: ads don't get your chats, your calendar or your
 * interests, and requestNonPersonalizedAdsOnly keeps targeting off.
 *
 * The module is loaded lazily so the app still runs where AdMob's native code
 * isn't available (Expo Go, simulators without it): ads just don't show.
 */
import React from 'react';
import { View } from 'react-native';
import type * as AdsModule from 'react-native-google-mobile-ads';
import type { Tier } from './types';

type Ads = typeof AdsModule;

let ads: Ads | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ads = require('react-native-google-mobile-ads') as Ads;
} catch {
  ads = null;
}

// Paste Eternity's real ad unit IDs from AdMob before release. Until then,
// and always in development, Google's test units are used.
// (Aibram's units are tied to Aibram's app, so they can't be reused.)
const REAL_BANNER_ID = '';
const REAL_REWARDED_ID = '';

const REQUEST = { requestNonPersonalizedAdsOnly: true };

function bannerId() {
  return !__DEV__ && REAL_BANNER_ID ? REAL_BANNER_ID : (ads?.TestIds.ADAPTIVE_BANNER ?? '');
}

function rewardedId() {
  return !__DEV__ && REAL_REWARDED_ID ? REAL_REWARDED_ID : (ads?.TestIds.REWARDED ?? '');
}

let initialized = false;
export async function initAds(): Promise<void> {
  if (initialized || !ads) return;
  initialized = true;
  try {
    await ads.default().initialize();
  } catch {
    /* ads are optional */
  }
}

export function AdBanner({ tier }: { tier: Tier }) {
  if (tier !== 'free' || !ads) return null;
  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={{ alignItems: 'center', marginTop: 16 }}>
      <BannerAd unitId={bannerId()} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={REQUEST} />
    </View>
  );
}

export const rewardedAvailable = !!ads;

export function showRewarded(): Promise<boolean> {
  const mod = ads;
  if (!mod) return Promise.resolve(false);
  return new Promise((resolve) => {
    let earned = false;
    let done = false;
    const ad = mod.RewardedAd.createForAdRequest(rewardedId(), REQUEST);
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      unsubs.forEach((u) => u());
      resolve(v);
    };
    const unsubs = [
      ad.addAdEventListener(mod.RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => finish(false));
      }),
      ad.addAdEventListener(mod.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(mod.AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(mod.AdEventType.ERROR, () => finish(false)),
    ];
    ad.load();
    setTimeout(() => finish(earned), 60_000);
  });
}
