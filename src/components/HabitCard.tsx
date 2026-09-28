import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckinButton } from './CheckinButton';
import type { Habit } from '../models/types';

interface HabitCardProps {
  habit: Habit;
  checked: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}

function getDaysRemaining(targetDate: string): number | null {
  const target = new Date(targetDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function HabitCard({ habit, checked, onToggle, onLongPress }: HabitCardProps) {
  const days = habit.targetTime ? getDaysRemaining(habit.targetTime) : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: habit.color + '20' }]}>
          <Ionicons name={habit.icon as any} size={24} color={habit.color} />
        </View>
        <CheckinButton checked={checked} color={habit.color} onPress={onToggle} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{habit.name}</Text>
      <Text style={[styles.status, { color: checked ? habit.color : '#aaa' }]}>
        {checked ? '已打卡' : '未打卡'}
      </Text>
      {habit.targetTime && days !== null && (
        <View style={styles.targetRow}>
          <Ionicons name="calendar-outline" size={12} color={days >= 0 ? '#4A90D9' : '#E74C3C'} />
          <Text style={[styles.targetText, { color: days >= 0 ? '#4A90D9' : '#E74C3C' }]}>
            {days > 0 ? `还剩 ${days} 天` : days === 0 ? '今天到期' : `已过期 ${Math.abs(days)} 天`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  targetText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
