'use strict';

const ALLOWED_DOMAINS = ['study', 'career', 'wealth', 'relationship', 'family', 'health', 'change'];
const ALLOWED_ANSWERS = ['yes', 'no', 'unsure'];
const ALLOWED_MATCH_LEVELS = ['exact', 'partial', 'none', 'unsure'];

function safeKey(value, max) {
  return String(value || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, max || 80);
}

function safeText(value, max) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max || 180);
}

function normalizeDomain(value, fallback) {
  value = String(value || '').toLowerCase();
  return ALLOWED_DOMAINS.includes(value) ? value : (fallback || 'change');
}

function normalizeFollowupOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map(function(item) {
    const key = safeKey(item && item.key, 64);
    const label = safeText(item && item.label, 80);
    return key && label ? { key, label } : null;
  }).filter(Boolean);
}

function normalizeCalibrationOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map(function(item) {
    const key = safeKey(item && item.key, 80);
    const label = safeText(item && item.label, 80);
    const detail = safeText(item && item.detail, 220);
    if (!key || !label || !detail) return null;
    return {
      key,
      label,
      detail,
      domain: normalizeDomain(item && item.domain),
      manifestation: safeKey(item && item.manifestation, 64) || key,
      mechanism_key: safeKey(item && item.mechanism_key, 80),
      followup_prompt: safeText(item && item.followup_prompt, 120),
      followup_options: normalizeFollowupOptions(item && item.followup_options)
    };
  }).filter(Boolean);
}

function selectedOptionFor(event, selectedOption) {
  const options = normalizeCalibrationOptions(event && event.options);
  const key = safeKey(selectedOption, 80);
  return options.find(function(option) { return option.key === key; }) || null;
}

function normalizeCalibrationResponse(event, input) {
  input = input || {};
  const answer = ALLOWED_ANSWERS.includes(input.answer) ? input.answer : '';
  if (!answer) return { error: '无效的校对答案' };

  let selectedOption = safeKey(input.selected_option, 80);
  let selectedDetail = safeKey(input.selected_detail, 64);
  let matchLevel = ALLOWED_MATCH_LEVELS.includes(input.match_level) ? input.match_level : '';
  let actualYear = input.actual_year === null || input.actual_year === undefined || input.actual_year === ''
    ? null : parseInt(input.actual_year, 10);
  const note = safeText(input.note, 240);

  if (answer === 'no' || answer === 'unsure') {
    selectedOption = '';
    selectedDetail = '';
    matchLevel = answer === 'no' ? 'none' : 'unsure';
    actualYear = null;
  } else {
    const availableOptions = normalizeCalibrationOptions(event && event.options);
    const option = selectedOptionFor(event, selectedOption);
    // 兼容已生成的 v1 校对题和仍在缓存中的旧前端；v2 题必须选择具体取象。
    if (availableOptions.length && !option) return { error: '请选择一项最接近的真实经历' };
    if (!availableOptions.length && !selectedOption) {
      selectedOption = '';
      selectedDetail = '';
    }
    if (option && selectedDetail) {
      const allowedDetail = option.followup_options.some(function(item) { return item.key === selectedDetail; });
      if (!allowedDetail) return { error: '补充选项与主选项不一致' };
    }
    if (matchLevel !== 'partial') matchLevel = 'exact';
    const eventYear = Number(event && event.event_year);
    if (actualYear !== null && (!Number.isInteger(actualYear) || Math.abs(actualYear - eventYear) > 1)) {
      return { error: '实际年份只能在推断年份前后一年内调整' };
    }
  }

  return {
    value: {
      answer,
      selected_option: selectedOption || null,
      selected_detail: selectedDetail || null,
      match_level: matchLevel,
      actual_year: actualYear,
      note
    }
  };
}

function optionLabel(event) {
  const option = selectedOptionFor(event, event && event.selected_option);
  if (!option) return null;
  const detail = option.followup_options.find(function(item) { return item.key === event.selected_detail; });
  return {
    domain: option.domain,
    label: option.label,
    detail: detail ? detail.label : '',
    manifestation: option.manifestation,
    mechanismKey: option.mechanism_key || safeKey(event && event.mechanism_key, 80)
  };
}

function buildCalibrationProfile(events) {
  const buckets = {};
  const denied = {};
  (events || []).forEach(function(event) {
    if (event.answer === 'yes') {
      const picked = optionLabel(event);
      if (!picked) return;
      const key = picked.domain + ':' + picked.manifestation;
      if (!buckets[key]) buckets[key] = { ...picked, score: 0, count: 0, years: [] };
      buckets[key].score += event.match_level === 'partial' ? 1 : 2;
      buckets[key].count += 1;
      buckets[key].years.push(event.actual_year || event.event_year);
    } else if (event.answer === 'no') {
      const domain = normalizeDomain(event.domain);
      denied[domain] = (denied[domain] || 0) + 1;
    }
  });
  const patterns = Object.values(buckets).sort(function(a, b) {
    return b.score - a.score || b.count - a.count || a.label.localeCompare(b.label, 'zh-CN');
  }).slice(0, 6);
  return { version: 'bazi-cal-v2', patterns, denied };
}

module.exports = {
  ALLOWED_DOMAINS,
  normalizeCalibrationOptions,
  normalizeCalibrationResponse,
  selectedOptionFor,
  optionLabel,
  buildCalibrationProfile,
  safeKey,
  safeText
};
