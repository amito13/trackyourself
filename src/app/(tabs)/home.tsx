import { Image } from 'expo-image';
import { MuscleArt, savedBodyParts } from '@/components/workout/muscle-art';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Badge,
  Brand,
  Button,
  Card,
  Empty,
  Icon,
  IconButton,
  Loading,
  Notice,
  Screen,
  Section,
} from '@/components/ui';
import { weekdays, useTheme } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { LocalStatus } from '@/features/app/local-status';
import { useLocalQuery } from '@/hooks/use-local-query';
import { displayDate, errorMessage } from '@/utils/display';

export default function HomeScreen() {
  const { colors, ui, mode } = useTheme();
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
      <View style={ui.between}>
        <View style={ui.flex}><Brand /></View>
        <IconButton name="settings" label="Open profile and appearance" onPress={() => router.push('/profile')} />
      </View>
      <View style={{ minHeight: 238, borderRadius: 24, overflow: 'hidden', justifyContent: 'center', padding: 18, backgroundColor: colors.background }}>
        <Image source={require('../../../assets/images/outdo/hero.png')} contentFit="cover"
          style={{ position: 'absolute', inset: 0, opacity: mode === 'dark' ? 0.65 : 0.13 }} accessible={false} />
        <View style={{ gap: 16, width: '82%' }}>
          <Text style={ui.muted}>{displayDate(now.toISOString())}</Text>
          <Text style={[ui.title, { fontSize: 34, lineHeight: 41 }]}>
            Let’s get{'\n'}after it{data?.profile?.name ? ', ' : '.'}
            {!!data?.profile?.name && <Text style={{ color: colors.accent }}>{data.profile.name.split(' ')[0]}.</Text>}
          </Text>
          <Text style={[ui.muted, { maxWidth: 210 }]}>Small steps today.{'\n'}Stronger you tomorrow.</Text>
        </View>
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
              const calendarDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday + index + 1);
              return (
                <View
                  key={name}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 13,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: today ? colors.accent : colors.border,
                    backgroundColor: today ? colors.accent : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: today ? colors.onAccent : colors.muted,
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {name.slice(0, 1)}
                  </Text>
                  <Text style={{ color: today ? colors.onAccent : colors.text, fontSize: 16, fontWeight: '700' }}>{calendarDay.getDate()}</Text>
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: training
                        ? today
                          ? colors.onAccent
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
            trailing={data.plan ? <IconButton name="calendar" label="View workout plan" onPress={() => router.push('/plan/edit')} /> : undefined}
          />
          {data.active ? (
            <Card style={{ borderColor: colors.accentBorder }}>
              <Badge>IN PROGRESS</Badge>
              <View style={ui.row}><MuscleArt groups={savedBodyParts(data.active.body_parts)} size={70} /><Text style={[ui.heading, ui.flex]}>{data.active.title}</Text></View>
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
            <Card style={{ borderColor: colors.success, backgroundColor: colors.successSoft }}>
              <Badge green>WORKOUT COMPLETE</Badge>
              <View style={ui.row}>
                <View style={[ui.flex, ui.smallStack]}>
                  <Text style={ui.heading}>You showed up.</Text>
                  <Text style={ui.muted}>Today’s work is in the books. Take a look at your session.</Text>
                </View>
                <Image source={require('../../../assets/images/outdo/complete.png')} contentFit="contain"
                  style={{ width: 92, height: 92, borderRadius: 18 }} accessible={false} />
              </View>
              <Button
                title="View workout"
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
            <Card style={{ borderColor: colors.accentBorder }}>
              <View style={ui.between}>
                <Badge>{weekdays[weekday - 1].toUpperCase()}</Badge>
                <Icon name="arrow-up-right" color={colors.accent} />
              </View>
              <View style={ui.row}><MuscleArt groups={data.today.bodyParts} size={76} /><Text style={[ui.heading, ui.flex]}>{data.today.bodyParts.join(' + ')}</Text></View>
              <Text style={ui.muted}>
                {data.today.exercises.length} exercises · your pace
              </Text>
              <View style={ui.rule} />
              {data.today.exercises.map((exercise) => (
                <View style={ui.row} key={exercise.id}>
                  <MuscleArt groups={[exercise.muscle_group]} size={48} />
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
          <Section title="Your progress" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Analyze your progress"
            onPress={() => router.push('/analyze')}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Card>
              <View style={ui.row}>
                <Icon name="bar-chart-2" color={colors.accent} size={26} />
                <View style={ui.flex}>
                  <Text style={ui.heading}>Every set adds up.</Text>
                  <Text style={ui.muted}>
                    See your volume, strength, and progress over time.
                  </Text>
                </View>
                <Icon name="chevron-right" color={colors.accent} />
              </View>
            </Card>
          </Pressable>
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
                    <MuscleArt groups={savedBodyParts(data.recent[0].body_parts)} size={56} />
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
