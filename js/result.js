/**
 * 结果页面 v3 - 大运流年联动四柱表格
 */

const SHI_CHEN_NAMES = [
    '子时','丑时','寅时','卯时','辰时','巳时',
    '午时','未时','申时','酉时','戌时','亥时'
];
const SHI_CHEN_TIMES = [
    '23:00-01:00','01:00-03:00','03:00-05:00','05:00-07:00',
    '07:00-09:00','09:00-11:00','11:00-13:00','13:00-15:00',
    '15:00-17:00','17:00-19:00','19:00-21:00','21:00-23:00'
];
const POS_NAMES = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };

const WX_COLORS = {
    '金':'#FFD700','木':'#4CAF50','水':'#2196F3',
    '火':'#F44336','土':'#CD853F'
};

function getUrlParams() {
    const p = new URLSearchParams(window.location.search);
    var mode = p.get('mode') || '';
    var timing = mode === 'pillars' && p.get('timing') === 'matched' ? 'matched' : (mode === 'pillars' ? 'unknown' : '');
    var rawClock = p.get('clock') || '';
    var clockIsInteger = /^\d{1,2}$/.test(rawClock);
    var clockIsNumber = /^\d{1,2}(?:\.\d+)?$/.test(rawClock);
    var parsedClock = clockIsNumber && Number(rawClock) >= 0 && Number(rawClock) < 24
        ? Number(rawClock) : NaN;
    // 普通排盘的原始钟点一定是整数。历史订单中的小数钟点是已经
    // 校正过的真太阳时，恢复时不得再次校正。四柱反查仍只接受整数钟点。
    var restoredNormalizedClock = mode !== 'pillars' && Number.isFinite(parsedClock) && !clockIsInteger;
    return {
        year: parseInt(p.get('year')),
        month: parseInt(p.get('month')),
        day: parseInt(p.get('day')),
        hour: parseInt(p.get('hour')),
        gender: p.get('gender'),
        name: (p.get('name') || '').trim().slice(0, 20),
        cal: p.get('cal') || '',
        prov: p.get('prov') || '',
        city: p.get('city') || '',
        dist: p.get('dist') || '',
        geoVersion: p.get('geo_v') || '',
        minute: parseInt(p.get('minute')) || 0,
        clock: mode === 'pillars' && !clockIsInteger ? NaN : parsedClock,
        solar: p.get('solar') || '',
        zishi: p.get('zishi') || '',
        mode: mode,
        timing: timing,
        reportClockNormalized: p.get('report_clock_normalized') === '1' || restoredNormalizedClock,
        reportYear: p.get('report_year') ? parseInt(p.get('report_year')) : undefined,
        enteredPillars: mode === 'pillars' && window.PillarInput
            ? window.PillarInput.fromSearchParams(p)
            : null
    };
}

function isValidBirthClock(clock) {
    if (clock === null || clock === undefined || clock === '') return false;
    if (typeof clock === 'string' && !/^\d{1,2}$/.test(clock)) return false;
    var value = Number(clock);
    return Number.isInteger(value) && value >= 0 && value <= 23;
}

function isValidCalculatedClock(clock) {
    var value = Number(clock);
    return Number.isFinite(value) && value >= 0 && value < 24;
}

function buildResultData(params) {
    var isDirect = params.mode === 'pillars';
    var requestedTiming = !isDirect || params.timing === 'matched';
    var hasTiming = requestedTiming && (isDirect
        ? isValidBirthClock(params.clock)
        : isValidCalculatedClock(params.clock));
    var birthDate = hasTiming
        ? { year: params.year, month: params.month, day: params.day, hour: params.hour, clock: params.clock }
        : null;
    var bazi = isDirect
        ? window.BaZiCalculator.buildFromPillars(params.enteredPillars, params.gender, birthDate)
        : window.BaZiCalculator.calculate(
            params.year, params.month, params.day, params.hour, params.gender, params.clock,
            params.dayPillarOffset || 0
        );
    var daYun = hasTiming
        ? window.BaZiCalculator.calculateDaYun(
            bazi.month, bazi.year, params.gender,
            params.year, params.month, params.day, params.hour, params.clock
        )
        : null;

    return {
        bazi: bazi,
        daYun: daYun,
        shenSha: window.BaZiCalculator.calculateShenSha(bazi),
        hasTiming: hasTiming
    };
}

function applyTimingAvailability(hasTiming) {
    var dayunSection = document.querySelector('.section-dayun');
    var liunianSection = document.querySelector('.section-liunian');
    var notice = document.getElementById('timingLimitNotice');
    if (dayunSection) dayunSection.style.display = hasTiming ? '' : 'none';
    if (liunianSection) liunianSection.style.display = hasTiming ? '' : 'none';
    if (notice) notice.style.display = hasTiming ? 'none' : 'block';
}

// ==================== 全局状态 ====================
let _daYunData = null;
let _dayGan = null;
let _bazi = null;
let _currentDaYunIndex = -1;
let _currentLiuNianIndex = -1;
let _nativeShenSha = [];  // 四柱神煞
let _dayunShenSha = [];   // 大运柱神煞
let _liunianShenSha = []; // 流年柱神煞
let _params = null;       // URL参数（供后续函数使用）
let _reportIdentityParams = null; // 用户原始输入/历史订单身份，不参与二次真太阳时校正
let _reportYear = 0;      // 只读购买年份，不进入报告/订单身份
let _reportAnchorYear = 0;
let _reportPaidAt = '';
let _accountReportAccessResolved = false;
let _deepReportFacts = null;

function reportAnchorKey(params) {
    var key = {
        mode: params.mode || '', year: params.year, month: params.month, day: params.day,
        hour: params.hour, gender: params.gender, cal: params.cal || '',
        prov: params.prov || '', city: params.city || '', dist: params.dist || '',
        solarDataVersion: params.solarDataVersion || '',
        minute: params.minute || 0, clock: params.clock || 0,
        solar: params.solar || '', zishi: params.zishi || '', timing: params.timing || ''
    };
    if (params.enteredPillars) key.enteredPillars = params.enteredPillars;
    return JSON.stringify(key);
}

// ==================== 主渲染 ====================
function render(data) {
    const bazi = data.bazi;
    _bazi = bazi;  // 存储供 renderPaidContent 使用
    _deepReportFacts = null;
    const dayGan = bazi.day.gan;
    const currentYear = new Date().getFullYear();
    var isDirect = _params && _params.mode === 'pillars';
    var hasTiming = data.hasTiming !== false;
    applyTimingAvailability(hasTiming);

    // 顶部信息
    document.getElementById('genderLabel').textContent = bazi.gender === 'male' ? '乾造' : '坤造';
    document.getElementById('birthDateText').textContent = hasTiming
        ? `${bazi.birthDate.year}年${bazi.birthDate.month}月${bazi.birthDate.day}日`
        : '出生日期未定位';

    // 时辰显示：若经真太阳时调整后不同，标注原始北京时间
    var hourText = hasTiming
        ? `${SHI_CHEN_NAMES[bazi.birthDate.hour]}（${SHI_CHEN_TIMES[bazi.birthDate.hour]}）`
        : '四柱直排';
    if (isDirect && hasTiming) {
        hourText += ' <span style="font-size:10px;color:var(--text-dim)">四柱反查 · 起运按时辰中点估算</span>';
    } else if (hasTiming && bazi.originalHour !== undefined && bazi.originalHour !== bazi.birthDate.hour) {
        hourText += ' <span style="font-size:11px;color:var(--gold)">真太阳时</span>';
        hourText += ' <span style="font-size:10px;color:var(--text-dim)">原北京时间：' + SHI_CHEN_NAMES[bazi.originalHour] + '</span>';
    } else if (hasTiming && bazi.solarInfo && bazi.solarInfo.locationResolution) {
        hourText += bazi.solarInfo.locationResolution.estimated
            ? ' <span style="font-size:10px;color:var(--text-dim)">（经度按上级地区估算）</span>'
            : ' <span style="font-size:10px;color:var(--text-dim)">（县级经度已校正）</span>';
    }
    document.getElementById('birthHourText').innerHTML = hourText;
    document.getElementById('nayinText').textContent = bazi.naYin;

    if (hasTiming) {
        // 大运
        renderDaYun(data.daYun, dayGan, currentYear);

        // 流年（默认显示当前大运的流年）
        const currentDaYun = data.daYun.list.find(dy =>
            currentYear >= dy.startYear && currentYear <= dy.endYear
        ) || data.daYun.list[0];
        const currentDaYunIdx = data.daYun.list.indexOf(currentDaYun);
        _currentDaYunIndex = currentDaYunIdx;

        // 当前年份在流年中的索引
        const liuNianList = window.BaZiCalculator.calculateLiuNian(currentDaYun, dayGan);
        const currentLnIdx = liuNianList.findIndex(ln => ln.year === currentYear);
        _currentLiuNianIndex = currentLnIdx >= 0 ? currentLnIdx : 0;

        renderLiuNian(currentDaYun, dayGan, currentYear);

        // 更新表格中的大运/流年列
        updateDayunColumn(currentDaYunIdx);
        updateLiuNianColumn(currentDaYun, _currentLiuNianIndex);
    }

    // 四柱主盘（固定四柱）
    renderSiZhu(bazi, dayGan);

    _nativeShenSha = data.shenSha;




    // 滴天髓日主解析
    renderRiZhuJieXi(bazi.day.gan);
    // 真太阳时
    if (isDirect) {
        var solarTimeText = document.getElementById('solarTimeText');
        if (solarTimeText) solarTimeText.textContent = '四柱直排不使用真太阳时';
    } else {
        renderSolarTime(_params.year, _params.month, _params.day, _params.hour);
    }

    // 日主性格（大白话）
    var reportFacts=null;
    try{reportFacts=typeof BaZiCalculator!=='undefined'&&BaZiCalculator.getProfessionalReportFacts?BaZiCalculator.getProfessionalReportFacts(bazi,_params.gender):null}catch(e){console.log("reportFacts error:",e)}
    try{renderPillarAnalysis(bazi)}catch(e){console.log("pillarAnalysis error:",e)}
    try{renderDayMasterPower(bazi,reportFacts)}catch(e){console.log("dayMasterPower error:",e)}
    try{renderPattern(bazi,reportFacts)}catch(e){console.log("pattern error:",e)}
    try{renderYongJi(bazi,reportFacts)}catch(e){console.log("yongJi error:",e)}
    try{renderCharacter(bazi)}catch(e){console.log("character error:",e);document.getElementById("characterSection").innerHTML="<div class=drawer-body><p>性格数据加载中...</p></div>"}
    document.getElementById('characterSection').classList.add('drawer-open');

    // 父母关系
    try{renderParents(bazi, _params.gender)}catch(e){console.log("parents error:",e)}
    document.getElementById('parentsSection').classList.add('drawer-open');

    // 先初始化付费访问控制。正文只在确认解锁后生成，避免遮盖层、
    // 布局变化或移动端合成导致付费内容提前可见。
    initPaywall(_reportIdentityParams || _params);
    // 自动存储排盘数据到 localStorage，确保 AI 对话页总能获取到
    try {
      var d={birthInfo:{gender:_params.gender}};
      if(hasTiming){
        d.birthInfo.year=_params.year;d.birthInfo.month=_params.month;d.birthInfo.day=_params.day;d.birthInfo.hour=_params.hour;
      }
      if(isDirect){
        d.birthInfo.mode=_params.mode;d.birthInfo.timing=_params.timing;
      }
      if(_bazi){
        d.fourPillars={};
        ['year','month','day','hour'].forEach(function(p){
          if(_bazi[p])d.fourPillars[p]={gan:_bazi[p].gan,zhi:_bazi[p].zhi,ganWX:(_bazi[p].wuXing||{}).gan||'',zhiWX:(_bazi[p].wuXing||{}).zhi||'',nayin:_bazi[p].nayin||''};
        });
        if(_bazi.day&&_bazi.day.gan)d.dayMaster={gan:_bazi.day.gan,wuXing:(_bazi.day.wuXing||{}).gan||''};
        if(typeof BaZiCalculator!=='undefined'){
          try{d.dayMasterStrength=BaZiCalculator.calcDayMasterStrength(_bazi);if(_bazi._siLing)d.dayMasterStrength._siLing=_bazi._siLing;}catch(e){}
          try{d.renYuan=BaZiCalculator.getRenYuanEvidence(_bazi)}catch(e){}
          try{d.pattern=BaZiCalculator.getPattern(_bazi)}catch(e){}
          try{d.yongJi=BaZiCalculator.getYongJi(_bazi)}catch(e){}
        }
        // P3-A3 结构层（新增解释层，不覆盖不修改上述既有字段；两层不污染）
        if(typeof StructuralAnalysis!=='undefined'){
          try{
            var sa=StructuralAnalysis.evaluate(_bazi);
            d.relationEvents=sa.relationEvents;
            d.structuralRisks=sa.structuralRisks;
          }catch(e){}
        }
      }
      localStorage.setItem('ai_chart_data',JSON.stringify(d));
    }catch(e){console.log('auto-save chartData failed:',e)}
    if (window.PosterUI && window.BaZiCalculator.getPattern) {
      window.PosterUI.configure({
        bazi: _bazi,
        gender: _params.gender,
        pattern: window.BaZiCalculator.getPattern(_bazi)
      });
    }
}

// ---- 付费内容渲染：五个栏目只消费同一份深度报告事实 ----
function reportEsc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function reportText(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value)
            .replace(/事业\/家庭根基动摇/g, '事业或家庭安排可能调整')
            .replace(/根基动摇/g, '相关安排可能调整')
            .replace(/大凶/g, '高强度条件性波动')
            .replace(/谨防口舌官非、?工作变动、?与上级冲突/g, '沟通、工作节奏或上下级关系需留有调整空间')
            .replace(/变动冲突分离之象/g, '变动或边界议题')
            .replace(/暗中不利貌合神离/g, '隐性摩擦议题')
            .replace(/旧运已断新运未稳/g, '运势切换阶段')
            .replace(/必然|必定|一定会|肯定会/g, '在相关条件下可能')
            .replace(/灾祸|灾难/g, '高强度变化')
            .replace(/诉讼|官司|官非/g, '规则或沟通争议')
            .replace(/重病|患病|疾病/g, '身心状态需关注')
            .replace(/离婚|分手/g, '关系边界可能调整')
            .replace(/破财|亏损|损失/g, '资源波动')
            .replace(/死亡/g, '身心安全需关注');
    }
    if (Array.isArray(value)) return value.map(reportText).filter(Boolean).join('；');
    return reportText(value.text || value.conclusion || value.detail || value.label || value.name || '');
}

function reportRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(function(row) {
        if (typeof row === 'string' || typeof row === 'number') {
            return '<li><strong>依据</strong>：' + reportEsc(reportText(row)) + '</li>';
        }
        var label = row && (row.label || row.type || row.field || row.name) || '依据';
        var text = row && (row.text || row.conclusion || row.detail || row.evidence || row.why || row.parties || row.triggerHint) || '';
        return '<li><strong>' + reportEsc(reportText(label)) + '</strong>：' + reportEsc(reportText(text)) + '</li>';
    }).join('');
}

function reportConditions(value) {
    var rows = Array.isArray(value) ? value : [];
    if (!rows.length) return '';
    return '<div class="deep-report-conditions"><strong>条件与限制</strong><ul>' + reportRows(rows.map(function(row) { return { text: row }; })) + '</ul></div>';
}

function reportEvidence(value) {
    var rows = Array.isArray(value) ? value : [];
    if (!rows.length) return '';
    return '<div class="deep-report-evidence"><strong>依据</strong><ul>' + reportRows(rows) + '</ul></div>';
}

function reportCard(title, fact) {
    if (!fact) return '';
    var titleHtml = '<h3>' + reportEsc(reportText(title)) + '</h3>';
    var state = fact.state ? '<span class="deep-report-state">' + reportEsc(reportText(fact.state)) + '</span>' : '';
    var confidence = fact.confidence ? '<span class="deep-report-confidence">可信度：' + reportEsc(reportText(fact.confidence)) + '</span>' : '';
    var conclusion = fact.conclusion ? '<p>' + reportEsc(reportText(fact.conclusion)) + '</p>' : '';
    return '<article class="deep-report-card">' + titleHtml + state + confidence + conclusion + reportEvidence(fact.evidence) + reportConditions(fact.conditions) + '</article>';
}

function reportNarrative(narrative) {
    if (!narrative) return '';
    var grade = reportText(narrative.grade);
    var level = reportText(narrative.level);
    var difficulty = reportText(narrative.difficulty);
    var html = '';
    if (!narrative.hideScore) {
        html += '<div class="deep-report-overview deep-report-verdict">';
        if (grade) html += '<strong class="deep-report-grade">' + reportEsc(grade) + '</strong>';
        if (level) html += '<span class="deep-report-level">' + reportEsc(level) + '</span>';
        if (difficulty) html += '<span class="deep-report-difficulty">' + reportEsc(difficulty) + '</span>';
        html += '</div>';
    }
    html += '<article class="deep-report-card deep-report-narrative">';
    if (narrative.headline) html += '<h3>' + reportEsc(reportText(narrative.headline)) + '</h3>';
    if (narrative.painPoint) html += '<p class="deep-report-pain-point">' + reportEsc(reportText(narrative.painPoint)) + '</p>';
    if (Array.isArray(narrative.verdicts) && narrative.verdicts.length) {
        html += '<div class="deep-report-verdict-list">' + narrative.verdicts.map(function(verdict) {
            var sourceText = reportText(verdict.sourceText);
            var outcomeText = reportText(verdict.outcomeText || verdict.text);
            var body = '';
            if (sourceText) body += '<p class="deep-report-verdict-source">命理依据：' + reportEsc(sourceText) + '</p>';
            if (outcomeText) body += '<p class="deep-report-verdict-outcome">' + reportEsc(outcomeText) + '</p>';
            return '<section class="deep-report-verdict-item"><h4>' + reportEsc(reportText(verdict.title)) + '</h4>' + body + '</section>';
        }).join('') + '</div>';
    }
    (Array.isArray(narrative.paragraphs) ? narrative.paragraphs : []).forEach(function(paragraph) {
        if (reportText(paragraph)) html += '<p>' + reportEsc(reportText(paragraph)) + '</p>';
    });
    if (narrative.note) html += '<p class="deep-report-note">' + reportEsc(reportText(narrative.note)) + '</p>';
    return html + '</article>';
}

