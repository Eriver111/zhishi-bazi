const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}

function chart(values) {
  const records = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

test('父母星固定采用偏财看父、正印看母，不随性别互换', () => {
  const calculator = loadCalculator();
  const bazi = chart(['丙寅', '丁卯', '甲子', '戊辰']);
  const male = calculator.analyzeParents(bazi, 'male');
  const female = calculator.analyzeParents(bazi, 'female');

  assert.equal(male.fatherStar, '偏财');
  assert.equal(male.motherStar, '正印');
  assert.equal(female.fatherStar, '偏财');
  assert.equal(female.motherStar, '正印');
});

test('父母星扫描完整四柱，能够识别日支母星与时柱父星', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['丙寅', '丁卯', '甲子', '戊辰']), 'female');
  const fatherPositions = result.facts.parentStars.father.appearances.map(item => item.pos);
  const motherPositions = result.facts.parentStars.mother.appearances.map(item => item.pos);

  assert.ok(fatherPositions.includes('hour'));
  assert.ok(motherPositions.includes('day'));
  assert.match(result.fatherText, /时干戊/);
  assert.match(result.motherText, /日支本气癸/);
});

test('年干生年支时按父生母解释，年支克年干时按母强父弱解释', () => {
  const calculator = loadCalculator();
  const fatherSupports = calculator.analyzeParents(chart(['甲午', '丙寅', '戊戌', '癸亥']), 'male');
  const motherDominates = calculator.analyzeParents(chart(['甲申', '丙寅', '戊戌', '癸亥']), 'male');

  assert.equal(fatherSupports.facts.palace.intraRelation, '生');
  assert.match(fatherSupports.parentsRelationshipText, /父亲更愿意迁就、支持母亲/);
  assert.equal(motherDominates.facts.palace.intraRelation, '被克');
  assert.match(motherDominates.parentsRelationshipText, /母亲在家里更强势/);
});

test('父母宫与月柱相冲会进入受损状态并明确说明家庭反复', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲申', '丙寅', '戊戌', '癸亥']), 'male');

  assert.equal(result.facts.palace.state, 'damaged');
  assert.ok(result.facts.palace.damageEvents.some(event => event.pair === '申寅' && event.type === '冲'));
  assert.match(result.familyText, /家庭结构不是一直平稳/);
  assert.match(result.parentsRelationshipText, /申寅冲/);
});

test('父母宫相合先判断合出五行喜忌，不再把合直接等同家庭融洽', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲子', '己丑', '丙寅', '戊戌']), 'male');

  assert.ok(result.facts.palace.combinationEvents.some(event => event.pair === '子丑' && event.resultElement === '土'));
  assert.doesNotMatch(result.parentsRelationshipText, /家庭关系比较融洽/);
  assert.match(result.parentsRelationshipText, /相合后落到土/);
});

test('父母报告提供五段事实输出且保留结构化依据', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲申', '丙寅', '戊戌', '癸亥']), 'male');

  for (const field of ['familyText', 'fatherText', 'motherText', 'parentsRelationshipText', 'childRelationshipText']) {
    assert.ok(result[field].length > 20, field);
  }
  assert.equal(result.facts.methodVersion, 'parents-v3-palace-star-relationship');
  assert.ok(['supportive', 'mixed', 'limited'].includes(result.facts.family.level));
});

test('父母星跨柱出现时按透干与藏气权重判断主要落点', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲申', '丙寅', '戊戌', '癸亥']), 'male');

  assert.match(result.fatherText, /年支中气壬、时支本气壬/);
  assert.match(result.fatherText, /力量较实的一处在时柱/);
  assert.match(result.fatherText, /本身有根，但根所在的位置同时受冲害/);
  assert.doesNotMatch(result.fatherText, /主要落在年柱/);
  assert.doesNotMatch(result.fatherText, /父亲星根气偏弱/);
});

test('亲疏判断按父母星主要力量而非任一余气位置判定', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲午', '丙寅', '戊戌', '癸亥']), 'male');

  assert.match(result.motherText, /力量较实的一处在年柱/);
  assert.match(result.childRelationshipText, /正印的主要力量离日主较远/);
  assert.doesNotMatch(result.childRelationshipText, /正印的主要力量靠近日主/);
});

test('父母星完全不现时不再误写成远隔或藏而不透', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲子', '己丑', '丙寅', '戊戌']), 'female');

  assert.equal(result.fatherPresent, false);
  assert.equal(result.motherPresent, false);
  assert.match(result.childRelationshipText, /正印不现/);
  assert.match(result.childRelationshipText, /偏财不现/);
  assert.doesNotMatch(result.childRelationshipText, /远隔或藏而不透/);
});

test('时柱透根且日支食伤生父星时不误判父子疏远', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['癸未', '庚申', '甲寅', '戊辰']), 'male');
  const fatherRelationship = result.facts.relationship.father;

  assert.equal(fatherRelationship.close, true);
  assert.equal(fatherRelationship.exposedNear, true);
  assert.ok(fatherRelationship.interestChannels.some(item => item.pos === 'day'));
  assert.match(result.childRelationshipText, /不是疏远型关系/);
  assert.match(result.childRelationshipText, /共同话题/);
  assert.match(result.childRelationshipText, /理解并支持你想做的方向/);
  assert.doesNotMatch(result.childRelationshipText, /父亲平时话不算多/);
  assert.doesNotMatch(result.fatherText, /平时联系不算密集/);
  assert.match(result.fatherText, /不能直接拿来判断亲子感情、沟通多少或对方是否支持你/);
});
