import AsyncStorage from '@react-native-async-storage/async-storage';
import { allowed, dayKey, monthBalance, newId, statusOf, summarize } from './model';
import { loadAllDays, loadDay, loadSettings, saveDay } from './storage';
import { A_BACK, A_LEAVE, A_LUNCH, A_SMOKE, updateStatusNotification } from './notify';

/*
 * Shared actions used both by the UI and by the background notification task.
 * They always read from / write to storage, so they work even when the app isn't open.
 */

const HANDLED_KEY = 'lastHandledNotificationResponse';

const NOTIFICATION_ACTIONS = {
  [A_SMOKE]: ['break', 'smoke'],
  [A_LUNCH]: ['break', 'lunch'],
  [A_BACK]: ['back'],
  [A_LEAVE]: ['out'],
};

/** Re-renders the status notification from what's stored. */
export async function refreshNotification() {
  const settings = await loadSettings();
  const targetMs = settings.targetMinutes * 60_000;
  const today = dayKey();
  const days = await loadAllDays();
  const events = days.find((d) => d.key === today)?.events ?? [];
  const past = monthBalance(days, today.slice(0, 7), targetMs, today);
  await updateStatusNotification(summarize(events), targetMs, past.balanceMs);
}

/** Records an arrive/break/back/leave tap for today. Ignored if it doesn't fit the current status. */
export async function recordAction(type, kind) {
  const key = dayKey();
  const events = await loadDay(key);
  if (allowed(statusOf(events)).includes(type)) {
    await saveDay(key, [...events, { id: newId(), type, ts: Date.now(), kind }]);
  }
  await refreshNotification();
}

/** Replaces all events of a day (edit, adjust or delete a whole day). */
export async function saveDayEvents(key, events) {
  await saveDay(key, events);
  await refreshNotification();
}

/**
 * Handles a notification button press. Safe to call twice for the same press
 * (from the background task and from the app), only the first one counts.
 */
export async function handleNotificationResponse(response) {
  const action = response?.actionIdentifier;
  const mapped = NOTIFICATION_ACTIONS[action];
  if (!mapped) return false;
  const n = response.notification;
  const id = `${n?.request?.identifier}|${n?.date}|${action}`;
  if ((await AsyncStorage.getItem(HANDLED_KEY)) === id) return false;
  await AsyncStorage.setItem(HANDLED_KEY, id);
  await recordAction(...mapped);
  return true;
}
