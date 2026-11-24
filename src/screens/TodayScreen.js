import { Pressable, ScrollView, Text, View } from 'react-native';
import { fmtBalance, fmtDur, fmtHM, fmtTime, KIND_LABELS, OFF_LABELS } from '../model';
import { eventLabel } from '../components/DayModal';
import { balanceColor, Big, COLORS, Stat, styles } from '../ui';

export function TodayScreen({ info, settings, now, onRecord, onEditDay }) {
  const { sum, events, off, expectedToday, past, monthNowMs, leave, leaveMonth } = info;
  const quota = expectedToday || settings.targetMinutes * 60_000;
  const progress = Math.min(1, sum.countedMs / quota);
  const done = expectedToday > 0 && sum.countedMs >= expectedToday;
  const turnstile = settings.countMode === 'turnstile';
  const showBoth = sum.insideMs !== sum.workedMs || turnstile;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {(off || !expectedToday) && (
        <View style={styles.banner}>
          <Text style={styles.shiftText}>
            {off ? `${OFF_LABELS[off]} today` : 'Not a workday'} · all time counts as overtime
          </Text>
        </View>
      )}

      <Text style={styles.statusLabel}>
        {sum.status === 'out'
          ? events.length
            ? 'Left the office'
            : 'Not in the office'
          : sum.status === 'break'
            ? `On break · ${KIND_LABELS[sum.currentBreakKind ?? 'other']}`
            : 'In the office'}
      </Text>
      <Text style={[styles.bigTimer, done && { color: COLORS.green }]}>{fmtDur(sum.countedMs, true)}</Text>
      {showBoth && (
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {turnstile
            ? `Turnstile time · without any breaks ${fmtHM(sum.workedMs)}`
            : `Without breaks · turnstile time ${fmtHM(sum.insideMs)}`}
        </Text>
      )}
      <View style={styles.bar}>
        <View
          style={[styles.barFill, { width: `${progress * 100}%` }, done && { backgroundColor: COLORS.green }]}
        />
      </View>
      <Text style={styles.sub}>
        {!expectedToday
          ? 'No quota today'
          : done
            ? `Daily quota of ${fmtHM(expectedToday)} reached 🎉`
            : leave
              ? `Daily quota: leave at ${fmtTime(leave)} · ${fmtDur(expectedToday - sum.countedMs)} to go`
              : `Daily quota ${fmtHM(expectedToday)}`}
      </Text>
      {sum.status !== 'out' && leaveMonth && (
        <Text style={[styles.sub, { marginTop: 4, color: balanceColor(past.balanceMs) }]}>
          {leaveMonth <= now + 60_000
            ? 'Monthly target: already covered by overtime'
            : `Monthly target: leave at ${fmtTime(leaveMonth)}`}
        </Text>
      )}

      <View style={styles.monthCard}>
        <Text style={styles.statLabel}>
          {new Date(now).toLocaleDateString(undefined, { month: 'long' })} balance
        </Text>
        <Text style={[styles.monthValue, { color: balanceColor(monthNowMs) }]}>{fmtBalance(monthNowMs)}</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {past.expectedDays} finished workdays
          {events.length && sum.status !== 'out' ? ' · today is added when you leave' : ''}
        </Text>
      </View>
      {sum.status === 'break' && sum.breakStartedAt && (
        <Text style={styles.breakTimer}>Break: {fmtDur(now - sum.breakStartedAt, true)}</Text>
      )}

      <View style={styles.buttons}>
        {sum.status === 'out' && <Big label="🏢 Arrived" color="#2563eb" onPress={() => onRecord('in')} />}
        {sum.status === 'in' && (
          <>
            <View style={styles.row}>
              <Big
                label={KIND_LABELS.smoke}
                color="#f59e0b"
                onPress={() => onRecord('break', 'smoke')}
                flex
              />
              <Big
                label={KIND_LABELS.lunch}
                color="#f97316"
                onPress={() => onRecord('break', 'lunch')}
                flex
              />
            </View>
            <Big label={KIND_LABELS.other} color="#a855f7" onPress={() => onRecord('break', 'other')} />
            <Big label="🏠 Leave" color="#475569" onPress={() => onRecord('out')} />
          </>
        )}
        {sum.status === 'break' && (
          <>
            <Big label="✅ Back" color="#16a34a" onPress={() => onRecord('back')} />
            <Big label="🏠 Leave" color="#475569" onPress={() => onRecord('out')} />
          </>
        )}
      </View>

      <View style={styles.statsRow}>
        <Stat label="Breaks" value={fmtDur(sum.breakMs)} />
        <Stat label="Smoke" value={fmtDur(sum.breakByKind.smoke)} />
        <Stat label="Lunch" value={fmtDur(sum.breakByKind.lunch)} />
        <Stat label="First in" value={sum.firstIn ? fmtTime(sum.firstIn) : '-'} />
      </View>

      <Pressable onPress={() => onEditDay()} style={styles.editDayBtn}>
        <Text style={styles.shiftText}>✏️ Edit day · day off · manual add / subtract</Text>
      </Pressable>

      <Text style={styles.section}>Today's log · tap to fix a time</Text>
      {events.length === 0 && (
        <Text style={styles.muted}>Nothing yet. Tap "Arrived" when you pass the turnstile.</Text>
      )}
      {events.map((e) => (
        <Pressable key={e.id} onPress={() => onEditDay(e.id)} style={styles.logRow}>
          <Text style={styles.logTime}>{e.type === 'adjust' ? '' : fmtTime(e.ts)}</Text>
          <Text style={styles.logText}>{eventLabel(e)}</Text>
          <Text style={styles.muted}>edit</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
