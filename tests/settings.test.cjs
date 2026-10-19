/* Run with: node tests/settings.test.cjs
 * These tests read only the public index.html. Storage, DOM, clock, and timers
 * are isolated in memory; no real board data, browser profile, or network is used.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const publicPage = path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(publicPage, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script, 'Public index.html must contain the application script');
const compiled = new vm.Script(script[1], { filename: 'public-index.html' });

// Use local wall-clock dates, matching the app, so tests also run outside China.
const at = (year, month, day, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();
const minutes = value => value * 60000;
const today = '2026-10-19';
const lunchtime = () => ({
  s: at(2026, 10, 19, 11, 40), e: at(2026, 10, 19, 13, 20),
});
const plain = value => JSON.parse(JSON.stringify(value));

class Element {
  constructor() {
    this.style = { setProperty() {} };
    this.dataset = {};
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, enabled) {
        const next = enabled === undefined ? !classes.has(name) : enabled;
        if (next) classes.add(name); else classes.delete(name);
        return next;
      },
    };
  }
  set innerHTML(value) { this.markup = value; this.children = []; }
  get innerHTML() { return this.markup || ''; }
  appendChild(child) { this.children.push(child); return child; }
  append(child) { return this.appendChild(child); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  dispatch(type, event) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
  getBoundingClientRect() {
    return { left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 };
  }
  focus() {}
  remove() {}
}

function createApp() {
  let clock = at(2026, 10, 19, 14, 35);
  let systemReducedMotion = false;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const storage = new Map();
  const sandbox = {
    Date: FixedDate,
    console,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    // Never run animation, autosave, celebration, or ticking callbacks.
    setTimeout() { return 1; }, clearTimeout() {},
    setInterval() { return 1; }, clearInterval() {},
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    document: {
      documentElement: new Element(), body: new Element(), hidden: false,
      getElementById: element, createElement: () => new Element(),
      querySelector: () => new Element(), querySelectorAll: () => [],
      addEventListener() {},
    },
    window: {
      addEventListener() {},
      matchMedia: () => ({ matches: systemReducedMotion }),
      location: { pathname: '/index.html' },
      // Deliberately omit folder-access and IndexedDB capabilities.
    },
    getComputedStyle: () => ({ paddingLeft: '0', paddingRight: '0' }),
    alert() {}, confirm: () => true,
  };
  vm.createContext(sandbox);
  compiled.runInContext(sandbox, { timeout: 3000 });
  sandbox.state = sandbox.defaultState();
  sandbox.tstate = { version: 1, days: {} };
  sandbox.viewDay = today;
  return {
    app: sandbox, element,
    now: () => clock,
    setClock: value => { clock = value; },
    advance: value => { clock += value; },
    setSystemReduced: value => { systemReducedMotion = value; },
  };
}

function item(id, options = {}) {
  return {
    id, text: id, at: at(2026, 10, 19, 9), segs: [], running: false,
    done: false, doneAt: null, zone: 'doing', ord: 0, from: today,
    ...options,
  };
}
function put(app, items, day = today) { app.tstate.days[day] = { items }; }
function settings(app, changes = {}) { return { ...plain(app.getSettings()), ...changes }; }
function activeCount(app) {
  return Object.values(app.tstate.days).flatMap(day => day.items).filter(it => it.running).length;
}

test('new boards preserve the established default business rules', () => {
  const { app } = createApp();
  assert.deepEqual(plain(app.getSettings()), {
    rest: { enabled: true, start: '12:00', end: '13:00' },
    workdays: [1, 2, 3, 4, 5], useHolidays: true, dateOverrides: [],
    autoCarry: true, parallel: true, enterAction: 'start', startView: 'today', motion: 'auto',
  });
  assert.equal(app.state.mondayStart, true);
});

test('legacy boards without settings acquire defaults without losing projects', () => {
  const { app } = createApp();
  const migrated = app.migrate({ version: 1, projects: [{ id: 'legacy', name: 'Legacy' }] });
  assert.equal(migrated.months['2026-10'].projects[0].id, 'legacy');
  assert.equal(migrated.settings.rest.start, '12:00');
  assert.equal(migrated.settings.autoCarry, true);
  assert.equal(migrated.settings.parallel, true);
});

test('invalid settings use safe defaults and invalid calendar dates are ignored', () => {
  const { app } = createApp();
  const normalized = app.normalizeSettings({
    rest: { start: '25:10', end: '00:30' }, workdays: [6, 6, -1, 0, '1', 8],
    dateOverrides: [{ date: '2026-02-30', work: true }, { date: 'invalid', work: false }],
    enterAction: 'invalid', startView: 'invalid', motion: 'invalid',
  });
  assert.deepEqual(plain(normalized.rest), { enabled: true, start: '12:00', end: '13:00' });
  assert.deepEqual(plain(normalized.workdays), [0, 6]);
  assert.deepEqual(plain(normalized.dateOverrides), []);
  assert.equal(normalized.enterAction, 'start');
  assert.equal(normalized.startView, 'today');
  assert.equal(normalized.motion, 'auto');
  assert.equal(app.normalizeSettings(null).parallel, true);
  assert.equal(app.normalizeSettings({ rest: { start: '13:00', end: '12:00' } }).rest.start, '12:00');
});

test('legacy timing remains 40 minutes even after changing the current rest rule', () => {
  const { app } = createApp();
  const legacy = item('legacy', { segs: [lunchtime()], done: true });
  assert.equal(app.elapsed(legacy), minutes(40));
  app.applySettings(settings(app, { rest: { enabled: false, start: '12:00', end: '13:00' } }), true);
  assert.equal(app.elapsed(legacy), minutes(40));
  assert.equal(app.elapsedOn(legacy, today), minutes(40));
});

test('a half-hour rest deducts exactly 30 minutes from a 100-minute session', () => {
  const { app } = createApp();
  const rest = { enabled: true, start: '12:15', end: '12:45' };
  const segment = { ...lunchtime(), rest };
  assert.equal(app.elapsed(item('half-hour', { segs: [segment] })), minutes(70));
  const parts = app.cutLunch(segment.s, segment.e, rest);
  assert.equal(parts.reduce((sum, [start, end]) => sum + end - start, 0), minutes(70));
});

test('disabling rest keeps all 100 minutes and produces no rest gap', () => {
  const { app } = createApp();
  const segment = { ...lunchtime(), rest: { enabled: false, start: '12:00', end: '13:00' } };
  assert.equal(app.elapsed(item('no-rest', { segs: [segment] })), minutes(100));
  assert.deepEqual(plain(app.cutLunch(segment.s, segment.e, segment.rest)), [[segment.s, segment.e]]);
});

test('new sessions retain their chosen minute-level rest rule after later changes', () => {
  const { app, setClock } = createApp();
  app.applySettings(settings(app, { rest: { enabled: true, start: '12:15', end: '12:45' } }), true);
  setClock(at(2026, 10, 19, 11, 40));
  const started = app.addItem('new session', true);
  setClock(at(2026, 10, 19, 13, 20));
  app.pauseItem(started);
  assert.equal(app.elapsed(started), minutes(70));
  app.applySettings(settings(app, { rest: { enabled: false, start: '12:00', end: '13:00' } }), true);
  assert.equal(app.elapsed(started), minutes(70));
});

test('changing rest during work preserves prior effort and changes only future effort', () => {
  const { app, advance } = createApp();
  const history = item('history', { segs: [lunchtime()], done: true });
  const active = item('active', { segs: [{ s: at(2026, 10, 19, 11, 40), e: null }], running: true });
  put(app, [history, active]);
  const historyBefore = app.elapsed(history);
  const activeBefore = app.elapsed(active);
  app.applySettings(settings(app, { rest: { enabled: false, start: '12:00', end: '13:00' } }), true);
  assert.equal(active.running, true);
  assert.equal(app.elapsed(history), historyBefore);
  assert.equal(app.elapsed(active), activeBefore);
  advance(minutes(10));
  assert.equal(app.elapsed(active), activeBefore + minutes(10));
  assert.equal(app.elapsedOn(active, today), activeBefore + minutes(10));
  assert.equal(app.elapsed(history), historyBefore);
});

test('saving display preferences does not stop or restart an active timer', () => {
  const { app, now, advance } = createApp();
  const active = item('active', { segs: [{ s: now() - minutes(15), e: null }], running: true });
  put(app, [active]);
  app.applySettings(settings(app, { startView: 'gantt', enterAction: 'todo', motion: 'reduced' }), true);
  advance(minutes(5));
  assert.equal(active.running, true);
  assert.equal(app.elapsed(active), minutes(20));
  assert.equal(active.segs.length, 1);
});

test('turning off parallel work retains the most recently started item', () => {
  const { app, now, advance } = createApp();
  const older = item('older', { segs: [{ s: now() - minutes(20), e: null }], running: true });
  const latest = item('latest', { segs: [{ s: now() - minutes(5), e: null }], running: true });
  put(app, [older, latest]);
  app.applySettings(settings(app, { parallel: false }), true);
  assert.equal(activeCount(app), 1);
  assert.equal(latest.running, true);
  advance(minutes(10));
  assert.equal(app.elapsed(older), minutes(20));
  assert.equal(app.elapsed(latest), minutes(15));
});

test('adding and starting an item pauses other work in single-task mode', () => {
  const { app, now, advance } = createApp();
  app.applySettings(settings(app, { parallel: false }), true);
  const earlier = item('earlier', { segs: [{ s: now() - minutes(10), e: null }], running: true });
  put(app, [earlier]);
  const added = app.addItem('new task', true);
  advance(minutes(5));
  assert.equal(activeCount(app), 1);
  assert.equal(added.running, true);
  assert.equal(app.elapsed(earlier), minutes(10));
  assert.equal(app.elapsed(added), minutes(5));
});

test('resuming an item pauses other work while preserving all earlier sessions', () => {
  const { app, now, advance } = createApp();
  app.applySettings(settings(app, { parallel: false }), true);
  const earlier = item('earlier', { segs: [{ s: now() - minutes(10), e: null }], running: true });
  const resumed = item('resumed', { segs: [{ s: at(2026, 10, 19, 9), e: at(2026, 10, 19, 9, 20) }] });
  put(app, [earlier, resumed]);
  app.startItem(resumed);
  advance(minutes(5));
  assert.equal(activeCount(app), 1);
  assert.equal(app.elapsed(earlier), minutes(10));
  assert.equal(app.elapsed(resumed), minutes(25));
});

test('dragging queued work into doing also obeys single-task mode', () => {
  const { app, now, advance } = createApp();
  app.applySettings(settings(app, { parallel: false }), true);
  const earlier = item('earlier', { segs: [{ s: now() - minutes(10), e: null }], running: true });
  const queued = item('queued', { zone: 'todo' });
  put(app, [earlier, queued]);
  app.moveItem(queued.id, 'doing', -1, false);
  advance(minutes(5));
  assert.equal(activeCount(app), 1);
  assert.equal(queued.zone, 'doing');
  assert.equal(app.elapsed(earlier), minutes(10));
  assert.equal(app.elapsed(queued), minutes(5));
});

test('the default parallel mode lets two independently timed items keep running', () => {
  const { app, advance } = createApp();
  const first = app.addItem('first', true);
  advance(minutes(5));
  const second = app.addItem('second', true);
  advance(minutes(5));
  assert.equal(activeCount(app), 2);
  assert.equal(app.elapsed(first), minutes(10));
  assert.equal(app.elapsed(second), minutes(5));
});

test('disabled carry-over leaves past work in place and stops forgotten timers', () => {
  const { app, now, advance } = createApp();
  app.applySettings(settings(app, { autoCarry: false }), true);
  const past = item('past', { from: '2026-10-18', segs: [{ s: now() - minutes(30), e: null }], running: true });
  put(app, [past], '2026-10-18');
  assert.equal(app.carryOver(), 0);
  const effort = app.elapsed(past);
  advance(minutes(60));
  assert.equal(app.elapsed(past), effort);
  assert.equal(past.running, false);
  assert.equal(past.movedTo, undefined);
  assert.equal(app.tstate.days[today], undefined);
});

test('re-enabling carry-over moves mixed pending work once and preserves history', () => {
  const { app } = createApp();
  app.applySettings(settings(app, { autoCarry: false }), true);
  const pending = item('pending', { from: '2026-10-18', zone: 'todo' });
  const started = item('started', { from: '2026-10-18', segs: [{ s: at(2026, 10, 18, 10), e: at(2026, 10, 18, 10, 30) }] });
  const done = item('done', { done: true, zone: 'done' });
  const moved = item('moved', { movedTo: today });
  put(app, [pending, started, done, moved], '2026-10-18');
  assert.equal(app.carryOver(), 0);
  app.applySettings(settings(app, { autoCarry: true }), true);
  assert.equal(app.carryOver(), 2);
  assert.equal(app.carryOver(), 0);
  const copies = app.tstate.days[today].items;
  assert.deepEqual(plain(copies.map(it => it.text).sort()), ['pending', 'started']);
  assert.ok(copies.every(it => !it.running && !it.done && it.carried));
  assert.equal(app.tstate.days['2026-10-18'].items.length, 4);
  const continued = copies.find(it => it.text === 'started');
  assert.equal(app.elapsed(continued), minutes(30));
  assert.equal(app.elapsedOn(continued, today), 0);
  assert.notEqual(continued.segs[0], started.segs[0]);
});

test('switching week starts and back preserves occupied weeks and both note levels', () => {
  const { app } = createApp();
  app.state.months['2026-10'] = {
    projects: [{ id: 'p', weeks: { '2026-10-12': { note: 'sample' }, '2026-10-19': { note: 'review' } } }],
    weekNotes: { '2026-10-12': 'shared reminder' }, colorSeq: 1,
  };
  const before = plain(app.state.months);
  app.setWeekStart(false);
  assert.equal(app.state.months['2026-10'].projects[0].weeks['2026-10-11'].note, 'sample');
  assert.equal(app.state.months['2026-10'].weekNotes['2026-10-11'], 'shared reminder');
  app.setWeekStart(true);
  assert.deepEqual(plain(app.state.months), before);
});

test('a month-edge occupied week remains visible after changing the week start', () => {
  const { app } = createApp();
  app.state.months['2026-2'] = {
    projects: [{ id: 'edge', weeks: { '2026-01-26': { note: 'month edge' } } }],
    weekNotes: { '2026-01-26': 'keep this reminder' }, colorSeq: 1,
  };
  app.setWeekStart(false);
  const columns = app.buildColumns(2026, 2);
  assert.ok(columns.some(column => column.key === '2026-01-25'));
  assert.equal(app.state.months['2026-2'].projects[0].weeks['2026-01-25'].note, 'month edge');
  app.setWeekStart(true);
  assert.equal(app.state.months['2026-2'].weekNotes['2026-01-26'], 'keep this reminder');
});

test('date overrides take precedence over built-in holidays and makeup workdays', () => {
  const { app } = createApp();
  assert.equal(app.isWorkday(new Date(2026, 9, 1)), false);
  assert.equal(app.isWorkday(new Date(2026, 9, 10)), true);
  app.applySettings(settings(app, { dateOverrides: [
    { date: '2026-10-01', work: true, label: 'special workday' },
    { date: '2026-10-10', work: false, label: 'company holiday' },
  ] }), true);
  assert.equal(app.isWorkday(new Date(2026, 9, 1)), true);
  assert.equal(app.workdayInfo(new Date(2026, 9, 1)).hol, '');
  assert.equal(app.isWorkday(new Date(2026, 9, 10)), false);
  assert.equal(app.workdayInfo(new Date(2026, 9, 10)).hol, 'company holiday');
});

test('disabling built-in holidays removes their markers and uses weekly workdays', () => {
  const { app } = createApp();
  app.applySettings(settings(app, { useHolidays: false }), true);
  assert.equal(app.isWorkday(new Date(2026, 9, 1)), true);
  assert.equal(app.workdayInfo(new Date(2026, 9, 1)).hol, '');
  assert.equal(app.isWorkday(new Date(2026, 9, 10)), false);
  assert.equal(app.workdayInfo(new Date(2026, 9, 10)).makeup, false);
});

test('custom weekend work and an empty weekly schedule both retain usable columns', () => {
  const { app } = createApp();
  app.applySettings(settings(app, { useHolidays: false, workdays: [0, 6] }), true);
  assert.equal(app.isWorkday(new Date(2026, 9, 11)), true);
  assert.equal(app.isWorkday(new Date(2026, 9, 12)), false);
  assert.ok(app.buildColumns(2026, 10).some(column => column.days.some(day => day.inMonth && day.dow === 0)));
  app.applySettings(settings(app, { workdays: [], dateOverrides: [{ date: '2026-10-12', work: true, label: '' }] }), true);
  assert.equal(app.isWorkday(new Date(2026, 9, 11)), false);
  assert.equal(app.isWorkday(new Date(2026, 9, 12)), true);
  assert.ok(app.buildColumns(2026, 10).length > 0);
});

test('duplicate special dates resolve consistently and valid leap dates are retained', () => {
  const { app } = createApp();
  app.applySettings(settings(app, { dateOverrides: [
    { date: '2026-10-19', work: false, label: 'old' },
    { date: '2026-10-19', work: true, label: 'new' },
    { date: '2028-02-29', work: false, label: 'leap day' },
    { date: '2027-02-29', work: false, label: 'invalid' },
  ] }), true);
  assert.equal(app.isWorkday(new Date(2026, 9, 19)), true);
  assert.equal(app.getSettings().dateOverrides.length, 2);
  assert.equal(app.workdayInfo(new Date(2028, 1, 29)).hol, 'leap day');
});

test('unknown holiday years warn only when built-in holidays are enabled', () => {
  const { app, element } = createApp();
  app.cols = app.buildColumns(2027, 1);
  app.renderHolNote(2027, 1);
  assert.equal(element('holNote').hidden, false);
  app.applySettings(settings(app, { useHolidays: false }), true);
  app.renderHolNote(2027, 1);
  assert.equal(element('holNote').hidden, true);
});

test('reduced motion applies to both app behavior and the document preference', () => {
  const { app, setSystemReduced } = createApp();
  assert.equal(app.noMotion(), false);
  app.applySettings(settings(app, { motion: 'reduced' }), true);
  app.applyMotionPreference();
  assert.equal(app.noMotion(), true);
  assert.equal(app.document.documentElement.getAttribute('data-motion'), 'reduced');
  app.applySettings(settings(app, { motion: 'auto' }), true);
  app.applyMotionPreference();
  assert.equal(app.document.documentElement.getAttribute('data-motion'), null);
  setSystemReduced(true);
  assert.equal(app.noMotion(), true);
});

test('Enter can queue work without timing and IME confirmation never adds an item', () => {
  const { app, element } = createApp();
  app.applySettings(settings(app, { enterAction: 'todo' }), true);
  const input = element('addInput');
  input.value = 'queued via Enter';
  input.dispatch('keydown', { key: 'Enter', isComposing: true, preventDefault() {} });
  input.dispatch('keydown', { key: 'Enter', keyCode: 229, preventDefault() {} });
  assert.equal(app.tstate.days[today], undefined);
  input.dispatch('keydown', { key: 'Enter', preventDefault() {} });
  const [queued] = app.tstate.days[today].items;
  assert.equal(queued.text, 'queued via Enter');
  assert.equal(queued.zone, 'todo');
  assert.equal(queued.running, false);
  assert.equal(app.elapsed(queued), 0);
});

test('connecting a board opens its configured default view', () => {
  const { app, element } = createApp();
  app.applySettings(settings(app, { startView: 'gantt' }), true);
  app.startApp();
  assert.equal(element('viewToday').hidden, true);
  assert.equal(element('viewGantt').hidden, false);
});
