/**
 * /api/fortune - 今日运势
 * POST: 返回完整黄历 + AI 个性化八字运势（免费）
 */
const crypto = require('crypto');

const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

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
const JIANCHU_LUCK = { '建':'黑','除':'黄','满':'黄','平':'黄','定':'黄','执':'黄','破':'黑','危':'黑','成':'黄','收':'黄','开':'黄','闭':'黑' };

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
const SOLAR_TERMS_2026 = [
  [1,5,'小寒'],[1,20,'大寒'],[2,4,'立春'],[2,19,'雨水'],[3,5,'惊蛰'],[3,20,'春分'],
  [4,5,'清明'],[4,20,'谷雨'],[5,5,'立夏'],[5,21,'小满'],[6,5,'芒种'],[6,21,'夏至'],
  [7,7,'小暑'],[7,22,'大暑'],[8,7,'立秋'],[8,23,'处暑'],[9,7,'白露'],[9,23,'秋分'],
  [10,8,'寒露'],[10,23,'霜降'],[11,7,'立冬'],[11,22,'小雪'],[12,7,'大雪'],[12,22,'冬至']
];

function getSolarTerm(month, day) {
  for (var i = SOLAR_TERMS_2026.length - 1; i >= 0; i--) {
    var t = SOLAR_TERMS_2026[i];
    if (month > t[0] || (month === t[0] && day >= t[1])) {
      var cur = t[2];
      var next = SOLAR_TERMS_2026[i+1];
      if (!next) next = SOLAR_TERMS_2026[0];
      var diffDays = (next[0]-month)*30 + (next[1]-day);
      return { cur: cur, next: next[2], days: diffDays };
    }
  }
  return { cur:'未知', next:'未知', days:0 };
}

function buildHuangli(y, m, d) {
  var dayGanIdx = (y*7 + d) % 10;
  var dayZhiIdx = (y*5 + d + (m > 2 ? 6 - Math.floor(m/2) : 0)) % 12;
  var dayG = TG[dayGanIdx], dayZ = DZ[dayZhiIdx];
  var gzStr = dayG + dayZ;
  var yGanIdx = (y-4)%10, yZhiIdx = (y-4)%12;
  var yGan = TG[yGanIdx], yZhi = DZ[yZhiIdx];
  var monZhi = DZ[(m-1)%12];
  var monGan = TG[(yGanIdx * 2 + m) % 10];
  var weekDays = ['日','一','二','三','四','五','六'];
  var wd = '星期' + weekDays[new Date(y,m-1,d).getDay()];

  // 建除
  var jcIdx = (dayZhiIdx - (m-1) + 12) % 12;
  var jc = JIANCHU[jcIdx];
  var jcLuck = JIANCHU_LUCK[jc];
  // 星宿
  var xiuIdx = (y*7 + d + m) % 28;
  var xiuName = XIU28[xiuIdx];
  var xiuFull = xiuName + XIU_ANIMAL[xiuIdx];

  var term = getSolarTerm(m, d);
  var chongAnimal = ANIMALS[DZ.indexOf(CHONG[dayZ])];

  return {
    date: y + '年' + m + '月' + d + '日 ' + wd,
    yearGZ: yGan + yZhi + '年（' + ANIMALS[DZ.indexOf(yZhi)] + '）',
    monthGZ: monGan + monZhi + '月',
    dayGZ: gzStr,
    term: term,
    nayin: NAYIN[gzStr] || '',
    jianchu: jc + '（' + (jcLuck==='黄'?'黄道':'黑道') + ' · ' + (jcLuck==='黄'?'吉':'凶') + '）',
    chong: '冲(' + CHONG[dayZ] + ')' + chongAnimal + ' · 煞' + SHA_DIR[CHONG[dayZ]],
    pengzu: PENGZU_G[dayG] + '；' + PENGZU_Z[dayZ],
    xiu: xiuFull + ' · ' + XIU_LUCK[xiuName],
    yi: JD_YI[jc] || [],
    ji: JD_JI[jc] || []
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    var body = req.body || {};
    var dayGan = body.dayGan, dayZhi = body.dayZhi;
    var gender = body.gender || 'male', chartLabel = body.label || '';
    var now = new Date();
    var nY = now.getFullYear(), nM = now.getMonth()+1, nD = now.getDate();
    var todayKey = nY + '-' + nM + '-' + nD;
    var huangli = buildHuangli(nY, nM, nD);

    if (!dayGan) return res.status(200).json({ huangli: huangli, fortune: null });

    var cacheKey = crypto.createHash('md5').update((chartLabel||'') + todayKey).digest('hex');
    for (var k in _cache) { if (!_cache[k]._date || _cache[k]._date !== todayKey) delete _cache[k]; }
    if (_cache[cacheKey]) return res.status(200).json({ huangli: huangli, fortune: _cache[cacheKey] });

    var wx = WU_XING[dayGan] || '';
    var prompt = `你是"知时"。用户的信息：八字${chartLabel}，日主是${dayGan}（五行属${wx}），日柱地支${dayZhi}。今天是${huangli.dayGZ}日。

请用大白话给这位${dayGan}${wx}日主写一段今日运势提醒，像朋友聊天一样亲切，不要用任何专业术语、古文或引用。150字左右，温暖随性，不要半途截断。

直接返回JSON：{"tip":"写好的那段话"}`;

    var aiResp = await fetch(AI_API_URL, {
      method: 'POST', headers: { 'Content-Type':'application/json','Authorization':'Bearer '+AI_API_KEY },
      body: JSON.stringify({ model:AI_MODEL, messages:[{role:'user',content:prompt}], max_tokens:800, temperature:0.8 })
    });
    var aiData = await aiResp.json();
    var content = aiData.choices?.[0]?.message?.content || '';
    var fortune = {};
    try { fortune = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || content); } catch(e) { fortune = { tip: content }; }
    var output = { tip: fortune.tip || fortune.overview || content, _date: todayKey, _cached: false };
    _cache[cacheKey] = output;
    return res.status(200).json({ huangli: huangli, fortune: output });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
