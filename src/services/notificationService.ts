import * as Notifications from 'expo-notifications';
import { sendIntent } from 'expo-linking';
import { Platform } from 'react-native';
import type { Habit } from '../models/types';

// 前台通知处理
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CHANNEL_ID = 'checkin-reminder';
const MAX_PENDING_BUDGET = 45; // Android 待处理通知上限约 60，留出安全余量
const MAX_SPAN_DAYS = 14; // 排程窗口上限：每次启动/保存时滚动补排
const MAX_SPAN_DAYS_SINGLE = 30; // 全部项目都是单提醒点时维持长窗口

// 星期显示顺序：一~日，对应 JS getDay() 的 1..6,0
export const WEEKDAY_OPTIONS: { label: string; value: number }[] = [
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
  { label: '日', value: 0 },
];

/**
 * 解析 "HH:mm" 为时分
 */
export function parseReminderTime(time: string | null): { hour: number; minute: number } {
  if (!time) return { hour: 20, minute: 0 };
  const [h, m] = time.split(':').map(Number);
  return {
    hour: Number.isFinite(h) ? h : 20,
    minute: Number.isFinite(m) ? m : 0,
  };
}

export interface ReminderSlot {
  hour: number;
  minute: number;
  index: number; // 第几次提醒，从 1 开始
}

// 序列化重排：并发的 cancel+重建 交错会留下重复通知，因此同时只跑一个，
// 期间新请求只保留最新的项目快照（合并去抖）
let queuedHabits: Habit[] | null = null;
let rescheduleRunning: Promise<void> | null = null;

/**
 * 计算一个项目每天的提醒时间点：
 * - 单次项目或仅设了单个时间 → 1 个提醒点
 * - 多次项目且设了时段结束时间 → 在 [开始, 结束] 内均分 N 个点（就近整分钟）
 */
export function computeReminderSlots(habit: Habit): ReminderSlot[] {
  const n = Math.max(1, habit.dailyTarget || 1);
  const start = parseReminderTime(habit.reminderTime);
  if (n === 1 || !habit.reminderEndTime) {
    return [{ ...start, index: 1 }];
  }
  const end = parseReminderTime(habit.reminderEndTime);
  const startMin = start.hour * 60 + start.minute;
  let endMin = end.hour * 60 + end.minute;
  if (endMin <= startMin) endMin = Math.min(23 * 60 + 59, startMin + 60); // 非法时段兜底：跨度 1 小时
  const step = (endMin - startMin) / (n - 1);
  const slots: ReminderSlot[] = [];
  const used = new Set<number>();
  for (let i = 0; i < n; i++) {
    let total = Math.round(startMin + step * i); // 就近整分钟
    // 取整碰撞时顺移 1 分钟，避免同一分钟多条提醒
    while (used.has(total)) total += 1;
    if (total > 23 * 60 + 59) continue; // 超出当天上限则放弃该点
    used.add(total);
    slots.push({ hour: Math.floor(total / 60), minute: total % 60, index: 0 });
  }
  slots.forEach((s, i) => { s.index = i + 1; });
  return slots;
}

// 项目每天应发的提醒条数（考虑星期循环的比例）
function dailyNotificationWeight(habit: Habit): number {
  const slots = computeReminderSlots(habit);
  const days = habit.reminderDays ?? [];
  const dayFactor = days.length === 0 || days.length >= 7 ? 1 : days.length / 7;
  return slots.length * dayFactor;
}

// 根据所有启用项目的总预算，计算统一的排程窗口天数
export function computeSpanDays(habits: Habit[]): number {
  const enabled = habits.filter((h) => h.reminderEnabled && h.reminderTime && !h.archived);
  if (enabled.length === 0) return MAX_SPAN_DAYS_SINGLE;
  const totalWeight = enabled.reduce((sum, h) => sum + dailyNotificationWeight(h), 0);
  const hasMulti = enabled.some((h) => computeReminderSlots(h).length > 1);
  const cap = hasMulti ? MAX_SPAN_DAYS : MAX_SPAN_DAYS_SINGLE;
  return Math.max(1, Math.min(cap, Math.floor(MAX_PENDING_BUDGET / Math.max(1, totalWeight))));
}

