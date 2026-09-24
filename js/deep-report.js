(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeepReport = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SCHEMA_VERSION = '2.1.0';

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
  var WEALTH_DIRECTIONS = {
    '木': ['东方', '东南'], '火': ['南方'], '土': ['本地', '中央区域'],
    '金': ['西方', '西北'], '水': ['北方'],
  };

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

  function studyPatternPending(core) {
    var pattern = core && core.pattern || {};
    return textOf(pattern.status || pattern.state || pattern.result) === '条件待定';
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
    } else if (studyPatternPending(core)) {
      rows.push('格局条件待定，暂不按成格或破格强路径下结论，需结合实际十神与现实反馈验证。');
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
    if (!studyPatternEffective(core) && !studyPatternPending(core) && /破格|未成|不成|失效|无效/.test(textOf(core && core.pattern && (core.pattern.status || core.pattern.state || core.pattern.result)))) {
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
    var publicBand = publicStudyBand(rank);
    return {
      key: 'L' + rank,
      label: publicBand.label,
      rank: rank,
      publicKey: publicBand.key,
      publicLabel: publicBand.label,
      outcomeText: studyLevelText(rank),
      basis: ['STUDY_BAND:L' + rank],
    };
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

  function wealthGatheringRelations(core, wealthElement) {
    var combineTypes = ['六合', '半合', '三合', '半会', '三会'];
    var relations = list(core && core.relationEvents);
    return relations.filter(function (row) {
      if (!row || combineTypes.indexOf(row.type) < 0) return false;
      var elementText = list(row.elements).join('');
      if (!(new RegExp('[化合会]' + wealthElement)).test(elementText)) return false;
      var pillars = list(row.pillars);
      return !relations.some(function (other) {
        if (!other || other === row || combineTypes.indexOf(other.type) < 0) return false;
        var overlap = pillars.some(function (pillar) { return list(other.pillars).indexOf(pillar) >= 0; });
        if (!overlap) return false;
        var otherText = list(other.elements).join('');
        return /[化合会][木火土金水]/.test(otherText) && !(new RegExp('[化合会]' + wealthElement)).test(otherText);
      });
    });
  }

  function wealthPathFinalElement(type, wealthElement) {
    var wealthIndex = ELEMENT_CYCLE.indexOf(wealthElement);
    if (wealthIndex < 0) return wealthElement;
    if (type === '财生官') return ELEMENT_CYCLE[(wealthIndex + 1) % ELEMENT_CYCLE.length];
    if (type === '财官印连续流通' || type === '财配印') return ELEMENT_CYCLE[(wealthIndex + 2) % ELEMENT_CYCLE.length];
    return wealthElement;
  }

  function applyWealthPathEffects(rows, core, wealthElement) {
    return list(rows).map(function (row) {
      if (!row || !row.type) return row;
      if (row.positive !== true) return Object.assign({}, row, { positive: false, effect: 'adverse', scalePotential: false });
      var finalElement = wealthPathFinalElement(row.type, wealthElement);
      var finalRole = classifyElementRole(finalElement, core && core.yongJi);
      var effect = finalRole === '忌神' ? 'adverse' : favorableRole(finalRole) ? 'favorable' : 'mixed';
      return Object.assign({}, row, {
        positive: effect !== 'adverse',
        effect: effect,
        finalElement: finalElement,
        finalElementRole: finalRole,
        scalePotential: true,
      });
    });
  }

  function buildWealthPathways(core, bazi, calculator, wealthOccurrences, wealthElement) {
    var chains = list(core && core.actionChains);
    var relations = list(core && core.relationEvents);
    var risks = list(core && core.structuralRisks);
    var rows = [];
    var definitions = [
      { type: '比劫生食伤生财', positive: true, pattern: /^(?:比肩|劫财|比劫)\s*(?:生|→|->)\s*(?:食神|伤官|食伤)\s*(?:生|→|->)\s*财(?:星)?$/, conclusion: '已有比劫、食伤到财星的完整链路证据，可观察协作、产出向资源的转化条件。' },
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
        positive: definition.positive === true,
        conclusion: definition.conclusion,
        confidence: matched.length ? 'strong' : 'medium',
        evidence: matched.concat(riskMatched).map(textOf).filter(Boolean),
      });
    });
    var outputOccurrences = bazi && calculator ? collectTenGodOccurrences(bazi, calculator, function (role) {
      return role === '食神' || role === '伤官';
    }) : [];
    var exposedOutput = outputOccurrences.filter(function (item) { return item.layer === '天干'; });
    var hiddenOutput = outputOccurrences.filter(function (item) { return item.layer !== '天干'; });
    var exposedWealth = list(wealthOccurrences).filter(function (item) { return item.layer === '天干'; });
    var rootedWealth = list(wealthOccurrences).filter(function (item) { return item.layer !== '天干'; });
    var outputElement = outputOccurrences[0] && outputOccurrences[0].element;
    var monthElement = branchElement(bazi && bazi.month && bazi.month.zhi, calculator);
    var monthCommandOutput = outputOccurrences.filter(function (item) {
      return item.pillar === 'month' && item.layer === '本气';
    })[0];
    var wealthGathering = wealthGatheringRelations(core, wealthElement);
    var strongOutput = exposedOutput.length > 0 && (hiddenOutput.length > 0 || monthElement === outputElement);
    var outputFeedsWealth = outputElement && wealthElement && elementRelation(outputElement, wealthElement) === 'generates';
    if (strongOutput && outputFeedsWealth && exposedWealth.length && rootedWealth.length && !rows.some(function (row) {
      return row.type === '食伤生财' && row.positive === true;
    })) {
      rows.unshift({
        type: '食伤生财',
        positive: true,
        conclusion: '食伤透出且有根气或得月令支持，财星同时透干有根，形成产出直接转化为财富的完整路径。',
        confidence: 'strong',
        evidence: [
          '食伤透干：' + exposedOutput.map(function (item) { return item.gan + item.pillarLabel; }).join('、'),
          '食伤有力：' + (monthElement === outputElement ? '月支同为' + outputElement : hiddenOutput.map(function (item) { return item.gan + item.pillarLabel + item.layer; }).join('、')),
          '财星透干有根：' + exposedWealth.map(function (item) { return item.gan + item.pillarLabel; }).join('、') + '；' + rootedWealth.map(function (item) { return item.gan + item.pillarLabel + item.layer; }).join('、'),
        ],
        inferredFromChart: true,
      });
    }
    if (monthCommandOutput && rootedWealth.length >= 2 &&
      elementRelation(monthCommandOutput.element, wealthElement) === 'generates' && wealthGathering.length &&
      !rows.some(function (row) { return row.type === '食伤生财'; })) {
      rows.unshift({
        type: '食伤生财',
        positive: true,
        conclusion: '月令食伤当令，财星虽未透干但根气集中，合会又把力量引向财星，形成由产出转成财富的完整路径。',
        confidence: 'strong',
        evidence: [
          '月令食伤：' + monthCommandOutput.gan + monthCommandOutput.role + '居' + (bazi.month && bazi.month.zhi),
          '财星有' + rootedWealth.length + '处根气：' + rootedWealth.map(function (item) { return item.gan + item.pillarLabel + item.layer; }).join('、'),
        ].concat(wealthGathering.map(function (row) { return textOf(row); })),
        inferredFromChart: true,
        inferenceMode: 'month-command-hidden-wealth',
      });
    }
    if (wealthGathering.length && !rows.some(function (row) { return row.type === '合会引财'; })) {
      rows.push({
        type: '合会引财',
        positive: true,
        conclusion: '原局的合会关系把力量引向财星，财富机会和资金规模容易被集中放大。',
        confidence: 'medium',
        evidence: wealthGathering.map(function (row) { return textOf(row); }),
        inferredFromChart: true,
      });
    }
    return applyWealthPathEffects(rows, core, wealthElement);
  }

  function uniqueElements(values) {
    return list(values).filter(function (value, index, rows) {
      return typeof value === 'string' && ELEMENT_CYCLE.indexOf(value) >= 0 && rows.indexOf(value) === index;
    });
  }

  function wealthPathElements(pathways, wealthElement) {
    var wealthIndex = ELEMENT_CYCLE.indexOf(wealthElement);
    if (wealthIndex < 0) return [];
    var dayElement = ELEMENT_CYCLE[(wealthIndex + ELEMENT_CYCLE.length - 2) % ELEMENT_CYCLE.length];
    var outputElement = ELEMENT_CYCLE[(wealthIndex + ELEMENT_CYCLE.length - 1) % ELEMENT_CYCLE.length];
    var officerElement = ELEMENT_CYCLE[(wealthIndex + 1) % ELEMENT_CYCLE.length];
    var resourceElement = ELEMENT_CYCLE[(wealthIndex + 2) % ELEMENT_CYCLE.length];
    var supportedTypes = {
      '比劫生食伤生财': [dayElement, outputElement, wealthElement],
      '食伤生财': [outputElement, wealthElement],
      '财生官': [wealthElement, officerElement],
      '财官印连续流通': [wealthElement, officerElement, resourceElement],
      '财配印': [wealthElement, resourceElement],
    };
    return uniqueElements(list(pathways).reduce(function (all, pathway) {
      if (!pathway || typeof pathway !== 'object') return all;
      var elements = supportedTypes[pathway.type];
      if (!elements) return all;
      return all.concat(elements, uniqueElements(pathway.elements));
    }, []));
  }

  function deriveWealthDirection(input) {
    input = input || {};
    var yong = uniqueElements(input.yongJi && input.yongJi.yongShen);
    var xi = uniqueElements(input.yongJi && input.yongJi.xiShen);
    var ji = uniqueElements(input.yongJi && input.yongJi.jiShen);
    var primary = yong.filter(function (element) { return ji.indexOf(element) < 0; });
    var secondary = xi.filter(function (element) {
      return ji.indexOf(element) < 0 && primary.indexOf(element) < 0;
    });
    var ranked = primary.concat(secondary);
    if (!ranked.length) return { element: '', elements: [], primary: [], secondary: [], directions: [], confidence: 'limited', conflict: true };
    return {
      element: ranked[0],
      elements: ranked,
      primary: primary,
      secondary: secondary,
      directions: ranked.reduce(function (rows, element) {
        return rows.concat((WEALTH_DIRECTIONS[element] || []).filter(function (direction) { return rows.indexOf(direction) < 0; }));
      }, []),
      confidence: 'strong',
      conflict: false,
    };
  }

  function buildPartialWealthFact(occurrences) {
    var partial = list(occurrences).filter(function (item) { return item && item.role === '偏财'; });
    var exposed = partial.filter(function (item) { return item.layer === '天干'; });
    var hidden = partial.filter(function (item) { return item.layer !== '天干'; });
    return {
      strong: exposed.length >= 2,
      exposedCount: exposed.length,
      hiddenCount: hidden.length,
      evidence: exposed.map(function (item) {
        return item.pillarLabel + item.layer + item.gan + item.role;
      }),
    };
  }

  function storageNarrativeContribution(row, capacity) {
    row = row || {};
    var disposition = storageRoleDisposition(row);
    var useful = disposition === 'useful';
    var adverse = disposition === 'adverse' || disposition === 'adverse-hidden';
    var active = row.activated === true;
    var connected = row.wealthConnection === true;
    var pressure = capacity && capacity.state === '承压';
    var hidden = list(row.hiddenRoles).map(function (item) {
      return item && item.role ? item.role + '为' + (item.elementRole || '中性') : '';
    }).filter(Boolean);
    var hiddenRoleNames = list(row.hiddenRoles).map(function (item) { return item && item.role; }).filter(Boolean);
    var basis = (row.pillarLabel || '') + (row.zhi || '') + '为' + (row.storageRole || '十神库') +
      '，对应' + (row.elementRole || '中性') + (hidden.length ? '，库中见' + hidden.join('、') : '') +
      (active ? '，已见引动' : '，尚未见引动') +
      (connected ? '，并已接入财富路径' : '，尚未接入明确财富路径') +
      (row.outcome ? '。' + row.outcome : '。');
    var result = { basis: basis, source: '', retention: '' };
    if (!active) return result;
    if (row.storageRoleKey === 'peer') {
      if (useful) result.source = '钱更容易从熟人介绍、朋友牵线、同事合作或一起做项目中来；有人把客户和机会带进来，你再把事情做成。';
      else if (adverse) result.retention = '合作越多，越容易出现谁做得多、谁拿得多的问题，钱进来后要经过分配才会到自己手里。';
    } else if (row.storageRoleKey === 'resource') {
      if (useful) result.source = '钱更容易靠学会一门真本事、拿到别人认可的资格，或者凭过去做出的成绩和口碑挣到；别人先相信你，才愿意把工作和钱交给你。';
      else if (adverse) result.retention = '容易把钱和时间持续花在准备、学习或依赖平台上，短期不一定马上变成进账。';
    } else if (row.storageRoleKey === 'output') {
      if (useful) result.source = '钱更容易靠手艺、技术、做产品、讲清楚一件事或按时把项目交出来挣到；做出的东西越能直接解决问题，收入越容易跟着上来。';
      else if (adverse) result.retention = '想做的项目容易铺得太开，花了时间和钱，真正收款的项目反而不多。';
    } else if (row.storageRoleKey === 'wealth') {
      if (useful && connected && !pressure) result.retention = '钱进来以后，有机会变成存款、资产或能持续带来回款的长期项目。';
      else if (adverse) result.retention = '财库被触动时，先要面对垫资、债务、家庭责任或项目规模变大的问题，不能把它直接当成存钱信号。';
      else result.retention = '财库被触动只说明资金和资产议题会变多；没有接上明确赚钱路径前，不能断定钱会留下。';
    } else if (row.storageRoleKey === 'officer') {
      if (useful || disposition === 'mixed') {
        result.source = '钱更容易从有规矩、有层级的单位或长期项目里来：接下更重要的事、职位往上走、带团队、管项目，或者对接重要客户，把手里的责任和决定权变成收入。';
        if (hiddenRoleNames.some(function (role) { return /印/.test(role); })) result.source += '别人愿意把重要的事交给你，往往还因为你做事稳、经验够，或者过去的成绩让人放心。';
        if (hiddenRoleNames.some(function (role) { return /比肩|劫财/.test(role); })) result.source += '这笔钱通常不是一个人闷头挣来，而是要跟同事、朋友或团队一起把事情做大。';
        if (disposition === 'mixed' && list(row.hiddenRoles).some(function (item) { return item && item.elementRole === '忌神' && /比肩|劫财/.test(item.role); })) result.source += '但一起做大的钱还要经过分配，事情和责任可能主要由你扛，最后真正到手的会比账面收入少。';
        if (disposition === 'mixed' && list(row.hiddenRoles).some(function (item) { return item && item.elementRole === '忌神' && /印/.test(item.role); })) result.source += '同时也容易先把时间和钱花在学习、准备或证明自己上，职位和收入不会完全同步增加。';
      }
      else if (adverse) result.retention = '职位和责任一上来，时间、规则和要承担的事情都会变多，收入未必能同步留下。';
    }
    return result;
  }

  function buildWealthRetention(core, wealthElement, pathways, bazi, calculator) {
    var risks = list(core && core.structuralRisks);
    var events = list(core && core.relationEvents);
    var chains = list(core && core.actionChains);
    var source = risks.concat(events, chains);
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
    list(pathways).filter(function (pathway) {
      return pathway && pathway.effect === 'adverse' && (pathway.type === '财生官' || pathway.type === '财官印连续流通');
    }).forEach(function (pathway) {
      if (rows.some(function (row) { return row.type === '财生官压身'; })) return;
      rows.push({
        type: '财生官压身',
        conclusion: '财星继续生助忌神官杀，收入机会会同时放大责任、成本与现实压力。',
        evidence: list(pathway.evidence),
      });
    });
    var peerOccurrences = bazi && calculator ? collectTenGodOccurrences(bazi, calculator, function (role) {
      return role === '比肩' || role === '劫财';
    }) : [];
    var exposedPeers = peerOccurrences.filter(function (item) {
      return item.layer === '天干' && item.pillar !== 'day';
    });
    var exposedWealth = bazi && calculator ? collectTenGodOccurrences(bazi, calculator, function (role) {
      return role === '正财' || role === '偏财';
    }).filter(function (item) { return item.layer === '天干'; }) : [];
    if (exposedPeers.length >= 2 && exposedWealth.length && !rows.some(function (row) { return row.type === '比劫分流'; })) {
      rows.push({
        type: '比劫分流',
        conclusion: '多个比劫同时围绕透出的财星，挣钱规模可以做大，但合作分利和同行竞争会降低最终留存。',
        evidence: [exposedPeers.map(function (item) { return item.gan + item.pillarLabel; }).join('、') + '并见' + exposedWealth.map(function (item) { return item.gan + item.pillarLabel; }).join('、')],
      });
    }
    var role = classifyElementRole(wealthElement, core && core.yongJi);
    return {
      state: rows.length ? '需管理' : '待观察',
      conclusion: rows.length ? '留存与风险需分开观察，当前已有结构证据提示管理重点。' : '未见明确留存风险证据，仍需结合实际路径和岁运条件观察。',
      elementRole: role,
      risks: rows,
      evidence: rows.reduce(function (all, row) { return all.concat(row.evidence); }, []),
    };
  }

  function storageActivationEvidence(zhi, bazi, core) {
    var paired = STORAGE_CLASH[zhi];
    var texts = list(core && core.relationEvents).concat(list(core && core.actionChains));
    var direct = texts.filter(function (item) {
      var text = textOf(item);
      return text.indexOf(zhi) >= 0 && (text.indexOf('冲') >= 0 || text.indexOf('刑') >= 0 || text.indexOf('合') >= 0);
    });
    if (direct.length) return direct;
    if (!paired || !bazi) return [];
    var hasPairedBranch = PILLARS.some(function (pillarName) {
      return bazi[pillarName] && bazi[pillarName].zhi === paired;
    });
    if (!hasPairedBranch) return [];
    return texts.filter(function (item) {
      var text = textOf(item);
      return text.indexOf(paired) >= 0 && (text.indexOf('冲') >= 0 || text.indexOf('刑') >= 0 || text.indexOf('合') >= 0);
    });
  }

  function storageRoleKey(dayElement, storedElement) {
    var relation = elementRelation(dayElement, storedElement);
    return ({ same: 'peer', generatedBy: 'resource', generates: 'output', controls: 'wealth', controlledBy: 'officer' })[relation] || 'neutral';
  }

  function storageRoleLabel(key) {
    return ({ peer: '比劫库', resource: '印库', output: '食伤库', wealth: '财库', officer: '官杀库' })[key] || '十神库';
  }

  function structuredWealthPathTypes(paths) {
    paths = list(paths);
    return paths.filter(function (path) {
      return path && typeof path === 'object' && typeof path.type === 'string';
    }).map(function (path) {
      return path.type;
    });
  }

  function storageHasWealthConnection(key, paths) {
    var pathTypes = structuredWealthPathTypes(paths);
    var directWealthPaths = ['食伤生财', '财生官', '财官印连续流通', '财配印'];
    if (key === 'wealth') return pathTypes.some(function (type) { return directWealthPaths.indexOf(type) >= 0; });
    if (key === 'output') return pathTypes.indexOf('食伤生财') >= 0;
    if (key === 'resource') return pathTypes.indexOf('财配印') >= 0 || pathTypes.indexOf('财官印连续流通') >= 0;
    if (key === 'officer') return pathTypes.indexOf('财生官') >= 0 || pathTypes.indexOf('财官印连续流通') >= 0;
    if (key === 'peer') {
      return pathTypes.indexOf('比劫生食伤生财') >= 0 ||
        (pathTypes.indexOf('比劫生食伤') >= 0 && pathTypes.indexOf('食伤生财') >= 0);
    }
    return false;
  }

  function storageRoleDisposition(row) {
    row = row || {};
    var hiddenRoles = list(row.hiddenRoles).map(function (item) { return item && item.elementRole; });
    var fixedUseful = favorableRole(row.elementRole);
    var fixedAdverse = row.elementRole === '忌神';
    var hasUseful = fixedUseful || hiddenRoles.some(favorableRole);
    var hasAdverse = fixedAdverse || hiddenRoles.indexOf('忌神') >= 0;
    if (hasUseful && hasAdverse) return 'mixed';
    if (hasAdverse) return fixedAdverse ? 'adverse' : 'adverse-hidden';
    if (hasUseful) return fixedUseful ? 'useful' : 'supportive-hidden';
    return 'neutral';
  }

  function storageOutcome(row) {
    row = row || {};
    var key = row.storageRoleKey || 'neutral';
    var disposition = storageRoleDisposition(row);
    var useful = disposition === 'useful';
    var inactive = {
      peer: '比劫库尚未见引动证据，协作与伙伴条件仍以潜在变化观察。',
      resource: '印库尚未见引动证据，学习、资质或支持条件仍以潜在变化观察。',
      output: '食伤库尚未见引动证据，技能、表达或交付条件仍以潜在变化观察。',
      wealth: '财库尚未见引动证据，资金或资产议题仍以潜在变化观察。',
      officer: '官杀库尚未见引动证据，责任、规则或组织位置仍以潜在变化观察。',
    };
    var adverse = {
      peer: '比劫库被引动，但对应元素为' + (row.elementRole || '平神') + '，竞争或伙伴分配压力需要结合实际观察。',
      resource: '印库被引动，但对应元素为' + (row.elementRole || '平神') + '，学习、资质或支持条件可能形成牵制。',
      output: '食伤库被引动，但对应元素为' + (row.elementRole || '平神') + '，技能、表达或交付环节可能形成压力。',
      wealth: '财库被引动，但对应元素为' + (row.elementRole || '平神') + '，资金或资产议题可能伴随压力。',
      officer: '官杀库被引动，但对应元素为' + (row.elementRole || '平神') + '，责任、规则或组织位置可能形成压力。',
    };
    var neutral = {
      peer: '比劫库被引动，但固定库性与库中藏干整体没有明确喜忌，只说明合作、伙伴与分配议题会变多，不能直接断定有利或不利。',
      resource: '印库被引动，但固定库性与库中藏干整体没有明确喜忌，只说明学习、资质与支持条件会变多，不能直接断定有利或不利。',
      output: '食伤库被引动，但固定库性与库中藏干整体没有明确喜忌，只说明技能、表达与交付活动会变多，不能直接断定有利或不利。',
      wealth: '财库被引动，但固定库性与库中藏干整体没有明确喜忌，只说明资金与资产事项会变多，不能直接断定钱会增加或留下。',
      officer: '官杀库被引动，但固定库性与库中藏干整体没有明确喜忌，只说明责任、规则与组织事项会变多，不能直接断定职位或收入变化。',
    };
    if (!row.activated) return inactive[key] || '库支尚未见引动证据，当前以潜在条件观察。';
    if (disposition === 'adverse' || disposition === 'adverse-hidden') {
      return adverse[key] || '库支被引动，固定库性或库中藏干见忌神，暂不直接视为利好。';
    }
    if (!useful) {
      var hiddenNote = disposition === 'supportive-hidden'
        ? '库中虽有喜用藏干，但固定库性仍为中性。'
        : disposition === 'mixed'
          ? mixedStorageRoleNote(row)
          : '';
      return hiddenNote + (neutral[key] || '库支被引动，但整体喜忌不明确，只说明相关事项会变多，不能直接判断好坏。');
    }
    if (key === 'wealth') {
      return row.wealthConnection
        ? '财库被引动，资金或资产议题已接入明确财富路径，可观察收入转化与留存条件。'
        : '财库被引动，资金或资产议题更容易显现，但尚未见其接入明确财富路径。';
    }
    if (key === 'peer') {
      return row.wealthConnection
        ? '比劫库被引动，团队、伙伴或圈层的协作可通过既有路径放大资源转化。'
        : '比劫库被引动，团队、伙伴或圈层的协作条件更活跃，但尚未见通向财富的完整路径。';
    }
    if (key === 'output') {
      return row.wealthConnection
        ? '食伤库被引动，技能、表达或交付已接入财富路径，可观察产出转化。'
        : '食伤库被引动，技能、表达或交付条件更活跃，但尚未见其接入财富路径。';
    }
    if (key === 'resource') {
      return row.wealthConnection
        ? '印库被引动，学习、资质或支持系统已与财富路径相连，可观察其转化条件。'
        : '印库被引动，学习、资质或支持系统更活跃，但尚未见其接入财富路径。';
    }
    if (key === 'officer') {
      return row.wealthConnection
        ? '官杀库被引动，责任、规则或组织位置已与财富路径相连，可观察其转化条件。'
        : '官杀库被引动，责任、规则或组织位置更活跃，但尚未见其接入财富路径。';
    }
    return '库支被引动，但十神归类尚未确定，暂以条件变化观察。';
  }

  function mixedStorageRoleNote(row) {
    row = row || {};
    var hiddenRoles = list(row.hiddenRoles).map(function (item) { return item && item.elementRole; }).filter(Boolean);
    var hiddenUseful = hiddenRoles.find(favorableRole);
    var hiddenAdverse = hiddenRoles.indexOf('忌神') >= 0;
    if (favorableRole(row.elementRole) && hiddenAdverse) {
      return '固定库性为' + row.elementRole + '，但藏干含忌神。';
    }
    if (row.elementRole === '忌神' && hiddenUseful) {
      return '固定库性为忌神，但藏干含' + hiddenUseful + '。';
    }
    if (!favorableRole(row.elementRole) && row.elementRole !== '忌神' && hiddenUseful && hiddenAdverse) {
      return '固定库性为' + (row.elementRole || '中性') + '，藏干同时含喜用与忌神。';
    }
    return '固定库性与藏干的喜忌证据相反。';
  }

  function buildWealthStorage(bazi, core, wealthElement, calculator, wealthPaths) {
    var candidates = [];
    var storages = [];
    var dayElement = ((calculator && calculator.WU_XING) || {})[bazi && bazi.day && bazi.day.gan] || '';
    PILLARS.forEach(function (pillarName) {
      var pillar = bazi && bazi[pillarName];
      if (!pillar || !STORAGE_ELEMENTS[pillar.zhi]) return;
      var fixedElement = STORAGE_ELEMENTS[pillar.zhi];
      var hiddenRoles = getHiddenStems(pillar, calculator).map(function (gan, index) {
        var element = (calculator.WU_XING || {})[gan] || '';
        return {
          gan: gan,
          layer: index === 0 ? '本气' : (index === 1 ? '中气' : '余气'),
          element: element,
          role: getStemRole(bazi.day.gan, gan, calculator),
          elementRole: classifyElementRole(element, core && core.yongJi),
        };
      });
      var roleKey = storageRoleKey(dayElement, fixedElement);
      var activationEvidence = storageActivationEvidence(pillar.zhi, bazi, core);
      var activated = activationEvidence.length > 0;
      var wealthConnection = storageHasWealthConnection(roleKey, wealthPaths);
      var row = {
        pillar: pillarName,
        pillarLabel: PILLAR_LABELS[pillarName],
        zhi: pillar.zhi,
        fixedElement: fixedElement,
        storageRole: storageRoleLabel(roleKey),
        storageRoleKey: roleKey,
        elementRole: classifyElementRole(fixedElement, core && core.yongJi),
        activated: activated,
        hiddenRoles: hiddenRoles,
        wealthConnection: wealthConnection,
        outcomeKey: roleKey + '-' + (activated ? 'activated' : 'inactive') + '-' + (wealthConnection ? 'connected' : 'disconnected'),
        activationEvidence: activationEvidence,
      };
      row.outcome = storageOutcome(row);
      storages.push(row);
      var hidden = hiddenRoles.filter(function (item) { return item.element === wealthElement; }).map(function (item) {
        return { gan: item.gan, layer: item.layer, element: item.element };
      });
      if (hidden.length) candidates.push({
        pillar: pillarName,
        pillarLabel: PILLAR_LABELS[pillarName],
        zhi: pillar.zhi,
        storedElement: fixedElement,
        hidden: hidden,
        activated: activated,
      });
    });
    var activated = candidates.filter(function (item) { return item.activated; });
    var evidenceRows = activated.reduce(function (all, item) {
      return all.concat(item.hidden.map(function (hidden) {
        return item.pillarLabel + item.zhi + '藏' + hidden.gan + '（' + hidden.layer + '）为财星，相关库气受到引动。';
      }));
    }, []);
    if (!candidates.length) {
      return { present: false, activated: false, confidence: 'limited', conclusion: '未发现库支中真实藏有对应财星，不能仅以库支出现判定财库。', candidates: [], storages: storages, evidence: [] };
    }
    if (!activated.length) {
      return { present: false, activated: false, confidence: 'limited', conclusion: '发现库支中真实藏有财星，但尚未见相关冲、刑、合或岁运引动证据。', candidates: candidates, storages: storages, evidence: candidates.map(function (item) { return item.pillarLabel + item.zhi + '藏有财星'; }) };
    }
    return {
      present: true,
      activated: true,
      confidence: 'medium',
      conclusion: evidenceRows.join('') + '这只表示藏干或库气被触动，是否形成实际资源仍需结合透干、月令、喜忌和承载条件。',
      candidates: candidates,
      storages: storages,
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
    var pathways = buildWealthPathways(core, bazi, calculator, occurrences, wealthWx);
    var pathElements = wealthPathElements(pathways, wealthWx);
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
      yongJi: core.yongJi || {},
      pathElements: pathElements,
      direction: deriveWealthDirection({ yongJi: core.yongJi, pathElements: pathElements }),
      occurrences: occurrences,
      partialWealth: buildPartialWealthFact(occurrences),
      resource: buildResourceQuality(occurrences, bazi, core, calculator, wealthWx),
      capacity: capacity,
      pathways: pathways,
      retention: buildWealthRetention(core, wealthWx, pathways, bazi, calculator),
      storage: buildWealthStorage(bazi, core, wealthWx, calculator, pathways),
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
    if (typeof year !== 'number' || !Number.isFinite(year) || !Number.isInteger(year)) return null;
    var target = year;
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

  function resolveAnnualDynamic(bazi, daYun, pillar, core, calculator, chain, timingOptions) {
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
        return chain.analyzeLiuNian(
          bazi, daYun, pillar, core && core.yongJi, timingOptions || {}
        ) || { triggers: [], reliefs: [] };
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
    if (birthDate.clock === null || birthDate.clock === undefined || birthDate.clock === '') return false;
    if (typeof birthDate.clock === 'string' && !/^\d{1,2}$/.test(birthDate.clock)) return false;
    var year = Number(birthDate.year);
    var month = Number(birthDate.month);
    var day = Number(birthDate.day);
    var hour = Number(birthDate.hour);
    var clock = Number(birthDate.clock);
    if (![year, month, day, hour, clock].every(Number.isFinite)) return false;
    if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12) return false;
    if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(hour) || hour < 0 || hour > 11) return false;
    if (!Number.isInteger(clock) || clock < 0 || clock > 23) return false;
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
    if (/三合|半合|三会|半会/.test(row.type)) {
      var branches = (row.participants || [row.actor, row.target]).filter(function (branch, index, values) {
        return branch && values.indexOf(branch) === index;
      });
      return row.actor + '引动原局' + targetLabel + '，' + branches.join('') + row.type;
    }
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

  function buildAnnualFacts(bazi, core, calculator, chain, year, activeDaYun, timingStatus, timingOptions) {
    var pillar = annualPillarForYear(calculator, year, activeDaYun, bazi && bazi.day && bazi.day.gan);
    var annualOptions = Object.assign({}, timingOptions || {});
    if (bazi && bazi.birthDate && Number.isFinite(Number(bazi.birthDate.year))) {
      annualOptions.birthYear = Number(bazi.birthDate.year);
      annualOptions.age = Number(year) - Number(bazi.birthDate.year);
    }
    var dynamic = resolveAnnualDynamic(bazi, activeDaYun, pillar, core || {}, calculator, chain, annualOptions);
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
      daYunStatus: timingStatus || (activeDaYun ? 'active' : 'unknown_birth'),
      stemRole: classifyElementRole(stemElement, core && core.yongJi),
      branchRole: classifyElementRole(branchElement, core && core.yongJi),
      daYunStemRole: activeDaYun
        ? classifyElementRole(calculator && calculator.WU_XING && calculator.WU_XING[activeDaYun.gan], core && core.yongJi)
        : '未纳入',
      daYunBranchRole: activeDaYun
        ? classifyElementRole(calculator && calculator.DI_ZHI_WU_XING && calculator.DI_ZHI_WU_XING[activeDaYun.zhi], core && core.yongJi)
        : '未纳入',
      tenGod: tenGod,
      dynamic: dynamic,
      eventAdjudication: dynamic && dynamic.eventAdjudication || null,
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
      years.push(buildAnnualFacts(bazi, core, calculator, chain, year, null, 'unknown_birth'));
    }
    return {
      anchorYear: Number(anchorYear),
      hasDaYun: false,
      timingStatus: 'unknown_birth',
      limitation: '未确认出生时间，当前大运与起运年龄未纳入。',
      years: years,
      transitions: [],
      trend: compareAnnualFacts(years),
    };
  }

  function buildUnavailableFiveYearFacts(bazi, core, calculator, chain, anchorYear) {
    var years = [];
    for (var year = Number(anchorYear); year < Number(anchorYear) + 5; year += 1) {
      years.push(buildAnnualFacts(bazi, core, calculator, chain, year, null, 'calculation_unavailable'));
    }
    return {
      anchorYear: Number(anchorYear),
      hasDaYun: false,
      timingStatus: 'calculation_unavailable',
      limitation: '出生信息完整，但大运计算暂不可用。',
      years: years,
      transitions: [],
      trend: compareAnnualFacts(years),
    };
  }

  function buildFiveYearFacts(bazi, core, calculator, chain, anchorYear, gender) {
    var targetYear = Number(anchorYear);
    if (!bazi || !validBirthDate(bazi.birthDate)) {
      return buildUndatedFiveYearFacts(bazi, core, calculator || {}, chain, targetYear);
    }
    if (!calculator || typeof calculator.calculateDaYun !== 'function') {
      return buildUnavailableFiveYearFacts(bazi, core, calculator || {}, chain, targetYear);
    }
    var daYunData;
    try {
      daYunData = calculator.calculateDaYun(
        bazi.month, bazi.year, gender,
        bazi.birthDate.year, bazi.birthDate.month, bazi.birthDate.day, bazi.birthDate.hour, bazi.birthDate.clock
      ) || {};
    } catch (error) {
      return buildUnavailableFiveYearFacts(bazi, core, calculator, chain, targetYear);
    }
    var daYunList = list(daYunData.list);
    var daYunListValid = daYunList.length && daYunList.every(function (item) {
      return item && ANNUAL_STEMS.indexOf(item.gan) >= 0 && ANNUAL_BRANCHES.indexOf(item.zhi) >= 0 &&
        typeof item.startYear === 'number' && typeof item.endYear === 'number' &&
        Number.isFinite(item.startYear) && Number.isFinite(item.endYear) &&
        Number.isInteger(item.startYear) && Number.isInteger(item.endYear) &&
        item.endYear >= item.startYear;
    });
    var daYunStarts = daYunList.map(function (item) { return Number(item && item.startYear); })
      .filter(Number.isFinite).sort(function (a, b) { return a - b; });
    var daYunEnds = daYunList.map(function (item) { return Number(item && item.endYear); })
      .filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!daYunListValid || !daYunStarts.length || !daYunEnds.length) {
      return buildUnavailableFiveYearFacts(bazi, core, calculator, chain, targetYear);
    }
    var firstDaYun = daYunStarts[0];
    var lastDaYun = daYunEnds[daYunEnds.length - 1];
    var fortunePeriods = [];
    if (chain && typeof chain.analyzeFortune === 'function') {
      try {
        fortunePeriods = list((chain.analyzeFortune(bazi, daYunList, core && core.yongJi) || {}).periods);
      } catch (error) { fortunePeriods = []; }
    }
    var years = [];
    for (var year = targetYear; year < targetYear + 5; year += 1) {
      var activeDaYun = findDaYunForYear(daYunList, year);
      var daYunPeriod = activeDaYun && fortunePeriods.filter(function (period) {
        var sameRange = Number(period && period.startYear) === Number(activeDaYun.startYear) &&
          Number(period && period.endYear) === Number(activeDaYun.endYear);
        return sameRange || (period && period.gan === activeDaYun.gan && period.zhi === activeDaYun.zhi);
      })[0] || null;
      var yearTimingStatus = activeDaYun ? 'active'
        : (Number.isFinite(firstDaYun) && year < firstDaYun ? 'before_start'
          : (Number.isFinite(lastDaYun) && year > lastDaYun ? 'out_of_range' : 'calculation_unavailable'));
      years.push(buildAnnualFacts(bazi, core, calculator, chain, year, activeDaYun, yearTimingStatus, {
        daYunPeriod: daYunPeriod,
        daYunEventLedger: daYunPeriod && daYunPeriod.eventLedger || null,
      }));
    }
    var timingStatus = years.some(function (row) { return row.daYunStatus === 'calculation_unavailable'; }) ? 'calculation_unavailable'
      : years.some(function (row) { return row.daYunStatus === 'active'; }) ? 'active'
        : years.some(function (row) { return row.daYunStatus === 'before_start'; }) ? 'before_start'
        : years.some(function (row) { return row.daYunStatus === 'out_of_range'; }) ? 'out_of_range'
          : 'unknown_birth';
    return {
      anchorYear: targetYear,
      hasDaYun: timingStatus === 'active',
      timingStatus: timingStatus,
      daYunList: daYunList,
      fortunePeriods: fortunePeriods,
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

  function wealthStrengthState(facts) {
    var strength = facts && facts.core && facts.core.strength || {};
    var level = textOf(strength.level);
    if (/^(极强|偏强|身强|旺极)$/.test(level)) return 'strong';
    if (/^(极弱|偏弱|身弱|弱极)$/.test(level)) return 'weak';
    if (level === '中和') return 'balanced';
    if (typeof strength.score !== 'number' || !Number.isFinite(strength.score)) return 'unknown';
    return strength.score >= 60 ? 'strong' : strength.score < 40 ? 'weak' : 'balanced';
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

  function wealthDomainRecord(period) {
    return list(period && period.eventLedger && period.eventLedger.domainRecords).filter(function (row) {
      return row && row.domain === 'wealth';
    })[0] || null;
  }

  function buildWealthFortuneWindows(bazi, fiveYear) {
    var birthYear = Number(bazi && bazi.birthDate && bazi.birthDate.year);
    var periods = list(fiveYear && fiveYear.fortunePeriods);
    if (!Number.isFinite(birthYear) || !periods.length) {
      return {
        available: false, periods: [], adultBest: null, earlyFoundation: null,
        limitation: '未确认完整出生时间或起运数据，暂不判断财富兑现窗口。',
      };
    }
    var rows = periods.map(function (period) {
      var startAge = Math.max(0, Number(period.startYear) - birthYear);
      var endAge = Math.max(startAge, Number(period.endYear) - birthYear);
      var wealthRecord = wealthDomainRecord(period);
      var directionBonus = wealthRecord && wealthRecord.direction === '偏有利' ? 1.5
        : wealthRecord && wealthRecord.direction === '偏不利' ? -1.5 : 0;
      var activation = Number(wealthRecord && wealthRecord.activationScore) || 0;
      var score = (Number(period.verifiedScore) || 0) + directionBonus + Math.min(2, activation * 0.25);
      var stage = endAge < 16 ? 'foundation' : startAge < 23 ? 'preparation' : 'adult';
      return {
        gan: period.gan, zhi: period.zhi, label: textOf(period.gan) + textOf(period.zhi),
        startYear: Number(period.startYear), endYear: Number(period.endYear),
        startAge: startAge, endAge: endAge, stage: stage,
        stageLabel: stage === 'foundation' ? '家庭与成长资源期'
          : stage === 'preparation' ? '能力与职业起步期' : '成年财富兑现期',
        score: Number(score.toFixed(2)), verdict: period.verdict,
        wealthDirection: wealthRecord && wealthRecord.direction || '条件性',
        wealthEvidence: list(wealthRecord && wealthRecord.evidence),
      };
    });
    function bestOf(candidates) {
      return candidates.slice().sort(function (a, b) {
        return b.score - a.score || a.startYear - b.startYear;
      })[0] || null;
    }
    var favorableAdult = rows.filter(function (row) {
      return row.stage === 'adult' && row.wealthDirection === '偏有利' && row.score > 0;
    });
    var favorableEarly = rows.filter(function (row) {
      return row.stage !== 'adult' && row.wealthDirection === '偏有利' && row.score > 0;
    });
    return {
      available: true,
      periods: rows,
      adultBest: bestOf(favorableAdult),
      earlyFoundation: bestOf(favorableEarly),
      limitation: favorableAdult.length
        ? '大运只筛选原局财富潜力值得核对的阶段，不改变原局A等级；未成年阶段只解释家庭、教育与成长资源，不解释为个人身价。'
        : '当前大运列表中没有足够明确的成年财富上升窗口；原局A等级仍是模型参考，不能据此承诺现实兑现。',
    };
  }

  function calibrateWealthReality(wealthFacts, input) {
    input = input || {};
    var natalLevel = clampNumber(Number(wealthFacts && wealthFacts.narrative && wealthFacts.narrative.grade &&
      String(wealthFacts.narrative.grade).replace(/\D/g, '')) || 1, 1, 10);
    var incomeLevel = clampNumber(Number(input.incomeLevel) || 1, 1, 10);
    var assetLevel = clampNumber(Number(input.assetLevel) || 1, 1, 10);
    var occupation = textOf(input.occupation) || '未填写';
    var debt = textOf(input.debt) || '未填写';
    var familySupport = textOf(input.familySupport) || '未填写';
    var currentLevel = Math.max(assetLevel, Math.max(1, incomeLevel - 1));
    if (debt === '较重') currentLevel = Math.max(1, currentLevel - 1);
    var carrier = occupation === '在读/未就业' ? '财富载体尚在形成，当前好运应优先解释为家庭、教育与能力积累。'
      : occupation === '经营者/企业主' ? '已经具备经营、客户、资本或资产载体，可重点核对成年有利大运中的实际扩张能力。'
      : '已经具备职业或项目载体，可用真实收入、净资产和留财情况核对兑现程度。';
    var gap = Math.max(0, natalLevel - currentLevel);
    return {
      natalGrade: 'A' + natalLevel, currentReferenceGrade: 'A' + currentLevel, gap: gap, carrier: carrier,
      summary: '原局模型潜力仍为A' + natalLevel + '，本次现实基准约为A' + currentLevel +
        (gap ? '，与原局参考相差' + gap + '档。' : '，当前基准已接近原局参考。') +
        '本次复核只校对现实兑现程度，不修改原局A等级。',
      inputs: { occupation: occupation, incomeLevel: incomeLevel, assetLevel: assetLevel, debt: debt, familySupport: familySupport },
    };
  }

  function compactTechnicalTerms(values, limit) {
    var terms = [];
    list(values).forEach(function (value) {
      var term = textOf(value).replace(/[。；，,]+$/g, '').trim();
      if (!term || terms.indexOf(term) >= 0 || terms.length >= (limit || 4)) return;
      terms.push(term);
    });
    return terms;
  }

  function coreTechnicalTerms(facts) {
    var core = facts && facts.core || {};
    var strength = core.strength || {};
    var pattern = core.pattern || {};
    var yongJi = core.yongJi || {};
    var level = textOf(strength.level || strength.label);
    var patternName = textOf(pattern.displayName || pattern.name || pattern.label);
    var patternStatus = textOf(pattern.status || pattern.formationStatus);
    var source = yongJi.yongShenSource || {};
    var yongElement = textOf(source.element) || list(yongJi.yongShen)[0] || '';
    var useType = textOf(source.label || source.primaryType);
    return compactTechnicalTerms([
      level ? (/^日主/.test(level) ? level : '日主' + level) : '',
      patternName ? patternName + (patternStatus && patternName.indexOf(patternStatus) < 0 ? '·' + patternStatus : '') : '',
      yongElement ? yongElement + '为' + (useType || '用神') : '',
    ], 3);
  }

  function timingTechnicalTerms(year) {
    year = year || {};
    var pillar = year.pillar || year.yearPillar || {};
    var daYun = year.daYun || {};
    var interaction = list(year.interactions).map(function (row) {
      return textOf(row && (row.type || row.relation || row.name));
    }).filter(Boolean)[0];
    return compactTechnicalTerms([
      pillar.gan || pillar.zhi ? year.year + '年·' + textOf(pillar.gan) + textOf(pillar.zhi) + '流年' : '',
      daYun.gan || daYun.zhi ? textOf(daYun.gan) + textOf(daYun.zhi) + '大运' : '',
      interaction,
    ], 3);
  }

  function narrativeTechnicalBasis(facts, domain) {
    // 旺衰、格局与总用神只在年度总览出现一次；其余板块只保留
    // 本主题真正参与推断的术语，避免五个板块重复同一组底盘标签。
    var terms = domain === 'currentYear' ? coreTechnicalTerms(facts) : [];
    if (domain === 'wealth') {
      var wealth = facts && facts.wealth || {};
      var path = list(wealth.pathways).map(function (row) { return textOf(row && row.type); }).filter(Boolean)[0];
      terms = terms.concat([path, wealth.resource && wealth.resource.state ? '财星' + wealth.resource.state : '']);
    } else if (domain === 'relationship') {
      var relationship = facts && facts.relationship || {};
      var roles = relationship.spouseStar && relationship.spouseStar.roles;
      if (!list(roles).length) {
        roles = list(relationship.spouseStar && relationship.spouseStar.occurrences).map(function (row) { return row && row.role; });
      }
      terms = terms.concat([
        compactTechnicalTerms(roles, 2).join('、') + (list(roles).length ? '为配偶星' : ''),
        relationship.palace && relationship.palace.zhi ? '夫妻宫坐' + relationship.palace.zhi : '',
      ]);
    } else if (domain === 'study') {
      var study = facts && facts.study || {};
      terms = terms.concat([
        study.path && study.path.type ? study.path.type + '学习路径' : '',
        study.profile && study.profile.label,
      ]);
    } else if (domain === 'currentYear') {
      terms = timingTechnicalTerms(facts && facts.currentYear).concat(terms);
    } else if (domain === 'fiveYear') {
      var fiveYears = facts && facts.fiveYear && facts.fiveYear.years || [];
      var firstActive = fiveYears.filter(function (row) { return row && row.daYun; })[0] || fiveYears[0];
      terms = timingTechnicalTerms(firstActive).concat(['大运看趋势·流年定应期']).concat(terms);
    }
    if (!terms.filter(Boolean).length) terms = coreTechnicalTerms(facts).slice(0, 2);
    return compactTechnicalTerms(terms, 4);
  }

  function attachNarrativeTechnicalBasis(narrative, facts, domain) {
    if (narrative) narrative.technicalBasis = narrativeTechnicalBasis(facts, domain);
    return narrative;
  }

  var REPORT_TIMING_DOMAIN = {
    wealth: { title: '接下来几年更容易见到钱的年份' },
    relationship: { title: '接下来几年感情更容易应事的年份' },
    study: { title: '接下来几年考试与进修更容易应事的年份' },
  };

  function annualAdjudication(year) {
    return year && (year.eventAdjudication || year.dynamic && year.dynamic.eventAdjudication) || null;
  }

  function domainTimingCandidates(facts, domain, limit) {
    var rows = [];
    list(facts && facts.fiveYear && facts.fiveYear.years).forEach(function (year) {
      if (facts && facts.currentYear && Number(year && year.year) === Number(facts.currentYear.year)) return;
      var adjudication = annualAdjudication(year);
      if (!adjudication) return;
      var record = list(adjudication.domainRecords).filter(function (item) {
        return item && item.domain === domain;
      })[0];
      // 只有当年确有刑冲合害等独立结构触发时才报“应期”；十神和大运背景只能定主题。
      if (!record || record.reportExcluded || record.reportVariantSuppressed || !record.hasIndependentAnnualTrigger || Number(record.activationScore || 0) < 2) return;
      rows.push({
        year: Number(year.year), age: adjudication.age,
        stage: adjudication.lifeStage && adjudication.lifeStage.label || '',
        stageKey: adjudication.lifeStage && adjudication.lifeStage.key || '',
        direction: record.direction || '条件性', confidence: record.confidence || '中',
        eventCandidate: record.eventCandidate || '', scenarios: list(record.scenarioCandidates),
        selectedScenario: selectTimingScenario(record, adjudication),
        evidence: list(record.evidence),
        score: Number(record.activationScore || 0) + Number(adjudication.triggerStrength || 0) * 0.45,
      });
    });
    return rows.sort(function (a, b) { return b.score - a.score || a.year - b.year; })
      .slice(0, limit || 2);
  }

  function contextScenario(domain, direction, life) {
    if (!life || life.status === 'working' || domain === 'family') return '';
    var school=life.status==='student'||life.status==='unknown'&&life.age!=null&&life.age>=6&&life.age<18;
    var subjects=school?{study:'课程学习、答题与阶段成果',career:'学校任务、集体活动与同伴协作',wealth:'可支配费用与学习物资',relationship:'同伴联系与日常相处',change:'课程、居住或校园生活安排',health:'精力恢复与日常节奏'}
      :life.status==='exam'?{study:'复习计划、练习与考核准备',career:'备考任务与考核要求',wealth:'备考费用与生活预算',relationship:'备考协作与重要关系的沟通',change:'复习与生活安排',health:'精力恢复与复习节奏'}
      :life.status==='transition'?{career:'求职准备、申请与方向选择',wealth:'生活预算与求职成本',relationship:'重要联系与相处安排',change:'求职方向与生活安排',health:'精力恢复与日常节奏'}
      :life.status==='home'?{career:'生活事务与照料分工',wealth:'生活预算与共同开支',relationship:'共同生活中的沟通与协作',change:'居住、照料与个人计划',health:'精力恢复与日常节奏'}
      :life.status==='retired'?{career:'日常办事、兴趣活动与共同任务',wealth:'可支配费用与生活开支',relationship:'同伴联系与日常相处',change:'居住、活动与生活安排',health:'精力恢复与活动节奏'}
      :{study:'当时的学习或准备安排（如有）',career:'个人任务、实际要求与协作',wealth:'可支配费用与资源安排',relationship:'重要联系与日常相处',change:'主要生活安排与个人计划',health:'精力恢复与日常节奏'};
    return subjects[domain] ? subjects[domain]+(direction==='偏有利'?'更容易理顺，具体成果仍需核对':direction==='偏不利'?'更容易遇到阻力，需要调整原有安排':'是本年需要核对的变化方向，具体结果取决于现实安排') : '';
  }

  function selectTimingScenario(record, adjudication) {
    record = record || {};
    adjudication = adjudication || {};
    var reference=record.reportProcessReference;
    var processText=reference?' 往事可参考的共同作用方式：'+reference.commonProcess+'。'+(reference.state==='mixed-reference'?'同类解释也收到过不符合反馈，需要保留不同表现。':'')+'这条线索用于核对当前场景，不表示相同事件或结果会重演。':'';
    if (record.reportFeedback) return (record.reportScenario || record.reportFeedback.original || record.reportFeedback.label || '')+'。'+record.reportFeedback.outcome+processText;
    if (record.reportScenario) return record.reportScenario+processText;
    var contextual=contextScenario(record.domain,record.direction,adjudication.lifeContext);
    if(contextual)return contextual;
    var stageKey = adjudication.lifeStage && adjudication.lifeStage.key || '';
    if (!stageKey && Number.isFinite(Number(adjudication.age))) {
      var stageAge = Number(adjudication.age);
      stageKey = stageAge < 16 ? 'child' : stageAge < 24 ? 'education' : stageAge < 31 ? 'launch'
        : stageAge < 46 ? 'development' : stageAge < 61 ? 'mature' : 'late';
    }
    var concrete = list(record.scenarioCandidates).map(textOf).filter(Boolean);
    if (['launch','development','mature'].indexOf(stageKey) >= 0 && concrete.length && !/^事业事项/.test(concrete[0])) return concrete[0];
    var direction = record.direction || '条件性';
    var favorable = direction === '偏有利';
    var adverse = direction === '偏不利';
    if (record.domain === 'study') {
      if (stageKey === 'child' || stageKey === 'education') {
        return favorable ? '考试、录取、升学或证照通过更容易推进'
          : adverse ? '考试发挥、录取推进或资格审核更容易遇到阻力'
            : '考试、录取或学习进度会成为这一年的主要变量';
      }
      return favorable ? '考证、进修、岗位学习或专业评审更容易取得结果'
        : adverse ? '考证、进修或专业评审更容易被工作和现实事务打断'
          : '进修、考证或专业能力更新会成为这一年的主要变量';
    }
    if (record.domain === 'career') {
      if (stageKey === 'child') return favorable ? '班级职责、竞赛展示或阶段成果更容易得到认可'
        : adverse ? '学校任务、竞赛表现或与师长的要求更容易形成压力' : '学校职责、竞赛或阶段成果更容易发生变化';
      if (stageKey === 'education') return favorable ? '实习、求职准备或第一个重要实践项目更容易落实'
        : adverse ? '实习、求职准备或实践项目更容易反复' : '实习、求职准备或实践方向更容易发生变化';
      if (stageKey === 'launch') return favorable ? '求职、转岗或第一个重要项目更容易落实'
        : adverse ? '求职、岗位稳定或项目落地更容易反复' : '求职、岗位或项目方向更容易发生变化';
      if (stageKey === 'late') return favorable ? '职责交接、顾问合作或既有成果兑现更容易落实'
        : adverse ? '职责交接、合作收尾或工作量安排更容易形成压力' : '职责交接、合作方式或生活重心更容易调整';
      return favorable ? '职位、重要项目、客户认可或成果兑现更容易推进'
        : adverse ? '职位调整、项目交付、考核或上下级协调更容易形成压力'
          : '职位、项目或工作安排更容易发生明显变化';
    }
    if (record.domain === 'wealth') {
      if (stageKey === 'child') return favorable ? '家庭用于学习与成长的资源更容易到位'
        : adverse ? '学习、照护或家庭安排带来的支出更容易增加' : '家庭资源和学习支出会成为这一年的主要变量';
      if (stageKey === 'education') return favorable ? '奖学金、兼职收入、实习报酬或家庭支持更容易到位'
        : adverse ? '学费、培训、租住或求职准备带来的支出更容易增加' : '学习投入、兼职收入与家庭支持会同时变化';
      if (stageKey === 'late') return favorable ? '退休收入、资产安排、回款或家庭资源配置更容易落实'
        : adverse ? '医疗照护、家庭支出、回款延迟或资产占用更容易增加' : '退休收入、家庭支出与资产安排会同时变化';
      return favorable ? '收入、客户回款、项目结算或资源兑现更容易落地'
        : adverse ? '支出、垫款、回款延迟或资金占用更容易增加'
          : '收入机会和资金安排会同时增多，最终能否留下仍需核对';
    }
    if (record.domain === 'relationship') {
      if (stageKey === 'child') return favorable ? '与父母、老师或同伴的沟通和协作更容易改善'
        : adverse ? '与父母、老师或同伴的边界和争执更容易成为主要问题' : '家庭与同伴关系更容易被明显牵动';
      if (stageKey === 'education') return favorable ? '关系确认、沟通靠近或合作推进更容易发生'
        : adverse ? '关系边界、争执或疏远更容易成为主要问题' : '感情与合作关系更容易被明显牵动';
      if (stageKey === 'late') return favorable ? '伴侣沟通、家庭协作或共同生活安排更容易改善'
        : adverse ? '伴侣距离、家庭分工或照护安排更容易出现摩擦' : '伴侣沟通与家庭协作更容易发生变化';
      return favorable ? '关系确认、同居婚嫁商议、沟通修复或共同安排更容易推进'
        : adverse ? '争执、距离、分合决定或合作边界调整更容易出现'
          : '关系确认、共同安排或分合选择更容易成为主要议题';
    }
    if (record.domain === 'family') {
      return favorable ? '家庭分工、长辈支持、居住或照护安排更容易落实'
        : adverse ? '家庭分工、长辈事务、居住或照护安排更容易增加压力'
          : '家庭分工、长辈事务或居住安排更容易发生变化';
    }
    if (record.domain === 'health') {
      return favorable ? '作息、恢复状态或既有健康管理更容易改善'
        : adverse ? '劳累、睡眠、情绪承载或行动安全更需要留意'
          : '作息、恢复状态或行动安全会成为这一年的主要变量';
    }
    if (record.domain === 'change') {
      return favorable ? '搬迁、换环境、改计划或重新启动更容易顺利落实'
        : adverse ? '既有安排更容易被打断，搬迁、出行或计划调整更容易反复'
          : '环境、出行或生活重心更容易发生明显变化';
    }
    return list(record.scenarioCandidates)[0] || record.eventCandidate || '相关事项更容易被引动';
  }

  function timingCandidateOutcome(row) {
    var contextMeta = [row.age !== null && row.age !== undefined ? row.age + '岁' : '', row.stage].filter(Boolean).join('·');
    var context = row.year + '年' + (contextMeta ? '（' + contextMeta + '）' : '');
    var scene = row.selectedScenario || row.scenarios[0] || row.eventCandidate;
    return context + '为' + row.direction + '：' + (scene || '相关事项更容易被引动') + '。';
  }

  function attachDomainTiming(narrative, facts, domain) {
    var meta = REPORT_TIMING_DOMAIN[domain];
    if (!narrative || !meta) return narrative;
    var candidates = domainTimingCandidates(facts, domain, 2);
    // 没有足够证据时不额外塞入三个相似的“无法判断”卡片，统一留在五年边界说明中。
    if (!candidates.length) return narrative;
    var outcome = candidates.map(timingCandidateOutcome).join(' ');
    var source = candidates.map(function (row) {
      return row.year + '年：' + row.evidence.slice(0, 2).join('；');
    }).filter(function (row) { return !/:$/.test(row); }).join(' ');
    narrative.verdicts = list(narrative.verdicts).concat([narrativeVerdict(meta.title, '', ['TIMING_DOMAIN:' + domain], {
      sourceText: source,
      outcomeText: outcome,
    })]);
    return narrative;
  }

  function buildReportStoryline(facts) {
    var core = facts && facts.core || {};
    var strength = core.strength || {};
    var pattern = core.pattern || {};
    var yongJi = core.yongJi || {};
    var source = yongJi.yongShenSource || {};
    var yong = textOf(source.element) || list(yongJi.yongShen)[0] || '';
    var ji = list(yongJi.jiShen)[0] || '';
    var entries = list(yongJi.elementRoleLedger && yongJi.elementRoleLedger.entries);
    var yongEntry = entries.filter(function (item) { return item && item.element === yong; })[0] || {};
    var jiEntry = entries.filter(function (item) { return item && item.element === ji; })[0] || {};
    var level = textOf(strength.level || strength.label) || '旺衰已定';
    var following = core.congGe || pattern.congGe || /从格|专旺/.test(textOf(yongJi.method));
    var centralTension = following
      ? '本局按'+textOf(pattern.name || yongJi.method)+'顺势取用。报告重点是顺势条件是否完整，以及后续作用有没有改变原局方向，不能套用普通身弱先补扶的判断。'
      : /极弱|身弱|偏弱/.test(level)
      ? '真正要解决的是承载不足：机会、钱和责任来得太快时，人容易先累、先乱，所以要先让自己接得住，再谈放大结果。'
      : /身强|偏强|极强|旺极/.test(level)
        ? '你不缺推动事情的力量，真正的问题是力量能不能被疏通并变成成果；继续一味加码，反而容易变成内耗、竞争或反复。'
        : '命局不是简单地越补越好，关键在于维持现有承载，同时让真正能解决问题的力量发挥出来。';
    var yongState = yong
      ? yongEntry.natalRole === '原局未现'
        ? yong + '在原局没有直接出现，它更像后天需要等待或主动建立的关键条件。'
        : yongEntry.natalRole === '原局有功'
          ? yong + '属于原局所需的力量；已有根气、已经起作用和岁运继续增加，要分别判断，不能直接当作越多越好。'
          : yongEntry.natalRole === '功过并见'
            ? yong + '在原局既有帮助也有副作用，后面遇到它不能一概论好，必须看它具体落在哪里、作用到谁。'
            : yong + '是解决原局核心问题的第一顺序，后面的行运都要先看它能不能真正发挥。'
      : '当前没有形成单一用神，后面的判断以具体干支关系和现实反馈为主。';
    var adverse = ji
      ? (jiEntry.fortuneDirection || '逢' + ji + '运通常要增加一层复核')
      : '没有单一五行能够直接概括所有阻力';
    var domainCounts = {};
    list(facts && facts.fiveYear && facts.fiveYear.years).forEach(function (year) {
      var primary = annualAdjudication(year) && annualAdjudication(year).primaryEvent;
      if (primary && primary.domain && primary.hasIndependentAnnualTrigger) domainCounts[primary.domain] = (domainCounts[primary.domain] || 0) + 1;
    });
    var domainLabels = { study: '学习考试', career: '事业工作', wealth: '收入资金', relationship: '婚恋合作', family: '家庭长辈', health: '身心安全', change: '环境变化' };
    var focus = Object.keys(domainCounts).sort(function (a, b) { return domainCounts[b] - domainCounts[a] || a.localeCompare(b); }).slice(0, 2);
    return {
      headline: '整份报告先看这一条主线',
      summary: centralTension + ' ' + yongState,
      mechanismAccount:yongJi.mechanismSummary ? {
        cause:yongJi.mechanismSummary.mainCause,
        help:yongJi.mechanismSummary.help,
        cost:yongJi.mechanismSummary.cost,
        natalState:yongJi.mechanismSummary.natalState
      } : null,
      direction: yong ? (yongEntry.fortuneDirection || '逢' + yong + '运优先看是否真正改善原局') : '',
      boundary: ji ? adverse + '；这只是原局给出的基础方向，具体年份仍由大运、流年与原局的实际作用复核。' : '具体年份仍由大运、流年与原局的实际作用复核。',
      focus: focus.length ? '接下来五年的现实重点更集中在' + focus.map(function (key) { return domainLabels[key] || key; }).join('和') + '，其他板块都围绕这条主线展开。' : '',
      technicalBasis: compactTechnicalTerms([
        /^日主/.test(level) ? level : '日主' + level,
        textOf(pattern.displayName || pattern.name || pattern.label),
        yong ? yong + '为' + textOf(source.label || source.primaryType || '用神') : '',
      ], 3),
    };
  }

  function dedupeNarrativeSources(narratives) {
    var seen = {};
    ['currentYear', 'relationship', 'wealth', 'study', 'fiveYear'].forEach(function (section) {
      var narrative = narratives && narratives[section];
      list(narrative && narrative.verdicts).forEach(function (verdict) {
        var source = textOf(verdict && verdict.sourceText);
        var key = source.replace(/[\s，。；、：！？,.!?;:“”‘’"']/g, '');
        if (key.length < 12) return;
        if (seen[key]) verdict.sourceText = '';
        else seen[key] = section;
      });
    });
    return narratives;
  }

  function buildWealthNarrative(facts) {
    var wealth = facts && facts.wealth || {};
    var resource = wealth.resource || {};
    var capacity = wealth.capacity || {};
    var quality = resource.quality || {};
    var pathways = list(wealth.pathways);
    var retentionRisks = list(wealth.retention && wealth.retention.risks);
    var yongJi = wealth.yongJi || (facts && facts.core && facts.core.yongJi) || {};
    var pathElements = uniqueElements(wealth.pathElements);
    if (!pathElements.length) pathElements = wealthPathElements(pathways, wealth.wealthElement);
    var direction = deriveWealthDirection({ yongJi: yongJi });
    var storageRows = list(wealth.storage && wealth.storage.storages);
    var storageContributions = storageRows.map(function (row) { return storageNarrativeContribution(row, capacity); });
    var storageFacts = storageContributions.map(function (item) { return item.basis; });
    var storageSourceText = storageContributions.map(function (item) { return item.source; }).filter(Boolean);
    var storageRetentionText = storageContributions.map(function (item) { return item.retention; }).filter(Boolean);
    var financialStorageRows = storageRows.filter(function (row) {
      return row && (row.storageRoleKey === 'wealth' || list(row.hiddenRoles).some(function (item) {
        return item && (item.role === '正财' || item.role === '偏财');
      }));
    });
    var usefulRetainingWealthStorage = financialStorageRows.filter(function (row) {
      return row.storageRoleKey === 'wealth' && row.activated && row.wealthConnection &&
        storageRoleDisposition(row) === 'useful' && (capacity.state === '顺势' || capacity.state === '可承接');
    });
    var positivePathTypes = ['比劫生食伤生财', '食伤生财', '财生官', '财官印连续流通', '财配印'];
    var scalePathTypes = positivePathTypes.concat(['合会引财']);
    var scalePaths = pathways.filter(function (row) {
      return row && scalePathTypes.indexOf(row.type) >= 0 && row.scalePotential !== false;
    });
    var actualPaths = pathways.filter(function (row) {
      return row && positivePathTypes.indexOf(row.type) >= 0 && row.positive === true;
    });
    var adverseScalePaths = scalePaths.filter(function (row) { return row.effect === 'adverse'; });
    var strongOutputWealthPath = scalePaths.some(function (row) {
      return row.type === '食伤生财' && row.confidence === 'strong';
    });
    var wealthGatheringPath = scalePaths.some(function (row) { return row.type === '合会引财'; });
    var connectedActivatedWealthStorage = financialStorageRows.some(function (row) {
      return row && row.storageRoleKey === 'wealth' && row.activated && row.wealthConnection;
    });
    var annualWealthEvidence = facts && facts.currentYear && facts.currentYear.wealth &&
      list(facts.currentYear.wealth.timing && facts.currentYear.wealth.timing.activation).length > 0;
    var points = 2;
    points += ({ '顺势': 3, '可承接': 2, '有缓解': 1, '平衡观察': 0, '承压': -2 })[capacity.state] || 0;
    if (Number(resource.visibleCount) > 0) points += 1;
    if (Number(resource.hiddenCount) > 0 || list(quality.roots).length) points += 0.5;
    if (capacity.elementRole === '用神' || capacity.elementRole === '喜神' || resource.elementRole === '用神' || resource.elementRole === '喜神') points += 1;
    if (capacity.elementRole === '忌神' || resource.elementRole === '忌神') points -= 1;
    points += Math.min(2, scalePaths.length) * 0.5;
    if (usefulRetainingWealthStorage.length) points += 0.5;
    if (strongOutputWealthPath) points += 2;
    if (list(quality.roots).length >= 2) points += 1;
    if (list(quality.sources).length >= 3) points += 1;
    if (/月令同气|月令相生/.test(textOf(quality.season && quality.season.state))) points += 0.5;
    if (connectedActivatedWealthStorage) points += 1.5;
    if (wealthGatheringPath) points += 1;
    var level = clampNumber(Math.round(points), 1, 10);
    var isolatedHiddenWealth = Number(resource.visibleCount) === 0 &&
      Number(resource.hiddenCount) > 0 && scalePaths.length === 0 &&
      list(quality.sources).length <= 1 && !connectedActivatedWealthStorage;
    if (isolatedHiddenWealth) level = Math.min(level, 4);
    var strengthScore = Number(facts && facts.core && facts.core.strength && facts.core.strength.score);
    var extremeWeakAdverse = Number.isFinite(strengthScore) && strengthScore <= 25 &&
      (capacity.elementRole === '忌神' || resource.elementRole === '忌神') && capacity.method !== '从格顺势';
    if (extremeWeakAdverse) level = Math.min(level, 5);
    var pathText = scalePaths.map(function (row) { return textOf(row && (row.type || row.conclusion || row)); }).join(' ');
    var retentionRiskText = retentionRisks.map(function (row) { return textOf(row && (row.type || row)); }).join(' ');
    var hasPartnershipLoss = /比劫|合伙|合作|分流/.test(retentionRiskText);
    var hasSealBreak = /财破印|财坏印|财印冲/.test(retentionRiskText);
    var hasInvestmentLoss = /投资|判断失误/.test(retentionRiskText);
    var hasOfficerPressure = /财生官压身|财党杀/.test(retentionRiskText);
    var headline;
    var painPoint;
    if (capacity.state === '承压') {
      headline = '你不是没有赚钱机会，而是机会一多，垫的钱、要扛的事和花掉的时间也会一起变多。';
      painPoint = '最大的财富问题不是收入低，而是项目做大后，钱可能先压在项目里、分给合伙人，或花在家庭和责任上。';
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
    if (retentionRisks.length) {
      headline = '你有挣钱能力，但漏财风险也很明显。';
      var lossReasons = [];
      if (hasPartnershipLoss) lossReasons.push('合伙分钱、替别人扛成本时破财');
      if (hasInvestmentLoss) lossReasons.push('继续投项目或投资判断失误时亏钱');
      if (hasSealBreak) lossReasons.push('为了追收入而不断花钱准备、转型或补足资格时把钱用掉');
      if (hasOfficerPressure) lossReasons.push('项目和职位带来的责任、垫资与成本一起增加时把钱压住');
      if (!lossReasons.length) lossReasons.push('项目继续投入、家庭责任或临时支出增加时把钱花掉');
      painPoint = '钱容易在' + lossReasons.join('，也容易在') + '，属于赚得到、却不容易全部留下的类型。';
    }
    var adversePathText = adverseScalePaths.map(function (row) { return textOf(row && row.type); }).join(' ');
    var source = /食伤生财/.test(pathText)
      ? (/食伤生财/.test(adversePathText)
        ? '钱主要靠手艺、技术、产品、内容或项目成果挣到；但这条路也会持续消耗你的时间、资金和精力，做得越大，跟着增加的投入和压力也越多。'
        : '钱主要靠手艺、技术、产品、内容或项目成果挣到，做出的东西越能直接解决问题，收入越容易跟着增加。')
      : /财生官|财官印/.test(pathText)
        ? (/财生官|财官印/.test(adversePathText)
          ? '钱和工作责任往往一起出现：项目、职位和要扛的事情会增加，但这些责任也会吃掉大量时间和成本，事情做得多不等于最后留下的钱多。'
          : '钱更容易随着职位、长期项目和手里能决定的事情一起增加。')
        : /财配印/.test(pathText)
          ? '知识、资质、专业信誉和长期资产更容易成为财富入口。'
          : /比劫/.test(pathText)
            ? '合作与圈层能够带来机会，同时也会产生更明显的利益分配。'
            : storageSourceText.length ? '' : '当前没有足够结构依据确定主要收入路径。可结合现实职业、技能或经营方式再核对，不补定工资、项目或横财来源。';
    var strengthState = wealthStrengthState(facts, capacity);
    var retentionText = capacity.method === '从格顺势'
      ? '本局按从格顺势评估财富承接，不套用普通身弱难担财的模板。实际留存还要看路径、支出与分配。'
      : '主引擎旺衰为'+textOf(facts && facts.core && facts.core.strength && facts.core.strength.level || '待核')+'，财富承接状态为'+textOf(capacity.state || '待核')+'。承接是结构条件，不能单独确认现金留存；需结合下列通路与阻断。';
    if (isolatedHiddenWealth) {
      retentionText = '财星藏支且未接上明确财富通路，当前不足以确认收入放大与留存条件；有库也不能直接断能存下钱。';
    }
    if (retentionRisks.length) {
      var retentionDetails = [];
      if (hasPartnershipLoss) retentionDetails.push('合作、团队或同行会参与分钱，账面收入不会全部落到自己手里');
      if (hasSealBreak) retentionDetails.push('为了挣钱更容易挤掉学习提升、资格积累、稳定支持或原有保障，钱也会继续花在准备和转型上');
      if (hasInvestmentLoss) retentionDetails.push('继续投入项目或投资判断失误会直接造成亏损');
      if (hasOfficerPressure) retentionDetails.push('收入机会会同时带来更多责任、垫资和成本，事情做多了，钱反而容易被压住');
      if (!retentionDetails.length) retentionDetails.push('项目继续投入、家庭责任或临时支出会降低最后留下来的比例');
      retentionText += retentionDetails.join('；') + '。';
    }
    var hasFinancialStorage = storageRows.some(function (row) { return row && row.storageRoleKey === 'wealth'; });
    var hasStrongWealthPath = scalePaths.length > 0;
    var hasCongCai = capacity.method === '从格顺势';
    var partialWealth = wealth.partialWealth || { strong: false, exposedCount: 0, hiddenCount: 0, evidence: [] };
    var storageText = usefulRetainingWealthStorage.length
      ? '财库确实被引动，财星又是喜用，命局也能接住这股财气；钱进来以后，才有机会变成存款、资产或能持续回款的长期项目。'
      : storageRetentionText.length
        ? storageRetentionText.join(' ')
      : hasFinancialStorage
        ? '命局里虽然能看到财星或财库，但它没有同时满足“财是喜用、日主担得住、库已被真正引动”三个条件，所以有进账不等于都能留下。'
        : (!hasStrongWealthPath && !hasCongCai && !annualWealthEvidence && !partialWealth.strong
          ? '命局没有形成财库，一笔机会突然把财富放大的信号较弱；财富更像是靠工资、客户或长期项目一点点积累起来。'
          : (partialWealth.strong
            ? '命局没有形成财库，但偏财连续透出两处，说明遇到项目、客户、市场变化或阶段性机会时，进账有被放大的可能；能不能留下，仍要看后续的合作分配和实际投入。'
            : '命局没有形成财库，但已经有其他挣钱方式或岁运引动条件，所以仍可能出现收入突然增加，只是这不等于能一次性沉淀成大额资产。'));
    var totalText;
    if (isolatedHiddenWealth) {
      totalText = '这张盘身强不代表富。财星只藏在地支，没有透出，也没有接成稳定的赚钱链条；财库虽被触动，但没有真正接上财路。所以更容易是有挣钱的能力和想法，但收入难以持续放大，财富层级偏低。';
    } else if (extremeWeakAdverse) {
      totalText = '这张盘看得到挣钱机会，但日主太弱，财星又继续把力量推向压力和责任。事情越做越多，成本和负担也越重，真正留下的钱通常有限。';
    } else if (capacity.state === '承压') {
      totalText = '你的赚钱机会并不少，但机会一多，需要垫的钱、扛的责任和花掉的精力也会一起增加。账面进账可能变大，真正能留下多少要看后面的路径和留存条件。';
    } else if (capacity.state === '顺势' || level >= 8) {
      totalText = '这张盘有把资源做大的基础。收入不只靠一份固定工资，更容易靠项目、客户、平台或长期经营把规模慢慢拉开。';
    } else if (capacity.state === '可承接' || capacity.state === '有缓解') {
      totalText = '这张盘能接住正常的赚钱机会。收入上来以后，稳定的工资、客户或项目能够变成看得见的成果；机会一旦超过手里能调动的钱和人，留下来的比例就会下降。';
    } else {
      totalText = '这张盘的收入起伏主要取决于有没有稳定的工资、客户、项目或产品；赚钱入口稳定时能持续进账，入口一断，收入也会跟着明显下降。';
    }
    var sourceOutcome = [source].concat(storageSourceText).filter(Boolean).join(' ');
    var retentionOutcome = retentionText + ' ' + storageText;
    var directionSource;
    var directionText;
    if (!direction.conflict) {
      var primaryText = list(direction.primary).map(function (element) { return element + '为用神'; }).join('、');
      var secondaryText = list(direction.secondary).map(function (element) { return element + '为喜神'; }).join('、');
      directionSource = [primaryText, secondaryText].filter(Boolean).join('，') + '。';
      var primaryDirections = list(direction.primary).reduce(function (rows, element) {
        return rows.concat((WEALTH_DIRECTIONS[element] || []).filter(function (item) { return rows.indexOf(item) < 0; }));
      }, []);
      var secondaryDirections = list(direction.secondary).reduce(function (rows, element) {
        return rows.concat((WEALTH_DIRECTIONS[element] || []).filter(function (item) { return rows.indexOf(item) < 0; }));
      }, []);
      directionText = (primaryDirections.length ? primaryDirections.join('、') + '是按用神对应的传统方位取象。' : '') +
        (secondaryDirections.length ? secondaryDirections.join('、') + '是第二顺位。' : '') +
        '方位是辅助线索，无法仅凭地域确认客户、项目或收入；实际路径与经营条件仍需单独核对。';
    } else {
      directionSource = actualPaths.length
        ? '已见财富通路，但能接入通路的喜用元素没有形成单一优势。'
        : '原局未见同时符合喜用与实际财富通路的单一方向。';
      directionText = '得财方向不集中，不能只凭某一个五行或方位断定哪里一定更赚钱。真正决定收入的，是哪一种客户、项目、平台或合作方式能把现有路径接成收入。';
    }
    // 留财证据已经通过承载状态、喜忌与负向路径进入基础分；这里只记录，避免同一证据重复扣分。
    var retentionPenalty = 0;
    var ceilingComponents = {
      capacity: capacity.state || '未知',
      wealthVisibility: Number(resource.visibleCount) > 0 ? '透干' : Number(resource.hiddenCount) > 0 ? '藏支' : '不显',
      pathCount: scalePaths.length,
      rootCount: list(quality.roots).length,
      sourceCount: list(quality.sources).length,
      retentionPenalty: retentionPenalty,
      meaning: '本模型在原局结构条件下的财富潜力参考，尚非经过现实验证的终身净资产上限。',
    };
    // A1-A5 仅保留为内部结构分，公开等级最低 A6，避免被误读为现实资产的终身断言。
    var publicLevel = Math.max(6, level);
    var wealthContinuitySource = [
      Number(resource.visibleCount) > 0 ? '财星透干' : Number(resource.hiddenCount) > 0 ? '财星藏支' : '财星不显',
      list(quality.roots).length ? '财星有根' : '根气不足',
      list(quality.sources).length ? '有生财来源' : '生财来源不集中',
      list(quality.restraints).length ? '同时受到制约' : '',
    ].filter(Boolean).join('、') + '。';
    var wealthContinuityText = Number(resource.visibleCount) > 0 && list(quality.roots).length
      ? '收入机会比较容易被看见，也有条件持续承接；真正拉开差距的关键，是把已经出现的客户、职位或项目做成重复收入，而不是只等偶然机会。'
      : Number(resource.visibleCount) > 0
        ? '赚钱机会来得比较直接，但持续性弱于机会本身；常见表现是阶段进账明显，后续能否续上，要看客户复购、项目延续或职位稳定性。'
        : Number(resource.hiddenCount) > 0
          ? '赚钱能力并非没有，但平时不一定直接表现为高收入；当工作平台、客户资源或相关岁运把财星引出来时，收入才更容易出现明显变化。'
          : '原局财星不显，财富增长更依赖后天建立稳定职业、产品、客户或经营模式，单靠等待机会很难形成持续放大。';
    var windows = wealth.fortuneWindows || {};
    var windowVerdicts = [];
    if (windows.adultBest) {
      var adult = windows.adultBest;
      windowVerdicts.push(narrativeVerdict('值得核对的成年财富窗口', '', ['WEALTH_ADULT_WINDOW:' + adult.label], {
        sourceText: adult.startYear + '—' + adult.endYear + '年走' + adult.label + '大运，按原局喜忌、该运与原局互动及财富领域引动综合为“' + adult.wealthDirection + '”。',
        outcomeText: adult.startAge + '—' + adult.endAge + '岁更适合核对职业、经营、客户或资产是否已经形成承载条件；这一步运更有机会接近原局A' + publicLevel + '模型潜力对应的条件，但不代表必然达到。',
      }));
    } else if (windows.available) {
      windowVerdicts.push(narrativeVerdict('成年财富兑现窗口', '', ['WEALTH_ADULT_WINDOW:LIMITED'], {
        sourceText: '现有大运逐步核对后，没有同时满足“成年阶段、财富领域偏有利、原局互动验证为正”的明确窗口。',
        outcomeText: '原局A' + publicLevel + '仍是模型潜力参考，目前不能指定某一步大运一定兑现；职业、经营或资产载体形成后，可结合真实收入复核。',
      }));
    }
    if (windows.earlyFoundation) {
      var early = windows.earlyFoundation;
      windowVerdicts.push(narrativeVerdict('早年好运如何理解', '', ['WEALTH_EARLY_WINDOW:' + early.label], {
        sourceText: early.startYear + '—' + early.endYear + '年走' + early.label + '大运，年龄处于' + early.stageLabel + '。',
        outcomeText: '这段窗口只用于核对家庭支持、教育条件、见识、技能和起步资源，不能把原局A' + publicLevel + '参考写成当时已经拥有的个人财富。',
      }));
    }
    return {
      grade: 'A' + publicLevel,
      ceiling: ceilingComponents,
      level: '',
      difficulty: '',
      headline: headline,
      painPoint: painPoint,
      paragraphs: [],
      verdicts: [
        narrativeVerdict('财富量级与总判断', '', [
          'WEALTH_OCCURRENCE:' + (resource.state || 'unknown'),
          'WEALTH_CAPACITY:' + (capacity.state || 'unknown'),
        ], {
          sourceText: '财星在原局中' + (Number(resource.visibleCount) > 0 ? '透干显现' : Number(resource.hiddenCount) > 0 ? '藏于地支' : '没有明显显现') + '；日主旺衰与财星喜忌综合后，财富承载状态为“' + (capacity.state || '中间状态') + '”。', outcomeText: totalText,
        }),
        narrativeVerdict('钱主要从哪里来', '', scalePaths.length ? scalePaths.map(function (row) { return 'WEALTH_PATH:' + textOf(row.type || row); }) : ['WEALTH_PATH:FALLBACK'], {
          sourceText: (scalePaths.length ? '命局形成' + scalePaths.map(function (row) { return textOf(row.type || row); }).join('、') + '。' : '原局没有形成单一高权重财富链。') + (storageSourceText.length ? ' ' + storageContributions.filter(function (item) { return item.source; }).map(function (item) { return item.basis; }).join('；') + '。' : ''), outcomeText: sourceOutcome,
        }),
        narrativeVerdict('收入能不能持续放大', '', ['WEALTH_QUALITY:CONTINUITY'], {
          sourceText: wealthContinuitySource,
          outcomeText: wealthContinuityText,
        }),
        narrativeVerdict('钱能不能留下', '', (retentionRisks.length ? retentionRisks.map(function (row) { return 'WEALTH_RETENTION:' + textOf(row.type || row); }) : ['WEALTH_RETENTION:CLEAR']).concat(['WEALTH_STORAGE:' + (wealth.storage && wealth.storage.activated ? 'activated' : hasFinancialStorage ? 'present' : 'absent')]), {
          sourceText: (retentionRisks.length ? '原局存在' + retentionRisks.map(function (row) { return textOf(row.type || row); }).join('、') + '等财富留存证据。' : '原局未见明确财富留存风险。') + (storageFacts.length ? ' ' + storageFacts.join('；') + '。' : ''), outcomeText: retentionOutcome,
        }),
        narrativeVerdict('哪里更容易打开财路', '', direction.conflict ? ['WEALTH_DIRECTION:UNFOCUSED'] : ['WEALTH_DIRECTION:' + direction.element], {
          sourceText: directionSource, outcomeText: directionText,
        }),
      ].concat(windowVerdicts),
      note: 'A等级是原局模型潜力参考，不是现实终身财富上限；兑现条件包括成年大运与实际职业、经营和资源。',
    };
  }

  function studySignalScore(fact) {
    if (!fact) return 0;
    var points = ({ strong: 1.25, medium: 0.75, limited: 0.25 })[fact.confidence] || 0.5;
    if (/待建立|拉扯|需转化|规则切换|吃力|不足/.test(textOf(fact.state))) points -= 0.5;
    return Math.max(0, points);
  }

  function publicStudyBand(level) {
    if (level >= 8) return { key: 'high', label: '高学历' };
    if (level >= 4) return { key: 'ordinary', label: '普通学历' };
    return { key: 'low', label: '低学历' };
  }

  function studyLevelText(level) {
    return level >= 8 ? '学习结构中的支持条件较集中，可重点观察系统学习与持续深造的适配性。'
      : level >= 6 ? '学习结构有一定承接条件，长期投入、输出练习与现实基础需要配合。'
      : level >= 4 ? '学习支持与限制并见，可优先识别最影响持续投入的环节。'
      : '当前学习结构中的支持条件较少，适合进一步核对环境、兴趣与练习方式；不能由此认定学习能力低。';
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
    var publicBand = publicStudyBand(level);
    // Cached reports can retain the former L1–L10 label strings.  The public
    // label must always be recalculated from the retained internal rank.
    var levelLabel = level >= 8 ? '深造支持较集中' : level >= 4 ? '学习条件有待配合' : '学习支持需补充';
    var levelOutcome = studyLevelText(level);
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
    var headline = levelOutcome;
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
        outcomeText: '本项传统结构线索：'+studyStateText(key, fact)+' 是否符合你的实际学习表现，需要用练习、成绩与学习经历核对。',
      });
    }
    var verdicts = [
      narrativeVerdict('学习与深造潜力', '', list(band.basis).length ? band.basis : ['STUDY_BAND:L' + level], {
        sourceText: '综合学习结构、四项条件与已确认阻断后，结构参考为“' + levelLabel + '”。',
        outcomeText: levelLabel + '：' + levelOutcome + '这属于结构参考，不能据此确定本科、研究生或其他实际学历。',
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
      '七杀': '夫妻宫主气对应七杀，可取象为做事更果断、要求更高，也更习惯自己掌握节奏',
      '正官': '夫妻宫主气对应正官，可取象为重规则、名分和责任，对伴侣也有明确标准',
      '食神': '夫妻宫主气对应食神，可取象为性格较温和，会照顾生活感受，也在意两个人相处得舒不舒服',
      '伤官': '夫妻宫主气对应伤官，可取象为表达直接、自我意识强，不喜欢被固定规矩束缚',
      '正财': '夫妻宫主气对应正财，可取象为务实、会安排生活，也比较重视稳定和秩序',
      '偏财': '夫妻宫主气对应偏财，可取象为擅长与人打交道，对机会和现实资源也更敏感',
      '正印': '夫妻宫主气对应正印，可取象为较温和体贴，重视安全感和精神支持，但也容易照顾得过多',
      '偏印': '夫妻宫主气对应偏印，可取象为观察细、有自己的想法，很多情绪不会马上说出来，也需要个人空间',
      '比肩': '夫妻宫主气对应比肩，可取象为独立、自尊心强，希望两个人平等，不愿长期处于弱势',
      '劫财': '夫妻宫主气对应劫财，可取象为行动力强、爱憎分明，发生分歧时也更容易争主导权',
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
    var personalityText = '传统相处画像线索：'+branchProfile[0] + '。' + (roleProfiles[mainHidden && mainHidden.role] || '夫妻宫主气让这些特点更明显') + '。';
    if (secondaryHidden.length) personalityText += '夫妻宫里同时还藏有' + secondaryHidden.map(function (row) { return row.role; }).join('、') + '，可补充观察' + secondaryHidden.map(function (row) { return secondaryRoleCopies[row.role] || '不轻易外露'; }).join('、') + '的一面。';
    var interactionTexts = {
      '夫妻宫生身':'这组关系线索偏向接受支持与回应，可观察双方如何表达照顾和需要。',
      '命主生夫妻宫':'这组关系线索偏向投入与付出，可观察照顾和责任是否形成双方认可的分工。',
      '命主克夫妻宫':'这组关系线索偏向主动安排与边界，可观察重要决定是否经过协商。',
      '夫妻宫克身':'这组关系线索偏向对要求与责任的回应，可观察共同目标与个人节奏如何协调。',
      '干支同类':'这组关系线索偏向平等与自主，可观察双方意见相近和不同的时候如何协商。'
    };
    var marriageEffectText = '配偶星五行为'+textOf(quality.elementRole || '中性')+'，用于判断结构中的支持或负担方向；资源支持、责任分担和情感亲密需要分别核对，不能据喜忌给现实伴侣判好坏。';
    var positionMap = { outside_or_early:'year', work_or_local:'month', close_circle:'day', later_or_distant:'hour' };
    var positionSignal = relationship.distance && relationship.distance.tendency;
    var positions = list(spouseStar.occurrences).map(function(o) { return o.pillar; }).filter(Boolean);
    var uniquePositions = positions.filter(function(p,i) { return positions.indexOf(p) === i; });
    var firstPosition = positionSignal === 'unclear' ? 'unknown' : positionMap[positionSignal] || (uniquePositions.length === 1 ? uniquePositions[0] : 'unknown');
    var distanceCopies = { year: '原有生活圈之外、长辈关系圈或较早阶段', month: '工作、学习、同事同学或熟人圈', day: '身边长期接触、关系基础较近的圈层', hour: '后期工作圈、异地或人生较晚阶段' };
    var distanceCopy = distanceCopies[firstPosition] || '';
    var ageUnclear = !relationship.age || !relationship.age.tendency || relationship.age.tendency === 'unclear';
    var ageCopy = ageUnclear ? '年龄线索未集中，当前不指定年长、年幼或同龄，也不用心理成熟度替代年龄判断。' : relationship.age && relationship.age.tendency === 'older_tendency'
      ? '配偶年龄更容易略大，或即使年龄接近，心理成熟度和现实经验也更强。'
      : relationship.age && relationship.age.tendency === 'younger_tendency'
        ? '配偶年龄更容易略小，或在性格和生活阶段上显得更年轻。'
        : '配偶年龄以与命主相仿为主，也可能只是略年长、表现得更成熟。';
    var appearanceText = textOf(relationship.appearance && relationship.appearance.conclusion) || '外形线索不足，不由单一地支补定五官、身高或体型。';
    var eventVerdicts = [];
    var seenEvents = {};
    list(palace.dayInvolvingEvents).forEach(function(row) {
      var type = textOf(row && row.type);
      var key = type+':'+textOf(row.source)+':'+textOf(row.target);
      if (!type || seenEvents[key]) return;
      seenEvents[key] = true;
      var stemEvent = /天干|五合/.test(type);
      if (stemEvent) {
        var other = list(row.pillars).filter(function(p) { return p !== 'day'; })[0];
        var related = list(spouseStar.occurrences).some(function(o) {
          return o.pillar === other && o.layer === '天干' && (!o.gan || textOf(row).indexOf(o.gan) >= 0);
        });
        if (!related) return;
      }
      var eventSource = [textOf(row.source),textOf(row.target)].filter(Boolean).join('与')+'形成'+type;
      if (list(row.elements).length) eventSource += '（'+list(row.elements).map(textOf).join('、')+'）';
      var theme = /冲/.test(type) ? '个人节奏与共同安排'
        : /刑/.test(type) ? '反复出现的分歧与边界'
        : /害/.test(type) ? '未说清的期待与沟通'
        : /合|会/.test(type) ? '关系参与和共同计划' : '决策与责任分配';
      eventVerdicts.push(narrativeVerdict('关系线索·'+type,'',['PALACE_EVENT:'+key],{
        sourceText:eventSource+'；夫妻宫五行为'+textOf(palace.elementRole || '中性')+'。',
        outcomeText:'这项结构适合观察“'+theme+'”。它不能单独确认争吵、分居、亲密或分合；需要与配偶星、其他作用及现实相处一起核对。'+(/合|会/.test(type) ? '合会只列结构联系，是否成化及有利方向须另有有效裁决，不能仅凭合就断和睦。' : '')
      }));
    });
    var relationshipLandingSource = [
      textOf(quality.visibility),
      typeof quality.rooted === 'boolean' ? (quality.rooted ? '配偶星有根' : '配偶星根气不足') : '',
      textOf(quality.rolePurity),
    ].filter(Boolean).join('、') + '。';
    var hasExposedSpouse = list(spouseStar.exposed).length > 0 || /透干|透藏并见/.test(textOf(quality.visibility));
    var relationshipLandingText = hasExposedSpouse && quality.rooted
      ? '配偶星透出且有根，显现与承载两项条件同时存在，可作为关注关系落地的结构线索；是否遇到对象、是否稳定相处仍需现实状态与岁运支持。'
      : hasExposedSpouse
        ? '配偶星有透出线索，但根气承载尚不足；显现与稳定是两项条件，不能由透干单独确认感情机会已经出现。'
        : list(spouseStar.occurrences).length
          ? '配偶星以藏干线索为主，当前不能直接确定关系出现的方式与时间，可结合显现条件和实际接触情况再核对。'
          : '原局配偶星不显，这条线索不足以确定关系节奏；不能据此断晚婚、没有对象或推进缓慢。';
    return {
      hideScore: true,
      headline: interactionTexts[interaction.direction] || textOf(interaction.conclusion),
      painPoint: marriageEffectText,
      paragraphs: [],
      verdicts: [
        narrativeVerdict('夫妻主导关系', interactionTexts[interaction.direction] || textOf(interaction.conclusion), ['DAY_PILLAR_INTERACTION:' + (interaction.direction || 'unknown')]),
        narrativeVerdict('配偶性格', personalityText, ['SPOUSE_PALACE:' + (palace.zhi || 'unknown'), 'PALACE_MAIN_ROLE:' + (mainHidden && mainHidden.role || 'unknown')]),
        narrativeVerdict('婚后作用', marriageEffectText, ['SPOUSE_STAR_ROLE:' + (quality.elementRole || 'neutral')]),
        narrativeVerdict('认识渠道', distanceCopy ? '位置取象偏向'+distanceCopy+'。这是认识场景的弱线索，需要现实接触经历核对。' : '位置线索分散，暂不能锁定工作圈、熟人介绍或异地等认识渠道。', ['SPOUSE_STAR_POSITION:' + firstPosition]),
        narrativeVerdict('缘分是否容易落地', '', ['SPOUSE_STAR_QUALITY:' + (quality.visibility || 'unknown')], {
          sourceText: relationshipLandingSource,
          outcomeText: relationshipLandingText,
        }),
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
      return sourceLabel + activation.movingBranch + '冲夫妻宫' + activation.palaceBranch + '。夫妻宫本身为忌神，引动它的岁运支为' + activation.movingRole + '，所以原来让你觉得被管得多、明明相处不舒服却一直拖着的状态，有机会在这段时间被打破；但“冲”本身仍代表明显变化，可能先经历争吵、分开或重新决定关系，再看到改善。';
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
    var prioritized = prioritizedTimingInteractions(interactions);
    if (prioritized.some(function (row) {
      return !row || row.direction === 'mixed' || row.direction === 'unknown' || !row.direction;
    })) return '变化明显、好坏暂不能定';
    var decisive = prioritized.filter(function (row) {
      return row && (row.direction === 'favorable' || row.direction === 'adverse');
    });
    if (!decisive.length) return '平稳延续';
    var favorable = decisive.filter(function (row) { return row.direction === 'favorable'; }).length;
    var adverse = decisive.filter(function (row) { return row.direction === 'adverse'; }).length;
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

  function prioritizedTimingInteractions(interactions) {
    var rows = sortedTimingInteractions(interactions);
    if (!rows.length) return [];
    var highest = rows.reduce(function (priority, row) {
      return Math.max(priority, timingInteractionPriority(row));
    }, 0);
    return rows.filter(function (row) { return timingInteractionPriority(row) === highest; });
  }

  function timingInteractionStableKey(row) {
    row = row || {};
    var domains = list(row.domains).map(textOf).filter(Boolean).sort().join(',');
    return [row.source, row.type, row.id, row.layer, row.formationStatus,
      row.targetPillar, row.targetLabel, row.targetRole, row.actor, row.actorRole,
      row.target, row.movingBranch, row.movingRole, row.palaceBranch, row.palaceRole,
      row.formedElement, row.formedRole, row.direction, domains, row.sourceText]
      .map(textOf).join('|');
  }

  function sortedTimingInteractions(interactions) {
    return list(interactions).slice().sort(function (a, b) {
      return timingInteractionPriority(b) - timingInteractionPriority(a) ||
        timingInteractionStableKey(a).localeCompare(timingInteractionStableKey(b), 'zh-CN');
    });
  }

  function publicTimingInteractions(interactions) {
    return sortedTimingInteractions(interactions).filter(function (row) {
      if (!row) return false;
      if (row.direction === 'favorable' || row.direction === 'adverse') return true;
      var domains = list(row.domains);
      return !(domains.length === 1 && domains[0] === 'study');
    });
  }

  function timingInteractionOutcome(row) {
    row = row || {};
    var domains = list(row.domains);
    if (domains.indexOf('relationship') >= 0) {
      if (row.type === '六冲' && row.direction === 'favorable') return '原来让你被管得多、明明相处不舒服却一直拖着的状态更容易被打破；但通常会先经历争吵、分开或重新决定关系。';
      if (row.type === '六冲' && row.direction === 'adverse') return '感情稳定基础被打乱，两个人更容易争吵、分开住、聚少离多，或者重新考虑这段关系。';
      if (row.type === '六冲') return '夫妻宫被冲，关系或共同生活会出现明显变化和拉扯；现有喜忌不足，所以只能确定关系会动，好坏暂不能定。';
      if (row.type === '刑') return '两个人更容易互不服气，同一个问题反复争执，旧账也容易重新被翻出来。';
      if (row.type === '六害') return '不满更容易憋在心里，久了会出现误会、怀疑、不信任或表面不吵但逐渐冷淡。';
      if (/合|会/.test(row.type) && row.direction === 'favorable') return '两个人更容易靠近，关系确认、共同生活或未来安排会更容易稳定推进。';
      if (/合|会/.test(row.type) && row.direction === 'adverse') return '两个人的联系会变紧，但也更容易出现明明相处不开心、又迟迟分不开；短暂靠近以后又冷下来。';
    }
    if (domains.indexOf('wealth') >= 0) {
      if (row.direction === 'favorable' && row.type === '六冲') return '原来卡住收入或资产流动的部分被打破，进账、资金周转或资产调整更容易出现实质变化，但过程会先有波动。';
      if (row.direction === 'favorable') return '这一年更容易看到实际进账，项目回款会更顺，手里的钱也更有机会存下来或变成资产。';
      if (row.direction === 'adverse') return '这一年钱不是完全进不来，而是花出去得更快。项目垫款、家庭支出或合作分钱会增加，账面流水看着不少，最后真正留下的钱反而容易减少。';
      return '收入、支出或资产安排会发生变化，但现有证据不足以确定最后增加还是减少。';
    }
    if (domains.indexOf('career') >= 0) {
      return row.direction === 'favorable'
        ? '工作上更容易接到重要任务，事情推进得比平时快。做出的成绩也更容易被领导或客户看见，职位、权限或收入有机会跟着往上动。'
        : row.direction === 'adverse'
          ? /刑/.test(row.type || '')
            ? '工作里同一个问题容易反复出现，沟通不顺、临时改要求和返工会增多。人会比平时更忙，但结果出来得更慢。'
            : '工作安排容易临时改变，上级要求、项目进度或同事配合会让你来回返工。花的时间会增加，结果却容易晚一步出来。'
          : '';
    }
    if (domains.indexOf('study') >= 0) {
      return row.direction === 'favorable'
        ? '这一年学习和考试更容易出成绩，复习过的内容能真正用得上。考证、考试或作品评比，更容易拿到看得见的结果。'
        : row.direction === 'adverse'
          ? '学习容易被工作和杂事打断，复习节奏不稳。考试时也容易因为分心、时间不够，把原本会做的题做错，成绩低于真实水平。'
          : '';
    }
    if (row.direction === 'favorable') return '原来卡住的事情更容易往前推进，拖着不定的事更容易定下来，也更容易拿到看得见的结果。';
    if (row.direction === 'adverse') return '事情更容易被临时变化打断，原本一次能做完的事会多跑几趟、多等一阵，结果也更容易反复。';
    return '该领域会出现明显变化和拉扯，但好坏暂不能定。';
  }

  function uniqueTimingTexts(rows) {
    var seen = {};
    return list(rows).map(textOf).filter(function (value) {
      var key = value.replace(/\s+/g, '');
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function timingDomainVerdicts(interactions) {
    var labels = {
      relationship: '感情和相处', wealth: '钱和收入', career: '工作和职位',
      study: '学习和考试', wellbeing: '身体和作息', health: '身体和作息', general: '这一年的现实变化',
    };
    var groups = {};
    publicTimingInteractions(interactions).forEach(function (interaction) {
      var domains = list(interaction && interaction.domains).map(function (domain) {
        return domain === 'wellbeing' ? 'health' : domain;
      }).filter(function (domain) { return labels[domain]; }).filter(function (domain, index, rows) {
        return rows.indexOf(domain) === index;
      }).filter(function (domain) {
        return domain !== 'study' || interaction.direction === 'favorable' || interaction.direction === 'adverse';
      }).sort();
      if (!domains.length) domains = ['general'];
      domains.forEach(function (domain) {
        if (!groups[domain]) groups[domain] = { domains: [domain], rows: [] };
        groups[domain].rows.push(interaction);
      });
    });
    var domainOrder = ['relationship', 'career', 'wealth', 'study', 'health', 'general'];
    return Object.keys(groups).sort(function (a, b) {
      return domainOrder.indexOf(a) - domainOrder.indexOf(b);
    }).map(function (key) {
      var group = groups[key];
      var title = group.domains.length === 1 && group.domains[0] === 'general'
        ? '其他明显变化'
        : group.domains.map(function (domain) { return labels[domain]; }).join('、') + '会怎么变';
      return narrativeVerdict(title, '', group.rows.map(function (row) {
        return 'ANNUAL_INTERACTION:' + (row.id || row.type);
      }), {
        sourceText: uniqueTimingTexts(group.rows.map(function (row) { return row && row.sourceText; })).join(' '),
        outcomeText: uniqueTimingTexts(group.rows.map(function (row) {
          return timingInteractionOutcome(Object.assign({}, row, { domains: group.domains }));
        })).join(' '),
      });
    });
  }

  function timingDomainHeadline(interactions, directionLabel) {
    var labels = { relationship: '感情', wealth: '钱和收入', career: '工作', study: '学习和考试', wellbeing: '身体状态', health: '身体状态' };
    var domains = [];
    list(interactions).forEach(function (interaction) {
      list(interaction && interaction.domains).forEach(function (domain) {
        if (domain === 'study' && interaction.direction !== 'favorable' && interaction.direction !== 'adverse') return;
        var label = labels[domain];
        if (label && domains.indexOf(label) < 0) domains.push(label);
      });
    });
    var subject = domains.length ? domains.join('、') : '现实安排';
    var directionText = directionLabel === '偏有利'
      ? '结果偏有利'
      : directionLabel === '偏不利'
        ? '结果偏不利'
        : directionLabel === '有利与压力并见'
          ? '有进展，也有明显压力'
          : '变化会很明显，但好坏暂时不能定';
    return subject + '是今年变化最明显的地方，' + directionText + '。';
  }

  function aggregateFiveYearOutcomes(rows) {
    var groups = [];
    list(rows).forEach(function (row) {
      list(row && row.priorityOutcomes).forEach(function (outcome) {
        var existing = groups.filter(function (group) { return group.outcome === outcome; })[0];
        if (!existing) {
          existing = { outcome: outcome, years: [] };
          groups.push(existing);
        }
        if (existing.years.indexOf(row.year) < 0) existing.years.push(row.year);
      });
    });
    return groups.map(function (group) {
      return group.years.join('、') + '年：' + group.outcome;
    }).join(' ');
  }

  function daYunStatusLabel(year) {
    if (year && year.daYun) return textOf(year.daYun.gan) + textOf(year.daYun.zhi) + '大运';
    if (year && year.daYunStatus === 'before_start') return '起运前（仅按流年与原局）';
    if (year && year.daYunStatus === 'out_of_range') return '大运范围待延展（仅按流年与原局）';
    if (year && year.daYunStatus === 'unknown_birth') return '出生时间未定位（仅按流年与原局）';
    if (year && year.daYunStatus === 'calculation_unavailable') return '大运计算暂不可用（仅按流年与原局）';
    return '未纳入大运';
  }

  function annualRiskNarrative(risk) {
    var type = textOf(risk && risk.type);
    var known = {
      '伤官见官': {
        title: '本年被引动的风险点·伤官见官',
        sourceText: '本年伤官与正官同时出现的关系被引动。',
        outcomeText: '工作里更容易和上级、规则或流程顶起来；说得太直接、按自己的方法做事时，返工或被挑问题的情况会变多。',
      },
      '财破印': {
        title: '本年被引动的风险点·财破印',
        sourceText: '本年财星克印星的关系被引动。',
        outcomeText: '赚钱、感情或现实事务更容易打断学习、考证或原来的准备；关键阶段常会出现计划临时改掉、时间被别的事占走的情况。',
      },
      '财坏印': {
        title: '本年被引动的风险点·财坏印',
        sourceText: '本年财星克印星的关系被引动。',
        outcomeText: '赚钱、感情或现实事务更容易打断学习、考证或原来的准备；关键阶段常会出现计划临时改掉、时间被别的事占走的情况。',
      },
      '枭夺食': {
        title: '本年被引动的风险点·枭夺食',
        sourceText: '本年偏印克食神的关系被引动。',
        outcomeText: '这一年容易想得很多，却很难把想法稳定做成成果；学习、创作或项目交付时，反复推翻和卡住的情况会更多。',
      },
      '官杀混杂': {
        title: '本年工作要求更容易互相打架',
        sourceText: '本年正官与七杀同时出现的关系被引动。',
        outcomeText: '上级、规则或任务要求一会儿一个标准，做事时容易不知道该先顾哪一头，也更容易被不同的人催不同的事。',
      },
      '杀重无制': {
        title: '本年任务和考核更容易压到一起',
        sourceText: '本年七杀压力增加、缺少制化的信号被引动。',
        outcomeText: '任务、考核和催促容易压到一起，事情赶得很急；越想一次性全扛住，越容易出现遗漏、返工或睡不好。',
      },
      '关键用神/格局节点受冲': {
        title: '本年关键支撑点更容易被打乱',
        sourceText: '本年原局关键用神或格局节点受到冲动。',
        outcomeText: '原本最能撑住你的一个环节容易被打乱，工作、学习或生活安排里常会有一件原来顺手的事突然不好推进。',
      },
      '承载不足': {
        title: '本年机会和责任同时变多',
        sourceText: '本年出现需要垫钱、扛责任或投入更多时间的信号。',
        outcomeText: '机会一多，可能要先垫钱、接更多事或把时间全压进去；账面进账变大，手里能留下的钱未必同步增加。',
      },
      '身弱不担财': {
        title: '本年钱和责任更容易压到一起',
        sourceText: '本年财务机会超过现有支撑的信号被引动。',
        outcomeText: '项目、客户或收入机会一多，往往也要同时投入更多钱和精力；容易出现事情接得太多、最后顾不过来的情况。',
      },
      '比劫分流': {
        title: '本年合作分钱的情况更明显',
        sourceText: '本年合作与分配的信号被引动。',
        outcomeText: '一起做事时，客户、项目和收入更容易需要多人分；进账增加以后，真正落到自己手里的部分不一定同比增加。',
      },
      '财党杀': {
        title: '本年钱和责任更容易一起来',
        sourceText: '本年财富机会与责任同时增加的信号被引动。',
        outcomeText: '收入或项目变多时，上级要求、交付压力和要承担的责任也会一起变多，容易忙起来却没有留下多少空余。',
      },
      '财印冲': {
        title: '本年赚钱和原有准备容易顾此失彼',
        sourceText: '本年财星与印星相冲的关系被引动。',
        outcomeText: '赚钱和学习、考证或原有支持很难同时顾好：顾着项目时，考证、学习或原有安排就可能被推后。',
      },
      '官印冲': {
        title: '本年工作要求和原有安排容易撞在一起',
        sourceText: '本年官星与印星相冲的关系被引动。',
        outcomeText: '工作要求和自己的学习、证书或原有安排容易撞在一起；临时加的任务多时，原本排好的学习和生活节奏容易被打断。',
      },
    };
    var copy = known[type] || {
      title: '本年被引动的风险点',
      sourceText: '本年有一项风险信号被引动。',
      outcomeText: '本年有风险信号被引动，但现有事实不足以细分具体表现。',
    };
    var evidenceText = annualRiskEvidenceText(risk, Boolean(known[type]));
    if (evidenceText) copy = Object.assign({}, copy, { sourceText: evidenceText });
    return copy;
  }

  function annualRiskEvidenceText(risk, knownType) {
    if (!knownType) return '';
    var candidates = [risk && risk.why, risk && risk.triggerHint, risk && risk.partyEvidence]
      .concat(list(risk && risk.evidence).map(function (item) { return textOf(item && (item.text || item)); }));
    // Risk evidence is an internal trace.  Only a positively verified branch
    // relation may cross the public boundary; everything else uses the known
    // risk's fixed, customer-facing source text.
    return annualRiskRelationEvidence(candidates);
  }

  function annualRiskRelationEvidence(candidates) {
    var branches = '子丑寅卯辰巳午未申酉戌亥';
    var branchBreak = { '子酉': 1, '酉子': 1, '卯午': 1, '午卯': 1, '辰丑': 1, '丑辰': 1, '未戌': 1, '戌未': 1, '寅亥': 1, '亥寅': 1, '巳申': 1, '申巳': 1 };
    var pairs = [
      { type: '六冲', valid: function (a, b) { return BRANCH_CLASH[a] === b; }, plain: '原先固定的安排更容易被打乱。' },
      { type: '六合', valid: function (a, b) { return BRANCH_COMBINE[a] === b; }, plain: '原本分开的事情更容易绑在一起处理。' },
      { type: '六害', valid: function (a, b) { return BRANCH_HARM[a] === b; }, plain: '不容易当面说开的别扭更容易慢慢累积。' },
      { type: '刑', valid: function (a, b) { return Boolean(BRANCH_PUNISH[a + b]); }, plain: '同一件事更容易反复卡住，或因小问题起争执。' },
      { type: '破', valid: function (a, b) { return Boolean(branchBreak[a + b]); }, plain: '原来好用的安排更容易出现缺口，需要重新调整。' },
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var text = textOf(candidates[i]).replace(/\s+/g, '');
      for (var j = 0; j < pairs.length; j += 1) {
        var pair = pairs[j];
        var labelPattern = pair.type === '破' ? '(?:六破|破)' : pair.type;
        var after = text.match(new RegExp(labelPattern + '([' + branches + '])([' + branches + '])'));
        var before = text.match(new RegExp('([' + branches + '])([' + branches + '])' + labelPattern));
        var match = after || before;
        if (match && pair.valid(match[1], match[2])) {
          return '原局' + match[1] + '与' + match[2] + '形成' + pair.type + '，' + pair.plain;
        }
      }
    }
    return '';
  }

  function annualRiskCopies(risks, lifeContext) {
    var seen = {};
    return list(risks).map(function (risk) {
      var copy = Object.assign({}, annualRiskNarrative(risk), { basisRisk: textOf(risk) });
      if (lifeContext && !lifeContext.studyRelevant && ['财破印','财坏印'].indexOf(textOf(risk && risk.type)) >= 0)
        copy.outcomeText = '现实事务与原有准备之间可能出现牵制；重点核对计划被打断、时间被占用等情况，不据此推断考试结果。';
      return copy;
    }).filter(function (copy) {
      var key = [copy.title, copy.sourceText, copy.outcomeText].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function annualReliefCopies(reliefs, hasSupportedPressure, leadInteractions, leadDirection) {
    var seen = {};
    var leadDomains = list(leadInteractions).reduce(function (domains, interaction) {
      list(interaction && interaction.domains).forEach(function (domain) {
        if (domains.indexOf(domain) < 0) domains.push(domain);
      });
      return domains;
    }, []);
    var recognizedDomains = leadDomains.map(function (name) {
      return name === 'wellbeing' ? 'health' : name;
    }).filter(function (name) {
      return ['relationship', 'career', 'wealth', 'study', 'health'].indexOf(name) >= 0;
    }).filter(function (name, index, rows) { return rows.indexOf(name) === index; });
    var domain = recognizedDomains.length === 1 ? recognizedDomains[0] : 'general';
    if (domain === 'wellbeing') domain = 'health';
    var domainLead = {
      relationship: '双方仍有沟通和回转空间，关系上的紧张会缓和一些',
      career: '工作推进中的返工和摩擦会减轻一些',
      wealth: '资金占用和回款压力会减轻一些',
      study: '学习准备和考试节奏受到的干扰会减轻一些',
      health: '作息和身体状态受到的影响会减轻一些',
    }[domain] || '';
    var directionEnding = leadDirection === '偏有利'
      ? '风险仍然存在，但整体方向保持偏有利。'
      : leadDirection === '偏不利'
        ? '有所缓和，但不会翻转原本偏不利的方向。'
        : leadDirection === '有利与压力并见'
          ? '影响有所缓和，但有利与压力并见的原方向不变。'
          : '影响有所缓和，但原方向不变。';
    return list(reliefs).map(function (relief) {
      var type = textOf(relief && relief.type);
      var sourceText = type === '喜用岁运'
        ? '本年流年天干落在本命喜用范围，能给正在发生的事情增加一部分支撑。'
        : type === '结构风险救应'
          ? '本年被引动的风险同时见到可缓和条件。'
          : '本年同时出现一项可缓和当前变化的条件。';
      return {
        title: '本年已有缓和条件',
        sourceText: sourceText,
        outcomeText: domain === 'general'
          ? '影响有所缓和，但原方向不变。'
          : domain === 'relationship' && leadDirection === '偏不利'
            ? domainLead + '，但不会把关系忽远忽近或重新考虑是否继续的变化完全消除，也不会翻转原本偏不利的方向。'
            : domainLead + '；' + directionEnding,
      };
    }).filter(function (copy) {
      var key = [copy.sourceText, copy.outcomeText].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function buildCurrentYearNarrative(facts) {
    var year = facts && facts.currentYear || {};
    if (year.reportReconciliation) return reviewedAnnualNarrative(year);
    var interactions = publicTimingInteractions(year.interactions);
    var riskCopies = annualRiskCopies(year.triggeredRisks, year.lifeContext);
    var hasTriggeredRisk = riskCopies.length > 0;
    var directionLabel = timingDirectionLabel(interactions);
    var decisiveInteractions = prioritizedTimingInteractions(interactions);
    var decisiveOutcome = uniqueTimingTexts(timingDomainVerdicts(decisiveInteractions).map(function (row) {
      return row.outcomeText;
    })).join(' ');
    var reliefCopies = interactions.length || hasTriggeredRisk
      ? annualReliefCopies(year.reliefs, directionLabel === '偏不利' || hasTriggeredRisk, decisiveInteractions, directionLabel)
      : [];
    var pillarText = textOf(year.pillar && year.pillar.gan) + textOf(year.pillar && year.pillar.zhi);
    var daYunText = daYunStatusLabel(year);
    var timingBasis = year && year.daYun
      ? '按流年、大运与原局的实际关系判断。'
      : '当前大运未纳入，只按流年与原局的实际关系判断。';
    var roleRows = [
      { label: '流年天干', role: year.stemRole },
      { label: '流年地支', role: year.branchRole },
    ].concat(year && year.daYun ? [
      { label: '大运天干', role: year.daYunStemRole },
      { label: '大运地支', role: year.daYunBranchRole },
    ] : []).filter(function (row) { return row.role && row.role !== '未纳入'; });
    var favorableRoles = roleRows.filter(function (row) { return row.role === '用神' || row.role === '喜神'; }).length;
    var adverseRoles = roleRows.filter(function (row) { return row.role === '忌神'; }).length;
    var roleOutcome = favorableRoles > adverseRoles
      ? '这一年的整体环境对你偏有帮助，做同样的事情更容易得到资源、配合或推进机会；但具体领域仍以真正发生的刑冲合害为准。'
      : adverseRoles > favorableRoles
        ? '这一年的整体环境更容易增加消耗、责任或反复，同样的目标往往要付出更多成本；若同时出现有利引动，局部事情仍然能够推进。'
        : favorableRoles || adverseRoles
          ? '这一年机会和压力同时存在，不能只按“吉年”或“凶年”概括；哪一件事更明显，要看岁运具体引动了哪些与你当前阶段相关的领域。'
          : '这一年的五行底色没有明显偏向，事情是否发生明显变化，主要取决于流年与原局形成的具体关系。';
    var headline = interactions.length
      ? timingDomainHeadline(decisiveInteractions, directionLabel)
      : hasTriggeredRisk
        ? '本年有风险信号被岁运触发，下面列出已有依据和可能出现的具体表现。'
        : '本年没有发现足以单独改变原局方向的强引动，当前规则暂未识别明确变化窗口，不能据此断现实一定平稳。';
    var verdicts = [narrativeVerdict('年度总体变化', '', ['ANNUAL_PILLAR:' + pillarText], {
      sourceText: '流年为' + (pillarText || '未定') + '，当前处于' + daYunText + '；' + timingBasis,
      outcomeText: headline,
    }), narrativeVerdict('今年的整体顺逆底色', '', ['ANNUAL_ROLE_BALANCE'], {
      sourceText: roleRows.map(function (row) { return row.label + '为' + row.role; }).join('，') + '。',
      outcomeText: roleOutcome,
    })];
    var adjudication = annualAdjudication(year);
    if (adjudication && adjudication.primaryEvent) {
      var primary = adjudication.primaryEvent;
      var stageText = adjudication.lifeStage && adjudication.lifeStage.label || '年龄阶段待核';
      var concreteEnough = !!primary.hasIndependentAnnualTrigger;
      verdicts.push(narrativeVerdict(primary.reportFeedback ? '结合往事反馈看今年' : concreteEnough ? '今年最可能应在哪件事' : '今年能锁定到什么程度', '', ['ANNUAL_EVENT:' + primary.domain], {
        sourceText: [stageText, textOf(primary.decisionBasis), list(primary.evidence).slice(0, 2).join('；')].filter(Boolean).join('。'),
        outcomeText: concreteEnough
          ? selectTimingScenario(primary, adjudication) + (primary.reportFeedback ? '' : '。这是今年最值得优先核对的现实事项。')
          : '目前只能锁定“' + primary.label + '”主题较活跃，还缺少独立的当年结构触发，不能硬说某件具体事情一定发生。',
      }));
      var secondary = adjudication.secondaryEvent;
      if (secondary && secondary.hasIndependentAnnualTrigger) {
        verdicts.push(narrativeVerdict('其次会被带动的方面', '', ['ANNUAL_EVENT_SECONDARY:' + secondary.domain], {
          sourceText: list(secondary.evidence).slice(0, 2).join('；'),
          outcomeText: selectTimingScenario(secondary, adjudication) + '。',
        }));
      }
    }
    // The adjudication layer has already selected the one primary and, at
    // most, one secondary real-world event.  Re-expanding every interaction
    // into another set of domain cards would recreate the old "everything
    // may happen" report and duplicate the selected events.  Keep the broad
    // domain fallback only for legacy/incomplete ledgers without a selection.
    if (!(adjudication && adjudication.primaryEvent)) {
      verdicts = verdicts.concat(timingDomainVerdicts(interactions));
    }
    var relationshipActivations = list(year.relationship && year.relationship.activations);
    if (!interactions.some(function (row) { return list(row.domains).indexOf('relationship') >= 0; })) {
      relationshipActivations.forEach(function (activation) {
        verdicts.push(narrativeVerdict((activation.source || '岁运') + '感情·' + (activation.type || '关系'), annualRelationshipActivationText(activation), ['ANNUAL_PALACE:' + (activation.source || '岁运') + ':' + (activation.type || '关系')]));
      });
    }
    riskCopies.forEach(function (riskCopy) {
      verdicts.push(narrativeVerdict(riskCopy.title, '', ['ANNUAL_RISK:' + riskCopy.basisRisk], {
        sourceText: riskCopy.sourceText,
        outcomeText: riskCopy.outcomeText,
      }));
    });
    reliefCopies.forEach(function (reliefCopy, index) {
      verdicts.push(narrativeVerdict(reliefCopy.title, '', ['ANNUAL_RELIEF:' + index], {
        sourceText: reliefCopy.sourceText,
        outcomeText: reliefCopy.outcomeText,
      }));
    });
    return {
      hideScore: true,
      headline: headline,
      painPoint: interactions.length
        ? directionLabel === '变化明显、好坏暂不能定'
          ? decisiveOutcome + ' 综合同级变化后，好坏暂不能定。'
          : decisiveOutcome
        : hasTriggeredRisk
          ? riskCopies[0].outcomeText
          : '没有强引动不等于没有事情发生，只表示这套规则暂未识别明确窗口。',
      paragraphs: [],
      verdicts: verdicts,
      note: year && year.daYun
        ? '以上年度结论依据流年、大运、原局喜忌及实际刑冲克害合化推演；未被岁运触发的原局信息不会被写成本年事件。'
        : '当前大运未纳入，只按流年与原局喜忌及实际刑冲克害合化推演；未被流年触发的原局信息不会被写成本年事件。',
    };
  }

  function buildFiveYearNarrative(facts) {
    var fiveYear = facts && facts.fiveYear || {};
    var sourceYears = list(fiveYear.years).slice().sort(function (a, b) {
      return Number(a && a.year) - Number(b && b.year);
    });
    var daYunInteractions = [];
    var seenDaYun = {};
    var daYunCounts = {};
    // Broad decade prose has no mechanism-level attribution. Once a year's interpretation
    // is revised, use the selected annual ledger throughout this five-year summary.
    var hasReview = sourceYears.some(function(year) { return !!year.reportReconciliation; });
    sourceYears.forEach(function (year) {
      if (hasReview) return;
      publicTimingInteractions(year && year.interactions).filter(function (row) {
        return row && row.source === '大运';
      }).forEach(function (row) {
        var key = timingInteractionStableKey(row);
        daYunCounts[key] = (daYunCounts[key] || 0) + 1;
      });
    });
    sourceYears.forEach(function (year) {
      if (hasReview) return;
      publicTimingInteractions(year && year.interactions).filter(function (row) {
        return row && row.source === '大运' && daYunCounts[timingInteractionStableKey(row)] > 1;
      }).forEach(function (row) {
        var key = timingInteractionStableKey(row);
        if (!seenDaYun[key]) {
          seenDaYun[key] = true;
          daYunInteractions.push(row);
        }
      });
    });
    var daYunVerdicts = timingDomainVerdicts(daYunInteractions);
    var daYunCommonVerdict = daYunVerdicts.length ? narrativeVerdict('这步大运的共同影响', '', ['FIVE_YEAR:DAYUN_BACKGROUND'], {
      sourceText: uniqueTimingTexts(daYunInteractions.map(function (row) { return row.sourceText; })).join(' '),
      outcomeText: uniqueTimingTexts(daYunVerdicts.map(function (row) { return row.outcomeText; })).join(' '),
    }) : null;
    var years = sourceYears.map(function (year) {
      if (year.reportReconciliation) return reviewedFiveYearRow(year);
      var interactions = publicTimingInteractions(year && year.interactions).filter(function (row) {
        return row && !(row.source === '大运' && daYunCounts[timingInteractionStableKey(row)] > 1);
      });
      var decisive = prioritizedTimingInteractions(interactions);
      var displaySelected = decisive.slice(0, 2);
      var legacyRelationship = !decisive.length ? list(year && year.relationship && year.relationship.activations) : [];
      var riskCopies = annualRiskCopies(year && year.triggeredRisks, year && year.lifeContext);
      var directionLabel = !interactions.length && riskCopies.length
        ? '风险已触发'
        : timingDirectionLabel(interactions);
      var reliefCopies = decisive.length || riskCopies.length
        ? annualReliefCopies(year && year.reliefs, directionLabel === '偏不利' || riskCopies.length > 0, decisive, directionLabel)
        : [];
      var decisiveOutcome = uniqueTimingTexts(timingDomainVerdicts(decisive).map(function (row) {
        return row.outcomeText;
      })).join(' ');
      var adjudication = annualAdjudication(year);
      var primaryEvent = adjudication && adjudication.primaryEvent;
      var eventOutcome = primaryEvent && primaryEvent.hasIndependentAnnualTrigger
        ? (primaryEvent.reportFeedback ? '结合往事反馈：' : '这一年最可能应在“' + primaryEvent.label + '”：') + selectTimingScenario(primaryEvent, adjudication) + '。'
        : primaryEvent
          ? '这一年的现实重心偏向“' + primaryEvent.label + '”，但缺少独立的当年结构触发，不硬断具体事件。'
          : '';
      var baseSummary = decisive.length
        ? decisiveOutcome
        : legacyRelationship.length
          ? legacyRelationship.map(annualRelationshipActivationText).join(' ')
          : riskCopies.length
            ? String(year && year.year || '') + '年未见强刑冲合，但有风险信号已被岁运触发。'
            : String(year && year.year || '') + '年没有发现足以改变原局方向的强引动，不能据此确认事业、资金和关系保持不变。';
      var summary = [eventOutcome, baseSummary]
        .concat(riskCopies.map(function (copy) { return copy.outcomeText; }))
        .concat(reliefCopies.map(function (copy) { return copy.outcomeText; }))
        .filter(Boolean).join(' ');
      return {
        year: year && year.year,
        pillar: textOf(year && year.pillar && year.pillar.gan) + textOf(year && year.pillar && year.pillar.zhi),
        daYunLabel: daYunStatusLabel(year),
        directionLabel: directionLabel,
        lifeStage: adjudication && adjudication.lifeStage && adjudication.lifeStage.label || '',
        primaryEventLabel: primaryEvent && primaryEvent.label || '',
        eventDirection: primaryEvent && primaryEvent.direction || '',
        hasIndependentAnnualTrigger: !!(primaryEvent && primaryEvent.hasIndependentAnnualTrigger),
        sourceText: displaySelected.map(function (row) { return textOf(row.sourceText); })
          .concat(primaryEvent ? list(primaryEvent.evidence).slice(0, 2) : [])
          .concat(riskCopies.map(function (copy) { return copy.sourceText; }))
          .concat(reliefCopies.map(function (copy) { return copy.sourceText; })).filter(Boolean).join(' '),
        summary: summary,
        prioritizedOutcome: decisive.length ? decisiveOutcome : baseSummary,
        priorityOutcomes: decisive.length ? uniqueTimingTexts(timingDomainVerdicts(decisive).map(function (row) {
          return row.outcomeText;
        })) : [],
        priority: decisive.length ? timingInteractionPriority(decisive[0]) : 0,
        priorityCount: decisive.length,
        riskTriggered: riskCopies.length > 0,
      };
    });
    var strongest = years.slice().sort(function (a, b) {
      return b.priority - a.priority || b.priorityCount - a.priorityCount || a.year - b.year;
    })[0];
    var highestPriority = strongest ? strongest.priority : 0;
    var highestCount = strongest ? strongest.priorityCount : 0;
    var highestYears = highestPriority ? years.filter(function (row) {
      return row.priority === highestPriority && row.priorityCount === highestCount;
    }) : [];
    var highestLabels = highestYears.map(function (row) { return row.directionLabel; });
    var overallDirection = highestLabels.some(function (label) {
      return label === '变化明显、好坏暂不能定' || label === '有利与压力并见';
    }) ? '变化明显、好坏暂不能定'
      : highestLabels.indexOf('偏有利') >= 0 && highestLabels.indexOf('偏不利') >= 0
        ? '有利与压力并见'
        : highestLabels[0] || '未见突出窗口';
    var highestOutcome = aggregateFiveYearOutcomes(highestYears);
    var adverseYears = highestYears.filter(function (row) { return row.directionLabel === '偏不利'; });
    var riskYears = years.filter(function (row) { return row.riskTriggered; });
    var allDaYunActive = sourceYears.length > 0 && sourceYears.every(function (year) {
      return year && year.daYun && year.daYunStatus === 'active';
    });
    var hasAnyDaYunActive = sourceYears.some(function (year) {
      return year && year.daYun && year.daYunStatus === 'active';
    });
    var headline = strongest && strongest.priority
      ? highestYears.map(function (row) { return row.year; }).join('、') + '年是未来五年的变化重点，整体表现为' + overallDirection + '。'
      : riskYears.length
        ? '未来五年已有风险信号被岁运触发，具体表现以对应年份列出的结果为准。'
        : hasReview ? '结合往事反馈后，当前没有保留可优先列出的年度事件；原有结构触发仍保留在依据中。'
        : '未来五年没有出现足以单独改变原局方向的强引动，当前不能指定明确的变化重点。';
    var storyLine = years.map(function (row) {
      var role = row.hasIndependentAnnualTrigger
        ? (row.eventDirection === '偏有利' ? '推进' : row.eventDirection === '偏不利' ? '调整' : '转折')
        : '窗口待定';
      return row.year + '年' + role + (row.primaryEventLabel ? '（' + row.primaryEventLabel + '）' : '');
    }).join(' → ');
    return {
      hideScore: true,
      headline: headline,
      painPoint: highestYears.length && overallDirection === '变化明显、好坏暂不能定'
        ? highestOutcome + ' 相关领域会明显变化或拉扯，但好坏暂不能定。'
        : adverseYears.length
        ? adverseYears.map(function (row) { return row.year + '年：' + row.prioritizedOutcome; }).join(' ')
        : highestYears.length
          ? highestOutcome
          : riskYears.length
          ? riskYears.map(function (row) { return row.year; }).join('、') + '年有风险信号被触发，具体表现以对应年份列出的结果为准。'
          : '后续按每年的具体触发安排节奏；没有突出窗口的年份，不另行指定必然发生的事件。',
      paragraphs: [],
      verdicts: (daYunCommonVerdict ? [daYunCommonVerdict] : []).concat([narrativeVerdict('五年变化主线', '', ['FIVE_YEAR:INTERACTION_PRIORITY'], {
        sourceText: years.filter(function (row) { return row.sourceText; }).map(function (row) { return row.year + '年：' + row.sourceText; }).join(' '),
        outcomeText: headline,
      }), narrativeVerdict('五年推进顺序', '', ['FIVE_YEAR:EVENT_LEDGER'], {
        sourceText: '按每年的独立结构触发、最相关现实领域与年龄阶段依次排列；没有独立触发的年份保留窗口待定。',
        outcomeText: storyLine,
      })]),
      years: years.map(function (row) {
        var clean = Object.assign({}, row);
        clean.isCurrentYear = !!(facts && facts.currentYear && Number(facts.currentYear.year) === Number(row.year));
        delete clean.priority;
        delete clean.priorityCount;
        delete clean.riskTriggered;
        delete clean.prioritizedOutcome;
        delete clean.priorityOutcomes;
        return clean;
      }),
      note: allDaYunActive
        ? '五年结论依据同一命盘在不同流年和大运下的实际刑冲克害合化推演，不等同于具体事件保证。'
        : hasAnyDaYunActive
          ? '部分年份大运未纳入，对应年份仅按流年与原局喜忌及实际刑冲克害合化推演，不等同于具体事件保证。'
          : '当前大运未纳入，只按流年与原局喜忌及实际刑冲克害合化推演，不等同于具体事件保证。',
    };
  }

  function unavailableNarrative(domain) {
    return { grade:'', level:'', hideScore:true, headline:'本项资料尚不完整', painPoint:'',
      paragraphs:[], verdicts:[], note:'补齐相关排盘依据后再生成本项解读。', evidenceStatus:'insufficient', domain:domain };
  }

  function constrainNarrative(narrative, domain, facts) {
    if (!narrative || narrative.evidenceStatus === 'insufficient') return narrative;
    var limits = {
      wealth:'A等级是本模型的财富潜力参考；兑现仍需现实职业、经营和资源条件，不能据此确认终身金额上限。',
      relationship:'相处画像属于传统取象线索；不能确认现实人物的性格、样貌、年龄或关系结局。',
      study:'学习结构不等于真实成绩或学历；教育环境、当前基础和投入需要另行核对。',
      currentYear:'时间窗口表示规则触发，不是事件发生概率；实际职业和关系状态决定适用场景。',
      fiveYear:'年份排序来自结构触发，不是命定时间表；缺少信号不表示现实没有变化。'
    };
    list(narrative.verdicts).forEach(function(v, index) {
      var refs = list(v.basis).filter(Boolean);
      var hasUnknown = refs.some(function(ref) { return /unknown|unclear|FALLBACK|UNFOCUSED/.test(ref); });
      v.claimKey = domain+':'+index+':'+v.title;
      v.sourceRefs = refs.slice();
      v.ruleId = 'report-inference-v1';
      v.status = hasUnknown ? 'insufficient' : /currentYear|fiveYear/.test(domain) ? 'conditional' : 'symbolic';
      v.scope = domain;
      v.conditions = [limits[domain]].filter(Boolean);
      v.blockers = hasUnknown ? ['当前依据不足以支持单一明确结论'] : [];
      v.realityConfirmed = false;
      v.requiredConditions = [];
      if (domain === 'wealth') {
        var wealth = facts.wealth || {};
        var activePaths = list(wealth.pathways).filter(function(p) { return p && p.positive === true; });
        var pressures = list(wealth.retention && wealth.retention.risks).map(function(p) { return textOf(p.type || p); });
        if (/钱主要|持续放大|量级/.test(v.title)) {
          v.requiredConditions.push({ key:'wealthPath', label:'已确认有利财富路径', met:activePaths.length > 0 });
          v.conditions.unshift(activePaths.length ? '已确认路径：'+activePaths.map(function(p) { return p.type; }).join('、')+'；路径存在不等于现实收入已经形成。' : '尚未确认有利财富路径；有规模线索也需进一步核对能否兑现。');
        }
        if (/留下|量级/.test(v.title) && pressures.length) {
          v.blockers = v.blockers.concat(pressures);
          v.conditions.unshift('需要同时核对的留存限制：'+pressures.join('、')+'。');
        }
      }
      if (domain === 'relationship') {
        var relationship = facts.relationship || {};
        var quality = relationship.spouseStar && relationship.spouseStar.quality || {};
        if (v.title === '缘分是否容易落地') {
          v.requiredConditions.push({key:'exposed',label:'配偶星显现',met:/透干|透藏并见/.test(quality.visibility || '')});
          v.requiredConditions.push({key:'rooted',label:'配偶星根气',met:quality.rooted === true});
          v.blockers = v.blockers.concat(v.requiredConditions.filter(function(c) { return !c.met; }).map(function(c) { return c.label+'条件未完整'; }));
        }
      }
    });
    narrative.note = /currentYear|fiveYear/.test(domain)
      ? [narrative.note,limits[domain]].filter(Boolean).join(' ')
      : limits[domain];
    return narrative;
  }

  function buildNarratives(facts) {
    facts = facts || {};
    var validWealth = facts.wealth && facts.wealth.resource && facts.wealth.capacity && facts.wealth.capacity.state &&
      (typeof facts.wealth.resource.visibleCount === 'number' || typeof facts.wealth.resource.hiddenCount === 'number');
    var validRelationship = facts.relationship && facts.relationship.palace && facts.relationship.palace.zhi && facts.relationship.spouseStar;
    var validStudy = facts.study && ((facts.study.educationBand && Number.isFinite(facts.study.educationBand.rank)) ||
      ['absorption','expression','discipline','application'].some(function(key) { return facts.study[key] && facts.study[key].state; }));
    var narratives = {
      currentYear: facts.currentYear ? attachNarrativeTechnicalBasis(buildCurrentYearNarrative(facts), facts, 'currentYear') : unavailableNarrative('currentYear'),
      relationship: validRelationship ? attachNarrativeTechnicalBasis(attachDomainTiming(buildRelationshipNarrative(facts), facts, 'relationship'), facts, 'relationship') : unavailableNarrative('relationship'),
      wealth: validWealth ? attachNarrativeTechnicalBasis(attachDomainTiming(buildWealthNarrative(facts), facts, 'wealth'), facts, 'wealth') : unavailableNarrative('wealth'),
      study: facts.study && facts.study.relevant === false ? null : validStudy ? attachNarrativeTechnicalBasis(attachDomainTiming(buildStudyNarrative(facts), facts, 'study'), facts, 'study') : unavailableNarrative('study'),
      fiveYear: facts.fiveYear && list(facts.fiveYear.years).length ? attachNarrativeTechnicalBasis(buildFiveYearNarrative(facts), facts, 'fiveYear') : unavailableNarrative('fiveYear')
    };
    Object.keys(narratives).forEach(function(domain) { constrainNarrative(narratives[domain],domain,facts); });
    // Each card retains its own source; identical facts are not independent corroboration.
    return narratives;
  }

  // Life context selects relevant report topics; it never changes the chart or A grade.
  function resolveLifeContext(input, birthYear, currentYear) {
    input = input || {};
    var age = Number(birthYear) > 0 ? Number(currentYear) - Number(birthYear) : null;
    if (!Number.isFinite(age) || age < 0 || age > 120) age = null;
    var labels = {student:'在读',exam:'正在备考或进修',working:'已结束学业，工作中',transition:'已结束学业，求职或调整中',home:'以居家事务或照料安排为主',retired:'已退休',unknown:'暂不填写'};
    var status = Object.prototype.hasOwnProperty.call(labels,input.status) ? input.status : 'unknown';
    var school = status === 'student' || status === 'exam' || (status === 'unknown' && age !== null && age >= 6 && age < 18);
    var stageKey = age === null ? 'unknown' : age < 16 ? 'child' : age < 24 ? 'education' : age < 31 ? 'launch' : age < 46 ? 'development' : age < 61 ? 'mature' : 'late';
    if (status === 'student') stageKey = age !== null && age < 16 ? 'child' : 'education';
    if (status === 'working' || status === 'transition') stageKey = age !== null && age < 31 ? 'launch' : age !== null && age < 46 ? 'development' : 'mature';
    if (status === 'retired') stageKey = 'late';
    if (status === 'unknown' && age !== null && age >= 18 && age < 24) stageKey = 'launch';
    return {status:status, age:age, asOfYear:Number(currentYear), label:labels[status], studyRelevant:school, stageKey:stageKey,
      source:status === 'unknown' ? 'age_default' : 'user',
      note:school ? '学业内容按目前在读或学习阶段展开；未来身份变化后可重新选择。' : '后续不展开升学、考试预测；如正在备考或进修，可修改当前状态。'};
  }

  function applyLifeContext(facts, context) {
    facts.lifeContext = context;
    facts.study.relevant = context.studyRelevant;
    (facts.fiveYear.years || []).forEach(function(row) {
      var rowContext=resolveLifeContext({status:Number(row.year)<context.asOfYear ? 'unknown' : context.status},context.age===null ? null : context.asOfYear-context.age,Number(row.year));
      row.lifeContext = rowContext;
      var original = annualAdjudication(row);
      if (original) {
        var records = list(original.domainRecords).filter(function(record) { return rowContext.studyRelevant || record.domain !== 'study'; })
          .map(function(record) { return Object.assign({},record,{label:record.domain==='career'&&rowContext.status!=='working'?(rowContext.studyRelevant?'学习任务与协作':rowContext.status==='transition'?'求职与方向调整':'生活事务与协作'):record.label,scenarioCandidates:list(record.scenarioCandidates).filter(function(item){return rowContext.studyRelevant || !/升学|考试|备考|学费|奖学金|录取/.test(textOf(item));})}); });
        var adjudication = Object.assign({},original,{domainRecords:records,primaryEvent:records[0]||null,secondaryEvent:records[1]||null,
          lifeStage:{key:rowContext.stageKey,label:(rowContext.status==='unknown' ? ({child:'儿童阶段',education:'青少年阶段',launch:'青年阶段',development:'成年发展阶段',mature:'成熟阶段',late:'晚年阶段'}[rowContext.stageKey]||'年龄阶段未填写') : rowContext.label) + (rowContext.age === null ? '' : '（该年约'+rowContext.age+'岁）')},lifeContext:rowContext});
        row.eventAdjudication = adjudication;
        row.dynamic = Object.assign({},row.dynamic,{eventAdjudication:adjudication});
      }
      if (!rowContext.studyRelevant) {
        row.study = null;
        // Retain raw structural evidence separately; filter only its applicable report domains.
        row.originalInteractions = row.interactions;
        row.interactions = list(row.interactions).map(function(item) {
          return Object.assign({},item,{domains:list(item.domains).filter(function(domain){return domain !== 'study';})});
        }).filter(function(item,index){return item.domains.length || !list(row.originalInteractions[index].domains).length;});
      }
    });
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
      storyline: null,
    };
    facts.relationship = buildRelationshipFacts(bazi, gender, core, deps.calculator);
    facts.wealth = buildWealthFacts(bazi, core, deps.calculator);
    facts.study = buildStudyFacts(bazi, core, deps.calculator);
    var timingCore = Object.assign({}, core, { wealth: facts.wealth });
    facts.fiveYear = buildFiveYearFacts(
      bazi, timingCore, deps.calculator, deps.chain, facts.anchorYear, gender
    );
    if (options.lifeContext) applyLifeContext(facts, resolveLifeContext(options.lifeContext,
      bazi.birthDate && bazi.birthDate.year, options.currentYear || new Date().getFullYear()));
    facts.wealth.fortuneWindows = buildWealthFortuneWindows(bazi, facts.fiveYear);
    facts.currentYear = facts.fiveYear.years[0] || null;
    facts.storyline = buildReportStoryline(facts);
    var narratives = buildNarratives(facts);
    if (facts.currentYear) facts.currentYear.narrative = narratives.currentYear;
    facts.relationship.narrative = narratives.relationship;
    facts.wealth.narrative = narratives.wealth;
    facts.study.narrative = narratives.study;
    facts.fiveYear.narrative = narratives.fiveYear;
    return facts;
  }

  // Report-only interpretation layer. Scores, signs, structural risks and the core chart
  // remain unchanged. The baseline is captured after life-stage selection, so resetting
  // feedback restores that baseline rather than compounding earlier edits.
  function reviewedAnnualNarrative(year) {
    var adjudication=annualAdjudication(year), reconciliation=year.reportReconciliation;
    var selected=[adjudication.primaryEvent,adjudication.secondaryEvent].filter(Boolean);
    var outcomes=selected.map(function(record){return selectTimingScenario(record,adjudication);});
    var headline=selected.length ? (reconciliation.changes.length?'结合往事反馈，':'从具体作用机制看，')+year.year+'年优先关注'+selected.map(function(r){return r.label||r.domain;}).join('、')+'。'
      : year.year+'年原先的重点事件解释已撤下，本轮没有足够依据指定替代事件。';
    var verdicts=selected.map(function(record,index){
      return narrativeVerdict(index?'其次关注的方面':reconciliation.changes.length?'结合往事反馈看今年':'今年的主要作用方式','',['ANNUAL_EVENT:'+record.domain],{
        sourceText:list(record.evidence).join('；'),outcomeText:outcomes[index],
      });
    });
    var withdrawn=reconciliation.changes.filter(function(change){return change.excluded;});
    if(withdrawn.length)verdicts.push(narrativeVerdict('本轮修正','',['REPORT_REVIEW:WITHDRAWN'],{
      sourceText:'来源：同领域、同机制的往事反馈；不等同于未来事件的验证。',
      outcomeText:withdrawn.map(function(change){return '“'+change.label+'”的原解释'+(change.state==='mixed'?'收到正反两种反馈':'与已答经历不符')+'，本轮不再列为重点。';}).join('')+'这不会把原方向反转，也不表示以后一定不会发生。',
    }));
    return {hideScore:true,headline:headline,painPoint:outcomes.join(' '),paragraphs:[],verdicts:verdicts,
      revisions:reconciliation.changes,
      note:'年度正文统一采用有实际触发的机制候选；未归属具体机制的宽泛文案不重复展开。未作答部分仍为传统取象假设，作答也不等于未来保证。'};
  }

  function reviewedFiveYearRow(year) {
    var adjudication=annualAdjudication(year), primary=adjudication.primaryEvent;
    var narrative=reviewedAnnualNarrative(year);
    var outcomes=[primary,adjudication.secondaryEvent].filter(Boolean).map(function(record){return selectTimingScenario(record,adjudication);});
    return {year:year.year,pillar:textOf(year.pillar&&year.pillar.gan)+textOf(year.pillar&&year.pillar.zhi),
      daYunLabel:daYunStatusLabel(year),directionLabel:primary ? primary.direction : '解释已修正',
      lifeStage:adjudication.lifeStage&&adjudication.lifeStage.label||'',primaryEventLabel:primary&&primary.label||'',
      eventDirection:primary&&primary.direction||'',hasIndependentAnnualTrigger:!!primary,
      sourceText:[primary,adjudication.secondaryEvent].filter(Boolean).map(function(r){return list(r.evidence).join('；');}).join('；'),
      summary:narrative.headline+' '+narrative.verdicts.map(function(v){return v.outcomeText;}).join(' '),
      prioritizedOutcome:outcomes.join(' '),priorityOutcomes:outcomes,
      priority:primary ? Number(primary.activationScore||0) : 0,priorityCount:outcomes.length,
      riskTriggered:false,revisions:year.reportReconciliation.changes};
  }

  function applyReportReview(facts, review) {
    facts.reportReview = review;
    list(facts.fiveYear && facts.fiveYear.years).forEach(function(row){
      var original=annualAdjudication(row);
      if(!original)return;
      if(!row.reportOriginalAdjudication)row.reportOriginalAdjudication=JSON.parse(JSON.stringify(original));
      var adjudication=JSON.parse(JSON.stringify(row.reportOriginalAdjudication)), changes=[];
      delete row.reportReconciliation;
      var supported=list(review&&review.candidates).filter(function(c){return Number(c.year)===Number(row.year)&&c.hasIndependentAnnualTrigger===true&&c.mechanism_key;});
      var hasProfessional=supported.some(function(c){return /^rule:/.test(c.mechanism_key)&&c.reportBaseline;});
      // A domain can contain several professional mechanisms. Split only using the
      // pre-answer candidate ledger; rejecting one must not erase another mechanism.
      var baseRecords=adjudication.domainRecords;
      if(supported.length)adjudication.domainRecords=list(baseRecords).reduce(function(out,record){
        var options=supported.filter(function(c){return c.domain===record.domain;});
        return out.concat(options.length?options.map(function(c){
          var group=options.filter(function(o){return o.mechanism_key===c.mechanism_key;});
          var groupFeedback=list(review&&review.adjustments).filter(function(a){return Number(a.year)===Number(row.year)&&a.domain===c.domain&&a.mechanismKey===c.mechanism_key;});
          var selectedFeedback=groupFeedback.filter(function(a){return a.manifestation===c.manifestation;});
          // Outcome variants are alternatives, not independent corroboration. A denied
          // completion must not automatically turn into an assertion of failure (or vice versa).
          var suppress=group.length>1 && (groupFeedback.length ? selectedFeedback.length!==1||groupFeedback.filter(function(a){return a.state==='tentative'||a.state==='repeated';}).length>1 : group[0]!==c);
          var processReference=list(review&&review.processReferences).filter(function(r){return Number(r.year)===Number(row.year)&&r.domain===c.domain&&r.mechanismKey===c.mechanism_key&&r.manifestation===c.manifestation&&r.scope==='common_process_only';})[0];
          return Object.assign({},record,{
            label:groupFeedback.length?c.label:(c.reportLabel||c.label),reportMechanismKey:c.mechanism_key,reportManifestation:c.manifestation,
            reportScenario:groupFeedback.length?c.detail:(c.reportBaseline||c.detail),reportVariantSuppressed:suppress,
            reportProcessReference:processReference||null,
            evidence:list(record.evidence).concat(list(c.evidence),processReference?['跨场景参考（不验证本年事件）：'+list(processReference.sources).map(function(s){return s.year+'年：'+s.original;}).join('；')].concat(list(processReference.counterYears).length?['同类解释不符合年份：'+processReference.counterYears.join('、')]:[]):[])
          });
        }):[record]);
      },[]);
      list(adjudication.domainRecords).forEach(function(record,index){
        delete record.reportFeedback;
        delete record.reportExcluded;
        record.reportOriginalRank=index;
        var matching=list(review && review.adjustments).filter(function(item){return Number(item.year)===Number(row.year) && item.domain===record.domain
          && (!supported.length || record.reportMechanismKey===item.mechanismKey && record.reportManifestation===item.manifestation)
          && ['deprioritized','mixed','repeated','tentative'].indexOf(item.state)>=0;});
        if(matching.length!==1 || !record.hasIndependentAnnualTrigger)return;
        var feedback=matching[0];
        record.reportFeedback=feedback;
        record.reportExcluded=feedback.state==='deprioritized'||feedback.state==='mixed';
        changes.push({domain:record.domain,mechanismKey:feedback.mechanismKey,label:record.label||record.domain,state:feedback.state,excluded:record.reportExcluded,
          original:selectTimingScenario(Object.assign({},record,{reportFeedback:null}),adjudication),
          reason:feedback.outcome,sourceEvidence:list(feedback.sourceEvidence),
          confirmedYears:list(feedback.confirmedYears),deniedYears:list(feedback.deniedYears)});
      });
      if(changes.length||hasProfessional){
        var eligible=list(adjudication.domainRecords).filter(function(record){return record.hasIndependentAnnualTrigger&&!record.reportExcluded&&!record.reportVariantSuppressed;});
        eligible.sort(function(a,b){
          // Repeated support breaks a structural-score tie only; it cannot create a trigger.
          return Number(b.activationScore||0)-Number(a.activationScore||0)
            || Number(!!(b.reportFeedback&&b.reportFeedback.state==='repeated'))-Number(!!(a.reportFeedback&&a.reportFeedback.state==='repeated'))
            || a.reportOriginalRank-b.reportOriginalRank;
        });
        adjudication.primaryEvent=eligible[0]||null;adjudication.secondaryEvent=eligible[1]||null;
        adjudication.domainRecords=eligible.concat(adjudication.domainRecords.filter(function(r){return eligible.indexOf(r)<0;}));
        row.reportReconciliation={changes:changes,scope:'annual_interpretation',futureConfirmed:false};
      } else adjudication=JSON.parse(JSON.stringify(row.reportOriginalAdjudication));
      row.eventAdjudication=adjudication;
      row.dynamic=Object.assign({},row.dynamic,{eventAdjudication:adjudication});
    });
    facts.storyline=buildReportStoryline(facts);
    var narratives=buildNarratives(facts);
    if(facts.currentYear)facts.currentYear.narrative=narratives.currentYear;
    facts.relationship.narrative=narratives.relationship;facts.wealth.narrative=narratives.wealth;
    facts.study.narrative=narratives.study;facts.fiveYear.narrative=narratives.fiveYear;
    return facts;
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    buildFacts: buildFacts,
    resolveLifeContext: resolveLifeContext,
    contextScenario: contextScenario,
    applyLifeContext: applyLifeContext,
    applyReportReview: applyReportReview,
    buildNarratives: buildNarratives,
    buildWealthFacts: buildWealthFacts,
    buildRelationshipFacts: buildRelationshipFacts,
    buildStudyFacts: buildStudyFacts,
    deriveDayPillarInteraction: deriveDayPillarInteraction,
    buildAnnualFacts: buildAnnualFacts,
    matchTriggeredRisks: matchTriggeredRisks,
    buildFiveYearFacts: buildFiveYearFacts,
    buildWealthFortuneWindows: buildWealthFortuneWindows,
    calibrateWealthReality: calibrateWealthReality,
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
      storageOutcome: storageOutcome,
      deriveWealthDirection: deriveWealthDirection,
      publicStudyBand: publicStudyBand,
      dedupeNarrativeSources: dedupeNarrativeSources,
      selectTimingScenario: selectTimingScenario,
    };
  }
  return api;
}));
