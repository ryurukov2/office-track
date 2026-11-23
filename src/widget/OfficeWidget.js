import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { fmtBalance, fmtDur, fmtTime, KIND_LABELS } from '../model';

/*
 * Home-screen widget. Widgets can't run timers, so it only shows values that stay correct
 * until the next tap (leave time, month balance), and is re-rendered after every action.
 */

export const WIDGET_NAME = 'Office';

const C = {
  bg: '#0b1220',
  card: '#111a2e',
  text: '#ffffff',
  muted: '#94a3b8',
  green: '#4ade80',
  red: '#f87171',
};

/** Turns todayInfo() (src/actions.js) into plain values for the widget. */
export function widgetData(info) {
  const { sum, leave, monthNowMs, off } = info;
  let title = 'Not in the office';
  if (sum.status === 'in') title = 'In the office';
  if (sum.status === 'break') title = `On break · ${KIND_LABELS[sum.currentBreakKind ?? 'other']}`;
  if (sum.status === 'out' && info.events.length) title = `Left · ${fmtDur(sum.countedMs)} today`;

  let line = off ? 'Day off' : 'Tap Arrived when you get in';
  if (sum.status === 'in') line = leave ? `Leave at ${fmtTime(leave)}` : `${fmtDur(sum.countedMs)} so far`;
  if (sum.status === 'break') line = `Since ${fmtTime(sum.breakStartedAt)}`;

  return {
    status: sum.status,
    title,
    line,
    month: `Month: ${fmtBalance(monthNowMs)}`,
    monthColor: Math.abs(monthNowMs) < 60_000 ? C.muted : monthNowMs > 0 ? C.green : C.red,
  };
}

function Button({ label, action, color }) {
  return (
    <FlexWidget
      clickAction={action}
      style={{
        flex: 1,
        height: 'match_parent',
        backgroundColor: color,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 3,
      }}
    >
      <TextWidget text={label} style={{ color: C.text, fontSize: 14, fontWeight: '700' }} />
    </FlexWidget>
  );
}

export function OfficeWidget({ data }) {
  const d = data ?? {
    status: 'out',
    title: 'Office Tracker',
    line: 'Open the app once',
    month: '',
    monthColor: C.muted,
  };
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 20,
        padding: 12,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ width: 'match_parent', flexDirection: 'column', marginBottom: 8 }}
      >
        <TextWidget text={d.title} style={{ color: C.text, fontSize: 16, fontWeight: '700' }} />
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
          <TextWidget text={d.line} style={{ color: C.muted, fontSize: 13 }} />
          <TextWidget text={d.month} style={{ color: d.monthColor, fontSize: 13, fontWeight: '600' }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'row' }}>
        {d.status === 'out' && <Button label="🏢 Arrived" action="ARRIVE" color="#2563eb" />}
        {d.status === 'in' && <Button label="🚬 Smoke" action="SMOKE" color="#f59e0b" />}
        {d.status === 'in' && <Button label="🍽️ Lunch" action="LUNCH" color="#f97316" />}
        {d.status === 'break' && <Button label="✅ Back" action="BACK" color="#16a34a" />}
        {d.status !== 'out' && <Button label="🏠 Leave" action="LEAVE" color="#475569" />}
      </FlexWidget>
    </FlexWidget>
  );
}
