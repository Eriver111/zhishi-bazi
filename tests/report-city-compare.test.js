const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Planner = require('../js/report-city-compare.js');

test('work direction and city names are optional and an empty submission gives a basic checklist', () => {
  const plan = Planner.buildPlan();
  assert.equal(plan.valid, true); assert.deepEqual(plan.cities, []); assert.equal(plan.workDirection, '');
  assert.deepEqual(plan.checklist.map(item => item.key), ['jobs', 'choices', 'requirements']);
  assert.match(plan.planningDirection, /岗位.*机会.*进入条件/); assert.match(Planner.toText(plan), /工作 \/ 专业方向：暂未填写/);
  assert.ok(plan.checklist.every(item => item.check && item.source));
});

test('broad work direction changes job checks without requesting employer or personal details', () => {
  const technology = Planner.buildPlan({ workDirection: 'technology' }), service = Planner.buildPlan({ workDirection: 'service' });
  assert.match(technology.checklist[0].check, /技术与研究/); assert.match(service.checklist[0].check, /轮班方式/);
  assert.notEqual(technology.checklist[0].check, service.checklist[0].check); assert.notEqual(technology.planningDirection, service.planningDirection);
  assert.equal(Planner.buildPlan({ workDirection: '<script>' }).workDirection, '');
  assert.match(Planner.toText(technology), /工作 \/ 专业方向：技术与研究/);
});

test('uses up to two optional city names as checklist context, never invents a winning city', () => {
  const plan = Planner.buildPlan({ workDirection: 'technology', cities: ['杭州', '成都', '上海'] });
  assert.deepEqual(plan.cities, ['杭州', '成都']); assert.equal(plan.recommendation, undefined); assert.equal(plan.winner, undefined); assert.equal(plan.scores, undefined);
  const text = Planner.toText(plan); assert.match(text, /候选城市：杭州、成都/); assert.doesNotMatch(text, /待查证/);
  assert.doesNotMatch(text, /杭州更|成都更|优先考虑杭州|推荐成都|匹配度\d|https?:\/\//); assert.match(text, /尚未查询各城市的公开资料/);
  assert.deepEqual(Planner.buildPlan({ cities: ['杭州', ' 杭州 '] }).cities, ['杭州']); assert.deepEqual(Planner.buildPlan({ cities: ['', '成都'] }).cities, ['成都']);
});

test('removed preferences and private details are ignored and never returned or exported', () => {
  const input = { priority: 'comfort', pace: 'slower', distance: 'near-only', income: 'PRIVATE_INCOME', housing: 'PRIVATE_HOUSING', other: 'PRIVATE_COST', company: 'PRIVATE_COMPANY', address: 'PRIVATE_ADDRESS', cities: ['甲城', '乙城'] };
  const snapshot = JSON.stringify(input), plan = Planner.buildPlan(input); assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(plan, Planner.buildPlan({ cities: input.cities }));
  assert.doesNotMatch(JSON.stringify(plan) + Planner.toText(plan), /PRIVATE_|surplus|Cents|income|housing|recommendation|preferences|priority|pace|distance|偏好|离家|节奏慢/);
  const source = fs.readFileSync(require.resolve('../js/report-city-compare.js'), 'utf8');
  assert.doesNotMatch(source, /月到手收入|房租|月住房开支|生活开支|月结余|surplusCents|incomeCents|moneyFields|function amount|input\.priority|input\.pace|input\.distance|fields\.priority|fields\.pace|fields\.distance|偏好|离家/);
});

class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.attributes = {}; this.handlers = {}; this.value = ''; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('HTML parsing is forbidden in this component'); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this._text = ''; children.forEach(child => this.appendChild(child)); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
  removeEventListener(type, handler) { this.handlers[type] = (this.handlers[type] || []).filter(item => item !== handler); }
  emit(type) { (this.handlers[type] || []).forEach(handler => handler({ preventDefault() {} })); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this); this.parentNode = null; }
  click() { this.emit('click'); }
}
function all(node) { return [node, ...node.children.flatMap(all)]; }
function fixture() {
  const doc = { createElement(tag) { return new Element(tag, this); }, getElementById(id) { return [...all(this.head), ...all(this.body)].find(node => node.id === id); } };
  doc.head = new Element('head', doc); doc.body = new Element('body', doc); const container = doc.createElement('div'); doc.body.appendChild(container); return { doc, container };
}
function submit(container, input = {}) {
  all(container).filter(node => node.tagName === 'INPUT' || node.tagName === 'SELECT').forEach(node => { node.value = input[node.name] || ''; });
  all(container).find(node => node.tagName === 'FORM').emit('submit');
}

