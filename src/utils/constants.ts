export const PRESET_COLORS = [
  '#4A90D9', '#E74C3C', '#2ECC71', '#F39C12',
  '#9B59B6', '#1ABC9C', '#E67E22', '#3498DB',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722',
];

export const PRESET_ICONS = [
  'book', 'run', 'water', 'brain',
  'fitness', 'musical-notes', 'color-palette', 'pencil',
  'barbell', 'restaurant', 'bed', 'medkit',
  'bicycle', 'cafe', 'heart', 'star',
  'flame', 'leaf', 'trophy', 'happy',
];

export const DEFAULT_SETTINGS: import('@/models/types').UserSettings = {
  reminderEnabled: false,
  reminderHour: 20,
  reminderMinute: 0,
  weekStartsOn: 1,
};
