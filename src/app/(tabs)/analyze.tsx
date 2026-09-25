import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Card, Chip, Empty, Header, Icon, Loading, Metric, Notice, Screen } from '@/components/ui';
import { colors, ui } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { buildAnalytics, dateKey, formatNumber, periodBounds, shortDate, type Period } from '@/features/analyze/model';
import { TrendChart } from '@/features/analyze/trend-chart';
import { useLocalQuery } from '@/hooks/use-local-query';

export default function AnalyzeScreen() {
  const [days, setDays] = useState<Period>(30);
  const [exerciseId, setExerciseId] = useState<string>();
  const { data, loading, error, reload } = useLocalQuery(useCallback(async (r: Repositories) => {
    const today = dateKey(new Date());
    const bounds = periodBounds(days, today);
    return { rows: await r.analytics.range(bounds.previousStart, today), today, days };
  }, [days]));
  const stats = data && data.days === days ? buildAnalytics(data.rows, days, data.today, exerciseId) : null;
  return (
    <Screen tabs>
      <Header title="Analyze" right={<Icon name="bar-chart-2" color={colors.accent} />} />
      <View style={ui.smallStack}>
        <Text style={ui.title}>See your progress.</Text>
        <Text style={ui.muted}>Small steps. Stronger over time.</Text>
      </View>
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        {([7, 30, 90] as const).map((period) => (
          <Chip key={period} label={`${period} days`} selected={days === period} onPress={() => setDays(period)} />
        ))}
      </View>
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {loading && !stats && !error && <Loading />}
      {stats && <>
        <Text style={ui.small}>{shortDate(stats.start)} – {shortDate(stats.end)} · Last {days} days, including today</Text>
        <Card>
          <View style={ui.row}>
            <Metric value={stats.sessions} label="workouts" />
            <Metric value={stats.sets} label="completed sets" />
          </View>
        </Card>
        {stats.sessions === 0 ? (
          <Empty icon="trending-up" title="Your progress starts here" detail="Finish a workout to see your graphs, or choose a longer date range."
            action={<Button title="Go to today" secondary onPress={() => router.push('/home')} />} />
        ) : <>
          <Card>
            <View style={ui.between}>
              <Text style={ui.heading}>Volume</Text>
              <Icon name="bar-chart-2" color="#32A9E0" />
            </View>
            <Text style={ui.title}>{formatNumber(stats.totalVolume)} <Text style={ui.muted}>kg</Text></Text>
            <Text style={[ui.small, stats.change !== null && stats.change > 0 && { color: colors.success }]}>
              {stats.change === null ? 'No volume in the previous period to compare' : `${stats.change > 0 ? '+' : ''}${formatNumber(stats.change)}% vs. previous ${days} days`}
            </Text>
            <TrendChart key={`volume-${days}-${stats.end}`} points={stats.volume} kind="bar" />
            <Text style={ui.small}>Weight × reps from completed weighted sets. {stats.bucketSize === 1 ? 'Daily totals.' : `Totals grouped in ${stats.bucketSize}-day intervals; the final interval may be shorter.`}</Text>
          </Card>
          <Card>
            <View style={ui.between}>
              <Text style={[ui.heading, { flexShrink: 1 }]}>Heaviest weight</Text>
              <Icon name="award" color={colors.accent} size={26} />
            </View>
            {stats.selected ? <>
              <Text style={ui.small}>Choose an exercise</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {stats.options.map((exercise) => <Chip key={exercise.id} label={exercise.name} selected={stats.selected?.id === exercise.id} onPress={() => setExerciseId(exercise.id)} />)}
              </ScrollView>
              <Text style={ui.title}>{formatNumber(stats.best!)} <Text style={ui.muted}>kg</Text></Text>
              <Text style={ui.small}>Best in this period · {stats.selected.name}</Text>
              <TrendChart key={`weight-${days}-${stats.end}-${stats.selected.id}`} points={stats.weight} kind="line" />
              <Text style={ui.small}>Heaviest completed weighted set each training day.{stats.weight.length === 1 ? ' Log another day to see a trend.' : ''}</Text>
            </> : <Text style={ui.muted}>Complete a weighted set to see your weight trend. Bodyweight sets don’t have a recorded load.</Text>}
          </Card>
        </>}
        <Text style={[ui.small, { textAlign: 'center' }]}>Based on completed workouts saved on this device.</Text>
      </>}
    </Screen>
  );
}
