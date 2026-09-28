import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CheckinButtonProps {
  checked: boolean;
  color: string;
  onPress: () => void;
}

export function CheckinButton({ checked, color, onPress }: CheckinButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Animated.View style={[styles.button, { transform: [{ scale: scaleAnim }] }]}>
        {checked ? (
          <View style={[styles.checkedCircle, { backgroundColor: color }]}>
            <Ionicons name="checkmark" size={22} color="#fff" />
          </View>
        ) : (
          <View style={[styles.uncheckedCircle, { borderColor: color }]} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckedCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
  },
});
