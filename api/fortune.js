/**
 * /api/fortune - 今日运势
 * POST: 返回完整黄历 + AI 个性化八字运势（免费）
 */
const crypto = require('crypto');
const { calculator, calendar, chartFromQuery } = require('./_bazi-runtime');
const { chinaDateParts, buildDailyFacts, fallbackCopy } = require('./_daily-fortune');
const { requireAuth } = require('../lib/auth.js');
const { beginAiRequest } = require('../lib/ai-abuse-guard.js');

const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
// Keep billing predictable even when PM2 retains an older AI_MODEL value.
const AI_MODEL = 'deepseek-v4-flash';

const _cache = {};
const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ANIMALS = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const WU_XING = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };

// ---- 纳音（六十甲子）----
const NAYIN = {
  '甲子':'海中金','乙丑':'海中金','丙寅':'炉中火','丁卯':'炉中火','戊辰':'大林木','己巳':'大林木',
  '庚午':'路旁土','辛未':'路旁土','壬申':'剑锋金','癸酉':'剑锋金','甲戌':'山头火','乙亥':'山头火',
  '丙子':'涧下水','丁丑':'涧下水','戊寅':'城头土','己卯':'城头土','庚辰':'白蜡金','辛巳':'白蜡金',
  '壬午':'杨柳木','癸未':'杨柳木','甲申':'泉中水','乙酉':'泉中水','丙戌':'屋上土','丁亥':'屋上土',
  '戊子':'霹雳火','己丑':'霹雳火','庚寅':'松柏木','辛卯':'松柏木','壬辰':'长流水','癸巳':'长流水',
  '甲午':'沙中金','乙未':'沙中金','丙申':'山下火','丁酉':'山下火','戊戌':'平地木','己亥':'平地木',
  '庚子':'壁上土','辛丑':'壁上土','壬寅':'金箔金','癸卯':'金箔金','甲辰':'覆灯火','乙巳':'覆灯火',
  '丙午':'天河水','丁未':'天河水','戊申':'大驿土','己酉':'大驿土','庚戌':'钗钏金','辛亥':'钗钏金',
  '壬子':'桑柘木','癸丑':'桑柘木','甲寅':'大溪水','乙卯':'大溪水','丙辰':'沙中土','丁巳':'沙中土',
  '戊午':'天上火','己未':'天上火','庚申':'石榴木','辛酉':'石榴木','壬戌':'大海水','癸亥':'大海水'
};

// ---- 星宿（二十八宿，简版按月按日推算）----
const XIU28 = ['角','亢','氐','房','心','尾','箕','斗','牛','女','虚','危','室','壁','奎','娄','胃','昴','毕','觜','参','井','鬼','柳','星','张','翼','轸'];
const XIU_ANIMAL = ['木蛟','金龙','土貉','日兔','月狐','火虎','水豹','木獬','金牛','土蝠','日鼠','月燕','火猪','水㺄','木狼','金狗','土雉','日鸡','月乌','火猴','水猿','木犴','金羊','土獐','日马','月鹿','火蛇','水蚓'];
const XIU_LUCK = { '角':'吉','亢':'凶','氐':'吉','房':'吉','心':'凶','尾':'吉','箕':'吉','斗':'吉','牛':'凶','女':'凶','虚':'凶','危':'凶','室':'吉','壁':'吉','奎':'吉','娄':'吉','胃':'吉','昴':'凶','毕':'吉','觜':'凶','参':'吉','井':'吉','鬼':'凶','柳':'凶','星':'凶','张':'吉','翼':'凶','轸':'吉' };

// ---- 建除十二神（按月支+日支推算）----
const JIANCHU = ['建','除','满','平','定','执','破','危','成','收','开','闭'];

// ---- 冲煞（日支对应冲支）----
const CHONG = { '子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳' };
const SHA_DIR = { '子':'北','丑':'东北','寅':'东北','卯':'东','辰':'东南','巳':'东南','午':'南','未':'西南','申':'西南','酉':'西','戌':'西北','亥':'西北' };

