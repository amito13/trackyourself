import { palettes, type ThemeColors } from '@/constants/palettes';
import { AntDesign } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Brand, Button, Icon, Notice, Screen } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { SignInWithOAuth } from '@/lib/auth';
import { errorMessage } from '@/utils/display';

export default function SignInScreen() {
  const { colors, ui, mode } = useTheme();
  const styles = themedStyles[mode];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      await SignInWithOAuth('google');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Screen
      footer={
        <>
          <Button
            title="Continue with Google"
            onPress={() => void signIn()}
            loading={loading}
          />
          <View style={styles.footerNote}>
            <AntDesign name="google" color={colors.muted} size={14} />
            <Text style={ui.small}>Your training. All in one place.</Text>
          </View>
        </>
      }
    >
      <Brand />
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>LESS GUESSWORK. MORE PROGRESS.</Text>
        <Text style={styles.hero} accessibilityRole="header">
          Forget your{'\n'}last lift?{'\n'}
          <Text style={styles.accent}>Never again.</Text>
        </Text>
        <Text style={styles.description}>
          Your last weights and reps, right beside today’s sets. Know where to start. See when you improve.
        </Text>
      </View>
      <View style={styles.preview}>
        <View style={ui.between}>
          <View style={styles.exerciseTitle}>
            <View style={styles.exerciseIcon}>
              <Icon name="activity" color={colors.accent} size={20} />
            </View>
            <View style={ui.flex}>
              <Text style={styles.exerciseName}>Bench press</Text>
              <Text style={ui.small}>A little better than last time.</Text>
            </View>
          </View>
          <Text style={styles.sample}>EXAMPLE</Text>
        </View>
        <View style={styles.comparison}>
          <View style={styles.previous}>
            <Text style={styles.columnLabel}>LAST TIME</Text>
            <Text style={styles.weight}>40 <Text style={styles.unit}>kg</Text></Text>
            <Text style={styles.reps}>8 reps</Text>
          </View>
          <View style={styles.arrow}>
            <Icon name="arrow-right" color={colors.accent} size={18} />
          </View>
          <View style={styles.today}>
            <Text style={[styles.columnLabel, styles.accent]}>TODAY</Text>
            <Text style={styles.weight}>40 <Text style={styles.unit}>kg</Text></Text>
            <Text style={[styles.reps, styles.accent]}>9 reps</Text>
          </View>
        </View>
        <View style={styles.progressNote}>
          <Icon name="trending-up" color={colors.accent} size={18} />
          <Text style={styles.progressText}>One more rep. Progress you can see.</Text>
        </View>
      </View>
      <View style={styles.benefit}>
        <Icon name="wifi-off" color={colors.accent} size={19} />
        <View style={ui.flex}>
          <Text style={styles.benefitTitle}>No signal? No lost sets.</Text>
          <Text style={ui.small}>Log your workout even when the gym Wi-Fi quits.</Text>
        </View>
      </View>
      {error && <Notice error message={error} />}
    </Screen>
  );
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  intro: { marginTop: 12, gap: 12 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  hero: {
    color: colors.text,
    fontSize: 44,
    lineHeight: 49,
    fontWeight: '900',
    letterSpacing: -1.6,
  },
  accent: { color: colors.accent },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 18,
  },
  exerciseTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  exerciseIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  exerciseName: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  sample: { color: colors.muted, fontSize: 9, letterSpacing: 1 },
  comparison: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  previous: {
    flex: 1, paddingVertical: 16, paddingHorizontal: 10, gap: 5,
    borderRadius: 16, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  today: {
    flex: 1, paddingVertical: 16, paddingHorizontal: 10, gap: 5,
    borderRadius: 16, backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  arrow: { justifyContent: 'center' },
  columnLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  weight: { color: colors.text, fontSize: 32, lineHeight: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 16, fontWeight: '400', color: colors.muted },
  reps: { color: colors.muted, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  progressNote: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { color: colors.accent, fontSize: 13, lineHeight: 20, flex: 1, fontWeight: '600' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6 },
  benefitTitle: { color: colors.text, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});

const themedStyles = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
