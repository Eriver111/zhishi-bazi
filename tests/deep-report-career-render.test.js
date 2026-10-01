const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../js/deep-report.js');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sections = ['thisYear', 'wealth', 'marriage', 'career', 'study', 'fortune'];

function fixture(options = {}) {
  const nodes = {};
  const calls = { build: 0, mount: 0, destroy: 0 };
  function makeNode(id) {
    const node = {
      id, _html: '', style: {}, attributes: {}, children: [],
      classList: { add() {}, remove() {} },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      appendChild(child) { child.parentNode = this; this.children.push(child); if (child.id) nodes[child.id] = child; return child; },
      insertBefore(child, anchor) {
        if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(item=>item!==child);
        const index=this.children.indexOf(anchor);child.parentNode=this;
        if(index<0)this.children.push(child);else this.children.splice(index,0,child);
        if(child.id)nodes[child.id]=child;return child;
      },
      get nextSibling() { if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null; },
      querySelectorAll() { return []; },
      cloneNode() {
        const clone = { innerHTML: this.innerHTML, querySelectorAll(selector) {
          if(selector==='.report-context-form' && /class="report-context-form"/.test(this.innerHTML))return [{remove(){clone.innerHTML=clone.innerHTML.replace(/<details class="report-context-form"[\s\S]*?<\/details>/g,'');}}];
          if (selector === '.report-city-compare__form' && /class="report-city-compare__form"/.test(this.innerHTML)) {
            return [{ remove() { clone.innerHTML = clone.innerHTML.replace(/<form class="report-city-compare__form">[\s\S]*?<\/form>/g, ''); } }];
          }
          return [];
        } };
        return clone;
      }
    };
    Object.defineProperty(node, 'innerHTML', {
      get() {
        if (/Section$/.test(id)) return nodes[id.replace(/Section$/, 'Content')].innerHTML;
        return this._html.replace('<div id="reportCityCompare"></div>', () => '<div id="reportCityCompare">' + (nodes.reportCityCompare ? nodes.reportCityCompare.innerHTML : '') + '</div>');
      },
      set(value) {
        this._html = value;
        if (id === 'careerContent') {
          delete nodes.reportCityCompare;
          if (value.includes('<div id="reportCityCompare"></div>')) nodes.reportCityCompare = makeNode('reportCityCompare');
        }
        if(id==='marriageContent') {
          for(const key of ['reportRelationshipStatus','reportRelationshipApply','reportRelationshipNotice']) {
            delete nodes[key];
            if(value.includes('id="'+key+'"'))nodes[key]=makeNode(key);
          }
        }
      }
    });
    return node;
  }
  const body = makeNode('body');
  for (const key of sections) {
    nodes[key + 'Content'] = makeNode(key + 'Content');
    nodes[key + 'Section'] = makeNode(key + 'Section');
    body.appendChild(nodes[key + 'Section']);
  }
  const narrative = headline => ({ headline, verdicts: [{ title: '主要判断', outcomeText: headline + '正文', sourceText: '对应已有依据', basis: ['FIXTURE'] }] });
  const facts = {
    currentYear: { narrative: narrative('年度概览') },
    wealth: { narrative: { ...narrative('财富内容'), grade: 'A6' } },
    relationship: { narrative: narrative('感情内容') },
    career: { narrative: narrative('职业内容<script>unsafe()</script>') },
    study: { relevant: false },
    fiveYear: { narrative: narrative('五年内容') },
    ...options.facts
  };
  const context = {
    console, URLSearchParams,
    document: {
      body, addEventListener() {}, getElementById(id) { return nodes[id] || null; },
      createElement() { return makeNode(''); }, querySelector() { return null; }, querySelectorAll() { return []; }
    },
    window: {
      DeepReportAnchor: { resolve() { return 2026; } },
      DeepReport: { buildFacts(bazi,gender,config) { calls.build++; return options.buildFacts ? options.buildFacts(config, facts) : facts; }, reportSectionOrder:Report.reportSectionOrder },
      ReportCityCompare: { mount(container) {
        calls.mount++;
        container.innerHTML = '<form class="report-city-compare__form"><input value="editing"></form><article class="report-city-compare__result">城市选择清单：甲城岗位与进入条件</article>';
        return { destroy() { calls.destroy++; }, exportText() { return '城市比较结果'; } };
      } }
    }
  };
  vm.createContext(context);
  vm.runInContext(read('js/result.js'), context);
  vm.runInContext('_bazi={year:{},month:{},day:{},hour:{}};_params={gender:"male",mode:"pillars",timing:"unknown"};', context);
  return { context, nodes, calls, facts, run: code => vm.runInContext(code, context) };
}

