// 20 盲盘三项核验（2026-08-14）：GPT 生成 20 盲盘 → 冻结引擎（线上字节验证）算 身强身弱/格局/喜用忌 → 对照表。
// 方法同 QA harness：从 zhishi.online 拉取实际服务的 js 并 sha256 验证（= 网站专业解读页面同源代码），本地 eval 执行。
// 四柱不含性别/日期信息，旺衰/格局/喜用忌只由四柱决定（反查日期仅作构造载体，任意同四柱日期结果一致），性别按 male（不影响这三项）。
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var EXPECT_SHA_BAZI = '774f83bdfe20b94c11c99e7f2b7c63a5ca04434e569510c2aa7edd14e4100be6';
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

  // ---- 字节验证 + 引擎加载（= 网站线上同源代码） ----
  var bufBazi = await get('https://zhishi.online/js/bazi.js');
  var shaBazi = crypto.createHash('sha256').update(bufBazi).digest('hex');
  if (shaBazi !== EXPECT_SHA_BAZI) throw new Error('❌ 线上 bazi.js 漂移: ' + shaBazi);
  var bufStruct = await get('https://zhishi.online/js/structural.js');
  var shaStruct = crypto.createHash('sha256').update(bufStruct).digest('hex');
  if (shaStruct !== EXPECT_SHA_STRUCT) throw new Error('❌ 线上 structural.js 漂移: ' + shaStruct);
  var localChain = Buffer.from(fs.readFileSync(path.join(__dirname, 'js', 'bazi-chain.js'), 'utf8').replace(/\r\n/g, '\n'));
  var bufChain = await get('https://zhishi.online/js/bazi-chain.js');
  var shaChainL = crypto.createHash('sha256').update(localChain).digest('hex');
  var shaChainR = crypto.createHash('sha256').update(bufChain).digest('hex');
  if (shaChainL !== shaChainR) throw new Error('❌ 线上 bazi-chain.js ≠ 本地(LF): ' + shaChainR);
  console.log('✅ 字节零漂移：bazi.js / structural.js / bazi-chain.js（= 专业解读页面同源引擎）');

  global.window = global;
  global.document = {};
  var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
    return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
  }).join('\n');
  eval(bufBazi.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  eval(bufStruct.toString('utf8'));
  eval(bufChain.toString('utf8'));
  var ENG = global.BaZiCalculator;
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  console.log('✅ 引擎加载：BaZiCalculator / StructuralAnalysis / BaZiChain');

  // ---- 四柱 → 出生日期反查（同 QA harness；优先 1940-2010 在世成年人） ----
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

  // ---- 逐盘跑三项 ----
  var rows = [];
  for (var i = 0; i < DISKS.length; i++) {
    var disk = DISKS[i], id = disk[0], gz = disk.slice(1);
    var bd = findBirth(gz);
    if (!bd) {
      rows.push({ id: id, gz: gz.join(' '), birth: '反查失败', strength: '-', pattern: '-', status: '-', breaks: '-', yong: '-', xi: '-', ji: '-', cong: '-' });
      console.log('❌ ' + id + ' 反查出生日期失败');
      continue;
    }
    var bazi = ENG.calculate(bd.year, bd.month, bd.day, bd.hour, 'male', 0, 0);
    var ds, pt, yj, cg;
    try { ds = ENG.calcDayMasterStrength(bazi); } catch (e) { ds = null; }
    try { pt = ENG.getPattern(bazi); } catch (e) { pt = null; }
    try { yj = ENG.getYongJi(bazi); } catch (e) { yj = null; }
    try { cg = ENG.getCongGe(bazi); } catch (e) { cg = { isCong: false }; }
    var strength = ds ? ds.level + '(' + ds.score + ')' : '?';
    var pattern = pt ? pt.name : '?';
    var status = pt ? pt.status : '?';
    var breaks = (pt && pt.breakReasons && pt.breakReasons.length) ? pt.breakReasons.join('；') : '—';
    var yong = yj ? (yj.yongShen || []).join('') : '?';
    var xi = yj ? (yj.xiShen || []).join('') : '?';
    var ji = yj ? (yj.jiShen || []).join('') : '?';
    var congNote = cg && cg.isCong ? '从格·' + cg.name : '';
    rows.push({ id: id, gz: gz.join(' '), birth: bd.year + '-' + bd.month + '-' + bd.day, strength: strength, pattern: pattern, status: status, breaks: breaks, yong: yong, xi: xi, ji: ji, cong: congNote });
    console.log(id + ' ' + gz.join(' ') + ' [' + bd.year + '-' + bd.month + '-' + bd.day + '] 旺衰=' + strength + ' 格局=' + pattern + '·' + status + ' 用=' + yong + ' 喜=' + xi + ' 忌=' + ji + (congNote ? ' ' + congNote : ''));
  }

  // ---- 输出 md 表 + csv ----
  var md = '# 20 盲盘 · 网站三项（身强身弱 / 格局 / 喜用忌）引擎输出（2026-08-14）\n\n';
  md += '> 方法：从 zhishi.online 拉取线上服务的 bazi.js / structural.js / bazi-chain.js，sha256 与冻结值零漂移后本地执行（= 专业解读页面同源代码）。\n';
  md += '> 旺衰/格局/喜用忌只由四柱决定，反查出生日期仅作构造载体；性别不影响这三项（按 male）。\n';
  md += '> 供与 GPT 判断对照，差异盘交裁决。\n\n';
  md += '| 编号 | 四柱 | 反查出生 | 身强身弱 | 格局 | 状态 | 破格原因 | 用神 | 喜神 | 忌神 |\n|---|---|---|---|---|---|---|---|---|---|\n';
  rows.forEach(function (r) {
    md += '| ' + r.id + ' | ' + r.gz + ' | ' + r.birth + ' | ' + r.strength + ' | ' + r.pattern + ' | ' + r.status + ' | ' + r.breaks + ' | ' + r.yong + ' | ' + r.xi + ' | ' + r.ji + ' |\n';
  });
  fs.writeFileSync(path.join(OUT_DIR, '00-引擎三项.md'), md, 'utf8');
  var csv = '编号,四柱,反查出生,身强身弱,格局,状态,破格原因,用神,喜神,忌神\n';
  rows.forEach(function (r) {
    csv += [r.id, r.gz, r.birth, r.strength, r.pattern, r.status, r.breaks, r.yong, r.xi, r.ji].join(',') + '\n';
  });
  fs.writeFileSync(path.join(OUT_DIR, 'engine-three-items.csv'), csv, 'utf8');
  console.log('\n✅ 完成 ' + rows.length + ' 盘，已落盘 ' + OUT_DIR + '/00-引擎三项.md + engine-three-items.csv');
})().catch(function (e) {
  console.error('❌ 中止：' + e.message);
  process.exit(1);
});
