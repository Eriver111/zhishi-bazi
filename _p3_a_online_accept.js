// P3-A 线上最小验收（2026-08-14，GPT 裁决第 5 条）：拉取 zhishi.online 实际部署的
// js/bazi.js（sha256 === P2 冻结 blob 62143475…）+ js/structural.js（=== merge blob 96b8370d…），
// 用线上字节在内存跑 #9 / K2 四盘 / #8/B1 / #6 零风险盘 硬断言。
var https = require('https');
var crypto = require('crypto');

var EXPECT_SHA_BAZI = '6214347502646dc3bdc6854b986cb0d5248db312a6736b07e3e872ab8e4368c1';
var EXPECT_SHA_STRUCT = '96b8370dafc89453c1c63792f9f212934369d166682f8551f0f8d78984b5f8f7';

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
  console.log('线上 js/bazi.js sha256: ' + shaBazi);
  if (shaBazi !== EXPECT_SHA_BAZI) { console.error('❌ 线上 bazi.js ≠ P2 冻结 blob'); process.exit(1); }
  console.log('✅ 线上 js/bazi.js === P2 冻结 blob（零漂移）');

  var bufStruct = await get('https://zhishi.online/js/structural.js');
  var shaStruct = crypto.createHash('sha256').update(bufStruct).digest('hex');
  console.log('线上 js/structural.js sha256: ' + shaStruct);
  if (shaStruct !== EXPECT_SHA_STRUCT) { console.error('❌ 线上 structural.js ≠ merge blob'); process.exit(1); }
  console.log('✅ 线上 js/structural.js === merge blob');

  // 与页面一致的加载路径：window.BaZiCalculator + window.StructuralAnalysis
  global.window = global;
  global.document = {};
  var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
    return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
  }).join('\n');
  eval(bufBazi.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  eval(bufStruct.toString('utf8'));
  var SA = global.StructuralAnalysis;
  var ENG = { dm: calcDayMasterStrength, yj: getYongJi, cong: getCongGe, pat: getPattern };

  function toBazi(gz) {
    return {
      year: { gan: gz[0][0], zhi: gz[0][1] },
      month: { gan: gz[1][0], zhi: gz[1][1] },
      day: { gan: gz[2][0], zhi: gz[2][1] },
      hour: { gan: gz[3][0], zhi: gz[3][1] }
    };
  }
  function row(gz) {
    var b = toBazi(gz);
    var dm = ENG.dm(b), yj = ENG.yj(b), pat = ENG.pat(b), cong = ENG.cong(b);
    return {
      score: dm.score, level: dm.level,
      yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
      pattern: pat.name + '·' + pat.status, cong: cong.isCong ? cong.name : '否'
    };
  }
  function sa(gz) {
    var b = toBazi(gz);
    var r = SA.evaluate(b);
    return { events: r.relationEvents, risks: r.structuralRisks };
  }
  function riskOf(s, type) {
    return s.risks.filter(function (r) { return r.type === type; });
  }

  var fail = 0;
  function check(name, ok, detail) {
    if (!ok) fail++;
    console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? ' | ' + detail : ''));
  }

  // ---- #9 黄金样本（GPT 裁决第 5 条）----
  var gz9 = ['甲子', '丁卯', '己未', '庚午'];
  var r9 = row(gz9);
  var got9 = r9.score + ' ' + r9.level + ' 用' + r9.yong + ' 喜' + (r9.xi || '空') + ' 忌' + (r9.ji || '空') + ' ' + r9.pattern;
  check('#9 五行层', got9 === '51 中和 用木 喜木 忌空 杀印相生格·成格', got9);
  var s9 = sa(gz9);
  check('#9 relationEvents=8', s9.events.length === 8, String(s9.events.length));
  check('#9 structuralRisks=3', s9.risks.length === 3, String(s9.risks.length));
  check('#9 三风险全潜在', s9.risks.length === 3 && s9.risks.every(function (r) { return r.severity === '潜在'; }),
    s9.risks.map(function (r) { return r.type + ':' + r.severity; }).join(' / '));
  var n9 = riskOf(s9, '关键用神/格局节点受冲')[0];
  check('#9 节点受冲 why 含印星之根', !!n9 && n9.why.indexOf('印星之根') >= 0, n9 && n9.why);
  check('#9 节点受冲 why 不含日主之禄', !!n9 && n9.why.indexOf('日主之禄') < 0, n9 && n9.why);
  var sg9 = riskOf(s9, '伤官见官')[0], cy9 = riskOf(s9, '财印冲')[0];
  check('#9 伤官见官=潜在', !!sg9 && sg9.severity === '潜在');
  check('#9 财印冲=潜在', !!cy9 && cy9.severity === '潜在');

  // ---- K2-final 四盘（GPT 裁决第 5 条）----
  var kA6 = riskOf(sa(['癸酉', '乙卯', '己丑', '己巳']), '杀重无制');
  check('A6 杀重无制=存在', kA6.length === 1 && kA6[0].severity === '存在', kA6.map(function (r) { return r.severity; }).join('/'));
  var kP15 = riskOf(sa(['乙丑', '戊寅', '己巳', '庚午']), '杀重无制');
  check('P15-03 不输出杀重无制', kP15.length === 0);
  var kH05 = riskOf(sa(['庚子', '乙酉', '甲辰', '甲子']), '杀重无制');
  check('H05 杀重无制=潜在', kH05.length === 1 && kH05[0].severity === '潜在', kH05.map(function (r) { return r.severity; }).join('/'));
  var kH13 = riskOf(sa(['壬寅', '丙午', '丙戌', '辛卯']), '杀重无制');
  check('H13 不输出杀重无制', kH13.length === 0);
  var gP15 = row(['乙丑', '戊寅', '己巳', '庚午']);
  check('P15-03 五行层零漂移', gP15.score + ' ' + gP15.level + ' 用' + gP15.yong + ' 忌' + (gP15.ji || '空') === '51 中和 用火 忌空',
    gP15.score + ' ' + gP15.level);

  // ---- #8/B1 透干七杀坐支之根节点恢复（GPT 裁决第 5 条）----
  ['#8', 'B1'].forEach(function (id) {
    var s = sa(['庚申', '壬午', '甲午', '丙寅']);
    var n = riskOf(s, '关键用神/格局节点受冲');
    check(id + ' 关键节点受冲恢复', n.length === 1 && n[0].why.indexOf('透干七杀坐支之根') >= 0, n[0] && n[0].why);
  });

  // ---- #6 零 risk 盘五行层零漂移 ----
  var g6 = row(['甲辰', '丙寅', '戊午', '丁巳']);
  var got6 = g6.score + ' ' + g6.level + ' 用' + g6.yong + ' 喜' + g6.xi + ' 忌' + g6.ji + ' ' + g6.pattern;
  check('#6 五行层零漂移', got6 === '62 偏强 用水 喜水、金、木 忌火、土 杀印相生格·成格', got6);
  check('#6 零 structuralRisk', sa(['甲辰', '丙寅', '戊午', '丁巳']).risks.length === 0);

  console.log(fail === 0 ? '\n🎉 P3-A 线上最小验收全部通过（17 项）' : '\n❌ 验收失败 ' + fail + ' 项');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('❌ 网络/执行错误: ' + e.message); process.exit(1); });