test('new career section renders the narrative and comparison only after report access', () => {
  const f = fixture();
  f.context.Auth = { isLoggedIn() { return true; } };
  f.run('renderPaidContent()');
  assert.equal(f.calls.build, 0);
  assert.equal(f.calls.mount, 0);
  assert.equal(f.nodes.careerContent.innerHTML, '');
  f.run('applyAuthenticatedReportAccess({unlocked:false})');
  assert.equal(f.nodes.careerContent.innerHTML, '');
  f.run('applyAuthenticatedReportAccess({unlocked:true})');
  assert.equal(f.calls.build, 1);
  assert.equal(f.calls.mount, 1);
  assert.match(f.nodes.careerContent.innerHTML, /职业内容&lt;script&gt;/);
  assert.doesNotMatch(f.nodes.careerContent.innerHTML, /<script>/);
  assert.equal(f.nodes.careerSection.style.display, 'block');
  assert.match(f.nodes.wealthContent.innerHTML, /A6/);
});

test('a missing, null or inapplicable career module clears prior content and comparison', () => {
  for (const career of [undefined, null, { narrative: null }, { relevant: false, narrative: { headline: '不适用' } }]) {
    const f = fixture();
    f.run('renderPaidContent()');
    f.context.nextCareer = career;
    f.run('renderDeepCareer(nextCareer)');
    assert.equal(f.nodes.careerContent.innerHTML, '');
    assert.equal(f.nodes.careerSection.style.display, 'none');
    assert.equal(f.calls.destroy, 1);
  }
});

test('calibration waiting clears the career content, destroys input handlers and blocks export', () => {
  const f = fixture();
  f.run('renderPaidContent()');
  f.context.window.ZhishiCalibration = { beforeReport() { return false; }, reportPending() { return true; } };
  f.run('renderPaidContent()');
  assert.equal(f.nodes.careerContent.innerHTML, '');
  assert.equal(f.nodes.careerSection.style.display, 'none');
  assert.equal(f.calls.destroy, 1);
  assert.throws(() => f.run('buildReportHTML()'), /往事复核/);
});

test('report errors dispose of comparison and display retry without stale conclusions', () => {
  const f = fixture();
  f.run('renderPaidContent();renderDeepReportError("生成失败")');
  assert.equal(f.calls.destroy, 1);
  assert.match(f.nodes.careerContent.innerHTML, /生成失败/);
  assert.doesNotMatch(f.nodes.careerContent.innerHTML, /职业内容|城市比较结果/);
});

test('PDF contains career and static city results in the same order, omitting city form', () => {
  const f = fixture();
  f.run('renderPaidContent()');
  const html = f.run('buildReportHTML()');
  assert.match(html, /职业内容&lt;script&gt;/);
  assert.match(html, /甲城岗位与进入条件/);
  assert.doesNotMatch(html, /class="report-city-compare__form"|value="editing"/);
  const markers = ['年度概览', '财富内容', '感情内容', '职业内容', '五年内容'];
  for (let i = 1; i < markers.length; i++) assert.ok(html.indexOf(markers[i - 1]) < html.indexOf(markers[i]));
  f.run('_isPaywallActive=function(){return true;}');
  const locked = f.run('buildReportHTML()');
  assert.match(locked, /事业与发展选择/);
  assert.doesNotMatch(locked, /职业内容|甲城岗位与进入条件/);
});

test('paywall wraps and hides all six report sections in display order', () => {
  const f = fixture();
  f.run(read('js/paywall.js'));
  assert.equal(f.run('renderPaywall(false,true)'), true);
  assert.deepEqual(f.nodes.unifiedReport.children.map(node => node.id), sections.map(key => key + 'Section'));
  assert.equal(f.nodes.careerSection.style.display, 'none');
  assert.equal(f.nodes.careerSection.attributes['aria-hidden'], 'true');
  assert.equal(f.nodes.careerContent.innerHTML, '');
  const page = read('result.html');
  const ids = Array.from(page.matchAll(/<section[^>]+id="(thisYear|wealth|marriage|career|study|fortune)Section"/g), match => match[1]);
  assert.deepEqual(ids, sections);
  assert.match(read('js/mobile-app-shell.js'), /reading: \[[^\]]*'#careerSection'/);
});

test('legacy wealth renderer preserves traditional direction without favorable-city claims', () => {
  const f = fixture();
  f.context.window.BaZiCalculator = {
    getYongJi() { return {}; },
    analyzeWealth() { return { caiWX: '水', caiPositions: [], wealthLevels: [], goodCities: ['城市不应输出甲'], badCities: ['城市不应输出乙'], goodDirection: '北', badDirection: '南' }; }
  };
  f.run('renderWealth({},"male")');
  assert.match(f.nodes.wealthContent.innerHTML, /喜用对应方位|传统方位/);
  assert.doesNotMatch(f.nodes.wealthContent.innerHTML, /城市不应输出|旺财方位|打开财路|赚钱比别人费劲/);
});

