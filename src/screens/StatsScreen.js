import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { dayKey, fmtBalance, fmtDur, fmtHM, fmtMinutes, monthReport, parseKey, statsFor } from '../model';
import { balanceColor, COLORS, SmallBtn, Stat, styles } from '../ui';

function shiftMonth(m, n) {
  const d = parseKey(`${m}-01`);
  d.setMonth(d.getMonth() + n);
  return dayKey(d).slice(0, 7);
}

/** Simple bar chart: one bar per day, the line marks the quota. */
function DayBars({ rows, targetMs }) {
  const chrono = [...rows].filter((r) => r.type === 'worked' || r.type === 'missing').reverse();
  if (!chrono.length) return null;
  const max = Math.max(targetMs * 1.25, ...chrono.map((r) => r.counted));
  const H = 140;
  return (
    <View style={{ marginTop: 8, backgroundColor: COLORS.card, borderRadius: 12, padding: 12 }}>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: (targetMs / max) * H,
            borderTopWidth: 1,
            borderColor: COLORS.label,
            borderStyle: 'dashed',
          }}
        />
        {chrono.map((r) => (
          <View
            key={r.key}
            style={{
              flex: 1,
              height: Math.max(2, (r.counted / max) * H),
              borderRadius: 3,
              backgroundColor:
                r.type === 'missing' ? COLORS.red : r.delta >= -60_000 ? COLORS.green : COLORS.amber,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={styles.muted}>{parseKey(chrono[0].key).getDate()}.</Text>
        <Text style={styles.muted}>– – quota {fmtHM(targetMs)}</Text>
        <Text style={styles.muted}>{parseKey(chrono[chrono.length - 1].key).getDate()}.</Text>
      </View>
    </View>
  );
}

export function StatsScreen({ state }) {
  const { days, offDays, settings } = state;
  const [month, setMonth] = useState(dayKey().slice(0, 7));
  const rep = monthReport(days, offDays, month, settings);
  const st = statsFor(rep.rows);
  const targetMs = settings.targetMinutes * 60_000;
  const dash = (v, f) => (v == null ? '-' : f(v));
  const label = parseKey(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.row, { marginTop: 8 }]}>
        <SmallBtn label="‹" onPress={() => setMonth(shiftMonth(month, -1))} flex={false} />
        <Text style={[styles.monthTitle, { flex: 1, textAlign: 'center' }]}>{label}</Text>
        <SmallBtn label="›" onPress={() => setMonth(shiftMonth(month, 1))} flex={false} />
      </View>

      <View style={styles.monthCard}>
        <Text style={styles.statLabel}>Balance</Text>
        <Text style={[styles.monthValue, { color: balanceColor(rep.balanceMs) }]}>
          {fmtBalance(rep.balanceMs)}
        </Text>
        <Text style={styles.muted}>
          {st.onTarget}/{st.targetDays} workdays on target · streak {st.streak} 🔥
        </Text>
      </View>

      <DayBars rows={rep.rows} targetMs={targetMs} />

      <Text style={styles.section}>Average day</Text>
      <View style={[styles.statsRow, { marginTop: 0 }]}>
        <Stat label="Arrival" value={dash(st.avgArrival, fmtMinutes)} />
        <Stat label="Leave" value={dash(st.avgLeave, fmtMinutes)} />
        <Stat label="Counted" value={dash(st.avgCounted, fmtHM)} />
      </View>
      <View style={styles.statsRow}>
        <Stat label="Breaks" value={dash(st.avgBreak, fmtDur)} />
        <Stat label="Smoke" value={dash(st.avgSmoke, fmtDur)} />
        <Stat label="Smokes/day" value={dash(st.avgSmokeCount, (v) => v.toFixed(1))} />
        <Stat label="Lunch" value={dash(st.avgLunch, fmtDur)} />
      </View>

      <Text style={styles.section}>Month</Text>
      <View style={[styles.statsRow, { marginTop: 0 }]}>
        <Stat label="Days in" value={String(st.days)} />
        <Stat label="Days off" value={String(rep.offCount)} />
        <Stat label="Total" value={fmtDur(rep.countedMs)} />
      </View>
      {st.longest && (
        <Text style={[styles.muted, { marginTop: 12, textAlign: 'center' }]}>
          Longest day:{' '}
          {parseKey(st.longest.key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ·{' '}
          {fmtHM(st.longest.counted)}
        </Text>
      )}
    </ScrollView>
  );
}
