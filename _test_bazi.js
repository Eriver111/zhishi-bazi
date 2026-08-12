// Quick test harness for bazi.js in Node
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');

// Stitch: expose internal functions to global before they get exported
var exportsToGlobal = [
  'calculateBaZi','normalizeBirthInput','calculateFromBirthInput',
  'getChangSheng','getTrueSolarHour','getPattern','calcDayMasterStrength',
  'getYongJi','analyzeFortune','analyzeThisYear',
  'getDayPillar','getMonthPillar','getYearPillar','getHourPillar',
  'getShiShen','DI_ZHI_WU_XING','WU_XING','SHENGWO','KEWO','WOSHENG','WOKE',
  'SHI_CHEN_NAMES','SHI_CHEN_TIMES','getRenYuanEvidence','getDaysFromJieQi'
];

var stitch = '';
exportsToGlobal.forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});

code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

// Now run the calculation
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

console.log('═'.repeat(50));
console.log('公历: 2005-03-08 00:45  湖北省襄阳市谷城县');
console.log('═'.repeat(50));

if (n.solarInfo) {
    var si = n.solarInfo;
    console.log('');
    console.log('【真太阳时】');
    console.log('  经度:', si.lng, '°E');
    console.log('  经度偏移:', si.lngOffsetMin, '分');
    console.log('  均时差(EoT):', si.eotMin, '分');
    console.log('  总调整:', Math.round((si.lngOffsetMin || 0) + (si.eotMin || 0)), '分');
    console.log('  真太阳钟点:', si.trueHour + ':' + String(si.trueMinute || 0).padStart(2, '0'));
    console.log('  真太阳时辰:', ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][si.hourIndex] + '时');
}

console.log('');
console.log('【四柱】');
var pillars = ['year','month','day','hour'];
pillars.forEach(function(p) {
    var x = b[p];
    console.log('  ' + p + ': ' + x.gan + x.zhi + '  藏干[' + (x.cangGan || []).join(',') + ']  纳音:' + (x.nayin || ''));
});

console.log('');
console.log('  → ' + b.year.gan + b.year.zhi + ' ' + b.month.gan + b.month.zhi + ' ' + b.day.gan + b.day.zhi + ' ' + b.hour.gan + b.hour.zhi);

console.log('');
console.log('【日主】' + b.day.gan + '（' + b.day.wuXing.gan + '）');

var s = calcDayMasterStrength(b);
console.log('');
console.log('【旺衰】' + s.level + '（' + s.label + '，得分 ' + s.score + '）');

var p = getPattern(b);
console.log('');
console.log('【格局】' + p.name + ' / ' + p.status);
console.log('  类型: ' + p.type);
console.log('  来源: ' + p.source);

var y = getYongJi(b);
console.log('');
console.log('【喜用忌】');
console.log('  喜神:', y.xiShen.join('、'));
console.log('  用神:', y.yongShen.join('、'));
console.log('  忌神:', y.jiShen.join('、'));

// Show the 人元司令 info
var ry = getRenYuanEvidence(b);
if (ry.visible) {
    console.log('');
    console.log('【人元司令分野】');
    console.log('  ' + ry.text);
}
