// 打卡项目
export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetTime: string | null; // "YYYY-MM-DD" 格式的目标日期，null 表示不设
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  reminderEnabled: boolean; // 是否开启该项目的提醒
  reminderTime: string | null; // "HH:mm" 格式的提醒时间，null 表示未设置
  reminderDays: number[]; // 循环提醒的星期，0=周日...6=周六，空数组表示每天
}

// 打卡记录
export interface CheckinRecord {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  note: string | null;
  createdAt: string;
}

// 用户设置
export interface UserSettings {
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  weekStartsOn: 0 | 1; // 0=周日, 1=周一
}

// 统计聚合
export interface HabitStats {
  habitId: string;
  totalDays: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  thisWeekCompleted: number;
  thisMonthCompleted: number;
}

// 每日打卡概览
export interface DailyOverview {
  date: string;
  habits: {
    habit: Habit;
    checked: boolean;
    record: CheckinRecord | null;
  }[];
}
