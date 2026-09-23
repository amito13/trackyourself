import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Badge,
  Brand,
  Button,
  Card,
  Empty,
  ExerciseMark,
  Icon,
  Loading,
  Notice,
  Screen,
  Section,
} from '@/components/ui';
import { colors, ui, weekdays } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { LocalStatus } from '@/features/app/local-status';
import { useLocalQuery } from '@/hooks/use-local-query';
import { displayDate, errorMessage } from '@/utils/display';

export default function HomeScreen() {
  const { data, error, reload, repositories } = useLocalQuery(
    useCallback(
      async (r: Repositories) => ({
        profile: await r.profile.get(),
        plan: await r.plans.get(),
        today: await r.workouts.today(),
        active: await r.workouts.active(),
        recent: await r.history.list(1),
      }),
      [],
    ),
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function start() {
    if (!repositories) return;
    setBusy(true);
    setActionError(null);
    try {
      const sessionId = await repositories.workouts.startOrResume();
      router.push({ pathname: '/workout/[sessionId]', params: { sessionId } });
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const now = new Date();
  const weekday = now.getDay() || 7;
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const finishedToday = data?.recent.find((session) => session.workout_date === date);
  const next = data?.plan?.days
    .slice()
    .sort(
      (a, b) => ((a.day_of_week - weekday + 6) % 7) - ((b.day_of_week - weekday + 6) % 7),
    )[0];
  return (
    <Screen tabs>
      <Brand />
      <View style={ui.smallStack}>
        <Text style={ui.muted}>{displayDate(now.toISOString())}</Text>
        <Text style={ui.title}>
          Let’s get after it
          {data?.profile?.name ? `,\n${data.profile.name.split(' ')[0]}.` : '.'}
        </Text>
      </View>
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {!data && !error && <Loading />}
      {actionError && <Notice error message={actionError} />}
      {data && (
        <>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {weekdays.map((name, index) => {
              const training = data.plan?.days.some((d) => d.day_of_week === index + 1);
              const today = weekday === index + 1;
              return (
                <View
                  key={name}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 13,
                    borderRadius: 12,
                    backgroundColor: today ? colors.accent : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: today ? colors.background : colors.muted,
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {name.slice(0, 1)}
                  </Text>
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: training
                        ? today
                          ? colors.background
                          : colors.accent
                        : colors.border,
                    }}
                  />
                </View>
              );
            })}
          </View>
          <Section
            title={data.active ? 'Pick up where you left off' : 'Today’s workout'}
          />
          {data.active ? (
            <Card style={{ borderColor: '#6D4830' }}>
              <Badge>IN PROGRESS</Badge>
              <Text style={ui.title}>{data.active.title}</Text>
              <Text style={ui.muted}>
                Started {displayDate(data.active.workout_date, true)}. Your sets are right
                where you left them.
              </Text>
              <Button
                title="Resume workout"
                icon="play"
                onPress={() => void start()}
                loading={busy}
              />
            </Card>
          ) : finishedToday ? (
            <Card>
              <Badge green>WORKOUT COMPLETE</Badge>
              <Text style={ui.heading}>You showed up.</Text>
              <Text style={ui.muted}>
                Today’s work is in the books. Take a look at your session.
              </Text>
              <Button
                title="View workout"
                secondary
                icon="arrow-right"
                onPress={() =>
                  router.push({
                    pathname: '/history/[sessionId]',
                    params: { sessionId: finishedToday.id },
                  })
                }
              />
            </Card>
          ) : data.today ? (
            <Card style={{ borderColor: '#6D4830' }}>
              <View style={ui.between}>
                <Badge>{weekdays[weekday - 1].toUpperCase()}</Badge>
                <Icon name="arrow-up-right" color={colors.accent} />
              </View>
              <Text style={ui.title}>{data.today.bodyParts.join(' + ')}</Text>
              <Text style={ui.muted}>
                {data.today.exercises.length} exercises · your pace
              </Text>
              <View style={ui.rule} />
              {data.today.exercises.map((exercise, i) => (
                <View style={ui.row} key={exercise.id}>
                  <Text style={[ui.small, { width: 22, fontVariant: ['tabular-nums'] }]}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text style={[ui.body, ui.flex]}>{exercise.name}</Text>
                </View>
              ))}
              <Button
                title="Start workout"
                icon="play"
                loading={busy}
                onPress={() => void start()}
              />
            </Card>
          ) : !data.plan ? (
            <Empty
              icon="calendar"
              title="Make it your routine"
              detail="Choose your training days and the exercises you want to work on."
              action={
                <Button
                  title="Build my plan"
                  onPress={() => router.push('/onboarding')}
                />
              }
            />
          ) : (
            <Card>
              <View style={ui.between}>
                <Badge>REST DAY</Badge>
                <Icon name="sun" size={30} color={colors.accent} />
              </View>
              <Text style={ui.title}>Recover today.{'\n'}Come back stronger.</Text>
              <Text style={ui.muted}>
                Recovery is part of progress. Enjoy the breathing room.
              </Text>
              {next && (
                <>
                  <View style={ui.rule} />
                  <Text style={ui.label}>
                    UP NEXT · {weekdays[next.day_of_week - 1].toUpperCase()}
                  </Text>
                  <Text style={ui.heading}>{next.bodyParts.join(' + ')}</Text>
                </>
              )}
            </Card>
          )}
          <LocalStatus />
          <Section
            title="Your progress"
            trailing={<Text style={ui.small}>Coming soon</Text>}
          />
          <Card>
            <View style={ui.row}>
              <Icon name="bar-chart-2" color={colors.accent} size={26} />
              <View style={ui.flex}>
                <Text style={ui.heading}>Every set adds up.</Text>
                <Text style={ui.muted}>
                  A bigger picture of your training is on the way.
                </Text>
              </View>
            </View>
          </Card>
          {!!data.recent.length && (
            <>
              <Section title="Last session" />
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/history/[sessionId]',
                    params: { sessionId: data.recent[0].id },
                  })
                }
              >
                <Card>
                  <View style={ui.row}>
                    <ExerciseMark small />
                    <View style={ui.flex}>
                      <Text style={ui.body}>{data.recent[0].title}</Text>
                      <Text style={ui.small}>
                        {displayDate(data.recent[0].workout_date, true)}
                      </Text>
                    </View>
                    <Icon name="chevron-right" />
                  </View>
                </Card>
              </Pressable>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
