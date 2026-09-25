import { palettes, type ThemeColors } from '@/constants/palettes';
import { AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Brand, Button, Card, Icon, Notice, Screen } from '@/components/ui';
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
          <View style={[ui.row, { justifyContent: 'center' }]}>
            <AntDesign name="google" color={colors.muted} size={14} />
            <Text style={ui.small}>Your account. Your training. Your progress.</Text>
          </View>
        </>
      }
    >
      <Brand />
      <View style={{ marginTop: 20, gap: 16 }}>
        <Text style={styles.hero}>
          Your last lift.{'\n'}Your next
          <Text style={{ color: colors.accent }}> best.</Text>
        </Text>
        <Text style={[ui.muted, { fontSize: 16, lineHeight: 25 }]}>
          Walk in with a plan. Remember every set.{'\n'}Make today count.
        </Text>
      </View>
      <View
        style={styles.art}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.ring} />
        <View
          style={[styles.ring, { width: 140, height: 140, borderColor: colors.accentBorder }]}
        />
        <MaterialCommunityIcons
          name="dumbbell"
          size={110}
          color={colors.accent}
          style={{ transform: [{ rotate: '-28deg' }] }}
        />
        <View style={styles.artCaption}>
          <Icon name="arrow-up-right" color={colors.accent} size={16} />
          <Text style={[ui.label, { color: colors.accent }]}>BUILT SET BY SET</Text>
        </View>
      </View>
      <Card>
        <View style={ui.row}>
          <Icon name="repeat" color={colors.accent} />
          <View style={ui.flex}>
            <Text style={[ui.body, { fontWeight: '700' }]}>
              Pick up where you left off
            </Text>
            <Text style={ui.small}>Last time beside every set you log today.</Text>
          </View>
        </View>
        <View style={ui.rule} />
        <View style={ui.row}>
          <Icon name="wifi-off" color={colors.accent} />
          <View style={ui.flex}>
            <Text style={[ui.body, { fontWeight: '700' }]}>Keep training offline</Text>
            <Text style={ui.small}>Your workout stays with you, signal or not.</Text>
          </View>
        </View>
      </Card>
      {error && <Notice error message={error} />}
    </Screen>
  );
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  hero: {
    color: colors.text,
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '900',
    letterSpacing: -1.8,
  },
  art: {
    height: 205,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: 24,
  },
  ring: {
    width: 240,
    height: 240,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 150,
    position: 'absolute',
  },
  artCaption: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

const themedStyles = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
