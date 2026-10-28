import type { AnalyticsRow } from '@/db/repositories/analytics';

export type Period = 7 | 30 | 90;
export interface ChartPoint { date: string; value: number; endDate?: string }

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function shift(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
export function periodBounds(days: Period, today: string) {
  return { start: shift(today, 1 - days), previousStart: shift(today, 1 - days * 2), end: today };
}
export function shortDate(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
export function percentChange(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

export function buildStreak(trainingDates: string[], days: Period, today: string) {
  const dates = [...new Set(trainingDates.filter((date) => date <= today))].sort();
  const trained = new Set(dates);
  let best = 0;
  let run = 0;
  let previous: string | undefined;
  for (const date of dates) {
    run = previous && shift(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  let current = 0;
  let cursor = trained.has(today) ? today : shift(today, -1);
  while (trained.has(cursor)) {
    current++;
    cursor = shift(cursor, -1);
  }
  const { start } = periodBounds(days, today);
  const activity = Array.from({ length: days }, (_, offset) => {
    const date = shift(start, offset);
    return { date, trained: trained.has(date) };
  });
  const trainingDays = activity.filter((day) => day.trained).length;
  return { current, best, trainingDays, consistency: Math.round(trainingDays / days * 100), activity, trainedToday: trained.has(today) };
}

export function buildAnalytics(rows: AnalyticsRow[], days: Period, today: string, exerciseId?: string) {
  const bounds = periodBounds(days, today);
  const current = rows.filter((r) => r.workout_date >= bounds.start && r.workout_date <= today);
  const previous = rows.filter((r) => r.workout_date >= bounds.previousStart && r.workout_date < bounds.start);
  const bucketSize = days === 7 ? 1 : days === 30 ? 3 : 7;
  const volume: ChartPoint[] = [];
  const bucketForDate = new Map<string, number>();
  for (let offset = 0; offset < days; offset++) {
    const date = shift(bounds.start, offset);
    if (offset % bucketSize === 0) volume.push({ date, endDate: date, value: 0 });
    volume[volume.length - 1].endDate = date;
    bucketForDate.set(date, volume.length - 1);
  }
  for (const row of current) volume[bucketForDate.get(row.workout_date)!].value += row.volume;
  const exercises = new Map<string, string>();
  for (const row of current) {
    if (row.exercise_id && row.exercise_name && row.heaviest !== null) exercises.set(row.exercise_id, row.exercise_name);
  }
  const options = Array.from(exercises, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const selected = options.find((e) => e.id === exerciseId) ?? options[0];
  const daily = new Map<string, number>();
  for (const row of current) {
    if (row.exercise_id === selected?.id && row.heaviest !== null) {
      daily.set(row.workout_date, Math.max(daily.get(row.workout_date) ?? 0, row.heaviest));
    }
  }
  const weight = Array.from(daily, ([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  // Compare each exercise with its first logged load in the comparison window,
  // then average those percentage changes on each training day. Percentages
  // make loads from different exercises comparable.
  const firstLoad = new Map<string, number>();
  for (const row of [...previous, ...current]) {
    if (row.exercise_id && row.heaviest !== null && row.heaviest > 0 && !firstLoad.has(row.exercise_id)) {
      firstLoad.set(row.exercise_id, row.heaviest);
    }
  }
  const dailyLoads = new Map<string, Map<string, number>>();
  for (const row of current) {
    if (!row.exercise_id || row.heaviest === null || row.heaviest <= 0) continue;
    const loads = dailyLoads.get(row.workout_date) ?? new Map<string, number>();
    loads.set(row.exercise_id, Math.max(loads.get(row.exercise_id) ?? 0, row.heaviest));
    dailyLoads.set(row.workout_date, loads);
  }
  const overall: ChartPoint[] = Array.from(dailyLoads, ([date, loads]) => {
    const changes = Array.from(loads, ([id, load]) => {
      const baseline = firstLoad.get(id);
      return baseline ? ((load - baseline) / baseline) * 100 : null;
    }).filter((change): change is number => change !== null);
    return { date, value: changes.length ? changes.reduce((sum, change) => sum + change, 0) / changes.length : 0 };
  }).sort((a, b) => a.date.localeCompare(b.date));
  const totalVolume = current.reduce((sum, row) => sum + row.volume, 0);
  const previousVolume = previous.reduce((sum, row) => sum + row.volume, 0);
  return {
    ...bounds, volume, weight, overall, options, selected, totalVolume, previousVolume,
    change: percentChange(totalVolume, previousVolume),
    sessions: new Set(current.map((r) => r.session_id)).size,
    sets: current.reduce((sum, row) => sum + row.completed_sets, 0),
    best: weight.length ? Math.max(...weight.map((p) => p.value)) : null,
    bucketSize,
  };
}
