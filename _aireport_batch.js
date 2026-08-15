// AI 报告验证 · 同13盘回归（2026-08-14）：GPT 终裁三修复（context 剥除 / SYSTEM_PROMPT 事实锁 / V1 validator）后重跑
// 原13盘 = 冒烟3盘（S04/TH07/R01）+ 全量批9盘（S07/S08/BND02/BND04/PAT01/PAT07/TH01/R06/X04）+ PAT04 表达专项。
// 2026-08-15 P5-B(B4) 复跑：+1 盘 #61（己丑壬申丙午壬辰，B4 白名单验收盘）→ 14 盘；
// EXPECT_SHA_BAZI = P5-B 收口冻结 LF 774f83bd…（2026-08-15 一次性重钉，线上字节口径=git blob LF）。
// 2026-08-15 补跑支持：node _aireport_batch.js "PAT04,#61" 只跑指定盘（credits=2×盘数，覆盖 60s 超时双扣）；
// 客户端超时 60s→180s（生产服务端生成 >60s 时不再中途放弃重试，消除双保存/双扣噪声）。
// 通过门槛（GPT 终裁）：A层红线0、E1=0、E2=0、E3=0、E4=0，纯文风瑕疵可接受。
// B4 专项：机制行/候选对比/财→杀链进 context；#61 报告不得以「财生官」描述壬七杀关系。
// 纪律：AI 报告走线上网站真实调用（zhishi.online /api/ai-chat，生产 DeepSeek）；
// 本地离线仅用于构建与生产前端完全一致的 chartData（同一冻结引擎字节）。
// 流程：
//  ① sha 验证线上 bazi.js / structural.js（冻结字节）+ bazi-chain.js（与本地 LF 一致）
//  ② 由四柱反查出生日期（引擎自身 calculate 全匹配）→ 复刻 buildResultContext 生产逻辑
//  ③ 插入测试兑换码 AISMOKE03（credits=DISKS.length, channel=qa）→ 真实 POST /api/ai-chat（mode=pro, qa_debug）
//  ④ 每盘后查 supabase chat_history 验证报告保存（user/assistant 行、内容一致）+ 记录服务端 V1 validator warnings
//  ⑤ 验证扣减 13→0，最后删除测试码（chat_history 证据行保留并报告）
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var EXPECT_SHA_BAZI = '774f83bdfe20b94c11c99e7f2b7c63a5ca04434e569510c2aa7edd14e4100be6';
var EXPECT_SHA_STRUCT = '96b8370dafc89453c1c63792f9f212934369d166682f8551f0f8d78984b5f8f7';
var TEST_CODE = 'AISMOKE03';
var OUT_DIR = path.join(__dirname, '_aireport_regression');

var DISKS = [
  ['S04', '壬子', '壬子', '丁酉', '辛亥'],
  ['TH07', '丁未', '丁未', '辛丑', '戊子'],
  ['R01', '甲子', '丁卯', '己亥', '庚午'],
  ['S07', '庚申', '乙酉', '庚申', '乙酉'],
  ['S08', '丁巳', '乙巳', '辛亥', '甲午'],
  ['BND02', '辛未', '丁酉', '丁亥', '癸卯'],
  ['BND04', '乙丑', '癸未', '庚辰', '丙子'],
  ['PAT01', '癸亥', '甲寅', '戊辰', '丁巳'],
  ['PAT07', '壬午', '癸丑', '庚寅', '壬午'],
  ['TH01', '壬辰', '壬子', '甲午', '丙寅'],
  ['R06', '辛卯', '丁酉', '乙亥', '己卯'],
  ['X04', '戊辰', '丙辰', '壬戌', '庚戌'],
  ['PAT04', '丁亥', '己酉', '甲辰', '庚午'],
  ['#61', '己丑', '壬申', '丙午', '壬辰']
];
// 盘过滤（补跑支持）：node _aireport_batch.js "PAT04,#61" 只跑指定盘
if (process.argv[2]) {
  var idsArg = process.argv[2].split(',').map(function (s) { return s.trim(); });
  DISKS = DISKS.filter(function (d) { return idsArg.indexOf(d[0]) !== -1; });
  console.log('🎯 盘过滤：' + DISKS.map(function (d) { return d[0]; }).join('、') + '（' + DISKS.length + ' 盘）');
}
var QUESTION = '请根据我的排盘数据，为我做一份完整的命理分析报告，涵盖旺衰格局、喜用忌神、性格、事业、财运、婚姻、健康等方面。';

// ---- 环境 ----
var env = {};
fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(function (l) {
  var m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});
var supabaseJs = require('@supabase/supabase-js');
var db = supabaseJs.createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

// 生产 SYSTEM_PROMPT 逐字提取（本地 api/ai-chat.js == 线上，git diff api/ 为空；
// ${currentYear2} 在服务端模块加载时解析为北京时间的当前年份 2026）
var API_FILE = fs.readFileSync(path.join(__dirname, 'api', 'ai-chat.js'), 'utf8');
var mPrompt = API_FILE.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;\s*\r?\n\s*const ZIWEI_SYSTEM_PROMPT/);
if (!mPrompt) throw new Error('SYSTEM_PROMPT 提取失败');
var SYSTEM_PROMPT = mPrompt[1].replace(/\$\{currentYear2\}/g, '2026').replace(/\$\{currentGZ2\}/g, '丙午');

