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
  reminderEndTime: string | null; // "HH:mm" 多次打卡的提醒时段结束时间，null 表示仅单点提醒
  dailyTarget: number; // 每日目标次数，1 表示单次打卡，>1 表示一天需多次打卡
  category: string | null; // 分组标签（如 生活/运动/学习），null 表示未分组
  freezeCards: number; // 可用的连续保护卡数量
}

// 打卡记录
export interface CheckinRecord {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  note: string | null;
  createdAt: string;
  times: number; // 当日完成次数
  recordType: 'checkin' | 'freeze'; // freeze 表示使用保护卡填充的记录（不计入完成次数，仅保护连续）
}

// 用户设置
export interface UserSettings {
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  weekStartsOn: 0 | 1; // 0=周日, 1=周一
  makeupEnabled: boolean; // 是否允许补卡
  makeupQuota: number; // 每月可补卡次数
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
