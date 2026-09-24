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
const POSITION_DOMAIN = {year:'家庭沟通',month:'学习或工作安排',day:'相处与日常安排',hour:'计划与收尾'};
const METHOD_VERSION = 'daily-evidence-v2';

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
  const entry = ((yongJi.elementRoleLedger || {}).entries || []).find(row => row.element === element);
  if (entry && entry.fortuneLevel === '中性双向') return '中性双向';
  if (entry && entry.fortuneLevel === '条件有利') return '条件有利';
  if (entry && entry.fortuneRole) return entry.fortuneRole;
  if ((yongJi.yongShen || []).includes(element)) return '用神';
  if ((yongJi.xiShen || []).includes(element)) return '喜神';
  if ((yongJi.jiShen || []).includes(element)) return '忌神';
  return '中性';
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

// Daily output uses qualitative gates, not an uncalibrated sum presented as luck.
function reviewPillar(calculator, yongJi, label, pillar) {
  const ganReview = calculator.classifyFortuneElement(STEM_ELEMENT[pillar.gan], yongJi, label + '天干', {
    type:'stem', symbol:pillar.gan, companionElement:BRANCH_ELEMENT[pillar.zhi], companionSymbol:pillar.zhi
  });
  const zhiReview = calculator.classifyFortuneElement(BRANCH_ELEMENT[pillar.zhi], yongJi, label + '地支', {
    type:'branch', symbol:pillar.zhi, companionElement:STEM_ELEMENT[pillar.gan], companionSymbol:pillar.gan
  });
  return {label, pillar:pillar.gan + pillar.zhi, gan:pillar.gan, zhi:pillar.zhi,
    ganRole:classifyElement(STEM_ELEMENT[pillar.gan], yongJi),
    zhiRole:classifyElement(BRANCH_ELEMENT[pillar.zhi], yongJi), ganReview, zhiReview};
}

function direction(review) {
  if (['中性双向','条件有利'].includes(review.level) || review.carrierStatus === '透而待根') return 0;
  return Math.sign(review.score);
}

function activeDaYun(calculator, bazi, gender, transit) {
  if (!bazi.birthDate) return {status:'缺少出生日期，未纳入大运', pillar:null};
  if (!transit.monthNumber || !transit.dayNumber) return {status:'缺少当天日期，未纳入大运', pillar:null};
  const birth = bazi.birthDate;
  const data = calculator.calculateDaYun(bazi.month, bazi.year, gender,
    birth.year, birth.month, birth.day, birth.hour, birth.clock);
  // startDate stores civil-calendar components, not an actual UTC instant.
  const start = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(data.startDate || '');
  if (!start) return {status:'交运时间不足，未纳入大运', pillar:null};
  const [, y, m, d, h, minute, second] = start.map(Number);
  const at = Date.UTC(transit.yearNumber, transit.monthNumber - 1, transit.dayNumber, 12);
  function boundary(index) {
    const year = y + index * 10;
    const day = Math.min(d, new Date(Date.UTC(year, m, 0)).getUTCDate());
    return Date.UTC(year, m - 1, day, h, minute, second);
  }
  const index = (data.list || []).findIndex((row, i) => at >= boundary(i) && at < boundary(i + 1));
  if (index < 0) return {status:at < boundary(0) ? '尚未起运' : '超出已排大运范围', pillar:null};
  const sameDay = value => Math.floor(value / 86400000) === Math.floor(at / 86400000);
  const boundaryDay = sameDay(boundary(index)) || sameDay(boundary(index + 1));
  return {status:boundaryDay ? '当天交运，按12时所处大运参考' : '已按交运日期纳入', pillar:data.list[index]};
}

