import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PRESET_ICONS } from '../utils/constants';

interface HabitIconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
  color: string;
}

export function HabitIconPicker({ selectedIcon, onSelect, color }: HabitIconPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>选择图标</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.iconList}>
          {PRESET_ICONS.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[
                styles.iconItem,
                selectedIcon === icon && { backgroundColor: color + '25', borderColor: color, borderWidth: 2 },
              ]}
              onPress={() => onSelect(icon)}
            >
              <Ionicons name={icon as any} size={26} color={selectedIcon === icon ? color : '#888'} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 10 },
  iconList: { flexDirection: 'row', gap: 10, paddingHorizontal: 2 },
  iconItem: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
