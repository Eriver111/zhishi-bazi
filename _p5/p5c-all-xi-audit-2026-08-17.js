// 临时审计：543 盘池 + 5000 随机盘，统计 elementClassification 五元素分布——
// 问题：五个字全为喜神（或全在喜侧）会出现吗？
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');
function load(src) { var ctx = { window: {} }; vm.runInNewContext(src, ctx); return ctx.window.BaZiCalculator; }
var ENG = load(fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8'));

// ---- 543 盘池（p5c-remote-drift-2026-08-17.js 同源）----
var DISKS = {};
function addDisk(id, gz, set) {
  if (!DISKS[gz]) DISKS[gz] = { id: id, gz: gz, sets: {} };
  DISKS[gz].sets[set] = true;
}
function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
parseCSV('_p3_a2_sha_ab.csv').slice(1).forEach(function (r) { addDisk(r[1], r[2], '53freeze'); });
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm, m;
  while ((m = re.exec(md)) !== null) addDisk(m[1], m[2], '50blind');
});
[
  ['M01','壬子 壬子 丁酉 辛亥'],['M02','庚申 乙酉 庚申 乙酉'],['M03','丁巳 乙巳 辛亥 甲午'],
  ['M04','辛未 丁酉 丁亥 癸卯'],['M05','乙丑 癸未 庚辰 丙子'],['M06','癸亥 甲寅 戊辰 丁巳'],
  ['M07','壬午 癸丑 庚寅 壬午'],['M08','壬辰 壬子 甲午 丙寅'],['M09','丁未 丁未 辛丑 戊子'],
  ['M10','甲子 丁卯 己亥 庚午'],['M11','辛卯 丁酉 乙亥 己卯'],['M12','戊辰 丙辰 壬戌 庚戌'],
  ['M13','丁亥 己酉 甲辰 庚午'],['M14','戊午 戊午 甲戌 庚戌'],['M15','癸丑 乙卯 甲辰 戊辰'],
  ['M16','丙寅 庚寅 壬午 戊申'],['M17','癸巳 戊午 丙戌 壬辰'],['M18','乙亥 己卯 癸未 丁巳'],
  ['M19','庚辰 戊子 丙午 壬辰'],['M20','壬申 戊申 甲寅 丙寅']
].forEach(function (m) { addDisk(m[0], m[1], '20blind'); });
var ATTACK_SETS = { '00-P5A1-格局攻击集.md': 120, '00-P5A2-格局成败攻击集.md': 120, '00-P5A3-财党杀攻击集.md': 61 };
Object.keys(ATTACK_SETS).forEach(function (f) {
  var md = fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/^﻿/, '');
  var re = /^\| (\d+) \| [^|]+ \| [^|]+ \| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]) \|/gm;
  var m, n = 0;
  while ((m = re.exec(md)) !== null) { addDisk(f.replace(/\.md$/, '') + '#' + m[1], m[2], 'attack'); n++; }
  if (n !== ATTACK_SETS[f]) throw new Error(f + ' parse count anomaly: ' + n);
});
var p4aMd = fs.readFileSync(path.join(ROOT, '_p4a', '00-定向用例.md'), 'utf8');
var p4aCount = 0;
p4aMd.split(/\r?\n/).forEach(function (l) {
  var m = l.match(/\| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])（/);
  if (!m) return;
  p4aCount++;
  addDisk('P4A-' + p4aCount, m[1], 'P4A');
});
if (p4aCount !== 32) throw new Error('P4A parse count anomaly: ' + p4aCount);
[require('./p5c02-output.json'), require('./p5c03-output.json'), require('./p5c04-output.json')].forEach(function (arr) {
  arr.forEach(function (r) { if (r.gz) addDisk('IMPACT', r.gz, '105impact'); });
});
JSON.parse(fs.readFileSync(path.join(__dirname, 'p5c05-output.json'), 'utf8')).forEach(function (r) {
  addDisk(r.id, r.gz, 'C05-28');
});
[['ANCH1','丁亥 丙午 癸巳 己卯'],['ANCH2','戊子 丁巳 癸亥 庚申'],['ANCH3','己丑 甲戌 癸巳 丙辰'],
 ['USER-Q','庚寅 丙戌 庚子 乙酉']].forEach(function (a) { addDisk(a[0], a[1], 'extra'); });

// ---- 5000 随机盘（去重）----
var GANS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var ZHIS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var RAND = {};
function rg() { var gi = Math.floor(Math.random()*10); return GANS[gi] + ZHIS[gi%2 + 2*Math.floor(Math.random()*6)]; } // 阴阳匹配（60甲子合法柱）
var tries = 0;
while (Object.keys(RAND).length < 5000 && tries < 100000) {
  var gz = rg() + ' ' + rg() + ' ' + rg() + ' ' + rg();
  if (!RAND[gz] && !DISKS[gz]) RAND[gz] = true;
  tries++;
}

function build(ENG, gz) {
  var p = gz.split(' ');
  return ENG.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] }, month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] }, hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}
var WX5 = ['木','火','土','金','水'];
var FAV = { '用神':1, '喜神':1, '弱喜':1 };
var stats = { allFav: [], allStrong: [], dist: {} };
function audit(gz, tag) {
  var b = build(ENG, gz);
  var cls = ENG.getYongJi(b).elementClassification || {};
  var tiers = WX5.map(function (w) { return cls[w] || '?'; });
  var favCount = tiers.filter(function (t) { return FAV[t]; }).length;
  var strongCount = tiers.filter(function (t) { return t === '用神' || t === '喜神'; }).length;
  var key = favCount + 'fav_' + strongCount + 'strong';
  stats.dist[key] = (stats.dist[key] || 0) + 1;
  if (favCount === 5) stats.allFav.push({ gz: gz, tag: tag, tiers: tiers, cong: !!ENG.getCongGe(b).isCong });
  if (strongCount === 5) stats.allStrong.push({ gz: gz, tag: tag, tiers: tiers });
}
Object.keys(DISKS).forEach(function (gz) { audit(gz, '543'); });
Object.keys(RAND).forEach(function (gz) { audit(gz, 'rand'); });

console.log('pool_543=' + Object.keys(DISKS).length + ' rand=' + Object.keys(RAND).length);
console.log('all_five_favorable=' + stats.allFav.length);
stats.allFav.slice(0, 10).forEach(function (r) {
  console.log('  ALLFAV [' + r.tag + '] ' + r.gz + ' cong=' + r.cong + ' tiers=' + r.tiers.join(','));
});
console.log('all_five_strong=' + stats.allStrong.length);
stats.allStrong.slice(0, 10).forEach(function (r) {
  console.log('  ALLSTRONG [' + r.tag + '] ' + r.gz + ' tiers=' + r.tiers.join(','));
});
console.log('distribution(favCount_strongCount)=count:');
Object.keys(stats.dist).sort().forEach(function (k) { console.log('  ' + k + '=' + stats.dist[k]); });
