(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeepReport = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SCHEMA_VERSION = '2.0.0';

  var PILLARS = ['year', 'month', 'day', 'hour'];
  var PILLAR_LABELS = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
  var STORAGE_ELEMENTS = { '丑': '金', '未': '木', '辰': '水', '戌': '火' };
  var STORAGE_CLASH = { '丑': '未', '未': '丑', '辰': '戌', '戌': '辰' };
  var BRANCH_CLASH = { '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅', '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳' };
  var BRANCH_HARM = { '子': '未', '未': '子', '丑': '午', '午': '丑', '寅': '巳', '巳': '寅', '卯': '辰', '辰': '卯', '申': '亥', '亥': '申', '酉': '戌', '戌': '酉' };
  var BRANCH_COMBINE = { '子': '丑', '丑': '子', '寅': '亥', '亥': '寅', '卯': '戌', '戌': '卯', '辰': '酉', '酉': '辰', '巳': '申', '申': '巳', '午': '未', '未': '午' };
  var BRANCH_PUNISH = { '子卯': 1, '卯子': 1, '寅巳': 1, '巳寅': 1, '巳申': 1, '申巳': 1, '申寅': 1, '寅申': 1, '丑戌': 1, '戌丑': 1, '戌未': 1, '未戌': 1, '未丑': 1, '丑未': 1 };
  var STEM_COMBINE = { '甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊' };
  var STEM_COMBINE_ELEMENT = { '甲己': '土', '己甲': '土', '乙庚': '金', '庚乙': '金', '丙辛': '水', '辛丙': '水', '丁壬': '木', '壬丁': '木', '戊癸': '火', '癸戊': '火' };
  var BRANCH_COMBINE_ELEMENT = { '子丑': '土', '丑子': '土', '寅亥': '木', '亥寅': '木', '卯戌': '火', '戌卯': '火', '辰酉': '金', '酉辰': '金', '巳申': '水', '申巳': '水', '午未': '土', '未午': '土' };
  var THREE_COMBINE = [
    { branches: ['寅', '午', '戌'], element: '火' },
    { branches: ['亥', '卯', '未'], element: '木' },
    { branches: ['申', '子', '辰'], element: '水' },
    { branches: ['巳', '酉', '丑'], element: '金' },
  ];
  var THREE_MEET = [
    { branches: ['寅', '卯', '辰'], element: '木' },
    { branches: ['巳', '午', '未'], element: '火' },
    { branches: ['申', '酉', '戌'], element: '金' },
    { branches: ['亥', '子', '丑'], element: '水' },
  ];

  function list(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    return [value];
  }

  function textOf(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(' ');
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return [value.title, value.name, value.type, value.category, value.detail, value.desc, value.text,
      value.conclusion, value.source, value.target, value.pillars, value.elements].filter(Boolean).join(' ');
  }

  function includeElement(values, element) {
    return list(values).some(function (value) {
      return value === element || (value && value.element === element);
    });
  }

  function classifyElementRole(element, yongJi) {
    yongJi = yongJi || {};
    if (includeElement(yongJi.yongShen, element) || includeElement(yongJi.useful, element)) return '用神';
    if (includeElement(yongJi.xiShen, element) || includeElement(yongJi.favorable, element)) return '喜神';
    if (includeElement(yongJi.jiShen, element) || includeElement(yongJi.avoid, element)) return '忌神';
    if (yongJi.elementReasons && yongJi.elementReasons[element]) {
      return yongJi.elementReasons[element].role || '中性';
    }
    return '中性';
  }

  function favorableRole(role) {
    return role === '用神' || role === '喜神';
  }

  function getStemRole(dayGan, gan, calculator) {
    if (!gan) return '十神未定';
    if (calculator && typeof calculator.getShiShen === 'function') {
      return calculator.getShiShen(dayGan, gan) || '十神未定';
    }
    if (calculator && typeof calculator.getTenGod === 'function') {
      return calculator.getTenGod(dayGan, gan) || '十神未定';
    }
    return '十神未定';
  }

  function getHiddenStems(pillar, calculator) {
    if (!pillar) return [];
    if (Array.isArray(pillar.cangGan)) return pillar.cangGan;
    if (Array.isArray(pillar.hiddenStems)) return pillar.hiddenStems;
    if (calculator && typeof calculator.getCangGan === 'function') {
      return calculator.getCangGan(pillar.zhi) || [];
    }
    return [];
  }

  function collectTenGodOccurrences(bazi, calculator, predicate) {
    var dayGan = bazi && bazi.day && bazi.day.gan;
    var wuXing = (calculator && calculator.WU_XING) || {};
    var result = [];
    PILLARS.forEach(function (pillarName) {
      var pillar = bazi && bazi[pillarName];
      if (!pillar) return;
      var exposedRole = getStemRole(dayGan, pillar.gan, calculator);
      if (predicate(exposedRole, pillar.gan, pillarName, '天干')) {
        result.push({
          pillar: pillarName,
          pillarLabel: PILLAR_LABELS[pillarName],
          layer: '天干',
          gan: pillar.gan,
          role: exposedRole,
          element: wuXing[pillar.gan] || '',
        });
      }
      getHiddenStems(pillar, calculator).forEach(function (gan, index) {
        var layer = index === 0 ? '本气' : (index === 1 ? '中气' : '余气');
        var role = getStemRole(dayGan, gan, calculator);
        if (!predicate(role, gan, pillarName, layer)) return;
        result.push({
          pillar: pillarName,
          pillarLabel: PILLAR_LABELS[pillarName],
          layer: layer,
          gan: gan,
          role: role,
          element: wuXing[gan] || '',
        });
      });
    });
    return result;
  }

  function selectStudyRoles(occurrences, roles) {
    return list(occurrences).filter(function (item) {
      return roles.indexOf(item && item.role) >= 0;
    });
  }

  function studyOccurrenceEvidence(occurrences) {
    return list(occurrences).map(function (item) {
      return item.pillarLabel + item.layer + '出现' + item.gan + item.role +
        (item.element ? '（' + item.element + '）' : '');
    });
  }

  function studyElementRole(occurrences, core) {
    var roles = list(occurrences).map(function (item) {
      return classifyElementRole(item.element, core && core.yongJi);
    });
    if (roles.indexOf('用神') >= 0) return '用神';
    if (roles.indexOf('喜神') >= 0) return '喜神';
    if (roles.indexOf('忌神') >= 0) return '忌神';
    return roles.length ? roles[0] : '中性';
  }

  function studyHasElementRole(occurrences, core, role) {
    return list(occurrences).some(function (item) {
      return classifyElementRole(item.element, core && core.yongJi) === role;
    });
  }

  function studyActionText(core) {
    return list(core && core.actionChains).map(textOf).concat([
      textOf(core && core.chain),
    ]).filter(Boolean).join(' ');
  }

  function studyPatternText(core) {
    var pattern = core && core.pattern || {};
    return [pattern.name, pattern.label, pattern.source].concat(list(pattern.evidence).map(textOf))
      .filter(Boolean).join(' ');
  }

  function studyPatternEffective(core) {
    var pattern = core && core.pattern || {};
    var status = textOf(pattern.status || pattern.state || pattern.result);
    if (pattern.isEstablished === false || pattern.established === false || pattern.valid === false) return false;
    if (pattern.isEstablished === true || pattern.established === true || pattern.valid === true) return true;
    if (/破格|未成|不成|失效|无效/.test(status)) return false;
    return /成格|成立|有效|真格/.test(status);
  }

  function studyPathOccurrenceEvidence(occurrences, core) {
    return list(occurrences).map(function (item) {
      return item.pillarLabel + item.layer + '出现' + item.gan + item.role +
        '，喜忌角色为' + classifyElementRole(item.element, core && core.yongJi);
    });
  }

  function studyPathEvidence(core, occurrences) {
    var pattern = core && core.pattern || {};
    var rows = studyPathOccurrenceEvidence(occurrences, core);
    if (studyPatternEffective(core)) {
      rows.push('有效格局证据：' + (pattern.name || pattern.label || '已确认格局') + '·' + (pattern.status || '成立'));
    } else {
      rows.push('格局未满足强路径条件，需结合实际十神与现实反馈验证。');
    }
    rows = rows.concat(list(core && core.actionChains).map(textOf).filter(Boolean));
    return rows;
  }

  function buildAbsorptionFacts(seals, core) {
    var role = studyElementRole(seals, core);
    var evidenceRows = studyOccurrenceEvidence(seals);
    var patternText = studyActionText(core);
    if (!seals.length) {
      return evidence('待建立', '原局未见明确印星承接证据，吸收理解更依赖兴趣、方法和外部支持，需要把输入拆成可复习的步骤。', 'limited', ['印星未显'], role);
    }
    if (role === '忌神') {
      return evidence('需转化', '印星数量或存在感不等于天然学业好；印为忌时容易停在思虑、囤积资料或过度依赖理解，需用行动、练习和输出把知识转化。', 'strong', evidenceRows.concat(['印星被核心喜忌标为忌神']), role);
    }
    if (/枭神夺食/.test(patternText)) {
      return evidence('输入与输出拉扯', '印星承接与食伤输出之间有拉扯，理解阶段宜设置明确的复述、练习和交付节点。', 'medium', evidenceRows.concat(['已见枭神夺食结构提示']), role);
    }
    return evidence('有承接', '印星提供一定的知识吸收和理解承接，仍需通过复述、练习与应用确认真正掌握。', 'medium', evidenceRows, role);
  }

  function buildExpressionFacts(outputs, core) {
    var role = studyElementRole(outputs, core);
    var evidenceRows = studyOccurrenceEvidence(outputs);
    var hasFood = outputs.some(function (item) { return item.role === '食神'; });
    var hasWound = outputs.some(function (item) { return item.role === '伤官'; });
    var patternText = studyActionText(core);
    if (!outputs.length) {
      return evidence('待建立', '表达输出证据较少，建议用写作、讲解、题后复盘或作品交付把理解外化。', 'limited', ['食伤未显'], role);
    }
    if (/伤官见官/.test(patternText) && hasWound) {
      return evidence('创新输出', '伤官提供质疑、拆解和创新表达；在标准化考试或规则环境中需校准表达方式，不把结构摩擦直接等同于考试能力不足。', 'medium', evidenceRows.concat(['已见伤官见官结构提示']), role);
    }
    if (hasFood && hasWound) {
      return evidence('复合输出', '食神的稳定表达与伤官的创新表达并见，适合在稳定练习和开放创作之间切换。', 'medium', evidenceRows, role);
    }
    return evidence(hasWound ? '创新输出' : '稳定输出', hasWound
      ? '伤官偏向拆解、创新和观点表达，宜通过项目、讲解或作品验证理解。'
      : '食神偏向稳定、持续的表达输出，宜通过固定练习和复盘形成可重复的方法。', 'medium', evidenceRows, role);
  }

  function buildDisciplineFacts(officers, seals, core) {
    var role = studyElementRole(officers, core);
    var evidenceRows = studyOccurrenceEvidence(officers.concat(seals));
    var patternText = studyActionText(core) + ' ' + studyPatternText(core);
    var mixed = officers.some(function (item) { return item.role === '正官'; }) &&
      officers.some(function (item) { return item.role === '七杀'; });
    if (studyPatternEffective(core) && seals.length && officers.length && /官印相生|杀印相生/.test(patternText)) {
      return evidence('可借规则转化', '官杀与印形成承接或转化链路，适合把长期目标拆成计划、检查点和阶段性认证；执行仍需现实投入。', 'strong', evidenceRows.concat([/杀印相生/.test(patternText) ? '杀印相生结构提示' : '官印相生结构提示']), role);
    }
    if (mixed || /官杀混杂/.test(patternText)) {
      return evidence('规则切换', '官杀信号并见或规则要求较多，纪律与应试状态容易受环境切换影响，宜减少并行目标并明确优先级。', 'medium', evidenceRows.concat(['官杀混杂或混合规则提示']), role);
    }
    if (!officers.length) {
      return evidence('需外部节奏', '原局官杀纪律证据较少，长期学习更适合借助固定作息、截止时间、同伴监督或可见进度来维持执行。', 'limited', ['官杀未显'], role);
    }
    return evidence('有规则承接', '官杀提供一定的规则意识与长期执行线索，适合用固定计划和阶段检查维持应试节奏。', 'medium', evidenceRows, role);
  }

  function buildApplicationFacts(tenGods, core) {
    var outputs = selectStudyRoles(tenGods, ['食神', '伤官']);
    var wealth = selectStudyRoles(tenGods, ['正财', '偏财']);
    var evidenceRows = studyOccurrenceEvidence(outputs).concat(studyOccurrenceEvidence(wealth));
    var role = studyElementRole(outputs.concat(wealth), core);
    if (outputs.length && wealth.length) {
      return evidence('学以致用', '食伤与财星同时出现，适合把学习落到技能、项目、作品或可交付成果，边做边校准理解。', 'medium', evidenceRows, role);
    }
    if (outputs.length) {
      return evidence('实践转化', '已有食伤输出线索，适合通过实验、项目、作品或讲解把知识变成可验证的能力。', 'medium', evidenceRows, role);
    }
    return evidence('需要应用', '实践转化证据尚不集中，建议为每个学习主题设置小练习、真实任务或复盘产物，避免只停留在记忆层面。', 'limited', evidenceRows.concat(['食伤与财星的应用链路不明显']), role);
  }

  function studyRiskText(risk) {
    risk = risk || {};
    return [risk.type, risk.name, risk.category, risk.title, risk.why, risk.detail,
      risk.desc, risk.conclusion, risk.evidence, risk.partyEvidence].map(textOf).filter(Boolean).join(' ');
  }

  function studyAuthoritativeRecords(core) {
    function itemText(item) {
      if (!item || typeof item !== 'object') return textOf(item);
      return [textOf(item), item.label, item.action, item.actionChain, item.reason, item.reasons,
        item.evidence, item.primaryReason, item.chainNote, item.chainAction, item.note]
        .concat(Object.keys(item).map(function (key) { return itemText(item[key]); }))
        .map(textOf).filter(Boolean).join(' ');
    }
    core = core || {};
    var yongJi = core.yongJi || {};
    var chain = core.chain || {};
    var records = [];
    var addList = function (value) {
      list(value).map(itemText).filter(Boolean).forEach(function (item) { records.push(item); });
    };
    addList(core.actionChains);
    addList(yongJi.reasoning);
    addList(yongJi.primaryReason);
    addList(yongJi.evidence);
    Object.keys(yongJi.elementReasons || {}).forEach(function (element) { addList(yongJi.elementReasons[element]); });
    addList(yongJi.chainHints);
    addList(yongJi.chainAdjustments);
    addList(chain.hints);
    addList(chain.adjustments);
    return records;
  }

  function studyAuthoritativeText(core) {
    return studyAuthoritativeRecords(core).join(' ');
  }

  function studyStructuralBlockers(core, names) {
    var wanted = list(names);
    var blockers = list(core && core.structuralRisks).concat(list(core && core.relationEvents)).map(function (risk) {
      var text = studyRiskText(risk);
      var match = wanted.filter(function (name) { return text.indexOf(name) >= 0; })[0];
      return match ? '结构风险：' + match : '';
    }).filter(Boolean);
    var authoritative = studyAuthoritativeText(core);
    wanted.forEach(function (name) {
      if (authoritative.indexOf(name) >= 0) blockers.push('结构证据：' + name);
    });
    return blockers.filter(function (item, index, rows) { return rows.indexOf(item) === index; });
  }

  function studyChainFact(id, present, evidenceRows, elementRoles, blockers, conditions, conclusion, confidence) {
    return {
      id: id,
      present: Boolean(present),
      evidence: list(evidenceRows).filter(Boolean),
      elementRoles: elementRoles || {},
      blockers: list(blockers).filter(Boolean),
      conditions: list(conditions).filter(Boolean),
      conclusion: conclusion,
      confidence: confidence || 'limited',
    };
  }

  function buildShaYinChain(seals, officers, core) {
    var patternText = studyPatternText(core);
    var authoritative = studyAuthoritativeText(core);
    var sealRole = studyElementRole(seals, core);
    var officerRole = studyElementRole(officers, core);
    var effectivePattern = studyPatternEffective(core) && /杀印相生|官印相生|印星化杀/.test(patternText);
    var explicitChain = /杀印相生|官印相生/.test(authoritative);
    var present = Boolean(seals.length && officers.length && (effectivePattern || explicitChain));
    var blockers = studyStructuralBlockers(core, ['财破印', '财坏印', '枭神夺食', '伤官见官', '官杀混杂', '杀重无制']);
    if (!seals.length) blockers.push('缺少印星实际出现证据');
    if (!officers.length) blockers.push('缺少官杀实际出现证据');
    if (!effectivePattern && !explicitChain) blockers.push('缺少有效杀印/官印链证据');
    if (!studyPatternEffective(core) && /破格|未成|不成|失效|无效/.test(textOf(core && core.pattern && (core.pattern.status || core.pattern.state || core.pattern.result)))) {
      blockers.push('格局破格或未成立');
    }
    if (sealRole === '忌神') blockers.push('印星为忌神，不能直接转为承接优势');
    var confidence = present && (sealRole === '用神' || sealRole === '喜神') && blockers.length === 0 ? 'strong'
      : (present || effectivePattern || explicitChain ? 'medium' : 'limited');
    return studyChainFact('sha_yin', present,
      studyOccurrenceEvidence(officers.concat(seals)).concat(effectivePattern ? ['有效格局证据：' + (core.pattern.name || '杀印/官印链')] : []).concat(explicitChain ? ['权威行动链证据：' + authoritative] : []),
      { officerKind: officers.map(function (item) { return item.role; }).filter(Boolean).filter(function (item, i, rows) { return rows.indexOf(item) === i; }),
        sealKind: seals.map(function (item) { return item.role; }).filter(Boolean).filter(function (item, i, rows) { return rows.indexOf(item) === i; }),
        officerRole: officerRole, sealRole: sealRole }, blockers,
      ['仅表示在规则、阶段目标与系统输入之间建立学习方法；仍需现实练习与反馈验证。'],
      '若官杀与印的有效链路成立，可把阶段目标、规则检查和系统输入结合起来；这不是教育结果判断。', confidence);
  }

  function buildWealthRegulatesSealChain(seals, wealth, core) {
    var authoritative = studyAuthoritativeText(core);
    var explicit = studyAuthoritativeRecords(core).some(function (record) {
      return /印(?:星)?成势[\s\S]*(?:财(?:星)?制印)|(?:财(?:星)?制印)[\s\S]*印(?:星)?成势/.test(record);
    });
    var wealthRole = studyElementRole(wealth, core);
    var sealRole = studyElementRole(seals, core);
    var present = Boolean(seals.length && wealth.length && explicit);
    var blockers = studyStructuralBlockers(core, ['财破印', '财坏印']);
    if (!seals.length) blockers.push('缺少印星实际出现证据');
    if (!wealth.length) blockers.push('缺少财星实际出现证据');
    if (!explicit) blockers.push('缺少权威的印成势→财制印证据');
    if (wealthRole !== '用神' && wealthRole !== '喜神') blockers.push('财星未被核心喜忌标为用神或喜神');
    if (studyHasElementRole(wealth, core, '忌神')) blockers.push('财星同时含忌神角色，需先处理方向冲突');
    var confidence = present && blockers.length === 0 ? 'medium' : 'limited';
    var result = studyChainFact('wealth_regulates_seal', present,
      studyOccurrenceEvidence(wealth.concat(seals)).concat(explicit ? ['权威行动链证据：印成势→财制印'] : []),
      { wealth: wealthRole, seal: sealRole, wealthRole: wealthRole, sealRole: sealRole, wealthKind: wealth.map(function (item) { return item.role; }).filter(Boolean),
        sealKind: seals.map(function (item) { return item.role; }).filter(Boolean) }, blockers,
      ['财制印与财破印/财坏印是不同事实；仍需结合结构风险与现实资源约束。'],
      '若印成势、财为用喜且无财破印风险，可把目标、输出和资源约束作为输入转化的方法；不替代核心喜忌。', confidence);
    result.unsupported = !explicit;
    return result;
  }

  function buildFoodControlsShaChain(outputs, officers, core) {
    var foods = outputs.filter(function (item) { return item.role === '食神'; });
    var sha = officers.filter(function (item) { return item.role === '七杀'; });
    var patternText = studyPatternText(core);
    var authoritative = studyAuthoritativeText(core);
    var effective = studyPatternEffective(core) && /食神制杀格/.test(patternText);
    var explicit = /食神制杀/.test(authoritative);
    var present = Boolean(foods.length && sha.length);
    var blockers = studyStructuralBlockers(core, ['伤官见官', '官杀混杂', '杀重无制', '枭神夺食', '财党杀', '承载不足', '身弱不担财']);
    if (/伤官见官/.test(authoritative)) blockers.push('结构风险：伤官见官');
    if (authoritative.indexOf('食神克正官') >= 0) blockers.push('食神克正官不是食神制杀证据');
    if (!foods.length) blockers.push('缺少食神实际出现证据');
    if (!sha.length) blockers.push('缺少七杀实际出现证据');
    if (!effective && !explicit) blockers.push('缺少有效食神制杀证据');
    if (studyHasElementRole(outputs, core, '忌神')) blockers.push('食神/伤官为忌神，输出转化受限');
    var confidence = present && (effective || explicit) && blockers.length === 0 ? 'strong'
      : (present ? 'medium' : 'limited');
    if (blockers.length > 0 && present) confidence = 'limited';
    return studyChainFact('food_controls_sha', present,
      studyOccurrenceEvidence(foods.concat(sha)).concat(effective ? ['有效格局证据：食神制杀格'] : []).concat(explicit ? ['权威行动链证据：食神制杀'] : []),
      { outputKind: foods.length ? '食神' : (outputs.some(function (item) { return item.role === '伤官'; }) ? '伤官' : '未定'),
        officerKind: sha.length ? '七杀' : (officers.some(function (item) { return item.role === '正官'; }) ? '正官' : '未定'),
        outputRole: studyElementRole(outputs, core), officerRole: studyElementRole(officers, core) }, blockers,
      ['食神制杀只讨论七杀与有效食神链；正官和伤官见官必须分别处理。'],
      '若食神与七杀的制化链有核心证据，可把任务、练习和表达作为压力转化方法；仍需观察实际反馈。', confidence);
  }

  function buildYangrenOutputChain(outputs, core) {
    var patternText = studyPatternText(core) + ' ' + studyAuthoritativeText(core);
    var yangren = /羊刃/.test(patternText);
    var output = outputs.length > 0;
    var explicit = /羊刃[\s\S]*(食神|伤官|食伤)|羊刃吐秀|食伤[\s\S]*羊刃/.test(patternText);
    var result = studyChainFact('yangren_output', yangren && output,
      studyOccurrenceEvidence(outputs).concat(yangren ? ['羊刃相关格局或行动证据'] : []),
      { outputRole: studyElementRole(outputs, core), pattern: yangren ? '羊刃' : '未见羊刃' },
      yangren && output && !explicit ? ['缺少权威的羊刃—食伤链证据'] : [],
      ['仅作 limited/manual-review 候选；不能仅由印星数量推断印旺。'],
      '羊刃与输出同时出现时，可人工复核练习和作品方向；自动报告不把它升级为确定优势。', 'limited');
    result.manualReviewRequired = true;
    return result;
  }

  function buildLearningPressureChain(officers, seals, core) {
    var level = textOf(core && core.strength && core.strength.level);
    var weak = /弱/.test(level) && !core.congGe;
    var present = weak && officers.length > 0 && seals.length === 0;
    return studyChainFact('learning_pressure', present,
      studyOccurrenceEvidence(officers),
      { strength: level || '未定', officerRole: studyElementRole(officers, core), sealRole: '未见' },
      present ? ['身弱/极弱且官杀见、无印'] : [],
      ['只描述学习承载与规则压力的条件性议题，不涉及健康或教育结果。'],
      present ? '身弱或极弱、官杀出现而印未见时，学习中的规则压力与承载度需要分段安排和外部支持；这是条件性压力提示。'
        : '未满足身弱、官杀见且无印的联合门槛，不单独生成学习压力判断。', present ? 'limited' : 'limited');
  }

  function buildStudyChains(tenGods, core) {
    var seals = selectStudyRoles(tenGods, ['正印', '偏印']);
    var outputs = selectStudyRoles(tenGods, ['食神', '伤官']);
    var officers = selectStudyRoles(tenGods, ['正官', '七杀']);
    var wealth = selectStudyRoles(tenGods, ['正财', '偏财']);
    return [
      buildShaYinChain(seals, officers, core),
      buildWealthRegulatesSealChain(seals, wealth, core),
      buildFoodControlsShaChain(outputs, officers, core),
      buildYangrenOutputChain(outputs, core),
      buildLearningPressureChain(officers, seals, core),
    ];
  }

  var STUDY_PROFILE_RANK = {
    persistent_sha_yin: 100,
    disciplined_guan_yin: 90,
    inspired_breakthrough: 88,
    smart_and_hardworking_food_sha: 84,
    smart_and_hardworking_wound_sha: 80,
    smart_and_hardworking_food_officer: 76,
    smart_action_regulation: 74,
    metal_water_clarity: 70,
    wood_fire_clarity: 70,
    composite: 50,
  };

  var STUDY_PROFILE_COPY = {
    persistent_sha_yin: {
      sourceText: '杀印相生链成立，印星为本命用神或喜神。',
      outcomeText: '你属于不怕重复、肯下功夫的长期投入型；目标越难、准备周期越长，越容易把压力变成成绩。',
      educationFloor: 8,
    },
    disciplined_guan_yin: {
      sourceText: '官印相生链成立，印星为本命用神或喜神。',
      outcomeText: '你对课程体系、考试规则和长期计划的适应力较强，按标准持续积累时，成绩更容易稳定兑现。',
      educationFloor: 7,
    },
    inspired_breakthrough: {
      sourceText: '日主旺极、印星成势，羊刃同时得到有效食伤吐秀。',
      outcomeText: '你属于灵感和突破力很强的类型，面对竞赛、创作、复杂难题或高强度任务时，往往比常规课堂更容易显出聪明。',
      educationFloor: 9,
    },
    smart_and_hardworking_food_sha: {
      sourceText: '食神制杀链成立，食神能够制约七杀。',
      outcomeText: '你既能扛住压力，也能把压力转成解题和专业能力，属于聪明且愿意下功夫的类型。',
      educationFloor: 8,
    },
    smart_and_hardworking_wound_sha: {
      sourceText: '伤官合杀链成立，伤官与七杀形成有效转化。',
      outcomeText: '你的反应、拆解和临场调整能力较强，越是需要独立思考和解决难题的学习，越容易拉开差距。',
      educationFloor: 7,
    },
    smart_and_hardworking_food_officer: {
      sourceText: '食神克官链有实际十神和权威结构支持。',
      outcomeText: '你能用自己的理解消化规则，但对僵硬标准容易产生抵触；能力型考试通常好于纯服从型环境。',
      educationFloor: 7,
    },
    smart_action_regulation: {
      sourceText: '印星成势且为忌，喜用财星形成财制印，没有财坏印证据。',
      outcomeText: '你不是只会想而不会做；一旦目标和现实结果明确，思考会很快转成行动，聪明程度更容易通过成果体现。',
      educationFloor: 7,
    },
    metal_water_clarity: {
      sourceText: '金水实际相生，且没有金寒水冷、燥土埋金等阻断。',
      outcomeText: '你的逻辑、归纳和信息处理能力较突出，数理、金融、法律、技术分析一类学习更容易形成优势。',
      educationFloor: 7,
    },
    wood_fire_clarity: {
      sourceText: '木火实际相生，且没有火炎木焚、木火偏枯等阻断。',
      outcomeText: '你的理解、表达和联想能力较突出，文学、艺术、教育、传播或需要形成观点的学习更容易显出优势。',
      educationFloor: 7,
    },
    composite: {
      sourceText: '命局未形成单一高权重学习结构，按吸收、输出、纪律和应用四项综合判断。',
      outcomeText: '你的学习表现更依赖各环节是否接得上，不属于只靠某一种天赋就能稳定出成绩的类型。',
      educationFloor: 0,
    },
  };

  function studyProfileRecord(key, basis) {
    var copy = STUDY_PROFILE_COPY[key] || STUDY_PROFILE_COPY.composite;
    return {
      key: key,
      rank: STUDY_PROFILE_RANK[key] || 0,
      sourceText: copy.sourceText,
      outcomeText: copy.outcomeText,
      educationFloor: copy.educationFloor,
      basis: list(basis).filter(Boolean),
    };
  }

  function qualifiedElementOccurrences(tenGods, element) {
    return list(tenGods).filter(function (item) {
      return item && item.element === element && (item.layer === '天干' || item.layer === '本气');
    });
  }

  function buildStudyPairingProfile(bazi, tenGods, core) {
    var authoritative = studyAuthoritativeText(core) + ' ' + list(core && core.structuralRisks).map(studyRiskText).join(' ');
    var blockerText = authoritative.replace(/不寒|不冻|不燥|不烈|不过寒|不过燥|不过烈/g, '');
    var monthBranch = bazi && bazi.month && bazi.month.zhi;
    var candidates = [];
    var metal = qualifiedElementOccurrences(tenGods, '金');
    var water = qualifiedElementOccurrences(tenGods, '水');
    var wood = qualifiedElementOccurrences(tenGods, '木');
    var fire = qualifiedElementOccurrences(tenGods, '火');
    var metalWaterRolesBlocked = studyElementRole(metal, core) === '忌神' && studyElementRole(water, core) === '忌神';
    var woodFireRolesBlocked = studyElementRole(wood, core) === '忌神' && studyElementRole(fire, core) === '忌神';

    if (metal.length && water.length && /金[^。；，,]*生[^。；，,]*水|金水相涵/.test(authoritative) && !metalWaterRolesBlocked &&
        !/寒|冻|金寒水冷|水多金沉|湿重|燥土埋金/.test(blockerText) &&
        (!/[亥子丑]/.test(monthBranch || '') || fire.length)) {
      candidates.push(studyProfileRecord('metal_water_clarity', ['PAIRING:METAL_WATER']));
    }
    if (wood.length && fire.length && /木[^。；，,]*生[^。；，,]*火|木火通明/.test(authoritative) && !woodFireRolesBlocked &&
        !/燥|烈|火炎|木焚|木火偏枯|炎上太过/.test(blockerText) &&
        (!/[巳午未]/.test(monthBranch || '') || water.length)) {
      candidates.push(studyProfileRecord('wood_fire_clarity', ['PAIRING:WOOD_FIRE']));
    }
    candidates.sort(function (a, b) { return b.rank - a.rank; });
    return candidates[0] || null;
  }

  function buildStudyProfile(bazi, tenGods, chains, core) {
    var candidates = [];
    var authoritative = studyAuthoritativeText(core);
    var patternText = studyPatternText(core);
    var seals = selectStudyRoles(tenGods, ['正印', '偏印']);
    var outputs = selectStudyRoles(tenGods, ['食神', '伤官']);
    var officers = selectStudyRoles(tenGods, ['正官', '七杀']);
    var chainById = {};
    list(chains).forEach(function (chain) { if (chain && chain.id) chainById[chain.id] = chain; });
    var shaYin = chainById.sha_yin;
    if (shaYin && shaYin.present && shaYin.confidence === 'strong' && favorableRole(shaYin.elementRoles && shaYin.elementRoles.sealRole)) {
      if (list(shaYin.elementRoles.officerKind).indexOf('七杀') >= 0 && /杀印相生|印星化杀/.test(authoritative + ' ' + patternText)) {
        candidates.push(studyProfileRecord('persistent_sha_yin', shaYin.evidence));
      } else if (list(shaYin.elementRoles.officerKind).indexOf('正官') >= 0 && /官印相生/.test(authoritative + ' ' + patternText)) {
        candidates.push(studyProfileRecord('disciplined_guan_yin', shaYin.evidence));
      }
    }

    var strength = textOf(core && core.strength && core.strength.level);
    var hasYangren = /羊刃/.test(patternText + ' ' + authoritative);
    var strongSealEvidence = /印星成势|印成势|印旺|印绶成势|印强/.test(authoritative);
    var effectiveOutput = /羊刃吐秀|食伤吐秀|食伤成势/.test(authoritative);
    if (/极强|旺极/.test(strength) && hasYangren && strongSealEvidence && effectiveOutput && seals.length && outputs.length) {
      candidates.push(studyProfileRecord('inspired_breakthrough', ['PROFILE:YANGREN_OUTPUT']));
    }

    var foodSha = chainById.food_controls_sha;
    if (foodSha && foodSha.present && foodSha.confidence === 'strong') {
      candidates.push(studyProfileRecord('smart_and_hardworking_food_sha', foodSha.evidence));
    }
    if (/伤官合杀/.test(authoritative) && !/伤官见官/.test(authoritative) &&
        outputs.some(function (item) { return item.role === '伤官'; }) && officers.some(function (item) { return item.role === '七杀'; })) {
      candidates.push(studyProfileRecord('smart_and_hardworking_wound_sha', ['CHAIN:WOUND_COMBINES_SHA']));
    }
    if (/食神克官/.test(authoritative) && outputs.some(function (item) { return item.role === '食神'; }) &&
        officers.some(function (item) { return item.role === '正官'; })) {
      candidates.push(studyProfileRecord('smart_and_hardworking_food_officer', ['CHAIN:FOOD_CONTROLS_OFFICER']));
    }

    var regulated = chainById.wealth_regulates_seal;
    if (regulated && regulated.present && regulated.confidence !== 'limited' &&
        regulated.elementRoles && regulated.elementRoles.sealRole === '忌神' &&
        favorableRole(regulated.elementRoles.wealthRole) && !/财破印|财坏印/.test(authoritative + ' ' + list(core && core.structuralRisks).map(studyRiskText).join(' '))) {
      candidates.push(studyProfileRecord('smart_action_regulation', regulated.evidence));
    }

    var pairing = buildStudyPairingProfile(bazi, tenGods, core);
    if (pairing) candidates.push(pairing);
    candidates.sort(function (a, b) { return b.rank - a.rank; });
    return candidates[0] || studyProfileRecord('composite', ['PROFILE:COMPOSITE']);
  }

  function buildStudyLimitations(tenGods, chains, core) {
    var authoritative = [studyAuthoritativeText(core), studyPatternText(core)]
      .concat(list(core && core.structuralRisks).map(studyRiskText))
      .concat(list(core && core.relationEvents).map(studyRiskText)).join(' ');
    var seals = selectStudyRoles(tenGods, ['正印', '偏印']);
    var limitations = [];
    function add(key, severity, sourceText, outcomeText) {
      if (limitations.some(function (row) { return row.key === key; })) return;
      limitations.push({ key: key, severity: severity, sourceText: sourceText, outcomeText: outcomeText, basis: ['STUDY_LIMIT:' + key] });
    }
    if (studyElementRole(seals, core) === '忌神' && /印星成势|印成势|印旺|印重|印多/.test(authoritative)) {
      add('excessive_ji_seal', 'medium', '印星为忌且有旺、重或成势的权威证据。', '你容易反复思考、囤积资料或依赖熟悉方法，理解不少，但形成成绩和成果的速度偏慢。');
    }
    if (/食伤过旺无制/.test(authoritative)) {
      add('uncontrolled_output', 'medium', '食伤过旺且没有制化。', '你思路多、反应快，但容易厌烦重复训练和固定规则，成绩会明显低于真实聪明程度。');
    }
    if (/财破印|财坏印/.test(authoritative)) {
      add('wealth_breaks_seal', 'severe', '命局有财破印或财坏印的有效证据。', '赚钱、感情或现实事务更容易在关键阶段打断学习，长期学业连续性会受到明显影响。');
    }
    if (/身弱杀旺无印/.test(authoritative) || list(chains).some(function (chain) { return chain && chain.id === 'learning_pressure' && chain.present; })) {
      add('weak_body_strong_killers_no_seal', 'severe', '身弱、官杀压力重且缺少印星承接。', '面对高压考试和长期竞争时容易越学越累，成绩可能在关键阶段突然下滑或中断。');
    }
    if (/用神无力|用神[^。；，,]*空亡/.test(authoritative)) {
      add('weak_or_void_useful_god', 'severe', '核心用神被权威事实标为无力或空亡。', '关键阶段的助力不稳定，能力可以达到，但兑现为学历或考试结果会多走弯路。');
    }
    return limitations;
  }

  function deriveEducationBand(profile, dimensions, limitations) {
    var points = 1 + studySignalScore(dimensions.absorption) + studySignalScore(dimensions.expression) +
      studySignalScore(dimensions.discipline) + studySignalScore(dimensions.application);
    var rank = clampNumber(Math.round(points), 1, 10);
    if (profile && profile.educationFloor) rank = Math.max(rank, profile.educationFloor);
    list(limitations).forEach(function (limitation) {
      rank -= limitation.severity === 'severe' ? 2 : 1;
    });
    rank = clampNumber(rank, 1, 10);
    return { key: 'L' + rank, label: studyLevelText(rank), rank: rank, basis: ['STUDY_BAND:L' + rank] };
  }

  function deriveStudyPath(core, seals, outputs, officers) {
    var text = studyActionText(core);
    var pattern = core && core.pattern || {};
    var combined = text + ' ' + studyPatternText(core);
    var effective = studyPatternEffective(core);
    var actualGuanYin = seals.length && officers.length && /官印相生|杀印相生/.test(combined);
    var actualShangYin = seals.length && outputs.some(function (item) { return item.role === '伤官'; }) && /伤官配印/.test(combined);
    var occurrences = seals.concat(outputs, officers);
    var pathEvidence = studyPathEvidence(core, occurrences);
    var sealRole = studyElementRole(seals, core);
    var outputRole = studyElementRole(outputs, core);
    var officerRole = studyElementRole(officers, core);
    var constrained = studyHasElementRole(seals, core, '忌神') ||
      studyHasElementRole(outputs, core, '忌神') || studyHasElementRole(officers, core, '忌神');
    var type;
    var reason;
    var confidence = 'medium';
    if (effective && actualShangYin) {
      type = '研究创作型';
      reason = '伤官配印把理解、拆解与表达连接起来，适合研究、创作、写作或需要形成观点的学习路径。';
      confidence = constrained ? 'limited' : 'strong';
      if (sealRole === '忌神') reason += '但印星为忌，需先用输出、练习和现实反馈校准吸收，路径成立具有条件性。';
    } else if (effective && actualGuanYin) {
      type = '考试型';
      reason = '官印相生或杀印相生提供规则、长期目标与知识承接的链路，适合阶段计划清晰的考试、认证或深造路径。';
      confidence = constrained ? 'limited' : 'strong';
      if (constrained) reason += '相关十神带有忌神或承压角色，需以阶段性反馈调整节奏。';
    } else if (outputs.some(function (item) { return item.role === '伤官'; }) && outputs.length) {
      type = '创作型';
      reason = '伤官输出线索较明显，适合以项目、作品、观点表达和开放题目检验学习成果。';
    } else if (outputs.length && selectStudyRoles(outputs, ['食神']).length) {
      type = '技术型';
      reason = '食神提供持续、可重复的输出线索，适合通过技能训练、实验和稳定练习形成能力。';
    } else if (seals.length && officers.length) {
      type = '复合型';
      reason = '印与官杀同时提供输入和纪律线索，适合把系统学习与阶段性实践、检查结合起来。';
    } else if (outputs.length) {
      type = '实践型';
      reason = '输出线索比纯输入更清晰，适合边做边学，以真实任务和反馈形成学习闭环。';
    } else {
      type = '复合型';
      reason = '单一学习信号不足，适合先用小目标测试吸收、输出、纪律和实践四个环节，再收敛到更匹配的路径。';
    }
    if (!effective && /伤官配印|官印相生|杀印相生/.test(combined)) {
      reason += '相关格局未明确成格或缺少对应十神，仅作条件性参考，需以实际练习与反馈验证。';
    }
    return {
      type: type,
      conclusion: reason,
      evidence: pathEvidence,
      confidence: confidence,
      elementRole: constrained ? '忌神' : (sealRole !== '中性' ? sealRole : (outputRole !== '中性' ? outputRole : officerRole)),
      conditions: ['路径是学习方式倾向，不代表确定学历、学校层次或录取结果']
        .concat(constrained ? ['相关十神含忌神角色，结论需以输出、承载与现实反馈校准'] : [])
        .concat(!effective && /伤官配印|官印相生|杀印相生/.test(combined) ? ['格局未明确成格或缺少实际对应十神，不采用强路径结论'] : []),
    };
  }

  function selectStudyRisks(risks) {
    return list(risks).filter(function (risk) {
      return /财破印|枭神夺食|伤官见官|官杀混杂|杀重|印星|食伤/.test(textOf(risk));
    }).map(function (risk) {
      return {
        type: risk.type || risk.name || risk.category || '学习结构风险',
        conclusion: textOf(risk.conclusion || risk.detail || risk.why || risk),
        evidence: structuralRiskEvidence(risk),
        confidence: 'medium',
        conditions: ['仅在相关结构被岁运或现实条件引动时提高关注'],
      };
    });
  }

  function buildStudyAuxiliary(bazi, calculator) {
    var rows = [];
    if (calculator && typeof calculator.calculateShenSha === 'function') {
      try { rows = list(calculator.calculateShenSha(bazi)); } catch (error) { rows = []; }
    }
    if (!rows.length && bazi && Array.isArray(bazi.shenSha)) rows = bazi.shenSha;
    return rows.filter(function (item) {
      return /文昌|学堂/.test(textOf(item));
    }).map(function (item) {
      return {
        name: item.name || item.type || textOf(item),
        positions: item.positions || item.posText || [],
        conclusion: '仅作辅助提示，不能单独决定学习路径或学业结果。',
        confidence: 'limited',
        evidence: [textOf(item)].filter(Boolean),
      };
    });
  }

  function buildStudyFacts(bazi, core, calculator) {
    if (!bazi || !bazi.day || !calculator) throw new Error('学业事实缺少有效命盘或计算器');
    core = core || {};
    var tenGods = collectTenGodOccurrences(bazi, calculator, function () { return true; });
    var seals = selectStudyRoles(tenGods, ['正印', '偏印']);
    var outputs = selectStudyRoles(tenGods, ['食神', '伤官']);
    var officers = selectStudyRoles(tenGods, ['正官', '七杀']);
    var absorption = buildAbsorptionFacts(seals, core);
    var expression = buildExpressionFacts(outputs, core);
    var discipline = buildDisciplineFacts(officers, seals, core);
    var application = buildApplicationFacts(tenGods, core);
    var chains = buildStudyChains(tenGods, core);
    var profile = buildStudyProfile(bazi, tenGods, chains, core);
    var limitations = buildStudyLimitations(tenGods, chains, core);
    return {
      absorption: absorption,
      expression: expression,
      discipline: discipline,
      application: application,
      path: deriveStudyPath(core, seals, outputs, officers),
      chains: chains,
      profile: profile,
      educationBand: deriveEducationBand(profile, {
        absorption: absorption, expression: expression, discipline: discipline, application: application,
      }, limitations),
      fieldTendencies: profile.key === 'metal_water_clarity'
        ? ['数理', '金融', '法律', '技术分析']
        : (profile.key === 'wood_fire_clarity' ? ['文学', '艺术', '教育', '传播表达'] : []),
      limitations: limitations,
      obstacles: selectStudyRisks(list(core.structuralRisks).concat(list(core.relationEvents))),
      auxiliary: buildStudyAuxiliary(bazi, calculator),
      timing: null,
    };
  }

  function evidence(state, conclusion, confidence, conditions, elementRole) {
    return {
      state: state,
      method: state,
      conclusion: conclusion,
      confidence: confidence || 'medium',
      conditions: conditions || [],
      elementRole: elementRole || '中性',
      evidence: (conditions || []).slice(),
    };
  }

  function buildResourceQuality(occurrences, bazi, core, calculator, wealthElement) {
    var exposed = occurrences.filter(function (item) { return item.layer === '天干'; });
    var hidden = occurrences.filter(function (item) { return item.layer !== '天干'; });
    var role = classifyElementRole(wealthElement, core.yongJi);
    var conditions = [];
    if (exposed.length) conditions.push('财星透干：' + exposed.map(function (item) { return item.gan + item.pillarLabel; }).join('、'));
    if (hidden.length) conditions.push('财星藏于：' + hidden.map(function (item) { return item.gan + item.pillarLabel + item.layer; }).join('、'));
    var monthElement = branchElement(bazi && bazi.month && bazi.month.zhi, calculator);
    var seasonRelation = elementRelation(monthElement, wealthElement);
    var sourceIndex = ELEMENT_CYCLE.indexOf(wealthElement);
    var sourceElement = sourceIndex >= 0 ? ELEMENT_CYCLE[(sourceIndex + ELEMENT_CYCLE.length - 1) % ELEMENT_CYCLE.length] : '';
    var allOccurrences = collectTenGodOccurrences(bazi, calculator, function () { return true; });
    var roots = occurrences.filter(function (item) { return item.layer !== '天干'; }).map(function (item) {
      return item.pillarLabel + item.layer + item.gan + '提供财星根气证据';
    });
    var sources = allOccurrences.filter(function (item) { return item.element === sourceElement; }).map(function (item) {
      return item.pillarLabel + item.layer + item.gan + '为财星生源' + sourceElement;
    });
    var relationRows = list(core && core.relationEvents).concat(list(core && core.structuralRisks)).filter(function (row) {
      return /财/.test(textOf(row));
    });
    var restraints = relationRows.filter(function (row) {
      return /克|冲|刑|害|破|受制|合绊/.test(textOf(row));
    }).map(textOf).filter(Boolean);
    var quality = {
      season: {
        state: monthElement === wealthElement ? '月令同气' : (seasonRelation === 'generates' ? '月令相生' : '未见月令直接支持'),
        evidence: monthElement ? ['月支' + bazi.month.zhi + '为' + monthElement + '，与财星' + wealthElement + '关系为' + seasonRelation] : [],
      },
      roots: roots,
      sources: sources,
      restraints: restraints,
      relationships: relationRows.map(textOf).filter(Boolean),
      uncertainty: relationRows.length ? '' : '权威关系事件未提供财星受制或联动证据，相关质量保持不确定。',
    };
    if (!occurrences.length) {
      return {
        state: '不显',
        conclusion: '原局未见明确正财或偏财十神，资源议题需结合岁运和现实路径观察。',
        confidence: 'limited',
        elementRole: role,
        visibleCount: 0,
        hiddenCount: 0,
        evidence: [],
        quality: quality,
      };
    }
    return {
      state: exposed.length ? '显现' : '潜藏',
      conclusion: exposed.length
        ? '财星有透干证据，资源机会较容易被看见，但能否转化仍取决于承载与结构路径。'
        : '财星主要以藏干形式出现，资源线索较隐性，需要结合根气、引动和实际通路观察。',
      confidence: exposed.length && hidden.length ? 'strong' : 'medium',
      elementRole: role,
      visibleCount: exposed.length,
      hiddenCount: hidden.length,
      evidence: conditions,
      quality: quality,
    };
  }

  function buildWealthPathways(core) {
    var chains = list(core && core.actionChains);
    var relations = list(core && core.relationEvents);
    var risks = list(core && core.structuralRisks);
    var rows = [];
    var definitions = [
      { type: '食伤生财', positive: true, pattern: /(?:食神|伤官|食伤)\s*(?:生财|(?:→|->)\s*财(?:星)?)/, conclusion: '已有食伤与财星的链路证据，可关注表达、技能或产出向资源转化的条件。' },
      { type: '财生官', positive: true, pattern: /财(?:星)?(?:生|→|->)(?:正官|七杀|官杀|官)/, exclude: /财党杀|财破印|财坏印/, conclusion: '已有财与官杀相连的正向生化证据，资源可能与责任、规则或组织位置同步出现。' },
      { type: '财官印连续流通', positive: true, pattern: /财(?:星)?(?:生|→|->).*官(?:杀)?.*(?:生|→|->).*印|财官印连续流通|财生杀印/, exclude: /财党杀|财破印|财坏印/, conclusion: '已有财、官杀、印连续流通的证据，转化效果取决于各环节是否承接。' },
      { type: '财配印', positive: true, pattern: /财配印|财(?:星)?(?:与|配合|协同)(?:正印|偏印|印星)/, exclude: /财破印|财坏印|财印冲/, conclusion: '已有财印正向配合证据，资源与学习、资质或支持系统之间存在联动条件。' },
      { type: '比劫与财并见', positive: true, pattern: /比劫与财并见|比劫.*财(?:星)?并见|财(?:星)?.*比劫并见/, conclusion: '已有比劫与财并见证据，获取机会与资源分流需同时评估。' },
      { type: '财党杀', pattern: /财党杀/, conclusion: '已有财党杀证据，资源议题可能伴随责任、竞争或压力，不能单独视为利好。' },
      { type: '财破印', pattern: /财破印|财坏印|财.*破.*印/, conclusion: '已有财破印证据，资源投入可能牵动学习、资质或支持系统，需要保留缓冲。' },
    ];
    definitions.forEach(function (definition) {
      var authoritative = definition.positive ? chains.concat(relations) : chains;
      var matched = authoritative.filter(function (chain) {
        var text = textOf(chain);
        return definition.pattern.test(text) && !(definition.exclude && definition.exclude.test(text));
      });
      var riskMatched = definition.positive ? [] : risks.filter(function (risk) { return definition.pattern.test(textOf(risk)); });
      if (!matched.length && !riskMatched.length) return;
      rows.push({
        type: definition.type,
        conclusion: definition.conclusion,
        confidence: matched.length ? 'strong' : 'medium',
        evidence: matched.concat(riskMatched).map(textOf).filter(Boolean),
      });
    });
    return rows;
  }

  function buildWealthRetention(core, wealthElement) {
    var risks = list(core && core.structuralRisks);
    var events = list(core && core.relationEvents);
    var source = risks.concat(events);
    var rows = [];
    var definitions = [
      { type: '比劫分流', pattern: /比劫|劫财/, text: '比劫相关证据提示资源分流或竞争条件，需要明确边界与分配规则。' },
      { type: '财破印', pattern: /财破印/, text: '财破印证据提示资源投入可能牵动学习、资质或支持系统，留存稳定性取决于是否有替代支持。' },
      { type: '财印冲', pattern: /财印冲|财.*印.*冲|印.*财.*冲/, text: '财印冲证据提示资源安排与支持系统之间存在张力，应结合实际结构调整。' },
      { type: '财党杀', pattern: /财党杀/, text: '财党杀证据提示资源与责任压力同向增加，留存需要控制杠杆与承诺范围。' },
    ];
    definitions.forEach(function (definition) {
      var matched = source.filter(function (item) { return definition.pattern.test(textOf(item)); });
      if (!matched.length) return;
      rows.push({ type: definition.type, conclusion: definition.text, evidence: matched.map(textOf).filter(Boolean) });
    });
    var role = classifyElementRole(wealthElement, core && core.yongJi);
    return {
      state: rows.length ? '需管理' : '待观察',
      conclusion: rows.length ? '留存与风险需分开观察，当前已有结构证据提示管理重点。' : '未见明确留存风险证据，仍需结合实际路径和岁运条件观察。',
      elementRole: role,
      risks: rows,
      evidence: rows.reduce(function (all, row) { return all.concat(row.evidence); }, []),
    };
  }

  function hasStorageActivation(zhi, bazi, core) {
    var paired = STORAGE_CLASH[zhi];
    var texts = list(core && core.relationEvents).concat(list(core && core.actionChains));
    if (texts.some(function (item) {
      var text = textOf(item);
      return text.indexOf(zhi) >= 0 && (text.indexOf('冲') >= 0 || text.indexOf('刑') >= 0 || text.indexOf('合') >= 0);
    })) return true;
    if (!paired || !bazi) return false;
    return PILLARS.some(function (pillarName) {
      return bazi[pillarName] && bazi[pillarName].zhi === paired;
    }) && texts.some(function (item) {
      var text = textOf(item);
      return text.indexOf(paired) >= 0 && (text.indexOf('冲') >= 0 || text.indexOf('刑') >= 0 || text.indexOf('合') >= 0);
    });
  }

  function buildWealthStorage(bazi, core, wealthElement, calculator) {
    var candidates = [];
    PILLARS.forEach(function (pillarName) {
      var pillar = bazi && bazi[pillarName];
      if (!pillar || !STORAGE_ELEMENTS[pillar.zhi]) return;
      var hidden = getHiddenStems(pillar, calculator).map(function (gan, index) {
        return { gan: gan, layer: index === 0 ? '本气' : (index === 1 ? '中气' : '余气'), element: (calculator.WU_XING || {})[gan] || '' };
      }).filter(function (item) { return item.element === wealthElement; });
      if (!hidden.length) return;
      candidates.push({
        pillar: pillarName,
        pillarLabel: PILLAR_LABELS[pillarName],
        zhi: pillar.zhi,
        storedElement: STORAGE_ELEMENTS[pillar.zhi],
        hidden: hidden,
        activated: hasStorageActivation(pillar.zhi, bazi, core),
      });
    });
    var activated = candidates.filter(function (item) { return item.activated; });
    var evidenceRows = activated.reduce(function (all, item) {
      return all.concat(item.hidden.map(function (hidden) {
        return item.pillarLabel + item.zhi + '藏' + hidden.gan + '（' + hidden.layer + '）为财星，相关库气受到引动。';
      }));
    }, []);
    if (!candidates.length) {
      return { present: false, activated: false, confidence: 'limited', conclusion: '未发现库支中真实藏有对应财星，不能仅以库支出现判定财库。', candidates: [], evidence: [] };
    }
    if (!activated.length) {
      return { present: false, activated: false, confidence: 'limited', conclusion: '发现库支中真实藏有财星，但尚未见相关冲、刑、合或岁运引动证据。', candidates: candidates, evidence: candidates.map(function (item) { return item.pillarLabel + item.zhi + '藏有财星'; }) };
    }
    return {
      present: true,
      activated: true,
      confidence: 'medium',
      conclusion: evidenceRows.join('') + '这只表示藏干或库气被触动，是否形成实际资源仍需结合透干、月令、喜忌和承载条件。',
      candidates: candidates,
      evidence: evidenceRows,
    };
  }

  function deriveWealthSummaryLevel(capacity, occurrences, core) {
    if (capacity.state === '承压') return '承压';
    if (capacity.state === '顺势') return '较强';
    if (!occurrences.length) return '待时';
    if (capacity.state === '可承接') return '稳健';
    return '中等';
  }

  function authoritativeWealthSupport(core) {
    var positive = /(?:印星|正印|偏印|印比|比肩|劫财|比劫).{0,24}(?:生身|扶身|助身|帮身|护身|支持|承载)|(?:生身|扶身|助身|帮身|护身|支持|承载).{0,24}(?:印星|正印|偏印|印比|比肩|劫财|比劫)/;
    var negative = /克身|破印|坏印|夺食|受制|无力|不足|不成|不能|未见|缺少/;
    return list(core && core.actionChains).concat(list(core && core.relationEvents)).filter(function (row) {
      var text = textOf(row);
      return positive.test(text) && !negative.test(text);
    });
  }

  function buildWealthFacts(bazi, core, calculator) {
    if (!bazi || !bazi.day || !calculator) throw new Error('财富事实缺少有效命盘或计算器');
    core = core || {};
    var wuXing = calculator.WU_XING || {};
    var dayWx = wuXing[bazi.day.gan];
    var cycle = ['木', '火', '土', '金', '水'];
    var wealthIndex = cycle.indexOf(dayWx);
    var wealthWx = wealthIndex >= 0 ? cycle[(wealthIndex + 2) % cycle.length] : '';
    var occurrences = collectTenGodOccurrences(bazi, calculator, function (role) {
      return role === '正财' || role === '偏财';
    });
    var elementRole = classifyElementRole(wealthWx, core.yongJi);
    var patternName = core.pattern && (core.pattern.name || core.pattern.label || '');
    var isCongCai = !!(core.congGe && /从财/.test(patternName));
    var strength = core.strength || {};
    var strengthText = strength.level || strength.label || '';
    var weak = /弱/.test(strengthText);
    var supportOccurrences = collectTenGodOccurrences(bazi, calculator, function (role) {
      return ['正印', '偏印', '比肩', '劫财'].indexOf(role) >= 0;
    }).filter(function (item) { return !(item.pillar === 'day' && item.layer === '天干'); });
    var favorableSupport = supportOccurrences.filter(function (item) {
      var itemRole = classifyElementRole(item.element, core.yongJi);
      return itemRole === '用神' || itemRole === '喜神';
    });
    var directSupport = favorableSupport.filter(function (item) {
      return item.layer === '天干' || item.layer === '本气';
    });
    var secondarySupport = favorableSupport.filter(function (item) {
      return item.layer === '中气' || item.layer === '余气';
    });
    var secondaryPillars = secondarySupport.map(function (item) { return item.pillar; }).filter(function (pillar, index, rows) {
      return rows.indexOf(pillar) === index;
    });
    var chainSupport = authoritativeWealthSupport(core);
    var effectiveSupport = directSupport.concat(secondaryPillars.length >= 2 ? secondarySupport : []);
    var isEffectiveSupport = effectiveSupport.length > 0 || chainSupport.length > 0;
    var limitedSupport = !isEffectiveSupport && secondarySupport.length > 0;
    var occurrenceEvidence = effectiveSupport.map(function (item) {
      return item.pillarLabel + item.layer + item.gan + item.role + '为' + classifyElementRole(item.element, core.yongJi) + '，提供身弱承载支持';
    });
    var chainEvidence = chainSupport.map(function (row) {
      return '权威印比支持链：' + textOf(row);
    });
    var support = {
      effective: isEffectiveSupport,
      limited: limitedSupport,
      occurrences: effectiveSupport,
      limitedOccurrences: limitedSupport ? secondarySupport : [],
      authoritative: chainSupport,
      evidence: occurrenceEvidence.concat(chainEvidence),
      limitedEvidence: (limitedSupport ? secondarySupport : []).map(function (item) {
        return item.pillarLabel + item.layer + item.gan + item.role + '为单一弱藏干，仅部分缓解承载压力';
      }),
    };
    var capacity;
    if (isCongCai) {
      capacity = evidence('顺势', '从财格成立，财星按冻结的从格结论顺势解释。', 'strong', ['从财格'], elementRole);
      capacity.method = '从格顺势';
    } else if (weak && elementRole === '忌神' && support.effective) {
      capacity = evidence('有缓解', '身弱而财为忌仍有承载压力，但有效印星或比劫支持可提供缓解，不宜只按承压解释。', 'medium', ['身弱', '财为忌'].concat(support.evidence), elementRole);
    } else if (weak && elementRole === '忌神') {
      capacity = evidence('承压', limitedSupport
        ? '财星力量明显，日主承载条件仍有限；单一中气或余气印比仅部分缓解承载压力，不能作为有效支持。'
        : '财星力量明显，但日主承载条件有限，机会与资源压力可能同时增加。', 'strong', ['身弱', '财为忌'].concat(support.limitedEvidence), elementRole);
    } else if (elementRole === '用神' || elementRole === '喜神') {
      capacity = evidence('可承接', '财星属于冻结核心中的有利元素，具备资源调动的候选条件，仍需结合承载和路径。', 'medium', ['财为' + elementRole], elementRole);
    } else {
      capacity = evidence('平衡观察', '财星作用需结合日主承载、格局路径和结构风险判断，不以数量直接等同结果。', 'medium', [], elementRole);
    }
    capacity.support = support;
    return {
      wealthElement: wealthWx,
      wealthRole: ['正财', '偏财'],
      occurrences: occurrences,
      resource: buildResourceQuality(occurrences, bazi, core, calculator, wealthWx),
      capacity: capacity,
      pathways: buildWealthPathways(core),
      retention: buildWealthRetention(core, wealthWx),
      storage: buildWealthStorage(bazi, core, wealthWx, calculator),
      timing: null,
      summaryLevel: deriveWealthSummaryLevel(capacity, occurrences, core),
      evidence: [capacity].concat(occurrences.map(function (item) {
        return { label: item.pillarLabel + item.layer, text: item.gan + '为' + item.role + '（' + item.element + '）' };
      })),
    };
  }

  var ELEMENT_CYCLE = ['木', '火', '土', '金', '水'];
  var BRANCH_ELEMENTS = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
    '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水',
  };
  var RELATIONSHIP_POSITION_TENDENCIES = {
    year: 'outside_or_early',
    month: 'work_or_local',
    day: 'close_circle',
    hour: 'later_or_distant',
  };
  var RELATIONSHIP_POSITION_LABELS = {
    outside_or_early: '生活圈外或较早阶段的弱信号',
    work_or_local: '工作圈、同学同事或同城附近的弱信号',
    close_circle: '身边长期接触圈的弱信号',
    later_or_distant: '较晚阶段、未来生活圈或异地的弱信号',
  };
  var AGE_TENDENCY_LABELS = {
    older_tendency: '略年长',
    similar_tendency: '相仿',
    younger_tendency: '略年轻',
    unclear: '证据不足',
  };

  function normalizeGender(gender) {
    var value = String(gender || '').toLowerCase();
    if (value === 'male' || value === 'm' || value === '男' || value.indexOf('男') >= 0) return 'male';
    if (value === 'female' || value === 'f' || value === '女' || value.indexOf('女') >= 0) return 'female';
    return value;
  }

  function branchElement(zhi, calculator) {
    var map = calculator && (calculator.DI_ZHI_WU_XING || calculator.BRANCH_WU_XING);
    return (map && map[zhi]) || BRANCH_ELEMENTS[zhi] || '';
  }

  function elementRelation(source, target) {
    var sourceIndex = ELEMENT_CYCLE.indexOf(source);
    var targetIndex = ELEMENT_CYCLE.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0) return 'unknown';
    if (source === target) return 'same';
    if ((sourceIndex + 1) % ELEMENT_CYCLE.length === targetIndex) return 'generates';
    if ((sourceIndex + 2) % ELEMENT_CYCLE.length === targetIndex) return 'controls';
    if ((targetIndex + 1) % ELEMENT_CYCLE.length === sourceIndex) return 'generatedBy';
    if ((targetIndex + 2) % ELEMENT_CYCLE.length === sourceIndex) return 'controlledBy';
    return 'unknown';
  }

  function deriveDayPillarInteraction(dayGanWx, dayZhiWx) {
    var relation = elementRelation(dayZhiWx, dayGanWx);
    if (relation === 'generates') return { direction: '夫妻宫生身', actor: 'partner', effect: 'support' };
    if (relation === 'generatedBy') return { direction: '命主生夫妻宫', actor: 'self', effect: 'invest' };
    if (relation === 'controls') return { direction: '夫妻宫克身', actor: 'partner', effect: 'pressure' };
    if (relation === 'controlledBy') return { direction: '命主克夫妻宫', actor: 'self', effect: 'lead' };
    return { direction: '干支同类', actor: 'both', effect: 'peer' };
  }

  function interactionConclusion(interaction) {
    var conclusions = {
      '夫妻宫生身': '夫妻宫所代表的关系侧更偏向提供支持、照顾或资源承接，仍需结合喜忌与结构观察。',
      '命主生夫妻宫': '命主更倾向主动投入关系、提供支持或承担经营，投入方式仍受整体结构影响。',
      '命主克夫妻宫': '命主更倾向主导关系安排、提出要求或推动边界，需留意协商与相互尊重。',
      '夫妻宫克身': '关系侧更容易带来责任、约束或压力感，宜把现实分工与边界说清楚。',
      '干支同类': '日干与日支五行同类，互动更偏相似与平等，也可能在意见上互不相让。',
    };
    return conclusions[interaction.direction] || '日干与日支的互动方向需结合喜忌与结构观察。';
  }

  function layerForHidden(index) {
    return index === 0 ? '本气' : (index === 1 ? '中气' : '余气');
  }

  function relationshipEventsForDay(events) {
    return list(events).filter(function (event) {
      var text = textOf(event);
      var pillars = event && event.pillars;
      var pillarText = textOf(pillars);
      var structuralText = [event && event.parties, event && event.why, event && event.partyEvidence,
        event && event.evidence, event && event.triggerHint].map(textOf).join(' ');
      return text.indexOf('日支') >= 0 || text.indexOf('夫妻宫') >= 0 || text.indexOf('日柱') >= 0 ||
        structuralText.indexOf('日支') >= 0 || structuralText.indexOf('夫妻宫') >= 0 || structuralText.indexOf('日柱') >= 0 ||
        pillarText.indexOf('day') >= 0 || pillarText.indexOf('日柱') >= 0;
    });
  }

  function structuralRiskEvidence(risk) {
    return [
      ['parties', risk && risk.parties],
      ['why', risk && risk.why],
      ['partyEvidence', risk && risk.partyEvidence],
      ['evidence', risk && risk.evidence],
      ['triggerHint', risk && risk.triggerHint],
    ].filter(function (row) { return textOf(row[1]); }).map(function (row) {
      return { field: row[0], text: textOf(row[1]) };
    });
  }

  function buildRelationshipPalace(bazi, core, calculator) {
    var day = bazi && bazi.day || {};
    var hiddenStems = getHiddenStems(day, calculator);
    var dayElement = branchElement(day.zhi, calculator);
    var hiddenTenGods = hiddenStems.map(function (gan, index) {
      return { gan: gan, role: getStemRole(day.gan, gan, calculator), layer: layerForHidden(index) };
    });
    var events = relationshipEventsForDay(core && core.relationEvents);
    var risks = relationshipEventsForDay(core && core.structuralRisks);
    return {
      zhi: day.zhi || '',
      element: dayElement,
      hiddenStems: hiddenStems,
      hiddenTenGods: hiddenTenGods,
      elementRole: classifyElementRole(dayElement, core && core.yongJi),
      dayInvolvingEvents: events,
      relationEvents: events,
      risks: risks,
      riskEvidence: risks.reduce(function (all, risk) { return all.concat(structuralRiskEvidence(risk)); }, []),
      evidence: events.concat(risks).map(textOf).filter(Boolean),
    };
  }

  function spouseElementFromRole(dayElement, gender) {
    var index = ELEMENT_CYCLE.indexOf(dayElement);
    if (index < 0) return '';
    if (gender === 'male') return ELEMENT_CYCLE[(index + 2) % ELEMENT_CYCLE.length];
    return ELEMENT_CYCLE[(index + 3) % ELEMENT_CYCLE.length];
  }

  function positionTendencyFor(pillar) {
    return RELATIONSHIP_POSITION_TENDENCIES[pillar] || 'unknown';
  }

  function spouseOccurrenceRows(bazi, calculator, roles) {
    return collectTenGodOccurrences(bazi, calculator, function (role) {
      return roles.indexOf(role) >= 0;
    }).map(function (item) {
      var positionTendency = positionTendencyFor(item.pillar);
      return Object.assign({}, item, {
        positionTendency: positionTendency,
        positionLabel: RELATIONSHIP_POSITION_LABELS[positionTendency] || '位置证据不足',
      });
    });
  }

  function buildSpouseStarFacts(bazi, gender, core, calculator, palace) {
    var roles = gender === 'male' ? ['正财', '偏财'] : ['正官', '七杀'];
    var occurrences = spouseOccurrenceRows(bazi, calculator, roles);
    var exposed = occurrences.filter(function (item) { return item.layer === '天干'; });
    var hidden = occurrences.filter(function (item) { return item.layer !== '天干'; });
    var month = bazi && bazi.month;
    var monthHidden = getHiddenStems(month, calculator);
    var dayElement = palace.element;
    var spouseElement = occurrences.map(function (item) { return item.element; }).filter(Boolean)[0] || spouseElementFromRole((calculator.WU_XING || {})[bazi.day.gan], gender);
    var monthSupport = occurrences.some(function (item) {
      return item.pillar === 'month' || (month && item.element === branchElement(month.zhi, calculator));
    }) || monthHidden.some(function (gan) { return getStemRole(bazi.day.gan, gan, calculator) === roles[0] || getStemRole(bazi.day.gan, gan, calculator) === roles[1]; });
    var visibility = !occurrences.length ? '不显' : (exposed.length && hidden.length ? '透藏并见' : exposed.length ? '透干显现' : '藏干潜藏');
    var strengthTendency = !occurrences.length ? '未见明确配偶星' : (monthSupport ? '有月令或根气响应的显现倾向' : exposed.length ? '有透干显现倾向' : '以藏干潜藏为主');
    var roleMix = roles.every(function (role) { return occurrences.some(function (item) { return item.role === role; }); });
    var rolePurity = roleMix ? '正偏混杂' : '单一口径';
    var elementRole = classifyElementRole(spouseElement, core && core.yongJi);
    return {
      roles: roles,
      element: spouseElement,
      occurrences: occurrences,
      exposed: exposed,
      hidden: hidden,
      visibility: visibility,
      strengthTendency: strengthTendency,
      monthSupport: monthSupport,
      rooted: hidden.length > 0,
      rolePurity: rolePurity,
      elementRole: elementRole,
      quality: {
        visibility: visibility,
        strengthTendency: strengthTendency,
        monthSupport: monthSupport,
        rooted: hidden.length > 0,
        rolePurity: rolePurity,
        elementRole: elementRole,
      },
      evidence: occurrences.map(function (item) {
        return item.pillarLabel + item.layer + '出现' + item.gan + item.role + '，位置仅作弱证据。';
      }),
      palaceElement: dayElement,
    };
  }

  function dominantPosition(occurrences) {
    var counts = {};
    occurrences.forEach(function (item) {
      if (!item.positionTendency || item.positionTendency === 'unknown') return;
      counts[item.positionTendency] = (counts[item.positionTendency] || 0) + 1;
    });
    var keys = Object.keys(counts);
    if (!keys.length) return 'unclear';
    keys.sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
    if (keys.length > 1 && counts[keys[0]] === counts[keys[1]]) return 'unclear';
    return keys[0];
  }

  function buildDistanceFacts(spouseStar) {
    var tendency = dominantPosition(spouseStar.occurrences);
    return {
      tendency: tendency,
      label: tendency === 'unclear' ? '远近证据不足' : RELATIONSHIP_POSITION_LABELS[tendency],
      confidence: tendency === 'unclear' ? 'limited' : 'limited',
      evidence: spouseStar.occurrences.map(function (item) {
        return item.pillarLabel + '仅提供' + item.positionLabel + '，需叠加关系事件与岁运后再提高可信度。';
      }),
    };
  }

  function ageTendencyForPosition(position) {
    if (position === 'year') return 'older_tendency';
    if (position === 'month') return 'similar_tendency';
    if (position === 'hour') return 'younger_tendency';
    if (position === 'day') return 'similar_tendency';
    return 'unclear';
  }

  function buildAgeFacts(spouseStar, palace) {
    var candidates = spouseStar.occurrences.map(function (item) {
      return { tendency: ageTendencyForPosition(item.pillar), evidence: item.pillarLabel + '位置只提供年龄远近的弱证据。' };
    }).filter(function (item) { return item.tendency !== 'unclear'; });
    var counts = {};
    candidates.forEach(function (item) { counts[item.tendency] = (counts[item.tendency] || 0) + 1; });
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
    var tendency = keys.length && (!keys[1] || counts[keys[0]] > counts[keys[1]]) ? keys[0] : 'unclear';
    return {
      tendency: tendency,
      label: AGE_TENDENCY_LABELS[tendency],
      confidence: tendency === 'unclear' ? 'limited' : 'limited',
      evidence: candidates.map(function (item) { return item.evidence; }).concat(palace.hiddenTenGods.length ? ['夫妻宫藏干参与年龄判断，但不单独定年龄差。'] : []),
    };
  }

  function appearanceStyle(element) {
    var styles = {
      '木': '清秀舒展、重视成长感',
      '火': '明朗有活力、表达感较强',
      '土': '稳重朴实、节奏感较稳',
      '金': '利落清爽、边界感较明',
      '水': '灵活温和、适应性较强',
    };
    return styles[element] || '';
  }

  function collectAppearanceSignals(palace, spouseStar, core) {
    var signals = [];
    if (palace.element && appearanceStyle(palace.element)) {
      signals.push({ source: '夫妻宫', element: palace.element, style: appearanceStyle(palace.element), role: palace.elementRole });
    }
    if (spouseStar.occurrences.length && spouseStar.element && appearanceStyle(spouseStar.element)) {
      signals.push({ source: '配偶星', element: spouseStar.element, style: appearanceStyle(spouseStar.element), role: spouseStar.elementRole });
    }
    if (!signals.length && core && core.relationEvents && core.relationEvents.length) {
      signals.push({ source: '关系事件', style: '关系形象呈现动态复合倾向' });
    }
    return signals;
  }

  function buildAppearanceFacts(palace, spouseStar, core) {
    var signals = collectAppearanceSignals(palace, spouseStar, core);
    var counts = {};
    signals.forEach(function (signal) { counts[signal.style] = (counts[signal.style] || 0) + 1; });
    var styles = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
    var agreement = styles.length ? counts[styles[0]] : 0;
    var confidence = agreement >= 2 ? 'medium' : 'limited';
    var conclusion = agreement >= 2
      ? '外在气质与形象风格更偏向' + styles[0] + '，仅作低到中等可信度的倾向参考，不指向具体样貌。'
      : '夫妻宫与配偶星呈现复合信号，外在气质特征不集中，仅作低可信度倾向参考。';
    return { confidence: confidence, conclusion: conclusion, evidence: signals, signals: signals, agreement: agreement };
  }

  function buildRelationshipFacts(bazi, gender, core, calculator) {
    if (!bazi || !bazi.day || !calculator) throw new Error('婚恋事实缺少有效命盘或计算器');
    core = core || {};
    var normalizedGender = normalizeGender(gender);
    var palace = buildRelationshipPalace(bazi, core, calculator);
    var spouseStar = buildSpouseStarFacts(bazi, normalizedGender, core, calculator, palace);
    var dayElement = (calculator.WU_XING || {})[bazi.day.gan] || '';
    var interaction = deriveDayPillarInteraction(dayElement, palace.element);
    interaction.conclusion = interactionConclusion(interaction);
    var age = buildAgeFacts(spouseStar, palace);
    return {
      gender: normalizedGender,
      spouseStar: spouseStar,
      palace: palace,
      interaction: interaction,
      distance: buildDistanceFacts(spouseStar),
      age: age,
      ageTendency: age,
      appearance: buildAppearanceFacts(palace, spouseStar, core),
      stability: {
        relationEvents: list(core.relationEvents),
        structuralRisks: list(core.structuralRisks),
        conclusion: '合冲刑害只表示关系议题被触发，不等于必然结婚或离开；稳定性仍需结合现实安排、边界和救应观察。',
        confidence: 'limited',
      },
      evidence: palace.evidence.concat(spouseStar.evidence),
    };
  }

  var ANNUAL_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ANNUAL_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  function annualPillarFallback(year) {
    var offset = Number(year) - 1984;
    var stemIndex = ((offset % 10) + 10) % 10;
    var branchIndex = ((offset % 12) + 12) % 12;
    return { year: Number(year), gan: ANNUAL_STEMS[stemIndex], zhi: ANNUAL_BRANCHES[branchIndex] };
  }

  function findDaYunForYear(list, year) {
    list = Array.isArray(list) ? list : [];
    var target = Number(year);
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i] || {};
      var start = Number(item.startYear);
      var end = Number(item.endYear);
      if (Number.isFinite(start) && Number.isFinite(end) && target >= start && target <= end) return item;
    }
    return null;
  }

  function textList(value) {
    return list(value).map(textOf).filter(Boolean);
  }

  function annualPillarForYear(calculator, year, daYun, dayGan) {
    var rows = [];
    if (calculator && typeof calculator.calculateLiuNian === 'function') {
      try {
        var source = daYun || { startYear: Number(year), endYear: Number(year) + 9 };
        var result = calculator.calculateLiuNian(source, dayGan);
        rows = Array.isArray(result) ? result : list(result && result.years);
      } catch (error) {
        rows = [];
      }
    }
    var found = rows.filter(function (row) { return Number(row && row.year) === Number(year); })[0];
    if (found && found.gan && found.zhi) return found;
    return annualPillarFallback(year);
  }

  function resolveAnnualDynamic(bazi, daYun, pillar, core, calculator, chain) {
    if (!daYun) {
      var originalTriggers = [];
      PILLARS.forEach(function (sourcePillar) {
        var original = bazi && bazi[sourcePillar];
        if (!original) return;
        var proxy = { year: original, month: pillar, day: bazi.day, hour: bazi.hour };
        if (calculator && typeof calculator.getPillarRelations === 'function') {
          try {
            var pillarRelation = list(calculator.getPillarRelations(proxy)).filter(function (row) {
              return row && row.from === '年柱' && row.to === '月柱';
            })[0];
            list(pillarRelation && pillarRelation.details).forEach(function (detail) {
              originalTriggers.push({
                type: pillarRelation.gan && pillarRelation.gan !== '—' ? '天干' + pillarRelation.gan : '地支' + pillarRelation.zhi,
                detail: textOf(detail), sourcePillar: sourcePillar, annualPillar: pillar,
                pillars: [sourcePillar, 'annual'], involvesDay: sourcePillar === 'day',
                domains: sourcePillar === 'day' ? ['relationship'] : [], source: 'calculator.getPillarRelations',
              });
            });
          } catch (error) { /* authoritative relation API unavailable for this row */ }
        }
        if (calculator && typeof calculator.getBranchRelations === 'function') {
          try {
            list(calculator.getBranchRelations(proxy)).filter(function (row) {
              return row && row.from === '年柱' && row.to === '月柱';
            }).forEach(function (row) {
              list(row.relations).forEach(function (relation) {
                originalTriggers.push({
                  type: textOf(relation.type) || '地支关系', detail: textOf(relation.detail),
                  sourcePillar: sourcePillar, annualPillar: pillar, pillars: [sourcePillar, 'annual'],
                  involvesDay: sourcePillar === 'day', domains: sourcePillar === 'day' ? ['relationship'] : [],
                  source: 'calculator.getBranchRelations',
                });
              });
            });
          } catch (error) { /* authoritative relation API unavailable for this row */ }
        }
      });
      var seen = {};
      originalTriggers = originalTriggers.filter(function (row) {
        var key = [row.type, row.sourcePillar, row.detail].join('|');
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
      return {
        mode: 'original-chart', triggers: originalTriggers, reliefs: [],
        summary: originalTriggers.length ? '流年只与原局关系进行条件性对照，未纳入大运。' : '当前权威接口未返回流年与原局关系。',
      };
    }
    if (chain && typeof chain.analyzeLiuNian === 'function') {
      try {
        return chain.analyzeLiuNian(bazi, daYun, pillar, core && core.yongJi) || { triggers: [], reliefs: [] };
      } catch (error) {
        return { triggers: [], reliefs: [], error: '岁运关系暂无法解析' };
      }
    }
    return { triggers: [], reliefs: [] };
  }

  function annualNodeTexts(pillar, daYun, dynamic) {
    var values = [pillar && pillar.gan, pillar && pillar.zhi, daYun && daYun.gan, daYun && daYun.zhi];
    return values.concat(textList(dynamic && dynamic.triggers)).concat(textList(dynamic && dynamic.reliefs));
  }

  function annualNodeElements(pillar, daYun, calculator) {
    var stems = [pillar && pillar.gan, daYun && daYun.gan];
    var branches = [pillar && pillar.zhi, daYun && daYun.zhi];
    var stemMap = calculator && calculator.WU_XING || {};
    var branchMap = calculator && calculator.DI_ZHI_WU_XING || {};
    return stems.map(function (item) { return stemMap[item]; })
      .concat(branches.map(function (item) { return branchMap[item]; })).filter(Boolean);
  }

  function validBirthDate(birthDate) {
    if (!birthDate || typeof birthDate !== 'object') return false;
    var year = Number(birthDate.year);
    var month = Number(birthDate.month);
    var day = Number(birthDate.day);
    var hour = Number(birthDate.hour);
    if (![year, month, day, hour].every(Number.isFinite)) return false;
    if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12) return false;
    if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(hour) || hour < 0 || hour > 11) return false;
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function extractAnnualBranches(value) {
    var source = textOf(value);
    return ANNUAL_BRANCHES.filter(function (branch) { return source.indexOf(branch) >= 0; });
  }

  function hasUnverifiableTimingCondition(value) {
    return /进一步增强|得根行旺|得运助增|力量增强|制化不足|失其制化|根基不稳|可能加重|加重/.test(textOf(value));
  }

  function usableMitigation(value) {
    var normalized = textOf(value).trim();
    if (!normalized) return false;
    var compact = normalized.replace(/[\s，。；;、,]/g, '');
    return ['无', '暂无', '无救应', '无救援', '暂无救应', '暂无明显救应'].indexOf(compact) < 0;
  }

  function structuralEvidence(risk) {
    return [
      ['why', risk.why],
      ['triggerHint', risk.triggerHint],
      ['evidence', risk.evidence],
      ['partyEvidence', risk.partyEvidence],
    ].filter(function (row) { return textOf(row[1]); }).map(function (row) {
      return { field: row[0], text: textOf(row[1]) };
    });
  }

  function riskMatches(risk, pillar, daYun, dynamic, calculator, year, dayGan) {
    risk = risk || {};
    if (risk.strengthensRisk === false || risk.active === false) return false;
    var triggerYears = list(risk.triggerYears || risk.activeYears || risk.years).map(Number);
    if (triggerYears.length && triggerYears.indexOf(Number(year)) >= 0) return true;
    var dynamicRows = list(dynamic && dynamic.triggers);
    var riskType = textOf(risk.type || risk.name || risk.category) || textOf(risk);
    var texts = annualNodeTexts(pillar, daYun, dynamic);
    var elements = annualNodeElements(pillar, daYun, calculator);
    var riskText = [risk.parties, risk.why, risk.triggerHint, risk.evidence, risk.partyEvidence].map(textOf).join(' ');
    var annualRoles = [
      getStemRole(dayGan, pillar && pillar.gan, calculator),
      getStemRole(dayGan, daYun && daYun.gan, calculator),
    ].filter(Boolean);
    var annualTokens = [pillar && pillar.gan, pillar && pillar.zhi, daYun && daYun.gan, daYun && daYun.zhi]
      .concat(elements).concat(annualRoles).filter(Boolean);
    if (dynamicRows.some(function (row) {
      var value = textOf(row);
      return riskType && value.indexOf(riskType) >= 0 && annualTokens.some(function (token) { return value.indexOf(token) >= 0; });
    })) return true;
    var triggerText = textOf(risk.triggerHint || risk.trigger || risk.condition);
    if (!triggerText) triggerText = textOf(risk.why);
    if (!hasUnverifiableTimingCondition(triggerText) && annualTokens.some(function (token) { return triggerText.indexOf(token) >= 0; })) return true;
    var requiredElements = list(risk.triggerElements || risk.elements || risk.strengthenedBy);
    if (requiredElements.length && requiredElements.some(function (element) {
      return elements.indexOf(element) >= 0;
    })) {
      if (risk.requiresDynamic === false) return true;
      return dynamicRows.some(function (row) {
        var value = textOf(row);
        return !riskType || value.indexOf(riskType) >= 0 || requiredElements.some(function (element) { return value.indexOf(element) >= 0; });
      });
    }
    var relation = risk.relation || risk.event || risk.triggerRelation;
    if (relation === '冲' || /冲/.test(textOf(risk)) || /冲/.test(riskText)) {
      var branches = [pillar && pillar.zhi, daYun && daYun.zhi];
      var chartBranches = [
        risk.pillar && risk.pillar.zhi,
        risk.zhi,
      ].filter(Boolean).concat(extractAnnualBranches(riskText));
      if (risk.pillars && Array.isArray(risk.pillars) && risk.pillars.length) {
        chartBranches = chartBranches.concat(risk.pillars.map(function (item) {
          return typeof item === 'string' ? item : item && item.zhi;
        }).filter(Boolean));
      }
      if (branches.some(function (branch) {
        return branch && chartBranches.some(function (other) { return BRANCH_CLASH[branch] === other; });
      })) return true;
    }
    var trigger = textOf(risk.trigger || risk.condition || risk.activation);
    return !!trigger && texts.some(function (value) { return value.indexOf(trigger) >= 0; });
  }

  function matchTriggeredRisks(risks, pillar, daYun, dynamic, calculator, year, dayGan) {
    return list(risks).filter(function (risk) {
      return riskMatches(risk, pillar, daYun, dynamic, calculator, year, dayGan);
    }).map(function (risk) {
      var label = textOf(risk.type || risk.name || risk.category) || '结构节点';
      var source = textOf(risk.detail || risk.description || risk.conclusion || risk);
      return {
        type: label,
        conclusion: '岁运可能加强' + label + '，需结合现实条件与救应安排观察。',
        confidence: 'medium',
        evidence: structuralEvidence(risk).length ? structuralEvidence(risk) : (source ? [{ field: 'source', text: source }] : [{ field: 'type', text: label }]),
        why: textOf(risk.why),
        triggerHint: textOf(risk.triggerHint),
        partyEvidence: textOf(risk.partyEvidence),
        conditions: ['流年' + (pillar.gan || '') + (pillar.zhi || '') + '与当前岁运节点同时出现'],
      };
    });
  }

  function matchReliefs(risks, pillar, daYun, dynamic, calculator, year, core, dayGan) {
    var activeRisks = list(risks).filter(function (risk) {
      return riskMatches(risk, pillar, daYun, dynamic, calculator, year, dayGan);
    });
    var rows = list(dynamic && (dynamic.reliefs || dynamic.rescues));
    activeRisks.forEach(function (risk) {
      list(risk.mitigations).filter(usableMitigation).forEach(function (mitigation) {
        rows.push({ type: '结构风险救应', detail: textOf(mitigation), riskType: textOf(risk.type || risk.name) });
      });
    });
    var role = classifyElementRole(calculator && calculator.WU_XING && calculator.WU_XING[pillar && pillar.gan], core && core.yongJi);
    if (role === '用神' || role === '喜神') {
      rows = rows.concat([{ type: '喜用岁运', detail: '流年天干属于' + role + '，可作为缓和压力的条件之一。' }]);
    }
    return rows.map(function (row) {
      return { type: textOf(row.type || row.name) || '岁运救应', conclusion: textOf(row.detail || row.conclusion || row) || '岁运出现可供调节的条件，仍需结合现实执行。', evidence: [textOf(row)].filter(Boolean) };
    });
  }

  function annualTenGod(pillar, daYun, bazi, calculator) {
    var dayGan = bazi && bazi.day && bazi.day.gan;
    var getRole = function (gan) { return getStemRole(dayGan, gan, calculator); };
    return {
      yearStem: getRole(pillar && pillar.gan),
      daYunStem: getRole(daYun && daYun.gan),
      yearBranch: (pillar && pillar.zhi) || '',
      daYunBranch: (daYun && daYun.zhi) || '',
    };
  }

  var ANNUAL_DOMAIN_NAMES = {
    wealth: 'wealth', finance: 'wealth', money: 'wealth', '财运': 'wealth', '财富': 'wealth',
    relationship: 'relationship', marriage: 'relationship', love: 'relationship', '感情': 'relationship', '婚恋': 'relationship',
    study: 'study', education: 'study', learning: 'study', '学业': 'study', '学习': 'study',
    career: 'career', work: 'career', profession: 'career', '事业': 'career', '工作': 'career',
  };

  function normalizedAnnualDomain(value) {
    return ANNUAL_DOMAIN_NAMES[String(value == null ? '' : value).trim().toLowerCase()] || '';
  }

  function annualTriggerDomains(row) {
    row = row || {};
    var structured = list(row.domains || row.domain || row.reportDomains || row.reportDomain || row.area || row.areas || row.category)
      .map(normalizedAnnualDomain).filter(Boolean);
    if (structured.length) return structured.filter(function (domain, index) { return structured.indexOf(domain) === index; });
    var text = textOf(row);
    var domains = [];
    if (/财星|财运|财富|食伤生财|财破印|财坏印|财党杀|资源议题/.test(text)) domains.push('wealth');
    if (/夫妻宫|配偶星|感情|婚恋|婚姻|关系议题|日支/.test(text)) domains.push('relationship');
    if (/学业|学习|考试|进修|官印相生|杀印相生|伤官配印|食神制杀/.test(text)) domains.push('study');
    if (/事业|工作|职场|上级|组织位置|官非/.test(text)) domains.push('career');
    return domains;
  }

  function annualTriggerText(row) {
    return textOf(row && (row.detail || row.conclusion || row.text || row.summary || row));
  }

  function annualDomainTriggers(dynamic, domain) {
    return list(dynamic && dynamic.triggers).filter(function (row) {
      return annualTriggerDomains(row).indexOf(domain) >= 0;
    });
  }

  function annualOverallTriggers(dynamic) {
    return list(dynamic && dynamic.triggers).filter(function (row) {
      return annualTriggerDomains(row).length === 0;
    });
  }

  function annualDomainEvidence(dynamic, domain) {
    return annualDomainTriggers(dynamic, domain).map(annualTriggerText).filter(Boolean);
  }

  function buildAnnualCareerFacts(tenGod, dynamic) {
    return {
      conclusion: '事业议题按官杀、印与食伤的岁运透出观察，适合把目标拆成可执行步骤。',
      evidence: [tenGod.yearStem, tenGod.daYunStem].filter(function (item) { return item && item !== '十神未定'; }).concat(annualDomainEvidence(dynamic, 'career')),
      timing: dynamic && dynamic.summary ? dynamic.summary : '',
    };
  }

  function buildAnnualWealthFacts(core, pillar, daYun, dynamic, calculator) {
    var base = core && (core.wealth || core.wealthFacts) || null;
    var stemElement = calculator && calculator.WU_XING && calculator.WU_XING[pillar && pillar.gan];
    return {
      base: base,
      resource: base && base.resource,
      capacity: base && base.capacity,
      pathways: base && base.pathways,
      retention: base && base.retention,
      storage: base && base.storage,
      timing: {
        yearPillar: { gan: pillar && pillar.gan, zhi: pillar && pillar.zhi },
        daYun: daYun,
        elementRole: classifyElementRole(stemElement, core && core.yongJi),
        activation: annualDomainEvidence(dynamic, 'wealth'),
      },
      conclusion: base && base.summaryLevel
        ? '沿用财富事实的“' + base.summaryLevel + '”倾向，本年只补充岁运激活条件，不重新评估财富质量。'
        : '本年仅记录岁运对既有财富事实的激活条件，不重新评估财富质量。',
      evidence: annualDomainEvidence(dynamic, 'wealth'),
    };
  }

  function timingTargetLabel(targetPillar, layer) {
    if (targetPillar === 'dayun') return layer === '天干' ? '大运天干' : '大运地支';
    var label = PILLAR_LABELS[targetPillar] || targetPillar || '原局';
    return label + (layer === '天干' ? '天干' : '地支');
  }

  function timingBaseRow(source, layer, type, actor, target, targetPillar, core, calculator) {
    var actorElement = layer === '天干'
      ? ((calculator && calculator.WU_XING || {})[actor] || '')
      : branchElement(actor, calculator);
    var targetElement = layer === '天干'
      ? ((calculator && calculator.WU_XING || {})[target] || '')
      : branchElement(target, calculator);
    return {
      id: [String(source).toLowerCase(), layer === '天干' ? 'stem' : 'branch', type, targetPillar, actor, target].join(':'),
      source: source,
      targetPillar: targetPillar,
      targetLabel: timingTargetLabel(targetPillar, layer),
      layer: layer,
      type: type,
      actor: actor,
      target: target,
      actorElement: actorElement,
      targetElement: targetElement,
      actorRole: classifyElementRole(actorElement, core && core.yongJi),
      targetRole: classifyElementRole(targetElement, core && core.yongJi),
      formedElement: '',
      formedRole: '中性',
      formationStatus: 'none',
      transformed: false,
      direction: 'mixed',
      domains: targetPillar === 'day' && layer === '地支'
        ? ['relationship']
        : (targetPillar === 'month' ? ['career'] : []),
    };
  }

  function collectStemTimingRelation(source, movingGan, targetGan, targetPillar, core, calculator) {
    if (!movingGan || !targetGan) return [];
    var rows = [];
    var relation = elementRelation(
      (calculator && calculator.WU_XING || {})[movingGan],
      (calculator && calculator.WU_XING || {})[targetGan]
    );
    if (movingGan === targetGan) {
      rows.push(timingBaseRow(source, '天干', '伏吟', movingGan, targetGan, targetPillar, core, calculator));
    } else if (relation === 'generates' || relation === 'generatedBy') {
      rows.push(timingBaseRow(source, '天干', '天干相生', movingGan, targetGan, targetPillar, core, calculator));
    } else if (relation === 'controls' || relation === 'controlledBy') {
      var control = timingBaseRow(source, '天干', '天干相克', movingGan, targetGan, targetPillar, core, calculator);
      var movingControls = relation === 'controls';
      control.controller = movingControls ? movingGan : targetGan;
      control.controlled = movingControls ? targetGan : movingGan;
      control.controllerRole = movingControls ? control.actorRole : control.targetRole;
      control.controlledRole = movingControls ? control.targetRole : control.actorRole;
      rows.push(control);
    }
    if (STEM_COMBINE[movingGan] === targetGan) {
      var combined = timingBaseRow(source, '天干', '天干五合', movingGan, targetGan, targetPillar, core, calculator);
      combined.formedElement = STEM_COMBINE_ELEMENT[movingGan + targetGan] || '';
      combined.formedRole = classifyElementRole(combined.formedElement, core && core.yongJi);
      combined.formationStatus = 'potential';
      rows.push(combined);
    }
    return rows;
  }

  function collectBranchTimingRelations(source, movingZhi, targetZhi, targetPillar, core, calculator) {
    if (!movingZhi || !targetZhi) return [];
    var types = [];
    if (movingZhi === targetZhi) types.push('伏吟');
    if (BRANCH_CLASH[movingZhi] === targetZhi) types.push('六冲');
    if (BRANCH_COMBINE[movingZhi] === targetZhi) types.push('六合');
    if (BRANCH_HARM[movingZhi] === targetZhi) types.push('六害');
    if (BRANCH_PUNISH[movingZhi + targetZhi]) types.push('刑');
    return types.map(function (type) {
      var row = timingBaseRow(source, '地支', type, movingZhi, targetZhi, targetPillar, core, calculator);
      if (type === '六合') {
        row.formedElement = BRANCH_COMBINE_ELEMENT[movingZhi + targetZhi] || '';
        row.formedRole = classifyElementRole(row.formedElement, core && core.yongJi);
        row.formationStatus = 'potential';
      }
      return row;
    });
  }

  function collectGroupTimingRelations(source, movingZhi, bazi, core, calculator) {
    if (!movingZhi || !bazi) return [];
    var original = PILLARS.map(function (pillar) {
      return { pillar: pillar, zhi: bazi[pillar] && bazi[pillar].zhi };
    }).filter(function (row) { return row.zhi; });
    var rows = [];
    function collect(groups, fullType, halfType) {
      groups.forEach(function (group) {
        if (group.branches.indexOf(movingZhi) < 0) return;
        var before = group.branches.filter(function (branch) {
          return original.some(function (row) { return row.zhi === branch; });
        });
        var after = group.branches.filter(function (branch) {
          return branch === movingZhi || before.indexOf(branch) >= 0;
        });
        if (after.length < 2 || before.length === group.branches.length) return;
        var type = after.length === 3 ? fullType : halfType;
        var participants = original.filter(function (row) { return group.branches.indexOf(row.zhi) >= 0; });
        var targetPillar = participants.map(function (row) { return row.pillar; }).join('+') || 'original';
        var target = participants.map(function (row) { return row.zhi; }).join('');
        var row = timingBaseRow(source, '地支', type, movingZhi, target, targetPillar, core, calculator);
        row.targetLabel = participants.map(function (item) { return PILLAR_LABELS[item.pillar] + item.zhi; }).join('、');
        row.formedElement = group.element;
        row.formedRole = classifyElementRole(group.element, core && core.yongJi);
        row.formationStatus = after.length === 3 ? 'potential' : 'tendency';
        row.participants = [movingZhi].concat(participants.map(function (item) { return item.zhi; }));
        row.domains = participants.some(function (item) { return item.pillar === 'day'; }) ? ['relationship'] : [];
        rows.push(row);
      });
    }
    collect(THREE_COMBINE, '三合', '半合');
    collect(THREE_MEET, '三会', '半会');
    return rows;
  }

  function applyAuthoritativeFormationEvidence(rows, dynamic) {
    var authoritative = textList(dynamic && dynamic.triggers).join(' ');
    if (!authoritative || !/合化|化成|化神|真化|三合局|三会局|成局/.test(authoritative)) return rows;
    return rows.map(function (row) {
      if (!/天干五合|六合|三合|三会/.test(row.type)) return row;
      var tokens = [row.actor, row.target, row.formedElement].filter(Boolean);
      if (!tokens.some(function (token) { return authoritative.indexOf(token) >= 0; })) return row;
      return Object.assign({}, row, { formationStatus: 'qualified', transformed: true });
    });
  }

  function dedupeTimingInteractions(rows) {
    var seen = {};
    return list(rows).filter(function (row) {
      var key = [row.source, row.layer, row.type, row.targetPillar, row.actor, row.target, row.formedElement].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function adjudicateTimingInteraction(row) {
    row = row || {};
    var result = { direction: 'mixed', changeCost: false, frictionPersists: false, reasonKey: 'insufficient' };
    if (row.type === '六冲') {
      result.changeCost = true;
      if (favorableRole(row.targetRole)) {
        result.direction = 'adverse';
        result.reasonKey = 'clash_favorable_target';
      } else if (row.targetRole === '忌神' && favorableRole(row.actorRole)) {
        result.direction = 'favorable';
        result.reasonKey = 'clash_ji_target';
      }
    } else if (/^(六合|三合|半合|三会|半会|天干五合)$/.test(row.type)) {
      if (favorableRole(row.formedRole)) {
        result.direction = 'favorable';
        result.reasonKey = 'combine_favorable_formation';
      } else if (row.formedRole === '忌神') {
        result.direction = 'adverse';
        result.reasonKey = 'combine_ji_formation';
      } else if (favorableRole(row.targetRole) && row.actorRole === '忌神') {
        result.direction = 'adverse';
        result.reasonKey = 'bind_favorable_target';
      } else if (row.targetRole === '忌神') {
        result.reasonKey = 'bind_ji_target';
      }
    } else if (row.type === '刑' || row.type === '六害') {
      result.frictionPersists = true;
      result.direction = favorableRole(row.targetRole) || row.actorRole === '忌神' ? 'adverse' : 'mixed';
      result.reasonKey = row.type === '刑' ? 'repeated_friction' : 'hidden_distrust';
    } else if (row.type === '伏吟') {
      result.direction = favorableRole(row.targetRole) ? 'favorable' : (row.targetRole === '忌神' ? 'adverse' : 'mixed');
      result.reasonKey = 'repeat_target_role';
    } else if (row.type === '天干相克') {
      if (favorableRole(row.controllerRole) && row.controlledRole === '忌神') result.direction = 'favorable';
      else if (row.controllerRole === '忌神' && favorableRole(row.controlledRole)) result.direction = 'adverse';
      result.reasonKey = 'stem_control_direction';
    }
    return Object.assign({}, row, result);
  }

  function timingRelationPhrase(row) {
    var targetLabel = row.targetLabel || timingTargetLabel(row.targetPillar, row.layer);
    if (row.type === '六冲') return row.actor + '冲' + targetLabel + row.target;
    if (row.type === '六害') return row.actor + '害' + targetLabel + row.target;
    if (row.type === '刑') return row.actor + '刑' + targetLabel + row.target;
    if (row.type === '伏吟') return row.actor + '与' + targetLabel + row.target + '伏吟';
    if (row.type === '天干相克') return row.controller + '克' + row.controlled + '，作用到' + targetLabel;
    if (row.type === '天干相生') return row.actor + '与' + targetLabel + row.target + '相生';
    if (row.type === '天干五合') return row.actor + '与' + targetLabel + row.target + '五合';
    if (row.type === '六合') return row.actor + '与' + targetLabel + row.target + '六合';
    if (/三合|半合|三会|半会/.test(row.type)) return (row.participants || [row.actor, row.target]).join('') + row.type;
    return row.actor + '与' + targetLabel + row.target + row.type;
  }

  function timingSourceText(row) {
    row = row || {};
    var text = (row.source || '岁运') + timingRelationPhrase(row);
    if (row.formedElement) {
      if (row.formationStatus === 'qualified') text += '，合化为' + row.formedElement;
      else if (row.formationStatus === 'tendency') text += '，形成' + row.formedElement + '势的趋势';
      else text += '，合向' + row.formedElement;
      if (row.formedRole && row.formedRole !== '中性') text += '，' + row.formedElement + '为本命' + row.formedRole;
    } else if (row.targetElement && row.targetRole && row.targetRole !== '中性') {
      text += '，' + row.target + row.targetElement + '为本命' + row.targetRole;
    }
    return text + '。';
  }

  function timingDomains(row, facts) {
    row = row || {};
    facts = facts || {};
    var domains = list(row.domains).slice();
    if (row.targetPillar === 'day' && row.layer === '地支') domains.push('relationship');
    if (row.targetPillar === 'month') domains.push('career');
    var tenGodText = [row.actorTenGod, row.targetTenGod].filter(Boolean).join(' ');
    if (/正财|偏财/.test(tenGodText)) domains.push('wealth');
    if (/正印|偏印|正官|七杀|食神|伤官/.test(tenGodText)) domains.push('study');

    var storage = facts.wealth && facts.wealth.storage;
    var storageBranches = list(storage && storage.candidates).map(function (item) { return item && item.zhi; }).filter(Boolean);
    if (storageBranches.indexOf(row.actor) >= 0 || storageBranches.indexOf(row.target) >= 0) domains.push('wealth');

    list(row.structuralDomains).forEach(function (domain) { domains.push(domain); });
    return domains.filter(function (domain, index) { return domain && domains.indexOf(domain) === index; });
  }

  function enrichTimingInteraction(row, bazi, core, calculator) {
    var enriched = Object.assign({}, row);
    if (enriched.layer === '天干') {
      var dayGan = bazi && bazi.day && bazi.day.gan;
      enriched.actorTenGod = getStemRole(dayGan, enriched.actor, calculator);
      enriched.targetTenGod = getStemRole(dayGan, enriched.target, calculator);
    }
    enriched = adjudicateTimingInteraction(enriched);
    enriched.domains = timingDomains(enriched, core || {});
    enriched.sourceText = timingSourceText(enriched);
    return enriched;
  }

  function collectAnnualInteractions(bazi, core, pillar, daYun, dynamic, calculator) {
    var rows = [];
    function collectMoving(source, moving, targetChart) {
      if (!moving) return;
      PILLARS.forEach(function (targetPillar) {
        var target = targetChart && targetChart[targetPillar];
        if (!target) return;
        rows = rows.concat(collectStemTimingRelation(source, moving.gan, target.gan, targetPillar, core, calculator));
        rows = rows.concat(collectBranchTimingRelations(source, moving.zhi, target.zhi, targetPillar, core, calculator));
      });
      rows = rows.concat(collectGroupTimingRelations(source, moving.zhi, targetChart, core, calculator));
    }
    collectMoving('流年', pillar, bazi);
    if (daYun) {
      collectMoving('大运', daYun, bazi);
      rows = rows.concat(collectStemTimingRelation('岁运', pillar && pillar.gan, daYun.gan, 'dayun', core, calculator));
      rows = rows.concat(collectBranchTimingRelations('岁运', pillar && pillar.zhi, daYun.zhi, 'dayun', core, calculator));
    }
    return dedupeTimingInteractions(applyAuthoritativeFormationEvidence(rows, dynamic)).map(function (row) {
      return enrichTimingInteraction(row, bazi, core, calculator);
    });
  }

  function movingPalaceRelations(source, movingBranch, palaceBranch, core, calculator) {
    if (!movingBranch || !palaceBranch) return [];
    var types = [];
    if (movingBranch === palaceBranch) types.push('伏吟');
    if (BRANCH_CLASH[movingBranch] === palaceBranch) types.push('六冲');
    if (BRANCH_HARM[movingBranch] === palaceBranch) types.push('六害');
    if (BRANCH_PUNISH[movingBranch + palaceBranch]) types.push('刑');
    if (BRANCH_COMBINE[movingBranch] === palaceBranch) types.push('六合');
    var movingElement = branchElement(movingBranch, calculator);
    var palaceElement = branchElement(palaceBranch, calculator);
    var movingRole = classifyElementRole(movingElement, core && core.yongJi);
    var palaceRole = classifyElementRole(palaceElement, core && core.yongJi);
    return types.map(function (type) {
      var direction = 'mixed';
      if (type === '六冲') {
        if (palaceRole === '忌神') direction = 'favorable';
        else if (favorableRole(palaceRole)) direction = 'adverse';
      } else if (type === '六合') {
        if (favorableRole(movingRole) && favorableRole(palaceRole)) direction = 'favorable';
        else if (movingRole === '忌神' || palaceRole === '忌神') direction = 'adverse';
      } else if (type === '伏吟') {
        if (favorableRole(palaceRole)) direction = 'favorable';
        else if (palaceRole === '忌神') direction = 'adverse';
      } else if ((type === '刑' || type === '六害') && movingRole === '忌神' && favorableRole(palaceRole)) {
        direction = 'adverse';
      }
      return {
        source: source,
        type: type,
        movingBranch: movingBranch,
        palaceBranch: palaceBranch,
        movingElement: movingElement,
        palaceElement: palaceElement,
        movingRole: movingRole,
        palaceRole: palaceRole,
        direction: direction,
      };
    });
  }

  function buildAnnualRelationshipFacts(bazi, core, pillar, daYun, dynamic, calculator) {
    var palaceBranch = bazi && bazi.day && bazi.day.zhi;
    var activations = movingPalaceRelations('流年', pillar && pillar.zhi, palaceBranch, core, calculator)
      .concat(movingPalaceRelations('大运', daYun && daYun.zhi, palaceBranch, core, calculator));
    return {
      conclusion: '关系议题按流年与夫妻宫、配偶星的动态牵动观察，合冲只表示议题被触发，不直接定结果。',
      timing: { yearPillar: pillar, daYun: daYun },
      activations: activations,
      evidence: annualDomainEvidence(dynamic, 'relationship'),
    };
  }

  function buildAnnualStudyFacts(tenGod, dynamic) {
    return {
      conclusion: '学习安排可结合印、食伤与官杀的岁运表现，在吸收、输出和纪律之间调整节奏。',
      evidence: [tenGod.yearStem, tenGod.daYunStem].filter(function (item) { return item && item !== '十神未定'; }).concat(annualDomainEvidence(dynamic, 'study')),
    };
  }

  function buildWellbeingGuidance(core, pillar, daYun) {
    return {
      conclusion: '岁运变化较明显时，优先留意作息、活动、饮食与情绪管理，必要时寻求专业支持。',
      evidence: [pillar && pillar.gan + pillar.zhi, daYun && daYun.gan + daYun.zhi].filter(Boolean),
      conditions: ['仅作身心状态风险提示，不作诊断'],
    };
  }

  function buildAnnualFacts(bazi, core, calculator, chain, year, activeDaYun) {
    var pillar = annualPillarForYear(calculator, year, activeDaYun, bazi && bazi.day && bazi.day.gan);
    var dynamic = resolveAnnualDynamic(bazi, activeDaYun, pillar, core || {}, calculator, chain);
    var tenGod = annualTenGod(pillar, activeDaYun, bazi, calculator);
    var stemElement = calculator && calculator.WU_XING && calculator.WU_XING[pillar.gan];
    var branchElement = calculator && calculator.DI_ZHI_WU_XING && calculator.DI_ZHI_WU_XING[pillar.zhi];
    var dayGan = bazi && bazi.day && bazi.day.gan;
    var triggeredRisks = matchTriggeredRisks(core && core.structuralRisks, pillar, activeDaYun, dynamic, calculator, year, dayGan);
    var interactions = collectAnnualInteractions(bazi, core || {}, pillar, activeDaYun, dynamic, calculator);
    return {
      year: Number(year),
      pillar: pillar,
      yearPillar: pillar,
      daYun: activeDaYun || null,
      hasDaYun: !!activeDaYun,
      stemRole: classifyElementRole(stemElement, core && core.yongJi),
      branchRole: classifyElementRole(branchElement, core && core.yongJi),
      daYunStemRole: classifyElementRole(calculator && calculator.WU_XING && calculator.WU_XING[activeDaYun && activeDaYun.gan], core && core.yongJi),
      daYunBranchRole: classifyElementRole(calculator && calculator.DI_ZHI_WU_XING && calculator.DI_ZHI_WU_XING[activeDaYun && activeDaYun.zhi], core && core.yongJi),
      tenGod: tenGod,
      dynamic: dynamic,
      interactions: interactions,
      overallTriggers: annualOverallTriggers(dynamic),
      triggeredRisks: triggeredRisks,
      reliefs: matchReliefs(core && core.structuralRisks, pillar, activeDaYun, dynamic, calculator, year, core, dayGan),
      career: buildAnnualCareerFacts(tenGod, dynamic),
      wealth: buildAnnualWealthFacts(core, pillar, activeDaYun, dynamic, calculator),
      relationship: buildAnnualRelationshipFacts(bazi, core, pillar, activeDaYun, dynamic, calculator),
      study: buildAnnualStudyFacts(tenGod, dynamic),
      wellbeing: buildWellbeingGuidance(core, pillar, activeDaYun),
    };
  }

  function compareAnnualFacts(years) {
    years = Array.isArray(years) ? years : [];
    var active = years.filter(function (row) { return row.triggeredRisks && row.triggeredRisks.length; });
    var roles = years.map(function (row) { return row.stemRole; });
    return {
      label: active.length ? '结构调整与风险管理' : '按年观察与节奏收敛',
      evidence: active.map(function (row) { return row.year + '年有条件性结构提示'; }),
      roleSequence: roles,
    };
  }

  function findDaYunTransitions(years) {
    var transitions = [];
    for (var i = 1; i < years.length; i += 1) {
      var previous = years[i - 1].daYun;
      var current = years[i].daYun;
      var previousKey = previous && previous.gan + previous.zhi;
      var currentKey = current && current.gan + current.zhi;
      if (previousKey !== currentKey) {
        transitions.push({ year: years[i].year, from: previous || null, to: current || null });
      }
    }
    return transitions;
  }

  function buildUndatedFiveYearFacts(bazi, core, calculator, chain, anchorYear) {
    var years = [];
    for (var year = Number(anchorYear); year < Number(anchorYear) + 5; year += 1) {
      years.push(buildAnnualFacts(bazi, core, calculator, chain, year, null));
    }
    return {
      anchorYear: Number(anchorYear),
      hasDaYun: false,
      limitation: '未确认出生时间，当前大运与起运年龄未纳入。',
      years: years,
      transitions: [],
      trend: compareAnnualFacts(years),
    };
  }

  function buildFiveYearFacts(bazi, core, calculator, chain, anchorYear, gender) {
    var targetYear = Number(anchorYear);
    if (!bazi || !validBirthDate(bazi.birthDate) || !calculator || typeof calculator.calculateDaYun !== 'function') {
      return buildUndatedFiveYearFacts(bazi, core, calculator || {}, chain, targetYear);
    }
    var daYunData;
    try {
      daYunData = calculator.calculateDaYun(
        bazi.month, bazi.year, gender,
        bazi.birthDate.year, bazi.birthDate.month, bazi.birthDate.day, bazi.birthDate.hour
      ) || {};
    } catch (error) {
      return buildUndatedFiveYearFacts(bazi, core, calculator, chain, targetYear);
    }
    var years = [];
    for (var year = targetYear; year < targetYear + 5; year += 1) {
      years.push(buildAnnualFacts(bazi, core, calculator, chain, year, findDaYunForYear(daYunData.list, year)));
    }
    return {
      anchorYear: targetYear,
      hasDaYun: true,
      years: years,
      transitions: findDaYunTransitions(years),
      trend: compareAnnualFacts(years),
    };
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function wealthMagnitude(level) {
    return [
      '', '1元级', '10元级', '100元级', '1000元级', '1万元级',
      '10万元级', '100万元级', '1000万元级', '1亿元级', '10亿元级',
    ][level];
  }

  function narrativeVerdict(title, text, basis, details) {
    details = details || {};
    var outcomeText = details.outcomeText || text || '';
    return {
      title: title || '',
      sourceText: details.sourceText || '',
      outcomeText: outcomeText,
      text: outcomeText,
      basis: list(basis).filter(Boolean),
    };
  }

  function buildWealthNarrative(facts) {
    var wealth = facts && facts.wealth || {};
    var resource = wealth.resource || {};
    var capacity = wealth.capacity || {};
    var quality = resource.quality || {};
    var pathways = list(wealth.pathways);
    var retentionRisks = list(wealth.retention && wealth.retention.risks);
    var points = 2;
    points += ({ '顺势': 3, '可承接': 2, '有缓解': 1, '平衡观察': 0, '承压': -2 })[capacity.state] || 0;
    if (Number(resource.visibleCount) > 0) points += 1;
    if (Number(resource.hiddenCount) > 0 || list(quality.roots).length) points += 0.5;
    if (capacity.elementRole === '用神' || capacity.elementRole === '喜神' || resource.elementRole === '用神' || resource.elementRole === '喜神') points += 1;
    if (capacity.elementRole === '忌神' || resource.elementRole === '忌神') points -= 1;
    points += Math.min(2, pathways.length) * 0.5;
    if (wealth.storage && wealth.storage.activated) points += 0.5;
    points -= Math.min(3, retentionRisks.length) * 0.5;
    var level = clampNumber(Math.round(points), 1, 10);
    var pathText = pathways.map(function (row) { return textOf(row && (row.type || row.conclusion || row)); }).join(' ');
    var headline;
    var painPoint;
    if (capacity.state === '承压') {
      headline = '你不是没有赚钱机会，而是机会越多，资金、责任和精力越容易一起承压。';
      painPoint = '最大的财富问题不是收入低，而是为了接住机会付出的成本可能超过实际留存。';
    } else if (!Number(resource.visibleCount) && !Number(resource.hiddenCount)) {
      headline = '你的财富不会凭空出现，必须先把能力做成别人愿意持续付费的东西。';
      painPoint = '最容易卡住的地方，是有能力却缺少稳定的成交入口。';
    } else if (retentionRisks.length) {
      headline = '你具备赚钱条件，但真正拉开财富差距的是能不能把钱留下。';
      painPoint = '最大的财富漏洞，是收入增加后又被合作分配、长期投入或责任支出迅速带走。';
    } else {
      headline = '你的财富上限不只取决于工资，更取决于能否把经验和资源重复变现。';
      painPoint = '最容易低估的问题，是收入增加了，但可复制的赚钱方式没有同步形成。';
    }
    var source = /食伤生财/.test(pathText)
      ? '财富主要通过专业输出、产品、技术、内容或项目成果形成。'
      : /财生官|财官印/.test(pathText)
        ? '财富主要通过组织平台、管理职责和资源调度放大。'
        : /财配印/.test(pathText)
          ? '知识、资质、专业信誉和长期资产更容易成为财富入口。'
          : /比劫/.test(pathText)
            ? '合作与圈层能够带来机会，同时也会产生更明显的利益分配。'
            : '财富更常从稳定主业开始，再由可重复成交的能力或资源逐步放大。';
    var resourceText = Number(resource.visibleCount) > 0
      ? '财富机会在命局中有明显出口，收入通常不是完全隐性的，更容易通过现实职位、项目或交易被看见。'
      : Number(resource.hiddenCount) > 0
        ? '财富信息藏在命局内部，赚钱机会往往先以能力、资源或长期积累的形式出现，兑现速度偏慢。'
        : '原局没有明显财富出口，财富增长更依赖后天行业、平台和岁运把资源通路打开。';
    var capacityText = capacity.state === '顺势'
      ? '命局顺着财富结构运行，资源越集中越容易形成现实结果，财富承载是这张盘的主要优势。'
      : capacity.state === '可承接'
        ? '命主具备承接财富的基础，收入机会出现后有能力把它转成实际成果。'
        : capacity.state === '有缓解'
          ? '财富会同时带来压力，但命局中仍有力量分担，属于能接财、却不能无限扩张的结构。'
          : capacity.state === '承压'
            ? '财星对命主形成明显消耗，收入规模扩大时，责任、成本和资金压力也会同步增加。'
            : '财富承载处于中间状态，收入高低更依赖具体行业与岁运是否形成通路。';
    var retentionText = retentionRisks.length
      ? '命局存在财富分流或消耗结构，表现为进账之后容易继续投入、被合作分配，或被责任性支出带走。'
      : '原局没有明显的财富分流结构，收入形成后相对更容易保留，但实际资产仍取决于现实经营。';
    var storageText = wealth.storage && wealth.storage.activated
      ? '财库在原局中有真实财星并受到引动，财富存在从现金流沉淀为资产、项目或长期资源的通道。'
      : wealth.storage && wealth.storage.candidates && wealth.storage.candidates.length
        ? '命局有财入库的基础，但库气尚未被明显引动，财富更像有储存空间、暂未完全打开。'
        : '原局未形成有效财库，财富更偏流动收入，资产沉淀能力不能仅凭库支判断。';
    return {
      grade: 'A' + level,
      level: wealthMagnitude(level),
      difficulty: level >= 8 ? '平台、强运与长期经营同时到位时兑现更快' : level >= 5 ? '持续经营时更容易逐步达到' : '承载与变现通路偏弱',
      headline: headline,
      painPoint: painPoint,
      paragraphs: [],
      verdicts: [
        narrativeVerdict('财富显现方式', '', ['WEALTH_OCCURRENCE:' + (resource.state || 'unknown')], {
          sourceText: '财星在原局中' + (Number(resource.visibleCount) > 0 ? '透干显现' : Number(resource.hiddenCount) > 0 ? '藏于地支' : '没有明显显现') + '。', outcomeText: resourceText,
        }),
        narrativeVerdict('财富承载能力', '', ['WEALTH_CAPACITY:' + (capacity.state || 'unknown')], {
          sourceText: '日主旺衰与财星喜忌综合后，财富承载状态为“' + (capacity.state || '中间状态') + '”。', outcomeText: capacityText,
        }),
        narrativeVerdict('主要赚钱路径', '', pathways.length ? pathways.map(function (row) { return 'WEALTH_PATH:' + textOf(row.type || row); }) : ['WEALTH_PATH:FALLBACK'], {
          sourceText: pathways.length ? '命局形成' + pathways.map(function (row) { return textOf(row.type || row); }).join('、') + '。' : '原局没有形成单一高权重财富链。', outcomeText: source,
        }),
        narrativeVerdict('财富留存状态', '', retentionRisks.length ? retentionRisks.map(function (row) { return 'WEALTH_RETENTION:' + textOf(row.type || row); }) : ['WEALTH_RETENTION:CLEAR'], {
          sourceText: retentionRisks.length ? '原局存在' + retentionRisks.map(function (row) { return textOf(row.type || row); }).join('、') + '等财富分流证据。' : '原局未见明确财富分流结构。', outcomeText: retentionText,
        }),
        narrativeVerdict('资产沉淀能力', '', ['WEALTH_STORAGE:' + (wealth.storage && wealth.storage.activated ? 'activated' : wealth.storage && wealth.storage.candidates && wealth.storage.candidates.length ? 'present' : 'absent')], {
          sourceText: wealth.storage && wealth.storage.activated ? '财星真实入库，且财库受到原局关系引动。' : wealth.storage && wealth.storage.candidates && wealth.storage.candidates.length ? '财星真实入库，但库气尚未明显引动。' : '原局未形成有效财库。', outcomeText: storageText,
        }),
      ],
      note: '财富等级表示个人净资产峰值的命局量级参考，不代表当前存款，也不是收益承诺。',
    };
  }

  function studySignalScore(fact) {
    if (!fact) return 0;
    var points = ({ strong: 1.25, medium: 0.75, limited: 0.25 })[fact.confidence] || 0.5;
    if (/待建立|拉扯|需转化|规则切换|吃力|不足/.test(textOf(fact.state))) points -= 0.5;
    return Math.max(0, points);
  }

  function studyLevelText(level) {
    return [
      '', '基础学习较吃力', '完成基础学历需要更多投入', '职业技能路线相对更顺',
      '大专层级较顺，本科需要努力', '本科有机会，稳定投入是关键',
      '本科较顺，冲击更高学历需要努力', '本科以上相对轻松，硕士仍需持续投入',
      '硕士层级有较强潜力', '研究生深造优势明显', '高阶研究型学习潜力突出',
    ][level];
  }

  function buildStudyNarrative(facts) {
    var study = facts && facts.study || {};
    var band = study.educationBand || {};
    var level = Number(band.rank);
    if (!Number.isFinite(level)) {
      var points = 1 + studySignalScore(study.absorption) + studySignalScore(study.expression) +
        studySignalScore(study.discipline) + studySignalScore(study.application);
      list(study.chains).forEach(function (chain) {
        if (!chain || !chain.present) return;
        points += chain.id === 'learning_pressure' ? -1.25 : (chain.confidence === 'strong' ? 1.5 : 0.75);
      });
      points -= Math.min(2, list(study.obstacles).length) * 0.5;
      level = clampNumber(Math.round(points), 1, 10);
    }
    var levelLabel = textOf(band.label) || studyLevelText(level);
    var profile = study.profile || studyProfileRecord('composite', ['PROFILE:LEGACY_COMPOSITE']);
    var limitations = list(study.limitations);
    var disciplineText = textOf(study.discipline);
    var absorptionText = textOf(study.absorption);
    var expressionText = textOf(study.expression);
    var painPoint = limitations.length ? textOf(limitations[0].outcomeText) : /待建立|需外部节奏|规则切换/.test(disciplineText)
      ? '最容易拖累你的不是理解能力，而是长期执行、应试节奏和对重复训练的耐心。'
      : /待建立|需转化|拉扯/.test(absorptionText)
        ? '学习最吃力的环节在于把零散信息真正消化，资料越多反而越容易失去重点。'
        : /待建立|拉扯/.test(expressionText)
          ? '你容易出现“听懂了但写不出来、做不出来”的问题，输出训练决定最终成绩。'
          : '真正的问题不是聪明程度，而是能否把优势稳定维持到长期考试和成果交付，这也是最容易低估的短板。';
    var headline = level >= 8
      ? '你的学习结构具备继续深造的基础，本科以上相对轻松，硕士及更高层级也有明显潜力。'
      : level >= 6
        ? '你达到本科层级相对有基础，更高学历的差距主要出现在长期投入和应试稳定性。'
        : level >= 4
          ? '你并非学不会，但纯靠临场发挥很难稳定跨过更高学历门槛。'
          : '传统应试对你会比较吃力，理解能力、稳定输出和长期执行之间容易出现明显断层。';
    function studyStateText(kind, fact) {
      var state = textOf(fact && fact.state);
      var maps = {
        absorption: {
          '有承接': '理解和吸收能力较稳定，面对系统知识时能够抓住主线，不完全依赖死记硬背。',
          '需转化': '理解并不差，但容易停在思考和收集资料阶段，知道得多、真正转成成绩或成果的速度偏慢。',
          '输入与输出拉扯': '吸收信息和表达成果之间容易脱节，常出现听懂、看懂，却不能稳定复现的情况。',
          '待建立': '吸收知识更依赖兴趣和外部引导，面对不感兴趣的标准课程时会明显吃力。',
        },
        expression: {
          '稳定输出': '输出能力偏稳定，适合通过持续练习积累成绩，临场表现通常不会大起大落。',
          '创新输出': '思路活、拆解能力强，开放题和创造性任务更占优势，但标准答案环境容易显得不够规整。',
          '复合输出': '既能稳定表达，也有创新能力，学习成果更容易通过写作、讲解、作品或项目表现出来。',
          '待建立': '表达和答题输出是明显短板，理解程度往往高于最终呈现出来的成绩。',
        },
        discipline: {
          '可借规则转化': '能够在明确制度、考试目标或资格体系中持续投入，越是有标准的长期学习越容易形成成果。',
          '有规则承接': '具备一定自律和应试适应力，学习状态在目标明确时明显好于完全自由安排。',
          '规则切换': '面对多个目标或规则频繁变化时容易分心，应试成绩的稳定性弱于真实理解能力。',
          '需外部节奏': '长期自我约束偏弱，没有考试、期限或监督时，学习容易断续。',
        },
        application: {
          '学以致用': '知识更容易转成技能、项目、作品或收入，实践型学习的兑现能力较强。',
          '实践转化': '学习只有进入真实任务后才容易掌握，单纯理论积累的效率一般。',
          '待建立': '知识与现实应用之间缺少稳定通道，学历和实际能力可能出现落差。',
        },
      };
      return maps[kind] && maps[kind][state] || textOf(fact && fact.conclusion) || '该项学习特征没有形成集中表现。';
    }
    function dimensionVerdict(title, key, fact) {
      var state = textOf(fact && fact.state) || '未形成集中表现';
      var role = textOf(fact && fact.elementRole);
      return narrativeVerdict(title, '', ['STUDY_' + key.toUpperCase() + ':' + state], {
        sourceText: title + '在命局中呈现“' + state + '”' + (role && role !== '中性' ? '，对应五行为本命' + role : '') + '。',
        outcomeText: studyStateText(key, fact),
      });
    }
    var verdicts = [
      narrativeVerdict('可达到的学习层级', '', list(band.basis).length ? band.basis : ['STUDY_BAND:L' + level], {
        sourceText: '综合学习结构、四项承接能力与已确认阻断后，学业层级落在“' + levelLabel + '”。',
        outcomeText: levelLabel + '。这表示命局具备的学习与应试承接上限，不代表具体学校录取。',
      }),
      narrativeVerdict('你的学习类型', '', list(profile.basis).length ? profile.basis : ['STUDY_PROFILE:' + (profile.key || 'composite')], {
        sourceText: textOf(profile.sourceText),
        outcomeText: textOf(profile.outcomeText),
      }),
      dimensionVerdict('理解吸收', 'absorption', study.absorption),
      dimensionVerdict('答题与表达', 'expression', study.expression),
      dimensionVerdict('自律与应试', 'discipline', study.discipline),
      dimensionVerdict('知识兑现', 'application', study.application),
    ];
    limitations.forEach(function (limitation) {
      verdicts.push(narrativeVerdict('拉低学业表现的因素', '', limitation.basis || ['STUDY_LIMIT:' + limitation.key], {
        sourceText: textOf(limitation.sourceText),
        outcomeText: textOf(limitation.outcomeText),
      }));
    });
    return {
      grade: '',
      level: levelLabel,
      difficulty: '',
      headline: headline,
      painPoint: painPoint,
      paragraphs: [],
      verdicts: verdicts,
      note: '学业层级表示命局中的学习承接与应试潜力，不等于录取或学历承诺。',
    };
  }

  function buildRelationshipNarrative(facts) {
    var relationship = facts && facts.relationship || {};
    var interaction = relationship.interaction || {};
    var spouseStar = relationship.spouseStar || {};
    var quality = spouseStar.quality || {};
    var palace = relationship.palace || {};
    var partnerLabel = relationship.gender === 'female' ? '丈夫' : relationship.gender === 'male' ? '妻子' : '另一半';
    var branchProfiles = {
      '子': ['反应快、心思细、适应力强，但情绪和想法变化也快', '五官线条偏柔和，眼神灵动，体态轻巧，气质带有清冷或机敏感'],
      '丑': ['务实耐受、慢热谨慎，重生活基础，也容易固执和压住情绪', '骨架稳、身形匀实，面部轮廓端正，气质朴素耐看'],
      '寅': ['主见强、行动果断、讲原则和效率，不喜欢被反复指挥，关系中自然带有主导感', '身形偏修长或骨架舒展，眉形清晰，眼神直接有精神，动作利落，整体清秀而干练'],
      '卯': ['审美和分寸感较强，待人温和但内在坚持，重视体面与感受', '身形偏纤细匀称，五官秀气，线条柔顺，整体形象较整洁'],
      '辰': ['现实、能筹划，表面稳定但内心想法多，既重资源也重长期安排', '身形匀实，轮廓有层次，气质沉稳中带灵活感，耐看多于张扬'],
      '巳': ['反应敏捷、表达直接、企图心强，重效率，也容易急躁或控制节奏', '面部有光彩，眼神活，身形利落，举止带速度感和明显存在感'],
      '午': ['热情坦率、自尊心强，喜欢明确回应，关系中不愿长期冷淡', '气色明亮，神态外放，身形舒展，笑容或眼神较有感染力'],
      '未': ['温和顾家、重感受与稳定，愿意照顾人，但内心有自己的标准', '线条柔和，身形匀称或略有肉感，气质温暖亲近'],
      '申': ['聪明机敏、现实判断强，善于处理复杂关系，也容易防备心重', '骨架清楚，五官轮廓利落，动作灵活，气质精明而有距离感'],
      '酉': ['重品质、边界和细节，自我要求高，也容易挑剔或在意评价', '五官精致或轮廓分明，身形匀称，仪表整洁，修饰感较突出'],
      '戌': ['责任感强、重承诺和原则，能扛事，但固执时不容易听取不同意见', '骨架稳健，轮廓方正，神态可靠，气质成熟克制'],
      '亥': ['感受力强、包容随和，重精神交流，但想法深、不喜欢被追问到底', '线条柔润，眼神温和，体态自然，气质安静并带一点神秘感'],
    };
    var roleProfiles = {
      '七杀': '夫妻宫主气对应七杀，所以对方做事更果断、要求更高，也更习惯自己掌握节奏',
      '正官': '夫妻宫主气对应正官，所以对方重规则、名分和责任，对伴侣也有明确标准',
      '食神': '夫妻宫主气对应食神，所以对方性格较温和，会照顾生活感受，也在意两个人相处得舒不舒服',
      '伤官': '夫妻宫主气对应伤官，所以对方表达直接、自我意识强，不喜欢被固定规矩束缚',
      '正财': '夫妻宫主气对应正财，所以对方务实、会安排生活，也比较重视稳定和秩序',
      '偏财': '夫妻宫主气对应偏财，所以对方擅长与人打交道，对机会和现实资源也更敏感',
      '正印': '夫妻宫主气对应正印，所以对方较温和体贴，重视安全感和精神支持，但也容易照顾得过多',
      '偏印': '夫妻宫主气对应偏印，所以对方观察细、有自己的想法，很多情绪不会马上说出来，也需要个人空间',
      '比肩': '夫妻宫主气对应比肩，所以对方独立、自尊心强，希望两个人平等，不愿长期处于弱势',
      '劫财': '夫妻宫主气对应劫财，所以对方行动力强、爱憎分明，发生分歧时也更容易争主导权',
    };
    var starElementLooks = {
      '木': '配偶星属木，进一步加强修长、清秀和有成长感的特征',
      '火': '配偶星属火，进一步加强明亮气色、表达感和存在感',
      '土': '配偶星属土，进一步加强稳重、匀实和朴素耐看的特征',
      '金': '配偶星属金，进一步加强轮廓清晰、整洁精致和边界感',
      '水': '配偶星属水，使外形在利落之外多出细腻、柔和与灵动感',
    };
    var branchProfile = branchProfiles[palace.zhi] || ['配偶性格呈现复合特点', '外形气质没有形成单一特征'];
    var hiddenRows = list(palace.hiddenTenGods);
    var mainHidden = hiddenRows.filter(function (row) { return row && row.layer === '本气'; })[0] || hiddenRows[0];
    var secondaryHidden = hiddenRows.filter(function (row) { return row && row !== mainHidden; });
    var secondaryRoleCopies = {
      '七杀': '遇事敢做决定', '正官': '看重规则和承诺', '食神': '会照顾生活感受', '伤官': '说话直接、不愿受束缚',
      '正财': '务实、会过日子', '偏财': '懂人情和机会', '正印': '重感情和安全感', '偏印': '心思细、有自己的想法',
      '比肩': '独立、不愿示弱', '劫财': '行动快、好胜心强',
    };
    var personalityText = branchProfile[0] + '。' + (roleProfiles[mainHidden && mainHidden.role] || '夫妻宫主气让这些特点更明显') + '。';
    if (secondaryHidden.length) personalityText += '夫妻宫里同时还藏有' + secondaryHidden.map(function (row) { return row.role; }).join('、') + '，所以对方还有' + secondaryHidden.map(function (row) { return secondaryRoleCopies[row.role] || '不轻易外露'; }).join('、') + '的一面。';
    var interactionTexts = {
      '夫妻宫生身': partnerLabel + '更愿意照顾你，遇到现实问题时也更容易主动帮你。',
      '命主生夫妻宫': '这段关系里通常是你付出更多，照顾、迁就和承担往往先由你开始。',
      '命主克夫妻宫': '你更想掌握两个人的生活节奏，遇到重要事情时通常希望按你的想法推进。',
      '夫妻宫克身': partnerLabel + '的主见和现实要求比你更强，很多事情会推着你走，你也容易觉得自己被管得多、被压着。',
      '干支同类': '两个人都很有主见，平时能并肩做事，但争起来也都不愿先让步。',
    };
    var marriageEffectText = quality.elementRole === '用神' || quality.elementRole === '喜神'
      ? '配偶星在命局中属于' + quality.elementRole + '，所以' + partnerLabel + '进入你的生活后，更容易给你带来实际帮助，例如资源、收入机会、生活安排或做事秩序。'
      : quality.elementRole === '忌神'
        ? '配偶星在命局中属于忌神，所以进入关系后，你更容易觉得钱、责任和精力都被感情占住；对方越强势，这种压力通常越明显。'
        : '配偶星在命局中没有明显落在喜神或忌神上，所以' + partnerLabel + '带来的帮助和压力都不算特别集中，关系起伏更容易跟着大运流年变化。';
    var firstPosition = spouseStar.occurrences && spouseStar.occurrences[0] && spouseStar.occurrences[0].pillar || 'unknown';
    var distanceCopies = { year: '原有生活圈之外、长辈关系圈或较早阶段', month: '工作、学习、同事同学或熟人圈', day: '身边长期接触、关系基础较近的圈层', hour: '后期工作圈、异地或人生较晚阶段' };
    var distanceCopy = distanceCopies[firstPosition] || '现实生活中能够持续接触的圈层';
    var ageCopy = relationship.age && relationship.age.tendency === 'older_tendency'
      ? '配偶年龄更容易略大，或即使年龄接近，心理成熟度和现实经验也更强。'
      : relationship.age && relationship.age.tendency === 'younger_tendency'
        ? '配偶年龄更容易略小，或在性格和生活阶段上显得更年轻。'
        : '配偶年龄以与命主相仿为主，也可能只是略年长、表现得更成熟。';
    var appearanceText = branchProfile[1] + '。' + (starElementLooks[spouseStar.element] || '') + '。';
    var eventVerdicts = [];
    var palaceRoleText = palace.elementRole || '中性';
    var originalEvents = list(palace.dayInvolvingEvents);
    var eventTypes = originalEvents.map(function (row) { return textOf(row && row.type) || textOf(row); });
    function hasOriginalEvent(pattern) { return eventTypes.some(function (type) { return pattern.test(type); }); }
    function originalEventDirections(pattern) {
      return originalEvents.filter(function (row) { return pattern.test(textOf(row && row.type)); }).map(function (row) {
        return textOf(row && row.source) + '与' + textOf(row && row.target) + '形成' + textOf(row && row.type);
      }).filter(function (row) { return row !== '与形成'; }).join('、');
    }
    var favorablePalace = favorableRole(palaceRoleText);
    function originalRoleSuffix(type) {
      if (favorablePalace) {
        if (type === '合') return '夫妻宫本身为' + palaceRoleText + '，合住以后，两个人更容易真正靠近，也更愿意把生活和未来安排放到一起。';
        if (type === '冲') return '夫妻宫本身为' + palaceRoleText + '，被冲以后，原本能带来帮助和稳定的部分会被打乱，所以整体偏不利。';
        return '夫妻宫本身为' + palaceRoleText + '，出现这种作用后，原本比较顺的相处和配偶帮助会被干扰。';
      }
      if (palaceRoleText === '忌神') {
        if (type === '合') return '夫妻宫本身为忌神，合住以后更容易出现明明相处很累，却又舍不得彻底分开的情况。';
        if (type === '冲') return '夫妻宫本身为忌神，被冲以后，原来让你难受的相处方式可能被打破，但关系本身也会经历明显变化。';
        return '夫妻宫本身为忌神，这种作用会让争执、不信任或被对方压着的感觉更明显，不能因为宫位是忌神就把刑害克直接说成好事。';
      }
      return '夫妻宫喜忌不明显，所以这里只能确定关系会发生变化，不能单凭这一项判断最后一定变好或变坏。';
    }
    if (hasOriginalEvent(/六冲|冲/)) eventVerdicts.push(narrativeVerdict('感情容易出现明显变化', originalEventDirections(/六冲|冲/) + '。夫妻宫受冲，关系更容易突然改变，常见表现是争吵、分开住、聚少离多，或者其中一方重新考虑这段感情还要不要继续。' + originalRoleSuffix('冲'), ['PALACE_EVENT:CLASH', 'PALACE_ROLE:' + palaceRoleText]));
    if (hasOriginalEvent(/刑/)) eventVerdicts.push(narrativeVerdict('同一个问题容易反复争执', originalEventDirections(/刑/) + '。夫妻宫带刑，说明两个人容易较劲、互不服气；一个问题吵完看似过去，之后还可能因为类似的事情再次翻旧账。' + originalRoleSuffix('刑'), ['PALACE_EVENT:PUNISHMENT', 'PALACE_ROLE:' + palaceRoleText]));
    if (hasOriginalEvent(/六害|害/)) eventVerdicts.push(narrativeVerdict('不满容易憋在心里', originalEventDirections(/六害|害/) + '。夫妻宫受害，很多问题不一定当场吵出来，但心里的不满会慢慢积累，久了容易怀疑对方、不再完全信任对方。' + originalRoleSuffix('害'), ['PALACE_EVENT:HARM', 'PALACE_ROLE:' + palaceRoleText]));
    originalEvents.filter(function (row) { return /六合|三合局|半合|三会方|半会/.test(textOf(row && row.type)); }).forEach(function (row) {
      var type = textOf(row && row.type);
      var pair = list(row && row.elements).map(textOf).filter(function (value) { return /^[子丑寅卯辰巳午未申酉戌亥]{2,3}$/.test(value); })[0] || '';
      var canonicalPairs = { '午寅': '寅午', '戌寅': '寅戌', '戌午': '午戌', '卯亥': '亥卯', '未亥': '亥未', '未卯': '卯未', '子申': '申子', '辰申': '申辰', '辰子': '子辰', '酉巳': '巳酉', '丑巳': '巳丑', '丑酉': '酉丑' };
      pair = canonicalPairs[pair] || pair;
      var formedElement = list(row && row.elements).map(textOf).map(function (value) {
        var match = value.match(/(?:合|会)([木火土金水])/);
        return match && match[1];
      }).filter(Boolean)[0] || '';
      var formedRole = classifyElementRole(formedElement, facts && facts.core && facts.core.yongJi);
      var directionLabel = favorableRole(formedRole) ? '偏有利' : (formedRole === '忌神' ? '偏不利' : '中性');
      var directionText = textOf(row && row.source) + '与' + textOf(row && row.target) + '形成' + (pair || '') + type + (formedElement ? formedElement + '势' : '');
      var resultText = favorableRole(formedRole)
        ? formedElement + '在本命中为' + formedRole + '，所以这项组合对感情偏有利：两个人更愿意靠近，也更容易把生活、家庭和未来安排真正放到一起。'
        : formedRole === '忌神'
          ? formedElement + '在本命中为忌神，所以这项组合对感情偏不利：它会让你心里没底、内心反复琢磨，怀疑对方到底靠不靠谱、这段感情还能不能继续走下去；两个人也容易一阵亲近、一阵疏远，明明互相牵挂，却很难长期保持稳定。'
          : '所趋五行在本命中喜忌不明显，所以这里只能确定两个人的联系会变多，不能只靠这一项判断最后是好是坏。';
      var limitText = type === '半合' || type === '半会'
        ? '半合只表示气势趋向，并不等于已经完全合化，也不等同于暗合或隐秘关系。'
        : '是否真正成化仍以月令、透干和受制情况为准。';
      eventVerdicts.push(narrativeVerdict('夫妻宫' + type + (formedElement || '') + '·' + directionLabel, directionText + '。' + resultText + limitText, ['PALACE_EVENT:BRANCH_COMBINATION:' + type, 'FORMED_ELEMENT:' + (formedElement || 'unknown'), 'FORMED_ROLE:' + formedRole]));
    });
    var spouseCombineRows = originalEvents.filter(function (row) {
      if (!/天干五合/.test(textOf(row && row.type))) return false;
      var otherPillar = list(row && row.pillars).filter(function (pillar) { return pillar !== 'day'; })[0];
      var eventText = textOf(row);
      return list(spouseStar.occurrences).some(function (item) {
        return item && item.pillar === otherPillar && item.layer === '天干' && (!item.gan || eventText.indexOf(item.gan) >= 0);
      });
    });
    if (spouseCombineRows.length) {
      var spouseCombineDirections = spouseCombineRows.map(function (row) {
        return textOf(row && row.source) + '与' + textOf(row && row.target) + '五合';
      }).filter(function (row) { return row !== '与五合'; });
      var spouseLabel = relationship.gender === 'female' ? '正官或七杀夫星合身' : relationship.gender === 'male' ? '正财妻星合身' : '配偶星合身';
      var spouseRoleCopy = favorableRole(quality.elementRole)
        ? '配偶星在本命中为' + quality.elementRole + '，所以' + partnerLabel + '更容易真正进入你的生活，并在钱、资源、家庭或日常安排上帮到你。'
        : quality.elementRole === '忌神'
          ? '配偶星在本命中为忌神，所以' + partnerLabel + '会很深地参与到你的生活里，但你也更容易觉得感情占用了太多钱、精力或责任。'
          : '配偶星在本命中喜忌不明显，所以只能确定' + partnerLabel + '会比较直接地参与到你的现实生活中，不能只靠这一项断好坏。';
      eventVerdicts.push(narrativeVerdict(spouseLabel, spouseCombineDirections.join('、') + '。与日主相合的这个天干，正好也是本命的配偶星，所以才放进婚姻板块；这表示另一半会比较直接地进入你的钱、家庭和生活安排。' + spouseRoleCopy + '至于五合能不能真正化成另一种五行，还要看月令、透干和有没有受制。', ['PALACE_EVENT:SPOUSE_STAR_COMBINATION', 'SPOUSE_STAR_ROLE:' + (quality.elementRole || 'neutral')]));
    }
    var controlDirections = originalEvents.filter(function (row) { return /天干克|克/.test(textOf(row && row.type)); }).map(function (row) {
      return textOf(row && row.source) + '克' + textOf(row && row.target);
    }).filter(function (row) { return row !== '克'; });
    if (controlDirections.length) eventVerdicts.push(narrativeVerdict('两个人容易争谁说了算', controlDirections.join('、') + '。日柱参与天干相克，说明两个人在主导权、现实要求或责任分配上更容易正面顶起来；具体是谁压着谁，要按实际的生克方向判断。' + originalRoleSuffix('克'), ['PALACE_EVENT:STEM_CONTROL', 'PALACE_ROLE:' + palaceRoleText]));
    return {
      hideScore: true,
      headline: interactionTexts[interaction.direction] || textOf(interaction.conclusion),
      painPoint: marriageEffectText,
      paragraphs: [],
      verdicts: [
        narrativeVerdict('夫妻主导关系', interactionTexts[interaction.direction] || textOf(interaction.conclusion), ['DAY_PILLAR_INTERACTION:' + (interaction.direction || 'unknown')]),
        narrativeVerdict('配偶性格', personalityText, ['SPOUSE_PALACE:' + (palace.zhi || 'unknown'), 'PALACE_MAIN_ROLE:' + (mainHidden && mainHidden.role || 'unknown')]),
        narrativeVerdict('婚后作用', marriageEffectText, ['SPOUSE_STAR_ROLE:' + (quality.elementRole || 'neutral')]),
        narrativeVerdict('认识渠道', '缘分更容易出现在' + distanceCopy + '，属于现实接触中逐渐建立关系的类型。', ['SPOUSE_STAR_POSITION:' + firstPosition]),
        narrativeVerdict('年龄倾向', ageCopy, ['SPOUSE_AGE_POSITION:' + (relationship.age && relationship.age.tendency || 'unclear')]),
        narrativeVerdict('外形气质', appearanceText, ['SPOUSE_PALACE_APPEARANCE:' + (palace.zhi || 'unknown'), 'SPOUSE_STAR_ELEMENT:' + (spouseStar.element || 'unknown')]),
      ].concat(eventVerdicts),
      note: '以上内容依据传统子平法中的夫妻宫、配偶星、喜忌、透藏与生克关系推演，不等同于现实人物身份确认。',
    };
  }

  function annualNarrativeScore(year) {
    year = year || {};
    var points = 5;
    [year.stemRole, year.branchRole, year.daYunStemRole, year.daYunBranchRole].forEach(function (role) {
      if (role === '用神' || role === '喜神') points += 0.75;
      if (role === '忌神') points -= 0.75;
    });
    points += Math.min(2, list(year.reliefs).length) * 0.5;
    points -= Math.min(3, list(year.triggeredRisks).length) * 0.75;
    return clampNumber(Math.round(points), 1, 10);
  }

  function annualRelationshipActivationText(activation) {
    activation = activation || {};
    var sourceLabel = activation.source || '岁运';
    var relationLabel = activation.type || '关系';
    if (relationLabel === '六冲' && activation.direction === 'favorable') {
      return sourceLabel + activation.movingBranch + '冲夫妻宫' + activation.palaceBranch + '。夫妻宫本身为忌神，引动它的岁运支为' + activation.movingRole + '，所以原来让你觉得压抑、被管着或反复纠缠的相处方式，有机会在这段时间被打破，变化方向偏有利；但“冲”本身仍代表明显变化，可能先经历争吵、分开或重新决定关系，再看到改善。';
    }
    if (relationLabel === '六冲' && activation.direction === 'adverse') {
      return sourceLabel + activation.movingBranch + '冲夫妻宫' + activation.palaceBranch + '。夫妻宫本身为' + activation.palaceRole + '，原本能给你帮助、让关系稳定的部分被冲动，而引动它的岁运支为' + activation.movingRole + '，所以变化方向偏不利；两个人更容易争吵、分开住、聚少离多，或者重新考虑这段感情是否继续。';
    }
    if (relationLabel === '六冲') {
      return sourceLabel + activation.movingBranch + '冲夫妻宫' + activation.palaceBranch + '，说明感情或共同生活会发生明显变化；但夫妻宫和岁运没有形成明确喜忌，所以只能确定“会动”，不能直接断定最后一定变好或变坏。';
    }
    if (relationLabel === '六合') {
      return sourceLabel + activation.movingBranch + '合夫妻宫' + activation.palaceBranch + '，两个人的联系会变紧，感情更容易确定，也更容易把钱、家庭或生活安排绑在一起。' + (activation.direction === 'favorable' ? '宫位与岁运偏喜用，所以这种靠近更容易让关系稳定下来。' : activation.direction === 'adverse' ? '但这里带有忌神，所以也可能出现明明相处很累，却一直拖着、舍不得彻底分开的情况。' : '喜忌不明确，所以不能只凭这次相合判断最后是好是坏。');
    }
    if (relationLabel === '刑') {
      return sourceLabel + activation.movingBranch + '刑夫妻宫' + activation.palaceBranch + '，两个人更容易互不服气，同一个问题吵完以后还会再出现，也容易重新翻出以前没有解决的旧账。';
    }
    if (relationLabel === '六害') {
      return sourceLabel + activation.movingBranch + '害夫妻宫' + activation.palaceBranch + '，很多不满不一定当场说出来，但心里会慢慢积累；久了容易误会对方、怀疑对方，表面没大吵，关系却越来越冷。';
    }
    return sourceLabel + activation.movingBranch + '与夫妻宫' + activation.palaceBranch + '伏吟，以前在感情里反复出现的问题会再次被放大；夫妻宫为' + activation.palaceRole + '，原来相处得顺的部分会更明显，原来让你难受的问题也会更明显。';
  }

  function timingDirectionLabel(interactions) {
    var favorable = list(interactions).filter(function (row) { return row && row.direction === 'favorable'; }).length;
    var adverse = list(interactions).filter(function (row) { return row && row.direction === 'adverse'; }).length;
    if (favorable > adverse) return '偏有利';
    if (adverse > favorable) return '偏不利';
    return favorable || adverse ? '有利与压力并见' : '平稳延续';
  }

  function timingInteractionPriority(row) {
    if (!row) return 0;
    if (row.formationStatus === 'qualified') return 6;
    if (/六冲|刑|六害|天干相克/.test(row.type) && /day|month/.test(row.targetPillar || '')) return 5;
    if (/六合|三合|三会|半合|半会|天干五合/.test(row.type)) return 4;
    if (row.direction === 'favorable' || row.direction === 'adverse') return 3;
    return 1;
  }

  function timingInteractionOutcome(row) {
    row = row || {};
    var domains = list(row.domains);
    if (domains.indexOf('relationship') >= 0) {
      if (row.type === '六冲' && row.direction === 'favorable') return '原来让你压抑、被管着或反复纠缠的相处方式更容易被打破，关系有改善机会；但通常会先经历争吵、分开或重新决定关系。';
      if (row.type === '六冲') return '感情稳定基础被打乱，两个人更容易争吵、分开住、聚少离多，或者重新考虑这段关系。';
      if (row.type === '刑') return '两个人更容易互不服气，同一个问题反复争执，旧账也容易重新被翻出来。';
      if (row.type === '六害') return '不满更容易憋在心里，久了会出现误会、怀疑、不信任或表面不吵但逐渐冷淡。';
      if (/合|会/.test(row.type) && row.direction === 'favorable') return '两个人更容易靠近，关系确认、共同生活或未来安排会更容易稳定推进。';
      if (/合|会/.test(row.type) && row.direction === 'adverse') return '两个人的联系会变紧，但也更容易出现舍不得分开、相处又很累的拉扯，关系忽远忽近。';
    }
    if (domains.indexOf('wealth') >= 0) {
      if (row.direction === 'favorable' && row.type === '六冲') return '原来卡住收入或资产流动的部分被打破，进账、资金周转或资产调整更容易出现实质变化，但过程会先有波动。';
      if (row.direction === 'favorable') return '财富通路被有利力量引动，收入、项目回款或资产沉淀更容易出现实际进展。';
      if (row.direction === 'adverse') return '资金占用、责任支出或合作分配会放大，流水可能增加，但真正留下的钱反而容易减少。';
      return '收入、支出或资产安排会发生变化，但现有证据不足以确定最后增加还是减少。';
    }
    if (domains.indexOf('career') >= 0) {
      return row.direction === 'favorable'
        ? '岗位、职责、上级关系或项目节奏会出现有利变化，现实推进速度比平时更快。'
        : row.direction === 'adverse'
          ? '岗位、职责、上级关系或项目节奏更容易被打乱，工作中的摩擦和返工会增加。'
          : '岗位、职责或项目节奏会变化，但最后走向仍取决于其他同时出现的岁运关系。';
    }
    if (domains.indexOf('study') >= 0) {
      return row.direction === 'favorable'
        ? '学习、考试、资格认证或专业成果更容易兑现，原有优势能在这一年发挥出来。'
        : row.direction === 'adverse'
          ? '学习节奏更容易被压力、分心或输出不稳打断，成绩会低于真实能力。'
          : '学习和考试议题会被加强，但现有证据不足以确定成绩一定上升或下降。';
    }
    if (row.direction === 'favorable') return '这项岁运关系打通了原局中的有利部分，现实推进会比平时顺。';
    if (row.direction === 'adverse') return '这项岁运关系触动了原局中的不利部分，现实阻力和反复会增加。';
    return '这项岁运关系带来明显变化，但现有喜忌证据不足以直接判定最终好坏。';
  }

  function buildCurrentYearNarrative(facts) {
    var year = facts && facts.currentYear || {};
    var interactions = list(year.interactions).slice().sort(function (a, b) { return timingInteractionPriority(b) - timingInteractionPriority(a); });
    var directionLabel = timingDirectionLabel(interactions);
    var pillarText = textOf(year.pillar && year.pillar.gan) + textOf(year.pillar && year.pillar.zhi);
    var daYunText = year.daYun ? textOf(year.daYun.gan) + textOf(year.daYun.zhi) + '大运' : '未纳入大运';
    var headline = interactions.length
      ? (directionLabel === '偏有利' ? '本年被引动的有利关系更多，现实变化总体朝着改善和兑现发展。' : directionLabel === '偏不利' ? '本年被引动的不利关系更多，事业、资金或感情更容易出现明显波动。' : '本年有利与不利关系同时被引动，机会和压力会先后出现。')
      : '本年没有发现足以单独改变原局方向的强引动，现实表现以原有方向延续为主。';
    var verdicts = [narrativeVerdict('年度总体变化', '', ['ANNUAL_PILLAR:' + pillarText], {
      sourceText: '流年为' + (pillarText || '未定') + '，当前处于' + daYunText + '；按流年、大运与原局的实际关系判断。',
      outcomeText: headline,
    })];
    interactions.forEach(function (interaction) {
      verdicts.push(narrativeVerdict((interaction.source || '岁运') + '·' + (interaction.type || '关系'), '', ['ANNUAL_INTERACTION:' + (interaction.id || interaction.type)], {
        sourceText: textOf(interaction.sourceText), outcomeText: timingInteractionOutcome(interaction),
      }));
    });
    var relationshipActivations = list(year.relationship && year.relationship.activations);
    if (!interactions.some(function (row) { return list(row.domains).indexOf('relationship') >= 0; })) {
      relationshipActivations.forEach(function (activation) {
        verdicts.push(narrativeVerdict((activation.source || '岁运') + '感情·' + (activation.type || '关系'), annualRelationshipActivationText(activation), ['ANNUAL_PALACE:' + (activation.source || '岁运') + ':' + (activation.type || '关系')]));
      });
    }
    list(year.triggeredRisks).forEach(function (risk) {
      verdicts.push(narrativeVerdict('本年结构压力', '', ['ANNUAL_RISK:' + textOf(risk)], {
        sourceText: textOf(risk.why || risk.triggerHint || risk.type),
        outcomeText: '原局中的这个压力点在本年被触发，计划反复、关系摩擦、资金占用或精力负担会更明显。',
      }));
    });
    return {
      hideScore: true,
      headline: headline,
      painPoint: interactions.length ? interactions.map(timingInteractionOutcome)[0] : '没有强引动不等于没有事情发生，只表示主要结果更接近原有方向的延续。',
      paragraphs: [],
      verdicts: verdicts,
      note: '以上年度结论依据流年、大运、原局喜忌及实际刑冲克害合化推演；未被岁运触发的原局信息不会被写成本年事件。',
    };
  }

  function buildFiveYearNarrative(facts) {
    var fiveYear = facts && facts.fiveYear || {};
    var years = list(fiveYear.years).map(function (year) {
      var interactions = list(year && year.interactions).slice().sort(function (a, b) { return timingInteractionPriority(b) - timingInteractionPriority(a); });
      var directionLabel = timingDirectionLabel(interactions);
      var selected = interactions.slice(0, 2);
      var legacyRelationship = !selected.length ? list(year && year.relationship && year.relationship.activations) : [];
      var summary = selected.length
        ? selected.map(timingInteractionOutcome).join(' ')
        : legacyRelationship.length
          ? legacyRelationship.map(annualRelationshipActivationText).join(' ')
          : String(year && year.year || '') + '年没有发现足以改变原局方向的强引动，事业、资金和关系以原有方向延续为主。';
      return {
        year: year && year.year,
        pillar: textOf(year && year.pillar && year.pillar.gan) + textOf(year && year.pillar && year.pillar.zhi),
        daYunLabel: year && year.daYun ? textOf(year.daYun.gan) + textOf(year.daYun.zhi) + '大运' : '未纳入大运',
        directionLabel: directionLabel,
        sourceText: selected.map(function (row) { return textOf(row.sourceText); }).filter(Boolean).join(' '),
        summary: summary,
        priority: selected.length ? timingInteractionPriority(selected[0]) : 0,
      };
    });
    var strongest = years.slice().sort(function (a, b) { return b.priority - a.priority || a.year - b.year; })[0];
    var adverseYears = years.filter(function (row) { return row.directionLabel === '偏不利'; });
    var headline = strongest && strongest.priority
      ? strongest.year + '年变化最明显，具体方向以该年列出的刑冲克害合化结果为准。'
      : '未来五年没有出现足以单独改变原局方向的强引动，整体以原有方向延续为主。';
    return {
      hideScore: true,
      headline: headline,
      painPoint: adverseYears.length ? adverseYears.map(function (row) { return row.year; }).join('、') + '年出现的阻力最集中，相关领域更容易发生现实波动。' : '五年内没有集中出现偏不利的强关系，主要差别在于兑现速度。',
      paragraphs: [],
      verdicts: [narrativeVerdict('五年变化主线', '', ['FIVE_YEAR:INTERACTION_PRIORITY'], {
        sourceText: years.filter(function (row) { return row.sourceText; }).map(function (row) { return row.year + '年：' + row.sourceText; }).join(' '),
        outcomeText: headline,
      })],
      years: years.map(function (row) {
        var clean = Object.assign({}, row);
        delete clean.priority;
        return clean;
      }),
      note: '五年结论依据同一命盘在不同流年和大运下的实际刑冲克害合化推演，不等同于具体事件保证。',
    };
  }

  function buildNarratives(facts) {
    return {
      currentYear: buildCurrentYearNarrative(facts),
      relationship: buildRelationshipNarrative(facts),
      wealth: buildWealthNarrative(facts),
      study: buildStudyNarrative(facts),
      fiveYear: buildFiveYearNarrative(facts),
    };
  }

  function buildFacts(bazi, gender, options) {
    options = options || {};
    var host = typeof window !== 'undefined' ? window : globalThis;
    var deps = options.deps || {
      calculator: host.BaZiCalculator,
      structural: host.StructuralAnalysis,
      chain: host.BaZiChain,
    };
    if (!bazi || !deps.calculator) throw new Error('深度报告缺少有效命盘或计算器');

    var professional = deps.calculator.getProfessionalReportFacts(bazi, gender);
    var structural = deps.structural
      ? deps.structural.evaluate(bazi, deps.calculator)
      : { relationEvents: [], structuralRisks: [] };
    var chain = deps.chain
      ? deps.chain.analyze(bazi)
      : { adjustments: [], hints: [], ganChain: [], zhiChain: [] };
    var core = Object.freeze({
      strength: professional.strength,
      pattern: professional.pattern,
      yongJi: professional.yongJi,
      congGe: !!(professional.pattern && professional.pattern.congGe),
      actionChains: professional.actionChains || [],
      relationEvents: structural.relationEvents || [],
      structuralRisks: structural.structuralRisks || [],
      chain: chain,
    });
    var facts = {
      schemaVersion: SCHEMA_VERSION,
      anchorYear: Number(options.anchorYear),
      chartIdentity: [bazi.year, bazi.month, bazi.day, bazi.hour]
        .map(function (pillar) { return pillar.gan + pillar.zhi; })
        .join(' '),
      core: core,
      wealth: null,
      relationship: null,
      study: null,
      currentYear: null,
      fiveYear: null,
    };
    facts.relationship = buildRelationshipFacts(bazi, gender, core, deps.calculator);
    facts.wealth = buildWealthFacts(bazi, core, deps.calculator);
    facts.study = buildStudyFacts(bazi, core, deps.calculator);
    var timingCore = Object.assign({}, core, { wealth: facts.wealth });
    facts.fiveYear = buildFiveYearFacts(
      bazi, timingCore, deps.calculator, deps.chain, facts.anchorYear, gender
    );
    facts.currentYear = facts.fiveYear.years[0] || null;
    var narratives = buildNarratives(facts);
    if (facts.currentYear) facts.currentYear.narrative = narratives.currentYear;
    facts.relationship.narrative = narratives.relationship;
    facts.wealth.narrative = narratives.wealth;
    facts.study.narrative = narratives.study;
    facts.fiveYear.narrative = narratives.fiveYear;
    return facts;
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    buildFacts: buildFacts,
    buildNarratives: buildNarratives,
    buildWealthFacts: buildWealthFacts,
    buildRelationshipFacts: buildRelationshipFacts,
    buildStudyFacts: buildStudyFacts,
    deriveDayPillarInteraction: deriveDayPillarInteraction,
    buildAnnualFacts: buildAnnualFacts,
    buildFiveYearFacts: buildFiveYearFacts,
    findDaYunForYear: findDaYunForYear,
  };
  if (typeof module === 'object' && module.exports) {
    api.__test = {
      collectStemTimingRelation: collectStemTimingRelation,
      collectBranchTimingRelations: collectBranchTimingRelations,
      collectGroupTimingRelations: collectGroupTimingRelations,
      collectAnnualInteractions: collectAnnualInteractions,
      adjudicateTimingInteraction: adjudicateTimingInteraction,
      timingSourceText: timingSourceText,
      timingDomains: timingDomains,
    };
  }
  return api;
}));
