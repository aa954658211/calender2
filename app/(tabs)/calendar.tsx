import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { checkinRepository } from '../../src/db/repositories/checkinRepository';
import { formatDate, formatToday } from '../../src/utils/dateUtils';
import type { CheckinRecord } from '../../src/models/types';

export default function CalendarScreen() {
  const habits = useHabitStore((s) => s.habits);
  const loadDate = useCheckinStore((s) => s.loadDate);
  const selectedDateCheckins = useCheckinStore((s) => s.selectedDateCheckins);
  const selectedDate = useCheckinStore((s) => s.selectedDate);

  const [markedDates, setMarkedDates] = useState<any>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        try {
          const marks = await buildMonthMarks(currentMonth);
          if (!cancelled) {
            setMarkedDates(marks);
            await loadDate(selectedDate || formatToday());
          }
        } catch (_e) {
          // ignore — rapid tab switching may cause transient errors
        }
      };
      load();
      return () => { cancelled = true; };
    }, [habits])
  );

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
        return { color: habit?.color || '#ccc', selectedDotColor: '#fff' };
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
        <Text style={styles.detailTitle}>
          {selectedDate === formatToday() ? '今天' : selectedDate} 的打卡记录
        </Text>

        {habits.length === 0 ? (
          <Text style={styles.emptyText}>暂无打卡项目</Text>
        ) : (
          <ScrollView style={styles.detailList}>
            {habits.map((habit) => {
              const checked = selectedDateCheckins.has(habit.id);
              return (
                <View key={habit.id} style={styles.detailItem}>
                  <View style={styles.detailLeft}>
                    <View style={[styles.detailIcon, { backgroundColor: habit.color + '20' }]}>
                      <Ionicons name={habit.icon as any} size={18} color={habit.color} />
                    </View>
                    <Text style={styles.detailName}>{habit.name}</Text>
                  </View>
                  <Ionicons
                    name={checked ? 'checkmark-circle' : 'close-circle'}
                    size={24}
                    color={checked ? habit.color : '#ddd'}
                  />
                </View>
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
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  detailList: { flex: 1 },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailName: { fontSize: 15, color: '#333', fontWeight: '500' },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 20 },
});
