import { router } from 'expo-router';
import { Button, Empty, Screen } from '@/components/ui';
export default function NotFoundScreen() {
  return (
    <Screen>
      <Empty
        icon="compass"
        title="Let’s get you back on track"
        detail="That screen isn’t available. Your saved workouts are still there."
        action={<Button title="Go to the start" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
