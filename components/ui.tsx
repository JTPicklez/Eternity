/**
 * The Ink & Water kit: paper backgrounds, carved cards, ink buttons and a
 * signal blue for the one thing that matters on each screen.
 */
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { carved, fonts } from '@/theme/tokens';
import { useFamily } from '@/lib/store';
import { DROP_PATH } from './shapes';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' | 'select' = 'light') {
  if (!useFamily.getState().settings.haptics || Platform.OS === 'web') return;
  const run = () => {
    switch (kind) {
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'select':
        return Haptics.selectionAsync();
      default:
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  run().catch(() => {});
}

// ── Text ─────────────────────────────────────────────────────────────────────
type TxtVariant = 'display' | 'title' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'smallStrong' | 'mono' | 'label' | 'tiny';

export function Txt({
  variant = 'body',
  color,
  center,
  style,
  children,
  ...rest
}: TextProps & { variant?: TxtVariant; color?: string; center?: boolean; style?: StyleProp<TextStyle> }) {
  const p = useTheme();
  const base: Record<TxtVariant, TextStyle> = {
    display: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, letterSpacing: -1.2, color: p.text },
    title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 31, letterSpacing: -0.8, color: p.text },
    h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, letterSpacing: -0.5, color: p.text },
    h3: { fontFamily: fonts.displayBold, fontSize: 16.5, lineHeight: 21, color: p.text },
    body: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 22, color: p.text2 },
    bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15.5, lineHeight: 21, color: p.text },
    small: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: p.muted },
    smallStrong: { fontFamily: fonts.bodySemi, fontSize: 13.5, lineHeight: 18, color: p.text },
    mono: { fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 17, color: p.muted },
    label: { fontFamily: fonts.monoMedium, fontSize: 11.5, lineHeight: 15, letterSpacing: 1.2, color: p.muted, textTransform: 'uppercase' },
    tiny: { fontFamily: fonts.bodyMedium, fontSize: 11.5, lineHeight: 14, color: p.muted },
  };
  return (
    <Text
      {...rest}
      style={[base[variant], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
      maxFontSizeMultiplier={1.4}
    >
      {children}
    </Text>
  );
}

// ── Background ripples ───────────────────────────────────────────────────────
export function Ripples({ corner = 'topRight', size = 300 }: { corner?: 'topRight' | 'bottomLeft' | 'topLeft'; size?: number }) {
  const p = useTheme();
  const ambient = useFamily((s) => s.settings.ambient);
  const reduced = useReducedMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (!ambient || reduced) return;
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [ambient, reduced, drift]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + drift.value * 0.06 }] }));
  const pos: ViewStyle =
    corner === 'topRight'
      ? { right: -size * 0.37, top: -size * 0.2 }
      : corner === 'topLeft'
        ? { left: -size * 0.4, top: -size * 0.15 }
        : { left: -size * 0.4, bottom: -size * 0.2 };
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size * 0.67 }, pos, style]}>
      <Svg width={size} height={size * 0.67} viewBox="0 0 300 200">
        <G fill="none" stroke={p.ripple} strokeWidth={1.5}>
          <Ellipse cx={150} cy={100} rx={40} ry={24} />
          <Ellipse cx={150} cy={100} rx={75} ry={45} />
          <Ellipse cx={150} cy={100} rx={110} ry={66} />
          <Ellipse cx={150} cy={100} rx={145} ry={87} />
        </G>
      </Svg>
    </Animated.View>
  );
}

