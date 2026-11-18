# Office Tracker

A tiny Android app for tracking how long you actually spend in the office: one tap when you arrive, one tap for a smoke or lunch break, one tap when you leave. It replaces pausing and resuming a stopwatch in the Clock app.

Built with **React Native + Expo** in plain JavaScript.

## Features

- **One-tap tracking**: big buttons for *Arrived*, *Smoke*, *Lunch*, *Other break*, *Back* and *Leave*. Only the buttons that make sense right now are shown.
- **Notification with action buttons**: while you're in the office, a notification that can't be swiped away shows when you can leave and has Smoke / Lunch / Leave (or Back) buttons, reachable from the lock screen.
- **Daily quota** (default **7:40**, adjustable in 5-minute steps) with a progress bar and "can leave at HH:MM".
- **Monthly balance**: every day you come in adds `worked − quota` to the month's balance, so an 8:00 day and a 7:20 day cancel out. Shows "+2h 00m overtime" / "30m below quota", plus the time to leave to stay on target for the month. Days you don't come in don't count. A fresh balance starts each month.
- **History**: per-month totals, balance and daily average; tap a month to see each day with its +/− and its smoke / lunch break time.
- **Fix mistakes**: tap any entry in today's log to move it by ±1/5/30 minutes or delete it.
- **Battery friendly**: no GPS, Wi-Fi scanning, network or background service. The notification text only changes when you tap something, and the on-screen clock runs only while the app is open.
- **Private**: all data stays on the phone (AsyncStorage).

## How the numbers are calculated

Each day is stored as a list of timestamped events (`in`, `break`, `back`, `out`). The app walks them in order:

- time while **in** → worked
- time while **on break** → break (split by smoke / lunch / other)
- time while **out** → not counted

Monthly balance = Σ (worked − quota) over the tracked days of that month.

## Project structure

```
App.js            UI: Today screen, History screen, edit dialog
src/model.js      pure logic: events → worked/break time, balances, formatting
src/storage.js    persistence (AsyncStorage): days and settings
src/notify.js     the notification and its action buttons
app.json          Expo config (app name, Android package, plugins)
eas.json          EAS build profiles (`preview` builds an installable APK)
```

## Development

```bash
npm install
npx expo start        # scan the QR code with the Expo Go app on your phone
```

Build an installable APK in the cloud (free Expo account):

```bash
npx eas-cli@latest build -p android --profile preview
```

## Tech

React Native · Expo SDK 58 · expo-notifications · AsyncStorage · EAS Build

## Roadmap

- Home-screen widget and Quick Settings tile
- CSV export to compare with the company's turnstile report
- Store the quota per day so changing it doesn't recalculate past months
