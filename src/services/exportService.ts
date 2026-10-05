import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from '../db/database';
import { habitRepository } from '../db/repositories/habitRepository';
import { checkinRepository } from '../db/repositories/checkinRepository';
import type { CheckinRecord, Habit } from '../models/types';

interface ExportPayload {
  app: string;
  version: number;
  exportedAt: string;
  habits: Habit[];
  checkins: CheckinRecord[];
}

function buildPayload(habits: Habit[], checkins: CheckinRecord[]): ExportPayload {
  return {
    app: 'checkin-app',
    version: 1,
    exportedAt: new Date().toISOString(),
    habits,
    checkins,
  };
}

function toCsv(habits: Habit[], checkins: CheckinRecord[]): string {
  const nameById = new Map(habits.map((h) => [h.id, h.name]));
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = ['日期,打卡项目,备注'];
  for (const r of checkins) {
    rows.push([r.date, escape(nameById.get(r.habitId) ?? r.habitId), escape(r.note ?? '')].join(','));
  }
  // BOM so that Excel opens UTF-8 Chinese correctly
  return '\uFEFF' + rows.join('\r\n');
}

async function saveAndShare(filename: string, contents: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = globalThis.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create({ overwrite: true });
  file.write(contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: '导出数据', UTI: mimeType });
  } else {
    throw new Error('分享功能不可用');
  }
}

function timestampName(ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `checkin-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}

export interface ImportResult {
  habits: number;
  checkins: number;
  skipped: number;
}

function isRecordArray(v: unknown): v is CheckinRecord[] {
  return Array.isArray(v) && v.every(
    (r) => r && typeof r.id === 'string' && typeof r.habitId === 'string' && typeof r.date === 'string'
  );
}

function isHabitArray(v: unknown): v is Habit[] {
  return Array.isArray(v) && v.every(
    (h) => h && typeof h.id === 'string' && typeof h.name === 'string'
  );
}

export const exportService = {
  async getAllData() {
    const habits = await habitRepository.getAll();
    const checkins = await checkinRepository.getAll();
    return { habits, checkins };
  },

  async exportJson(): Promise<number> {
    const { habits, checkins } = await this.getAllData();
    const payload = buildPayload(habits, checkins);
    await saveAndShare(timestampName('json'), JSON.stringify(payload, null, 2), 'application/json');
    return checkins.length;
  },

  async exportCsv(): Promise<number> {
    const { habits, checkins } = await this.getAllData();
    await saveAndShare(timestampName('csv'), toCsv(habits, checkins), 'text/csv');
    return checkins.length;
  },

  // 选择 JSON 备份文件并按 id 去重合并导入（不覆盖现有数据）
  async importJson(): Promise<ImportResult | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return null;

    const text = Platform.OS === 'web'
      ? await new File(result.assets[0].uri).text()
      : new File(result.assets[0].uri).textSync();

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (_e) {
      throw new Error('文件不是有效的 JSON 格式');
    }

    const p = payload as Partial<ExportPayload>;
    if (!p || !isHabitArray(p.habits) || !isRecordArray(p.checkins)) {
      throw new Error('文件格式不正确，请选择本应用的 JSON 备份');
    }

    const db = await getDatabase();
    const out: ImportResult = { habits: 0, checkins: 0, skipped: 0 };

    await db.withTransactionAsync(async () => {
      for (const h of p.habits!) {
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM habits WHERE id = ?', [h.id]
        );
        if (existing) { out.skipped++; continue; }
        await db.runAsync(
          'INSERT INTO habits (id, name, icon, color, target_time, created_at, updated_at, archived, reminder_enabled, reminder_time, reminder_days, reminder_end_time, daily_target, category, freeze_cards) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)',
          [h.id, h.name, h.icon ?? 'star', h.color ?? '#4A90D9', h.targetTime ?? null,
           h.createdAt ?? new Date().toISOString(), h.updatedAt ?? h.createdAt ?? new Date().toISOString(),
           h.reminderEnabled ? 1 : 0, h.reminderTime ?? null, JSON.stringify(h.reminderDays ?? []),
           h.reminderEndTime ?? null,
           h.dailyTarget ?? 1, h.category ?? null, h.freezeCards ?? 0]
        );
        out.habits++;
      }

      for (const r of p.checkins!) {
        // 跳过 id 重复或同一项目同一天已有记录的，避免重复导入
        const duplicate = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM checkin_records WHERE id = ? OR (habit_id = ? AND date = ?) LIMIT 1',
          [r.id, r.habitId, r.date]
        );
        if (duplicate || !p.habits!.some((h) => h.id === r.habitId)) {
          out.skipped++;
          continue;
        }
        await db.runAsync(
          'INSERT INTO checkin_records (id, habit_id, date, note, created_at, times, record_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [r.id, r.habitId, r.date, r.note ?? null, r.createdAt ?? new Date().toISOString(),
           r.times ?? 1, r.recordType ?? 'checkin']
        );
        out.checkins++;
      }
    });

    return out;
  },
};
