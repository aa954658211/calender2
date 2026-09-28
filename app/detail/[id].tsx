import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { checkinRepository } from '../../src/db/repositories/checkinRepository';
import { StatsCard } from '../../src/components/StatsCard';
import {
  calculateCurrentStreak,
  calculateLongestStreak,
  calculateCompletionRate,
  getHeatmapData,
} from '../../src/utils/statsCalculator';
import { parseISO } from '../../src/utils/dateUtils';
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

  // Reset pagination and reload first page on focus
  useFocusEffect(
    useCallback(() => {
      if (!id || !habit) return () => {};
      let cancelled = false;

      const load = async () => {
        try {
          const firstPage = await checkinRepository.getByHabitPaged(habit.id, PAGE_SIZE, 0);
          const total = await checkinRepository.countByHabit(habit.id);
          if (cancelled) return;
          setRecords(firstPage);
          setHasMoreRecords(total > PAGE_SIZE);

          // Stats need full history scope
          const allRecs = total > PAGE_SIZE ? await checkinRepository.getByHabit(habit.id) : firstPage;
          const allDates = [...new Set(allRecs.map((r) => r.date))];
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
            currentStreak: calculateCurrentStreak(allDates),
            longestStreak: calculateLongestStreak(allDates),
            completionRate: Math.round(calculateCompletionRate(allDates, totalDays) * 100),
          });

          setHeatmapData(getHeatmapData(allRecs, 60));
        } catch (_e) {
          // ignore
        }
      };

      load();
      return () => { cancelled = true; };
    }, [id, habit?.id])
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: habit.color + '20' }]}>
          <Ionicons name={habit.icon as any} size={32} color={habit.color} />
        </View>
        <Text style={styles.headerName}>{habit.name}</Text>
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
              <Ionicons name="checkmark-circle" size={20} color={habit.color} />
              <Text style={styles.recordDate}>{record.date}</Text>
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
  recordNote: { fontSize: 13, color: '#888' },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 20 },
  loadMoreBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, marginTop: 6,
    backgroundColor: '#fff', borderRadius: 10,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
});
