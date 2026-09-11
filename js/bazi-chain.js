/**
 * bazi-chain.js — 生克链分析引擎
 * v2.0: 结构证据、岁运触发与喜用忌联动（不改写核心旺衰结论）
 *
 * 依赖: bazi.js 导出的 BaZiCalculator 公共五行、藏干与十神 API
 * 必须在 bazi.js 之后加载
 */
(function(root) {
  'use strict';

  var BaZiCalculator = root && root.BaZiCalculator;
  if (!BaZiCalculator || !BaZiCalculator.WU_XING || !BaZiCalculator.DI_ZHI_WU_XING || !BaZiCalculator.getCangGan) {
    throw new Error('BaZiChain requires the public BaZiCalculator element and hidden-stem APIs');
  }
  // Keep the legacy implementation isolated from browser globals: every dependency
  // below is an adapter over BaZiCalculator's public API, not a top-level const.
  var window = {
    WU_XING: BaZiCalculator.WU_XING,
    DI_ZHI_WU_XING: BaZiCalculator.DI_ZHI_WU_XING,
    getCangGan: BaZiCalculator.getCangGan
  };

  var WXL = ['木','火','土','金','水'];

  // ---- 十二长生 ----
  var CHANG_SHENG = { '甲':'亥','乙':'午','丙':'寅','丁':'酉','戊':'寅','己':'酉','庚':'巳','辛':'子','壬':'申','癸':'卯' };
  var LIN_GUAN = { '甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' };

  // ---- 冲/害/刑 ----
  var CHONG = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' };
  var HAI  = { '子':'未','未':'子','丑':'午','午':'丑','寅':'巳','巳':'寅','卯':'辰','辰':'卯','申':'亥','亥':'申','酉':'戌','戌':'酉' };
  var XING_PAIRS = {};
  [['子','卯'],['寅','巳'],['巳','申'],['申','寅'],['丑','戌'],['戌','未'],['未','丑']].forEach(function(p) {
    XING_PAIRS[p[0]+p[1]] = true; XING_PAIRS[p[1]+p[0]] = true;
  });
  var SELF_XING = { '辰':true, '午':true, '酉':true, '亥':true };
  var ZHI_HE = {
    '子丑':'土','丑子':'土','寅亥':'木','亥寅':'木','卯戌':'火','戌卯':'火',
    '辰酉':'金','酉辰':'金','巳申':'水','申巳':'水','午未':'土','未午':'土'
  };
  // 六破在不同流派中的使用权重不同，只进入事实层，不直接判吉凶。
  var ZHI_PO = {};
  [['子','酉'],['丑','辰'],['寅','亥'],['卯','午'],['巳','申'],['未','戌']].forEach(function(p) {
    ZHI_PO[p[0]+p[1]] = true; ZHI_PO[p[1]+p[0]] = true;
  });
  var SAN_HE = [['寅','午','戌','火'],['亥','卯','未','木'],['申','子','辰','水'],['巳','酉','丑','金']];
  var SAN_HUI = [['寅','卯','辰','木'],['巳','午','未','火'],['申','酉','戌','金'],['亥','子','丑','水']];
  var GAN_HE_PAIR = { '甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛','辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊' };
  var GAN_HE_WX = { '甲己':'土','己甲':'土','乙庚':'金','庚乙':'金','丙辛':'水','辛丙':'水','丁壬':'木','壬丁':'木','戊癸':'火','癸戊':'火' };
  var POSITIONS = ['year','month','day','hour'];
  var POS_NAMES = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };
  var POS_XIANG = {
    year:'祖上、早年环境和外部资源',
    month:'父母家庭、成长环境和工作平台',
    day:'自己、伴侣和日常家庭',
    hour:'行动结果、子女、晚年和长期落点'
  };

  function roleFamily(shiShen) {
    if (shiShen === '比肩' || shiShen === '劫财') return '比劫';
    if (shiShen === '食神' || shiShen === '伤官') return '食伤';
    if (shiShen === '正财' || shiShen === '偏财') return '财';
    if (shiShen === '正官' || shiShen === '七杀') return '官杀';
    if (shiShen === '正印' || shiShen === '偏印') return '印';
    return '';
  }

  function relationDirection(wxA, wxB) {
    var rel = simpleRel(wxA, wxB);
    if (rel === 'sheng') return { type:'生', fromFirst:true };
    if (rel === 'beiSheng') return { type:'生', fromFirst:false };
    if (rel === 'ke') return { type:'克', fromFirst:true };
    if (rel === 'beiKe') return { type:'克', fromFirst:false };
    if (rel === 'tong') return { type:'同气', fromFirst:true };
    return null;
  }

  function nodeLabel(node) {
    var hidden = node.visibility === 'hidden' ? '藏' : '';
    return POS_NAMES[node.pillar] + hidden + node.char + '（' + node.wx + '·' + (node.shiShen || '五行') + '）';
  }

  /**
   * 完整事实图：只记录“命盘中真实存在的关系”，不在这里裁决旺衰、格局与喜用忌。
   * 天干、地支本气、全部藏干均建节点；生克边覆盖任意柱位，特殊地支关系另建事实边。
   */
  function buildFactGraph(bazi) {
    var dg = bazi.day.gan;
    var settlement = BaZiCalculator.buildEvidenceSettlement ? BaZiCalculator.buildEvidenceSettlement(bazi) : null;
    var nodes = [];
    var energyNodes = [];
    POSITIONS.forEach(function(pos, posIndex) {
      var pillar = bazi[pos];
      var ganNode = {
        id:pos + '.gan', pillar:pos, position:posIndex, layer:'gan', char:pillar.gan,
        wx:window.WU_XING[pillar.gan], shiShen:BaZiCalculator.getShiShen(dg, pillar.gan),
        family:pos === 'day' ? '日主' : roleFamily(BaZiCalculator.getShiShen(dg, pillar.gan)),
        visibility:'exposed', depth:'透干', weight:1
      };
      var hidden = window.getCangGan(pillar.zhi);
      var mainGan = hidden[0];
      var settledRoots = settlement ? settlement.rootAt(pos) : [];
      var mainSettledRoot = settledRoots.filter(function(root) { return root.depth === '本气'; })[0];
      var zhiNode = {
        id:pos + '.zhi', pillar:pos, position:posIndex, layer:'zhi', char:pillar.zhi,
        wx:window.DI_ZHI_WU_XING[pillar.zhi], shiShen:BaZiCalculator.getShiShen(dg, mainGan),
        family:roleFamily(BaZiCalculator.getShiShen(dg, mainGan)), visibility:'branch', depth:'地支本气', weight:1.1,
        effectiveCoefficient:mainSettledRoot ? mainSettledRoot.effectiveCoefficient : 1
      };
      nodes.push(ganNode, zhiNode); energyNodes.push(ganNode, zhiNode);
      hidden.forEach(function(gan, hiddenIndex) {
        var ss = BaZiCalculator.getShiShen(dg, gan);
        var depth = hiddenIndex === 0 ? '本气' : (hiddenIndex === 1 ? '中气' : '余气');
        var settledRoot = settledRoots.filter(function(root) { return root.gan === gan && root.depth === depth; })[0];
        var hNode = {
          id:pos + '.hidden.' + hiddenIndex, pillar:pos, position:posIndex, layer:'hidden', char:gan,
          branch:pillar.zhi, wx:window.WU_XING[gan], shiShen:ss, family:roleFamily(ss),
          visibility:'hidden', depth:depth,
          weight:hiddenIndex === 0 ? 0.75 : (hiddenIndex === 1 ? 0.5 : 0.3),
          effectiveCoefficient:settledRoot ? settledRoot.effectiveCoefficient : 1,
          settlementRootId:settledRoot ? settledRoot.id : null
        };
        nodes.push(hNode); energyNodes.push(hNode);
      });
    });

    var edges = [];
    function addEnergyEdge(a, b) {
      // 同一地支节点与其本气藏干是同一股气，不重复制造“同气链”。
      if (a.pillar === b.pillar && ((a.layer === 'zhi' && b.layer === 'hidden') || (b.layer === 'zhi' && a.layer === 'hidden'))) return;
      var rel = relationDirection(a.wx, b.wx);
      if (!rel) return;
      var from = rel.fromFirst ? a : b, to = rel.fromFirst ? b : a;
      var distance = Math.abs(a.position - b.position);
      var visibilityFactor = Math.min(
        a.weight * (a.effectiveCoefficient === undefined ? 1 : a.effectiveCoefficient),
        b.weight * (b.effectiveCoefficient === undefined ? 1 : b.effectiveCoefficient)
      );
      var proximityFactor = distance === 0 ? 1.2 : (distance === 1 ? 1 : (distance === 2 ? 0.72 : 0.55));
      edges.push({
        id:'energy:' + from.id + '>' + to.id + ':' + rel.type,
        type:rel.type, from:from.id, to:to.id, fromNode:from, toNode:to,
        distance:distance, adjacent:distance <= 1,
        strength:Number((visibilityFactor * proximityFactor).toFixed(2)),
        evidence:nodeLabel(from) + (rel.type === '同气' ? '与' : rel.type) + nodeLabel(to)
      });
    }
    for (var i = 0; i < energyNodes.length; i++) {
      for (var j = i + 1; j < energyNodes.length; j++) addEnergyEdge(energyNodes[i], energyNodes[j]);
    }

    var branchNodes = POSITIONS.map(function(pos) { return nodes.filter(function(n) { return n.id === pos + '.zhi'; })[0]; });
    function addBranchEdge(type, a, b, extra) {
      var relationSettlement = settlement ? settlement.relationSettlements.filter(function(item) {
        return (item.source === a.pillar && item.target === b.pillar) || (item.source === b.pillar && item.target === a.pillar);
      })[0] : null;
      var canonicalType = type === '刑' ? '相刑' : type;
      edges.push({
        id:'branch:' + type + ':' + a.id + '>' + b.id, type:type, from:a.id, to:b.id,
        fromNode:a, toNode:b, distance:Math.abs(a.position - b.position), adjacent:Math.abs(a.position - b.position) <= 1,
        strength:Math.abs(a.position - b.position) <= 1 ? 1 : 0.7,
        settlementId:relationSettlement ? relationSettlement.id : null,
        mergedInto:relationSettlement && relationSettlement.mergedRelations.indexOf(canonicalType) >= 0 ? relationSettlement.primaryRelation : null,
        formedWx:extra && extra.formedWx || null, schoolRule:Boolean(extra && extra.schoolRule),
        evidence:nodeLabel(a) + type + nodeLabel(b) + (extra && extra.formedWx ? '，候选化' + extra.formedWx : '')
      });
    }
    for (var bi = 0; bi < branchNodes.length; bi++) {
      for (var bj = bi + 1; bj < branchNodes.length; bj++) {
        var ba = branchNodes[bi], bb = branchNodes[bj], pair = ba.char + bb.char;
        if (CHONG[ba.char] === bb.char) addBranchEdge('六冲', ba, bb);
        if (HAI[ba.char] === bb.char) addBranchEdge('六害', ba, bb);
        if (XING_PAIRS[pair]) addBranchEdge('刑', ba, bb);
        if (ba.char === bb.char && SELF_XING[ba.char]) addBranchEdge('自刑', ba, bb);
        if (ZHI_HE[pair]) addBranchEdge('六合', ba, bb, { formedWx:ZHI_HE[pair] });
        if (ZHI_PO[pair]) addBranchEdge('六破', ba, bb, { schoolRule:true });
      }
    }

    function addGroupRelations(groups, fullType, halfType, requireMiddle) {
      var zhis = branchNodes.map(function(n) { return n.char; });
      groups.forEach(function(group) {
        var members = group.slice(0, 3), wx = group[3];
        var found = members.filter(function(z) { return zhis.indexOf(z) >= 0; });
        if (found.length === 3) {
          var memberNodes = members.map(function(z) { return branchNodes[zhis.indexOf(z)]; });
          edges.push({ id:'group:' + fullType + ':' + members.join(''), type:fullType,
            members:memberNodes.map(function(n){ return n.id; }), nodes:memberNodes, formedWx:wx,
            strength:1.25, evidence:memberNodes.map(nodeLabel).join('、') + fullType + wx + '局；是否成化另看月令、透干与受制' });
        } else if (found.length === 2) {
          var validHalf = requireMiddle ? found.indexOf(members[1]) >= 0
            : (members.indexOf(found[0]) + 1 === members.indexOf(found[1]) || members.indexOf(found[1]) + 1 === members.indexOf(found[0]));
          if (!validHalf) return;
          var halfNodes = found.map(function(z) { return branchNodes[zhis.indexOf(z)]; });
          edges.push({ id:'group:' + halfType + ':' + found.join(''), type:halfType,
            members:halfNodes.map(function(n){ return n.id; }), nodes:halfNodes, formedWx:wx,
            strength:0.65, evidence:halfNodes.map(nodeLabel).join('、') + halfType + wx + '势，只记牵引，不作完整成化' });
        }
      });
    }
    addGroupRelations(SAN_HE, '三合局', '半合', true);
    addGroupRelations(SAN_HUI, '三会方', '半会', false);

    return { version:'3.1', nodes:nodes, edges:edges, evidenceSettlementVersion:settlement ? settlement.version : null };
  }

  function deriveMechanisms(graph) {
    var defs = [
      { relation:'生', from:'食伤', to:'财', name:'食伤生财', domain:'wealth' },
      { relation:'生', from:'财', to:'官杀', name:'财生官杀', domain:'career' },
      { relation:'生', from:'官杀', to:'印', name:'官杀生印', domain:'career' },
      { relation:'生', from:'印', to:['日主','比劫'], name:'印生身', domain:'study' },
      { relation:'克', from:'比劫', to:'财', name:'比劫制财', domain:'wealth' },
      { relation:'克', from:'财', to:'印', name:'财破印', domain:'study' },
      { relation:'克', from:'印', to:'食伤', name:'印制食伤', domain:'study' },
      { relation:'克', from:'官杀', to:['日主','比劫'], name:'官杀克身', domain:'career' },
      { relation:'克', from:'食伤', to:'官杀', name:'食伤制官杀', domain:'career' }
    ];
    var mechanisms = [];
    defs.forEach(function(def) {
      var matched = graph.edges.filter(function(edge) {
        return edge.type === def.relation && edge.fromNode && edge.toNode
          && edge.fromNode.family === def.from
          && (Array.isArray(def.to) ? def.to.indexOf(edge.toNode.family) >= 0 : edge.toNode.family === def.to)
          && edge.strength >= 0.5;
      }).sort(function(a,b) { return b.strength - a.strength; });
      if (!matched.length) return;
      var actualName = def.name;
      if (def.name === '食伤制官杀') {
        var strongest = matched[0];
        if (strongest.fromNode.shiShen === '食神' && strongest.toNode.shiShen === '七杀') actualName = '食神制杀';
        else if (strongest.fromNode.shiShen === '伤官' && strongest.toNode.shiShen === '正官') actualName = '伤官见官';
        else if (strongest.toNode.shiShen === '正官') actualName = '食伤制官';
        else actualName = '食伤制杀';
      }
      mechanisms.push({
        name:actualName, relation:def.relation, fromFamily:def.from, toFamily:def.to, domain:def.domain,
        strength:matched[0].strength >= 0.85 ? '强' : (matched[0].strength >= 0.55 ? '中' : '弱'),
        dominanceScore:Number((matched.slice(0, 3).reduce(function(total, edge) { return total + edge.strength; }, 0)
          + (matched[0].adjacent ? 0.2 : 0)).toFixed(2)),
        evidence:matched.slice(0, 3).map(function(edge) { return edge.evidence; }),
        sourceWx:matched[0].fromNode.wx, targetWx:matched[0].toNode.wx,
        sourcePillar:matched[0].fromNode.pillar, targetPillar:matched[0].toNode.pillar,
        sourceShiShen:matched[0].fromNode.shiShen, targetShiShen:matched[0].toNode.shiShen,
        _edges:matched
      });
    });

    // 事实图可以完整，但给 AI 的“主导机制”必须去噪：按力量、邻近度和重复证据排序，最多保留六条。
    mechanisms.sort(function(a,b) { return b.dominanceScore - a.dominanceScore; });
    mechanisms = mechanisms.filter(function(item, index) {
      return index < 6 && (item.strength !== '弱' || index < 3);
    });

    function has(name) { return mechanisms.some(function(m) { return m.name === name || (name === '食伤制官杀' && /^食神制杀|^伤官见官|^食伤制/.test(m.name)); }); }
    function mechanism(name) {
      return mechanisms.filter(function(m) { return m.name === name || (name === '食伤制官杀' && /^食神制杀|^伤官见官|^食伤制/.test(m.name)); })[0];
    }
    function directlyContinues(first, second) {
      if (!first || !second) return false;
      return first._edges.some(function(a) {
        return second._edges.some(function(b) {
          return a.toNode.id === b.fromNode.id && Math.min(a.strength, b.strength) >= 0.55;
        });
      });
    }
    var paths = [];
    var wealthOfficer = mechanism('财生官杀'), officerSeal = mechanism('官杀生印'), sealBody = mechanism('印生身');
    var outputWealth = mechanism('食伤生财'), officerBody = mechanism('官杀克身');
    if (directlyContinues(wealthOfficer, officerSeal) && directlyContinues(officerSeal, sealBody)) {
      paths.push({ name:'财官印身连续流通', steps:['财生官杀','官杀生印','印生身'] });
    }
    if (directlyContinues(outputWealth, wealthOfficer)) {
      paths.push({ name:'才华资源责任连续流通', steps:['食伤生财','财生官杀'] });
    }
    if (officerBody && directlyContinues(officerSeal, sealBody)) {
      paths.push({ name:'官杀经印通关', steps:['官杀克身','官杀生印','印生身'] });
    }
    mechanisms.forEach(function(item) { delete item._edges; });
    return { mechanisms:mechanisms, paths:paths };
  }

  function roleForWx(yongJi, wx) {
    var entries = yongJi && yongJi.elementRoleLedger && yongJi.elementRoleLedger.entries;
    if (entries && entries.length) {
      var ledgerEntry = entries.filter(function(item) { return item.element === wx; })[0];
      if (ledgerEntry && ledgerEntry.fortuneRole) return ledgerEntry.fortuneRole;
    }
    if (yongJi && yongJi.yongShen && yongJi.yongShen.indexOf(wx) >= 0) return '用神';
    if (yongJi && yongJi.xiShen && yongJi.xiShen.indexOf(wx) >= 0) return '喜神';
    if (yongJi && yongJi.jiShen && yongJi.jiShen.indexOf(wx) >= 0) return '忌神';
    return '中性';
  }

  function fortuneDirectionForWx(yongJi, wx) {
    var role = roleForWx(yongJi, wx);
    var level = role === '用神' ? '核心有利'
      : role === '喜神' ? '总体有利'
      : role === '忌神' ? '总体不利' : '中性双向';
    var entries = yongJi && yongJi.elementRoleLedger && yongJi.elementRoleLedger.entries;
    if (entries && entries.length) {
      var ledgerEntry = entries.filter(function(item) { return item.element === wx; })[0];
      if (ledgerEntry && ledgerEntry.fortuneLevel) level = ledgerEntry.fortuneLevel;
    }
    var scoreMap = { '核心有利':3, '总体有利':2, '条件有利':1, '中性双向':0, '总体不利':-2 };
    return {
      role:role,
      level:level,
      score:Object.prototype.hasOwnProperty.call(scoreMap, level) ? scoreMap[level] : 0
    };
  }

  function buildImagery(bazi, mechanisms, paths, yongJi) {
    var copy = {
      '食伤生财':'你更容易把手艺、专业能力、表达、内容或产品直接换成收入，钱主要靠自己做出东西、解决问题后获得。',
      '财生官杀':'钱和资源会继续推高责任、职位或项目规模；赚得越多，往往也意味着要管更多事、扛更大的结果。',
      '官杀生印':'外界压力能够转成经验、资历、证书或平台认可，越是在有规则、有门槛的环境里，越容易积累真正的本事。',
      '印生身':'学习、证书、长辈帮助和成熟的方法能直接托住自己，遇事不是只能硬扛，靠知识和准备更容易站稳。',
      '比劫制财':'同辈、朋友、合伙人或竞争者会直接碰到钱和资源分配，既可能一起把盘子做大，也容易在分钱时出现拉扯。',
      '财破印':'赚钱、感情或现实事务容易挤占学习和准备时间，忙着处理眼前事情时，长期积累可能被打断。',
      '印制食伤':'想法和表达会受到规则、学历或长辈标准约束；好处是做事更稳，过重时则容易想得多、落地慢。',
      '官杀克身':'职位、规则、上级或现实责任会直接压到自己身上，容易形成必须按时完成、不能随意退后的生活状态。',
      '食神制杀':'面对竞争和压力时，更擅长靠技能、方案和实际成果解决问题，而不是只靠关系或硬碰硬。',
      '食伤制杀':'面对竞争和压力时，更擅长靠能力、表达和解决方案争取主动。',
      '食伤制官':'自己的想法和做法会挑战现成规则，适合改进流程，但也容易与管理方式发生摩擦。',
      '伤官见官':'说话直接、做事有自己的标准，遇到不合理规定时很难装作没看见，因此容易和上级、制度或审核要求正面摩擦。'
    };
    return mechanisms.map(function(m) {
      var sourceRole = roleForWx(yongJi, m.sourceWx), targetRole = roleForWx(yongJi, m.targetWx);
      var sourceFavorable = sourceRole === '用神' || sourceRole === '喜神';
      var targetFavorable = targetRole === '用神' || targetRole === '喜神';
      var direction = '条件性';
      if (m.relation === '生') {
        if (targetFavorable) direction = '有利';
        else if (targetRole === '忌神') direction = '不利';
      } else if (m.relation === '克') {
        if (targetRole === '忌神' && sourceFavorable) direction = '有利';
        else if (targetFavorable) direction = '不利';
        else if (sourceRole === '忌神' && targetRole !== '忌神') direction = '不利';
      }
      var placement = POS_XIANG[m.sourcePillar] + '牵动' + POS_XIANG[m.targetPillar];
      var directionReason = direction === '有利'
        ? '这条通路的关键落点属于喜用，可作为有利取象。'
        : (direction === '不利'
          ? '这条通路虽然真实存在，但关键落点属于忌神，更像“有这件事，同时也要付出对应成本”，不能只据此断成好结果。'
          : '这条通路的喜忌证据互有牵制，只能作为候选含义，需与其他主导链一起判断。');
      return {
        name:m.name, domain:m.domain, direction:direction, confidence:m.strength,
        basis:m.evidence.join('；'),
        placement:placement,
        conclusion:(copy[m.name] || '这条关系会把两个生活领域直接连在一起。')
          + '源头为' + sourceRole + '、落点为' + targetRole + '。' + directionReason
      };
    }).concat(paths.map(function(path) {
      return {
        name:path.name, domain:'overall', direction:'条件性', confidence:'中',
        basis:path.steps.join('→'), placement:'多柱连续流通',
        conclusion:'命局不是单个十神孤立起作用，而是形成“' + path.steps.join('，再') + '”的连续通路；最终能否顺畅，要看每一环是否有根、透出并且没有被冲克截断。'
      };
    }));
  }

  var FORTUNE_DOMAIN_META = {
    family:{ label:'家庭与长辈', favorable:'家庭、长辈或师长资源更容易成为现实助力', adverse:'家庭责任、长辈事务或依赖关系更容易增加成本', conditional:'家庭与长辈主题会被引动，但能否形成庇护仍需看具体制化' },
    study:{ label:'学习与资质', favorable:'学习、考试、证照和方法积累更容易得到推进', adverse:'学习准备、资格审核或认知负担更容易形成阻力', conditional:'学习与资质主题更活跃，但结果仍取决于实际投入和结构配合' },
    career:{ label:'事业与职责', favorable:'工作平台、职位责任或项目推进更容易获得有利条件', adverse:'职场规则、项目压力或工作变动的成本更容易增加', conditional:'事业与职责会被引动，但不宜只凭十神名称判断升降' },
    wealth:{ label:'收入与资源', favorable:'收入兑现、客户资源或资金安排更容易出现推进机会', adverse:'支出、资金占用或资源分配压力更容易增加', conditional:'资金和资源事项会增多，但不等于收入必然增加' },
    relationship:{ label:'感情与合作', favorable:'感情沟通、合作关系或共同安排更容易向有利方向推进', adverse:'感情、合作或相处边界更容易出现摩擦与调整', conditional:'感情与合作关系会被引动，但好坏仍需看夫妻宫及具体互动' },
    health:{ label:'身心与承载', favorable:'精力调配、恢复节奏和压力承载更容易得到改善', adverse:'劳累、情绪压力或身体承载方面更需要主动管理', conditional:'身心状态会受到牵动，但不能据此直接断定疾病或事故' }
  };
  var FORTUNE_FAMILY_DOMAINS = {
    '印':[{domain:'study',weight:2},{domain:'family',weight:1.5},{domain:'career',weight:0.7}],
    '财':[{domain:'wealth',weight:2},{domain:'career',weight:1}],
    '官杀':[{domain:'career',weight:2},{domain:'study',weight:0.7},{domain:'health',weight:0.8}],
    '食伤':[{domain:'career',weight:1.2},{domain:'wealth',weight:1.1},{domain:'study',weight:0.5}],
    '比劫':[{domain:'career',weight:1},{domain:'wealth',weight:1},{domain:'relationship',weight:0.8}]
  };

  function getFortuneLifeStage(dy, index) {
    var parsed = parseInt(String(dy && dy.displayAge !== undefined ? dy.displayAge : ''), 10);
    var startAge = isFinite(parsed) ? parsed : (1 + index * 10);
    var endAge = startAge + 9;
    if (startAge < 16) return { key:'early', label:'早年', startAge:startAge, endAge:endAge, focus:['family','study'] };
    if (startAge < 26) return { key:'youth', label:'青年起步期', startAge:startAge, endAge:endAge, focus:['study','career','relationship'] };
    if (startAge < 46) return { key:'middle', label:'中年发展期', startAge:startAge, endAge:endAge, focus:['career','wealth','relationship','family'] };
    if (startAge < 61) return { key:'mature', label:'成熟积累期', startAge:startAge, endAge:endAge, focus:['career','wealth','family','health'] };
    return { key:'late', label:'晚年生活期', startAge:startAge, endAge:endAge, focus:['family','health','wealth'] };
  }

  function familyForElement(dayMasterWx, wx) {
    var rel = simpleRel(dayMasterWx, wx);
    if (rel === 'tong') return '比劫';
    if (rel === 'sheng') return '食伤';
    if (rel === 'ke') return '财';
    if (rel === 'beiKe') return '官杀';
    if (rel === 'beiSheng') return '印';
    return '';
  }

  function inferFortuneInteractionDomains(item, dayMasterWx) {
    var domains = [];
    function add(domain) { if (domain && domains.indexOf(domain) < 0) domains.push(domain); }
    if (item.target === 'year') add('family');
    if (item.target === 'month') { add('career'); add('family'); }
    if (item.target === 'day') {
      add('relationship'); add('family');
      if (item.isGood === false && /六冲|六害|刑|自刑/.test(item.type || '')) add('health');
    }
    if (item.target === 'hour') { add('family'); add('career'); }
    if (item.formedWx) {
      (FORTUNE_FAMILY_DOMAINS[familyForElement(dayMasterWx, item.formedWx)] || []).forEach(function(row) { add(row.domain); });
    }
    return domains;
  }

  function buildDaYunEventLedger(bazi, dy, index, verdict, verifiedScore, interactions) {
    var dayMasterWx = window.WU_XING[bazi.day.gan];
    var stage = getFortuneLifeStage(dy, index);
    var ganShiShen = BaZiCalculator.getShiShen(bazi.day.gan, dy.gan);
    var hidden = window.getCangGan(dy.zhi) || [];
    var zhiMainGan = hidden[0] || '';
    var zhiShiShen = zhiMainGan ? BaZiCalculator.getShiShen(bazi.day.gan, zhiMainGan) : '';
    var ganFamily = roleFamily(ganShiShen), zhiFamily = roleFamily(zhiShiShen);
    var directionMap = { '喜运':2, '偏喜':1, '中性':0, '偏忌':-1, '忌运':-2 };
    var globalDirection = Object.prototype.hasOwnProperty.call(directionMap, verdict) ? directionMap[verdict] : 0;
    var buckets = {};

    function bucket(domain) {
      if (!buckets[domain]) buckets[domain] = { domain:domain, activation:0, directionPoints:0, directionWeight:0, directDirectional:0, evidence:[], sources:[] };
      return buckets[domain];
    }
    function addEvidence(row, text, source) {
      if (text && row.evidence.indexOf(text) < 0 && row.evidence.length < 5) row.evidence.push(text);
      if (source && row.sources.indexOf(source) < 0) row.sources.push(source);
    }
    function addFamilyThemes(family, shiShen, sourceLabel) {
      (FORTUNE_FAMILY_DOMAINS[family] || []).forEach(function(theme) {
        var row = bucket(theme.domain);
        row.activation += theme.weight;
        row.directionPoints += theme.weight * globalDirection;
        row.directionWeight += theme.weight;
        addEvidence(row, sourceLabel + '为' + shiShen + '，只确定“' + FORTUNE_DOMAIN_META[theme.domain].label + '”事项被引动', sourceLabel);
      });
    }
    addFamilyThemes(ganFamily, ganShiShen, '大运天干' + dy.gan);
    addFamilyThemes(zhiFamily, zhiShiShen, '大运地支' + dy.zhi + '本气' + zhiMainGan);

    (interactions || []).forEach(function(item) {
      var domains = item.domains && item.domains.length ? item.domains : inferFortuneInteractionDomains(item, dayMasterWx);
      item.domains = domains;
      domains.forEach(function(domain) {
        var row = bucket(domain);
        row.activation += 2.2;
        if (item.isGood === true) { row.directionPoints += 4.4; row.directionWeight += 2.2; row.directDirectional++; }
        else if (item.isGood === false) { row.directionPoints -= 4.4; row.directionWeight += 2.2; row.directDirectional++; }
        addEvidence(row, item.text, '大运与原局互动');
      });
    });

    var records = Object.keys(buckets).map(function(domain) {
      var row = buckets[domain], meta = FORTUNE_DOMAIN_META[domain];
      // 中性冲合只提高“该领域会被引动”的置信度，不稀释已有的喜忌方向。
      var normalized = row.directionWeight ? row.directionPoints / row.directionWeight : 0;
      var direction = normalized >= 0.55 ? '偏有利' : (normalized <= -0.55 ? '偏不利' : '条件性');
      var conclusion = direction === '偏有利' ? meta.favorable : (direction === '偏不利' ? meta.adverse : meta.conditional);
      // 人生阶段只负责排序现实重心，不参与吉凶方向计算。
      // 权重需要足够明显，避免早年账本被与月/时柱的普通互动挤成“事业优先”。
      var stageBoost = stage.focus.indexOf(domain) >= 0 ? 3.5 : 0;
      var confidence = row.directDirectional > 0 ? '高' : (row.sources.length >= 2 && direction !== '条件性' ? '中高' : '中');
      return {
        id:'dayun:' + (dy.startYear || stage.startAge) + ':' + dy.gan + dy.zhi + ':' + domain,
        domain:domain, label:meta.label, stagePriority:stage.focus.indexOf(domain) >= 0,
        activationScore:Number(row.activation.toFixed(2)),
        directionScore:Number(normalized.toFixed(2)),
        direction:direction, confidence:confidence,
        conclusion:conclusion,
        evidence:row.evidence,
        decisionBasis:'本步大运总体验证方向 + 本领域十神事项 + 与原局对应柱位的实际互动；十神名称不单独决定吉凶',
        _rank:row.activation + stageBoost + (row.directDirectional ? 2 : 0)
      };
    }).sort(function(a,b) { return b._rank - a._rank || a.domain.localeCompare(b.domain); });
    // “重点领域”先按人生阶段列出已被实际引动的现实主题，再补充本步最强的其他主题。
    // 这只改变展示顺序，不改变任何领域的吉凶或置信度。
    var primaryRecords = [];
    stage.focus.forEach(function(domain) {
      var found = records.find(function(row) { return row.domain === domain; });
      if (found && primaryRecords.indexOf(found) < 0) primaryRecords.push(found);
    });
    records.forEach(function(row) {
      if (primaryRecords.indexOf(row) < 0) primaryRecords.push(row);
    });
    records.forEach(function(row) { delete row._rank; });

    var families = [ganFamily, zhiFamily];
    var conditions = ['阶段只决定现实重心，不决定吉凶；同一十神落在不同原局与不同大运互动中，结果可以相反。'];
    if (families.indexOf('印') >= 0) conditions.push('印只代表家人、师长、学习与资质资源；仅当本步验证偏有利且没有印旺为害、财破印等反向结构时，才可进一步解释为庇护。');
    if (families.indexOf('财') >= 0) conditions.push('财只代表资金、客户和资源兑现；须原局能够承财且本步验证偏有利，才可解释为事业收入改善，不能见财便断发财。');
    if (families.indexOf('官杀') >= 0) conditions.push('官杀只代表职位、规则和责任；有利时可对应晋升与承担，不利时更可能表现为压力、约束或审核成本。');
    if (families.indexOf('食伤') >= 0) conditions.push('食伤只代表表达、技能和成果输出；能否转成收入或事业成果，仍须财星通路和本步验证共同成立。');
    if (families.indexOf('比劫') >= 0) conditions.push('比劫只代表自主、同辈、合作与竞争；有利时可借团队扩张，不利时须防资源分配和资金损耗。');

    return {
      id:'dayun:' + (dy.startYear || stage.startAge) + ':' + dy.gan + dy.zhi,
      version:'1.1', frozen:false, inference:true, userCorrectable:true,
      stage:stage,
      pillars:{ gan:dy.gan, zhi:dy.zhi, ganShiShen:ganShiShen, zhiMainGan:zhiMainGan, zhiShiShen:zhiShiShen },
      verification:{ verdict:verdict, score:Number(verifiedScore.toFixed(2)) },
      primaryDomains:primaryRecords.slice(0, 3).map(function(row) { return row.domain; }),
      domainRecords:records,
      opportunities:records.filter(function(row) { return row.direction === '偏有利'; }).map(function(row) { return row.conclusion; }),
      risks:records.filter(function(row) { return row.direction === '偏不利'; }).map(function(row) { return row.conclusion; }),
      conditions:conditions,
      constraint:'事件账本只记录本步运更可能被引动的领域、方向与条件，不承诺具体事件必然发生；用户确认的真实经历优先并可校正该推断。'
    };
  }

  // 判断两个五行之间的生克关系
  function wxRelation(fromWx, toWx) {
    if (fromWx === toWx) return { type: 'tong', name: '比和' };
    var fi = WXL.indexOf(fromWx), ti = WXL.indexOf(toWx);
    if (fi < 0 || ti < 0) return { type: 'unknown', name: '未知' };
    var diff = (ti - fi + 5) % 5;
    if (diff === 1) return { type: 'sheng', name: '生' };     // from 生 to
    if (diff === 2) return { type: 'ke_out', name: '被克' };   // from 克 to (from is the one doing ke)
    if (diff === 3) return { type: 'ke_in', name: '克' };      // from 被 to 克 (to is the one doing ke)
    if (diff === 4) return { type: 'bei_sheng', name: '被生' }; // from 被 to 生
  }

  // 简化：fromWx 对 toWx 的关系
  // 返回 'sheng'(from生to), 'ke'(from克to), 'beiSheng'(from被to生), 'beiKe'(from被to克), 'tong'(同)
  function simpleRel(fromWx, toWx) {
    if (fromWx === toWx) return 'tong';
    var fi = WXL.indexOf(fromWx), ti = WXL.indexOf(toWx);
    if (fi < 0 || ti < 0) return null;
    var diff = (ti - fi + 5) % 5;
    if (diff === 1) return 'sheng';
    if (diff === 2) return 'ke';
    if (diff === 3) return 'beiKe';
    if (diff === 4) return 'beiSheng';
  }

  /**
   * 检查某个干支组合中是否包含指定五行的藏干
   */
  function zhiContainsWx(zhi, wx) {
    var cg = window.getCangGan ? window.getCangGan(zhi) : [];
    for (var i = 0; i < cg.length; i++) {
      if (window.WU_XING && window.WU_XING[cg[i]] === wx) return true;
    }
    return false;
  }

  /**
   * 全局五行出现检测（天干+地支表层+藏干）
   */
  function hasWxAnywhere(bazi, wx) {
    var positions = ['year','month','day','hour'];
    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      if (window.WU_XING[bazi[pos].gan] === wx) return true;
      if (window.DI_ZHI_WU_XING[bazi[pos].zhi] === wx) return true;
    }
    // 藏干
    for (var j = 0; j < positions.length; j++) {
      var cg = window.getCangGan(bazi[positions[j]].zhi);
      for (var k = 0; k < cg.length; k++) {
        if (window.WU_XING[cg[k]] === wx) return true;
      }
    }
    return false;
  }

  /**
   * 主入口：分析八字的生克链
   * @param {Object} bazi - 八字对象 { year, month, day, hour } 每柱 { gan, zhi }
   * @returns {{ adjustments: Array, hints: Array, ganChain: Array, zhiChain: Array }}
   */
  function analyzeChains(bazi) {
    var requiredPillars = ['year', 'month', 'day', 'hour'];
    var complete = bazi && requiredPillars.every(function(pos) {
      return bazi[pos] && BaZiCalculator.WU_XING[bazi[pos].gan] && BaZiCalculator.DI_ZHI_WU_XING[bazi[pos].zhi];
    });
    if (!complete) throw new TypeError('BaZiChain requires complete year, month, day, and hour pillars');
    var dg = bazi.day.gan;
    var evidenceSettlement = BaZiCalculator.buildEvidenceSettlement ? BaZiCalculator.buildEvidenceSettlement(bazi) : null;
    var dgWx = window.WU_XING[dg];
    var di = WXL.indexOf(dgWx);

    var SHENGWO = WXL[(di + 4) % 5]; // 印星
    var WOSHENG = WXL[(di + 1) % 5]; // 食伤
    var KEWO    = WXL[(di + 3) % 5]; // 官杀
    var WOKE    = WXL[(di + 2) % 5]; // 财星

    var positions = ['year','month','day','hour'];
    var posNames = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };

    var hints = [];
    var adjustments = [];

    // ============================================================
    // 1. 构建天干链和地支链
    // ============================================================
    var ganChain = positions.map(function(pos) {
      return { pillar: pos, wx: window.WU_XING[bazi[pos].gan], gan: bazi[pos].gan };
    });
    var zhiChain = positions.map(function(pos) {
      var zhi = bazi[pos].zhi;
      return { pillar: pos, wx: window.DI_ZHI_WU_XING[zhi], zhi: zhi };
    });

    // ============================================================
    // 2. 链检测：天干通道 (year→month→day)
    // ============================================================
    var relYM = simpleRel(ganChain[0].wx, ganChain[1].wx); // 年干→月干
    var relMD = simpleRel(ganChain[1].wx, ganChain[2].wx); // 月干→日干
    var relDH = simpleRel(ganChain[2].wx, ganChain[3].wx); // 日干→时干

    // 月干与日干直接关系
    var monthGanWx = ganChain[1].wx;
    var monthGan = ganChain[1].gan;

    // ---- 链A: 杀印相生（天干层面） ----
    // 月干为印，日干为日主 → 印贴生
    // 或月令为杀(地支)，月干/日支藏印通关
    var monthZhiWx = zhiChain[1].wx;
    var yinAdjacentGan = (monthGanWx === SHENGWO);               // 月干是印
    var yinInDayZhi = zhiContainsWx(bazi.day.zhi, SHENGWO);      // 日支藏印
    var yinInHourGan = (window.WU_XING[bazi.hour.gan] === SHENGWO); // 时干是印
    var monthMainGan = window.getCangGan(bazi.month.zhi)[0];
    var monthOfficerRole = BaZiCalculator.getShiShen(dg, monthMainGan) || '官杀';
    var guanShaInMonth = (monthOfficerRole === '正官' || monthOfficerRole === '七杀');

    if (guanShaInMonth && (yinAdjacentGan || yinInDayZhi)) {
      // 月令官/杀 + 有印贴身 → 官印相生或杀印相生，必须按真实十神区分。
      var sealSource;
      if (yinAdjacentGan) {
        sealSource = '月干' + monthGan + monthGanWx + (BaZiCalculator.getShiShen(dg, monthGan) || '印星');
      } else {
        var daySealGan = window.getCangGan(bazi.day.zhi).find(function(gan) {
          return window.WU_XING[gan] === SHENGWO;
        });
        sealSource = '日支' + bazi.day.zhi + '中藏' + daySealGan + SHENGWO
          + (BaZiCalculator.getShiShen(dg, daySealGan) || '印星');
      }
      var hasRoot = false;
      positions.forEach(function(pos) {
        if (bazi[pos].zhi === CHANG_SHENG[dg] || bazi[pos].zhi === LIN_GUAN[dg]) {
          hasRoot = !evidenceSettlement || evidenceSettlement.rootAt(pos).some(function(root) {
            return root.effectivePower > 0;
          });
        }
      });
      hints.push({
        type: 'structure',
        category: monthOfficerRole === '正官' ? '官印相生' : '杀印相生',
        text: '月令' + bazi.month.zhi + '主气' + monthMainGan + monthZhiWx + '为' + monthOfficerRole
          + '，并见' + sealSource + '贴近日主，形成' + (monthOfficerRole === '正官' ? '官印相生' : '杀印相生') + '的通关路径。'
          + (hasRoot ? '日主另有长生/禄根，结构承接较稳。' : '日主根气稍弱，仍需结合全局强弱判断。')
      });
    }

    // ---- 链B: 财党杀 / 财生杀印通关 ----
    // 路径: 年干(财?) → 月干/月支(杀?) → 日干(身)
    // 年干生月支(杀) / 年干克月干但月干生杀 / 年支生月支(杀)
    var yearGanToMonth = simpleRel(ganChain[0].wx, monthGanWx);   // 年干→月干
    var yearZhiToMonth = simpleRel(zhiChain[0].wx, monthZhiWx);    // 年支→月支
    var yearIsCai = (ganChain[0].wx === WOKE || zhiChain[0].wx === WOKE); // 年柱带财
    var monthIsSha = (monthZhiWx === KEWO || monthGanWx === KEWO); // 月柱带杀
    function formatGanEvidence(gan) {
      return gan + '（' + window.WU_XING[gan] + '，' + (BaZiCalculator.getShiShen(dg, gan) || '十神未定') + '）';
    }

    // 财→杀 生助路径存在
    var caiShengSha = false;
    var caiShengShaPath = '';
    if (yearGanToMonth === 'sheng' && monthGanWx === KEWO) {
      // 年干生月干(杀) — 紧贴，最强
      caiShengSha = true;
      caiShengShaPath = '年干' + formatGanEvidence(ganChain[0].gan) + '生月干' + formatGanEvidence(monthGan);
    } else if (yearZhiToMonth === 'sheng' && monthZhiWx === KEWO) {
      // 年支生月支(杀)
      caiShengSha = true;
      caiShengShaPath = '年支' + zhiChain[0].zhi + '（' + zhiChain[0].wx + '）生月支' + zhiChain[1].zhi + '（' + monthZhiWx + '）';
    } else if (simpleRel(ganChain[0].wx, monthZhiWx) === 'sheng' && monthZhiWx === KEWO) {
      // 年干生月支(杀) — 跨通道
      caiShengSha = true;
      caiShengShaPath = '年干' + formatGanEvidence(ganChain[0].gan) + '生月支' + zhiChain[1].zhi + '（' + monthZhiWx + '）';
    } else if (simpleRel(zhiChain[0].wx, monthGanWx) === 'sheng' && monthGanWx === KEWO) {
      caiShengSha = true;
      caiShengShaPath = '年支' + zhiChain[0].zhi + '（' + zhiChain[0].wx + '）生月干' + formatGanEvidence(monthGan);
    } else if (simpleRel(monthZhiWx, monthGanWx) === 'sheng' && monthZhiWx === WOKE && monthGanWx === KEWO) {
      // P5-B(B1) 同柱路径：月支(财)生月干(杀)——「财生杀格」复合的杀路径（如己丑壬申丙午壬辰：申金生壬杀）。
      // 原链B只查年→月生成，漏掉月柱同柱内部的财生杀，故补。
      caiShengSha = true;
      caiShengShaPath = '月支' + zhiChain[1].zhi + '（' + monthZhiWx + '）生月干' + formatGanEvidence(monthGan);
    }

    // yearIsCai 仅覆盖年柱带财的路径；同柱路径的财在月支，守卫放宽为「路径源头为财」。
    if (caiShengSha && monthIsSha && (yearIsCai || monthZhiWx === WOKE)) {
      // 财生杀 → 这是"财党杀"
      if (yinAdjacentGan || yinInDayZhi || yinInHourGan) {
        var chainSealSource;
        if (yinAdjacentGan) {
          chainSealSource = '月干' + formatGanEvidence(monthGan);
        } else if (yinInDayZhi) {
          var chainDaySealGan = window.getCangGan(bazi.day.zhi).find(function(gan) {
            return window.WU_XING[gan] === SHENGWO;
          });
          chainSealSource = '日支' + bazi.day.zhi + '中藏' + chainDaySealGan + SHENGWO
            + (BaZiCalculator.getShiShen(dg, chainDaySealGan) || '印星');
        } else {
          chainSealSource = '时干' + formatGanEvidence(bazi.hour.gan);
        }
        hints.push({
          type: 'structure',
          category: '财生杀印截',
          text: caiShengShaPath + '，同时见' + chainSealSource
            + '，存在官杀生印、印再生身的通关路径；能否有效转化仍须结合旺衰、透干与受制情况。'
        });
        adjustments.push({ wx: WOKE, action: 'highlight_ambivalent', reason: '财生官杀，同时存在官杀生印的候选通路，须结合全局判断能否通关' });
        adjustments.push({ wx: KEWO, action: 'highlight_ambivalent', reason: '官杀克身但同时存在生印路径，实际作用取决于印星承接与全局旺衰' });
      } else {
        // 无印截留 → 真正的财党杀
        hints.push({
          type: 'warning',
          category: '财党杀',
          text: caiShengShaPath + '→ 财星生助官杀，官杀直克日主，无印星通关。「财党杀，因财致祸。」'
        });
        adjustments.push({ wx: WOKE, action: 'upgrade_ji', reason: '财星党杀攻身，无印截断' });
      }
    }

    // ---- 链C: 食伤制杀 ----
    // 检查是否有食伤克制官杀（利好身弱）
    var shiShangZhiSha = false;
    if (guanShaInMonth) {
      // 月令为官/杀 → 看有没有食伤天干透出；按实际十神区分制杀、制官与伤官见官。
      positions.forEach(function(pos) {
        if (window.WU_XING[bazi[pos].gan] === WOSHENG) {
          shiShangZhiSha = true;
          var sourceRole = BaZiCalculator.getShiShen(dg, bazi[pos].gan) || '食伤';
          var mechanismName;
          var hintType = 'info';
          if (sourceRole === '食神' && monthOfficerRole === '七杀') mechanismName = '食神制杀';
          else if (sourceRole === '伤官' && monthOfficerRole === '正官') { mechanismName = '伤官见官'; hintType = 'warning'; }
          else if (monthOfficerRole === '正官') mechanismName = '食伤制官';
          else mechanismName = '食伤制杀';
          hints.push({
            type: hintType,
            category: mechanismName,
            text: posNames[pos] + '天干' + bazi[pos].gan + '（' + sourceRole + '·' + WOSHENG + '）克制月令'
              + monthMainGan + '（' + monthOfficerRole + '·' + KEWO + '）。'
          });
          if (monthOfficerRole === '七杀') {
            adjustments.push({ wx: WOSHENG, action: 'downgrade_ji', reason: sourceRole + '虽泄身但存在制七杀的结构作用' });
          } else {
            adjustments.push({ wx: WOSHENG, action: 'highlight_ambivalent', reason: sourceRole + '克正官，既有改进规则的能力，也可能造成规则与表达之间的摩擦' });
          }
        }
      });
    }

    // ============================================================
    // 3. 链检测：地支配伍
    // ============================================================
    // ---- 链D: 日支被冲/穿/刑，根气受损 ----
    var dayZhi = bazi.day.zhi;
    var dayZhiWx = window.DI_ZHI_WU_XING[dayZhi];

    // 检查日支是否藏有日主之根
    var hasDayZhiRoot = zhiContainsWx(dayZhi, dgWx);
    // 检查日支是否藏有印星之根
    var hasDayZhiYinRoot = zhiContainsWx(dayZhi, SHENGWO);

    // 日支被冲
    positions.forEach(function(pos) {
      if (pos === 'day') return;
      var otherZhi = bazi[pos].zhi;
      if (CHONG[dayZhi] === otherZhi) {
        hints.push({
          type: 'warning',
          category: '日支被冲',
          text: '日支' + dayZhi + '被' + posNames[pos] + '地支' + otherZhi + '冲——根基动摇。' +
               (hasDayZhiRoot ? '日主坐根被冲，力量打折扣。' : '')
        });
        if (hasDayZhiRoot) {
          adjustments.push({ wx: dgWx, action: 'downgrade_xi', reason: '日支被冲，根气受损' });
        }
      }
    });

    // 日支被害
    positions.forEach(function(pos) {
      if (pos === 'day') return;
      var otherZhi = bazi[pos].zhi;
      if (HAI[dayZhi] === otherZhi) {
        var isMonth = (pos === 'month');
        hints.push({
          type: 'warning',
          category: '日支被害',
          text: '日支' + dayZhi + '被' + posNames[pos] + '地支' + otherZhi + '穿害——' +
               (isMonth ? '月令穿害日支，力量最强，' : '') + '暗中破损，根气不纯。' +
               (hasDayZhiYinRoot ? '藏干印星亦受暗损。' : '')
        });
        if (hasDayZhiRoot) {
          adjustments.push({ wx: dgWx, action: 'downgrade_xi', reason: '日支被害，根气暗损' });
        }
        if (hasDayZhiYinRoot && yinAdjacentGan) {
          // 坐支印星被害但天干印透 → 天干印可补
          hints.push({
            type: 'info',
            category: '印星补偿',
            text: '日支藏印虽被害，但月干印星透出——天干透印可补地支之损，通关未断。'
          });
        }
      }
    });

    // 日支受刑
    positions.forEach(function(pos) {
      if (pos === 'day') return;
      var otherZhi = bazi[pos].zhi;
      if (XING_PAIRS[dayZhi + otherZhi]) {
        hints.push({
          type: 'info',
          category: '日支受刑',
          text: '日支' + dayZhi + '与' + posNames[pos] + '地支' + otherZhi + '相刑——暗中不和，需注意人际关系。'
        });
      }
    });

    // ============================================================
    // 4. 通根深度检测：日主的根气
    // ============================================================
    var rootDetails = [];
    var MU = { '甲':'未','乙':'戌','丙':'戌','丁':'丑','戊':'辰','己':'未','庚':'丑','辛':'辰','壬':'辰','癸':'未' };
    positions.forEach(function(pos) {
      var zhi = bazi[pos].zhi;
      if (zhi === LIN_GUAN[dg]) {
        rootDetails.push(posNames[pos] + '地支' + zhi + '为日主禄位（强根）');
      }
      if (zhi === CHANG_SHENG[dg]) {
        rootDetails.push(posNames[pos] + '地支' + zhi + '为日主长生之位（有气之根，靠印滋养）');
      }
      if (zhi === MU[dg]) {
        rootDetails.push(posNames[pos] + '地支' + zhi + '为日主墓库（弱根，是否发动需看冲合）');
      }
      window.getCangGan(zhi).forEach(function(hiddenGan, hiddenIndex) {
        if (window.WU_XING[hiddenGan] !== dgWx) return;
        var depth = hiddenIndex === 0 ? '本气强根' : (hiddenIndex === 1 ? '中气根' : '余气根');
        rootDetails.push(posNames[pos] + '地支' + zhi + '藏' + hiddenGan + dgWx + '（' + depth + '）');
      });
    });
    if (rootDetails.length > 0) {
      hints.push({
        type: 'info',
        category: '日主根气',
        text: rootDetails.join('；')
      });
    } else {
      hints.push({
        type: 'warning',
        category: '日主无根',
        text: '日主' + dg + dgWx + '在原局未见禄位、长生、墓库或同五行藏干，根气较浅，仍需结合天干生扶与月令判断。'
      });
    }

    // ============================================================
    // 4½. 库冲开库检测（丑未冲/辰戌冲 + 丑未戌三刑）
    // 库冲按“藏干受引动”记录；是否真正成事仍需结合透干、月令与喜忌。
    // 丑(金库) 未(木库) 辰(水库) 戌(火库)
    // ============================================================
    var STORAGE_DEF = {
      '丑': { stores:'金' }, '未': { stores:'木' },
      '辰': { stores:'水' }, '戌': { stores:'火' }
    };
    var STORAGE_CLASH = { '丑':'未','未':'丑','辰':'戌','戌':'辰' };

    // 收集命局中所有库位
    var storagePos = [];
    positions.forEach(function(pos) {
      var z = bazi[pos].zhi;
      if (STORAGE_DEF[z]) storagePos.push({ pos:pos, zhi:z, idx:positions.indexOf(pos) });
    });

    var openedStorages = {}; // zhi → { def, openedBy: [{byZhi, type, isAdj}] }
    if (storagePos.length >= 2) {
      for (var spi = 0; spi < storagePos.length; spi++) {
        for (var spj = spi + 1; spj < storagePos.length; spj++) {
          var sA = storagePos[spi], sB = storagePos[spj];
          var isClash = STORAGE_CLASH[sA.zhi] === sB.zhi;
          var isXing = XING_PAIRS[sA.zhi + sB.zhi];
          var isAdj = Math.abs(sA.idx - sB.idx) === 1;

          if (isClash || isXing) {
            var openType = isClash ? (isAdj ? '紧贴库冲' : '跨柱库冲') : (isAdj ? '紧贴库刑' : '跨柱库刑');
            [sA, sB].forEach(function(s) {
              if (!openedStorages[s.zhi]) openedStorages[s.zhi] = { zhi:s.zhi, def:STORAGE_DEF[s.zhi], openedBy:[] };
              openedStorages[s.zhi].openedBy.push({ byZhi:(s===sA?sB:sA).zhi, type:openType, pos:s.pos });
            });
          }
        }
      }
    }

    if (Object.keys(openedStorages).length > 0) {
      // 收集受冲刑引动的藏干（中气+余气；本气始终参与原局判断）
      var activatedHiddenStems = []; // { wx, gan, fromZhi, relationToDay, role }
      Object.keys(openedStorages).forEach(function(zhi) {
        var sto = openedStorages[zhi];
        window.getCangGan(zhi).forEach(function(hiddenGan, cidx) {
          if (cidx === 0) return; // 本气不受库锁影响
          var hiddenWx = window.WU_XING[hiddenGan];
          activatedHiddenStems.push({
            wx: hiddenWx, gan: hiddenGan, fromZhi: zhi,
            relToDay: simpleRel(hiddenWx, dgWx),
            role: BaZiCalculator.getShiShen(dg, hiddenGan) || '十神未定'
          });
        });
      });

      // 三刑俱全检测
      var hasAllThree = openedStorages['丑'] && openedStorages['未'] && openedStorages['戌'];

      // 分析受引动元素是否存在可用通路
      var usefulPaths = [];
      activatedHiddenStems.forEach(function(el) {
        var r = el.relToDay;

        // ① 受引动的是印星 → 记录印星根气候选证据
        if (r === 'sheng') {
          usefulPaths.push({
            title: '印星得库根',
            desc: el.fromZhi + '库受冲/刑，藏干' + el.gan + '（印星）受到引动，'
                 + '是否形成有效生身仍需看透干与全局承接。',
            wx: el.wx, priority: 3
          });
        }
        // ② 受引动五行生印星 → 记录间接生身候选路径（如：官→印→身）
        else if (simpleRel(el.wx, SHENGWO) === 'sheng') {
          // 确认印星在原局确实存在
          var hasYinInChart = hasWxAnywhere(bazi, SHENGWO);
          if (hasYinInChart) {
            usefulPaths.push({
              title: '官/杀印通关',
              desc: el.fromZhi + '库藏' + el.gan + '（' + el.wx + '，' + el.role + '）受到引动，'
                   + '存在生印、印再生身的通关可能。',
              wx: el.wx, priority: 3
            });
          }
        }
        // ③ 受引动的是日主同类 → 记录同类根气候选证据
        else if (r === 'tong') {
          usefulPaths.push({
            title: '日主得库气',
            desc: el.fromZhi + '库藏' + el.gan + '受到引动，与日主同五行，'
                 + '可作为根气增强的候选证据。',
            wx: el.wx, priority: 2
          });
        }
      });

      // ---- 输出 ----
      if (hasAllThree) {
        hints.push({
          type: 'structure',
          category: '三刑俱全',
          text: '丑、未、戌三库全现——"恃势之刑"，三库联动。' +
               (usefulPaths.length > 0
                 ? '三库同时被撬开，' + usefulPaths.map(function(p) { return p.title; }).join('、') + '。' +
                   '既见潜在通路，也须同时评估土气变化与日主承受能力。'
                 : '三库虽受引动，但藏干能否透出发挥作用，仍须结合全局判断。')
        });
      } else if (Object.keys(openedStorages).length >= 2) {
        var zhiNames = Object.keys(openedStorages).join('、');
        hints.push({
          type: 'structure',
          category: '库冲开库',
          text: zhiNames + '库支发生冲/刑，相关藏干受到引动。' +
               (usefulPaths.length > 0 ? usefulPaths.map(function(p) { return p.title; }).join('、') + '。' : '')
        });
      }

      // 独立成条：每条有用通路
      usefulPaths.sort(function(a, b) { return b.priority - a.priority; });
      usefulPaths.forEach(function(p) {
        hints.push({ type: 'structure', category: p.title, text: p.desc });
        // 生成调整
        if (p.title === '官/杀印通关') {
          adjustments.push({ wx: p.wx, action: 'highlight_ambivalent',
            reason: '库支受冲刑后，' + p.wx + '（官杀）存在官杀生印、印再生身的通关可能；能否转化须看透干、旺衰及全局承接' });
        }
        if (p.title === '印星得库根') {
          adjustments.push({ wx: p.wx, action: 'highlight_enhanced',
            reason: '库支受冲刑后印星藏干受到引动，可作为印星根气增强的候选证据，仍须结合透干与受制情况' });
        }
      });

      // 副作用提示：库开同时土被冲/刑旺
      var hasTuStorage = openedStorages['丑'] || openedStorages['未'] || openedStorages['辰'] || openedStorages['戌'];
      // 丑未辰戌本气全都是土（丑己/未己/辰戊/戌戊）
      if (hasTuStorage && usefulPaths.length > 0) {
        hints.push({
          type: 'info',
          category: '库开代价',
          text: '库支发生冲/刑时，除藏干受到引动外，也会改变土气的稳定状态。土在本命中所对应的十神及其喜忌，须与相关藏干一并权衡。'
        });
      }
    }

    // ============================================================
    // 5. 《滴天髓》十天干口诀匹配
    // ============================================================
    var allZhi = [bazi.year.zhi, bazi.month.zhi, bazi.day.zhi, bazi.hour.zhi];
    var diTianSuiHints = [];
    var monthZhi = bazi.month.zhi;
    var seasonByMonth = {
      '寅':'春','卯':'春','辰':'春', '巳':'夏','午':'夏','未':'夏',
      '申':'秋','酉':'秋','戌':'秋', '亥':'冬','子':'冬','丑':'冬'
    };
    var season = seasonByMonth[monthZhi];

    // ---- 甲木章 ----
    if (dg === '甲') {
      if (season === '秋') {
        var hasFireJ = hasWxAnywhere(bazi, '火');
        var earthCountJ = positions.reduce(function(s, pos) {
          return s + (window.WU_XING[bazi[pos].gan] === '土' ? 1 : 0) + (window.DI_ZHI_WU_XING[bazi[pos].zhi] === '土' ? 1 : 0);
        }, 0);
        if (!hasFireJ) diTianSuiHints.push('「脱胎要火」——秋木凋零，无火则木不秀发');
        if (earthCountJ >= 2) diTianSuiHints.push('「秋不容土」——秋木杀重，再见厚土则财党杀攻身');
        if (!hasFireJ && earthCountJ >= 2) {
          adjustments.push({ wx: '土', action: 'upgrade_ji', reason: '《滴天髓》甲木"秋不容土"：秋木杀重，土财党杀为大忌' });
          adjustments.push({ wx: '火', action: 'downgrade_ji', reason: '《滴天髓》甲木"脱胎要火"：秋木需火暖局，虽泄身但调候所需' });
        }
      }
      if (season === '春') {
        var hasMetalSpr = positions.some(function(p) { return window.WU_XING[bazi[p].gan] === '金' || window.DI_ZHI_WU_XING[bazi[p].zhi] === '金'; });
        if (hasMetalSpr) diTianSuiHints.push('「春不容金」——春木嫩，金来克之伤残');
      }
      if (hasWxAnywhere(bazi, '火') && hasWxAnywhere(bazi, '水')) {
        diTianSuiHints.push('「地润天和」——水火既济，甲木得润得暖，根基深厚');
      }
    }

    // ---- 乙木章 ----
    if (dg === '乙') {
      // 刲羊解牛：乙木在未/丑月有根，不怕土重
      if (monthZhi === '未' || monthZhi === '丑') {
        diTianSuiHints.push('「刲羊解牛」——乙木坐未/丑月，柔木能制旺土，不惧财重');
      }
      // 怀丁抱丙：冬月乙木需火暖局
      if (season === '冬') {
        var hasFireYi = hasWxAnywhere(bazi, '火');
        if (!hasFireYi) diTianSuiHints.push('「怀丁抱丙」——冬木寒湿，无火则不荣');
        if (hasFireYi) {
          adjustments.push({ wx: '火', action: 'downgrade_ji', reason: '《滴天髓》乙木"怀丁抱丙"：冬木需火暖局，火泄身反为吉' });
        }
      }
      // 藤萝系甲：乙见甲，可春可秋
      var hasJia = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('甲') >= 0;
      if (hasJia) diTianSuiHints.push('「藤萝系甲」——乙见甲木如藤附大树，春不畏金秋不畏土');
      // 跨凤乘猴：酉申月需甲/火
      if ((monthZhi === '申' || monthZhi === '酉') && !hasJia) {
        diTianSuiHints.push('「跨凤乘猴」——乙木在申酉绝地，无甲则藤无所附，宜见火制金');
        if (!hasWxAnywhere(bazi, '火')) {
          adjustments.push({ wx: '火', action: 'downgrade_ji', reason: '《滴天髓》乙木"跨凤乘猴"需火制金护木' });
        }
      }
    }

    // 水多木漂同时适用于甲、乙木，但不能仅凭“冬月见三处水”下结论；
    // 统一读取主引擎的根气、成势与火土制化结算。
    if (dg === '甲' || dg === '乙') {
      var waterloggedState = window.BaZiCalculator && window.BaZiCalculator.getWaterloggedWoodState
        ? window.BaZiCalculator.getWaterloggedWoodState(bazi) : null;
      if (waterloggedState && waterloggedState.applies) {
        diTianSuiHints.push('「虚湿之地，骑马亦忧」——旺水成势而木无完整寅卯根，印星反成水多木漂；宜先'
          + (waterloggedState.primaryRemedy === '土' ? '以燥土制水筑堤' : '以有根之火暖局泄印') + '，再议扶木');
      }
    }

    // ---- 丙火章 ----
    if (dg === '丙') {
      if (season === '冬') {
        diTianSuiHints.push('「欺霜侮雪」——丙火猛烈，冬月亦不畏寒，调候需求远低于丁火');
      }
      // 逢辛反怯：丙遇辛金合住
      if ([bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('辛') >= 0) {
        diTianSuiHints.push('「逢辛反怯」——丙火遇辛金合，烈性被羁，光辉不显');
        adjustments.push({ wx: '金', action: 'highlight_ambivalent', reason: '《滴天髓》"逢辛反怯"：辛合丙，财来合身反失其烈' });
      }
      // 土众成慈：土多泄火
      var earthCountBing = positions.reduce(function(s, p) {
        return s + (window.WU_XING[bazi[p].gan] === '土' ? 1 : 0) + (window.DI_ZHI_WU_XING[bazi[p].zhi] === '土' ? 1 : 0);
      }, 0);
      if (earthCountBing >= 3) diTianSuiHints.push('「土众成慈」——土多泄火过甚，丙火烈性转温和，但泄身太过需制土');
      // 水猖显节：水多时水火既济
      var waterCountBing = positions.reduce(function(s, p) {
        return s + (window.WU_XING[bazi[p].gan] === '水' ? 1 : 0) + (window.DI_ZHI_WU_XING[bazi[p].zhi] === '水' ? 1 : 0);
      }, 0);
      if (waterCountBing >= 2) {
        diTianSuiHints.push('「水猖显节」——水旺克火反显丙火之节操，水火既济为贵');
      }
      // 虎马犬乡：寅午戌三合火局
      var hasSanHeHuo = allZhi.indexOf('寅') >= 0 && allZhi.indexOf('午') >= 0 && allZhi.indexOf('戌') >= 0;
      if (hasSanHeHuo) {
        var hasJiaBing = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('甲') >= 0;
        if (hasJiaBing) diTianSuiHints.push('「虎马犬乡，甲木来焚」——三合火局炎上，甲木生火则火炎土燥，物被焚灭');
      }
    }

    // ---- 丁火章 ----
    if (dg === '丁') {
      diTianSuiHints.push('「旺而不烈，衰而不穷」——丁火柔中，不似丙火刚暴，根基不易灭');
      // 如有嫡母，可秋可冬：甲木生丁
      var hasJiaDing = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('甲') >= 0;
      if (hasJiaDing && (season === '秋' || season === '冬')) {
        diTianSuiHints.push('「如有嫡母，可秋可冬」——甲木（嫡母）生丁火，秋冬有甲则不熄');
        adjustments.push({ wx: '木', action: 'highlight_enhanced', reason: '《滴天髓》丁火"如有嫡母"：甲木生丁，秋冬印星尤为珍贵' });
      }
      // 抱乙而孝：乙木生丁
      var hasYiDing = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('乙') >= 0;
      if (hasYiDing) diTianSuiHints.push('「抱乙而孝」——乙木偏印生丁火，如子得母');
      // 冬月无甲
      if (season === '冬' && !hasJiaDing) {
        diTianSuiHints.push('冬月丁火，无甲木生扶则灯火飘摇，宜有甲木暖根');
      }
    }

    // ---- 戊土章 ----
    if (dg === '戊') {
      // 水润物生，火燥物病
      if (season === '夏') {
        var hasWaterWu = hasWxAnywhere(bazi, '水');
        if (!hasWaterWu) diTianSuiHints.push('「火燥物病」——夏土焦裂，无水润泽则万物不生');
        if (hasWaterWu) {
          adjustments.push({ wx: '水', action: 'downgrade_ji', reason: '《滴天髓》戊土"水润物生"：夏土喜水滋润，财星反成调候之宝' });
        }
      }
      // 若在艮坤，怕冲宜静：寅(艮)申(坤)月
      if ((monthZhi === '寅' || monthZhi === '申') && CHONG[monthZhi]) {
        var hasChong = positions.some(function(p) { return bazi[p].zhi === CHONG[monthZhi]; });
        if (hasChong) diTianSuiHints.push('「若在艮坤，怕冲宜静」——寅申月戊土逢冲，根基动摇');
      }
      diTianSuiHints.push('「既中且正」——戊土敦厚诚信，承载万物，喜水润火暖土助');
    }

    // ---- 己土章 ----
    if (dg === '己') {
      diTianSuiHints.push('「不愁木盛，不畏水狂」——己土卑湿柔韧，木克不倒水冲不散');
      // 火少火晦
      var hasFireJi = positions.filter(function(p) { return window.WU_XING[bazi[p].gan] === '火'; }).length;
      if (hasFireJi <= 0) diTianSuiHints.push('「火少火晦」——无火生土则己土暗昧，宜丙火照暖');
      // 金多金光
      var metalCountJi = positions.reduce(function(s, p) {
        return s + (window.WU_XING[bazi[p].gan] === '金' ? 1 : 0) + (window.DI_ZHI_WU_XING[bazi[p].zhi] === '金' ? 1 : 0);
      }, 0);
      if (metalCountJi >= 3) diTianSuiHints.push('「金多金光」——金多泄土，但己土生金，反显光华，宜辩证看待');
      diTianSuiHints.push('「宜助宜帮」——己土喜丙火生、戊土帮，得助则万物茂盛');
    }

    // ---- 庚金章 ----
    if (dg === '庚') {
      // 得水而清
      if (hasWxAnywhere(bazi, '水')) {
        diTianSuiHints.push('「得水而清」——水洗庚金，锋芒更利，食伤泄秀为贵');
      }
      // 得火而锐
      if (hasWxAnywhere(bazi, '火')) {
        diTianSuiHints.push('「得火而锐」——火炼庚金成器，官杀制身反成栋梁');
        adjustments.push({ wx: '火', action: 'highlight_ambivalent', reason: '《滴天髓》庚金"得火而锐"：火炼金刚，官杀虽克身却能成器' });
      }
      // 土润则生，土干则脆
      if (season === '夏' || monthZhi === '未' || monthZhi === '戌') {
        var hasWaterGen = hasWxAnywhere(bazi, '水');
        if (!hasWaterGen) diTianSuiHints.push('「土干则脆」——燥土不生金反脆金，夏月无水土焦金碎');
      }
      // 能赢甲兄，输于乙妹
      var hasYiGen = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('乙') >= 0;
      if (hasYiGen) diTianSuiHints.push('「输于乙妹」——庚遇乙木合，刚金被柔木牵绊，锐气内敛');
    }

    // ---- 辛金章 ----
    if (dg === '辛') {
      // 畏土之叠
      var earthCountXin = positions.reduce(function(s, p) {
        return s + (window.WU_XING[bazi[p].gan] === '土' ? 1 : 0) + (window.DI_ZHI_WU_XING[bazi[p].zhi] === '土' ? 1 : 0);
      }, 0);
      if (earthCountXin >= 4) diTianSuiHints.push('「畏土之叠」——土多埋金，辛金珠玉之光被掩');
      // 乐水之盈
      if (hasWxAnywhere(bazi, '水')) {
        diTianSuiHints.push('「乐水之盈」——水淘辛金，珠玉愈发光洁，食伤泄秀为美');
      }
      // 热则喜母，寒则喜丁
      if (season === '夏') {
        diTianSuiHints.push('「热则喜母」——夏金销熔，喜湿土（辰丑）生金护金');
      }
      if (season === '冬') {
        var hasDingXin = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('丁') >= 0;
        if (!hasDingXin) diTianSuiHints.push('「寒则喜丁」——冬金寒凝，宜丁火暖局炼金');
        if (hasDingXin) {
          adjustments.push({ wx: '火', action: 'downgrade_ji', reason: '《滴天髓》辛金"寒则喜丁"：冬金需丁火暖局，火克金反成调候之功' });
        }
      }
    }

    // ---- 壬水章 ----
    if (dg === '壬') {
      // 通根透癸
      var hasGui = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('癸') >= 0;
      var hasWaterRoot = positions.some(function(p) {
        return window.DI_ZHI_WU_XING[bazi[p].zhi] === '水';
      });
      if (hasGui && hasWaterRoot) {
        diTianSuiHints.push('「通根透癸，冲天奔地」——壬水有根又透癸，水势浩荡，需戊土堤防');
        if (!hasWxAnywhere(bazi, '土')) {
          adjustments.push({ wx: '土', action: 'downgrade_ji', reason: '《滴天髓》壬水"冲天奔地"需戊土堤防，土制水反为用' });
        }
      }
      // 化则有情：丁壬合化木
      var hasDingRen = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('丁') >= 0;
      if (hasDingRen) diTianSuiHints.push('「化则有情」——丁壬合化木，合则有情有义，化气为贵');
      diTianSuiHints.push('「刚中之德，周流不滞」——壬水通达，适应力强，顺势而为');
    }

    // ---- 癸水章 ----
    if (dg === '癸') {
      diTianSuiHints.push('「至弱达于天津」——癸水至柔，但能润泽万物，柔中带刚');
      // 得龙而运：见辰则通
      if (allZhi.indexOf('辰') >= 0) {
        diTianSuiHints.push('「得龙而运」——癸水见辰（龙）为水库，得库则运化通神');
      }
      diTianSuiHints.push('「不愁火土，不论庚辛」——癸水至柔，不畏火土之克，不拘庚辛之生');
      // 合戊见火
      var hasWuGui = [bazi.year.gan, bazi.month.gan, bazi.hour.gan].indexOf('戊') >= 0;
      if (hasWuGui && hasWxAnywhere(bazi, '火')) {
        diTianSuiHints.push('「合戊见火，化象斯真」——戊癸合，见火则化火成真，格局为贵');
      }
    }

    // ============================================================
    // 滴天髓通用：调候季月速查 (all stems, supplemental to above)
    // ============================================================
    // 夏月通用
    if (season === '夏') {
      if ((dgWx === '金' || dgWx === '土') && !hasWxAnywhere(bazi, '水')) {
        diTianSuiHints.push('《滴天髓》调候：夏月' + dgWx + '燥渴，无水润泽则金脆土焦');
      }
    }
    // 冬月通用
    if (season === '冬') {
      if ((dgWx === '木' || dgWx === '金') && !hasWxAnywhere(bazi, '火')) {
        diTianSuiHints.push('《滴天髓》调候：冬月' + dgWx + '寒凝，无火暖局则不荣不锐');
      }
    }

    // 输出滴天髓 hints
    if (diTianSuiHints.length > 0) {
      hints.push({
        type: 'classic',
        category: '滴天髓',
        text: '《滴天髓》' + dg + dgWx + '章：' + diTianSuiHints.join('；') + '。'
      });
    }

    // ============================================================
    // 6. 合并同类调整。同一五行可以同时存在不同作用，禁止 first-write-wins 丢证据。
    // ============================================================
    var finalAdjustments = [];
    var groupedAdjustments = {};
    for (var a = 0; a < adjustments.length; a++) {
      var adj = adjustments[a];
      var adjustmentKey = adj.wx + '|' + adj.action;
      if (!groupedAdjustments[adjustmentKey]) {
        groupedAdjustments[adjustmentKey] = { wx:adj.wx, action:adj.action, reasons:[] };
        finalAdjustments.push(groupedAdjustments[adjustmentKey]);
      }
      if (groupedAdjustments[adjustmentKey].reasons.indexOf(adj.reason) < 0) groupedAdjustments[adjustmentKey].reasons.push(adj.reason);
    }
    finalAdjustments.forEach(function(item) { item.reason = item.reasons.join('；'); });

    var factGraph = buildFactGraph(bazi);
    var derived = deriveMechanisms(factGraph);

    return {
      adjustments: finalAdjustments,
      hints: hints,
      ganChain: ganChain,
      zhiChain: zhiChain,
      factGraph: factGraph,
      mechanisms: derived.mechanisms,
      paths: derived.paths
    };
  }

  function interpretChains(bazi, yongJi) {
    var analyzed = analyzeChains(bazi);
    return {
      version:'3.0',
      factGraph:analyzed.factGraph,
      mechanisms:analyzed.mechanisms,
      paths:analyzed.paths,
      // imagery 是有证据和限制条件的“候选取象”，供 AI 综合，不是最终断语。
      imagery:buildImagery(bazi, analyzed.mechanisms, analyzed.paths, yongJi),
      constraints:[
        '取象不得覆盖冻结的旺衰、格局、喜用忌结论',
        '合、冲、刑、害、破只代表关系被引动，吉凶必须结合喜用忌和受作用对象',
        '藏干证据按本气、中气、余气降权，隔柱关系按距离降权',
        '多个候选取象并存时由 AI 综合，禁止只取一句作绝对结论'
      ]
    };
  }

  /**
   * 大运喜用忌联动分析
   * 原局的喜用忌是静态的，大运介入后每个元素的作用会变化
   * 例：原局忌金，但走水运时金生水→水生木，金反成水源
   */
  function analyzeFortuneImpact(bazi, daYunList, yongJi) {
    var dg = bazi.day.gan;
    var dgWx = window.WU_XING[dg];
    var di = WXL.indexOf(dgWx);
    var SHENGWO = WXL[(di + 4) % 5];
    var WOSHENG = WXL[(di + 1) % 5];
    var KEWO    = WXL[(di + 3) % 5];
    var WOKE    = WXL[(di + 2) % 5];

    var xiSet = (yongJi && yongJi.xiShen) ? yongJi.xiShen.slice() : [];
    var jiSet = (yongJi && yongJi.jiShen) ? yongJi.jiShen.slice() : [];
    var yongSet = (yongJi && yongJi.yongShen) ? yongJi.yongShen.slice() : [];
    var ledgerMap = {};
    if (yongJi && yongJi.elementRoleLedger && yongJi.elementRoleLedger.entries) {
      yongJi.elementRoleLedger.entries.forEach(function(item) { ledgerMap[item.element] = item; });
    }

    // 判断某五行在当前喜用忌分类中的角色
    function wxRole(wx) {
      if (ledgerMap[wx] && ledgerMap[wx].fortuneRole) return ledgerMap[wx].fortuneRole;
      if (yongSet.indexOf(wx) >= 0) return '用神';
      if (xiSet.indexOf(wx) >= 0) return '喜神';
      if (jiSet.indexOf(wx) >= 0) return '忌神';
      return '中性';
    }

    // 从原局裁决取得行运基础分。十神只解释发生什么，不再直接决定吉凶。
    function wxFortune(wx) {
      var item = ledgerMap[wx] || {};
      var role = wxRole(wx);
      var level = item.fortuneLevel || (role === '用神' ? '核心有利'
        : role === '喜神' ? '总体有利' : role === '忌神' ? '总体不利' : '中性双向');
      var scoreMap = { '核心有利':3, '总体有利':2, '条件有利':1, '中性双向':0, '总体不利':-2 };
      return {
        role:role,
        level:level,
        score:Object.prototype.hasOwnProperty.call(scoreMap, level) ? scoreMap[level] : 0,
        direction:item.fortuneDirection || ''
      };
    }

    // 某五行与日主的关系名
    function relName(wx) {
      if (wx === dgWx) return '比劫';
      if (wx === SHENGWO) return '印星';
      if (wx === WOSHENG) return '食伤';
      if (wx === WOKE) return '财星';
      if (wx === KEWO) return '官杀';
      return '五行';
    }

    var positions = ['year','month','day','hour'];
    var periods = [];

    if (!daYunList || !daYunList.length) return { periods: [], summary: '无大运数据' };

    daYunList.forEach(function(dy, idx) {
      var ganWx = window.WU_XING[dy.gan];
      var zhiWx = window.DI_ZHI_WU_XING[dy.zhi];
      var ganFortune = wxFortune(ganWx), zhiFortune = wxFortune(zhiWx);
      var ganRole = ganFortune.role;
      var zhiRole = zhiFortune.role;

      // 大运与日主关系
      var ganRel = simpleRel(ganWx, dgWx);
      var zhiRel = simpleRel(zhiWx, dgWx);

      // 检测大运与原局的特殊互动
      var interactions = [];
      // 大运冲原局月柱地支（提纲被冲）
      if (CHONG[dy.zhi] === bazi.month.zhi) {
        var monthTargetRole = wxRole(window.DI_ZHI_WU_XING[bazi.month.zhi]);
        var monthClashGood = monthTargetRole === '忌神' && (zhiRole === '用神' || zhiRole === '喜神');
        var monthClashDirection = monthClashGood ? true
          : ((monthTargetRole === '用神' || monthTargetRole === '喜神') ? false : null);
        interactions.push({ type: '六冲', target:'month', role:zhiRole, targetRole:monthTargetRole, isGood:monthClashDirection,
          text:'大运' + dy.zhi + '冲提纲（月支' + bazi.month.zhi + '）；大运支为' + zhiRole + '，月支为' + monthTargetRole
            + '。' + (monthClashGood ? '有利力量冲动原局忌神，可能先经历环境变化，再出现改善。' : '工作、家庭或生活基础更容易发生明显变化。') });
      }
      // 大运冲原局日支（夫妻/自身根基被冲）
      if (CHONG[dy.zhi] === bazi.day.zhi) {
        var dayTargetRole = wxRole(window.DI_ZHI_WU_XING[bazi.day.zhi]);
        var dayClashGood = dayTargetRole === '忌神' && (zhiRole === '用神' || zhiRole === '喜神');
        var dayClashDirection = dayClashGood ? true
          : ((dayTargetRole === '用神' || dayTargetRole === '喜神') ? false : null);
        interactions.push({ type: '六冲', target:'day', role:zhiRole, targetRole:dayTargetRole, isGood:dayClashDirection,
          text:'大运' + dy.zhi + '冲日支' + bazi.day.zhi + '（夫妻宫/自身根基）；大运支为' + zhiRole + '，日支为' + dayTargetRole
            + '。' + (dayClashGood ? '原来不利的相处或生活结构可能被打破，但过程仍会先有明显变化。' : '关系、居所或个人状态更容易出现明显变化。') });
      }
      // 大运与原局三合
      var allZhi = [bazi.year.zhi, bazi.month.zhi, bazi.day.zhi, bazi.hour.zhi];
      var SAN_HE_TRI = [['寅','午','戌','火'],['亥','卯','未','木'],['申','子','辰','水'],['巳','酉','丑','金']];
      SAN_HE_TRI.forEach(function(tri) {
        var needed = [tri[0], tri[1], tri[2]];
        var present = needed.filter(function(z) { return allZhi.indexOf(z) >= 0 || z === dy.zhi; });
        if (present.length === 3 && allZhi.indexOf(dy.zhi) < 0) {
          // 大运补齐了三合局!
          var heWx = tri[3];
          var heRole = wxRole(heWx);
          var heIsGood = heRole === '用神' || heRole === '喜神'
            ? true
            : (heRole === '忌神' ? false : null);
          interactions.push({
            type: 'structure', target:'structure',
            formedWx: heWx,
            role: heRole,
            isGood: heIsGood,
            text: '大运' + dy.zhi + '补全三合' + heWx + '局，所化五行在本命喜忌中为' + heRole + '；是否成化仍需结合月令、透干与受制情况判断。'
          });
        }
      });

      // 大运天干对原局四干：五合与双向相克均记录，不能只看大运五行名称。
      positions.forEach(function(pos) {
        var natalGan = bazi[pos].gan;
        var natalGanWx = window.WU_XING[natalGan];
        if (GAN_HE_PAIR[dy.gan] === natalGan) {
          var formedWx = GAN_HE_WX[dy.gan + natalGan];
          interactions.push({
            type:'天干五合', target:pos, formedWx:formedWx, role:wxRole(formedWx), isGood:null,
            text:'大运' + dy.gan + '合' + POS_NAMES[pos] + natalGan + '，候选化' + formedWx
              + '；合只表示牵引，须看月令、透根和受制后再定是否成化。'
          });
        }
        var ganDirection = relationDirection(ganWx, natalGanWx);
        if (ganDirection && ganDirection.type === '克') {
          var ganController = ganDirection.fromFirst ? dy.gan : natalGan;
          var ganControlled = ganDirection.fromFirst ? natalGan : dy.gan;
          interactions.push({
            type:'天干克', target:pos, role:ganDirection.fromFirst ? ganRole : wxRole(natalGanWx), isGood:null,
            text:(ganDirection.fromFirst ? '大运' : POS_NAMES[pos]) + ganController + '克'
              + (ganDirection.fromFirst ? POS_NAMES[pos] : '大运') + ganControlled + '，表示对应事务发生直接制约。'
          });
        }
      });

      // 大运地支对原局四支：冲、害、刑、自刑、合、破全量枚举。
      positions.forEach(function(pos) {
        var natalZhi = bazi[pos].zhi, pair = dy.zhi + natalZhi;
        var natalWx = window.DI_ZHI_WU_XING[natalZhi], natalRole = wxRole(natalWx);
        var relationTypes = [];
        if (CHONG[dy.zhi] === natalZhi) relationTypes.push('六冲');
        if (HAI[dy.zhi] === natalZhi) relationTypes.push('六害');
        if (XING_PAIRS[pair]) relationTypes.push('刑');
        if (dy.zhi === natalZhi && SELF_XING[dy.zhi]) relationTypes.push('自刑');
        if (ZHI_HE[pair]) relationTypes.push('六合');
        if (ZHI_PO[pair]) relationTypes.push('六破');
        relationTypes.forEach(function(type) {
          if (type === '六冲' && (pos === 'month' || pos === 'day')) return; // 上方已有高优先级说明
          var isGood = null, note = '只表示该位置被引动';
          if (type === '六冲' && natalRole === '忌神' && (zhiRole === '用神' || zhiRole === '喜神')) {
            isGood = true; note = '有利力量冲动原局忌神，可能先变后改善';
          } else if (type === '六冲' && (natalRole === '用神' || natalRole === '喜神')) {
            isGood = false; note = '原局有利位置被冲，稳定性下降';
          } else if (type !== '六合') {
            isGood = false; note = '容易带来摩擦、反复或结构变化';
          }
          interactions.push({
            type:type, target:pos, role:zhiRole, targetRole:natalRole, isGood:isGood,
            text:'大运' + dy.zhi + type + POS_NAMES[pos] + natalZhi + '；大运支为' + zhiRole
              + '，目标支为' + natalRole + '，' + note + '。'
          });
        });
      });

      // 三会及半合/半会补充；完整成局按所成五行喜忌标方向，半局只作候选牵引。
      function addFortuneGroups(groups, fullType, halfType, requireMiddle) {
        groups.forEach(function(group) {
          if (group.slice(0,3).indexOf(dy.zhi) < 0 || allZhi.indexOf(dy.zhi) >= 0) return;
          var members = group.slice(0,3), beforeFound = members.filter(function(z){ return allZhi.indexOf(z) >= 0; });
          var full = beforeFound.length >= 2;
          var half = !full && beforeFound.length === 1;
          if (half && requireMiddle) half = members.indexOf(dy.zhi) === 1 || beforeFound.indexOf(members[1]) >= 0;
          if (half && !requireMiddle) half = Math.abs(members.indexOf(dy.zhi) - members.indexOf(beforeFound[0])) === 1;
          if (!full && !half) return;
          var type = full ? fullType : halfType, formedWx = group[3], formedRole = wxRole(formedWx);
          var shownMembers = full ? members : members.filter(function(z) { return z === dy.zhi || beforeFound.indexOf(z) >= 0; });
          interactions.push({
            type:type, target:'structure', formedWx:formedWx, role:formedRole,
            isGood:full ? (formedRole === '用神' || formedRole === '喜神' ? true : (formedRole === '忌神' ? false : null)) : null,
            text:'大运' + dy.zhi + (full ? '补成' : '形成') + shownMembers.join('') + type + formedWx + '势，所成五行为' + formedRole
              + '；' + (full ? '是否成化仍须结合月令、透干与受制。' : '只作局部牵引，不按完整成局。')
          });
        });
      }
      addFortuneGroups(SAN_HE, '三合局', '半合', true);
      addFortuneGroups(SAN_HUI, '三会方', '半会', false);

      // 去掉完全重复的互动文案。
      var interactionSeen = {};
      interactions = interactions.filter(function(item) {
        var key = item.type + '|' + item.text;
        if (interactionSeen[key]) return false;
        interactionSeen[key] = true;
        return true;
      });
      interactions.forEach(function(item) {
        item.domains = inferFortuneInteractionDomains(item, dgWx);
      });

      // 评估大运喜忌：先取原局行运方向，再由本步实际互动升降级。
      var goodInteractions = interactions.filter(function(item) { return item.isGood === true; }).length;
      var badInteractions = interactions.filter(function(item) { return item.isGood === false; }).length;
      var baseScore = ganFortune.score * 0.45 + zhiFortune.score * 0.55;
      var interactionScore = goodInteractions - badInteractions;
      var verifiedScore = baseScore + interactionScore * 0.65;
      var verdict = verifiedScore >= 2.25 ? '喜运'
        : verifiedScore >= 0.65 ? '偏喜'
        : verifiedScore <= -2.25 ? '忌运'
        : verifiedScore <= -0.65 ? '偏忌' : '中性';

      // 三合只是结构变化证据，且尚有成化条件；不可脱离所化五行喜忌直接改判运势。

      // 生成运程摘要
      var summaryStage = getFortuneLifeStage(dy, idx);
      var summaryAgeRange = summaryStage.startAge + '-' + summaryStage.endAge + '岁';
      var summaryYearRange = dy.startYear && dy.endYear ? '，' + dy.startYear + '-' + dy.endYear + '年' : '';
      var summary = '大运' + dy.gan + dy.zhi + '（' + summaryAgeRange + summaryYearRange + '），';
      summary += '天干' + ganWx + relName(ganWx) + '（' + ganRole + '·' + ganFortune.level + '），';
      summary += '地支' + zhiWx + '（' + zhiRole + '·' + zhiFortune.level + '）。';
      if (verdict === '喜运') summary += '干支均有利，整体更容易得到资源与推进机会。';
      else if (verdict === '偏喜') summary += '有利力量占上风，但具体关系引动中仍夹有需要处理的变化。';
      else if (verdict === '忌运') summary += '干支均为忌神，现实阻力和需要承担的成本更容易增加。';
      else if (verdict === '偏忌') summary += '不利力量偏多，但仍存在可以借力或转圜的环节。';
      else summary += '干支本身较中性，实际表现主要看与原局发生的具体关系。';
      if (interactions.length) summary += '本步大运共引动' + interactions.length + '条原局关系，其中明确有利' + goodInteractions + '条、明确不利' + badInteractions + '条，其余为条件性变化。';

      var eventLedger = buildDaYunEventLedger(bazi, dy, idx, verdict, verifiedScore, interactions);
      periods.push({
        analysisType:'structural_forecast',
        userCorrectable:true,
        realityPriority:'user_confirmed_experience',
        inferenceBoundary:'大运干支及其与原局的关系属于结构证据；领域落点和现实结果只是方向推断，不是已发生事实。',
        gan: dy.gan, zhi: dy.zhi,
        ganWx: ganWx, zhiWx: zhiWx,
        ganRole: ganRole, zhiRole: zhiRole,
        ganFortuneLevel:ganFortune.level,
        zhiFortuneLevel:zhiFortune.level,
        natalDirectionScore:Math.round(baseScore * 100) / 100,
        interactionAdjustment:Math.round(interactionScore * 65) / 100,
        verifiedScore:Math.round(verifiedScore * 100) / 100,
        verificationBasis:'原局喜用忌方向 + 本步干支与原局的实际互动；十神名称仅作事项解释',
        age: dy.displayAge || dy.startYear,
        startYear: dy.startYear, endYear: dy.endYear,
        interactions: interactions,
        eventLedger:eventLedger,
        verdict: verdict,
        summary: summary
      });
    });

    // 生成全局大运总结
    var allVer = periods.map(function(p) { return p.verdict; });
    var xiCount = allVer.filter(function(v) { return v === '喜运' || v === '偏喜'; }).length;
    var jiCount = allVer.filter(function(v) { return v === '忌运' || v === '偏忌'; }).length;
    var summaryText = '按原局方向与岁运关系计算，' + periods.length + '步大运中，结构偏有利' + xiCount + '步，结构偏不利' + jiCount + '步。';
    if (xiCount >= jiCount + 2) summaryText += '整体方向偏有利，但具体领域能否兑现仍取决于现实条件。';
    else if (jiCount >= xiCount + 2) summaryText += '整体阻力信号偏多，宜结合真实经历辨认主要落点。';
    else summaryText += '有利与阻力方向交替，具体表现以每步互动和实际经历为准。';

    return {
      version:'6.1', periods: periods, summary: summaryText,
      analysisType:'structural_forecast', userCorrectable:true,
      realityPriority:'user_confirmed_experience',
      inferenceBoundary:'大运顺序和干支关系是结构证据；喜忌方向、领域落点与现实结果属于可校正推断。',
      eventLedgerVersion:'1.1', eventLedgerMode:'correctable-domain-inference',
      eventLedgerConstraint:'先按原局喜用与本步互动定方向，再用十神和人生阶段定位事项；禁止见印断庇护、见财断发财；用户确认的真实经历优先。'
    };
  }

  /**
   * v5.2 流年→大运→原局三方互动
   * 子平法核心：岁运局三者关系决定一年的真实吉凶
   */
  var ANNUAL_DOMAIN_META = {
    study:{ label:'学业考试', favorable:'考试、录取、证照或学习进度更容易推进', adverse:'考试、审核、证照或学习进度更容易受阻', conditional:'学习与资质事项更容易被引动' },
    career:{ label:'事业工作', favorable:'岗位、项目、责任或平台更容易向前推进', adverse:'岗位、项目、制度或上下级关系更容易形成压力', conditional:'工作与职责事项更容易被引动' },
    wealth:{ label:'收入资金', favorable:'收入、回款、客户或资源兑现更容易推进', adverse:'支出、周转、分配或资金占用压力更容易增加', conditional:'资金与资源事项更容易被引动' },
    relationship:{ label:'婚恋合作', favorable:'关系确认、沟通修复或共同安排更容易推进', adverse:'关系摩擦、距离、分合或合作边界更容易调整', conditional:'感情与合作事项更容易被引动' },
    family:{ label:'家庭长辈', favorable:'家庭安排、长辈支持或居住事项更容易获得助力', adverse:'家庭责任、长辈事务或居住安排更容易增加压力', conditional:'家庭、长辈与居住事项更容易被引动' },
    health:{ label:'身心安全', favorable:'精力、恢复节奏或压力管理更容易改善', adverse:'劳累、情绪、身体承载或行动安全更需要管理', conditional:'身心与行动安全事项更容易被引动' },
    change:{ label:'环境变动', favorable:'换环境、改计划或重新启动更容易形成正向转机', adverse:'既有安排更容易被打断，被迫调整或反复', conditional:'环境、计划或生活重心更容易变化' }
  };

  function annualLifeStage(age) {
    if (age === null || age === undefined || age === '') return { key:'unknown', label:'年龄阶段待核', focus:[] };
    var n = Number(age);
    if (!isFinite(n) || n < 0) return { key:'unknown', label:'年龄阶段待核', focus:[] };
    if (n < 16) return { key:'child', label:'少年成长阶段', focus:['family','study'] };
    if (n < 24) return { key:'education', label:'升学与起步阶段', focus:['study','family','relationship'] };
    if (n < 31) return { key:'launch', label:'事业婚恋起步阶段', focus:['career','relationship','wealth'] };
    if (n < 46) return { key:'development', label:'事业家庭发展阶段', focus:['career','wealth','relationship','family'] };
    if (n < 61) return { key:'mature', label:'事业家庭承责阶段', focus:['career','wealth','family','health'] };
    return { key:'late', label:'晚年生活阶段', focus:['health','family','wealth'] };
  }

  function triggerAnnualDomains(trigger, age) {
    var domains = [], detail = String(trigger && trigger.detail || ''), type = String(trigger && trigger.type || '');
    var ageKnown = age !== null && age !== undefined && age !== '' && isFinite(Number(age));
    function add(domain, weight) {
      var found = domains.filter(function(item) { return item.domain === domain; })[0];
      if (found) found.weight += weight;
      else domains.push({ domain:domain, weight:weight });
    }
    if (trigger.target === 'day' || /日柱|日支|夫妻/.test(detail)) { add('relationship', 4); add('health', 1.5); }
    if (trigger.target === 'year' || /年柱/.test(detail)) add('family', 3);
    if (trigger.target === 'month' || /月柱|月支|提纲/.test(detail)) {
      if (!ageKnown) { add('study', 1.5); add('career', 1.5); }
      else add(Number(age) <= 23 ? 'study' : 'career', 3);
    }
    if (trigger.target === 'hour' || /时柱|时支/.test(detail)) { add('career', 2); add('family', 1); }
    if (/天克地冲|六冲|刑|六害|六破|伏吟|驿马/.test(type)) add('change', 2);
    if ((trigger.target === 'day' || trigger.target === 'hour') && /天克地冲|六冲|刑|自刑|六害|伏吟|驿马/.test(type)) add('health', 2);
    if (/伤官见官|官逢伤官/.test(type)) add('career', 6);
    if (/流年合日支/.test(type)) add('relationship', 3);
    if (/驿马逢日支受扰/.test(type)) { add('health', 5); add('change', 3); }
    return domains;
  }

  function buildAnnualEventAdjudication(bazi, daYun, liuNian, analysis, options) {
    options = options || {};
    var year = Number(liuNian && liuNian.year);
    var birthYear = Number(options.birthYear);
    var hasExplicitAge = options.age !== null && options.age !== undefined && options.age !== '' && isFinite(Number(options.age));
    var hasBirthYear = isFinite(birthYear) && birthYear > 0;
    var age = hasExplicitAge ? Number(options.age)
      : (isFinite(year) && hasBirthYear ? year - birthYear : null);
    var stage = annualLifeStage(age);
    var scores = { study:0, career:0, wealth:0, relationship:0, family:0, health:0, change:1 };
    var evidence = { study:[], career:[], wealth:[], relationship:[], family:[], health:[], change:[] };
    var directional = { study:0, career:0, wealth:0, relationship:0, family:0, health:0, change:0 };
    var annualShiShen = '';
    try { annualShiShen = BaZiCalculator.getShiShen(bazi.day.gan, liuNian.gan) || ''; } catch (e) {}

    (analysis.triggers || []).forEach(function(trigger) {
      triggerAnnualDomains(trigger, age).forEach(function(hit) {
        scores[hit.domain] += hit.weight;
        if (trigger.isGood === true) directional[hit.domain] += hit.weight;
        else if (trigger.isGood === false) directional[hit.domain] -= hit.weight;
        if (evidence[hit.domain].length < 4 && trigger.detail && evidence[hit.domain].indexOf(trigger.detail) < 0) evidence[hit.domain].push(trigger.detail);
      });
    });

    if (/财/.test(annualShiShen)) scores.wealth += 4;
    if (/官|杀/.test(annualShiShen)) scores.career += 4;
    if (/印/.test(annualShiShen)) {
      if (age === null) { scores.study += 2; scores.family += 2; }
      else scores[age <= 24 ? 'study' : 'family'] += 4;
    }
    if (/食神|伤官/.test(annualShiShen)) {
      if (age === null) { scores.study += 1; scores.career += 1; }
      else scores[age <= 23 ? 'study' : 'career'] += 2;
    }
    if (/比肩|劫财/.test(annualShiShen)) { scores.wealth += 2; scores.relationship += 1; }

    // 大运先定十年趋势：只把同一领域的大运账本带入，不能借用别的领域方向。
    var daYunLedger = options.daYunEventLedger || (options.daYunPeriod && options.daYunPeriod.eventLedger) || null;
    if (daYunLedger && daYunLedger.domainRecords) {
      daYunLedger.domainRecords.forEach(function(record) {
        if (!Object.prototype.hasOwnProperty.call(scores, record.domain)) return;
        scores[record.domain] += Math.min(Number(record.activationScore || 0) * 0.35, 2.5);
        if (record.direction === '偏有利') directional[record.domain] += 2;
        else if (record.direction === '偏不利') directional[record.domain] -= 2;
        if (record.conclusion && evidence[record.domain].length < 4) {
          evidence[record.domain].push('本步大运在“' + record.label + '”领域为' + record.direction + '：' + record.conclusion);
        }
      });
    }

    // 年龄只限定“此时最可能应在哪类现实事项”，不参与吉凶计算。
    if (age !== null && age < 18) { scores.study += Math.max(scores.career, 0); scores.career = -1; }
    if (age !== null && age < 16) { scores.family += Math.max(scores.wealth, 0); scores.wealth = -1; }
    if (age !== null && age < 14) { scores.family += Math.max(scores.relationship, 0); scores.relationship = -1; }
    stage.focus.forEach(function(domain) { if (scores[domain] >= 0) scores[domain] += 1.5; });

    var globalDirection = Number(analysis.verifiedScore || 0);
    var ranked = Object.keys(scores).filter(function(domain) { return scores[domain] >= 0; }).map(function(domain) {
      var d = directional[domain];
      var direction = d > 0.5 ? '偏有利' : (d < -0.5 ? '偏不利' : (globalDirection >= 0.65 ? '偏有利' : (globalDirection <= -0.65 ? '偏不利' : '条件性')));
      var meta = ANNUAL_DOMAIN_META[domain];
      var activation = Number(scores[domain].toFixed(2));
      var confidence = activation >= 9 && evidence[domain].length >= 2 ? '高' : (activation >= 5 ? '中高' : '中');
      return {
        domain:domain, label:meta.label, activationScore:activation, direction:direction, confidence:confidence,
        eventCandidate:direction === '偏有利' ? meta.favorable : (direction === '偏不利' ? meta.adverse : meta.conditional),
        evidence:evidence[domain].slice(0, 3),
        lifeStageMatched:stage.focus.indexOf(domain) >= 0,
        decisionBasis:'流年触发位置 + 岁运局关系方向 + 当年十神事项 + 实际年龄阶段'
      };
    }).sort(function(a,b) { return b.activationScore - a.activationScore || b.evidence.length - a.evidence.length || a.domain.localeCompare(b.domain); });

    return {
      version:'1.0', analysisType:'timing_hypothesis', frozen:false, userCorrectable:true,
      year:isFinite(year) ? year : null, age:age, lifeStage:stage, annualShiShen:annualShiShen,
      primaryEvent:ranked[0] || null, secondaryEvent:ranked[1] || null, domainRecords:ranked,
      triggerStrength:Number((Number(analysis.dangerScore || 0) + Number(analysis.opportunityScore || 0) + Math.min((analysis.triggers || []).length, 5)).toFixed(2)),
      selectionRule:'先由大运定十年趋势，再由流年与岁运局触发定应期；年龄阶段只筛现实场景，十神名称不单独决定事件。',
      constraint:'主次事件均为最可能兑现的候选，不是既成事实；用户提供真实经历后必须以经历校正，禁止为维护推断而嘴硬。'
    };
  }

  function rankTimingCandidates(entries, requestedDomain) {
    var rows = (entries || []).map(function(entry) {
      var adjudication = entry.eventAdjudication || entry.adjudication || null;
      if (!adjudication) return null;
      var record = requestedDomain
        ? (adjudication.domainRecords || []).filter(function(item) { return item.domain === requestedDomain; })[0]
        : adjudication.primaryEvent;
      if (!record) return null;
      if (requestedDomain && Number(record.activationScore || 0) < 2) return null;
      return {
        year:adjudication.year, age:adjudication.age,
        daYunGan:entry.daYunGan || entry.daYun && entry.daYun.gan || '', daYunZhi:entry.daYunZhi || entry.daYun && entry.daYun.zhi || '',
        liuNianGan:entry.liuNianGan || entry.liuNian && entry.liuNian.gan || '', liuNianZhi:entry.liuNianZhi || entry.liuNian && entry.liuNian.zhi || '',
        domain:record.domain, label:record.label, direction:record.direction, confidence:record.confidence,
        eventCandidate:record.eventCandidate, evidence:record.evidence,
        score:Number(record.activationScore || 0) + Number(adjudication.triggerStrength || 0) * 0.45,
        constraint:adjudication.constraint
      };
    }).filter(Boolean).sort(function(a,b) { return b.score - a.score || Number(a.year || 0) - Number(b.year || 0); });
    return rows.slice(0, 3).map(function(row) { row.score = Number(row.score.toFixed(2)); return row; });
  }

  function analyzeLiuNianImpact(bazi, daYun, liuNian, yongJi, options) {
    if (!daYun || !liuNian) return { triggers: [], verdict: "neutral", summary: "大运或流年数据缺失" };

    var dg = bazi.day.gan;
    var dgWx = window.WU_XING[dg];
    var dz = bazi.day.zhi;
    var triggers = [];
    var dangerScore = 0;
    var opportunityScore = 0;

    var dyGan = daYun.gan, dyZhi = daYun.zhi;
    var lnGan = liuNian.gan, lnZhi = liuNian.zhi;
    var dyGanWx = window.WU_XING[dyGan] || '';
    var lnGanWx = window.WU_XING[lnGan] || '';
    var lnZhiWx = window.DI_ZHI_WU_XING[lnZhi] || '';

    var CHONG = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' };
    var KEX_MAP = { '木':'金','火':'水','土':'木','金':'火','水':'土' };
    function stemControlsEither(wxA, wxB) {
      return wxA === KEX_MAP[wxB] || wxB === KEX_MAP[wxA];
    }
    function isFavorableRole(role) { return role === '用神' || role === '喜神'; }
    function interactionDirection(movingWx, targetWx, relationType) {
      var movingRole = roleForWx(yongJi, movingWx), targetRole = roleForWx(yongJi, targetWx);
      if (relationType === '六合' || relationType === '三合局' || relationType === '三会方' || relationType === '半合' || relationType === '半会') {
        return { isGood:null, movingRole:movingRole, targetRole:targetRole, note:'合会只表示牵引，须按所成五行另判' };
      }
      if (relationType === '六冲' && targetRole === '忌神' && isFavorableRole(movingRole)) {
        return { isGood:true, movingRole:movingRole, targetRole:targetRole, note:'有利力量冲动原局忌神，可能先变后改善' };
      }
      if (relationType === '六冲' && isFavorableRole(targetRole)) {
        return { isGood:false, movingRole:movingRole, targetRole:targetRole, note:'原局有利位置被冲，稳定性下降' };
      }
      return { isGood:false, movingRole:movingRole, targetRole:targetRole, note:'关系产生摩擦或结构变化' };
    }
    function compoundClashDirection(targetBranchWx, targetStemWx) {
      var branch = interactionDirection(lnZhiWx, targetBranchWx, '六冲');
      var movingStemRole = roleForWx(yongJi, lnGanWx);
      var targetStemRole = roleForWx(yongJi, targetStemWx);
      if (branch.isGood === true && movingStemRole !== '忌神') {
        return { isGood:true, note:'有利流年支冲动原局忌神，且流年干未形成新的忌神压力，属于先变后改善的候选引动' };
      }
      if (branch.isGood === false || (movingStemRole === '忌神' && isFavorableRole(targetStemRole))) {
        return { isGood:false, note:'原局有利位置受冲克，稳定性下降' };
      }
      return { isGood:null, note:'冲克事实明确，但利弊证据互有牵制，不能只凭“天克地冲”三个字定凶' };
    }

    // === 1. 岁运并临 ===
    if (dyGan === lnGan && dyZhi === lnZhi) {
      var isXi = (yongJi && yongJi.yongShen && yongJi.yongShen.indexOf(dyGanWx) >= 0) ||
                 (yongJi && yongJi.xiShen && yongJi.xiShen.indexOf(dyGanWx) >= 0);
      triggers.push({
        type: '岁运并临', severity: 'high',
        detail: dyGan + dyZhi + '岁运并临——大运与流年干支完全相同，相关五行作用容易集中显现。' + (isXi ? '该五行属喜用，可关注有利议题的放大' : '该五行不属喜用，宜留意压力议题的放大'),
        isGood: isXi
      });
      if (isXi) opportunityScore += 4; else dangerScore += 4;
    }

    // === 2. 天克地冲 ===
    // 2a. 流年与日柱天克地冲
    if (stemControlsEither(lnGanWx, dgWx) && CHONG[lnZhi] === dz) {
      var dayCompound = compoundClashDirection(window.DI_ZHI_WU_XING[dz], dgWx);
      triggers.push({
        type: '天克地冲', severity: 'critical',
        detail: '流年' + lnGan + lnZhi + '与日柱' + dg + dz + '天克地冲，个人关系、事业节奏或身心状态更容易出现明显波动；' + dayCompound.note + '。',
        isGood: dayCompound.isGood
      });
      if (dayCompound.isGood === true) opportunityScore += 2;
      else if (dayCompound.isGood === false) dangerScore += 5;
    }
    // 2b. 流年与月柱天克地冲
    if (CHONG[lnZhi] === bazi.month.zhi) {
      var mGanWx = window.WU_XING[bazi.month.gan];
      var monthCompound = compoundClashDirection(window.DI_ZHI_WU_XING[bazi.month.zhi], mGanWx);
      if (stemControlsEither(lnGanWx, mGanWx)) {
        triggers.push({ type: '天克地冲', severity: 'high', detail: '流年与月柱（提纲）天克地冲，工作、家庭或生活基础会出现明显调整；' + monthCompound.note + '。', isGood: monthCompound.isGood });
        if (monthCompound.isGood === true) opportunityScore += 2;
        else if (monthCompound.isGood === false) dangerScore += 3;
      } else {
        var monthBranchDirection = interactionDirection(lnZhiWx, window.DI_ZHI_WU_XING[bazi.month.zhi], '六冲');
        triggers.push({ type: '地冲月提', severity: 'medium', detail: '流年' + lnZhi + '冲月支' + bazi.month.zhi + '，工作环境或家庭安排更容易变化；' + monthBranchDirection.note + '。', isGood: monthBranchDirection.isGood });
        if (monthBranchDirection.isGood === true) opportunityScore += 1;
        else if (monthBranchDirection.isGood === false) dangerScore += 2;
      }
    }
    // 2c. 流年与大运天克地冲
    if (stemControlsEither(lnGanWx, dyGanWx) && CHONG[lnZhi] === dyZhi) {
      triggers.push({ type: '岁运天克地冲', severity: 'high', detail: '流年与大运天克地冲——运势转折之年，旧运已断新运未稳', isGood: false });
      dangerScore += 3;
    }

    // === 3. 伤官见官 ===
    if (typeof BaZiCalculator !== 'undefined' && BaZiCalculator.getShiShen) {
      var lnSS = BaZiCalculator.getShiShen(dg, lnGan);
      var allZhiPos = ['year','month','hour'];
      if (lnSS === '伤官') {
        var hasZhengGuan = allZhiPos.some(function(p) {
          return BaZiCalculator.getShiShen(dg, bazi[p].gan) === '正官';
        }) || BaZiCalculator.getShiShen(dg, dyGan) === '正官';
        if (hasZhengGuan) {
          triggers.push({ type: '伤官见官', severity: 'high', detail: '流年伤官' + lnGan + '见原局/大运正官——今年谨防口舌官非、工作变动、与上级冲突', isGood: false });
          dangerScore += 3;
        }
      }
      if (lnSS === '正官') {
        var hasShangGuan = allZhiPos.some(function(p) {
          return BaZiCalculator.getShiShen(dg, bazi[p].gan) === '伤官';
        });
        if (hasShangGuan) {
          triggers.push({ type: '官逢伤官', severity: 'medium', detail: '流年正官被原局伤官克制——虽有机会但易节外生枝', isGood: false });
          dangerScore += 2;
        }
      }
    }

    // === 4. 流年合日主 ===
    var GAN_HE = { '甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛','辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊' };
    if (GAN_HE[dg] === lnGan) {
      triggers.push({ type: '流年合日主', severity: 'medium', detail: '流年' + lnGan + '与日主' + dg + '相合，表示相关人事议题容易被牵动；合而能否化、最终利弊均须结合月令与喜忌，不直接定吉凶。', isGood: null });
    }

    // === 5. 流年合日支 ===
    var ZHI_HE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' };
    if (ZHI_HE[lnZhi] === dz) {
      triggers.push({ type: '流年合日支', severity: 'medium', detail: '流年' + lnZhi + '合日支' + dz + '，表示关系、家庭或日常环境议题容易被牵动；合的结果须结合全局喜忌，不直接定吉凶。', isGood: null });
    }

    // === 6. 三刑补齐 ===
    var beforeAnnualZhi = [bazi.year.zhi, bazi.month.zhi, bazi.day.zhi, bazi.hour.zhi, dyZhi];
    var allZhiFull = beforeAnnualZhi.concat(lnZhi);
    function annualCompletes(branches) {
      return branches.indexOf(lnZhi) >= 0
        && branches.every(function(z) { return allZhiFull.indexOf(z) >= 0; })
        && !branches.every(function(z) { return beforeAnnualZhi.indexOf(z) >= 0; });
    }
    if (annualCompletes(['丑','未','戌'])) {
      triggers.push({ type: '三刑俱全', severity: 'high', detail: '流年' + lnZhi + '补齐丑未戌恃势之刑，相关合作、规则与压力议题容易被触发，需结合喜忌判断。', isGood: false });
      dangerScore += 2;
    }
    if (annualCompletes(['寅','巳','申'])) {
      triggers.push({ type: '三刑俱全', severity: 'high', detail: '流年' + lnZhi + '补齐寅巳申无恩之刑，关系摩擦与行动风险容易放大，宜谨慎应对。', isGood: false });
      dangerScore += 2;
    }

    // === 6b. 流年地支对原局四柱的完整关系事实 ===
    // 不把合直接当吉、冲直接当凶；方向由移动支、目标支的喜用忌共同确定。
    var originalPositions = ['year','month','day','hour'];
    var originalPosNames = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };
    originalPositions.forEach(function(pos) {
      var targetZhi = bazi[pos].zhi;
      var targetWx = window.DI_ZHI_WU_XING[targetZhi];
      var pair = lnZhi + targetZhi;
      var relationTypes = [];
      if (CHONG[lnZhi] === targetZhi) relationTypes.push('六冲');
      if (HAI[lnZhi] === targetZhi) relationTypes.push('六害');
      if (XING_PAIRS[pair]) relationTypes.push('刑');
      if (lnZhi === targetZhi && SELF_XING[lnZhi]) relationTypes.push('自刑');
      if (ZHI_HE[pair]) relationTypes.push('六合');
      if (ZHI_PO[pair]) relationTypes.push('六破');
      var hasSoftCompound = relationTypes.indexOf('六害') >= 0 && relationTypes.indexOf('刑') >= 0;
      var softCompoundScored = false;
      relationTypes.forEach(function(type) {
        var direction = interactionDirection(lnZhiWx, targetWx, type);
        // 日/月冲已在高优先级条目说明，保留完整事实但避免重复累计危险分。
        var duplicateHighPriority = type === '六冲' && (pos === 'day' || pos === 'month');
        var duplicateSoftCompound = hasSoftCompound && (type === '六害' || type === '刑') && softCompoundScored;
        triggers.push({
          type:type, severity:type === '六冲' ? 'high' : (type === '六合' ? 'medium' : 'medium'),
          detail:'流年' + lnZhi + type + originalPosNames[pos] + targetZhi + '；流年支为' + direction.movingRole
            + '，目标支为' + direction.targetRole + '。' + direction.note
            + (duplicateSoftCompound ? '；该刑害与同一对地支的另一关系合并结算，不重复扣分' : '') + '。',
          isGood:direction.isGood, source:'流年', target:pos,
          movingRole:direction.movingRole, targetRole:direction.targetRole
        });
        if (!duplicateHighPriority && !duplicateSoftCompound) {
          if (direction.isGood === true) opportunityScore += 1;
          else if (direction.isGood === false && type !== '六合') {
            // 同一对地支同时成立刑、害时保留两个事实，但只结算一次；
            // 日支是本人/关系与行动落点，复合扰动按 2 分结算，其他柱按 1 分。
            dangerScore += hasSoftCompound && (type === '六害' || type === '刑')
              ? (pos === 'day' ? 2 : 1)
              : (type === '六冲' ? 2 : 1);
          }
          if (hasSoftCompound && (type === '六害' || type === '刑')) softCompoundScored = true;
        }
      });
    });

    // === 6c. 流年地支与大运地支的完整关系事实 ===
    // 原局和大运是两个不同层次，流年同时击中同一地支时应记录“跨层放大”；
    // 但同一关系不在两个层次各扣满分，只追加一级，避免重复扣分。
    var dyBranchWx = window.DI_ZHI_WU_XING[dyZhi];
    var annualDaYunPair = lnZhi + dyZhi;
    var annualDaYunRelations = [];
    if (CHONG[lnZhi] === dyZhi) annualDaYunRelations.push('六冲');
    if (HAI[lnZhi] === dyZhi) annualDaYunRelations.push('六害');
    if (XING_PAIRS[annualDaYunPair]) annualDaYunRelations.push('刑');
    if (lnZhi === dyZhi && SELF_XING[lnZhi]) annualDaYunRelations.push('自刑');
    if (ZHI_HE[annualDaYunPair]) annualDaYunRelations.push('六合');
    if (ZHI_PO[annualDaYunPair]) annualDaYunRelations.push('六破');
    var daYunSoftCompound = annualDaYunRelations.indexOf('六害') >= 0 && annualDaYunRelations.indexOf('刑') >= 0;
    var daYunSoftScored = false;
    annualDaYunRelations.forEach(function(type) {
      var direction = interactionDirection(lnZhiWx, dyBranchWx, type);
      var sameBranchInNatal = originalPositions.some(function(pos) { return bazi[pos].zhi === dyZhi; });
      var duplicateCompoundClash = type === '六冲' && stemControlsEither(lnGanWx, dyGanWx);
      var duplicateSoft = daYunSoftCompound && (type === '六害' || type === '刑') && daYunSoftScored;
      triggers.push({
        type:type, severity:type === '六冲' ? 'high' : 'medium',
        detail:'流年' + lnZhi + type + '大运' + dyZhi + '；流年支为' + direction.movingRole
          + '，大运支为' + direction.targetRole + '。' + direction.note
          + (sameBranchInNatal ? '；该支同时见于原局，属于岁、运、局跨层放大，仅追加一级影响，不重复完整结算' : '')
          + (duplicateCompoundClash ? '；天克地冲已在高优先级条目结算，此处只保留地支事实' : '')
          + (duplicateSoft ? '；该刑害与同一对地支的另一关系合并结算，不重复扣分' : '') + '。',
        isGood:direction.isGood, source:'岁运', target:'dayun',
        movingRole:direction.movingRole, targetRole:direction.targetRole
      });
      if (!duplicateCompoundClash && !duplicateSoft && type !== '六合') {
        if (direction.isGood === true) opportunityScore += sameBranchInNatal ? 0.5 : 1;
        else if (direction.isGood === false) dangerScore += sameBranchInNatal ? 1 : (type === '六冲' ? 2 : 1);
        if (daYunSoftCompound && (type === '六害' || type === '刑')) daYunSoftScored = true;
      }
    });

    function addAnnualGroup(groups, fullType, halfType, requireMiddle) {
      var before = [bazi.year.zhi,bazi.month.zhi,bazi.day.zhi,bazi.hour.zhi,dyZhi];
      groups.forEach(function(group) {
        if (group.slice(0,3).indexOf(lnZhi) < 0) return;
        var members = group.slice(0,3), foundBefore = members.filter(function(z){ return before.indexOf(z) >= 0; });
        // 流年只有带来“原先缺失的新成员”才能补成合会。若该支原局/大运已经存在，
        // 再逢同支只是重复加深，不能把已有的两支误报为三合/三会齐全。
        var annualAddsMissingMember = before.indexOf(lnZhi) < 0;
        if (!annualAddsMissingMember) return;
        var foundAfter = members.filter(function(z){ return before.indexOf(z) >= 0 || z === lnZhi; });
        var formed = foundBefore.length === 2 && foundAfter.length === 3;
        var half = !formed && foundBefore.length === 1 && foundAfter.length === 2;
        if (half && requireMiddle) half = members.indexOf(lnZhi) === 1 || foundBefore.indexOf(members[1]) >= 0;
        if (half && !requireMiddle) half = Math.abs(members.indexOf(lnZhi) - members.indexOf(foundBefore[0])) === 1;
        if (!formed && !half) return;
        var type = formed ? fullType : halfType, formedWx = group[3], formedRole = roleForWx(yongJi, formedWx);
        var isGood = formed ? (isFavorableRole(formedRole) ? true : (formedRole === '忌神' ? false : null)) : null;
        var shownMembers = formed ? members : members.filter(function(z) { return z === lnZhi || foundBefore.indexOf(z) >= 0; });
        triggers.push({
          type:type, severity:formed ? 'high' : 'medium', formedWx:formedWx, formedRole:formedRole, isGood:isGood,
          detail:'流年' + lnZhi + (formed ? '补成' : '形成') + shownMembers.join('') + type + formedWx + '势，所成五行为' + formedRole
            + '；' + (formed ? '仍须检查月令、透干与受制后再确认成化程度。' : '仅为局部牵引，不按完整成局论。')
        });
        if (formed && isGood === true) opportunityScore += 2;
        if (formed && isGood === false) dangerScore += 2;
        // 半合/半会仍不是完整成局；但若明确牵向原局忌神，可作为低一级风险计一次。
        if (half && formedRole === '忌神') dangerScore += 1;
      });
    }
    addAnnualGroup(SAN_HE, '三合局', '半合', true);
    addAnnualGroup(SAN_HUI, '三会方', '半会', false);

    // === 7. 伏吟 / 地支重复 ===
    // 四柱逐柱核对：整柱相同才叫伏吟；只同一支仅记录重复，不冒充整柱伏吟。
    originalPositions.forEach(function(pos) {
      var pillar = bazi[pos];
      if (lnGan === pillar.gan && lnZhi === pillar.zhi) {
        triggers.push({
          type:'伏吟', severity:'medium', target:pos, isGood:null,
          detail:'流年' + lnGan + lnZhi + '与' + originalPosNames[pos] + pillar.gan + pillar.zhi + '完全相同，属于' + originalPosNames[pos] + '伏吟，既有议题容易重复或加深；伏吟本身表示放大，不单独断吉凶。'
        });
      } else if (lnZhi === pillar.zhi) {
        triggers.push({
          type:'地支重复', severity:'low', target:pos, isGood:null,
          detail:'流年地支与' + originalPosNames[pos] + '同为' + lnZhi + '，属于地支重复，并非整柱伏吟；表示该位置的既有议题加深。'
        });
      }
    });

    // === 7b. 驿马与行动风险复合触发 ===
    // 以年支、日支分别取驿马。驿马只代表移动变化，不单独论吉凶；
    // 只有同时刑、害或冲动日支时，才提高出行/驾驶场景的风险提示。
    var YI_MA = {
      '申':'寅','子':'寅','辰':'寅',
      '寅':'申','午':'申','戌':'申',
      '巳':'亥','酉':'亥','丑':'亥',
      '亥':'巳','卯':'巳','未':'巳'
    };
    var yiMaSources = [];
    if (YI_MA[bazi.year.zhi] === lnZhi) yiMaSources.push('年支');
    if (YI_MA[bazi.day.zhi] === lnZhi) yiMaSources.push('日支');
    if (yiMaSources.length) {
      triggers.push({
        type:'驿马', severity:'medium', source:'流年', isGood:null,
        detail:'流年' + lnZhi + '触发' + yiMaSources.join('、') + '所取驿马，移动、出行、换环境或节奏加快的议题更明显；驿马本身不直接断吉凶。'
      });
      var yiMaDayPair = lnZhi + dz;
      var yiMaDisturbsDay = CHONG[lnZhi] === dz || HAI[lnZhi] === dz || !!XING_PAIRS[yiMaDayPair];
      if (yiMaDisturbsDay) {
        triggers.push({
          type:'驿马逢日支受扰', severity:'high', source:'流年', target:'day', isGood:false,
          detail:'流年驿马同时冲、刑或害到日支，移动与个人行动落点叠加受扰；出行、驾驶、运动或快速变化场景的风险会上升，宜主动降低速度并留意交通安全，但不等于必然发生事故。'
        });
        dangerScore += 3;
      }
    }

    // === 8. 综合判词 ===
    var stemDirection = fortuneDirectionForWx(yongJi, lnGanWx);
    var branchDirection = fortuneDirectionForWx(yongJi, lnZhiWx);
    var stemRole = stemDirection.role;
    var branchRole = branchDirection.role;
    var lnIsXi = isFavorableRole(stemRole) || isFavorableRole(branchRole);
    var lnIsJi = stemRole === '忌神' || branchRole === '忌神';
    var natalDirectionScore = stemDirection.score * 0.45 + branchDirection.score * 0.55;
    var interactionAdjustment = opportunityScore * 0.55 - dangerScore * 0.55;
    var verifiedScore = natalDirectionScore + interactionAdjustment;
    var hasDirectionLedger = !!(yongJi && yongJi.elementRoleLedger && yongJi.elementRoleLedger.entries && yongJi.elementRoleLedger.entries.length);

    var verdict, summary;
    if (hasDirectionLedger && verifiedScore >= 2.25) {
      verdict = '大吉';
      summary = '原局喜用方向与本年实际干支关系相互配合，有利条件较集中；仍需结合现实资源与时机稳步推进。';
    } else if (hasDirectionLedger && verifiedScore >= 0.65) {
      verdict = '偏吉';
      summary = '本年经原局方向和具体干支关系复核后，有利力量占上风，但仍有条件与变化需要处理。';
    } else if (hasDirectionLedger && verifiedScore <= -0.65) {
      verdict = '偏凶';
      summary = '本年经原局方向和具体干支关系复核后，阻力偏多；这不是由十神名称直接得出，而是干支互动对基础方向的降级。';
    } else if (hasDirectionLedger) {
      verdict = '中性';
      summary = '本年原局基础方向与具体干支互动互有抵消，宜按实际事件推进，不宜只凭十神名称断吉凶。';
    } else if (dangerScore >= 5) {
      verdict = '大凶';
      summary = '本年有' + triggers.filter(function(t){return t.isGood === false}).length + '项高强度结构触发，规则上更偏向波动。重要决定宜留有余地，并结合现实信息审慎判断。';
    } else if (dangerScore >= 2) {
      verdict = '偏凶';
      var criticalTriggers = triggers.filter(function(t){return t.type==='天克地冲'||t.type==='伤官见官'||t.type==='三刑俱全'});
      summary = '流年有挑战但非不可控。' + (criticalTriggers.length > 0 ? criticalTriggers.map(function(t){return t.detail}).join('；') : '宜谨慎行事。');
    } else if (opportunityScore >= 3) {
      verdict = '大吉';
      summary = '流年喜用力量较集中，有利条件相对增多；仍需结合实际资源与时机稳步推进。';
    } else if (opportunityScore >= 1) {
      verdict = '偏吉';
      summary = '流年结构总体平稳向吉，现实结果仍取决于资源、选择与具体事项。';
    } else if (lnIsXi) {
      verdict = '偏吉';
      summary = '流年干支中有喜用力量（天干' + stemRole + '、地支' + branchRole + '），有利条件相对增加。';
    } else if (lnIsJi) {
      verdict = '偏凶';
      summary = '流年干支中见忌神力量（天干' + stemRole + '、地支' + branchRole + '），相关事情更容易增加阻力。';
    } else {
      verdict = '中性';
      summary = '流年结构信号相对平稳，暂不据此承诺具体事件结果。';
    }

    var result = {
      analysisType:'structural_forecast',
      userCorrectable:true,
      realityPriority:'user_confirmed_experience',
      inferenceBoundary:'流年干支与关系类型属于结构事实；事件领域与现实结果只是可校正推断，不是已发生事实。',
      liuNianGan: lnGan, liuNianZhi: lnZhi,
      daYunGan: dyGan, daYunZhi: dyZhi,
      triggers: triggers,
      dangerScore: dangerScore,
      opportunityScore: opportunityScore,
      stemRole: stemRole,
      branchRole: branchRole,
      stemFortuneLevel:stemDirection.level,
      branchFortuneLevel:branchDirection.level,
      natalDirectionScore:Math.round(natalDirectionScore * 100) / 100,
      interactionAdjustment:Math.round(interactionAdjustment * 100) / 100,
      verifiedScore:Math.round(verifiedScore * 100) / 100,
      verificationBasis:'原局喜用忌方向 + 流年、大运、原局三方的实际干支互动；十神名称仅作事项解释',
      verdict: verdict,
      summary: summary
    };
    result.eventAdjudication = buildAnnualEventAdjudication(bazi, daYun, liuNian, result, options || {});
    return result;
  }


  // ============================================================
  // 公开 API
  // ============================================================
  root.BaZiChain = {
    analyze: analyzeChains,
    interpret: interpretChains,
    analyzeFortune: analyzeFortuneImpact,
    analyzeLiuNian: analyzeLiuNianImpact,
    buildAnnualEventAdjudication: buildAnnualEventAdjudication,
    rankTimingCandidates: rankTimingCandidates,
    CHANG_SHENG: CHANG_SHENG,
    LIN_GUAN: LIN_GUAN,
    CHONG: CHONG,
    HAI: HAI
  };

})(typeof window !== 'undefined' ? window : globalThis);
