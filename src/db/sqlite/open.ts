import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { createRepositories, type Repositories } from '../repositories';
import { LocalDatabase } from './connection';

const accounts = new Map<string, Promise<Repositories>>();

/** Open lazily after authentication; logout must not delete unsynchronized data. */
export function openRepositories(userId: string): Promise<Repositories> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return Promise.reject(new Error('A valid authenticated user ID is required'));
  }
  const normalizedId = userId.toLowerCase();
  let pending = accounts.get(normalizedId);
  if (!pending) {
    pending = (async () => {
      const connection = await openDatabaseAsync(`track-yourself-${normalizedId}.db`);
      try {
        const database = new LocalDatabase(connection, normalizedId);
        await database.initialize();
        return createRepositories(database, { uuid: randomUUID, now: () => new Date() });
      } catch (error) {
        await connection.closeAsync();
        throw error;
      }
    })().catch(error => {
      accounts.delete(normalizedId);
      throw error;
    });
    accounts.set(normalizedId, pending);
  }
  return pending;
}
