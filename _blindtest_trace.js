// 三方终裁证据 trace（2026-08-14）：按 GPT 裁决要求抽取
// ① S06 getPattern() 完整破格 reason（OBS-1）
// ② S04/S07/S08 从格判定依据（getCongGe 返回明细）
// ③ BND02 杀重无制 evidence 明细（验证 e3 口径）
// 用线上字节跑（与 _blindtest_engine_results.md 同源），只读不改。
var https = require('https');
var crypto = require('crypto');

var EXPECT_SHA_BAZI = 'f792041b6abe2be4e7f18cc6ce7b05e454f5fa75e3ca81cc1f756a6d87c92141';
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
  if (crypto.createHash('sha256').update(bufBazi).digest('hex') !== EXPECT_SHA_BAZI) { console.error('❌ bazi.js 漂移'); process.exit(1); }
  var bufStruct = await get('https://zhishi.online/js/structural.js');
  if (crypto.createHash('sha256').update(bufStruct).digest('hex') !== EXPECT_SHA_STRUCT) { console.error('❌ structural.js 漂移'); process.exit(1); }

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

  console.log('===== ① S06 乙亥 己卯 己酉 丙寅 · getPattern 破格 reason =====');
  var p6 = getPattern(toBazi(['乙亥', '己卯', '己酉', '丙寅']));
  console.log('name: ' + p6.name + ' | status: ' + p6.status + ' | isEstablished: ' + p6.isEstablished);
  console.log('breakReasons:');
  (p6.breakReasons || []).forEach(function (r) { console.log('  - ' + r); });
  console.log('source: ' + p6.source);

  console.log('\n===== ② 从格判定明细（S04/S07/S08 + 对照 S02/S06） =====');
  [['S04', '壬子', '壬子', '丁酉', '辛亥'],
   ['S07', '庚申', '乙酉', '庚申', '乙酉'],
   ['S08', '丁巳', '乙巳', '辛亥', '甲午'],
   ['S02', '庚午', '甲申', '甲午', '癸酉'],
   ['S06', '乙亥', '己卯', '己酉', '丙寅']].forEach(function (d) {
    var c = getCongGe(toBazi(d.slice(1)));
    console.log(d[0] + ' ' + d.slice(1).join(' ') + ' → isCong: ' + c.isCong + (c.isCong ? ' | name: ' + c.name + ' | source: ' + c.source : '') + ' | ' + JSON.stringify(c));
  });

  console.log('\n===== ③ BND02 辛未 丁酉 丁亥 癸卯 · 杀重无制 evidence 明细 =====');
  var s = SA.evaluate(toBazi(['辛未', '丁酉', '丁亥', '癸卯']));
  s.structuralRisks.forEach(function (r) {
    if (r.type === '杀重无制') {
      console.log('type: ' + r.type + ' | severity: ' + r.severity);
      console.log('evidence: ' + r.evidence);
      console.log('partyEvidence: ' + JSON.stringify(r.partyEvidence));
    }
  });

  console.log('\n===== ④ S06 structuralRisks 全量（对照格局层张力） =====');
  var s6 = SA.evaluate(toBazi(['乙亥', '己卯', '己酉', '丙寅']));
  s6.structuralRisks.forEach(function (r) {
    console.log('[' + r.type + '](' + r.severity + ') ' + r.why);
  });

  console.log('\n===== ⑤ S08 两个节点受冲 severity 判定依据（位距/涉月令） =====');
  var s8 = SA.evaluate(toBazi(['丁巳', '乙巳', '辛亥', '甲午']));
  s8.structuralRisks.forEach(function (r) {
    if (r.type === '关键用神/格局节点受冲') console.log('(' + r.severity + ') ' + r.why);
  });
})().catch(function (e) { console.error('❌ ' + e.message); process.exit(1); });
