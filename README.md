# Office Tracker

A tiny Android app for tracking how long you actually spend in the office: one tap when you arrive, one tap for a smoke or lunch break, one tap when you leave. It replaces pausing and resuming a stopwatch in the Clock app.

Built with **React Native + Expo** in plain JavaScript.

## Features

- **One-tap tracking**: big buttons for *Arrived*, *Smoke*, *Lunch*, *Other break*, *Back* and *Leave*, with haptic feedback. Only the buttons that make sense right now are shown.
- **Notification with action buttons**: while you're in the office, a notification that can't be swiped away shows when you can leave and has Smoke / Lunch / Leave (or Back) buttons, reachable from the lock screen. Pressing them records the action in the background without opening the app.
- **Home-screen widget**: status, leave time, monthly balance and one-tap buttons, without opening the app.
- **Quick Settings tile**: swipe down and tap to start or end a break; it always shows the real status.
- **Daily quota** (default **7:40**) with a progress bar and "can leave at HH:MM".
- **Monthly balance**: every workday (Mon–Fri by default) is expected to have the full quota; weekend work counts as overtime. Shows "+2h 00m overtime" / "30m below quota", plus the time to leave to stay on target for the month. A fresh balance starts each month.
- **Days off**: mark vacation, sick days and holidays (also in advance) so they don't count against the quota.
- **Turnstile mode**: count time inside the building instead of time minus all breaks. Choose which breaks happen inside (e.g. lunch in the canteen) to match the company's turnstile report.
- **Reminders**: still on a break after X minutes, still checked in late in the evening, not checked in by 10:00 on a workday, daily quota reached, monthly target reached. Each one has action buttons, e.g. *Back* on the long-break reminder.
- **History**: per-month balance with every day's +/−, missed workdays highlighted, days off and planned days off.
- **Stats**: average arrival and leave time, average breaks and smoke breaks, days on target, current streak, and a bar chart of the month.
- **CSV export**: export a month or everything and share it (email, Drive, ...) to compare with the turnstile report.
- **Day editor**: open any day to add or subtract time manually (e.g. −10m for a forgotten smoke break), move or delete single entries, mark it as a day off, or delete the whole day.
- **Battery friendly**: no GPS, Wi-Fi scanning, network or background service. Reminders are single scheduled alarms; the notification and widget only change when you tap something.
- **Private**: all data stays on the phone (AsyncStorage).

## How the numbers are calculated

Each day is stored as a list of timestamped events (`in`, `break`, `back`, `out`, plus manual `adjust` entries). The app walks them in order:

- time while **in** → worked
- time while **on break** → break (split by smoke / lunch / other)
- time while **out** → not counted
- manual adjustments are added to the worked time

In **turnstile mode**, breaks of the kinds marked as "inside the building" are counted as well.

Monthly balance = Σ counted time − quota × expected workdays, where expected workdays are the configured weekdays since you started using the app, minus days off. A day only counts once it's finished (you checked out), so the balance changes once a day. While you're in the office the app still shows two leave times: one for today's quota and one that keeps the month on target.

## Project structure

```
App.js                      app shell: tabs, state, day editor
src/model.js                pure logic: events → time, balances, reports, stats
src/storage.js              persistence (AsyncStorage): days, days off, settings
src/actions.js              actions shared by the UI, background task and widget
src/notify.js               status notification, action buttons and reminders
src/backgroundTask.js       handles notification buttons without opening the app
src/export.js               CSV export
src/widget/                 home-screen widget and its background handler
src/screens/                Today, History, Stats and Settings screens
src/components/DayModal.js  day editor
src/ui.js                   shared components and styles
modules/office-tile/        Quick Settings tile (small native Android module)
```

## Install

Download the APK from the [releases page](https://github.com/ryurukov2/office-track/releases) and open it on your phone (allow installing from your browser or file manager when Android asks).

## Development

The widget and the tile are native code, so the app runs in a development build rather than Expo Go:

```bash
npm install
npx expo run:android  # builds and installs a development build on a connected phone or emulator
```

Build an installable APK in the cloud (free Expo account):

```bash
npx eas-cli@latest build -p android --profile preview
```

## Tech

React Native · Expo SDK 58 · expo-notifications · expo-task-manager · react-native-android-widget · AsyncStorage · EAS Build

## Roadmap

- Store the quota per day so changing it doesn't recalculate past months
- Backup / restore
