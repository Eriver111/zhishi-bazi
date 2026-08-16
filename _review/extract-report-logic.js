// 提取 js/bazi.js 深度报告判定逻辑，生成自包含审阅材料（2026-08-15）
// 输出：_review/深度报告判定逻辑.md —— 可直接交给 GPT 审阅。
var fs = require('fs');
var path = require('path');

var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8').replace(/\r\n/g, '\n');
var lines = src.split('\n');

// 顶层函数定位（引擎全部使用行首 function 声明）
var tops = [];
lines.forEach(function (l, i) {
  var m = /^function (\w+)\(/.exec(l);
  if (m) tops.push({ name: m[1], start: i + 1 });
});

var DESC = {
  getJieQiDatesLegacy: '节气时刻（近似算法，历法基础）',
  getJieQiDates: '节气时刻（太阳视黄经 NOAA/Meeus 低阶，历法基础）',
  getYearPillar: '年柱判定（立春分界）',
  getMonthPillar: '月柱判定（节气分界 + 五虎遁）',
  getDayPillar: '日柱推算（公历 → 干支）',
  getHourPillar: '时柱判定（五鼠遁）',
  getShiShen: '十神映射（日干对目标干）',
  getWuXingRelation: '五行生克关系',
  calculateShiShen: '十神计算（生克 + 阴阳同性异性）',
  getNaYin: '纳音',
  getCangGan: '地支藏干',
  calculateBaZi: '排盘总装（四柱 + 藏干 + 十神 + 纳音）',
  normalizeBirthInput: '出生输入归一化',
  calculateFromBirthInput: '从输入参数起盘',
  buildBaZiFromPillars: '从已知四柱构造命盘（合盘/测试用）',
  countWuXing: '五行统计',
  calculateDaYun: '大运排定（起运岁数 + 顺逆排运）',
  birthDateToDecimal: '日期换算为十进制',
  calculateLiuNian: '流年排定',
  calculateShenSha: '神煞计算',
  calculateChengGu: '称骨',
  analyzePei: '配偶分析',
  calculateSpouseAge: '配偶年龄推算',
  getDaysFromJieQi: '距节气天数（人元司令基础）',
  getRenYuanSiLing: '人元司令（司权天数）',
  getRenYuanEvidence: '人元司令证据',
  calcDayMasterStrength: '日主旺衰判定（★ 冻结层 CORE_ENGINE_FROZEN_AFTER_P4A）',
  analyzeParents: '六亲·父母分析',
  analyzeHourYearCharacter: '年/月/时柱性格',
  analyzeCharacter: '性格分析',
  analyzeWealth: '财富分析',
  classifyFortuneElement: '事业五行分类',
  analyzeFortune: '事业运势分析',
  analyzeThisYear: '流年应期分析（用神/喜神/忌神触发）',
  analyzeStudy: '学业分析',
  getTrueSolarHour: '真太阳时（省份经度修正）',
  finalizePatternStatus: '格局状态收口（成格/破格 + 救应）',
  getPattern: '取格判定（★ 冻结层，P4-A 已修 A1/A2）',
  normalizeYongJiLists: '用神列表归一化',
  finalizeYongJiResult: '用神收口（扶抑/调候/救应 method + 理由链）',
  evaluateYongShenQuality: '用神质量评估（根气/受克/被合绊）',
  calcCandidateScores: '候选用神评分（★ 冻结层 P1）',
  getYongJi: '用神判定总装（★ 冻结层）',
  getPillarRelations: '天干关系（生克/合）',
  getBranchRelations: '地支关系（冲刑害合）',
  getChangSheng: '十二长生表',
  getCongGe: '从格判定（★ 冻结层，P4-A 已修覆盖优先级）',
  getGanHe: '天干合化',
  getSanHui: '三会方',
  getCangGanDepth: '藏干深度',
  analyzeDayBranch: '日支分析',
  getProfessionalReportFacts: '★ 深度报告事实总装（报告内容判定链的收口函数）'
};

var md = [];
md.push('# 个人排盘·深度报告 判定逻辑（js/bazi.js 全量源码）');
md.push('');
md.push('> 2026-08-15 提取，供 GPT 审阅。文件 js/bazi.js 共 5616 行，本文档按函数为单位完整收录判定链。');
md.push('> 冻结声明：标注 ★ 的函数属于 `CORE_ENGINE_FROZEN_AFTER_P4A` 冻结面（旺衰/取格/从格/用神/喜忌/候选评分）——');
md.push('> 按冻结纪律，除非新多盘同机制明确错误，不得修改。其余函数为报告解释层/历法层，可正常审阅修复。');
md.push('');

// 索引表
md.push('## 函数索引（按源文件行号）');
md.push('');
md.push('| 函数 | 行号 | 职责 |');
md.push('|---|---|---|');
tops.forEach(function (t, i) {
  var end = (i + 1 < tops.length ? tops[i + 1].start - 1 : lines.length);
  md.push('| ' + t.name + ' | ' + t.start + '-' + end + ' | ' + (DESC[t.name] || '—') + ' |');
});
md.push('');

// 正文：全函数源码
md.push('## 源码（按源文件顺序）');
md.push('');
tops.forEach(function (t, i) {
  var end = (i + 1 < tops.length ? tops[i + 1].start - 1 : lines.length);
  md.push('### ' + t.name + '（行 ' + t.start + '-' + end + '）');
  md.push('');
  if (DESC[t.name]) md.push('> ' + DESC[t.name]);
  md.push('');
  md.push('```js');
  md.push(lines.slice(t.start - 1, end).join('\n'));
  md.push('```');
  md.push('');
});

var out = path.join(__dirname, '深度报告判定逻辑.md');
fs.writeFileSync(out, md.join('\n'), 'utf8');
console.log('已生成 ' + out + '（' + tops.length + ' 个函数，' + md.length + ' 行 markdown，' + Math.round(fs.statSync(out).size / 1024) + ' KB）');
