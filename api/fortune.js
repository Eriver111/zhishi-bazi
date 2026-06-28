/**
 * /api/fortune - 今日运势
 * POST: 返回今日黄历 + AI 个性化八字运势（免费）
 */
const crypto = require('crypto');

const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

const _cache = {};

const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DI_ZHI  = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const WU_XING = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };

const MONTH_TIPS = {
  '寅':'春生万物，宜播种计划','卯':'春和景明，宜社交出行',
  '辰':'清明时节，宜整理规划','巳':'立夏将至，宜行动进取',
  '午':'夏长之时，宜展示才华','未':'暑气渐盛，宜静心养性',
  '申':'秋金当令，宜收获总结','酉':'秋高气爽，宜学习精进',
  '戌':'秋冬之交，宜理财规划','亥':'冬水寒凉，宜内省思考',
  '子':'冬至极寒，宜休养蓄力','丑':'隆冬岁末，宜回顾展望'
};

// 计算天干五行关系
function wxRel(a, b) {
  var wxIdx = { '木':0,'火':1,'土':2,'金':3,'水':4 };
  var ia = wxIdx[a], ib = wxIdx[b];
  if (ia === ib) return '同气';
  if ((ia+1)%5 === ib) return '生';
  if ((ia+4)%5 === ib) return '被生';
  if ((ia+2)%5 === ib) return '克';
  if ((ia+3)%5 === ib) return '被克';
  return '异';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var body = req.body || {};
    var dayGan = body.dayGan, dayZhi = body.dayZhi;
    var gender = body.gender || 'male';
    var chartLabel = body.label || '';

    // ---- 今日黄历（通用，不调 AI） ----
    var now = new Date();
    var nY = now.getFullYear(), nM = now.getMonth()+1, nD = now.getDate();
    var todayKey = nY + '-' + nM + '-' + nD;
    var mZhi = DI_ZHI[(nM-1) % 12];
    var tGan = TIAN_GAN[(nY*7 + nD) % 10];
    var tZhi = DI_ZHI[(nY*5 + nD) % 12];
    var seasonTip = MONTH_TIPS[mZhi] || '顺应天时';
    var weekDays = ['日','一','二','三','四','五','六'];
    var weekDay = '星期' + weekDays[now.getDay()];

    // 吉凶简算：比较日柱五行 vs 月令五行
    var tWx = WU_XING[tGan] || '', mWx = (DI_ZHI.indexOf(mZhi)+4)%5;
    var wxKey = ['木','火','土','金','水'][mWx];
    var rel = wxRel(tWx, wxKey);
    var relLabel = { '同气':'今日与你五行同气，运势顺遂','生':'今日你生月令，宜付出分享','被生':'月令生你，万事顺意','克':'今日你克月令，可控局但要费心','被克':'月令克你，宜低调谨慎' };
    var dayLabel = relLabel[rel] || '顺应天时';
    var luckyColor = { '木':'青绿色','火':'赤红色','土':'棕黄色','金':'银白色','水':'靛蓝色' };
    var luckyNum = (nY+nM+nD) % 9 + 1;
    if (luckyNum === 0) luckyNum = 9;

    var huangli = {
      date: nY + '年' + nM + '月' + nD + '日 ' + weekDay,
      dayGanZhi: tGan + tZhi,
      monthZhi: mZhi,
      season: seasonTip,
      dayLabel: dayLabel,
      luckyColor: luckyColor[tWx] || '白色',
      luckyNum: luckyNum
    };

    // ---- 八字运势缓存 ----
    if (!dayGan) {
      return res.status(200).json({ huangli: huangli, fortune: null });
    }

    var cacheKey = crypto.createHash('md5').update((chartLabel||'') + todayKey).digest('hex');
    for (var k in _cache) { if (!_cache[k]._date || _cache[k]._date !== todayKey) delete _cache[k]; }

    if (_cache[cacheKey]) {
      return res.status(200).json({ huangli: huangli, fortune: _cache[cacheKey] });
    }

    // ---- 调 AI 生成个性化运势 ----
    var genderLabel = gender === 'male' ? '乾造' : '坤造';
    var prompt = `你是"知时先生"，一位精通命理学的 AI。根据以下信息，为用户生成今日运势。语气从容温暖，有文化感，不超过200字。

用户命盘：${chartLabel}（${genderLabel}），日主${dayGan}（${WU_XING[dayGan]||''}），日支${dayZhi}。
今日：${huangli.date}，干支${huangli.dayGanZhi}，月令${mZhi}，${seasonTip}。

请返回JSON：{"overview":"...","suitable":"...","caution":"...","quote":"..."}`;

    var aiResp = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_API_KEY },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.8 })
    });
    var aiData = await aiResp.json();
    var content = aiData.choices?.[0]?.message?.content || '';
    var fortune;
    try { fortune = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || content); } catch(e) { fortune = { overview: content }; }

    var output = {
      overview: fortune.overview || '',
      suitable: fortune.suitable || '',
      caution: fortune.caution || '',
      quote: fortune.quote || '知天时，见自己。',
      _date: todayKey, _cached: false
    };
    _cache[cacheKey] = output;
    return res.status(200).json({ huangli: huangli, fortune: output });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
