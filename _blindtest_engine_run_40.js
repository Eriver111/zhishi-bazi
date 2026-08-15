// 盲测正式批 第③步（2026-08-14）：拉取 zhishi.online 部署字节（sha256 零漂移验证），
// 对 40 盘（BND03~08/PAT01~08/TH01~08/R01~08/X01~10）跑完整线上引擎。
// 纪律：在 Claude 冻结稿 commit 之后运行；结果落 _blindtest_engine_results_40.md。
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');

var EXPECT_SHA_BAZI = 'e3f9f67ada904819afd211d289991ade7712581be5d84ba74c923a522e3e21ab';
var EXPECT_SHA_STRUCT = '96b8370dafc89453c1c63792f9f212934369d166682f8551f0f8d78984b5f8f7';

var DISKS = [
  ['BND03', '癸酉', '乙丑', '丙辰', '甲午'],
  ['BND04', '乙丑', '癸未', '庚辰', '丙子'],
  ['BND05', '丙申', '己亥', '壬辰', '丙午'],
  ['BND06', '己未', '己巳', '乙丑', '丁亥'],
  ['BND07', '庚辰', '戊寅', '辛未', '丁酉'],
  ['BND08', '丁卯', '庚戌', '癸巳', '庚申'],
  ['PAT01', '癸亥', '甲寅', '戊辰', '丁巳'],
  ['PAT02', '辛酉', '辛卯', '己丑', '庚午'],
  ['PAT03', '甲申', '壬申', '乙卯', '丙子'],
  ['PAT04', '丁亥', '己酉', '甲辰', '庚午'],
  ['PAT05', '庚戌', '戊寅', '丙申', '壬辰'],
  ['PAT06', '乙未', '壬午', '壬戌', '戊申'],
  ['PAT07', '壬午', '癸丑', '庚寅', '壬午'],
  ['PAT08', '戊子', '癸亥', '丁未', '己酉'],
  ['TH01', '壬辰', '壬子', '甲午', '丙寅'],
  ['TH02', '庚子', '己丑', '丁未', '辛亥'],
  ['TH03', '癸丑', '癸亥', '戊午', '丁巳'],
  ['TH04', '辛亥', '庚子', '庚寅', '壬午'],
  ['TH05', '丙午', '甲午', '壬子', '戊申'],
  ['TH06', '甲午', '己巳', '己亥', '癸酉'],
  ['TH07', '丁未', '丁未', '辛丑', '戊子'],
  ['TH08', '己巳', '庚午', '乙亥', '庚辰'],
  ['R01', '甲子', '丁卯', '己亥', '庚午'],
  ['R02', '庚申', '戊寅', '甲戌', '壬申'],
  ['R03', '乙酉', '己卯', '戊子', '戊午'],
  ['R04', '壬子', '丙午', '丁卯', '己酉'],
  ['R05', '丙寅', '丙申', '庚午', '戊寅'],
  ['R06', '辛卯', '丁酉', '乙亥', '己卯'],
  ['R07', '戊辰', '壬戌', '壬子', '甲辰'],
  ['R08', '癸未', '乙丑', '丙申', '乙未'],
  ['X01', '癸亥', '癸亥', '丁巳', '乙巳'],
  ['X02', '庚申', '甲申', '甲寅', '丙寅'],
  ['X03', '辛酉', '丁酉', '乙卯', '己卯'],
  ['X04', '戊辰', '丙辰', '壬戌', '庚戌'],
  ['X05', '己丑', '辛未', '癸丑', '己未'],
  ['X06', '甲午', '庚午', '庚子', '丙子'],
  ['X07', '乙亥', '丁亥', '辛巳', '癸巳'],
  ['X08', '丙寅', '庚寅', '壬申', '戊申'],
  ['X09', '丁卯', '癸卯', '癸酉', '辛酉'],
  ['X10', '癸巳', '丁巳', '丁亥', '辛亥']
];