export function Drop({ size = 16, color }: { size?: number; color?: string }) {
  const p = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={DROP_PATH} fill={color ?? p.signal} />
    </Svg>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export function Screen({
  children,
  scroll = true,
  padded = true,
  ripples = true,
  edges = ['top'],
  footer,
  contentStyle,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  ripples?: boolean;
  edges?: ('top' | 'bottom')[];
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  const p = useTheme();
  const pad: ViewStyle = padded ? { paddingHorizontal: 16 } : {};
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: p.bg }}>
      {ripples && <Ripples />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[pad, { paddingTop: 12, paddingBottom: 40 }, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export type CardTone = 'paper' | 'stone' | 'outline' | 'signal' | 'soft' | 'color';

export function Card({
  tone = 'paper',
  carve = 0,
  color,
  style,
  children,
  onPress,
  padding = 16,
  accessibilityLabel,
}: {
  tone?: CardTone;
  carve?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  onPress?: () => void;
  padding?: number;
  accessibilityLabel?: string;
}) {
  const p = useTheme();
  const radii = carved[carve % carved.length];
  const toneStyle: ViewStyle =
    tone === 'paper'
      ? { backgroundColor: p.card, boxShadow: `0px 3px 0px ${p.shadow}` }
      : tone === 'stone'
        ? { backgroundColor: p.stone }
        : tone === 'outline'
          ? { backgroundColor: p.card, borderWidth: 2, borderColor: p.text }
          : tone === 'signal'
            ? { backgroundColor: p.signal }
            : tone === 'color'
              ? { backgroundColor: color ?? p.card }
              : { backgroundColor: p.card2 };
  const content = <View style={[radii, toneStyle, { padding }, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <PressScale onPress={onPress} accessibilityLabel={accessibilityLabel}>
      {content}
    </PressScale>
  );
}

/** Wraps anything so it dips a little when pressed. */
export function PressScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  hapticKind = 'light',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'switch' | 'radio' | 'checkbox';
  hapticKind?: 'light' | 'medium' | 'select' | 'none';
}) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        s.value = withTiming(0.97, { duration: 80 });
      }}
      onPressOut={() => {
        s.value = withSpring(1, { damping: 12, stiffness: 300 });
      }}
      onPress={() => {
        if (hapticKind !== 'none') haptic(hapticKind);
        onPress?.();
      }}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={style}
    >
      <Animated.View style={[anim, disabled ? { opacity: 0.45 } : null]}>{children}</Animated.View>
    </Pressable>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
export type BtnVariant = 'ink' | 'signal' | 'ghost' | 'quiet' | 'danger' | 'onStone' | 'water' | 'stoneGhost' | 'color';

export function Btn({
  title,
  onPress,
  variant = 'ink',
  icon,
  iconRight,
  small,
  full,
  loading,
  disabled,
  color,
  textColor,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  iconRight?: IconName;
  small?: boolean;
  full?: boolean;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const p = useTheme();
  const map: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
    ink: { bg: p.stone, fg: p.onStone },
    signal: { bg: p.signal, fg: p.onSignal },
    ghost: { bg: 'transparent', fg: p.text, border: p.text },
    quiet: { bg: 'transparent', fg: p.signalText },
    danger: { bg: 'transparent', fg: p.danger, border: p.danger },
    // For buttons sitting on a stone (inverted) card.
    onStone: { bg: p.onStone, fg: p.stone },
    water: p.mode === 'paper' ? { bg: '#5CC8F2', fg: '#1E2023' } : { bg: '#1E5BD2', fg: '#F7F3EC' },
    stoneGhost: { bg: 'transparent', fg: p.onStone, border: p.mode === 'paper' ? '#4A4D52' : '#B9B0A2' },
    color: { bg: color ?? p.signal, fg: textColor ?? '#1E2023' },
  };
  const c = map[variant];
  const h = small ? 38 : 48;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? title}
      style={[full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    >
      <View
        style={{
          height: h,
          paddingHorizontal: variant === 'quiet' ? 4 : small ? 14 : 18,
          borderRadius: small ? 13 : 15,
          backgroundColor: c.bg,
          borderWidth: c.border ? 1.5 : 0,
          borderColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {loading ? (
          <ActivityIndicator color={c.fg} />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={small ? 16 : 18} color={c.fg} />}
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: small ? 13.5 : 15, color: c.fg }} maxFontSizeMultiplier={1.3}>
              {title}
            </Text>
            {iconRight && <Ionicons name={iconRight} size={small ? 16 : 18} color={c.fg} />}
          </>
        )}
      </View>
    </PressScale>
  );
}

