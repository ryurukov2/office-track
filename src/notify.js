import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, fmtBalance, fmtDur, fmtHM, fmtTime, isWorkday, KIND_LABELS, parseKey } from './model';

const STATUS_CHANNEL = 'tracker'; // silent, sticky status
const REMINDER_CHANNEL = 'reminders'; // pops up with sound

const STATUS_ID = 'office-tracker-status';

const QUOTA_KEY = 'quotaReminder'; // { day, at } of the last planned quota reminder
const REMINDER_IDS = ['rem-break', 'rem-leave', 'rem-quota', 'rem-month', 'rem-arrive'];

export const CAT_IN = 'tracker_in';
export const CAT_BREAK = 'tracker_break';
export const CAT_OUT = 'tracker_out';

// Action identifiers, handled in src/actions.js
export const A_SMOKE = 'smoke';
export const A_LUNCH = 'lunch';
export const A_BACK = 'back';
export const A_LEAVE = 'leave';
export const A_ARRIVE = 'arrive';

export const isReminder = (identifier) => REMINDER_IDS.includes(identifier);

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const popup = isReminder(n.request.identifier);
    return { shouldShowBanner: popup, shouldShowList: true, shouldPlaySound: popup, shouldSetBadge: false };
  },
});

export async function setupNotifications() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(STATUS_CHANNEL, {
      name: 'Office timer',
      importance: Notifications.AndroidImportance.LOW, // silent, no popup
      showBadge: false,
    });
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Reminders',
      description: 'Long breaks, forgotten check-out, quota reached',
      importance: Notifications.AndroidImportance.HIGH,
      showBadge: false,
    });
  }
  // Buttons are handled in the background (see src/backgroundTask.js), so the app stays closed.
  const opts = { opensAppToForeground: false };
  await Notifications.setNotificationCategoryAsync(CAT_IN, [
    { identifier: A_SMOKE, buttonTitle: '🚬 Smoke', options: opts },
    { identifier: A_LUNCH, buttonTitle: '🍽️ Lunch', options: opts },
    { identifier: A_LEAVE, buttonTitle: '🏠 Leave', options: opts },
  ]);
  await Notifications.setNotificationCategoryAsync(CAT_BREAK, [
    { identifier: A_BACK, buttonTitle: '✅ Back', options: opts },
    { identifier: A_LEAVE, buttonTitle: '🏠 Leave', options: opts },
  ]);
  await Notifications.setNotificationCategoryAsync(CAT_OUT, [
    { identifier: A_ARRIVE, buttonTitle: '🏢 Arrived', options: opts },
  ]);
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Shows (or replaces) the sticky status notification, or removes it when out.
 * Text only contains values that don't change until the next tap,
 * so the notification never needs periodic refreshing (zero background work).
 */
export async function updateStatusNotification({ sum, pastBalanceMs, leave, leaveMonth }) {
  if (Platform.OS === 'web') return;
  if (sum.status === 'out') {
    await Notifications.dismissNotificationAsync(STATUS_ID).catch(() => {});
    return;
  }
  const month = `Month: ${fmtBalance(pastBalanceMs)} before today`;
  const title =
    sum.status === 'break'
      ? `On break: ${KIND_LABELS[sum.currentBreakKind ?? 'other']} since ${fmtTime(sum.breakStartedAt)}`
      : `In office · leave at ${leave ? fmtTime(leave) : '-'}` +
        (leaveMonth && leaveMonth !== leave ? ` (${fmtTime(leaveMonth)} for month)` : '');
  const body =
    sum.status === 'break'
      ? `${fmtDur(sum.countedMs)} today · ${month}`
      : `${month} · breaks ${fmtDur(sum.breakMs)}`;

  await Notifications.scheduleNotificationAsync({
    identifier: STATUS_ID,
    content: {
      title,
      body,
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: sum.status === 'break' ? CAT_BREAK : CAT_IN,
      sound: false,
    },
    trigger: Platform.OS === 'android' ? { channelId: STATUS_CHANNEL } : null,
  });
}

async function schedule(identifier, date, title, body, categoryIdentifier) {
  if (date <= Date.now() + 5_000) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, categoryIdentifier, sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: REMINDER_CHANNEL },
  });
}

const atMinutes = (key, minutes) => parseKey(key).getTime() + minutes * 60_000;

/**
 * Re-plans all reminders from the current state. Each one is a single scheduled alarm,
 * so nothing runs in the background. Called after every change.
 */
export async function scheduleReminders({
  sum,
  settings,
  todayKey,
  offDays,
  hasEventsToday,
  leave,
  leaveMonth,
}) {
  if (Platform.OS === 'web') return;
  // Cancel every pending reminder, including any stray copies, before planning new ones.
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const ids = new Set([...REMINDER_IDS, ...pending.map((n) => n.identifier).filter((id) => id.startsWith('rem-'))]);
  await Promise.all([...ids].map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  const rem = settings.reminders;
  const targetMs = settings.targetMinutes * 60_000;

  if (sum.status === 'break' && rem.longBreak) {
    const kind = sum.currentBreakKind ?? 'other';
    const limit = rem.breakLimits[kind];
    await schedule(
      'rem-break',
      sum.breakStartedAt + limit * 60_000,
      `Still on your ${KIND_LABELS[kind]} break?`,
      `It's been ${limit} minutes. Tap Back if you forgot.`,
      CAT_BREAK,
    );
  }

  if (sum.status !== 'out' && rem.forgotLeave) {
    await schedule(
      'rem-leave',
      atMinutes(todayKey, rem.forgotLeaveAt),
      'Still in the office?',
      `It's ${fmtHM(rem.forgotLeaveAt * 60_000)} and you're still checked in.`,
      sum.status === 'break' ? CAT_BREAK : CAT_IN,
    );
  }

  // The quota reminder goes off at most once a day: once its time has passed it's not planned again.
  const quotaSent = JSON.parse((await AsyncStorage.getItem(QUOTA_KEY)) ?? 'null');
  const quotaDoneToday = quotaSent?.day === todayKey && quotaSent.at <= Date.now();
  if (sum.status === 'in' && rem.quotaReached && leave && sum.countedMs < targetMs && !quotaDoneToday) {
    await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify({ day: todayKey, at: leave }));
    await schedule(
      'rem-quota',
      leave,
      'Daily quota reached 🎉',
      `${fmtHM(targetMs)} done, you can leave.`,
      CAT_IN,
    );
  }

  if (sum.status === 'in' && rem.monthTarget && leaveMonth && leaveMonth !== leave) {
    await schedule(
      'rem-month',
      leaveMonth,
      'Monthly target reached',
      'Leaving now keeps your month on target.',
      CAT_IN,
    );
  }

  if (rem.noArrival) {
    // next workday (today if not checked in yet) that isn't a day off
    let key = hasEventsToday ? addDays(todayKey, 1) : todayKey;
    for (let i = 0; i < 14 && (!isWorkday(key, settings) || offDays[key]); i++) key = addDays(key, 1);
    await schedule(
      'rem-arrive',
      atMinutes(key, rem.noArrivalAt),
      'Not checked in yet',
      'Tap Arrived if you are in the office.',
      CAT_OUT,
    );
  }
}

export async function dismiss(identifier) {
  await Notifications.dismissNotificationAsync(identifier).catch(() => {});
}
