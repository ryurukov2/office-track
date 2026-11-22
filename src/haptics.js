import * as Haptics from 'expo-haptics';

/** Short vibration for main buttons. Never throws (e.g. on devices without a vibration motor). */
export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

/** Light tick for small buttons (time shifts, adjustments). */
export const tick = () => Haptics.selectionAsync().catch(() => {});

/** Stronger feedback for destructive actions. */
export const warn = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