function reportTriggerKeys(row) {
    var keys = [];
    if (row == null) return keys;
    if (typeof row !== 'object') {
        var primitive = reportText(row).replace(/\s+/g, '').trim();
        return primitive ? ['text:' + primitive] : [];
    }
    ['id', 'key', 'uid', 'eventId', 'eventKey'].forEach(function(field) {
        if (row[field] != null && row[field] !== '') keys.push(field + ':' + String(row[field]));
    });
    var mainText = reportText(row.detail || row.conclusion || row.text || row.summary || row.desc || row.why || row);
    if (mainText) keys.push('text:' + mainText.replace(/\s+/g, '').trim());
    var structured = ['type', 'relation', 'sourcePillar', 'targetPillar', 'source', 'target'].map(function(field) {
        return reportText(row[field]);
    }).filter(Boolean).join('|');
    if (structured && mainText) keys.push('structured:' + structured + '|' + mainText.replace(/\s+/g, '').trim());
    ['evidence', 'conditions'].forEach(function(field) {
        (Array.isArray(row[field]) ? row[field] : []).forEach(function(child) {
            keys = keys.concat(reportTriggerKeys(child));
        });
    });
    return keys.filter(function(key, index, rows) { return rows.indexOf(key) === index; });
}

function reportOverallTriggers(title, facts) {
    var seen = {};
    var domainRows = [];
    ['career', 'wealth', 'relationship', 'study'].forEach(function(domain) {
        var fact = facts && facts[domain] || {};
        domainRows = domainRows.concat(Array.isArray(fact.evidence) ? fact.evidence : []);
        if (fact.timing && Array.isArray(fact.timing.activation)) domainRows = domainRows.concat(fact.timing.activation);
    });
    domainRows = domainRows.concat(Array.isArray(facts && facts.triggeredRisks) ? facts.triggeredRisks : []);
    domainRows.forEach(function(row) {
        reportTriggerKeys(row).forEach(function(key) { seen[key] = true; });
    });
    var rows = (Array.isArray(facts && facts.overallTriggers) ? facts.overallTriggers : []).filter(function(row) {
        var keys = reportTriggerKeys(row);
        if (!keys.length || keys.some(function(key) { return seen[key]; })) return false;
        keys.forEach(function(key) { seen[key] = true; });
        return true;
    });
    if (!rows.length) return '';
    return '<article class="deep-report-card deep-report-overall-triggers"><h3>' + reportEsc(title) + '</h3>'
        + '<p>以下仅表示原局与年度节点出现互动，需结合领域事实、现实条件与可执行安排观察。</p>'
        + '<ul>' + reportRows(rows) + '</ul></article>';
}

function reportWealthQuality(quality) {
    if (!quality) return '';
    function joined(rows, fallback) {
        rows = Array.isArray(rows) ? rows.filter(function(row) { return reportText(row); }) : [];
        return rows.length ? rows.map(reportText).join('；') : fallback;
    }
    var season = quality.season || {};
    var seasonEvidence = joined(season.evidence, '未见进一步月令证据');
    var rows = [
        { label: '月令与季节', text: (reportText(season.state) || '月令关系未定') + '；' + seasonEvidence },
        { label: '根气', text: joined(quality.roots, '未见明确财星根气证据') },
        { label: '生源', text: joined(quality.sources, '未见明确财星生源证据') },
        { label: '受制', text: joined(quality.restraints, '未见权威财星受制证据') },
        { label: '关系质量', text: joined(quality.relationships, '未见权威财星关系事件') },
        { label: '不确定性', text: reportText(quality.uncertainty) || '现有权威关系证据有限，相关质量保持不确定。' },
    ];
    return reportCard('资源质量依据', {
        confidence: rows.length ? 'medium' : 'limited',
        conclusion: rows.length ? '资源质量按月令、根气、生源与结构关系分项呈现，不另设强弱分数。' : '资源质量证据不足，保持不确定。',
        evidence: rows,
    });
}

function openPaidSection(id) {
    var section = document.getElementById(id);
    if (!section) return;
    section.classList.add('drawer-open');
    section.style.display = 'block';
}

function renderDeepReportError(message) {
    var html = '<div class="deep-report-error"><strong>专业报告暂时无法生成</strong><p>' + reportEsc(message || '请稍后重试。') + '</p><button type="button" onclick="renderPaidContent()">重试</button></div>';
    ['thisYearContent', 'marriageContent', 'wealthContent', 'studyContent', 'fortuneContent'].forEach(function(id) {
        var node = document.getElementById(id);
        if (node) node.innerHTML = html;
    });
    ['thisYearSection', 'marriageSection', 'wealthSection', 'studySection', 'fortuneSection'].forEach(openPaidSection);
}

function resolveDeepReportAnchor(params) {
    var anchor = typeof window !== 'undefined' && window.DeepReportAnchor;
    if (anchor && typeof anchor.resolve === 'function') {
        if (_reportPaidAt) {
            return anchor.resolve({ paidAt: _reportPaidAt, chartKey: reportAnchorKey(params || {}), storage: window.localStorage });
        }
        var resolved = Number(_reportAnchorYear);
        if (resolved >= 1900 && resolved <= 2200) return resolved;
        return anchor.resolve({ chartKey: reportAnchorKey(params || {}), storage: window.localStorage });
    }
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()));
}

function applyAuthenticatedReportAccess(data) {
    data = data || {};
    _accountReportAccessResolved = true;
    _reportPaidAt = data.unlocked && data.paid_at ? String(data.paid_at) : '';
    _reportAnchorYear = 0;
    _reportAnchorYear = resolveDeepReportAnchor(_params || {});
    _deepReportFacts = null;
    // 未解锁时不得提前把付费正文写进 DOM。
    if (data.unlocked) renderPaidContent();
}

function renderDeepCurrentYear(facts) {
    var node = document.getElementById('thisYearContent');
    if (!node) return;
    if (facts && facts.narrative) {
        node.innerHTML = reportNarrative(facts.narrative);
        openPaidSection('thisYearSection');
        return;
    }
    var year = facts && facts.year ? reportEsc(facts.year) : '';
    var pillar = facts && (facts.pillar || facts.yearPillar) || {};
    var html = '<div class="deep-report-overview"><strong>' + year + '年</strong> · ' + reportEsc(reportText(pillar.gan) + reportText(pillar.zhi)) + '</div>';
    html += reportCard('事业与节奏', facts && facts.career);
    html += reportCard('本年财富激活', facts && facts.wealth);
    html += reportCard('关系议题', facts && facts.relationship);
    html += reportCard('学习安排', facts && facts.study);
    html += reportCard('身心管理', facts && facts.wellbeing);
    html += reportOverallTriggers('综合变化', facts);
    html += reportCard('实际触发风险', { evidence: facts && facts.triggeredRisks, conditions: facts && facts.reliefs });
    node.innerHTML = html;
    openPaidSection('thisYearSection');
}

function renderDeepRelationship(facts) {
    var node = document.getElementById('marriageContent');
    if (!node) return;
    if (facts && facts.narrative) {
        node.innerHTML = reportNarrative(facts.narrative);
        openPaidSection('marriageSection');
        return;
    }
    var html = reportCard('夫妻宫互动', facts && facts.interaction);
    var palace = facts && facts.palace || {};
    var hiddenRows = (palace.hiddenTenGods || []).map(function(item) {
        return { label: item.layer || '藏干', text: reportText(item.gan) + ' · ' + reportText(item.role) };
    });
    html += reportCard('夫妻宫藏干与十神', {
        confidence: hiddenRows.length ? 'medium' : 'limited',
        conclusion: palace.zhi ? '日支' + reportText(palace.zhi) + '为' + reportText(palace.element) + '，在冻结喜忌中属于' + reportText(palace.elementRole || '中性') + '。' : '夫妻宫藏干证据不足。',
        evidence: hiddenRows,
    });
    html += reportCard('配偶星证据', facts && facts.spouseStar);
    var quality = facts && facts.spouseStar && facts.spouseStar.quality || {};
    html += reportCard('配偶星质量', {
        confidence: facts && facts.spouseStar && facts.spouseStar.occurrences && facts.spouseStar.occurrences.length ? 'medium' : 'limited',
        conclusion: [quality.visibility, quality.strengthTendency, typeof quality.rooted === 'boolean' ? (quality.rooted ? '有根气证据' : '根气证据不足') : '', quality.rolePurity, quality.elementRole].filter(Boolean).join('；') || '配偶星质量证据不足，保持低可信度。',
        evidence: facts && facts.spouseStar && facts.spouseStar.evidence,
    });
    html += reportCard('日柱关系事件', {
        confidence: palace.dayInvolvingEvents && palace.dayInvolvingEvents.length ? 'medium' : 'limited',
        conclusion: palace.dayInvolvingEvents && palace.dayInvolvingEvents.length ? '以下事件只表示日柱或夫妻宫议题被牵动，不直接定关系结果。' : '未见权威日柱关系事件。',
        evidence: palace.dayInvolvingEvents || palace.relationEvents || [],
    });
    html += reportCard('条件性结构风险', {
        confidence: palace.risks && palace.risks.length ? 'medium' : 'limited',
        conclusion: palace.risks && palace.risks.length ? '结构风险需在相关条件被引动时观察，并结合救应与现实边界。' : '未见涉及日柱的已登记结构风险。',
        evidence: palace.risks || [],
        conditions: palace.risks && palace.risks.length ? ['不把条件性风险解释为必然关系结果'] : [],
    });
    html += reportCard('远近倾向', facts && facts.distance);
    html += reportCard('年龄远近倾向', facts && facts.age);
    html += reportCard('外在气质参考', facts && facts.appearance);
    html += reportCard('稳定性与限制', facts && facts.stability);
    node.innerHTML = html;
    openPaidSection('marriageSection');
}

function renderDeepWealth(facts) {
    var node = document.getElementById('wealthContent');
    if (!node) return;
    if (facts && facts.narrative) {
        var wealthNarrative = Object.assign({}, facts.narrative, { level: '', difficulty: '' });
        node.innerHTML = reportNarrative(wealthNarrative);
        openPaidSection('wealthSection');
        return;
    }
    var html = '<div class="deep-report-overview"><strong>资源承接：' + reportEsc(facts && facts.summaryLevel) + '</strong></div>';
    html += reportCard('资源质量', facts && facts.resource);
    html += reportWealthQuality(facts && facts.resource && facts.resource.quality);
    html += reportCard('承载能力', facts && facts.capacity);
    html += '<article class="deep-report-card"><h3>转化路径</h3><ul>' + reportRows(facts && facts.pathways) + '</ul></article>';
    html += reportCard('留存与风险', facts && facts.retention);
    html += reportCard('库气与引动', facts && facts.storage);
    html += reportEvidence(facts && facts.evidence);
    node.innerHTML = html;
    openPaidSection('wealthSection');
}

function renderDeepStudy(facts) {
    var node = document.getElementById('studyContent');
    if (!node) return;
    if (facts && facts.narrative) {
        node.innerHTML = reportNarrative(facts.narrative);
        openPaidSection('studySection');
        return;
    }
    var html = reportCard('吸收理解', facts && facts.absorption);
    html += reportCard('表达输出', facts && facts.expression);
    html += reportCard('纪律应试', facts && facts.discipline);
    html += reportCard('实践转化', facts && facts.application);
    html += reportCard('学习路径：' + reportText(facts && facts.path && facts.path.type), facts && facts.path);
    var chainLabels = {
        sha_yin: '杀印相生链', wealth_regulates_seal: '财制印链', food_controls_sha: '食神制杀链',
        yangren_output: '羊刃输出链', learning_pressure: '学习压力链'
    };
    html += '<div class="deep-report-study-chains">' + ((facts && facts.chains) || []).map(function(chain) {
        var roleEvidence = Object.keys(chain.elementRoles || {}).map(function(key) {
            return { label: '元素角色', text: key + '：' + reportText(chain.elementRoles[key]) };
        });
        return reportCard(chainLabels[chain.id] || chain.id || '学习证据链', {
            state: chain.present ? '已识别' : '证据不足',
            confidence: chain.confidence || 'limited',
            conclusion: chain.conclusion,
            evidence: (chain.evidence || []).concat(roleEvidence),
            conditions: (chain.blockers || []).concat(chain.conditions || []),
        });
    }).join('') + '</div>';
    html += '<article class="deep-report-card"><h3>辅助提示</h3><ul>' + reportRows(facts && facts.auxiliary) + '</ul></article>';
    html += '<article class="deep-report-card"><h3>障碍与建议</h3><ul>' + reportRows(facts && facts.obstacles) + '</ul></article>';
    node.innerHTML = html;
    openPaidSection('studySection');
}

function renderDeepFiveYear(facts) {
    var node = document.getElementById('fortuneContent');
    if (!node) return;
    if (facts && facts.narrative) {
        node.innerHTML = reportNarrative(facts.narrative);
        openPaidSection('fortuneSection');
        return;
    }
    var html = '<div class="deep-report-overview"><strong>五年观察：' + reportEsc(facts && facts.anchorYear) + '—' + reportEsc(Number(facts && facts.anchorYear) + 4) + '</strong></div>';
    html += reportCard('整体趋势', facts && facts.trend);
    if (facts && facts.limitation) html += '<p class="deep-report-limitation">' + reportEsc(facts.limitation) + '</p>';
    html += '<div class="deep-report-years">' + ((facts && facts.years) || []).map(function(year) {
        var pillar = year.pillar || year.yearPillar || {};
        var card = '<article class="deep-report-year"><h3>' + reportEsc(year.year) + '年 · ' + reportEsc(reportText(pillar.gan) + reportText(pillar.zhi)) + '</h3>';
        card += reportCard('事业', year.career);
        card += reportCard('财富激活', year.wealth);
        card += reportCard('关系', year.relationship);
        card += reportCard('学习', year.study);
        card += reportOverallTriggers('原局互动', year);
        card += reportEvidence(year.triggeredRisks);
        return card + '</article>';
    }).join('') + '</div>';
    node.innerHTML = html;
    openPaidSection('fortuneSection');
}

function renderPaidContent() {
    if (!_bazi || !_params) {
        renderDeepReportError('请刷新页面后重试。');
        return;
    }
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn() && !_accountReportAccessResolved) return;
    try {
        if (!_deepReportFacts) {
            if (!window.DeepReport || typeof window.DeepReport.buildFacts !== 'function') throw new Error('缺少深度报告事实模块');
            var anchorYear = resolveDeepReportAnchor(_params);
            _deepReportFacts = window.DeepReport.buildFacts(_bazi, _params.gender, { anchorYear: anchorYear });
        }
        renderDeepCurrentYear(_deepReportFacts.currentYear);
        renderDeepRelationship(_deepReportFacts.relationship);
        renderDeepWealth(_deepReportFacts.wealth);
        renderDeepStudy(_deepReportFacts.study);
        renderDeepFiveYear(_deepReportFacts.fiveYear);
    } catch (error) {
        console.error('[deep-report]', error);
        _deepReportFacts = null;
        renderDeepReportError('请稍后重试。');
    }
}

