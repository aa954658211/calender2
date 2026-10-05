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

  async create(record: { habitId: string; date: string; note?: string; times?: number; recordType?: 'checkin' | 'freeze' }): Promise<CheckinRecord> {
    const db = await getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    const times = record.times ?? 1;
    const recordType = record.recordType ?? 'checkin';
    await db.runAsync(
      'INSERT INTO checkin_records (id, habit_id, date, note, created_at, times, record_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, record.habitId, record.date, record.note || null, now, times, recordType]
    );
    return { id, habitId: record.habitId, date: record.date, note: record.note || null, createdAt: now, times, recordType };
  },

  // 插入或更新某项目某天的记录（保证一天只一条）
  async upsert(record: { habitId: string; date: string; times: number; recordType: 'checkin' | 'freeze'; note?: string }): Promise<CheckinRecord> {
    const existing = await this.exists(record.habitId, record.date);
    if (existing) {
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE checkin_records SET times = ?, record_type = ?, note = ? WHERE id = ?',
        [record.times, record.recordType, record.note ?? existing.note, existing.id]
      );
      return { ...existing, times: record.times, recordType: record.recordType, note: record.note ?? existing.note };
    }
    return this.create(record);
  },

  async updateTimes(id: string, times: number, recordType: 'checkin' | 'freeze'): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE checkin_records SET times = ?, record_type = ? WHERE id = ?', [times, recordType, id]);
  },

  // 本月已使用的补卡次数（date 早于录入日，且录入在本月）
  async getMakeupsThisMonth(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>("SELECT date, created_at FROM checkin_records WHERE record_type = 'checkin'");
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let count = 0;
    for (const row of rows) {
      const loggedAt = String(row.created_at ?? '').slice(0, 7);
      const checkDate = String(row.date ?? '');
      if (loggedAt === monthPrefix && checkDate < loggedAtDate(row.created_at)) {
        count++;
      }
    }
    return count;
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM checkin_records WHERE id = ?', [id]);
  },
};

function loggedAtDate(createdAt: string): string {
  return String(createdAt ?? '').slice(0, 10);
}

function mapRowToRecord(row: any): CheckinRecord {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
    times: row.times ?? 1,
    recordType: row.record_type === 'freeze' ? 'freeze' : 'checkin',
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
