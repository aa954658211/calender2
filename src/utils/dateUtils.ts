import { format, subDays, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isToday, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function formatDate(date: Date, fmt: string = 'yyyy-MM-dd'): string {
  return format(date, fmt);
}

export function formatToday(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDisplay(date: Date): string {
  return format(date, 'yyyy年M月d日', { locale: zhCN });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function getWeekDates(date: Date = new Date()): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function getMonthDates(date: Date): Date[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return eachDayOfInterval({ start, end });
}

export function getRecentDays(count: number): Date[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => subDays(today, count - 1 - i));
}

export { subDays, addDays, parseISO, isToday, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval };
