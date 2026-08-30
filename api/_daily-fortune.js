'use strict';

const STEM_ELEMENT = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const BRANCH_ELEMENT = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const OVERCOMES = {木:'土',土:'水',水:'火',火:'金',金:'木'};
const STEM_COMBINE = {甲:'己',己:'甲',乙:'庚',庚:'乙',丙:'辛',辛:'丙',丁:'壬',壬:'丁',戊:'癸',癸:'戊'};
const STEM_COMBINE_ELEMENT = {'甲己':'土','乙庚':'金','丙辛':'水','丁壬':'木','戊癸':'火'};
const BRANCH_COMBINE = {子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
const BRANCH_COMBINE_ELEMENT = {'子丑':'土','寅亥':'木','卯戌':'火','辰酉':'金','巳申':'水','午未':'土'};
const BRANCH_CLASH = {子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
const HARM_PAIRS = new Set([['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']].map(pair => pairKey(pair[0], pair[1])));
const BREAK_PAIRS = new Set([['子','酉'],['丑','辰'],['寅','亥'],['卯','午'],['巳','申'],['未','戌']].map(pair => pairKey(pair[0], pair[1])));
const PUNISH_GROUPS = [['寅','巳','申'],['丑','未','戌']];
const MUTUAL_PUNISH = new Set([pairKey('子','卯')]);
const SELF_PUNISH = new Set(['辰','午','酉','亥']);
const SANHE = [
  {members:['申','子','辰'],element:'水'}, {members:['亥','卯','未'],element:'木'},
  {members:['寅','午','戌'],element:'火'}, {members:['巳','酉','丑'],element:'金'}
];
const SANHUI = [
  {members:['寅','卯','辰'],element:'木'}, {members:['巳','午','未'],element:'火'},
  {members:['申','酉','戌'],element:'金'}, {members:['亥','子','丑'],element:'水'}
];
const POSITION_LABEL = {year:'年柱',month:'月柱',day:'夫妻宫',hour:'时柱'};
const STEM_POSITION_LABEL = {year:'年干',month:'月干',day:'日主',hour:'时干'};
const POSITION_DOMAIN = {year:'家庭与外部关系',month:'工作与现实事务',day:'感情与居住状态',hour:'后续计划与成果'};

function pairKey(a, b) {
  return [a, b].sort().join('');
}

function chinaDateParts(input) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(input || new Date());
  const out = {};
  parts.forEach(part => { if (part.type !== 'literal') out[part.type] = Number(part.value); });
  return {year:out.year, month:out.month, day:out.day};
}

function classifyElement(element, yongJi) {
  if (!element) return '中性';
  if ((yongJi.yongShen || []).includes(element)) return '用神';
  if ((yongJi.xiShen || []).includes(element)) return '喜神';
  if ((yongJi.jiShen || []).includes(element)) return '忌神';
  return '中性';
}

function roleScore(role) {
  return role === '用神' ? 3 : role === '喜神' ? 2 : role === '忌神' ? -3 : 0;
}

function combineElement(a, b, table) {
  return table[a + b] || table[b + a] || '';
}

function stemRelations(dayGan, targetGan) {
  const rows = [];
  if (STEM_COMBINE[dayGan] === targetGan) {
    rows.push({type:'天干五合', resultElement:combineElement(dayGan, targetGan, STEM_COMBINE_ELEMENT)});
  }
  const dayElement = STEM_ELEMENT[dayGan], targetElement = STEM_ELEMENT[targetGan];
  if (OVERCOMES[dayElement] === targetElement) rows.push({type:'流日天干克原局', direction:'incoming'});
  else if (OVERCOMES[targetElement] === dayElement) rows.push({type:'原局天干克流日', direction:'contained'});
  return rows;
}

function branchRelations(dayZhi, targetZhi) {
  const rows = [];
  if (BRANCH_COMBINE[dayZhi] === targetZhi) {
    rows.push({type:'六合', resultElement:combineElement(dayZhi, targetZhi, BRANCH_COMBINE_ELEMENT)});
  }
  if (BRANCH_CLASH[dayZhi] === targetZhi) rows.push({type:'六冲'});
  const key = pairKey(dayZhi, targetZhi);
  if (HARM_PAIRS.has(key)) rows.push({type:'六害'});
  if (BREAK_PAIRS.has(key)) rows.push({type:'相破'});
  if (MUTUAL_PUNISH.has(key)
      || (dayZhi === targetZhi && SELF_PUNISH.has(dayZhi))
      || PUNISH_GROUPS.some(group => group.includes(dayZhi) && group.includes(targetZhi) && dayZhi !== targetZhi)) {
    rows.push({type:'相刑'});
  }
  return rows;
}

function eventImpact(type, incomingRole, targetRole, resultRole) {
  if (type === '天干五合' || type === '六合' || type === '三合局' || type === '三会局' || type === '半合' || type === '半会') {
    return Math.max(-2, Math.min(2, roleScore(resultRole || incomingRole)));
  }
  if (type === '六冲') {
    if (targetRole === '用神') return -2;
    if (targetRole === '喜神') return -1;
    if (targetRole === '忌神' && (incomingRole === '用神' || incomingRole === '喜神')) return 1;
    return incomingRole === '忌神' ? -1 : 0;
  }
  if (type === '六害' || type === '相刑' || type === '相破') {
    return targetRole === '用神' || targetRole === '喜神' ? -2 : incomingRole === '忌神' ? -1 : 0;
  }
  if (type === '流日天干克原局') {
    return targetRole === '用神' || targetRole === '喜神' ? -1 : targetRole === '忌神' ? 1 : 0;
  }
  return 0;
}

function describeEvent(event) {
  const target = event.target;
  if (event.type === '天干五合') return '流日天干与' + target + '相合，关系指向' + event.resultElement + '，在命局中属于' + event.resultRole;
  if (event.type === '六合') return '流日地支与' + target + '六合，合局指向' + event.resultElement + '，在命局中属于' + event.resultRole;
  if (event.type === '三合局' || event.type === '三会局') return '流日与原局形成' + event.type + event.resultElement + '，该五行属于' + event.resultRole;
  if (event.type === '半合' || event.type === '半会') return '流日与原局出现' + event.type + event.resultElement + '的趋势，该五行属于' + event.resultRole;
  if (event.type === '流日天干克原局') return '流日天干克到' + target + '，被触动的五行属于' + event.targetRole;
  if (event.type === '原局天干克流日') return target + '对流日天干形成制约，今天的外来影响不容易完全展开';
  if (event.type === '六冲') {
    if (event.targetRole === '忌神' && (event.incomingRole === '用神' || event.incomingRole === '喜神')) return '流日冲到' + target + '的忌神，变化更像推动旧问题松动';
    return '流日冲到' + target + '，被冲动的五行属于' + event.targetRole;
  }
  return '流日与' + target + '形成' + event.type + '，被触动的五行属于' + event.targetRole;
}

function addGroupEvents(events, dayZhi, natalBranches, groups, fullType, halfType, yongJi) {
  groups.forEach(group => {
    if (!group.members.includes(dayZhi)) return;
    const remaining = group.members.filter(zhi => zhi !== dayZhi);
    const found = remaining.filter(zhi => natalBranches.includes(zhi));
    if (!found.length) return;
    const type = found.length === remaining.length ? fullType : halfType;
    const resultRole = classifyElement(group.element, yongJi);
    const event = {
      layer:'地支', type, target:'原局' + found.join('、'), resultElement:group.element,
      resultRole, incomingRole:classifyElement(BRANCH_ELEMENT[dayZhi], yongJi), targetRole:'中性',
      domain:'整体结构', priority:type === fullType ? 4 : 1
    };
    event.impact = eventImpact(type, event.incomingRole, event.targetRole, resultRole);
    event.detail = describeEvent(event);
    events.push(event);
  });
}

function activeDaYun(calculator, bazi, gender, year) {
  if (!bazi.birthDate || !Number.isFinite(Number(bazi.birthDate.year))) return null;
  try {
    const data = calculator.calculateDaYun(
      bazi.month, bazi.year, gender,
      bazi.birthDate.year, bazi.birthDate.month, bazi.birthDate.day, bazi.birthDate.hour
    );
    return (data.list || []).find(row => year >= row.startYear && year <= row.endYear) || null;
  } catch (_) {
    return null;
  }
}

function buildDailyFacts(calculator, bazi, gender, transit) {
  const yongJi = calculator.getYongJi(bazi);
  const dayGan = transit.day.gan, dayZhi = transit.day.zhi;
  const ganRole = classifyElement(STEM_ELEMENT[dayGan], yongJi);
  const zhiRole = classifyElement(BRANCH_ELEMENT[dayZhi], yongJi);
  const events = [];
  const positions = ['year','month','day','hour'];

  positions.forEach(position => {
    const pillar = bazi[position];
    const branchTarget = POSITION_LABEL[position];
    const stemTarget = STEM_POSITION_LABEL[position];
    const domain = POSITION_DOMAIN[position];
    const targetGanRole = classifyElement(STEM_ELEMENT[pillar.gan], yongJi);
    const targetZhiRole = classifyElement(BRANCH_ELEMENT[pillar.zhi], yongJi);
    stemRelations(dayGan, pillar.gan).forEach(row => {
      const resultRole = classifyElement(row.resultElement, yongJi);
      const event = Object.assign({layer:'天干',target:stemTarget,domain,incomingRole:ganRole,targetRole:targetGanRole,resultRole,priority:2}, row);
      event.impact = eventImpact(event.type, ganRole, targetGanRole, resultRole);
      event.detail = describeEvent(event); events.push(event);
    });
    branchRelations(dayZhi, pillar.zhi).forEach(row => {
      const resultRole = classifyElement(row.resultElement, yongJi);
      const event = Object.assign({layer:'地支',target:branchTarget,domain,incomingRole:zhiRole,targetRole:targetZhiRole,resultRole,priority:row.type === '六冲' ? 4 : 3}, row);
      event.impact = eventImpact(event.type, zhiRole, targetZhiRole, resultRole);
      event.detail = describeEvent(event); events.push(event);
    });
    if (dayGan === pillar.gan && dayZhi === pillar.zhi) {
      events.push({layer:'干支',type:'伏吟',target:branchTarget,domain,incomingRole:zhiRole,targetRole:targetZhiRole,
        resultRole:zhiRole,impact:zhiRole === '忌神' ? -2 : 0,priority:4,
        detail:'流日与' + branchTarget + '完全相同，相关事情更容易重复、拖长或被再次提起'});
    }
  });

  const natalBranches = positions.map(position => bazi[position].zhi);
  addGroupEvents(events, dayZhi, natalBranches, SANHE, '三合局', '半合', yongJi);
  addGroupEvents(events, dayZhi, natalBranches, SANHUI, '三会局', '半会', yongJi);

  const daYun = activeDaYun(calculator, bazi, gender, transit.yearNumber);
  const context = [
    {label:'大运',pillar:daYun ? daYun.gan + daYun.zhi : '', gan:daYun && daYun.gan, zhi:daYun && daYun.zhi},
    {label:'流年',pillar:transit.year.gan + transit.year.zhi, gan:transit.year.gan, zhi:transit.year.zhi},
    {label:'流月',pillar:transit.month.gan + transit.month.zhi, gan:transit.month.gan, zhi:transit.month.zhi},
    {label:'流日',pillar:dayGan + dayZhi, gan:dayGan, zhi:dayZhi}
  ].filter(row => row.pillar).map(row => ({
    label:row.label, pillar:row.pillar,
    ganRole:classifyElement(STEM_ELEMENT[row.gan], yongJi),
    zhiRole:classifyElement(BRANCH_ELEMENT[row.zhi], yongJi)
  }));

  const domainCounts = {};
  events.forEach(event => { domainCounts[event.domain] = (domainCounts[event.domain] || 0) + event.priority; });
  const focus = Object.keys(domainCounts).sort((a,b) => domainCounts[b] - domainCounts[a]).slice(0,2);
  const score = roleScore(ganRole) + roleScore(zhiRole) + events.reduce((sum,event) => sum + event.impact, 0);
  const strongEvents = events.slice().sort((a,b) => b.priority - a.priority || Math.abs(b.impact) - Math.abs(a.impact)).slice(0,4);
  let tendency = '平稳';
  if (score >= 4) tendency = '偏顺';
  else if (score <= -4) tendency = '偏紧';
  else if (events.some(event => event.priority >= 3)) {
    var leadingImpact = strongEvents.length ? strongEvents[0].impact : 0;
    if (score > 0 || (score === 0 && leadingImpact > 0)) tendency = '有利变化';
    else if (score < 0 || (score === 0 && leadingImpact < 0)) tendency = '需要留意';
  }

  return {
    pillars:[bazi.year,bazi.month,bazi.day,bazi.hour].map(p => p.gan + p.zhi).join(' '),
    strength:calculator.calcDayMasterStrength(bazi), pattern:yongJi.resolvedPattern || calculator.getPattern(bazi), yongJi,
    day:{gan:dayGan,zhi:dayZhi,ganElement:STEM_ELEMENT[dayGan],zhiElement:BRANCH_ELEMENT[dayZhi],
      ganRole,zhiRole,shiShen:calculator.getShiShen(bazi.day.gan, dayGan)},
    context, events:strongEvents, focus, score, tendency,
    basis:[
      '流日' + dayGan + '属' + STEM_ELEMENT[dayGan] + '，为命局' + ganRole + '；' + dayZhi + '属' + BRANCH_ELEMENT[dayZhi] + '，为命局' + zhiRole,
      strongEvents.length ? strongEvents.map(event => event.detail).join('；') : '流日与原局没有形成强烈的刑冲合害，今天更接近日常节奏',
      context.map(row => row.label + row.pillar + '（干' + row.ganRole + '、支' + row.zhiRole + '）').join('；')
    ]
  };
}

function fallbackCopy(facts) {
  const area = facts.focus.length ? facts.focus.join('、') : '日常安排';
  const event = facts.events[0];
  if (facts.tendency === '偏顺') return '今天对你来说整体更顺，最容易有进展的是' + area + '。' + (event ? event.detail + '，事情更容易往能落实、能推进的方向发展。' : '按原计划推进，通常能看到比平时更明确的结果。');
  if (facts.tendency === '偏紧') return '今天对你来说压力偏重，最容易被牵动的是' + area + '。' + (event ? event.detail + '，现实中容易表现为临时变化、反复确认或原本谈好的事情需要重来。' : '事情不一定出大问题，但过程会比平时更费力。');
  if (facts.tendency === '有利变化') return '今天容易出现对你有利的变化，重点落在' + area + '。' + (event ? event.detail + '，原本卡住的事情更容易被推动，现实结果通常比过程看起来更好。' : '事情会比平时更容易向前推进。');
  if (facts.tendency === '需要留意') return '今天会有一些不太省心的变化，重点落在' + area + '。' + (event ? event.detail + '，相关事情容易突然被提起、临时改动，或者需要你重新处理一遍。' : '事情未必严重，但过程容易反复。');
  return '今天没有特别强的变化信号，整体接近日常状态。事情大多按照原有节奏发展，重点仍在' + area + '。';
}

module.exports = {chinaDateParts, classifyElement, stemRelations, branchRelations, buildDailyFacts, fallbackCopy};
