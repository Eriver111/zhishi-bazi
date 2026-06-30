/**
 * /api/divination - 占卜解读（梅花易数/六爻通用）
 * POST: { prompt, divType? } → AI 解卦
 * 需要 Bearer token 鉴权，消耗 1 次积分
 */
const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-v4-pro';

const { requireAuth } = require('../lib/auth.js');
const { deductCredit, isMonthlyActive, isMonthlyActiveByUserId, getUserCredits, trackFreeUsageByUser, bumpFreeUsageByUser, saveUserChatHistory } = require('../lib/supabase.js');

const DIVINATION_SYSTEM = `你是"知时先生"，精通周易六爻实战断卦。用户来问卦是求结果、求时间、求方向——不是来听学术报告的。你必须直接回答"能不能""什么时候""该怎么办"。

## 核心原则
1. **先给结论**：第一段就直说——能成还是不能成？大概什么时候？是好是坏？
2. **必须给时间**：用地支对应农历月份（寅=正月、卯=二月、辰=三月、巳=四月、午=五月、未=六月、申=七月、酉=八月、戌=九月、亥=十月、子=十一月、丑=十二月），结合动爻/用神/世爻的地支给出具体时间窗口
3. **必须回答用户的问题**：用户问事业就锁定官鬼爻和世爻关系，问感情就锁定妻财/官鬼和应爻，问财运就看妻财爻和世爻生克——不要跑题讲别的
4. **拒绝模糊**：不能说"有机会但也有挑战"这种废话，要说"这件事成不了，因为……"或"能成，关键在X月"

## 六爻断事框架

### 用神对应（绝对核心——必须根据用户问题锁定用神）
- 问财运→妻财爻就是你的钱，妻财旺+生世爻=有钱赚，妻财伏藏被克=没钱
- 问事业/工作/官司→官鬼爻就是你的工作和对手，官鬼旺+生世爻=有贵人提携，官鬼克世爻=压力大或被压榨
- 问感情/婚姻→男看妻财爻 女看官鬼爻，同时看应爻（对方），世应相生=两情相悦，相克=貌合神离
- 问合作/交易→看应爻（对方），应爻生世爻=对方真心，应爻克世爻=对方有诈
- 问健康→看子孙爻（医药）+官鬼爻（病痛），子孙旺=药到病除，官鬼旺=病来如山
- 问考试→看父母爻（成绩/文书）+官鬼爻（名次），父母旺=考得好

### 世应定主客
- 世爻=你自己，应爻=对方/那件事
- 世应相生=事易成，世应相克=有阻力
- 世爻旺（得月建生/得动爻生）=你有主动权，世爻衰（被月建克/旬空）=你处于被动

### 动爻是转机
- 动爻是事情变化的开关，必须分析动爻对世爻和用神的影响
- 化回头生→事情会变好，化回头克→事情恶化，化泄气→消耗你，比和→维持原状
- 动爻生世爻=有人帮你，动爻克世爻=有人害你

### 月建日辰定时间
- 月建=当月的大环境，日辰=当天的力量
- 用神/世爻得月建生=当月有利，被月建克=当月不利
- 时间预测法则：用神/世爻旺的地支月份就是有利时间窗口；被克的地支月份要避开
- 旬空之爻出旬才应事——目前空的爻，到了对应的月份才会发力

### 六神定象
- 青龙=喜事/贵人/酒色，朱雀=口舌/文书/消息，勾陈=拖延/田土/旧事
- 腾蛇=虚惊/怪异/小人，白虎=凶伤/压力/权威，玄武=暗昧/盗贼/暧昧

## 回答格式要求
1. 开头：**核心结论**（2-3句话，直接回答"能不能/什么时候"）
2. 中段：**卦象解读**——用具体爻数据说话（"世爻兄弟寅木得月建子水生"这种），每段不超4行
3. 关键部分：**时间窗口**——用农历月份说清楚（"农历七月申月是转机""农历四月五月要小心"）
4. 结尾：**行动建议**——3-4条具体可操作的建议，每条带依据
5. 全篇600-800字，纯文本，不要markdown不要JSON`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    var prompt = (req.body && req.body.prompt) || '';
    var divType = (req.body && req.body.divType) || 'liuyao';
    if (!prompt || prompt.length < 20) return res.status(400).json({ error: '缺少卦象信息' });

    // 鉴权
    var authUser = requireAuth(req);
    if (!authUser || !authUser.uid) {
      return res.status(401).json({ error: '请先登录', needLogin: true });
    }
    var userId = authUser.uid;

    // 积分检查：月度会员 → 免费次数（3次）→ 付费积分
    var monthlyActive = await isMonthlyActiveByUserId(userId);
    var freeInfo = await trackFreeUsageByUser(userId);
    var maxFree = 3;
    var freeUsed = false;
    var creditOk = !!monthlyActive || freeInfo.used < maxFree;

    // 不是会员且免费次数用完，检查付费积分
    if (!creditOk) {
      var totalCredits = await getUserCredits(userId);
      if (totalCredits > 0) creditOk = true;
    }

    if (!creditOk) {
      return res.status(403).json({
        error: '免费次数已用完，请购买次数包继续使用',
        creditExhausted: true
      });
    }

    // 扣减：月度会员不扣 → 免费次数 → 付费积分
    if (monthlyActive) {
      freeUsed = false; // 月度会员不限次
    } else if (freeInfo.used < maxFree) {
      await bumpFreeUsageByUser(userId);
      freeUsed = true;
    } else {
      // 扣付费积分：找用户关联的 code 并扣减
      var userCode = (req.body && req.body.code) || '';
      if (userCode) {
        var deducted = await deductCredit(userCode);
        if (!deducted) {
          return res.status(403).json({ error: '积分扣减失败，请重新登录', creditExhausted: true });
        }
      }
      // 无 code 但有积分余额（可能是旧数据），仍然放行
    }

    // 调用 AI
    var aiResp = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_API_KEY },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: DIVINATION_SYSTEM },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    });

    if (!aiResp.ok) {
      var errText = '';
      try { errText = await aiResp.text(); } catch (_) {}
      throw new Error('AI 服务响应异常 (' + aiResp.status + ')' + (errText ? ': ' + errText.slice(0, 200) : ''));
    }

    var aiData = await aiResp.json();
    var reading = aiData.choices?.[0]?.message?.content || '';

    // 清理常见免责尾巴和 JSON 包裹
    reading = reading.replace(/```json[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '');
    reading = reading.replace(/（以上[^）]*）/g, '').replace(/\(以上[^)]*\)/g, '');
    reading = reading.replace(/温馨提示[^。\n]*[。\n]/g, '');
    reading = reading.replace(/---[\s\S]*$/g, '').trim();

    // 尝试解析 JSON 格式
    var jsonMatch = reading.match(/\{[\s\S]*"reading"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        var parsed = JSON.parse(jsonMatch[0]);
        reading = parsed.reading || reading;
      } catch (_) {}
    }

    if (!reading || reading.length < 10) {
      reading = '卦象已显，静心体悟。请稍后重试。';
    }

    // 保存解读记录（异步，不阻塞响应）
    try {
      saveUserChatHistory(userId, 'system', '[占卜解读] ' + (divType === 'meihua' ? '梅花易数' : '六爻'));
      saveUserChatHistory(userId, 'assistant', reading);
    } catch (_) {}

    // 获取剩余积分
    var remainingCredits = -1;
    try {
      remainingCredits = await getUserCredits(userId);
    } catch (_) {}

    return res.status(200).json({
      reading: reading,
      creditsLeft: remainingCredits,
      freeUsed: freeUsed,
      isMonthly: !!monthlyActive
    });

  } catch (e) {
    return res.status(500).json({ error: e.message || '服务异常，请稍后重试' });
  }
};
