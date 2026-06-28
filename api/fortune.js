/**
 * /api/fortune - 今日运势
 * POST: 生成个性化每日运势（免费）
 * 基于用户八字 + 流日柱 + 黄历信息
 */
const crypto = require('crypto');

const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

// 简单内存缓存（同一天同一八字不重复调 AI）
const _cache = {};

const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const WU_XING = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };

// 简版黄历每日宜忌（按月支）
const MONTH_TIPS = {
  '寅': '春生万物，宜播种新计划', '卯': '春和景明，宜社交出行',
  '辰': '清明时节，宜整理规划', '巳': '立夏将至，宜行动进取',
  '午': '夏长之时，宜展示才华', '未': '暑气渐盛，宜静心养性',
  '申': '秋金当令，宜收获总结', '酉': '秋高气爽，宜学习精进',
  '戌': '秋冬之交，宜理财规划', '亥': '冬水寒凉，宜内省思考',
  '子': '冬至极寒，宜休养蓄力', '丑': '隆冬岁末，宜回顾展望'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var body = req.body || {};
    var year = body.year, month = body.month, day = body.day;
    var dayGan = body.dayGan, dayZhi = body.dayZhi;
    var gender = body.gender || 'male';
    var chartLabel = body.label || '';

    if (!year || !month || !day || !dayGan) {
      return res.status(400).json({ error: '缺少八字信息，请先排盘' });
    }

    // 计算今日流日柱
    var now = new Date();
    var todayKey = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate();
    var cacheKey = crypto.createHash('md5').update(chartLabel + todayKey).digest('hex');

    // 缓存命中
    if (_cache[cacheKey]) {
      return res.status(200).json(_cache[cacheKey]);
    }

    // 清过期缓存
    var todayStr = todayKey;
    for (var k in _cache) {
      if (!_cache[k]._date || _cache[k]._date !== todayStr) delete _cache[k];
    }

    var nowYear = now.getFullYear();
    var nowMonth = now.getMonth() + 1;
    var nowDay = now.getDate();
    var tGan = TIAN_GAN[(nowYear % 10 + nowMonth + nowDay) % 10] || '甲'; // 简算今日天干
    var mZhi = DI_ZHI[(nowMonth - 1) % 12];
    var seasonTip = MONTH_TIPS[mZhi] || '顺应天时';

    var genderLabel = gender === 'male' ? '乾造' : '坤造';
    var prompt = `你是知时先生，一位精通传统命理学的 AI 命理师。请根据以下信息，为用户生成一段200字左右的今日运势解读，语气温暖从容，有文化底蕴，不堆砌术语。

用户命盘：${chartLabel}（${genderLabel}），日主为${dayGan}（${WU_XING[dayGan]||''}），日柱地支为${dayZhi}。
今日日期：${nowYear}年${nowMonth}月${nowDay}日，月令${mZhi}，${seasonTip}。

请包含：
1. 今日整体运势简述（结合日主与月令关系）
2. 适合做什么（一句话）
3. 注意事项（一句话）
4. 一句古典名言收尾（来自《道德经》《易经》等）

用JSON格式返回：{ "overview":"...", "suitable":"...", "caution":"...", "quote":"..." }`;

    var aiResp = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_API_KEY },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400, temperature: 0.8
      })
    });
    var aiData = await aiResp.json();
    var content = aiData.choices && aiData.choices[0] ? aiData.choices[0].message.content : '';

    var result;
    try {
      result = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || content);
    } catch(e) {
      result = { overview: content, suitable: '', caution: '', quote: '' };
    }

    var output = {
      overview: result.overview || result.overview,
      suitable: result.suitable || '',
      caution: result.caution || '',
      quote: result.quote || '知天时，见自己。',
      _date: todayStr,
      _cached: false
    };

    _cache[cacheKey] = output;
    return res.status(200).json(output);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
