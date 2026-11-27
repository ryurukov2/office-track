import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { dayKey } from './src/model';
import { DEFAULT_SETTINGS, saveSettings } from './src/storage';
import { setupNotifications } from './src/notify';
import {
  handleNotificationResponse,
  loadState,
  markOffDay,
  recordAction,
  refreshAll,
  saveDayEvents,
  todayInfo,
} from './src/actions';
import { DayModal } from './src/components/DayModal';
import { TodayScreen } from './src/screens/TodayScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { SwipePager } from './src/SwipePager';
import { styles } from './src/ui';

const TABS = [
  ['today', 'Today', 'time'],
  ['history', 'History', 'calendar'],
  ['stats', 'Stats', 'stats-chart'],
  ['settings', 'Settings', 'settings'],
];

export default function App() {
  const [tabIndex, setTabIndex] = useState(0);
  const tab = TABS[tabIndex][0];
  const [state, setState] = useState({ settings: DEFAULT_SETTINGS, days: [], offDays: {} });
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [dayEdit, setDayEdit] = useState(null); // { key, selectedId? } for the day editor

  const reload = useCallback(async () => setState(await loadState()), []);

  // Load once, then tick every second while the app is on screen.
  useEffect(() => {
    (async () => {
      await reload();
      setLoaded(true);
      await setupNotifications();
      await refreshAll();
    })();
    let t = null;
    const start = () => {
      if (!t) {
        setNow(Date.now());
        t = setInterval(() => setNow(Date.now()), 1000);
      }
    };
    const stop = () => {
      if (t) clearInterval(t);
      t = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        start();
        reload(); // pick up taps made from the notification or widget
      } else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [reload]);

  const today = dayKey(now);
  const info = useMemo(() => todayInfo(state, now), [state, now]);

  // Notification button pressed while the app is open (in the background they're handled by src/backgroundTask.js).
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!loaded || !response) return;
    handleNotificationResponse(response).then((handled) => handled && reload());
  }, [response, loaded, reload]);

  const record = async (type, kind) => {
    await recordAction(type, kind);
    await reload();
  };

  const saveSettingsAndRefresh = async (settings) => {
    setState((s) => ({ ...s, settings }));
    await saveSettings(settings);
    await refreshAll();
  };

  const editKey = dayEdit?.key;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SwipePager
        index={tabIndex}
        onIndexChange={setTabIndex}
        count={TABS.length}
        renderPage={(i) => {
          switch (TABS[i][0]) {
            case 'today':
              return (
                <TodayScreen
                  info={info}
                  settings={state.settings}
                  now={now}
                  onRecord={record}
                  onEditDay={(selectedId) => setDayEdit({ key: today, selectedId })}
                />
              );
            case 'history':
              return <HistoryScreen state={state} onOpenDay={(key) => setDayEdit({ key })} />;
            case 'stats':
              return <StatsScreen state={state} />;
            default:
              return <SettingsScreen settings={state.settings} onChange={saveSettingsAndRefresh} />;
          }
        }}
      />

      {/* bottom tab bar; swiping left / right also switches tabs */}
      <View style={styles.tabs}>
        {TABS.map(([id, label, icon], i) => (
          <Pressable
            key={id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setTabIndex(i);
            }}
            style={styles.tab}
          >
            <View style={[styles.tabPill, tab === id && styles.tabPillActive]}>
              <Ionicons name={tab === id ? icon : `${icon}-outline`} size={21} color={tab === id ? '#fff' : '#64748b'} />
            </View>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {dayEdit && (
        <DayModal
          dayKeyStr={editKey}
          initialSelectedId={dayEdit.selectedId}
          events={state.days.find((d) => d.key === editKey)?.events ?? []}
          off={state.offDays[editKey]}
          settings={state.settings}
          onChange={async (next) => {
            await saveDayEvents(editKey, next);
            await reload();
          }}
          onOffChange={async (type) => {
            await markOffDay(editKey, type);
            await reload();
          }}
          onClose={() => setDayEdit(null)}
        />
      )}
    </View>
  );
}
