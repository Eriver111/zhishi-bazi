/**
 * /api/palm-reading — AI 手相分析
 * POST { image: base64, code? } → 扣1次积分 → Qwen VL 分析
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AI_API_URL = process.env.VISION_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const AI_API_KEY = process.env.VISION_API_KEY || process.env.AI_API_KEY || '';
const AI_MODEL = process.env.VISION_MODEL || 'qwen-vl-max';
const USE_OPENAI_FORMAT = AI_API_URL.includes('compatible-mode');

const { requireAuth } = require('../lib/auth.js');
const { deductCredit, deductCreditByUser, isMonthlyActiveByUserId, getUserCredits, saveUserChatHistory } = require('../lib/supabase.js');

// 加载手相知识库
const PALM_SYSTEM = (function() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'knowledge', 'palm-reading-system.md'), 'utf-8');
  } catch(e) {
    return '你是精通《神相全编》的手相师。按掌纹八大纹逐宫分析，引用原文，给出综合断语。';
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

        var actualUrl = USE_OPENAI_FORMAT ? AI_API_URL + '/chat/completions' : AI_API_URL;
    console.log('[palm-reading] bodySize='+Math.round(image.length/1024)+'KB');
    console.log('[palm-reading] fmt=' + (USE_OPENAI_FORMAT?'openai':'native') + ' model=' + AI_MODEL + ' key=' + (AI_API_KEY||'').substring(0,8) + '...');
    // 调用 Vision AI
    var actualUrl = USE_OPENAI_FORMAT ? AI_API_URL + '/chat/completions' : AI_API_URL;
    var aiResp = await fetch(actualUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + AI_API_KEY
      },
      body: USE_OPENAI_FORMAT
      ? JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: PALM_SYSTEM },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: image } },
            { type: 'text', text: "请分析这张手相。先概括手型，再挑掌心最明显的几条主线解读（看不清的别硬编）。注意观察老茧、痣、肤色等生活痕迹。语气像朋友聊天别教条。好的说坏的也客观说。最后给段温暖总结，诗可选不强制。" }
          ]}
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
      : JSON.stringify({
        model: AI_MODEL,
        input: { messages: [
          { role: 'system', content: PALM_SYSTEM },
          { role: 'user', content: [
            { image: image },
            { type: 'text', text: "请分析这张手相。先概括手型，再挑掌心最明显的几条主线解读（看不清的别硬编）。注意观察老茧、痣、肤色等生活痕迹。语气像朋友聊天别教条。好的说坏的也客观说。最后给段温暖总结，诗可选不强制。" }
          ]}
        ]},
        parameters: { max_tokens: 2000, temperature: 0.3 }
      })
    });

    if (!aiResp.ok) {
      var errText = '';
      try { errText = await aiResp.text(); } catch(_) {}
      console.error('[palm-reading] AI error:', aiResp.status, 'body:', (errText||'').substring(0,300));
      var errDetail = 'HTTP ' + aiResp.status + ': ' + (errText||'').substring(0,200) || '请检查VISION_API_KEY和VISION_MODEL';
      return res.status(500).json({ error: errDetail });
    }

    var aiData = await aiResp.json();
    // DashScope 原生 API 返回 output.choices，兼容 OpenAI 格式
    var reading = aiData.choices?.[0]?.message?.content || '';
    if (!reading) {
      var rawContent = aiData.output?.choices?.[0]?.message?.content || '';
      reading = Array.isArray(rawContent) ? rawContent.map(function(c){return c.text||''}).join('') : String(rawContent);
    }
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
      saveUserChatHistory(userId, 'system', '[手相分析]');
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
    console.error('[palm-reading] 异常:', e.message);
    return res.status(500).json({ error: '服务异常，请稍后重试' });
  }
};
