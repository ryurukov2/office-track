import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  summarize, statusOf, allowed, leaveAt, monthReport, rangeReport, statsFor,
  fmtDur, fmtHM, fmtBalance, weekRange, monthRange, trackingStart,
} from '../src/model.js';

const MIN = 60_000;
const at = (key, hm) => new Date(`${key}T${hm}:00`).getTime();
let n = 0;
const ev = (key, hm, type, extra = {}) => ({ id: String(n++), type, ts: at(key, hm), ...extra });
const settings = { targetMinutes: 460, workdays: [1, 2, 3, 4, 5], countMode: 'worked', insideKinds: { lunch: true } };

// A full 7:40 day: 8:00-16:40 with a 1h lunch.
const fullDay = (key) => [
  ev(key, '08:00', 'in'),
  ev(key, '12:00', 'break', { kind: 'lunch' }),
  ev(key, '13:00', 'back'),
  ev(key, '16:40', 'out'),
];

test('normal day', () => {
  const s = summarize(fullDay('2026-11-02'), at('2026-11-02', '20:00'));
  assert.equal(s.status, 'out');
  assert.equal(s.workedMs, 460 * MIN);
  assert.equal(s.breakMs, 60 * MIN);
  assert.equal(s.breakByKind.lunch, 60 * MIN);
  assert.equal(s.firstIn, at('2026-11-02', '08:00'));
  assert.equal(s.lastOut, at('2026-11-02', '16:40'));
});

test('multiple breaks per kind, unsorted input, adjustment', () => {
  const k = '2026-11-03';
  const events = [
    ev(k, '17:00', 'out'),
    ev(k, '09:00', 'in'),
    ev(k, '10:00', 'break', { kind: 'smoke' }),
    ev(k, '10:10', 'back'),
    ev(k, '12:00', 'break', { kind: 'lunch' }),
    ev(k, '12:30', 'back'),
    ev(k, '15:00', 'break', { kind: 'smoke' }),
    ev(k, '15:05', 'back'),
    ev(k, '15:30', 'break'),
    ev(k, '15:45', 'back'),
    { id: 'a', type: 'adjust', ts: at(k, '18:00'), deltaMs: -10 * MIN },
  ];
  const s = summarize(events, at(k, '18:00'));
  assert.equal(s.breakByKind.smoke, 15 * MIN);
  assert.equal(s.breakCountByKind.smoke, 2);
  assert.equal(s.breakByKind.lunch, 30 * MIN);
  assert.equal(s.breakByKind.other, 15 * MIN);
  assert.equal(s.breakMs, 60 * MIN);
  assert.equal(s.adjustMs, -10 * MIN);
  assert.equal(s.workedMs, (480 - 60 - 10) * MIN);
  assert.equal(statusOf(events), 'in'); // statusOf uses given order (last real event is 'back')
});

test('open break at now and can-leave time', () => {
  const k = '2026-11-04';
  const events = [ev(k, '08:00', 'in'), ev(k, '12:00', 'break', { kind: 'lunch' })];
  const now = at(k, '12:20');
  const s = summarize(events, now, settings);
  assert.equal(s.status, 'break');
  assert.equal(s.breakStartedAt, at(k, '12:00'));
  assert.equal(s.currentBreakKind, 'lunch');
  assert.equal(s.breakByKind.lunch, 20 * MIN);
  assert.equal(s.workedMs, 240 * MIN);
  assert.equal(leaveAt(s, 460 * MIN, now), now + 220 * MIN);
  assert.deepEqual(allowed(s.status), ['back', 'out']);
});

test('edge cases: empty, break without in, now before last event, over target', () => {
  assert.equal(statusOf([]), 'out');
  assert.equal(summarize([], 0).workedMs, 0);
  assert.equal(leaveAt(summarize([], 0), 460 * MIN, 0), null);
  const k = '2026-11-05';
  const s = summarize([ev(k, '09:00', 'break', { kind: 'smoke' }), ev(k, '09:10', 'back')], at(k, '09:00'));
  assert.equal(s.firstIn, at(k, '09:00'));
  assert.equal(s.breakMs, 10 * MIN);
  assert.equal(s.workedMs, 0); // now earlier than last event: no negative time
  const long = summarize([ev(k, '07:00', 'in')], at(k, '16:00'));
  assert.equal(leaveAt(long, 460 * MIN, at(k, '16:00')), at(k, '16:00'));
  // negative adjust can't make worked time negative
  assert.equal(summarize([ev(k, '09:00', 'in'), { id: 'x', type: 'adjust', ts: 0, deltaMs: -99 * 60 * MIN }], at(k, '10:00')).workedMs, 0);
});

