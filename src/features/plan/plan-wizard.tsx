import { MuscleArt } from '@/components/workout/muscle-art';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Chip,
  Header,
  Icon,
  Loading,
  Notice,
  Screen,
  Section,
} from '@/components/ui';
import { bodyParts, weekdays, useTheme } from '@/constants/theme';
import type { Exercise, PlanInput, Repositories } from '@/db/repositories';
import { useLocalQuery } from '@/hooks/use-local-query';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/utils/display';

export function PlanWizard({ editing = false }: { editing?: boolean }) {
  const { colors, ui } = useTheme();
  const {
    repositories,
    data,
    error: queryError,
    reload,
  } = useLocalQuery(
    useCallback(
      async (r: Repositories) => ({
        plan: await r.plans.get(),
        exercises: await r.exercises.list(),
      }),
      [],
    ),
  );
  const [draft, setDraft] = useState<PlanInput[]>([]);
  const [step, setStep] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const [fetching, setFetching] = useState(false);
  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setLibrary(data.exercises);
    if (data.plan)
      setDraft(
        data.plan.days.map((day) => ({
          dayOfWeek: day.day_of_week,
          bodyParts: day.bodyParts,
          exerciseIds: day.exercises.map((e) => e.id),
        })),
      );
  }, [data]);
  async function fetchLibrary() {
    if (!repositories) return;
    setFetching(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await supabase
        .from('exercises')
        .select(
          'id,name,muscle_group,image_url,tracking_type,default_weight_type,deleted_at',
        )
        .is('deleted_at', null)
        .abortSignal(controller.signal);
      if (result.error) throw result.error;
      if (!result.data?.length)
        throw new Error('No exercises are available yet. Please try again later.');
      const items = result.data as Exercise[];
      await repositories.exercises.cache(items);
      setLibrary(items);
    } catch {
      setError(
        'Connect to the internet to download the exercise library, then try again.',
      );
    } finally {
      clearTimeout(timeout);
      setFetching(false);
    }
  }
  const day = draft[dayIndex];
  const parts = Array.from(
    new Set([...bodyParts, ...library.map((e) => e.muscle_group)]),
  );
  function updateDay(update: Partial<PlanInput>) {
    setDraft((previous) =>
      previous.map((item, i) => (i === dayIndex ? { ...item, ...update } : item)),
    );
  }
  function toggleDay(dayOfWeek: number) {
    setDraft((previous) =>
      previous.some((day) => day.dayOfWeek === dayOfWeek)
        ? previous.filter((day) => day.dayOfWeek !== dayOfWeek)
        : [...previous, { dayOfWeek, bodyParts: [], exerciseIds: [] }].sort(
            (a, b) => a.dayOfWeek - b.dayOfWeek,
          ),
    );
  }
  function back() {
    setError(null);
    if (step > 0) {
      setStep((n) => n - 1);
      setDayIndex(0);
    } else if (editing) router.back();
    else router.replace('/(auth)/sign-in');
  }
  const valid =
    step === 0
      ? draft.length > 0
      : step === 1
        ? draft.every((d) => d.bodyParts.length > 0)
        : draft.every((d) =>
            d.bodyParts.every((part) =>
              d.exerciseIds.some((id) =>
                library.some((e) => e.id === id && e.muscle_group === part),
              ),
            ),
          );
  async function next() {
    if (!valid || !repositories) return;
    setError(null);
    if (step < 2) {
      setStep(step + 1);
      setDayIndex(0);
      setSearch('');
      return;
    }
    setBusy(true);
    try {
      await repositories.plans.save(draft);
      router.replace(editing ? '/profile' : '/home');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      footer={
        <>
          <Text style={[ui.small, { textAlign: 'center' }]}>
            {step === 0
              ? `${draft.length} training days selected`
              : step === 1
                ? 'Choose body parts for every selected day'
                : 'Sets, reps and weight come during your workout'}
          </Text>
          <Button
            title={
              step < 2 ? 'Continue' : editing ? 'Save changes' : 'Let’s get training'
            }
            icon="arrow-right"
            onPress={() => void next()}
            loading={busy}
            disabled={!valid || !data}
          />
        </>
      }
    >
      <Header
        title={editing ? 'Edit your plan' : 'Your starting point'}
        back={editing || step > 0}
        onBack={back}
        right={<Text style={ui.small}>0{step + 1} / 03</Text>}
      />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2].map((n) => (
          <View
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              backgroundColor: n <= step ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>
      <View style={ui.smallStack}>
        <Text style={ui.title}>
          {
            [
              'Make room\nfor your stronger self.',
              'Your days.\nYour split.',
              'Choose your\ngo-to exercises.',
            ][step]
          }
        </Text>
        <Text style={ui.muted}>
          {
            [
              'Which days do you train? Build a week that works for you.',
              'One muscle group or a few. Make each day your own.',
              'Start with what you know. You can always change it later.',
            ][step]
          }
        </Text>
      </View>
      {queryError && <Notice error message={queryError} onRetry={() => void reload()} />}
      {!data && !queryError && <Loading />}
      {error && <Notice error message={error} />}
      {data && step === 0 && (
        <View style={{ gap: 10 }}>
          {weekdays.map((name, index) => {
            const selected = draft.some((d) => d.dayOfWeek === index + 1);
            return (
              <Pressable
                key={name}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleDay(index + 1)}
                style={[
                  ui.between,
                  {
                    padding: 18,
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={[ui.body, { fontWeight: '600' }]}>{name}</Text>
                <Icon
                  name={selected ? 'check-square' : 'square'}
                  color={selected ? colors.accent : colors.muted}
                />
              </Pressable>
            );
          })}
        </View>
      )}
      {data && step > 0 && day && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {draft.map((item, i) => (
              <Chip
                key={item.dayOfWeek}
                label={weekdays[item.dayOfWeek - 1].slice(0, 3)}
                selected={i === dayIndex}
                onPress={() => {
                  setDayIndex(i);
                  setSearch('');
                }}
              />
            ))}
          </View>
          <Section
            title={weekdays[day.dayOfWeek - 1]}
            trailing={
              <Badge>
                {step === 1
                  ? `${day.bodyParts.length} SELECTED`
                  : `${day.exerciseIds.length} EXERCISES`}
              </Badge>
            }
          />
          {step === 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {parts.map((part) => (
                <Chip
                  key={part}
                  label={part}
                  selected={day.bodyParts.includes(part)}
                  onPress={() => {
                    const selected = day.bodyParts.includes(part);
                    updateDay({
                      bodyParts: selected
                        ? day.bodyParts.filter((p) => p !== part)
                        : [...day.bodyParts, part],
                      exerciseIds: selected
                        ? day.exerciseIds.filter(
                            (id) =>
                              !library.some(
                                (e) => e.id === id && e.muscle_group === part,
                              ),
                          )
                        : day.exerciseIds,
                    });
                  }}
                />
              ))}
            </View>
          ) : (
            <>
              {!library.length ? (
                <Card>
                  <Text style={ui.heading}>Your exercise library</Text>
                  <Text style={ui.muted}>
                    Download the library once to choose exercises and keep training
                    offline.
                  </Text>
                  <Button
                    title="Load exercises"
                    icon="download"
                    onPress={() => void fetchLibrary()}
                    loading={fetching}
                  />
                </Card>
              ) : (
                <>
                  <Button
                    title="Refresh exercises"
                    icon="download"
                    onPress={() => void fetchLibrary()}
                    loading={fetching}
                  />
                  <TextInput
                    style={ui.input}
                    placeholder="Search exercises…"
                    placeholderTextColor={colors.muted}
                    value={search}
                    onChangeText={setSearch}
                    accessibilityLabel="Search exercises"
                  />
                  {day.bodyParts.map((part) => (
                    <View key={part} style={ui.smallStack}>
                      <Section title={part} />
                      {library
                        .filter(
                          (e) =>
                            e.muscle_group === part &&
                            e.name.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map((exercise) => {
                          const selected = day.exerciseIds.includes(exercise.id);
                          return (
                            <Pressable
                              key={exercise.id}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected }}
                              onPress={() =>
                                updateDay({
                                  exerciseIds: selected
                                    ? day.exerciseIds.filter((id) => id !== exercise.id)
                                    : [...day.exerciseIds, exercise.id],
                                })
                              }
                              style={[
                                ui.row,
                                {
                                  padding: 14,
                                  borderRadius: 14,
                                  backgroundColor: colors.surface,
                                  borderWidth: 1,
                                  borderColor: selected ? colors.accent : colors.border,
                                },
                              ]}
                            >
                              <MuscleArt groups={[exercise.muscle_group]} size={46} />
                              <View style={ui.flex}>
                                <Text style={[ui.body, { fontWeight: '600' }]}>
                                  {exercise.name}
                                </Text>
                                <Text style={ui.small}>
                                  {exercise.tracking_type === 'duration'
                                    ? 'Time based'
                                    : 'Reps'}{' '}
                                  ·{' '}
                                  {exercise.default_weight_type === 'bodyweight'
                                    ? 'Bodyweight'
                                    : 'Weighted'}
                                </Text>
                              </View>
                              <Icon
                                name={selected ? 'check-square' : 'square'}
                                color={selected ? colors.accent : colors.muted}
                              />
                            </Pressable>
                          );
                        })}
                      {!library.some(
                        (e) =>
                          e.muscle_group === part &&
                          e.name.toLowerCase().includes(search.toLowerCase()),
                      ) && <Text style={ui.muted}>No matching exercises.</Text>}
                    </View>
                  ))}
                </>
              )}
            </>
          )}
          <Text style={ui.small}>
            {
              draft.filter((d) =>
                step === 1 ? d.bodyParts.length : d.exerciseIds.length,
              ).length
            }{' '}
            of {draft.length} days configured
          </Text>
        </>
      )}
    </Screen>
  );
}