// ==================== 大运渲染 ====================
function renderDaYun(daYunData, dayGan, currentYear) {
    const table = document.getElementById('dayunTable');
    const dirLabel = daYunData.isForward ? '顺行' : '逆行';

    const ti = daYunData.timingInfo || {};
    const timingStr = (ti.years > 0 ? ti.years + '年' : '') + ti.months + '个月' + ti.days + '天';
    const jqName = daYunData.targetJieQi ? '（距' + daYunData.targetJieQi + '）' : '';
    document.getElementById('dayunDirection').innerHTML =
        dirLabel + ' · 出生后' + timingStr + '0时起运' + jqName +
        '<br><small style="color:var(--text-dim)">大运虚岁标签：' + daYunData.list[0]?.displayAge + '岁起</small>';

    let html = '';
    daYunData.list.forEach((dy, i) => {
        const isCurrent = currentYear >= dy.startYear && currentYear <= dy.endYear;
        const isPast = currentYear > dy.endYear;
        const cls = isCurrent ? 'current' : (isPast ? 'past' : '');
        const ss = window.BaZiCalculator.getShiShen(dayGan, dy.gan);

        html += `
        <div class="dayun-col ${cls}" data-index="${i}"
             onclick="showLiuNian(${i})">
            <div class="dayun-age">${dy.displayAge}岁</div>
            <div class="dayun-gz"><span style="color:${WX_COLORS[window.BaZiCalculator.WU_XING[dy.gan]]}">${dy.gan}</span><span style="color:${WX_COLORS[window.BaZiCalculator.DI_ZHI_WU_XING[dy.zhi]]}">${dy.zhi}</span></div>
            <div class="dayun-ss">${ss}</div>
        </div>`;
    });
    table.innerHTML = html;

    // 高亮当前大运
    setTimeout(() => {
        const currentCol = table.querySelector('.current');
        if (currentCol) {
            currentCol.classList.add('active');
            currentCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, 300);
}

// ==================== 流年渲染 ====================
function showLiuNian(daYunIndex) {
    if (!_daYunData || !_dayGan) return;
    const dy = _daYunData.list[daYunIndex];
    const currentYear = new Date().getFullYear();

    // 高亮选中的大运
    document.querySelectorAll('.dayun-col').forEach((col, i) => {
        col.classList.toggle('active', i === daYunIndex);
    });

    _currentDaYunIndex = daYunIndex;
    _currentLiuNianIndex = -1; // 重置流年选中

    renderLiuNian(dy, _dayGan, currentYear);

    // 更新表格中的大运列
    updateDayunColumn(daYunIndex);

    // 清空流年列（等待用户点击流年）
    clearLiuNianColumn();
}

function renderLiuNian(daYunItem, dayGan, currentYear) {
    const table = document.getElementById('liunianTable');
    document.getElementById('liunianRange').textContent =
        `${daYunItem.startYear}-${daYunItem.endYear}年（${daYunItem.displayAge}岁）`;

    const liuNianList = window.BaZiCalculator.calculateLiuNian(daYunItem, dayGan);

    let html = '';
    liuNianList.forEach((ln, i) => {
        const isCurrent = ln.year === currentYear;
        const isPast = ln.year < currentYear;
        const cls = isCurrent ? 'current-year' : (isPast ? 'past-year' : '');

        html += `
        <div class="liunian-col ${cls}" data-index="${i}"
             onclick="selectLiuNian(${i})">
            <div class="liunian-year-label">${ln.year}年</div>
            <div class="liunian-gz"><span style="color:${WX_COLORS[window.BaZiCalculator.WU_XING[ln.gan]]}">${ln.gan}</span><span style="color:${WX_COLORS[window.BaZiCalculator.DI_ZHI_WU_XING[ln.zhi]]}">${ln.zhi}</span></div>
            <div class="liunian-ss">${ln.shiShen}</div>
        </div>`;
    });
    table.innerHTML = html;

    // 滚动到当前年份
    setTimeout(() => {
        const cur = table.querySelector('.current-year');
        if (cur) {
            cur.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            // 自动选中当前年份
            const idx = parseInt(cur.getAttribute('data-index'));
            selectLiuNian(idx);
        }
    }, 200);
}

// 点击流年 - 更新表格中的流年列
function selectLiuNian(liuNianIndex) {
    if (!_daYunData || !_dayGan) return;
    const daYunItem = _daYunData.list[_currentDaYunIndex];
    if (!daYunItem) return;

    _currentLiuNianIndex = liuNianIndex;

    // 高亮选中的流年
    document.querySelectorAll('.liunian-col').forEach((col, i) => {
        col.classList.toggle('active-ln', i === liuNianIndex);
    });

    // 更新表格中的流年列
    updateLiuNianColumn(daYunItem, liuNianIndex);
}

// ==================== 四柱主盘渲染 ====================
function renderSiZhu(bazi, dayGan) {
    const positions = ['year', 'month', 'day', 'hour'];

    positions.forEach(pos => {
        const pillar = bazi[pos];

        // 天干
        const ganEl = document.getElementById(`gan-${pos}`);
        ganEl.textContent = pillar.gan;
        ganEl.style.color = WX_COLORS[pillar.wuXing.gan];

        // 地支
        const zhiEl = document.getElementById(`zhi-${pos}`);
        zhiEl.textContent = pillar.zhi;
        zhiEl.style.color = WX_COLORS[pillar.wuXing.zhi];

        // 十神 - 天干
        if (pos !== 'day') {
            document.getElementById(`ss-${pos}-gan`).textContent = pillar.shiShen.gan;
        }

        // 藏干与副星分行展示，二者按相同顺序逐项对应。
        const cangEl = document.getElementById(`cang-${pos}`);
        const cangItems = pillar.cangGan.map(gan => {
            const wx = window.BaZiCalculator.WU_XING[gan];
            return `<span class="cang-gan-char" style="color:${WX_COLORS[wx]}">${gan}</span>`;
        });
        cangEl.innerHTML = cangItems.join('');

        const fuXingEl = document.getElementById(`ss-${pos}-zhi`);
        fuXingEl.innerHTML = pillar.cangGan
            .map(gan => `<span class="fuxing-entry">${window.BaZiCalculator.getShiShen(dayGan, gan)}</span>`)
            .join('');
    });
}

// ==================== 表格大运列更新 ====================
function updateDayunColumn(daYunIndex) {
    if (!_daYunData || !_dayGan) return;
    const dy = _daYunData.list[daYunIndex];
    if (!dy) return;

    // 获取所有大运列元素
    const dayunCols = document.querySelectorAll('.pp-dayun-col');

    // 添加/移除高亮
    dayunCols.forEach(col => {
        col.classList.add('active-dayun');
    });

    // 天干
    const ganEl = document.getElementById('gan-dayun');
    ganEl.textContent = dy.gan;
    const dyWxGan = window.BaZiCalculator.WU_XING[dy.gan];
    ganEl.style.color = WX_COLORS[dyWxGan];

    // 地支
    const zhiEl = document.getElementById('zhi-dayun');
    zhiEl.textContent = dy.zhi;
    const dyWxZhi = window.BaZiCalculator.DI_ZHI_WU_XING[dy.zhi];
    zhiEl.style.color = WX_COLORS[dyWxZhi];

    // 十神（天干）
    const ssGanEl = document.getElementById('ss-dayun-gan');
    ssGanEl.innerHTML = `<span class="pp-ss-text">${window.BaZiCalculator.getShiShen(_dayGan, dy.gan)}</span>`;

    // 藏干与副星
    const cangGan = window.BaZiCalculator.getCangGan(dy.zhi);
    const ssZhiEl = document.getElementById('ss-dayun-zhi');
    ssZhiEl.innerHTML = cangGan
        .map(gan => `<span class="fuxing-entry">${window.BaZiCalculator.getShiShen(_dayGan, gan)}</span>`)
        .join('');

    const cangEl = document.getElementById('cang-dayun');
    const cangItems = cangGan.map(gan => {
        const wx = window.BaZiCalculator.WU_XING[gan];
        return `<span class="cang-gan-char" style="color:${WX_COLORS[wx]}">${gan}</span>`;
    });
    cangEl.innerHTML = cangItems.join('');

    // 神煞 - 计算大运柱的神煞
    updateColumnShenSha('dayun', dy);
}

// ==================== 表格流年列更新 ====================
function updateLiuNianColumn(daYunItem, liuNianIndex) {
    if (!_daYunData || !_dayGan) return;

    const liuNianList = window.BaZiCalculator.calculateLiuNian(daYunItem, _dayGan);
    const ln = liuNianList[liuNianIndex];
    if (!ln) return;

    // 高亮流年列
    const liunianCols = document.querySelectorAll('.pp-liunian-col');
    liunianCols.forEach(col => {
        col.classList.add('active-liunian');
    });

    // 天干
    const ganEl = document.getElementById('gan-liunian');
    ganEl.textContent = ln.gan;
    const lnWxGan = window.BaZiCalculator.WU_XING[ln.gan];
    ganEl.style.color = WX_COLORS[lnWxGan];

    // 地支
    const zhiEl = document.getElementById('zhi-liunian');
    zhiEl.textContent = ln.zhi;
    const lnWxZhi = window.BaZiCalculator.DI_ZHI_WU_XING[ln.zhi];
    zhiEl.style.color = WX_COLORS[lnWxZhi];

    // 十神（天干）
    const ssGanEl = document.getElementById('ss-liunian-gan');
    ssGanEl.innerHTML = `<span class="pp-ss-text">${ln.shiShen}</span>`;

    // 藏干与副星
    const cangGan = window.BaZiCalculator.getCangGan(ln.zhi);
    const ssZhiEl = document.getElementById('ss-liunian-zhi');
    ssZhiEl.innerHTML = cangGan
        .map(gan => `<span class="fuxing-entry">${window.BaZiCalculator.getShiShen(_dayGan, gan)}</span>`)
        .join('');

    const cangEl = document.getElementById('cang-liunian');
    const cangItems = cangGan.map(gan => {
        const wx = window.BaZiCalculator.WU_XING[gan];
        return `<span class="cang-gan-char" style="color:${WX_COLORS[wx]}">${gan}</span>`;
    });
    cangEl.innerHTML = cangItems.join('');

    // 神煞 - 计算流年柱的神煞
    updateColumnShenSha('liunian', ln);
}

// 清空流年列
function clearLiuNianColumn() {
    const liunianCols = document.querySelectorAll('.pp-liunian-col');
    liunianCols.forEach(col => col.classList.remove('active-liunian'));

    document.getElementById('gan-liunian').textContent = '—';
    document.getElementById('gan-liunian').style.color = 'var(--text-dim)';
    document.getElementById('zhi-liunian').textContent = '—';
    document.getElementById('zhi-liunian').style.color = 'var(--text-dim)';
    document.getElementById('ss-liunian-gan').innerHTML = '<span style="color:var(--text-dim)">—</span>';
    document.getElementById('ss-liunian-zhi').innerHTML = '<span style="color:var(--text-dim)">—</span>';
    document.getElementById('cang-liunian').innerHTML = '<span style="color:var(--text-dim)">—</span>';
    document.getElementById('shensha-liunian').innerHTML = '<span style="color:var(--text-dim)">—</span>';

    // 清空流年神煞并刷新
    refreshShenShaDetail();
}

// ==================== 列神煞计算 ====================
function updateColumnShenSha(colType, pillarData) {
    const el = document.getElementById(`shensha-${colType}`);
    if (!el || !_bazi) return;

    const PI = pillarData;
    const pGanIdx = PI.ganIndex !== undefined ? PI.ganIndex : window.BaZiCalculator.TIAN_GAN.indexOf(PI.gan);
    const pZhiIdx = PI.zhiIndex !== undefined ? PI.zhiIndex : window.BaZiCalculator.DI_ZHI.indexOf(PI.zhi);
    const pPillar = { gan: PI.gan, zhi: PI.zhi, ganIndex: pGanIdx, zhiIndex: pZhiIdx };

    // 方法1：虚拟bazi，大运/流年放hour位置 → 查年/月/日支相关的神煞
    const virtualBazi = {
        year: _bazi.year, month: _bazi.month, day: _bazi.day,
        hour: pPillar, gender: _bazi.gender
    };
    const all1 = window.BaZiCalculator.calculateShenSha(virtualBazi);
    const dayunShenSha1 = all1.filter(ss => ss.positions.includes('hour'));

    // 方法2：虚拟bazi，大运/流年放day位置 → 查空亡等日柱相关神煞
    const virtualBazi2 = {
        year: _bazi.year, month: _bazi.month,
        day: pPillar,
        hour: _bazi.hour,
        gender: _bazi.gender
    };
    // 只取空亡（它用日柱计算旬空）
    const all2 = window.BaZiCalculator.calculateShenSha(virtualBazi2);
    const dayunShenSha2 = all2.filter(ss => ss.name === '空亡' && ss.positions.includes('day'));

    // 合并去重（按name去重）
    const merged = [...dayunShenSha1];
    dayunShenSha2.forEach(ss => {
        if (!merged.find(m => m.name === ss.name)) {
            merged.push(ss);
        }
    });

    // 重命名position
    const posNameMap = { dayun: '大运', liunian: '流年' };
    const renamed = merged.map(ss => ({
        ...ss,
        positions: [colType],
        posText: `见于${posNameMap[colType]}`
    }));

    // 存储
    if (colType === 'dayun') { _dayunShenSha = renamed; }
    else { _liunianShenSha = renamed; }

    // 填充表格单元格
    if (merged.length === 0) {
        el.innerHTML = '<span style="color:var(--text-dim)">—</span>';
    } else {
        el.innerHTML = merged.map(ss =>
            `<span class="shensha-tag ${ss.type}">${ss.name}</span>`
        ).join('');
    }

    // 刷新神煞详解
    refreshShenShaDetail();
}

// ==================== 神煞渲染 ====================
function renderShenSha() {
    // 1. 在四柱表格中显示神煞标签（仅用原生四柱神煞）
    const posMap = { year: [], month: [], day: [], hour: [] };
    _nativeShenSha.forEach(ss => {
        ss.positions.forEach(pos => {
            posMap[pos].push({ name: ss.name, type: ss.type });
        });
    });

    ['year', 'month', 'day', 'hour'].forEach(pos => {
        const el = document.getElementById(`shensha-${pos}`);
        if (posMap[pos].length === 0) {
            el.innerHTML = '<span style="color:var(--text-dim)">—</span>';
        } else {
            el.innerHTML = posMap[pos].map(ss =>
                `<span class="shensha-tag ${ss.type}">${ss.name}</span>`
            ).join('');
        }
    });

    // 2. 刷新折叠面板
    refreshShenShaDetail();
}

// 合并所有神煞（四柱+大运+流年）并更新accordion
function refreshShenShaDetail() {
    const accordion = document.getElementById('shenshaAccordion');
    if (!accordion) return;

    // 合并所有神煞：四柱 + 大运 + 流年
    const allList = [..._nativeShenSha, ..._dayunShenSha, ..._liunianShenSha];

    if (allList.length === 0) {
        accordion.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-dim);font-size:13px">命局清净，暂无特殊神煞</div>';
        return;
    }

    // 更新计数
    var countEl=document.getElementById('shenshaCount');if(!countEl)return;
    if (countEl) countEl.textContent = '（共' + allList.length + '项）';

    // 按类型排序：吉神 > 中性 > 凶煞
    const typeOrder = { 'ji-shen': 0, 'zhong': 1, 'ji': 2 };
    const sorted = [...allList].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

    const typeLabels = { 'ji-shen': '吉神', 'zhong': '中性', 'ji': '凶煞' };
    const groupNames = { 'ji-shen': '吉神', 'zhong': '中性', 'ji': '凶煞' };

    let html = '';
    let lastType = '';

    sorted.forEach((ss, index) => {
        if (ss.type !== lastType) {
            html += `<div class="ss-group-header">${groupNames[ss.type]}</div>`;
            lastType = ss.type;
        }

        html += `
        <div class="ss-accordion-item" data-index="${index}">
            <div class="ss-accordion-header" onclick="toggleAccordion(this)">
                <span class="ss-accordion-arrow">▶</span>
                <span class="ss-accordion-type-badge ${ss.type}">${typeLabels[ss.type]}</span>
                <span class="ss-accordion-name">${ss.name}</span>
                <span class="ss-accordion-pos">${ss.posText}</span>
            </div>
            <div class="ss-accordion-body">
                <div class="ss-accordion-content">${ss.desc}</div>
            </div>
        </div>`;
    });

    accordion.innerHTML = html;
}

// 折叠面板切换
function toggleAccordion(header) {
    const item = header.parentElement;
    const isOpen = item.classList.contains('open');

    // 关闭所有
    document.querySelectorAll('.ss-accordion-item.open').forEach(el => {
        el.classList.remove('open');
    });

    // 如果之前没打开，则打开当前
    if (!isOpen) {
        item.classList.add('open');
    }
}

// ==================== 五行渲染 ====================
function renderWuXing(wuXingCount) {
window._wuxingData=wuXingCount;var c=document.querySelector(".section-wuxing .drawer-body")||document.querySelector(".section-wuxing");if(c&&!document.getElementById("wuxingCanvas")){var cv=document.createElement("canvas");cv.id="wuxingCanvas";cv.style.cssText="display:block;margin:16px auto;width:220px;height:220px";c.insertBefore(cv,c.firstChild);setTimeout(function(){if(window.drawWuxingRing)drawWuxingRing("wuxingCanvas",wuXingCount)},500)};    const wxMap = { '金':'jin','木':'mu','水':'shui','火':'huo','土':'tu' };
    const maxCount = Math.max(...Object.values(wuXingCount), 1);

    Object.entries(wuXingCount).forEach(([wx, count]) => {
        const item = document.getElementById(`wx-${wxMap[wx]}`);
        item.setAttribute('data-wx', wx);
        item.querySelector('.wx-fill').style.width = `${(count / maxCount) * 100}%`;
        item.querySelector('.wx-num').textContent = count;
    });

    const sorted = Object.entries(wuXingCount).sort((a, b) => b[1] - a[1]);
    const strongest = sorted[0];
    const missing = sorted.filter(([_, c]) => c === 0);

    let text = `四柱五行中【${strongest[0]}】最旺（${strongest[1]}个）`;
    if (missing.length > 0) {
        text += `，【${missing.map(([n]) => n).join('、')}】缺失`;
    } else {
        const weakest = sorted[sorted.length - 1];
        text += `，【${weakest[0]}】最弱（${weakest[1]}个）`;
    }
    document.getElementById('wuxingSummary').textContent = text;
}

// ==================== 袁天罡称骨 ====================
function renderChengGu(bazi, birthMonth, birthDay) {
    const cg = window.BaZiCalculator.calculateChengGu(bazi, birthMonth, birthDay);
    const el = document.getElementById('chengguContent');
    if (!el) return;

    const items = [
        { label: '年重', val: cg.breakdown.year },
        { label: '月重', val: cg.breakdown.month },
        { label: '日重', val: cg.breakdown.day },
        { label: '时重', val: cg.breakdown.hour }
    ];

    const weightHtml = items.map(it =>
        `<div class="cg-row"><span class="cg-label">${it.label}</span><span class="cg-value">${it.val}</span></div>`
    ).join('');

    const totalDisplay = cg.totalLiang + '.' + cg.totalQian;

    el.innerHTML = `
        <div class="cg-breakdown">${weightHtml}</div>
        <div class="cg-total">
            <span class="cg-total-weight">骨重 <strong>${cg.weightStr}</strong></span>
            <span class="cg-rate">
                ${totalDisplay < 3 ? ' 骨轻' : totalDisplay < 5 ? '◆ 中等' : totalDisplay < 7 ? ' 偏重' : ' 极重'}
            </span>
        </div>
        <div class="cg-geyao">
            <div class="cg-geyao-header">
                <span class="cg-geyao-ming">${cg.geyao.ming}</span>
                <span class="cg-geyao-geju">— ${cg.geyao.geju}</span>
            </div>
            <div class="cg-geyao-duan">${cg.geyao.duan}</div>
        </div>
    `;
}

// ==================== 日主解析 · 滴天髓 ====================
function renderRiZhuJieXi(dayGan) {
    const dt = window.BaZiCalculator.DITIANSUI[dayGan];
    const el = document.getElementById('rizhuContent');
    if (!el || !dt) return;

    const wuXingNames = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
    const wx = wuXingNames[dayGan] || '';
    const wxColor = { '木': '#4CAF50', '火': '#F44336', '土': '#CD853F', '金': '#FFD700', '水': '#2196F3' };

    const jiexiItems = dt.jiexi.map(j => `
        <div class="dt-line">
            <span class="dt-ju">${j.ju}</span>
            <span class="dt-yi">${j.yi}</span>
        </div>
    `).join('');

    el.innerHTML = `
        <div class="dt-header">
            <span class="dt-badge" style="background:${wxColor[wx]}22;border-color:${wxColor[wx]};color:${wxColor[wx]}">
                ${dayGan}${wx} · 日主
            </span>
        </div>
        <div class="dt-shi">${dt.shi}</div>
        <div class="dt-divider">
            <span class="dt-divider-label">逐句解析</span>
        </div>
        <div class="dt-jiexi">${jiexiItems}</div>
        <div class="dt-yuanzhu">
            <div class="dt-yz-label">【原注】</div>
            <div class="dt-yz-text">${dt.yuanzhu}</div>
        </div>
    `;
}

// ==================== 夫妻宫渲染 ====================

// ==================== 婚姻感情渲染（大白话） ====================
function renderMarriage(bazi, gender) {
    const pei = window.BaZiCalculator.analyzePei(bazi);
    const ageInfo = window.BaZiCalculator.calculateSpouseAge(bazi, pei.mainSS);
    const el = document.getElementById('marriageContent');
    if (!el) return;

    const maxCount = Math.max(ageInfo.bigCount, ageInfo.smallCount, ageInfo.sameCount);
    const barW = (v) => maxCount > 0 ? Math.round(v / maxCount * 100) : 0;

    // 大白话翻译夫妻宫信息
    const spouseDescMap = {
        '比肩': '另一半性格直爽独立，两人相处像朋友一样平等',
        '劫财': '两人个性都挺要强，偶尔会争个高低，但也更有活力',
        '食神': '另一半温和体贴，懂得享受生活，会把日子过得很舒服',
        '伤官': '另一半聪明有才华，想法独特，有时候说话很直接',
        '正财': '另一半务实顾家，重视经济基础，是个踏实过日子的人',
        '偏财': '另一半大方开朗，社交能力强，朋友多，也舍得花钱',
        '正官': '另一半做事规矩有担当，可能比较传统，责任感强',
        '七杀': '另一半果敢有魄力，不按常理出牌，可能给你带来惊喜也带来挑战',
        '正印': '另一半像你的温暖港湾，包容体贴，会照顾人',
        '偏印': '另一半思想独立深沉，可能有些神秘，不太轻易表达'
    };
    const spouseDesc = spouseDescMap[pei.mainSS] || '两人缘法很奇特，相遇后会慢慢发现彼此的闪光点';

    const wx = window.BaZiCalculator.WU_XING;
    const cangInfo = pei.cangGan.map((g) => {
        return '<span class="fq-cang-gan" style="color:' + (WX_COLORS[wx[g]] || '#b8a878') + '">' + g + '</span>';
    }).join('<span class="fq-cang-sep">·</span>');

    // 远近+认识方式翻译
    const distMap = { '同城/同乡':'另一半很可能是本地人','异地':'另一半来自不同城市','远方':'另一半来自很远的地方' };
    const meetMap = { '自由恋爱':'应该是在工作或社交中自然而然认识的','媒人介绍':'很可能是通过朋友或家人介绍认识的','巧合相遇':'缘分来得比较巧妙，可能是在旅途中偶遇' };

    el.innerHTML = ''
        + '<div class="mp-couple">'
        +   '<span class="mp-day-gz">' + bazi.day.gan + bazi.day.zhi + '</span>'
        +   '<span class="mp-day-label">（你的日柱·夫妻宫）</span>'
        + '</div>'
        + '<div class="mp-spouse-desc">' + spouseDesc + '</div>'
        + '<div class="mp-section-title">对方样貌特点</div>'
        + '<div class="mp-looks">' + pei.looks + '</div>'
        + '<div class="mp-section-title">年龄差距</div>'
        + '<div class="mp-age-badge">' + ageInfo.result + '</div>'
        + '<div class="mp-age-desc">' + ageInfo.desc + '</div>'
        + '<div class="mp-bars">'
        +   '<div class="sa-bar-item"><span class="sa-bar-label">年长<span class="sa-bar-sub">官杀·印星</span></span><div class="sa-bar-track"><div class="sa-bar-fill sa-big" style="width:' + barW(ageInfo.bigCount) + '%"></div></div><span class="sa-bar-num">' + ageInfo.bigCount + '</span></div>'
        +   '<div class="sa-bar-item"><span class="sa-bar-label">年轻的<span class="sa-bar-sub">食伤·财星</span></span><div class="sa-bar-track"><div class="sa-bar-fill sa-small" style="width:' + barW(ageInfo.smallCount) + '%"></div></div><span class="sa-bar-num">' + ageInfo.smallCount + '</span></div>'
        +   '<div class="sa-bar-item"><span class="sa-bar-label">同龄的<span class="sa-bar-sub">比劫</span></span><div class="sa-bar-track"><div class="sa-bar-fill sa-same" style="width:' + barW(ageInfo.sameCount) + '%"></div></div><span class="sa-bar-num">' + ageInfo.sameCount + '</span></div>'
        + '</div>'
        + '<div class="mp-loc-row">'
        +   '<div class="sa-loc-card"><span class="sa-loc-icon" style="display:none"></span><div class="sa-loc-body"><div class="sa-loc-title">你们离得远吗：<b>' + ageInfo.distanceLabel + '</b></div><div class="sa-loc-text">' + (distMap[ageInfo.distanceLabel] || ageInfo.distanceText) + '</div></div></div>'
        +   '<div class="sa-loc-card"><span class="sa-loc-icon" style="display:none"></span><div class="sa-loc-body"><div class="sa-loc-title">可能怎么认识：<b>' + ageInfo.meetingLabel + '</b></div><div class="sa-loc-text">' + (meetMap[ageInfo.meetingLabel] || ageInfo.meetingText) + '</div></div></div>'
        + '</div>';
}


// ==================== 父母关系渲染 ====================
function renderParents(bazi, gender) {
    const parents = window.BaZiCalculator.analyzeParents(bazi, gender);
    const el = document.getElementById('parentsContent');
    if (!el) return;

    el.innerHTML = `
        <div class="pr-card pr-father">
            <div class="pr-card-icon" style="display:none"></div>
            <div class="pr-card-body">
                <div class="pr-card-title">父亲 <span class="pr-star-tag">${parents.fatherStar}</span></div>
                <div class="pr-card-text">${parents.fatherText}</div>
            </div>
        </div>
        <div class="pr-card pr-mother">
            <div class="pr-card-icon" style="display:none"></div>
            <div class="pr-card-body">
                <div class="pr-card-title">母亲 <span class="pr-star-tag">${parents.motherStar}</span></div>
                <div class="pr-card-text">${parents.motherText}</div>
            </div>
        </div>
        <div class="pr-summary">
            <div class="pr-summary-label">综合</div>
            <div class="pr-summary-text">${parents.summaryText}</div>
        </div>
    `;
}

// ==================== 日主性格渲染（白话版） ====================
function renderCharacter(bazi) {
    var ch = window.BaZiCalculator.analyzeCharacter(bazi);
    var el = document.getElementById('characterContent');
    if (!el) return;

    // v3.0: 新格式是纯文本字符串，直接显示
    if (typeof ch === 'string') {
        el.innerHTML = '<div style="line-height:2;font-size:14px;padding:12px 0">' +
            ch.split('\n').filter(function(l){return l.trim()}).map(function(l){
                if(l.startsWith('日主')) return '<p style="color:var(--gold-l);font-size:16px;font-weight:700;margin-bottom:12px">'+l+'</p>';
                if(l.startsWith('适合')) return '<p style="color:var(--tx2);font-size:12px;margin-top:10px;padding:8px 12px;background:rgba(201,168,76,.06);border-radius:8px">'+l+'</p>';
                return '<p style="margin-bottom:6px;color:var(--tx)">'+l+'</p>';
            }).join('') + '</div>';
        return;
    }

    var wxColor = { '木':'#4CAF50','火':'#F44336','土':'#CD853F','金':'#FFD700','水':'#2196F3' };

    // ---- 把后端数据拆解出来，换成真人说话的句子 ----
    var dayGan = ch.dayGan, wuXing = ch.wuXing;
    var pos = ch.nature.positive, neg = ch.nature.negative, xi = ch.nature.xingxiang;

    // 五行底色简介（口语化）
    var wxIntro = {
        '木': dayGan + '五行属木。命带木气的人，骨子里有股不服输的劲儿，做人做事像树一样——愿意慢慢扎根、一点点往上长。不太喜欢拐弯抹角，但也不轻易跟人撕破脸。',
        '火': dayGan + '五行属火。你这个人热情是真的，不是装出来的。走到哪里都自带温度，别人跟你待着会觉得很舒服、很放松。不过有时候性子一上来，话赶话就容易说出让人误会的话。',
        '土': dayGan + '五行属土。你给人的第一印象往往是稳。不慌不忙、不急不躁，什么事到你手里都变得有条理了。朋友有事第一个想到的就是你——因为知道你不会掉链子。',
        '金': dayGan + '五行属金。你这人有个特点：脑子清楚、做事利索。不喜欢磨叽，更讨厌拖泥带水。一旦认定了什么，就会咬着不放，执行力在朋友圈里数一数二。',
        '水': dayGan + '五行属水。你聪明、反应快，适应力强得让人羡慕。换个环境、换个圈子，你总是第一个融入的。唯一的问题可能是——什么都想做，什么都想试试，结果有些事就只开了个头。'
    };

    var intro = wxIntro[wuXing] || (dayGan + '五行属' + wuXing + '。' + xi);

    // 优点润色（把连续逗号拆开，加连接词，加感叹）
    var posArr = pos.replace(/、/g, '，').split('，').filter(function(s) { return s.length > 2; });
    var posText = '';
    if (posArr.length > 0) {
        // 选前3-4条核心的
        var core = posArr.slice(0, 4);
        if (core.length === 1) {
            posText = '最突出的一点就是' + core[0] + '。';
        } else {
            // 用"一方面…另一方面…还有就是…"的自然结构
            posText = '具体来说：' + core[0] + '，而且' + core[1];
            if (core[2]) posText += '。另外' + core[2];
            if (core[3]) posText += '，' + core[3];
            posText += '。';
        }
    }

    // 缺点润色（同样的处理）
    var negArr = neg.replace(/、/g, '，').split('，').filter(function(s) { return s.length > 2; });
    var negText = '';
    if (negArr.length > 0) {
        var coreNeg = negArr.slice(0, 4);
        if (coreNeg.length === 1) {
            negText = '要说需要注意的地方，就是有时候会' + coreNeg[0] + '。';
        } else {
            negText = '不过话说回来，有时候也会' + coreNeg[0] + '，或者' + coreNeg[1];
            if (coreNeg[2]) negText += '。身边人偶尔会觉得你' + coreNeg[2];
            if (coreNeg[3]) negText += '，' + coreNeg[3];
            negText += '。这些都是小节，自己心里有数就行。';
        }
    }

    // 综合画像（把后端composite拆开重说）
    var topSS = ch.topSS || [];
    var topSSDetail = ch.topSSDetail || [];
    var ssAdvice = '';
    if (topSSDetail.length >= 1) {
        var main = topSSDetail[0];
        ssAdvice = '从命局来看，你的「' + main.name + '」特质比较突出';
        if (main.count > 1) ssAdvice += '（出现了' + main.count + '次）';
        ssAdvice += '，' + main.trait;

        if (topSSDetail.length >= 2) {
            var second = topSSDetail[1];
            ssAdvice += '。同时身上也有不少「' + second.name + '」的影子——' + second.trait;
        }
        ssAdvice += '。所以整体来说，你这个人给人的感觉相当立体，不是一个标签能概括的。';
    }

    // 组装
    el.innerHTML = ''
        + '<div style="text-align:center;margin-bottom:18px">'
        +   '<span style="display:inline-block;padding:8px 26px;border:1px solid;border-radius:2px;font-size:18px;font-weight:700;letter-spacing:3px;background:' + (wxColor[wuXing] || '#b8a878') + '22;border-color:' + (wxColor[wuXing] || '#b8a878') + ';color:' + (wxColor[wuXing] || '#b8a878') + '">' + dayGan + wuXing + '日主</span>'
        + '</div>'

        // 五行底色
        + '<div style="font-size:14px;color:var(--text-primary);line-height:2.2;padding:14px 16px;background:rgba(20,25,40,.4);border:1px solid rgba(212,175,55,.06);border-radius:2px;margin-bottom:12px">'
        +   '<p style="margin:0">' + intro + '</p>'
        + '</div>'

        // ==== 时柱/年柱十神性格分析（新算法） ====
        + (function(){
            var hy = ch.hourYear;
            if (!hy || !hy.hour || !hy.year) return '';
            var hd = hy.hour.desc, yd = hy.year.desc;
            var h = '';
            // 外层气质卡片
            h += '<div style="margin-bottom:12px;border:1px solid rgba(201,168,76,.15);border-radius:10px;overflow:hidden">';
            h += '<div style="background:rgba(201,168,76,.08);padding:10px 16px;display:flex;align-items:center;gap:10px">';
            h += '<span style="font-size:18px">🎭</span>';
            h += '<div><span style="color:var(--gold-l);font-size:14px;font-weight:700;letter-spacing:2px">外在气质</span>';
            h += '<span style="color:var(--tx3);font-size:10px;margin-left:8px">时柱 ' + hy.hour.gan + ' → ' + hy.hour.shiShen + '</span></div>';
            h += '</div>';
            if (hd) {
                h += '<div style="padding:12px 16px;font-size:13px;color:var(--tx);line-height:2.0">';
                h += '<p style="margin:0 0 8px"><span style="color:var(--gold-l);font-weight:600">▸ 正面：</span>' + hd.pos + '</p>';
                h += '<p style="margin:0;color:var(--tx2)"><span style="color:#c99;font-weight:600">▸ 留意：</span>' + hd.neg + '</p>';
                h += '</div>';
            }
            h += '</div>';
            // 分隔或表里如一标注
            if (hy.isSame) {
                h += '<div style="text-align:center;padding:6px 0;font-size:11px;color:var(--gold-l);letter-spacing:2px;opacity:.7">⬆ 表里如一 · 内外一致 ⬆</div>';
            }
            // 内在驱动力卡片
            h += '<div style="margin-bottom:12px;border:1px solid rgba(91,127,165,.15);border-radius:10px;overflow:hidden">';
            h += '<div style="background:rgba(91,127,165,.08);padding:10px 16px;display:flex;align-items:center;gap:10px">';
            h += '<span style="font-size:18px">🧠</span>';
            h += '<div><span style="color:#8ab0d0;font-size:14px;font-weight:700;letter-spacing:2px">内在驱动力</span>';
            h += '<span style="color:var(--tx3);font-size:10px;margin-left:8px">年柱 ' + hy.year.gan + ' → ' + hy.year.shiShen + '</span></div>';
            h += '</div>';
            if (yd) {
                h += '<div style="padding:12px 16px;font-size:13px;color:var(--tx);line-height:2.0">';
                h += '<p style="margin:0 0 8px"><span style="color:#8ab0d0;font-weight:600">▸ 正面：</span>' + yd.pos + '</p>';
                h += '<p style="margin:0;color:var(--tx2)"><span style="color:#c99;font-weight:600">▸ 留意：</span>' + yd.neg + '</p>';
                h += '</div>';
            }
            h += '</div>';
            return h;
        })()

        // 优点
        + '<div style="font-size:13px;color:var(--text-primary);line-height:2;padding:14px 16px;background:rgba(20,25,40,.4);border:1px solid rgba(212,175,55,.06);border-radius:2px;margin-bottom:12px">'
        +   '<p style="margin:0"><b>长处</b>' + posText + '</p>'
        + '</div>'

        // 缺点
        + '<div style="font-size:13px;color:var(--text-primary);line-height:2;padding:14px 16px;background:rgba(20,25,40,.4);border:1px solid rgba(212,175,55,.06);border-radius:2px;margin-bottom:12px">'
        +   '<p style="margin:0"><b>小毛病</b>' + negText + '</p>'
        + '</div>'

        // 十神综合
        + '<div style="font-size:13px;color:var(--text-secondary);line-height:2.2;padding:14px 16px;background:rgba(212,175,55,.03);border:1px solid rgba(212,175,55,.1);border-radius:2px">'
        +   '<p style="margin:0">' + ssAdvice + '</p>'
        + '</div>';
}

// ==================== 今年运势渲染 ====================
function renderThisYear(bazi, gender) {
    var yongJiTy = window.BaZiCalculator.getYongJi(bazi);
    var ty = window.BaZiCalculator.analyzeThisYear(bazi, gender, yongJiTy);
    var el = document.getElementById('thisYearContent');
    if (!el) return;

    var labelColor = ty.isFavorable ? '#81C784' : '#feca57';

    // 吉/凶标签
    var overallTag = ty.isFavorable ? '利好' : '偏紧';
    var overallColor = ty.isFavorable ? '#81C784' : '#feca57';

    // 冲合警告
    var chongHtml = '';
    if (ty.chongWarnings && ty.chongWarnings.length > 0) {
        chongHtml = '<div style="font-size:13px;color:#E57373;line-height:2;padding:14px 16px;background:rgba(244,67,54,.04);border:1px solid rgba(244,67,54,.12);border-radius:3px;margin-bottom:12px">'
            + '<div style="font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:6px">需要注意</div>'
            + ty.chongWarnings.map(function(w) { return '<p style="margin:0 0 6px">-- ' + w + '</p>'; }).join('')
            + '</div>';
    }

    var heHtml = '';
    if (ty.heGoods && ty.heGoods.length > 0) {
        heHtml = '<div style="font-size:13px;color:#81C784;line-height:2;padding:14px 16px;background:rgba(76,175,80,.04);border:1px solid rgba(76,175,80,.12);border-radius:3px;margin-bottom:12px">'
            + '<div style="font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:6px">好兆头</div>'
            + ty.heGoods.map(function(g) { return '<p style="margin:0 0 6px">-- ' + g + '</p>'; }).join('')
            + '</div>';
    }

    // 机会
    var oppHtml = '';
    if (ty.opportunities && ty.opportunities.length > 0) {
        oppHtml = '<div style="font-size:13px;color:var(--text-primary);line-height:2;padding:14px 16px;background:rgba(20,25,40,.4);border:1px solid rgba(212,175,55,.06);border-radius:3px;margin-bottom:12px">'
            + '<div style="font-size:12px;color:var(--gold);font-weight:700;letter-spacing:2px;margin-bottom:6px">今年可能的机会</div>'
            + ty.opportunities.map(function(o, i) { return '<p style="margin:0 0 6px">' + (i+1) + '. ' + o + '</p>'; }).join('')
            + '</div>';
    }

    el.innerHTML = ''
        // 标题行
        + '<div style="text-align:center;margin-bottom:18px">'
        +   '<div style="font-family:\'STKaiti\',\'KaiTi\',\'Source Han Serif SC\',serif;font-size:24px;letter-spacing:4px;color:var(--gold);margin-bottom:4px">' + ty.year + ' 年运势</div>'
        +   '<div style="font-size:13px;color:var(--text-dim);letter-spacing:2px">'
        +     '流年 <span style="color:' + overallColor + ';font-weight:700">' + ty.gan + ty.zhi + '</span>'
        +     ' · 十神 <span style="color:var(--text-primary);font-weight:700">' + ty.shiShen + '</span>'
        +   '</div>'
        + '</div>'

        // 概括
        + '<div style="font-size:14px;color:var(--text-primary);line-height:2.2;padding:16px 18px;background:rgba(20,25,40,.5);border:1px solid rgba(212,175,55,.08);border-radius:3px;margin-bottom:14px">'
        +   '<p style="margin:0">' + ty.story.good + '</p>'
        + '</div>'

        // 规避
        + '<div style="font-size:13px;color:var(--text-primary);line-height:2.2;padding:14px 16px;background:rgba(244,67,54,.03);border:1px solid rgba(244,67,54,.08);border-radius:3px;margin-bottom:12px">'
        +   '<p style="margin:0"><span style="color:#E57373;font-weight:700;letter-spacing:2px">需要回避的</span></p>'
        +   '<p style="margin:0">' + ty.story.bad + '</p>'
        + '</div>'

        + chongHtml
        + heHtml
        + oppHtml

        // 健康
        + '<div style="font-size:13px;color:var(--text-primary);line-height:2.2;padding:14px 16px;background:rgba(255,193,7,.03);border:1px solid rgba(255,193,7,.1);border-radius:3px;margin-bottom:12px">'
        +   '<p style="margin:0 0 6px"><span style="color:#feca57;font-weight:700;letter-spacing:2px">身体状况</span></p>'
        +   '<p style="margin:0">' + ty.healthSummary + '</p>'
        +   (ty.healthExtra && ty.healthExtra.length > 0 ? '<p style="margin:8px 0 0;color:var(--text-secondary)">' + ty.healthExtra.join(' ') + '</p>' : '')
        + '</div>'

        // 总结
        + '<div style="font-size:12px;color:var(--text-secondary);line-height:2;padding:12px 16px;background:rgba(212,175,55,.03);border:1px solid rgba(212,175,55,.1);border-radius:3px">'
        +   '<p style="margin:0">以上分析基于命理学的流年推算，每个人的实际经历会因自身选择和环境影响而不同。不管你信不信，都愿你今年平安顺遂。</p>'
        + '</div>';
}

// ==================== 财运分析渲染（加强版） ====================
function renderWealth(bazi, gender) {
    var yongJiWealth = window.BaZiCalculator.getYongJi(bazi);
    var wl = window.BaZiCalculator.analyzeWealth(bazi, gender, yongJiWealth);
    var el = document.getElementById('wealthContent');
    if (!el) return;

    var wxColors = { '木': '#4CAF50', '火': '#F44336', '土': '#CD853F', '金': '#FFD700', '水': '#2196F3' };
    var caiColor = wxColors[wl.caiWX] || '#b8a878';
    var wangLabels = { '身强': '比较强', '中和偏强': '还不错', '中和偏弱': '有点弱', '身弱': '比较弱' };

    // 财星位置
    var posNames = { year: '祖上', month: '青年', day: '自己', hour: '晚年' };
    var posList = wl.caiPositions.map(function(p) { return posNames[p] || p; });
    var posText = posList.length > 0 ? posList.join('、') : '财气不显但靠自己';

    // 财富量级描述
    var levelHtml = (wl.wealthLevels || []).map(function(l) {
        return '<p style="margin:0 0 8px">' + l + '</p>';
    }).join('');

    // 有利城市
    var goodCityTags = (wl.goodCities || []).map(function(c) {
        return '<span style="display:inline-block;padding:3px 10px;margin:2px;border:1px solid rgba(76,175,80,.3);border-radius:2px;font-size:12px;color:#81C784">' + c + '</span>';
    }).join('');
    // 不利城市
    var badCityTags = (wl.badCities || []).map(function(c) {
        return '<span style="display:inline-block;padding:3px 10px;margin:2px;border:1px solid rgba(244,67,54,.3);border-radius:2px;font-size:12px;color:#E57373">' + c + '</span>';
    }).join('');

    el.innerHTML = ''
        // ==== 顶部概览 ====
        + '<div style="text-align:center;margin-bottom:18px">'
        +   '<div style="font-family:\'STKaiti\',\'KaiTi\',\'Source Han Serif SC\',serif;font-size:22px;letter-spacing:4px;color:' + caiColor + ';margin-bottom:2px">'
        +     ' ' + wl.caiWX + '为财'
        +   '</div>'
        +   '<div style="font-size:12px;color:var(--text-dim);letter-spacing:2px">出现 ' + wl.caiCount + ' 次 · 命格底气 ' + (wangLabels[wl.wangStatus] || wl.wangStatus) + ' · 财在' + posText + '</div>'
        + '</div>'

        // ==== 一句话总结 ====
        + '<div style="font-size:14px;color:var(--text-primary);line-height:2;padding:16px 18px;background:rgba(20,25,40,.5);border:1px solid rgba(212,175,55,.08);border-radius:3px;margin-bottom:16px">'
        +   '<p style="margin:0"> <b>概览：</b>' + (wl.wealthSummary || '你的财运有根有底，别着急，好事在后头') + '</p>'
        + '</div>'

        // ==== 财富量级（核心） ====
        + '<div style="margin-bottom:10px">'
        +   '<span style="font-size:12px;color:var(--gold);letter-spacing:3px;font-weight:600"> 未来财富量级</span>'
        + '</div>'
        + '<div style="font-size:13px;color:var(--text-primary);line-height:2;padding:16px 18px;background:rgba(212,175,55,.04);border:1px solid rgba(212,175,55,.12);border-radius:3px;margin-bottom:16px">'
        +   levelHtml
        + '</div>'

        // ==== 方位与城市 ====
        + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">'
        // 有利方位
        +   '<div style="flex:1;min-width:140px;padding:14px 16px;background:rgba(76,175,80,.04);border:1px solid rgba(76,175,80,.12);border-radius:3px">'
        +     '<div style="font-size:13px;color:#81C784;font-weight:700;letter-spacing:2px;margin-bottom:8px"> 旺财方位</div>'
        +     '<div style="font-size:18px;font-weight:700;color:#81C784;margin-bottom:6px;letter-spacing:2px">' + wl.goodDirection + '方' + '</div>'
        +     '<div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;line-height:1.6">往这个方向发展的城市，更容易遇到贵人、打开财路。出差、旅行、甚至定居都可以多往这边靠。</div>'
        +     '<div style="margin-bottom:4px;font-size:11px;color:var(--text-secondary);letter-spacing:1px">利好城市</div>'
        +     '<div>' + goodCityTags + '</div>'
        +   '</div>'
        // 不利方位
        +   '<div style="flex:1;min-width:140px;padding:14px 16px;background:rgba(244,67,54,.04);border:1px solid rgba(244,67,54,.12);border-radius:3px">'
        +     '<div style="font-size:13px;color:#E57373;font-weight:700;letter-spacing:2px;margin-bottom:8px"> 求财慎往</div>'
        +     '<div style="font-size:18px;font-weight:700;color:#E57373;margin-bottom:6px;letter-spacing:2px">' + wl.badDirection + '方' + '</div>'
        +     '<div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;line-height:1.6">去这些地方发展可能会比较吃力，赚钱比别人费劲一些。不是不能去，但要有心理准备。</div>'
        +     '<div style="margin-bottom:4px;font-size:11px;color:var(--text-secondary);letter-spacing:1px">需谨慎的城市</div>'
        +     '<div>' + badCityTags + '</div>'
        +   '</div>'
        + '</div>'

        // ==== 详细解读 ====
        + '<div style="font-size:13px;color:var(--text-primary);line-height:2;padding:14px 16px;background:rgba(20,25,40,.4);border:1px solid rgba(212,175,55,.06);border-radius:3px;margin-bottom:12px">'
        +   '<p style="margin:0"><b> 赚钱建议：</b>' + wl.caiAdvice + '</p>'
        + '</div>'

        // ==== 底层解读 ====
        + '<div style="font-size:12px;color:var(--text-secondary);line-height:2;padding:12px 16px;background:rgba(212,175,55,.03);border:1px solid rgba(212,175,55,.1);border-radius:3px">'
        +   '<p style="margin:0"><b> 命理解读：</b>' + wl.caiWanxi + '</p>'
        + '</div>';
}

// ==================== 流年运势渲染 ====================
function renderFortune(bazi, gender) {
    var yongJiFt = window.BaZiCalculator.getYongJi(bazi);
    const ft = window.BaZiCalculator.analyzeFortune(bazi, gender, yongJiFt);
    const el = document.getElementById('fortuneContent');
    if (!el) return;

    const yearCards = ft.years.map(function(yr) {
        var riskBlock = '';
        if (yr.riskText) riskBlock += '<div class="ft-risk">' + yr.riskText + '</div>';
        if (yr.oppText) riskBlock += '<div class="ft-opp">' + yr.oppText + '</div>';
        var cautionBlock = '';
        if (yr.cautions && yr.cautions.length > 0) {
            cautionBlock = '<div class="ft-caution">' + yr.cautions.map(function(c) {
                return '<div class="ft-caution-item"><span class="ft-caution-dot">·</span><span>' + c + '</span></div>';
            }).join('') + '</div>';
        }
        return '<div class="ft-card">'
            + '<div class="ft-year-row">'
            +   '<span class="ft-year-num">' + yr.year + '</span>'
            +   '<span class="ft-year-gz">' + yr.gan + yr.zhi + '</span>'
            +   '<span class="ft-tag" style="background:' + yr.overallColor + '22;border-color:' + yr.overallColor + ';color:' + yr.overallColor + '">' + yr.overallLabel + '</span>'
            +   '<span class="ft-ss-badge">' + yr.shiShen + '</span>'
            + '</div>'
            + '<div class="ft-body">'
            +   '<div class="ft-desc">' + yr.ssNote + '</div>'
            +   riskBlock
            +   cautionBlock
            + '</div>'
            + '</div>';
    }).join('');

    el.innerHTML = `
        <div class="ft-dy-info">${ft.dyInfo}</div>
        <div class="ft-legend">
            <span class="ft-legend-item"><span class="ft-dot" style="background:#81C784"></span>利好</span>
            <span class="ft-legend-item"><span class="ft-dot" style="background:#feca57"></span>较好</span>
            <span class="ft-legend-item"><span class="ft-dot" style="background:#a29bfe"></span>平稳</span>
            <span class="ft-legend-item"><span class="ft-dot" style="background:#F44336"></span>注意</span>
        </div>
        <div class="ft-cards">${yearCards}</div>
        <div class="ft-disclaimer">※ 流年运势为命理学的概率性参考，请结合自身实际情况理性看待，勿盲信。</div>
    `;
}

// ==================== 学业分析渲染 ====================
function renderStudy(bazi) {
    const st = window.BaZiCalculator.analyzeStudy(bazi);
    const el = document.getElementById('studyContent');
    if (!el) return;
    const wxColors = { '木':'#4CAF50','火':'#F44336','土':'#CD853F','金':'#FFD700','水':'#2196F3' };
    const yinPct = Math.min(100, Math.max(5, Math.round(st.yinScore / 6 * 100)));

    // 大白话等级说明
    const levelStories = {
        '学业优秀': '你的学习能力很强——天生有很好的吸收和理解能力，读书考试对你来说不是难事。如果能找到自己真正感兴趣的领域，潜力非常大。',
        '学业良好': '你的学习底子不错，虽然不是天才型但胜在踏实。只要愿意下功夫，考试升学都有很好的机会。找到一个好老师或者好的学习环境会让你事半功倍。',
        '学业中等': '书本学习可能不是你最强的武器，但这不代表你不行。你可能更适合动手操作、和人打交道或者搞创意——有很多职业不需要高分也能做得很好。',
        '学业需努力': '读书考试确实需要比别人多花力气，但这往往意味着你的天赋在别处。建议多尝试不同的学习方式，动手做比光看书效果好，找到适合自己的路比硬拼更重要。'
    };

    // 学习建议扩展
    const fullAdvice = '建议你选择最适合自己的学习方式，把长处发挥到极致。' + st.adviceText;

    el.innerHTML = ''
        + '<div style="text-align:center;margin-bottom:14px">'
        +   '<span style="display:inline-block;padding:6px 24px;border:1px solid;border-radius:2px;font-size:16px;font-weight:700;letter-spacing:3px;background:' + (wxColors[st.wuXing] || '#b8a878') + '22;border-color:' + (wxColors[st.wuXing] || '#b8a878') + ';color:' + (wxColors[st.wuXing] || '#b8a878') + '">' + st.levelLabel + '</span>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">'
        +   '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text-secondary);flex:0 0 40px;letter-spacing:1px">学习力</span><div style="flex:1;height:8px;background:rgba(255,255,255,.05);border-radius:1px;overflow:hidden"><div style="height:100%;width:' + yinPct + '%;background:' + (wxColors[st.wuXing] || '#b8a878') + ';border-radius:1px;transition:width .6s"></div></div><span style="font-size:12px;color:var(--text-secondary)">' + st.yinScore.toFixed(1) + '</span></div>'
        +   '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text-secondary);flex:0 0 40px;letter-spacing:1px">创造力</span><div style="flex:1;height:8px;background:rgba(255,255,255,.05);border-radius:1px;overflow:hidden"><div style="height:100%;width:' + Math.min(100,Math.round(st.shiShangScore/6*100)) + '%;background:#ff9f43;border-radius:1px;transition:width .6s"></div></div><span style="font-size:12px;color:var(--text-secondary)">' + st.shiShangScore.toFixed(1) + '</span></div>'
        +   '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text-secondary);flex:0 0 40px;letter-spacing:1px">自律力</span><div style="flex:1;height:8px;background:rgba(255,255,255,.05);border-radius:1px;overflow:hidden"><div style="height:100%;width:' + Math.min(100,Math.round(st.guanScore/4*100)) + '%;background:#4dadff;border-radius:1px;transition:width .6s"></div></div><span style="font-size:12px;color:var(--text-secondary)">' + st.guanScore.toFixed(1) + '</span></div>'
        + '</div>'
        + '<div style="font-size:13px;color:var(--text-primary);line-height:2;padding:14px 16px;background:rgba(20,25,40,.4);border:1px solid rgba(212,175,55,.06);border-radius:2px;margin-bottom:12px">'
        +   '<p>' + (levelStories[st.levelLabel] || st.levelText) + '</p>'
        + '</div>'
        +   (st.hasWenChang ? '<div style="font-size:13px;color:#81C784;line-height:2;padding:10px 14px;background:rgba(76,175,80,.04);border:1px solid rgba(212,175,55,.08);border-radius:2px;margin-bottom:10px"><p> 自带文昌贵人，考试运不错，关键时刻容易发挥出超常水平。</p></div>' : '')
        +   (st.hasXueTang ? '<div style="font-size:13px;color:#81C784;line-height:2;padding:10px 14px;background:rgba(76,175,80,.04);border:1px solid rgba(212,175,55,.08);border-radius:2px;margin-bottom:10px"><p> 命带学堂，天生对知识有好奇心，适合持续学习的环境。</p></div>' : '')
        + '<div style="font-size:13px;color:var(--text-secondary);line-height:2;padding:14px 16px;background:rgba(212,175,55,.03);border:1px solid rgba(212,175,55,.1);border-radius:2px">'
        +   '<p><b> 建议：</b>' + fullAdvice + '</p>'
        + '</div>';
}

// ==================== 真太阳时 ====================
function renderSolarTime(year, month, day, birthHour) {
    var el = document.getElementById('solarTimeText');
    if (!el) return;

    // 优先使用已计算好的 solarInfo（含经度+均时差调整）
    var solarInfo = (_bazi && _bazi.solarInfo) || null;
    if (!solarInfo && _params && _params.reportClockNormalized && isValidCalculatedClock(_params.clock)) {
        var restoredMinutes = Math.round(Number(_params.clock) * 60);
        var restoredHour = Math.floor(restoredMinutes / 60) % 24;
        var restoredMinute = restoredMinutes % 60;
        el.textContent = String(restoredHour).padStart(2, '0') + ':'
            + String(restoredMinute).padStart(2, '0') + '（已按购买记录恢复真太阳时）';
        return;
    }
    if (!solarInfo) {
        var fallbackLocation = (_params.prov || _params.city || _params.dist) ? {
            province:_params.prov || '', city:_params.city || '', district:_params.dist || '', allowFallback:true
        } : '';
        solarInfo = window.BaZiCalculator.getTrueSolarHour(birthHour, fallbackLocation, year, month, day, 0, 0);
    }

    // 用 solarMinutes 直接取真太阳时间
    var tm = solarInfo.solarMinutes;
    var sH = Math.floor(tm / 60);
    var sM = Math.round(tm % 60);
    if (sM >= 60) { sH++; sM = 0; }
    if (sH >= 24) sH -= 24;
    var solarStr = String(sH).padStart(2,'0') + ':' + String(sM).padStart(2,'0');

    var sign = Math.abs(solarInfo.eotMin) < 0.5 ? '≈' : (solarInfo.eotMin > 0 ? '+' : '');
    var resolution = solarInfo.locationResolution;
    var locationText = '';
    if (resolution) {
        if (resolution.level === 'county') {
            locationText = '按' + (_params.dist || '所选县区') + '的县级行政中心经度 ' + solarInfo.lng + '°E 校正';
        } else if (resolution.level === 'county_alias') {
            locationText = '旧地名已映射；按当前县级行政中心经度 ' + solarInfo.lng + '°E 校正';
        } else if (resolution.level === 'city_fallback') {
            locationText = '县级经度未匹配，当前按' + (_params.city || '所选城市') + '经度估算';
        } else if (resolution.level === 'province_fallback') {
            locationText = '县级经度未匹配，当前按' + (_params.prov || '所选省份') + '经度估算';
        } else {
            locationText = '出生地经度未匹配，当前按东经 120° 估算';
        }
    } else if (!_params.prov && !_params.city && !_params.dist) {
        locationText = '未选择出生地，当前未使用县级经度';
    } else {
        locationText = '旧版地点数据，当前按可识别的上级地区估算';
    }
    el.textContent = solarStr + '（均时差' + sign + Math.abs(solarInfo.eotMin) + '分 • ' + locationText + '）';
}

// ==================== 抽屉式开关 ====================
function toggleDrawer(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.classList.toggle('drawer-open');
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    _params = getUrlParams();
    _reportYear = _params.reportYear;
    _reportPaidAt = '';
    _accountReportAccessResolved = false;
    delete _params.reportYear;
    _reportIdentityParams = JSON.parse(JSON.stringify(_params));
    var isDirect = _params.mode === 'pillars';
    var hasTiming = !isDirect || _params.timing === 'matched';
    var invalidDate = !_params.year || !_params.month || !_params.day || isNaN(_params.hour);
    var invalidClock = hasTiming && (isDirect
        ? !isValidBirthClock(_params.clock)
        : !isValidCalculatedClock(_params.clock));
    var invalidParams = !_params.gender
        || invalidClock
        || (isDirect ? (!_params.enteredPillars || (hasTiming && invalidDate)) : invalidDate);

    // 登录用户：报告页不在这儿存档，见下方 _bazi 赋值后

    if (invalidParams) {
        alert('参数错误，请重新输入');
        window.location.href = 'index.html';
        return;
    }

    // --- 统一出生时间归一化（个人排盘与合盘共用）---
    var originalHour = _params.hour;
    var solarInfo = null;
    if (!isDirect) {
        // 确保 _params.hour 始终是时辰索引（0-11），不是钟点（0-23）
        if (_params.hour >= 12) _params.hour = _params.hour === 23 ? 0 : Math.floor((_params.hour + 1) / 2) % 12;
        originalHour = _params.hour;
        var normalizedBirth = window.BaZiCalculator.normalizeBirthInput({
            year:_params.year, month:_params.month, day:_params.day, hour:_params.hour,
            clock:_params.clock, minute:_params.minute, gender:_params.gender,
            location:(_params.prov || _params.city || _params.dist) ? {
                province:_params.prov || '', city:_params.city || '', district:_params.dist || '', allowFallback:true
            } : '',
            dist:_params.dist || '', city:_params.city || '', prov:_params.prov || '',
            trueSolarTime:_params.reportClockNormalized ? false : _params.solar !== '0',
            ziHourNextDay:_params.zishi === '1'
        });
        _params.year=normalizedBirth.year;_params.month=normalizedBirth.month;_params.day=normalizedBirth.day;
        _params.hour=normalizedBirth.hour;_params.clock=normalizedBirth.clock;
        _params.dayPillarOffset=normalizedBirth.dayPillarOffset;
        solarInfo=normalizedBirth.solarInfo;
        _params.solarDataVersion = solarInfo && solarInfo.locationResolution
            ? solarInfo.locationResolution.sourceVersion : '';
    }

    if (typeof window !== 'undefined' && window.DeepReportAnchor && window.DeepReportAnchor.resolve) {
        try {
            _reportAnchorYear = window.DeepReportAnchor.resolve({
                chartKey: reportAnchorKey(_params),
                storage: window.localStorage
            });
            window.__deepReportAnchorYear = _reportAnchorYear;
        } catch (e) {}
    }

    const resultData = buildResultData(_params);
    const bazi = resultData.bazi;
    const daYun = resultData.daYun;
    if (!isDirect) {
        // 保存原始时辰供显示
        bazi.originalHour = originalHour;
        bazi.solarInfo = solarInfo;
    }

    // 存储供流年点击使用
    _daYunData = daYun || undefined;
    _dayGan = bazi.day.gan;
    _bazi = bazi;

    // 登录用户：保存排盘参数 + 日柱到档案
    if (typeof Auth !== 'undefined') {
      Auth.ready(function() {
        if (!Auth.isLoggedIn()) return;
        var identityQuery = new URLSearchParams(window.location.search);
        identityQuery.delete('report_year');
        var paramStr = identityQuery.toString();
        try { Auth.syncData('last_bazi_params', paramStr); } catch(e) {}
        if (typeof iru === 'function' && iru()) {
          try { Auth.syncData('bazi_rpt', JSON.stringify({h:typeof _baziHash!=='undefined'?_baziHash:'',e:Date.now()+365*86400000})); } catch(e) {}
        }
        try {
          Auth.getData('saved_charts').then(function(existing){
            var charts = [];
            try { charts = JSON.parse(existing || '[]'); } catch(e){}
            // 找到并更新已有条目，或新增
            var found = charts.find(function(c){ return c.params === paramStr; });
            var genderLabel = _params.gender === 'male' ? '乾造' : '坤造';
            var label = (_params.name ? _params.name + ' · ' : '') + genderLabel;
            if (isDirect) {
              label += ' · ' + ['year','month','day','hour'].map(function(position) {
                var pillar = _params.enteredPillars[position];
                return pillar.gan + pillar.zhi;
              }).join(' ');
            } else {
              label += ' · ' + _params.year + '年' + _params.month + '月' + _params.day + '日';
            }
            var entry = { name: _params.name || '', label: label, params: paramStr, dayGan: bazi.day.gan, dayZhi: bazi.day.zhi, saved_at: new Date().toISOString() };
            if (found) {
              // 更新已有条目，补充日柱数据
              found.dayGan = entry.dayGan; found.dayZhi = entry.dayZhi;
              found.saved_at = entry.saved_at; found.label = entry.label; found.name = entry.name;
            } else {
              charts.unshift(entry);
            }
            if (charts.length > 20) charts = charts.slice(0, 20);
            Auth.syncData('saved_charts', JSON.stringify(charts));
          }).catch(function(){});
        } catch(e) {}
      });
    }

    render(resultData);
});

