/**
 * bazi-chain.js — 生克链分析引擎
 * v1.0 MVP: 四条核心链检测 + 旺衰修正 + 喜用忌调整建议
 *
 * 依赖: bazi.js（WU_XING, DI_ZHI_WU_XING, getCangGan）
 * 必须在 bazi.js 之后加载
 */
(function() {
  'use strict';

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
   * @returns {{ bonuses: {structural: number}, adjustments: Array, hints: Array, ganChain: Array, zhiChain: Array }}
   */
  function analyzeChains(bazi) {
    var dg = bazi.day.gan;
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
    var bonuses = { structural: 0 };

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
    var shaInMonth = (monthZhiWx === KEWO);                       // 月令是杀

    if (shaInMonth && (yinAdjacentGan || yinInDayZhi)) {
      // 月令杀 + 有印贴身 → 杀印相生
      var hasRoot = false;
      positions.forEach(function(pos) {
        if (bazi[pos].zhi === CHANG_SHENG[dg] || bazi[pos].zhi === LIN_GUAN[dg]) {
          hasRoot = true;
        }
      });
      bonuses.structural = hasRoot ? 13 : 8;

      hints.push({
        type: 'structure',
        category: '杀印相生',
        text: '月令七杀当权（申金），但' + (yinAdjacentGan ? '月干' + monthGan + '水印星贴身通关' : '日支申中藏壬水印星通关') + '——「杀印相生，化杀为权」。' +
             (hasRoot ? '日主有长生/禄根，格局成立。' : '日主根气稍弱，杀印虽通但底气不足。')
      });
    }

    // ---- 链B: 财党杀 / 财生杀印通关 ----
    // 路径: 年干(财?) → 月干/月支(杀?) → 日干(身)
    // 年干生月支(杀) / 年干克月干但月干生杀 / 年支生月支(杀)
    var yearGanToMonth = simpleRel(ganChain[0].wx, monthGanWx);   // 年干→月干
    var yearZhiToMonth = simpleRel(zhiChain[0].wx, monthZhiWx);    // 年支→月支
    var yearIsCai = (ganChain[0].wx === WOKE || zhiChain[0].wx === WOKE); // 年柱带财
    var monthIsSha = (monthZhiWx === KEWO || monthGanWx === KEWO); // 月柱带杀

    // 财→杀 生助路径存在
    var caiShengSha = false;
    var caiShengShaPath = '';
    if (yearGanToMonth === 'sheng' && monthGanWx === KEWO) {
      // 年干生月干(杀) — 紧贴，最强
      caiShengSha = true;
      caiShengShaPath = '年干' + ganChain[0].gan + '（' + ganChain[0].wx + '）生月干' + monthGan + '（' + monthGanWx + '）';
    } else if (yearZhiToMonth === 'sheng' && monthZhiWx === KEWO) {
      // 年支生月支(杀)
      caiShengSha = true;
      caiShengShaPath = '年支' + zhiChain[0].zhi + '（' + zhiChain[0].wx + '）生月支' + zhiChain[1].zhi + '（金）';
    } else if (simpleRel(ganChain[0].wx, monthZhiWx) === 'sheng' && monthZhiWx === KEWO) {
      // 年干生月支(杀) — 跨通道
      caiShengSha = true;
      caiShengShaPath = '年干' + ganChain[0].gan + '（' + ganChain[0].wx + '）生月支' + zhiChain[1].zhi + '（金）';
    } else if (simpleRel(zhiChain[0].wx, monthGanWx) === 'sheng' && monthGanWx === KEWO) {
      caiShengSha = true;
      caiShengShaPath = '年支' + zhiChain[0].zhi + '（' + zhiChain[0].wx + '）生月干' + monthGan + '（' + monthGanWx + '）';
    }

    if (caiShengSha && yearIsCai && monthIsSha) {
      // 财生杀 → 这是"财党杀"
      if (yinAdjacentGan || yinInDayZhi || yinInHourGan) {
        // 有印截留 → 财生杀但杀转生印，印再生身 → 不凶反吉
        hints.push({
          type: 'structure',
          category: '财生杀印截',
          text: caiShengShaPath + '→ 财虽生杀，但杀有印星通关（' +
               (yinAdjacentGan ? '月干壬水印星' : yinInDayZhi ? '日支藏壬水印星' : '时干印星') +
               '截留），化敌为友。' + ganChain[0].gan + '土财表面上生杀为忌，实际经通关后最终生身。'
        });
        // 土(财)本来忌，但在此局中忌中有转圜 → 降半级
        adjustments.push({ wx: WOKE, action: 'downgrade_ji', reason: '财虽生杀但被印截，忌中有转圜通路' });
        // 金(杀)虽克身但有印化 → 标记为"忌中转"
        adjustments.push({ wx: KEWO, action: 'highlight_ambivalent', reason: '杀虽克身但转生印，最终生身' });
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
    if (monthZhiWx === KEWO) {
      // 月令为杀 → 看有没有食伤天干透出克月令
      positions.forEach(function(pos) {
        if (window.WU_XING[bazi[pos].gan] === WOSHENG) {
          shiShangZhiSha = true;
          hints.push({
            type: 'info',
            category: '食伤制杀',
            text: posNames[pos] + '天干' + bazi[pos].gan + '（食伤·' + WOSHENG + '）克制月令七杀——"食神制杀，英雄独压万人"。'
          });
          // 火(食伤)名义上忌，但在此局有制杀功能 → 忌中有用
          adjustments.push({ wx: WOSHENG, action: 'downgrade_ji', reason: '食伤虽泄身但能制杀护主' });
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
    positions.forEach(function(pos) {
      var zhi = bazi[pos].zhi;
      // 禄位
      if (zhi === LIN_GUAN[dg]) {
        rootDetails.push(posNames[pos] + '地支' + zhi + '为日主禄位（强根，+12）');
      }
      // 长生位
      if (zhi === CHANG_SHENG[dg]) {
        rootDetails.push(posNames[pos] + '地支' + zhi + '为日主长生之位（有气之根，靠印滋养）');
      }
      // 墓库
      var MU = { '甲':'未','乙':'戌','丙':'戌','丁':'丑','戊':'辰','己':'未','庚':'丑','辛':'辰','壬':'辰','癸':'未' };
      if (zhi === MU[dg]) {
        rootDetails.push(posNames[pos] + '地支' + zhi + '为日主墓库（弱根，入库待冲）');
      }
    });
    if (rootDetails.length === 0) {
      // 检查藏干本气
      var foundRoot = false;
      positions.forEach(function(pos) {
        var cg = window.getCangGan(bazi[pos].zhi);
        if (cg.length > 0 && window.WU_XING[cg[0]] === dgWx) {
          rootDetails.push(posNames[pos] + '藏干本气' + cg[0] + '为日主通根（地支有根）');
          foundRoot = true;
        }
      });
      if (!foundRoot) {
        hints.push({
          type: 'warning',
          category: '日主无根',
          text: '日主' + dg + '木在原局无禄位、无长生、无墓库、无藏干本气根——"无根之木，浮于水上"，根基浅薄。'
        });
      }
    }
    if (rootDetails.length > 0) {
      hints.push({
        type: 'info',
        category: '日主根气',
        text: rootDetails.join('；')
      });
    }

    // ============================================================
    // 5. 《滴天髓》口诀匹配
    // ============================================================
    if (dgWx === '木' && monthZhiWx === KEWO) {
      // 秋木
      if (zhiChain[1].zhi === '申' || zhiChain[1].zhi === '酉') {
        var hasFire = hasWxAnywhere(bazi, '火');
        var hasEarth = hasWxAnywhere(bazi, '土');
        var earthStrong = false;
        // 土是否"重"：统计土在天干+地支出现次数
        var earthCount = 0;
        positions.forEach(function(pos) {
          if (window.WU_XING[bazi[pos].gan] === '土') earthCount++;
          if (window.DI_ZHI_WU_XING[bazi[pos].zhi] === '土') earthCount++;
        });
        earthStrong = earthCount >= 2;

        var diTianSuiHints = [];
        if (!hasFire) {
          diTianSuiHints.push('「脱胎要火」——秋木凋零，无火则木不秀发');
        }
        if (earthStrong) {
          diTianSuiHints.push('「秋不容土」——秋木杀重，再见厚土则财党杀攻身');
        }
        if (diTianSuiHints.length > 0) {
          hints.push({
            type: 'info',
            category: '滴天髓',
            text: '《滴天髓》甲木章：' + diTianSuiHints.join('；') + '。'
          });
          if (!hasFire && earthStrong) {
            // 既有秋不容土（土财重），又无火暖局 → 土比火更忌
            adjustments.push({ wx: '土', action: 'upgrade_ji', reason: '《滴天髓》"秋不容土"：秋木杀重，土财党杀为大忌' });
            // 火虽然名义上忌（泄身），但秋木需火 → 忌降为中性
            adjustments.push({ wx: '火', action: 'downgrade_ji', reason: '《滴天髓》"脱胎要火"：秋木需火暖局发荣，虽泄身但调候所需' });
          }
        }
      }
    }

    // ============================================================
    // 6. 去重调整（first-write-wins: 链分析 > 滴天髓泛化规则）
    // ============================================================
    var finalAdjustments = [];
    var seenWx = {};
    for (var a = 0; a < adjustments.length; a++) {
      var adj = adjustments[a];
      if (!seenWx[adj.wx]) {
        seenWx[adj.wx] = true;
        finalAdjustments.push(adj);
      }
    }

    return {
      bonuses: bonuses,
      adjustments: finalAdjustments,
      hints: hints,
      ganChain: ganChain,
      zhiChain: zhiChain
    };
  }

  // ============================================================
  // 公开 API
  // ============================================================
  window.BaZiChain = {
    analyze: analyzeChains,
    CHANG_SHENG: CHANG_SHENG,
    LIN_GUAN: LIN_GUAN,
    CHONG: CHONG,
    HAI: HAI
  };

})();
