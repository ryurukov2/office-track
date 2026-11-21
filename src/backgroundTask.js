import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { handleNotificationResponse } from './actions';

/*
 * On Android, tapping a notification button while the app is in the background
 * (or closed) runs this task without opening the app.
 * Must be imported early, from index.js.
 */
const TASK = 'office-tracker-notification-action';

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return;
  await handleNotificationResponse(data);
});

Notifications.registerTaskAsync(TASK).catch(() => {});
