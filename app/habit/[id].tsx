import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  Modal, FlatList, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { HabitIconPicker } from '../../src/components/HabitIconPicker';
import { ColorPicker } from '../../src/components/ColorPicker';
import { HabitCard } from '../../src/components/HabitCard';
import { ReminderEditor } from '../../src/components/ReminderEditor';

const ITEM_HEIGHT = 44;

function getYears() {
  const now = new Date();
  return Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);
}
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
function getDays(year: number, month: number) {
  return Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
}
function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseDateStr(s: string | null) {
  if (!s) { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate() }; }
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export default function EditHabitScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habits = useHabitStore((s) => s.habits);
  const updateHabit = useHabitStore((s) => s.updateHabit);

  const habit = habits.find((h) => h.id === id);
  const parsed = parseDateStr(habit?.targetTime ?? null);

  const [name, setName] = useState(habit?.name || '');
  const [icon, setIcon] = useState(habit?.icon || 'star');
  const [color, setColor] = useState(habit?.color || '#4A90D9');
  const [enableTarget, setEnableTarget] = useState(!!habit?.targetTime);
  const [targetYear, setTargetYear] = useState(parsed.year);
  const [targetMonth, setTargetMonth] = useState(parsed.month);
  const [targetDay, setTargetDay] = useState(parsed.day);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(habit?.reminderEnabled ?? false);
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime ?? '20:00');
  const [reminderDays, setReminderDays] = useState<number[]>(habit?.reminderDays ?? []);

  const yearRef = useRef<FlatList>(null);
  const monthRef = useRef<FlatList>(null);
  const dayRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!habit) {
      Alert.alert('错误', '未找到该项目');
      router.back();
    }
  }, []);

  if (!habit) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '请输入项目名称');
      return;
    }
    const targetTime = enableTarget ? formatDate(targetYear, targetMonth, targetDay) : null;
    await updateHabit(habit.id, {
      name: name.trim(),
      icon,
      color,
      targetTime,
      reminderEnabled,
      reminderTime,
      reminderDays,
    });
    router.back();
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
    setTimeout(() => {
      const years = getYears();
      const yIdx = years.indexOf(targetYear);
      yearRef.current?.scrollToIndex({ index: yIdx >= 0 ? yIdx : 0, animated: false });
      monthRef.current?.scrollToIndex({ index: targetMonth - 1, animated: false });
      const days = getDays(targetYear, targetMonth);
      const dIdx = days.indexOf(targetDay);
      dayRef.current?.scrollToIndex({ index: dIdx >= 0 ? dIdx : 0, animated: false });
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>项目名称</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={20} />

        <HabitIconPicker selectedIcon={icon} onSelect={setIcon} color={color} />
        <ColorPicker selectedColor={color} onSelect={setColor} />

        <Text style={styles.label}>目标日期</Text>
        <View style={styles.targetSection}>
          <View style={styles.targetRow}>
            <View style={styles.targetLeft}>
              <Ionicons name="calendar-outline" size={20} color="#4A90D9" />
              <Text style={styles.targetText}>设置目标日期</Text>
            </View>
            <Switch value={enableTarget} onValueChange={setEnableTarget}
              trackColor={{ true: '#4A90D9', false: '#ddd' }} />
          </View>
          {enableTarget && (
            <TouchableOpacity style={styles.dateButton} onPress={openDatePicker}>
              <Ionicons name="calendar" size={18} color="#4A90D9" />
              <Text style={styles.dateButtonText}>{formatDate(targetYear, targetMonth, targetDay)}</Text>
            </TouchableOpacity>
          )}
          {!enableTarget && <Text style={styles.targetHint}>不设置目标日期，长期打卡</Text>}
        </View>

        <Text style={styles.label}>提醒设置</Text>
        <ReminderEditor
          enabled={reminderEnabled}
          time={reminderTime}
          days={reminderDays}
          color={color}
          onChange={(patch) => {
            if (patch.enabled !== undefined) setReminderEnabled(patch.enabled);
            if (patch.time !== undefined) setReminderTime(patch.time);
            if (patch.days !== undefined) setReminderDays(patch.days);
          }}
        />

        <Text style={styles.label}>预览效果</Text>
        <View style={styles.previewWrap}>
          <HabitCard
            habit={{ ...habit, name: name || habit.name, icon, color, targetTime: enableTarget ? formatDate(targetYear, targetMonth, targetDay) : null, reminderEnabled, reminderTime, reminderDays }}
            checked={false}
            onToggle={() => {}}
          />
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存修改</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>选择目标日期</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalConfirmText}>确认</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>年</Text>
                <View style={styles.pickerHighlight} />
                <FlatList ref={yearRef} data={getYears()} keyExtractor={(item) => `y-${item}`}
                  snapToInterval={ITEM_HEIGHT} decelerationRate="fast" showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                  renderItem={({ item }) => (
                    <View style={[styles.pickerItem, item === targetYear && styles.pickerItemActive]}>
                      <Text style={[styles.pickerItemText, item === targetYear && styles.pickerItemTextActive]}>{item}</Text>
                    </View>
                  )}
                  onMomentumScrollEnd={(e) => {
                    const years = getYears();
                    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                    const val = years[index];
                    if (val !== undefined) {
                      setTargetYear(val);
                      const maxDay = new Date(val, targetMonth, 0).getDate();
                      if (targetDay > maxDay) setTargetDay(maxDay);
                    }
                  }}
                  initialScrollIndex={Math.max(0, getYears().indexOf(targetYear))}
                  getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                />
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>月</Text>
                <View style={styles.pickerHighlight} />
                <FlatList ref={monthRef} data={MONTHS} keyExtractor={(item) => `m-${item}`}
                  snapToInterval={ITEM_HEIGHT} decelerationRate="fast" showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                  renderItem={({ item }) => (
                    <View style={[styles.pickerItem, item === targetMonth && styles.pickerItemActive]}>
                      <Text style={[styles.pickerItemText, item === targetMonth && styles.pickerItemTextActive]}>{String(item).padStart(2, '0')}</Text>
                    </View>
                  )}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                    const val = MONTHS[index];
                    if (val !== undefined) {
                      setTargetMonth(val);
                      const maxDay = new Date(targetYear, val, 0).getDate();
                      if (targetDay > maxDay) setTargetDay(maxDay);
                    }
                  }}
                  initialScrollIndex={targetMonth - 1}
                  getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                />
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>日</Text>
                <View style={styles.pickerHighlight} />
                <FlatList ref={dayRef} data={getDays(targetYear, targetMonth)} keyExtractor={(item) => `d-${item}`}
                  snapToInterval={ITEM_HEIGHT} decelerationRate="fast" showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                  renderItem={({ item }) => (
                    <View style={[styles.pickerItem, item === targetDay && styles.pickerItemActive]}>
                      <Text style={[styles.pickerItemText, item === targetDay && styles.pickerItemTextActive]}>{String(item).padStart(2, '0')}</Text>
                    </View>
                  )}
                  onMomentumScrollEnd={(e) => {
                    const days = getDays(targetYear, targetMonth);
                    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                    if (days[index] !== undefined) setTargetDay(days[index]);
                  }}
                  initialScrollIndex={Math.max(0, getDays(targetYear, targetMonth).indexOf(targetDay))}
                  getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 10 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#eee',
  },
  targetSection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#eee',
  },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  targetText: { fontSize: 15, color: '#333' },
  dateButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#f0f4ff', borderRadius: 10,
  },
  dateButtonText: { fontSize: 17, fontWeight: '700', color: '#4A90D9' },
  targetHint: { fontSize: 13, color: '#aaa', marginTop: 8 },
  previewWrap: { marginBottom: 24 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  modalCancelText: { fontSize: 15, color: '#999' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  modalConfirmText: { fontSize: 15, color: '#4A90D9', fontWeight: '600' },
  pickerContainer: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    height: ITEM_HEIGHT * 5 + 20, paddingHorizontal: 20,
  },
  pickerColumn: { flex: 1, alignItems: 'center' },
  pickerLabel: { fontSize: 13, color: '#999', marginBottom: 4, position: 'absolute', top: ITEM_HEIGHT * 2 - 10, zIndex: 1 },
  pickerHighlight: {
    position: 'absolute', top: ITEM_HEIGHT * 2, width: '100%', height: ITEM_HEIGHT,
    backgroundColor: '#f0f4ff', borderRadius: 8,
  },
  pickerItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  pickerItemActive: {},
  pickerItemText: { fontSize: 20, color: '#ccc', fontWeight: '400' },
  pickerItemTextActive: { fontSize: 24, color: '#333', fontWeight: '700' },
});
