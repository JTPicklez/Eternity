/**
 * Plans and purchases on the website, through RevenueCat Web Billing (which
 * runs on Stripe). purchases.native.ts is what iOS and Android use. Keep their
 * exports identical. A plan bought on the web or on iPhone is the same plan:
 * RevenueCat tells Eternity's server, and the server decides your tier.
 */
import { ErrorCode, Purchases, PurchasesError, type CustomerInfo, type Package } from '@revenuecat/purchases-js';
import { CONFIG } from './config';
import type { Tier } from './types';
import { FALLBACK_PLANS, type Plan } from './purchases.shared';

export { FALLBACK_PLANS, type Plan };

const WEB_KEY = CONFIG.revenuecat.web;
export const purchasesAvailable = !!WEB_KEY;

let instance: Purchases | null = null;
let packages: Record<string, Package> = {};

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

/** Web Billing needs a real account, so this waits for a signed-in uid. */
export async function configurePurchases(uid?: string | null): Promise<void> {
  if (!WEB_KEY || !uid) return;
  try {
    if (!instance) instance = Purchases.configure({ apiKey: WEB_KEY, appUserId: uid });
    else await instance.changeUser(uid);
  } catch {
    instance = null;
  }
}

export async function currentTier(): Promise<Tier | null> {
  if (!instance) return null;
  try {
    return tierFromInfo(await instance.getCustomerInfo());
  } catch {
    return null;
  }
}

export async function getPlans(): Promise<Plan[]> {
  if (!instance) return FALLBACK_PLANS;
  try {
    const offerings = await instance.getOfferings();
    const list = offerings.current?.availablePackages ?? [];
    if (!list.length) return FALLBACK_PLANS;
    packages = {};
    return list.map((p) => {
      const product = p.webBillingProduct;
      packages[product.identifier] = p;
      return {
        id: product.identifier,
        tier: tierFromProduct(product.identifier),
        title: product.title || product.identifier,
        price: product.currentPrice.formattedPrice,
        period: /Y/.test(product.normalPeriodDuration ?? '') ? 'year' : 'month',
      } satisfies Plan;
    });
  } catch {
    return FALLBACK_PLANS;
  }
}

export async function buyPlan(id: string): Promise<{ ok: boolean; tier?: Tier; cancelled?: boolean; error?: string }> {
  if (!WEB_KEY) return { ok: false, error: 'Web checkout is not set up yet. You can subscribe in the iPhone app.' };
  if (!instance) return { ok: false, error: 'Sign in to your account first, then pick a plan.' };
  const rcPackage = packages[id];
  if (!rcPackage) return { ok: false, error: 'That plan is not available right now.' };
  try {
    const { customerInfo } = await instance.purchase({ rcPackage });
    return { ok: true, tier: tierFromInfo(customerInfo) };
  } catch (e) {
    if (e instanceof PurchasesError && e.errorCode === ErrorCode.UserCancelledError) return { ok: false, cancelled: true };
    return { ok: false, error: (e as Error).message || 'The purchase did not go through.' };
  }
}

/** On the web, your plan follows your account, so restoring is just a refresh. */
export async function restorePurchases(): Promise<Tier | null> {
  return currentTier();
}
