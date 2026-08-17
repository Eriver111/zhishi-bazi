const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const audit = require('../scripts/bazi-audit-round.js');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bazi-audit-'));
  const round = path.join(root, 'round-01');
  fs.mkdirSync(round, { recursive: true });
  fs.writeFileSync(path.join(round, 'cases.json'), JSON.stringify({
    roundId: 'round-01',
    cases: Array.from({ length: 10 }, (_, index) => ({
      id: `R01-C${String(index + 1).padStart(2, '0')}`,
      birth: { year: 1990 + index, month: 1, day: 1, clock: 12, minute: 0, gender: index % 2 ? 'female' : 'male' },
      location: { province: '测试省', city: '测试市', district: `测试县${index}` },
      solarDataVersion: 'county-centroid-v1',
      pillars: ['甲子', '丙寅', '戊辰', ['庚午','辛未','壬申','癸酉','甲戌','乙亥','丙子','丁丑','戊寅','己卯'][index]],
      coverageTags: [index === 0 ? '明确身强' : '明确身弱'],
    }))
  }, null, 2));
  return { root, round };
}

test('capture refuses to reveal engine output before independent rulings are frozen', () => {
  const { round } = fixture();
  assert.throws(() => audit.captureEngine(round, { root: path.dirname(round), calculator: {} }), /先冻结独立判断/);
});

test('case validation rejects duplicate pillars and incomplete coverage', () => {
  const { round } = fixture();
  const data = JSON.parse(fs.readFileSync(path.join(round, 'cases.json')));
  data.cases[1].pillars = data.cases[0].pillars;
  fs.writeFileSync(path.join(round, 'cases.json'), JSON.stringify(data));
  assert.throws(() => audit.prepare(round, { priorPillars: new Set() }), /重复四柱/);
});

test('verification detects independent ruling changes after freeze', () => {
  const { round } = fixture();
  fs.writeFileSync(path.join(round, 'independent-rulings.md'), '# 独立判断\n');
  audit.freezeRulings(round, { root: path.dirname(round), engineFiles: [] });
  fs.appendFileSync(path.join(round, 'independent-rulings.md'), 'changed\n');
  assert.throws(() => audit.verifyRound(round, { root: path.dirname(round), engineFiles: [] }), /独立判断哈希不一致/);
});

test('prior audit collision scanning recognizes complete four-pillar tuples', () => {
  const { root, round } = fixture();
  fs.writeFileSync(path.join(root, '_blindtest_sample.md'), '旧盘：甲子 丙寅 戊辰 庚午');
  assert.throws(() => audit.prepare(round, { root }), /案例已在历史批次使用/);
});
