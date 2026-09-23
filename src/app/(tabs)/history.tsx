import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Empty,
  ExerciseMark,
  Header,
  Icon,
  Loading,
  Notice,
  Screen,
} from '@/components/ui';
import { ui } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { useLocalQuery } from '@/hooks/use-local-query';
import { displayDate } from '@/utils/display';
export default function HistoryScreen() {
  const [page, setPage] = useState(0);
  const { data, error, reload } = useLocalQuery(
    useCallback((r: Repositories) => r.history.list(20, page * 20), [page]),
  );
  return (
    <Screen tabs>
      <Header title="Previous data" />
      <View style={ui.smallStack}>
        <Text style={ui.title}>Your work,{'\n'}recorded.</Text>
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
      {data?.map((session) => (
        <Pressable
          key={session.id}
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/history/[sessionId]',
              params: { sessionId: session.id },
            })
          }
        >
          <Card>
            <View style={ui.between}>
              <Text style={ui.small}>{displayDate(session.workout_date)}</Text>
              <Badge green>COMPLETE</Badge>
            </View>
            <View style={ui.row}>
              <ExerciseMark />
              <View style={ui.flex}>
                <Text style={ui.heading}>{session.title}</Text>
                <Text style={ui.small}>View sets & compare performance</Text>
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
