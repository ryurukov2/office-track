/**
 * Data model
 * ----------
 * A day is a list of events, stored under the key "day:YYYY-MM-DD":
 *   { id: string, type: 'in' | 'break' | 'back' | 'out', ts: number (ms), kind?: 'smoke' | 'lunch' | 'other' }
 * plus manual corrections, which don't change the status:
 *   { id: string, type: 'adjust', ts: number, deltaMs: number }   e.g. -10 min for a forgotten smoke break
 *
 * Days off are stored separately: { "YYYY-MM-DD": 'vacation' | 'sick' | 'holiday' | 'other' }.
 *
 * Status is derived from the last event: 'out' | 'in' | 'break'.
 * Everything else (worked time, breaks, balances) is calculated from the events.
 *
 * Two ways of counting a day (settings.countMode):
 *   'worked'    – time in the office minus all breaks
 *   'turnstile' – time inside the building: breaks spent inside (settings.insideKinds) still count,
 *                 matching a turnstile report that only sees you leave the building.
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
  const real = events.filter((e) => e.type !== 'adjust');
  const last = real[real.length - 1];
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
 * `settings` (optional) decides which time counts towards the quota (countedMs).
 */
export function summarize(events, now = Date.now(), settings) {
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
  let adjustMs = 0;
  for (const e of sorted) {
    if (e.type === 'adjust') {
      adjustMs += e.deltaMs ?? 0;
      continue;
    }
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
  s.adjustMs = adjustMs;
  s.workedMs = Math.max(0, s.workedMs + adjustMs);
  if (s.status === 'break') {
    s.breakStartedAt = since;
    s.currentBreakKind = kind;
  }
  const inside = settings?.insideKinds ?? {};
  s.insideMs =
    s.workedMs + Object.keys(s.breakByKind).reduce((a, k) => a + (inside[k] ? s.breakByKind[k] : 0), 0);
  s.countedMs = settings?.countMode === 'turnstile' ? s.insideMs : s.workedMs;
  return s;
}

/** Wall-clock time at which counted time reaches target, assuming no more breaks. */
export function leaveAt(sum, targetMs, now = Date.now()) {
  if (sum.status === 'out') return null;
  const remaining = targetMs - (sum.countedMs ?? sum.workedMs);
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
  adjust: 'Manual adjustment',
};

/** "+10m" / "−1h 05m" for manual adjustments. */
export function fmtDelta(ms) {
  return `${ms < 0 ? '−' : '+'}${fmtDur(Math.abs(ms))}`;
}

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

export const OFF_LABELS = {
  vacation: '🏖️ Vacation',
  sick: '🤒 Sick',
  holiday: '🎉 Holiday',
  other: '📅 Day off',
};

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---- calendar helpers (keys are "YYYY-MM-DD", local time) ----

export const parseKey = (key) => new Date(`${key}T00:00:00`);

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export const isWorkday = (key, settings) =>
  (settings?.workdays ?? [1, 2, 3, 4, 5]).includes(parseKey(key).getDay());

export function monthRange(monthPrefix) {
  const [y, m] = monthPrefix.split('-').map(Number);
  return { from: `${monthPrefix}-01`, to: dayKey(new Date(y, m, 0)) };
}

export function weekRange(key) {
  const dow = (parseKey(key).getDay() + 6) % 7; // Monday = 0
  const from = addDays(key, -dow);
  return { from, to: addDays(from, 6) };
}

/** The first day the app was used (earliest day with entries or a day off). Days before don't count. */
export function trackingStart(days, offDays) {
  const keys = [...days.filter((d) => d.events.length).map((d) => d.key), ...Object.keys(offDays ?? {})];
  return keys.length ? keys.sort()[0] : null;
}

/**
 * Balance over a date range (inclusive).
 * Every workday (settings.workdays, Mon–Fri by default) is expected to have the full quota,
 * except days off. Weekend work counts as overtime. A day only counts once it's finished
 * (you checked out); today in the office or a past day without check-out is 'open' and not counted.
 * Days before you started using the app are ignored. Future days off are listed but don't count.
 *
 * Returns { balanceMs, countedMs, workedDays, expectedDays, offCount, rows } with rows newest first:
 *   { key, type: 'worked' | 'open' | 'off' | 'missing' | 'planned', counted, expected, delta, sum?, off? }
 */
export function rangeReport(days, offDays, fromKey, toKey, settings, opts = {}) {
  const todayKey = opts.todayKey ?? dayKey();
  const now = opts.now ?? Date.now();
  const targetMs = settings.targetMinutes * 60_000;
  const byKey = Object.fromEntries(days.map((d) => [d.key, d.events]));
  const start = trackingStart(days, offDays);
  const res = { balanceMs: 0, countedMs: 0, workedDays: 0, expectedDays: 0, offCount: 0, rows: [] };
  if (!start) return res;

  for (let key = fromKey; key <= toKey; key = addDays(key, 1)) {
    const off = offDays?.[key];
    if (key > todayKey) {
      if (off) res.rows.push({ key, type: 'planned', off, counted: 0, expected: 0, delta: 0 });
      continue;
    }
    if (key < start) continue;
    if (opts.excludeToday && key === todayKey) continue;

    const events = byKey[key] ?? [];
    const has = events.length > 0;
    const workday = isWorkday(key, settings) && !off;
    const expectedIfDone = workday && (has || key !== todayKey) ? targetMs : 0;
    if (!has && !off && !expectedIfDone) continue;

    // Past days are measured up to their last entry, today up to now.
    const lastTs = has ? Math.max(...events.map((e) => e.ts)) : 0;
    const sum = has ? summarize(events, key === todayKey ? now : lastTs, settings) : null;
    // A day only counts towards the balance once it's finished (checked out).
    // Today while in the office, or a past day without check-out, is "open": shown but not counted.
    const open = has && sum.status !== 'out';
    const counted = sum && !open ? sum.countedMs : 0;
    const expected = open ? 0 : expectedIfDone;
    const delta = counted - expected;
    res.balanceMs += delta;
    res.countedMs += counted;
    if (has && !open) res.workedDays++;
    if (expected) res.expectedDays++;
    if (off) res.offCount++;
    res.rows.push({
      key,
      type: open ? 'open' : has ? 'worked' : off ? 'off' : 'missing',
      off,
      counted,
      expected,
      delta,
      sum,
    });
  }
  res.rows.sort((a, b) => (a.key < b.key ? 1 : -1));
  return res;
}

export function monthReport(days, offDays, monthPrefix, settings, opts) {
  const { from, to } = monthRange(monthPrefix);
  return rangeReport(days, offDays, from, to, settings, opts);
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
