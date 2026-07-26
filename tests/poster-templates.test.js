const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'js', 'poster-templates.js');
const dayMasters = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const patterns = [
  '正官格', '七杀格', '正财格', '偏财格', '正印格', '偏印格', '食神格', '伤官格',
  '建禄格', '羊刃格', '官印相生格', '杀印相生格', '财生官格', '食神生财格', '印绶格', '杂格',
];
const identity = {
  甲: ['参天之木', '木', 'jia'],
  乙: ['藤萝之木', '木', 'yi'],
  丙: ['太阳之火', '火', 'bing'],
  丁: ['灯烛之火', '火', 'ding'],
  戊: ['城垣之土', '土', 'wu'],
  己: ['田园之土', '土', 'ji'],
  庚: ['刚健之金', '金', 'geng'],
  辛: ['珠玉之金', '金', 'xin'],
  壬: ['江海之水', '水', 'ren'],
  癸: ['雨露之水', '水', 'gui'],
};

function loadTemplates() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiPosterTemplates;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('resolves every supported day-master and pattern pair to complete unique copy', () => {
  const templates = loadTemplates();
  const seenCopy = new Set();

  for (const dayGan of dayMasters) {
    for (const pattern of patterns) {
      const result = plain(templates.resolve({
        bazi: { day: { gan: dayGan } },
        gender: 'male',
        pattern,
      }));

      assert.deepEqual(Object.keys(result), [
        'dayGan', 'dayMasterLabel', 'subtitle', 'patternName', 'copyLines',
        'backgroundKey', 'sealText', 'footer',
      ]);
      assert.equal(result.dayGan, dayGan);
      assert.equal(result.dayMasterLabel, `${dayGan}${identity[dayGan][1]}男`);
      assert.equal(result.subtitle, identity[dayGan][0]);
      assert.equal(result.patternName, pattern);
      assert.equal(result.copyLines.length, 2);
      assert.ok(result.copyLines.every((line) => typeof line === 'string' && line.trim().length > 0));
      assert.equal(result.backgroundKey, `${identity[dayGan][2]}-male`);
      assert.equal(result.sealText, '知时');
      assert.equal(result.footer, '知天时，见自己');
      seenCopy.add(result.copyLines.join('\n'));
    }
  }

  assert.equal(seenCopy.size, 160, 'each day-master × pattern pair needs its own reviewed copy');
});

test('keeps the approved 乙木正官 copy verbatim', () => {
  const result = plain(loadTemplates().resolve({
    bazi: { day: { gan: '乙' } },
    gender: 'female',
    pattern: '正官格',
  }));

  assert.deepEqual(result.copyLines, [
    '看似柔软，自有守住分寸的力量。',
    '循序向上，责任会成为你攀援的支点。',
  ]);
});

test('returns deterministic core copy across repeated calls and genders', () => {
  const templates = loadTemplates();
  const input = { bazi: { day: { gan: '壬' } }, gender: 'male', pattern: '食神生财格' };
  const first = plain(templates.resolve(input));
  const second = plain(templates.resolve(input));
  const female = plain(templates.resolve({ ...input, gender: 'female' }));

  assert.deepEqual(second, first);
  assert.deepEqual(female.copyLines, first.copyLines);
  assert.equal(female.patternName, first.patternName);
});

test('normalizes empty and unknown patterns while resolving future keyword names deterministically', () => {
  const templates = loadTemplates();
  const bazi = { day: { gan: '庚' } };
  const miscellaneous = plain(templates.resolve({ bazi, gender: 'male', pattern: '杂格' }));

  for (const pattern of ['', '   ', null, undefined, '从旺局']) {
    const result = plain(templates.resolve({ bazi, gender: 'male', pattern }));
    assert.equal(result.patternName, '杂格');
    assert.deepEqual(result.copyLines, miscellaneous.copyLines);
  }

  assert.equal(
    templates.resolve({ bazi, gender: 'male', pattern: '月令七杀成势' }).patternName,
    '七杀格',
  );
  assert.equal(
    templates.resolve({ bazi, gender: 'male', pattern: '食神生财清局' }).patternName,
    '食神生财格',
  );
  assert.equal(
    templates.resolve({ bazi, gender: 'male', pattern: '正官七杀并见' }).patternName,
    '正官格',
  );
});

test('uses gender only for the identity label and background variant', () => {
  const templates = loadTemplates();
  const bazi = { day: { gan: '乙' } };
  const male = plain(templates.resolve({ bazi, gender: 'male', pattern: '偏印格' }));
  const female = plain(templates.resolve({ bazi, gender: 'female', pattern: '偏印格' }));

  assert.equal(male.dayMasterLabel, '乙木男');
  assert.equal(female.dayMasterLabel, '乙木女');
  assert.equal(male.backgroundKey, 'yi-male');
  assert.equal(female.backgroundKey, 'yi-female');
  assert.deepEqual(male.copyLines, female.copyLines);
});

test('source contract excludes random, seeded, hashed, cycling and refresh-based variation', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.doesNotMatch(source, /Math\.random|\bseed\b|\bhash\b|\bcycl(?:e|ing)\b|换一句|refresh/iu);
});
