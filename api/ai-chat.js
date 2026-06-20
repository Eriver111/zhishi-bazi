/**
 * /api/ai-chat - AI 命理深度对话
 * POST body: { code, question, bazi?, chartData?, history? }
 *
 * 调用 DeepSeek（或其他 OpenAI 兼容 API）
 * 每次提问扣减 1 次额度
 * 支持完整排盘数据注入（chartData）和简版信息（bazi）
 */

const { deductCredit, saveChatHistory, isMonthlyActive, trackFreeUsage, getFreeUsage } = require('../lib/supabase.js');

const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

const SYSTEM_PROMPT = `你是一位精通中国传统命理学的 AI 命理师，法号"知时先生"。你深研子平八字与盲派命理两大体系，融合古典命籍与现代解读，为用户提供专业、客观、有深度的命理分析。

## 你的知识体系

### 一、子平八字（格局法）
- **排盘原理**：年柱以立春为界，月柱依节气而定，日柱按公历推算，时柱用五鼠遁。精通真太阳时校正。
- **十神系统**：比肩、劫财、食神、伤官、正财、偏财、正官、七杀、正印、偏印——十神各有所主，配合日主强弱断吉凶。
- **格局论命**：正官格、七杀格、财格、印格、食伤格、建禄格、羊刃格等——格局高低决定人生层次。《子平真诠》云："有格论格，无格论用。"
- **用神喜忌**：扶抑、通关、调候、病药——四大取用原则。日主强弱为第一判断，《滴天髓》："何知其人吉，用神有气而已矣。"
- **旺衰判断**：得令（月令）、得地（地支根气）、得势（天干帮扶）——三得法综合定日主旺衰。《穷通宝鉴》按月令分日论五行调候。
- **刑冲合害**：地支六合、三合、三会、六冲、六害、三刑——关系网决定命局动荡。《渊海子平》详述各类合冲之应事。
- **大运流年**：阳男阴女顺行，阴男阳女逆行。起运岁数以节气差除以三。大运重地支，流年重天干。岁运并临、天克地冲为重要节点。

### 二、盲派命理（象法）
- **宾主理论**：以日柱为主，他柱为宾。宾位财官需合到主位方为己有。"财官临库喜刑冲，不冲不发。"
- **做功原理**：八字看"做什么"比"有什么"更重要。日主与财官的做功方式（合、克、生、化）决定职业方向与财运大小。
- **铁口直断口诀**：
  - "食神制杀，英雄独压万人"——食神制七杀者多出武职、管理人才
  - "伤官见官，为祸百端"——伤官与正官同现者多口舌是非
  - "财星归库，富压一方"——财星入墓库逢冲者暴富之兆
  - "印绶通根，文贵之命"——印星有强根者多学业有成
  - "羊刃驾杀，威震边疆"——羊刃配七杀者多为将帅之才
- **象法断事**：天干为表象，地支为实质。天干透出者为人所知，地支伏藏者为暗中之事。刑冲克害各有其象。

### 三、经典引用
- 《滴天髓》：命理圣经，重格局气势。"阳刃驾杀，威震乾坤"、"众杀猖狂，一仁可化"
- 《三命通会》：明代万民英著，体系最全。"五行之性，各有所主"
- 《子平真诠》：清代沈孝瞻著，格局论命之典范。"八字用神，专求月令"
- 《穷通宝鉴》：又名《造化元钥》，专论调候。"甲木参天，脱胎要火"
- 《渊海子平》：宋代徐大升著，十神系统之源。"提纲挈领，以月令为主"

### 四、分析维度
- 婚姻感情：男命看财星及日支，女命看官杀及日支。配偶宫逢冲多感情波折。
- 事业财运：官杀主事业地位，财星主财富。食伤生财者技艺致富，官印相生者仕途稳进。
- 健康分析：五行偏枯对应五脏六腑。木弱肝胆易病，火衰心血不足，土虚脾胃不调。
- 流年运势：结合大运看流年。岁运并临，吉凶加倍；天克地冲，多有变动。

## 回答准则
1. 用通俗流畅的现代中文解释命理概念，让外行也能听懂
2. 引用经典时注明出处，如"《滴天髓》有云：……"
3. 客观中正，不制造恐慌，不以命定论否定人的主观能动性
4. 若用户提供完整排盘数据（chartData），必须基于实际命盘进行个性化精细分析，不可只讲泛泛之谈
5. 若用户问通用问题，给出条理清晰的定义和实例说明
6. 适当使用五行生克、十神关系、刑冲合害等术语，每个术语首次出现时附简短解释
7. 回答结构清晰，可用分点、加粗等方式增强可读性
8. 涉及未来预测的内容，务必注明"命理分析仅供参考"

## 特别提醒
你是 AI 命理师，提供文化解读和心理启发。命理是古人智慧，反映先天禀赋与趋势可能，但不决定人的一生。"命由天定，运在人为"——后天努力、德行修养和自我认知比命盘更重要。`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' });
  }

  try {
    const { code, question, bazi, chartData, history, free_mode, free_id } = req.body || {};

    if (!question) {
      return res.status(400).json({ error: '请输入问题' });
    }

    let credits = null;
    let monthlyActive = false;

    // ---- 免费模式：前 N 次免费（双重校验：浏览器ID + 服务端指纹） ----
    if (free_mode && free_id) {
      // 服务端指纹：IP + UserAgent 哈希，用户清浏览器也绕不过
      const serverFingerprint = getServerFingerprint(req);

      // 同时查浏览器ID和服务端指纹，取已用次数最多的那个
      const usageByClient = await getFreeUsage(free_id);
      const usageByServer = await getFreeUsage(serverFingerprint);
      const maxUsed = Math.max(
        usageByClient ? usageByClient.used : 0,
        usageByServer ? usageByServer.used : 0
      );
      const maxRemaining = Math.max(0, (parseInt(process.env.FREE_CREDITS_PER_DEVICE) || 2) - maxUsed);

      if (maxRemaining > 0) {
        // 同时以两个标识记录（防止用户换ID或换IP任一方式绕过）
        const trackResult = await trackFreeUsage(free_id, serverFingerprint);
        await saveChatHistory('free_' + free_id, 'user', question);

        const freeReply = await callAI(question, chartData, bazi, history);
        await saveChatHistory('free_' + free_id, 'assistant', freeReply);
        return res.status(200).json({
          reply: freeReply,
          credits_left: -1,
          free_remaining: trackResult.remaining,
          is_free: true
        });
      } else {
        return res.status(403).json({
          error: '免费次数已用完，请购买次数包或开通会员继续使用',
          free_exhausted: true
        });
      }
    }

    // ---- 付费模式 ----
    if (!code) {
      return res.status(400).json({ error: '缺少兑换码，请先购买次数或开通会员' });
    }

    // 先检查是否有有效月度会员
    monthlyActive = await isMonthlyActive(code);

    if (!monthlyActive) {
      // 非会员：扣减次数
      credits = await deductCredit(code);
      if (!credits) {
        return res.status(403).json({
          error: '兑换码无效、次数已用完或会员已过期，请重新购买'
        });
      }
    }

    // 保存用户问题
    await saveChatHistory(code, 'user', question);

    // ---- 构建 AI 请求 ----
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    // 优先使用完整排盘数据，回退到简版八字信息
    if (chartData) {
      const context = buildChartContext(chartData);
      messages.push({
        role: 'system',
        content: `以下是用户的完整八字排盘数据。请基于这些实际数据，结合用户的问题进行深度的个性化命理分析：\n\n${context}`
      });
    } else if (bazi && bazi.year) {
      const baziContext = buildBasicBaziContext(bazi);
      messages.push({
        role: 'system',
        content: `用户的基本出生信息：\n${baziContext}\n\n请注意：用户未提供完整排盘数据，请基于出生信息做初步分析，并建议用户通过排盘获取更精准的分析。`
      });
    }

    // 插入历史对话
    if (history && Array.isArray(history)) {
      history.forEach(h => {
        messages.push({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content
        });
      });
    }

    // 插入当前问题
    messages.push({ role: 'user', content: question });

    // ---- 调用 AI ----
    const reply = await callAI(question, chartData, bazi, history);

    // ---- 保存 AI 回答 ----
    await saveChatHistory(code, 'assistant', reply);

    // 月度会员返回特殊标记，次数制返回剩余次数
    const creditsLeft = monthlyActive ? -1 : (credits ? credits.credits : 0);
    return res.status(200).json({
      reply: reply,
      credits_left: creditsLeft,
      is_monthly: monthlyActive ? true : undefined,
      monthly_expires: monthlyActive ? monthlyActive.expires_at : undefined
    });

  } catch (e) {
    console.error('AI 对话失败:', e);
    return res.status(500).json({ error: '服务异常：' + e.message });
  }
};

