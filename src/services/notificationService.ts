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
const SCHEDULE_DAYS = 30; // 每个项目向后调度未来30天内匹配的提醒

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
  getDatesForDays(hour: number, minute: number, days: number[], spanDays: number = SCHEDULE_DAYS): Date[] {
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
   * 根据所有项目的提醒设置，重新调度全部通知
   * 采用「先全部取消，再全部重建」的策略，简单且可靠
   */
  async rescheduleAll(habits: Habit[]): Promise<boolean> {
    try {
      await this.setupChannel();
      await this.cancelAll();

      const enabled = habits.filter(
        (h) => h.reminderEnabled && h.reminderTime && !h.archived
      );

      if (enabled.length > 0) {
        await this.requestPermissions();
      }

      for (const habit of enabled) {
        const { hour, minute } = parseReminderTime(habit.reminderTime);
        const dates = this.getDatesForDays(hour, minute, habit.reminderDays ?? []);

        for (const date of dates) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${habit.name} 打卡提醒`,
              body: '到时间啦，坚持打卡，别让它断在今天！',
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
        }
      }

      console.log(`已按 ${enabled.length} 个项目的提醒设置完成调度`);
      return true;
    } catch (error) {
      console.error('调度提醒失败:', error);
      return false;
    }
  },

  /**
   * 应用启动时恢复通知调度
   * 若未来通知剩余过少（被系统清理），则依据项目设置重建
   */
  async restoreNotifications(habits: Habit[]) {
    const hasEnabled = habits.some(
      (h) => h.reminderEnabled && h.reminderTime && !h.archived
    );
    if (!hasEnabled) {
      await this.cancelAll();
      return;
    }

    try {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      // 每个项目每天最多一个通知，剩余不足则重建
      if (pending.length < 3) {
        console.log(`剩余通知不足(${pending.length})，重新调度...`);
        await this.rescheduleAll(habits);
      }
    } catch (error) {
      console.error('恢复通知失败:', error);
    }
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
