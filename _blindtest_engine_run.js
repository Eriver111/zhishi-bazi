// 盲测冒烟批 第③步（2026-08-14）：拉取 zhishi.online 实际部署字节（先 sha256 验证零漂移），
// 对 S01~S08 + BND01~BND02 跑完整线上引擎：旺衰/从格/用喜忌/格局/relationEvents/structuralRisks。
// 纪律：本脚本在 Claude 独立断盘冻结稿 commit（e51cc6c）之后才运行；结果落 _blindtest_engine_results.md。
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');

var EXPECT_SHA_BAZI = '774f83bdfe20b94c11c99e7f2b7c63a5ca04434e569510c2aa7edd14e4100be6';
var EXPECT_SHA_STRUCT = '96b8370dafc89453c1c63792f9f212934369d166682f8551f0f8d78984b5f8f7';

var DISKS = [
  ['S01', '壬申', '壬寅', '甲寅', '丁卯'],
  ['S02', '庚午', '甲申', '甲午', '癸酉'],
  ['S03', '甲辰', '庚午', '丙午', '癸巳'],
  ['S04', '壬子', '壬子', '丁酉', '辛亥'],
  ['S05', '丙戌', '甲午', '戊戌', '丁巳'],
  ['S06', '乙亥', '己卯', '己酉', '丙寅'],
  ['S07', '庚申', '乙酉', '庚申', '乙酉'],
  ['S08', '丁巳', '乙巳', '辛亥', '甲午'],
  ['BND01', '甲戌', '戊辰', '甲子', '壬申'],
  ['BND02', '辛未', '丁酉', '丁亥', '癸卯']
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
      cong: cong.isCong ? cong.name : '否',
      sa: SA.evaluate(b)
    };
  }

  var lines = [];
  lines.push('# 盲测冒烟批 · 线上引擎结果（2026-08-15）');
  lines.push('');
  lines.push('> 数据源：zhishi.online 部署字节。bazi.js sha256 `' + shaBazi.slice(0, 16) + '…`（P5-A2A blob ✓）');
  lines.push('> structural.js sha256 `' + shaStruct.slice(0, 16) + '…`（merge blob ✓）。');
  lines.push('> 时序：本结果在 Claude 独立断盘冻结稿 commit e51cc6c 之后生成，三方对账以本文档为引擎侧唯一依据。');
  lines.push('');

  DISKS.forEach(function (d) {
    var id = d[0], gz = d.slice(1);
    var r = engineRow(gz);
    lines.push('## ' + id + ' ' + gz.join(' '));
    lines.push('');
    lines.push('- **旺衰**: ' + r.score + ' ' + r.level + ' ｜ **从格**: ' + r.cong);
    lines.push('- **用神**: ' + (r.yong || '空') + ' ｜ **喜神**: ' + (r.xi || '空') + ' ｜ **忌神**: ' + (r.ji || '空'));
    lines.push('- **格局**: ' + r.pattern);
    lines.push('- **relationEvents**: ' + r.sa.relationEvents.length + ' 条');
    lines.push('- **structuralRisks**: ' + r.sa.structuralRisks.length + ' 条');
    r.sa.structuralRisks.forEach(function (rk) {
      lines.push('  - [' + rk.type + '](' + rk.severity + ') ' + rk.why);
    });
    if (r.sa.structuralRisks.length === 0) lines.push('  - （无）');
    lines.push('');
  });

  var out = lines.join('\n');
  fs.writeFileSync(__dirname + '/_blindtest_engine_results.md', out, 'utf8');
  console.log(out);
  console.log('✅ 引擎结果已落盘 _blindtest_engine_results.md');
})().catch(function (e) { console.error('❌ 网络/执行错误: ' + e.message); process.exit(1); });
