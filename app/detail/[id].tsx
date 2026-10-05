import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { checkinRepository } from '../../src/db/repositories/checkinRepository';
import { StatsCard } from '../../src/components/StatsCard';
import { CheckinButton } from '../../src/components/CheckinButton';
import {
  calculateCurrentStreak,
  calculateLongestStreak,
  calculateCompletionRate,
  getHeatmapData,
  splitCompletion,
  streakDates,
} from '../../src/utils/statsCalculator';
import { parseISO, formatDisplay } from '../../src/utils/dateUtils';
import type { CheckinRecord } from '../../src/models/types';

const PAGE_SIZE = 20;

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabitStore((s) => s.habits.find((h) => h.id === id));
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [stats, setStats] = useState({
    totalDays: 0,
    currentStreak: 0,
    longestStreak: 0,
    completionRate: 0,
  });
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([]);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const todayCheckins = useCheckinStore((s) => s.todayCheckins);
  const increment = useCheckinStore((s) => s.increment);
  const undo = useCheckinStore((s) => s.undo);

  // Reset pagination and reload first page on focus
  useFocusEffect(
    useCallback(() => {
      if (!id || !habit) return () => {};
      let cancelled = false;

      const load = async () => {
        try {
          await useCheckinStore.getState().loadToday();
          const firstPage = await checkinRepository.getByHabitPaged(habit.id, PAGE_SIZE, 0);
          const total = await checkinRepository.countByHabit(habit.id);
          if (cancelled) return;
          setRecords(firstPage);
          setHasMoreRecords(total > PAGE_SIZE);

          // Stats need full history scope
          const allRecs = total > PAGE_SIZE ? await checkinRepository.getByHabit(habit.id) : firstPage;
          // 完成日 / 保护日拆分：连续口径含保护日，总数与完成率只计完成日
          const target = habit.dailyTarget || 1;
          const { completed, protectedDates } = splitCompletion(allRecs, { [habit.id]: target });
          const allDates = [...new Set(completed)];
          const datesForStreak = streakDates(completed, protectedDates);
          if (cancelled) return;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const createdDate = parseISO(habit.createdAt);
          createdDate.setHours(0, 0, 0, 0);

          // Use creation-to-target span as denominator when target exists
          let totalDays = Math.ceil(
            (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;

          if (habit.targetTime) {
            const targetDate = new Date(habit.targetTime + 'T00:00:00');
            const spanToTarget = Math.ceil(
              (targetDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;
            totalDays = Math.max(totalDays, spanToTarget);
          }

          totalDays = Math.max(1, totalDays);

          setStats({
            totalDays: allDates.length,
            currentStreak: calculateCurrentStreak(datesForStreak),
            longestStreak: calculateLongestStreak(datesForStreak),
            completionRate: Math.round(calculateCompletionRate(allDates, totalDays) * 100),
          });

          setHeatmapData(getHeatmapData(allRecs, 60));
        } catch (_e) {
          // ignore
        }
      };

      load();
      return () => { cancelled = true; };
    }, [id, habit?.id, refreshKey])
  );

  const handleLoadMore = async () => {
    if (!habit || loadingMore || !hasMoreRecords) return;
    setLoadingMore(true);
    try {
      const next = await checkinRepository.getByHabitPaged(habit.id, PAGE_SIZE, records.length);
      setRecords((prev) => [...prev, ...next]);
      setHasMoreRecords(next.length === PAGE_SIZE);
    } catch (_e) {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  if (!habit) return null;

  const target = habit.dailyTarget || 1;
  const todayRecord = todayCheckins.get(habit.id);
  const todayTimes = todayRecord && todayRecord.recordType === 'checkin' ? (todayRecord.times ?? 1) : 0;
  const doneToday = todayTimes >= target;

  const handleCheckin = async () => {
    const result = await increment(habit);
    switch (result.status) {
      case 'incremented':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'completed':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result.awarded) {
          Alert.alert('🎉 获得保护卡', '已连续打卡 7 的倍数天，获得 1 张连续保护卡');
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
    setRefreshKey((k) => k + 1);
  };

  const handleUndoToday = async () => {
    await undo(habit.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshKey((k) => k + 1);
  };

  const todayStatusText = todayRecord?.recordType === 'freeze'
    ? '今日已使用保护卡，点右侧按钮可改为真实打卡'
    : doneToday
      ? '今日已完成 🎉'
      : todayTimes > 0
        ? `今日已打卡 ${todayTimes}/${target} 次，继续加油`
        : '今日还未打卡，点右侧圆圈打卡';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: habit.color + '20' }]}>
          <Ionicons name={habit.icon as any} size={32} color={habit.color} />
        </View>
        <Text style={styles.headerName}>{habit.name}</Text>
        {(habit.dailyTarget || 1) > 1 && (
          <Text style={styles.headerTarget}>每日 {habit.dailyTarget} 次</Text>
        )}
        <View style={styles.freezeRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#F39C12" />
          <Text style={styles.freezeText}>
            保护卡 {habit.freezeCards ?? 0} 张 · 每连续 7 天得 1 张，可在日历页填补漏打卡日
          </Text>
        </View>
        {habit.targetTime && (() => {
          const target = new Date(habit.targetTime + 'T00:00:00');
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const days = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return (
            <View style={styles.targetTimeRow}>
              <Ionicons name="calendar-outline" size={14} color={days >= 0 ? '#4A90D9' : '#E74C3C'} />
              <Text style={[styles.targetTimeText, { color: days >= 0 ? '#4A90D9' : '#E74C3C' }]}>
                目标 {habit.targetTime}
                {days > 0 ? ` · 还剩 ${days} 天` : days === 0 ? ' · 今天到期' : ` · 已过期 ${Math.abs(days)} 天`}
              </Text>
            </View>
          );
        })()}
      </View>

      {/* Today check-in */}
      <View style={styles.checkinCard}>
        <View style={styles.checkinLeft}>
          <Text style={styles.checkinDate}>{formatDisplay(new Date())}</Text>
          <Text style={[styles.checkinStatus, { color: doneToday ? habit.color : '#888' }]}>
            {todayStatusText}
          </Text>
          {todayTimes > 0 && (
            <TouchableOpacity onPress={handleUndoToday}>
              <Text style={styles.undoText}>撤销今日打卡</Text>
            </TouchableOpacity>
          )}
        </View>
        <CheckinButton
          checked={doneToday}
          color={habit.color}
          onPress={handleCheckin}
          label={!doneToday && todayTimes > 0 ? String(todayTimes) : undefined}
        />
      </View>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <StatsCard label="总打卡" value={`${stats.totalDays}天`} icon="calendar" color={habit.color} />
        <View style={{ width: 8 }} />
        <StatsCard label="连续" value={`${stats.currentStreak}天`} icon="flame" color="#E74C3C" />
        <View style={{ width: 8 }} />
        <StatsCard label="完成率" value={`${stats.completionRate}%`} icon="pie-chart" color="#2ECC71" />
        <View style={{ width: 8 }} />
        <StatsCard label="最长" value={`${stats.longestStreak}天`} icon="trophy" color="#F39C12" />
      </View>

      {/* Heatmap */}
      <View style={styles.heatmapSection}>
        <Text style={styles.sectionTitle}>最近60天打卡记录</Text>
        <View style={styles.heatmapGrid}>
          {heatmapData.map((item) => {
            const opacity = item.count > 0 ? 0.3 + (item.count / 1) * 0.7 : 0;
            return (
              <View
                key={item.date}
                style={[
                  styles.heatmapCell,
                  { backgroundColor: opacity > 0 ? habit.color + (opacity > 0.7 ? 'ff' : '88') : '#f0f0f0' },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Recent records (paginated) */}
      <Text style={styles.sectionTitle}>最近打卡记录</Text>
      {records.length === 0 ? (
        <Text style={styles.emptyText}>还没有打卡记录</Text>
      ) : (
        <>
          {records.map((record) => (
            <View key={record.id} style={styles.recordItem}>
              <Ionicons
                name={record.recordType === 'freeze' ? 'shield-checkmark' : 'checkmark-circle'}
                size={20}
                color={record.recordType === 'freeze' ? '#F39C12' : habit.color}
              />
              <Text style={styles.recordDate}>{record.date}</Text>
              {record.recordType === 'freeze' ? (
                <Text style={styles.recordTimes}>保护卡</Text>
              ) : (record.times ?? 1) > 1 ? (
                <Text style={styles.recordTimes}>{record.times} 次</Text>
              ) : null}
              {record.note && <Text style={styles.recordNote}>{record.note}</Text>}
            </View>
          ))}
          {hasMoreRecords && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={handleLoadMore}
              disabled={loadingMore}
              activeOpacity={0.7}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={habit.color} />
              ) : (
                <Text style={[styles.loadMoreText, { color: habit.color }]}>加载更多</Text>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  headerIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  headerName: { fontSize: 20, fontWeight: '700', color: '#333' },
  headerTarget: { fontSize: 13, color: '#888', marginTop: 4 },
  freezeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingHorizontal: 10 },
  freezeText: { fontSize: 12, color: '#999' },
  checkinCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16,
  },
  checkinLeft: { flex: 1, gap: 4 },
  checkinDate: { fontSize: 14, fontWeight: '700', color: '#333' },
  checkinStatus: { fontSize: 13 },
  undoText: { fontSize: 12, color: '#aaa', textDecorationLine: 'underline' },
  targetTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  targetTimeText: { fontSize: 13, color: '#4A90D9', fontWeight: '500' },
  statsRow: { flexDirection: 'row', marginBottom: 24 },
  heatmapSection: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 24,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 12 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapCell: { width: 16, height: 16, borderRadius: 3 },
  recordItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  recordDate: { fontSize: 14, color: '#333', fontWeight: '500' },
  recordTimes: { fontSize: 12, color: '#F39C12', fontWeight: '600' },
  recordNote: { fontSize: 13, color: '#888' },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 20 },
  loadMoreBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, marginTop: 6,
    backgroundColor: '#fff', borderRadius: 10,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
});
