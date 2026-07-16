/**
 * /api/fengshui-reading — AI 八宅风水分析
 * POST { sitting, facing, layout: {door, bedroom, kitchen, bathroom}, images?: [{slot, data}] }
 * → 扣1次积分 → Qwen VL 分析（有图时多轮）
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AI_API_URL = process.env.VISION_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const AI_API_KEY = process.env.VISION_API_KEY || process.env.AI_API_KEY || '';
const AI_MODEL = process.env.VISION_MODEL || 'qwen-vl-max';
const USE_OPENAI_FORMAT = AI_API_URL.includes('compatible-mode');
const FALLBACK_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const FALLBACK_MODEL = 'qwen-vl-max';

const { requireAuth } = require('../lib/auth.js');
const { deductCredit, deductCreditByUser, isMonthlyActiveByUserId, getUserCredits, saveUserChatHistory } = require('../lib/supabase.js');

// 加载风水知识库
const FENGSHUI_SYSTEM = (function() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'knowledge', 'fengshui-system.md'), 'utf-8');
  } catch(e) {
    return '你是精通《八宅明镜》的风水师。根据用户提供的坐向和方位信息，运用八宅法进行吉凶分析。';
  }
})();

/**
 * 调用 Vision AI（单次请求，支持图片或纯文本）
 */
async function callAI(systemPrompt, userContent, isOpenAI) {
  var actualUrl = isOpenAI ? AI_API_URL + '/chat/completions' : AI_API_URL;
  var body;
  if (isOpenAI) {
    body = JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: 4000,
      temperature: 0.3
    });
  } else {
    // Native DashScope format — userContent可能是[{image:...},{text:'...'}]或纯文本
    var messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];
    body = JSON.stringify({
      model: AI_MODEL,
      input: { messages: messages },
      parameters: { max_tokens: 4000, temperature: 0.3 }
    });
  }

  var controller = new AbortController();
  var timeout = setTimeout(function(){ controller.abort(); }, 120000);
  try {
    var resp = await fetch(actualUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + AI_API_KEY
      },
      body: body
    });

    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch(_) {}
      console.error('[fengshui] AI error:', resp.status, (errText||'').substring(0,300));
      throw new Error('HTTP ' + resp.status + ': ' + (errText||'').substring(0,200));
    }

    var data = await resp.json();
    var reading = '';
    if (isOpenAI) {
      reading = data.choices?.[0]?.message?.content || '';
    }
    if (!reading) {
      var raw = data.output?.choices?.[0]?.message?.content || '';
      reading = Array.isArray(raw) ? raw.map(function(c){return c.text||''}).join('') : String(raw);
    }
    return reading;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 带降级的 AI 调用（MaaS 超时时自动切原生端点）
 */
