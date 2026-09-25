import { MuscleArt, savedBodyParts } from '@/components/workout/muscle-art';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Empty,
  Brand,
  Section,
  Icon,
  Loading,
  Notice,
  Screen,
} from '@/components/ui';
import { useTheme } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { useLocalQuery } from '@/hooks/use-local-query';
import { displayDate } from '@/utils/display';
export default function HistoryScreen() {
  const { colors, ui } = useTheme();
  const [page, setPage] = useState(0);
  const { data, error, reload } = useLocalQuery(
    useCallback((r: Repositories) => r.history.list(20, page * 20), [page]),
  );
  return (
    <Screen tabs>
      <Brand />
      <Section title="Previous data" />
      <View style={ui.smallStack}>
        <Text style={ui.title}>Your work, <Text style={{ color: colors.accent }}>recorded.</Text></Text>
        <Text style={ui.muted}>Every session. Every set. All in one place.</Text>
      </View>
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {!data && !error && <Loading />}
      {data?.length === 0 && (
        <Empty
          icon="clock"
          title={page ? 'You’re all caught up' : 'Your first chapter awaits'}
          detail={
            page
              ? 'No older workouts to show.'
              : 'Finish your first workout and you’ll find it here. Your future self will thank you.'
          }
          action={
            <Button
              title={page ? 'Previous page' : 'Go to today'}
              secondary
              onPress={() => (page ? setPage((p) => p - 1) : router.push('/home'))}
            />
          }
        />
      )}
      {!!data?.length && <Section title="Sessions" trailing={<Text style={ui.small}>Latest first</Text>} />}
      {data?.map((session) => (
        <Pressable
          key={session.id}
          accessibilityRole="button"
          accessibilityLabel={`View ${session.title}, ${displayDate(session.workout_date)}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          onPress={() =>
            router.push({
              pathname: '/history/[sessionId]',
              params: { sessionId: session.id },
            })
          }
        >
          <Card style={{ padding: 14 }}>
            <View style={ui.row}>
              <MuscleArt groups={savedBodyParts(session.body_parts)} size={66} />
              <View style={[ui.flex, { gap: 6 }]}>
                <Text style={ui.small}>{displayDate(session.workout_date)}</Text>
                <Text style={[ui.body, { fontWeight: '700', fontSize: 17 }]}>{session.title}</Text>
                <Badge green>COMPLETED</Badge>
              </View>
              <Icon name="chevron-right" />
            </View>
          </Card>
        </Pressable>
      ))}
      {!!data?.length && (
        <View style={ui.row}>
          {page > 0 && (
            <View style={ui.flex}>
              <Button title="Newer" secondary onPress={() => setPage((p) => p - 1)} />
            </View>
          )}
          {data.length === 20 && (
            <View style={ui.flex}>
              <Button title="Older" secondary onPress={() => setPage((p) => p + 1)} />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
