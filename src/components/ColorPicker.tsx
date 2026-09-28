import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PRESET_COLORS } from '../utils/constants';

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selectedColor, onSelect }: ColorPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>选择颜色</Text>
      <View style={styles.colorList}>
        {PRESET_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorDot,
              { backgroundColor: color },
              selectedColor === color && styles.selectedDot,
            ]}
            onPress={() => onSelect(color)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 10 },
  colorList: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  selectedDot: {
    borderWidth: 3,
    borderColor: '#333',
    transform: [{ scale: 1.1 }],
  },
});