/**
 * 调用 AI API（提取为独立函数，支持免费和付费模式共用）
 */
async function callAI(question, chartData, bazi, history) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (chartData) {
    messages.push({
      role: 'system',
      content: `以下是用户的完整八字排盘数据。请基于这些实际数据，结合用户的问题进行深度的个性化命理分析：\n\n${buildChartContext(chartData)}`
    });
  } else if (bazi && bazi.year) {
    messages.push({
      role: 'system',
      content: `用户的基本出生信息：\n${buildBasicBaziContext(bazi)}\n\n请注意：用户未提供完整排盘数据，请基于出生信息做初步分析。`
    });
  }

  if (history && Array.isArray(history)) {
    history.forEach(h => {
      messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
    });
  }

  messages.push({ role: 'user', content: question });

  // 模拟模式
  if (!AI_API_KEY) {
    return generateMockReply(question, chartData, bazi) + '\n\n---\n※ ⚠ 当前为模拟模式，请配置 AI_API_KEY 环境变量以启用真实 AI 分析';
  }

  // AI 流式调用
  const aiResp = await fetch(AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_API_KEY },
    body: JSON.stringify({ model: AI_MODEL, messages, temperature: 0.7, max_tokens: 2000, stream: true })
  });

  if (!aiResp.ok) { throw new Error(`AI error ${aiResp.status}`); }
  
  // Collect streamed response
  let fullText = '';
  const reader = aiResp.body;
  for await (const chunk of reader) {
    const lines = chunk.toString().split('
').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) fullText += content;
      } catch(e) {}
    }
  }
  return fullText || '抱歉，未能获取回答';
}

