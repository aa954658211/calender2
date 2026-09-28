import { getDatabase } from '../database';
import type { Habit } from '../../models/types';

export const habitRepository = {
  async getAll(): Promise<Habit[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM habits WHERE archived = 0 ORDER BY created_at ASC'
    );
    return rows.map(mapRowToHabit);
  },

  async getById(id: string): Promise<Habit | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM habits WHERE id = ?',
      [id]
    );
    return row ? mapRowToHabit(row) : null;
  },

  async create(habit: Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'reminderEnabled' | 'reminderTime' | 'reminderDays'> & Partial<Pick<Habit, 'reminderEnabled' | 'reminderTime' | 'reminderDays'>>): Promise<Habit> {
    const db = await getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    const reminderEnabled = habit.reminderEnabled ?? false;
    const reminderTime = habit.reminderTime ?? null;
    const reminderDays = habit.reminderDays ?? [];
    await db.runAsync(
      'INSERT INTO habits (id, name, icon, color, target_time, created_at, updated_at, archived, reminder_enabled, reminder_time, reminder_days) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
      [id, habit.name, habit.icon, habit.color, habit.targetTime, now, now, reminderEnabled ? 1 : 0, reminderTime, JSON.stringify(reminderDays)]
    );
    return { id, name: habit.name, icon: habit.icon, color: habit.color, targetTime: habit.targetTime, createdAt: now, updatedAt: now, archived: false, reminderEnabled, reminderTime, reminderDays };
  },

  async update(id: string, data: Partial<Pick<Habit, 'name' | 'icon' | 'color' | 'targetTime' | 'reminderEnabled' | 'reminderTime' | 'reminderDays'>>): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
    if (data.targetTime !== undefined) { fields.push('target_time = ?'); values.push(data.targetTime); }
    if (data.reminderEnabled !== undefined) { fields.push('reminder_enabled = ?'); values.push(data.reminderEnabled ? 1 : 0); }
    if (data.reminderTime !== undefined) { fields.push('reminder_time = ?'); values.push(data.reminderTime); }
    if (data.reminderDays !== undefined) { fields.push('reminder_days = ?'); values.push(JSON.stringify(data.reminderDays)); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await db.runAsync(
      `UPDATE habits SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async archive(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE habits SET archived = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
  },
};

function mapRowToHabit(row: any): Habit {
  let reminderDays: number[] = [];
  if (row.reminder_days) {
    try {
      const parsed = JSON.parse(row.reminder_days);
      if (Array.isArray(parsed)) reminderDays = parsed.filter((d) => typeof d === 'number');
    } catch (_) {
      reminderDays = [];
    }
  }
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    targetTime: row.target_time ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: row.archived === 1,
    reminderEnabled: row.reminder_enabled === 1,
    reminderTime: row.reminder_time ?? null,
    reminderDays,
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
