// V1 validator + context 剥除 + V2 触发器分类 单元测试（2026-08-14，GPT终裁落地自检）
// 从 api/ai-chat.js 抽取四个纯函数直接测试，不启动服务。
var fs = require('fs');
var path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai-chat.js'), 'utf8');

function extract(name) {
  var m = src.match(new RegExp('function ' + name + '[\\s\\S]*?\\n}'));
  if (!m) throw new Error('function not found: ' + name);
  eval(m[0]);
  return eval(name);
}
var runReplyValidation = extract('runReplyValidation');
var buildSingleChart = extract('buildSingleChart');
var isHardWarning = extract('isHardWarning');
var buildV2Instruction = extract('buildV2Instruction');

var pass = 0, fail = 0;
function T(desc, cond) {
  if (cond) { pass++; console.log('  PASS  ' + desc); }
  else { fail++; console.log('  FAIL  ' + desc); }
}

// ---------- ① 档位漂移 ----------
console.log('\n[① E4 档位漂移]');
var w = runReplyValidation({ dayMasterStrength: { level: '中和' } }, '您身弱不胜财，婚姻中容易付出多');
T('中和盘出现「身弱」→ 命中', w.some(function(x) { return x.indexOf('E4') >= 0 && x.indexOf('身弱') >= 0; }));
var w2 = runReplyValidation({ dayMasterStrength: { level: '偏弱' } }, '您身弱不胜财，需要印比帮扶');
T('偏弱盘出现「身弱」（同族）→ 不命中', !w2.some(function(x) { return x.indexOf('E4') >= 0; }));
var w3 = runReplyValidation({ dayMasterStrength: { level: '中和' } }, '日主中和偏弱之象');
T('中和盘出现「偏弱」（PAT07 型）→ 命中', w3.some(function(x) { return x.indexOf('E4') >= 0; }));
var w4 = runReplyValidation({ dayMasterStrength: { level: '偏强' } }, '身旺喜克泄耗');
T('偏强盘出现「身旺」（同族）→ 不命中', !w4.some(function(x) { return x.indexOf('E4') >= 0; }));
var w5 = runReplyValidation({ dayMasterStrength: { level: '偏弱' }, congGe: { isCong: true } }, '从弱格喜财官');
T('从格盘跳过档位检查 → 不命中', !w5.some(function(x) { return x.indexOf('E4') >= 0; }));

// ---------- ② 无冲合刑害 vs relationEvents ----------
console.log('\n[② E2 关系否定冲突]');
var w6 = runReplyValidation(
  { relationEvents: [{ type: '三合', pillars: ['year', 'day', 'hour'], involvesDay: true }] },
  '夫妻宫稳固，无冲合刑害'
);
T('涉日支事件 + 否定语 → 命中', w6.some(function(x) { return x.indexOf('E2') >= 0; }));
var w7 = runReplyValidation(
  { relationEvents: [{ type: '半会', pillars: ['year', 'month'], involvesDay: false }] },
  '夫妻宫稳固，无冲合刑害'
);
T('仅年月事件 + 否定语（S07 型正确用法）→ 不命中', !w7.some(function(x) { return x.indexOf('E2') >= 0; }));

