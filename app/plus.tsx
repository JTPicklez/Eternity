import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { buyPlan, FALLBACK_PLANS, getPlans, purchasesAvailable, restorePurchases, type Plan } from '@/lib/purchases';
import { useFamily, useHead } from '@/lib/store';
import type { Tier } from '@/lib/types';
import { Pebble } from '@/components/Pebble';
import { Badge, Btn, haptic, IconBtn, PressScale, Row, Screen, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';
import { carved } from '@/theme/tokens';

const FEATURES: Record<Exclude<Tier, 'free'>, string[]> = {
  plus: ['All 10 seats in the loop', '300 messages a day, sharper models for planning', 'Unlimited routines', '5 errands a day', 'WHOOP, Oura, YouTube, Stripe and more', 'No ads'],
  pro: ['Everything in Plus', '1,000 messages a day, the deepest model for big plans', '30 errands a day', '10 hours of Workbench computers a month', 'Watch live and take the wheel'],
  founding: ['Everything in Plus, for $4.99 a month for life', 'Gold leaf finish for every teammate', 'Your name in the founding families list', 'Only for the first 500 families'],
};

const FREE = ['Aibram plus 2 teammates', '20 messages a day', '2 routines', 'One small ad, never personalized'];

export default function PlusScreen() {
  const p = useTheme();
  const head = useHead();
  const tier = useFamily((s) => s.settings.tier);
  const setSettings = useFamily((s) => s.setSettings);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [pick, setPick] = useState<string>(FALLBACK_PLANS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getPlans().then((ps) => {
      setPlans(ps);
      if (ps[0]) setPick(ps[0].id);
    });
  }, []);

  const chosen = plans.find((x) => x.id === pick) ?? plans[0];

  const buy = async () => {
    setError('');
    if (!purchasesAvailable) {
      if (__DEV__) {
        setSettings({ tier: chosen.tier });
        toast(`Preview: ${chosen.title} unlocked on this device for testing.`);
        router.back();
        return;
      }
      setError('Purchases are not set up in this build yet.');
      return;
    }
    setBusy(true);
    const r = await buyPlan(chosen.id);
    setBusy(false);
    if (r.ok && r.tier) {
      setSettings({ tier: r.tier });
      haptic('success');
      toast(`Welcome to ${chosen.title}.`, undefined, head.color);
      router.back();
    } else if (!r.cancelled) setError(r.error ?? 'The purchase did not go through.');
  };

  return (
    <Screen
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18, gap: 8, borderTopWidth: 1.5, borderTopColor: p.line, backgroundColor: p.bg }}>
          {error ? (
            <Txt variant="small" color={p.danger} center>
              {error}
            </Txt>
          ) : null}
          <Btn
            title={tier === chosen.tier ? "You're on this plan" : `Start ${chosen.title} · ${chosen.price}/${chosen.period === 'year' ? 'yr' : 'mo'}`}
            variant="signal"
            full
            loading={busy}
            disabled={tier === chosen.tier}
            onPress={buy}
          />
          <Row justify="center" gap={18}>
            <Btn
              title="Restore purchases"
              small
              variant="quiet"
              onPress={async () => {
                const t = await restorePurchases();
                if (t && t !== 'free') {
                  setSettings({ tier: t });
                  toast('Restored.');
                } else toast('Nothing to restore on this Apple ID.');
              }}
            />
          </Row>
          <Txt variant="tiny" center>
            Monthly, cancel anytime in Settings. Payment is charged to your Apple ID.
          </Txt>
        </View>
      }
    >
      <Row justify="flex-end">
        <IconBtn icon="close" label="Close" onPress={() => router.back()} />
      </Row>
      <View style={{ alignItems: 'center' }}>
        <Animated.View entering={ZoomIn.springify()}>
          <Pebble shape={head.shape} color={head.color} mark={head.mark} finish={chosen.tier === 'founding' ? 'gold' : 'glow'} size={96} />
        </Animated.View>
        <Txt variant="title" center style={{ marginTop: 14 }}>
          A bigger family. A lighter load.
        </Txt>
        <Txt variant="body" center style={{ marginTop: 6, maxWidth: 320 }}>
          Fill every seat, hand off errands, and let your family take more off your plate.
        </Txt>
      </View>

      <View style={{ marginTop: 20, gap: 10 }}>
        {plans.map((pl, i) => {
          const on = pick === pl.id;
          const gold = pl.tier === 'founding';
          return (
            <Animated.View key={pl.id} entering={FadeInDown.delay(i * 70)}>
              <PressScale onPress={() => setPick(pl.id)} accessibilityRole="radio" accessibilityLabel={`${pl.title}, ${pl.price} per ${pl.period}`}>
                <View
                  style={[
                    carved[i % 4],
                    {
                      padding: 16,
                      backgroundColor: on ? (gold ? '#2A2416' : p.stone) : p.card,
                      borderWidth: 2,
                      borderColor: on ? (gold ? '#D4AF5A' : p.stone) : 'transparent',
                      boxShadow: on ? undefined : `0px 3px 0px ${p.shadow}`,
                    },
                  ]}
                >
                  <Row justify="space-between">
                    <Row gap={8}>
                      <Txt variant="h3" color={on ? (gold ? '#F6E3A1' : p.onStone) : undefined}>
                        {pl.title}
                      </Txt>
                      {pl.tier === 'plus' && <Badge text="Most families" color={on ? p.signal : p.card2} textColor={on ? p.onSignal : p.text} />}
                      {gold && <Badge text="First 500" color="#D4AF5A" textColor="#1E2023" />}
                    </Row>
                    <Txt variant="h3" color={on ? (gold ? '#F6E3A1' : p.onStone) : undefined}>
                      {pl.price}
                      <Txt variant="tiny" color={on ? (gold ? '#D4AF5A' : p.onStoneMuted) : p.muted}>
                        /{pl.period === 'year' ? 'yr' : 'mo'}
                      </Txt>
                    </Txt>
                  </Row>
                  {(FEATURES[pl.tier as Exclude<Tier, 'free'>] ?? []).map((f) => (
                    <Row key={f} gap={8} style={{ marginTop: 8 }}>
                      <Ionicons name="checkmark" size={15} color={on ? (gold ? '#D4AF5A' : p.mode === 'paper' ? '#5CC8F2' : '#1E5BD2') : p.success} />
                      <Txt variant="small" color={on ? (gold ? '#EFE6CF' : p.onStoneMuted) : p.text2} style={{ flex: 1 }}>
                        {f}
                      </Txt>
                    </Row>
                  ))}
                </View>
              </PressScale>
            </Animated.View>
          );
        })}
      </View>

      <View style={{ marginTop: 16, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: p.line }}>
        <Txt variant="label">Free, forever</Txt>
        {FREE.map((f) => (
          <Txt key={f} variant="small" style={{ marginTop: 6 }}>
            · {f}
          </Txt>
        ))}
      </View>
      {!purchasesAvailable && __DEV__ && (
        <Txt variant="tiny" center style={{ marginTop: 12 }}>
          Development build: RevenueCat keys aren't set, so this unlocks the plan locally for testing.
        </Txt>
      )}
    </Screen>
  );
}
