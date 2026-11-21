import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  dayKey,
  fmtDelta,
  fmtBalance,
  fmtDur,
  fmtHM,
  fmtTime,
  KIND_LABELS,
  LABELS,
  leaveAt,
  monthBalance,
  newId,
  summarize,
} from './src/model';
import { DEFAULT_SETTINGS, loadAllDays, loadDay, loadSettings, saveSettings } from './src/storage';
import { setupNotifications } from './src/notify';
import { handleNotificationResponse, recordAction, refreshNotification, saveDayEvents } from './src/actions';

export default function App() {
  const [tab, setTab] = useState('today');
  const [today, setToday] = useState(dayKey());
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [now, setNow] = useState(Date.now());
  const [dayEdit, setDayEdit] = useState(null); // { key, selectedId? } for the day editor
  const [loaded, setLoaded] = useState(false);
  const [allDays, setAllDays] = useState([]);
  const targetMs = settings.targetMinutes * 60_000;
  const sum = useMemo(() => summarize(events, now), [events, now]);
  // Monthly balance from previous days of this month (today is added live below).
  useEffect(() => {
    loadAllDays().then(setAllDays);
  }, [today, events]);
  const past = useMemo(
    () => monthBalance(allDays, today.slice(0, 7), targetMs, today),
    [allDays, today, targetMs],
  );
  // Load + tick every second; roll over to a new day at midnight.
  useEffect(() => {
    (async () => {
      setSettings(await loadSettings());
      setEvents(await loadDay(dayKey()));
      setLoaded(true);
      await setupNotifications();
    })();
    // The 1s clock only runs while the app is on screen.
    let t = null;
    const tick = () => {
      setNow(Date.now());
      const k = dayKey();
      setToday((prev) => (prev !== k ? k : prev));
    };
    const start = () => {
      if (!t) {
        tick();
        t = setInterval(tick, 1000);
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
        loadDay(dayKey()).then(setEvents);
      } else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (loaded) loadDay(today).then(setEvents);
  }, [today]);
  const reloadToday = useCallback(async () => setEvents(await loadDay(dayKey())), []);

  // Arrive / break / back / leave taps from the app.
  const record = useCallback(
    async (type, kind) => {
      await recordAction(type, kind);
      await reloadToday();
    },
    [reloadToday],
  );

  // Save a whole day (edited entry, manual adjustment or deleted day).
  const saveDayAndReload = useCallback(
    async (key, next) => {
      await saveDayEvents(key, next);
      if (key === dayKey()) await reloadToday();
      setAllDays(await loadAllDays());
    },
    [reloadToday],
  );

  // Keep the notification in sync when the quota changes or the app starts.
  useEffect(() => {
    if (loaded) refreshNotification();
  }, [loaded, targetMs]);

  // Notification button pressed while the app is open (in the background they're handled by src/backgroundTask.js).
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!loaded || !response) return;
    handleNotificationResponse(response).then((handled) => handled && reloadToday());
  }, [response, loaded, reloadToday]);

  const leave = leaveAt(sum, targetMs, now);
  const progress = Math.min(1, sum.workedMs / targetMs);
  const done = sum.workedMs >= targetMs;
  // Balance including today: today counts once you've arrived.
  const todayDelta = events.length ? sum.workedMs - targetMs : 0;
  const monthNow = past.balanceMs + todayDelta;
  const leaveMonth = leaveAt(sum, targetMs - past.balanceMs, now);
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.tabs}>
        {['today', 'history'].map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'today' ? 'Today' : 'History'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'today' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.statusLabel}>
            {sum.status === 'out'
              ? events.length
                ? 'Left the office'
                : 'Not in the office'
              : sum.status === 'break'
                ? `On break · ${KIND_LABELS[sum.currentBreakKind ?? 'other']}`
                : 'In the office'}
          </Text>
          <Text style={[styles.bigTimer, done && { color: '#4ade80' }]}>{fmtDur(sum.workedMs, true)}</Text>
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                { width: `${progress * 100}%` },
                done && { backgroundColor: '#4ade80' },
              ]}
            />
          </View>
          <Text style={styles.sub}>
            {done
              ? `Daily quota of ${fmtHM(targetMs)} reached 🎉`
              : leave
                ? `Can leave at ${fmtTime(leave)} · ${fmtDur(targetMs - sum.workedMs)} to go`
                : `Daily quota ${fmtHM(targetMs)}`}
          </Text>

          <View style={styles.monthCard}>
            <Text style={styles.statLabel}>
              {new Date().toLocaleDateString(undefined, { month: 'long' })} balance
            </Text>
            <Text style={[styles.monthValue, { color: balanceColor(monthNow) }]}>{fmtBalance(monthNow)}</Text>
            <Text style={styles.muted}>
              {fmtBalance(past.balanceMs)} before today ({past.days} {past.days === 1 ? 'day' : 'days'})
              {sum.status !== 'out' && leaveMonth && leaveMonth !== leave
                ? ` · leave at ${fmtTime(leaveMonth)} to stay on monthly target`
                : ''}
            </Text>
          </View>
          {sum.status === 'break' && sum.breakStartedAt && (
            <Text style={styles.breakTimer}>Break: {fmtDur(now - sum.breakStartedAt, true)}</Text>
          )}

          <View style={styles.buttons}>
            {sum.status === 'out' && <Big label="🏢 Arrived" color="#2563eb" onPress={() => record('in')} />}
            {sum.status === 'in' && (
              <>
                <View style={styles.row}>
                  <Big
                    label={KIND_LABELS.smoke}
                    color="#f59e0b"
                    onPress={() => record('break', 'smoke')}
                    flex
                  />
                  <Big
                    label={KIND_LABELS.lunch}
                    color="#f97316"
                    onPress={() => record('break', 'lunch')}
                    flex
                  />
                </View>
                <Big label={KIND_LABELS.other} color="#a855f7" onPress={() => record('break', 'other')} />
                <Big label="🏠 Leave" color="#475569" onPress={() => record('out')} />
              </>
            )}
            {sum.status === 'break' && (
              <>
                <Big label="✅ Back" color="#16a34a" onPress={() => record('back')} />
                <Big label="🏠 Leave" color="#475569" onPress={() => record('out')} />
              </>
            )}
          </View>

          <View style={styles.statsRow}>
            <Stat label="Breaks" value={fmtDur(sum.breakMs)} />
            <Stat label="Smoke" value={fmtDur(sum.breakByKind.smoke)} />
            <Stat label="Lunch" value={fmtDur(sum.breakByKind.lunch)} />
            <Stat label="First in" value={sum.firstIn ? fmtTime(sum.firstIn) : '-'} />
          </View>

          <Pressable onPress={() => setDayEdit({ key: today })} style={styles.editDayBtn}>
            <Text style={styles.shiftText}>✏️ Edit day · manual add / subtract time</Text>
          </Pressable>

          <Text style={styles.section}>Today's log · tap to fix a time</Text>
          {events.length === 0 && (
            <Text style={styles.muted}>Nothing yet. Tap "Arrived" when you pass the turnstile.</Text>
          )}
          {events.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => setDayEdit({ key: today, selectedId: e.id })}
              style={styles.logRow}
            >
              <Text style={styles.logTime}>{fmtTime(e.ts)}</Text>
              <Text style={styles.logText}>{eventLabel(e)}</Text>
              <Text style={styles.muted}>edit</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <History
          settings={settings}
          days={allDays}
          onOpenDay={(key) => setDayEdit({ key })}
          onSettings={async (s) => {
            setSettings(s);
            await saveSettings(s);
          }}
        />
      )}

      {dayEdit && (
        <DayModal
          dayKeyStr={dayEdit.key}
          initialSelectedId={dayEdit.selectedId}
          events={dayEdit.key === today ? events : (allDays.find((d) => d.key === dayEdit.key)?.events ?? [])}
          targetMs={targetMs}
          onChange={(next) => saveDayAndReload(dayEdit.key, next)}
          onClose={() => setDayEdit(null)}
        />
      )}
    </View>
  );
}

