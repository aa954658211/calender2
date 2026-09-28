import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WEEKDAY_OPTIONS, parseReminderTime } from '../services/notificationService';

interface Props {
  enabled: boolean;
  time: string; // "HH:mm"
  days: number[]; // 0=周日...6=周六，空数组表示每天
  color: string;
  onChange: (patch: { enabled?: boolean; time?: string; days?: number[] }) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatDaysLabel(days: number[]): string {
  if (days.length === 0 || days.length >= 7) return '每天';
  const map = new Map(WEEKDAY_OPTIONS.map((o) => [o.value, o.label]));
  const sorted = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  return '每周' + sorted.map((d) => map.get(d)).join('、');
}

export function ReminderEditor({ enabled, time, days, color, onChange }: Props) {
  const parsed = parseReminderTime(time);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempHour, setTempHour] = useState(parsed.hour);
  const [tempMinute, setTempMinute] = useState(parsed.minute);

  useEffect(() => {
    const p = parseReminderTime(time);
    setTempHour(p.hour);
    setTempMinute(p.minute);
  }, [time]);

  const openTimePicker = () => {
    const p = parseReminderTime(time);
    setTempHour(p.hour);
    setTempMinute(p.minute);
    setShowTimePicker(true);
  };

  const handleTimeConfirm = () => {
    setShowTimePicker(false);
    onChange({ time: `${pad(tempHour)}:${pad(tempMinute)}` });
  };

  const clampHour = (h: number) => (h < 0 ? 23 : h > 23 ? 0 : h);
  const clampMinute = (m: number) => (m < 0 ? 59 : m > 59 ? 0 : m);

  const toggleDay = (value: number) => {
    // 当前视为「每天」（空或全选）时，点击某个星期切换为「除该天外的其它天」
    const isEveryDay = days.length === 0 || days.length >= 7;
    let next: number[];
    if (isEveryDay) {
      const all = WEEKDAY_OPTIONS.map((o) => o.value);
      next = all.includes(value) ? all.filter((d) => d !== value) : all;
    } else if (days.includes(value)) {
      next = days.filter((d) => d !== value);
    } else {
      next = [...days, value];
    }
    // 若补齐为 7 天则归并为「每天」（空数组）
    if (next.length >= 7) next = [];
    onChange({ days: next });
  };

  const selectEveryDay = () => onChange({ days: [] });
  const selectWorkdays = () => onChange({ days: [1, 2, 3, 4, 5] });

  // 判断某天是否被选中（每天视为全部选中）
  const isDayActive = (value: number) =>
    days.length === 0 || days.length >= 7 || days.includes(value);

  const isWorkdays =
    days.length === 5 && !days.includes(0) && !days.includes(6);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="alarm-outline" size={20} color={color} />
          <Text style={styles.headerText}>提醒</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={(v) => onChange({ enabled: v })}
          trackColor={{ true: color, false: '#ddd' }}
        />
      </View>

      {!enabled && (
        <Text style={styles.hint}>开启后可为该项目设置专属提醒时间，像闹钟一样按星期循环。</Text>
      )}