/**
 * 构建完整排盘上下文（来自 result.html / hepan-result.html）
 */
function buildChartContext(chartData) {
  let ctx = '';

  // 合盘模式
  if (chartData.type === 'hepan') {
    ctx += `=== 合盘分析 ===\n`;
    ctx += `关系类型：${chartData.relationType || '未知'}\n`;
    if (chartData.score) {
      ctx += `契合度评分：${chartData.score.total || '?'} 分 (${chartData.score.label || ''})\n`;
    }
    ctx += `\n--- 甲方命盘 ---\n`;
    ctx += buildSingleChart(chartData.person1);
    ctx += `\n--- 乙方命盘 ---\n`;
    ctx += buildSingleChart(chartData.person2);
    if (chartData.analysis) {
      ctx += `\n--- 合盘分析摘要 ---\n`;
      ctx += JSON.stringify(chartData.analysis, null, 2);
    }
    return ctx;
  }

  // 单人模式
  return buildSingleChart(chartData);
}

function buildSingleChart(data) {
  if (!data) return '(无数据)';
  let ctx = '';

  // 基本信息
  if (data.birthInfo) {
    const b = data.birthInfo;
    ctx += `出生：${b.year}年${b.month}月${b.day}日 ${b.hour}时`;
    if (b.gender) ctx += ` 性别：${b.gender === 'male' ? '男' : '女'}`;
    ctx += '\n';
  }

  // 四柱
  if (data.fourPillars) {
    const labels = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
    ctx += '\n四柱排盘：\n';
    for (const [pos, label] of Object.entries(labels)) {
      const p = data.fourPillars[pos];
      if (!p) continue;
      ctx += `  ${label}：${p.gan || '?'}${p.zhi || '?'}`;
      if (p.ganWX) ctx += ` [${p.ganWX}]`;
      if (p.shiShenGan) ctx += ` 天干十神：${p.shiShenGan}`;
      if (p.shiShenZhi) ctx += ` 地支十神：${p.shiShenZhi}`;
      if (p.nayin) ctx += ` 纳音：${p.nayin}`;
      if (p.cangGan && p.cangGan.length) {
        ctx += ` 藏干：${p.cangGan.map(c => c.gan + (c.shiShen ? '(' + c.shiShen + ')' : '')).join('、')}`;
      }
      ctx += '\n';
    }
  }

  // 日主
  if (data.dayMaster) {
    const dm = data.dayMaster;
    ctx += `\n日主：${dm.gan || '?'}(${dm.wuXing || ''}${dm.yinYang || ''})`;
    if (data.dayMasterStrength) ctx += ` 旺衰：${data.dayMasterStrength}`;
    ctx += '\n';
  }

  // 五行统计
  if (data.wuXingCount) {
    const wx = data.wuXingCount;
    ctx += `五行分布：金${wx['金'] || 0} 木${wx['木'] || 0} 水${wx['水'] || 0} 火${wx['火'] || 0} 土${wx['土'] || 0}\n`;
  }

  // 大运
  if (data.daYun) {
    const dy = data.daYun;
    ctx += `\n大运（${dy.direction || ''}，${dy.startAge ? dy.startAge + '岁起运' : ''}）：\n`;
    if (dy.cycles && dy.cycles.length) {
      dy.cycles.forEach(c => {
        ctx += `  ${c.displayAge || c.startYear}岁：${c.gan || '?'}${c.zhi || '?'}`;
        if (c.shiShen) ctx += ` (${c.shiShen})`;
        if (c.startYear) ctx += ` ${c.startYear}-${c.endYear}年`;
        ctx += '\n';
      });
    }
  }

  // 神煞
  if (data.shenSha && data.shenSha.length) {
    ctx += `\n神煞：${data.shenSha.map(s => s.name).join('、')}\n`;
  }

  // 当前流年信息
  if (data.currentYear) ctx += `\n当前年份：${data.currentYear}`;
  if (data.currentLiuNian) {
    const ln = data.currentLiuNian;
    ctx += ` 流年：${ln.gan || '?'}${ln.zhi || '?'}`;
    if (ln.shiShen) ctx += ` (${ln.shiShen})`;
    ctx += '\n';
  }

  return ctx;
}