// ---------- ③ 标准关系表 ----------
console.log('\n[③ E1 标准关系表]');
var w8 = runReplyValidation({}, '丙癸相合，财官有情');
T('丙癸相合（BND02 型）→ 命中五合错误', w8.some(function(x) { return x.indexOf('五合') >= 0; }));
var w9 = runReplyValidation({}, '丙辛合水，聪明灵秀');
T('丙辛合水（真五合）→ 不命中', !w9.some(function(x) { return x.indexOf('五合') >= 0; }));
var w10 = runReplyValidation({}, '水生土、土生金、金生水');
T('水生土（TH01 原文）→ 命中生克方向', w10.some(function(x) { return x.indexOf('生克') >= 0 && x.indexOf('水生土') >= 0; }));
var w10b = runReplyValidation({}, '水能生土');
T('水能生土（带"能"变体）→ 命中生克方向', w10b.some(function(x) { return x.indexOf('生克') >= 0 && x.indexOf('水能生土') >= 0; }));
var w11 = runReplyValidation({}, '水生木，木生火，火生土，土生金，金生水');
T('五行相生全链（全对）→ 不命中', !w11.some(function(x) { return x.indexOf('生克') >= 0; }));
var w12 = runReplyValidation({}, '金克木，木克土，土克水，水克火，火克金');
T('五行相克全链（全对）→ 不命中', !w12.some(function(x) { return x.indexOf('生克') >= 0; }));
var w13 = runReplyValidation({}, '土克火');
T('土克火（方向错）→ 命中', w13.some(function(x) { return x.indexOf('生克') >= 0; }));
var w14 = runReplyValidation(
  { fourPillars: { year: { zhi: '寅' }, month: { zhi: '卯' }, day: { zhi: '子' }, hour: { zhi: '丑' } } },
  '寅卯辰三会东方木局'
);
T('三会木局缺辰（PAT07 型）→ 命中缺员', w14.some(function(x) { return x.indexOf('缺员') >= 0 && x.indexOf('辰') >= 0; }));
var w15 = runReplyValidation(
  { fourPillars: { year: { zhi: '寅' }, month: { zhi: '卯' }, day: { zhi: '辰' }, hour: { zhi: '丑' } } },
  '寅卯辰三会东方木局'
);
T('三会三支齐 → 不命中', !w15.some(function(x) { return x.indexOf('缺员') >= 0; }));
var w16 = runReplyValidation(
  { fourPillars: { year: { zhi: '申' }, month: { zhi: '子' }, day: { zhi: '午' }, hour: { zhi: '丑' } } },
  '申子辰三合水局'
);
T('三合缺辰（两支在场）→ 命中并提示半合', w16.some(function(x) { return x.indexOf('缺员') >= 0 && x.indexOf('半合') >= 0; }));
var w17 = runReplyValidation(
  { fourPillars: { year: { zhi: '申' }, month: { zhi: '子' }, day: { zhi: '午' }, hour: { zhi: '丑' } },
    currentLiuNian: { zhi: '辰', gan: '甲' } },
  '申子辰三合水局'
);
T('缺辰但流年辰在场（运补型）→ 不命中', !w17.some(function(x) { return x.indexOf('缺员') >= 0; }));
var w17b = runReplyValidation(
  { fourPillars: { year: { zhi: '子' }, month: { zhi: '丑' }, day: { zhi: '寅' }, hour: { zhi: '午' } },
    currentDaYun: { gan: '乙', zhi: '卯' } },
  '乙卯财星与日支寅木三会木局'
);
T('PAT07 型：大运卯+日支寅「三会木局」缺辰 → 命中', w17b.some(function(x) { return x.indexOf('缺员') >= 0 && x.indexOf('辰') >= 0; }));
var w17c = runReplyValidation({}, '寅卯辰三会东方木局');
T('三会东方木局（带方位词）→ 方位不误报', !w17c.some(function(x) { return x.indexOf('方位五行错配') >= 0; }));
var w17d = runReplyValidation({}, '三会东方火局');
T('三会东方火局（方位五行错配）→ 命中', w17d.some(function(x) { return x.indexOf('方位五行错配') >= 0; }));

// ---------- ④ 十神映射 ----------
console.log('\n[④ E1 十神映射]');
var chart10 = {
  fourPillars: {
    year: { gan: '癸', zhi: '丑', shiShenGan: '七杀', shiShenZhi: '偏印',
            cangGan: [{ gan: '己', shiShen: '正印' }, { gan: '癸', shiShen: '七杀' }, { gan: '辛', shiShen: '偏财' }] },
    month: { gan: '甲', zhi: '寅', shiShenGan: '正印', shiShenZhi: '比肩',
             cangGan: [{ gan: '甲', shiShen: '正印' }] },
    day: { gan: '壬', zhi: '午', shiShenGan: '日主', shiShenZhi: '正财' },
    hour: { gan: '丙', zhi: '戌', shiShenGan: '偏财', shiShenZhi: '七杀' }
  }
};
var w18 = runReplyValidation(chart10, '月干甲木为食神，泄秀有功');
T('甲→正印 被写成食神 → 命中', w18.some(function(x) { return x.indexOf('十神映射') >= 0 && x.indexOf('甲') >= 0; }));
var w19 = runReplyValidation(chart10, '月干甲木为正印，化杀生身');
T('甲→正印 正确 → 不命中', !w19.some(function(x) { return x.indexOf('十神映射') >= 0; }));
var w20 = runReplyValidation(chart10, '年干癸水枭神夺食');
T('癸→七杀 别名（枭神≡偏印≠七杀）→ 命中', w20.some(function(x) { return x.indexOf('十神映射') >= 0; }));
var chart10b = {
  fourPillars: {
    month: { gan: '甲', shiShenGan: '偏印' },
    year: { gan: '癸', shiShenGan: '七杀' },
    day: { gan: '壬', shiShenGan: '日主' },
    hour: { gan: '丙', shiShenGan: '偏财' }
  }
};
var w21 = runReplyValidation(chart10b, '年干癸水七杀，得甲木枭神化杀');
T('癸→七杀 正确 + 枭神≡偏印 别名归一 → 不命中', !w21.some(function(x) { return x.indexOf('十神映射') >= 0; }));
var w22 = runReplyValidation(chart10, '壬水克丙火，火生土');
T('生克句式不触发十神检查 → 不命中', !w22.some(function(x) { return x.indexOf('十神映射') >= 0; }));

