'use strict';

// This validates recorded evidence and review status, not the truth of a doctrine
// or the real-world identity of an author. AI agreement is not an external gold standard.
const ELEMENTS = ['木', '火', '土', '金', '水'];
const LEVEL_DIRECTIONS = { 极强: '强', 偏强: '强', 中和: '中和', 偏弱: '弱', 极弱: '弱' };
const SOURCE_KINDS = ['project-rule', 'published-reference', 'external-review', 'internal-review', 'ai-assisted'];

function requireValue(condition, message) { if (!condition) throw new Error('判读记录: ' + message); }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function text(value, name) { requireValue(nonempty(value), name + '不能为空'); }
function choice(value, choices, name) { requireValue(choices.includes(value), name + '无效'); }
function list(value, name, allowEmpty = false) {
  requireValue(Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(nonempty), name + '须为说明列表');
}
function timestamp(value, name) {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)), name + '须为ISO时间');
  return Date.parse(value);
}
function person(value, name) {
  requireValue(value && typeof value === 'object', name + '缺失');
  text(value.id, name + '.id');
  choice(value.kind, ['human', 'ai', 'team'], name + '.kind');
}
function elementList(value, name) {
  requireValue(Array.isArray(value) && value.every(item => ELEMENTS.includes(item)) && new Set(value).size === value.length, name + '须为不重复的五行列表');
}

function validateRulings(data, caseData, options = {}) {
  requireValue(data && data.schemaVersion === 1, '需要schemaVersion=1的independent-rulings.json');
  requireValue(data.roundId === caseData.roundId, 'roundId与案例不一致');
  choice(data.datasetRole, ['development', 'acceptance', 'disputed'], 'datasetRole');
  text(data.ruleVersion, 'ruleVersion');
  requireValue(Array.isArray(data.sources) && data.sources.length > 0, 'sources缺失');
  const sources = new Map();
  for (const source of data.sources) {
    requireValue(source && typeof source === 'object', '来源无效');
    text(source.id, 'source.id');
    requireValue(!sources.has(source.id), '来源ID重复');
    choice(source.kind, SOURCE_KINDS, 'source.kind');
    text(source.reference, 'source.reference');
    text(source.description, 'source.description');
    sources.set(source.id, source);
  }
  requireValue(Array.isArray(data.cases) && data.cases.length === 10, '必须包含10盘完整判读');
  const expected = new Map(caseData.cases.map(item => [item.id, item]));
  const seen = new Set();
  const latest = options.frozenAt ? timestamp(options.frozenAt, 'rulingsFrozenAt') : Date.now();
  for (const item of data.cases) {
    requireValue(item && expected.has(item.id) && !seen.has(item.id), '案例ID缺失、重复或不匹配');
    seen.add(item.id);
    const name = item.id;
    requireValue(Array.isArray(item.pillars) && JSON.stringify(item.pillars) === JSON.stringify(expected.get(item.id).pillars), name + '四柱与案例不一致');
    const decidedAt = timestamp(item.decidedAt, name + '.decidedAt');
    requireValue(decidedAt <= latest, name + '判读时间晚于冻结时间');
    requireValue(item.engineOutputSeen === false, name + '必须记录未查看引擎判断的独立判读');
    person(item.author, name + '.author');
    list(item.sourceIds, name + '.sourceIds');
    requireValue(new Set(item.sourceIds).size === item.sourceIds.length && item.sourceIds.every(id => sources.has(id)), name + '引用了不存在或重复的来源');
    requireValue(item.review && typeof item.review === 'object', name + '.review缺失');
    choice(item.review.status, ['pending', 'reviewed', 'disputed'], name + '.review.status');
    text(item.review.notes, name + '.review.notes');
    if (item.review.status === 'pending') {
      requireValue(item.review.reviewer === null && item.review.reviewedAt === null, name + '待复核记录须将复核者和时间标为null');
    } else {
      person(item.review.reviewer, name + '.review.reviewer');
      const reviewedAt = timestamp(item.review.reviewedAt, name + '.review.reviewedAt');
      requireValue(item.review.reviewer.id !== item.author.id, name + '复核者不能与原判读者相同');
      requireValue(reviewedAt >= decidedAt && reviewedAt <= latest, name + '复核时间必须在判读之后、冻结之前');
    }
    requireValue(item.strength && item.following && item.pattern && item.yongJi, name + '缺少旺衰、从格、格局或喜用忌');
    choice(item.strength.direction, ['强', '中和', '弱', '待定'], name + '.strength.direction');
    choice(item.strength.level, [...Object.keys(LEVEL_DIRECTIONS), '待定'], name + '.strength.level');
    requireValue(item.strength.level === '待定' || LEVEL_DIRECTIONS[item.strength.level] === item.strength.direction, name + '旺衰方向与档位矛盾');
    list(item.strength.evidence, name + '.strength.evidence');
    choice(item.following.status, ['成立', '候选', '不从', '待定'], name + '.following.status');
    text(item.following.name, name + '.following.name');
    list(item.following.evidence, name + '.following.evidence');
    text(item.pattern.name, name + '.pattern.name');
    choice(item.pattern.status, ['成格', '破格', '有救应', '候选', '待定'], name + '.pattern.status');
    list(item.pattern.evidence, name + '.pattern.evidence');
    choice(item.yongJi.status, ['已定', '待定'], name + '.yongJi.status');
    requireValue(item.yongJi.status === '待定' ? item.yongJi.primary === null : ELEMENTS.includes(item.yongJi.primary), name + '.yongJi.primary无效');
    elementList(item.yongJi.favorable, name + '.yongJi.favorable');
    elementList(item.yongJi.unfavorable, name + '.yongJi.unfavorable');
    // Favorable is the complete xiShen set, including the primary useful element.
    requireValue(item.yongJi.status === '待定' || item.yongJi.favorable.includes(item.yongJi.primary), name + '完整喜神集合必须包含首用五行');
    requireValue(!item.yongJi.favorable.some(value => item.yongJi.unfavorable.includes(value)) && !item.yongJi.unfavorable.includes(item.yongJi.primary), name + '同一五行不能同时列为用/喜与忌');
    list(item.yongJi.evidence, name + '.yongJi.evidence');
    list(item.disputes, name + '.disputes', true);
  }
  return { sources, cases: data.cases };
}

