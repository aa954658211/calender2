import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, AppState,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { HabitCard } from '../../src/components/HabitCard';
import { EmptyState } from '../../src/components/EmptyState';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { getGreeting, formatDisplay } from '../../src/utils/dateUtils';
import type { Habit } from '../../src/models/types';

export default function HomeScreen() {
  const router = useRouter();
  const habits = useHabitStore((s) => s.habits);
  const todayCheckins = useCheckinStore((s) => s.todayCheckins);
  const increment = useCheckinStore((s) => s.increment);
  const undo = useCheckinStore((s) => s.undo);
  const loadToday = useCheckinStore((s) => s.loadToday);
  const deleteHabit = useHabitStore((s) => s.deleteHabit);

  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Reload on tab focus
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          await loadToday();
        } catch (_e) {
          // ignore
        }
      };
      load();
    }, [])
  );

  // Reload when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadToday().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [loadToday]);

  const handleToggle = async (habit: Habit) => {
    if (togglingId) return;
    setTogglingId(habit.id);
    try {
      const result = await increment(habit);
      switch (result.status) {
        case 'incremented':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'completed':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (result.awarded) {
            Alert.alert('🎉 获得保护卡', `已连续打卡 7 的倍数天，获得 1 张连续保护卡（可在日历页使用）`);
          }
          break;
        case 'undone':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'blocked_disabled':
          Alert.alert('补卡已关闭', '可在 设置 中开启补卡功能');
          break;
        case 'blocked_quota':
          Alert.alert('本月补卡额度已用完', '每月补卡次数有限，下月会重置');
          break;
        case 'blocked_future':
          break;
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleLongPress = (habit: Habit) => {
    const record = todayCheckins.get(habit.id);
    const canUndo = !!record;
    Alert.alert(habit.name, '选择一个操作', [
      ...(canUndo
        ? [{
            text: '撤销今日打卡',
            onPress: async () => {
              await undo(habit.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
          }]
        : []),
      { text: '查看详情', onPress: () => router.push(`/detail/${habit.id}`) },
      { text: '编辑', onPress: () => router.push(`/habit/${habit.id}`) },
      { text: '删除', style: 'destructive', onPress: () => setDeleteTarget(habit.id) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteHabit(deleteTarget);
      setDeleteTarget(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadToday();
    } catch (_error) {
      // Silently ignore — rapid tab switching may cause transient DB errors
    } finally {
      setRefreshing(false);
    }
  };

  // 按分组标签归类，未分组的排最后
  const groups = useMemo(() => {
    const map = new Map<string, Habit[]>();
    habits.forEach((h) => {
      const key = h.category || '未分组';
      const list = map.get(key);
      if (list) list.push(h);
      else map.set(key, [h]);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (a === '未分组') return 1;
      if (b === '未分组') return -1;
      return a.localeCompare(b, 'zh-Hans-CN');
    });
  }, [habits]);

  const todayTimes = (habit: Habit) => {
    const rec = todayCheckins.get(habit.id);
    return rec && rec.recordType === 'checkin' ? (rec.times ?? 1) : 0;
  };

  const { checked: checkedCount, total: totalCount } = useMemo(() => {
    let checked = 0;
    habits.forEach((h) => {
      if (todayTimes(h) >= (h.dailyTarget || 1)) checked++;
    });
    return { checked, total: habits.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, todayCheckins]);
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  if (habits.length === 0) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <EmptyState
            icon="add-circle-outline"
            title="还没有打卡项目"
            subtitle="点击下方按钮创建第一个打卡项目吧"
          />
        </ScrollView>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/habit/create')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{getGreeting()}！</Text>
          <Text style={styles.dateText}>{formatDisplay(new Date())}</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              今日进度 {checkedCount}/{totalCount}
            </Text>
            <Text style={styles.progressPercent}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Habit Cards grouped by category */}
        {groups.map(([category, list]) => (
          <View key={category}>
            {groups.length > 1 && (
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{category}</Text>
                <Text style={styles.groupCount}>{list.length} 项</Text>
              </View>
            )}
            <View style={styles.grid}>
              {list.map((habit) => (
                <View key={habit.id} style={styles.gridItem}>
                  <HabitCard
                    habit={habit}
                    times={todayTimes(habit)}
                    onToggle={() => handleToggle(habit)}
                    onLongPress={() => handleLongPress(habit)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/habit/create')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="删除项目"
        message="确定要删除这个打卡项目吗？相关的打卡记录也会被删除，此操作不可撤销。"
        confirmText="删除"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { padding: 20, paddingBottom: 80 },
  greetingSection: { marginBottom: 16 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#333' },
  dateText: { fontSize: 14, color: '#888', marginTop: 4 },
  progressSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressText: { fontSize: 14, fontWeight: '600', color: '#555' },
  progressPercent: { fontSize: 14, fontWeight: '700', color: '#4A90D9' },
  progressBar: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#4A90D9', borderRadius: 4 },
  groupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, marginTop: 4, paddingHorizontal: 2,
  },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  groupCount: { fontSize: 12, color: '#aaa' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  gridItem: { width: '48%' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
