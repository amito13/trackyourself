import type { SqlConnection, SqlValue } from '../sqlite/connection';
import type { MutableTable } from './types';

export async function markPending(db: SqlConnection, table: MutableTable, id: string) {
  await db.runAsync(`INSERT INTO pending_changes(table_name, record_id) VALUES (?, ?)
    ON CONFLICT(table_name, record_id) DO UPDATE SET revision = revision + 1`, table, id);
}

export async function insertRecord(
  db: SqlConnection, table: MutableTable, record: Record<string, SqlValue>,
) {
  const columns = Object.keys(record);
  await db.runAsync(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    ...Object.values(record));
  await markPending(db, table, record.id as string);
}

export async function tombstone(db: SqlConnection, table: MutableTable, id: string, now: string) {
  await db.runAsync(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, now, now, id);
  await markPending(db, table, id);
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
