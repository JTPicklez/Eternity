/**
 * RevenueCat on iOS and Android. Entitlements: "plus" and "pro".
 * Founding Crews buy a product that grants "plus" for life at $4.99.
 */
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { CONFIG } from './config';
import type { Tier } from './types';
import { FALLBACK_PLANS, type Plan } from './purchases.shared';

export { FALLBACK_PLANS, type Plan };

// Keys live in lib/config.ts. Create a new app for Eternity in RevenueCat;
// Aibram's key belongs to Aibram's bundle id, so it can't be reused.
const IOS_KEY = CONFIG.revenuecat.ios;
const ANDROID_KEY = CONFIG.revenuecat.android;

const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
export const purchasesAvailable = !!apiKey;

let configured = false;
let packages: Record<string, PurchasesPackage> = {};

function tierFromInfo(info: CustomerInfo): Tier {
  const active = info.entitlements.active;
  if (active.pro) return 'pro';
  if (active.plus) return /founding/i.test(active.plus.productIdentifier) ? 'founding' : 'plus';
  return 'free';
}

function tierFromProduct(id: string): Tier {
  if (/founding/i.test(id)) return 'founding';
  if (/pro/i.test(id)) return 'pro';
  return 'plus';
}

export async function configurePurchases(uid?: string | null): Promise<void> {
  if (!apiKey) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey, appUserID: uid ?? undefined });
      configured = true;
    } else if (uid) {
      await Purchases.logIn(uid);
    }
  } catch {
    /* store unavailable; the app keeps working on Free */
  }
}

export async function currentTier(): Promise<Tier | null> {
  if (!configured) return null;
  try {
    return tierFromInfo(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

export async function getPlans(): Promise<Plan[]> {
  if (!configured) return FALLBACK_PLANS;
  try {
    const offerings = await Purchases.getOfferings();
    const list = offerings.current?.availablePackages ?? [];
    if (!list.length) return FALLBACK_PLANS;
    packages = {};
    return list.map((p) => {
      packages[p.product.identifier] = p;
      return {
        id: p.product.identifier,
        tier: tierFromProduct(p.product.identifier),
        title: p.product.title || p.product.identifier,
        price: p.product.priceString,
        period: p.packageType === 'ANNUAL' ? 'year' : 'month',
      } satisfies Plan;
    });
  } catch {
    return FALLBACK_PLANS;
  }
}

export async function buyPlan(id: string): Promise<{ ok: boolean; tier?: Tier; cancelled?: boolean; error?: string }> {
  if (!configured) return { ok: false, error: 'Purchases are not set up in this build yet.' };
  const pkg = packages[id];
  if (!pkg) return { ok: false, error: 'That plan is not available right now.' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, tier: tierFromInfo(customerInfo) };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: err.message ?? 'The purchase did not go through.' };
  }
}

export async function restorePurchases(): Promise<Tier | null> {
  if (!configured) return null;
  try {
    return tierFromInfo(await Purchases.restorePurchases());
  } catch {
    return null;
  }
}
