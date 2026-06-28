/**
 * ============================================================
 * 知时 - 合盘结果页渲染脚本 (hepan-result.js)
 * 读取 URL 参数 → 推算双方八字 → 调用合盘引擎 → 渲染结果
 * ============================================================
 */

;(function() {
  'use strict';

  // =====================================================
  // SECTION 0: 常量映射
  // =====================================================

  var GAN_WUXING_MAP = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
  var ZHI_WUXING_MAP = { '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };
  var WUXING_ORDER = ['木','火','土','金','水'];
  var PILLAR_LABELS = ['年柱','月柱','日柱','时柱'];

  var WX_COLORS = {
    '木': '#7ec87e', '火': '#e06055', '土': '#d4a843',
    '金': '#e8d44d', '水': '#5b9bd5'
  };

  var WX_LABELS = {
    '木': '木', '火': '火', '土': '土', '金': '金', '水': '水'
  };

  // 关系类型中文
  var RELATION_LABELS = { '夫妻': '夫妻合盘', '情侣': '情侣合盘', '朋友': '朋友合盘' };

  // =====================================================
  // SECTION 1: URL 参数读取
  // =====================================================

  function getParams() {
    var raw = window.location.search;
    var p = {};
    if (!raw || raw.length <= 1) return p;

    var q = raw.substring(1);
    var pairs = q.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split('=');
      if (kv.length >= 2) {
        var key = decodeURIComponent(kv[0]);
        var val = decodeURIComponent(kv.slice(1).join('='));
        p[key] = val;
      }
    }
    return p;
  }

  function parsePersonParams(params, prefix) {
    var y = parseInt(params[prefix + 'y']);
    var m = parseInt(params[prefix + 'm']);
    var d = parseInt(params[prefix + 'd']);
    var h = parseInt(params[prefix + 'h']);
    var clock = params[prefix + 'clock'] !== undefined ? parseInt(params[prefix + 'clock']) : h;
    var min = params[prefix + 'min'] !== undefined ? parseInt(params[prefix + 'min']) : 0;
    var g = params[prefix + 'g'];
    var cal = params[prefix + 'cal'] || 'solar';

    if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h) || !g) {
      return null;
    }

    return {
      year: y, month: m, day: d,
      hour: h, clock: isNaN(clock) ? h : clock,
      minute: min, gender: g, cal: cal
    };
  }

  // =====================================================
  // SECTION 2: 人物对象构建
  // =====================================================

  /**
   * 根据八字数据构建 hepan-core 分析所需的人物对象
   * @param {string} name - '甲方' | '乙方'
   * @param {number} year
   * @param {number} month
   * @param {number} day
   * @param {number} hour - 时支索引 0-11
   * @param {number} clock - 实际钟点 0-23
   * @param {string} gender - 'male' | 'female'
   * @returns {Object} 人物对象
   */
  function buildPerson(name, year, month, day, hour, clock, gender) {
    // 调用 bazi.js 的 calculateBaZi
    var bazi = calculateBaZi(year, month, day, hour, gender, clock);

    // 构建四柱 pillars 数组
    var pillars = [
      buildPillar(bazi.year),
      buildPillar(bazi.month),
      buildPillar(bazi.day),
      buildPillar(bazi.hour)
    ];

    // 完整五行统计（含藏干）
    var wuxing = countFullWuxing(pillars);

    // 日主五行
    var dmWuxing = GAN_WUXING_MAP[bazi.day.gan] || '土';

    return {
      _bazi: bazi,
      name: name,
      gender: gender,
      dayGan: bazi.day.gan,
      dayZhi: bazi.day.zhi,
      dayMaster: bazi.day.gan,
      dmWuxing: dmWuxing,
      shenSha: [],
      pillars: pillars,
      wuxing: wuxing
    };
  }

  /**
   * 构建单柱 pillar 对象
   * { gan, zhi, cangGan, nayin, shiShen: { ganSS, zhiSS } }
   */
  function buildPillar(pillarData) {
    var gan = pillarData.gan;
    var zhi = pillarData.zhi;
    var cangGan = pillarData.cangGan || getCangGanFromBazi(zhi);
    var nayin = pillarData.nayin || '';

    // 十神 - ganSS 直接使用 pillarData.shiShen.gan
    var ganSS = pillarData.shiShen ? pillarData.shiShen.gan : '';
    var zhiSS = pillarData.shiShen ? pillarData.shiShen.zhi : '';

    return {
      gan: gan,
      zhi: zhi,
      cangGan: cangGan,
      nayin: nayin,
      shiShen: {
        ganSS: ganSS,
        zhiSS: zhiSS
      }
    };
  }

  /**
   * 从地支获取藏干（内联，避免依赖 hepan-core 的 CANG_GAN）
   */
  function getCangGanFromBazi(zhi) {
    var map = {
      '子': ['癸'], '丑': ['己','癸','辛'], '寅': ['甲','丙','戊'], '卯': ['乙'],
      '辰': ['戊','乙','癸'], '巳': ['丙','庚','戊'], '午': ['丁','己'], '未': ['己','丁','乙'],
      '申': ['庚','壬','戊'], '酉': ['辛'], '戌': ['戊','辛','丁'], '亥': ['壬','甲']
    };
    return map[zhi] || [];
  }

  /**
   * 完整五行统计：所有四柱的 gan + zhi + cangGan 合计
   * @returns {{木: number, 火: number, 土: number, 金: number, 水: number}}
   */
  function countFullWuxing(pillars) {
    var count = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };

    for (var i = 0; i < pillars.length; i++) {
      var p = pillars[i];

      // 天干五行
      var gw = GAN_WUXING_MAP[p.gan];
      if (gw) count[gw]++;

      // 地支五行
      var zw = ZHI_WUXING_MAP[p.zhi];
      if (zw) count[zw]++;

      // 藏干五行
      var cg = p.cangGan || [];
      for (var j = 0; j < cg.length; j++) {
        var cw = GAN_WUXING_MAP[cg[j]];
        if (cw) count[cw]++;
      }
    }

    return count;
  }

  // =====================================================
  // SECTION 3: 渲染主函数
  // =====================================================

  /**
   * 渲染整页合盘结果
   * @param {Object} result - analyzeHePan 的返回值
   * @param {string} relationType - 关系类型
   * @param {Object} p1 - 第一个人物对象
   * @param {Object} p2 - 第二个人物对象
   */
  function renderAll(result, relationType, p1, p2) {
    // 设置关系类型标签
    var typeLabel = document.getElementById('typeLabel');
    if (typeLabel) {
      typeLabel.textContent = RELATION_LABELS[relationType] || '合盘分析';
    }

    // 1. Score banner → 独立容器 #scoreBanner
    var scoreEl = document.getElementById('scoreBanner');
    if (scoreEl) {
      scoreEl.innerHTML = renderScoreBanner(result.score, relationType);
    }

    // 2. Dual bazi → 独立容器 #dualBazi
    var baziEl = document.getElementById('dualBazi');
    if (baziEl) {
      baziEl.innerHTML = renderDualBazi(p1, p2);
    }

    // 滚动计数器
    var secIdx = 0;

    // 3-10. 其余板块 → #hpSections
    var sectionsEl = document.getElementById('hpSections');
    if (!sectionsEl) {
      console.error('[hepan-result] 找不到 #hpSections');
      return;
    }
    var html = '';
    html += renderXiyong(result.xiyong, p1, p2, secIdx++);
    html += renderWuxingComplement(result.wuxingComplement, p1, p2, secIdx++);
    html += renderDailyRelation(result.dailyRelation, p1, p2, secIdx++);
    html += renderDayGanStrength(result.dayGanStrength, p1, p2, secIdx++);
    html += renderCrossPillars(result.crossPillars, secIdx++);
    html += renderCoreMode(result.coreMode, secIdx++);
    html += renderYearlyAdvice(result.yearlyAdvice, secIdx++);
    html += renderDosAndDonts(result.dosAndDonts, secIdx++);
    sectionsEl.innerHTML = html;

    handleMobileAdaptation();

    // 存储分析结果供 PDF 下载使用
    window._hepanData = { result: result, relationType: relationType, p1: p1, p2: p2 };

    // 初始化付费遮罩
    // old paywall disabled, using new inline version
  }

  // 构建 drawer 包装器，idx 为序号用于付费 ID 定位
  function drawer(title, bodyHtml, idx, openByDefault) {
    var cls = openByDefault ? 'hp-drawer hp-drawer-open' : 'hp-drawer';
    var idAttr = (idx !== undefined) ? ' id="hp-drawer-' + idx + '"' : '';
    return '<div class="' + cls + '"' + idAttr + '>' +
      '<div class="hp-drawer-toggle" onclick="this.parentElement.classList.toggle(\'hp-drawer-open\')">' +
        '<span class="hp-drawer-arrow">▶</span>' +
        '<h2>' + escapeHtml(title) + '</h2>' +
      '</div>' +
      '<div class="hp-drawer-body drawer-body">' + bodyHtml + '</div>' +
    '</div>';
  }

  function renderScoreBanner(scoreData, relationType) {
    var score = scoreData.total;
    var label = scoreData.label;
    var relLabel = RELATION_LABELS[relationType] || '合盘分析';

    // 根据分数决定颜色
    var colorClass = 'hp-score-high';
    if (score < 35) colorClass = 'hp-score-low';
    else if (score < 50) colorClass = 'hp-score-mid-low';
    else if (score < 65) colorClass = 'hp-score-mid';
    else if (score < 80) colorClass = 'hp-score-mid-high';

    var numColor = score >= 65 ? '#e8cf70' : (score >= 50 ? '#c9a84c' : '#b09850');

    return '' +
      '<div class="hp-score-ring ' + colorClass + '" style="display:inline-block;width:100px;height:100px;border-radius:50%;border:3px solid ' + numColor + ';line-height:100px;margin-bottom:10px">' +
        '<span class="hp-score-num" style="font-size:38px;font-weight:900;color:' + numColor + '">' + score + '</span>' +
      '</div>' +
      '<div class="hp-score-label" style="font-size:20px;color:' + numColor + ';letter-spacing:4px;font-weight:600;margin-bottom:4px">' + label + '</div>' +
      '<div class="hp-score-subtitle">' + relLabel + ' · 合盘分析</div>';
  }

  // =====================================================
  // SECTION 3.2: 双人八字展示
  // =====================================================

  function renderDualBazi(p1, p2) {
    return drawer('双方八字',
      '<div class="hp-dual-bazi">' +
        renderBaziCard(p1) +
        renderBaziCard(p2) +
      '</div>', undefined, true);
  }

  function renderBaziCard(person) {
    var isP2 = person.name === '乙方';
    var labelClass = isP2 ? 'hp-bazi-label p2' : 'hp-bazi-label';

    var pillarsHtml = '';
    for (var i = 0; i < person.pillars.length; i++) {
      var p = person.pillars[i];
      pillarsHtml += '' +
        '<div class="hp-pillar">' +
          '<div class="hp-pillar-label">' + PILLAR_LABELS[i] + '</div>' +
          '<div class="hp-pillar-gan">' + p.gan + '</div>' +
          '<div class="hp-pillar-zhi">' + p.zhi + '</div>' +
        '</div>';
    }

    return '' +
      '<div class="hp-bazi-card">' +
        '<div class="' + labelClass + '">' + person.name + ' · ' + getGenderLabel(person.gender) + '</div>' +
        '<div class="hp-bazi-pillars">' + pillarsHtml + '</div>' +
      '</div>';
  }

  function getGenderLabel(gender) {
    return gender === 'male' ? '乾造' : '坤造';
  }

  // =====================================================
  // SECTION 3.3: 喜用神
  // =====================================================

  function renderXiyong(xiyongData, p1, p2, idx) {
    if (!xiyongData || !xiyongData.p1 || !xiyongData.p2) {
      return drawer('喜用神分析', '<p>数据暂不可用</p>', idx, false);
    }

    var x1 = xiyongData.p1;
    var x2 = xiyongData.p2;
    var detail = xiyongData.complementDetail || '';

    return drawer('喜用神分析',
      '<div class="hp-xiyong-grid">' +
        renderXiyongCard(p1.name, x1.xiShen, x1.yongShen, x1.jiShen) +
        renderXiyongCard(p2.name, x2.xiShen, x2.yongShen, x2.jiShen) +
      '</div>' +
      (detail ? '<div class="hp-xiyong-complement">' + escapeHtml(detail) + '</div>' : ''), idx, true);
  }

  function renderXiyongCard(name, xiShen, yongShen, jiShen) {
    var ysStr = Array.isArray(yongShen) ? yongShen.join('、') : (yongShen || '');
    var jsStr = Array.isArray(jiShen) ? jiShen.join('、') : (jiShen || '');

    return '' +
      '<div class="hp-xiyong-card">' +
        '<div class="hp-xiyong-name">' + escapeHtml(name) + '</div>' +
        '<div class="hp-xiyong-row"><span class="hp-xiyong-tag xi">喜神</span><span>' + escapeHtml(xiShen || '-') + '</span></div>' +
        '<div class="hp-xiyong-row"><span class="hp-xiyong-tag yong">用神</span><span>' + escapeHtml(ysStr || '-') + '</span></div>' +
        '<div class="hp-xiyong-row"><span class="hp-xiyong-tag ji">忌神</span><span>' + escapeHtml(jsStr || '-') + '</span></div>' +
      '</div>';
  }

  // =====================================================
  // SECTION 3.4: 五行互补
  // =====================================================

  function renderWuxingComplement(wcData, p1, p2, idx) {
    if (!wcData) {
      return drawer('五行互补', '<p>数据暂不可用</p>', idx, false);
    }

    return drawer('五行互补',
      '<div class="hp-wuxing-bars">' +
        renderWuxingBars(p1) +
        renderWuxingBars(p2) +
      '</div>' +
      '<div class="hp-wuxing-desc">' + escapeHtml(wcData.detail || '') + '</div>' +
      '<div class="hp-wuxing-score">互补度评分：' + (wcData.complementScore || 0) + ' 分</div>', idx, true);
  }

  function renderWuxingBars(person) {
    var barsHtml = '';
    var maxCount = 1;
    // Find max count for relative scaling
    WUXING_ORDER.forEach(function(wx) {
      var c = person.wuxing[wx] || 0;
      if (c > maxCount) maxCount = c;
    });

    WUXING_ORDER.forEach(function(wx) {
      var count = person.wuxing[wx] || 0;
      var pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
      barsHtml += '' +
        '<div class="hp-wx-row">' +
          '<span class="hp-wx-name" style="color:' + (WX_COLORS[wx] || '#ccc') + '">' + WX_LABELS[wx] + '</span>' +
          '<div class="hp-wx-bar-track"><div class="hp-wx-bar-fill" style="width:' + pct + '%;background:' + (WX_COLORS[wx] || '#ccc') + '"></div></div>' +
          '<span class="hp-wx-count">' + count + '</span>' +
        '</div>';
    });

    return '' +
      '<div class="hp-wuxing-card">' +
        '<div class="hp-wuxing-name">' + escapeHtml(person.name) + '</div>' +
        barsHtml +
      '</div>';
  }

  // =====================================================
  // SECTION 3.5: 日柱契合度
  // =====================================================

  function renderDailyRelation(drData, p1, p2, idx) {
    if (!drData) {
      return drawer('日柱契合度', '<p>数据暂不可用</p>', idx, false);
    }

    return drawer('日柱契合度',
      '<div class="hp-daily-score">契合评分：' + (drData.score || 0) + ' / 60</div>' +
      '<div class="hp-daily-desc">' + escapeHtml(drData.ganDesc || '') + '</div>' +
      '<div class="hp-daily-desc">' + escapeHtml(drData.zhiDesc || '') + '</div>', idx, true);
  }

  // =====================================================
  // SECTION 3.6: 日干关系
  // =====================================================

  function renderDayGanStrength(dgsData, p1, p2, idx) {
    if (!dgsData) {
      return drawer('日干旺衰对比', '<p>数据暂不可用</p>', idx, false);
    }

    var p1s = dgsData.p1Strength || {};
    var p2s = dgsData.p2Strength || {};
    var dg1 = p1.dayGan;
    var dg2 = p2.dayGan;
    var yinYang1 = ['甲','丙','戊','庚','壬'].indexOf(dg1) !== -1 ? '阳' : '阴';
    var yinYang2 = ['甲','丙','戊','庚','壬'].indexOf(dg2) !== -1 ? '阳' : '阴';

    return drawer('日干旺衰对比',
      '<div class="hp-dgs-grid">' +
        '<div class="hp-dgs-card">' +
          '<div class="hp-dgs-name">' + escapeHtml(p1.name) + '</div>' +
          '<div class="hp-dgs-gan">日干：<b>' + escapeHtml(dg1) + '</b>（' + yinYang1 + '）</div>' +
          '<div class="hp-dgs-strength">' + escapeHtml(p1s.label || '-') + '</div>' +
          '<div class="hp-dgs-wx">五行：' + (GAN_WUXING_MAP[dg1] || '-') + '</div>' +
        '</div>' +
        '<div class="hp-dgs-vs">VS</div>' +
        '<div class="hp-dgs-card">' +
          '<div class="hp-dgs-name">' + escapeHtml(p2.name) + '</div>' +
          '<div class="hp-dgs-gan">日干：<b>' + escapeHtml(dg2) + '</b>（' + yinYang2 + '）</div>' +
          '<div class="hp-dgs-strength">' + escapeHtml(p2s.label || '-') + '</div>' +
          '<div class="hp-dgs-wx">五行：' + (GAN_WUXING_MAP[dg2] || '-') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="hp-dgs-summary">' + escapeHtml(dgsData.whoStronger || '') + '</div>' +
      '<div class="hp-dgs-detail">' + escapeHtml(dgsData.detail || '') + '</div>', idx, true);
  }

  // =====================================================
  // SECTION 3.7: 跨盘干支交互
  // =====================================================

  function renderCrossPillars(crossData, idx) {
    var TITLE = '双方命中相合与相克之处';
    if (!crossData || !crossData.length) {
      return drawer(TITLE,
        '<p class="hp-no-data">两盘之间未发现明显干支交互关系。</p>', idx, false);
    }

    var itemsHtml = '';
    for (var i = 0; i < crossData.length; i++) {
      var item = crossData[i];
      var typeClass = '';
      switch (item.type) {
        case '合': typeClass = 'hp-cross-he'; break;
        case '生': typeClass = 'hp-cross-sheng'; break;
        case '冲': typeClass = 'hp-cross-chong'; break;
        case '克': typeClass = 'hp-cross-ke'; break;
      }

      itemsHtml += '' +
        '<div class="hp-cross-item ' + typeClass + '">' +
          '<span class="hp-cross-type">[' + escapeHtml(item.type) + ']</span>' +
          '<span class="hp-cross-pillars">' + escapeHtml(item.pillar1) + ' ←→ ' + escapeHtml(item.pillar2) + '</span>' +
          '<div class="hp-cross-detail">' + escapeHtml(item.detail || '') + '</div>' +
        '</div>';
    }

    return drawer(TITLE,
      '<div class="hp-cross-list">' + itemsHtml + '</div>', idx, true);
  }

  // =====================================================
  // SECTION 3.8: 核心相处模式
  // =====================================================

  function renderCoreMode(coreMode, idx) {
    var TITLE = '你们的相处密码';
    if (!coreMode) {
      return drawer(TITLE, '<p>数据暂不可用</p>', idx, false);
    }

    return drawer(TITLE,
      '<div class="hp-mode-card">' +
        '<div class="hp-mode-title">' + escapeHtml(coreMode.title || '') + '</div>' +
        '<div class="hp-mode-detail">' + escapeHtml(coreMode.detail || '') + '</div>' +
      '</div>', idx, true);
  }

  // =====================================================
  // SECTION 3.9: 流年关键节点
  // =====================================================

  function renderYearlyAdvice(yearlyData, idx) {
    var TITLE = '未来三年关键节点与避讳';
    if (!yearlyData || !yearlyData.length) {
      return drawer(TITLE, '<p>数据暂不可用</p>', idx, false);
    }

    var cardsHtml = '';
    var yearLabels = ['今年', '明年', '后年'];
    for (var i = 0; i < Math.min(yearlyData.length, 3); i++) {
      var item = yearlyData[i];
      cardsHtml += '' +
        '<div class="hp-yearly-card">' +
          '<div class="hp-yearly-label">' + yearLabels[i] + ' · ' + item.year + '年</div>' +
          '<div class="hp-yearly-advice">' + escapeHtml(item.advice || '') + '</div>' +
        '</div>';
    }

    return drawer(TITLE,
      '<div class="hp-yearly-grid">' + cardsHtml + '</div>', idx, true);
  }

  // =====================================================
  // SECTION 3.10: 宜忌清单
  // =====================================================

  function renderDosAndDonts(ddData, idx) {
    var TITLE = '专属相处宜忌指南';
    if (!ddData) {
      return drawer(TITLE, '<p>数据暂不可用</p>', idx, false);
    }

    var dos = ddData.dos || [];
    var donts = ddData.donts || [];

    var dosHtml = '';
    for (var i = 0; i < dos.length; i++) {
      dosHtml += '<li class="hp-do-item">' + escapeHtml(dos[i]) + '</li>';
    }
    if (!dosHtml) dosHtml = '<li class="hp-do-item hp-empty">暂无特别建议</li>';

    var dontsHtml = '';
    for (var j = 0; j < donts.length; j++) {
      dontsHtml += '<li class="hp-dont-item">' + escapeHtml(donts[j]) + '</li>';
    }
    if (!dontsHtml) dontsHtml = '<li class="hp-dont-item hp-empty">暂无特别禁忌</li>';

    return drawer(TITLE,
      '<div class="hp-dosdonts">' +
        '<div class="hp-dos-col">' +
          '<div class="hp-dos-title">✓ 宜</div>' +
          '<ul class="hp-dos-list">' + dosHtml + '</ul>' +
        '</div>' +
        '<div class="hp-donts-col">' +
          '<div class="hp-donts-title">✗ 忌</div>' +
          '<ul class="hp-donts-list">' + dontsHtml + '</ul>' +
        '</div>' +
      '</div>', idx, true);
  }

  // =====================================================
  // SECTION 4: 错误处理
  // =====================================================

  function showError(message) {
    var container = document.getElementById('hepan-result') || document.getElementById('hp-result-container');
    if (container) {
      container.innerHTML = '' +
        '<div class="hp-header">' +
          '<div class="hp-score-banner hp-score-low">' +
            '<div class="hp-score-label">参数错误</div>' +
            '<div class="hp-score-subtitle">' + escapeHtml(message) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="hp-section" style="text-align:center;padding:40px 20px;">' +
          '<p>请返回 <a href="hepan.html" style="color:var(--gold);">合盘页面</a> 重新填写信息。</p>' +
        '</div>';
    }
  }

  // =====================================================
  // SECTION 5: 工具函数
  // =====================================================

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 移动端适配 - 动态调整一些样式
   */
  function handleMobileAdaptation() {
    var isMobile = window.innerWidth <= 480;
    if (isMobile) {
      // 为移动端添加 body class
      document.body.classList.add('hp-mobile');
    }
  }

  // =====================================================
  // SECTION 5.5: PDF 合盘报告下载
  // =====================================================

  function downloadHePanReport() {
    var data = window._hepanData;
    if (!data || !data.result) return;
    var r = data.result, rel = data.relationType, p1 = data.p1, p2 = data.p2;
    var gender1 = p1.gender === 'male' ? '乾造' : '坤造';
    var gender2 = p2.gender === 'male' ? '乾造' : '坤造';
    var dateStr = new Date().toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'});
    var relLabel = RELATION_LABELS[rel] || '合盘分析';

    var css = ''
    // 基础
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'html{font-size:15px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{max-width:820px;margin:0 auto;font-family:"Source Han Serif SC","Noto Serif SC","PingFang SC","Songti SC","SimSun",serif;color:#d5cebb;background:#0d0f18;padding:0;line-height:1.8;orphans:3;widows:3}'

    // 封面
    + '.cover{text-align:center;padding:90px 30px 70px;background:linear-gradient(180deg,#111320 0%,#0d0f18 100%);position:relative;border-bottom:1px solid rgba(201,168,76,.1);page-break-after:always}'
    + '.cover::before{content:"";position:absolute;top:35%;left:50%;transform:translate(-50%,-50%);width:320px;height:320px;border-radius:50%;border:1px solid rgba(201,168,76,.08);background:radial-gradient(circle,rgba(201,168,76,.02) 0%,transparent 70%)}'
    + '.cover .brand{font-size:64px;color:#d4b850;letter-spacing:24px;font-weight:900;margin-bottom:14px;position:relative}'
    + '.cover .tagline{font-size:18px;color:#a09060;letter-spacing:12px;margin-bottom:50px;position:relative}'
    + '.cover .cover-divider{width:60px;height:1px;margin:0 auto 40px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.3),transparent)}'
    + '.cover .info{display:inline-block;padding:20px 36px;border:1px solid rgba(201,168,76,.15);border-radius:14px;color:#a89878;font-size:15px;letter-spacing:2px;line-height:2.2;position:relative;background:rgba(201,168,76,.02)}'
    + '.cover .info strong{color:#d8c060;font-weight:600}'

    // 区块
    + '.section{margin:0;padding:0 36px;page-break-inside:avoid}'
    + '.section.break-before{page-break-before:always}'
    + '.section-title{font-size:20px;color:#d0b850;text-align:center;margin:40px 0 22px;letter-spacing:6px;font-weight:700;page-break-after:avoid}'
    + '.section-title::after{content:"";display:block;width:50px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.25),transparent);margin:12px auto 0}'
    + '.section-body{color:#b0a090;font-size:14px;line-height:2.0;padding:8px 0}'
    + '.section-body b,.section-body strong{color:#d8be58}'

    // 评分环
    + '.score-ring{display:inline-block;width:90px;height:90px;border-radius:50%;border:3px solid #d4b850;line-height:90px;text-align:center;margin-bottom:10px;background:rgba(201,168,76,.05)}'
    + '.score-num{font-size:36px;font-weight:900;color:#d4b850}'
    + '.score-label{font-size:16px;color:#c9a84c;margin-top:8px;letter-spacing:2px}'

    // 八字
    + '.bazi-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:14px 0}'
    + '.bazi-cell{text-align:center;padding:10px 12px;border:1px solid rgba(201,168,76,.12);border-radius:8px;min-width:62px;page-break-inside:avoid}'
    + '.bazi-cell .gan{font-size:24px;font-weight:700;color:#e0d8c8}'
    + '.bazi-cell .zhi{font-size:16px;color:#b8a888}'
    + '.bazi-cell .label{font-size:10px;color:#7a7880;margin-bottom:4px;letter-spacing:2px}'

    // 日干对比
    + '.dgs-row{display:flex;align-items:center;gap:16px;margin:14px 0;justify-content:center}'
    + '.dgs-card{flex:1;max-width:200px;text-align:center;padding:16px 12px;border:1px solid rgba(201,168,76,.1);border-radius:10px;background:rgba(255,255,255,.01);page-break-inside:avoid}'
    + '.dgs-card .name{font-size:15px;color:#c9a84c;margin-bottom:8px;letter-spacing:2px}'
    + '.dgs-card .gan{font-size:22px;color:#e0d8c8;font-weight:700}'
    + '.dgs-vs{font-size:18px;color:rgba(201,168,76,.35);font-weight:700}'

    // 跨盘交互
    + '.cross-item{padding:10px 14px;border-left:3px solid rgba(201,168,76,.2);margin:8px 0;font-size:13px;page-break-inside:avoid}'
    + '.cross-item.he{border-left-color:#7ec87e}.cross-item.sheng{border-left-color:#5b9bd5}.cross-item.chong{border-left-color:#e06055}.cross-item.ke{border-left-color:#d4a843}'
    + '.cross-item b{color:#d0b850}'

    // 年度建议
    + '.advice-row{display:flex;gap:10px;margin:10px 0;flex-wrap:wrap}'
    + '.advice-card{flex:1;min-width:140px;padding:12px;border:1px solid rgba(201,168,76,.1);border-radius:8px;font-size:12px;page-break-inside:avoid}'
    + '.advice-card .yr{font-size:14px;color:#c9a84c;margin-bottom:6px;font-weight:600;letter-spacing:1px}'

    // 宜忌
    + '.dd-row{display:flex;gap:14px;margin:14px 0;page-break-inside:avoid}'
    + '.dd-col{flex:1}.dd-col h4{font-size:15px;margin-bottom:8px;letter-spacing:3px}'
    + '.dd-col .do{color:#7ec87e}.dd-col .dont{color:#e06055}'
    + '.dd-col li{font-size:13px;line-height:2.0;margin:3px 0}'

    // 页脚
    + '.footer{text-align:center;padding:50px 36px 40px;border-top:1px solid rgba(255,255,255,.04);margin-top:50px;color:#5a5860;font-size:12px;line-height:2.2;letter-spacing:1px}'
    + '.footer .footer-brand{font-size:15px;color:#a09060;letter-spacing:6px;font-weight:600}'

    // 操作栏
    + '.no-print{text-align:center;padding:16px 0}'
    + '.no-print .toolbar{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}'
    + '.no-print button{display:inline-flex;align-items:center;gap:6px;margin:0;padding:12px 28px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);color:#d8c060;font-size:15px;font-weight:600;border-radius:10px;cursor:pointer;letter-spacing:3px;font-family:inherit;transition:all .2s}'
    + '.no-print button:hover{background:rgba(201,168,76,.18);transform:translateY(-1px)}'

    // 打印
    + '@media print{'
    + 'html,body{background:#fff!important;color:#222!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:14px}'
    + '.cover{background:#fafaf5!important;padding:60px 0 50px;border-bottom:2px solid #d8c060!important;page-break-after:always}'
    + '.cover::before{display:none}'
    + '.cover .brand{color:#8a7030!important}'
    + '.cover .tagline,.cover .info{color:#6a6050!important}'
    + '.section{padding:0!important}'
    + '.section-title{color:#8a7030!important;font-size:18px!important;page-break-after:avoid}'
    + '.section-title::after{background:rgba(180,150,60,.3)!important}'
    + '.section-body{color:#333!important}'
    + '.section-body b,.section-body strong{color:#6a5020!important}'
    + '.bazi-cell{border-color:#e0d8c8!important}'
    + '.bazi-cell .gan,.bazi-cell .zhi{color:#444!important}'
    + '.bazi-cell .label{color:#999!important}'
    + '.dgs-card{background:#fafaf5!important;border-color:#e0d8c8!important}'
    + '.dgs-card .gan,.dgs-card .name{color:#444!important}'
    + '.cross-item{color:#333!important}'
    + '.advice-card{border-color:#e0d8c8!important;color:#444!important}'
    + '.advice-card .yr{color:#8a7030!important}'
    + '.dd-col li{color:#444!important}'
    + '.footer{color:#8a8a80!important;border-top-color:#e0e0d8!important}'
    + '.footer .footer-brand{color:#a09060!important}'
    + '.no-print{display:none!important}'
    + '@page{size:A4;margin:16mm 14mm 18mm 14mm;'
    +   '@top-center{content:"知时 · 合盘分析报告";font-size:9px;color:#b0a090;font-family:"Source Han Serif SC",serif}'
    +   '@bottom-center{content:"— " counter(page) " —";font-size:9px;color:#b0a090;font-family:"Source Han Serif SC",serif}'
    + '}'
    + '@page:first{@top-center{content:none}}'
    + '}';

    // Build bazi cells HTML
    function baziRow(person, label){
      var h='<div class="bazi-row"><div class="bazi-cell"><div class="label">'+label+'</div></div>';
      var pl=['年柱','月柱','日柱','时柱'];
      for(var i=0;i<person.pillars.length;i++){
        var p=person.pillars[i];
        h+='<div class="bazi-cell"><div class="label">'+pl[i]+'</div><div class="gan">'+p.gan+'</div><div class="zhi">'+p.zhi+'</div></div>';
      }
      h+='</div>';
      return h;
    }

    // Cross items
    var crItems='';
    (r.crossPillars||[]).forEach(function(item){
      var tc='';
      switch(item.type){case'合':tc='he';break;case'生':tc='sheng';break;case'冲':tc='chong';break;case'克':tc='ke';break;}
      crItems+='<div class="cross-item '+tc+'"><b>['+item.type+']</b> '+item.pillar1+' ←→ '+item.pillar2+' — '+item.detail+'</div>';
    });

    // Yearly advice
    var yrHtml='';
    var yrLabels=['今年','明年','后年'];
    (r.yearlyAdvice||[]).forEach(function(item,i){
      if(i>=3)return;
      yrHtml+='<div class="advice-card"><div class="yr">'+yrLabels[i]+' · '+item.year+'年</div>'+item.advice+'</div>';
    });

    // Dos & Donts
    var doHtml='',dontHtml='';
    (r.dosAndDonts.dos||[]).forEach(function(d){doHtml+='<li>'+d+'</li>';});
    (r.dosAndDonts.donts||[]).forEach(function(d){dontHtml+='<li>'+d+'</li>';});

    var html='<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n'
    +'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    +'<title>知时 · 合盘 · '+relLabel+'</title>\n'
    +'<style>'+css+'</style>\n</head>\n<body>\n'

    // 操作栏
    +'<div class="no-print">'
    +'<div class="toolbar">'
    +'<button onclick="window.print()">📄 保存为 PDF</button>'
    +'<button onclick="window.close()">✕ 关闭页面</button>'
    +'</div>'
    +'<p style="color:#8a8070;font-size:12px;margin-top:8px;letter-spacing:1px">点击「保存为 PDF」→ 目标另存为 PDF → 保存</p>'
    +'</div>\n'

    // 封面
    +'<div class="cover">\n'
    +'<div class="brand">知 时</div>\n'
    +'<div class="tagline">'+relLabel+'</div>\n'
    +'<div class="cover-divider"></div>\n'
    +'<div class="info">\n'
    +p1.name+' · '+gender1+' &nbsp;&nbsp;✦&nbsp;&nbsp; '+p2.name+' · '+gender2+'<br>\n'
    +'<span style="font-size:12px;color:#8a8070">分析日期：'+dateStr+'</span>\n'
    +'</div>\n</div>\n'

    // 各区块
    +'<div class="section"><div class="section-title">综合缘分评分</div><div class="section-body" style="text-align:center"><div class="score-ring"><span class="score-num">'+r.score.total+'</span></div><div class="score-label">'+r.score.label+'</div></div></div>\n'
    +'<div class="section break-before"><div class="section-title">'+p1.name+' 八字</div>'+baziRow(p1,gender1)+'</div>\n'
    +'<div class="section"><div class="section-title">'+p2.name+' 八字</div>'+baziRow(p2,gender2)+'</div>\n'
    +'<div class="section break-before"><div class="section-title">日干旺衰对比</div><div class="dgs-row"><div class="dgs-card"><div class="name">'+p1.name+'</div><div class="gan">'+p1.dayGan+'</div></div><div class="dgs-vs">VS</div><div class="dgs-card"><div class="name">'+p2.name+'</div><div class="gan">'+p2.dayGan+'</div></div></div><div class="section-body">'+(r.dayGanStrength?r.dayGanStrength.detail:'')+'</div></div>\n'
    +'<div class="section"><div class="section-title">双方命中相合与相克之处</div><div class="section-body">'+(crItems||'<p>无显著跨盘交互</p>')+'</div></div>\n'
    +'<div class="section"><div class="section-title">你们的相处密码</div><div class="section-body"><b>'+r.coreMode.title+'</b><br>'+r.coreMode.detail+'</div></div>\n'
    +'<div class="section break-before"><div class="section-title">未来三年关键节点</div><div class="advice-row">'+yrHtml+'</div></div>\n'
    +'<div class="section"><div class="section-title">专属宜忌指南</div><div class="dd-row"><div class="dd-col"><h4 class="do">✅ 宜</h4><ul>'+doHtml+'</ul></div><div class="dd-col"><h4 class="dont">⚠️ 忌</h4><ul>'+dontHtml+'</ul></div></div></div>\n'

    // 页脚
    +'<div class="footer">'
    +'<div class="footer-brand">知 时</div>'
    +'<div>合盘分析报告 · 数据生成于 '+dateStr+'</div>'
    +'<div>本报告仅供娱乐交流参考</div>'
    +'</div>\n'

    // 自动打印
    +'<script>setTimeout(function(){window.print();},800);<\/script>\n'
    +'</body>\n</html>';

    var w=window.open('','_blank','width=900,height=700');
    if(!w){alert('弹出窗口被拦截，请允许弹出窗口后重试。');return;}
    w.document.write(html);
    w.document.close();
  }

  // 暴露 download 到全局
  window.downloadHePanReport = downloadHePanReport;

  // =====================================================
  // SECTION 6: 主入口
  // =====================================================

  function main() {
    var params = getParams();

    // 1. 读取关系类型
    var relationType = params['type'] || '情侣';
    if (['夫妻','情侣','朋友'].indexOf(relationType) === -1) {
      relationType = '情侣';
    }

    // 2. 解析双方参数
    var p1Params = parsePersonParams(params, 'p1');
    var p2Params = parsePersonParams(params, 'p2');

    if (!p1Params || !p2Params) {
      showError('缺少必要参数，请从合盘页面重新提交。');
      return;
    }

    // 3. 检查依赖是否加载
    if (typeof calculateBaZi !== 'function') {
      showError('八字计算模块未加载，请刷新页面重试。');
      return;
    }
    if (typeof analyzeHePan !== 'function') {
      showError('合盘分析模块未加载，请刷新页面重试。');
      return;
    }

    try {
      // 4. 构建人物对象
      var person1 = buildPerson(
        '甲方',
        p1Params.year, p1Params.month, p1Params.day,
        p1Params.hour, p1Params.clock, p1Params.gender
      );

      var person2 = buildPerson(
        '乙方',
        p2Params.year, p2Params.month, p2Params.day,
        p2Params.hour, p2Params.clock, p2Params.gender
      );

      // 5. 执行合盘分析
      var result = analyzeHePan(person1, person2, relationType);

      // 6. 渲染结果
      renderAll(result, relationType, person1, person2);
      // v3.0: init hepan paywall
      if(typeof initHePanPaywall==='function') initHePanPaywall(person1, person2, relationType);

    } catch (err) {
      console.error('[hepan-result] 分析出错:', err);
      showError('分析过程出现错误，请稍后重试。<br/>错误详情：' + escapeHtml(err.message || String(err)));
    }
  }

  // =====================================================
  // SECTION 7: 启动
  // =====================================================

  // 等待 DOM 就绪后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
