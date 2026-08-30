/**
 * /api/divination - 占卜解读（梅花易数/六爻通用）
 * POST: { prompt, divType? } → AI 解卦
 * 需要 Bearer token 鉴权，消耗 1 次积分
 */
const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
// Keep billing predictable even when PM2 retains an older AI_MODEL value.
const AI_MODEL = 'deepseek-v4-flash';

const { requireAuth } = require('../lib/auth.js');
const { beginAiRequest } = require('../lib/ai-abuse-guard.js');
const { deductCredit, deductCreditByUser, isMonthlyActive, isMonthlyActiveByUserId, getUserCredits, trackFreeUsageByUser, bumpFreeUsageByUser, saveUserChatHistory } = require('../lib/supabase.js');

const DIVINATION_SYSTEM = `你是"知时先生"，精通周易六爻实战断卦。用户来问卦是求结果、求时间、求方向——不是来听学术报告的。你必须直接回答"能不能""什么时候""该怎么办"。

## 核心原则
1. **先给结论**：第一段就直说——能成还是不能成？大概什么时候？是好是坏？
2. **排盘不可改写**：用户消息里的“排盘专业数据”具有最高优先级。卦名、卦宫、世应、六亲、纳甲、月建、日辰、旬空、月破、伏神和动变关系必须逐字采用，禁止凭模型记忆自行改卦或重新装卦
3. **必须回答用户的问题**：用户问事业就锁定官鬼爻和世爻关系，问感情就锁定妻财/官鬼和应爻，问财运就看妻财爻和世爻生克——不要跑题讲别的
4. **时间必须有依据**：可以给时间窗口，但必须依据值、冲、合、出空、填实、月破填实或动爻变化；依据不足时说明是宽窗口，不得只把地支机械转成月份
5. **拒绝空话**：不能只说"有机会但也有挑战"，结论后必须紧跟具体爻位依据

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
- 变爻生本爻才叫化回头生，变爻克本爻才叫化回头克；本爻生变爻为化泄气，本爻克变爻为化出所克，比和则力量延续
- 动爻生世爻=有人帮你，动爻克世爻=有人害你

### 月建日辰定时间
- 月建=当月的大环境，日辰=当天的力量
- 逐爻优先采用排盘给出的“临月建、得月扶、得月生、泄于月、月克、克月、月破”等标签，不得用季节印象覆盖
- 应期要综合用神和动爻的值、冲、合，以及月破填实；同一个地支不能脱离旬空与生克单独定吉凶
- 旬空要区分出旬、冲空和填实。出旬通常首先是日级条件，也可能在值月填实，不等同于“到了对应月份才会发力”
- 日辰必须参与判断：日扶、日克、日冲、日合均可能改变爻的实际状态；数据未直接预计算时只做有依据的生克冲合，不编造暗动

### 六神定象
- 青龙=喜事/贵人/酒色，朱雀=口舌/文书/消息，勾陈=拖延/田土/旧事
- 腾蛇=虚惊/怪异/小人，白虎=凶伤/压力/权威，玄武=暗昧/盗贼/暧昧

### 射覆专章（猜物·猜事）
当用户问"我拿着什么""口袋里是什么""这个东西是什么"之类的问题时，按射覆逻辑断卦：
- **定类象**：先看动爻所临六亲——妻财爻动→金属/钱财/贵重品，父母爻动→文书/证件/衣服/包装物，子孙爻动→食物/药品/宠物/娱乐品，官鬼爻动→工具/器械/电子产品/工作用品，兄弟爻动→日常用品/随身物
- **看五行断材质**：用神地支五行→金=金属/白色、木=木质/绿色/条状、水=液体/黑色/流动、火=电子/红色/发热、土=陶瓷/黄色/方形
- **看六神断属性**：临青龙→新的/贵重的，临朱雀→红色/有文字，临白虎→锋利的/白色的/医疗相关，临玄武→隐藏的/黑色的/与水有关，临腾蛇→绳状/软质/缠绕物
- **看世应关系**：世爻生用神→你在找/想要这个东西，用神生世爻→这个东西对你有用，世克用→你能掌控它，用克世→这个东西让你不舒服
- **结合动变**：用神发动化进→东西在变大/增值，化退→消耗品/逐渐减少，化空→不在了/空的
- **结论格式**：先说是什么大类（金属/木质/食物/文书等），再说具体可能是什么（3个候选），最后说材质/颜色/状态

## 回答格式要求
1. 开头：**核心结论**（2-3句话，直接回答"能不能/什么时候"）
2. 中段：**卦象解读**——用具体爻数据说话（"世爻兄弟寅木得月建子水生"这种），每段不超4行
3. 关键部分：**时间窗口**——用农历月份说清楚（"农历七月申月是转机""农历四月五月要小心"）
4. 结尾：**行动建议**——3-4条具体可操作的建议，每条带依据
5. 全篇600-800字，纯文本，不要markdown不要JSON`;

