// Detailed trace for 2005-03-08 bazi - v2 with local tables
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');

var exportsToGlobal = [
  'calculateBaZi','normalizeBirthInput','calculateFromBirthInput',
  'getChangSheng','getTrueSolarHour','getPattern','calcDayMasterStrength',
  'getYongJi','getDayPillar','getMonthPillar','getYearPillar','getHourPillar',
  'getShiShen','DI_ZHI_WU_XING','WU_XING',
  'SHI_CHEN_NAMES','SHI_CHEN_TIMES','getRenYuanEvidence','getDaysFromJieQi',
  'getRenYuanSiLing','MONTH_TO_JIEQI','REN_YUAN_SI_LING'
];

var stitch = '';
exportsToGlobal.forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});

code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

// ── Local lookup tables (mirrors bazi.js internals) ──
var DI_ZHI_WX = DI_ZHI_WU_XING;
var WX = WU_XING;
var SHENGWO  = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
var KEWO     = { '木':'金','火':'水','土':'木','金':'火','水':'土' };
var WOSHENG  = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
var WOKE     = { '木':'土','火':'金','土':'水','金':'木','水':'火' };

var result = calculateFromBirthInput({
    year: 2005, month: 3, day: 8,
    hour: 0, clock: 0, minute: 45,
    gender: 'male',
    location: '谷城县',
    city: '襄阳市',
    prov: '湖北省',
    trueSolarTime: true
});

var b = result.bazi;
var n = result.normalized;

console.log('═══════════════════════════════════════════════');
console.log(' 2005年3月8日 00:45  湖北襄阳谷城县  男');
console.log('═══════════════════════════════════════════════');
console.log('');

// ═══ 真太阳时 ═══
if (n.solarInfo) {
    var si = n.solarInfo;
    console.log('┌─ 真太阳时 ──────────────────────────────────');
    console.log('│ 经度: ' + si.lng + '°E');
    console.log('│ 经度偏移: ' + si.lngOffsetMin + ' 分  (120-112.1)×4 = 31.6 ≈ 32分)');
    console.log('│ 均时差(EoT): ' + Math.round(si.eotMin) + ' 分');
    console.log('│ 总调整: ' + Math.round(si.lngOffsetMin + si.eotMin) + ' 分');
    console.log('│ 北京时间 00:45 → 真太阳时 ' + si.trueHour + ':' + String(si.trueMinute||0).padStart(2,'0'));
    console.log('│ 日期偏移: ' + (si.dayOffset || 0) + ' → 日柱' + (si.dayOffset ? '进入下一天' : '仍在当天'));
    console.log('│ 时辰: ' + ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][si.hourIndex] + '时');
    console.log('└────────────────────────────────────────────');
}

// ═══ 四柱 ═══
console.log('');
console.log('┌─ 四柱 ─────────────────────────────────────');
['year','month','day','hour'].forEach(function(pos) {
    var p = b[pos];
    console.log('│ ' + pos + ': ' + p.gan + p.zhi + '  (藏干: ' + (p.cangGan||[]).join(',') + '  纳音: ' + (p.nayin||'') + ')');
});
console.log('│');
console.log('│ 八字: ' + b.year.gan+b.year.zhi + ' ' + b.month.gan+b.month.zhi + ' ' + b.day.gan+b.day.zhi + ' ' + b.hour.gan+b.hour.zhi);
console.log('└────────────────────────────────────────────');