// ---- 彭祖百忌 ----
const PENGZU_G = { '甲':'甲不开仓财物耗散','乙':'乙不栽植千株不长','丙':'丙不修灶必见灾殃','丁':'丁不剃头头必生疮','戊':'戊不受田田主不祥','己':'己不破券二比并亡','庚':'庚不经络织机虚张','辛':'辛不合酱主人不尝','壬':'壬不决水更难提防','癸':'癸不词讼理弱敌强' };
const PENGZU_Z = { '子':'子不问卜自惹祸殃','丑':'丑不冠带主不还乡','寅':'寅不祭祀神鬼不尝','卯':'卯不穿井水泉不香','辰':'辰不哭泣必主重丧','巳':'巳不远行财物伏藏','午':'午不苫盖屋主更张','未':'未不服药毒气入肠','申':'申不安床鬼祟入房','酉':'酉不会客醉坐颠狂','戌':'戌不吃犬作怪上床','亥':'亥不嫁娶不利新郎' };

// ---- 宜忌数据 ----
const JD_YI = {
  '建':['祭祀','祈福','求嗣','入学','出行','上官赴任'],
  '除':['祭祀','祈福','求嗣','解除','沐浴','整容','扫舍'],
  '满':['祭祀','祈福','求嗣','开市','立券','交易','纳财'],
  '平':['祭祀','修饰垣墙','平治道涂'],
  '定':['祭祀','祈福','求嗣','开市','立券','交易'],
  '执':['祭祀','祈福','求嗣','捕捉','畋猎'],
  '破':['求医','治病','破屋坏垣'],
  '危':['祭祀','祈福','求嗣','安床','拆卸'],
  '成':['祭祀','祈福','求嗣','入学','结婚','开市','交易','纳财','修造'],
  '收':['祭祀','祈福','求嗣','捕捉','畋猎','收敛财货'],
  '开':['祭祀','祈福','求嗣','开市','立券','交易','出行','嫁娶','修造'],
  '闭':['祭祀','祈福','求嗣','补垣塞穴']
};
const JD_JI = {
  '建':['开仓','出财'],
  '除':['开市','交易','嫁娶','出行'],
  '满':['祭祀','祈福','求嗣'],
  '平':['开渠','穿井'],
  '定':['诉讼','出行','迁徙'],
  '执':['开市','交易','嫁娶'],
  '破':['祈福','求嗣','嫁娶','出行','开市'],
  '危':['开市','交易','嫁娶'],
  '成':['诉讼'],
  '收':['开市','交易','嫁娶','出行'],
  '开':['破土','安葬'],
  '闭':['开市','交易','嫁娶','出行','修造']
};

// ---- 节气（2026）----
// 节气日期表（2026-2030），每年按 [立春,惊蛰,清明,立夏,芒种,小暑,立秋,白露,寒露,立冬,大雪,小寒] 顺序，仅存 day
const SOLAR_TERMS_DATA = {
  2026: [4,5,5,5,5,7,7,7,8,7,7,5],
  2027: [4,6,5,6,6,7,8,8,9,8,7,6],
  2028: [4,5,4,5,5,7,7,7,8,7,7,6],
  2029: [3,5,4,5,5,7,7,7,8,7,7,5],
  2030: [4,5,5,5,6,7,7,8,8,7,7,6]
};
const BASE_MONTHS = [2,3,4,5,6,7,8,9,10,11,12,1]; // 各节气对应月份

function getSolarTerm(year, month, day) {
  var target = new Date(year, month - 1, day, 12, 0, 0);
  var terms = [];
  [year - 1, year, year + 1].forEach(function(termYear) {
    calendar.getJieQiDates(termYear).forEach(function(term) {
      terms.push({ name: term.name, date: term.date });
    });
  });
  terms.sort(function(a, b) { return a.date - b.date; });
  var current = null, next = null;
  terms.forEach(function(term) {
    if (term.date <= target) current = term;
    else if (!next) next = term;
  });
  return {
    cur: current ? current.name : '—',
    next: next ? next.name : '—',
    days: next ? Math.max(0, Math.ceil((next.date - target) / 86400000)) : 0
  };
}

