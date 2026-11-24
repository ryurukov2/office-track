import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import {
  addDays,
  dayKey,
  fmtBalance,
  fmtDur,
  fmtHM,
  monthReport,
  OFF_LABELS,
  parseKey,
  rangeReport,
  weekRange,
} from '../model';
import { exportCsv } from '../export';
import { balanceColor, COLORS, SmallBtn, Stat, styles } from '../ui';

const monthLabel = (m) =>
  parseKey(`${m}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const dayLabel = (key) =>
  parseKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function DayRow({ row, onPress }) {
  const { key, type, sum, off, delta } = row;
  let main = fmtHM(row.counted);
  let detail = '';
  if (type === 'worked') {
    detail = `breaks ${fmtDur(sum.breakMs)} · smoke ${fmtDur(sum.breakByKind.smoke)} · lunch ${fmtDur(sum.breakByKind.lunch)}`;
    if (off) detail = `${OFF_LABELS[off]} · ${detail}`;
  } else if (type === 'open') {
    detail =
      key === dayKey() ? 'In progress · counts once you leave' : '⚠️ No check-out · not counted, tap to fix';
  } else if (type === 'off' || type === 'planned') {
    main = '';
    detail = OFF_LABELS[off] + (type === 'planned' ? ' (planned)' : '');
  } else {
    main = '';
    detail = 'No entries · tap to mark as day off';
  }
  return (
    <Pressable onPress={onPress} style={styles.dayRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.logText}>
          {dayLabel(key)}
          {'  '}
          <Text style={styles.muted}>{main}</Text>
        </Text>
        <Text
          style={[
            styles.muted,
            (type === 'missing' || (type === 'open' && key !== dayKey())) && { color: COLORS.red },
          ]}
        >
          {detail}
        </Text>
      </View>
      <Text style={[styles.dayDelta, { color: balanceColor(delta) }]}>
        {type === 'off' || type === 'planned' || type === 'open'
          ? ''
          : Math.abs(delta) < 60_000
            ? '±0'
            : `${delta > 0 ? '+' : '−'}${fmtHM(Math.abs(delta))}`}
      </Text>
    </Pressable>
  );
}

/** Pick any date (e.g. next week's vacation) and open it in the day editor. */
function PlanDayOff({ onOpenDay }) {
  const [key, setKey] = useState(addDays(dayKey(), 1));
  return (
    <View style={[styles.row, styles.settingRow]}>
      <SmallBtn label="‹" onPress={() => setKey(addDays(key, -1))} flex={false} />
      <Text style={[styles.logText, { textAlign: 'center' }]}>{dayLabel(key)}</Text>
      <SmallBtn label="›" onPress={() => setKey(addDays(key, 1))} flex={false} />
      <SmallBtn label="Open" onPress={() => onOpenDay(key)} flex={false} color="#2563eb" />
    </View>
  );
}

export function HistoryScreen({ state, onOpenDay }) {
  const { days, offDays, settings } = state;
  const today = dayKey();
  const week = weekRange(today);
  const weekRep = rangeReport(days, offDays, week.from, week.to, settings);
  const months = [
    ...new Set(
      [...days.filter((d) => d.events.length).map((d) => d.key), ...Object.keys(offDays), today].map((k) =>
        k.slice(0, 7),
      ),
    ),
  ]
    .sort()
    .reverse();
  const [open, setOpen] = useState(today.slice(0, 7));

  const doExport = async (m) => {
    try {
      await exportCsv(state, m);
    } catch (e) {
      Alert.alert('Export failed', String(e?.message ?? e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.statsRow}>
        <Stat label="This week" value={fmtDur(weekRep.countedMs)} />
        <Stat
          label="Week balance"
          value={fmtBalance(weekRep.balanceMs)}
          color={balanceColor(weekRep.balanceMs)}
        />
      </View>

      <Text style={styles.section}>Plan a day off</Text>
      <PlanDayOff onOpenDay={onOpenDay} />

      {months.map((m) => {
        const rep = monthReport(days, offDays, m, settings);
        const isOpen = open === m;
        return (
          <View key={m}>
            <Pressable onPress={() => setOpen(isOpen ? null : m)} style={styles.monthHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthTitle}>{monthLabel(m)}</Text>
                <Text style={styles.muted}>
                  {rep.workedDays} days in · {rep.expectedDays} workdays · {rep.offCount} off ·{' '}
                  {fmtDur(rep.countedMs)}
                </Text>
              </View>
              <Text style={[styles.dayWorked, { color: balanceColor(rep.balanceMs) }]}>
                {fmtBalance(rep.balanceMs)}
              </Text>
            </Pressable>
            {isOpen && (
              <>
                {rep.rows.length === 0 && (
                  <Text style={[styles.muted, { padding: 12 }]}>Nothing tracked.</Text>
                )}
                {rep.rows.map((row) => (
                  <DayRow key={row.key} row={row} onPress={() => onOpenDay(row.key)} />
                ))}
                <View style={[styles.row, { marginTop: 12 }]}>
                  <SmallBtn label="📤 Export month (CSV)" onPress={() => doExport(m)} />
                </View>
              </>
            )}
          </View>
        );
      })}

      <View style={[styles.row, { marginTop: 24 }]}>
        <SmallBtn label="📤 Export everything (CSV)" onPress={() => doExport(null)} />
      </View>
    </ScrollView>
  );
}
