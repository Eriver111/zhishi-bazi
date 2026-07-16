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
      max_tokens: 2500,
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
      parameters: { max_tokens: 2500, temperature: 0.3 }
    });
  }

  var controller = new AbortController();
  var timeout = setTimeout(function(){ controller.abort(); }, 60000);
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
  // 降级到原生端点
  var nativeContent;
  if (Array.isArray(userContent)) {
    // 转换 OpenAI 格式的 content 数组为 native 格式
    nativeContent = userContent.map(function(c){
      if (c.image_url) return { image: c.image_url.url };
      if (c.image) return c;
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
      // === 有照片：多轮分析 ===

      // 第一轮：逐图分析形煞
      var photoAnalyses = [];
      var slotLabels = {
        'door': '大门',
        'living': '客厅',
        'kitchen': '厨房',
        'bedroom': '主卧',
        'floorplan': '户型图'
      };

      for (var i = 0; i < images.length; i++) {
        var imgData = images[i].data || images[i];
        var slot = images[i].slot || ('photo_' + i);
        var label = slotLabels[slot] || slot;

        var photoPrompt = [
          '请分析这张' + label + '照片中与风水相关的内容。',
          '',
          '重点关注：',
          '1. 此空间是否存在形煞？（穿堂煞、横梁压顶、门冲、角煞等）',
          '2. 格局是否合理？（采光、通风、空间布局）',
          '3. 家具摆放是否符合风水原则？',
          '4. 有什么需要注意的问题？',
          '',
          '请用简明扼要的几点说明，每点不超过两行。只分析能看清的，看不清的如实说"无法判断"。'
        ].join('\n');

        var content;
        if (USE_OPENAI_FORMAT) {
          content = [
            { type: 'image_url', image_url: { url: imgData } },
            { type: 'text', text: photoPrompt }
          ];
        } else {
          content = [
            { image: imgData },
            { text: photoPrompt }
          ];
        }

        try {
          console.log('[fengshui] 分析' + label + '照片 (' + Math.round((imgData||'').length/1024) + 'KB)...');
          var photoResult = await callAIWithFallback(FENGSHUI_SYSTEM, content);
          if (photoResult && photoResult.length >= 10) {
            photoAnalyses.push('### ' + label + '分析\n' + photoResult);
          }
        } catch(e) {
          console.error('[fengshui] ' + label + '分析失败:', e.message);
          photoAnalyses.push('### ' + label + '分析\n（该照片分析失败，请参考其他结果）');
        }
      }

      // 第二轮：综合总结
      var summaryPrompt = layoutText.join('\n') + '\n\n' +
        '以下是各房间照片的风水分析结果，请结合八宅理论给出综合总结：\n\n' +
        photoAnalyses.join('\n\n---\n\n') + '\n\n' +
        '请按照知识库要求的五段式输出格式给出完整的风水分析报告。';

      var summaryContent = [{ type: 'text', text: summaryPrompt }];
      console.log('[fengshui] 生成综合报告...');
      reading = await callAIWithFallback(FENGSHUI_SYSTEM, summaryContent);

    } else {
      // === 无照片：纯文本分析 ===
      console.log('[fengshui] 纯文本分析（无照片）');
      var textContent = [{ type: 'text', text: layoutText.join('\n') }];
      reading = await callAIWithFallback(FENGSHUI_SYSTEM, textContent);
    }

    if (!reading || reading.length < 30) {
      return res.status(500).json({ error: 'AI 返回异常，请稍后重试' });
    }

    // 扣费
    if (!monthlyActive) {
      var deducted = await deductCreditByUser(userId);
      if (!deducted) {
        return res.status(403).json({ error: '积分扣减失败', creditExhausted: true });
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
    console.error('[fengshui] 异常:', e.message);
    return res.status(500).json({ error: '服务异常，请稍后重试' });
  }
};
