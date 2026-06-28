// hepan-core.js — IIFE wrapped
(function(){
/**
 * ============================================================
 * 八字合盘分析引擎 (Bazi HePan Analysis Engine)
 * 方法论: 子平法 + 盲派
 * Self-contained, 无外部依赖, 输入为预计算的八字数据
 * 所有分析文字输出为 大白话 (口语化中文)
 * ============================================================
 */

// =====================================================
// SECTION 1: 常量与基础数据映射
// =====================================================

var HP_TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var HP_DZ   = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var HP_WXO = ['木','火','土','金','水'];

var HP_GYY = {
  '甲':'阳','乙':'阴','丙':'阳','丁':'阴','戊':'阳',
  '己':'阴','庚':'阳','辛':'阴','壬':'阳','癸':'阴'
};

var HP_GWX = {
  '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土',
  '己':'土','庚':'金','辛':'金','壬':'水','癸':'水'
};

var HP_ZWX = {
  '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火',
  '午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'
};

var HP_ZP = {
  '子':0,'丑':1,'寅':2,'卯':3,'辰':4,'巳':5,
  '午':6,'未':7,'申':8,'酉':9,'戌':10,'亥':11
};

// 五行相生: 木→火→土→金→水→木
var HP_WXS = { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' };

// 五行相克: 木克土, 土克水, 水克火, 火克金, 金克木
var HP_WXK = { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' };

// 反生: 生我者
var HP_WXBS = { '木':'水', '火':'木', '土':'火', '金':'土', '水':'金' };

// 反克: 克我者
var HP_WXBK = { '木':'金', '火':'水', '土':'木', '金':'火', '水':'土' };

// 天干五合: 甲己合土, 乙庚合金, 丙辛合水, 丁壬合木, 戊癸合火
var HP_GWH = {
  '甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛',
  '辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊'
};

// 天干五合对应的五行
var HP_GWHWX = {
  '甲己':'土','己甲':'土','乙庚':'金','庚乙':'金',
  '丙辛':'水','辛丙':'水','丁壬':'木','壬丁':'木',
  '戊癸':'火','癸戊':'火'
};

// 天干相克矩阵 (甲乙克戊己, 丙丁克庚辛, 戊己克壬癸, 庚辛克甲乙, 壬癸克丙丁)
var GAN_XIANG_KE = {};
(function() {
  var keMap = [
    ['甲','乙'], ['戊','己'],    // 木克土
    ['丙','丁'], ['庚','辛'],    // 火克金
    ['戊','己'], ['壬','癸'],    // 土克水
    ['庚','辛'], ['甲','乙'],    // 金克木
    ['壬','癸'], ['丙','丁']     // 水克火
  ];
  for (var i = 0; i < keMap.length; i += 2) {
    var attackers = keMap[i], targets = keMap[i+1];
    for (var a = 0; a < attackers.length; a++) {
      GAN_XIANG_KE[attackers[a]] = targets.slice();
    }
  }
})();

// 天干相生
var GAN_XIANG_SHENG = {};
(function() {
  HP_TG.forEach(function(g) {
    GAN_XIANG_SHENG[g] = [];
  });
  // 同五行之间: 甲乙木生丙丁火...
  var shengPairs = [
    [['甲','乙'], ['丙','丁']],
    [['丙','丁'], ['戊','己']],
    [['戊','己'], ['庚','辛']],
    [['庚','辛'], ['壬','癸']],
    [['壬','癸'], ['甲','乙']]
  ];
  shengPairs.forEach(function(pair) {
    var src = pair[0], dst = pair[1];
    src.forEach(function(s) { dst.forEach(function(d) { GAN_XIANG_SHENG[s].push(d); }); });
  });
})();

// 地支六合: 子丑合土, 寅亥合木, 卯戌合火, 辰酉合金, 巳申合水, 午未合土
var HP_ZLH = {
  '子':'丑','丑':'子','寅':'亥','亥':'寅',
  '卯':'戌','戌':'卯','辰':'酉','酉':'辰',
  '巳':'申','申':'巳','午':'未','未':'午'
};

// 地支三合局
var ZHI_SAN_HE_GROUPS = [
  { members: ['申','子','辰'], wx: '水' },
  { members: ['亥','卯','未'], wx: '木' },
  { members: ['寅','午','戌'], wx: '火' },
  { members: ['巳','酉','丑'], wx: '金' }
];

// 地支六冲: 子午冲, 丑未冲, 寅申冲, 卯酉冲, 辰戌冲, 巳亥冲
var HP_ZLC = {
  '子':'午','午':'子','丑':'未','未':'丑',
  '寅':'申','申':'寅','卯':'酉','酉':'卯',
  '辰':'戌','戌':'辰','巳':'亥','亥':'巳'
};

// 地支六害(穿): 子未害, 丑午害, 寅巳害, 卯辰害, 申亥害, 酉戌害
var ZHI_LIU_HAI = {
  '子':'未','未':'子','丑':'午','午':'丑',
  '寅':'巳','巳':'寅','卯':'辰','辰':'卯',
  '申':'亥','亥':'申','酉':'戌','戌':'酉'
};

// 地支相刑
var HP_ZXX = {};
(function() {
  HP_ZXX['子'] = ['卯']; HP_ZXX['卯'] = ['子'];           // 无礼之刑
  ['寅','巳','申'].forEach(function(z) { HP_ZXX[z] = ['寅','巳','申'].filter(function(x) { return x !== z; }); }); // 无恩之刑
  ['丑','戌','未'].forEach(function(z) { HP_ZXX[z] = ['丑','戌','未'].filter(function(x) { return x !== z; }); }); // 恃势之刑
  ['辰','午','酉','亥'].forEach(function(z) { HP_ZXX[z] = [z]; }); // 自刑
})();

// 羊刃日柱 (盲派: 婚不顺的标志)
var YANG_REN_RIZHU = ['丙午','壬子','丁巳','癸亥'];

// 地支藏干
var HP_CG = {
  '子': ['癸'],
  '丑': ['己','癸','辛'],
  '寅': ['甲','丙','戊'],
  '卯': ['乙'],
  '辰': ['戊','乙','癸'],
  '巳': ['丙','戊','庚'],
  '午': ['丁','己'],
  '未': ['己','丁','乙'],
  '申': ['庚','壬','戊'],
  '酉': ['辛'],
  '戌': ['戊','辛','丁'],
  '亥': ['壬','甲']
};

// 桃花星 (以年支或日支查): 申子辰见酉, 亥卯未见子, 寅午戌见卯, 巳酉丑见午
var TAOHUA_MAP = {};
(function() {
  var map = {
    '申':'酉','子':'酉','辰':'酉',
    '亥':'子','卯':'子','未':'子',
    '寅':'卯','午':'卯','戌':'卯',
    '巳':'午','酉':'午','丑':'午'
  };
  for (var k in map) { TAOHUA_MAP[k] = map[k]; }
})();

// =====================================================
// SECTION 2: 工具函数
// =====================================================

/** 判断天干是否同类(同五行) */
function isSameWuxing(g1, g2) {
  return HP_GWX[g1] === HP_GWX[g2];
}

/** 天干关系: '合' | '生' | '克' | '比' */
function ganRelationType(gan1, gan2) {
  if (HP_GWH[gan1] === gan2) return '合';
  if (GAN_XIANG_SHENG[gan1] && GAN_XIANG_SHENG[gan1].indexOf(gan2) !== -1) return '生';
  if (GAN_XIANG_SHENG[gan2] && GAN_XIANG_SHENG[gan2].indexOf(gan1) !== -1) return '被生';
  if (GAN_XIANG_KE[gan1] && GAN_XIANG_KE[gan1].indexOf(gan2) !== -1) return '克';
  if (GAN_XIANG_KE[gan2] && GAN_XIANG_KE[gan2].indexOf(gan1) !== -1) return '被克';
  if (isSameWuxing(gan1, gan2)) return '比';
  return '比'; // fallback
}

/** 地支关系: '六合' | '三合' | '六冲' | '六害' | '相刑' | '无' */
function zhiRelationType(zhi1, zhi2) {
  if (HP_ZLH[zhi1] === zhi2) return '六合';
  if (HP_ZLC[zhi1] === zhi2) return '六冲';
  if (ZHI_LIU_HAI[zhi1] === zhi2) return '六害';
  if (HP_ZXX[zhi1] && HP_ZXX[zhi1].indexOf(zhi2) !== -1) return '相刑';
  // 三合检测
  for (var i = 0; i < ZHI_SAN_HE_GROUPS.length; i++) {
    var g = ZHI_SAN_HE_GROUPS[i];
    if (g.members.indexOf(zhi1) !== -1 && g.members.indexOf(zhi2) !== -1 && zhi1 !== zhi2) {
      return '三合';
    }
  }
  // 相生/相克 by 五行
  if (HP_WXS[HP_ZWX[zhi1]] === HP_ZWX[zhi2]) return '生';
  if (HP_WXS[HP_ZWX[zhi2]] === HP_ZWX[zhi1]) return '被生';
  if (HP_WXK[HP_ZWX[zhi1]] === HP_ZWX[zhi2]) return '克';
  if (HP_WXK[HP_ZWX[zhi2]] === HP_ZWX[zhi1]) return '被克';
  if (HP_ZWX[zhi1] === HP_ZWX[zhi2]) return '比';
  return '无';
}

/** 获取两个地支的三合五行(如果属于同一三合局) */
function getSanHeWx(zhi1, zhi2) {
  for (var i = 0; i < ZHI_SAN_HE_GROUPS.length; i++) {
    var g = ZHI_SAN_HE_GROUPS[i];
    if (g.members.indexOf(zhi1) !== -1 && g.members.indexOf(zhi2) !== -1) {
      return g.wx;
    }
  }
  return null;
}

/** 简单 hash 字符串 */
function simpleHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

// =====================================================
// SECTION 3: 日柱关系分析 (dailyRelation)
// =====================================================

var GAN_HE_DESCS = {
  '甲己': '甲己合，像大树离不开厚土，树根越扎越深，土也因树而有了活力。你们天生互补，一个向上生长，一个稳重承载，是最相配的组合之一。',
  '乙庚': '乙庚合，像藤蔓缠绕金属栏杆，柔韧与刚硬看似矛盾却完美结合。你的温柔刚好能软化对方的倔强，在一起有种奇妙的平衡感。',
  '丙辛': '丙辛合，像阳光融进清晨的露水里，火热遇清凉，互相降温也互相温暖。你们的性格有反差感，但这种反差反而让彼此着迷。',
  '丁壬': '丁壬合，像一盏灯映照在江面上，灯光虽弱却能让整条江水泛出温柔的光泽。你们在一起有种说不清的默契，眼神交流就能懂对方。',
  '戊癸': '戊癸合，像大地拥抱春天的细雨，看起来一个硬朗一个柔软，合在一起却孕育万物。你们能激发彼此最好的一面，是能同甘共苦的组合。'
};

var ZHI_REL_DESCS = {
  '六合': '日支六合是地支里最好的缘分配合，你们的夫妻宫（内心深处）天然契合，日常相处轻松自在，不容易起大矛盾，有一种「回到家就安心」的感觉。',
  '三合': '日支三合是一种凝聚力很强的格局，像三条河水汇成一条江，你们在一起做事特别有默契，目标一致，配合得当，关系有方向感。',
  '六冲': '日支六冲是比较考验感情的配置，就像水火相遇，一开始激情满满，但久了容易为小事起争执。需要学会互相让步，不然矛盾会越积越多。',
  '六害': '日支相穿（六害）要注意了，这不是明显的冲突，而是日积月累的磨损，像鞋子里的沙子，走久了才知道疼。日常要多沟通，别让不满悄悄堆积。',
  '相刑': '日支相刑容易产生互不理解的情况，两个人各自坚持自己的方式，谁也不服谁。长期这样会很累，需要有一方先学会低头。',
  '生': '日支相生是个好兆头，一方的内在能量在滋养另一方，日常相处中会感受到来自对方的支持和温暖，关系很滋养人。',
  '被生': '日支被生说明对方的内在在支持着你，你会感到被理解和被包容，这是很重要的情感滋养。',
  '比': '日支五行相同，你们在价值观和性格底色上很像，有天然的亲近感。好处是能互相理解，坏处是太像了偶尔也会针锋相对。',
  '克': '日支相克表示一方在关系中习惯主导，另一方容易感到压力。这不是不能相处，而是需要被克制的一方学会表达自己的需要。',
  '被克': '你的日支被对方克制，在关系中你容易迁就对方多一些。要注意保护自己的边界，别让迁就变成习惯。',
  '无': '日支之间没有明显的互动关系，日常相处比较平淡稳定，不容易擦出太大的火花但也少有大矛盾，属于细水长流的类型。'
};

function analyzeDailyRelation(p1, p2) {
  var dg1 = p1.dayGan, dg2 = p2.dayGan;
  var dz1 = p1.dayZhi, dz2 = p2.dayZhi;

  var gr = ganRelationType(dg1, dg2);
  var zr = zhiRelationType(dz1, dz2);

  // 天干描述
  var ganDesc = '';
  var ganScore = 0;
  switch (gr) {
    case '合':
      var key1 = dg1 + dg2, key2 = dg2 + dg1;
      ganDesc = GAN_HE_DESCS[key1] || GAN_HE_DESCS[key2] || (dg1 + '和' + dg2 + '天干五合，是非常难得的缘分，天生的吸引力让你们走到一起。');
      ganScore = 40;
      break;
    case '生':
      ganDesc = '你的日干' + HP_GWX[dg1] + '在生对方的日干' + HP_GWX[dg2] + '，你的能量在滋养对方。在关系里你更愿意付出，对方也能感受到你的好。这是一种温暖的连接。';
      ganScore = 30;
      break;
    case '被生':
      ganDesc = '对方的日干' + HP_GWX[dg2] + '在生你的日干' + HP_GWX[dg1] + '，对方的能量在支持着你。你在关系中是被照顾的一方，要记得珍惜和回馈。';
      ganScore = 30;
      break;
    case '比':
      ganDesc = '你俩的日干都是' + HP_GWX[dg1] + '行，五行相同说明你们骨子里很像。懂得彼此的想法和感受，有天然的亲近感，但太像了有时候也会暗自较劲。';
      ganScore = 25;
      break;
    case '克':
      ganDesc = '你的日干' + HP_GWX[dg1] + '在克对方的日干' + HP_GWX[dg2] + '。在关系里你习惯占据主导位置，对方可能会感到一些压力。注意不要太强势，给彼此留点空间。';
      ganScore = 18;
      break;
    case '被克':
      ganDesc = '对方的日干' + HP_GWX[dg2] + '在克你的日干' + HP_GWX[dg1] + '。你在关系中容易被动、迁就对方。心里有话要说出来，健康的感情不是单方面的退让。';
      ganScore = 18;
      break;
    default:
      ganDesc = '你们的天干之间没有太强的互动，关系基调比较平和，需要靠多沟通来增进感情。';
      ganScore = 20;
  }

  // 地支描述
  var zhiDesc = ZHI_REL_DESCS[zr] || (zr === '三合' ? ZHI_REL_DESCS['三合'] : '日支关系比较中性，需要在日常生活中慢慢磨合。');
  var zhiScore = 0;
  switch (zr) {
    case '六合': zhiScore = 35; break;
    case '三合': zhiScore = 30; break;
    case '生':
    case '被生': zhiScore = 28; break;
    case '比': zhiScore = 22; break;
    case '克':
    case '被克': zhiScore = 18; break;
    case '六冲': zhiScore = 10; break;
    case '六害': zhiScore = 8; break;
    case '相刑': zhiScore = 8; break;
    default: zhiScore = 18;
  }

  // 盲派夫妻宫特殊判断
  var mangPaiWarnings = [];
  // 日支被冲
  if (HP_ZLC[dz1] === dz2) {
    mangPaiWarnings.push('日支互相六冲，这是夫妻宫的冲撞，意味着在一起容易情绪波动大，好的时候特别好，吵的时候也特别凶。建议平时多培养共同的放松方式。');
  }
  // 日支被穿
  if (ZHI_LIU_HAI[dz1] === dz2) {
    mangPaiWarnings.push('日支互相穿害（六害），这是比较隐蔽的问题，不是直接吵架，而是慢慢积累不满。一定要养成有问题及时说开的习惯，别闷在心里。');
  }
  // 日支相刑
  if (HP_ZXX[dz1] && HP_ZXX[dz1].indexOf(dz2) !== -1) {
    mangPaiWarnings.push('日支相刑，两人思维方式和做事风格差异较大，容易互相较劲、互不理解。建议多换位思考，别总用自己的标准去要求对方。');
  }
  // 羊刃日柱
  var rz1 = dg1 + dz1, rz2 = dg2 + dz2;
  if (YANG_REN_RIZHU.indexOf(rz1) !== -1) {
    mangPaiWarnings.push('你的日柱是' + rz1 + '，为羊刃日柱，脾气上比较刚烈，在感情中容易固执己见。建议学会柔软一点，凡事不要太较真。');
  }
  if (YANG_REN_RIZHU.indexOf(rz2) !== -1) {
    mangPaiWarnings.push('对方的日柱是' + rz2 + '，为羊刃日柱，性格上有强硬的一面，感情中可能不太会妥协。需要多一些耐心和包容。');
  }

  if (mangPaiWarnings.length > 0) {
    zhiDesc += ' 【特别提醒】' + mangPaiWarnings.join(' ');
  }

  // 综合分数
  var totalScore = ganScore + zhiScore;
  totalScore = Math.min(totalScore, 75); // cap at 75
  totalScore = Math.max(totalScore, 8);

  return {
    ganRelation: gr,
    zhiRelation: zr,
    ganDesc: ganDesc,
    zhiDesc: zhiDesc,
    score: totalScore
  };
}

// =====================================================
// SECTION 4: 五行互补分析 (wuxingComplement)
// =====================================================

var WX_ELEMENT_NAMES = { '木':'木元素','火':'火元素','土':'土元素','金':'金元素','水':'水元素' };

function analyzeWuxingComplement(p1, p2) {
  var w1 = p1.wuxing, w2 = p2.wuxing;
  var totalWuxing = {};
  HP_WXO.forEach(function(wx) {
    totalWuxing[wx] = (w1[wx] || 0) + (w2[wx] || 0);
  });

  // 找出各自缺失的五行和共有的五行
  var p1Missing = [], p2Missing = [], p1Has = [], p2Has = [];
  HP_WXO.forEach(function(wx) {
    if (!w1[wx] || w1[wx] === 0) p1Missing.push(wx); else p1Has.push(wx);
    if (!w2[wx] || w2[wx] === 0) p2Missing.push(wx); else p2Has.push(wx);
  });

  // 互补分析: 对方有的刚好是我缺的
  var complementPairs = [];
  p1Missing.forEach(function(wx) {
    if (p2Has.indexOf(wx) !== -1) complementPairs.push({ wx: wx, from: p2.name, to: p1.name });
  });
  p2Missing.forEach(function(wx) {
    if (p1Has.indexOf(wx) !== -1) complementPairs.push({ wx: wx, from: p1.name, to: p2.name });
  });

  // 各自的五行分布描述
  var p1WxDesc = describeWuxingProfile(w1, p1.name);
  var p2WxDesc = describeWuxingProfile(w2, p2.name);

  var detail = '';
  var complementScore = 58; // base

  if (complementPairs.length >= 3) {
    detail = p1WxDesc + ' ' + p2WxDesc + ' 你们五行互补非常明显——';
    var cpDescs = complementPairs.map(function(cp) {
      return cp.from + '的' + WX_ELEMENT_NAMES[cp.wx] + '刚好补上' + cp.to + '的缺口';
    });
    detail += cpDescs.join('，') + '。这就像拼图刚好对上，对方身上有你需要的东西，相处久了会发现缺了对方反而不完整。互补性很强，是天生的好搭档。';
    complementScore = 95;
  } else if (complementPairs.length >= 1) {
    detail = p1WxDesc + ' ' + p2WxDesc + ' 你们有一定的互补性——';
    var cpDescs2 = complementPairs.map(function(cp) {
      return cp.from + '的' + WX_ELEMENT_NAMES[cp.wx] + '刚好补上' + cp.to + '的缺口';
    });
    detail += cpDescs2.join('，') + '。虽然在有些方面还需要磨合，但你们能给彼此提供对方没有的东西，这是关系的重要基础。';
    complementScore = 78;
  } else {
    detail = p1WxDesc + ' ' + p2WxDesc + ' 你们的五行分布比较相似，没有特别明显的互补关系。这意味着你们不会特别需要对方来补充自己，但也不会因为五行差异产生矛盾。好处是相处轻松不累，坏处是少了那种「非你不可」的吸引力。';
    complementScore = 58;
  }

  // 五行是否太偏 - 某个五行过多或过少
  var imbalanced = [];
  HP_WXO.forEach(function(wx) {
    var total = totalWuxing[wx] || 0;
    if (total >= 8) imbalanced.push(wx + '过多');
    if (total <= 1) imbalanced.push(wx + '偏少');
  });
  if (imbalanced.length > 0) {
    detail += ' 需要注意你们俩加起来' + imbalanced.join('、') + '，这可能影响整体的平衡感。';
    complementScore -= imbalanced.length * 3;
  }

  complementScore = Math.min(100, Math.max(10, complementScore));

  return {
    p1Wuxing: p1WxDesc,
    p2Wuxing: p2WxDesc,
    complementScore: complementScore,
    detail: detail
  };
}

function describeWuxingProfile(wxObj, name) {
  var parts = [];
  HP_WXO.forEach(function(wx) {
    var count = wxObj[wx] || 0;
    parts.push(wx + '(' + count + '个)');
  });
  return name + '的五行分布是：' + parts.join('、') + '。';
}

// =====================================================
// SECTION 5: 日干旺衰分析 (dayGanStrength)
// =====================================================

function analyzeDayGanStrength(p1, p2) {
  var s1 = calcDayGanStrength(p1);
  var s2 = calcDayGanStrength(p2);

  var whoStronger = '';
  var detail = '';

  if (s1.level === s2.level) {
    whoStronger = '你们俩的日主旺衰程度差不多';
    detail = p1.name + '日主' + s1.label + '，' + p2.name + '日主' + s2.label + '。两个人都属于' + s1.label + '的类型，势均力敌，关系中不会出现一方强势压过另一方的情况，沟通起来相对平等。';
  } else if (s1.score > s2.score) {
    whoStronger = p1.name + '的元气更强一些';
    detail = p1.name + '日主' + s1.label + '（得分' + s1.score + '），' + p2.name + '日主' + s2.label + '（得分' + s2.score + '）。在关系中，' + p1.name + '的自我意识和能量会强一些，' + p2.name + '相对柔和。这不一定是坏事，关键看强势的一方能不能照顾到对方的感受。';
  } else {
    whoStronger = p2.name + '的元气更强一些';
    detail = p1.name + '日主' + s1.label + '（得分' + s1.score + '），' + p2.name + '日主' + s2.label + '（得分' + s2.score + '）。在关系中，' + p2.name + '的内在力量更强，' + p1.name + '相对柔软一些。强弱互补如果能搭配好，反而是一种稳定的结构。';
  }

  return {
    p1Strength: { level: s1.level, label: s1.label, score: s1.score },
    p2Strength: { level: s2.level, label: s2.label, score: s2.score },
    whoStronger: whoStronger,
    detail: detail
  };
}

// 使用 BaZiCalculator 统一算法
function calcDayGanStrength(person) {
  // 如果有完整 bazi 对象，直接用 BaZiCalculator
  if (person._bazi && typeof BaZiCalculator !== 'undefined' && BaZiCalculator.calcDayMasterStrength) {
    var result = BaZiCalculator.calcDayMasterStrength(person._bazi);
    return { level: result.level, label: result.label, score: result.score };
  }
  // 回退到旧的合盘独立算法
  return _legacyCalcDayGanStrength(person);
}

function _legacyCalcDayGanStrength(person) {
  var dg = person.dayGan;
  var dgWx = person.dmWuxing || HP_GWX[dg];
  var monthPillar = person.pillars[1]; // 月柱
  var monthZhi = monthPillar.zhi;
  var monthWx = HP_ZWX[monthZhi];

  var score = 50; // 基准分

  // 1. 得月令: 最重要的因素
  if (monthWx === dgWx) {
    score += 30; // 月令同五行，得令
  } else if (HP_WXBS[dgWx] === monthWx) {
    score += 20; // 月令生我，相令
  } else if (HP_WXS[dgWx] === monthWx) {
    score -= 15; // 我生月令，休令
  } else if (HP_WXK[dgWx] === monthWx) {
    score -= 25; // 我克月令，囚令
  } else if (HP_WXBK[dgWx] === monthWx) {
    score -= 35; // 月令克我，死令
  }

  // 2. 得地: 日支是否支持日干
  var dayZhiWx = HP_ZWX[person.dayZhi];
  if (dayZhiWx === dgWx) score += 12;
  else if (HP_WXBS[dgWx] === dayZhiWx) score += 8;
  else if (HP_WXBK[dgWx] === dayZhiWx) score -= 10;

  // 3. 得势: 统计各柱天干比劫生扶情况
  person.pillars.forEach(function(pillar) {
    var gWx = HP_GWX[pillar.gan];
    if (gWx === dgWx) score += 6;       // 比肩
    else if (HP_WXBS[dgWx] === gWx) score += 4; // 生我(印)
    else if (HP_WXK[dgWx] === gWx) score -= 4;        // 克我(官杀)
    else if (HP_WXS[dgWx] === gWx) score -= 3;     // 我生(食伤)
    else if (HP_WXBK[dgWx] === gWx) score -= 5;    // 我克(财)
  });

  // 4. 地支藏干的支撑
  person.pillars.forEach(function(pillar) {
    var cg = pillar.cangGan || [];
    cg.forEach(function(g) {
      var gWx = HP_GWX[g];
      if (gWx === dgWx) score += 3;
      else if (HP_WXBS[dgWx] === gWx) score += 2;
    });
  });

  // 判定旺衰等级
  var level, label;
  if (score >= 85) { level = '极旺'; label = '元气充沛'; }
  else if (score >= 65) { level = '偏旺'; label = '元气较足'; }
  else if (score >= 45) { level = '中和偏旺'; label = '元气适中偏强'; }
  else if (score >= 35) { level = '中和'; label = '元气均衡'; }
  else if (score >= 25) { level = '中和偏柔'; label = '元气适中偏柔'; }
  else if (score >= 15) { level = '偏柔'; label = '元气偏柔'; }
  else { level = '清秀'; label = '元气清秀'; }

  return { level: level, label: label, score: score };
}

// =====================================================
// SECTION 6: 喜用神分析 (xiyong)
// =====================================================

function analyzeXiyong(p1, p2) {
  var x1 = calcXiyong(p1);
  var x2 = calcXiyong(p2);

  var detail = '';
  // 看喜用神是否互补
  var p1XiMatch = x2.yongShen.indexOf(x1.xiShen) !== -1 || x2.xiShen === x1.xiShen;
  var p2XiMatch = x1.yongShen.indexOf(x2.xiShen) !== -1 || x1.xiShen === x2.xiShen;

  if (p1XiMatch && p2XiMatch) {
    detail = '你们俩的喜用神互相支持，这是非常好的信号！' + p1.name + '需要' + x1.xiShen + '来平衡，而' + p2.name + '身上有这种属性；反过来' + p2.name + '需要' + x2.xiShen + '，' + p1.name + '也能提供。你们在一起自然就能帮对方平衡气场，相处起来彼此都舒服。';
  } else if (p1XiMatch || p2XiMatch) {
    detail = '你们俩的喜用神有一部分是互补的。';
    if (p1XiMatch) detail += p1.name + '的喜神' + x1.xiShen + '能从' + p2.name + '身上获得，这对' + p1.name + '很有好处。';
    if (p2XiMatch) detail += p2.name + '的喜神' + x2.xiShen + '能从' + p1.name + '身上获得，这对' + p2.name + '很有好处。';
    detail += ' 虽然不是完全互补，但也能在一定程度上帮到对方。';
  } else {
    detail = '你们俩的喜用神方向不太一致，' + p1.name + '需要' + x1.xiShen + '来平衡，而' + p2.name + '需要' + x2.xiShen + '。这说明你们各自适合的环境和方式不太一样，在日常生活中需要注意协调彼此的节奏，找到都能舒服的中间地带。';
  }

  return {
    p1: { xiShen: x1.xiShen, yongShen: x1.yongShen, jiShen: x1.jiShen },
    p2: { xiShen: x2.xiShen, yongShen: x2.yongShen, jiShen: x2.jiShen },
    complementDetail: detail
  };
}

function calcXiyong(person) {
  var str = calcDayGanStrength(person);
  var dgWx = person.dmWuxing || HP_GWX[person.dayGan];
  var score = str.score;
  var xiShen, yongShen, jiShen;

  if (score >= 65) {
    // 身旺: 喜克泄耗
    xiShen = HP_WXBK[dgWx];      // 官杀(克我者)
    yongShen = [HP_WXS[dgWx]];    // 食伤(我生者)
    if (HP_WXK[dgWx]) yongShen.push(HP_WXK[dgWx]); // 财(我克者)
    jiShen = [HP_WXBS[dgWx], dgWx]; // 忌印星和比劫
  } else if (score <= 35) {
    // 身弱: 喜生扶
    xiShen = HP_WXBS[dgWx];    // 印星(生我者)
    yongShen = [dgWx];              // 比劫(同我者)
    jiShen = [HP_WXBK[dgWx]];     // 忌官杀(克我者)
  } else {
    // 中和: 看具体倾向
    if (score > 45) {
      xiShen = HP_WXBK[dgWx];
      yongShen = [HP_WXS[dgWx]];
      jiShen = [HP_WXBS[dgWx]];
    } else {
      xiShen = HP_WXBS[dgWx];
      yongShen = [dgWx];
      jiShen = [HP_WXBK[dgWx]];
    }
  }

  return { xiShen: xiShen, yongShen: yongShen, jiShen: jiShen };
}

// =====================================================
// SECTION 7: 跨盘分析 (crossPillars)
// =====================================================

var PILLAR_NAMES = ['年柱','月柱','日柱','时柱'];

function analyzeCrossPillars(p1, p2) {
  var results = [];

  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      var p1p = p1.pillars[i], p2p = p2.pillars[j];

      // 天干关系
      var gr = ganRelationType(p1p.gan, p2p.gan);
      if (gr === '合') {
        results.push({
          type: '合',
          pillar1: p1.name + '的' + PILLAR_NAMES[i] + '(' + p1p.gan + p1p.zhi + ')',
          pillar2: p2.name + '的' + PILLAR_NAMES[j] + '(' + p2p.gan + p2p.zhi + ')',
          detail: p1.name + '的' + PILLAR_NAMES[i] + '天干' + p1p.gan + '和' + p2.name + '的' + PILLAR_NAMES[j] + '天干' + p2p.gan + '形成天干五合。天干在天上代表外显的层面，说明你们在社交、做事、对外态度上有天然的默契，很容易配合。'
        });
      }

      // 地支关系
      var zr = zhiRelationType(p1p.zhi, p2p.zhi);
      switch (zr) {
        case '六冲':
          results.push({
            type: '冲',
            pillar1: p1.name + '的' + PILLAR_NAMES[i] + '(' + p1p.gan + p1p.zhi + ')',
            pillar2: p2.name + '的' + PILLAR_NAMES[j] + '(' + p2p.gan + p2p.zhi + ')',
            detail: p1.name + '的' + PILLAR_NAMES[i] + '地支' + p1p.zhi + '和' + p2.name + '的' + PILLAR_NAMES[j] + '地支' + p2p.zhi + '六冲。地支在底下代表内在的、根源性的东西，这里相冲意味着在某些根本问题上你们看法不一样，' + (i === 2 || j === 2 ? '尤其涉及夫妻宫（日支），需要特别注意沟通。' : '需要多花时间磨合和沟通。')
          });
          break;
        case '六合':
          results.push({
            type: '合',
            pillar1: p1.name + '的' + PILLAR_NAMES[i] + '(' + p1p.gan + p1p.zhi + ')',
            pillar2: p2.name + '的' + PILLAR_NAMES[j] + '(' + p2p.gan + p2p.zhi + ')',
            detail: p1.name + '的' + PILLAR_NAMES[i] + '地支' + p1p.zhi + '和' + p2.name + '的' + PILLAR_NAMES[j] + '地支' + p2p.zhi + '六合。地支合说明底层的能量在互相吸引，你们在很多事情上不用多说就能理解对方，是很好的缘分信号。'
          });
          break;
        case '三合':
          results.push({
            type: '合',
            pillar1: p1.name + '的' + PILLAR_NAMES[i] + '(' + p1p.gan + p1p.zhi + ')',
            pillar2: p2.name + '的' + PILLAR_NAMES[j] + '(' + p2p.gan + p2p.zhi + ')',
            detail: p1.name + '的' + PILLAR_NAMES[i] + '地支' + p1p.zhi + '和' + p2.name + '的' + PILLAR_NAMES[j] + '地支' + p2p.zhi + '属于三合局的关系。三合是大合，力量很强，代表两人在某个重大方向上观念一致、能够互相成就。'
          });
          break;
        case '六害':
          results.push({
            type: '克',
            pillar1: p1.name + '的' + PILLAR_NAMES[i] + '(' + p1p.gan + p1p.zhi + ')',
            pillar2: p2.name + '的' + PILLAR_NAMES[j] + '(' + p2p.gan + p2p.zhi + ')',
            detail: p1.name + '的' + PILLAR_NAMES[i] + '和' + p2.name + '的' + PILLAR_NAMES[j] + '地支相害。害是一种暗伤，不像冲那样明显但日积月累也会有影响。在相关的领域上容易有暗中的摩擦和不爽。'
          });
          break;
        case '相刑':
          results.push({
            type: '克',
            pillar1: p1.name + '的' + PILLAR_NAMES[i] + '(' + p1p.gan + p1p.zhi + ')',
            pillar2: p2.name + '的' + PILLAR_NAMES[j] + '(' + p2p.gan + p2p.zhi + ')',
            detail: p1.name + '的' + PILLAR_NAMES[i] + '和' + p2.name + '的' + PILLAR_NAMES[j] + '地支相刑。刑代表着较劲和互不理解，双方在这方面的看法和处理方式差异很大，容易产生摩擦。'
          });
          break;
        case '生':
          results.push({
            type: '生',
            pillar1: p1.name + '的' + PILLAR_NAMES[i] + '(' + p1p.gan + p1p.zhi + ')',
            pillar2: p2.name + '的' + PILLAR_NAMES[j] + '(' + p2p.gan + p2p.zhi + ')',
            detail: p1.name + '的' + PILLAR_NAMES[i] + '在生' + p2.name + '的' + PILLAR_NAMES[j] + '，这种相生的关系说明在对应的方面，一方愿意为另一方付出。'
          });
          break;
        case '被生':
          results.push({
            type: '生',
            pillar1: p1.name + '的' + PILLAR_NAMES[i] + '(' + p1p.gan + p1p.zhi + ')',
            pillar2: p2.name + '的' + PILLAR_NAMES[j] + '(' + p2p.gan + p2p.zhi + ')',
            detail: p2.name + '的' + PILLAR_NAMES[j] + '在生' + p1.name + '的' + PILLAR_NAMES[i] + '，对方在对应方面更愿意支持和滋养你。'
          });
          break;
      }
    }
  }

  // 去重：同一对柱子如果合冲克生都有，优先保留最重要的
  var deduped = [];
  var seenPairs = {};
  results.forEach(function(r) {
    var key = r.pillar1 + '|' + r.pillar2;
    var revKey = r.pillar2 + '|' + r.pillar1;
    if (!seenPairs[key] && !seenPairs[revKey]) {
      seenPairs[key] = true;
      seenPairs[revKey] = true;
      deduped.push(r);
    }
  });

  // 按重要性排序: 合 > 生 > 冲 > 克
  var typeOrder = { '合':0, '生':1, '冲':2, '克':3 };
  deduped.sort(function(a, b) {
    return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
  });

  // 最多返回8条
  return deduped.slice(0, 8);
}

// =====================================================
// SECTION 8: 核心模式分析 (coreMode)
// =====================================================

function analyzeCoreMode(p1, p2, relationType) {
  var dr = analyzeDailyRelation(p1, p2);
  var wc = analyzeWuxingComplement(p1, p2);
  var dgs = analyzeDayGanStrength(p1, p2);

  var title = '', detail = '';

  // 组合日柱信息
  var combo = p1.dayGan + p1.dayZhi + ' + ' + p2.dayGan + p2.dayZhi;

  if (relationType === '夫妻') {
    title = '夫妻合盘核心解读';

    // 日支(夫妻宫)权重最高
    var zr = zhiRelationType(p1.dayZhi, p2.dayZhi);
    var ziPart = '';
    if (zr === '六合' || zr === '三合') {
      ziPart = '你们俩的夫妻宫（日支）形成' + (zr === '六合' ? '六合' : '三合') + '，这是夫妻关系最重要的基础打得牢固。夫妻宫合，意味着两人的内心世界对得上频道，日常生活中能自然磨合，不会为鸡毛蒜皮的事闹得不可开交。';
    } else if (zr === '六冲') {
      ziPart = '你们俩的夫妻宫（日支）六冲，这是婚姻中最需要用心经营的情况。冲不代表不能在一起，而是需要双方都有意识地去平衡和包容。很多看似恩爱的夫妻其实日支也是冲的，关键在于他们学会了「你退一步我让一步」。';
    } else if (zr === '六害' || zr === '相刑') {
      ziPart = '你们俩的夫妻宫（日支）有' + (zr === '六害' ? '穿害' : '相刑') + '关系，这提示你们在婚姻中要特别注意沟通方式。不是不能过，而是比一般夫妻更需要学习怎么表达自己的真实感受，别把不满压在心里。';
    } else {
      ziPart = '你们俩的夫妻宫（日支）没有特别强或特别冲的关系，这意味着婚姻的基础比较中性，好坏更多取决于你们后天的相处和经营。这种组合其实也有好处——不会因命理上的冲突而产生太多的先天障碍。';
    }

    // 财官分析
    var caiGuanPart = '';
    if (p1.gender === 'male' && p2.gender === 'female') {
      caiGuanPart = '从传统的财官角度看，男命以财为妻，女命以官为夫。虽然现代社会不讲究这些，但八字里的财官关系仍然能反映出两个人在家庭角色上的默契度。';
    } else if (p1.gender === 'female' && p2.gender === 'male') {
      caiGuanPart = '从传统的财官角度看，女命以官为夫，男命以财为妻。财官如果协调，说明两个人在家庭分工和生活规划上容易达成一致。';
    } else {
      caiGuanPart = '';
    }

    // 稳定性分析
    var stabilityPart = '';
    var mangPaiIssues = checkMangPaiMarriage(p1, p2);
    if (mangPaiIssues.length > 0) {
      stabilityPart = '从盲派的角度，你们的合盘有' + mangPaiIssues.length + '个需要留意的地方：' + mangPaiIssues.join('；') + '。这些不是不可逾越的问题，但提醒你们在婚姻中要有意识地去调整和经营。';
    } else {
      stabilityPart = '从稳定性来看，你们的合盘没有明显的婚姻障碍信号，这是一个不错的起点。但婚姻说到底还是靠两个人一起维护的，八字再好也需要日常的用心和付出。';
    }

    detail = combo + ' ' + ziPart + ' ' + caiGuanPart + ' ' + stabilityPart;

  } else if (relationType === '情侣') {
    title = '情侣合盘核心解读';

    // 日柱吸引力权重最高
    var gr = ganRelationType(p1.dayGan, p2.dayGan);
    var attractPart = '';
    if (gr === '合') {
      attractPart = '你们的日干天干五合，是情侣间最强的吸引力信号！天干五合就像天然磁铁，见面就容易来电，相处时总有种说不清的默契和舒适感。这是谈恋爱最需要的那种「化学效应」。';
    } else if (gr === '生' || gr === '被生') {
      attractPart = '你们的日干相生，一方在滋养另一方。这种关系在恋爱中很常见——总有一方更主动、更愿意付出，另一方享受被照顾的感觉。只要被照顾的一方懂得回应，这种模式可以很甜蜜。';
    } else if (gr === '比') {
      attractPart = '你们的日干五行相同，像遇到世界上另一个自己。聊得来、笑点一致、兴趣相投，恋爱初期很容易产生「知己」的感觉。但时间久了可能会少了点新鲜感，需要刻意制造惊喜。';
    } else {
      attractPart = '你们的日干相克，在恋爱中可能是一对「欢喜冤家」。好的时候很有张力和激情，吵起来也真的上头。如果你们享受这种「吵架和好」的循环，那也不失为一种独特的恋爱方式。';
    }

    // 五行互补 - 情侣更看重互补的新鲜感
    var wxPart = '从五行来看，' + (wc.complementScore >= 70 ? '你们五行互补很好，对方身上有你所缺的东西，这种差异感在热恋期特别有吸引力。恋爱就是互相探索的过程，差异越大反而越有趣。' : '你们的五行分布比较接近，好处是相处不累、不用费心磨合，但可能少了点「互补的新鲜感」。情侣间的差异有时候反而是最好的调味剂。');

    // 桃花相关
    var taohuaPart = '';
    var p1Th = getTaohuaZhi(p1), p2Th = getTaohuaZhi(p2);
    if (p1Th && p2Th && p1Th === p2Th) {
      taohuaPart = '有意思的是你们俩的桃花星是同一个地支，代表你们在异性缘分上有相似的磁场，能互相吸引也能互相理解对方的魅力点。';
    } else {
      taohuaPart = '';
    }

    detail = combo + ' ' + attractPart + ' ' + wxPart + ' ' + taohuaPart;

  } else if (relationType === '朋友') {
    title = '朋友合盘核心解读';

    // 比劫关系权重高
    var gr = ganRelationType(p1.dayGan, p2.dayGan);
    var biJiePart = '';
    if (gr === '比' || (isSameWuxing(p1.dayGan, p2.dayGan))) {
      biJiePart = '你们日干五行相同，这在朋友关系里是最好的信号之一。同五行的人思维方式和价值观接近，在一起不用解释太多就能get到对方的点。这种朋友最难得——可以一起疯一起拼，伤心时一个眼神就够了。';
    } else if (gr === '生' || gr === '被生') {
      biJiePart = '你们的日干相生，朋友关系里有明显的互补——一方喜欢照顾人，一方习惯被照顾。或者一个出主意一个去执行。这种「一个主外一个主内」的朋友搭档模式，做事特别有效率。';
    } else if (gr === '合') {
      biJiePart = '你们的日干天干五合，这在朋友关系里也是很好的缘分。虽然不如夫妻/情侣那样有强烈的吸引力，但意味着你们有种天然的默契，合作做事很顺手，是可以长久信任的伙伴。';
    } else {
      biJiePart = '你们的日干相克，朋友关系中可能偶尔会有观点上的碰撞。但这种碰撞不一定是坏事——好朋友之间有时候恰恰是因为敢于说真话、敢于争论，才显得珍贵。关键是要学会「吵完就忘」。';
    }

    // 五行平衡 - 朋友更看重平衡和稳定
    var wxBalancePart = '从五行来看，朋友之间五行平衡比互补更重要。' + (wc.complementScore >= 70 ? '你们五行互补性好，能够在不同方面给彼此支持，是很好的互补型朋友。' : '你们的五行相近，相处起来轻松自在，是有共同话题和共同节奏的好朋友。');

    // 志趣相投
    var zhiQuPart = '';
    var dz1 = HP_ZWX[p1.dayZhi], dz2 = HP_ZWX[p2.dayZhi];
    if (dz1 === dz2) {
      zhiQuPart = '你们的日支五行也相同，说明在更深层次的价值观和处事风格上也很一致。这是能做「一辈子朋友」的配置。';
    } else if (HP_WXS[dz1] === dz2 || HP_WXS[dz2] === dz1) {
      zhiQuPart = '你们的日支五行相生，说明在行事风格上虽然有差异但能互相配合，一个人快的时候另一个人能跟得上。';
    }

    detail = combo + ' ' + biJiePart + ' ' + wxBalancePart + ' ' + zhiQuPart;
  }

  return { title: title, detail: detail };
}

/** 获取桃花的地址 */
function getTaohuaZhi(person) {
  // 以日支查桃花
  if (person.dayZhi && TAOHUA_MAP[person.dayZhi]) return TAOHUA_MAP[person.dayZhi];
  // 以年支查桃花
  var yearZhi = person.pillars[0] ? person.pillars[0].zhi : null;
  if (yearZhi && TAOHUA_MAP[yearZhi]) return TAOHUA_MAP[yearZhi];
  return null;
}

/** 盲派婚姻问题检测 */
function checkMangPaiMarriage(p1, p2) {
  var issues = [];
  var dz1 = p1.dayZhi, dz2 = p2.dayZhi;

  if (HP_ZLC[dz1] === dz2) {
    issues.push('日支六冲，夫妻宫动荡，建议保持情绪稳定，遇事多沟通少冷战');
  }
  if (ZHI_LIU_HAI[dz1] === dz2) {
    issues.push('日支穿害，容易积累隐性不满，建议定期「清空情绪垃圾桶」');
  }
  if (HP_ZXX[dz1] && HP_ZXX[dz1].indexOf(dz2) !== -1) {
    issues.push('日支相刑，容易互不理解，建议多换位思考');
  }
  var rz1 = p1.dayGan + p1.dayZhi, rz2 = p2.dayGan + p2.dayZhi;
  if (YANG_REN_RIZHU.indexOf(rz1) !== -1) {
    issues.push(p1.name + '是羊刃日柱，性格刚硬，建议在关系中多一分柔软');
  }
  if (YANG_REN_RIZHU.indexOf(rz2) !== -1) {
    issues.push(p2.name + '是羊刃日柱，性格刚硬，建议在关系中多一分柔软');
  }

  return issues;
}

// =====================================================
// SECTION 9: 年度建议 (yearlyAdvice)
// =====================================================

function generateYearlyAdvice(p1, p2, relationType) {
  var currentYear = new Date().getFullYear();
  var results = [];

  for (var offset = 0; offset < 3; offset++) {
    var year = currentYear + offset;
    var yearGz = getYearGanZhi(year);
    var yearGan = yearGz.gan, yearZhi = yearGz.zhi;

    // 分析流年干支与两人日柱的互动
    var interactions = [];
    // p1 日干
    var p1Gr = ganRelationType(yearGan, p1.dayGan);
    if (p1Gr === '合') interactions.push('对' + p1.name + '来说天干合，这一年运势不错');
    if (p1Gr === '克') interactions.push('对' + p1.name + '来说天干受克，需注意压力');
    // p2 日干
    var p2Gr = ganRelationType(yearGan, p2.dayGan);
    if (p2Gr === '合') interactions.push('对' + p2.name + '来说天干合，这一年运势不错');

    // 日支互动
    var yzDz1 = zhiRelationType(yearZhi, p1.dayZhi);
    var yzDz2 = zhiRelationType(yearZhi, p2.dayZhi);

    var advice = '';
    if (yzDz1 === '六合' || yzDz2 === '六合') {
      advice = year + '年（' + yearGan + yearZhi + '年）：流年地支与你们其中一人的夫妻宫六合，这一年感情运势上升，适合订婚、结婚或者一起做重要决定。如果有外出旅行的机会，能进一步增进感情。';
    } else if (yzDz1 === '六冲' && yzDz2 === '六冲') {
      advice = year + '年（' + yearGan + yearZhi + '年）：流年地支同时冲你们俩的日支，这一年两人都容易情绪不稳。建议少做大决定，多一些耐心和包容，尽量避免因为小事闹大。过了这个年份就好。';
    } else if (yzDz1 === '六冲' || yzDz2 === '六冲') {
      var whoStr = yzDz1 === '六冲' ? p1.name : p2.name;
      advice = year + '年（' + yearGan + yearZhi + '年）：流年冲' + whoStr + '的夫妻宫，这一年' + whoStr + '情绪波动会比较大，对方要多理解和包容。最好别在气头上做任何决定。';
    } else if (yzDz1 === '三合' || yzDz2 === '三合') {
      advice = year + '年（' + yearGan + yearZhi + '年）：流年与你们的日支形成三合，是有利于人际关系和感情发展的一年。如果有重要的人生计划可以放在这一年推进。';
    } else if (interactions.length > 0) {
      advice = year + '年（' + yearGan + yearZhi + '年）：' + interactions.join('，') + '。总体来看是比较平稳的一年，适合稳扎稳打经营感情。';
    } else {
      if (relationType === '夫妻') {
        advice = year + '年（' + yearGan + yearZhi + '年）：流年对你们的夫妻宫没有特别的冲合，是比较平淡的一年。平淡对夫妻来说是福气，好好享受日常的小日子就好。';
      } else if (relationType === '情侣') {
        advice = year + '年（' + yearGan + yearZhi + '年）：没有大的流年干扰，这一年可以专注于恋爱本身，多创造一些共同的回忆。平淡的年份反而适合夯实感情基础。';
      } else {
        advice = year + '年（' + yearGan + yearZhi + '年）：这一年流年平稳，朋友关系不会有大的波折。可以一起规划和执行一些共同的目标，比如旅行、学习新技能等等。';
      }
    }

    results.push({ year: year, advice: advice });
  }

  return results;
}

/** 根据公历年份计算干支 */
function getYearGanZhi(year) {
  var ganIndex = (year - 4) % 10;
  var zhiIndex = (year - 4) % 12;
  return { gan: HP_TG[ganIndex], zhi: HP_DZ[zhiIndex] };
}

// =====================================================
// SECTION 10: 宜忌建议 (dosAndDonts)
// =====================================================

function generateDosAndDonts(p1, p2, relationType) {
  var dr = analyzeDailyRelation(p1, p2);
  var wc = analyzeWuxingComplement(p1, p2);
  var xiy = analyzeXiyong(p1, p2);
  var dgs = analyzeDayGanStrength(p1, p2);
  var cr = analyzeCrossPillars(p1, p2);

  var dosH = [], dosM = [], dosL = []; // 高/中/低 优先级
  var dontsH = [], dontsM = [], dontsL = [];

  var zr = zhiRelationType(p1.dayZhi, p2.dayZhi);
   var gr = ganRelationType(p1.dayGan, p2.dayGan);

  // 两个人的共忌五行（都忌的）
  var j1 = Array.isArray(xiy.p1.jiShen) ? xiy.p1.jiShen.slice() : [];
  var j2 = Array.isArray(xiy.p2.jiShen) ? xiy.p2.jiShen.slice() : [];
  var shareJi = j1.filter(function(w){return j2.indexOf(w)>-1});
  var shareXi = j1.filter(function(w){return xiy.p1.xiShen.indexOf(w)>-1});

  // 五行强弱提取
  var wxP1 = p1.wuxing, wxP2 = p2.wuxing;
  var WX_ALL = HP_WXO;
  var weakBoth = [];
  WX_ALL.forEach(function(wx){
    if((wxP1[wx]||0)<=1&&(wxP2[wx]||0)<=1)weakBoth.push(wx);
  });

  // 找出驿马（寅申巳亥）柱
  function hasYiMa(pillars){
    var ym=['寅','申','巳','亥'];
    for(var i=0;i<pillars.length;i++){
      if(ym.indexOf(pillars[i].zhi)>-1)return pillars[i];
    }
    return null;
  }
  var ym1=hasYiMa(p1.pillars), ym2=hasYiMa(p2.pillars);

  // 日柱是否羊刃
  var yrdSet={'丙午':1,'壬子':1,'丁巳':1,'癸亥':1};
  var p1YangRen=!!yrdSet[p1.dayGan+p1.dayZhi], p2YangRen=!!yrdSet[p2.dayGan+p2.dayZhi];

  // 跨盘合的数量
  var crHe=0,crChong=0;
  (cr||[]).forEach(function(c){if(c.type==='合')crHe++;if(c.type==='冲')crChong++;});

  // =========================================================
  // 1. 基于喜用神/忌神的五行活动建议
  // =========================================================
  var WX_ACTIVITY = {
    '木':{do:'一起养花草、做园艺、去山林徒步，在大自然里放松心情',dont:'不要总宅在室内封闭空间，木气需要舒展'},
    '火':{do:'一起参加一些有活力的集体活动，比如桌游、运动、看演出，让热情流动起来',dont:'别相互冷落太久，火怕寒，主动点没错'},
    '土':{do:'一起制定实际的目标并踏实执行，比如存钱计划、装修清单、学习一项需要耐心的技艺',dont:'别好高骛远画大饼，土需要踏实感，说到做到才安心'},
    '金':{do:'一起学一门需要专注和逻辑的技艺，比如乐器、棋类、书法，打磨心性',dont:'别在情绪化时做金钱决策，金主决断但也要冷静'},
    '水':{do:'多创造深度聊天和思想碰撞的机会，一起看书、听讲座、交流想法',dont:'别回避深入对话，水主智慧，不敢聊心里话只会让距离越来越远'}
  };

  // 给共忌五行对应的「宜」
  shareJi.forEach(function(wx){
    var act=WX_ACTIVITY[wx+''];
    if(act)dosH.push(act.do+'（'+wx+'为共忌，需主动平衡）');
  });

  // 给缺五行对应的「宜」
  weakBoth.forEach(function(wx){
    var act=WX_ACTIVITY[wx+''];
    if(act&&shareJi.indexOf(wx)<0)dosM.push(act.do+'（'+wx+'不足，需有意识补充）');
  });

  // 共忌对应的「忌」
  shareJi.forEach(function(wx){
    var act=WX_ACTIVITY[wx+''];
    if(act)dontsH.push(act.dont+'（'+wx+'为共忌，过度放任易失衡）');
  });

  // =========================================================
  // 2. 日柱关系驱动的建议
  // =========================================================
  if(zr==='六冲'){
    var p2zhi = HP_ZWX[p2.dayZhi];
    var chongHint='';
    if(p2zhi==='火')chongHint='子午冲';
    else if(p2zhi==='土'||p2zhi==='木'||p2zhi==='金'||p2zhi==='水')chongHint='';
    dosH.push('当两人意见相左时，各自冷静十分钟再聊，不要当场争输赢（日支'+zr+'，情绪易瞬间引爆）');
    dontsH.push('别在气头上说重话，日柱'+zr+'意味着你们一旦互相伤害，伤口比普通关系更深');
    if(ym1||ym2){
      dosM.push('定期一起出门走走，短途旅行最好，流动的空间能大大缓解冲的压力（寅申巳亥为驿马，动则通）');
    } else {
      dosM.push('培养一个能一起流汗的运动习惯，跑跑步、打打球，冲的能量需要身体来释放');
    }
  } else if(zr==='相刑'){
    dosH.push('彼此说话多留三分余地，日支'+zr+'最怕话赶话，慢半拍再回应可以避免很多误会');
    dontsH.push('别对对方的小毛病斤斤计较，日柱相刑容易把小事放大，得过且过反而是智慧');
  } else if(zr==='六害'){
    dosM.push('多关注对方的感受而不是对错，日支'+zr+'关系中是非多，争赢了道理可能输了感情');
    dontsM.push('别跟共同的朋友聊两人之间的矛盾，六害关系容易被外界放大是非');
  } else if(zr==='三合'||zr==='六合'){
    dosM.push('日柱'+zr+'是上等配置，你们之间有一种天然的默契，多相信直觉');
  }

  // 日干五合
  if(gr==='五合'){
    dosH.push('你们是天干'+p1.dayGan+'、'+p2.dayGan+'五合，这是最难得的组合之一，天生互补，遇到分歧多想想这个');
  } else if(gr==='克'){
    dontsM.push('别在公开场合争强好胜，日干'+gr+'关系容易在众人面前擦出火星子');
  }

  // 羊刃
  if(p1YangRen||p2YangRen){
    var who=p1YangRen?p1.name:p2.name;
    dontsM.push(who+'的日柱带羊刃，性格里有不服输的一面，不要硬碰硬，以柔克刚比硬刚效果好得多');
    dosM.push('给'+who+'多一点被需要的感觉，羊刃的人其实最吃软不吃硬，一句「我需要你」比一百句道理都管用');
  }

  // =========================================================
  // 3. 跨盘冲合驱动的建议
  // =========================================================
  if(crChong>=3){
    dontsH.push('避免长期异地分居或长时间冷战，两位盘面之间有'+crChong+'处相冲，距离远了容易生变');
    dosH.push('在两人的共同空间里布置一些圆润的装饰（圆形家具、弧形摆设），在居家层面化解冲的能量');
  } else if(crChong>=1){
    dontsM.push('不要在三观差异大的事情上反复较劲，盘面存在冲克，求同存异比求全更实际');
  }

  if(crHe>=3){
    dosM.push('你们天生合得来，一起做任何事情都比单打独斗效果好，适合共同创业或合作项目');
  }

  // =========================================================
  // 4. 日干旺衰对比
  // =========================================================
  var diff=Math.abs(dgs.p1Strength.score-dgs.p2Strength.score);
  if(diff>30){
    var strong=dgs.p1Strength.score>dgs.p2Strength.score?p1.name:p2.name;
    var weak=strong===p1.name?p2.name:p1.name;
    dosH.push(strong+'在拿主意时多问问'+weak+'的感受，「你说呢」三个字就能让关系平衡很多');
    dontsH.push(strong+'别总觉得'+weak+'不够有主见，有些人的优势在于配合，不是所有人天生都要当决策者');
  } else if(diff>15){
    dosM.push('两人的性格节奏不同，不是缺点而是互补，快的一方学一点耐心，慢的一方学一点果断');
  }

  // =========================================================
  // 5. 关系类型特有建议
  // =========================================================
  if(relationType==='夫妻'){
    // 看夫妻宫日支是否有问题
    if(zr==='六冲'||zr==='相刑'){
      dosH.push('建立共同的家庭财务目标和年度计划，用具体的共同目标来锚定关系，对冲刑的离散力');
    }
    // 财官 — 男看财星女看官星
    if(p1.gender==='male'){
      var caiWx=HP_WXK[HP_GWX[p1.dayGan]]||'土';
      dontsM.push('在经济决策上多听听'+p2.name+'的意见，命盘看你的财星需要辅助，单打独斗容易判断失误');
    }
    if(p2.gender==='female'){
      dontsM.push(p2.name+'不要在工作中过度消耗自己，命盘看需要平衡事业和家庭的精力分配');
    }
  } else if(relationType==='情侣'){
    dosM.push('保持适度的个人空间和朋友圈子，再亲密的关系也需要两个完整的人而不是两个半个人拼在一起');
    // 看桃花
    var p1HasTaohua=!!(p1.shenSha||[]).filter(function(s){return s.indexOf('桃花')>-1}).length;
    var p2HasTaohua=!!(p2.shenSha||[]).filter(function(s){return s.indexOf('桃花')>-1}).length;
    if(p1HasTaohua||p2HasTaohua){
      var whoTP=p1HasTaohua?p1.name:p2.name;
      dontsM.push(whoTP+'的命盘显示人缘不错，在异性交往上保持适当的边界感会让对方更安心');
    }
    dontsM.push('不要过早把所有未来都绑定在对方身上，留一点未知的可能性对彼此都是保护');
  } else if(relationType==='朋友'){
    // 比劫关系
    var p1DayWx=HP_GWX[p1.dayGan];
    var p2DayWx=HP_GWX[p2.dayGan];
    if(p1DayWx===p2DayWx){
      dosM.push('你们两人五行同源，是最好的事业搭档和学习伙伴，适合互相监督一起成长');
    }
    dontsM.push('不要在金钱上有大额牵扯，朋友之间算清楚账才能做长久朋友');
    if(crHe>=2){
      dosM.push('盘面合相多，一起创业或投资的成功率比别人高，可以认真考虑');
    }
  }

  // =========================================================
  // 6. 五行互补深度建议
  // =========================================================
  if(wc.complementScore<40){
    dontsH.push('别强迫对方变成跟自己一样的人，五行互补度低意味着你们的优势完全不在一个赛道，各走各路再回头看对方反而是风景');
    dosH.push('利用好各自的特长分工合作，一个负责规划一个负责执行，一个主外一个主内，互补型联盟反而最稳固');
  } else if(wc.complementScore>=70){
    dosM.push('五行高度互补，你们在一起能形成一个完整的能量环，独处时各自有短板，合在一起刚好补齐');
  }

  // =========================================================
  // 7. 驿马特化建议
  // =========================================================
  if(ym1||ym2){
    var ymWho=ym1?p1.name:(ym2?p2.name:'');
    var ymZhi=(ym1||ym2||{}).zhi;
    if(ymZhi){
      dosM.push(ymWho+'的盘面有驿马星（'+ymZhi+'），多安排一些一起出行、旅行、外出的活动，动起来对你们的运势都有帮助');
      if(crChong>0)dontsM.push('不要把'+ymWho+'拘束在家或办公室太久，有驿马的人憋着会烦躁，情绪积累反而容易爆发冲突');
    }
  }

  // =========================================================
  // 收尾：优先级排序 + 截取
  // =========================================================
  var allDos=dosH.concat(dosM).concat(dosL);
  var allDonts=dontsH.concat(dontsM).concat(dontsL);

  // 去重
  var seenD={}; allDos=allDos.filter(function(d){var k=d.substring(0,20);if(seenD[k])return false;seenD[k]=1;return true});
  var seenDt={}; allDonts=allDonts.filter(function(d){var k=d.substring(0,20);if(seenDt[k])return false;seenDt[k]=1;return true});

  // 补齐到 5 条
  var genericDos=[
    '多创造两人独处的时间，真正的默契都在没有外人干扰时培养出来的',
    '定期安排约会日，不管是去新餐厅还是逛公园，新鲜感是任何关系的保鲜剂'
  ];
  var genericDonts=[
    '不要在情绪上头时做重要决定，冷静下来再说',
    '不要翻旧账，过去的已经过去，关系要向前看'
  ];

  while(allDos.length<5)allDos.push(genericDos.shift()||'');
  while(allDonts.length<5)allDonts.push(genericDonts.shift()||'');

  return { dos: allDos.slice(0,5), donts: allDonts.slice(0,5) };
}

// =====================================================
// SECTION 11: 综合评分 (score)
// =====================================================

function calculateOverallScore(dailyRelation, wuxingComplement, crossPillars, dayGanStrength, relationType) {
  var total = 0;

  if (relationType === '夫妻') {
    // 日支(夫妻宫)权重最高 30分
    total += dailyRelation.score * 0.5;
    // 五行互补 20分
    total += wuxingComplement.complementScore * 0.2;
    // 跨盘和谐 25分
    total += calcCrossPillarScore(crossPillars) * 0.25;
    // 日干旺衰平衡 15分
    var strengthDiff = Math.abs(dayGanStrength.p1Strength.score - dayGanStrength.p2Strength.score);
    total += Math.max(0, 15 - strengthDiff * 0.2);
    // 稳定加分 15分
    total += 15;
  } else if (relationType === '情侣') {
    // 日柱吸引力 35分
    total += dailyRelation.score * 0.58;
    // 五行互补 25分
    total += wuxingComplement.complementScore * 0.25;
    // 跨盘 20分
    total += calcCrossPillarScore(crossPillars) * 0.2;
    // 旺衰平衡 10分
    var diff2 = Math.abs(dayGanStrength.p1Strength.score - dayGanStrength.p2Strength.score);
    total += Math.max(0, 10 - diff2 * 0.15);
    // 激情加分 15分
    total += 15;
  } else if (relationType === '朋友') {
    // 比劫关系 20分
    total += dailyRelation.score * 0.33;
    // 五行平衡 30分 (相似性比互补性更重要)
    var balanceScore = 100 - Math.abs(wuxingComplement.complementScore - 50) * 1.2;
    total += Math.max(0, balanceScore) * 0.3;
    // 跨盘 20分
    total += calcCrossPillarScore(crossPillars) * 0.2;
    // 旺衰 15分
    var diff3 = Math.abs(dayGanStrength.p1Strength.score - dayGanStrength.p2Strength.score);
    total += Math.max(0, 15 - diff3 * 0.2);
    // 默契加分 20分
    total += 20;
  }

  total = Math.round(total);
  total = Math.min(100, Math.max(0, total));

  // 确定等级标签
  var label = '';
  if (total >= 90) label = '天作之合';
  else if (total >= 80) label = '上等缘分';
  else if (total >= 65) label = '良好缘分';
  else if (total >= 50) label = '中等缘分';
  else if (total >= 35) label = '普通缘分';
  else label = '缘分较浅';

  return { total: total, label: label };
}

/** 计算跨盘和谐分数 */
function calcCrossPillarScore(crossPillars) {
  if (!crossPillars || crossPillars.length === 0) return 65;
  var score = 65;
  crossPillars.forEach(function(cp) {
    switch (cp.type) {
      case '合': score += 10; break;
      case '生': score += 5; break;
      case '冲': score -= 5; break;
      case '克': score -= 2; break;
    }
  });
  return Math.min(100, Math.max(0, score));
}

// =====================================================
// SECTION 12: 主分析函数 (analyze)
// =====================================================

/**
 * 八字合盘分析主入口
 * @param {Object} person1 - 第一个人八字数据
 * @param {Object} person2 - 第二个人八字数据
 * @param {string} relationType - '夫妻' | '情侣' | '朋友'
 * @returns {Object} 完整的合盘分析结果
 */
function analyze(person1, person2, relationType) {
  // 默认关系类型
  if (!relationType || ['夫妻','情侣','朋友'].indexOf(relationType) === -1) {
    relationType = '情侣';
  }

  // 1. 日柱关系
  var dailyRelation = analyzeDailyRelation(person1, person2);

  // 2. 五行互补
  var wuxingComplement = analyzeWuxingComplement(person1, person2);

  // 3. 日干旺衰
  var dayGanStrength = analyzeDayGanStrength(person1, person2);

  // 4. 喜用神
  var xiyong = analyzeXiyong(person1, person2);

  // 5. 跨盘分析
  var crossPillars = analyzeCrossPillars(person1, person2);

  // 6. 核心模式
  var coreMode = analyzeCoreMode(person1, person2, relationType);

  // 7. 年度建议
  var yearlyAdvice = generateYearlyAdvice(person1, person2, relationType);

  // 8. 宜忌
  var dosAndDonts = generateDosAndDonts(person1, person2, relationType);

  // 9. 综合评分
  var score = calculateOverallScore(dailyRelation, wuxingComplement, crossPillars, dayGanStrength, relationType);

  return {
    dailyRelation: dailyRelation,
    wuxingComplement: wuxingComplement,
    dayGanStrength: dayGanStrength,
    xiyong: xiyong,
    crossPillars: crossPillars,
    coreMode: coreMode,
    yearlyAdvice: yearlyAdvice,
    dosAndDonts: dosAndDonts,
    score: score
  };
}

// =====================================================
// SECTION 13: 导出
// =====================================================

// 浏览器全局导出
if (typeof window !== 'undefined') {
  window.analyzeHePan = analyze;
  window._hepanHelpers = {
    ganRelationType: ganRelationType,
    zhiRelationType: zhiRelationType,
    calcDayGanStrength: calcDayGanStrength,
    analyzeDailyRelation: analyzeDailyRelation,
    analyzeWuxingComplement: analyzeWuxingComplement,
    analyzeDayGanStrength: analyzeDayGanStrength,
    analyzeXiyong: analyzeXiyong,
    analyzeCrossPillars: analyzeCrossPillars,
    analyzeCoreMode: analyzeCoreMode,
    generateYearlyAdvice: generateYearlyAdvice,
    generateDosAndDonts: generateDosAndDonts,
    calculateOverallScore: calculateOverallScore
  };
}

// Node.js / CommonJS 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    analyze: analyze,
    helpers: {
      ganRelationType: ganRelationType,
      zhiRelationType: zhiRelationType,
      calcDayGanStrength: calcDayGanStrength,
      analyzeDailyRelation: analyzeDailyRelation,
      analyzeWuxingComplement: analyzeWuxingComplement,
      analyzeDayGanStrength: analyzeDayGanStrength,
      analyzeXiyong: analyzeXiyong,
      analyzeCrossPillars: analyzeCrossPillars,
      analyzeCoreMode: analyzeCoreMode,
      generateYearlyAdvice: generateYearlyAdvice,
      generateDosAndDonts: generateDosAndDonts,
      calculateOverallScore: calculateOverallScore
    }
  };
}
})();