function Big({ label, color, onPress, flex }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        { backgroundColor: color, opacity: pressed ? 0.7 : 1 },
        flex && { flex: 1 },
      ]}
    >
      <Text style={styles.bigText}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function eventLabel(e) {
  if (e.type === 'adjust') return `✍️ ${LABELS.adjust} ${fmtDelta(e.deltaMs)}`;
  return `${LABELS[e.type]}${e.type === 'break' && e.kind ? ` · ${KIND_LABELS[e.kind]}` : ''}`;
}

function fmtDayTitle(key) {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Edit a whole day: manual add/subtract time, fix or delete single entries, or delete the day.
 */
function DayModal({ dayKeyStr, events, initialSelectedId, targetMs, onChange, onClose }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? null);
  const [ts, setTs] = useState(0);
  const selected = events.find((e) => e.id === selectedId) ?? null;
  useEffect(() => {
    if (selected) setTs(selected.ts);
  }, [selectedId]);

  const sum = summarize(events);
  const delta = sum.workedMs - targetMs;

  const adjust = (min) =>
    onChange([...events, { id: newId(), type: 'adjust', ts: Date.now(), deltaMs: min * 60_000 }]);

  const deleteDay = () =>
    Alert.alert('Delete this day?', `All entries for ${fmtDayTitle(dayKeyStr)} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await onChange([]);
          onClose();
        },
      },
    ]);

  const shift = (min) => setTs((t) => Math.min(Date.now(), t + min * 60_000));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <Text style={styles.modalTitle}>{fmtDayTitle(dayKeyStr)}</Text>
          <Text style={styles.modalTime}>{fmtHM(sum.workedMs)}</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            {events.length ? fmtBalance(delta) + ' for this day' : 'No entries'}
            {sum.adjustMs ? ` · manual ${fmtDelta(sum.adjustMs)}` : ''}
          </Text>

          {selected ? (
            <>
              <Text style={styles.section}>{eventLabel(selected)}</Text>
              {selected.type !== 'adjust' && (
                <>
                  <Text style={[styles.modalTime, { fontSize: 36 }]}>{fmtTime(ts)}</Text>
                  {[
                    [-30, -5, -1],
                    [1, 5, 30],
                  ].map((row, i) => (
                    <View key={i} style={styles.row}>
                      {row.map((m) => (
                        <Pressable key={m} onPress={() => shift(m)} style={styles.shiftBtn}>
                          <Text style={styles.shiftText}>{m > 0 ? `+${m}` : m} min</Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </>
              )}
              <View style={[styles.row, { marginTop: 12 }]}>
                <Pressable
                  onPress={async () => {
                    await onChange(events.filter((x) => x.id !== selected.id));
                    setSelectedId(null);
                  }}
                  style={[styles.modalBtn, { backgroundColor: '#7f1d1d' }]}
                >
                  <Text style={styles.bigText}>Delete</Text>
                </Pressable>
                {selected.type !== 'adjust' && (
                  <Pressable
                    onPress={async () => {
                      await onChange(events.map((x) => (x.id === selected.id ? { ...x, ts } : x)));
                      setSelectedId(null);
                    }}
                    style={[styles.modalBtn, { backgroundColor: '#2563eb' }]}
                  >
                    <Text style={styles.bigText}>Save</Text>
                  </Pressable>
                )}
              </View>
              <Pressable onPress={() => setSelectedId(null)} style={{ padding: 8, alignItems: 'center' }}>
                <Text style={styles.muted}>← back to day</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.section}>Manual add / subtract</Text>
              {[
                [-60, -15, -10, -5],
                [5, 10, 15, 60],
              ].map((row, i) => (
                <View key={i} style={styles.row}>
                  {row.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => adjust(m)}
                      style={[styles.shiftBtn, { backgroundColor: m < 0 ? '#3b1d2a' : '#14332a' }]}
                    >
                      <Text style={styles.shiftText}>{fmtDelta(m * 60_000)}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}

              <Text style={styles.section}>Entries · tap to edit</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {events.length === 0 && <Text style={styles.muted}>No entries.</Text>}
                {events.map((e) => (
                  <Pressable key={e.id} onPress={() => setSelectedId(e.id)} style={styles.logRow}>
                    <Text style={styles.logTime}>{e.type === 'adjust' ? '' : fmtTime(e.ts)}</Text>
                    <Text style={styles.logText}>{eventLabel(e)}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={[styles.row, { marginTop: 12 }]}>
                {events.length > 0 && (
                  <Pressable onPress={deleteDay} style={[styles.modalBtn, { backgroundColor: '#7f1d1d' }]}>
                    <Text style={styles.bigText}>Delete day</Text>
                  </Pressable>
                )}
                <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: '#1e2a45' }]}>
                  <Text style={styles.bigText}>Done</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x.getTime();
}

function balanceColor(ms) {
  if (Math.abs(ms) < 60_000) return '#e2e8f0';
  return ms > 0 ? '#4ade80' : '#f87171';
}

function History({ settings, onSettings, onOpenDay, days }) {
  const targetMs = settings.targetMinutes * 60_000;
  const tracked = days.filter((d) => d.events.length > 0);
  const months = [...new Set(tracked.map((d) => d.key.slice(0, 7)))].sort().reverse();
  const weekStart = startOfWeek(new Date());
  const week = tracked.filter((d) => new Date(`${d.key}T00:00:00`).getTime() >= weekStart);
  const weekWorked = week.reduce((a, d) => a + summarize(d.events).workedMs, 0);
  const [open, setOpen] = useState(dayKey().slice(0, 7));
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.statsRow}>
        <Stat label="This week" value={fmtDur(weekWorked)} />
        <Stat label="Week balance" value={fmtBalance(weekWorked - week.length * targetMs)} />
      </View>

      <View style={[styles.row, styles.targetRow]}>
        <Text style={styles.logText}>Daily quota</Text>
        <Pressable
          style={styles.shiftBtn}
          onPress={() => onSettings({ ...settings, targetMinutes: Math.max(30, settings.targetMinutes - 5) })}
        >
          <Text style={styles.shiftText}>−5m</Text>
        </Pressable>
        <Text style={styles.statValue}>{fmtHM(targetMs)}</Text>
        <Pressable
          style={styles.shiftBtn}
          onPress={() =>
            onSettings({ ...settings, targetMinutes: Math.min(14 * 60, settings.targetMinutes + 5) })
          }
        >
          <Text style={styles.shiftText}>+5m</Text>
        </Pressable>
      </View>

      {months.length === 0 && <Text style={[styles.muted, { marginTop: 24 }]}>No days tracked yet.</Text>}
      {months.map((m) => {
        const mb = monthBalance(tracked, m, targetMs);
        const label = new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        });
        const isOpen = open === m;
        return (
          <View key={m}>
            <Pressable onPress={() => setOpen(isOpen ? null : m)} style={styles.monthHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthTitle}>{label}</Text>
                <Text style={styles.muted}>
                  {mb.days} days · {fmtDur(mb.workedMs)} worked · avg{' '}
                  {mb.days ? fmtHM(mb.workedMs / mb.days) : '-'}/day
                </Text>
              </View>
              <Text style={[styles.dayWorked, { color: balanceColor(mb.balanceMs) }]}>
                {fmtBalance(mb.balanceMs)}
              </Text>
            </Pressable>
            {isOpen &&
              tracked
                .filter((d) => d.key.startsWith(m))
                .map((d) => {
                  const sum = summarize(d.events);
                  const delta = sum.workedMs - targetMs;
                  return (
                    <Pressable key={d.key} onPress={() => onOpenDay(d.key)} style={styles.dayRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logText}>
                          {new Date(`${d.key}T00:00:00`).toLocaleDateString(undefined, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                          {'  '}
                          <Text style={styles.muted}>{fmtHM(sum.workedMs)}</Text>
                        </Text>
                        <Text style={styles.muted}>
                          breaks {fmtDur(sum.breakMs)} · smoke {fmtDur(sum.breakByKind.smoke)} · lunch{' '}
                          {fmtDur(sum.breakByKind.lunch)}
                        </Text>
                      </View>
                      <Text style={[styles.dayDelta, { color: balanceColor(delta) }]}>
                        {Math.abs(delta) < 60_000
                          ? '±0'
                          : `${delta > 0 ? '+' : '−'}${fmtHM(Math.abs(delta))}`}
                      </Text>
                    </Pressable>
                  );
                })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220', paddingTop: 48 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#111a2e',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#1e2a45' },
  tabText: { color: '#94a3b8', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  statusLabel: { color: '#94a3b8', fontSize: 16, textAlign: 'center', marginTop: 12 },
  bigTimer: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  bar: { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  barFill: { height: '100%', backgroundColor: '#3b82f6' },
  sub: { color: '#cbd5e1', textAlign: 'center', marginTop: 10, fontSize: 15 },
  breakTimer: {
    color: '#fbbf24',
    textAlign: 'center',
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  buttons: { marginTop: 24, gap: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  big: { paddingVertical: 22, borderRadius: 16, alignItems: 'center' },
  bigText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 24 },
  stat: { flex: 1, backgroundColor: '#111a2e', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 17, fontWeight: '700' },
  statLabel: { color: '#64748b', fontSize: 12, marginTop: 2 },
  section: { color: '#94a3b8', marginTop: 28, marginBottom: 8, fontWeight: '600' },
  muted: { color: '#64748b', fontSize: 13 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#1e293b',
    borderBottomWidth: 1,
    gap: 12,
  },
  logTime: { color: '#fff', fontWeight: '700', fontSize: 16, width: 56, fontVariant: ['tabular-nums'] },
  logText: { color: '#e2e8f0', fontSize: 16, flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#111a2e', borderRadius: 16, padding: 20, gap: 10 },
  modalTitle: { color: '#94a3b8', fontSize: 16, textAlign: 'center' },
  modalTime: { color: '#fff', fontSize: 48, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  shiftBtn: {
    flex: 1,
    backgroundColor: '#1e2a45',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  shiftText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  targetRow: { marginTop: 20, backgroundColor: '#111a2e', padding: 12, borderRadius: 12 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#1e293b',
    borderBottomWidth: 1,
  },
  editDayBtn: {
    marginTop: 20,
    backgroundColor: '#1e2a45',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  monthCard: {
    marginTop: 20,
    backgroundColor: '#111a2e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  monthValue: { fontSize: 22, fontWeight: '800' },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#111a2e',
    borderRadius: 12,
    padding: 14,
  },
  monthTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  dayDelta: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayWorked: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