function get(url) {
  return new Promise(function (res, rej) {
    https.get(url, function (r) {
      var chunks = [];
      r.on('data', function (c) { chunks.push(c); });
      r.on('end', function () { res(Buffer.concat(chunks)); });
    }).on('error', rej);
  });
}

(async function () {
  var bufBazi = await get('https://zhishi.online/js/bazi.js');
  var shaBazi = crypto.createHash('sha256').update(bufBazi).digest('hex');
  if (shaBazi !== EXPECT_SHA_BAZI) { console.error('❌ 线上 bazi.js 漂移: ' + shaBazi); process.exit(1); }
  var bufStruct = await get('https://zhishi.online/js/structural.js');
  var shaStruct = crypto.createHash('sha256').update(bufStruct).digest('hex');
  if (shaStruct !== EXPECT_SHA_STRUCT) { console.error('❌ 线上 structural.js 漂移: ' + shaStruct); process.exit(1); }

  global.window = global;
  global.document = {};
  var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
    return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
  }).join('\n');
  eval(bufBazi.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  eval(bufStruct.toString('utf8'));
  var SA = global.StructuralAnalysis;

  function toBazi(gz) {
    return {
      year: { gan: gz[0][0], zhi: gz[0][1] },
      month: { gan: gz[1][0], zhi: gz[1][1] },
      day: { gan: gz[2][0], zhi: gz[2][1] },
      hour: { gan: gz[3][0], zhi: gz[3][1] }
    };
  }
  function engineRow(gz) {
    var b = toBazi(gz);
    var dm = calcDayMasterStrength(b), yj = getYongJi(b), pat = getPattern(b), cong = getCongGe(b);
    return {
      score: dm.score, level: dm.level,
      yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
      pattern: pat.name + '·' + pat.status,
      breakReasons: pat.status === '破格' ? (pat.breakReasons || []).join('；') : '',
      cong: cong.isCong ? cong.name : '否',
      sa: SA.evaluate(b)
    };
  }

  var lines = [];
  lines.push('# 盲测正式批 · 线上引擎结果（2026-08-14）');
  lines.push('');
  lines.push('> 数据源：zhishi.online 部署字节。bazi.js sha256 `' + shaBazi.slice(0, 16) + '…`（P2 冻结 blob ✓）');
  lines.push('> structural.js sha256 `' + shaStruct.slice(0, 16) + '…`（merge blob ✓）。');
  lines.push('> 时序：本结果在 Claude 独立断盘冻结稿 commit 之后生成。X01~10 为压力盘，单独统计。');
  lines.push('');

  DISKS.forEach(function (d) {
    var id = d[0], gz = d.slice(1);
    var r = engineRow(gz);
    lines.push('## ' + id + ' ' + gz.join(' '));
    lines.push('');
    lines.push('- **旺衰**: ' + r.score + ' ' + r.level + ' ｜ **从格**: ' + r.cong);
    lines.push('- **用神**: ' + (r.yong || '空') + ' ｜ **喜神**: ' + (r.xi || '空') + ' ｜ **忌神**: ' + (r.ji || '空'));
    lines.push('- **格局**: ' + r.pattern + (r.breakReasons ? '（破格因：' + r.breakReasons + '）' : ''));
    lines.push('- **relationEvents**: ' + r.sa.relationEvents.length + ' 条');
    lines.push('- **structuralRisks**: ' + r.sa.structuralRisks.length + ' 条');
    r.sa.structuralRisks.forEach(function (rk) {
      lines.push('  - [' + rk.type + '](' + rk.severity + ') ' + rk.why);
    });
    if (r.sa.structuralRisks.length === 0) lines.push('  - （无）');
    lines.push('');
  });

  var out = lines.join('\n');
  fs.writeFileSync(__dirname + '/_blindtest_engine_results_40.md', out, 'utf8');
  console.log(out);
  console.log('✅ 引擎结果已落盘 _blindtest_engine_results_40.md');
})().catch(function (e) { console.error('❌ 网络/执行错误: ' + e.message); process.exit(1); });