function buildHuangli(y, m, d) {
  // 与八字排盘共用同一套节气与干支算法，避免两个页面口径不同。
  var dayPillar = calendar.getDayPillar(y, m, d);
  var yearPillar = calendar.getYearPillar(y, m, d, 12);
  var monthPillar = calendar.getMonthPillar(y, m, d, 12, 12);
  var dayG = dayPillar.gan, dayZ = dayPillar.zhi;
  var gzStr = dayG + dayZ;
  var yGan = yearPillar.gan, yZhi = yearPillar.zhi;
  var monZhi = monthPillar.zhi, monGan = monthPillar.gan;
  var weekDays = ['日','一','二','三','四','五','六'];
  var wd = '星期' + weekDays[new Date(y,m-1,d).getDay()];

  // 建除
  var dayZhiIdx = dayPillar.zhiIndex;
  var jcIdx = (dayZhiIdx - monthPillar.zhiIndex + 12) % 12;
  var jc = JIANCHU[jcIdx];
  var term = getSolarTerm(y, m, d);
  var chongAnimal = ANIMALS[DZ.indexOf(CHONG[dayZ])];

  // 每日方向神煞（基于日干）
  var DIRS = { '东北':'↗','西北':'↖','西南':'↙','东南':'↘','正北':'↑','正南':'↓','正东':'→','正西':'←' };
  var XISHEN = { '甲':'东北','乙':'西北','丙':'西南','丁':'正南','戊':'东南','己':'东北','庚':'西北','辛':'西南','壬':'正南','癸':'东南' };
  var CAISHEN = { '甲':'东北','乙':'东北','丙':'正西','丁':'正西','戊':'正北','己':'正北','庚':'正东','辛':'正东','壬':'正南','癸':'正南' };
  var FUSHEN = { '甲':'东南','乙':'东南','丙':'正东','丁':'正东','戊':'正北','己':'正北','庚':'西南','辛':'西南','壬':'西北','癸':'西北' };
  var YANGGUI = { '甲':'西南','乙':'西南','丙':'正西','丁':'西北','戊':'东北','己':'东北','庚':'正南','辛':'东北','壬':'正东','癸':'东南' };
  var YINGUI = { '甲':'东北','乙':'正北','丙':'西北','丁':'正西','戊':'东南','己':'西南','庚':'西南','辛':'正南','壬':'西北','癸':'正东' };
  var dirGods = {
    xishen: XISHEN[dayG] || '', caishen: CAISHEN[dayG] || '', fushen: FUSHEN[dayG] || '',
    yanggui: YANGGUI[dayG] || '', yingui: YINGUI[dayG] || ''
  };

  return {
    date: y + '年' + m + '月' + d + '日 ' + wd,
    yearGZ: yGan + yZhi + '年（' + ANIMALS[DZ.indexOf(yZhi)] + '）',
    monthGZ: monGan + monZhi + '月',
    dayGZ: gzStr,
    term: term,
    nayin: NAYIN[gzStr] || '',
    jianchu: jc + '日（建除十二值）',
    chong: '冲(' + CHONG[dayZ] + ')' + chongAnimal + ' · 煞' + ({'申':'南','子':'南','辰':'南','寅':'北','午':'北','戌':'北','亥':'西','卯':'西','未':'西','巳':'东','酉':'东','丑':'东'}[dayZ] || ''),
    pengzu: PENGZU_G[dayG] + '；' + PENGZU_Z[dayZ],
    xiu: '',
    yi: (JD_YI[jc] || []).filter(function(item) { return (JD_JI[jc] || []).indexOf(item) < 0; }),
    ji: (JD_JI[jc] || []).filter(function(item) { return (JD_YI[jc] || []).indexOf(item) < 0; }),
    dirGods: dirGods
  };
}

