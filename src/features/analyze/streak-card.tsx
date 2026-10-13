import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Icon } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { buildStreak, shortDate, type Period } from './model';

export function StreakCard({ trainingDates, days, today }: { trainingDates: string[]; days: Period; today: string }) {
  const { colors, ui } = useTheme();
  const streak = buildStreak(trainingDates, days, today);
  const milestone = [3, 7, 14, 30, 60, 90].find((goal) => goal > streak.current)
    ?? (Math.floor(streak.current / 30) + 1) * 30;
  const remaining = milestone - streak.current;
  const status = streak.trainedToday ? 'TODAY COMPLETE' : streak.current > 0 ? 'KEEP IT GOING' : 'YOUR NEXT CHAPTER';
  return (
    <Card style={{ padding: 0, overflow: 'hidden', borderColor: colors.accentBorder }}>
      <View style={[styles.hero, { backgroundColor: colors.accentSoft }]}>
        <View pointerEvents="none" accessible={false} style={[styles.orbit, { borderColor: colors.accentBorder }]} />
        <View style={[ui.between, { flexWrap: 'wrap' }]}>
          <Text style={[ui.label, { color: colors.accent }]}>GYM STREAK</Text>
          <View style={[styles.pill, { backgroundColor: colors.surface }]}>
            <Icon name={streak.trainedToday ? 'check-circle' : 'zap'} color={colors.accent} size={13} />
            <Text style={[styles.pillText, { color: colors.accent }]}>{status}</Text>
          </View>
        </View>
        <View style={[ui.row, { gap: 16, flexWrap: 'wrap' }]}>
          <View style={[styles.flame, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="fire" size={46} color={colors.onAccent} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.counter, { color: colors.text }]}>{streak.current}<Text style={[ui.heading, { color: colors.accent }]}> {streak.current === 1 ? 'day' : 'days'}</Text></Text>
            <Text style={ui.muted}>of showing up for yourself</Text>
          </View>
        </View>
        <Text style={[ui.body, { fontWeight: '600' }]}>
          {streak.trainedToday ? 'Another day stronger. You earned this one.'
            : streak.current > 0 ? 'One workout today keeps the momentum alive.'
            : 'Big things start with one workout.'}
        </Text>
        <View style={[styles.milestone, { backgroundColor: colors.surface, borderColor: colors.accentBorder }]}>
          <View style={ui.between}>
            <View style={[ui.row, { gap: 6, flex: 1 }]}>
              <Icon name="flag" color={colors.accent} size={15} />
              <Text style={[ui.small, { color: colors.text, flexShrink: 1 }]}>Next milestone · {milestone} days</Text>
            </View>
            <Text style={[ui.small, { color: colors.accent }]}>{remaining} to go</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={`Progress toward a ${milestone} day streak`}
            accessibilityValue={{ min: 0, max: milestone, now: streak.current }}
            style={[styles.track, { backgroundColor: colors.raised }]}>
            <View style={[styles.fill, { width: `${streak.current / milestone * 100}%`, backgroundColor: colors.accent }]} />
          </View>
        </View>
      </View>
      <View style={styles.details}>
        <View style={[ui.row, { alignItems: 'stretch', gap: 10 }]}>
          <View style={[styles.stat, { backgroundColor: colors.raised }]}>
            <Icon name="award" size={18} color={colors.accent} />
            <Text style={[styles.statValue, { color: colors.text }]}>{streak.best}<Text style={ui.small}> days</Text></Text>
            <Text style={ui.small}>Personal best · all time</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.raised }]}>
            <Icon name="activity" size={18} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>{streak.consistency}<Text style={ui.small}> %</Text></Text>
            <Text style={ui.small}>Attendance · {streak.trainingDays}/{days} days</Text>
          </View>
        </View>
        <View style={ui.between}>
          <Text style={ui.label}>YOUR LAST 7 DAYS</Text>
          <Text style={[ui.small, { color: colors.accent }]}>Today outlined</Text>
        </View>
        <View style={[ui.row, { gap: 5, alignItems: 'stretch' }]}>
          {streak.activity.slice(-7).map((day) => (
            <View key={day.date} accessible accessibilityLabel={`${shortDate(day.date)}: ${day.trained ? 'workout completed' : day.date === today ? 'no workout yet' : 'no workout'}`}
              style={[styles.day, { backgroundColor: day.trained ? colors.accentSoft : colors.raised,
                borderColor: day.date === today ? colors.accent : 'transparent' }]}>
              <Text style={[ui.small, { fontSize: 10 }]}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
              <Icon name={day.trained ? 'check' : 'minus'} size={18} color={day.trained ? colors.accent : colors.muted} />
              <Text style={[ui.small, { color: day.trained ? colors.accent : colors.muted, fontWeight: '700' }]}>{Number(day.date.slice(-2))}</Text>
            </View>
          ))}
        </View>
        <View style={[ui.row, { gap: 6 }]}>
          <Icon name="info" size={13} />
          <Text style={[ui.small, { flex: 1 }]}>One completed workout per day builds your streak. Today stays open until the day ends. Rest days break daily streaks and count as days off in attendance.</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 20, gap: 18, overflow: 'hidden' },
  orbit: { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 1, right: -100, top: 32 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  pillText: { fontSize: 9, letterSpacing: 0.6, fontWeight: '800' },
  flame: { width: 72, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  counter: { fontSize: 64, lineHeight: 76, fontWeight: '900', letterSpacing: -3, fontVariant: ['tabular-nums'] },
  milestone: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  details: { padding: 20, gap: 18 },
  stat: { flex: 1, borderRadius: 16, padding: 12, gap: 6 },
  statValue: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  day: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5 },
});
