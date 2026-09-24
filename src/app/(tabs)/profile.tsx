import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Button,
  Card,
  Header,
  Icon,
  Loading,
  Notice,
  Screen,
  Section,
} from '@/components/ui';
import { colors, ui, weekdays } from '@/constants/theme';
import type { Repositories } from '@/db/repositories';
import { useData } from '@/features/app/data-context';
import { LocalStatus } from '@/features/app/local-status';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useAuthStore } from '@/state/auth-store';
import { errorMessage } from '@/utils/display';
export default function ProfileScreen() {
  const { sync, syncNow } = useData();
  const signOut = useAuthStore((s) => s.signOut);
  const { data, error, reload } = useLocalQuery(
    useCallback(
      async (r: Repositories) => ({
        profile: await r.profile.get(),
        plan: await r.plans.get(),
      }),
      [],
    ),
  );
  const [busy, setBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  async function logout() {
    setBusy(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen tabs>
      <Header title="Profile" />
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
            <View
              style={{
                width: 82,
                height: 82,
                borderRadius: 28,
                backgroundColor: colors.accentSoft,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 32, color: colors.accent, fontWeight: '800' }}>
                {data.profile?.name?.slice(0, 1).toUpperCase() || 'A'}
              </Text>
            </View>
            <Text style={ui.heading}>{data.profile?.name || 'Athlete'}</Text>
            <Text style={ui.muted}>{data.profile?.email}</Text>
          </View>
          <Section
            title="My workout plan"
            trailing={<Icon name="calendar" color={colors.accent} />}
          />
          <Card>
            {data.plan?.days.map((day, index) => (
              <View key={day.id} style={ui.stack}>
                {index > 0 && <View style={ui.rule} />}
                <View style={ui.row}>
                  <View style={{ width: 44 }}>
                    <Text style={[ui.label, { color: colors.accent }]}>
                      {weekdays[day.day_of_week - 1].slice(0, 3).toUpperCase()}
                    </Text>
                  </View>
                  <View style={ui.flex}>
                    <Text style={[ui.body, { fontWeight: '600' }]}>
                      {day.bodyParts.join(' + ')}
                    </Text>
                    <Text style={ui.small}>{day.exercises.length} exercises</Text>
                  </View>
                </View>
              </View>
            ))}
            {!data.plan && <Text style={ui.muted}>Your routine starts with a plan.</Text>}
            <Button
              title={data.plan ? 'Edit workout plan' : 'Create workout plan'}
              icon="edit-2"
              secondary
              onPress={() => router.push(data.plan ? '/plan/edit' : '/onboarding')}
            />
          </Card>
          <Section title="Your data" />
          <Card>
            <LocalStatus />
            <Text style={ui.small}>
              {sync.pending} changes waiting to upload. Your data is saved on this device first.
            </Text>
          </Card>
          {sync.error && <Notice error message={sync.error} onRetry={syncNow} />}
          <Button title="Sync now" icon="upload-cloud" secondary loading={sync.status === 'syncing'} onPress={syncNow} />
          {signOutError && <Notice error message={signOutError} />}
          <Button
            title="Log out"
            icon="log-out"
            secondary
            loading={busy}
            onPress={() => void logout()}
          />
          <Text style={[ui.small, { textAlign: 'center' }]}>TRACK YOURSELF · v1.0.0</Text>
        </>
      )}
    </Screen>
  );
}
