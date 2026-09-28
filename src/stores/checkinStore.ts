import { create } from 'zustand';
import type { CheckinRecord } from '../models/types';
import { checkinRepository } from '../db/repositories/checkinRepository';
import { formatToday } from '../utils/dateUtils';

interface CheckinStore {
  todayCheckins: Map<string, CheckinRecord>;
  selectedDateCheckins: Map<string, CheckinRecord>;
  selectedDate: string;
  loading: boolean;

  loadToday: () => Promise<void>;
  loadDate: (date: string) => Promise<void>;
  toggleCheckin: (habitId: string, date?: string) => Promise<boolean>;
  isChecked: (habitId: string) => boolean;
  getTodayProgress: () => { checked: number; total: number };
  getAllRecords: () => Promise<CheckinRecord[]>;
  getRecordsByHabit: (habitId: string) => Promise<CheckinRecord[]>;
}

export const useCheckinStore = create<CheckinStore>((set, get) => ({
  todayCheckins: new Map(),
  selectedDateCheckins: new Map(),
  selectedDate: formatToday(),
  loading: false,

  loadToday: async () => {
    const today = formatToday();
    const records = await checkinRepository.getByDate(today);
    const map = new Map<string, CheckinRecord>();
    records.forEach((r) => map.set(r.habitId, r));
    set({ todayCheckins: map });
  },

  loadDate: async (date: string) => {
    const records = await checkinRepository.getByDate(date);
    const map = new Map<string, CheckinRecord>();
    records.forEach((r) => map.set(r.habitId, r));
    set({ selectedDateCheckins: map, selectedDate: date });
  },

  toggleCheckin: async (habitId: string, date?: string) => {
    const targetDate = date || formatToday();
    const isToday = targetDate === formatToday();

    const existing = await checkinRepository.exists(habitId, targetDate);
    if (existing) {
      await checkinRepository.delete(existing.id);
    } else {
      await checkinRepository.create({ habitId, date: targetDate });
    }
    // Reload from DB to ensure consistency (swallow errors to avoid UI alerts)
    try {
      if (isToday) await get().loadToday();
      await get().loadDate(targetDate);
    } catch (_e) {
      // ignore reload errors
    }
    return !existing; // true if checked, false if unchecked
  },

  isChecked: (habitId: string) => {
    return get().todayCheckins.has(habitId);
  },

  getTodayProgress: () => {
    const { useHabitStore } = require('./habitStore');
    const habits = useHabitStore.getState().habits;
    const checked = get().todayCheckins.size;
    return { checked, total: habits.length };
  },

  getAllRecords: async () => {
    return await checkinRepository.getAll();
  },

  getRecordsByHabit: async (habitId: string) => {
    return await checkinRepository.getByHabit(habitId);
  },
}));
