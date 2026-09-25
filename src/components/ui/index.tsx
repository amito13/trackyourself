import { palettes, type ThemeColors } from '@/constants/palettes';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/theme';
import { brand } from '@/constants/brand';

export type IconName = ComponentProps<typeof Feather>['name'];
export function Icon({
  name,
  color,
  size = 20,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return <Feather name={name} size={size} color={color ?? colors.muted} />;
}
export function Screen({
  children,
  footer,
  tabs = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  tabs?: boolean;
}) {
  const { ui, mode } = useTheme();
  const styles = themedStyles[mode];
  return (
    <SafeAreaView
      style={styles.screen}
      edges={tabs ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={ui.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { mode } = useTheme();
  const styles = themedStyles[mode];
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary,
  disabled,
  loading,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
}) {
  const { colors, mode } = useTheme();
  const styles = themedStyles[mode];
  const color = secondary ? colors.text : colors.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: secondary ? colors.raised : colors.accent },
        (pressed || disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon && <Icon name={icon} color={color} size={18} />}
          <Text style={[styles.buttonText, { color }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  disabled,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, mode } = useTheme();
  const styles = themedStyles[mode];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: pressed || disabled ? 0.4 : 1 },
      ]}
    >
      <Icon name={name} color={colors.text} />
    </Pressable>
  );
}
export function Header({
  title,
  back = false,
  right,
  onBack,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const { colors, ui } = useTheme();
  return (
    <View style={[ui.between, { minHeight: 44, flexShrink: 0 }]}>
      <View style={[ui.row, ui.flex]}>
        {back && (
          <IconButton
            name="arrow-left"
            label="Go back"
            onPress={
              onBack ??
              (() => (router.canGoBack() ? router.back() : router.replace('/home')))
            }
          />
        )}
        <Text style={[ui.label, { color: colors.text, flexShrink: 1 }]}>
          {title.toUpperCase()}
        </Text>
      </View>
      {right}
    </View>
  );
}
export function Brand() {
  const { colors, ui, mode } = useTheme();
  const styles = themedStyles[mode];
  return (
    <View style={ui.row}>
      <View style={styles.logo}>
        <MaterialCommunityIcons
          name="dumbbell"
          size={26}
          color={colors.onAccent}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.brand}>{brand.name}</Text>
        <Text style={ui.small}>{brand.tagline}</Text>
      </View>
    </View>
  );
}
export function Badge({
  children,
  green = false,
  style,
}: {
  children: ReactNode;
  green?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, mode } = useTheme();
  const styles = themedStyles[mode];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: green ? colors.successSoft : colors.accentSoft },
        style,
      ]}
    >
      <Text
        style={{
          color: green ? colors.success : colors.accent,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.7,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors, mode } = useTheme();
  const styles = themedStyles[mode];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.accent : colors.muted,
          fontWeight: '600',
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Notice({
  message,
  error = false,
  onRetry,
}: {
  message: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  const { colors, ui, mode } = useTheme();
  const styles = themedStyles[mode];
  return (
    <View
      style={[styles.notice, error && { borderColor: colors.danger }]}
      accessibilityLiveRegion="polite"
    >
      <View style={ui.row}>
        <Icon
          name={error ? 'alert-circle' : 'info'}
          color={error ? colors.danger : colors.muted}
          size={16}
        />
        <Text style={[ui.small, ui.flex, error && { color: colors.danger }]}>
          {message}
        </Text>
      </View>
      {onRetry && <Button title="Try again" secondary onPress={onRetry} />}
    </View>
  );
}
export function Empty({
  icon = 'inbox',
  title,
  detail,
  action,
}: {
  icon?: IconName;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  const { colors, ui, mode } = useTheme();
  const styles = themedStyles[mode];
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} color={colors.accent} size={28} />
      </View>
      <Text style={[ui.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[ui.muted, { textAlign: 'center' }]}>{detail}</Text>
      {action}
    </Card>
  );
}
export function Loading() {
  const { colors, ui } = useTheme();
  return (
    <View style={{ padding: 48 }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[ui.small, { textAlign: 'center', marginTop: 12 }]}>
        Getting things ready…
      </Text>
    </View>
  );
}
export function Section({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const { ui } = useTheme();
  return (
    <View style={[ui.between, { marginTop: 8 }]}>
      <Text style={ui.label}>{title.toUpperCase()}</Text>
      {trailing}
    </View>
  );
}
export function ExerciseMark({ small = false }: { small?: boolean }) {
  const { colors, mode } = useTheme();
  const styles = themedStyles[mode];
  return (
    <View style={[styles.exerciseMark, small && { width: 38, height: 38 }]}>
      <MaterialCommunityIcons
        name="dumbbell"
        size={small ? 19 : 26}
        color={colors.accent}
      />
    </View>
  );
}
export function Metric({ value, label }: { value: string | number; label: string }) {
  const { colors, ui } = useTheme();
  return (
    <View style={ui.flex}>
      <Text
        style={{
          color: colors.text,
          fontSize: 28,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text style={ui.small}>{label}</Text>
    </View>
  );
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 22,
    gap: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingBottom: 32,
    flexGrow: 1,
  },
  footer: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  button: {
    minHeight: 54,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: { fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.raised,
  },
  logo: {
    width: 48,
    height: 48,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  brand: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: colors.text, letterSpacing: 2 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.raised,
  },
  notice: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 12,
  },
  empty: { alignItems: 'center', paddingVertical: 38, gap: 14 },
  emptyIcon: {
    backgroundColor: colors.accentSoft,
    padding: 18,
    borderRadius: 20,
    marginBottom: 4,
  },
  exerciseMark: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const themedStyles = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
