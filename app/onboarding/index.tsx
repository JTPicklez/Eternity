import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import { useFamily, useHead } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { Typewriter } from '@/components/Typewriter';
import { Btn, Field, haptic, Screen, Spacer, Txt } from '@/components/ui';
import { Steps } from '@/components/Steps';
import { useTheme } from '@/theme/ThemeProvider';

function WaterLine({ width }: { width: number }) {
  const p = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(500, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1));
  }, [t]);
  const a = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ scaleX: 0.4 + t.value * 0.9 }, { scaleY: 0.4 + t.value * 0.9 }] }));
  return (
    <Animated.View style={[{ position: 'absolute', bottom: -6, width, height: 40, alignItems: 'center' }, a]} pointerEvents="none">
      <Svg width={width} height={40} viewBox="0 0 300 40">
        <Ellipse cx={150} cy={20} rx={140} ry={16} fill="none" stroke={p.glow} strokeWidth={2} />
        <Ellipse cx={150} cy={20} rx={90} ry={10} fill="none" stroke={p.glow} strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );
}

export default function Welcome() {
  const p = useTheme();
  const head = useHead();
  const firstName = useFamily((s) => s.firstName);
  const setProfile = useFamily((s) => s.setProfile);
  const [name, setName] = useState(firstName);
  const [stage, setStage] = useState(0);

  const rise = useSharedValue(140);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    rise.value = withDelay(250, withSpring(0, { damping: 9, stiffness: 70 }));
    const t = setTimeout(() => haptic('medium'), 700);
    return () => clearTimeout(t);
  }, [rise, opacity]);
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }], opacity: opacity.value }));

  const greeting = firstName ? `Hey ${firstName}. I'm ${head.name}.` : `Hey there. I'm ${head.name}.`;

  return (
    <Screen>
      <Steps step={0} back={false} />
      <View style={{ alignItems: 'center', marginTop: 24, height: 190, justifyContent: 'flex-end', overflow: 'visible' }}>
        <WaterLine width={300} />
        <Animated.View style={riseStyle}>
          <MemberPebble member={head} size={150} finish="glow" />
        </Animated.View>
      </View>
      <Spacer h={28} />
      <Typewriter text={greeting} variant="title" onDone={() => setStage(1)} />
      {stage >= 1 && (
        <Typewriter
          text="I'll be the head of your family: a small team of AI teammates who plan, prep and take work off your plate so you can go after the big stuff."
          variant="body"
          style={{ marginTop: 12 }}
          delay={250}
          onDone={() => setStage(2)}
        />
      )}
      {stage >= 2 && (
        <Typewriter
          text="Nothing gets sent, booked or paid for without your tap. Ever."
          variant="bodyStrong"
          style={{ marginTop: 12 }}
          delay={200}
          onDone={() => setStage(3)}
        />
      )}
      {stage >= 3 && (
        <Animated.View entering={FadeInDown.duration(500)} style={{ marginTop: 26, gap: 12 }}>
          {!firstName && <Field label="What should we call you?" placeholder="First name" value={name} onChangeText={setName} autoFocus />}
          <Btn
            title="Let's build it"
            variant="signal"
            full
            iconRight="arrow-forward"
            onPress={() => {
              if (!firstName && name.trim()) setProfile({ firstName: name.trim().split(' ')[0] });
              router.push('/onboarding/chasing');
            }}
          />
        </Animated.View>
      )}
      {stage < 3 && (
        <Animated.View entering={FadeIn.delay(1500)} style={{ marginTop: 24, alignItems: 'center' }}>
          <Btn title="Skip ahead" variant="quiet" small onPress={() => setStage(3)} />
        </Animated.View>
      )}
      <Txt variant="tiny" center style={{ marginTop: 30 }} color={p.muted}>
        Takes about a minute.
      </Txt>
    </Screen>
  );
}
