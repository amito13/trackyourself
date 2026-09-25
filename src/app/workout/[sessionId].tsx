import { MuscleArt } from '@/components/workout/muscle-art';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Header,
  Icon,
  Loading,
  Notice,
  Screen,
  Section,
} from '@/components/ui';
import { useTheme } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { LocalStatus } from '@/features/app/local-status';
import { useLocalQuery } from '@/hooks/use-local-query';
import { errorMessage } from '@/utils/display';
export default function WorkoutScreen() {
  const { colors, ui } = useTheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { data, error, reload, repositories } = useLocalQuery(
    useCallback(
      async (r: Repositories) => ({
        session: await r.history.session(sessionId),
        library: await r.exercises.list(),
      }),
      [sessionId],
    ),
  );
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function action(work: () => Promise<unknown>) {
    if (busy) return;
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
  const session = data?.session;
  const completed =
    session?.exercises.filter((e) => e.status === 'completed').length ?? 0;
  return (
    <Screen
      footer={
        session?.status === 'active' ? (
          <Button
            title="Finish workout"
            icon="check"
            onPress={() => setFinishing(true)}
            disabled={busy}
          />
        ) : undefined
      }
    >
      <Header
        title="Your session"
        back
        onBack={() => router.replace('/home')}
        right={
          session && (
            <Badge>{session.status === 'active' ? 'IN PROGRESS' : 'COMPLETE'}</Badge>
          )
        }
      />
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {!data && !error && <Loading />}
      {data && !session && (
        <Notice message="This workout could not be found on this device." />
      )}
      {session && (
        <>
          <View style={ui.smallStack}>
            <Text style={ui.title}>{session.title}</Text>
            <Text style={ui.muted}>
              {completed} of {session.exercises.length} exercises complete
            </Text>
          </View>
          <View style={{ height: 5, borderRadius: 5, backgroundColor: colors.border }}>
            <View
              style={{
                height: 5,
                borderRadius: 5,
                backgroundColor: colors.accent,
                width: `${session.exercises.length ? (completed / session.exercises.length) * 100 : 0}%`,
              }}
            />
          </View>
          <LocalStatus />
          {actionError && <Notice error message={actionError} />}
          {finishing && (
            <Card style={{ borderColor: colors.accent }}>
              <Text style={ui.heading}>Ready to call it a day?</Text>
              <Text style={ui.muted}>
                All entered values will be kept, including blank fields. Finished workouts
                are read-only.
              </Text>
              <Button
                title="Finish & save workout"
                loading={busy}
                onPress={() =>
                  void action(async () => {
                    await repositories!.workouts.finish(sessionId);
                    router.replace({
                      pathname: '/workout/summary/[sessionId]',
                      params: { sessionId },
                    });
                  })
                }
              />
              <Button
                title="Keep training"
                secondary
                disabled={busy}
                onPress={() => setFinishing(false)}
              />
            </Card>
          )}
          <Section title="Your exercises" />
          {session.exercises.map((exercise, index) => (
            <Pressable
              key={exercise.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname:
                    session.status === 'active'
                      ? '/workout/exercise/[sessionExerciseId]'
                      : '/history/exercise/[sessionExerciseId]',
                  params: { sessionExerciseId: exercise.id },
                })
              }
            >
              <Card>
                <View style={ui.row}>
                  <MuscleArt groups={[exercise.muscle_group]} size={60} />
                  <View style={ui.flex}>
                    <Text style={ui.small}>
                      {String(index + 1).padStart(2, '0')} /{' '}
                      {exercise.muscle_group.toUpperCase()}
                    </Text>
                    <Text style={[ui.body, { fontWeight: '700' }]}>
                      {exercise.exercise_name}
                    </Text>
                    <Text style={ui.small}>
                      {exercise.status === 'skipped'
                        ? 'Skipped'
                        : `${exercise.sets.filter((s) => s.completed).length} sets recorded`}
                    </Text>
                  </View>
                  <Icon
                    name={
                      exercise.status === 'completed' ? 'check-circle' : 'chevron-right'
                    }
                    color={
                      exercise.status === 'completed' ? colors.success : colors.muted
                    }
                  />
                </View>
              </Card>
            </Pressable>
          ))}
          {session.status === 'active' && (
            <Button
              title={adding ? 'Close exercise library' : 'Add an exercise'}
              icon={adding ? 'x' : 'plus'}
              secondary
              onPress={() => setAdding(!adding)}
            />
          )}
          {adding && (
            <View style={ui.stack}>
              <TextInput
                style={ui.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Find an exercise…"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Find an exercise"
              />
              {data.library
                .filter(
                  (e) =>
                    !session.exercises.some((s) => s.exercise_id === e.id) &&
                    e.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((e) => (
                  <Pressable
                    key={e.id}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() =>
                      void action(async () => {
                        await repositories!.workouts.addExercise(sessionId, e.id);
                        setAdding(false);
                      })
                    }
                  >
                    <Card>
                      <View style={ui.between}>
                        <View style={ui.flex}>
                          <Text style={ui.body}>{e.name}</Text>
                          <Text style={ui.small}>{e.muscle_group}</Text>
                        </View>
                        <Icon name="plus" color={colors.accent} />
                      </View>
                    </Card>
                  </Pressable>
                ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
