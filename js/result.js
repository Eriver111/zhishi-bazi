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
    return {
        year: parseInt(p.get('year')),
        month: parseInt(p.get('month')),
        day: parseInt(p.get('day')),
        hour: parseInt(p.get('hour')),
        gender: p.get('gender'),
        prov: p.get('prov') || '',
        minute: parseInt(p.get('minute')) || 0,
        clock: parseInt(p.get('clock')) || 0
    };
}

// ==================== 全局状态 ====================
let _daYunData = null;
let _dayGan = null;
let _bazi = null;
let _currentDaYunIndex = -1;
let _currentLiuNianIndex = -1;
let _nativeShenSha = [];  // 四柱神煞
let // shensha removed   // 大运柱神煞
let // shensha removed // 流年柱神煞
let _params = null;       // URL参数（供后续函数使用）

// ==================== 主渲染 ====================
function render(data) {
    const bazi = data.bazi;
    _bazi = bazi;  // 存储供 renderPaidContent 使用
    const dayGan = bazi.day.gan;
    const currentYear = new Date().getFullYear();

    // 顶部信息
    document.getElementById('genderLabel').textContent = bazi.gender === 'male' ? '乾造' : '坤造';
    document.getElementById('birthDateText').textContent =
        `${bazi.birthDate.year}年${bazi.birthDate.month}月${bazi.birthDate.day}日`;

    // 时辰显示：若经真太阳时调整后不同，标注原始北京时间
    var hourText = `${SHI_CHEN_NAMES[bazi.birthDate.hour]}（${SHI_CHEN_TIMES[bazi.birthDate.hour]}）`;
    if (bazi.originalHour !== undefined && bazi.originalHour !== bazi.birthDate.hour) {
        hourText += ' <span style="font-size:11px;color:var(--gold)">真太阳时</span>';
        hourText += ' <span style="font-size:10px;color:var(--text-dim)">原北京时间：' + SHI_CHEN_NAMES[bazi.originalHour] + '</span>';
    } else if (bazi.solarInfo && bazi.solarInfo.lng !== 120) {
        hourText += ' <span style="font-size:10px;color:var(--text-dim)">（经度已校正）</span>';
    }
    document.getElementById('birthHourText').innerHTML = hourText;
    document.getElementById('nayinText').textContent = bazi.naYin;

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

    // 四柱主盘（固定四柱）
    renderSiZhu(bazi, dayGan);

    // 更新表格中的大运/流年列
    updateDayunColumn(currentDaYunIdx);
    updateLiuNianColumn(currentDaYun, _currentLiuNianIndex);

    // 神煞
    _nativeShenSha = data.shenSha;
    _dayunShenSha = [];
    _liunianShenSha = [];
    // shensha removed

    // 五行
    // wuxing merged into pro analysis

    // 日主解析 · 滴天髓
    // merged into day master power

    // 专业解读不自动打开（默认关闭）

    // 真太阳时
    renderSolarTime(_params.year, _params.month, _params.day, _params.hour);

    // 日主性格（大白话）
    renderPillarAnalysis(bazi); renderDayMasterPower(bazi); renderPattern(bazi);
    renderCharacter(bazi);
    document.getElementById('characterSection').classList.add('drawer-open');

    // 父母关系
    renderParents(bazi, _params.gender);
    document.getElementById('parentsSection').classList.add('drawer-open');

    // 付费板块：解锁后才渲染（避免内容撑开抽屉）
    // 由 renderPaidContent() 在付费后渲染

    // 神煞统计
    // shensha removed

    // 初始化付费遮罩（渐变模糊，透出前两行）
    initPaywall({
        year: _params.year,
        month: _params.month,
        day: _params.day,
        hour: _params.hour,
        gender: _params.gender
    });
}

// ---- 付费内容渲染 (由 paywall 在解锁后调用) ----

