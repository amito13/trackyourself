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
import { weekdays, useTheme } from '@/constants/theme';
import { brand } from '@/constants/brand';
import { AppearanceSetting } from '@/features/appearance/appearance-setting';
import type { Repositories } from '@/db/repositories';
import { LocalStatus } from '@/features/app/local-status';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useAuthStore } from '@/state/auth-store';
import { errorMessage } from '@/utils/display';
export default function ProfileScreen() {
  const { colors, ui } = useTheme();
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
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
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
  async function removeAccount() {
    if (deleting || busy) return;
    setDeleting(true);
    setSignOutError(null);
    try {
      await deleteAccount();
    } catch (error) {
      setSignOutError(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }
  return (
    <Screen tabs>
      <Header title="Profile" />
      {error && <Notice error message={error} onRetry={() => void reload()} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <View style={{ alignItems: 'center', flexShrink: 0, gap: 12, paddingVertical: 16 }}>
            <View
              style={{
                width: 82,
                height: 82,
                flexShrink: 0,
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
            <Text style={[ui.heading, { alignSelf: 'stretch', textAlign: 'center' }]}>
              {data.profile?.name || 'Athlete'}
            </Text>
            <Text style={[ui.muted, { alignSelf: 'stretch', textAlign: 'center' }]}>
              {data.profile?.email}
            </Text>
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
          <AppearanceSetting />
          <Section title="Your data" />
          <Card>
            <LocalStatus />
            <Text style={ui.small}>
              Your progress saves automatically. Offline changes upload when you’re back online.
            </Text>
          </Card>
          {signOutError && <Notice error message={signOutError} />}
          <Button
            title="Log out"
            icon="log-out"
            secondary
            loading={busy}
            disabled={deleting}
            onPress={() => void logout()}
          />
          <Button
            title="Delete account"
            icon="trash-2"
            destructive
            disabled={busy || deleting || confirmDelete}
            onPress={() => setConfirmDelete(true)}
          />
          {confirmDelete && (
            <Card>
              <Text style={ui.heading}>Permanently delete your account?</Text>
              <Text style={ui.body}>
                Your account, workout plans, history, and saved progress will be permanently
                deleted, including offline changes on this device. This cannot be undone.
              </Text>
              <Button title="Cancel" secondary disabled={deleting}
                onPress={() => setConfirmDelete(false)} />
              <Button title="Permanently delete account" icon="trash-2" destructive
                loading={deleting} onPress={() => void removeAccount()} />
            </Card>
          )}
          <View style={[ui.smallStack, { alignItems: 'center' }]}>
            <Text style={[ui.label, { color: colors.text }]}>{brand.name} · v1.0.0</Text>
            <Text style={[ui.small, { textAlign: 'center' }]}>{brand.tagline}</Text>
          </View>
        </>
      )}
    </Screen>
  );
}
