import { StyleSheet } from 'react-native';

export const colors = {
  background: '#101112',
  surface: '#1B1D1F',
  raised: '#25282B',
  border: '#303336',
  text: '#F5F3EF',
  muted: '#A6AAAE',
  accent: '#FF8A4C',
  accentSoft: '#35251E',
  success: '#8FD6AC',
  successSoft: '#1C3027',
  danger: '#FF9A95',
};
export const ui = StyleSheet.create({
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