test('mount starts collapsed with exactly three optional labeled controls and no preference or amount inputs', () => {
  const { doc, container } = fixture(); Planner.mount(container); const nodes = all(container), controls = nodes.filter(node => node.tagName === 'INPUT' || node.tagName === 'SELECT');
  assert.deepEqual(controls.map(node => node.name), ['workDirection', 'city0', 'city1']);
  assert.ok(controls.every(control => !control.required && control.attributes['aria-required'] !== 'true'));
  assert.ok(controls.every(control => nodes.some(node => node.tagName === 'LABEL' && node.htmlFor === control.id)));
  assert.equal(nodes.find(node => node.tagName === 'DETAILS').open, undefined); assert.equal(controls.filter(control => control.tagName === 'INPUT').length, 2);
  assert.ok(controls.filter(control => control.tagName === 'INPUT').every(control => control.type === 'text')); assert.match(doc.head.textContent, /@media\(max-width:620px\)/);
  assert.doesNotMatch(container.textContent, /到手收入|房租|生活开支|评分|公司名称|详细地址|偏好|离家|更看重/);
});

test('blank form submission succeeds and does not block or request personal details', () => {
  const { container } = fixture(); const api = Planner.mount(container); submit(container);
  assert.equal(api.getResult().valid, true); assert.ok(api.exportText()); assert.match(container.textContent, /规划方向/);
  assert.doesNotMatch(container.textContent, /必须填写|请填写金额|不能为空/); assert.equal(all(container).find(node => node.tagName === 'DETAILS').open, false);
});

test('city names are literal text and the result shows useful checks without empty comparison columns', () => {
  const { container } = fixture(); const api = Planner.mount(container); submit(container, { city0: '<img src=x onerror=alert(1)>', city1: '<svg onload=alert(1)>', workDirection: 'service' });
  assert.equal(api.getResult().valid, true); assert.ok(container.textContent.includes('<img src=x onerror=alert(1)>'));
  assert.ok(!all(container).some(node => node.tagName === 'IMG' || node.tagName === 'SVG'));
  assert.equal(all(container).filter(node => node.tagName === 'TD').length, 0);
  assert.equal(all(container).filter(node => node.tagName === 'LI').length, api.getResult().checklist.length);
  assert.doesNotMatch(container.textContent, /待查证/); assert.match(api.exportText(), /<svg onload=alert\(1\)>/);
});

test('changed direction or cities clear the old checklist and export; mounted result snapshots cannot be mutated', () => {
  const { container } = fixture(); const api = Planner.mount(container); submit(container, { city0: '甲城' });
  const snapshot = api.getResult(); snapshot.cities[0] = '改写'; assert.equal(api.getResult().cities[0], '甲城');
  all(container).find(node => node.tagName === 'FORM').emit('change'); assert.equal(api.getResult(), null); assert.equal(api.exportText(), ''); assert.match(container.textContent, /工作方向或候选城市已修改/);
});

test('static checklist remains separate from printable-excluded forms; remount cleans listeners', () => {
  const { doc, container } = fixture(); const first = Planner.mount(container); submit(container, { city0: '甲城', city1: '乙城' });
  const staticResult = all(container).find(node => node.className === 'report-city-compare__result');
  assert.match(staticResult.textContent, /甲城/); assert.match(staticResult.textContent, /乙城/); assert.match(staticResult.textContent, /公开资料/);
  assert.ok(!all(staticResult).some(node => ['INPUT', 'SELECT', 'BUTTON', 'FORM'].includes(node.tagName)));
  const firstForm = all(container).find(node => node.tagName === 'FORM'), second = Planner.mount(container);
  assert.equal(first.getResult(), null); assert.equal(firstForm.handlers.submit.length, 0); assert.equal(all(container).filter(node => node.tagName === 'FORM').length, 1); assert.equal(doc.head.children.length, 1);
  second.destroy(); second.destroy(); assert.equal(container.children.length, 0);
});

test('browser API performs no network or persistence access and adds no guessed external links', () => {
  const source = fs.readFileSync(require.resolve('../js/report-city-compare.js'), 'utf8'), window = {}, context = { window };
  Object.defineProperties(context, { fetch: { get() { throw new Error('network'); } }, localStorage: { get() { throw new Error('storage'); } }, sessionStorage: { get() { throw new Error('storage'); } } });
  vm.runInNewContext(source, context); assert.equal(typeof window.ReportCityCompare.mount, 'function');
  assert.equal(window.ReportCityCompare.buildPlan({ cities: ['杭州', '成都'] }).valid, true); assert.doesNotMatch(source, /https?:\/\//);
});