// ==================== 下载 / 保存报告 ====================

// 检测付费遮罩是否激活（未付费状态）
function _isPaywallActive() {
    try {
        var pw = document.getElementById('rptPaywall');
        if (pw && pw.offsetParent !== null) return true;
    } catch(e) {}
    // 备用：检查 unifiedReport 内是否有可见遮罩
    try {
        var ur = document.getElementById('unifiedReport');
        if (ur) {
            var overlays = ur.querySelectorAll('[style*="display"]');
            for (var i = 0; i < overlays.length; i++) {
                if (overlays[i].offsetParent !== null &&
                    (overlays[i].id === 'rptPaywall' || overlays[i].className.indexOf('paywall') >= 0)) {
                    return true;
                }
            }
        }
    } catch(e) {}
    // 兜底：检查 localStorage 解锁记录
    try {
        if (typeof iru === 'function') return !iru();
    } catch(e) {}
    return false;
}

// 付费内容 section ID 列表
var PAYWALLED_SECTIONS = ['thisYearSection', 'marriageSection', 'wealthSection', 'studySection', 'fortuneSection'];

function buildReportHTML() {
    var paywallActive = _isPaywallActive();
    var inheritedStyles = '';

    // PDF 在独立 iframe 中渲染。复制当前结果页样式，避免四柱、
    // 大运等组件因缺少原页面布局规则而退化成纵向文本或被裁切。
    try {
        if (document && typeof document.querySelectorAll === 'function') {
            Array.prototype.forEach.call(document.querySelectorAll('style'), function(styleNode) {
                inheritedStyles += styleNode.textContent || '';
            });
        }
    } catch (styleError) {}

    var sections = [
        { id: 'sizhuSection', title: '四柱解析', html: '', pageBreak: false },
        { id: 'dayunSection', title: '大运走势', html: '', pageBreak: false },
        { id: 'liunianSection', title: '流年运势', html: '', pageBreak: false },
        { id: 'proSection', title: '专业命理分析', html: '', pageBreak: true },
        { id: 'characterSection', title: '性格特征', html: '', pageBreak: false },
        { id: 'parentsSection', title: '父母关系', html: '', pageBreak: false },
        { id: 'thisYearSection', title: '今年运势参考', html: '', pageBreak: true, paywalled: true },
        { id: 'marriageSection', title: '感情婚姻参考', html: '', pageBreak: false, paywalled: true },
        { id: 'wealthSection', title: '财运分析参考', html: '', pageBreak: false, paywalled: true },
        { id: 'studySection', title: '学业发展参考', html: '', pageBreak: false, paywalled: true },
        { id: 'fortuneSection', title: '五年流年详批', html: '', pageBreak: false, paywalled: true }
    ];

    sections.forEach(function(sec) {
        var el = document.getElementById(sec.id);
        if (!el) return;

        // 付费内容且未解锁 → 占位提示
        if (sec.paywalled && paywallActive) {
            sec.html = '<div class="locked-placeholder">'
                + '<div class="locked-icon">🔒</div>'
                + '<p class="locked-title">此内容需积分解锁</p>'
                + '<p class="locked-desc">「' + sec.title + '」为深度命理分析内容，需使用积分兑换后查看完整报告。</p>'
                + '<p class="locked-hint">请返回知时官网（knowbazi.online）完成支付后，重新生成完整 PDF 报告。</p>'
                + '</div>';
            return;
        }

        var clone = el.cloneNode(true);
        // 移除所有遮罩和交互元素
        clone.querySelectorAll('.paywall-overlay,#rptPaywall,[id*="paywall"]').forEach(function(o) { o.remove(); });
        clone.querySelectorAll('.drawer-arrow,.toggle-icon').forEach(function(a) { a.remove(); });
        clone.querySelectorAll('button,.share-btn,.download-btn,.dl-btn').forEach(function(b) { b.remove(); });
        clone.querySelectorAll('.section-drawer').forEach(function(s) { s.classList.add('drawer-open'); });
        // 移除脚本标签
        clone.querySelectorAll('script').forEach(function(s) { s.remove(); });
        // 移除 onclick 等事件属性（避免打印页中误触）
        clone.querySelectorAll('[onclick]').forEach(function(el) { el.removeAttribute('onclick'); });

        // html2canvas 对嵌套 flex 命盘在部分 Android WebView 中会漏列、漏字。
        // 仅在导出副本中转成标准 table；网页本身的布局和交互不受影响。
        if (sec.id === 'sizhuSection' && typeof clone.querySelector === 'function') {
            var paipan = clone.querySelector('.paipan-table');
            if (paipan && paipan.ownerDocument) {
                var exportTable = paipan.ownerDocument.createElement('table');
                exportTable.className = 'pdf-paipan-table';
                Array.prototype.forEach.call(paipan.querySelectorAll('.pp-row'), function(row) {
                    if (row.hidden || row.classList.contains('pp-shensha-row')) return;
                    var tr = paipan.ownerDocument.createElement('tr');
                    Array.prototype.forEach.call(row.children, function(cell, cellIndex) {
                        var tagName = row.classList.contains('pp-header') ? 'th' : 'td';
                        var td = paipan.ownerDocument.createElement(tagName);
                        var colored = cell.querySelector('[style*="color"]');
                        var pieces = Array.prototype.map.call(cell.children, function(child) {
                            return (child.textContent || '').replace(/\s+/g, ' ').trim();
                        }).filter(Boolean);
                        var plainText = (cell.textContent || '').replace(/\s+/g, ' ').trim();
                        td.textContent = pieces.length > 1 ? pieces.join(' · ') : (plainText || (cellIndex === 0 ? '' : '—'));
                        if (cellIndex === 0) td.className = 'pdf-paipan-label';
                        if (colored && colored.style && colored.style.color) {
                            td.style.color = colored.style.color;
                        }
                        tr.appendChild(td);
                    });
                    exportTable.appendChild(tr);
                });
                paipan.parentNode.replaceChild(exportTable, paipan);
            }
        }
        sec.html = clone.innerHTML;
    });

    var gender = _params ? (_params.gender === 'male' ? '男' : '女') : '';
    var reportHasTiming = _params && (_params.mode !== 'pillars' || _params.timing === 'matched');
    var birthStr = reportHasTiming
        ? _params.year + '年' + _params.month + '月' + _params.day + '日'
        : '出生日期未定位';
    var hourStr = reportHasTiming ? (SHI_CHEN_NAMES && SHI_CHEN_NAMES[_params.hour]) || '' : '四柱直排';
    var provStr = (_params && _params.prov) ? ' · ' + _params.prov : '';
    var dateStr = new Date().toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'});
    var yearNum = reportHasTiming ? _params.year : '';

    var css = ''
    // ===== 基础重置 =====
    + '@font-face{font-family:"Zhishi Report Serif";src:url("/fonts/posters/NotoSerifSC-SemiBold.woff2") format("woff2");font-style:normal;font-weight:400 900;font-display:block}'
    + ':root{--gold:#c9a84c;--gold-light:#e2cb75;--gold-l:#e2cb75;--gold-glow:rgba(201,168,76,.35);--text-primary:#d5cebb;--text-secondary:#a79c87;--text-dim:#756f65;--tx2:#a79c87;--tx3:#756f65;--bd:rgba(201,168,76,.16)}'
    + '*{box-sizing:border-box}'
    + 'html{font-size:15px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{max-width:820px;margin:0 auto;font-family:"Zhishi Report Serif","Source Han Serif SC","Noto Serif SC","PingFang SC","Songti SC","SimSun",serif;color:#d5cebb;background:#0d0f18;padding:0;line-height:1.8;orphans:3;widows:3}'

    // ===== 封面 =====
    + '.cover{text-align:center;padding:90px 30px 70px;background:linear-gradient(180deg,#111320 0%,#0d0f18 100%);position:relative;border-bottom:1px solid rgba(201,168,76,.1);page-break-after:always}'
    + '.cover::before{content:"";position:absolute;top:35%;left:50%;transform:translate(-50%,-50%);width:320px;height:320px;border-radius:50%;border:1px solid rgba(201,168,76,.08);background:radial-gradient(circle,rgba(201,168,76,.02) 0%,transparent 70%)}'
    + '.cover .brand{font-size:64px;color:#d4b850;letter-spacing:24px;font-weight:900;margin-bottom:14px;position:relative}'
    + '.cover .tagline{font-size:18px;color:#a09060;letter-spacing:12px;margin-bottom:50px;position:relative}'
    + '.cover .cover-divider{width:60px;height:1px;margin:0 auto 40px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.3),transparent)}'
    + '.cover .info{display:inline-block;padding:20px 36px;border:1px solid rgba(201,168,76,.15);border-radius:14px;color:#a89878;font-size:15px;letter-spacing:2px;line-height:2.2;position:relative;background:rgba(201,168,76,.02)}'
    + '.cover .info strong{color:#d8c060;font-weight:600}'
    + '.cover .info .birth-label{font-size:11px;color:#8a8070;letter-spacing:4px}'

    // ===== 区块标题 =====
    + '.section{margin:0;padding:0 36px;page-break-inside:avoid}'
    + '.section.break-before{page-break-before:always}'
    + '.section-title{font-size:22px;color:#d0b850;text-align:center;margin:48px 0 28px;letter-spacing:8px;font-weight:700;position:relative;page-break-after:avoid}'
    + '.section-title::after{content:"";display:block;width:50px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.25),transparent);margin:14px auto 0}'
    + '.section-subtitle{font-size:13px;color:#8a8070;text-align:center;margin:-16px 0 24px;letter-spacing:3px;font-weight:400}'

    // ===== 表格 =====
    + 'table{width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;page-break-inside:avoid}'
    + 'thead{display:table-header-group}'
    + 'th,td{padding:11px 10px;text-align:center;border:1px solid rgba(255,255,255,.06);vertical-align:middle}'
    + 'th{background:rgba(201,168,76,.07);color:#d4b850;font-weight:600;font-size:12px;letter-spacing:2px;white-space:nowrap}'
    + 'td{color:#b8a888;font-size:13px}'
    + 'tr:nth-child(even) td{background:rgba(255,255,255,.01)}'
    + '.pdf-paipan-table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;margin:0 0 12px!important}'
    + '.pdf-paipan-table th,.pdf-paipan-table td{height:48px!important;padding:7px 4px!important;border:1px solid rgba(201,168,76,.1)!important;white-space:normal!important;word-break:keep-all!important;color:#d5cebb;font-size:13px!important;line-height:1.35!important}'
    + '.pdf-paipan-table th{height:40px!important;color:#d4b850!important;background:rgba(201,168,76,.06)!important}'
    + '.pdf-paipan-table th:first-child,.pdf-paipan-table td:first-child{width:56px!important;color:#857d70!important;font-size:11px!important}'
    + '.pdf-paipan-table th:nth-child(2),.pdf-paipan-table td:nth-child(2),.pdf-paipan-table th:nth-child(3),.pdf-paipan-table td:nth-child(3){width:80px!important}'
    + '.pdf-paipan-table tr:nth-child(3) td:not(:first-child),.pdf-paipan-table tr:nth-child(4) td:not(:first-child){font-size:24px!important;font-weight:700!important}'

    // ===== 抽屉/正文 =====
    + '.drawer-body{color:#b0a090;font-size:14px;line-height:2.0;padding:10px 0}'
    + '.drawer-body p,.drawer-body div{margin-bottom:12px;color:#b0a090}'
    + '.drawer-body .highlight,.drawer-body strong,.drawer-body b{color:#d8be58;font-weight:600}'
    + '.drawer-body .text-dim,.drawer-body .text-muted{color:#7a7880}'
    + '.section-header h2,.section-title-row{font-size:18px!important;color:#c0a040!important;text-align:center;margin:28px 0 14px!important;letter-spacing:5px}'

    // ===== 卡片/行 =====
    + '.item-row,.wl-row,.pr-card{background:rgba(255,255,255,.02);border-radius:10px;padding:16px 18px;margin-bottom:12px;border:1px solid rgba(255,255,255,.04);page-break-inside:avoid}'
    + '.wl-wang-bar{padding:11px 14px;background:rgba(255,255,255,.015);border-radius:8px;margin:5px 0;page-break-inside:avoid}'
    + '.wl-wang-bar b,.wl-wang-bar strong{color:#d8be58}'

    // ===== 神煞标签 =====
    + '.shensha-tag,.tag{display:inline-block;padding:3px 12px;border-radius:4px;font-size:12px;margin:3px;background:rgba(201,168,76,.08);color:#d0b858;border:1px solid rgba(201,168,76,.15)}'
    + '.shensha-tag.ji-shen,.tag.good{background:rgba(100,180,120,.08);color:#9c9;border-color:rgba(100,180,120,.15)}'
    + '.shensha-tag.xiong-sha,.tag.bad{background:rgba(200,100,100,.08);color:#c99;border-color:rgba(200,100,100,.15)}'

    // ===== 大运/流年 =====
    + '.dayun-table td.active,.dayun-table td.current{background:rgba(201,168,76,.1);font-weight:600;color:#e0c860}'
    + '.liunian-col{display:inline-block;min-width:74px;text-align:center;padding:10px 6px;border:1px solid rgba(255,255,255,.04);border-radius:8px;margin:5px;font-size:12px;color:#a0a090}'
    + '.liunian-col.current-year{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.3);font-weight:600;color:#d8be58}'

    // PDF 横向命盘与运势表必须完整展开，不能保留网页滚动裁切。
    + '.paipan-table{width:100%!important;max-width:100%!important;overflow:visible!important}'
    + '.pp-row{display:grid!important;grid-template-columns:56px 80px 80px repeat(4,minmax(0,1fr))!important;width:100%!important}'
    + '.pp-label{min-width:0!important}'
    + '.pp-col{display:block!important;min-width:0!important;text-align:center!important}'
    + '.pp-dayun-col,.pp-liunian-col{min-width:0!important}'
    + '.pp-cang-row .pp-col,.pp-fuxing-row .pp-col{display:flex!important;align-items:center!important;justify-content:center!important}'
    + '.pp-col>span{opacity:1!important;visibility:visible!important}'
    + '.dayun-scroll-wrapper,.liunian-scroll-wrapper{overflow:visible!important;width:100%!important}'
    + '.dayun-table,.liunian-table{display:flex!important;width:max-content!important;min-width:100%!important}'

    // ===== 占位（付费内容未解锁） =====
    + '.locked-placeholder{text-align:center;padding:48px 24px;margin:20px 0;border:2px dashed rgba(201,168,76,.15);border-radius:14px;background:rgba(201,168,76,.02);page-break-inside:avoid}'
    + '.locked-placeholder .locked-icon{font-size:40px;margin-bottom:12px;opacity:.6}'
    + '.locked-placeholder .locked-title{font-size:17px;color:#c0a040;font-weight:700;margin-bottom:8px;letter-spacing:3px}'
    + '.locked-placeholder .locked-desc{font-size:13px;color:#8a8078;line-height:1.8;margin-bottom:6px}'
    + '.locked-placeholder .locked-hint{font-size:11px;color:#6a6860;line-height:1.6;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.04)}'

    // ===== 页脚 =====
    + '.footer{text-align:center;padding:50px 36px 40px;border-top:1px solid rgba(255,255,255,.04);margin-top:50px;color:#5a5860;font-size:12px;line-height:2.2;letter-spacing:1px}'
    + '.footer .footer-brand{font-size:15px;color:#a09060;letter-spacing:6px;font-weight:600}'

    // ===== 屏幕操作栏 =====
    + '.no-print{text-align:center;padding:16px 0}'
    + '.no-print .toolbar{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}'
    + '.no-print button{display:inline-flex;align-items:center;gap:6px;margin:0;padding:12px 28px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);color:#d8c060;font-size:15px;font-weight:600;border-radius:10px;cursor:pointer;letter-spacing:3px;font-family:inherit;transition:all .2s}'
    + '.no-print button:hover{background:rgba(201,168,76,.18);transform:translateY(-1px)}'
    + '.no-print button.primary{background:linear-gradient(135deg,rgba(180,140,50,.3),rgba(201,168,76,.15));border-color:rgba(201,168,76,.4);color:#e8d070}'

    // ===== 打印样式 =====
    + '@media print{'
    + 'html,body{background:#fff!important;color:#222!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:14px}'
    + '.cover{background:#fafaf5!important;padding:60px 0 50px;border-bottom:2px solid #d8c060!important;page-break-after:always}'
    + '.cover::before{display:none}'
    + '.cover .brand{color:#8a7030!important}'
    + '.cover .tagline{color:#a09060!important}'
    + '.cover .info{color:#6a6050!important;border-color:rgba(180,150,60,.3)!important;background:#fafaf0!important}'
    + '.cover .info strong{color:#8a7030!important}'
    + '.section{padding:0!important}'
    + '.section-title{color:#8a7030!important;font-size:20px!important;margin:36px 0 22px!important;page-break-after:avoid}'
    + '.section-title::after{background:rgba(180,150,60,.3)!important}'
    + '.no-print{display:none!important}'
    + 'table th{background:#f5f0e0!important;color:#4a4030!important;border-color:#ddd!important}'
    + 'table td{color:#444!important;border-color:#e8e8e0!important}'
    + 'tr:nth-child(even) td{background:#fafaf5!important}'
    + '.drawer-body,.drawer-body p,.drawer-body div{color:#333!important}'
    + '.drawer-body .highlight,.drawer-body strong,.drawer-body b{color:#6a5020!important}'
    + '.drawer-body .text-dim,.drawer-body .text-muted{color:#888!important}'
    + '.item-row,.wl-row,.pr-card{background:#fafaf5!important;border-color:#e8e8e0!important;color:#333!important}'
    + '.wl-wang-bar{background:#fafaf5!important}'
    + '.wl-wang-bar b,.wl-wang-bar strong{color:#6a5020!important}'
    + '.shensha-tag,.tag{background:rgba(180,150,60,.08)!important;color:#6a5020!important;border-color:rgba(180,150,60,.2)!important}'
    + '.shensha-tag.ji-shen,.tag.good{background:rgba(100,160,100,.08)!important;color:#4a7040!important;border-color:rgba(100,160,100,.2)!important}'
    + '.shensha-tag.xiong-sha,.tag.bad{background:rgba(200,100,100,.06)!important;color:#8a4040!important;border-color:rgba(200,100,100,.15)!important}'
    + '.dayun-table td.active,.dayun-table td.current{background:rgba(201,168,76,.15)!important;color:#6a5020!important;font-weight:700}'
    + '.liunian-col.current-year{background:rgba(201,168,76,.15)!important;border-color:rgba(201,168,76,.35)!important;color:#6a5020!important;font-weight:700}'
    + '.locked-placeholder{border-color:rgba(180,150,60,.25)!important;background:#fafaf0!important}'
    + '.locked-placeholder .locked-title{color:#8a7030!important}'
    + '.footer{color:#8a8a80!important;border-top-color:#e0e0d8!important}'
    + '.footer .footer-brand{color:#a09060!important}'
    + 'h2,h3{color:#6a5020!important}'
    + '@page{size:A4;margin:16mm 14mm 18mm 14mm;'
    +   '@top-center{content:"知时 · 命理分析报告";font-size:9px;color:#b0a090;font-family:"Source Han Serif SC",serif}'
    +   '@bottom-center{content:"— " counter(page) " —";font-size:9px;color:#b0a090;font-family:"Source Han Serif SC",serif}'
    + '}'
    + '@page:first{@top-center{content:none}}'
    + '}';

    // ===== 组装 HTML =====
    var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>知时命理报告 · ' + (gender==='男'?'乾造':'坤造') + ' · ' + birthStr + '</title>\n'
    + '<style>' + inheritedStyles + '\n' + css + '</style>\n'
    + '</head>\n<body>\n'

    // 屏幕操作栏（打印时隐藏）
    + '<div class="no-print">'
    + '<div class="toolbar">'
    + '<button class="primary" onclick="window.print()">📄 保存为 PDF</button>'
    + '<button onclick="window.close()">✕ 关闭页面</button>'
    + '</div>'
    + '<p style="color:#8a8070;font-size:12px;margin-top:8px;letter-spacing:1px">点击「保存为 PDF」→ 目标另存为 PDF → 保存</p>'
    + '</div>\n'

    // 封面
    + '<div class="cover">\n'
    + '<div class="brand">知 时</div>\n'
    + '<div class="tagline">知 天 时 · 见 自 己</div>\n'
    + '<div class="cover-divider"></div>\n'
    + '<div class="info">\n'
    + '<div class="birth-label">命 造 信 息</div>\n'
    + '<strong>' + gender + '造</strong> · ' + birthStr + '<br>\n'
    + (yearNum ? yearNum + '年 ' : '') + hourStr + provStr + '<br>\n'
    + '<span style="font-size:12px;color:#8a8070">分析日期：' + dateStr + '</span>\n'
    + '</div>\n</div>\n';

    // 各区块
    var used = {};
    sections.forEach(function(sec) {
        if (!sec.html || sec.html.length < 20) return;
        if (sec.title && !used[sec.title]) {
            var cls = 'section';
            if (sec.pageBreak) cls += ' break-before';
            html += '<div class="' + cls + '"><div class="section-title">' + sec.title + '</div>' + sec.html + '</div>\n';
            used[sec.title] = true;
        }
    });

    // 页脚
    html += '<div class="footer">'
    + '<div class="footer-brand">知 时</div>'
    + '<div>本报告由知时（knowbazi.online）AI 命理系统生成</div>'
    + '<div>仅供学习参考与娱乐交流，不构成任何决策建议</div>'
    + '<div style="margin-top:4px;font-size:11px">知天时 · 见自己</div>'
    + '</div>\n'

    // 自动触发打印（延迟确保渲染完成）
    + '<script>'
    + '(function(){'
    + 'var autoPrint=sessionStorage.getItem("zhishi_auto_print");'
    + 'if(autoPrint==="1"){sessionStorage.removeItem("zhishi_auto_print");setTimeout(function(){window.print();},800);}'
    + '})();'
    + '<\/script>\n'

    + '</body>\n</html>';

    return html;
}

