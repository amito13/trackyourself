import type { LocalDatabase } from '../sqlite/connection';
import { markPending } from './shared';
import type { Profile, RepositoryRuntime } from './types';

export class ProfileRepository {
  constructor(private local: LocalDatabase, private runtime: RepositoryRuntime) {}

  /** Cache identity after login. A returning login must not reset local onboarding. */
  cacheIdentity(identity: { id: string; name: string; email: string | null; avatarUrl: string | null }) {
    if (identity.id !== this.local.userId) throw new Error('Account mismatch');
    return this.local.write(async db => {
      await db.runAsync(`INSERT INTO users(id, auth_user_id, name, email, avatar_url)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
      identity.id, identity.id, identity.name, identity.email, identity.avatarUrl);
    });
  }

  get() {
    return this.local.read(db => db.getFirstAsync<Profile>('SELECT * FROM users WHERE id = ?', this.local.userId));
  }

  update(name: string, avatarUrl: string | null) {
    return this.local.write(async db => {
      const result = await db.runAsync('UPDATE users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
        name, avatarUrl, this.runtime.now().toISOString(), this.local.userId);
      if (!result.changes) throw new Error('Local profile is not initialized');
      await markPending(db, 'users', this.local.userId);
    });
  }
}
