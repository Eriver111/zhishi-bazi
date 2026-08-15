// 20 盲盘差异审计辅助（2026-08-14）：对点名盘输出引擎完整判定细节（从格依据/格局成因/用神方法论/五行分布），
// 供 Claude 审计是否存在「多盘同机制新错误」。引擎 = 线上字节验证后的冻结 js（同 _blind20.js）。
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var EXPECT_SHA_BAZI = '677a95f39d017c4683f37be44de5a72ff1a92e8e6d34d822585a742cf108e37f';
var EXPECT_SHA_STRUCT = '96b8370dafc89453c1c63792f9f212934369d166682f8551f0f8d78984b5f8f7';
var OUT_DIR = path.join(__dirname, '_blind20');

var DISKS = [
  ['M01', '壬子', '壬子', '丁酉', '辛亥'],
  ['M02', '庚申', '乙酉', '庚申', '乙酉'],
  ['M03', '丁巳', '乙巳', '辛亥', '甲午'],
  ['M04', '辛未', '丁酉', '丁亥', '癸卯'],
  ['M05', '乙丑', '癸未', '庚辰', '丙子'],
  ['M06', '癸亥', '甲寅', '戊辰', '丁巳'],
  ['M07', '壬午', '癸丑', '庚寅', '壬午'],
  ['M08', '壬辰', '壬子', '甲午', '丙寅'],
  ['M09', '丁未', '丁未', '辛丑', '戊子'],
  ['M10', '甲子', '丁卯', '己亥', '庚午'],
  ['M11', '辛卯', '丁酉', '乙亥', '己卯'],
  ['M12', '戊辰', '丙辰', '壬戌', '庚戌'],
  ['M13', '丁亥', '己酉', '甲辰', '庚午'],
  ['M14', '戊午', '戊午', '甲戌', '庚午'],
  ['M15', '癸丑', '乙卯', '甲辰', '戊辰'],
  ['M16', '丙寅', '庚寅', '壬午', '戊申'],
  ['M17', '癸巳', '戊午', '丙戌', '壬辰'],
  ['M18', '乙亥', '己卯', '癸未', '丁巳'],
  ['M19', '庚辰', '戊子', '丙午', '壬辰'],
  ['M20', '壬申', '戊申', '甲寅', '丙寅']
];
var FLAGGED = ['M01', 'M03', 'M14', 'M04', 'M05', 'M11', 'M16', 'M19', 'M12', 'M17', 'M18', 'M20', 'M15', 'M02', 'M08', 'M09', 'M10', 'M06', 'M07', 'M13'];

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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  var bufBazi = await get('https://zhishi.online/js/bazi.js');
  var shaBazi = crypto.createHash('sha256').update(bufBazi).digest('hex');
  if (shaBazi !== EXPECT_SHA_BAZI) throw new Error('❌ 线上 bazi.js 漂移: ' + shaBazi);
  var bufStruct = await get('https://zhishi.online/js/structural.js');
  var shaStruct = crypto.createHash('sha256').update(bufStruct).digest('hex');
  if (shaStruct !== EXPECT_SHA_STRUCT) throw new Error('❌ 线上 structural.js 漂移: ' + shaStruct);
  var localChain = Buffer.from(fs.readFileSync(path.join(__dirname, 'js', 'bazi-chain.js'), 'utf8').replace(/\r\n/g, '\n'));
  var bufChain = await get('https://zhishi.online/js/bazi-chain.js');
  if (crypto.createHash('sha256').update(localChain).digest('hex') !== crypto.createHash('sha256').update(bufChain).digest('hex')) {
    throw new Error('❌ 线上 bazi-chain.js ≠ 本地(LF)');
  }
  console.log('✅ 字节零漂移，引擎已加载');

  global.window = global;
  global.document = {};
  var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
    return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
  }).join('\n');
  eval(bufBazi.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  var ENG = global.BaZiCalculator;
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';

  function findBirth(gz) {
    var hourIdx = ZHI.indexOf(gz[3][1]);
    var matches = [];
    for (var y = 1600; y <= 2048; y++) {
      var ypJan = ENG.calculate(y, 1, 15, 6, 'male', 0, 0).year;
      var ypJun = ENG.calculate(y, 6, 15, 6, 'male', 0, 0).year;
      if (ypJan.gan + ypJan.zhi !== gz[0] && ypJun.gan + ypJun.zhi !== gz[0]) continue;
      for (var m = 1; m <= 12; m++) {
        for (var d = 1; d <= 31; d++) {
          var b = ENG.calculate(y, m, d, hourIdx, 'male', 0, 0);
          if (b.year.gan + b.year.zhi === gz[0] && b.month.gan + b.month.zhi === gz[1] &&
              b.day.gan + b.day.zhi === gz[2] && b.hour.gan + b.hour.zhi === gz[3]) {
            matches.push({ year: y, month: m, day: d, hour: hourIdx });
          }
        }
      }
    }
    if (!matches.length) return null;
    function rank(b) {
      if (b.year >= 1940 && b.year <= 2010) return 0;
      if (b.year < 1940) return 1;
      return 2;
    }
    matches.sort(function (a, b2) {
      var r = rank(a) - rank(b2);
      if (r !== 0) return r;
      if (a.year !== b2.year) return b2.year - a.year;
      if (a.month !== b2.month) return a.month - b2.month;
      return a.day - b2.day;
    });
    return matches[0];
  }

  var all = {};
  for (var i = 0; i < DISKS.length; i++) {
    var disk = DISKS[i], id = disk[0], gz = disk.slice(1);
    var bd = findBirth(gz);
    if (!bd) { console.log('❌ ' + id + ' 反查失败'); continue; }
    var bazi = ENG.calculate(bd.year, bd.month, bd.day, bd.hour, 'male', 0, 0);
    var ds = null, pt = null, yj = null, cg = null;
    try { ds = ENG.calcDayMasterStrength(bazi); } catch (e) {}
    try { pt = ENG.getPattern(bazi); } catch (e) {}
    try { yj = ENG.getYongJi(bazi); } catch (e) {}
    try { cg = ENG.getCongGe(bazi); } catch (e) {}
    all[id] = {
      gz: gz.join(' '), birth: bd.year + '-' + bd.month + '-' + bd.day,
      wuXingCount: bazi.wuXingCount || null,
      strength: ds, pattern: pt, yongJi: yj, congGe: cg
    };
  }
  fs.writeFileSync(path.join(OUT_DIR, 'audit-detail.json'), JSON.stringify(all, null, 2), 'utf8');

  // ---- 精简打印（审计用） ----
  var WX_ORDER = ['木', '火', '土', '金', '水'];
  FLAGGED.forEach(function (id) {
    var d = all[id];
    console.log('\n========== ' + id + ' ' + d.gz + ' ==========');
    console.log('五行分布: ' + WX_ORDER.map(function (w) { return w + '=' + (d.wuXingCount ? d.wuXingCount[w] : '?'); }).join(' '));
    if (d.congGe) {
      var cg = d.congGe;
      console.log('从格: isCong=' + cg.isCong + ' name=' + (cg.name || '-') + ' source=' + (cg.source || '-'));
      if (cg.isCong) console.log('  从格喜: ' + (cg.xiOverride || []).join('、') + ' 从格忌: ' + (cg.jiOverride || []).join('、'));
    }
    if (d.strength) {
      var s = d.strength;
      console.log('旺衰: level=' + s.level + ' score=' + s.score + (s.label ? ' label=' + s.label : '') + (s.detail ? ' detail=' + s.detail : ''));
    }
    if (d.pattern) {
      var p = d.pattern;
      console.log('格局: name=' + p.name + ' type=' + (p.type || '-') + ' status=' + p.status + ' monthWx=' + (p.monthWx || '-'));
      if (p.breakReasons && p.breakReasons.length) console.log('  破格原因: ' + p.breakReasons.join('；'));
      if (p.establishConditions && p.establishConditions.length) {
        console.log('  成立条件: ' + p.establishConditions.map(function (c) { return (c.met ? '✅' : '❌') + c.condition; }).join(' | '));
      }
      console.log('  格局解读: ' + ((p.desc || '').slice(0, 120)));
    }
    if (d.yongJi) {
      var y = d.yongJi;
      console.log('用神: 用=' + (y.yongShen || []).join('、') + ' 喜=' + (y.xiShen || []).join('、') + ' 忌=' + (y.jiShen || []).join('、') + ' method=' + (y.method || '-'));
      console.log('  核心依据: ' + ((y.primaryReason || y.reasoning || '').slice(0, 200)));
      if (y.evidence && y.evidence.length) {
        y.evidence.slice(0, 5).forEach(function (e) { console.log('  证据: [' + e.category + '] ' + e.detail); });
      }
    }
  });
  console.log('\n✅ 明细已落盘 ' + OUT_DIR + '/audit-detail.json');
})().catch(function (e) {
  console.error('❌ 中止：' + e.message);
  process.exit(1);
});