// ==================== 移动端 PDF 操作面板 ====================
var _preparedReportPdfFile = null;
var _preparedReportPdfFilename = '';
var _reportPdfPreviousFocus = null;
var _reportPdfGenerationId = 0;
var _reportPdfPreviousBodyOverflow = '';
var _reportPdfBackgroundState = [];
var _reportPdfSheetOpen = false;
var _reportPdfAbortController = null;
var _reportPdfPreparationPromise = null;

function reportFilename(extension) {
    var reportName = '';
    if (_params && _params.mode === 'pillars' && _params.enteredPillars) {
        reportName = ['year','month','day','hour'].map(function(position) {
            var pillar = _params.enteredPillars[position];
            return pillar.gan + pillar.zhi;
        }).join('');
    } else if (_params) {
        reportName = _params.year + '' + _params.month + _params.day;
    }
    return '知时报告_' + reportName + extension;
}

function updatePdfProgress(value) {
    var progress = document.getElementById('reportPdfProgress');
    var bar = document.getElementById('reportPdfProgressBar');
    var normalized = Math.max(0, Math.min(100, Number(value) || 0));
    if (progress) progress.setAttribute('aria-valuenow', String(normalized));
    if (bar) bar.style.width = normalized + '%';
}

function setMobileReportPdfStatus(message) {
    var status = document.getElementById('reportPdfStatus');
    if (status) status.textContent = message;
}

