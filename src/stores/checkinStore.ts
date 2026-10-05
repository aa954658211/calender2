import { create } from 'zustand';
import type { CheckinRecord, Habit } from '../models/types';
import { checkinRepository } from '../db/repositories/checkinRepository';
import { useHabitStore } from './habitStore';
import { useSettingsStore } from './settingsStore';
import { formatToday } from '../utils/dateUtils';
import { splitCompletion, streakDates, calculateCurrentStreak } from '../utils/statsCalculator';

const FREEZE_CAP = 5; // 每个项目最多持有 5 张保护卡

export type CheckinResult =
  | { status: 'incremented'; times: number }
  | { status: 'completed'; times: number; awarded: boolean }
  | { status: 'undone' }
  | { status: 'blocked_future' }
  | { status: 'blocked_quota' }
  | { status: 'blocked_disabled' };

export interface MakeupInfo {
  enabled: boolean;
  quota: number;
  used: number;
  remaining: number;
}

interface CheckinStore {
  todayCheckins: Map<string, CheckinRecord>;
  selectedDateCheckins: Map<string, CheckinRecord>;
  selectedDate: string;
  loading: boolean;

  loadToday: () => Promise<void>;
  loadDate: (date: string) => Promise<void>;
  increment: (habit: Habit, date?: string) => Promise<CheckinResult>;
  undo: (habitId: string, date?: string) => Promise<void>;
  useFreezeCard: (habit: Habit, date: string) => Promise<'ok' | 'no_card' | 'already_done'>;
  getMakeupInfo: () => Promise<MakeupInfo>;
  isCompleted: (habit: Habit, record?: CheckinRecord) => boolean;
  getTodayProgress: () => { checked: number; total: number };
  getAllRecords: () => Promise<CheckinRecord[]>;
  getRecordsByHabit: (habitId: string) => Promise<CheckinRecord[]>;
}

export const useCheckinStore = create<CheckinStore>((set, get) => {
  const reload = async (dateStr: string) => {
    try {
      if (dateStr === formatToday()) await get().loadToday();
      await get().loadDate(dateStr);
    } catch (_e) {
      // ignore reload errors
    }
  };

  // 完成里程碑（每 7 天）发放一张保护卡
  const tryAwardFreeze = async (habit: Habit, target: number): Promise<boolean> => {
    try {
      const records = await checkinRepository.getByHabit(habit.id);
      const { completed, protectedDates } = splitCompletion(records, { [habit.id]: target });
      const streak = calculateCurrentStreak(streakDates(completed, protectedDates));
      if (streak > 0 && streak % 7 === 0) {
        const fresh = useHabitStore.getState().habits.find((h) => h.id === habit.id) ?? habit;
        const next = Math.min(FREEZE_CAP, (fresh.freezeCards ?? 0) + 1);
        if (next > (fresh.freezeCards ?? 0)) {
          await useHabitStore.getState().setFreezeCards(habit.id, next);
          return true;
        }
      }
    } catch (_e) {
      // ignore
    }
    return false;
  };

  return {
    todayCheckins: new Map(),
    selectedDateCheckins: new Map(),
    selectedDate: formatToday(),
    loading: false,

    loadToday: async () => {
      const records = await checkinRepository.getByDate(formatToday());
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

    isCompleted: (habit, record) => {
      const rec = record ?? get().todayCheckins.get(habit.id);
      const target = habit.dailyTarget || 1;
      return !!rec && rec.recordType === 'checkin' && (rec.times ?? 1) >= target;
    },

    increment: async (habit, dateArg) => {
      const dateStr = dateArg || formatToday();
      const today = formatToday();
      if (dateStr > today) return { status: 'blocked_future' };

      const isMakeup = dateStr < today;
      const target = habit.dailyTarget || 1;
      const settings = useSettingsStore.getState().settings;
      const existing = await checkinRepository.exists(habit.id, dateStr);
      const wasCompletedBefore =
        !!existing && existing.recordType === 'checkin' && (existing.times ?? 1) >= target;

      if (isMakeup) {
        if (!settings.makeupEnabled) return { status: 'blocked_disabled' };
        const newlyMakingUp = !existing || existing.recordType === 'freeze';
        if (newlyMakingUp) {
          const used = await checkinRepository.getMakeupsThisMonth();
          if (used >= (settings.makeupQuota || 0)) return { status: 'blocked_quota' };
        }
      }

      let newTimes = 1;
      if (existing && existing.recordType === 'checkin') {
        // 单日项目已完成后再次点击 = 取消打卡
        if ((existing.times ?? 1) >= target && target === 1) {
          await checkinRepository.delete(existing.id);
          await reload(dateStr);
          return { status: 'undone' };
        }
        newTimes = (existing.times ?? 1) + 1;
        await checkinRepository.updateTimes(existing.id, newTimes, 'checkin');
      } else if (existing && existing.recordType === 'freeze') {
        // 用真实打卡覆盖此前的保护卡记录
        newTimes = 1;
        await checkinRepository.updateTimes(existing.id, newTimes, 'checkin');
      } else {
        newTimes = 1;
        await checkinRepository.create({ habitId: habit.id, date: dateStr, times: 1, recordType: 'checkin' });
      }

      await reload(dateStr);

      const completed = newTimes >= target;
      let awarded = false;
      if (completed && !wasCompletedBefore) {
        awarded = await tryAwardFreeze(habit, target);
      }
      return completed ? { status: 'completed', times: newTimes, awarded } : { status: 'incremented', times: newTimes };
    },

    undo: async (habitId, dateArg) => {
      const dateStr = dateArg || formatToday();
      const existing = await checkinRepository.exists(habitId, dateStr);
      if (existing) await checkinRepository.delete(existing.id);
      await reload(dateStr);
    },

    useFreezeCard: async (habit, dateStr) => {
      const fresh = useHabitStore.getState().habits.find((h) => h.id === habit.id) ?? habit;
      if ((fresh.freezeCards ?? 0) <= 0) return 'no_card';
      const target = habit.dailyTarget || 1;
      const existing = await checkinRepository.exists(habit.id, dateStr);
      if (existing && existing.recordType === 'checkin' && (existing.times ?? 1) >= target) {
        return 'already_done';
      }
      await checkinRepository.upsert({ habitId: habit.id, date: dateStr, times: 0, recordType: 'freeze' });
      await useHabitStore.getState().setFreezeCards(habit.id, (fresh.freezeCards ?? 0) - 1);
      await reload(dateStr);
      return 'ok';
    },

    getMakeupInfo: async () => {
      const settings = useSettingsStore.getState().settings;
      const used = await checkinRepository.getMakeupsThisMonth();
      const quota = settings.makeupQuota || 0;
      return { enabled: settings.makeupEnabled, quota, used, remaining: Math.max(0, quota - used) };
    },

    getTodayProgress: () => {
      const habits = useHabitStore.getState().habits;
      const today = get().todayCheckins;
      const checked = habits.filter((h) => {
        const rec = today.get(h.id);
        return !!rec && rec.recordType === 'checkin' && (rec.times ?? 1) >= (h.dailyTarget || 1);
      }).length;
      return { checked, total: habits.length };
    },

    getAllRecords: async () => checkinRepository.getAll(),
    getRecordsByHabit: async (habitId) => checkinRepository.getByHabit(habitId),
  };
});