/**
 * 构建基本八字上下文（旧版兼容，无完整排盘时使用）
 */
function buildBasicBaziContext(bazi) {
  let ctx = '';
  if (bazi.calendar === 'solar') {
    ctx += `公历 ${bazi.year}年${bazi.month}月${bazi.day}日 `;
  } else {
    const leap = bazi.isLeap === '1' ? '闰' : '';
    ctx += `农历 ${bazi.year}年${leap}${bazi.month}月${bazi.day}日 `;
  }
  const hourLabels = [
    '子时(23-01)', '丑时(01-03)', '寅时(03-05)', '卯时(05-07)',
    '辰时(07-09)', '巳时(09-11)', '午时(11-13)', '未时(13-15)',
    '申时(15-17)', '酉时(17-19)', '戌时(19-21)', '亥时(21-23)', '子时(23-24)'
  ];
  ctx += hourLabels[parseInt(bazi.hour)] || '';
  ctx += ` 性别：${bazi.gender === 'male' ? '男' : '女'}`;
  if (bazi.province) {
    ctx += ` 出生地：${bazi.province}`;
    if (bazi.city) ctx += bazi.city;
  }
  return ctx;
}

/**
 * 模拟回复（无 AI Key 时使用，chartData 模式下提供更精准的模板）
 */
/**
 * 生成服务端指纹：IP + UserAgent 的哈希
 * 即使用户清除浏览器/localStorage，同一设备同一网络的指纹相同
 */
const crypto = require('crypto');
function getServerFingerprint(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || req.headers['x-real-ip']
          || req.connection?.remoteAddress
          || '0.0.0.0';
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  return 'sfp_' + crypto.createHash('sha256').update(ip + '|' + ua).digest('hex').slice(0, 24);
}