      {enabled && (
        <>
          {/* 时间 */}
          <TouchableOpacity style={styles.timeRow} onPress={openTimePicker}>
            <View style={styles.headerLeft}>
              <Ionicons name="time-outline" size={18} color={color} />
              <Text style={styles.timeLabel}>提醒时间</Text>
            </View>
            <Text style={[styles.timeValue, { color }]}>{time}</Text>
          </TouchableOpacity>

          {/* 快捷选择 */}
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickChip, (days.length === 0 || days.length >= 7) && styles.quickChipActive]}
              onPress={selectEveryDay}
            >
              <Text style={[styles.quickChipText, (days.length === 0 || days.length >= 7) && styles.quickChipTextActive]}>每天</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickChip, isWorkdays && styles.quickChipActive]}
              onPress={selectWorkdays}
            >
              <Text style={[styles.quickChipText, isWorkdays && styles.quickChipTextActive]}>工作日</Text>
            </TouchableOpacity>
          </View>

          {/* 星期选择 */}
          <View style={styles.weekRow}>
            {WEEKDAY_OPTIONS.map((opt) => {
              const active = isDayActive(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.dayChip, active && { backgroundColor: color }]}
                  onPress={() => toggleDay(opt.value)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.summary}>将在「{formatDaysLabel(days)} {time}」提醒你打卡</Text>
        </>
      )}

      {/* Time picker: tap-to-select grid */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '86%' }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>选择提醒时间</Text>
              <TouchableOpacity onPress={handleTimeConfirm}>
                <Text style={[styles.modalConfirmText, { color }]}>确认</Text>
              </TouchableOpacity>
            </View>

            {/* 大号时间预览 */}
            <Text style={[styles.bigTime, { color }]}>{pad(tempHour)} : {pad(tempMinute)}</Text>

            {/* 步进微调：可精确到任意分钟 */}
            <View style={styles.stepperRow}>
              <View style={styles.stepperGroup}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setTempHour(clampHour(tempHour - 1))}>
                  <Ionicons name="remove" size={22} color={color} />
                </TouchableOpacity>
                <View style={styles.stepValueWrap}>
                  <Text style={styles.stepValue}>{pad(tempHour)}</Text>
                  <Text style={styles.stepUnit}>时</Text>
                </View>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setTempHour(clampHour(tempHour + 1))}>
                  <Ionicons name="add" size={22} color={color} />
                </TouchableOpacity>
              </View>

              <View style={styles.stepperGroup}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setTempMinute(clampMinute(tempMinute - 1))}>
                  <Ionicons name="remove" size={22} color={color} />
                </TouchableOpacity>
                <View style={styles.stepValueWrap}>
                  <Text style={styles.stepValue}>{pad(tempMinute)}</Text>
                  <Text style={styles.stepUnit}>分</Text>
                </View>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setTempMinute(clampMinute(tempMinute + 1))}>
                  <Ionicons name="add" size={22} color={color} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.gridScroll}>
              <Text style={styles.gridLabel}>小时</Text>
              <View style={styles.grid}>
                {HOURS.map((h) => {
                  const active = h === tempHour;
                  return (
                    <TouchableOpacity
                      key={`h-${h}`}
                      style={[styles.gridCell, active && { backgroundColor: color }]}
                      onPress={() => setTempHour(h)}
                    >
                      <Text style={[styles.gridCellText, active && styles.gridCellTextActive]}>{pad(h)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.gridLabel}>分钟</Text>
              <View style={styles.grid}>
                {MINUTES.map((m) => {
                  const active = m === tempMinute;
                  return (
                    <TouchableOpacity
                      key={`m-${m}`}
                      style={[styles.gridCell, active && { backgroundColor: color }]}
                      onPress={() => setTempMinute(m)}
                    >
                      <Text style={[styles.gridCellText, active && styles.gridCellTextActive]}>{pad(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#eee',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { fontSize: 15, color: '#333', fontWeight: '600' },
  hint: { fontSize: 13, color: '#aaa', marginTop: 8, lineHeight: 19 },
  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, paddingVertical: 8,
  },
  timeLabel: { fontSize: 15, color: '#333' },
  timeValue: { fontSize: 22, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  quickChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#e2ebff',
  },
  quickChipActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  quickChipText: { fontSize: 13, color: '#4A90D9', fontWeight: '600' },
  quickChipTextActive: { color: '#fff' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  dayChip: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#f2f3f5',
    justifyContent: 'center', alignItems: 'center',
  },
  dayChipText: { fontSize: 14, color: '#888', fontWeight: '600' },
  dayChipTextActive: { color: '#fff', fontWeight: '700' },
  summary: { fontSize: 13, color: '#999', marginTop: 14, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  modalCancelText: { fontSize: 15, color: '#999' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  modalConfirmText: { fontSize: 15, fontWeight: '600' },
  bigTime: { fontSize: 34, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  stepperRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginVertical: 12 },
  stepperGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f2f3f5',
    justifyContent: 'center', alignItems: 'center',
  },
  stepValueWrap: { alignItems: 'center', minWidth: 48 },
  stepValue: { fontSize: 26, fontWeight: '700', color: '#333' },
  stepUnit: { fontSize: 12, color: '#999', marginTop: -2 },
  gridScroll: { paddingHorizontal: 16 },
  gridLabel: { fontSize: 13, color: '#999', marginBottom: 8, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCell: {
    width: '22%', height: 44, borderRadius: 10, backgroundColor: '#f2f3f5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  gridCellText: { fontSize: 17, color: '#555', fontWeight: '600' },
  gridCellTextActive: { color: '#fff', fontWeight: '700' },
});
