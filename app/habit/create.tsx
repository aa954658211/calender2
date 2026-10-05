import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  Modal, FlatList, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { HabitIconPicker } from '../../src/components/HabitIconPicker';
import { ColorPicker } from '../../src/components/ColorPicker';
import { HabitCard } from '../../src/components/HabitCard';
import { ReminderEditor } from '../../src/components/ReminderEditor';
import { PRESET_COLORS, PRESET_ICONS, PRESET_CATEGORIES } from '../../src/utils/constants';

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

function daysRemaining(targetDate: string): number | null {
  const target = new Date(targetDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function CreateHabitScreen() {
  const router = useRouter();
  const addHabit = useHabitStore((s) => s.addHabit);

  const now = new Date();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [enableTarget, setEnableTarget] = useState(false);
  const [targetYear, setTargetYear] = useState(now.getFullYear());
  const [targetMonth, setTargetMonth] = useState(now.getMonth() + 1);
  const [targetDay, setTargetDay] = useState(now.getDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [reminderDays, setReminderDays] = useState<number[]>([]);
  const [reminderEndTime, setReminderEndTime] = useState<string | null>(null);
  const [dailyTarget, setDailyTarget] = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState('');

  const yearRef = useRef<FlatList>(null);
  const monthRef = useRef<FlatList>(null);
  const dayRef = useRef<FlatList>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '请输入项目名称');
      return;
    }
    const targetTime = enableTarget ? formatDate(targetYear, targetMonth, targetDay) : null;
    const finalCategory = customCategory.trim() || category;
    await addHabit({
      name: name.trim(),
      icon,
      color,
      targetTime,
      reminderEnabled,
      reminderTime,
      reminderDays,
      reminderEndTime: dailyTarget > 1 ? reminderEndTime : null,
      dailyTarget,
      category: finalCategory,
    });
    router.back();
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
    setTimeout(() => {
      const years = getYears();
      yearRef.current?.scrollToIndex({ index: years.indexOf(targetYear), animated: false });
      monthRef.current?.scrollToIndex({ index: targetMonth - 1, animated: false });
      const days = getDays(targetYear, targetMonth);
      dayRef.current?.scrollToIndex({ index: days.indexOf(targetDay) >= 0 ? days.indexOf(targetDay) : 0, animated: false });
    }, 100);
  };

  const previewTargetTime = enableTarget ? formatDate(targetYear, targetMonth, targetDay) : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>项目名称</Text>
        <TextInput
          style={styles.input}
          placeholder="输入项目名称，如：读书、运动"
          value={name}
          onChangeText={setName}
          maxLength={20}
          autoFocus
        />

        <HabitIconPicker selectedIcon={icon} onSelect={setIcon} color={color} />
        <ColorPicker selectedColor={color} onSelect={setColor} />

        {/* Daily target times */}
        <Text style={styles.label}>每日目标次数</Text>
        <View style={styles.stepperSection}>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => setDailyTarget((v) => Math.max(1, v - 1))}
              disabled={dailyTarget <= 1}
            >
              <Text style={[styles.stepperBtnText, dailyTarget <= 1 && styles.stepperBtnDisabled]}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>
              {dailyTarget === 1 ? '每天 1 次（普通打卡）' : `每天 ${dailyTarget} 次`}
            </Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => setDailyTarget((v) => Math.min(20, v + 1))}
              disabled={dailyTarget >= 20}
            >
              <Text style={[styles.stepperBtnText, dailyTarget >= 20 && styles.stepperBtnDisabled]}>＋</Text>
            </TouchableOpacity>
          </View>
          {dailyTarget > 1 && (
            <Text style={styles.targetHint}>适合喝水、背单词等一天要完成多次的项目，首页会显示 n/{dailyTarget} 进度</Text>
          )}
        </View>

        {/* Category */}
        <Text style={styles.label}>分组标签</Text>
        <View style={styles.categorySection}>
          <View style={styles.categoryRow}>
            <TouchableOpacity
              style={[styles.categoryChip, !category && !customCategory.trim() && styles.categoryChipActive]}
              onPress={() => { setCategory(null); setCustomCategory(''); }}
            >
              <Text style={[styles.categoryChipText, !category && !customCategory.trim() && { color: '#4A90D9', fontWeight: '700' }]}>未分组</Text>
            </TouchableOpacity>
            {PRESET_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                onPress={() => { setCategory(c); setCustomCategory(''); }}
              >
                <Text style={[styles.categoryChipText, category === c && { color: '#4A90D9', fontWeight: '700' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.customCategoryInput}
            placeholder="自定义分组（可选，填写后优先于上方选择）"
            value={customCategory}
            onChangeText={setCustomCategory}
            maxLength={10}
          />
        </View>

        {/* Target date */}
        <Text style={styles.label}>目标日期</Text>
        <View style={styles.targetSection}>
          <View style={styles.targetRow}>
            <View style={styles.targetLeft}>
              <Ionicons name="calendar-outline" size={20} color="#4A90D9" />
              <Text style={styles.targetText}>设置目标日期</Text>
            </View>
            <Switch
              value={enableTarget}
              onValueChange={setEnableTarget}
              trackColor={{ true: '#4A90D9', false: '#ddd' }}
            />
          </View>
          {enableTarget && (
            <TouchableOpacity style={styles.dateButton} onPress={openDatePicker}>
              <Ionicons name="calendar" size={18} color="#4A90D9" />
              <Text style={styles.dateButtonText}>{formatDate(targetYear, targetMonth, targetDay)}</Text>
              {(() => {
                const days = daysRemaining(formatDate(targetYear, targetMonth, targetDay));
                return days !== null && days >= 0 ? (
                  <Text style={styles.daysLeft}>还剩 {days} 天</Text>
                ) : null;
              })()}
            </TouchableOpacity>
          )}
          {!enableTarget && (
            <Text style={styles.targetHint}>不设置目标日期，长期打卡</Text>
          )}
        </View>

        {/* Reminder */}
        <Text style={styles.label}>提醒设置</Text>
        <ReminderEditor
          enabled={reminderEnabled}
          time={reminderTime}
          days={reminderDays}
          color={color}
          dailyTarget={dailyTarget}
          endTime={reminderEndTime}
          onChange={(patch) => {
            if (patch.enabled !== undefined) setReminderEnabled(patch.enabled);
            if (patch.time !== undefined) setReminderTime(patch.time);
            if (patch.days !== undefined) setReminderDays(patch.days);
            if (patch.endTime !== undefined) setReminderEndTime(patch.endTime);
          }}
        />

        <Text style={styles.label}>预览效果</Text>
        <View style={styles.previewWrap}>
          <HabitCard
            habit={{
              id: 'preview',
              name: name || '项目名称',
              icon,
              color,
              targetTime: previewTargetTime,
              createdAt: '',
              updatedAt: '',
              archived: false,
              reminderEnabled,
              reminderTime,
              reminderDays,
              reminderEndTime,
              dailyTarget,
              category: customCategory.trim() || category,
              freezeCards: 0,
            }}
            times={0}
            onToggle={() => {}}
          />
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker Modal */}
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
              {/* Year */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>年</Text>
                <View style={styles.pickerHighlight} />
                <FlatList
                  ref={yearRef}
                  data={getYears()}
                  keyExtractor={(item) => `y-${item}`}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
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
                      // Clamp day
                      const maxDay = new Date(val, targetMonth, 0).getDate();
                      if (targetDay > maxDay) setTargetDay(maxDay);
                    }
                  }}
                  initialScrollIndex={getYears().indexOf(targetYear)}
                  getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                />
              </View>
              {/* Month */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>月</Text>
                <View style={styles.pickerHighlight} />
                <FlatList
                  ref={monthRef}
                  data={MONTHS}
                  keyExtractor={(item) => `m-${item}`}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
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
              {/* Day */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>日</Text>
                <View style={styles.pickerHighlight} />
                <FlatList
                  ref={dayRef}
                  data={getDays(targetYear, targetMonth)}
                  keyExtractor={(item) => `d-${item}`}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
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
                  initialScrollIndex={getDays(targetYear, targetMonth).indexOf(targetDay) >= 0 ? getDays(targetYear, targetMonth).indexOf(targetDay) : 0}
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
  daysLeft: { fontSize: 12, color: '#E67E22', marginLeft: 'auto', fontWeight: '600' },
  targetHint: { fontSize: 13, color: '#aaa', marginTop: 8 },
  stepperSection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#eee',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f4ff',
    justifyContent: 'center', alignItems: 'center',
  },
  stepperBtnText: { fontSize: 20, color: '#4A90D9', fontWeight: '700' },
  stepperBtnDisabled: { color: '#ccc' },
  stepperValue: { fontSize: 16, fontWeight: '600', color: '#333' },
  categorySection: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#eee',
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#f5f6f8', borderWidth: 1, borderColor: '#eee',
  },
  categoryChipActive: { backgroundColor: '#4A90D920', borderColor: '#4A90D9' },
  categoryChipText: { fontSize: 13, color: '#666' },
  customCategoryInput: {
    marginTop: 10, backgroundColor: '#f7f8fa', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: '#eee',
  },
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