function natalEvents(bazi, day, yongJi) {
  const events = [];
  // Repeated symbols in several palaces are one relation with several targets.
  for (const layer of ['天干','地支']) {
    const key = layer === '天干' ? 'gan' : 'zhi';
    const labels = layer === '天干' ? STEM_POSITION_LABEL : POSITION_LABEL;
    const grouped = new Map();
    for (const position of ['day','month','year','hour']) {
      const symbol = bazi[position][key];
      if (!grouped.has(symbol)) grouped.set(symbol, []);
      grouped.get(symbol).push(position);
    }
    for (const [symbol, positions] of grouped) {
      const relations = layer === '天干' ? stemRelations(day.gan, symbol) : branchRelations(day.zhi, symbol);
      if (!relations.length) continue;
      const types = relations.map(row => row.type);
      const targets = positions.map(position => labels[position]);
      const element = (layer === '天干' ? STEM_ELEMENT : BRANCH_ELEMENT)[symbol];
      const targetRole = classifyElement(element, yongJi);
      const touchesHelpful = ['用神','喜神'].includes(targetRole);
      // A clash of an adverse element does not establish successful removal.
      const risk = touchesHelpful && (types.includes('六冲') || types.includes('流日天干克原局'));
      const strong = risk || types.includes('六冲') || types.includes('天干五合') || types.includes('六合');
      const combination = relations.find(row => row.resultElement);
      const id = 'natal-' + key + '-' + symbol;
      const detail = '流日' + (layer === '天干' ? day.gan : day.zhi) + '与' + targets.join('、') + symbol
        + '有' + types.join('、') + '关系'
        + (combination ? '；仅记录相合，不据此认定合化为' + combination.resultElement : '')
        + (risk ? '；涉及原局喜用，需要留意其承接是否受影响' : '');
      events.push({id, layer, type:types[0], types, target:targets[0], targets, symbol, positions,
        domains:positions.map(position => POSITION_DOMAIN[position]), targetRole, risk, strong,
        resultElement:combination ? combination.resultElement : '', transformed:false,
        priority:risk ? 5 : types.includes('六冲') ? 4 : strong ? 3 : 1, detail});
    }
  }
  // Full-pillar repetition is an observation, never a second penalty on the same branch.
  const repeated = ['day','month','year','hour'].filter(pos => bazi[pos].gan === day.gan && bazi[pos].zhi === day.zhi);
  if (repeated.length) events.push({id:'natal-repeat', layer:'干支', type:'伏吟', types:['伏吟'],
    target:POSITION_LABEL[repeated[0]], positions:repeated, domains:repeated.map(pos => POSITION_DOMAIN[pos]),
    risk:false, strong:true, priority:2,
    detail:'流日干支与' + repeated.map(pos => POSITION_LABEL[pos]).join('、') + '相同，记作伏吟；不单凭重复判断吉凶或断言旧事重来'});
  const natalBranches = ['year','month','day','hour'].map(pos => bazi[pos].zhi);
  for (const [groups, type] of [[SANHE,'三合'],[SANHUI,'三会']]) {
    for (const group of groups) {
      if (!group.members.includes(day.zhi)) continue;
      const others = group.members.filter(zhi => zhi !== day.zhi);
      if (!others.every(zhi => natalBranches.includes(zhi))) continue;
      const newMember = !natalBranches.includes(day.zhi);
      events.push({id:'group-' + type + '-' + group.element, layer:'地支', type:type + '组合', types:[type + '组合'],
        target:'原局', positions:[], domains:[], resultElement:group.element, transformed:false,
        risk:false, strong:newMember, priority:newMember ? 3 : 1,
        detail:newMember ? '流日' + day.zhi + '补齐' + group.members.join('') + type + '所需三支；未核定合化，不按' + group.element + '自动加吉分'
          : group.members.join('') + type + '所需三支原局已有，流日重复其中一支，不另算新成局'});
    }
  }
  return events.sort((a,b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

function reviewBackground(context, day) {
  return context.filter(row => row.label !== '流日').map(row => {
    const links = [];
    for (const [key, elementMap] of [['gan',STEM_ELEMENT],['zhi',BRANCH_ELEMENT]]) {
      const source = row[key], target = day[key];
      const review = day[key + 'Review'];
      const related = key === 'gan' ? stemRelations(target, source) : branchRelations(target, source);
      const types = related.map(item => item.type);
      const same = source === target;
      const restrained = key === 'gan' && OVERCOMES[elementMap[source]] === elementMap[target];
      const disputed = types.some(type => ['六冲','六合','天干五合','六害','相破','相刑'].includes(type));
      // Support here means the SAME daily carrier is repeated in the background,
      // not that the entire month/year/decade is auspicious or a transit has formed a new mechanism.
      if (!same && !restrained && !related.length) continue;
      const state = restrained || disputed ? '受牵制' : !same ? '存在生克联系' : direction(review) > 0 ? '同向承接'
        : direction(review) < 0 ? '压力重复' : '双向重复';
      const relation = same ? '同字重见' : types.map(type => type.replace('流日天干克原局','流日天干克背景天干').replace('原局天干克流日','背景天干克流日')).join('、');
      links.push({carrier:key, state, relation, detail:row.label + row.pillar + '与流日'
        + (key === 'gan' ? '天干' : '地支') + target + '：' + relation + '（' + state + '）'});
    }
    return {label:row.label, pillar:row.pillar, links};
  });
}

function buildDailyFacts(calculator, bazi, gender, transit) {
  for (const pillar of [bazi.year,bazi.month,bazi.day,bazi.hour,transit.year,transit.month,transit.day]) {
    if (!pillar || !STEM_ELEMENT[pillar.gan] || !BRANCH_ELEMENT[pillar.zhi]) throw new Error('完整命盘或日期干支不足');
  }
  const yongJi = calculator.getYongJi(bazi);
  const day = reviewPillar(calculator, yongJi, '流日', transit.day);
  const daYun = activeDaYun(calculator, bazi, gender, transit);
  const context = [];
  if (daYun.pillar) context.push(reviewPillar(calculator, yongJi, '大运', daYun.pillar));
  context.push(reviewPillar(calculator, yongJi, '流年', transit.year),
    reviewPillar(calculator, yongJi, '流月', transit.month), day);
  const allEvents = natalEvents(bazi, day, yongJi);
  const background = reviewBackground(context, day);
  const links = background.flatMap(row => row.links);
  const positive = [day.ganReview,day.zhiReview].some(review => direction(review) > 0);
  const negative = [day.ganReview,day.zhiReview].some(review => direction(review) < 0);
  const conditional = [day.ganReview,day.zhiReview].some(review => direction(review) === 0);
  const dualRole = [day.ganReview,day.zhiReview].some(review => review.level === '中性双向' && review.role !== '中性');
  const restrainedPositive = links.some(link => link.state === '受牵制' && direction(day[link.carrier + 'Review']) > 0);
  const repeatedPressure = links.some(link => link.state === '压力重复');
  const hasTrigger = allEvents.some(event => event.strong);
  const helpfulRisk = allEvents.some(event => event.risk);
  let tendency = '平稳', decision = 'no-strong-trigger';
  if (hasTrigger) {
    if (dualRole || (positive && (negative || conditional || helpfulRisk || restrainedPositive))) {
      tendency = '利弊并见'; decision = 'mixed-or-constrained';
    } else if (helpfulRisk || negative) {
      tendency = repeatedPressure ? '偏紧' : '需要留意'; decision = 'pressure-triggered';
    } else if (positive && !conditional) {
      tendency = '有利变化'; decision = 'favorable-triggered';
    } else {
      tendency = '有引动'; decision = 'trigger-without-direction';
    }
  }
  const events = allEvents.slice(0,3);
  const focus = [...new Set(events.flatMap(event => event.domains))].slice(0,2);
  const backgroundSummary = links.length ? [...new Set(links.map(link => link.detail))].join('；')
    : '大运、流年、流月中已纳入的层次，与流日未见本规则识别的直接同字或合冲克制关系；不另加吉凶判断';
  const basis = [
    '流日' + day.pillar + '：天干' + day.gan + '（' + day.ganReview.level + '）；地支' + day.zhi + '（' + day.zhiReview.level + '）',
    events.length ? events.map(event => event.detail).join('；') : '流日与原局未见本规则识别的直接引动',
    backgroundSummary
  ];
  const notes = [daYun.status, '以中国标准时间当日12时的节气归属和大运为日级参考，不细分当天交节、交运前后'];
  const seenConditions = new Set();
  const conditions = [day.ganReview,day.zhiReview]
    .filter(review => direction(review) === 0 || review.carrierStatus === '新增作用有条件')
    .map(review => (review.carrierReason || review.reason).split(/[；;]/)
      .map(clause => clause.trim().replace(/^同柱配合：/, ''))
      .filter(clause => {
        if (!clause || seenConditions.has(clause)) return false;
        seenConditions.add(clause); return true;
      }).join('；')).filter(Boolean);
  return {
    methodVersion:METHOD_VERSION,
    pillars:[bazi.year,bazi.month,bazi.day,bazi.hour].map(p => p.gan + p.zhi).join(' '),
    strength:calculator.calcDayMasterStrength(bazi), pattern:yongJi.resolvedPattern || calculator.getPattern(bazi), yongJi,
    day:{...day, ganElement:STEM_ELEMENT[day.gan], zhiElement:BRANCH_ELEMENT[day.zhi], shiShen:calculator.getShiShen(bazi.day.gan, day.gan)},
    context, events, allEvents, background, focus, tendency, basis, notes,
    decision:{rule:decision, hasTrigger, helpfulRisk, restrainedPositive, repeatedPressure},
    // These are engine conditions, not independently verified real-world occurrences.
    conditions,
    scope:'传统命理规则下的日级观察，不是经过现实命中率验证的事件预测'
  };
}

function buildDailyCopy(facts) {
  const titles = {平稳:'今天按原有安排来',有利变化:'把准备好的事向前推',需要留意:'重要安排先确认清楚',偏紧:'把时间留给最重要的事',利弊并见:'可以推进，也要留出余地',有引动:'先把时间和分工说清楚'};
  const intros = {
    平稳:'今天没有足够强的引动信号，按原计划安排即可。',
    有利变化:'流日所带的五行作用偏有利，并与原局有直接联系；可以把已经准备好的事往前推进，但不据此保证结果。',
    需要留意:'当天引动涉及喜用承接或原局所忌的作用，适合把注意力放在已有安排的细节上。',
    偏紧:'当天有直接引动，而且压力方向在岁运背景中重见。安排别塞得太满，先保证最重要的一件事做完。',
    利弊并见:'当天有可以利用的作用，也有牵制或需要满足的条件。可以推进已有计划，但别把时间、钱或承诺一次压满。',
    有引动:'当天与原局有直接联系，但这组关系本身不能定成吉或凶；先看手头正在推进的事有没有需要协调的地方。'
  };
  const advice = {
    家庭沟通:'如果今天要和家人商量安排，把由谁负责、何时办完说清楚，别只以为对方已经明白。',
    学习或工作安排:'如果今天有作业、考试准备、任务提交或合作，先核对要求和截止时间，减少临到最后返工。',
    相处与日常安排:'如果今天有约定或需要一起作决定，先确认时间和各自的打算，别替对方默认答应。',
    计划与收尾:'如果今天要交付、提交材料或结束一项安排，把遗漏和后续步骤过一遍。'
  };
  const specific = facts.decision.hasTrigger && facts.focus.length ? advice[facts.focus[0]]
    : '照常处理学习、工作和生活安排即可，不必因为今日标签改变原定的重要决定。';
  return {headline:titles[facts.tendency], tip:intros[facts.tendency] + specific};
}

function fallbackCopy(facts) { return buildDailyCopy(facts).tip; }

module.exports = {METHOD_VERSION, chinaDateParts, classifyElement, stemRelations, branchRelations,
  activeDaYun, buildDailyFacts, buildDailyCopy, fallbackCopy};
