/* Run: node tests/gantt-groups.test.cjs [path/to/board.html]
 * Uses fictional projects and isolated in-memory storage only.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(source, 'utf8');
const compiled = new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1], { filename: source });
const plain = value => JSON.parse(JSON.stringify(value));

class Element {
  constructor() {
    this.children = []; this.dataset = {}; this.value = ''; this.textContent = '';
    this.style = { setProperty() {} }; this.events = new Map(); this.attributes = new Map();
    const classes = new Set();
    this.classList = { add: x => classes.add(x), remove: x => classes.delete(x),
      contains: x => classes.has(x), toggle: (x, yes) => yes ? classes.add(x) : classes.delete(x) };
  }
  set innerHTML(value) { this.markup = value; this.children = []; }
  get innerHTML() { return this.markup || ''; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) { this.events.set(type, fn); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key); }
  removeAttribute(key) { this.attributes.delete(key); }
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { top: 0, left: 0, bottom: 100, right: 100, height: 100, width: 100 }; }
  focus() {} showModal() { this.open = true; } close() { this.open = false; }
}
function setup() {
  const nodes = new Map(), storage = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const app = {
    console, Date, setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    requestAnimationFrame() {}, cancelAnimationFrame() {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)) },
    document: { body: new Element(), documentElement: new Element(), getElementById: node,
      createElement: () => new Element(), querySelector: () => new Element(), querySelectorAll: () => [], addEventListener() {} },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }), location: { pathname: '/index.html' } },
    getComputedStyle: () => ({}), alert() {}, confirm: () => true,
  };
  vm.createContext(app); compiled.runInContext(app, { timeout: 3000 });
  app.state = app.defaultState(); app.state.view = { year: 2026, month: 11 }; app.state.settings.motion = 'reduced';
  const md = app.curMonth(); md.groups = [{ id: 'g1', name: '待启动' }, { id: 'g2', name: '暂缓' }];
  const p = (id, extra = {}) => ({ id, name: id, color: '#5856D6', weeks: { '2026-11-02': { note: '保留备注' } }, ...extra });
  md.projects = [p('a'), p('b', { groupId: 'g1' }), p('c', { groupId: 'g1' }),
    p('d', { groupId: 'g2' }), p('e', { done: true, doneAt: 1234, groupId: 'g1' })];
  let saved = null; app.save = () => { saved = JSON.stringify(app.packData(1)); };
  return { app, md, node, saved: () => saved };
}
function ids(app, md, section) {
  return md.projects.filter(p => app.projectSection(p, md) === section).map(p => p.id);
}
function nameForm(ctx, value, group) {
  ctx.app.openGroupEditor(group || null); ctx.node('groupName').value = value;
  return ctx.app.saveGroupName();
}

test('old v1 and v2 boards retain projects and notes without requiring groups', () => {
  const { app, md } = setup();
  for (const old of [
    { version: 1, view: { year: 2026, month: 11 }, projects: plain(md.projects), weekNotes: { n: '周备注' } },
    { version: 2, view: { year: 2026, month: 11 }, months: { '2026-11': { projects: plain(md.projects), weekNotes: { n: '周备注' } } } },
  ]) {
    const migrated = app.migrate(old).months['2026-11'];
    assert.equal(migrated.projects.length, 5); assert.deepEqual(plain(migrated.groups), []);
    assert.equal(migrated.weekNotes.n, '周备注'); assert.equal(app.projectGroup(migrated.projects[1], migrated), '');
  }
});
test('new groups are named, empty, saved, and restored with the full backup', () => {
  const ctx = setup(), before = plain(ctx.md.projects);
  assert.equal(nameForm(ctx, '  等反馈  '), true);
  assert.equal(ctx.md.groups.at(-1).name, '等反馈'); assert.equal(ctx.node('groupDialog').open, false);
  assert.deepEqual(plain(ctx.md.projects), before);
  const reloaded = ctx.app.migrate(JSON.parse(ctx.saved()).gantt).months['2026-11'];
  assert.equal(reloaded.groups.at(-1).name, '等反馈'); assert.equal(reloaded.projects.length, 5);
});
test('blank, duplicate, reserved, and overly long names keep the editor open with useful errors', () => {
  for (const value of ['', '   ', '待启动', '已完成', '进行中', '长'.repeat(41)]) {
    const ctx = setup(); assert.equal(nameForm(ctx, value), false);
    assert.equal(ctx.md.groups.length, 2); assert.equal(ctx.node('groupDialog').open, true);
    assert.equal(ctx.node('groupError').hidden, false); assert.ok(ctx.node('groupError').textContent.length > 8);
    assert.equal(ctx.node('groupName').value, value); assert.equal(ctx.saved(), null);
  }
});
test('renaming a group retains all projects and membership; duplicate renames cannot merge groups', () => {
  const ctx = setup(), before = plain(ctx.md.projects);
  assert.equal(nameForm(ctx, '待样品', ctx.md.groups[0]), true);
  assert.deepEqual(plain(ctx.md.projects), before); assert.equal(ctx.md.groups.length, 2);
  assert.equal(nameForm(ctx, '暂缓', ctx.md.groups[0]), false); assert.equal(ctx.md.groups[0].name, '待样品');
});
test('moving between ordinary groups retains unfinished status, schedule, color, notes, and every project', () => {
  const { app, md } = setup(), p = app.projById('b'), before = plain(p);
  assert.equal(app.moveProjectTo('b', 0, false, 'g2'), true);
  assert.equal(p.groupId, 'g2'); assert.equal(!!p.done, false); assert.equal(p.doneAt, undefined);
  delete before.groupId; const after = plain(p); delete after.groupId; assert.deepEqual(after, before);
  assert.deepEqual(plain(ids(app, md, 'g2')), ['b', 'd']);
  assert.equal(new Set(md.projects.map(p => p.id)).size, 5); assert.equal(md.projects.length, 5);
});
test('reordering within a group accounts for removal of the dragged row and no-op drops', () => {
  const { app, md } = setup();
  assert.equal(app.moveProjectTo('b', 1, false, 'g1'), false);
  assert.equal(app.moveProjectTo('b', 2, false, 'g1'), true);
  assert.deepEqual(plain(ids(app, md, 'g1')), ['c', 'b']); assert.equal(md.projects.length, 5);
});
test('invalid target groups and missing projects never change or drop data', () => {
  const { app, md } = setup(), before = plain(md);
  assert.equal(app.moveProjectTo('b', 0, false, 'missing'), false);
  assert.equal(app.moveProjectTo('missing', 0, false, 'g1'), false); assert.deepEqual(plain(md), before);
});
test('marking a grouped project complete and restoring it returns it to its original group', () => {
  const { app, md } = setup(), p = app.projById('b');
  app.setProjectDone(p, true); assert.equal(p.done, true); assert.ok(p.doneAt); assert.equal(p.groupId, 'g1');
  app.setProjectDone(p, false); assert.equal(p.done, undefined); assert.equal(p.doneAt, undefined);
  assert.equal(p.groupId, 'g1'); assert.deepEqual(plain(ids(app, md, 'g1')), ['c', 'b']);
});
test('dragging a completed project into an ordinary group restores it without changing its schedule', () => {
  const { app } = setup(), p = app.projById('e'), weeks = plain(p.weeks);
  app.moveProjectTo('e', 0, false, 'g2'); assert.equal(p.done, undefined); assert.equal(p.doneAt, undefined);
  assert.equal(p.groupId, 'g2'); assert.deepEqual(plain(p.weeks), weeks);
});
test('projects can return to the default group, including when their old group no longer exists', () => {
  const { app, md } = setup();
  app.moveProjectTo('b', 1, false, ''); assert.equal(app.projById('b').groupId, undefined);
  const p = app.projById('e'); md.groups = [];
  app.setProjectDone(p, false); assert.equal(app.projectGroup(p, md), ''); assert.equal(!!p.done, false);
  assert.equal(md.projects.length, 5);
});
test('canceling group removal keeps data; confirmed removal preserves mixed unfinished and completed projects', () => {
  const { app, md } = setup(), before = plain(md);
  app.confirm = () => false; app.removeGroup(md.groups[0]); assert.deepEqual(plain(md), before);
  app.confirm = () => true; app.removeGroup(md.groups[0]);
  assert.deepEqual(plain(md.groups), [{ id: 'g2', name: '暂缓' }]); assert.equal(md.projects.length, 5);
  assert.equal(app.projById('b').groupId, undefined); assert.equal(app.projById('e').groupId, undefined);
  assert.equal(app.projById('e').done, true); assert.equal(app.projById('e').doneAt, 1234);
  assert.deepEqual(plain(md.projects.map(p => p.weeks)), before.projects.map(p => p.weeks));
});
test('groups without any projects are still recognized as saved board data', () => {
  const { app, md } = setup(); md.projects = [];
  assert.equal(app.ganttHasData(app.state), true);
  const reloaded = app.migrate(plain(app.state)); assert.equal(reloaded.months['2026-11'].groups.length, 2);
});
test('groups are independent by month and rolling forward still copies only the project name and color', () => {
  const { app, md } = setup(); const before = plain(md);
  app.rollProjectToNextMonth(app.projById('b'));
  const next = app.monthData(2026, 12, false); assert.deepEqual(plain(next.groups), []);
  assert.equal(next.projects.length, 1); assert.equal(next.projects[0].groupId, undefined);
  assert.deepEqual(plain(next.projects[0].weeks), {}); assert.deepEqual(plain(md), before);
});
test('malformed group records are skipped while orphaned projects remain visible in the default group', () => {
  const { app, md } = setup(); md.groups.push(null, { id: 'g1', name: '重复' }, { id: '_done', name: '伪完成' }, { id: 'x', name: '' });
  md.projects.push({ id: 'orphan', name: '孤立项目', groupId: 'missing', weeks: {} });
  const migrated = app.migrate(plain(app.state)).months['2026-11'];
  assert.equal(migrated.groups.length, 2); assert.equal(migrated.projects.length, 6);
  assert.equal(app.projectGroup(migrated.projects.at(-1), migrated), '');
});

test('renaming the default group preserves projects, membership, and completed status across backup reload', () => {
  const ctx = setup(), before = plain(ctx.md.projects), groups = plain(ctx.md.groups);
  assert.equal(nameForm(ctx, '重点推进', { id: '', name: '进行中' }), true);
  assert.equal(ctx.app.activeGroupName(ctx.md), '重点推进');
  assert.deepEqual(plain(ctx.md.projects), before); assert.deepEqual(plain(ctx.md.groups), groups);
  const reloaded = ctx.app.migrate(JSON.parse(ctx.saved()).gantt).months['2026-11'];
  assert.equal(ctx.app.activeGroupName(reloaded), '重点推进');
  assert.deepEqual(plain(reloaded.projects), before); assert.equal(reloaded.projects.at(-1).done, true);
  assert.equal(ctx.node('groupSave').textContent, '保存名称');
});

test('default group rename rejects empty or duplicate names while allowing its existing name', () => {
  const ctx = setup();
  for (const name of [' ', '待启动', '暂缓', '已完成']) {
    assert.equal(nameForm(ctx, name, { id: '', name: '进行中' }), false);
    assert.equal(ctx.app.activeGroupName(ctx.md), '进行中'); assert.equal(ctx.saved(), null);
    assert.equal(ctx.node('groupDialog').open, true); assert.equal(ctx.node('groupError').hidden, false);
  }
  assert.equal(nameForm(ctx, '进行中', { id: '', name: '进行中' }), true);
  assert.equal(ctx.md.groups.length, 2);
});

test('the current default name participates in duplicate checks for both new and renamed custom groups', () => {
  const ctx = setup(); nameForm(ctx, '主线项目', { id: '', name: '进行中' });
  assert.equal(nameForm(ctx, '主线项目'), false);
  assert.equal(nameForm(ctx, '主线项目', ctx.md.groups[0]), false);
  assert.equal(nameForm(ctx, '进行中'), true);
  assert.equal(ctx.md.groups.at(-1).name, '进行中');
  assert.equal(nameForm(ctx, '进行中', { id: '', name: '主线项目' }), false);
  assert.equal(ctx.app.activeGroupName(ctx.md), '主线项目');
});

test('a default group renamed on an otherwise empty month remains saved and independent of other months', () => {
  const ctx = setup(); ctx.md.groups = []; ctx.md.projects = [];
  assert.equal(ctx.app.ganttHasData(ctx.app.state), false);
  assert.equal(nameForm(ctx, '本月推进', { id: '', name: '进行中' }), true);
  assert.equal(ctx.app.ganttHasData(ctx.app.state), true); assert.deepEqual(plain(ctx.md.groups), []);
  const loaded = ctx.app.migrate(JSON.parse(ctx.saved()).gantt);
  assert.equal(ctx.app.activeGroupName(loaded.months['2026-11']), '本月推进');
  ctx.app.state = loaded;
  const next = ctx.app.monthData(2026, 12, true); assert.equal(ctx.app.activeGroupName(next), '进行中');
  ctx.app.state.view.month = 12;
  assert.equal(nameForm(ctx, '下月安排', { id: '', name: '进行中' }), true);
  assert.equal(ctx.app.activeGroupName(ctx.app.monthData(2026, 11, false)), '本月推进');
});

test('completion and restoration keep using the renamed default group without creating a new group', () => {
  const ctx = setup(); nameForm(ctx, '常规项目', { id: '', name: '进行中' });
  const p = ctx.app.projById('a'), before = plain(p);
  ctx.app.setProjectDone(p, true); ctx.app.setProjectDone(p, false);
  assert.equal(ctx.app.projectSection(p, ctx.md), ''); assert.equal(ctx.app.activeGroupName(ctx.md), '常规项目');
  assert.equal(!!p.done, false); assert.equal(p.groupId, undefined); assert.equal(ctx.md.groups.length, 2);
  assert.deepEqual(plain(p.weeks), before.weeks); assert.equal(p.color, before.color);
  assert.ok(ctx.node('toast').textContent.includes('常规项目'));
});