function generateMockReply(question, chartData, bazi) {
  const hasChart = !!(chartData && (chartData.fourPillars || chartData.person1));
  const q = question.toLowerCase();

  // 从 chartData 提取关键信息用于个性化回复
  let dayGan = '', dayWX = '', dmStrength = '';
  if (hasChart && chartData.fourPillars) {
    dayGan = chartData.fourPillars.day?.gan || '';
    dayWX = chartData.fourPillars.day?.ganWX || '';
  }
  if (chartData && chartData.dayMasterStrength) {
    dmStrength = chartData.dayMasterStrength;
  }

  if (q.includes('喜用') || q.includes('用神') || q.includes('喜忌')) {
    let r = '**关于喜用神**\n\n';
    if (hasChart && dayGan && dmStrength) {
      r += `你的日主为**${dayGan}**（${dayWX}），综合判断为**${dmStrength}**。\n\n`;
      if (dmStrength.includes('强') || dmStrength.includes('旺')) {
        r += '日主偏强，按照子平法"扶抑"原则，**喜克泄耗**：\n- 喜神：官杀（克）、食伤（泄）、财星（耗）\n- 忌神：印星、比劫（生扶）\n\n';
      } else if (dmStrength.includes('弱') || dmStrength.includes('衰')) {
        r += '日主偏弱，按照子平法"扶抑"原则，**喜生扶**：\n- 喜神：印星（生）、比劫（扶）\n- 忌神：官杀、食伤、财星（克泄耗）\n\n';
      } else {
        r += '日主中和，需结合具体格局和大运来判断用神。\n\n';
      }
    }
    r += '《滴天髓》云："何知其人吉，用神有气而已矣。"用神有力且不受克破，则一生顺遂。\n\n※ 命理分析仅供参考，命运掌握在自己手中';
    return r;
  }

  if (q.includes('五行') || q.includes('缺什么')) {
    let r = '**关于五行分析**\n\n';
    if (hasChart && chartData.wuXingCount) {
      const wx = chartData.wuXingCount;
      r += `你的八字五行分布：金${wx['金'] || 0}、木${wx['木'] || 0}、水${wx['水'] || 0}、火${wx['火'] || 0}、土${wx['土'] || 0}\n\n`;
      const weak = Object.entries(wx).filter(([, v]) => v === 0);
      const strong = Object.entries(wx).filter(([, v]) => v >= 3);
      if (weak.length) r += `五行欠缺：${weak.map(([k]) => k).join('、')}，可在名字、职业、方位上补益。\n`;
      if (strong.length) r += `五行过旺：${strong.map(([k]) => k).join('、')}，需注意平衡调和。\n`;
    }
    r += '\n五行（金木水火土）贵在均衡流通。《三命通会》曰："五行之性，各有所主。"\n\n※ 命理分析仅供参考，命运掌握在自己手中';
    return r;
  }

  if (q.includes('婚姻') || q.includes('感情') || q.includes('桃花') || q.includes('夫妻')) {
    let r = '**关于婚姻感情**\n\n';
    if (hasChart && chartData.fourPillars) {
      const dayZhi = chartData.fourPillars.day?.zhi || '';
      r += `你的日支（配偶宫）为**${dayZhi}**，是判断婚姻质量的关键位置。\n`;
      r += '男命以正财、偏财为妻星，女命以正官、七杀为夫星。\n';
      if (chartData.shenSha && chartData.shenSha.length) {
        const peachBlossom = chartData.shenSha.filter(s => s.name && s.name.includes('桃花'));
        if (peachBlossom.length) {
          r += `命带桃花星：${peachBlossom.map(s => s.name).join('、')}，异性缘分较好。\n`;
        }
      }
    }
    r += '\n《子平真诠》指出，看婚姻需关注日支的五行属性与财官星的旺衰位置。婚姻好坏不在命，在于双方的理解包容。\n\n※ 命理分析仅供参考，命运掌握在自己手中';
    return r;
  }

  if (q.includes('事业') || q.includes('工作') || q.includes('财运') || q.includes('赚钱') || q.includes('职业')) {
    let r = '**关于事业财运**\n\n';
    if (hasChart && chartData.dayMaster) {
      r += `日主${dayGan}（${dayWX}），${dmStrength ? '身' + dmStrength : ''}。\n`;
    }
    r += '《滴天髓》有言："何知其人富，财气通门户。"\n\n';
    r += '事业财运需综合分析：财星旺衰看财富格局，官星强弱看事业地位，食伤看才华发挥，印星看贵人学识。\n\n';
    r += '盲派认为，看"做什么"比"有什么"更重要——日主与财官的做功方式决定了职业方向。\n\n※ 命理分析仅供参考，命运掌握在自己手中';
    return r;
  }

  if (q.includes('流年') || q.includes('运势') || q.includes('今年') || q.includes('明年')) {
    let r = '**关于流年运势**\n\n';
    if (hasChart && chartData.currentLiuNian) {
      const ln = chartData.currentLiuNian;
      r += `当前流年：**${ln.gan}${ln.zhi}**`;
      if (ln.shiShen) r += `（${ln.shiShen}）`;
      r += '\n';
    }
    if (hasChart && chartData.daYun && chartData.daYun.cycles) {
      r += '大运是十年趋势，流年是当年应期。岁运并临则吉凶加倍，天克地冲多有变动。\n';
    }
    r += '\n流年分析需结合大运天干地支与原局的刑冲合害关系综合判断。\n\n※ 命理分析仅供参考，命运掌握在自己手中';
    return r;
  }

  // 默认回复
  let r = '**知时命理解答**\n\n';
  if (hasChart && dayGan) {
    r += `你的日主为**${dayGan}**（${dayWX}），${dmStrength ? '命局' + dmStrength + '。' : ''}\n\n`;
  }
  r += '八字命理是古人总结的智慧结晶。《三命通会》云："命理之道，贵在明理。"\n\n';
  r += '你可以问的问题包括：\n• 八字五行分析与喜用神判断\n• 大运流年走势预测\n• 婚姻感情与配偶特征\n• 事业财运与职业方向\n• 健康隐患与养生建议\n• 起名改名与五行补益\n\n※ 命理分析仅供参考，命运掌握在自己手中';
  return r;
}