// ---------- Context 剥除（A 层） ----------
console.log('\n[A context 剥除]');
var bnd02Like = {
  dayBranchAnalysis: {
    branch: '亥', wuXing: '水', mainShiShen: '正官', ssDesc: '',
    rootType: '无根', rootScore: 0, stability: '稳固',
    summary: '日支亥为正官，无根。稳固——配偶宫根基扎实，感情稳定。无冲合刑害。；亥参与木局（未卯），日支有合局之助'
  },
  relationEvents: [{ type: '三合', pillars: ['year', 'day', 'hour'], involvesDay: true }]
};
var ctx1 = buildSingleChart(bnd02Like);
T('涉日支事件 → 剥除「无冲合刑害」', ctx1.indexOf('无冲合刑害') < 0);
T('剥除后保留合局信息「亥参与木局」', ctx1.indexOf('亥参与木局') >= 0);
T('剥除后保留稳定度信息「稳固」', ctx1.indexOf('稳固') >= 0);
var s04Like = {
  dayBranchAnalysis: {
    branch: '酉', wuXing: '金', mainShiShen: '偏财', ssDesc: '',
    rootType: '长生', rootScore: 3, stability: '稳固',
    summary: '日支酉为偏财，长生。稳固——配偶宫根基扎实，感情稳定。无冲合刑害。；酉为金局之一，待大运/流年补全'
  },
  relationEvents: [{ type: '半会', pillars: ['year', 'month'], involvesDay: false }]
};
var ctx2 = buildSingleChart(s04Like);
T('无涉日支事件 → 保留原综合行（S04 型）', ctx2.indexOf('无冲合刑害') >= 0 && ctx2.indexOf('待大运/流年补全') >= 0);
var allStrip = {
  dayBranchAnalysis: { summary: '无冲合刑害。', stability: '稳固' },
  relationEvents: [{ type: '六冲', pillars: ['day', 'month'], involvesDay: true }]
};
var ctx3 = buildSingleChart(allStrip);
T('整行只剩否定语 → 回退为事件表提示语', ctx3.indexOf('无冲合刑害') < 0 && ctx3.indexOf('关系事件表') >= 0);

// ---------- V2 触发器分类 + 修正指令 ----------
console.log('\n[V2 hard/soft 分类 + 修正指令]');
T('E4 档位漂移 → soft（不触发 V2）', isHardWarning('E4-档位漂移：系统档位=「中和」，回复出现「身弱」') === false);
T('E1 合局缺员 → hard（可触发 V2）', isHardWarning('E1-合局缺员：回复出现「三会火局」（三会），在场支为[亥寅辰巳酉午]，缺「未」') === true);
T('E1 五合错误 → hard', isHardWarning('E1-五合错误：丙癸相合') === true);
T('E1 生克方向 → hard', isHardWarning('E1-生克方向：水生土') === true);
T('E1 十神映射 → hard', isHardWarning('E1-十神映射冲突：甲→正印 被写成食神') === true);
T('E2 否定冲突 → hard', isHardWarning('E2-否定冲突：relationEvents 涉日支却写无冲合刑害') === true);
var v2instr = buildV2Instruction(['E1-合局缺员：回复出现「三会火局」（三会），在场支为[亥寅辰巳酉午]，缺「未」']);
T('V2 指令逐条列出 hard 警告', v2instr.indexOf('三会火局') >= 0 && v2instr.indexOf('缺「未」') >= 0);
T('V2 指令要求只修错句', v2instr.indexOf('只修正涉及上述错误的句子') >= 0);
T('V2 指令禁止改冻结结论（旺衰/格局/用喜忌/risks）', v2instr.indexOf('旺衰档位') >= 0 && v2instr.indexOf('成格/破格') >= 0 && v2instr.indexOf('喜神/忌神') >= 0 && v2instr.indexOf('structuralRisks') >= 0);

console.log('\n========== 结果：' + pass + ' PASS / ' + fail + ' FAIL ==========');
if (fail > 0) process.exit(1);
