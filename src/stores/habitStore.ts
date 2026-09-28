import { create } from 'zustand';
import type { Habit } from '../models/types';
import { habitRepository } from '../db/repositories/habitRepository';
import { notificationService } from '../services/notificationService';

export interface HabitInput {
  name: string;
  icon: string;
  color: string;
  targetTime?: string | null;
  reminderEnabled?: boolean;
  reminderTime?: string | null;
  reminderDays?: number[];
}

interface HabitStore {
  habits: Habit[];
  loading: boolean;
  loadHabits: () => Promise<void>;
  addHabit: (data: HabitInput) => Promise<Habit>;
  updateHabit: (
    id: string,
    data: Partial<Pick<Habit, 'name' | 'icon' | 'color' | 'targetTime' | 'reminderEnabled' | 'reminderTime' | 'reminderDays'>>
  ) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  getHabitById: (id: string) => Habit | undefined;
}

// 依据最新的项目列表重建通知调度
async function syncNotifications(habits: Habit[]) {
  await notificationService.rescheduleAll(habits);
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  loading: false,

  loadHabits: async () => {
    set({ loading: true });
    const habits = await habitRepository.getAll();
    set({ habits, loading: false });
  },

  addHabit: async (data) => {
    const habit = await habitRepository.create({
      name: data.name,
      icon: data.icon,
      color: data.color,
      targetTime: data.targetTime ?? null,
      reminderEnabled: data.reminderEnabled ?? false,
      reminderTime: data.reminderTime ?? null,
      reminderDays: data.reminderDays ?? [],
    });
    const habits = [...get().habits, habit];
    set({ habits });
    await syncNotifications(habits);
    return habit;
  },

  updateHabit: async (id, data) => {
    await habitRepository.update(id, data);
    const habits = get().habits.map((h) =>
      h.id === id ? { ...h, ...data, updatedAt: new Date().toISOString() } : h
    );
    set({ habits });
    await syncNotifications(habits);
  },

  deleteHabit: async (id) => {
    await habitRepository.archive(id);
    const habits = get().habits.filter((h) => h.id !== id);
    set({ habits });
    await syncNotifications(habits);
  },

  getHabitById: (id) => {
    return get().habits.find((h) => h.id === id);
  },
}));