function acceptanceReasons(data) {
  const reasons = [];
  if (data.datasetRole !== 'acceptance') reasons.push('样本用途不是acceptance');
  const sources = new Map(data.sources.map(source => [source.id, source]));
  for (const item of data.cases) {
    if (item.review.status !== 'reviewed' || item.review.reviewer?.kind !== 'human') reasons.push(item.id + '未完成第二人工复核');
    if (!item.sourceIds.some(id => ['project-rule', 'published-reference'].includes(sources.get(id)?.kind))) reasons.push(item.id + '没有可引用的规则或文献来源');
    if (item.disputes.length || item.strength.level === '待定' || item.strength.direction === '待定' || item.following.status === '待定' || item.following.name === '待定' || item.pattern.status === '待定' || item.pattern.name === '待定' || item.yongJi.status === '待定') reasons.push(item.id + '仍有待定或争议项');
  }
  return reasons;
}

// Input is explicitly normalized to the same judgement shape; no fuzzy names,
// merged weak levels, or partial element-set matches count as exact agreement.
function compareRuling(expected, actual) {
  const equal = (value, observed) => value === '待定' || value == null ? null : value === observed;
  const sameSet = (left, right) => Array.isArray(right) && right.length === new Set(right).size && left.length === right.length && left.every(value => right.includes(value));
  return {
    strengthDirection: equal(expected.strength.direction, actual.strength?.direction),
    strengthLevel: equal(expected.strength.level, actual.strength?.level),
    followingName: expected.following.status === '待定' ? null : equal(expected.following.name, actual.following?.name),
    followingStatus: equal(expected.following.status, actual.following?.status),
    primaryElement: expected.yongJi.status === '待定' ? null : equal(expected.yongJi.primary, actual.yongJi?.primary),
    favorableSet: expected.yongJi.status === '待定' ? null : actual.yongJi?.status !== '待定' && sameSet(expected.yongJi.favorable, actual.yongJi?.favorable),
    unfavorableSet: expected.yongJi.status === '待定' ? null : actual.yongJi?.status !== '待定' && sameSet(expected.yongJi.unfavorable, actual.yongJi?.unfavorable),
    patternName: expected.pattern.status === '待定' ? null : equal(expected.pattern.name, actual.pattern?.name),
    patternStatus: equal(expected.pattern.status, actual.pattern?.status)
  };
}

function normalizeEngineResult(item) {
  const level = LEVEL_DIRECTIONS[item.strength?.level] ? item.strength.level : '待定';
  const cong = item.cong || {};
  const yongJi = item.yongJi || {};
  const finalPattern = yongJi.resolvedPattern || (item.patternSource === 'resolvedPattern' ? item.pattern : null);
  const patternStatus = finalPattern?.status === '条件待定' ? '待定' : finalPattern?.status;
  const followingStatus = cong.isCong === true ? '成立' : cong.isCandidate === true ? '候选' : cong.isCong === false ? '不从' : '待定';
  const primary = Array.isArray(yongJi.yongShen) && ELEMENTS.includes(yongJi.yongShen[0]) ? yongJi.yongShen[0] : null;
  return {
    strength: { direction: LEVEL_DIRECTIONS[level] || '待定', level },
    following: { status: followingStatus, name: followingStatus === '不从' ? '普通格局' : cong.name || '待定' },
    pattern: { name: finalPattern?.name || '待定', status: ['成格', '破格', '有救应', '候选'].includes(patternStatus) ? patternStatus : '待定' },
    yongJi: {
      status: primary ? '已定' : '待定',
      primary,
      favorable: Array.isArray(yongJi.xiShen) ? yongJi.xiShen : null,
      unfavorable: Array.isArray(yongJi.jiShen) ? yongJi.jiShen : null
    }
  };
}

module.exports = { validateRulings, acceptanceReasons, compareRuling, normalizeEngineResult };
