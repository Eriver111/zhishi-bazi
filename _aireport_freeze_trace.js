// AI 报告验证前置 trace（2026-08-14）：补取冒烟批 S04/S07/S08/BND02 的 pattern breakReasons + 从格明细，
// 作为 13 盘禁改清单的冻结基准。线上字节 sha 零漂移验证。只读不写。
var https = require('https');
var crypto = require('crypto');

var EXPECT_SHA_BAZI = 'b8e9ebaa8a9fcf6b20d63621020658084be9d98c403a1fbfaafd1b5ac37f3db2';
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
  console.log('✅ 字节零漂移确认');

  global.window = global;
  global.document = {};
  var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
    return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
  }).join('\n');
  eval(bufBazi.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  eval(bufStruct.toString('utf8'));

  function toBazi(gz) {
    return {
      year: { gan: gz[0][0], zhi: gz[0][1] },
      month: { gan: gz[1][0], zhi: gz[1][1] },
      day: { gan: gz[2][0], zhi: gz[2][1] },
      hour: { gan: gz[3][0], zhi: gz[3][1] }
    };
  }
  var DISKS = [
    ['S04', '壬子', '壬子', '丁酉', '辛亥'],
    ['S07', '庚申', '乙酉', '庚申', '乙酉'],
    ['S08', '丁巳', '乙巳', '辛亥', '甲午'],
    ['BND02', '辛未', '丁酉', '丁亥', '癸卯']
  ];
  DISKS.forEach(function (d) {
    var b = toBazi(d.slice(1));
    var pat = getPattern(b);
    var cong = getCongGe(b);
    console.log('== ' + d[0] + ' ' + d.slice(1).join(' ') + ' ==');
    console.log('pattern: ' + pat.name + '·' + pat.status + (pat.breakReasons && pat.breakReasons.length ? '\n  breakReasons: ' + pat.breakReasons.join('；') : ''));
    console.log('cong: ' + (cong.isCong ? cong.name : '否'));
  });
})().catch(function (e) { console.error('❌ ' + e.message); process.exit(1); });
