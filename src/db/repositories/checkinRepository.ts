import { getDatabase } from '../database';
import type { CheckinRecord } from '../../models/types';

export const checkinRepository = {
  async getByDate(date: string): Promise<CheckinRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM checkin_records WHERE date = ? ORDER BY created_at ASC',
      [date]
    );
    return rows.map(mapRowToRecord);
  },

  async getByHabit(habitId: string, startDate?: string, endDate?: string): Promise<CheckinRecord[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM checkin_records WHERE habit_id = ?';
    const params: any[] = [habitId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date ASC';
    const rows = await db.getAllAsync<any>(query, params);
    return rows.map(mapRowToRecord);
  },

  async countByHabit(habitId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM checkin_records WHERE habit_id = ?',
      [habitId]
    );
    return row?.count ?? 0;
  },

  async getByHabitPaged(habitId: string, limit: number, offset: number): Promise<CheckinRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM checkin_records WHERE habit_id = ? ORDER BY date DESC LIMIT ? OFFSET ?',
      [habitId, limit, offset]
    );
    return rows.map(mapRowToRecord);
  },

  async getAll(): Promise<CheckinRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>('SELECT * FROM checkin_records ORDER BY date ASC');
    return rows.map(mapRowToRecord);
  },

  async exists(habitId: string, date: string): Promise<CheckinRecord | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM checkin_records WHERE habit_id = ? AND date = ?',
      [habitId, date]
    );
    return row ? mapRowToRecord(row) : null;
  },

  async create(record: { habitId: string; date: string; note?: string }): Promise<CheckinRecord> {
    const db = await getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO checkin_records (id, habit_id, date, note, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, record.habitId, record.date, record.note || null, now]
    );
    return { id, habitId: record.habitId, date: record.date, note: record.note || null, createdAt: now };
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM checkin_records WHERE id = ?', [id]);
  },
};

function mapRowToRecord(row: any): CheckinRecord {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
