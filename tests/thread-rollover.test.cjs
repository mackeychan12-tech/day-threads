/* Run: node tests/thread-rollover.test.cjs [path/to/board.html]
 * The application script, events, storage, clock, and timers run only in memory.
 * No real board file, browser profile, file handle, or network is used.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(source, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script, 'The board must contain its application script');
const compiled = new vm.Script(script[1], { filename: source });
const plain = value => JSON.parse(JSON.stringify(value));
const at = (year, month, day, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();
const OLD = '2026-10-30';
const NEXT = '2026-11-01';

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
  get isContentEditable() { return this.contentEditable === 'true' || this.contentEditable === true; }
  appendChild(child) { this.children.push(child); return child; }
  append(child) { return this.appendChild(child); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  async fire(type, event = {}) {
    await Promise.all((this.listeners.get(type) || []).map(listener => listener(event)));
    // Event wrappers do not always return the asynchronous operation they start.
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
  getBoundingClientRect() {
    return { left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 };
  }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  remove() {}
}

function item(id, changes = {}) {
  return {
    id, text: id, at: at(2026, 10, 30, 9), segs: [], running: false,
    done: false, doneAt: null, zone: 'todo', ord: 0, from: OLD,
    ...changes,
  };
}

function fixture() {
  const segs = [{
    s: at(2026, 10, 30, 10), e: at(2026, 10, 30, 10, 30),
    rest: { enabled: false, start: '12:00', end: '13:00' },
  }];
  return {
    version: 1,
    days: {
      // A previously carried ancestor must not become a second copy.
      '2026-10-28': { items: [item('ancestor', {
        text: 'queued work', from: '2026-10-28', movedTo: OLD,
      })] },
      '2026-10-29': { items: [] },
      [OLD]: { items: [
        item('queued', { text: 'queued work', from: '2026-10-28', carried: true }),
        item('paused', { text: 'paused work', zone: 'doing', segs }),
        item('finished', {
          text: 'completed work', done: true, zone: 'done', doneAt: at(2026, 10, 30, 11),
        }),
      ] },
    },
  };
}

function createApp(options = {}) {
  let clock = options.clock ?? at(2026, 10, 30, 16);
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const elements = new Map();
  let document;
  const createElement = () => {
    const node = new Element();
    node.ownerDocument = document;
    return node;
  };
  const element = id => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const documentEvents = new Element();
  const windowEvents = new Element();
  const storage = new Map();
  const intervals = new Map();
  const timeouts = new Map();
  let timerId = 0;
  let saves = 0;
  const setInterval = (callback, delay) => {
    const id = ++timerId;
    intervals.set(id, { callback, delay });
    return id;
  };
  const clearInterval = id => intervals.delete(id);
  const setTimeout = (callback, delay) => {
    const id = ++timerId;
    timeouts.set(id, { callback, delay });
    return id;
  };
  const clearTimeout = id => timeouts.delete(id);
  document = {
    documentElement: createElement(), body: createElement(), hidden: false, activeElement: null,
    getElementById: id => id === 'fsconf' ? (options.conflict ? element(id) : null) : element(id),
    createElement, querySelector: () => new Element(), querySelectorAll: () => [],
    addEventListener: documentEvents.addEventListener.bind(documentEvents),
    createRange: () => ({ selectNodeContents() {} }),
  };
  const sandbox = {
    Date: FixedDate, console,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    document,
    window: {
      addEventListener: windowEvents.addEventListener.bind(windowEvents),
      matchMedia: () => ({ matches: false }), location: { pathname: '/index.html' },
      getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
      setTimeout, clearTimeout, setInterval, clearInterval,
      // Omit folder-access and IndexedDB: the real disk can never be opened.
    },
    getComputedStyle: () => ({ paddingLeft: '0', paddingRight: '0' }),
    alert() {}, confirm: () => true,
  };
  vm.createContext(sandbox);
  compiled.runInContext(sandbox, { timeout: 3000 });
  sandbox.state = sandbox.defaultState();
  sandbox.tstate = options.thread ?? fixture();
  sandbox.viewDay = sandbox.todayKey();
  sandbox.fsx.ready = true;
  sandbox.fsx.dirty = false;
  sandbox.persist = () => { saves++; };
  sandbox.readDisk = async () => ({
    raw: sandbox.packData(sandbox.fsx.rev), rev: sandbox.fsx.rev, empty: false,
  });
  sandbox.startApp();
  return {
    app: sandbox, element,
    setClock(value) { clock = value; },
    saves: () => saves,
    documentEvent: (...args) => documentEvents.fire(...args),
    windowEvent: (...args) => windowEvents.fire(...args),
    async runIntervals() {
      for (const [id, timer] of [...intervals]) {
        if (intervals.has(id)) await timer.callback();
      }
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
}

const todayItems = app => (app.tstate.days[app.todayKey()] || { items: [] }).items;
function expectCarried(app, expected = 2) {
  const carried = todayItems(app).filter(entry => entry.carried);
  assert.equal(carried.length, expected, 'unfinished legacy work must be visible on the current day');
  assert.equal(carried.every(entry => !entry.running && !entry.done), true);
  assert.equal(carried.some(entry => entry.text === 'completed work'), false);
  return carried;
}

test('return to today immediately carries a mixed October batch into November', async () => {
  const { app, element, setClock } = createApp();
  setClock(at(2026, 11, 1, 9));
  await element('backToday').fire('click');
  assert.equal(app.viewDay, NEXT);
  const carried = expectCarried(app);
  assert.equal(carried.find(entry => entry.text === 'queued work').from, '2026-10-28');
  assert.deepEqual(plain(carried.find(entry => entry.text === 'paused work').segs),
    plain(app.tstate.days[OLD].items.find(entry => entry.id === 'paused').segs));
  assert.equal(app.tstate.days[OLD].items.length, 3);
  assert.equal(app.tstate.days['2026-10-28'].items.length, 1);
});

test('switching from the Gantt tab after rollover follows today and carries work', async () => {
  const { app, element, setClock } = createApp();
  await element('tabGantt').fire('click');
  setClock(at(2026, 11, 1, 9));
  await element('tabToday').fire('click');
  assert.equal(app.viewDay, NEXT);
  assert.equal(element('viewToday').hidden, false);
  expectCarried(app);
});

for (const [button, running] of [['addStart', true], ['addTodo', false]]) {
  test(`${button} carries existing work before appending the new November item`, async () => {
    const { app, element, setClock } = createApp();
    setClock(at(2026, 11, 1, 9));
    element('addInput').value = 'new November item';
    await element(button).fire('click');
    expectCarried(app);
    assert.equal(todayItems(app).length, 3);
    assert.equal(todayItems(app).at(-1).text, 'new November item');
    assert.equal(todayItems(app).at(-1).running, running, 'newly started work must keep running');
    assert.equal(app.viewDay, NEXT);
  });
}

test('restoring window focus performs rollover even when the disk revision is unchanged', async () => {
  const { app, setClock, windowEvent } = createApp();
  setClock(at(2026, 11, 1, 9));
  await windowEvent('focus');
  expectCarried(app);
  assert.equal(app.viewDay, NEXT);
});

test('becoming visible while on Gantt carries work without switching the selected tab', async () => {
  const { app, element, setClock, documentEvent } = createApp();
  await element('tabGantt').fire('click');
  setClock(at(2026, 11, 1, 9));
  await documentEvent('visibilitychange');
  expectCarried(app);
  assert.equal(element('viewToday').hidden, true, 'rollover must not force the user out of Gantt');
  await element('tabToday').fire('click');
  assert.equal(app.viewDay, NEXT);
  expectCarried(app);
});

for (const [label, before, after, day] of [
  ['ordinary day', at(2026, 10, 30, 23, 59), at(2026, 10, 31, 0, 1), '2026-10-31'],
  ['month boundary', at(2026, 10, 31, 23, 59), at(2026, 11, 1, 0, 1), NEXT],
  ['year boundary', at(2026, 12, 31, 23, 59), at(2027, 1, 1, 0, 1), '2027-01-01'],
]) {
  test(`an idle open page crosses the ${label} without requiring an active timer`, async () => {
    const { app, setClock, runIntervals } = createApp({ clock: before });
    // Initial connection carries the October fixture, so subsequent rollover
    // also exercises a chain rather than repeatedly copying its ancestors.
    setClock(after);
    await runIntervals();
    assert.equal(app.viewDay, day);
    expectCarried(app);
    assert.equal(todayItems(app).length, 2);
  });
}

test('repeated focus, visibility, timer, and return-to-today events do not duplicate a batch', async () => {
  const { app, element, setClock, runIntervals, documentEvent, windowEvent } = createApp();
  setClock(at(2026, 11, 1, 9));
  await element('backToday').fire('click');
  await windowEvent('focus');
  await documentEvent('visibilitychange');
  await runIntervals();
  await element('backToday').fire('click');
  expectCarried(app);
  assert.equal(todayItems(app).length, 2);
  assert.equal(new Set(todayItems(app).map(entry => entry.id)).size, 2);
  assert.equal(app.tstate.days[OLD].items.filter(entry => !entry.done).every(entry => entry.movedTo === NEXT), true);
});

test('turning auto-carry off retains history without importing it into today', async () => {
  const { app, element, setClock, runIntervals, documentEvent, windowEvent } = createApp();
  app.state.settings.autoCarry = false;
  const before = plain(app.tstate);
  setClock(at(2026, 11, 1, 9));
  await element('backToday').fire('click');
  await windowEvent('focus');
  await documentEvent('visibilitychange');
  await runIntervals();
  assert.equal(app.viewDay, NEXT);
  assert.equal(todayItems(app).length, 0);
  assert.deepEqual(plain(app.tstate), before);
});

test('a deliberately selected historical date is not replaced by the rollover watcher', async () => {
  const { app, setClock, runIntervals, documentEvent, windowEvent } = createApp();
  app.viewDay = '2026-10-28';
  app.renderToday();
  const before = plain(app.dayOf(app.viewDay));
  setClock(at(2026, 11, 1, 9));
  await runIntervals();
  await windowEvent('focus');
  await documentEvent('visibilitychange');
  assert.equal(app.viewDay, '2026-10-28');
  assert.deepEqual(plain(app.dayOf(app.viewDay)), before);
  expectCarried(app);
});

test('explicit return-to-today leaves a selected history date and carries the current batch', async () => {
  const { app, element, setClock } = createApp();
  app.viewDay = '2026-10-28';
  app.renderToday();
  setClock(at(2026, 11, 1, 9));
  await element('backToday').fire('click');
  assert.equal(app.viewDay, NEXT);
  assert.equal(element('histBar').hidden, true);
  expectCarried(app);
});

for (const conflict of [false, true]) {
  test(`${conflict ? 'an unresolved conflict' : 'a disconnected file'} prevents automatic rollover writes`, async () => {
    const { app, setClock, runIntervals, documentEvent, windowEvent, saves } = createApp({ conflict });
    // Check the conflict marker independently of the usual ready=false side effect.
    if (!conflict) app.fsx.ready = false;
    const before = plain(app.tstate);
    const beforeSaves = saves();
    setClock(at(2026, 11, 1, 9));
    await runIntervals();
    await windowEvent('focus');
    await documentEvent('visibilitychange');
    assert.deepEqual(plain(app.tstate), before);
    assert.equal(saves(), beforeSaves);
  });
}

test('an in-progress disk operation defers automatic rollover until it has finished', async () => {
  const { app, setClock, runIntervals, documentEvent, windowEvent, saves } = createApp();
  app.fsx.busy = true;
  const before = plain(app.tstate);
  const beforeSaves = saves();
  setClock(at(2026, 11, 1, 9));
  app.renderToday(); // A blocked render must not mark the new day as already handled.
  await runIntervals();
  await windowEvent('focus');
  await documentEvent('visibilitychange');
  assert.deepEqual(plain(app.tstate), before);
  assert.equal(saves(), beforeSaves);
  app.fsx.busy = false;
  await runIntervals();
  expectCarried(app);
  assert.equal(app.viewDay, NEXT);
});

test('restoring focus loads a newer disk version before carrying its legacy batch', async () => {
  const { app, setClock, windowEvent } = createApp();
  setClock(at(2026, 11, 1, 9));
  const disk = plain(app.packData(app.fsx.rev + 1));
  disk.thread.days[OLD].items.push(item('newer-disk-work', { text: 'legacy work added by another window' }));
  app.readDisk = async () => ({ raw: disk, rev: disk.rev, empty: false });
  await windowEvent('focus');
  expectCarried(app, 3);
  assert.equal(todayItems(app).length, 3);
  assert.equal(todayItems(app).some(entry => entry.text === 'legacy work added by another window'), true);
});

test('reconnecting after a deferred rollover retries the same batch exactly once', async () => {
  const { app, setClock, runIntervals } = createApp();
  app.fsx.ready = false;
  const before = plain(app.tstate);
  setClock(at(2026, 11, 1, 9));
  await runIntervals();
  assert.deepEqual(plain(app.tstate), before);
  app.linked(); // The real post-connection entry point, with disk access still isolated.
  assert.equal(app.viewDay, NEXT);
  expectCarried(app);
  await runIntervals();
  app.linked();
  assert.equal(todayItems(app).length, 2);
});

function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}

test('same-day continue, pause, and complete remain available during background saving', async () => {
  const { app, element } = createApp();
  const current = app.tstate.days[OLD].items.find(entry => entry.id === 'paused');
  const button = label => {
    const card = element('zone-doing').children.find(node => node.dataset.fid === current.id);
    assert.ok(card, 'the current-day card should still be rendered');
    const control = descendants(card).find(node => node.textContent === label);
    assert.ok(control, `the current-day ${label} control should exist`);
    return control;
  };
  app.fsx.busy = true; // A normal autosave must not swallow same-day user edits.
  await button('继续').fire('click');
  assert.equal(current.running, true);
  await button('暂停').fire('click');
  assert.equal(current.running, false);
  assert.ok(current.segs.at(-1).e, 'pausing must close the just-started segment');
  await button('完成').fire('click');
  assert.equal(current.done, true);
  assert.equal(current.zone, 'done');
  assert.equal(current.running, false);
});

for (const [zone, label] of [['doing', '继续'], ['doing', '完成'], ['todo', '✕']]) {
  test(`clicking a stale October ${zone} card's ${label} control cannot edit October history`, async () => {
    const { app, element, setClock } = createApp();
    const card = element(`zone-${zone}`).children.find(node => node.dataset.fid);
    assert.ok(card, 'the original live card should have been rendered');
    const control = descendants(card).find(node => node.textContent === label);
    assert.ok(control, 'the requested real card control should exist');
    const before = plain(app.tstate.days[OLD]);
    setClock(at(2026, 11, 1, 9));
    await control.fire('click');
    expectCarried(app);
    const history = plain(app.tstate.days[OLD]);
    // Marking a record as carried is expected; changing/deleting the old work is not.
    for (const entry of history.items) delete entry.movedTo;
    assert.deepEqual(history, before);
  });
}

test('editing across midnight keeps the editor intact and carries the saved text afterward', async () => {
  const { app, element, setClock, runIntervals, documentEvent, windowEvent } = createApp();
  const card = element('zone-doing').children.find(node => node.dataset.fid === 'paused');
  const title = descendants(card).find(node => /\bnowtitle\b/.test(node.className || ''));
  await title.fire('dblclick', { stopPropagation() {} });
  assert.equal(app.document.activeElement, title);
  assert.equal(title.isContentEditable, true);
  title.textContent = 'work renamed before leaving the editor';
  setClock(at(2026, 11, 1, 9));
  await runIntervals();
  await windowEvent('focus');
  await documentEvent('visibilitychange');
  assert.equal(element('zone-doing').children[0], card, 'the focused editor must not be detached');
  assert.equal(todayItems(app).length, 0, 'copying waits for the pending edit to be saved');
  await title.fire('blur');
  await runIntervals();
  expectCarried(app);
  assert.equal(todayItems(app).some(entry => entry.text === 'work renamed before leaving the editor'), true);
});

test('dragging across midnight keeps the dragged card intact and retries after drag end', async () => {
  const { app, element, setClock, runIntervals } = createApp();
  app.state.settings.motion = 'reduced';
  const card = element('zone-doing').children.find(node => node.dataset.fid === 'paused');
  await card.fire('dragstart', {
    clientX: 20, clientY: 20, preventDefault() {},
    dataTransfer: { setData() {}, setDragImage() {} },
  });
  assert.equal(app.dragId, 'paused');
  setClock(at(2026, 11, 1, 9));
  await runIntervals();
  assert.equal(element('zone-doing').children[0], card, 'rollover must not detach the drag source');
  assert.equal(todayItems(app).length, 0);
  await card.fire('dragend');
  await runIntervals();
  expectCarried(app);
  assert.equal(app.viewDay, NEXT);
});

test('an unchanged date does not copy, pause, or restart today\'s active timer', async () => {
  const { app, runIntervals, documentEvent, windowEvent } = createApp();
  const active = app.tstate.days[OLD].items.find(entry => entry.id === 'paused');
  active.running = true;
  active.segs.push({ s: at(2026, 10, 30, 15), e: null });
  app.renderToday();
  const before = plain(app.tstate);
  await runIntervals();
  await windowEvent('focus');
  await documentEvent('visibilitychange');
  assert.deepEqual(plain(app.tstate), before);
  assert.equal(active.running, true);
});

test('running legacy work closes once and its copied timing remains intact and paused', async () => {
  const { app, element, setClock, runIntervals } = createApp();
  const active = app.tstate.days[OLD].items.find(entry => entry.id === 'paused');
  active.running = true;
  active.segs.push({ s: at(2026, 10, 30, 15), e: null });
  const oldSegments = plain(active.segs.slice(0, -1));
  const now = at(2026, 11, 1, 9);
  setClock(now);
  await element('backToday').fire('click');
  const copied = expectCarried(app).find(entry => entry.text === 'paused work');
  assert.equal(active.running, false);
  assert.equal(copied.running, false);
  assert.deepEqual(plain(copied.segs.slice(0, -1)), oldSegments);
  assert.equal(copied.segs.at(-1).e, now);
  const carriedSegments = plain(copied.segs);
  setClock(now + 60000);
  await runIntervals();
  assert.deepEqual(plain(copied.segs), carriedSegments);
});

test('future records and completed history stay in their original dates', async () => {
  const { app, element, setClock } = createApp();
  app.tstate.days['2026-11-02'] = { items: [item('future work', { from: '2026-11-02' })] };
  const future = plain(app.tstate.days['2026-11-02']);
  const completed = plain(app.tstate.days[OLD].items.find(entry => entry.done));
  setClock(at(2026, 11, 1, 9));
  await element('backToday').fire('click');
  expectCarried(app);
  assert.deepEqual(plain(app.tstate.days['2026-11-02']), future);
  assert.deepEqual(plain(app.tstate.days[OLD].items.find(entry => entry.done)), completed);
});

test('empty and fully completed histories move the live date without inventing tasks', async () => {
  for (const thread of [
    { version: 1, days: {} },
    { version: 1, days: { [OLD]: { items: [item('done', { done: true, zone: 'done' })] } } },
  ]) {
    const { app, setClock, runIntervals } = createApp({ thread });
    const before = plain(app.tstate);
    setClock(at(2026, 11, 1, 9));
    await runIntervals();
    assert.equal(app.viewDay, NEXT);
    assert.equal(todayItems(app).length, 0);
    assert.deepEqual(plain(app.tstate), before);
  }
});
