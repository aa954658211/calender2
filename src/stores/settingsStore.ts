import { create } from 'zustand';
import type { UserSettings } from '../models/types';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { getDatabase } from '../db/database';

interface SettingsStore {
  settings: UserSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
}

const SETTINGS_KEY = 'user_settings';

async function loadFromDb(): Promise<UserSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT value FROM settings WHERE key = ?', [SETTINGS_KEY]);
  if (row) {
    try {
      return JSON.parse(row.value);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

async function saveToDb(settings: UserSettings): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [SETTINGS_KEY, JSON.stringify(settings)]
  );
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,

  loadSettings: async () => {
    set({ loading: true });
    const settings = await loadFromDb();
    set({ settings, loading: false });
  },

  updateSettings: async (updates) => {
    const newSettings = { ...get().settings, ...updates };
    await saveToDb(newSettings);
    set({ settings: newSettings });
  },
}));
