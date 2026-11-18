/**
 * Data model
 * ----------
 * A day is a list of events, stored under the key "day:YYYY-MM-DD":
 *   { id: string, type: 'in' | 'break' | 'back' | 'out', ts: number (ms), kind?: 'smoke' | 'lunch' | 'other' }
 *
 * Status is derived from the last event: 'out' | 'in' | 'break'.
 * Everything else (worked time, breaks, balances) is calculated from the events.
 */

export const dayKey = (d = new Date()) => {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
};

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Status after applying events in order. */
export function statusOf(events) {
  const last = events[events.length - 1];
  if (!last || last.type === 'out') return 'out';
  if (last.type === 'break') return 'break';
  return 'in';
}

/** Which actions make sense in a given status. */
export function allowed(status) {
  if (status === 'out') return ['in'];
  if (status === 'in') return ['break', 'out'];
  return ['back', 'out'];
}

/**
 * Walks events in time order. Time is "worked" while status is in,
 * and "break" while status is break. Ongoing segments count up to `now`.
 */
export function summarize(events, now = Date.now()) {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const s = {
    status: 'out',
    workedMs: 0,
    breakMs: 0,
    breakByKind: { smoke: 0, lunch: 0, other: 0 },
  };
  let since = 0;
  let kind = 'other';
  const close = (until) => {
    const d = Math.max(0, until - since);
    if (s.status === 'in') s.workedMs += d;
    if (s.status === 'break') {
      s.breakMs += d;
      s.breakByKind[kind] += d;
    }
  };
  for (const e of sorted) {
    close(e.ts);
    since = e.ts;
    if (e.type === 'in' || e.type === 'back') {
      s.status = 'in';
      if (s.firstIn === undefined) s.firstIn = e.ts;
    } else if (e.type === 'break') {
      // a break without being "in" first still means we're in the office
      if (s.firstIn === undefined) s.firstIn = e.ts;
      s.status = 'break';
      kind = e.kind ?? 'other';
    } else {
      s.status = 'out';
    }
  }
  close(Math.max(now, since));
  if (s.status === 'break') {
    s.breakStartedAt = since;
    s.currentBreakKind = kind;
  }
  return s;
}

/** Wall-clock time at which worked time reaches target, assuming no more breaks. */
export function leaveAt(sum, targetMs, now = Date.now()) {
  if (sum.status === 'out') return null;
  const remaining = targetMs - sum.workedMs;
  return now + Math.max(0, remaining);
}

export function fmtDur(ms, withSeconds = false) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (withSeconds) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const LABELS = {
  in: 'Arrived',
  break: 'Break',
  back: 'Back',
  out: 'Left',
};

export const KIND_LABELS = {
  smoke: '🚬 Smoke',
  lunch: '🍽️ Lunch',
  other: '☕ Other',
};

/** "7:40" style. */
export function fmtHM(ms) {
  const m = Math.round(ms / 60_000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** "+2h 00m overtime" / "30m below quota" / "on target". */
export function fmtBalance(ms) {
  if (Math.abs(ms) < 60_000) return 'on target';
  return ms > 0 ? `+${fmtDur(ms)} overtime` : `${fmtDur(-ms)} below quota`;
}

/**
 * Monthly balance = sum of (worked - target) over days in the month that have
 * any tracked events. Days you didn't come in (weekends, holidays) don't count.
 */
export function monthBalance(
  days,
  monthPrefix, // "2026-11"
  targetMs,
  excludeKey,
) {
  let balanceMs = 0;
  let workedMs = 0;
  let n = 0;
  for (const d of days) {
    if (!d.key.startsWith(monthPrefix) || d.key === excludeKey || d.events.length === 0) continue;
    const w = summarize(d.events).workedMs;
    workedMs += w;
    balanceMs += w - targetMs;
    n++;
  }
  return { balanceMs, workedMs, days: n };
}
