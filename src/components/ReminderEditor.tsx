import React, { useState, useEffect, useRef } from 'react';
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
  dailyTarget?: number; // 每日目标次数，>1 时显示提醒时段设置
  endTime?: string | null; // "HH:mm" 时段结束，null 表示仅单点提醒
  onChange: (patch: { enabled?: boolean; time?: string; days?: number[]; endTime?: string | null }) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59，精确到分钟

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// 滚轮选择器尺寸
const ITEM_H = 44;
const VISIBLE_ROWS = 5;

function formatDaysLabel(days: number[]): string {
  if (days.length === 0 || days.length >= 7) return '每天';
  const map = new Map(WEEKDAY_OPTIONS.map((o) => [o.value, o.label]));
  const sorted = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  return '每周' + sorted.map((d) => map.get(d)).join('、');
}

export function ReminderEditor({ enabled, time, days, color, dailyTarget = 1, endTime = null, onChange }: Props) {
  const parsed = parseReminderTime(time);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingField, setEditingField] = useState<'start' | 'end'>('start');
  const [tempHour, setTempHour] = useState(parsed.hour);
  const [tempMinute, setTempMinute] = useState(parsed.minute);

  const isMulti = dailyTarget > 1;

  useEffect(() => {
    const p = parseReminderTime(time);
    setTempHour(p.hour);
    setTempMinute(p.minute);
  }, [time]);

  const openTimePicker = (field: 'start' | 'end') => {
    const source = field === 'end' && endTime ? endTime : time;
    const p = parseReminderTime(source);
    setTempHour(p.hour);
    setTempMinute(p.minute);
    setEditingField(field);
    setShowTimePicker(true);
  };

  const handleTimeConfirm = () => {
    setShowTimePicker(false);
    const value = `${pad(tempHour)}:${pad(tempMinute)}`;
    if (editingField === 'end') {
      onChange({ endTime: value });
    } else {
      onChange({ time: value });
    }
  };

  // 滚轮：打开时定位到当前值，滚动吸附后回写选中时分
  const hourRef = useRef<ScrollView>(null);
  const minuteRef = useRef<ScrollView>(null);

  const alignWheel = (y: number, max: number) =>
    Math.max(0, Math.min(max, Math.round(y / ITEM_H)));

  const handleHourLayout = () => {
    hourRef.current?.scrollTo({ y: tempHour * ITEM_H, animated: false });
  };
  const handleMinuteLayout = () => {
    minuteRef.current?.scrollTo({ y: tempMinute * ITEM_H, animated: false });
  };
  const handleHourScroll = (y: number) => {
    const h = alignWheel(y, 23);
    setTempHour((prev) => (prev === h ? prev : h));
  };
  const handleMinuteScroll = (y: number) => {
    const m = alignWheel(y, 59);
    setTempMinute((prev) => (prev === m ? prev : m));
  };

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
          <TouchableOpacity style={styles.timeRow} onPress={() => openTimePicker('start')}>
            <View style={styles.headerLeft}>
              <Ionicons name="time-outline" size={18} color={color} />
              <Text style={styles.timeLabel}>{isMulti ? '提醒时段开始' : '提醒时间'}</Text>
            </View>
            <Text style={[styles.timeValue, { color }]}>{time}</Text>
          </TouchableOpacity>

          {/* 多次打卡：时段结束 */}
          {isMulti && (
            <View style={styles.timeRow}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                onPress={() => openTimePicker('end')}
              >
                <Ionicons name="hourglass-outline" size={18} color={endTime ? color : '#bbb'} />
                <Text style={[styles.timeLabel, { color: endTime ? '#333' : '#bbb' }]}>提醒时段结束</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {endTime ? (
                  <TouchableOpacity onPress={() => onChange({ endTime: null })} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#ccc" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => openTimePicker('end')}>
                  <Text style={[styles.timeValue, { color: endTime ? color : '#bbb' }]}>
                    {endTime ?? '未设置'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

          {isMulti && endTime ? (
            <Text style={styles.summary}>
              将在「{formatDaysLabel(days)}」的 {time}–{endTime} 间均分提醒 {dailyTarget} 次，每次通知标注第几次
            </Text>
          ) : (
            <Text style={styles.summary}>
              将在「{formatDaysLabel(days)} {time}」提醒你打卡
              {isMulti ? '（设置时段结束后可按次数多次提醒）' : ''}
            </Text>
          )}
        </>
      )}

      {/* Time picker: 滚动式轮盘，惯性滑动 + 吸附到行 */}
      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingField === 'end' ? '选择时段结束时间' : '选择提醒时间'}</Text>
              <TouchableOpacity onPress={handleTimeConfirm}>
                <Text style={[styles.modalConfirmText, { color }]}>确认</Text>
              </TouchableOpacity>
            </View>

            {/* 大号时间预览，随滚轮实时变化 */}
            <Text style={[styles.bigTime, { color }]}>{pad(tempHour)} : {pad(tempMinute)}</Text>

            <View style={styles.wheelRow}>
              <View style={styles.wheelCol}>
                <ScrollView
                  ref={hourRef}
                  onLayout={handleHourLayout}
                  style={styles.wheelBox}
                  contentContainerStyle={{ paddingVertical: ITEM_H * ((VISIBLE_ROWS - 1) / 2) }}
                  snapToInterval={ITEM_H}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(e) => handleHourScroll(e.nativeEvent.contentOffset.y)}
                >
                  {HOURS.map((h) => (
                    <View key={`h-${h}`} style={styles.wheelItem}>
                      <Text style={[styles.wheelText, h === tempHour && styles.wheelTextActive]}>{pad(h)}</Text>
                    </View>
                  ))}
                </ScrollView>
                <View pointerEvents="none" style={[styles.wheelSelector, { borderColor: color }]} />
                <Text style={styles.wheelUnit}>时</Text>
              </View>

              <View style={styles.wheelCol}>
                <ScrollView
                  ref={minuteRef}
                  onLayout={handleMinuteLayout}
                  style={styles.wheelBox}
                  contentContainerStyle={{ paddingVertical: ITEM_H * ((VISIBLE_ROWS - 1) / 2) }}
                  snapToInterval={ITEM_H}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(e) => handleMinuteScroll(e.nativeEvent.contentOffset.y)}
                >
                  {MINUTES.map((m) => (
                    <View key={`m-${m}`} style={styles.wheelItem}>
                      <Text style={[styles.wheelText, m === tempMinute && styles.wheelTextActive]}>{pad(m)}</Text>
                    </View>
                  ))}
                </ScrollView>
                <View pointerEvents="none" style={[styles.wheelSelector, { borderColor: color }]} />
                <Text style={styles.wheelUnit}>分</Text>
              </View>
            </View>
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
  bigTime: { fontSize: 34, fontWeight: '700', textAlign: 'center', marginTop: 12, marginBottom: 4 },
  // 滚轮选择器
  wheelRow: { flexDirection: 'row', justifyContent: 'center', gap: 36, paddingVertical: 8 },
  wheelCol: { alignItems: 'center' },
  wheelBox: { height: ITEM_H * VISIBLE_ROWS, width: 76 },
  wheelItem: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  wheelText: { fontSize: 20, color: '#aaa', fontWeight: '500' },
  wheelTextActive: { fontSize: 24, color: '#333', fontWeight: '800' },
  wheelSelector: {
    position: 'absolute', top: ITEM_H * ((VISIBLE_ROWS - 1) / 2), left: 0, right: 0,
    height: ITEM_H, borderWidth: 1.5, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)',
  },
  wheelUnit: { fontSize: 13, color: '#999', marginTop: 6 },
});
