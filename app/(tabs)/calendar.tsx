import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { checkinRepository } from '../../src/db/repositories/checkinRepository';
import { formatDate, formatToday } from '../../src/utils/dateUtils';
import type { CheckinRecord, Habit } from '../../src/models/types';
import type { MakeupInfo } from '../../src/stores/checkinStore';

const FREEZE_DOT_COLOR = '#F39C12';

export default function CalendarScreen() {
  const router = useRouter();
  const habits = useHabitStore((s) => s.habits);
  const loadDate = useCheckinStore((s) => s.loadDate);
  const selectedDateCheckins = useCheckinStore((s) => s.selectedDateCheckins);
  const selectedDate = useCheckinStore((s) => s.selectedDate);
  const increment = useCheckinStore((s) => s.increment);
  const undo = useCheckinStore((s) => s.undo);
  const useFreezeCard = useCheckinStore((s) => s.useFreezeCard);
  const getMakeupInfo = useCheckinStore((s) => s.getMakeupInfo);

  const [markedDates, setMarkedDates] = useState<any>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [makeup, setMakeup] = useState<MakeupInfo | null>(null);

  const buildMonthMarks = async (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const allRecords: CheckinRecord[] = [];
    for (const habit of habits) {
      const records = await checkinRepository.getByHabit(habit.id, startDate, endDate);
      allRecords.push(...records);
    }

    const byDate: Record<string, CheckinRecord[]> = {};
    allRecords.forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r);
    });

    const marks: any = {};
    const today = formatToday();

    Object.keys(byDate).forEach((dateStr) => {
      const records = byDate[dateStr];
      const dots = records.map((r) => {
        const habit = habits.find((h) => h.id === r.habitId);
        const color = r.recordType === 'freeze' ? FREEZE_DOT_COLOR : habit?.color || '#ccc';
        return { color, selectedDotColor: '#fff' };
      });

      marks[dateStr] = {
        dots,
        marked: true,
        ...(dateStr === today && { selected: true, selectedColor: '#4A90D9' }),
      };
    });

    if (!marks[today]) {
      marks[today] = { selected: true, selectedColor: '#4A90D9' };
    }

    return marks;
  };

  const refreshMarks = useCallback(() => {
    buildMonthMarks(currentMonth).then(setMarkedDates).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, habits]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        try {
          const marks = await buildMonthMarks(currentMonth);
          const info = await getMakeupInfo();
          if (!cancelled) {
            setMarkedDates(marks);
            setMakeup(info);
            await loadDate(selectedDate || formatToday());
          }
        } catch (_e) {
          // ignore — rapid tab switching may cause transient errors
        }
      };
      load();
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [habits])
  );

  const handleDayPress = async (day: { dateString: string }) => {
    try {
      await loadDate(day.dateString);
    } catch (_e) {
      // ignore
    }
    // Update marks for selection
    setMarkedDates((prev: any) => {
      const newMarks = { ...prev };
      // Remove old selection
      Object.keys(newMarks).forEach((key) => {
        if (newMarks[key].selected && key !== formatToday()) {
          delete newMarks[key].selected;
          delete newMarks[key].selectedColor;
        }
      });
      newMarks[day.dateString] = {
        ...newMarks[day.dateString],
        selected: true,
        selectedColor: '#4A90D9',
      };
      return newMarks;
    });
  };

  const handleMonthChange = (month: { year: number; month: number }) => {
    const newDate = new Date(month.year, month.month - 1, 1);
    setCurrentMonth(newDate);
    buildMonthMarks(newDate).then(setMarkedDates).catch(() => {});
  };

  const isFuture = selectedDate > formatToday();
  const isPast = selectedDate < formatToday();

  const handleToggle = async (habit: Habit) => {
    if (isFuture) return;
    const result = await increment(habit, selectedDate);
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
        Alert.alert('本月补卡额度已用完', `本月额度 ${makeup?.quota ?? 0} 次已用完，下月会重置`);
        break;
      case 'blocked_future':
        break;
    }
    getMakeupInfo().then(setMakeup).catch(() => {});
    refreshMarks();
  };

  const handleRowLongPress = (habit: Habit) => {
    const rec = selectedDateCheckins.get(habit.id);
    const buttons: any[] = [];
    if (rec) {
      buttons.push({
        text: '撤销这天的打卡',
        onPress: async () => {
          await undo(habit.id, selectedDate);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          getMakeupInfo().then(setMakeup).catch(() => {});
          refreshMarks();
        },
      });
    }
    const target = habit.dailyTarget || 1;
    const done = !!rec && rec.recordType === 'checkin' && (rec.times ?? 1) >= target;
    if (isPast && !done && (habit.freezeCards ?? 0) > 0) {
      buttons.push({
        text: `使用保护卡（剩 ${habit.freezeCards} 张）`,
        onPress: async () => {
          const res = await useFreezeCard(habit, selectedDate);
          if (res === 'no_card') Alert.alert('保护卡不足', '每连续打卡 7 天可获得 1 张保护卡');
          else if (res === 'already_done') Alert.alert('无需使用', '这一天已经完成打卡了');
          else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refreshMarks();
        },
      });
    }
    buttons.push({ text: '查看项目详情', onPress: () => router.push(`/detail/${habit.id}`) });
    buttons.push({ text: '取消', style: 'cancel' });
    Alert.alert(`${habit.name} · ${selectedDate}`, '长按可执行的操作', buttons);
  };

  const renderStatus = (habit: Habit) => {
    const rec = selectedDateCheckins.get(habit.id);
    const target = habit.dailyTarget || 1;
    const isMulti = target > 1;
    if (rec && rec.recordType === 'freeze') {
      return { text: '保护卡', color: FREEZE_DOT_COLOR, icon: 'shield-checkmark' as const };
    }
    const times = rec && rec.recordType === 'checkin' ? (rec.times ?? 1) : 0;
    if (times >= target) {
      return {
        text: isMulti ? `${target}/${target} 次` : '已打卡',
        color: habit.color,
        icon: 'checkmark-circle' as const,
      };
    }
    if (times > 0) {
      return { text: `${times}/${target} 次`, color: '#4A90D9', icon: 'ellipse' as const };
    }
    return { text: '未打卡', color: '#ddd', icon: 'close-circle' as const };
  };

  return (
    <View style={styles.container}>
      <Calendar
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        theme={{
          calendarBackground: '#fff',
          textSectionTitleColor: '#888',
          dayTextColor: '#333',
          todayTextColor: '#4A90D9',
          selectedDayTextColor: '#fff',
          selectedDayBackgroundColor: '#4A90D9',
          monthTextColor: '#333',
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayFontSize: 16,
        }}
      />

      {/* Selected date details */}
      <View style={styles.detailSection}>
        <View style={styles.detailHeaderRow}>
          <Text style={styles.detailTitle}>
            {selectedDate === formatToday() ? '今天' : selectedDate} 的打卡
          </Text>
          {isPast && makeup && (
            <Text style={styles.quotaText}>
              补卡额度 剩 {makeup.remaining}/{makeup.quota}
            </Text>
          )}
        </View>
        {isPast && (
          <Text style={styles.hintText}>
            点击项目可为该日期补打卡{makeup && !makeup.enabled ? '（补卡已关闭）' : ''}，长按可撤销或使用保护卡
          </Text>
        )}

        {habits.length === 0 ? (
          <Text style={styles.emptyText}>暂无打卡项目</Text>
        ) : (
          <ScrollView style={styles.detailList}>
            {habits.map((habit) => {
              const status = renderStatus(habit);
              return (
                <TouchableOpacity
                  key={habit.id}
                  style={[styles.detailItem, isFuture && styles.detailItemDisabled]}
                  onPress={() => handleToggle(habit)}
                  onLongPress={() => handleRowLongPress(habit)}
                  disabled={isFuture}
                  activeOpacity={0.7}
                >
                  <View style={styles.detailLeft}>
                    <View style={[styles.detailIcon, { backgroundColor: habit.color + '20' }]}>
                      <Ionicons name={habit.icon as any} size={18} color={habit.color} />
                    </View>
                    <View>
                      <Text style={styles.detailName}>{habit.name}</Text>
                      {(habit.dailyTarget || 1) > 1 && (
                        <Text style={styles.detailSub}>每日 {habit.dailyTarget} 次</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.detailRight}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                    <Ionicons name={status.icon} size={24} color={status.color} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  detailSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    marginTop: 8,
  },
  detailHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  quotaText: { fontSize: 12, color: '#F39C12', fontWeight: '600' },
  hintText: { fontSize: 11, color: '#aaa', marginBottom: 10 },
  detailList: { flex: 1 },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailItemDisabled: { opacity: 0.5 },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailName: { fontSize: 15, color: '#333', fontWeight: '500' },
  detailSub: { fontSize: 11, color: '#aaa', marginTop: 2 },
  detailRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 20 },
});