function suppressReportPdfBackground(sheet) {
    var body = document.body;
    var children;
    if (!body) return;
    _reportPdfPreviousBodyOverflow = body.style ? body.style.overflow : '';
    if (body.style) body.style.overflow = 'hidden';
    children = body.children ? Array.prototype.slice.call(body.children) : [];
    _reportPdfBackgroundState = children.filter(function(child) {
        return child !== sheet;
    }).map(function(child) {
        var supportsInert = 'inert' in child;
        var state = {
            element: child,
            supportsInert: supportsInert,
            inert: supportsInert ? child.inert : false,
            ariaHidden: typeof child.getAttribute === 'function'
                ? child.getAttribute('aria-hidden')
                : null
        };
        if (supportsInert) {
            child.inert = true;
        } else if (typeof child.setAttribute === 'function') {
            child.setAttribute('aria-hidden', 'true');
        }
        return state;
    });
}

function restoreReportPdfBackground() {
    var body = document.body;
    _reportPdfBackgroundState.forEach(function(state) {
        var child = state.element;
        if (state.supportsInert) {
            child.inert = state.inert;
        } else if (state.ariaHidden === null) {
            if (typeof child.removeAttribute === 'function') child.removeAttribute('aria-hidden');
        } else if (typeof child.setAttribute === 'function') {
            child.setAttribute('aria-hidden', state.ariaHidden);
        }
    });
    _reportPdfBackgroundState = [];
    if (body && body.style) body.style.overflow = _reportPdfPreviousBodyOverflow;
    _reportPdfPreviousBodyOverflow = '';
}