const MEIHUA_SYSTEM = `你是“知时先生”，精通梅花易数体用、互卦和动变推演。用户消息中的“梅花易数排盘事实”是程序已经算定的唯一课盘，必须逐字采用本卦、动爻、互卦、变卦、体卦、用卦及其五行，禁止自行重算或改卦。

断卦顺序：
1. 开头用两三句话直接回答用户所问之事的主要趋势，不说模棱两可的套话。
2. 本卦看当下大势；体卦代表问卦者或事情主体，用卦代表所问之事或外部条件。体用生克只表示当下主客关系，必须结合动爻、互卦和变卦综合判断，禁止凭“用生体/用克体”单项断终局。
3. 动爻爻辞是变化枢纽；互卦看事情中段和内部过程；变卦看后续走向。三者不得遗漏，也不得把六爻纳甲的世应、六亲、月建、日辰、六神等概念混入梅花解读。
4. 用户未提供起卦时空数据时，不得虚构旺衰、应期或精确日期；只能给有卦象依据的阶段性时间窗口，并明确依据。
5. 所有判断必须在后面紧跟卦象依据。用通俗中文，专业术语第一次出现时顺手解释。

输出依次为“核心结论、当下局面、事情如何变化、最终走向”。纯文本，约400—600字，不要JSON，不要Markdown标题符号。占卜仅作传统文化参考。`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    var prompt = (req.body && req.body.prompt) || '';
    var divType = (req.body && req.body.divType) || 'liuyao';
    if (divType !== 'liuyao' && divType !== 'meihua') return res.status(400).json({ error: '不支持的占卜类型' });
    if (!prompt || prompt.length < 20) return res.status(400).json({ error: '缺少卦象信息' });

    // 鉴权
    var authUser = requireAuth(req);
    if (!authUser || !authUser.uid) {
      return res.status(401).json({ error: '请先登录', needLogin: true });
    }
    var userId = authUser.uid;

    // 积分检查：月度会员 → 免费次数（3次）→ 付费积分
    var monthlyActive = await isMonthlyActiveByUserId(userId);
    // 回退：如果 userId 查不到，尝试用兑换码查询（兼容旧版订阅数据）
    if (!monthlyActive) {
      var code = (req.body && req.body.code) || '';
      if (code) monthlyActive = await isMonthlyActive(code);
    }
    var freeInfo = await trackFreeUsageByUser(userId);
    var fb = parseInt(process.env.FREE_CREDITS_PER_DEVICE); var base = isNaN(fb) ? 2 : fb; var maxFree = base + 2;
    var freeUsed = false;
    var creditOk = !!monthlyActive || freeInfo.used < maxFree;

    // 不是会员且免费次数用完，检查付费积分
    var hasPaidCredits = false;
    if (!creditOk) {
      var totalCredits = await getUserCredits(userId);
      if (totalCredits > 0) { creditOk = true; hasPaidCredits = true; }
    }

    if (!creditOk) {
      return res.status(403).json({
        error: '免费次数已用完（已用'+freeInfo.used+'/'+maxFree+'次），请购买次数包继续使用',
        creditExhausted: true,
        free_used: freeInfo.used,
        free_max: maxFree
      });
    }

    // 扣减：月度会员不扣 → 免费次数 → 付费积分
    if (monthlyActive) {
      freeUsed = false; // 月度会员不限次
    } else if (freeInfo.used < maxFree) {
      await bumpFreeUsageByUser(userId);
      freeUsed = true;
    } else if (hasPaidCredits) {
      // 扣付费积分：优先用传入的 code，否则用 userId 关联的积分
      var userCode = (req.body && req.body.code) || '';
      var deducted = null;
      if (userCode) {
        deducted = await deductCredit(userCode);
      }
      if (!deducted) {
        deducted = await deductCreditByUser(userId);
      }
      if (!deducted) {
        return res.status(403).json({ error: '积分扣减失败，请刷新页面重试', creditExhausted: true });
      }
    }

    // 同一账号只允许一个占卜请求在途，避免并发请求穿透次数检查。
    var guard = beginAiRequest(req, { route: 'divination', identity: userId, minuteMax: 4, hourMax: 24 });
    if (!guard.ok) return res.status(429).json({ error: guard.reason === 'concurrent' ? '上一次解读还在生成，请稍候' : '请求过于频繁，请稍后再试' });

    // 调用 AI
    var aiResp;
    try { aiResp = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_API_KEY },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: divType === 'meihua' ? MEIHUA_SYSTEM : DIVINATION_SYSTEM },
          { role: 'user', content: prompt }
        ],
        thinking: { type: 'disabled' },
        max_tokens: 1500,
        temperature: 0.3
      })
    }); } finally { guard.release(); }

    if (!aiResp.ok) {
      var errText = '';
      try { errText = await aiResp.text(); } catch (_) {}
      console.error('AI响应异常 status=' + aiResp.status + (errText ? ' ' + errText.slice(0,200) : '')); throw new Error('AI 服务暂时不可用，请稍后重试');
    }

    var aiData = await aiResp.json();
    console.log("[divination] respModel=" + (aiData.model || "?") + " at=" + new Date().toISOString());
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
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
};