async function callAIWithFallback(systemPrompt, userContent) {
  try {
    var reading = await callAI(systemPrompt, userContent, USE_OPENAI_FORMAT);
    if (reading && reading.length >= 20) return reading;
  } catch(e) {
    if (USE_OPENAI_FORMAT) {
      console.log('[fengshui] MaaS超时,降级到qwen-vl-max');
    } else {
      throw e;
    }
  }
  // 降级到原生端点 — 需将 OpenAI 格式转为原生格式
  var nativeContent;
  if (Array.isArray(userContent)) {
    nativeContent = userContent.map(function(c){
      if (c.image_url) return { image: c.image_url.url };
      if (c.type === 'text' && c.text) return { text: c.text };
      if (c.image) return c;
      if (c.text) return c;
      return c;
    });
  } else {
    nativeContent = userContent;
  }
  return await callAI(systemPrompt, nativeContent, false);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    var { roomType, sitting, facing, layout, images } = req.body || {};
    if (!sitting || !facing || !layout) {
      return res.status(400).json({ error: '请提供坐向和格局信息' });
    }

    // 鉴权
    var authUser = requireAuth(req);
    if (!authUser || !authUser.uid) {
      return res.status(401).json({ error: '请先登录', needLogin: true });
    }
    var userId = authUser.uid;

    // 积分检查（风水分析消耗15积分）
    var FENGSHUI_COST = 15;
    var monthlyActive = await isMonthlyActiveByUserId(userId);
    var creditOk = !!monthlyActive;
    if (!creditOk) {
      var totalCredits = await getUserCredits(userId);
      if (totalCredits >= FENGSHUI_COST) creditOk = true;
    }
    if (!creditOk) {
      return res.status(403).json({ error: '积分不足，风水分析需要' + FENGSHUI_COST + '积分，请先购买次数包', creditExhausted: true });
    }

    // 房型文案
    var roomTypeLabels = { house:'自建房/平房', apartment:'楼房/公寓', villa:'别墅/复式' };
    var roomTypeLabel = roomTypeLabels[roomType] || '未指定';
    var roomTypeNotes = {
      house: '独立院落或平房，有独立朝向，可分析院落格局和厢房分布。',
      apartment: '单元楼房，坐向以整栋楼为准。分析时需注意入户门与单元门的区别。',
      villa: '独栋多层住宅，需考虑楼层叠加、楼梯位置的影响。以一层大门朝向为坐向基准。'
    };

    // ===== 构建分析请求 =====
    var layoutText = [
      '## 房屋基本信息',
      '- 房屋类型：**' + roomTypeLabel + '**（' + (roomTypeNotes[roomType] || '') + '）',
      '- 房屋坐向：**坐' + sitting + '朝' + facing + '**',
      '- 大门方位：' + (layout.door || '未标注'),
      '- 厨房方位：' + (layout.kitchen || '未标注')
    ];

    // 动态卧室
    if (layout.bedrooms && layout.bedrooms.length > 0) {
      var brList = layout.bedrooms.map(function(b, i){
        return '  卧室' + (i+1) + '（' + (b.type || '卧室') + '）：' + (b.dir || '未标注');
      });
      layoutText.push('- 卧室共' + layout.bedrooms.length + '间：');
      layoutText.push(brList.join('\n'));
    } else if (layout.bedroom) {
      // 兼容旧格式
      layoutText.push('- 主卧方位：' + layout.bedroom);
    }

    // 动态卫生间
    if (layout.bathrooms && layout.bathrooms.length > 0) {
      var btList = layout.bathrooms.map(function(b, i){
        return '  卫生间' + (i+1) + '：' + (b.dir || '未标注');
      });
      layoutText.push('- 卫生间共' + layout.bathrooms.length + '间：');
      layoutText.push(btList.join('\n'));
    } else if (layout.bathroom) {
      layoutText.push('- 卫生间方位：' + layout.bathroom);
    }

    layoutText.push('', '请根据以上信息，结合八宅法进行完整的风水分析。注意考虑' + roomTypeLabel + '的特殊风水要点。');

    var reading = '';

    if (images && images.length > 0) {
      // === 有照片：所有图片+方位数据一次性发给AI ===
      console.log('[fengshui] 单轮分析，照片数=' + images.length + ' 总KB=' + Math.round(images.reduce(function(s,img){return s+(img.data||img||'').length/1024}, 0)));

      var slotLabels = {
        'door': '大门', 'living': '客厅', 'kitchen': '厨房',
        'bedroom': '主卧', 'bedroom_0': '主卧', 'bedroom_1': '次卧',
        'bathroom_0': '卫生间', 'bathroom_1': '卫生间',
        'stairs': '楼梯', 'floorplan': '户型图'
      };

      // 构建多图+文本的 content 数组（统一用 OpenAI 兼容格式，原生端点不支持多图）
      var userContent = [];
      images.forEach(function(img) {
        var imgData = img.data || img;
        var slot = img.slot || 'photo';
        var label = slotLabels[slot] || slot;
        userContent.push({ type: 'image_url', image_url: { url: imgData } });
        userContent.push({ type: 'text', text: '【上图：' + label + '】' });
      });

      var textPrompt = layoutText.join('\n') + '\n\n' +
        '以上是各房间照片和房屋方位信息。请按照知识库要求的五段式格式，结合八宅法进行完整风水分析。' +
        '逐张照片分析形煞，然后结合方位数据给出综合判断。';
      userContent.push({ type: 'text', text: textPrompt });

      // 多图时强制使用 OpenAI 兼容格式（原生端点不支持一次传多图）
      var useOA = USE_OPENAI_FORMAT || images.length > 0;
      reading = await callAI(FENGSHUI_SYSTEM, userContent, useOA);
      if ((!reading || reading.length < 20) && !USE_OPENAI_FORMAT) {
        // OpenAI 格式失败且当前是原生配置，降级到原生（单文本兜底）
        var nativeContent = userContent.map(function(c){
          if (c.image_url) return { image: c.image_url.url };
          if (c.type === 'text' && c.text) return { text: c.text };
          return c;
        });
        reading = await callAI(FENGSHUI_SYSTEM, nativeContent, false);
      }

    } else {
      // === 无照片：纯文本分析 ===
      console.log('[fengshui] 纯文本分析（无照片）');
      var textContent = [{ type: 'text', text: layoutText.join('\n') }];
      reading = await callAIWithFallback(FENGSHUI_SYSTEM, textContent);
    }

    if (!reading || reading.length < 30) {
      return res.status(500).json({ error: 'AI 返回异常，请稍后重试' });
    }

    // 扣费（月度会员免费，普通用户扣15积分）
    if (!monthlyActive) {
      for (var di = 0; di < FENGSHUI_COST; di++) {
        var deducted = await deductCreditByUser(userId);
        if (!deducted) {
          return res.status(403).json({ error: '积分扣减失败，请确认积分余额充足', creditExhausted: true });
        }
      }
    }

    // 保存记录
    try {
      var saveLabel = '[风水分析] 坐' + sitting + '朝' + facing + ' ' +
        (layout.door?'门'+layout.door+' ':'') +
        (layout.bedroom?'卧'+layout.bedroom+' ':'') +
        (layout.kitchen?'灶'+layout.kitchen:'');
      saveUserChatHistory(userId, 'system', saveLabel);
      saveUserChatHistory(userId, 'assistant', reading);
    } catch(_) {}

    var remainingCredits = -1;
    try { remainingCredits = await getUserCredits(userId); } catch(_) {}

    return res.status(200).json({
      reading: reading,
      creditsLeft: remainingCredits,
      isMonthly: !!monthlyActive
    });

  } catch (e) {
    console.error('[fengshui] 异常:', e.message, e.stack);
    return res.status(500).json({ error: '服务异常：' + (e.message || '未知错误') });
  }
};
