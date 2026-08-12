// Case 3 回归测试：丁亥 丁未 辛未 戊戌 —— 命主断：身偏弱、不成格、水为喜用
// 引擎曾误判 83分极强、七杀格成格、用火喜火水木
// 修复：A 金日主未戌月燥土印归零（①②③④） B 土≥3埋金-8 C 取水为用 D 燥土印→破格
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');

var exportsToGlobal = [
  'getPattern','calcDayMasterStrength','getYongJi','getCangGan',
  'DI_ZHI_WU_XING','WU_XING','getCongGe'
];
var stitch = '';
exportsToGlobal.forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

var bazi = {
  year: { gan:'丁', zhi:'亥' },
  month:{ gan:'丁', zhi:'未' },
  day:  { gan:'辛', zhi:'未' },
  hour: { gan:'戊', zhi:'戌' }
};

var engine = calcDayMasterStrength(bazi);
var pat = getPattern(bazi);
var yj = getYongJi(bazi);

console.log('═══════════════════════════════════════════════');
console.log(' 丁亥 丁未 辛未 戊戌（Case 3）回归测试');
console.log('═══════════════════════════════════════════════');
console.log('┌─ 引擎结果 ─────────────────────────────────');
console.log('│ 旺衰: ' + engine.score + '分 ' + engine.level);
console.log('│ 格局: ' + pat.name + '（' + pat.status + '）' + (pat.breakReasons && pat.breakReasons.length ? ' 破格原因: ' + pat.breakReasons.join(';') : ''));
console.log('│ 用神: ' + yj.yongShen.join('、'));
console.log('│ 喜神: ' + yj.xiShen.join('、'));
console.log('│ 忌神: ' + yj.jiShen.join('、'));
console.log('│ 判定: ' + yj.method);
console.log('└────────────────────────────────────────────');
console.log('');

var failures = [];
function check(name, cond, detail) {
  var ok = cond ? '✓' : '✗';
  console.log(' ' + ok + ' ' + name + (detail ? '（' + detail + '）' : ''));
  if (!cond) failures.push(name);
}

console.log('┌─ 断言 ─────────────────────────────────────');
check('身偏弱（旧值83极强）', engine.level === '偏弱' && engine.score >= 30 && engine.score < 40, engine.score + '分 ' + engine.level);
check('不再判极强', engine.score < 80, engine.score + '分');
check('格局为七杀格', (pat.name || '').indexOf('七杀') >= 0, pat.name);
check('格局破格（燥土印不化杀）', pat.status === '破格', pat.status + ' ' + (pat.breakReasons || []).join(';'));
check('用神为水（穷通宝鉴取水）', yj.yongShen.length === 1 && yj.yongShen[0] === '水', yj.yongShen.join('、'));
check('喜神水金', yj.xiShen.indexOf('水') >= 0 && yj.xiShen.indexOf('金') >= 0, yj.xiShen.join('、'));
check('忌神火木土', yj.jiShen.indexOf('火') >= 0 && yj.jiShen.indexOf('木') >= 0 && yj.jiShen.indexOf('土') >= 0, yj.jiShen.join('、'));
check('土不在喜用（燥土不生金）', yj.xiShen.indexOf('土') < 0 && yj.yongShen.indexOf('土') < 0, '喜' + yj.xiShen.join('、') + ' 用' + yj.yongShen.join('、'));
check('火不在喜用（杀为忌）', yj.xiShen.indexOf('火') < 0 && yj.yongShen.indexOf('火') < 0, '喜' + yj.xiShen.join('、') + ' 用' + yj.yongShen.join('、'));
console.log('└────────────────────────────────────────────');
console.log('');
if (failures.length > 0) {
  console.log('❌ 测试失败: ' + failures.join('; '));
  process.exit(1);
} else {
  console.log('✅ 全部断言通过');
}
