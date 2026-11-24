import { ScrollView, Text, View } from 'react-native';
import { fmtHM, KIND_LABELS, WEEKDAY_SHORT } from '../model';
import { SmallBtn, Stepper, styles, Toggle } from '../ui';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hm = (min) => fmtHM(min * 60_000);

export function SettingsScreen({ settings, onChange }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  const setRem = (patch) => set({ reminders: { ...settings.reminders, ...patch } });
  const rem = settings.reminders;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.section}>Quota</Text>
      <Stepper
        label="Daily quota"
        value={hm(settings.targetMinutes)}
        onMinus={() => set({ targetMinutes: clamp(settings.targetMinutes - 5, 30, 14 * 60) })}
        onPlus={() => set({ targetMinutes: clamp(settings.targetMinutes + 5, 30, 14 * 60) })}
      />
      <Text style={[styles.muted, { marginTop: 12 }]}>Workdays (expected to have the full quota)</Text>
      <View style={[styles.row, { marginTop: 8, gap: 4 }]}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = settings.workdays.includes(d);
          return (
            <SmallBtn
              key={d}
              label={WEEKDAY_SHORT[d].slice(0, 2)}
              active={on}
              onPress={() =>
                set({ workdays: on ? settings.workdays.filter((x) => x !== d) : [...settings.workdays, d] })
              }
            />
          );
        })}
      </View>

      <Text style={styles.section}>How time is counted</Text>
      <Toggle
        label="Turnstile mode"
        hint={
          settings.countMode === 'turnstile'
            ? 'Counts time inside the building: breaks marked "inside" below still count'
            : 'Off: counts office time minus every break'
        }
        value={settings.countMode === 'turnstile'}
        onChange={(v) => set({ countMode: v ? 'turnstile' : 'worked' })}
      />
      <Text style={[styles.muted, { marginTop: 12 }]}>
        Breaks spent inside the building (the turnstile doesn't see them)
      </Text>
      <View style={[styles.row, { marginTop: 8, gap: 6 }]}>
        {Object.entries(KIND_LABELS).map(([k, label]) => (
          <SmallBtn
            key={k}
            label={label}
            active={settings.insideKinds[k]}
            onPress={() => set({ insideKinds: { ...settings.insideKinds, [k]: !settings.insideKinds[k] } })}
          />
        ))}
      </View>

      <Text style={styles.section}>Reminders</Text>
      <Toggle
        label="Long break"
        hint="Asks if you're still on break after the limits below"
        value={rem.longBreak}
        onChange={(v) => setRem({ longBreak: v })}
      />
      {rem.longBreak &&
        Object.keys(KIND_LABELS).map((k) => (
          <Stepper
            key={k}
            label={`  ${KIND_LABELS[k]} limit`}
            value={`${rem.breakLimits[k]}m`}
            onMinus={() =>
              setRem({ breakLimits: { ...rem.breakLimits, [k]: clamp(rem.breakLimits[k] - 5, 5, 180) } })
            }
            onPlus={() =>
              setRem({ breakLimits: { ...rem.breakLimits, [k]: clamp(rem.breakLimits[k] + 5, 5, 180) } })
            }
          />
        ))}
      <Toggle
        label="Forgot to leave"
        hint="If you're still checked in late in the evening"
        value={rem.forgotLeave}
        onChange={(v) => setRem({ forgotLeave: v })}
      />
      {rem.forgotLeave && (
        <Stepper
          label="  At"
          value={hm(rem.forgotLeaveAt)}
          onMinus={() => setRem({ forgotLeaveAt: clamp(rem.forgotLeaveAt - 30, 12 * 60, 23 * 60 + 30) })}
          onPlus={() => setRem({ forgotLeaveAt: clamp(rem.forgotLeaveAt + 30, 12 * 60, 23 * 60 + 30) })}
        />
      )}
      <Toggle
        label="Not checked in"
        hint="On workdays (not days off) if you haven't tapped Arrived"
        value={rem.noArrival}
        onChange={(v) => setRem({ noArrival: v })}
      />
      {rem.noArrival && (
        <Stepper
          label="  At"
          value={hm(rem.noArrivalAt)}
          onMinus={() => setRem({ noArrivalAt: clamp(rem.noArrivalAt - 15, 6 * 60, 14 * 60) })}
          onPlus={() => setRem({ noArrivalAt: clamp(rem.noArrivalAt + 15, 6 * 60, 14 * 60) })}
        />
      )}
      <Toggle
        label="Daily quota reached"
        hint="Notifies you at your leave time"
        value={rem.quotaReached}
        onChange={(v) => setRem({ quotaReached: v })}
      />
      <Toggle
        label="Monthly target reached"
        hint="When leaving keeps the month's balance at zero"
        value={rem.monthTarget}
        onChange={(v) => setRem({ monthTarget: v })}
      />
      <Text style={[styles.muted, { marginTop: 16 }]}>
        Reminders are single scheduled alarms, so they don't use battery in the background.
      </Text>
    </ScrollView>
  );
}
