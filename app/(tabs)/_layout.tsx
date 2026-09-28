import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4A90D9',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: {
          height: 56,
          paddingBottom: 6,
          paddingTop: 4,
          borderTopColor: '#eee',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700' as any, fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '今日打卡',
          headerTitle: '打卡助手',
          tabBarIcon: ({ color }) => <Ionicons name="today-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '日历',
          headerTitle: '打卡日历',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: '统计',
          headerTitle: '数据统计',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          headerTitle: '设置',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
