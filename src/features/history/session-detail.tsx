import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ExerciseMark,
  Header,
  Icon,
  Loading,
  Metric,
  Notice,
  Screen,
  Section,
} from '@/components/ui';
import { colors, ui } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { useLocalQuery } from '@/hooks/use-local-query';
import { displayDate } from '@/utils/display';
export function SessionDetail({
  sessionId,
  summary = false,
}: {
  sessionId: string;
  summary?: boolean;
}) {
  const { data, error, reload } = useLocalQuery(
    useCallback((r: Repositories) => r.history.session(sessionId), [sessionId]),
  );
  return (
    <Screen
      footer={
        summary ? (
          <Button
            title="Done"
            icon="arrow-right"
            onPress={() => router.replace('/home')}
          />
        ) : undefined
      }
    >
      <Header title={summary ? 'Session saved' : 'Workout details'} back={!summary} />
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {data === undefined && !error && <Loading />}
      {data === null && (
        <Notice message="This workout could not be found on this device." />
      )}
      {data && (
        <>
          {summary ? (
            <View style={{ alignItems: 'center', paddingVertical: 22, gap: 16 }}>
              <View
                style={{
                  padding: 24,
                  borderRadius: 50,
                  backgroundColor: colors.successSoft,
                }}
              >
                <Icon name="check" color={colors.success} size={40} />
              </View>
              <Badge green>WORKOUT COMPLETE</Badge>
              <Text style={[ui.title, { textAlign: 'center' }]}>
                You put in{'\n'}the work.
              </Text>
              <Text style={ui.muted}>Another session. Another step forward.</Text>
            </View>
          ) : (
            <View style={ui.smallStack}>
              <Text style={ui.muted}>{displayDate(data.workout_date)}</Text>
              <Text style={ui.title}>{data.title}</Text>
              <Badge green>
                {data.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
              </Badge>
            </View>
          )}
          {summary && (
            <Text style={[ui.heading, { textAlign: 'center' }]}>{data.title}</Text>
          )}
          <Card>
            <View style={ui.row}>
              <Metric
                value={data.exercises.filter((e) => e.status === 'completed').length}
                label="exercises"
              />
              <Metric value={data.completedSets} label="sets recorded" />
              <Metric
                value={
                  data.durationSeconds !== null
                    ? Math.floor(data.durationSeconds / 60)
                    : '—'
                }
                label="minutes"
              />
            </View>
          </Card>
          {summary && (
            <Notice message="Saved on this device. Your workout is ready to revisit in Previous Data." />
          )}
          <Section title="The breakdown" />
          {data.exercises.map((exercise) => (
            <Pressable
              accessibilityRole="button"
              key={exercise.id}
              onPress={() =>
                router.push({
                  pathname: '/history/exercise/[sessionExerciseId]',
                  params: { sessionExerciseId: exercise.id },
                })
              }
            >
              <Card>
                <View style={ui.row}>
                  <ExerciseMark small />
                  <View style={ui.flex}>
                    <Text style={[ui.body, { fontWeight: '700' }]}>
                      {exercise.exercise_name}
                    </Text>
                    <Text style={ui.small}>
                      {exercise.status === 'skipped'
                        ? 'Skipped'
                        : `${exercise.sets.filter((set) => set.completed).length} recorded sets · ${exercise.muscle_group}`}
                    </Text>
                  </View>
                  <Icon name="chevron-right" />
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
