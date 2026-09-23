import { INITIAL_SCHEMA, SCHEMA_VERSION } from './schema';

export type SqlValue = string | number | null;
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}

/** All reads and writes share this queue; no query can leak into another transaction. */
export class LocalDatabase {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly connection: SqlConnection,
    readonly userId: string,
  ) {}

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.catch(() => undefined);
    return result;
  }

  read<T>(task: (db: SqlConnection) => Promise<T>): Promise<T> {
    return this.enqueue(() => task(this.connection));
  }

  write<T>(task: (db: SqlConnection) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.connection.execAsync('BEGIN IMMEDIATE');
      try {
        const result = await task(this.connection);
        await this.connection.execAsync('COMMIT');
        return result;
      } catch (error) {
        await this.connection.execAsync('ROLLBACK');
        throw error;
      }
    });
  }

  async initialize(): Promise<void> {
    await this.read((db) =>
      db.execAsync(
        'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;',
      ),
    );
    await this.write(async (db) => {
      const version = await db.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version',
      );
      if ((version?.user_version ?? 0) > SCHEMA_VERSION) {
        throw new Error('This database requires a newer version of the app.');
      }
      if (!version?.user_version) {
        await db.execAsync(INITIAL_SCHEMA);
        await db.runAsync('INSERT INTO local_account(user_id) VALUES (?)', this.userId);
        await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      }
      const account = await db.getFirstAsync<{ user_id: string }>(
        'SELECT user_id FROM local_account',
      );
      if (account?.user_id !== this.userId) throw new Error('Account mismatch');
    });
  }
}
