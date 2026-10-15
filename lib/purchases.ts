/**
 * Plans and purchases. This file is the web build (purchases are off on web);
 * purchases.native.ts is what iOS and Android use. Keep their exports identical.
 */
import type { Tier } from './types';
import { FALLBACK_PLANS, type Plan } from './purchases.shared';

export { FALLBACK_PLANS, type Plan };

export const purchasesAvailable = false;

export async function configurePurchases(_uid?: string | null): Promise<void> {}

export async function currentTier(): Promise<Tier | null> {
  return null;
}

export async function getPlans(): Promise<Plan[]> {
  return FALLBACK_PLANS;
}

export async function buyPlan(_id: string): Promise<{ ok: boolean; tier?: Tier; cancelled?: boolean; error?: string }> {
  return { ok: false, error: 'Purchases happen in the iPhone app.' };
}

export async function restorePurchases(): Promise<Tier | null> {
  return null;
}
