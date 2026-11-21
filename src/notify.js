import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fmtBalance, fmtDur, fmtTime, KIND_LABELS, leaveAt } from './model';

const CHANNEL = 'tracker';

const NOTIF_ID = 'office-tracker-status';

export const CAT_IN = 'tracker_in';

export const CAT_BREAK = 'tracker_break';

// Action identifiers, handled in App.js
export const A_SMOKE = 'smoke';

export const A_LUNCH = 'lunch';

export const A_BACK = 'back';

export const A_LEAVE = 'leave';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Office timer',
      importance: Notifications.AndroidImportance.LOW, // silent, no popup
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
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Shows (or replaces) the sticky status notification, or removes it when out.
 * @param pastBalanceMs month balance from previous days (today excluded)
 */
export async function updateStatusNotification(sum, targetMs, pastBalanceMs) {
  if (Platform.OS === 'web') return;
  if (sum.status === 'out') {
    await Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => {});
    return;
  }
  const leave = leaveAt(sum, targetMs);
  // Leave time that keeps the monthly balance at zero (earlier if in overtime).
  const leaveMonth = leaveAt(sum, targetMs - pastBalanceMs);
  const month = `Month: ${fmtBalance(pastBalanceMs)} before today`;
  // Text only contains values that don't change until the next tap,
  // so the notification never needs periodic refreshing (zero background work).
  const title =
    sum.status === 'break'
      ? `On break: ${KIND_LABELS[sum.currentBreakKind ?? 'other']} since ${fmtTime(sum.breakStartedAt)}`
      : `In office · leave at ${leave ? fmtTime(leave) : '-'}` +
        (leaveMonth && leaveMonth !== leave ? ` (${fmtTime(leaveMonth)} for month)` : '');
  const body =
    sum.status === 'break'
      ? `${fmtDur(sum.workedMs)} worked today · ${month}`
      : `${month} · breaks ${fmtDur(sum.breakMs)}`;
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_ID,
    content: {
      title,
      body,
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: sum.status === 'break' ? CAT_BREAK : CAT_IN,
      sound: false,
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}
