import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { fmtHM, fmtTime, monthRange, OFF_LABELS, parseKey, rangeReport, WEEKDAY_SHORT } from './model';

/*
 * CSV export of tracked days, shared via the Android share sheet (email, Drive, Telegram, ...).
 * One row per day: worked days, days off and missed workdays.
 */

const HEADER = [
  'date',
  'weekday',
  'type',
  'arrived',
  'left',
  'time_minus_breaks',
  'time_inside',
  'counted',
  'quota',
  'difference',
  'breaks',
  'smoke',
  'lunch',
  'other_breaks',
  'manual_adjustments',
  'day_off',
];

const hm = (ms) => (ms < 0 ? '-' : '') + fmtHM(Math.abs(ms));

export function buildCsv(report) {
  const rows = [...report.rows].filter((r) => r.type !== 'planned').reverse(); // oldest first
  const lines = rows.map((r) => {
    const s = r.sum;
    return [
      r.key,
      WEEKDAY_SHORT[parseKey(r.key).getDay()],
      r.type,
      s?.firstIn ? fmtTime(s.firstIn) : '',
      s?.lastOut ? fmtTime(s.lastOut) : '',
      s ? hm(s.workedMs) : '0:00',
      s ? hm(s.insideMs) : '0:00',
      hm(r.counted),
      hm(r.expected),
      hm(r.delta),
      s ? hm(s.breakMs) : '0:00',
      s ? hm(s.breakByKind.smoke) : '0:00',
      s ? hm(s.breakByKind.lunch) : '0:00',
      s ? hm(s.breakByKind.other) : '0:00',
      s?.adjustMs ? hm(s.adjustMs) : '',
      r.off ? OFF_LABELS[r.off].replace(/^\S+\s/, '') : '',
    ].join(',');
  });
  lines.push('');
  lines.push(`total,,,,,,,${hm(report.countedMs)},,${hm(report.balanceMs)}`);
  return [HEADER.join(','), ...lines].join('\n');
}

/** monthPrefix "2026-11", or null for everything. */
export async function exportCsv({ days, offDays, settings }, monthPrefix) {
  let from;
  let to;
  if (monthPrefix) ({ from, to } = monthRange(monthPrefix));
  else {
    const keys = [...days.map((d) => d.key), ...Object.keys(offDays)].sort();
    if (!keys.length) throw new Error('Nothing to export yet');
    from = keys[0];
    to = keys[keys.length - 1];
  }
  const csv = buildCsv(rangeReport(days, offDays, from, to, settings));
  const file = new File(Paths.cache, `office-time-${monthPrefix ?? 'all'}.csv`);
  if (file.exists) file.delete();
  file.create();
  await file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export office time' });
}
