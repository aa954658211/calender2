import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { StatsCard } from '../../src/components/StatsCard';
import { EmptyState } from '../../src/components/EmptyState';
import {
  calculateCurrentStreak,
  calculateLongestStreak,
  getWeeklyCompletionData,
  getHeatmapData,
  splitCompletion,
  streakDates,
} from '../../src/utils/statsCalculator';
import type { CheckinRecord } from '../../src/models/types';

export default function StatsScreen() {
  const habits = useHabitStore((s) => s.habits);
  const [allRecords, setAllRecords] = useState<CheckinRecord[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        try {
          const records = await useCheckinStore.getState().getAllRecords();
          if (!cancelled) setAllRecords(records);
        } catch (_e) {
          // ignore
        }
      };
      load();
      return () => { cancelled = true; };
    }, [])
  );

  if (habits.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState icon="stats-chart-outline" title="暂无统计数据" subtitle="创建打卡项目并开始打卡后，统计数据将显示在这里" />
      </View>
    );
  }

  const filteredRecords = selectedHabitId === 'all'
    ? allRecords
    : allRecords.filter((r) => r.habitId === selectedHabitId);

  const targets: Record<string, number> = {};
  habits.forEach((h) => { targets[h.id] = h.dailyTarget || 1; });
  // 完成日才计入总数/完成率；连续口径包含保护日
  const { completed, protectedDates } = splitCompletion(filteredRecords, targets);
  const allDates = completed;
  const currentStreak = calculateCurrentStreak(streakDates(completed, protectedDates));
  const longestStreak = calculateLongestStreak(streakDates(completed, protectedDates));
  const completedRecords = filteredRecords.filter(
    (r) => r.recordType === 'checkin' && (r.times ?? 1) >= (targets[r.habitId] || 1)
  );
  const weeklyData = getWeeklyCompletionData(completedRecords, selectedHabitId === 'all' ? habits.length : 1);
  const heatmapData = getHeatmapData(completedRecords, 35);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Habit selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
        <TouchableOpacity
          style={[styles.selectorChip, selectedHabitId === 'all' && styles.selectorChipActive]}
          onPress={() => setSelectedHabitId('all')}
        >
          <Text style={[styles.selectorText, selectedHabitId === 'all' && styles.selectorTextActive]}>全部</Text>
        </TouchableOpacity>
        {habits.map((h) => (
          <TouchableOpacity
            key={h.id}
            style={[styles.selectorChip, selectedHabitId === h.id && { backgroundColor: h.color + '25', borderColor: h.color }]}
            onPress={() => setSelectedHabitId(h.id)}
          >
            <Ionicons name={h.icon as any} size={14} color={selectedHabitId === h.id ? h.color : '#888'} />
            <Text style={[styles.selectorText, selectedHabitId === h.id && { color: h.color }]}>{h.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <StatsCard label="总打卡天数" value={allDates.length} icon="calendar" color="#4A90D9" />
        <View style={{ width: 10 }} />
        <StatsCard label="连续打卡" value={`${currentStreak}天`} icon="flame" color="#E74C3C" />
        <View style={{ width: 10 }} />
        <StatsCard label="最长连续" value={`${longestStreak}天`} icon="trophy" color="#F39C12" />
      </View>

      {/* Weekly chart */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>本周每日完成率</Text>
        {weeklyData.data.every((v) => v === 0) ? (
          <View style={styles.emptyChart}>
            <Ionicons name="bar-chart-outline" size={32} color="#ddd" />
            <Text style={styles.emptyChartText}>本周暂无打卡数据</Text>
          </View>
        ) : (
          <View style={styles.chartWrapper}>
            {/* Y-axis: absolutely positioned labels */}
            <View style={styles.yAxis}>
              {['100%', '75%', '50%', '25%', '0%'].map((label, i) => (
                <Text
                  key={label}
                  style={[styles.yLabel, { top: i * (CHART_HEIGHT / 4) - 6 }]}
                >
                  {label}
                </Text>
              ))}
            </View>
            {/* Chart area: grid + bars in one absolute-positioned space */}
            <View style={styles.chartArea}>
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[styles.gridLine, { top: i * (CHART_HEIGHT / 4) }]}
                />
              ))}
              {/* Bar columns */}
              {weeklyData.data.map((value, index) => {
                const isFuture = weeklyData.labels[index] === 'future';
                const barH = !isFuture && value > 0 ? (value / 100) * CHART_HEIGHT : 2;
                return (
                  <View
                    key={index}
                    style={[styles.barSlot, { left: `${(index * 100) / 7}%` as any }]}
                  >
                    {!isFuture && (
                      <Text style={[styles.barValue, { bottom: barH + BAR_LABEL_SPACE + 2 }]}>
                        {value}%
                      </Text>
                    )}
                    <View
                      style={[
                        styles.barFill,
                        !isFuture && value > 0
                          ? { height: barH, bottom: BAR_LABEL_SPACE, backgroundColor: '#4A90D9' }
                          : [styles.barEmpty, { bottom: BAR_LABEL_SPACE }],
                      ]}
                    />
                    <Text style={styles.barLabel}>
                      {weeklyData.displayLabels[index]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Heatmap */}
      <View style={styles.heatmapSection}>
        <Text style={styles.sectionTitle}>最近35天打卡热力图</Text>
        <View style={styles.heatmapGrid}>
          {heatmapData.map((item, index) => {
            const habitCount = selectedHabitId === 'all' ? habits.length : 1;
            const intensity = habitCount > 0 ? item.count / habitCount : 0;
            const opacity = Math.min(intensity, 1);
            return (
              <View
                key={item.date}
                style={[
                  styles.heatmapCell,
                  { backgroundColor: opacity > 0 ? `rgba(74, 144, 217, ${0.2 + opacity * 0.8})` : '#f0f0f0' },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.heatmapLegend}>
          <Text style={styles.legendText}>少</Text>
          <View style={[styles.legendCell, { backgroundColor: '#f0f0f0' }]} />
          <View style={[styles.legendCell, { backgroundColor: 'rgba(74,144,217,0.3)' }]} />
          <View style={[styles.legendCell, { backgroundColor: 'rgba(74,144,217,0.6)' }]} />
          <View style={[styles.legendCell, { backgroundColor: 'rgba(74,144,217,1)' }]} />
          <Text style={styles.legendText}>多</Text>
        </View>
      </View>

      {/* Habit details */}
      <Text style={styles.sectionTitle}>各项目详情</Text>
      {habits.map((habit) => {
        const habitRecords = allRecords.filter((r) => r.habitId === habit.id);
        const split = splitCompletion(habitRecords, { [habit.id]: habit.dailyTarget || 1 });
        const dates = split.completed;
        const streak = calculateCurrentStreak(streakDates(split.completed, split.protectedDates));
        return (
          <TouchableOpacity
            key={habit.id}
            style={styles.habitStatItem}
            onPress={() => router.push(`/detail/${habit.id}`)}
          >
            <View style={styles.habitStatLeft}>
              <View style={[styles.habitStatIcon, { backgroundColor: habit.color + '20' }]}>
                <Ionicons name={habit.icon as any} size={18} color={habit.color} />
              </View>
              <Text style={styles.habitStatName}>{habit.name}</Text>
            </View>
            <View style={styles.habitStatRight}>
              {habit.targetTime && (
                <View style={styles.habitTargetRow}>
                  <Ionicons name="calendar-outline" size={12} color="#aaa" />
                  <Text style={styles.habitTargetText}>{habit.targetTime}</Text>
                </View>
              )}
              <Text style={styles.habitStatNumber}>{dates.length}天</Text>
              <Text style={styles.habitStatStreak}>连续{streak}天</Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const CHART_HEIGHT = 140;
const BAR_LABEL_SPACE = 24;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { padding: 20, paddingBottom: 30 },
  selectorRow: { marginBottom: 16, maxHeight: 40 },
  selectorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#eee',
  },
  selectorChipActive: { backgroundColor: '#4A90D920', borderColor: '#4A90D9' },
  selectorText: { fontSize: 13, color: '#888', fontWeight: '500' },
  selectorTextActive: { color: '#4A90D9' },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  chartSection: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 12 },
  emptyChart: { alignItems: 'center', paddingVertical: 30 },
  emptyChartText: { fontSize: 13, color: '#aaa', marginTop: 8 },
  // ── Chart layout (absolute positioning for pixel-precise alignment) ──
  chartWrapper: { flexDirection: 'row', height: CHART_HEIGHT + BAR_LABEL_SPACE },
  yAxis: { width: 36, height: CHART_HEIGHT + BAR_LABEL_SPACE, position: 'relative' },
  yLabel: { position: 'absolute', right: 6, fontSize: 10, color: '#aaa', height: 12, textAlign: 'right' },
  chartArea: { flex: 1, height: CHART_HEIGHT + BAR_LABEL_SPACE, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#f0f0f0' },
  barSlot: {
    position: 'absolute', bottom: 0, width: `${100 / 7}%`,
    alignItems: 'center', height: CHART_HEIGHT + BAR_LABEL_SPACE,
  },
  barValue: {
    position: 'absolute', fontSize: 10, color: '#4A90D9', fontWeight: '600',
  },
  barFill: { position: 'absolute', width: 24, borderRadius: 4 },
  barEmpty: { height: 2, backgroundColor: '#eee', width: 24, borderRadius: 4 },
  barLabel: { position: 'absolute', top: CHART_HEIGHT + 4, fontSize: 11, color: '#888' },
  heatmapSection: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapCell: { width: 18, height: 18, borderRadius: 4 },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' },
  legendCell: { width: 14, height: 14, borderRadius: 3 },
  legendText: { fontSize: 11, color: '#999' },
  habitStatItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
  },
  habitStatLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  habitStatIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  habitStatName: { fontSize: 15, fontWeight: '500', color: '#333' },
  habitStatRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  habitStatNumber: { fontSize: 14, fontWeight: '600', color: '#4A90D9' },
  habitStatStreak: { fontSize: 12, color: '#888' },
  habitTargetRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 4 },
  habitTargetText: { fontSize: 11, color: '#aaa' },
});