// 每小时清理超过1小时的缓存
setInterval(function(){var now=Date.now();for(var k in _cache){if(_cache[k]._ts&&now-_cache[k]._ts>3600000)delete _cache[k];}},3600000).unref();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    var body = req.body || {};
    var dayGan = body.dayGan, dayZhi = body.dayZhi;
    var gender = body.gender || 'male', chartLabel = body.label || '';
    var query = typeof body.params === 'string' ? body.params : '';
    // 无论服务器部署在哪个时区，都按中国标准时间换日。
    var chinaToday = chinaDateParts(new Date());
    var nY = chinaToday.year, nM = chinaToday.month, nD = chinaToday.day;
    var todayKey = nY + '-' + nM + '-' + nD;
    var huangli = buildHuangli(nY, nM, nD);

    var chartContext = '';
    var dailyFacts = null;
    if (query) {
      try {
        var chartData = chartFromQuery(query);
        var bazi = chartData.bazi;
        gender = chartData.gender;
        dayGan = bazi.day.gan;
        dayZhi = bazi.day.zhi;
        dailyFacts = buildDailyFacts(calculator, bazi, gender, {
          yearNumber:nY,
          year:calendar.getYearPillar(nY, nM, nD, 12),
          month:calendar.getMonthPillar(nY, nM, nD, 12, 12),
          day:calendar.getDayPillar(nY, nM, nD)
        });
        chartContext = [
          '四柱：' + dailyFacts.pillars,
          '日主：' + dayGan + '，旺衰：' + dailyFacts.strength.level + '（' + dailyFacts.strength.score + '分）',
          '格局：' + dailyFacts.pattern.name + '·' + dailyFacts.pattern.status,
          '用神：' + dailyFacts.yongJi.yongShen.join('、') + '；喜神：' + dailyFacts.yongJi.xiShen.join('、')
            + (dailyFacts.yongJi.tiaoHouYongShen && dailyFacts.yongJi.tiaoHouYongShen.length ? '；调候用神：' + dailyFacts.yongJi.tiaoHouYongShen.join('、') + '（宜有度）' : '')
            + '；' + (dailyFacts.yongJi.tiaoHouYongShen && dailyFacts.yongJi.tiaoHouYongShen.length ? '结构忌神' : '忌神') + '：' + dailyFacts.yongJi.jiShen.join('、'),
          '岁运日环境：' + dailyFacts.context.map(function(row){return row.label + row.pillar + '（干' + row.ganRole + '、支' + row.zhiRole + '）';}).join('；'),
          '今日结论：' + dailyFacts.tendency + '；重点领域：' + (dailyFacts.focus.join('、') || '日常安排'),
          '明确引动：' + (dailyFacts.events.length ? dailyFacts.events.map(function(event){return event.detail;}).join('；') : '无强烈刑冲合害')
        ].join('\n');
      } catch (chartError) {
        console.warn('[fortune] chart context failed:', chartError.message);
      }
    }

    if (!dayGan) return res.status(200).json({ huangli: huangli, fortune: null });

    // 公共黄历无需登录；只要请求个性化推演，就必须使用真实登录身份。
    // 过去此处未鉴权，任何人都能绕过页面无限调用付费模型。
    var authUser = requireAuth(req);
    if (!authUser || !authUser.uid) {
      return res.status(401).json({ error: '请先登录查看专属今日运势', needLogin: true });
    }

    var cacheKey = crypto.createHash('sha256').update((query || chartLabel || (dayGan + dayZhi)) + '|' + todayKey).digest('hex');
    for (var k in _cache) { if (!_cache[k]._date || _cache[k]._date !== todayKey) delete _cache[k]; }
    if (_cache[cacheKey]) return res.status(200).json({ huangli: huangli, fortune: _cache[cacheKey] });

    var wx = WU_XING[dayGan] || '';
    var prompt = `你是“知时”今日运势的解释员。引擎已给出命盘事实，你不能重新计算、改判或补造关系。

${chartContext || ('保存档案：' + chartLabel + '\n日主：' + dayGan + wx + '\n日支：' + dayZhi)}
今天：${huangli.dayGZ}日。

请只根据以上事实写今日推演。headline用8至14个字直接概括今天；tip用140至220字大白话说明更容易发生的具体情况。重点写“会表现成什么”，不能只写建议，不能出现“能量、磁场、消耗、纠缠、关系失衡、机遇与挑战并存、稳步推进”等套话。合不默认吉、冲不默认凶，必须服从引擎给出的喜用忌和“今日结论”。若没有明确引动，就直说“今天没有特别强的变化信号”，不要硬编。

直接返回JSON：{"headline":"今日概括","tip":"大白话推演"}`;

    var guard = beginAiRequest(req, { route: 'fortune', identity: authUser.uid, minuteMax: 3, hourMax: 12 });
    if (!guard.ok) {
      return res.status(429).json({ error: guard.reason === 'concurrent' ? '上一次运势还在生成，请稍候' : '今日运势请求过于频繁，请稍后再试' });
    }
    var content = '';
    try {
      var aiResp = await fetch(AI_API_URL, {
        method: 'POST', headers: { 'Content-Type':'application/json','Authorization':'Bearer '+AI_API_KEY },
        body: JSON.stringify({ model:AI_MODEL, messages:[{role:'user',content:prompt}], thinking:{type:'disabled'}, max_tokens:900, temperature:0.2 })
      });
      var aiData = await aiResp.json();
      if (!aiResp.ok) throw new Error('AI error ' + aiResp.status);
      console.log("[fortune] respModel=" + (aiData.model || "?") + " at=" + new Date().toISOString());
      content = aiData.choices?.[0]?.message?.content || '';
      if (!content.trim()) throw new Error('AI 返回内容为空');
    } catch (aiError) {
      console.warn('[fortune] AI fallback:', aiError.message);
    } finally {
      guard.release();
    }
    // 去除可能的免责声明
    content = content.replace(/以上[^。]*生成[^。]*参考[^。]*[\n。]/g, '').replace(/以上[^。]*由[^。]*生成[^。]*/g, '').replace(/(本文|此内容|以上内容)[^。]*免责[^。]*[。\n]/g, '').replace(/\n*---\n.*$/s, '').replace(/（以上[^）]*）/, '').trim();
    var fortune = {};
    // 安全解析：找第一个完整JSON对象（非贪婪），避免匹配到AI返回的多个JSON块
    try {
      var firstBrace = content.indexOf('{');
      if (firstBrace >= 0) {
        var depth = 0, end = -1;
        for (var i = firstBrace; i < content.length; i++) {
          if (content[i] === '{') depth++;
          if (content[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end > firstBrace) {
          var jsonStr = content.substring(firstBrace, end + 1);
          fortune = JSON.parse(jsonStr);
        } else {
          fortune = { tip: content };
        }
      } else {
        fortune = { tip: content };
      }
    } catch(e) { fortune = { tip: content }; }
    var tip = fortune.tip || fortune.overview || content || (dailyFacts ? fallbackCopy(dailyFacts) : '今天没有特别强的变化信号。');
    tip = tip.replace(/以上[^。]*生成[^。]*参考[^。]*[。\n]/g, '').replace(/（以上[^）]*仅供参考[^）]*）/g, '').trim();
    var output = {
      headline:fortune.headline || (dailyFacts ? '今日' + dailyFacts.tendency : '今日提醒'),
      tip:tip,
      tendency:dailyFacts ? dailyFacts.tendency : '平稳',
      focus:dailyFacts ? dailyFacts.focus : [],
      basis:dailyFacts ? dailyFacts.basis.slice(0,2) : [],
      _date:todayKey, _cached:false
    };
    output._ts = Date.now(); _cache[cacheKey] = output;
    return res.status(200).json({ huangli: huangli, fortune: output });
  } catch (e) {
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
};