function get(url) {
  return new Promise(function (res, rej) {
    https.get(url, function (r) {
      var chunks = [];
      r.on('data', function (c) { chunks.push(c); });
      r.on('end', function () { res(Buffer.concat(chunks)); });
    }).on('error', rej);
  });
}
function postJson(url, body) {
  return new Promise(function (res, rej) {
    var data = Buffer.from(JSON.stringify(body));
    var req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, function (r) {
      var chunks = [];
      r.on('data', function (c) { chunks.push(c); });
      r.on('end', function () {
        res({ status: r.statusCode, text: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', rej);
    req.setTimeout(180000, function () { req.destroy(new Error('client timeout 180s')); });
    req.write(data);
    req.end();
  });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  var log = [];

  // ---- ① 字节验证 ----
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
  console.log('✅ 字节零漂移：bazi.js / structural.js / bazi-chain.js');

  // 等 Webhook 部署（服务器 60 秒轮询 + PM2 重启），给足 90 秒
  console.log('⏳ 等待 Webhook 部署新 api/ai-chat.js（90s）…');
  await sleep(90000);

  // ---- 引擎加载（与页面一致） ----
  global.window = global;
  global.document = {};
  var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
    return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
  }).join('\n');
  eval(bufBazi.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  eval(bufStruct.toString('utf8'));
  eval(bufChain.toString('utf8'));
  var ENG = global.BaZiCalculator;
  var SA = global.StructuralAnalysis;
  var CHAIN = global.BaZiChain;
  var WU_XING = ENG.WU_XING;
  var DI_ZHI_WU_XING = ENG.DI_ZHI_WU_XING;
  console.log('✅ 引擎加载：BaZiCalculator / StructuralAnalysis / BaZiChain');

  // ---- ② 四柱 → 出生日期反查 + chartData 复刻 ----
  var GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
  // 检索 1600-2048 全部匹配年，优先 1940-2010（在世成年人）→ <1940（先人）→ 2011+（未来，最后手段）。
  // 未来日期会与 SYSTEM_PROMPT"现在是2026年"冲突，污染 AI 忠实度判定，故仅作最后兜底；
  // 1900 前同理为装置兜底（如 S07/BND04/X04 唯一解在 1860s），逐盘记录，GPT 已有 S04 豁免先例。
  // 注意：年柱预筛必须同时看 1/15 与 6/15 —— 丑月（1 月，立春前）的四柱年柱属于上一年，
  // 只看 6/15 会漏掉丑月盘（PAT07 壬午癸丑庚寅壬午 真实解 2003-01-17 即因此被漏）。
  function findBirth(gz, gender) {
    var hourIdx = ZHI.indexOf(gz[3][1]);
    var matches = [];
    for (var y = 1600; y <= 2048; y++) {
      var ypJan = ENG.calculate(y, 1, 15, 6, gender, 0, 0).year;
      var ypJun = ENG.calculate(y, 6, 15, 6, gender, 0, 0).year;
      if (ypJan.gan + ypJan.zhi !== gz[0] && ypJun.gan + ypJun.zhi !== gz[0]) continue;
      for (var m = 1; m <= 12; m++) {
        for (var d = 1; d <= 31; d++) {
          var b = ENG.calculate(y, m, d, hourIdx, gender, 0, 0);
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
    // 同 rank 取最接近现代的年份（未来兜底除外），减少装置年代违和
    matches.sort(function (a, b2) {
      var r = rank(a) - rank(b2);
      if (r !== 0) return r;
      if (a.year !== b2.year) return b2.year - a.year;
      if (a.month !== b2.month) return a.month - b2.month;
      return a.day - b2.day;
    });
    console.log('  候选出生日期（全部）：' + matches.map(function (b) { return b.year + '-' + b.month + '-' + b.day; }).join(' / '));
    return matches[0];
  }

  // 生产 buildResultContext（js/ai-chat-integration.js L511-757）逐行复刻
  function buildChartData(gz, gender) {
    var bd = findBirth(gz, gender);
    if (!bd) throw new Error('反查出生日期失败: ' + gz.join(' '));
    var params = { year: bd.year, month: bd.month, day: bd.day, hour: bd.hour, gender: gender };
    var bazi = ENG.calculate(params.year, params.month, params.day, params.hour, params.gender, 0, 0);
    var daYun = ENG.calculateDaYun(bazi.month, bazi.year, params.gender, params.year, params.month, params.day, params.hour, 0);
    var shenShaRaw = ENG.calculateShenSha(bazi);
    var now = new Date();
    var currentYear = now.getFullYear();
    var currentDaYunIdx = daYun.list.findIndex(function (dy) {
      return currentYear >= dy.startYear && currentYear <= dy.endYear;
    });
    if (currentDaYunIdx < 0) currentDaYunIdx = 0;

    var data = {};
    // birthInfo（与 _params 一致；clock 未提供 → 不写入，与未填精确时间的真实用户一致）
    data.birthInfo = { year: params.year, month: params.month, day: params.day, hour: params.hour, gender: params.gender };
    // fourPillars（v3.2 藏干带十神）
    var dayGan = bazi.day.gan;
    data.fourPillars = {};
    ['year', 'month', 'day', 'hour'].forEach(function (pos) {
      var p = bazi[pos]; if (!p) return;
      var cgWithSS = (p.cangGan || []).map(function (cg) {
        var ss = '';
        try { ss = ENG.getShiShen(dayGan, cg); } catch (e) {}
        return { gan: cg, shiShen: ss };
      });
      data.fourPillars[pos] = { gan: p.gan, zhi: p.zhi, ganWX: p.wuXing ? p.wuXing.gan : '', zhiWX: p.wuXing ? p.wuXing.zhi : '', shiShenGan: p.shiShen ? p.shiShen.gan : '', shiShenZhi: p.shiShen ? p.shiShen.zhi : '', nayin: p.nayin || '', cangGan: cgWithSS };
    });
    if (bazi.wuXingCount) data.wuXingCount = bazi.wuXingCount;
    data.dayMaster = { gan: bazi.day.gan, wuXing: bazi.day.wuXing ? bazi.day.wuXing.gan : '' };
    data.dayMaster.yinYang = ['甲', '丙', '戊', '庚', '壬'].indexOf(bazi.day.gan) >= 0 ? '阳' : '阴';
    try { data.dayMasterStrength = ENG.calcDayMasterStrength(bazi); } catch (e) {}
    try { data.pattern = ENG.getPattern(bazi); } catch (e) {}
    try { data.yongJi = ENG.getYongJi(bazi); } catch (e) {}
    try { data.pillarRelations = ENG.getPillarRelations(bazi); } catch (e) {}
    try { data.branchRelations = ENG.getBranchRelations(bazi); } catch (e) {}
    try {
      var cs = ENG.getChangSheng(bazi.day.gan);
      data.changSheng = {};
      ['year', 'month', 'day', 'hour'].forEach(function (pos) {
        var z = bazi[pos].zhi;
        data.changSheng[pos] = cs[z] ? cs[z].stage : '?';
      });
    } catch (e) {}
    try { data.congGe = ENG.getCongGe(bazi); } catch (e) {}
    try { data.ganHe = ENG.getGanHe(bazi); } catch (e) {}
    try { data.sanHui = ENG.getSanHui(bazi); } catch (e) {}
    try { data.cangGanDepth = ENG.getCangGanDepth(bazi); } catch (e) {}
    // P3-A3 结构层
    try {
      var s = SA.evaluate(bazi);
      data.relationEvents = s.relationEvents;
      data.structuralRisks = s.structuralRisks;
    } catch (e) {}
    // 大运
    if (daYun && daYun.list) {
      data.daYun = { direction: daYun.isForward ? '顺行' : '逆行', startAge: daYun.qiYunAge, cycles: daYun.list.map(function (dy) { return { gan: dy.gan, zhi: dy.zhi, displayAge: dy.displayAge, startYear: dy.startYear, endYear: dy.endYear }; }) };
      var cd = daYun.list[currentDaYunIdx];
      if (cd) {
        try {
          data.currentDaYun = { gan: cd.gan, zhi: cd.zhi, startYear: cd.startYear, endYear: cd.endYear, displayAge: cd.displayAge, shiShen: ENG.getShiShen(bazi.day.gan, cd.gan) };
        } catch (e) {}
      }
    }
    // 当前流年/流月（与生产同逻辑：先 now 盘，再大运流年表补齐）
    data.currentYear = currentYear;
    try {
      var nowHour = now.getHours() + now.getMinutes() / 60;
      var nowShiChen = Math.floor(((now.getHours() + 1) % 24) / 2);
      var currentChart = ENG.calculate(now.getFullYear(), now.getMonth() + 1, now.getDate(), nowShiChen, 'male', nowHour, 0);
      if (currentChart && currentChart.year) {
        data.currentLiuNian = { year: now.getFullYear(), gan: currentChart.year.gan, zhi: currentChart.year.zhi, shiShen: ENG.getShiShen(bazi.day.gan, currentChart.year.gan) };
      }
      if (currentChart && currentChart.month) {
        data.currentLiuYue = { gan: currentChart.month.gan, zhi: currentChart.month.zhi };
      }
    } catch (e) {}
    if (daYun && daYun.list && currentDaYunIdx >= 0) {
      try {
        var cd2 = daYun.list[currentDaYunIdx];
        if (cd2) {
          var liuNianList = ENG.calculateLiuNian(cd2, bazi.day.gan);
          if (liuNianList) {
            var ln = null;
            for (var i = 0; i < liuNianList.length; i++) {
              if (liuNianList[i].year === currentYear) { ln = liuNianList[i]; break; }
            }
            if (!ln && liuNianList.length > 0) ln = liuNianList[0];
            if (ln) {
              if (!data.currentLiuNian) {
                data.currentLiuNian = { year: ln.year, gan: ln.gan, zhi: ln.zhi, shiShen: ln.shiShen || ENG.getShiShen(bazi.day.gan, ln.gan) };
              } else if (!data.currentLiuNian.shiShen) {
                data.currentLiuNian.shiShen = ln.shiShen || ENG.getShiShen(bazi.day.gan, data.currentLiuNian.gan);
              }
            }
          }
        }
      } catch (e) {}
    }
    if (shenShaRaw) data.shenSha = shenShaRaw.map(function (s) { return { name: s.name || s, type: s.type || '', desc: s.desc || '' }; });
    // v5.0 宫位远近（与生产完全一致的条件分支）
    try {
      var dgWx2 = bazi.day.wuXing ? bazi.day.wuXing.gan : '';
      var SHENGWO2 = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
      var KEWO2 = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' };
      var WOKE2 = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
      var yinWx = SHENGWO2[dgWx2], shaWx = KEWO2[dgWx2], caiWx = WOKE2[dgWx2];
      var mGanWx = bazi.month.gan ? WU_XING[bazi.month.gan] : '';
      var hGanWx = bazi.hour.gan ? WU_XING[bazi.hour.gan] : '';
      var yGanWx = bazi.year.gan ? WU_XING[bazi.year.gan] : '';
      var monthDesc = '月柱' + bazi.month.gan + bazi.month.zhi + '（提纲），';
      if (mGanWx === yinWx) monthDesc += '印星坐提纲，月令生身——得天时之助，贵人之地。';
      else if (mGanWx === dgWx2) monthDesc += '比劫当令，自身有力——根基稳固。';
      else if (mGanWx === shaWx) monthDesc += '官杀当令克身——压力重重，但若有制化反成权威。';
      else if (mGanWx === caiWx) monthDesc += '财星当令耗身——求财心切，但需身强方能担财。';
      else monthDesc += '食伤当令泄秀——才华外露，创意旺盛。';
      var hourDesc = '时柱' + bazi.hour.gan + bazi.hour.zhi + '（归息），';
      if (hGanWx === yinWx) hourDesc += '晚岁得印星庇护——老来有靠，福泽绵长。';
      else if (hGanWx === dgWx2) hourDesc += '比劫归时——晚运平稳，自力更生。';
      else if (hGanWx === shaWx) hourDesc += '晚年仍有压力——需防健康，宜早作安排。';
      else if (hGanWx === caiWx) hourDesc += '晚岁财星——老来财运，但须身强。';
      else hourDesc += '晚年食伤——儿孙缘厚，晚年享乐。';
      var yearDesc = '年柱' + bazi.year.gan + bazi.year.zhi + '（祖业），';
      if (yGanWx === yinWx) yearDesc += '祖上印星——家学渊源，长辈庇护。';
      else if (yGanWx === shaWx) yearDesc += '祖上官杀——家规严苛或祖上有权威传承。';
      else if (yGanWx === caiWx) yearDesc += '祖上财星——家底殷实，但自身需能守成。';
      else yearDesc += '祖业一般，需自身奋斗。';
      var summary = '';
      if (mGanWx === yinWx) summary += '提纲为印生身，得月令天时之利；';
      if (mGanWx === shaWx && hGanWx === yinWx) summary += '提纲官杀制身但归息印星解围——先难后易之命；';
      if (mGanWx === shaWx && hGanWx !== yinWx) summary += '提纲官杀攻身无印化解——一生压力随身；';
      data.palaceAnalysis = { monthDesc: monthDesc, hourDesc: hourDesc, yearDesc: yearDesc, summary: summary || '各宫位分布均衡，无特殊宫位偏颇。' };
    } catch (e) {}
    // v5.0 大运联动
    if (daYun && daYun.list) {
      try {
        if (CHAIN && CHAIN.analyzeFortune) {
          var yj = data.yongJi;
          var dyList = daYun.list.map(function (dy) { return { gan: dy.gan, zhi: dy.zhi, displayAge: dy.displayAge, startYear: dy.startYear, endYear: dy.endYear }; });
          data.fortuneAnalysis = CHAIN.analyzeFortune(bazi, dyList, yj);
        }
      } catch (e) {}
    }
    // v5.2 日支专项
    try {
      if (ENG.analyzeDayBranch) data.dayBranchAnalysis = ENG.analyzeDayBranch(bazi);
    } catch (e) {}
    // v5.2 流年三方互动
    if (data.currentDaYun && data.currentLiuNian) {
      try {
        if (CHAIN && CHAIN.analyzeLiuNian) {
          var yj2 = data.yongJi;
          data.liuNianAnalysis = CHAIN.analyzeLiuNian(bazi, data.currentDaYun, data.currentLiuNian, yj2);
        }
      } catch (e) {}
    }
    data._foundBirth = bd;
    return data;
  }

  // ---- 服务器 buildSingleChart 上下文复刻（api/ai-chat.js L637-916，用于展示实际发送的 context） ----
  function buildChartContext(data) {
    var ctx = '';
    if (data.birthInfo) {
      var b = data.birthInfo;
      ctx += '出生：' + b.year + '年' + b.month + '月' + b.day + '日 ' + b.hour + '时';
      if (b.gender) ctx += ' 性别：' + (b.gender === 'male' ? '男' : '女');
      ctx += '\n';
    }
    if (data.fourPillars) {
      var labels = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
      ctx += '\n四柱排盘：\n';
      Object.keys(labels).forEach(function (pos) {
        var p = data.fourPillars[pos];
        if (!p) return;
        ctx += '  ' + labels[pos] + '：' + (p.gan || '?') + (p.zhi || '?');
        if (p.ganWX) ctx += ' [' + p.ganWX + ']';
        if (p.shiShenGan) ctx += ' 天干十神：' + p.shiShenGan;
        if (p.shiShenZhi) ctx += ' 地支十神：' + p.shiShenZhi;
        if (p.nayin) ctx += ' 纳音：' + p.nayin;
        if (p.cangGan && p.cangGan.length) {
          ctx += ' 藏干：' + p.cangGan.map(function (c) { return c.gan + (c.shiShen ? '(' + c.shiShen + ')' : ''); }).join('、');
        }
        ctx += '\n';
      });
    }
    if (data.dayMaster) {
      var dm = data.dayMaster;
      ctx += '\n日主：' + (dm.gan || '?') + '(' + (dm.wuXing || '') + (dm.yinYang || '') + ')';
      if (data.dayMasterStrength && data.dayMasterStrength.level) ctx += ' 旺衰：' + data.dayMasterStrength.level;
      ctx += '\n';
    }
    if (data.wuXingCount) {
      var wx = data.wuXingCount;
      ctx += '五行分布：金' + (wx['金'] || 0) + ' 木' + (wx['木'] || 0) + ' 水' + (wx['水'] || 0) + ' 火' + (wx['火'] || 0) + ' 土' + (wx['土'] || 0) + '\n';
    }
    if (data.dayMasterStrength) {
      var ds = data.dayMasterStrength;
      ctx += '\n【排盘结构化数据】日主旺衰评定：' + (ds.level || '?') + '（评分 ' + (ds.score !== undefined && ds.score !== null ? ds.score : '?') + '，' + (ds.label || '') + '）。请以此为本次解读口径，不另行编造分数或替换强弱等级。\n';
    }
    if (data.congGe && data.congGe.isCong) {
      ctx += '\n⚠从格判定：' + data.congGe.name + '（' + (data.congGe.source || '') + '）\n';
      ctx += '  解读：' + data.congGe.desc + '\n';
      ctx += '  喜：' + (data.congGe.xiOverride || []).join('、') + ' 忌：' + (data.congGe.jiOverride || []).join('、') + '\n';
    }
    if (data.pattern) {
      var pt = data.pattern;
      ctx += '命局格局：' + (pt.name || '?');
      if (pt.type) ctx += '（' + pt.type + '类）';
      if (pt.monthWx) ctx += ' 月令五行：' + pt.monthWx;
      if (pt.status) ctx += '\n格局状态：' + pt.status;
      // P5-B(B4) 格局机制（与线上 buildSingleChart 同步，证据文件须与服务器实际发送一致）
      if (pt.mechanism) ctx += '\n格局机制：' + pt.mechanism;
      if (pt.breakReasons && pt.breakReasons.length) ctx += '\n破格原因：' + pt.breakReasons.join('；');
      if (pt.establishConditions && pt.establishConditions.length) {
        ctx += '\n格局成立条件清单：\n';
        pt.establishConditions.forEach(function (c) {
          ctx += '  ' + (c.met ? '✅' : '❌') + ' ' + c.condition + (c.detail ? ' —— ' + c.detail : '') + '\n';
        });
      }
      ctx += '\n格局解读：' + (pt.desc || '') + '\n';
    }
    if (data.yongJi) {
      var yj = data.yongJi;
      ctx += '\n喜用忌神分析：\n';
      ctx += '  用神：' + ((yj.yongShen || []).join('、') || '—') + '\n';
      ctx += '  喜神：' + ((yj.xiShen || []).join('、') || '—') + '\n';
      ctx += '  忌神：' + ((yj.jiShen || []).join('、') || '—') + '\n';
      ctx += '  取用方法：' + (yj.method || '—') + '\n';
      ctx += '  核心依据：' + (yj.primaryReason || yj.reasoning || '') + '\n';
      if (yj.evidence && yj.evidence.length) {
        ctx += '  判定证据：\n';
        yj.evidence.forEach(function (item) { ctx += '    - ' + item.category + '：' + item.detail + '\n'; });
      }
      if (yj.elementReasons) {
        ctx += '  五行归类理由：\n';
        Object.keys(yj.elementReasons).forEach(function (wx2) {
          var item = yj.elementReasons[wx2];
          ctx += '    - ' + item.role + '·' + wx2 + '：' + ((item.reasons || []).join('；')) + '\n';
        });
      }
      if (yj.chainHints && yj.chainHints.length) {
        ctx += '  生克链分析：\n';
        yj.chainHints.forEach(function (h) {
          ctx += '    - [' + (h.type || 'info') + '] ' + (h.category || '') + '：' + (h.text || '') + '\n';
        });
      }
      if (yj.chainAdjustments && yj.chainAdjustments.length) {
        ctx += '  生克链修正：\n';
        yj.chainAdjustments.forEach(function (a) {
          ctx += '    - [' + a.action + '] ' + (a.wx || '') + '：' + (a.reason || '') + '\n';
        });
      }
      if (yj.yongShenQuality) {
        ctx += '  用神真假评估：\n';
        Object.keys(yj.yongShenQuality).forEach(function (wx2) {
          var q = yj.yongShenQuality[wx2];
          ctx += '    - ' + wx2 + '：' + q.quality + '（根气得分' + q.score + '）\n';
          if (q.roots && q.roots.length) ctx += '      根气详情：' + q.roots.join('；') + '\n';
        });
      }
    }
    if (data.relationEvents && Array.isArray(data.relationEvents) && data.relationEvents.length) {
      ctx += '\n四柱关系事件（事实层枚举）：\n';
      data.relationEvents.forEach(function (e) {
        ctx += '  - ' + e.type + '：' + e.pillars.join('+') + '（' + (e.elements || []).join('') + '）' + (e.involvesMonth || e.involvesDay ? '，涉月令/日支' : '') + '\n';
      });
    }
    if (data.structuralRisks && Array.isArray(data.structuralRisks) && data.structuralRisks.length) {
      ctx += '\n条件性结构风险（解释层；severity 仅存在/潜在；不是喜用忌结论，不得据此把风险元素解释成忌神）：\n';
      data.structuralRisks.forEach(function (r) {
        ctx += '  - ' + r.type + '[' + r.severity + ']：' + r.parties + '。' + r.why + '。缓解：' + (r.mitigations || '无') + '。' + r.triggerHint + ' 结构显现：' + (r.partyEvidence || '') + '\n';
      });
    }
    if (data.pillarRelations && data.pillarRelations.length) {
      ctx += '\n四柱相邻生克关系：\n';
      data.pillarRelations.forEach(function (rel) {
        ctx += '  ' + rel.from + ' → ' + rel.to + '：天干' + rel.gan + '，地支' + rel.zhi + '\n';
        if (rel.details && rel.details.length) {
          rel.details.forEach(function (d) { ctx += '    - ' + d + '\n'; });
        }
      });
    }
    if (data.palaceAnalysis) {
      var pa = data.palaceAnalysis;
      ctx += '\n宫位远近分析：\n';
      ctx += '  提纲(月柱)：' + (pa.monthDesc || '—') + '\n';
      ctx += '  归息(时柱)：' + (pa.hourDesc || '—') + '\n';
      ctx += '  祖业(年柱)：' + (pa.yearDesc || '—') + '\n';
      ctx += '  宫位解读：' + (pa.summary || '无特殊宫位影响') + '\n';
    }
    // GPT终裁 2026-08-14：relationEvents 有涉日支事件时，夫妻宫综合行不得再带"无冲合刑害"否定语（与线上 ai-chat.js 一致）
    var dayHasRelation = false;
    if (data.relationEvents && Array.isArray(data.relationEvents)) {
      data.relationEvents.forEach(function (e) {
        if (e.involvesDay || (e.pillars && Array.isArray(e.pillars) && e.pillars.indexOf('day') >= 0)) dayHasRelation = true;
      });
    }
    if (data.dayBranchAnalysis) {
      var dba = data.dayBranchAnalysis;
      ctx += '\n日支（夫妻宫）专项分析：\n';
      ctx += '  日支' + dba.branch + '（' + dba.wuXing + '），' + dba.mainShiShen + '——' + (dba.ssDesc || '') + '\n';
      ctx += '  日主根气：' + dba.rootType + '（根气分' + dba.rootScore + '）\n';
      if (dba.interactions && dba.interactions.length) {
        ctx += '  日支互动：\n';
        dba.interactions.forEach(function (ix) {
          ctx += '    - ' + ix.type + '·' + ix.with + '：' + ix.detail + '\n';
        });
      }
      ctx += '  稳定度：' + dba.stability + '\n';
      if (dba.heRole) ctx += '  三合角色：' + dba.heRole + '\n';
      if (dba.huiRole) ctx += '  三会角色：' + dba.huiRole + '\n';
      if (dba.cangGan && dba.cangGan.length) {
        ctx += '  藏干详析：' + dba.cangGan.map(function (c) { return c.level + c.gan + '(' + c.shiShen + ')' + '——' + c.desc; }).join(' | ') + '\n';
      }
      var dbaSummary = dba.summary || '';
      if (dayHasRelation) {
        dbaSummary = dbaSummary
          .replace(/无冲合刑害[。；;]*/g, '')
          .replace(/无冲、?无合[。；;]*/g, '')
          .replace(/；；+/g, '；')
          .replace(/。；/g, '；')
          .replace(/^；+/, '')
          .trim();
        if (!dbaSummary) dbaSummary = '日支关系以四柱关系事件表为准';
      }
      ctx += '  综合：' + dbaSummary + '\n';
    }
    if (data.liuNianAnalysis) {
      var lna = data.liuNianAnalysis;
      ctx += '\n流年' + lna.liuNianGan + lna.liuNianZhi + '三方互动分析：\n';
      ctx += '  判词：' + lna.verdict + '（凶兆分' + (lna.dangerScore || 0) + '，吉兆分' + (lna.opportunityScore || 0) + '）\n';
      if (lna.triggers && lna.triggers.length) {
        lna.triggers.forEach(function (tr) {
          ctx += '  ' + (tr.isGood ? '✅' : '⚠') + ' [' + tr.severity + '] ' + tr.type + '：' + tr.detail + '\n';
        });
      }
      ctx += '  总结：' + lna.summary + '\n';
    }
    if (data.daYun) {
      var dy = data.daYun;
      ctx += '\n大运（' + (dy.direction || '') + '，' + (dy.startAge ? dy.startAge + '岁起运' : '') + '）：\n';
      if (dy.cycles && dy.cycles.length) {
        dy.cycles.forEach(function (c) {
          ctx += '  ' + (c.displayAge !== undefined ? c.displayAge : c.startYear) + '岁：' + (c.gan || '?') + (c.zhi || '?');
          if (c.startYear) ctx += ' ' + c.startYear + '-' + c.endYear + '年';
          ctx += '\n';
        });
      }
    }
    if (data.fortuneAnalysis) {
      var fa = data.fortuneAnalysis;
      ctx += '\n大运喜用忌联动分析：\n';
      ctx += '  ' + (fa.summary || '') + '\n';
      if (fa.periods && fa.periods.length) {
        fa.periods.forEach(function (p) {
          ctx += '  ' + p.gan + p.zhi + '（' + (p.age !== undefined ? p.age : p.startYear) + '-' + (p.endYear || '') + '岁）：';
          ctx += '天干' + p.ganWx + '为' + p.ganRole + '，地支' + p.zhiWx + '为' + p.zhiRole;
          ctx += ' → 综合判定：' + p.verdict;
          if (p.interactions && p.interactions.length) {
            ctx += ' [' + p.interactions.map(function (i) { return i.text; }).join('；') + ']';
          }
          ctx += '\n';
          ctx += '    运程：' + p.summary + '\n';
        });
      }
    }
    if (data.shenSha && data.shenSha.length) {
      ctx += '\n神煞：' + data.shenSha.map(function (s) { return s.name + (s.type ? '(' + s.type + ')' : ''); }).join('、') + '\n';
    }
    if (data.branchRelations && data.branchRelations.length) {
      ctx += '\n四柱地支冲合刑害：\n';
      data.branchRelations.forEach(function (br) {
        ctx += '  ' + br.from + br.branch1 + ' ←→ ' + br.to + br.branch2 + '：';
        ctx += br.relations.map(function (r) { return r.type; }).join('、');
        ctx += '\n';
        br.relations.forEach(function (r) { ctx += '    - ' + r.detail + '\n'; });
      });
    }
    var nowYear = data.currentYear || new Date().getFullYear();
    ctx += '\n当前时间：' + nowYear + '年\n';
    if (data.currentDaYun) {
      var cdy = data.currentDaYun;
      ctx += '当前大运：' + cdy.gan + cdy.zhi + '（' + (cdy.shiShen || '') + '）' + cdy.startYear + '-' + cdy.endYear + '年 ' + cdy.displayAge + '岁\n';
    }
    if (data.currentLiuNian) {
      var ln = data.currentLiuNian;
      ctx += '当前流年：' + ln.gan + ln.zhi + '（' + (ln.shiShen || '') + '）' + ln.year + '年\n';
      if (data.currentDaYun && data.currentDaYun.shiShen) {
        ctx += '  注意：当前行' + data.currentDaYun.shiShen + '大运，遇' + (ln.shiShen || ln.gan + ln.zhi) + '流年——需结合大运流年与原局关系综合判断吉凶。\n';
      }
    }
    if (data.changSheng) {
      ctx += '\n日主十二长生：\n';
      var labels2 = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
      Object.keys(labels2).forEach(function (pos) {
        if (data.changSheng[pos]) ctx += '  ' + labels2[pos] + '：' + data.changSheng[pos] + '\n';
      });
    }
    if (data.ganHe && data.ganHe.length) {
      ctx += '\n天干五合：\n';
      data.ganHe.forEach(function (h) { ctx += '  ' + h.desc + '\n'; });
    }
    if (data.sanHui && data.sanHui.length) {
      ctx += '\n地支三会：\n';
      data.sanHui.forEach(function (h) { ctx += '  ' + h.desc + '\n'; });
    }
    return ctx;
  }

  // ---- 真实 messages 数组复刻（api/ai-chat.js callAI，mode=pro 分支，history=[]） ----
  function chinaNow() {
    var d = new Date(Date.now() + 8 * 3600 * 1000);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }
  function buildMessages(chartData, question) {
    var msgs = [{ role: 'system', content: SYSTEM_PROMPT }];
    var cn = chinaNow();
    var timeAnchor = '当前时间（中国标准时间）：' + cn.y + '年' + cn.mo + '月' + cn.day + '日。';
    if (chartData.currentLiuNian && chartData.currentLiuNian.gan && chartData.currentLiuNian.zhi) {
      timeAnchor += '当前流年为' + chartData.currentLiuNian.gan + chartData.currentLiuNian.zhi + '年，该字段由排盘端计算。';
    } else {
      timeAnchor += '未提供 currentLiuNian 时，不得按公历年直接猜立春前的流年干支。';
    }
    if (chartData.currentLiuYue && chartData.currentLiuYue.gan && chartData.currentLiuYue.zhi) {
      timeAnchor += '当前节气流月为' + chartData.currentLiuYue.gan + chartData.currentLiuYue.zhi + '月，该字段由排盘端精确计算。';
    } else {
      timeAnchor += '未提供精确流月字段，不得按固定公历日期自行猜流月干支。';
    }
    msgs.push({ role: 'system', content: timeAnchor });
    msgs.push({ role: 'system', content: '本轮使用**专业模式**。使用标准命理术语，可引经典并注明出处，结构清晰可加分点，深入推演生克冲合，最后注明"命理分析仅供参考"。' });
    msgs.push({ role: 'system', content: '以下是用户的完整八字排盘数据。请严格基于这些数据回答，不得自行改盘：\n\n' + buildChartContext(chartData) });
    var lock2 = '【排盘事实锁】';
    if (chartData.dayMasterStrength) lock2 += '日主旺衰=「' + chartData.dayMasterStrength.level + '（' + chartData.dayMasterStrength.score + '）」';
    if (chartData.pattern) {
      lock2 += (lock2.length > 10 ? '，' : '') + '候选格局=「' + chartData.pattern.name + '」，状态=「' + (chartData.pattern.status || '未确认') + '」';
      if (chartData.pattern.breakReasons && chartData.pattern.breakReasons.length) lock2 += '，原因=「' + chartData.pattern.breakReasons.join('；') + '」';
    }
    if (lock2.length > 10) { lock2 += '。以上字段不另行重算；破格不得写成已成格；旺衰档位、格局状态、risk severity 均为冻结标签，禁止近义词换级。'; msgs.push({ role: 'system', content: lock2 }); }
    msgs.push({ role: 'user', content: question });
    return msgs;
  }

  // ---- ③ 插入测试兑换码 ----
  var nowIso = new Date().toISOString();
  var { error: insErr } = await db.from('user_credits').upsert({
    code: TEST_CODE, order_id: 'qa-report-batch-20260815', credits: DISKS.length * 2, total_used: 0,
    created_at: nowIso, updated_at: nowIso, channel: 'qa'
  }, { onConflict: 'code' });
  if (insErr) throw new Error('插入测试码失败: ' + insErr.message);
  console.log('✅ 测试兑换码 ' + TEST_CODE + '（credits=' + DISKS.length * 2 + '）已插入');
  // 清理中止运行可能残留的 chat_history 行，保证行数断言从 0 起
  var { error: purgeErr } = await db.from('chat_history').delete().neq('id', -1).eq('code', TEST_CODE);
  if (purgeErr) console.log('⚠ chat_history 残留清理失败: ' + purgeErr.message);
  else console.log('✅ chat_history 残留已清理（本轮从 0 行起）');

  // ---- ④ 逐盘真实调用 ----
  try {
    for (var di = 0; di < DISKS.length; di++) {
      var disk = DISKS[di], id = disk[0], gz = disk.slice(1);
      console.log('\n========== ' + id + ' ' + gz.join(' ') + ' ==========');

      var chartData = buildChartData(gz, 'male');
      var bd = chartData._foundBirth; delete chartData._foundBirth;
      console.log('反查出生：' + bd.year + '-' + bd.month + '-' + bd.day + ' 时辰idx=' + bd.hour);
      console.log('旺衰：' + chartData.dayMasterStrength.level + ' ' + chartData.dayMasterStrength.score +
        ' ｜ 格局：' + chartData.pattern.name + '·' + chartData.pattern.status +
        ' ｜ 用神：' + chartData.yongJi.yongShen.join('、') +
        ' ｜ 喜：' + chartData.yongJi.xiShen.join('、') +
        ' ｜ 忌：' + chartData.yongJi.jiShen.join('、') +
        ' ｜ risks：' + chartData.structuralRisks.length + ' 条');

      // 落盘 chartData + 上下文复刻 + 完整 messages 数组复刻
      var ctx = buildChartContext(chartData);
      var msgs = buildMessages(chartData, QUESTION);
      fs.writeFileSync(path.join(OUT_DIR, id + '-chartdata.json'), JSON.stringify(chartData, null, 2), 'utf8');
      fs.writeFileSync(path.join(OUT_DIR, id + '-context.txt'), ctx, 'utf8');
      var msgsMd = '# ' + id + ' · 实际发送给模型的完整 messages 数组（复刻 api/ai-chat.js callAI，mode=pro，history=[]）\n\n';
      msgsMd += '> fetch body: { model: "deepseek-v4-flash", thinking: {type:"disabled"}, temperature: 0.7, max_tokens: 4096, stream: false }，180 秒客户端超时（req.setTimeout）。\n';
      msgsMd += '> SYSTEM_PROMPT 为服务端加载时逐字内容（\\${currentYear2} 已解析为 2026）。\n\n';
      msgs.forEach(function (mg, i) {
        msgsMd += '---\n\n### message[' + i + '] · ' + mg.role + '\n\n```\n' + mg.content + '\n```\n\n';
      });
      fs.writeFileSync(path.join(OUT_DIR, id + '-messages.md'), msgsMd, 'utf8');

      // 真实调用（最多 3 次尝试；生产同款失败不扣次数语义）
      var resp = null, reply = null;
      for (var attempt = 1; attempt <= 3; attempt++) {
        try {
          resp = await postJson('https://zhishi.online/api/ai-chat', {
            question: QUESTION, chartData: chartData, history: [], mode: 'pro', code: TEST_CODE, qa_debug: true
          });
          var parsed = JSON.parse(resp.text);
          if (resp.status === 200 && parsed.reply) { reply = parsed; break; }
          if (resp.status === 403) { reply = parsed; break; }
          console.log('  尝试 ' + attempt + ' 失败（HTTP ' + resp.status + '）：' + (parsed.error || resp.text).slice(0, 120));
          await sleep(15000);
        } catch (e) {
          console.log('  尝试 ' + attempt + ' 异常：' + e.message);
          await sleep(15000);
        }
      }
      if (!reply) throw new Error(id + ' 3 次调用均失败');
      if (reply.error) {
        fs.writeFileSync(path.join(OUT_DIR, id + '-report.md'), '## ' + id + ' 调用失败\n\n' + JSON.stringify(reply, null, 2) + '\n', 'utf8');
        console.log('❌ ' + id + ' 调用失败：' + reply.error);
        log.push({ id: id, status: 'FAILED', error: reply.error });
        continue;
      }
      fs.writeFileSync(path.join(OUT_DIR, id + '-report.md'), '## ' + id + ' · AI 报告原文（线上真实调用，mode=pro）\n\n### 请求\n\n- 问题：' + QUESTION + '\n- history：[]（新会话首问）\n- 兑换码：' + TEST_CODE + '\n\n### AI 回复（' + new Date().toISOString() + '）\n\n' + reply.reply + '\n', 'utf8');
      if (!Array.isArray(reply.validation_warnings)) {
        throw new Error(id + ' 响应缺 validation_warnings 字段——线上 ai-chat.js 未部署新代码，请等待后重跑');
      }
      var vw = reply.validation_warnings || [];
      if (vw.length) {
        fs.appendFileSync(path.join(OUT_DIR, id + '-report.md'), '\n### V1 validator warnings（qa_debug 透出；服务端仅检测、不修改正文）\n\n' + vw.map(function (x) { return '- ' + x; }).join('\n') + '\n', 'utf8');
      } else {
        fs.appendFileSync(path.join(OUT_DIR, id + '-report.md'), '\n### V1 validator warnings\n\n（无）\n', 'utf8');
      }
      console.log('✅ ' + id + ' AI 回复已抓取（' + reply.reply.length + ' 字符，credits_left=' + reply.credits_left + '，validator warnings=' + vw.length + '）');

      // 验证 DB 保存
      var { data: rows, error: chErr } = await db.from('chat_history').select('role,content,created_at').eq('code', TEST_CODE).order('created_at', { ascending: true });
      if (chErr) throw new Error('chat_history 查询失败: ' + chErr.message);
      var expectRows = (di + 1) * 2;
      var savedAssistant = rows.filter(function (r) { return r.role === 'assistant'; });
      var last = savedAssistant[savedAssistant.length - 1];
      var savedOk = rows.length === expectRows && last && last.content === reply.reply;
      console.log((savedOk ? '✅' : '❌') + ' chat_history 保存验证：期望 ' + expectRows + ' 行，实际 ' + rows.length + ' 行；assistant 内容与回复' + (last && last.content === reply.reply ? '一致' : '不一致'));
      log.push({ id: id, status: 'OK', replyLen: reply.reply.length, creditsLeft: reply.credits_left, dbRows: rows.length, dbSaved: savedOk, birth: bd, vw: vw.length });

      await sleep(5000);
    }
  } finally {
    // ---- ⑤ 扣减终态 + 清理测试码 ----
    var { data: finalCred } = await db.from('user_credits').select('credits,total_used').eq('code', TEST_CODE).single();
    console.log('\n测试码终态：credits=' + (finalCred ? finalCred.credits : '?') + ' total_used=' + (finalCred ? finalCred.total_used : '?') + '（期望 0 / ' + DISKS.length + '）');
    var { error: delErr } = await db.from('user_credits').delete().eq('code', TEST_CODE);
    console.log('测试码清理：' + (delErr ? '❌ ' + delErr.message : '✅ 已删除（chat_history 证据行保留）'));
  }

  // ---- 汇总 ----
  var sum = '# AI 报告回归汇总（2026-08-15，P5-B(B4) AI context 接入后，' + DISKS.length + ' 盘）\n\n';
  sum += '> 线上真实调用 zhishi.online /api/ai-chat（生产 DeepSeek，model 由服务端钉死），mode=pro，新会话首问（history=[]），qa_debug 透出 V1 validator warnings。\n';
  sum += '> 测试兑换码 AISMOKE03（qa 专用，' + DISKS.length + ' 次额度），调用完成后已删除；chat_history 证据行保留（code=AISMOKE03）。\n';
  sum += '> 通过门槛（GPT 终裁）：A层 14/14 红线 0；E1=0、E2=0、E3=0、E4=0；纯文风瑕疵可接受。\n';
  sum += '> 性别：统一男命（乾造）。盲测盘未定义性别，大运顺逆按乾造计算。\n';
  sum += '> 出生日期：50 盘盲测只冻结四柱；出生日期由引擎四柱反查合成（优先 1940-2010 在世年，其次 1900-1939，未来年份仅兜底），供大运/流年做生产级计算。\n';
  sum += '> PAT04 为表达专项（第 13 盘），成绩单列、不计入 13 盘正式通过率。#61 为 B4 白名单验收盘。\n\n';
  sum += '| 盘 | 状态 | 回复长度 | 剩余额度 | DB行数 | 保存一致 | validator |\n|---|---|---|---|---|---|---|\n';
  log.forEach(function (l) {
    sum += '| ' + l.id + ' | ' + l.status + ' | ' + (l.replyLen || '-') + ' | ' + (l.creditsLeft !== undefined ? l.creditsLeft : '-') + ' | ' + (l.dbRows || 0) + ' | ' + (l.dbSaved === undefined ? '-' : (l.dbSaved ? '✅' : '❌')) + ' | ' + (l.vw === undefined ? '-' : l.vw) + ' |\n';
  });
  fs.writeFileSync(path.join(OUT_DIR, '00-summary.md'), sum, 'utf8');
  console.log('\n✅ 汇总已落盘 ' + OUT_DIR + '/00-summary.md');
})().catch(function (e) {
  console.error('❌ 回归中止：' + e.message);
  process.exit(1);
});
