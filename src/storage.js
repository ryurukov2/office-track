import AsyncStorage from '@react-native-async-storage/async-storage';

const DAY_PREFIX = 'day:';

const SETTINGS_KEY = 'settings';
const OFF_DAYS_KEY = 'offDays';

export const DEFAULT_SETTINGS = {
  targetMinutes: 7 * 60 + 40, // daily quota
  workdays: [1, 2, 3, 4, 5], // Date.getDay(): 0 = Sunday
  countMode: 'worked', // 'worked' | 'turnstile' (see model.js)
  insideKinds: { smoke: false, lunch: false, other: false }, // breaks spent inside the building
  reminders: {
    longBreak: true,
    breakLimits: { smoke: 15, lunch: 60, other: 30 }, // minutes
    forgotLeave: true,
    forgotLeaveAt: 20 * 60, // minutes since midnight
    noArrival: false,
    noArrivalAt: 10 * 60,
    quotaReached: true,
    monthTarget: false,
  },
};

/** Fills in defaults for settings saved by older versions. */
function withDefaults(saved) {
  const d = DEFAULT_SETTINGS;
  return {
    ...d,
    ...saved,
    insideKinds: { ...d.insideKinds, ...saved.insideKinds },
    reminders: {
      ...d.reminders,
      ...saved.reminders,
      breakLimits: { ...d.reminders.breakLimits, ...saved.reminders?.breakLimits },
    },
  };
}

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
    delete parsed.targetHours;
    return withDefaults(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/** Days off: { "YYYY-MM-DD": 'vacation' | 'sick' | 'holiday' | 'other' } */
export async function loadOffDays() {
  try {
    const raw = await AsyncStorage.getItem(OFF_DAYS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function setOffDay(key, type) {
  const all = await loadOffDays();
  if (type) all[key] = type;
  else delete all[key];
  await AsyncStorage.setItem(OFF_DAYS_KEY, JSON.stringify(all));
  return all;
}
