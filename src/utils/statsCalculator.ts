import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from 'date-fns';
import type { CheckinRecord, HabitStats } from '../models/types';

// 将记录拆分为「真正完成日」与「保护卡日」
// targets: habitId -> 每日目标次数（默认 1）
export function splitCompletion(
  records: CheckinRecord[],
  targets: Record<string, number> = {},
): { completed: string[]; protectedDates: string[] } {
  const completed = new Set<string>();
  const protectedSet = new Set<string>();
  for (const r of records) {
    if (r.recordType === 'freeze') {
      protectedSet.add(r.date);
      continue;
    }
    const target = targets[r.habitId] ?? 1;
    if ((r.times ?? 1) >= target) completed.add(r.date);
  }
  return { completed: [...completed], protectedDates: [...protectedSet] };
}

// 连续天序列＝完成日 ∪ 保护日（保护日不额外拉长连续，仅桥接不断）
export function streakDates(completed: string[], protectedDates: string[]): string[] {
  return [...new Set([...completed, ...protectedDates])];
}

export function calculateCurrentStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort().reverse();
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Streak must include today or yesterday
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 0;
  let checkDate = sorted[0] === today ? new Date() : subDays(new Date(), 1);

  for (let i = 0; i < sorted.length; i++) {
    const expected = format(checkDate, 'yyyy-MM-dd');
    if (sorted[i] === expected) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else if (sorted[i] < expected) {
      break;
    }
  }

  return streak;
}

export function calculateLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]);
    const curr = parseISO(sorted[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current++;
      longest = Math.max(longest, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }

  return longest;
}

export function calculateCompletionRate(dates: string[], totalDays: number): number {
  if (totalDays === 0) return 0;
  const uniqueDays = new Set(dates).size;
  return Math.min(uniqueDays / totalDays, 1);
}

export function getWeeklyCompletionData(
  records: CheckinRecord[],
  totalHabits: number,
): { labels: string[]; displayLabels: string[]; data: number[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];
  const labels: string[] = [];
  const displayLabels: string[] = [];
  const data: number[] = [];

  days.forEach((day, index) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isFuture = day.getTime() > today.getTime();
    labels.push(isFuture ? 'future' : dayLabels[index]);
    displayLabels.push(dayLabels[index]);
    if (isFuture || totalHabits === 0) {
      data.push(0);
    } else {
      const count = records.filter((r) => r.date === dateStr).length;
      data.push(Math.round((count / totalHabits) * 100));
    }
  });

  return { labels, displayLabels, data };
}

export function getHeatmapData(
  records: CheckinRecord[],
  days: number = 30,
): { date: string; count: number }[] {
  const today = new Date();
  const result: { date: string; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(today, i), 'yyyy-MM-dd');
    const count = records.filter((r) => r.date === date).length;
    result.push({ date, count });
  }

  return result;
}

export function calculateHabitStats(
  habitId: string,
  records: CheckinRecord[],
  createdAt: string,
): HabitStats {
  const habitRecords = records.filter((r) => r.habitId === habitId);
  const dates = habitRecords.map((r) => r.date);
  const today = new Date();
  const createdDate = parseISO(createdAt);
  const totalDaysSinceCreation = Math.max(
    1,
    Math.ceil((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  // This week
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const thisWeekCompleted = habitRecords.filter((r) =>
    weekDays.some((d) => format(d, 'yyyy-MM-dd') === r.date)
  ).length;

  // This month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const thisMonthCompleted = habitRecords.filter((r) =>
    monthDays.some((d) => format(d, 'yyyy-MM-dd') === r.date)
  ).length;

  return {
    habitId,
    totalDays: dates.length,
    currentStreak: calculateCurrentStreak(dates),
    longestStreak: calculateLongestStreak(dates),
    completionRate: calculateCompletionRate(dates, totalDaysSinceCreation),
    thisWeekCompleted,
    thisMonthCompleted,
  };
}
