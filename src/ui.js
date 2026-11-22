import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tap, tick } from './haptics';

/* Shared UI pieces and styles. */

export const COLORS = {
  bg: '#0b1220',
  card: '#111a2e',
  cardHi: '#1e2a45',
  line: '#1e293b',
  text: '#fff',
  soft: '#e2e8f0',
  muted: '#64748b',
  label: '#94a3b8',
  blue: '#3b82f6',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
};

export function balanceColor(ms) {
  if (Math.abs(ms) < 60_000) return COLORS.soft;
  return ms > 0 ? COLORS.green : COLORS.red;
}

/** Big action button with haptic feedback. */
export function Big({ label, color, onPress, flex }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
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

export function Stat({ label, value, color }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Small button used for time shifts, adjustments and steppers. */
export function SmallBtn({ label, onPress, color, active, flex = true }) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      style={[
        styles.shiftBtn,
        !flex && { flex: 0, flexShrink: 0, paddingHorizontal: 14, minWidth: 48 },
        color && { backgroundColor: color },
        active && styles.activeBtn,
      ]}
    >
      <Text style={styles.shiftText}>{label}</Text>
    </Pressable>
  );
}

/** Label + value with − / + buttons. */
export function Stepper({ label, value, onMinus, onPlus }) {
  return (
    <View style={[styles.row, styles.settingRow]}>
      <Text style={styles.logText}>{label}</Text>
      <SmallBtn label="−" onPress={onMinus} flex={false} />
      <Text style={[styles.statValue, { minWidth: 56, textAlign: 'center' }]}>{value}</Text>
      <SmallBtn label="+" onPress={onPlus} flex={false} />
    </View>
  );
}

/** On/off row. */
export function Toggle({ label, hint, value, onChange }) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onChange(!value);
      }}
      style={[styles.row, styles.settingRow]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.logText}>{label}</Text>
        {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      </View>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
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
  activeBtn: { backgroundColor: '#2563eb' },
  settingRow: { marginTop: 8, backgroundColor: '#111a2e', padding: 12, borderRadius: 12 },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: '#334155', padding: 3 },
  switchOn: { backgroundColor: '#2563eb' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#cbd5e1' },
  knobOn: { backgroundColor: '#fff', transform: [{ translateX: 18 }] },
  banner: { marginTop: 12, backgroundColor: '#1e2a45', borderRadius: 12, padding: 12, alignItems: 'center' },
});
