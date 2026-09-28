import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useHabitStore } from '../src/stores/habitStore';
import { useCheckinStore } from '../src/stores/checkinStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { notificationService } from '../src/services/notificationService';

export default function RootLayout() {
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
