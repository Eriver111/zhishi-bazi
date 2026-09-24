/**
 * /api/fortune - 今日运势
 * POST: 返回公共黄历 + 由统一引擎证据生成的个人日级提醒（免费）
 */
const { calculator, calendar, chartFromQuery } = require('./_bazi-runtime');
const { METHOD_VERSION, chinaDateParts, buildDailyFacts } = require('./_daily-fortune');
const { requireAuth } = require('../lib/auth.js');
const { beginAiRequest } = require('../lib/ai-abuse-guard.js');

const {chartIdentity, getDailyStore} = require('../lib/daily-fortune-store');
const {generateDailyCopy} = require('./_daily-fortune-copy');
const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ANIMALS = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

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

function hasCompleteChartQuery(query) {
  const params = new URLSearchParams(query);
  if (!['male','female'].includes(params.get('gender'))) return false;
  if (params.get('mode') === 'pillars') {
    if (!['yg','yz','mg','mz','dg','dz','hg','hz'].every(key => params.get(key))) return false;
    if (params.get('timing') !== 'matched') return true;
  }
  if (!['year','month','day','hour'].every(key => params.has(key) && params.get(key).trim() !== '')) return false;
  const y = Number(params.get('year')), m = Number(params.get('month')), d = Number(params.get('day'));
  const h = Number(params.get('hour'));
  if (![y,m,d,h].every(Number.isInteger) || y < 1800 || y > 2200 || m < 1 || m > 12 || h < 0 || h > 11) return false;
  if (d < 1 || d > new Date(Date.UTC(y,m,0)).getUTCDate()) return false;
  for (const key of ['clock','minute']) {
    if (!params.has(key)) continue;
    const value = Number(params.get(key));
    if (!Number.isFinite(value) || value < 0 || value >= (key === 'clock' ? 24 : 60)) return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error:'仅支持 POST 请求'});
  try {
    const body = req.body || {};
    const query = typeof body.params === 'string' ? body.params : '';
    const today = chinaDateParts(new Date());
    const todayKey = [today.year, String(today.month).padStart(2,'0'), String(today.day).padStart(2,'0')].join('-');
    const huangli = buildHuangli(today.year, today.month, today.day);
    if (!query && !body.dayGan) return res.status(200).json({huangli, fortune:null});

    // Authenticate before computing or serving cached personal output.
    const authUser = requireAuth(req);
    if (!authUser || !authUser.uid) {
      return res.status(401).json({error:'请先登录查看专属今日运势', needLogin:true});
    }
    function incomplete() {
      return res.status(200).json({huangli, fortune:null, personalStatus:'incomplete-chart',
        message:'这份档案的完整排盘资料不足，请重新排盘并保存后查看今日提醒。'});
    }
    if (!hasCompleteChartQuery(query)) return incomplete();
    let chart;
    try { chart = chartFromQuery(query); } catch (_) { return incomplete(); }
    const clockKnown = new URLSearchParams(query).has('clock');
    if (chart.bazi.birthDate && !clockKnown) delete chart.bazi.birthDate.clock;
    const identity = chartIdentity(chart);
    function factsAt(date) {
      return buildDailyFacts(calculator, chart.bazi, chart.gender, {
        yearNumber:date.year, monthNumber:date.month, dayNumber:date.day,
        year:calendar.getYearPillar(date.year,date.month,date.day,12),
        month:calendar.getMonthPillar(date.year,date.month,date.day,12,12),
        day:calendar.getDayPillar(date.year,date.month,date.day)
      });
    }
    const edition = await getDailyStore().getOrCreate(todayKey, identity, async () => {
      const guard = beginAiRequest(req, {route:'fortune', identity:authUser.uid, minuteMax:3, hourMax:12});
      if (!guard.ok) {const error = new Error('daily rate limit'); error.status = 429; throw error;}
      try {
        const facts = factsAt(today);
        const before = new Date(Date.UTC(today.year,today.month - 1,today.day - 1,12));
        const previous = factsAt({year:before.getUTCFullYear(),month:before.getUTCMonth()+1,day:before.getUTCDate()});
        if (chart.bazi.birthDate && !clockKnown) facts.notes.push('档案未保存具体钟点，大运起运按时辰中点估算');
        const copy = await generateDailyCopy(facts, previous);
        return {...copy, tendency:facts.tendency, focus:facts.focus,
          basis:facts.basis, conditions:facts.conditions, notes:facts.notes, scope:facts.scope,
          methodVersion:METHOD_VERSION, _date:todayKey, _ts:Date.now()};
      } finally {guard.release();}
    });
    // Never serve a provisional edition before durable publication succeeds.
    return res.status(200).json({huangli, fortune:{...edition.output, _cached:edition.cached}});
  } catch (error) {
    if (error.status === 429) return res.status(429).json({error:'今日运势请求过于频繁，请稍后再试'});
    return res.status(503).json({error:'今日内容暂时未能保存或读取，请稍后重试'});
  }
};
