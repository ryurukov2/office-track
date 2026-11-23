import AsyncStorage from '@react-native-async-storage/async-storage';
import { allowed, dayKey, isWorkday, leaveAt, monthReport, newId, statusOf, summarize } from './model';
import { loadAllDays, loadDay, loadOffDays, loadSettings, saveDay, setOffDay } from './storage';
import {
  A_ARRIVE,
  A_BACK,
  A_LEAVE,
  A_LUNCH,
  A_SMOKE,
  dismiss,
  isReminder,
  scheduleReminders,
  updateStatusNotification,
} from './notify';
import { updateWidget } from './widget/updateWidget';
import { setTileState } from '../modules/office-tile';

/*
 * Shared actions used by the UI, the background notification task and the widget.
 * They always read from / write to storage, so they work even when the app isn't open.
 */

const HANDLED_KEY = 'lastHandledNotificationResponse';

const NOTIFICATION_ACTIONS = {
  [A_SMOKE]: ['break', 'smoke'],
  [A_LUNCH]: ['break', 'lunch'],
  [A_BACK]: ['back'],
  [A_LEAVE]: ['out'],
  [A_ARRIVE]: ['in'],
};

/** Everything needed to calculate today's numbers. */
export async function loadState() {
  const [settings, days, offDays] = await Promise.all([loadSettings(), loadAllDays(), loadOffDays()]);
  return { settings, days, offDays };
}

/**
 * Today's numbers, used by the Today screen, the notification and the widget.
 * pastBalanceMs = this month's balance before today; monthNowMs includes today once you've checked out.
 * leave = when today's quota is reached; leaveMonth = when leaving keeps the month's balance at zero.
 * leaveMonth counts today as a workday from the moment you arrive (today's quota minus overtime from
 * previous days), but today's time only enters the balance itself once you've checked out.
 */
export function todayInfo({ settings, days, offDays }, now = Date.now()) {
  const todayKey = dayKey(now);
  const targetMs = settings.targetMinutes * 60_000;
  const events = days.find((d) => d.key === todayKey)?.events ?? [];
  const sum = summarize(events, now, settings);
  const past = monthReport(days, offDays, todayKey.slice(0, 7), settings, {
    todayKey,
    now,
    excludeToday: true,
  });
  const off = offDays[todayKey];
  const expectedToday = isWorkday(todayKey, settings) && !off ? targetMs : 0;
  // Today only counts towards the month once you've checked out.
  const todayDelta = events.length && sum.status === 'out' ? sum.countedMs - expectedToday : 0;
  return {
    todayKey,
    targetMs,
    events,
    sum,
    off,
    expectedToday,
    past,
    pastBalanceMs: past.balanceMs,
    monthNowMs: past.balanceMs + todayDelta,
    leave: expectedToday ? leaveAt(sum, expectedToday, now) : null,
    leaveMonth: leaveAt(sum, expectedToday - past.balanceMs, now),
  };
}

/** Re-renders the notification, re-plans reminders and updates the home-screen widget. */
export async function refreshAll() {
  const state = await loadState();
  const info = todayInfo(state);
  await Promise.all([
    updateStatusNotification(info),
    scheduleReminders({
      ...info,
      settings: state.settings,
      offDays: state.offDays,
      hasEventsToday: info.events.length > 0,
    }),
    updateWidget(info),
  ]).catch(() => {});
  const { status } = info.sum;
  setTileState(
    status,
    status === 'break' ? "Tap when you're back" : status === 'in' ? 'Tap to start a break' : '',
  );
}

/** Records an arrive/break/back/leave tap for today. Ignored if it doesn't fit the current status. */
export async function recordAction(type, kind) {
  const key = dayKey();
  const events = await loadDay(key);
  if (allowed(statusOf(events)).includes(type)) {
    await saveDay(key, [...events, { id: newId(), type, ts: Date.now(), kind }]);
  }
  await refreshAll();
}

/** Replaces all events of a day (edit, adjust or delete a whole day). */
export async function saveDayEvents(key, events) {
  await saveDay(key, events);
  await refreshAll();
}

/** Marks a day as a day off (type) or clears it (null). */
export async function markOffDay(key, type) {
  const all = await setOffDay(key, type);
  await refreshAll();
  return all;
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
  if (isReminder(n?.request?.identifier)) await dismiss(n.request.identifier);
  await recordAction(...mapped);
  return true;
}