function openMobileReportPdfSheet() {
    var sheet = document.getElementById('reportPdfSheet');
    var close = document.getElementById('reportPdfClose');
    if (!sheet) return;
    if (_reportPdfSheetOpen) return;
    _reportPdfSheetOpen = true;
    _reportPdfPreviousFocus = document.activeElement;
    sheet.hidden = false;
    if (close && typeof close.focus === 'function') close.focus();
    suppressReportPdfBackground(sheet);
}

function closeMobileReportPdfSheet() {
    var sheet = document.getElementById('reportPdfSheet');
    var downloadButton = document.getElementById('reportPdfDownload');
    var shareButton = document.getElementById('reportPdfShare');
    if (!sheet) return;
    _reportPdfGenerationId += 1;
    if (_reportPdfAbortController && !_reportPdfAbortController.signal.aborted) {
        _reportPdfAbortController.abort();
    }
    _preparedReportPdfFile = null;
    _preparedReportPdfFilename = '';
    if (downloadButton) downloadButton.disabled = true;
    if (shareButton) shareButton.disabled = true;
    updatePdfProgress(0);
    setMobileReportPdfStatus('准备生成 PDF');
    sheet.hidden = true;
    if (!_reportPdfSheetOpen) return;
    _reportPdfSheetOpen = false;
    restoreReportPdfBackground();
    if (_reportPdfPreviousFocus && typeof _reportPdfPreviousFocus.focus === 'function') {
        _reportPdfPreviousFocus.focus();
    }
    _reportPdfPreviousFocus = null;
}