test('process-only verdicts retain the actual explanation inside collapsed details', () => {
  const f = fixture();
  f.context.narrative = { verdicts: [{ title: '流程细节', outcomeText: '已经交出的材料需要补交。', sourceText: '已有结构依据', detailOnly: true }] };
  const html = f.run('reportNarrative(narrative)');
  assert.match(html, /<details[^>]*>[\s\S]*已经交出的材料需要补交。/);
  assert.doesNotMatch(html, /<section class="deep-report-verdict-item"/);
});

test('a process-only year and supporting process records are collapsed with their text', () => {
  const f = fixture();
  f.context.narrative = { years: [{ year: 2028, summary: '需要多次往返。', detailOnly: true, processDetails: [{ label: '过程', scenario: '约好的时间临时改动。', sourceText: '已有依据' }] }] };
  const html = f.run('reportNarrative(narrative)');
  assert.match(html, /<details[^>]*><summary>2028年 · 查看本年细节<\/summary>/);
  assert.match(html, /需要多次往返。/);
  assert.match(html, /约好的时间临时改动。/);
  assert.doesNotMatch(html, /<h3>2028年<\/h3>/);
});

test('reading priorities reorder complete paid chapters in the page and PDF without removing others', () => {
  const f=fixture({facts:{lifeContext:{priorities:['relationship','wealth']}}});
  f.run('renderPaidContent()');
  assert.deepEqual(f.context.document.body.children.map(node=>node.id),['marriageSection','wealthSection','thisYearSection','careerSection','studySection','fortuneSection']);
  assert.ok(f.nodes.careerContent.innerHTML.includes('职业内容'));
  const html=f.run('buildReportHTML()');
  assert.ok(html.indexOf('感情内容')<html.indexOf('财富内容'));
  assert.ok(html.indexOf('财富内容')<html.indexOf('年度概览'));
  for(const text of ['感情内容','财富内容','年度概览','职业内容','五年内容'])assert.ok(html.includes(text));
  f.facts.lifeContext.priorities=[];f.run('applyReportReadingOrder()');
  assert.deepEqual(f.context.document.body.children.map(node=>node.id),sections.map(key=>key+'Section'));
});

function relationshipFixture() {
  let context={status:'working',relationshipStatus:'unknown',priorities:[]}, owner='a';
  const review={adjustments:[]};
  const f=fixture({facts:{lifeContext:context,reportReview:review,reviewLoaded:true},buildFacts(config,facts){
    return {...facts,lifeContext:{...context},relationship:{narrative:{sectionTitle:'婚姻感情',headline:context.relationshipStatus==='married'?'婚后相处的判断':'原有感情判断',verdicts:[]}}};
  }});
  f.context.window.Auth={getUser(){return {id:owner};}};
  f.context.window.ZhishiCalibration={beforeReport(){return true;},reportContext(){return {...context};},updateReportContext(patch){context={...context,...patch};return true;}};
  f.context.window.DeepReport.applyReportReview=(facts,value)=>{assert.equal(value,review);facts.reviewApplied=true;};
  f.run('renderPaidContent()');
  return {...f,setOwner(value){owner=value;},readingContext(){return context;}};
}

test('optional relationship selection updates relevant sections while preserving review and city draft', () => {
  const f=relationshipFixture();
  assert.match(f.nodes.marriageContent.innerHTML,/按当前感情状态查看（可跳过）/);
  assert.doesNotMatch(f.nodes.marriageContent.innerHTML,/<select[^>]*required/);
  f.nodes.reportRelationshipStatus.value='married';f.nodes.reportRelationshipApply.onclick();
  assert.match(f.nodes.marriageContent.innerHTML,/婚后相处的判断/);
  assert.match(f.nodes.reportRelationshipNotice.textContent,/其他章节仍然保留/);
  assert.equal(f.calls.mount,1);assert.equal(f.calls.destroy,0);
  assert.equal(f.run('_deepReportFacts.reviewApplied'),true);
  assert.match(f.nodes.wealthContent.innerHTML,/财富内容/);
  assert.match(f.nodes.fortuneContent.innerHTML,/五年内容/);
  const pdf=f.run('buildReportHTML()');assert.match(pdf,/婚后相处的判断/);assert.doesNotMatch(pdf,/reportRelationshipStatus|reportRelationshipApply|其他／不愿回答/);
});

test('stale relationship button after account switch cannot change context or rebuild a report', () => {
  const f=relationshipFixture(), before=f.calls.build;
  f.nodes.reportRelationshipStatus.value='married';f.setOwner('b');f.nodes.reportRelationshipApply.onclick();
  assert.equal(f.calls.build,before);assert.equal(f.readingContext().relationshipStatus,'unknown');
});

test('minor report never prompts for adult relationship status', () => {
  const f=fixture({facts:{lifeContext:{age:16,relationshipStatus:'unknown'}}});
  f.context.window.ZhishiCalibration={beforeReport(){return true;},updateReportContext(){throw Error('not applicable');}};
  f.run('renderPaidContent()');assert.doesNotMatch(f.nodes.marriageContent.innerHTML,/reportRelationshipStatus/);
});
