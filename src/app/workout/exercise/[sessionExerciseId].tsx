import { usePreventRemove } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Badge, Button, Header, Loading, Notice, Screen } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { SetEditor } from '@/features/workout/set-editor';
import { useLocalQuery } from '@/hooks/use-local-query';
import { displayDate, errorMessage } from '@/utils/display';

export default function ExerciseScreen() {
  const { ui } = useTheme();
  const { sessionExerciseId } = useLocalSearchParams<{ sessionExerciseId: string }>();
  const { data, error, reload, repositories } = useLocalQuery(
    useCallback(
      async (r: Repositories) => {
        const comparison = await r.history.compare(sessionExerciseId);
        const session = comparison
          ? await r.history.session(comparison.current.session_id)
          : null;
        return { comparison, session };
      },
      [sessionExerciseId],
    ),
  );
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const report = useCallback(
    (id: string, value: boolean) => setDirty((items) => ({ ...items, [id]: value })),
    [],
  );
  const unsaved = Object.values(dirty).some(Boolean);
  usePreventRemove(unsaved, () =>
    Alert.alert(
      'Keep your set safe',
      'A set is still saving or needs attention. Wait for it to save, or retry the highlighted set before leaving.',
    ),
  );
  async function act(work: () => Promise<unknown>) {
    if (busy || unsaved) return;
    setBusy(true);
    setActionError(null);
    try {
      await work();
      await reload();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const comparison = data?.comparison;
  const exercise = comparison?.current;
  const active = data?.session?.status === 'active';
  return (
    <Screen
      footer={
        exercise && active ? (
          <Button
            title="Complete exercise"
            icon="check"
            loading={busy}
            disabled={unsaved}
            onPress={() =>
              void act(async () => {
                await repositories!.workouts.completeExercise(exercise.id);
                router.back();
              })
            }
          />
        ) : undefined
      }
    >
      <Header
        title="Log your sets"
        back
        right={exercise && <Badge>{exercise.muscle_group.toUpperCase()}</Badge>}
      />
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {!data && !error && <Loading />}
      {data && !exercise && <Notice message="This exercise could not be found." />}
      {exercise && (
        <>
          <View style={ui.smallStack}>
            <Text style={ui.title}>{exercise.exercise_name}</Text>
            <Text style={ui.muted}>
              {comparison.previous
                ? `Last performed ${displayDate(comparison.previous.workout_date, true)}`
                : 'A fresh starting point. Make your first set count.'}
            </Text>
          </View>
          <Notice
            message={
              comparison.previous
                ? 'Last time is your reference. Today starts blank. Your entries save as you type.'
                : 'Your entries save as you type. Leave anything you haven’t recorded blank.'
            }
          />
          {!active && (
            <Notice message="This workout is complete. Its records are read-only." />
          )}
          {actionError && <Notice error message={actionError} />}
          {exercise.sets.map((set, index) => (
            <SetEditor
              key={set.id}
              set={set}
              showPrevious={!!comparison.previous}
              previous={comparison.previous?.sets[index]}
              report={report}
              locked={busy || !active}
              save={(input) => repositories!.workouts.saveSet(set.id, input)}
              remove={() => void act(() => repositories!.workouts.removeSet(set.id))}
            />
          ))}
          {active && (
            <>
              <Button
                title="Add set"
                icon="plus"
                secondary
                disabled={busy || unsaved}
                onPress={() => void act(() => repositories!.workouts.addSet(exercise.id))}
              />
              <Button
                title="Skip this exercise"
                secondary
                disabled={busy || unsaved}
                onPress={() =>
                  void act(async () => {
                    await repositories!.workouts.skipExercise(exercise.id);
                    router.back();
                  })
                }
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
