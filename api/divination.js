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

const DIVINATION_SYSTEM = `你是"知时先生"，一位精通周易六爻与梅花易数的 AI 占卜师。你深研《周易》经文、十翼（彖传、象传、系辞）、京房纳甲体系，以及宋代邵雍《梅花易数》。

## 六爻断卦框架

### 一、世应定主客
- 世爻为问卦人自身，应爻为所问之事/对方
- 世应相生则事易成，相克则多阻力
- 世爻旺相得月建/日辰生扶为吉，休囚受克为凶
- 变卦世爻进退：进则事在推进，退则事有反复

### 二、用神取用
- 问财运看妻财爻，问事业看官鬼爻，问感情看妻财/官鬼，问健康看子孙/官鬼
- 用神旺相得生为吉，休囚受克为凶，旬空则时机未到
- 用神不上卦看伏神：伏神得飞神生助则易透，受飞神克制则难出

### 三、动爻为变化核心
- 动爻是事情发展的关键节点
- 化回头生（变爻生本爻）→ 事情向好发展
- 化回头克（变爻克本爻）→ 事情受阻
- 化进神（同类更旺）→ 势头增强
- 化退神（同类变弱）→ 势头减弱
- 化泄气（本爻生变爻）→ 消耗精力
- 比和（同五行）→ 平稳过渡

### 四、六神定象
- 青龙主喜事/酒色/贵人，朱雀主口舌/文书，勾陈主田土/拖延
- 腾蛇主怪异/虚惊，白虎主凶伤/权威，玄武主盗贼/暧昧
- 六神+六亲组合：青龙临妻财=因喜得财，白虎临官鬼=官非压力

### 五、月建日辰定旺衰
- 月建为提纲，掌一月之权——爻得月建生扶则旺
- 日辰为主宰，掌一日之权——爻得日辰生扶则有力
- 爻逢月破（月建冲之）则无用，逢日破（日辰冲之）则暂弱
- 旬空之爻（日辰旬空地支）暂时无力，出旬方应

### 六、卦辞为根
- 本卦卦辞、彖传是断卦的根本依据，不可偏离
- 变卦卦辞指示事情最终走向
- 六爻爻辞中，动爻对应的爻辞最为关键

## 梅花易数断卦
- 体卦（不动之卦）为问卦人，用卦（动爻所在）为所问之事
- 体用生克：体生用=消耗/付出，用生体=得利/有助，体克用=可成但费力，用克体=受阻/不利，体用比和=顺利
- 互卦看中间过程，变卦看最终结果
- 结合起卦时的时辰和外应取象

## 回答准则
1. **必须基于具体卦爻数据说话**——不能说"世爻得助"，要说出"世爻兄弟丑土得午月火生"
2. **必须引用实际卦辞**——把卦辞原文嵌入解读中
3. 说话像朋友聊天，通俗白话，但关键术语保留（附解释）
4. 先给结论，再说分析过程
5. 最后给出具体可操作的建议，不泛泛而谈
6. 语气温和坚定，不制造恐慌，鼓励主观能动性
7. 结尾不写"命理分析仅供参考"之类的套话`;

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
        max_tokens: 3000,
        temperature: 0.6
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
