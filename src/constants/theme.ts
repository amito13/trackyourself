import { StyleSheet } from 'react-native';

import { palettes, type ThemeColors } from './palettes';
import { useAppearanceMode } from '@/state/appearance-store';

function createUi(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    between: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    stack: { gap: 16 },
    smallStack: { gap: 8 },
    flex: { flex: 1 },
    title: {
      color: colors.text,
      fontSize: 32,
      lineHeight: 39,
      fontWeight: '800',
      letterSpacing: -1,
    },
    heading: {
      color: colors.text,
      fontSize: 21,
      lineHeight: 28,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    body: { color: colors.text, fontSize: 15, lineHeight: 23 },
    muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
    label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
    small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    rule: { height: 1, backgroundColor: colors.border },
    input: {
      minHeight: 52,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      color: colors.text,
      fontSize: 17,
    },
  });
}
const themes = {
  light: { mode: 'light' as const, colors: palettes.light, ui: createUi(palettes.light) },
  dark: { mode: 'dark' as const, colors: palettes.dark, ui: createUi(palettes.dark) },
};
export function useTheme() {
  const mode = useAppearanceMode();
  return themes[mode];
}
export const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export const bodyParts = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Core',
];
