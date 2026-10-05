import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('checkin.db');
      await initializeDatabase(db);
      return db;
    })();
  }
  return dbPromise;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase) {
  // Enable foreign keys
  await database.execAsync('PRAGMA foreign_keys = ON;');

  // Create habits table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'star',
      color TEXT NOT NULL DEFAULT '#4A90D9',
      target_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      reminder_enabled INTEGER NOT NULL DEFAULT 0,
      reminder_time TEXT,
      reminder_days TEXT,
      reminder_end_time TEXT,
      daily_target INTEGER NOT NULL DEFAULT 1,
      category TEXT,
      freeze_cards INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: add target_time column if not exists (for existing databases)
  try {
    await database.execAsync(`ALTER TABLE habits ADD COLUMN target_time TEXT`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: per-habit reminder columns
  try {
    await database.execAsync(`ALTER TABLE habits ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {
    // Column already exists, ignore
  }
  try {
    await database.execAsync(`ALTER TABLE habits ADD COLUMN reminder_time TEXT`);
  } catch (_) {
    // Column already exists, ignore
  }
  try {
    await database.execAsync(`ALTER TABLE habits ADD COLUMN reminder_days TEXT`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: reminder time-span end time for multi-count habits
  try {
    await database.execAsync(`ALTER TABLE habits ADD COLUMN reminder_end_time TEXT`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: daily multi-count, grouping and freeze cards
  try {
    await database.execAsync(`ALTER TABLE habits ADD COLUMN daily_target INTEGER NOT NULL DEFAULT 1`);
  } catch (_) {
    // Column already exists, ignore
  }
  try {
    await database.execAsync(`ALTER TABLE habits ADD COLUMN category TEXT`);
  } catch (_) {
    // Column already exists, ignore
  }
  try {
    await database.execAsync(`ALTER TABLE habits ADD COLUMN freeze_cards INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Create checkin_records table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS checkin_records (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      times INTEGER NOT NULL DEFAULT 1,
      record_type TEXT NOT NULL DEFAULT 'checkin',
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );
  `);

  // Migration: per-record count and freeze/checkin type
  try {
    await database.execAsync(`ALTER TABLE checkin_records ADD COLUMN times INTEGER NOT NULL DEFAULT 1`);
  } catch (_) {
    // Column already exists, ignore
  }
  try {
    await database.execAsync(`ALTER TABLE checkin_records ADD COLUMN record_type TEXT NOT NULL DEFAULT 'checkin'`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Create indexes
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_checkin_habit_date
    ON checkin_records(habit_id, date);
  `);

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_checkin_date
    ON checkin_records(date);
  `);

  // Create settings table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
