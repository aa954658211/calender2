import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Switch,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore } from '../../src/stores/habitStore';
import { useCheckinStore } from '../../src/stores/checkinStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { notificationService } from '../../src/services/notificationService';
import { exportService } from '../../src/services/exportService';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { getDatabase } from '../../src/db/database';

export default function SettingsScreen() {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [importing, setImporting] = useState(false);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // 导入/清除后同步刷新内存中的 store 状态
  const refreshStores = async () => {
    await useHabitStore.getState().loadHabits();
    await useCheckinStore.getState().loadToday();
  };

  const handleClearData = async () => {
    setShowClearDialog(false);
    const db = await getDatabase();
    await db.execAsync('DELETE FROM checkin_records;');
    await db.execAsync('DELETE FROM habits;');
    await refreshStores();
    Alert.alert('已清除', '所有数据已被清除');
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (exporting) return;
    setExporting(format);
    try {
      const count = format === 'json'
        ? await exportService.exportJson()
        : await exportService.exportCsv();
      Alert.alert('导出成功', `已导出 ${count} 条打卡记录`);
    } catch (e) {
      Alert.alert('导出失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setExporting(null);
    }
  };

  const handleImport = async () => {
    setShowImportDialog(false);
    if (importing) return;
    setImporting(true);
    try {
      const result = await exportService.importJson();
      if (!result) return; // 用户取消选择文件
      await refreshStores();
      Alert.alert(
        '导入完成',
        `新增 ${result.habits} 个项目、${result.checkins} 条打卡记录` +
        (result.skipped > 0 ? `，跳过 ${result.skipped} 条重复数据` : '')
      );
    } catch (e) {
      Alert.alert('导入失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* 提醒说明：改为每个项目自带提醒 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>提醒通知</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={22} color="#4A90D9" />
            <Text style={styles.rowText}>提醒已改为按项目设置</Text>
          </View>
        </View>
        <Text style={styles.reliabilityHint}>
          在「编辑项目」页面可为每个打卡项目单独设置提醒时间，并选择周一到周日循环提醒，像闹钟一样。
        </Text>
      </View>

      {/* 提醒可靠性 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>提醒可靠性</Text>
        <Text style={styles.reliabilityHint}>
          提醒未按时到达？国产手机系统会冻结后台应用导致通知延迟，请完成以下设置：
        </Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => notificationService.openAppSettings()}>
          <View style={styles.rowLeft}>
            <Ionicons name="settings-outline" size={22} color="#4A90D9" />
            <Text style={styles.rowText}>打开应用设置：允许自启动、省电策略改为「无限制」</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <View style={styles.reliabilityTip}>
          <Ionicons name="information-circle-outline" size={16} color="#F39C12" />
          <Text style={styles.reliabilityTipText}>
            精确闹钟权限已由应用自动获得，无需在系统「闹钟和提醒」列表中单独授权；小米/华为用户还需在「通知管理」中将本应用设为重要通知，否则仍可能被限流
          </Text>
        </View>
      </View>

      {/* 补卡与保护卡 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>补卡与保护卡</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="time-outline" size={22} color="#4A90D9" />
            <Text style={styles.rowText}>允许补卡</Text>
          </View>
          <Switch
            value={settings.makeupEnabled}
            onValueChange={(v) => updateSettings({ makeupEnabled: v })}
            trackColor={{ true: '#4A90D9', false: '#ddd' }}
          />
        </View>
        {settings.makeupEnabled && (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="calculator-outline" size={22} color="#4A90D9" />
              <Text style={styles.rowText}>每月补卡额度</Text>
            </View>
            <View style={styles.quotaStepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => updateSettings({ makeupQuota: Math.max(0, settings.makeupQuota - 1) })}
                disabled={settings.makeupQuota <= 0}
              >
                <Text style={[styles.stepperBtnText, settings.makeupQuota <= 0 && { color: '#ccc' }]}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{settings.makeupQuota} 次</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => updateSettings({ makeupQuota: Math.min(28, settings.makeupQuota + 1) })}
                disabled={settings.makeupQuota >= 28}
              >
                <Text style={[styles.stepperBtnText, settings.makeupQuota >= 28 && { color: '#ccc' }]}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <Text style={styles.reliabilityHint}>
          开启后可在日历页点击过去日期补打卡，每月次数有限、自动按自然月重置；连续打卡每满 7 天可获得 1 张保护卡，使用保护卡可填补漏打卡日、维持连续记录。
        </Text>
      </View>

      {/* Data section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>数据管理</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleExport('json')}
          disabled={exporting !== null}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="download-outline" size={22} color="#2ECC71" />
            <Text style={styles.rowText}>导出数据 (JSON)</Text>
          </View>
          {exporting === 'json' ? (
            <ActivityIndicator size="small" color="#2ECC71" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleExport('csv')}
          disabled={exporting !== null}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="grid-outline" size={22} color="#9B59B6" />
            <Text style={styles.rowText}>导出数据 (CSV)</Text>
          </View>
          {exporting === 'csv' ? (
            <ActivityIndicator size="small" color="#9B59B6" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowImportDialog(true)}
          disabled={importing || exporting !== null}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="cloud-upload-outline" size={22} color="#F39C12" />
            <Text style={styles.rowText}>导入数据 (JSON)</Text>
          </View>
          {importing ? (
            <ActivityIndicator size="small" color="#F39C12" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowClearDialog(true)}>
          <View style={styles.rowLeft}>
            <Ionicons name="trash-outline" size={22} color="#E74C3C" />
            <Text style={[styles.rowText, { color: '#E74C3C' }]}>清除所有数据</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>关于</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="information-circle-outline" size={22} color="#888" />
            <Text style={styles.rowText}>版本</Text>
          </View>
          <Text style={styles.versionText}>{Constants.expoConfig?.version ?? '1.0.1'}</Text>
        </View>
      </View>

      <ConfirmDialog
        visible={showImportDialog}
        title="导入数据"
        message="选择本应用导出的 JSON 备份文件，数据将合并导入；已存在的项目和同一天同项目的记录会自动跳过，不会覆盖现有数据。"
        confirmText="选择文件"
        onConfirm={handleImport}
        onCancel={() => setShowImportDialog(false)}
      />

      <ConfirmDialog
        visible={showClearDialog}
        title="清除所有数据"
        message="确定要清除所有打卡项目和记录吗？此操作不可撤销。"
        confirmText="清除"
        destructive
        onConfirm={handleClearData}
        onCancel={() => setShowClearDialog(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  scrollContent: { padding: 20 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { fontSize: 15, color: '#333' },
  timeDisplay: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: { fontSize: 18, fontWeight: '600', color: '#4A90D9' },
  quotaStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f4ff',
    justifyContent: 'center', alignItems: 'center',
  },
  stepperBtnText: { fontSize: 18, color: '#4A90D9', fontWeight: '700' },
  stepperValue: { fontSize: 15, fontWeight: '700', color: '#333', minWidth: 44, textAlign: 'center' },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  versionText: { fontSize: 14, color: '#999' },
  reliabilityHint: { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 8 },
  reliabilityTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 },
  reliabilityTipText: { flex: 1, fontSize: 12, color: '#999', lineHeight: 17 },
});
