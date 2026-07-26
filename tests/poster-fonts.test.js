const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const fontkit = require('fontkit');

const root = path.join(__dirname, '..');
const postersDir = path.join(root, 'fonts', 'posters');
const cssPath = path.join(root, 'css', 'poster.css');
const templatePath = path.join(root, 'js', 'poster-templates.js');
const fonts = [
  'MaShanZheng-Regular.woff2',
  'NotoSerifSC-SemiBold.woff2',
];
const licenses = [
  'OFL-MaShanZheng.txt',
  'OFL-NotoSerifSC.txt',
];
const dayMasters = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const patterns = [
  '正官格', '七杀格', '正财格', '偏财格', '正印格', '偏印格', '食神格', '伤官格',
  '建禄格', '羊刃格', '官印相生格', '杀印相生格', '财生官格', '食神生财格', '印绶格', '杂格',
];

function loadTemplates() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(templatePath, 'utf8'), context);
  return context.window.BaZiPosterTemplates;
}

function requiredPosterCharacters() {
  const templates = loadTemplates();
  const text = ['知时', '知天时，见自己'];

  for (const dayGan of dayMasters) {
    for (const pattern of patterns) {
      for (const gender of ['male', 'female']) {
        const poster = templates.resolve({ bazi: { day: { gan: dayGan } }, gender, pattern });
        text.push(
          poster.dayMasterLabel,
          poster.subtitle,
          poster.patternName,
          poster.sealText,
          poster.footer,
          ...poster.copyLines,
        );
      }
    }
  }

  return [...new Set(text.join(''))].filter((character) => !/\s/u.test(character));
}

test('ships the two poster WOFF2 assets and both SIL OFL notices', () => {
  for (const asset of [...fonts, ...licenses]) {
    assert.ok(fs.existsSync(path.join(postersDir, asset)), `missing ${asset}`);
  }

  for (const license of licenses) {
    assert.match(fs.readFileSync(path.join(postersDir, license), 'utf8'), /SIL OPEN FONT LICENSE/i);
  }
});

test('poster font files are non-empty complete WOFF2 files', () => {
  for (const font of fonts) {
    const bytes = fs.readFileSync(path.join(postersDir, font));
    assert.ok(bytes.length > 1024, `${font} is unexpectedly small`);
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2', `${font} is not WOFF2`);
    assert.equal(bytes.readUInt32BE(8), bytes.length, `${font} has an invalid declared length`);
  }
});

test('defines ZhishiBrush and ZhishiSerif with local poster asset URLs only', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1].trim().replace(/["']/g, ''));

  assert.match(css, /font-family:\s*["']ZhishiBrush["']/);
  assert.match(css, /font-family:\s*["']ZhishiSerif["']/);
  assert.deepEqual(urls, [
    '../fonts/posters/MaShanZheng-Regular.woff2',
    '../fonts/posters/NotoSerifSC-SemiBold.woff2',
  ]);
  assert.doesNotMatch(css, /https?:\/\/|\/\/fonts\./i);

  assert.doesNotMatch(css, /(^|[\s,>+~])(?:\.|#)(?:modal|preview)\b/im);
});

test('both poster fonts cover every character rendered by the poster templates', () => {
  const requiredCharacters = requiredPosterCharacters();
  assert.ok(requiredCharacters.length > 100, 'expected the template corpus to include substantial Chinese copy');

  for (const font of fonts) {
    const parsedFont = fontkit.openSync(path.join(postersDir, font));
    const missing = requiredCharacters.filter(
      (character) => !parsedFont.hasGlyphForCodePoint(character.codePointAt(0)),
    );
    assert.deepEqual(missing, [], `${font} is missing poster glyphs`);
  }
});
