const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const calibrationModel = require('../lib/calibration-model.js');

test('calibration schema is isolated from payment and locks generated candidates', () => {
  const migration = read('schema-chart-calibration.sql');
  const storage = read('lib/supabase.js');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS chart_calibrations/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS chart_calibration_events/);
  assert.match(migration, /options\s+JSONB/);
  assert.match(migration, /selected_option/);
  assert.match(migration, /UNIQUE\(calibration_id, event_key\)/);
  assert.doesNotMatch(migration, /orders|payment|credits/i);
  assert.match(storage, /if \(existing\) return existing/);
  assert.match(storage, /answerChartCalibrationEvent/);
});

test('first AI click offers optional calibration and archive can reopen it', () => {
  const client = read('js/chart-calibration.js');
  const archive = read('js/archive-library.js');
  const result = read('result.html');
  assert.match(client, /要不要先做应事校对/);
  assert.match(client, /先校对再问/);
  assert.match(client, /直接问 AI/);
  assert.match(client, /问题和依据在回答前已经锁定/);
  assert.match(client, /ZhishiCalibration\.beforeAI = inspectFirstClick/);
  assert.match(archive, /校对命盘/);
  assert.match(archive, /zhishi_open_archive_calibration/);
  assert.match(result, /chart-calibration\.js\?v=20/);
});

