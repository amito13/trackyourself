import type { ExerciseSet } from '@/db/repositories';
export function displayDate(value: string, short = false) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: short ? 'short' : 'long',
    ...(!short ? { weekday: 'long' as const } : {}),
  });
}
export function setLabel(set?: ExerciseSet) {
  if (!set) return '—';
  const effort =
    set.tracking_type === 'duration'
      ? `${set.duration_seconds ?? '—'} sec`
      : `${set.reps ?? '—'} reps`;
  return `${set.weight_type === 'bodyweight' ? 'BW' : `${set.weight_kg ?? '—'} kg`} × ${effort}`;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}
