/**
 * Flow: deep work with the Crew on watch. Sprints, breaks, ambient water
 * sounds, and teammates holding everything else until you surface.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { useCrew } from '@/lib/store';
import { MemberPebble } from '@/components/Pebble';
import { Btn, Chip, Field, haptic, IconBtn, Label, Row, Toggle, Txt } from '@/components/ui';
import { toast } from '@/components/Toast';
import { ink } from '@/theme/tokens';
import { ForceTheme } from '@/theme/ThemeProvider';

const rain = require('@/assets/sounds/rain.mp3');
const forest = require('@/assets/sounds/forest.mp3');

type Phase = 'setup' | 'sprint' | 'break' | 'done';

function Water({ progress, size }: { progress: number; size: number }) {
  const level = useSharedValue(0);
  const wave = useSharedValue(0);
  useEffect(() => {
    level.value = withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, level]);
  useEffect(() => {
    wave.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1);
  }, [wave]);
  const fill = useAnimatedStyle(() => ({ height: `${Math.max(4, level.value * 100)}%` }));
  const drift = useAnimatedStyle(() => ({ transform: [{ translateX: -wave.value * size }] }));
  const w = size * 2;
  const d = `M0 14 Q ${size / 4} 0 ${size / 2} 14 T ${size} 14 T ${size * 1.5} 14 T ${w} 14 V 40 H 0 Z`;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#1C2025', borderWidth: 2, borderColor: '#2A2F36' }}>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#1E5BD2' }, fill]}>
        <Animated.View style={[{ position: 'absolute', top: -13, left: 0, width: w, height: 40 }, drift]}>
          <Svg width={w} height={40} viewBox={`0 0 ${w} 40`}>
            <Path d={d} fill="#1E5BD2" />
          </Svg>
        </Animated.View>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 6, height: 2, backgroundColor: 'rgba(143,216,247,0.35)' }} />
      </Animated.View>
    </View>
  );
}

export default function Flow() {
  const params = useLocalSearchParams<{ task?: string; sprints?: string; minutes?: string; blockId?: string }>();
  const { width } = useWindowDimensions();
  const members = useCrew((s) => s.members);
  const settings = useCrew((s) => s.settings);
  const setSettings = useCrew((s) => s.setSettings);
  const logFlow = useCrew((s) => s.logFlow);
  const updateBlock = useCrew((s) => s.updateBlock);
  const addReceipt = useCrew((s) => s.addReceipt);
  const leadId = useCrew((s) => s.leadId);

  const [task, setTask] = useState(params.task ?? '');
  const [minutes, setMinutes] = useState(Number(params.minutes) || 50);
  const [sprints, setSprints] = useState(Number(params.sprints) || 4);
  const [shield, setShield] = useState({ chats: true, email: true });
  const [phase, setPhase] = useState<Phase>('setup');
  const [sprint, setSprint] = useState(1);
  const [left, setLeft] = useState(minutes * 60);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(0);
  const [worked, setWorked] = useState(0); // seconds, for display
  const workedRef = useRef(0);
  const heldRef = useRef(0);
  const endsAt = useRef<number>(0);

  const rainPlayer = useAudioPlayer(rain);
  const forestPlayer = useAudioPlayer(forest);
  const BREAK = minutes >= 90 ? 15 * 60 : minutes >= 50 ? 10 * 60 : 5 * 60;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    rainPlayer.loop = true;
    forestPlayer.loop = true;
    return () => {
      try {
        rainPlayer.pause();
        forestPlayer.pause();
      } catch {
        /* already released */
      }
    };
  }, [rainPlayer, forestPlayer]);

  useEffect(() => {
    const playing = phase === 'sprint' && !paused;
    try {
      if (playing && settings.sound === 'rain') rainPlayer.play();
      else rainPlayer.pause();
      if (playing && settings.sound === 'forest') forestPlayer.play();
      else forestPlayer.pause();
    } catch {
      /* audio unavailable */
    }
  }, [phase, paused, settings.sound, rainPlayer, forestPlayer]);

  // The clock runs off wall time, so it stays right if the app sleeps.
  useEffect(() => {
    if (phase !== 'sprint' && phase !== 'break') return;
    if (paused) return;
    endsAt.current = Date.now() + left * 1000;
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (phase === 'sprint') {
        workedRef.current += 1;
        setWorked(workedRef.current);
        // A teammate quietly catches a message now and then.
        if (Math.random() < 0.004) {
          heldRef.current += 1;
          setHeld(heldRef.current);
        }
      }
      if (remaining <= 0) {
        clearInterval(t);
        haptic('success');
        if (phase === 'sprint') {
          if (sprint >= sprints) finish();
          else {
            setPhase('break');
            setLeft(BREAK);
          }
        } else {
          setSprint((s) => s + 1);
          setPhase('sprint');
          setLeft(minutes * 60);
        }
      }
    }, 1000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setLeft(Math.max(0, Math.round((endsAt.current - Date.now()) / 1000)));
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, sprint]);

  const finish = () => {
    setPhase('done');
    const mins = Math.max(1, Math.round(workedRef.current / 60));
    logFlow({ minutes: mins, task: task || 'Deep work', sprints: sprint });
    if (params.blockId) updateBlock(params.blockId, { done: true });
    const heldCount = heldRef.current;
    if (heldCount) addReceipt({ memberId: leadId, text: `Held ${heldCount} messages while you were in Flow`, connector: 'Flow', kind: 'did', undoable: false });
  };

  const total = phase === 'break' ? BREAK : minutes * 60;
  const progress = phase === 'setup' ? 0 : phase === 'done' ? 1 : 1 - left / total;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const watchers = useMemo(() => members.slice(0, 3), [members]);
  const size = Math.min(width - 80, 300);
  const p = ink;

  return (
    <ForceTheme palette={ink}>
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <Row style={{ paddingHorizontal: 12, height: 52 }} justify="space-between">
        <IconBtn
          icon="close"
          label="Leave Flow"
          color={p.text}
          onPress={() => {
            if (phase === 'sprint' || phase === 'break') {
              finish();
              return;
            }
            router.back();
          }}
        />
        <Row gap={6}>
          <Ionicons name="water" size={16} color={p.signal} />
          <Txt variant="label" color={p.signalText}>
            Flow
          </Txt>
        </Row>
        <View style={{ width: 40 }} />
      </Row>

      {phase === 'setup' && (
        <Animated.ScrollView entering={FadeIn} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Txt variant="display" color={p.text}>
            Everything else goes quiet.
          </Txt>
          <Txt variant="body" color={p.text2} style={{ marginTop: 10 }}>
            Your Crew holds your messages, keeps the clock and tells you when to breathe.
          </Txt>
          <View style={{ marginTop: 20 }}>
            <Field placeholder="What are you diving into?" value={task} onChangeText={setTask} style={{ backgroundColor: p.card, borderColor: p.lineStrong, color: p.text }} />
          </View>
          <Label color={p.muted}>Sprint length</Label>
          <Row gap={8} wrap>
            {[25, 50, 90].map((m) => (
              <Chip key={m} label={`${m} min`} selected={minutes === m} color={minutes === m ? '#5CC8F2' : undefined} onPress={() => setMinutes(m)} />
            ))}
          </Row>
          <Label color={p.muted}>Sprints</Label>
          <Row gap={8} wrap>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Chip key={n} label={String(n)} selected={sprints === n} color={sprints === n ? '#5CC8F2' : undefined} onPress={() => setSprints(n)} />
            ))}
          </Row>
          <Txt variant="small" color={p.muted} style={{ marginTop: 8 }}>
            About {Math.round(((minutes * sprints + (sprints - 1) * (BREAK / 60)) / 60) * 10) / 10} hours with breaks.
          </Txt>
          <Label color={p.muted}>Sound</Label>
          <Row gap={8}>
            {(['rain', 'forest', 'off'] as const).map((s) => (
              <Chip key={s} label={s === 'rain' ? 'Rain' : s === 'forest' ? 'Forest' : 'Silence'} selected={settings.sound === s} color={settings.sound === s ? '#5CC8F2' : undefined} onPress={() => setSettings({ sound: s })} />
            ))}
          </Row>
          <Label color={p.muted}>Shield</Label>
          <View style={{ backgroundColor: p.card, borderRadius: 20, padding: 6 }}>
            <Row style={{ padding: 10 }} gap={12}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong" color={p.text}>
                  Hold Slack, Discord and group chats
                </Txt>
                <Txt variant="small" color={p.muted}>
                  Anything urgent still gets through.
                </Txt>
              </View>
              <Toggle value={shield.chats} onChange={(v) => setShield({ ...shield, chats: v })} label="Hold chats" />
            </Row>
            <Row style={{ padding: 10 }} gap={12}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong" color={p.text}>
                  Hold email until you surface
                </Txt>
                <Txt variant="small" color={p.muted}>
                  You'll get one summary after.
                </Txt>
              </View>
              <Toggle value={shield.email} onChange={(v) => setShield({ ...shield, email: v })} label="Hold email" />
            </Row>
          </View>
          <Btn
            title="Start"
            variant="color"
            color="#5CC8F2"
            full
            icon="water"
            style={{ marginTop: 24 }}
            onPress={() => {
              haptic('medium');
              setLeft(minutes * 60);
              setSprint(1);
              setWorked(0);
              workedRef.current = 0;
              heldRef.current = 0;
              setHeld(0);
              setPhase('sprint');
            }}
          />
        </Animated.ScrollView>
      )}

      {(phase === 'sprint' || phase === 'break') && (
        <Animated.View entering={FadeIn.duration(600)} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 20 }}>
          <Txt variant="label" color={p.muted} style={{ marginTop: 10 }}>
            {phase === 'break' ? 'Break' : `Sprint ${sprint} of ${sprints}`}
          </Txt>
          <Txt variant="h2" color={p.text} center style={{ marginTop: 6 }} numberOfLines={2}>
            {phase === 'break' ? 'Breathe. Stand up. Drink water.' : task || 'Deep work'}
          </Txt>
          <View style={{ marginTop: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Water progress={progress} size={size} />
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <Txt variant="display" color={p.text} style={{ fontSize: 58, lineHeight: 62, fontVariant: ['tabular-nums'] }}>
                {mm}:{ss}
              </Txt>
              {paused && (
                <Txt variant="label" color={p.signalText}>
                  Paused
                </Txt>
              )}
            </View>
          </View>
          <Row gap={10} style={{ marginTop: 26 }}>
            <Btn title={paused ? 'Resume' : 'Pause'} variant="ghost" icon={paused ? 'play' : 'pause'} onPress={() => setPaused((x) => !x)} />
            {phase === 'break' ? (
              <Btn
                title="Skip break"
                variant="color"
                color="#5CC8F2"
                onPress={() => {
                  setSprint((s) => s + 1);
                  setPhase('sprint');
                  setLeft(minutes * 60);
                }}
              />
            ) : (
              <Btn title="Finish" variant="color" color="#5CC8F2" onPress={finish} />
            )}
          </Row>
          <View style={{ marginTop: 'auto', marginBottom: 20, alignSelf: 'stretch', backgroundColor: p.card, borderRadius: 22, padding: 14 }}>
            <Row gap={10}>
              <View style={{ flexDirection: 'row' }}>
                {watchers.map((m, i) => (
                  <View key={m.id} style={{ marginLeft: i ? -8 : 0 }}>
                    <MemberPebble member={m} size={32} state="working" />
                  </View>
                ))}
              </View>
              <Txt variant="small" color={p.text2} style={{ flex: 1 }}>
                {watchers.map((m) => m.name).join(', ')} on watch. {held ? `Holding ${held} message${held === 1 ? '' : 's'}.` : 'Nothing needs you.'}
              </Txt>
            </Row>
          </View>
        </Animated.View>
      )}

      {phase === 'done' && (
        <Animated.View entering={FadeInDown} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Animated.View entering={ZoomIn.springify()}>
            <Water progress={1} size={160} />
          </Animated.View>
          <Txt variant="title" color={p.text} center style={{ marginTop: 24 }}>
            You surfaced.
          </Txt>
          <Txt variant="body" color={p.text2} center style={{ marginTop: 8 }}>
            {Math.max(1, Math.round(worked / 60))} minute{Math.max(1, Math.round(worked / 60)) === 1 ? '' : 's'} on {task || 'deep work'} across {sprint} sprint{sprint === 1 ? '' : 's'}. It counts toward your year.
          </Txt>
          {held > 0 && (
            <Txt variant="small" color={p.muted} center style={{ marginTop: 8 }}>
              Your Crew held {held} message{held === 1 ? '' : 's'}. Nothing was urgent.
            </Txt>
          )}
          <Row gap={10} style={{ marginTop: 24 }}>
            <Btn title="See your year" variant="ghost" onPress={() => router.replace('/rings')} />
            <Btn
              title="Done"
              variant="color"
              color="#5CC8F2"
              onPress={() => {
                toast('Flow logged. Nice work.');
                router.back();
              }}
            />
          </Row>
        </Animated.View>
      )}
    </SafeAreaView>
    </ForceTheme>
  );
}
