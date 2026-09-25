import type { Repositories } from '../repositories';

export interface SyncState {
  status: 'pending' | 'syncing' | 'synced' | 'offline' | 'error';
  pending: number;
  error: string | null;
  lastSyncedAt: string | null;
}

/** Upload each local commit immediately when connected; retry failures automatically. */
export function createSyncController(
  repositories: Pick<Repositories, 'pending' | 'subscribe'>,
  upload: (isCurrent: () => boolean) => Promise<void>,
  publish: (state: SyncState) => void,
  options: { retryDelayMs?: number; maxRetryDelayMs?: number } = {},
) {
  let stopped = false;
  // Wait for the initial connectivity check before making cloud requests.
  let online = false;
  let active = true;
  let requested = false;
  let running: Promise<void> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const initialDelay = options.retryDelayMs ?? 2000;
  const maxDelay = options.maxRetryDelayMs ?? 60000;
  let retryDelay = initialDelay;
  let state: SyncState = { status: 'pending', pending: 0, error: null, lastSyncedAt: null };
  function clearRetry() {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  }
  function emit(next: Partial<SyncState>) {
    state = { ...state, ...next };
    if (!stopped) publish(state);
  }
  function scheduleRetry() {
    if (stopped || !online || !active || retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void sync();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, maxDelay);
  }
  async function flush() {
    do {
      requested = false;
      const pending = (await repositories.pending.list()).length;
      if (stopped) return;
      emit({ pending });
      if (!online || !active) {
        emit({ status: online ? 'pending' : 'offline', error: null });
        return;
      }
      if (pending) {
        emit({ status: 'syncing', error: null });
        await upload(() => !stopped && online && active);
      }
      const remaining = (await repositories.pending.list()).length;
      if (stopped) return;
      if (!online || !active) {
        emit({ pending: remaining, status: online ? 'pending' : 'offline', error: null });
        return;
      }
      emit({ pending: remaining, status: remaining ? 'pending' : 'synced',
        error: null, lastSyncedAt: remaining ? state.lastSyncedAt : new Date().toISOString() });
      if (!remaining) retryDelay = initialDelay;
    } while (requested && !stopped);
  }
  function sync() {
    if (stopped) return Promise.resolve();
    requested = true;
    if (!running) {
      clearRetry();
      running = flush().catch((error: unknown) => {
        requested = false;
        emit({ status: !online ? 'offline' : !active ? 'pending' : 'error',
          error: online && active ? error instanceof Error ? error.message : String(error) : null });
      }).finally(() => {
        running = null;
        // A commit can arrive between the final queue read and this callback.
        if (requested && !stopped) void sync();
        else if (state.status === 'error' || state.pending > 0) scheduleRetry();
      });
    }
    return running;
  }
  const unsubscribe = repositories.subscribe(() => {
    // Keep backoff during outages rather than retrying on every keystroke.
    if (retryTimer === null) void sync();
  });
  return {
    sync,
    setOnline(value: boolean) {
      if (stopped) return;
      if (online === value) return;
      online = value;
      clearRetry();
      retryDelay = initialDelay;
      void sync();
    },
    setActive(value: boolean) {
      if (stopped) return;
      active = value;
      clearRetry();
      retryDelay = initialDelay;
      void sync();
    },
    stop() { stopped = true; clearRetry(); unsubscribe(); },
  };
}
