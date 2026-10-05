import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useHabitStore } from '../src/stores/habitStore';
import { useCheckinStore } from '../src/stores/checkinStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { notificationService } from '../src/services/notificationService';

export default function RootLayout() {
  const router = useRouter();
  const loadHabits = useHabitStore((s) => s.loadHabits);
  const loadToday = useCheckinStore((s) => s.loadToday);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    async function init() {
      await loadHabits();
      await loadToday();
      await loadSettings();
      // 初始化通知渠道（Android 必需）
      await notificationService.setupChannel();
      // 每次启动依据各项目的提醒设置恢复通知调度
      const currentHabits = useHabitStore.getState().habits;
      await notificationService.restoreNotifications(currentHabits);
    }
    init();

    // 点击通知直达项目详情
    const goToHabit = (habitId: unknown) => {
      if (typeof habitId === 'string' && habitId) {
        router.push(`/detail/${habitId}`);
      }
    };
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      goToHabit(response.notification.request.content.data?.habitId);
    });
    // 处理冷启动时点击通知进入的情况
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          await Notifications.clearLastNotificationResponseAsync();
          goToHabit(last.notification.request.content.data?.habitId);
        }
      } catch (_e) {
        // ignore
      }
    })();

    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="habit/create"
          options={{ headerShown: true, title: '新建打卡项目', presentation: 'modal' }}
        />
        <Stack.Screen
          name="habit/[id]"
          options={{ headerShown: true, title: '编辑项目', presentation: 'modal' }}
        />
        <Stack.Screen
          name="detail/[id]"
          options={{ headerShown: true, title: '项目详情' }}
        />
      </Stack>
    </>
  );
}
