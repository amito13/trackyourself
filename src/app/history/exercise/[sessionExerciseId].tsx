import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Badge, Card, Header, Loading, Notice, Screen } from '@/components/ui';
import { colors, ui } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { useLocalQuery } from '@/hooks/use-local-query';
import { displayDate, setLabel } from '@/utils/display';
export default function ComparisonScreen() {
  const { sessionExerciseId } = useLocalSearchParams<{ sessionExerciseId: string }>();
  const { data, error, reload } = useLocalQuery(
    useCallback(
      (r: Repositories) => r.history.compare(sessionExerciseId),
      [sessionExerciseId],
    ),
  );
  return (
    <Screen>
      <Header title="Exercise history" back />
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {data === undefined && !error && <Loading />}
      {data === null && <Notice message="This exercise could not be found." />}
      {data && (
        <>
          <View style={ui.smallStack}>
            <Badge>{data.current.muscle_group.toUpperCase()}</Badge>
            <Text style={ui.title}>{data.current.exercise_name}</Text>
            <Text style={ui.muted}>See how this session compares to your last.</Text>
          </View>
          {data.current.status === 'skipped' && (
            <Notice message="This exercise was skipped. Any entered values are retained below." />
          )}
          <Card>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 28 }} />
              <View style={ui.flex}>
                <Text style={[ui.label, { color: colors.accent }]}>THIS SESSION</Text>
                <Text style={ui.body}>
                  {displayDate(data.current.workout_date, true)}
                </Text>
              </View>
              <View style={ui.flex}>
                <Text style={ui.label}>PREVIOUS</Text>
                <Text style={ui.muted}>
                  {data.previous
                    ? displayDate(data.previous.workout_date, true)
                    : 'First time'}
                </Text>
              </View>
            </View>
            {Array.from(
              {
                length: Math.max(
                  data.current.sets.length,
                  data.previous?.sets.length ?? 0,
                ),
              },
              (_, i) => (
                <View key={i} style={ui.stack}>
                  <View style={ui.rule} />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={[ui.small, { width: 28 }]}>{i + 1}</Text>
                    <Text
                      style={[
                        ui.body,
                        ui.flex,
                        { color: colors.accent, fontVariant: ['tabular-nums'] },
                      ]}
                    >
                      {setLabel(data.current.sets[i])}
                    </Text>
                    <Text style={[ui.muted, ui.flex, { fontVariant: ['tabular-nums'] }]}>
                      {setLabel(data.previous?.sets[i])}
                    </Text>
                  </View>
                </View>
              ),
            )}
          </Card>
          {!data.previous && (
            <Notice message="There is no earlier completed performance for this exercise. This session is your starting point." />
          )}
          <Text style={ui.small}>
            Blank values mean no value was recorded. Completed workouts are read-only.
          </Text>
        </>
      )}
    </Screen>
  );
}