test('turnstile mode counts inside breaks', () => {
  const k = '2026-11-06';
  const events = [
    ev(k, '08:00', 'in'),
    ev(k, '10:00', 'break', { kind: 'smoke' }),
    ev(k, '10:15', 'back'),
    ev(k, '12:00', 'break', { kind: 'lunch' }),
    ev(k, '12:45', 'back'),
    ev(k, '16:00', 'out'),
  ];
  const worked = summarize(events, at(k, '17:00'), settings);
  assert.equal(worked.countedMs, worked.workedMs);
  assert.equal(worked.workedMs, 420 * MIN);
  const turn = summarize(events, at(k, '17:00'), { ...settings, countMode: 'turnstile' });
  assert.equal(turn.insideMs, 465 * MIN);
  assert.equal(turn.countedMs, 465 * MIN);
  const live = summarize(events.slice(0, 4), at(k, '12:30'), { ...settings, countMode: 'turnstile' });
  assert.equal(leaveAt(live, 460 * MIN, at(k, '12:30')), at(k, '12:30') + (460 - 255) * MIN);
});

test('month balance with day off, weekend overtime, missing and open days', () => {
  // Nov 2026: 1st is a Sunday. Tracking starts Mon 2nd.
  const days = [
    { key: '2026-11-02', events: fullDay('2026-11-02') }, // on target
    { key: '2026-11-03', events: [ev('2026-11-03', '08:00', 'in'), ev('2026-11-03', '15:00', 'out')] }, // -40m
    // 4th: vacation
    // 5th: missing (no entries) -> -7:40
    { key: '2026-11-06', events: [ev('2026-11-06', '08:00', 'in')] }, // past day without check-out: open
    { key: '2026-11-07', events: [ev('2026-11-07', '10:00', 'in'), ev('2026-11-07', '12:00', 'out')] }, // Saturday +2h
    { key: '2026-11-09', events: [ev('2026-11-09', '08:00', 'in')] }, // today, in progress
  ];
  const off = { '2026-11-04': 'vacation', '2026-11-20': 'holiday' };
  const r = monthReport(days, off, '2026-11', settings, { todayKey: '2026-11-09', now: at('2026-11-09', '10:00') });
  assert.equal(r.balanceMs, (-40 - 460 + 120) * MIN);
  assert.equal(r.workedDays, 3);
  assert.equal(r.expectedDays, 3);
  assert.equal(r.offCount, 1);
  const types = Object.fromEntries(r.rows.map((x) => [x.key, x.type]));
  assert.deepEqual(types, {
    '2026-11-20': 'planned', '2026-11-09': 'open', '2026-11-07': 'worked', '2026-11-06': 'open',
    '2026-11-05': 'missing', '2026-11-04': 'off', '2026-11-03': 'worked', '2026-11-02': 'worked',
  });
  assert.equal(r.rows[0].key, '2026-11-20'); // newest first
  const ex = monthReport(days, off, '2026-11', settings, { todayKey: '2026-11-09', now: 0, excludeToday: true });
  assert.ok(!ex.rows.some((x) => x.key === '2026-11-09'));
  // custom workdays: Saturday becomes a workday
  const six = rangeReport(days, off, '2026-11-07', '2026-11-07', { ...settings, workdays: [1, 2, 3, 4, 5, 6] }, { todayKey: '2026-11-09' });
  assert.equal(six.balanceMs, (120 - 460) * MIN);
  assert.equal(rangeReport([], {}, '2026-11-01', '2026-11-30', settings).rows.length, 0);
});

test('stats', () => {
  const days = [
    { key: '2026-11-02', events: fullDay('2026-11-02') },
    { key: '2026-11-03', events: [ev('2026-11-03', '09:00', 'in'), ev('2026-11-03', '10:00', 'break', { kind: 'smoke' }), ev('2026-11-03', '10:10', 'back'), ev('2026-11-03', '17:50', 'out')] },
    { key: '2026-11-04', events: [ev('2026-11-04', '08:00', 'in')] },
  ];
  const r = monthReport(days, {}, '2026-11', settings, { todayKey: '2026-11-04', now: at('2026-11-04', '09:00') });
  const s = statsFor(r.rows, '2026-11-04');
  assert.equal(s.days, 2);
  assert.equal(s.avgArrival, 8.5 * 60);
  assert.equal(s.avgLeave, (16 * 60 + 40 + 17 * 60 + 50) / 2);
  assert.equal(s.avgSmokeCount, 0.5);
  assert.equal(s.onTarget, 2);
  assert.equal(s.targetDays, 2);
  assert.equal(s.streak, 2);
  assert.equal(s.longest.key, '2026-11-03');
});

test('formatting and calendar helpers', () => {
  assert.equal(fmtDur(65 * MIN), '1h 05m');
  assert.equal(fmtDur(5 * MIN + 7000, true), '0:05:07');
  assert.equal(fmtHM(460 * MIN), '7:40');
  assert.equal(fmtBalance(30_000), 'on target');
  assert.equal(fmtBalance(-30 * MIN), '30m below quota');
  assert.deepEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(weekRange('2026-11-26'), { from: '2026-11-23', to: '2026-11-29' });
  assert.equal(trackingStart([{ key: '2026-11-05', events: [] }], { '2026-11-03': 'sick' }), '2026-11-03');
});
