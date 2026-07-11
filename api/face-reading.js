/**
 * /api/face-reading — AI 面相分析
 * POST { image: base64, code? } → 扣1次积分 → Qwen VL 分析
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AI_API_URL = process.env.VISION_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const AI_API_KEY = process.env.VISION_API_KEY || process.env.AI_API_KEY || '';
const AI_MODEL = process.env.VISION_MODEL || 'qwen-vl-max';

const { requireAuth } = require('../lib/auth.js');
const { deductCredit, deductCreditByUser, isMonthlyActiveByUserId, getUserCredits, saveUserChatHistory } = require('../lib/supabase.js');

// 加载面相知识库
const FACE_SYSTEM = (function() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'knowledge', 'face-reading-system.md'), 'utf-8');
  } catch(e) {
    return '你是精通《麻衣神相》的面相师。按十二宫逐宫分析，引用原文，给出综合断语。';
  }
})();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    const { image, code } = req.body || {};
    if (!image) return res.status(400).json({ error: '请上传照片' });

    // 鉴权
    var authUser = requireAuth(req);
    if (!authUser || !authUser.uid) {
      return res.status(401).json({ error: '请先登录', needLogin: true });
    }
    var userId = authUser.uid;

    // 积分检查
    var monthlyActive = await isMonthlyActiveByUserId(userId);
    var creditOk = !!monthlyActive;
    if (!creditOk) {
      var totalCredits = await getUserCredits(userId);
      if (totalCredits > 0) creditOk = true;
    }
    if (!creditOk) {
      return res.status(403).json({ error: '积分不足，请先购买次数包', creditExhausted: true });
    }

    // 图片体积限制（base64 解码后 < 2MB）
    var imgBuffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    if (imgBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: '图片过大，请压缩后重试（不超过5MB）' });
    }

    // 去重检查（同一张图短时间内不重复扣费）
    var imgHash = crypto.createHash('md5').update(imgBuffer).digest('hex');

    console.log('[face-reading] model=' + AI_MODEL + ' key=' + (AI_API_KEY||'').substring(0,8) + '... url=' + AI_API_URL);
    // 调用 Vision AI
    var aiResp = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + AI_API_KEY
      },
      body: JSON.stringify({
        model: AI_MODEL,
        input: { messages: [
          { role: 'system', content: FACE_SYSTEM },
          { role: 'user', content: [
            { image: image },
            { type: 'text', text: '请分析这张面相。好的要说，不好的也要客观指出。只分析清晰可见的部位，看不清的如实标注。注意观察面部痣、疤痕等特征。语气像朋友聊天。最后给一段总结和一首短诗。' }
          ]}
        ]
        },
        parameters: { max_tokens: 2000, temperature: 0.3 }
      })
    });

    if (!aiResp.ok) {
      var errText = '';
      try { errText = await aiResp.text(); } catch(_) {}
      console.error('[face-reading] AI error:', aiResp.status, 'body:', (errText||'').substring(0,300));
      var errDetail = 'HTTP ' + aiResp.status + ': ' + (errText||'').substring(0,200) || '请检查VISION_API_KEY和VISION_MODEL';
      return res.status(500).json({ error: errDetail });
    }

    var aiData = await aiResp.json();
    // DashScope 原生 API 返回 output.choices，兼容 OpenAI 格式
    var rawContent = aiData.output?.choices?.[0]?.message?.content || aiData.choices?.[0]?.message?.content || '';
    var reading = Array.isArray(rawContent) ? rawContent.map(function(c){return c.text||''}).join('') : String(rawContent);
    if (!reading || reading.length < 20) {
      return res.status(500).json({ error: 'AI 返回异常，请稍后重试' });
    }

    // 扣费
    if (!monthlyActive) {
      var deducted = null;
      if (code) deducted = await deductCredit(code);
      if (!deducted) deducted = await deductCreditByUser(userId);
      if (!deducted) {
        return res.status(403).json({ error: '积分扣减失败', creditExhausted: true });
      }
    }

    // 保存记录
    try {
      saveUserChatHistory(userId, 'system', '[面相分析]');
      saveUserChatHistory(userId, 'assistant', reading);
    } catch(_) {}

    // 返回剩余积分
    var remainingCredits = -1;
    try { remainingCredits = await getUserCredits(userId); } catch(_) {}

    return res.status(200).json({
      reading: reading,
      creditsLeft: remainingCredits,
      isMonthly: !!monthlyActive
    });

  } catch (e) {
    console.error('[face-reading] 异常:', e.message);
    return res.status(500).json({ error: '服务异常，请稍后重试' });
  }
};
