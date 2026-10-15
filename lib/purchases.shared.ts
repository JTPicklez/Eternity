import type { Tier } from './types';

export interface Plan {
  id: string;
  tier: Tier;
  title: string;
  price: string;
  period: 'month' | 'year';
}

/** Shown when the store can't be reached (and on web). Real prices come from the App Store. */
export const FALLBACK_PLANS: Plan[] = [
  { id: 'eternity_plus_monthly', tier: 'plus', title: 'Eternity Plus', price: '$6.99', period: 'month' },
  { id: 'eternity_pro_monthly', tier: 'pro', title: 'Eternity Pro', price: '$14.99', period: 'month' },
  { id: 'eternity_founding_monthly', tier: 'founding', title: 'Founding Family', price: '$4.99', period: 'month' },
];

