import AsyncStorage from '@react-native-async-storage/async-storage';

const DAY_PREFIX = 'day:';

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS = { targetMinutes: 7 * 60 + 40 };

export async function loadDay(key) {
  try {
    const raw = await AsyncStorage.getItem(DAY_PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveDay(key, events) {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  if (sorted.length === 0) await AsyncStorage.removeItem(DAY_PREFIX + key);
  else await AsyncStorage.setItem(DAY_PREFIX + key, JSON.stringify(sorted));
}

/** All stored days, newest first. */
export async function loadAllDays() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(DAY_PREFIX));
  const pairs = await AsyncStorage.multiGet(keys);
  return pairs
    .map(([k, v]) => ({ key: k.slice(DAY_PREFIX.length), events: v ? JSON.parse(v) : [] }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (parsed.targetMinutes === undefined && typeof parsed.targetHours === 'number') {
      parsed.targetMinutes = Math.round(parsed.targetHours * 60); // old format
    }
    return { targetMinutes: parsed.targetMinutes ?? DEFAULT_SETTINGS.targetMinutes };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
