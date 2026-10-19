/**
 * Ads on the website: one small AdSense unit for free plans, requested as
 * non-personalized every time. ads.native.tsx is the iOS/Android version.
 * Nothing shows until an AdSense client and slot are set in lib/config.ts.
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { CONFIG } from './config';
import type { Tier } from './types';

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number };
  }
}

let scriptAdded = false;

function addScript() {
  if (scriptAdded || typeof document === 'undefined' || !CONFIG.adsense.client) return;
  scriptAdded = true;
  window.adsbygoogle = window.adsbygoogle || [];
  // Non-personalized only, set before any ad is requested.
  window.adsbygoogle.requestNonPersonalizedAds = 1;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CONFIG.adsense.client)}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

export async function initAds(): Promise<void> {
  addScript();
}

export function AdBanner({ tier }: { tier: Tier }): React.ReactElement | null {
  const pushed = useRef(false);
  const on = tier === 'free' && !!CONFIG.adsense.client && !!CONFIG.adsense.slot;
  useEffect(() => {
    if (!on || pushed.current) return;
    pushed.current = true;
    addScript();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blockers and slow loads are fine */
    }
  }, [on]);
  if (!on) return null;
  return (
    <View style={{ alignItems: 'center', marginTop: 16, minHeight: 60 }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', maxWidth: 728, minHeight: 60 }}
        data-ad-client={CONFIG.adsense.client}
        data-ad-slot={CONFIG.adsense.slot}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </View>
  );
}

export const rewardedAvailable = false;

/** Rewarded ads are phone-only. */
export async function showRewarded(): Promise<boolean> {
  return false;
}