// ═══ 日柱验证 ═══
console.log('');
console.log('┌─ 日柱交叉验证 ─────────────────────────────');
// Known: 2000-01-01 = ?
// Standard base: 1900-01-01 = 甲戌日
// Days from 1900-01-01 to 2005-03-08: (2005-1900)*365 + leap days + Jan+Feb+8
// 105 years → 105*365 = 38325
// Leap years 1900-2099: years divisible by 4 → 1904,1908,...,2004 = 26
// But 1900 not leap (century not divisible by 400), 2000 IS leap
// 1904 to 2004: (2004-1904)/4+1 = 26 leap years
// 2005: Jan 31 + Feb 28 + Mar 8 = 67 days
// Total days from 1900-01-01 = 38325 + 26 + 67 = 38418
// 38418 % 60 = 38418 - 640*60 = 38418 - 38400 = 18
// 甲戌 index: let's use library's own calculation as truth
console.log('│ 库内日柱: ' + b.day.gan + b.day.zhi);
console.log('│ 库内日柱索引: ' + ((['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].indexOf(b.day.gan)*6 + ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].indexOf(b.day.zhi)) + ' / 60'));
console.log('└────────────────────────────────────────────');

// ═══ 旺衰手动追踪 ═══
var dg = b.day.gan;
var dgWx = WX[dg];

console.log('');
console.log('┌─ 旺衰分析 ─────────────────────────────────');
console.log('│ 日主: ' + dg + ' (' + dgWx + ')');
console.log('│');

// ① 得令
var mZhi = b.month.zhi;
var mWx = DI_ZHI_WX[mZhi];
console.log('│ ① 得令: 月支 ' + mZhi + ' (' + mWx + ')');
var dLingScore = 0;
var dLingNote = '';
if (mWx === dgWx) {
    dLingScore = 30; dLingNote = '同五行 → +30';
} else if (SHENGWO[dgWx] === mWx) {
    dLingScore = 20; dLingNote = mWx + '生' + dgWx + '(印) → +20';
} else if (WOSHENG[dgWx] === mWx) {
    dLingScore = -15; dLingNote = dgWx + '生' + mWx + '(泄) → -15';
} else if (WOKE[dgWx] === mWx) {
    dLingScore = -10; dLingNote = dgWx + '克' + mWx + '(耗) → -10';
} else if (KEWO[dgWx] === mWx) {
    dLingScore = -25; dLingNote = mWx + '克' + dgWx + '(克) → -25';
}
console.log('│   → ' + dLingNote + ' 得分: ' + dLingScore);

// ② 日支得地
console.log('│');
var dZhi = b.day.zhi;
var dZhiWx = DI_ZHI_WX[dZhi];
console.log('│ ② 得地(日支): ' + dZhi + ' (' + dZhiWx + ')');
var dDiNote = '';
if (dZhiWx === dgWx) dDiNote = '同五行(强根)';
else if (SHENGWO[dgWx] === dZhiWx) dDiNote = '生我(印根)';
else dDiNote = '非同五行/非生我 → 无得地加成';
console.log('│   → ' + dDiNote);

// ③ 天干
console.log('│');
console.log('│ ③ 天干:');
['year','month','hour'].forEach(function(pos) {
    var g = b[pos].gan;
    var wx = WX[g];
    var rel = '', sign = '';
    if (wx === dgWx) { rel = '比劫'; sign = '+'; }
    else if (SHENGWO[dgWx] === wx) { rel = '印星'; sign = '+'; }
    else if (WOSHENG[dgWx] === wx) { rel = '食伤'; sign = '-'; }
    else if (WOKE[dgWx] === wx) { rel = '财星'; sign = '-'; }
    else if (KEWO[dgWx] === wx) { rel = '官杀'; sign = '-'; }
    console.log('│   ' + pos + '干 ' + g + '(' + wx + ') → ' + rel + ' ' + sign);
});

// ④ 地支（五行）
console.log('│');
console.log('│ ④ 地支五行:');
['year','month','day','hour'].forEach(function(pos) {
    var z = b[pos].zhi;
    var wx = DI_ZHI_WX[z];
    var rel = '', sign = '';
    if (wx === dgWx) { rel = '比劫'; sign = '+'; }
    else if (SHENGWO[dgWx] === wx) { rel = '印星'; sign = '+'; }
    else if (WOSHENG[dgWx] === wx) { rel = '食伤'; sign = '-'; }
    else if (WOKE[dgWx] === wx) { rel = '财星'; sign = '-'; }
    else if (KEWO[dgWx] === wx) { rel = '官杀'; sign = '-'; }
    console.log('│   ' + pos + '支 ' + z + '(' + wx + ') → ' + rel + ' ' + sign);
});

// 库计算旺衰得分
var s = calcDayMasterStrength(b);
console.log('│');
console.log('│ ══ 总计得分: ' + s.score + ' → ' + s.level + ' (' + s.label + ')');
console.log('└────────────────────────────────────────────');

// ═══ 格局 ═══
var p = getPattern(b);
console.log('');
console.log('┌─ 格局 ─────────────────────────────────────');
console.log('│ 月支: ' + b.month.zhi + '  藏干: ' + (b.month.cangGan||[]).join(','));
console.log('│ 月支本气: ' + (b.month.cangGan && b.month.cangGan[0] || '?'));
console.log('│ 天干: 年' + b.year.gan + ' 月' + b.month.gan + ' 日' + b.day.gan + ' 时' + b.hour.gan);
console.log('│');
console.log('│ → 格局: ' + p.name + ' / ' + p.status);
console.log('│ → 类型: ' + p.type);
console.log('│ → 来源: ' + p.source);
console.log('│');
// 解释
console.log('│ 判定逻辑:');
console.log('│ 1. 月支卯藏乙(本气)，年干透出乙');
console.log('│ 2. 乙是辛的偏财 → 偏财格');
console.log('│ 3. 但日主极弱(22分)，财星过旺 → 破格/从格');
console.log('└────────────────────────────────────────────');

// ═══ 十二长生 ═══
var cs = getChangSheng(dg);
console.log('');
console.log('┌─ 十二长生 (日主 ' + dg + ') ────────────────');
var diZhiList = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
diZhiList.forEach(function(z) {
    var r = cs[z];
    if (r) {
        var marker = '';
        if (z === b.month.zhi) marker = ' ← 月令';
        if (z === b.day.zhi) marker = ' ← 日支';
        console.log('│ ' + z + ': ' + r.stage + marker);
    }
});
console.log('└────────────────────────────────────────────');

// ═══ 人元司令 ═══
var ry = getRenYuanEvidence(b);
console.log('');
console.log('┌─ 人元司令分野 ──────────────────────────────');
if (ry.visible) {
    console.log('│ ' + ry.text);
} else {
    console.log('│ 司令与本气一致，无额外标注');
}
console.log('└────────────────────────────────────────────');

// ═══ 喜用忌 ═══
var y = getYongJi(b);
console.log('');
console.log('┌─ 喜用忌 ───────────────────────────────────');
console.log('│ 喜神: ' + y.xiShen.join('、'));
console.log('│ 用神: ' + y.yongShen.join('、'));
console.log('│ 忌神: ' + y.jiShen.join('、'));
console.log('│');
console.log('│ 简释: 日主辛金极弱，土生金为喜用，');
console.log('│        木(财)火(官)水(食伤)为忌');
console.log('└────────────────────────────────────────────');
