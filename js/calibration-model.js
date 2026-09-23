(function(root,factory){var api=factory(typeof module==='object'&&module.exports?require('./report-imagery.js'):root.ReportImagery);if(typeof module==='object'&&module.exports)module.exports=api;else root.ZhishiCalibrationModel=api;})(typeof window!=='undefined'?window:globalThis,function(imagery){
'use strict';

const ALLOWED_DOMAINS = ['study', 'career', 'wealth', 'relationship', 'family', 'health', 'change'];
const ALLOWED_ANSWERS = ['yes', 'no', 'unsure'];
const ALLOWED_MATCH_LEVELS = ['exact', 'partial', 'none', 'unsure'];

function safeKey(value, max) {
  return String(value || '').replace(/[^a-zA-Z0-9:_\-\u4e00-\u9fa5]/g, '').slice(0, max || 80);
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

function normalizeEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map(function(item) { return safeText(item, 160); }).filter(Boolean);
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
      evidence: normalizeEvidence(item && item.evidence),
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
    eventText: option.detail,
    legacyBroad: (/^rule:/.test(option.mechanism_key)||/:scene-/.test(option.manifestation))&&!/:e2$/.test(option.manifestation),
    detail: detail ? detail.label : '',
    manifestation: option.manifestation,
    mechanismKey: option.mechanism_key || safeKey(event && event.mechanism_key, 80)
  };
}

function buildCalibrationProfile(events, options) {
  options=options||{};
  const cutoff=Number(options.currentYear)||new Date().getFullYear();
  const uniqueEvents=new Map();
  (Array.isArray(events)?events:[]).forEach(function(event){
    if(!event||!Number.isInteger(Number(event.event_year))||Number(event.event_year)>=cutoff||Number(event.event_year)<1900)return;
    const normalized=normalizeCalibrationResponse(event,event);
    if(normalized.error)return;
    const clean=Object.assign({},event,normalized.value);
    if(clean.actual_year && clean.actual_year>=cutoff)return;
    uniqueEvents.set(clean.event_key || 'year:'+clean.event_year+':'+(clean.domain||''),clean);
  });
  events=Array.from(uniqueEvents.values());
  const buckets = {};
  const denied = {};
  const deniedMechanisms = {};
  (events || []).forEach(function(event) {
    if (event.answer === 'yes') {
      const picked = optionLabel(event);
      if (!picked) return;
      // Keep old answers in history, but broad scene wording cannot validate the
      // new concrete event contract. Partial agreement is not a full outcome.
      if ((/^rule:/.test(picked.mechanismKey)||/:scene-/.test(picked.manifestation)) &&
          (!/:e2$/.test(picked.manifestation)||event.match_level==='partial')) return;
      const key = picked.domain + ':' + picked.mechanismKey + ':' + picked.manifestation;
      if (!buckets[key]) buckets[key] = { ...picked, score: 0, count: 0, years: [], byYear:{}, details:[] };
      if(buckets[key].details.indexOf(picked.detail)<0)buckets[key].details.push(picked.detail);
      const year=Number(event.actual_year || event.event_year);
      buckets[key].byYear[year]=Math.max(buckets[key].byYear[year]||0,event.match_level==='partial'?1:2);
      buckets[key].years=Object.keys(buckets[key].byYear).map(Number).sort((a,b)=>a-b);
      buckets[key].count=buckets[key].years.length;
      buckets[key].score=Object.values(buckets[key].byYear).reduce((a,b)=>a+b,0);
    } else if (event.answer === 'no') {
      // “都不符合”否定的是当时展示的全部候选，不能只沿用题目的首个机制。
      const options = normalizeCalibrationOptions(event.options);
      const deniedItems = options.length ? options.map(function(option) {
        return {
          domain: option.domain,
          mechanismKey: option.mechanism_key || (option.domain + ':general'),
          manifestation: option.manifestation,
          label: option.label
        };
      }) : [{
        domain: normalizeDomain(event.domain),
        mechanismKey: safeKey(event.mechanism_key, 80) || (normalizeDomain(event.domain) + ':general'),
        label: safeText(event.prompt, 80)
      }];
      const seen = new Set();
      deniedItems.forEach(function(item) {
        const domain = normalizeDomain(item.domain);
        const mechanism = safeKey(item.mechanismKey, 80) || (domain + ':general');
        const key = domain + ':' + mechanism + ':' + (item.manifestation || 'legacy');
        if (seen.has(key)) return;
        seen.add(key);
        if (!deniedMechanisms[key]) deniedMechanisms[key] = { domain, mechanismKey: mechanism, manifestation:item.manifestation||'', label: item.label || '', count: 0, years: [] };
        if(deniedMechanisms[key].years.indexOf(event.event_year)<0){
          denied[domain] = (denied[domain] || 0) + 1;
          deniedMechanisms[key].count += 1;
          deniedMechanisms[key].years.push(event.event_year);
        }
      });
    }
  });
  const rankedPatterns = Object.values(buckets).sort(function(a, b) {
    return b.score - a.score || b.count - a.count || a.label.localeCompare(b.label, 'zh-CN');
  });
  // 不同实际年份的重复反馈才进入重复线索；重复不是未来事件的概率或保证。
  rankedPatterns.forEach(function(item){ item.detail=item.details.length===1?item.details[0]:'';delete item.details;delete item.byYear; });
  const patterns = rankedPatterns.filter(function(item) { return item.count >= 2; }).slice(0, 6);
  const tentativePatterns = rankedPatterns.filter(function(item) { return item.count === 1; }).slice(0, 6);
  return { version: 'bazi-cal-v6', patterns, tentativePatterns, denied, deniedPatterns: Object.values(deniedMechanisms), events };
}


// These are testable interpretations, not causal facts. Only explicitly activated
// rules enter this ledger; a wealth/seal ten-god alone does not establish a rule.
function professionalCandidates(domain, analysis) { return imagery ? imagery.candidates(domain,analysis) : []; }

function buildProcessReferences(events,candidates){
  if(!imagery||!imagery.describeOption)return [];
  const references=[];
  candidates.forEach(function(candidate){
    const target=imagery.describeOption(candidate);if(!target||!target.commonProcess)return;
    const byYear=new Map(),counterYears=new Set();
    events.forEach(function(event){
      const year=Number(event.actual_year||event.event_year);
      if(event.answer==='no'){
        if(normalizeCalibrationOptions(event.options).some(o=>{const d=imagery.describeOption(o);return d&&d.id===target.id;}))counterYears.add(year);
        return;
      }
      // Partial agreement cannot tell us which part of a compound event matched.
      if(event.answer!=='yes'||event.match_level!=='exact')return;
      const picked=selectedOptionFor(event,event.selected_option),source=imagery.describeOption(picked);
      if(!source||source.id!==target.id||source.scene===target.scene&&source.domain===target.domain)return;
      if(!byYear.has(year))byYear.set(year,{year,scene:source.scene,domain:source.domain,original:picked.detail});
    });
    if(!byYear.size)return;
    const sources=Array.from(byYear.values()).sort((a,b)=>a.year-b.year);
    references.push({year:candidate.year,domain:candidate.domain,mechanismKey:candidate.mechanism_key,
      manifestation:candidate.manifestation,name:target.name,commonProcess:target.commonProcess,
      sources,sourceYears:sources.map(s=>s.year),counterYears:Array.from(counterYears).sort((a,b)=>a-b),
      state:counterYears.size?'mixed-reference':'process-reference',scope:'common_process_only',
      targetScene:target.scene,futureConfirmed:false});
  });
  return references;
}

function buildReportReview(events, candidates, options) {
  const profile=buildCalibrationProfile(events,options), seen=new Set();
  // A professional interpretation can include both process and outcome. Partial agreement
  // (for example "tired" without "completed") cannot validate the entire interpretation.
  // Keep that answer in history; this restriction only affects report-level matching.
  const supportProfile=buildCalibrationProfile(profile.events.filter(function(event){
    const picked=selectedOptionFor(event,event.selected_option);
    return !(event.answer==='yes'&&event.match_level==='partial'&&picked&&/^rule:/.test(picked.mechanism_key));
  }),options);
  const history=profile.events.filter(e=>e.answer==='yes'||e.answer==='no').map(function(e){
    const picked=optionLabel(e), options=normalizeCalibrationOptions(e.options);
    return {eventKey:e.event_key,year:Number(e.event_year),actualYear:Number(e.actual_year||e.event_year),
      answer:e.answer,matchLevel:e.match_level,original:safeText(e.prompt,240),
      originalOptions:options.map(o=>o.detail), evidence:normalizeEvidence(e.evidence),
      confirmed:picked ? picked.label+(picked.detail?' · '+picked.detail:'') : '',
      note:safeText(e.note,240)};
  });
  const adjustments=[], supportedCandidates=[];
  (Array.isArray(candidates)?candidates:[]).forEach(function(candidate){
    if(!candidate||candidate.hasIndependentAnnualTrigger!==true)return;
    const c=normalizeCalibrationOptions([candidate])[0];
    if(!c||!c.mechanism_key)return;
    const year=Number(candidate.year),cutoff=Number(options&&options.currentYear)||new Date().getFullYear();
    if(!Number.isInteger(year)||year<cutoff)return;
    const key=year+':'+c.domain+':'+c.mechanism_key+':'+c.manifestation;
    if(seen.has(key))return;seen.add(key);
    supportedCandidates.push({...c,year,hasIndependentAnnualTrigger:true,reportBaseline:safeText(candidate.reportBaseline,320),reportLabel:safeText(candidate.reportLabel,80)});
    const repeated=supportProfile.patterns.find(p=>p.domain===c.domain&&p.mechanismKey===c.mechanism_key&&p.manifestation===c.manifestation);
    const once=supportProfile.tentativePatterns.find(p=>p.domain===c.domain&&p.mechanismKey===c.mechanism_key&&p.manifestation===c.manifestation);
    const denied=profile.deniedPatterns.find(p=>p.domain===c.domain&&p.mechanismKey===c.mechanism_key&&p.manifestation===c.manifestation);
    if(!repeated&&!once&&!denied)return;
    const positive=repeated||once;
    const state=positive&&denied?'mixed':denied?'deprioritized':repeated?'repeated':'tentative';
    const outcome=state==='mixed'?'同类解释既有符合也有不符合的反馈，本年保留不同表现，不按单一结果下结论。'
      :state==='deprioritized'?'你否认过同类解释，本轮不把这条具体解释列为重点，重新区分现实场景；不因此排除整个领域。'
      :state==='repeated'?'相同机制曾在不同年份对应这类经历，本年优先沿这条线索解读，并继续核对现实条件。'
      :'目前只有一次相近经历，本年把它作为补充线索，不提高事件的确定程度。';
    adjustments.push({year,domain:c.domain,mechanismKey:c.mechanism_key,manifestation:c.manifestation,label:c.label,state,
      original:c.detail,sourceEvidence:c.evidence,confirmedYears:positive?positive.years:[],deniedYears:denied?denied.years:[],
      outcome,futureConfirmed:false});
  });
  return {version:'report-review-v5',answered:history.length,skipped:profile.events.filter(e=>e.answer==='unsure').length,
    history,adjustments,processReferences:buildProcessReferences(profile.events,supportedCandidates),candidates:supportedCandidates,profile,boundary:'往事复核只调整报告中的机制解释及相关总结，不修改家庭关系、四柱与原局判读；共同作用方式可跨场景参考，具体事件与结果不能直接迁移；经历符合不等于因果已证实，也不保证未来事件发生。'};
}

return {
  ALLOWED_DOMAINS,
  normalizeCalibrationOptions,
  normalizeCalibrationResponse,
  selectedOptionFor,
  optionLabel,
  buildCalibrationProfile,
  buildReportReview,
  professionalCandidates,
  safeKey,
  safeText
};

});