export const notificationService = {
  /**
   * 初始化通知渠道（Android 必需）
   */
  async setupChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: '打卡提醒',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4A90D9',
        description: '打卡提醒通知',
        enableVibrate: true,
        enableLights: true,
      });
    }
  },

  /**
   * 请求通知权限
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus === 'granted') return true;

      const { status } = await Notifications.requestPermissionsAsync({
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return status === 'granted';
    } catch (error) {
      console.error('请求通知权限失败:', error);
      return false;
    }
  },

  /**
   * 获取未来 N 天内匹配指定星期的提醒时间点
   * days 为空数组表示每天提醒
   */
  getDatesForDays(hour: number, minute: number, days: number[], spanDays: number): Date[] {
    const dates: Date[] = [];
    const now = new Date();
    const everyDay = days.length === 0 || days.length >= 7;

    for (let i = 0; i < spanDays; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      date.setHours(hour, minute, 0, 0);
      if (date.getTime() <= now.getTime()) continue; // 跳过已过去的时间
      if (everyDay || days.includes(date.getDay())) {
        dates.push(date);
      }
    }
    return dates;
  },

  /**
   * 根据所有项目的提醒设置，重新调度全部通知。
   * 通过串行队列执行：并发触发时自动合并，只按最新设置重建一次，
   * 避免两个重排流程交错产生重复通知。
   */
  async rescheduleAll(habits: Habit[]): Promise<void> {
    queuedHabits = habits;
    if (rescheduleRunning) return rescheduleRunning;
    rescheduleRunning = (async () => {
      try {
        while (queuedHabits) {
          const snapshot = queuedHabits;
          queuedHabits = null;
          await this.rescheduleNow(snapshot);
        }
      } finally {
        rescheduleRunning = null;
      }
    })();
    return rescheduleRunning;
  },

  /**
   * 实际执行「先全部取消，再全部重建」，仅供串行队列调用
   */
  async rescheduleNow(habits: Habit[]): Promise<void> {
    try {
      await this.setupChannel();
      await this.cancelAll();

      const enabled = habits.filter(
        (h) => h.reminderEnabled && h.reminderTime && !h.archived
      );

      if (enabled.length > 0) {
        await this.requestPermissions();
      }

      const spanDays = computeSpanDays(habits);
      let scheduled = 0;

      for (const habit of enabled) {
        const slots = computeReminderSlots(habit);
        const isMulti = slots.length > 1;

        for (const slot of slots) {
          const dates = this.getDatesForDays(slot.hour, slot.minute, habit.reminderDays ?? [], spanDays);
          const title = isMulti
            ? `${habit.name} · 第 ${slot.index}/${slots.length} 次`
            : `${habit.name} 打卡提醒`;
          const body = isMulti
            ? (slot.index === slots.length
                ? '今天最后一次，完成后今天就圆满啦！'
                : '按节奏完成一次，别堆到最后～')
            : '到时间啦，坚持打卡，别让它断在今天！';

          for (const date of dates) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                data: { habitId: habit.id },
                sticky: false,
                autoDismiss: true,
              },
              trigger: {
                type: 'date',
                date,
                channelId: CHANNEL_ID,
              } as any,
            });
            scheduled++;
          }
        }
      }

      console.log(`已调度 ${scheduled} 条提醒（${enabled.length} 个项目，窗口 ${spanDays} 天）`);
    } catch (error) {
      console.error('调度提醒失败:', error);
    }
  },

  /**
   * 应用启动时恢复通知调度：
   * 排程窗口按预算动态缩短，因此每次启动直接重建，保证窗口始终被填满
   */
  async restoreNotifications(habits: Habit[]) {
    const hasEnabled = habits.some(
      (h) => h.reminderEnabled && h.reminderTime && !h.archived
    );
    // 无启用项目时走同一个串行队列取消，避免与进行中的重排交错
    await this.rescheduleAll(hasEnabled ? habits : []);
  },

  /**
   * 取消所有通知
   */
  async cancelAll() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('取消通知失败:', error);
    }
  },

  /**
   * 获取已调度的通知数量
   */
  async getPendingCount(): Promise<number> {
    try {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      return pending.length;
    } catch {
      return 0;
    }
  },

  /**
   * 打开本应用的系统设置页（自启动、省电策略等入口都在这里）
   */
  async openAppSettings() {
    try {
      await sendIntent('android.settings.APPLICATION_DETAILS_SETTINGS', [
        { key: 'package', value: 'com.checkin.app' },
      ]);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 打开 Android 12+ 的「闹钟和提醒」系统设置页
   */
  async openExactAlarmSettings() {
    try {
      await sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
      return true;
    } catch {
      return false;
    }
  },
};