function canSharePreparedReportPdf(file) {
    try {
        return !!(file && typeof navigator.share === 'function'
            && navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (error) {
        return false;
    }
}

function prepareMobileReportPdf() {
    var downloadButton = document.getElementById('reportPdfDownload');
    var shareButton = document.getElementById('reportPdfShare');
    var previousPreparation = _reportPdfPreparationPromise;
    var generationId = ++_reportPdfGenerationId;
    var filename = reportFilename('.pdf');
    var controller;
    var operation;

    if (_reportPdfAbortController && !_reportPdfAbortController.signal.aborted) {
        _reportPdfAbortController.abort();
    }

    _preparedReportPdfFile = null;
    _preparedReportPdfFilename = '';
    if (downloadButton) downloadButton.disabled = true;
    if (shareButton) shareButton.disabled = true;
    setMobileReportPdfStatus('正在生成报告……');
    updatePdfProgress(0);
    openMobileReportPdfSheet();

    if (typeof window.AbortController !== 'function') {
        updatePdfProgress(0);
        setMobileReportPdfStatus('PDF 生成失败，请使用下方“下载 HTML 备用”保存报告。');
        return Promise.resolve(null);
    }

    controller = new window.AbortController();
    _reportPdfAbortController = controller;

    function handlePreparationFailure(error) {
        if (generationId !== _reportPdfGenerationId
            || controller.signal.aborted
            || (error && error.name === 'AbortError')) {
            return null;
        }
        _preparedReportPdfFile = null;
        _preparedReportPdfFilename = '';
        if (downloadButton) downloadButton.disabled = true;
        if (shareButton) shareButton.disabled = true;
        updatePdfProgress(0);
        setMobileReportPdfStatus('PDF 生成失败，请使用下方“下载 HTML 备用”保存报告。');
        return null;
    }

    function startPreparation() {
        var html;
        var pending;
        if (generationId !== _reportPdfGenerationId || controller.signal.aborted) {
            return null;
        }
        try {
            html = buildReportHTML();
            if (!window.ReportPdf || typeof window.ReportPdf.prepare !== 'function') {
                throw new Error('PDF 组件未加载');
            }
            pending = window.ReportPdf.prepare({
                html: html,
                filename: filename,
                signal: controller.signal,
                onProgress: function(value) {
                    if (generationId === _reportPdfGenerationId
                        && !controller.signal.aborted) {
                        updatePdfProgress(value);
                    }
                }
            });
        } catch (error) {
            return handlePreparationFailure(error);
        }

        return Promise.resolve(pending).then(function(file) {
            if (generationId !== _reportPdfGenerationId || controller.signal.aborted) {
                return null;
            }
            _preparedReportPdfFile = file;
            _preparedReportPdfFilename = filename;
            updatePdfProgress(100);
            setMobileReportPdfStatus(canSharePreparedReportPdf(file)
                ? 'PDF 已生成，手机建议使用“保存或分享”存入文件。'
                : 'PDF 已生成，可直接下载；若未响应请使用 HTML 备用。');
            if (downloadButton) downloadButton.disabled = false;
            if (shareButton) shareButton.disabled = !canSharePreparedReportPdf(file);
            return file;
        }, handlePreparationFailure);
    }

    if (previousPreparation) {
        operation = Promise.resolve(previousPreparation).catch(function() {
            return null;
        }).then(startPreparation);
    } else {
        operation = Promise.resolve(startPreparation());
    }

    _reportPdfPreparationPromise = operation;
    operation.then(function() {
        if (_reportPdfPreparationPromise === operation) {
            _reportPdfPreparationPromise = null;
        }
        if (_reportPdfAbortController === controller) {
            _reportPdfAbortController = null;
        }
    });
    return operation;
}

function initMobileReportPdfActions() {
    var sheet = document.getElementById('reportPdfSheet');
    var close = document.getElementById('reportPdfClose');
    var downloadButton = document.getElementById('reportPdfDownload');
    var shareButton = document.getElementById('reportPdfShare');
    var htmlFallback = document.getElementById('reportHtmlFallback');
    if (!sheet || !close || !downloadButton || !shareButton || !htmlFallback) return;

    close.addEventListener('click', closeMobileReportPdfSheet);
    sheet.addEventListener('click', function(event) {
        if (event.target === sheet) closeMobileReportPdfSheet();
    });
    downloadButton.addEventListener('click', function() {
        if (downloadButton.disabled || !_preparedReportPdfFile) return;
        try {
            window.ReportPdf.download(_preparedReportPdfFile, _preparedReportPdfFilename);
        } catch (error) {
            setMobileReportPdfStatus('下载未能开始，请重试或下载 HTML 备用。');
        }
    });
    shareButton.addEventListener('click', function() {
        var file = _preparedReportPdfFile;
        if (shareButton.disabled || !file) return;
        if (!(typeof navigator.share === 'function'
            && navigator.canShare && navigator.canShare({ files: [file] }))) {
            shareButton.disabled = true;
            setMobileReportPdfStatus('当前浏览器不支持文件分享，请使用“下载 PDF”。');
            return;
        }
        Promise.resolve(navigator.share({
            files: [file],
            title: '知时命理报告'
        })).catch(function(error) {
            if (error && error.name === 'AbortError') return;
            setMobileReportPdfStatus('分享未完成，PDF 仍可直接下载。');
        });
    });
    htmlFallback.addEventListener('click', function() {
        downloadReport();
    });
    document.addEventListener('keydown', function(event) {
        var controls;
        var currentIndex;
        var nextIndex;
        if (sheet.hidden) return;
        if (event.key === 'Escape') {
            if (typeof event.preventDefault === 'function') event.preventDefault();
            closeMobileReportPdfSheet();
        } else if (event.key === 'Tab') {
            controls = [close, downloadButton, shareButton, htmlFallback].filter(function(control) {
                return control && !control.hidden && !control.disabled;
            });
            if (!controls.length) return;
            currentIndex = controls.indexOf(document.activeElement);
            if (event.shiftKey) {
                nextIndex = currentIndex <= 0 ? controls.length - 1 : currentIndex - 1;
            } else {
                nextIndex = currentIndex < 0 || currentIndex === controls.length - 1
                    ? 0
                    : currentIndex + 1;
            }
            if (typeof event.preventDefault === 'function') event.preventDefault();
            if (typeof controls[nextIndex].focus === 'function') controls[nextIndex].focus();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileReportPdfActions);
} else {
    initMobileReportPdfActions();
}

// 直接下载 HTML 文件
function downloadReport() {
    var html = buildReportHTML();
    var blob = new Blob([html], { type: 'text/html;charset=UTF-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var fn = reportFilename('.html');
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 在新标签页打开报告（自动弹出打印对话框）
function openReportInNewTab() {
    if (typeof isMobile === 'function' && isMobile()) {
        return prepareMobileReportPdf();
    }

    // 设置标记：新标签页加载后自动弹出打印
    try { sessionStorage.setItem('zhishi_auto_print', '1'); } catch(e) {}

    var html = buildReportHTML();
    var blob = new Blob([html], { type: 'text/html;charset=UTF-8' });
    var url = URL.createObjectURL(blob);

    // 桌面端：新标签页打开 + 自动弹出打印
    var w = window.open(url, '_blank');
    if (!w) {
        alert('请允许弹出窗口以打开报告。如已允许但仍无法打开，请检查浏览器设置。');
        // 清理标记
        try { sessionStorage.removeItem('zhishi_auto_print'); } catch(e) {}
        return;
    }
    // 60 秒后释放 blob（给足打印时间）
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
}

// 快捷方法：一键打印（直接在当前窗口触发）
function printReportNow() {
    var html = buildReportHTML();
    var blob = new Blob([html], { type: 'text/html;charset=UTF-8' });
    var url = URL.createObjectURL(blob);
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;background:#fff';
    iframe.src = url;
    iframe.onload = function() {
        setTimeout(function() {
            try { iframe.contentWindow.print(); } catch(e) {}
            setTimeout(function() {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(url);
            }, 1000);
        }, 500);
    };
    document.body.appendChild(iframe);
}

// ==================== 反馈机制 ====================
function showFeedback() {
    document.getElementById('feedbackOverlay').style.display = 'flex';
    document.getElementById('feedbackResult').textContent = '';
    document.getElementById('feedbackMsg').value = '';
    document.getElementById('feedbackContact').value = '';
}

function closeFeedback(e) {
    if (e && e.target !== document.getElementById('feedbackOverlay')) return;
    document.getElementById('feedbackOverlay').style.display = 'none';
}

function submitFeedback() {
    var msg = document.getElementById('feedbackMsg').value.trim();
    if (!msg) {
        document.getElementById('feedbackResult').textContent = '请先写下你的想法';
        return;
    }
    var contact = document.getElementById('feedbackContact').value.trim();
    var btn = document.querySelector('.feedback-submit');
    btn.disabled = true;
    btn.textContent = '提交中...';
    document.getElementById('feedbackResult').textContent = '';

    // 收集当前八字信息做上下文
    var ctx = {};
    if (_params) {
        var feedbackHasTiming = _params.mode !== 'pillars' || _params.timing === 'matched';
        if (feedbackHasTiming) {
            ctx.year = _params.year; ctx.month = _params.month; ctx.day = _params.day;
            ctx.hour = _params.hour;
        }
        ctx.gender = _params.gender; ctx.prov = _params.prov || '';
        if (_params.mode === 'pillars') {
            ctx.mode = _params.mode; ctx.timing = _params.timing;
            ctx.enteredPillars = _params.enteredPillars;
        }
    }

    fetch('/api/feedback.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, contact: contact, context: ctx })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.ok) {
            document.getElementById('feedbackResult').textContent = '✓ 感谢你的反馈！我们会认真对待每一条建议';
            setTimeout(function() { closeFeedback(); }, 2000);
        } else {
            document.getElementById('feedbackResult').textContent = '提交失败，请稍后重试';
        }
    })
    .catch(function() {
        document.getElementById('feedbackResult').textContent = '网络错误，请稍后重试';
    })
    .finally(function() {
        btn.disabled = false;
        btn.textContent = '提交反馈';
    });
}

// ============ v3.0 ============
function renderPillarAnalysis(bazi){console.log("PILLAR CALLED");var c=document.getElementById('pillarAnalysis');if(!c)return;var m={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};var cl={'木':'#6db86d','火':'#e07050','土':'#c9a84c','金':'#e8d5a3','水':'#5b9fd4'};var sg={'木':'火','火':'土','土':'金','金':'水','水':'木'};var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};var ps=['year','month','day','hour'],ns=['年柱','月柱','日柱','时柱'];var h='<div style="display:flex;justify-content:center;align-items:center;gap:4px;flex-wrap:wrap;padding:8px 0">';for(var i=0;i<4;i++){var p=bazi[ps[i]],g=p.gan,w=m[g]||'?';h+='<div style="text-align:center;background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:10px;padding:8px 12px;min-width:55px">';h+='<div style="font-size:10px;color:var(--tx3)">'+ns[i]+'</div>';h+='<div style="font-size:20px;font-weight:700;color:'+(cl[w]||'#fff')+'">'+g+'</div>';h+='<div style="font-size:13px;color:var(--tx2)">'+p.zhi+'</div>';if(i===2)h+='<div style="font-size:9px;color:var(--gold-l)">☀日主</div>';h+='</div>';if(i<3){var w2=m[bazi[ps[i+1]].gan],rel='';if(sg[w]===w2)rel='<span style="color:#4f8;font-size:14px">生➡</span>';else if(ke[w]===w2)rel='<span style="color:#f44;font-size:14px">克➡</span>';else if(sg[w2]===w)rel='<span style="color:#4f8;font-size:14px">⬅生</span>';else if(ke[w2]===w)rel='<span style="color:#f44;font-size:14px">⬅克</span>';else rel='<span style="color:#888">—</span>';h+='<div style="min-width:30px;text-align:center">'+rel+'</div>';}}h+='</div><div style="text-align:center;font-size:10px;color:var(--tx3);margin-bottom:8px">🟢相生 🔴相克 箭头→被影响方</div>';c.innerHTML=h}
function renderDayMasterPower(bazi,facts){var c=document.getElementById('dayMasterPower');if(!c)return;var r;try{r=facts&&facts.strength?facts.strength:calcDayMasterStrength(bazi)}catch(e){r={score:50,level:'中和',detail:'日主中和'}}var l=r.score||50;var lb=r.level||'中和';var co=(lb==='极强'||lb==='偏强')?'#e44':lb==='中和'?'#ca4':'#48f';var h='<div style="display:flex;align-items:center;gap:8px;padding:4px 0">';h+='<span style="font-size:11px;color:var(--tx3)">身弱</span>';h+='<div style="flex:1;height:8px;background:rgba(255,255,255,.1);border-radius:4px"><div style="width:'+l+'%;height:100%;background:'+co+';border-radius:4px"></div></div>';h+='<span style="font-size:11px;color:var(--tx3)">身强</span>';h+='<span style="font-weight:700;color:'+co+';font-size:15px;margin-left:8px">'+lb+'</span></div>';h+='<p style="color:var(--tx2);font-size:11px;margin-top:4px;line-height:1.6">'+r.detail+'</p>';var ry=facts&&facts.renYuan;if(ry&&ry.visible&&ry.text)h+='<p class="renyuan-note" style="color:var(--tx3);font-size:9px;margin-top:3px;line-height:1.55">'+ry.text+'</p>';c.innerHTML=h}
function renderPattern(bazi,facts){var c=document.getElementById('patternAnalysis');if(!c)return;var p;try{p=facts&&facts.pattern?facts.pattern:(typeof BaZiCalculator!=='undefined'&&BaZiCalculator.getPattern?BaZiCalculator.getPattern(bazi):null)}catch(e){p=null}if(!p||!p.name){c.innerHTML='<p style="color:var(--gold-l);font-size:15px;font-weight:700;margin-bottom:4px">格局不显</p><p style="color:var(--tx2);font-size:12px;line-height:1.6">需结合天干透出与地支合局综合判断。</p>';return}var source=p.source||('月令'+p.monthZhi+' · 五行'+p.monthWx);var broken=p.status==='破格'?'<p style="color:#a45b4f;font-size:10px;margin:2px 0 5px">破格'+(p.breakReasons&&p.breakReasons.length?' · '+p.breakReasons.join('；'):'')+'</p>':'';c.innerHTML='<p style="color:var(--gold-l);font-size:15px;font-weight:700;margin-bottom:4px">'+p.name+(p.congGe?'<span style="display:inline-block;font-size:9px;font-weight:700;color:#1a1408;background:#e8c05a;border-radius:8px;padding:1px 7px;margin-left:5px;vertical-align:2px">从格</span>':'')+'</p>'+broken+'<p style="color:var(--tx2);font-size:12px;line-height:1.6">'+p.desc+'</p><p style="color:var(--tx3);font-size:10px;margin-top:2px">'+source+'</p>'}
function renderYongJi(bazi,facts){var c=document.getElementById('yongJiAnalysis');if(!c)return;var yj;try{yj=facts&&facts.yongJi?facts.yongJi:(typeof BaZiCalculator!=='undefined'&&BaZiCalculator.getYongJi?BaZiCalculator.getYongJi(bazi):null)}catch(e){yj=null}if(!yj){c.innerHTML='<p style="color:var(--tx2);font-size:12px">喜用忌神数据暂不可用</p>';return}var wxColors={'木':'#6db86d','火':'#e07050','土':'#c9a84c','金':'#b99a54','水':'#5b9fd4'};var tag=function(wx){return'<span style="display:inline-block;padding:3px 12px;margin:2px;border-radius:12px;font-size:12px;font-weight:700;color:#fff;background:'+(wxColors[wx]||'#888')+'">'+wx+'</span>'};var h='<p style="color:var(--tx2);font-size:11px;line-height:1.6;margin-bottom:8px"><b style="color:var(--gold-l)">'+(yj.method||'扶抑为主')+'</b> · '+(yj.primaryReason||yj.reasoning||'')+'</p>';[['用神',yj.yongShen],['喜神',yj.xiShen],['忌神',yj.jiShen]].forEach(function(group){h+='<div style="margin-bottom:8px"><span style="font-size:12px;color:var(--tx3)">'+group[0]+'</span><br>'+(group[1]&&group[1].length?group[1].map(tag).join(' '):'<span style="color:var(--tx3)">—</span>')+'</div>'});c.innerHTML=h}