export function IconBtn({
  icon,
  onPress,
  label,
  tone = 'plain',
  size = 40,
  color,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  tone?: 'plain' | 'ink' | 'card' | 'outline';
  size?: number;
  color?: string;
}) {
  const p = useTheme();
  const bg = tone === 'ink' ? p.stone : tone === 'card' ? p.card : 'transparent';
  const fg = color ?? (tone === 'ink' ? p.onStone : p.text);
  return (
    <PressScale onPress={onPress} accessibilityLabel={label}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.36,
          backgroundColor: bg,
          borderWidth: tone === 'outline' ? 1.5 : 0,
          borderColor: p.lineStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={size * 0.5} color={fg} />
      </View>
    </PressScale>
  );
}

// ── Chips, toggles, segmented ────────────────────────────────────────────────
export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  small,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  small?: boolean;
}) {
  const p = useTheme();
  return (
    <PressScale onPress={onPress} hapticKind="select" accessibilityRole="checkbox" accessibilityLabel={label}>
      <View
        style={{
          height: small ? 32 : 38,
          paddingHorizontal: small ? 11 : 14,
          borderRadius: small ? 11 : 13,
          borderWidth: 1.5,
          borderColor: selected ? (color ?? p.text) : p.lineStrong,
          backgroundColor: selected ? (color ?? p.stone) : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {icon && <Ionicons name={icon} size={15} color={selected ? (color ? '#1E2023' : p.onStone) : p.text} />}
        <Text
          style={{ fontFamily: fonts.bodySemi, fontSize: small ? 12.5 : 13.5, color: selected ? (color ? '#1E2023' : p.onStone) : p.text }}
          maxFontSizeMultiplier={1.3}
        >
          {label}
        </Text>
      </View>
    </PressScale>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const p = useTheme();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = withSpring(value ? 1 : 0, { damping: 15, stiffness: 220 });
  }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));
  return (
    <Pressable
      onPress={() => {
        haptic('select');
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
    >
      <View
        style={{
          width: 50,
          height: 30,
          borderRadius: 11,
          padding: 3,
          backgroundColor: value ? p.signal : p.card2,
          borderWidth: 1.5,
          borderColor: value ? p.signal : p.lineStrong,
        }}
      >
        <Animated.View
          style={[{ width: 21, height: 21, borderRadius: 8, backgroundColor: value ? p.onSignal : p.muted }, knob]}
        />
      </View>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: p.card2, borderRadius: 14, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => {
              haptic('select');
              onChange(o.id);
            }}
            style={{ flex: 1 }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <View
              style={{
                height: 36,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? p.stone : 'transparent',
              }}
            >
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: on ? p.onStone : p.text }} maxFontSizeMultiplier={1.3}>
                {o.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A 0..100 slider made of 11 tappable stones (no native slider needed). */
export function StoneSlider({
  value,
  onChange,
  left,
  right,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  left: string;
  right: string;
  color?: string;
}) {
  const p = useTheme();
  const steps = 11;
  const active = Math.round((value / 100) * (steps - 1));
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        {Array.from({ length: steps }).map((_, i) => {
          const on = i <= active;
          return (
            <Pressable
              key={i}
              onPress={() => {
                haptic('select');
                onChange(Math.round((i / (steps - 1)) * 100));
              }}
              hitSlop={{ top: 12, bottom: 12 }}
              style={{ flex: 1 }}
              accessibilityRole="adjustable"
              accessibilityLabel={`${left} to ${right}, step ${i + 1} of ${steps}`}
            >
              <View
                style={{
                  height: i === active ? 22 : 12,
                  borderRadius: 6,
                  backgroundColor: on ? (color ?? p.signal) : p.card2,
                  borderWidth: i === active ? 2 : 0,
                  borderColor: p.text,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Txt variant="tiny">{left}</Txt>
        <Txt variant="tiny">{right}</Txt>
      </View>
    </View>
  );
}

// ── Layout bits ──────────────────────────────────────────────────────────────
export function Label({ children, style, color }: { children: React.ReactNode; style?: StyleProp<TextStyle>; color?: string }) {
  return (
    <Txt variant="label" color={color} style={[{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }, style]}>
      {children}
    </Txt>
  );
}

export function Row({
  children,
  gap = 10,
  style,
  align = 'center',
  justify,
  wrap,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const p = useTheme();
  return <View style={[{ height: 1.5, backgroundColor: p.line, marginVertical: 12 }, style]} />;
}

export function BackHeader({
  title,
  right,
  onBack,
  kicker,
}: {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  kicker?: string;
}) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, marginHorizontal: -4 }}>
      <IconBtn
        icon="chevron-back"
        label="Back"
        onPress={() => {
          if (onBack) onBack();
          else if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
      <View style={{ flex: 1 }}>
        {kicker ? <Txt variant="label">{kicker}</Txt> : null}
        {title ? (
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: p.text }} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const p = useTheme();
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [value, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: p.card2, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color ?? p.signal }, style]} />
    </View>
  );
}

export function Field({
  label,
  style,
  multiline,
  ...rest
}: TextInputProps & { label?: string; style?: StyleProp<TextStyle> }) {
  const p = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt variant="smallStrong">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={p.muted}
        multiline={multiline}
        style={[
          {
            minHeight: multiline ? 92 : 48,
            paddingHorizontal: 14,
            paddingTop: multiline ? 12 : 0,
            paddingBottom: multiline ? 12 : 0,
            borderRadius: 15,
            borderWidth: 1.5,
            borderColor: p.lineStrong,
            backgroundColor: p.card,
            color: p.text,
            fontFamily: fonts.body,
            fontSize: 15.5,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        maxFontSizeMultiplier={1.3}
        {...rest}
      />
    </View>
  );
}

export function ListRow({
  icon,
  title,
  sub,
  right,
  onPress,
  danger,
  iconColor,
}: {
  icon?: IconName;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  iconColor?: string;
}) {
  const p = useTheme();
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 52 }}>
      {icon && (
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: p.card2, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={19} color={danger ? p.danger : (iconColor ?? p.text)} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={danger ? p.danger : undefined}>
          {title}
        </Txt>
        {sub ? <Txt variant="small">{sub}</Txt> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={p.muted} /> : null)}
    </View>
  );
  if (!onPress) return inner;
  return (
    <PressScale onPress={onPress} accessibilityLabel={title}>
      {inner}
    </PressScale>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 8 }}>
      <Drop size={26} />
      <Txt variant="h3" center>
        {title}
      </Txt>
      {body ? (
        <Txt variant="small" center>
          {body}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function Badge({ text, color, textColor }: { text: string; color?: string; textColor?: string }) {
  const p = useTheme();
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, backgroundColor: color ?? p.signal, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: textColor ?? p.onSignal }} maxFontSizeMultiplier={1.2}>
        {text}
      </Text>
    </View>
  );
}

// ── Sheet ────────────────────────────────────────────────────────────────────
export function Sheet({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(10, 12, 14, 0.45)' }} onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <Animated.View
              entering={SlideInDown.springify().damping(18)}
              exiting={SlideOutDown.duration(180)}
              style={{
                backgroundColor: p.bg,
                borderTopLeftRadius: 30,
                borderTopRightRadius: 22,
                paddingHorizontal: 18,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                maxHeight: '90%',
              }}
            >
              <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: p.lineStrong, marginBottom: 12 }} />
              {title ? (
                <Txt variant="h2" style={{ marginBottom: 10 }}>
                  {title}
                </Txt>
              ) : null}
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
                {children}
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}
    </Modal>
  );
}

/** Mono-letter connector badge. */
export function Mono({ text, size = 36, on }: { text: string; size?: number; on?: boolean }) {
  const p = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: on ? p.stone : p.card2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.monoMedium, fontSize: size * 0.34, color: on ? p.onStone : p.text }}>{text}</Text>
    </View>
  );
}

export const Spacer = ({ h = 12 }: { h?: number }) => <View style={{ height: h }} />;

/** A tiny pulse used for "live" indicators. */
export function LiveDot({ color }: { color?: string }) {
  const p = useTheme();
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color ?? p.danger }, style]} />;
}
