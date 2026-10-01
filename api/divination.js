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

const DIVINATION_SYSTEM = `你是"知时先生"，精通周易六爻实战断卦。按用户实际问题回答；问分工就说责任、交接和阻力，不强行改成问成败或应期。

## 核心原则
1. **先给结论**：第一段直接说最主要的倾向或问题，依据支持哪里就说到哪里，不以“待复核”“无法确定”代替分析，也不保证现实结果。
2. **排盘不可改写**：用户消息里的“排盘专业数据”具有最高优先级。卦名、卦宫、世应、六亲、纳甲、月建、日辰、旬空、月破、伏神和动变关系必须逐字采用，禁止凭模型记忆自行改卦或重新装卦
3. **必须回答用户的问题**：用户问事业就锁定官鬼爻和世爻关系，问感情就锁定妻财/官鬼和应爻，问财运就看妻财爻和世爻生克——不要跑题讲别的
4. **时间必须有依据**：可以给时间窗口，但必须依据值、冲、合、出空、填实、月破填实或动爻变化；依据不足时说明是宽窗口，不得只把地支机械转成月份
5. **拒绝空话**：不能只说"有机会但也有挑战"，结论后必须紧跟具体爻位依据

## 六爻断事框架

### 用神对应（绝对核心——必须根据用户问题锁定用神）
- 问财运→看妻财、世爻、兄弟及动变；区分收入机会、支出和竞争，不把妻财旺直接说成赚钱。
- 问事业/工作→看官鬼、父母和世爻；区分任务压力、考核要求与资源，不能断定有人提携或陷害。
- 问感情/婚姻→结合所问关系看用神与世应；相生相克不是双方真实感情或品行的证明。
- 问合作/课程分工→看世应、父母文书、兄弟协作；说明责任不清、交接反复等具体卡点，不虚构成员身份、性格和付出。
- 问身体状况→只允许概括状况变化对日常安排的影响，不提供医疗判断或建议。
- 问考试→看父母、官鬼、世爻与动变，不能把父母旺直接写成考得好。

### 世应定主客
- 世爻=你自己，应爻=对方/那件事
- 世应相生相克只作配合或牵制线索，不能证明事情必成或对方品行
- 世爻旺（得月建生/得动爻生）=你有主动权，世爻衰（被月建克/旬空）=你处于被动

### 动爻是转机
- 动爻是事情变化的开关，必须分析动爻对世爻和用神的影响
- 变爻生本爻才叫化回头生，变爻克本爻才叫化回头克；本爻生变爻为化泄气，本爻克变爻为化出所克，比和则力量延续
- 动爻生世爻看支持条件，克世爻看负担与约束，不能据此断言有人帮助或加害

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
1. 开头：核心判断（2-3句话，回答用户实际所问，给出有依据的主要倾向）
2. 中段：**卦象解读**——用具体爻数据说话（"世爻兄弟寅木得月建子水生"这种），每段不超4行
3. 关键部分：时间与安排——仅在问题需要且数据支持时分析应期；短期问题按其时间范围回答，不强制农历月份，不把已经过去的月份当作未来
4. 结尾：行动建议——2-3条对应实际卡点的安排；执行建议不是卦象预言的事实
5. 全篇600-800字，纯文本，不要markdown不要JSON`;

const MEIHUA_SYSTEM = `你是“知时先生”，精通梅花易数体用、互卦和动变推演。用户消息中的“梅花易数排盘事实”是程序已经算定的唯一课盘，必须逐字采用本卦、动爻、互卦、变卦、体卦、用卦及其五行，禁止自行重算或改卦。

断卦顺序：
1. 开头用两三句话直接回答用户所问之事的主要趋势，不说模棱两可的套话。
2. 本卦看当下大势；体卦代表问卦者或事情主体，用卦代表所问之事或外部条件。体用生克只表示当下主客关系，必须结合动爻、互卦和变卦综合判断，禁止凭“用生体/用克体”单项断终局。
3. 动爻爻辞是变化枢纽；互卦看事情中段和内部过程；变卦看后续走向。三者不得遗漏，也不得把六爻纳甲的世应、六亲、月建、日辰、六神等概念混入梅花解读。
4. 用户未提供起卦时空数据时，不得虚构旺衰、应期或精确日期；只能给有卦象依据的阶段性时间窗口，并明确依据。
5. 所有判断必须在后面紧跟卦象依据。用通俗中文，专业术语第一次出现时顺手解释。

输出依次为“核心结论、当下局面、事情如何变化、最终走向”。纯文本，约400—600字，不要JSON，不要Markdown标题符号。占卜仅作传统文化参考。`;

const OUTPUT_BOUNDARY = `
共同输出边界（优先于旧客户端的格式要求）：
按问题所问的生活场景回答。具体说哪件事、什么环节、什么代价；不要迎合用户的预设，不用天赋、贵人、化险为夷美化不利线索。不能把传统卦象解释当成已证实的现实事实或预言。
不出现“待复核”“数据不足无法判断”式占位段落；省略没有支撑的分支，直接写有依据的主要判断和理由，但不得编造确定性。
不得提供医疗建议，不提医院、检查、治疗、用药、疾病名称、身体部位或具体伤害；只能概括身体状况变化及日常安排受到影响。
不要把假设写成已发生；禁止“验收没问题”“肯定能成”“最终能交差”等结果保证，禁止单凭卦象认定他人欺诈或恶意。
先识别所问日期范围；问下周就聚焦下周，不强行推荐农历月份。没有公历映射就不猜具体日期，不将地支月等同于农历月。安排建议可使用“提交前、分工时、合并文档时”等任务节点。
纯文本，不使用星号或Markdown标题。`;
const { cleanReading, readingIssue } = require('../lib/divination-quality.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  var guard;
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

    // 同一账号只允许一个占卜请求在途，避免并发请求穿透次数检查。
    guard = beginAiRequest(req, { route: 'divination', identity: userId, minuteMax: 4, hourMax: 24 });
    if (!guard.ok) return res.status(429).json({ error: guard.reason === 'concurrent' ? '上一次解读还在生成，请稍候' : '请求过于频繁，请稍后再试' });

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

    // 先生成并校验，再扣次数；失败与并发拦截不消耗额度。
    var messages = [
      { role: 'system', content: (divType === 'meihua' ? MEIHUA_SYSTEM : DIVINATION_SYSTEM) + OUTPUT_BOUNDARY + '\n当前北京时间日期：' + new Date(Date.now()+8*3600000).toISOString().slice(0,10) },
      { role: 'user', content: prompt }
    ];
    var reading = '', issue = '';
    for (var attempt=0; attempt<2; attempt++) {
      var aiResp = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_API_KEY },
        body: JSON.stringify({model:AI_MODEL,messages:messages,thinking:{type:'disabled'},max_tokens:1500,temperature:0.3}),
        signal: AbortSignal.timeout(45000)
      });
      if (!aiResp.ok) throw new Error('AI upstream failed');
      var aiData = await aiResp.json();
      reading = cleanReading(aiData.choices?.[0]?.message?.content || '');
      issue = readingIssue(reading);
      if (!issue) break;
      messages.push({role:'assistant',content:reading},{role:'user',content:'上一稿未通过输出校验：'+issue+'。请保留有数据支持的分析，删除越界内容，直接重写完整解读，不要解释校验过程。'});
    }
    if (issue) return res.status(502).json({error:'本次解读未生成成功，未扣次数，请重试'});

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
  } finally {
    if (guard && guard.ok) guard.release();
  }
};
