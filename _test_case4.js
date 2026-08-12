// Case 4 回归测试：戊寅 甲寅 癸未 乙卯 —— 命主断：身极弱，从儿格
// 修复前：从格引擎已判从儿格，但格局区显示「伤官格·破格」，看起来像「未成从格」
// 修复：从格成立时 getPattern 覆盖为从格名（从格则不论正格）
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');

var exportsToGlobal = [
  'getPattern','calcDayMasterStrength','getYongJi','getCangGan',
  'DI_ZHI_WU_XING','WU_XING','getCongGe','getProfessionalReportFacts'
];
var stitch = '';
exportsToGlobal.forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

var bazi = {
  year: { gan:'戊', zhi:'寅' },
  month:{ gan:'甲', zhi:'寅' },
  day:  { gan:'癸', zhi:'未' },
  hour: { gan:'乙', zhi:'卯' }
};

var engine = calcDayMasterStrength(bazi);
var cong = getCongGe(bazi);
var pat = getPattern(bazi);
var yj = getYongJi(bazi);
var facts = getProfessionalReportFacts(bazi, 'male');

console.log('═══════════════════════════════════════════════');
console.log(' 戊寅 甲寅 癸未 乙卯（Case 4）回归测试');
console.log('═══════════════════════════════════════════════');
console.log('┌─ 引擎结果 ─────────────────────────────────');
console.log('│ 旺衰: ' + engine.score + '分 ' + engine.level);
console.log('│ 从格: isCong=' + cong.isCong + ' name=' + (cong.name || '-'));
console.log('│ 格局: ' + pat.name + '（' + pat.status + '）' + (pat.basePattern ? ' 原局: ' + pat.basePattern : ''));
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
check('身极弱（<30分）', engine.level === '极弱' && engine.score < 30, engine.score + '分 ' + engine.level);
check('从格判定为从儿格', cong.isCong === true && cong.name === '从儿格', 'isCong=' + cong.isCong + ' name=' + cong.name);
check('格局显示从儿格（不再是伤官格）', pat.name === '从儿格', pat.name);
check('从格成立则格局为成格', pat.status === '成格', pat.status);
check('从格标记 congGe=true', pat.congGe === true, 'congGe=' + pat.congGe);
check('保留原局备注（伤官格·破格）', (pat.basePattern || '').indexOf('伤官格') >= 0, pat.basePattern);
check('source 含「既成从格，以从格论」', (pat.source || '').indexOf('既成从格，以从格论') >= 0, pat.source);
check('用神为木（顺势从儿）', yj.yongShen.length === 1 && yj.yongShen[0] === '木', yj.yongShen.join('、'));
check('喜神木火', yj.xiShen.indexOf('木') >= 0 && yj.xiShen.indexOf('火') >= 0, yj.xiShen.join('、'));
check('忌神金', yj.jiShen.indexOf('金') >= 0, yj.jiShen.join('、'));
check('判定方法为从格顺势', yj.method === '从格顺势', yj.method);
check('patternStatus 同步从儿格', yj.patternStatus && yj.patternStatus.name === '从儿格' && yj.patternStatus.status === '成格', (yj.patternStatus || {}).name + '·' + (yj.patternStatus || {}).status);
check('证据链格局条目为从儿格·成格', yj.evidence.some(function(r) { return r.category === '格局' && r.title.indexOf('从儿格') >= 0; }), '');
check('深度报告 pattern 为从儿格', facts.pattern.name === '从儿格' && facts.pattern.status === '成格', facts.pattern.name + '·' + facts.pattern.status);
console.log('└────────────────────────────────────────────');
console.log('');
if (failures.length > 0) {
  console.log('❌ 测试失败: ' + failures.join('; '));
  process.exit(1);
} else {
  console.log('✅ 全部断言通过');
}
