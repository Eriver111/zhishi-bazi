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
    if (!occurrences.length) {
      return {
        state: '不显',
        conclusion: '原局未见明确正财或偏财十神，资源议题需结合岁运和现实路径观察。',
        confidence: 'limited',
        elementRole: role,
        visibleCount: 0,
        hiddenCount: 0,
        evidence: [],
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
    };
  }

  function buildWealthPathways(core) {
    var chains = list(core && core.actionChains);
    var risks = list(core && core.structuralRisks);
    var rows = [];
    var definitions = [
      { type: '食伤生财', pattern: /(?:食神|伤官|食伤)\s*(?:生财|(?:→|->)\s*财(?:星)?)/, conclusion: '已有食伤与财星的链路证据，可关注表达、技能或产出向资源转化的条件。' },
      { type: '财生官', pattern: /财.*官|财.*杀|官.*财/, conclusion: '已有财与官杀相连的证据，资源可能与责任、规则或组织位置同步出现。' },
      { type: '财官印连续流通', pattern: /财.*官.*印|财生杀印|财官印/, conclusion: '已有财、官杀、印连续流通的证据，转化效果取决于各环节是否承接。' },
      { type: '财配印', pattern: /财.*印|印.*财/, conclusion: '已有财印同场证据，资源与学习、资质或支持系统之间存在联动条件。' },
      { type: '比劫与财并见', pattern: /比劫.*财|财.*比劫|劫财/, conclusion: '已有比劫与财并见证据，获取机会与资源分流需同时评估。' },
      { type: '财党杀', pattern: /财党杀|财.*杀/, conclusion: '已有财党杀证据，资源议题可能伴随责任、竞争或压力，不能单独视为利好。' },
      { type: '财破印', pattern: /财破印|财.*破.*印/, conclusion: '已有财破印证据，资源投入可能牵动学习、资质或支持系统，需要保留缓冲。' },
    ];
    definitions.forEach(function (definition) {
      var matched = chains.filter(function (chain) { return definition.pattern.test(textOf(chain)); });
      var riskMatched = risks.filter(function (risk) { return definition.pattern.test(textOf(risk)); });
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
    var capacity;
    if (isCongCai) {
      capacity = evidence('顺势', '从财格成立，财星按冻结的从格结论顺势解释。', 'strong', ['从财格'], elementRole);
      capacity.method = '从格顺势';
    } else if (weak && elementRole === '忌神') {
      capacity = evidence('承压', '财星力量明显，但日主承载条件有限，机会与资源压力可能同时增加。', 'strong', ['身弱', '财为忌'], elementRole);
    } else if (elementRole === '用神' || elementRole === '喜神') {
      capacity = evidence('可承接', '财星属于冻结核心中的有利元素，具备资源调动的候选条件，仍需结合承载和路径。', 'medium', ['财为' + elementRole], elementRole);
    } else {
      capacity = evidence('平衡观察', '财星作用需结合日主承载、格局路径和结构风险判断，不以数量直接等同结果。', 'medium', [], elementRole);
    }
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
    if (position === 'year' || position === 'month') return 'older_tendency';
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
  var BRANCH_CLASH = {
    子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅',
    卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
  };

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

  function buildAnnualCareerFacts(tenGod, dynamic) {
    return {
      conclusion: '事业议题按官杀、印与食伤的岁运透出观察，适合把目标拆成可执行步骤。',
      evidence: [tenGod.yearStem, tenGod.daYunStem].filter(function (item) { return item && item !== '十神未定'; }),
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
        activation: textList(dynamic && dynamic.triggers),
      },
      conclusion: base && base.summaryLevel
        ? '沿用财富事实的“' + base.summaryLevel + '”倾向，本年只补充岁运激活条件，不重新评估财富质量。'
        : '本年仅记录岁运对既有财富事实的激活条件，不重新评估财富质量。',
      evidence: textList(dynamic && dynamic.triggers),
    };
  }

  function buildAnnualRelationshipFacts(pillar, daYun, dynamic) {
    return {
      conclusion: '关系议题按流年与夫妻宫、配偶星的动态牵动观察，合冲只表示议题被触发，不直接定结果。',
      timing: { yearPillar: pillar, daYun: daYun },
      evidence: textList(dynamic && dynamic.triggers),
    };
  }

  function buildAnnualStudyFacts(tenGod, dynamic) {
    return {
      conclusion: '学习安排可结合印、食伤与官杀的岁运表现，在吸收、输出和纪律之间调整节奏。',
      evidence: [tenGod.yearStem, tenGod.daYunStem].filter(function (item) { return item && item !== '十神未定'; }).concat(textList(dynamic && dynamic.triggers)),
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
      triggeredRisks: triggeredRisks,
      reliefs: matchReliefs(core && core.structuralRisks, pillar, activeDaYun, dynamic, calculator, year, core, dayGan),
      career: buildAnnualCareerFacts(tenGod, dynamic),
      wealth: buildAnnualWealthFacts(core, pillar, activeDaYun, dynamic, calculator),
      relationship: buildAnnualRelationshipFacts(pillar, activeDaYun, dynamic),
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
    var timingCore = Object.assign({}, core, { wealth: facts.wealth });
    facts.fiveYear = buildFiveYearFacts(
      bazi, timingCore, deps.calculator, deps.chain, facts.anchorYear, gender
    );
    facts.currentYear = facts.fiveYear.years[0] || null;
    return facts;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    buildFacts: buildFacts,
    buildWealthFacts: buildWealthFacts,
    buildRelationshipFacts: buildRelationshipFacts,
    deriveDayPillarInteraction: deriveDayPillarInteraction,
    buildAnnualFacts: buildAnnualFacts,
    buildFiveYearFacts: buildFiveYearFacts,
    findDaYunForYear: findDaYunForYear,
  };
}));
