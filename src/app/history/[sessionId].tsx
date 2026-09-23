import { useLocalSearchParams } from 'expo-router';
import { SessionDetail } from '@/features/history/session-detail';
export default function HistoryDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <SessionDetail sessionId={sessionId} />;
}