// ============ 四柱生克分析 ============
function renderPillarAnalysis(bazi) {
  var c=document.getElementById('pillarAnalysis'); if(!c)return;
  var wxMap={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  var colors={'木':'#6db86d','火':'#e07050','土':'#c9a84c','金':'#e8d5a3','水':'#5b9fd4'};
  var sheng={'木':'火','火':'土','土':'金','金':'水','水':'木'};
  var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};
  var pos=['year','month','day','hour'],names=['年柱','月柱','日柱','时柱'];
  var h='<h4 style="color:var(--tx);font-size:14px;margin-bottom:10px">📐 四柱生克分析</h4>';
  h+='<div style="display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 0 16px">';
  for(var i=0;i<4;i++){
    var p=bazi[pos[i]],g=p.gan,w=wxMap[g]||'?';
    h+='<div style="text-align:center;background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:10px;padding:10px 14px;min-width:60px">';
    h+='<div style="font-size:10px;color:var(--tx3)">'+names[i]+'</div>';
    h+='<div style="font-size:22px;font-weight:700;color:'+(colors[w]||'#fff')+'">'+g+'</div>';
    h+='<div style="font-size:14px;color:var(--tx2)">'+p.zhi+'</div>';
    h+='<div style="font-size:9px;color:var(--tx3)">'+w+'</div>';
    if(i===2)h+='<div style="font-size:9px;color:var(--gold-l);margin-top:2px">☀ 日主</div>';
    h+='</div>';
    if(i<3){
      var w2=wxMap[bazi[pos[i+1]].gan];
      var rel='';
      if(sheng[w]===w2)rel='<span style="color:#4f8">生➡</span>';
      else if(ke[w]===w2)rel='<span style="color:#f44">克➡</span>';
      else if(sheng[w2]===w)rel='<span style="color:#4f8">⬅生</span>';
      else if(ke[w2]===w)rel='<span style="color:#f44">⬅克</span>';
      else rel='';
      h+='<div style="font-size:12px">'+rel+'</div>';
    }
  }
  h+='</div><div style="text-align:center;font-size:10px;color:var(--tx3);margin-bottom:12px">🟢 相生 ｜ 🔴 相克 ｜ 箭头指向 → 被影响方</div>';
  c.innerHTML=h;
}

