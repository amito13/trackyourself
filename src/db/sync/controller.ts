import type { Repositories } from '../repositories';

export interface SyncState {
  status: 'pending' | 'syncing' | 'synced' | 'offline' | 'error';
  pending: number;
  error: string | null;
  lastSyncedAt: string | null;
}

/** Local commits request a flush. Network work never blocks the local transaction. */
export function createSyncController(
  repositories: Pick<Repositories, 'pending' | 'subscribe'>,
  upload: (isCurrent: () => boolean) => Promise<void>,
  publish: (state: SyncState) => void,
) {
  let stopped = false;
  let online = true;
  let active = true;
  let requested = false;
  let running: Promise<void> | null = null;
  let state: SyncState = { status: 'pending', pending: 0, error: null, lastSyncedAt: null };
  function emit(next: Partial<SyncState>) {
    state = { ...state, ...next };
    if (!stopped) publish(state);
  }
  async function flush() {
    do {
      requested = false;
      const pending = (await repositories.pending.list()).length;
      emit({ pending });
      if (stopped) return;
      if (!online || !active) {
        emit({ status: online ? 'pending' : 'offline' });
        return;
      }
      if (pending) {
        emit({ status: 'syncing', error: null });
        await upload(() => !stopped && online && active);
      }
      const remaining = (await repositories.pending.list()).length;
      emit({ pending: remaining, status: remaining ? 'pending' : 'synced',
        error: null, lastSyncedAt: remaining ? state.lastSyncedAt : new Date().toISOString() });
    } while (requested && !stopped);
  }
  function sync() {
    if (stopped) return Promise.resolve();
    requested = true;
    if (!running) {
      running = flush().catch((error: unknown) => {
        emit({ status: online ? 'error' : 'offline', error: error instanceof Error ? error.message : String(error) });
      }).finally(() => { running = null; });
    }
    return running;
  }
  const unsubscribe = repositories.subscribe(() => { void sync(); });
  return {
    sync,
    setOnline(value: boolean) { online = value; void sync(); },
    setActive(value: boolean) { active = value; void sync(); },
    stop() { stopped = true; unsubscribe(); },
  };
}