test('calibration questions require matching Bazi mechanisms instead of broad event examples', () => {
  const client = read('js/chart-calibration.js');
  assert.match(client, /伤官见官\|官逢伤官/);
  assert.match(client, /和领导、单位规定或审核流程发生过明显冲突/);
  assert.match(client, /比肩\|劫财/);
  assert.match(client, /合伙分钱、朋友借钱、同行竞争或替别人承担开支/);
  assert.match(client, /父母挣钱不稳、大额开支或资金周转/);
  assert.match(client, /六合\|流年合日支\|半合\|三合局/);
  assert.match(client, /六冲\|天克地冲/);
  assert.match(client, /刑\|自刑\|六害\|六破/);
  assert.doesNotMatch(client, /投资失利、被人分走钱/);
  assert.match(client, /var scores = \{ study:0, career:0, wealth:0, relationship:0, family:0, health:0, change:1 \}/);
  assert.match(client, /analyzeParents\(_bazi/);
  assert.match(client, /parents-v2-palace-star|parentYearContext/);
  assert.match(client, /palace-good-star-good/);
  assert.match(client, /palace-damaged-star-weak/);
  assert.match(client, /fatherDirect/);
  assert.match(client, /motherDirect/);
  assert.match(client, /study_impact/);
  assert.match(client, /domainDirection/);
  assert.match(client, /CANDIDATE_VERSION = 'bazi-cal-v10'/);
  assert.match(client, /dedupeOptionDomains/);
  assert.match(client, /系统原判断/);
  assert.match(client, /sleep_energy/);
  assert.match(client, /annualDomainScores/);
  assert.match(client, /analysis\.eventAdjudication/);
  assert.match(client, /daYunPeriod/);
  assert.match(client, /不能假定成 20 岁/);
  assert.doesNotMatch(client, /year - birthYear : 20/);
  assert.match(client, /dedupeOptionDomains\(rankedDomains, scores, parentContext\)/);
  assert.match(client, /followupSets/);
  assert.match(client, /data-selected-option/);
  assert.match(client, /很符合/);
  assert.match(client, /大致符合/);
  assert.match(client, /5-preserved\.length/);
  assert.match(client, /var firstYear = birthYear \+ 6/);
  assert.doesNotMatch(client, /nowYear - 14/);
  assert.match(client, /\['school','youth','early-adult','midlife','mature'\]/);
  assert.match(client, /先保证不同人生阶段均有代表题/);
  assert.match(client, /每步大运只展开一次流年/);
  assert.match(client, /liuNianByYear\[annualYear\] = annual/);
  assert.match(client, /你已经走过的人生阶段中筛选辨识度最高的年份/);
});

test('candidate version upgrade preserves answered events and replaces only unanswered questions', () => {
  const storage = read('lib/supabase.js');
  const endpoint = read('api/chart-calibration.js');
  assert.match(storage, /candidateVersion = safeCalibrationKey/);
  assert.match(storage, /filter\(function\(event\)\{ return !!event\.answer; \}\)/);
  assert.match(storage, /filter\(function\(event\)\{ return !event\.answer; \}\)/);
  assert.match(storage, /availableSlots = Math\.max\(0, 5 - answered\.length\)/);
  assert.match(storage, /answeredYears\.has/);
  assert.match(storage, /\.is\('answer', null\)/);
  assert.match(storage, /candidate_version:candidateVersion/);
  assert.match(endpoint, /body\.candidate_version/);
});

test('confirmed calibration is added to AI context without changing frozen facts', () => {
  const endpoint = read('api/ai-chat.js');
  const integration = read('js/ai-chat-integration.js');
  assert.match(endpoint, /getChartCalibrationSummary/);
  assert.match(endpoint, /不得据此改写四柱、旺衰、格局、喜用忌/);
  assert.match(endpoint, /逐项降低“已排除的应事方式”/);
  assert.match(endpoint, /单次校对线索.*只能弱参考/);
  assert.match(integration, /ChatPersistence\.decorate\(body, chatType/);
  assert.match(integration, /detectPageType\(\) === 'result' \? 'bazi'/);
  assert.match(integration, /requestHeaders\.Authorization/);
});

test('structured calibration rejects contradictory or forged follow-up answers', () => {
  const event = {
    event_year: 2024,
    options: [{
      key: 'wealth:partnership-loss', label: '合伙或人情带来损失', detail: '钱被合作分配带走',
      domain: 'wealth', manifestation: 'partnership-loss', mechanism_key: 'peer-wealth',
      followup_options: [{ key: 'partnership_money', label: '合伙分钱' }]
    }]
  };
  assert.equal(calibrationModel.normalizeCalibrationResponse(event, {
    answer: 'yes', selected_option: '', actual_year: 2024
  }).error, '请选择一项最接近的真实经历');
  assert.equal(calibrationModel.normalizeCalibrationResponse(event, {
    answer: 'yes', selected_option: 'wealth:partnership-loss', selected_detail: 'forged', actual_year: 2024
  }).error, '补充选项与主选项不一致');
  assert.equal(calibrationModel.normalizeCalibrationResponse(event, {
    answer: 'yes', selected_option: 'wealth:partnership-loss', actual_year: 2027
  }).error, '实际年份只能在推断年份前后一年内调整');
  const denied = calibrationModel.normalizeCalibrationResponse(event, {
    answer: 'no', selected_option: 'wealth:partnership-loss', selected_detail: 'partnership_money', actual_year: 2024
  }).value;
  assert.equal(denied.selected_option, null);
  assert.equal(denied.selected_detail, null);
  assert.equal(denied.match_level, 'none');
});

test('personal manifestation model weights exact matches above partial matches', () => {
  const option = {
    key: 'wealth:partnership-loss', label: '合伙或人情带来损失', detail: '钱被合作分配带走',
    domain: 'wealth', manifestation: 'partnership-loss', mechanism_key: 'peer-wealth',
    followup_options: [{ key: 'partnership_money', label: '合伙分钱' }]
  };
  const profile = calibrationModel.buildCalibrationProfile([
    { event_year: 2022, answer: 'yes', match_level: 'exact', selected_option: option.key, selected_detail: 'partnership_money', options: [option] },
    { event_year: 2024, answer: 'yes', match_level: 'partial', selected_option: option.key, selected_detail: 'partnership_money', options: [option] },
    { event_year: 2025, answer: 'no', domain: 'career', options: [] }
  ]);
  assert.equal(profile.patterns[0].score, 3);
  assert.equal(profile.patterns[0].count, 2);
  assert.deepEqual(profile.patterns[0].years, [2022, 2024]);
  assert.equal(profile.denied.career, 1);
  assert.equal(profile.deniedPatterns[0].mechanismKey, 'career:general');
  assert.equal(profile.version, 'bazi-cal-v6');
});

test('single confirmation stays tentative until the same manifestation repeats', () => {
  const option = {
    key: 'study:exam-pressure', label: '考试压力明显', detail: '重要考试发挥受影响',
    domain: 'study', manifestation: 'exam-pressure', mechanism_key: 'wealth-breaks-resource',
    followup_options: []
  };
  const once = calibrationModel.buildCalibrationProfile([
    { event_year: 2023, answer: 'yes', match_level: 'exact', selected_option: option.key, options: [option] }
  ]);
  assert.equal(once.patterns.length, 0);
  assert.equal(once.tentativePatterns.length, 1);
  const repeated = calibrationModel.buildCalibrationProfile([
    { event_year: 2023, answer: 'yes', match_level: 'exact', selected_option: option.key, options: [option] },
    { event_year: 2025, answer: 'yes', match_level: 'partial', selected_option: option.key, options: [option] }
  ]);
  assert.equal(repeated.patterns.length, 1);
  assert.equal(repeated.tentativePatterns.length, 0);
});

test('rejecting a multi-option year records every displayed mechanism', () => {
  const options = [
    { key: 'career:rule-conflict', label: '与规则冲突', detail: '工作审核受阻', domain: 'career', manifestation: 'rule-conflict', mechanism_key: 'hurting-officer-sees-officer' },
    { key: 'wealth:peer-loss', label: '合伙损失', detail: '合作分钱不利', domain: 'wealth', manifestation: 'peer-loss', mechanism_key: 'peer-wealth' },
    { key: 'family:parent-change', label: '父母变化', detail: '父母状态变化', domain: 'family', manifestation: 'parent-change', mechanism_key: 'parent-palace:clash' }
  ];
  const profile = calibrationModel.buildCalibrationProfile([
    { event_year: 2024, answer: 'no', domain: 'career', mechanism_key: options[0].mechanism_key, options }
  ]);
  assert.deepEqual(profile.deniedPatterns.map(function(item) { return item.mechanismKey; }).sort(), [
    'hurting-officer-sees-officer', 'parent-palace:clash', 'peer-wealth'
  ]);
  assert.equal(profile.denied.career, 1);
  assert.equal(profile.denied.wealth, 1);
  assert.equal(profile.denied.family, 1);
});

test('option evidence survives server normalization', () => {
  const normalized = calibrationModel.normalizeCalibrationOptions([{
    key:'family:parent-change', label:'父母状态变化', detail:'父母一方有明显变化', domain:'family',
    manifestation:'family-change', mechanism_key:'parent-palace:clash', evidence:['流年冲年柱', '父母宫受引动']
  }]);
  assert.deepEqual(normalized[0].evidence, ['流年冲年柱', '父母宫受引动']);
});
