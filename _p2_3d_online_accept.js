// P4-A 线上最小验收（2026-08-14）：拉取 zhishi.online 实际部署的 js/bazi.js，
// 校验 sha256 === P4-A-EVID-01 后 merge blob 677a95f3...，再用线上字节在内存跑 7 盘硬断言。
var https = require('https');
var crypto = require('crypto');

var EXPECT_SHA = 'e3f9f67ada904819afd211d289991ade7712581be5d84ba74c923a522e3e21ab';

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
  var buf = await get('https://zhishi.online/js/bazi.js');
  var sha = crypto.createHash('sha256').update(buf).digest('hex');
  console.log('线上 sha256: ' + sha);
  if (sha !== EXPECT_SHA) { console.error('❌ 线上文件与 merge blob 不一致'); process.exit(1); }
  console.log('✅ 线上 js/bazi.js === merge blob 677a95f3…');

  global.window = global;
  global.document = {};
  var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
    return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
  }).join('\n');
  eval(buf.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
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

  var PINS = [
    ['P15-14', ['丙寅','庚寅','戊辰','癸亥'], '28 极弱 用土 喜土、火 忌木、水、金 食神制杀格·破格'],
    ['A5/H11', ['壬辰','癸卯','戊戌','丁巳'], '38 偏弱 用土 喜土、火 忌木、金、水 正官格·破格'],
    ['#6',     ['甲辰','丙寅','戊午','丁巳'], '62 偏强 用水 喜水、金、木 忌火、土 杀印相生格·成格'],
    ['#9',     ['甲子','丁卯','己未','庚午'], '51 中和 用木 喜木 忌空 杀印相生格·成格'],
    ['P15-20', ['壬午','癸卯','戊寅','乙卯'], '6 极弱 用火 喜火、土 忌木、金、水 正官格·破格'],
    ['P15-09', ['丁丑','癸卯','庚申','丙戌'], '47 中和 用土 喜土 忌空 正财格·破格'],   // 零漂移锚点：⑧½不命中（金囚非死令）
    ['P15-03', ['乙丑','戊寅','己巳','庚午'], '51 中和 用火 喜火、水 忌空 正官格·破格']  // A档不变锚点
  ];
  var fail = 0;
  PINS.forEach(function (p) {
    var r = row(p[1]);
    var got = r.score + ' ' + r.level + ' 用' + r.yong + ' 喜' + (r.xi || '空') + ' 忌' + (r.ji || '空') + ' ' + r.pattern;
    var ok = got === p[2];
    if (!ok) fail++;
    console.log((ok ? '✅' : '❌') + ' ' + p[0] + ' ' + p[1].join(' ') + ' | ' + got);
    if (!ok) console.log('   期望: ' + p[2]);
  });
  var rA5 = row(['壬辰','癸卯','戊戌','丁巳']);
  console.log('   从格: ' + rA5.cong);
  if (rA5.cong !== '否') { fail++; console.log('❌ A5 从格期望 否'); }
  console.log(fail === 0 ? '\n🎉 线上最小验收 7/7 通过' : '\n❌ 验收失败 ' + fail + ' 项');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) { console.error('❌ 网络/执行错误: ' + e.message); process.exit(1); });