// ============ 日主能量 ============
function renderDayMasterPower(bazi) {
  var c=document.getElementById('dayMasterPower'); if(!c)return;
  var wxMap={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  var gan=bazi.day.gan,wx=wxMap[gan]||'?';
  var result={score:50,detail:'日主中和，需结合大运流年判断走势。'};
  try{result=calcDayMasterStrength(bazi)}catch(e){}
  var level=result.score||50;
  var label=level>=65?'身强':level>=45?'中和':'身弱';
  var color=level>=65?'#e44':level>=45?'#ca4':'#48f';
  var h='<h4 style="color:var(--tx);font-size:14px;margin:16px 0 8px">☀ 日主能量 · '+gan+'('+wx+')</h4>';
  h+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0">';
  h+='<span style="font-size:11px;color:var(--tx3)">身弱</span>';
  h+='<div style="flex:1;height:10px;background:rgba(255,255,255,.1);border-radius:5px;overflow:hidden"><div style="width:'+level+'%;height:100%;background:'+color+';border-radius:5px"></div></div>';
  h+='<span style="font-size:11px;color:var(--tx3)">身强</span>';
  h+='<span style="font-weight:700;color:'+color+';font-size:15px;min-width:40px;text-align:center">'+label+'</span></div>';
  h+='<p style="color:var(--tx2);font-size:11px;margin-top:6px;line-height:1.6">'+result.detail+'</p>';
  c.innerHTML=h;
}

// ============ 格局分析 ============
function renderPattern(bazi) {
  var c=document.getElementById('patternAnalysis'); if(!c)return;
  var monthSS=(bazi.month.shiShen&&bazi.month.shiShen.zhi)||'';
  var patterns={
    '正官':{name:'正官格',desc:'月令正官当权。为人正直，责任心强，适合公职管理。"官以任能，贵乎清正。"——《子平真诠》'},
    '七杀':{name:'七杀格',desc:'月令七杀当权。果断刚毅，有魄力担当。杀需制化——食神制杀出武将，印化杀出文贵。'},
    '正财':{name:'正财格',desc:'月令正财当权。务实稳健，善于理财。财宜有食伤来生、官星来护，富贵可期。'},
    '偏财':{name:'偏财格',desc:'月令偏财当权。慷慨大方，商业嗅觉敏锐，适合投资经营。偏财得位，必主富贵。'},
    '正印':{name:'正印格',desc:'月令正印当权。温厚善良，学识渊博。印喜官杀来生，忌财星破印。'},
    '偏印':{name:'偏印格',desc:'月令偏印当权。思维独特，善于钻研。偏印（枭神）需财星制化，否则夺食不吉。'},
    '食神':{name:'食神格',desc:'月令食神当权。温和聪慧，有艺术才华。食神生财为福，食神制杀为贵。'},
    '伤官':{name:'伤官格',desc:'月令伤官当权。聪明机敏，创造力强。伤官需配印制化或生财，忌见官星。'},
    '建禄':{name:'建禄格',desc:'日主得月令禄位，自身强旺。禄喜财官，不宜再行比劫运。'},
    '羊刃':{name:'羊刃格',desc:'日主得月令帝旺（刃），气势极强。刃需七杀驾之，方能成器。"羊刃驾杀，威震边疆。"'}
  };
  var p=patterns[monthSS]||{name:'杂格',desc:'月令格局不显，需结合天干透出与地支合局综合判断。有格论格，无格论用。'};
  var h='<h4 style="color:var(--tx);font-size:14px;margin:16px 0 8px">📐 格局分析</h4>';
  h+='<p style="color:var(--gold-l);font-size:15px;font-weight:700;margin-bottom:4px">'+p.name+'</p>';
  h+='<p style="color:var(--tx2);font-size:12px;line-height:1.6">'+p.desc+'</p>';
  c.innerHTML=h;
}

function renderPaidContent() {
    if (!_bazi || !_params) return;
    renderThisYear(_bazi, _params.gender);
    document.getElementById('paidReportContent').classList.add('drawer-open');
    renderMarriage(_bazi, _params.gender);
    document.getElementById('marriageSection').classList.add('drawer-open');
    renderWealth(_bazi, _params.gender);
    document.getElementById('wealthSection').classList.add('drawer-open');
    renderStudy(_bazi);
    document.getElementById('studySection').classList.add('drawer-open');
    renderFortune(_bazi, _params.gender);
    document.getElementById('fortuneSection').classList.add('drawer-open');
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
            <div class="dayun-gz">${dy.gan}${dy.zhi}</div>
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
            <div class="liunian-gz">${ln.gan}${ln.zhi}</div>
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

        // 十神 - 地支
        if (pos !== 'day') {
            document.getElementById(`ss-${pos}-zhi`).textContent = pillar.shiShen.zhi;
        }

        // 藏干（含十神）：列内竖排 "甲\n食神"  "丙\n比肩"  "戊\n偏财"
        const cangEl = document.getElementById(`cang-${pos}`);
        const cangItems = pillar.cangGan.map(gan => {
            const wx = window.BaZiCalculator.WU_XING[gan];
            const ss = (pos === 'day' && gan === dayGan) ? '日主' : window.BaZiCalculator.getShiShen(dayGan, gan);
            return `<div class="cang-entry"><span class="cang-gan-char" style="color:${WX_COLORS[wx]}">${gan}</span><span class="cang-ss-text">${ss}</span></div>`;
        });
        cangEl.innerHTML = cangItems.join('');
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

    // 十神（地支）- 用藏干本气
    const cangGan = window.BaZiCalculator.getCangGan(dy.zhi);
    const ssZhiEl = document.getElementById('ss-dayun-zhi');
    ssZhiEl.innerHTML = `<span class="pp-ss-text">${window.BaZiCalculator.getShiShen(_dayGan, cangGan[0])}</span>`;

    // 藏干（含十神）
    const cangEl = document.getElementById('cang-dayun');
    const cangItems = cangGan.map(gan => {
        const wx = window.BaZiCalculator.WU_XING[gan];
        const ss = window.BaZiCalculator.getShiShen(_dayGan, gan);
        return `<div class="cang-entry"><span class="cang-gan-char" style="color:${WX_COLORS[wx]}">${gan}</span><span class="cang-ss-text">${ss}</span></div>`;
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

    // 十神（地支）- 用藏干本气
    const cangGan = window.BaZiCalculator.getCangGan(ln.zhi);
    const ssZhiEl = document.getElementById('ss-liunian-zhi');
    ssZhiEl.innerHTML = `<span class="pp-ss-text">${window.BaZiCalculator.getShiShen(_dayGan, cangGan[0])}</span>`;

    // 藏干（含十神）
    const cangEl = document.getElementById('cang-liunian');
    const cangItems = cangGan.map(gan => {
        const wx = window.BaZiCalculator.WU_XING[gan];
        const ss = window.BaZiCalculator.getShiShen(_dayGan, gan);
        return `<div class="cang-entry"><span class="cang-gan-char" style="color:${WX_COLORS[wx]}">${gan}</span><span class="cang-ss-text">${ss}</span></div>`;
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
    _liunianShenSha = [];
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

    // 合并所有神煞：四柱 + 大运 + 流年
    const allList = [..._nativeShenSha, ..._dayunShenSha, ..._liunianShenSha];

    if (allList.length === 0) {
        accordion.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-dim);font-size:13px">命局清净，暂无特殊神煞</div>';
        return;
    }

    // 更新计数
    const countEl = document.getElementById('shenshaCount');
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
function renderWuXing_old(wuXingCount) {
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
    var ty = window.BaZiCalculator.analyzeThisYear(bazi, gender);
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
    var wl = window.BaZiCalculator.analyzeWealth(bazi, gender);
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
    const ft = window.BaZiCalculator.analyzeFortune(bazi, gender);
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
    if (!solarInfo) {
        solarInfo = window.BaZiCalculator.getTrueSolarHour(birthHour, _params.prov || '', year, month, day);
    }

    // 用 solarMinutes 直接取真太阳时间
    var tm = solarInfo.solarMinutes;
    var sH = Math.floor(tm / 60);
    var sM = Math.round(tm % 60);
    if (sM >= 60) { sH++; sM = 0; }
    if (sH >= 24) sH -= 24;
    var solarStr = String(sH).padStart(2,'0') + ':' + String(sM).padStart(2,'0');

    var sign = Math.abs(solarInfo.eotMin) < 0.5 ? '≈' : (solarInfo.eotMin > 0 ? '+' : '');
    el.innerHTML = solarStr + ' <span style="font-size:11px;color:var(--text-dim)">（均时差' + sign + Math.abs(solarInfo.eotMin) + '分'

    // 省份经度信息
    if (_params.prov && solarInfo.lng !== 120) {
        var offsetSign = solarInfo.lngOffsetMin > 0 ? '东' : '西';
        el.innerHTML += ' • ' + _params.prov + '经度' + solarInfo.lng + '°（北京偏' + offsetSign + Math.abs(solarInfo.lngOffsetMin) + '分）';
    }
    el.innerHTML += '）</span>';
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

    if (!_params.year || !_params.month || !_params.day || isNaN(_params.hour) || !_params.gender) {
        alert('参数错误，请重新输入');
        window.location.href = 'index.html';
        return;
    }

    // --- 真太阳时纠正（根据出生地省份经度调整时辰）---
    var originalHour = _params.hour;
    var solarInfo = null;
    if (_params.prov) {
        solarInfo = window.BaZiCalculator.getTrueSolarHour(
            _params.hour, _params.prov, _params.year, _params.month, _params.day, _params.minute, _params.clock
        );
        _params.hour = solarInfo.hourIndex;
        // 也更新 clock 为真太阳时钟点，确保年柱/月柱的节气比较使用真太阳时
        if (solarInfo.trueHour !== undefined) {
            _params.clock = solarInfo.trueHour + (solarInfo.trueMinute || 0) / 60;
        }
    }

    const bazi = window.BaZiCalculator.calculate(
        _params.year, _params.month, _params.day, _params.hour, _params.gender, _params.clock || 0
    );
    // 保存原始时辰供显示
    bazi.originalHour = originalHour;
    bazi.solarInfo = solarInfo;

    const daYun = window.BaZiCalculator.calculateDaYun(
        bazi.month, bazi.year, _params.gender,
        _params.year, _params.month, _params.day, _params.hour, _params.clock || 0
    );

    const shenSha = window.BaZiCalculator.calculateShenSha(bazi);

    // 存储供流年点击使用
    _daYunData = daYun;
    _dayGan = bazi.day.gan;
    _bazi = bazi;

    render({ bazi, daYun, shenSha });
});

// ==================== 下载 / 保存报告 ====================
function buildReportHTML() {
    var sections = [
        { id: 'sizhuSection', title: '四柱解析', html: '' },
        { id: 'dayunSection', title: '大运走势', html: '' },
        { id: 'liunianSection', title: '流年运势', html: '' },
        { id: 'proSection', title: '专业分析', html: '' },
        { id: 'characterSection', title: '性格特征', html: '' },
        { id: 'parentsSection', title: '父母关系', html: '' },
        { id: 'thisYearSection', title: '今年参考', html: '' },
        { id: 'marriageSection', title: '感情参考', html: '' },
        { id: 'wealthSection', title: '财运参考', html: '' },
        { id: 'studySection', title: '学业参考', html: '' },
        { id: 'fortuneSection', title: '五年流年', html: '' }
    ];

    sections.forEach(function(sec) {
        var el = document.getElementById(sec.id);
        if (!el) return;
        var clone = el.cloneNode(true);
        clone.querySelectorAll('.paywall-overlay').forEach(function(o) { o.remove(); });
        clone.querySelectorAll('.drawer-arrow').forEach(function(a) { a.remove(); });
        clone.querySelectorAll('button,.share-btn,.download-btn').forEach(function(b) { b.remove(); });
        clone.querySelectorAll('.section-drawer').forEach(function(s) { s.classList.add('drawer-open'); });
        sec.html = clone.innerHTML;
    });

    var gender = _params ? (_params.gender === 'male' ? '男' : '女') : '';
    var birthStr = _params ? _params.year + '年' + _params.month + '月' + _params.day + '日' : '';
    var hourStr = _params ? SHI_CHEN_NAMES[_params.hour] || '' : '';
    var provStr = (_params && _params.prov) ? ' · ' + _params.prov : '';
    var dateStr = new Date().toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'});

    var css = ''
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'body{max-width:800px;margin:0 auto;font-family:"Source Han Serif SC","PingFang SC","Microsoft YaHei",serif;color:#e0d8c8;background:#0f0f18;padding:0}'
    + '.cover{text-align:center;padding:80px 30px 60px;background:linear-gradient(180deg,#151520 0%,#0f0f18 100%);position:relative;border-bottom:1px solid rgba(212,175,55,.08)}'
    + '.cover::before{content:"";position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);width:300px;height:300px;border-radius:50%;border:1px solid rgba(212,175,55,.06)}'
    + '.cover .brand{font-size:60px;color:#e0c860;letter-spacing:20px;font-weight:900;margin-bottom:12px}'
    + '.cover .tagline{font-size:20px;color:#a89858;letter-spacing:10px;margin-bottom:40px}'
    + '.cover .info{display:inline-block;padding:16px 32px;border:1px solid rgba(212,175,55,.12);border-radius:12px;color:#b0a080;font-size:15px;letter-spacing:2px;line-height:2}'
    + '.cover .info strong{color:#d8c060;font-weight:600}'
    + '.section{margin:0;padding:0 30px}'
    + '.section-title{font-size:22px;color:#d8be58;text-align:center;margin:40px 0 24px;letter-spacing:6px;font-weight:700;position:relative}'
    + '.section-title::after{content:"";display:block;width:40px;height:1px;background:rgba(212,175,55,.2);margin:12px auto 0}'
    + 'table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}'
    + 'th,td{padding:10px 8px;text-align:center;border:1px solid rgba(255,255,255,.06)}'
    + 'th{background:rgba(212,175,55,.06);color:#dac060;font-weight:600;font-size:13px}'
    + 'td{color:#c0b090;font-size:13px}'
    + '.drawer-body{color:#b0a090;font-size:14px;line-height:1.9;padding:8px 0}'
    + '.drawer-body p,.drawer-body div{margin-bottom:10px;color:#b0a090}'
    + '.drawer-body .highlight,.drawer-body strong,.drawer-body b{color:#d8be58}'
    + '.drawer-body .text-dim,.drawer-body .text-muted{color:#7a7a80}'
    + '.section-header h2,.section-title-row{font-size:18px!important;color:#c8a848!important;text-align:center;margin:24px 0 12px!important;letter-spacing:4px}'
    + '.item-row,.wl-row,.pr-card{background:rgba(255,255,255,.02);border-radius:8px;padding:14px 16px;margin-bottom:10px;border:1px solid rgba(255,255,255,.04)}'
    + '.wl-wang-bar{padding:10px 12px;background:rgba(255,255,255,.015);border-radius:6px;margin:4px 0}'
    + '.wl-wang-bar b,.wl-wang-bar strong{color:#d8be58}'
    + '.shensha-tag,.tag{display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;margin:2px;background:rgba(212,175,55,.08);color:#d0b858;border:1px solid rgba(212,175,55,.15)}'
    + '.shensha-tag.ji-shen,.tag.good{background:rgba(100,180,120,.06);color:#8c8;border-color:rgba(100,180,120,.12)}'
    + '.shensha-tag.xiong-sha,.tag.bad{background:rgba(200,100,100,.06);color:#c88;border-color:rgba(200,100,100,.12)}'
    + '.dayun-table td.active,.dayun-table td.current{background:rgba(212,175,55,.08);font-weight:600}'
    + '.liunian-col{display:inline-block;min-width:70px;text-align:center;padding:8px 4px;border:1px solid rgba(255,255,255,.04);border-radius:6px;margin:4px;font-size:12px;color:#a0a090}'
    + '.liunian-col.current-year{background:rgba(212,175,55,.1);border-color:rgba(212,175,55,.25);font-weight:600;color:#d8be58}'
    + '.footer{text-align:center;padding:40px 30px;border-top:1px solid rgba(255,255,255,.04);margin-top:40px;color:#5a5a60;font-size:12px;line-height:2;letter-spacing:1px}'
    + '.no-print{text-align:center;padding:20px 0}'
    + '.no-print button{display:inline-block;margin:0 10px;padding:12px 28px;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.25);color:#e0c860;font-size:15px;font-weight:600;border-radius:8px;cursor:pointer;letter-spacing:3px;font-family:inherit}'
    + '@media print{body{background:#fff!important;color:#222!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.cover,.section{padding-left:0;padding-right:0}'
    + '.no-print{display:none!important}'
    + 'table th{background:#f5f0e0!important;color:#333!important}'
    + 'table td{color:#444!important}'
    + '.drawer-body,.drawer-body p,.drawer-body div{color:#333!important}'
    + '.section-title{color:#8a7030!important}'
    + '.cover .brand{color:#8a7030!important}'
    + 'h2,h3{color:#6a5020!important}'
    + '@page{size:A4;margin:15mm}}';

    var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>知时 · ' + (gender==='男'?'乾造':'坤造') + ' · ' + birthStr + '</title>\n'
    + '<style>' + css + '</style>\n</head>\n<body>\n'
    + '<div class="no-print" style="position:sticky;top:0;background:rgba(15,15,24,.95);padding:12px 0;z-index:99;border-bottom:1px solid rgba(255,255,255,.04)">'
    + '<button onclick="window.print()">🖨 保存为 PDF</button>'
    + '<button onclick="history.back()">← 返回</button>'
    + '</div>\n'
    + '<div class="cover">\n'
    + '<div class="brand">知 时</div>\n'
    + '<div class="tagline">知 天 时 · 见 自 己</div>\n'
    + '<div class="info">\n'
    + '<strong>' + gender + '造</strong> · ' + birthStr + '<br>\n'
    + birthStr.split('年')[0] + '年 ' + hourStr + provStr + '<br>\n'
    + '分析日期：' + dateStr + '\n'
    + '</div>\n</div>\n';

    var used = {};
    sections.forEach(function(sec) {
        if (!sec.html || sec.html.length < 20) return;
        if (sec.title && !used[sec.title]) {
            html += '<div class="section"><div class="section-title">' + sec.title + '</div>' + sec.html + '</div>\n';
            used[sec.title] = true;
        }
    });

    html += '<div class="footer">'
    + '本报告由知时（www.knowbazi.online）生成<br>'
    + '仅供学习参考与娱乐交流，不构成任何决策建议<br>'
    + '知天时 · 见自己'
    + '</div>\n'
    + '</body>\n</html>';

    return html;
}

function downloadReport() {
    var html = buildReportHTML();
    var blob = new Blob([html], { type: 'text/html;charset=UTF-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var fn = '知时报告_' + (_params ? _params.year + _params.month + _params.day : '') + '.html';
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openReportInNewTab() {
    var html = buildReportHTML();
    var blob = new Blob([html], { type: 'text/html;charset=UTF-8' });
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank');
    if (!w) { alert('请允许弹出窗口以打开报告'); return; }
    // 打开后 30 秒释放 blob
    setTimeout(function() { URL.revokeObjectURL(url); }, 30000);
}

// ==================== 反馈机制 ====================
function showFeedback() {
    document.getElementById('feedbackOverlay').classList.add('show');
    document.getElementById('feedbackResult').textContent = '';
    document.getElementById('feedbackMsg').value = '';
    document.getElementById('feedbackContact').value = '';
}

function closeFeedback(e) {
    if (e && e.target !== document.getElementById('feedbackOverlay')) return;
    document.getElementById('feedbackOverlay').classList.remove('show');
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
        ctx.year = _params.year; ctx.month = _params.month; ctx.day = _params.day;
        ctx.hour = _params.hour; ctx.gender = _params.gender; ctx.prov = _params.prov || '';
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
