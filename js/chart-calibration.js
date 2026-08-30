(function(root) {
  'use strict';

  var domainNames = { study:'学业', career:'事业', wealth:'财务', relationship:'感情', family:'家庭', health:'身心状态', change:'生活变化' };
  var prompts = {
    study:'这一年是否出现过升学、考试、转专业，或学习状态明显变化？',
    career:'这一年是否出现过入职、离职、换岗位、实习，或工作责任明显变化？',
    wealth:'这一年是否出现过收入、花钱、家庭经济，或较大金额进出明显变化？',
    relationship:'这一年是否出现过恋爱、分合、关系确定，或重要人际关系明显变化？',
    family:'这一年父母、家庭关系、住处，或家中重要事情是否有明显变化？',
    health:'这一年身体状态、作息、情绪压力，或治疗检查是否有明显变化？',
    change:'这一年是否发生过搬迁、换环境、身份变化，或人生节奏明显改变？'
  };

  function triggerFor(analysis, predicate) {
    return (analysis.triggers || []).filter(predicate)[0] || null;
  }

  function directionOf(trigger, analysis) {
    if (trigger && trigger.isGood === true) return 'good';
    if (trigger && trigger.isGood === false) return 'bad';
    if (Number(analysis.opportunityScore || 0) > Number(analysis.dangerScore || 0)) return 'good';
    if (Number(analysis.dangerScore || 0) > Number(analysis.opportunityScore || 0)) return 'bad';
    return 'neutral';
  }

  function predictedPrompt(domain, analysis, age, tenGod) {
    var good = Number(analysis.opportunityScore || 0) > Number(analysis.dangerScore || 0);
    var bad = Number(analysis.dangerScore || 0) > Number(analysis.opportunityScore || 0);
    var monthHit = triggerFor(analysis, function(t){ return t.target === 'month' || /月柱|月支|月提|提纲/.test(t.detail || ''); });
    var dayHit = triggerFor(analysis, function(t){ return t.target === 'day' || /日柱|日支|夫妻/.test(t.detail || ''); });
    var yearHit = triggerFor(analysis, function(t){ return t.target === 'year' || /年柱/.test(t.detail || ''); });
    var officerConflict = triggerFor(analysis, function(t){ return /伤官见官|官逢伤官/.test(t.type || ''); });
    var strongChange = triggerFor(analysis, function(t){ return /天克地冲|六冲|刑|自刑|六害|六破|伏吟/.test(t.type || ''); });
    var dayRelation = dayHit && (dayHit.type || '');
    var monthDirection = directionOf(monthHit, analysis);
    var dayDirection = directionOf(dayHit, analysis);
    var yearDirection = directionOf(yearHit, analysis);

    if (domain === 'study') {
      if (monthHit && /天克地冲|地冲月提|六冲/.test(monthHit.type || '')) {
        return monthDirection === 'good'
          ? '这一年是否换过学校、班级或学习方向，变化之后反而更适应，成绩或状态有所改善？'
          : '这一年是否换过学校、班级或学习方向，并因此出现过成绩波动、适应困难或压力明显增大？';
      }
      if (/印/.test(tenGod || '')) return good
        ? '这一年学习和考试是否明显更顺，得到过老师帮助、录取机会，或更容易静下心学习？'
        : '这一年是否学习投入不少，但容易死记硬背、压力很大，成绩提升却没有预期中明显？';
      if (/食神|伤官/.test(tenGod || '')) return good
        ? '这一年是否理解力、表达或临场发挥更突出，在考试、竞赛或作品上有过明显表现？'
        : '这一年是否更容易分心、抗拒管束或与老师顶撞，导致学习状态和成绩反复？';
      if (/官|杀/.test(tenGod || '') && bad) return '这一年是否考试和升学压力特别集中，明明想做好，却容易紧张、自我怀疑或一度想放弃？';
      return prompts.study;
    }
    if (domain === 'career') {
      if (officerConflict) return '这一年是否和领导、单位规定或审核流程发生过明显冲突，导致项目返工、岗位变动或离职念头增强？';
      if (monthHit && /天克地冲|地冲月提|六冲/.test(monthHit.type || '')) return monthDirection === 'good'
        ? '这一年是否换过工作、岗位或团队，虽然过程有变动，但换完以后发展空间反而更好？'
        : '这一年是否换过工作、岗位或团队，并伴随项目反复、工作不稳或一段明显的适应期？';
      if (/官|杀/.test(tenGod || '')) return good
        ? '这一年是否得到入职、升职、转正或承担重要职责的机会，别人开始更认可你的能力？'
        : '这一年工作责任和考核是否明显加重，容易被领导盯得紧、受制度限制，或觉得付出很多却不轻松？';
      if (/食神|伤官/.test(tenGod || '')) return good
        ? '这一年是否靠技术、表达、作品或业务能力做出过成绩，并因此得到新的工作机会？'
        : '这一年是否因为表达直接、做法不合规定或对工作不满，与同事领导产生过摩擦？';
      return prompts.career;
    }
    if (domain === 'wealth') {
      if (/比肩|劫财/.test(tenGod || '') && bad) return '这一年是否因为合伙分钱、朋友借钱、同行竞争或替别人承担开支，出现过一笔比较明显的钱财损失？';
      if (/比肩|劫财/.test(tenGod || '') && good) return '这一年是否通过朋友、团队、合伙或客户介绍得到过赚钱机会，收入来源比以前更活跃？';
      if (/财/.test(tenGod || '') && bad) return '这一年是否挣钱机会和花钱事情一起增多，虽然有进账，但很快被大额开支、家庭责任或资金周转带走？';
      if (/财/.test(tenGod || '') && good) return '这一年是否出现过比较明确的收入增长、项目回款、成交机会，或手里能支配的钱明显增加？';
      if (strongChange && bad) return '这一年是否有过计划外的大额支出或资金周转压力，钱进出得很快，手里很难长期留住？';
      return prompts.wealth;
    }
    if (domain === 'relationship' && dayHit) {
      if (/六合|流年合日支|半合|三合局/.test(dayRelation)) return dayDirection === 'good'
        ? '这一年感情是否明显走近，出现过认识重要对象、确定关系、复合或谈婚论嫁？'
        : (dayDirection === 'bad' ? '这一年是否有一段关系牵扯很深却不够轻松，明明放不下，又反复怀疑能不能继续？' : '这一年是否出现过一段牵扯较深的关系，两个人联系增多，但关系是否稳定一时难以确定？');
      if (/六冲|天克地冲/.test(dayRelation)) return dayDirection === 'good'
        ? '这一年感情是否经历过一次明显变化，例如结束不合适的关系、重新确定边界，之后状态反而轻松一些？'
        : '这一年感情是否发生过明显争吵、分开、异地或关系突然改变，让你反复考虑还能不能继续？';
      if (/刑|自刑|六害|六破/.test(dayRelation)) return '这一年感情是否容易互相猜疑、说话伤人或一阵亲近一阵疏远，明明在意却很难稳定相处？';
      if (/伏吟|地支重复/.test(dayRelation)) return '这一年是否反复遇到同一种感情问题，旧人旧事重新出现，或一段关系迟迟无法真正定下来？';
      return prompts.relationship;
    }
    if (domain === 'family') {
      if (yearHit && /六冲|天克地冲/.test(yearHit.type || '')) return yearDirection === 'good'
        ? '这一年家里是否经历过搬迁、父母工作变化或家庭关系调整，变化之后整体状态反而有所改善？'
        : '这一年家里是否发生过搬迁、父母工作变化、争执增多，或某位长辈的事情让全家明显操心？';
      if (yearHit && /刑|自刑|六害|六破/.test(yearHit.type || '')) return '这一年父母或家人之间是否更容易闹别扭、互相埋怨，家里的事情反复拖着，让你夹在中间操心？';
      if (/印/.test(tenGod || '')) return good
        ? '这一年是否得到过母亲、长辈或家庭的明显帮助，家里的关系和生活条件也比之前更稳定？'
        : '这一年是否主要为了母亲、长辈、住房或家庭安排操心，家里给你的压力明显多于帮助？';
      if (/财/.test(tenGod || '')) return good
        ? '这一年父母的收入、工作或家里经济条件是否明显改善，生活上的选择比以前宽松一些？'
        : '这一年家里是否因为父母挣钱不稳、大额开支或资金周转而压力增大，你也明显感受到钱不够宽松？';
      return prompts.family;
    }
    if (domain === 'change' && age < 18) return '这一年是否换过学校、班级、住处或主要生活环境，整个人的生活节奏随之改变？';
    if (domain === 'change' && strongChange) {
      var targetText = strongChange.target === 'month' ? '工作、住处或日常安排' : (strongChange.target === 'day' ? '感情、合作或个人状态' : (strongChange.target === 'year' ? '家庭或居住环境' : '生活计划'));
      return '这一年你的' + targetText + '是否发生过一次明显改变，原来的状态被打断，需要重新适应或重新选择？';
    }
    return prompts[domain] || prompts.change;
  }

  function token() { return root.Auth && root.Auth.getToken ? root.Auth.getToken() : ''; }
  function chartData() {
    return root.ZhishiAIContext && root.ZhishiAIContext.buildChartData
      ? root.ZhishiAIContext.buildChartData() : null;
  }
  function chartKey(data) {
    return root.ChatPersistence && data ? root.ChatPersistence.chartIdentity('bazi', data) : '';
  }
  function signature(data) {
    if (!data || !data.fourPillars) return '';
    return ['year','month','day','hour'].map(function(pos) {
      var p = data.fourPillars[pos] || {}; return (p.gan || '') + (p.zhi || '');
    }).join('|') + '|' + ((data.birthInfo && data.birthInfo.gender) || '');
  }
  function request(method, key, body) {
    var url = '/api/chart-calibration' + (method === 'GET' ? '?chart_key=' + encodeURIComponent(key) : '');
    return fetch(url, {
      method: method, cache: 'no-store',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + token() },
      body: method === 'POST' ? JSON.stringify(body) : undefined
    }).then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) { var error = new Error(data.error || '校准读取失败'); error.status = response.status; throw error; }
        return data;
      });
    });
  }

  function annualDomainScores(analysis, liuNian, age) {
    var scores = { study:0, career:0, wealth:0, relationship:0, family:0, change:1 };
    (analysis.triggers || []).forEach(function(trigger) {
      if (trigger.target === 'day' || /日柱|日支|夫妻/.test(trigger.detail || '')) scores.relationship += 4;
      if (trigger.target === 'year' || /年柱/.test(trigger.detail || '')) scores.family += 3;
      if (trigger.target === 'month' || /月柱|月支/.test(trigger.detail || '')) {
        if (age <= 23) scores.study += 3; else scores.career += 3;
      }
      if (trigger.target === 'hour' || /时柱|时支/.test(trigger.detail || '')) scores.career += 2;
      if (/天克地冲|六冲|刑|六害|六破|伏吟/.test(trigger.type || '')) scores.change += 2;
      if (/伤官见官|官逢伤官/.test(trigger.type || '')) scores.career += 6;
      if (/流年合日支/.test(trigger.type || '')) scores.relationship += 3;
    });
    try {
      var ss = BaZiCalculator.getShiShen(_bazi.day.gan, liuNian.gan);
      if (/财/.test(ss)) scores.wealth += 4;
      if (/官|杀/.test(ss)) scores.career += 4;
      if (/印/.test(ss)) { if (age <= 24) scores.study += 4; else scores.family += 4; }
      if (/食神|伤官/.test(ss)) { if (age <= 23) scores.study += 2; else scores.career += 2; }
      if (/比肩|劫财/.test(ss)) { scores.wealth += 2; scores.relationship += 1; }
    } catch (e) {}
    if (age < 18) { scores.study += scores.career; scores.career = -1; }
    if (age < 16) { scores.family += scores.wealth; scores.wealth = -1; }
    if (age < 14) { scores.family += scores.relationship; scores.relationship = -1; }
    return scores;
  }

  function annualDomain(analysis, liuNian, age) {
    var scores = annualDomainScores(analysis, liuNian, age);
    return Object.keys(scores).sort(function(a,b) { return scores[b] - scores[a]; })[0];
  }

  var followupSets = {
    study: [
      {key:'admission_exam',label:'升学、录取或重要考试'}, {key:'school_major',label:'换学校、班级或专业'},
      {key:'grade_focus',label:'成绩和专注度明显变化'}, {key:'teacher_conflict',label:'与老师、规则或学习压力有关'}
    ],
    career: [
      {key:'job_team',label:'入职、离职、换岗位或换团队'}, {key:'promotion_duty',label:'升职、转正或责任突然加重'},
      {key:'authority_conflict',label:'与领导、制度或审核发生冲突'}, {key:'project_rework',label:'项目反复、返工或工作节奏被打乱'}
    ],
    wealth: [
      {key:'partnership_money',label:'合伙分钱、朋友借钱或替人承担开支'}, {key:'investment_business',label:'投资、生意、项目回款或资金周转'},
      {key:'family_property',label:'家庭、住房或大件消费'}, {key:'income_change',label:'工资、收入来源或手里现金明显变化'}
    ],
    relationship: [
      {key:'start_commit',label:'认识重要对象或确定关系'}, {key:'break_distance',label:'争吵、分开或异地'},
      {key:'hot_cold',label:'反复拉扯、忽近忽远'}, {key:'old_person',label:'旧人旧事重新出现'}
    ],
    family: [
      {key:'parent_work_money',label:'父母工作或家庭经济变化'}, {key:'home_move',label:'搬家、住房或居住安排变化'},
      {key:'family_relation',label:'父母关系或家庭争执变化'}, {key:'elder_health',label:'长辈身体、治疗或需要照顾'}
    ],
    change: [
      {key:'move_city',label:'搬家、异地或长期离开原环境'}, {key:'school_job_change',label:'学校、工作或主要圈子改变'},
      {key:'identity_plan',label:'身份、计划或生活重心改变'}, {key:'forced_restart',label:'原计划被打断后重新开始'}
    ]
  };

  function mechanismKey(domain, analysis, tenGod) {
    var triggers = (analysis.triggers || []).map(function(item){return item.type || ''}).join('|');
    if (domain === 'relationship' && /六冲|天克地冲/.test(triggers)) return 'day-palace:clash';
    if (domain === 'relationship' && /六合|半合|三合/.test(triggers)) return 'day-palace:combine';
    if (domain === 'career' && /伤官见官|官逢伤官/.test(triggers)) return 'output-controls-officer';
    if (domain === 'wealth' && /比肩|劫财/.test(tenGod || '')) return 'peer-wealth';
    if (domain === 'family' && /印/.test(tenGod || '')) return 'seal-family';
    return domain + ':' + String(tenGod || 'annual-trigger').replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g,'').slice(0,30);
  }

  function manifestationKey(domain, analysis, tenGod) {
    var direction = directionOf(null, analysis);
    if (domain === 'wealth' && /比肩|劫财/.test(tenGod || '')) return direction === 'good' ? 'network-income' : 'partnership-loss';
    if (domain === 'career' && /(伤官见官|官逢伤官)/.test((analysis.triggers || []).map(function(t){return t.type||''}).join('|'))) return 'authority-conflict';
    if (domain === 'relationship') return direction === 'good' ? 'relationship-progress' : (direction === 'bad' ? 'relationship-instability' : 'relationship-change');
    if (domain === 'family') return direction === 'good' ? 'family-support' : (direction === 'bad' ? 'family-pressure' : 'family-change');
    if (domain === 'study') return direction === 'good' ? 'study-progress' : (direction === 'bad' ? 'study-pressure' : 'study-change');
    if (domain === 'career') return direction === 'good' ? 'career-progress' : (direction === 'bad' ? 'career-pressure' : 'career-change');
    if (domain === 'wealth') return direction === 'good' ? 'income-growth' : (direction === 'bad' ? 'money-outflow' : 'money-change');
    return 'environment-change';
  }

  function conciseLabel(domain, analysis, tenGod) {
    var labels = {study:'升学考试或学习状态',career:'工作岗位或责任变化',wealth:'收入、支出或资金变化',relationship:'感情关系出现转折',family:'父母、住房或家庭变化',change:'生活环境或人生计划变化'};
    if (domain === 'wealth' && /比肩|劫财/.test(tenGod || '')) return directionOf(null, analysis)==='good'?'朋友团队带来赚钱机会':'合伙、人情或竞争带来损失';
    if (domain === 'career' && /(伤官见官|官逢伤官)/.test((analysis.triggers || []).map(function(t){return t.type||''}).join('|'))) return '与领导、制度或审核发生冲突';
    return labels[domain] || labels.change;
  }

  function competingOption(domain, analysis, age, tenGod) {
    return {
      key: domain + ':' + manifestationKey(domain, analysis, tenGod),
      label: conciseLabel(domain, analysis, tenGod),
      detail: predictedPrompt(domain, analysis, age, tenGod).replace(/^这一年是否/, '').replace(/[？?]$/, ''),
      domain: domain,
      manifestation: manifestationKey(domain, analysis, tenGod),
      mechanism_key: mechanismKey(domain, analysis, tenGod),
      followup_prompt: '如果是这一类，具体更接近哪件事？',
      followup_options: followupSets[domain] || followupSets.change
    };
  }

  function generateCandidates(data) {
    var out = [];
    try {
      if (typeof _bazi === 'undefined' || !_bazi || typeof _daYunData === 'undefined' || !_daYunData || !_daYunData.list) return out;
      var birthYear = Number(new URLSearchParams(location.search).get('year'));
      if (!birthYear && data.birthInfo) birthYear = Number(data.birthInfo.year || String(data.birthInfo.standardTime || '').slice(0,4));
      var nowYear = new Date().getFullYear();
      var firstYear = Math.max(birthYear ? birthYear + 6 : nowYear - 14, nowYear - 14);
      var yongJi = data.yongJi || (BaZiCalculator.getYongJi ? BaZiCalculator.getYongJi(_bazi) : null);
      for (var year = firstYear; year < nowYear; year++) {
        var dy = _daYunData.list.filter(function(item) { return year >= Number(item.startYear) && year <= Number(item.endYear); })[0];
        if (!dy) continue;
        var liuNian = (BaZiCalculator.calculateLiuNian(dy, _bazi.day.gan) || []).filter(function(item) { return Number(item.year) === year; })[0];
        if (!liuNian) continue;
        var analysis = root.BaZiChain.analyzeLiuNian(_bazi, dy, liuNian, yongJi);
        var high = (analysis.triggers || []).filter(function(t) { return t.severity === 'high'; }).length;
        var score = Number(analysis.dangerScore || 0) + Number(analysis.opportunityScore || 0) + high * 2 + Math.min((analysis.triggers || []).length, 4);
        var age = birthYear ? year - birthYear : 20;
        var tenGod = '';
        try { tenGod = BaZiCalculator.getShiShen(_bazi.day.gan, liuNian.gan) || ''; } catch (e) {}
        var scores = annualDomainScores(analysis, liuNian, age);
        var rankedDomains = Object.keys(scores).filter(function(name){return scores[name] >= 0}).sort(function(a,b){return scores[b]-scores[a]});
        var domain = rankedDomains[0] || annualDomain(analysis, liuNian, age);
        var optionDomains = rankedDomains.slice(0,3);
        ['change','family','wealth','relationship','career','study'].some(function(name){
          if (optionDomains.length >= 3) return true;
          if (optionDomains.indexOf(name) < 0 && scores[name] >= 0) optionDomains.push(name);
          return optionDomains.length >= 3;
        });
        var options = optionDomains.map(function(name){return competingOption(name, analysis, age, tenGod)});
        var gz = (liuNian.gan || '') + (liuNian.zhi || '');
        var dyGz = (dy.gan || '') + (dy.zhi || '');
        var evidence = (analysis.triggers || []).slice().sort(function(a,b) {
          var rank = { high:3, medium:2, low:1 }; return (rank[b.severity] || 0) - (rank[a.severity] || 0);
        }).slice(0,3).map(function(t) { return t.detail; });
        evidence.unshift(year + '年' + gz + '，处于' + dyGz + '大运；流年天干为' + analysis.stemRole + '，地支为' + analysis.branchRole + '。');
        out.push({
          event_key: year + '-' + domain + '-' + gz, year: year, domain: domain,
          prompt: year + '年前后，下面哪一种情况最接近你的真实经历？', evidence: evidence,
          options: options, mechanism_key: options[0] ? options[0].mechanism_key : '',
          confidence: score >= 8 ? 'high' : (score >= 4 ? 'medium' : 'low'), _score: score
        });
      }
      out.sort(function(a,b) { return b._score - a._score || b.year - a.year; });
      var domainCounts = {};
      out = out.filter(function(item) {
        if (Number(domainCounts[item.domain] || 0) >= 2) return false;
        domainCounts[item.domain] = Number(domainCounts[item.domain] || 0) + 1;
        return true;
      }).slice(0, 5).sort(function(a,b) { return b.year - a.year; });
      out.forEach(function(item) { delete item._score; });
    } catch (error) { console.warn('[calibration] 候选生成失败:', error.message); }
    return out;
  }

  function ensureShell() {
    var shell = document.getElementById('calibrationShell');
    if (shell) return shell;
    shell = document.createElement('div'); shell.id = 'calibrationShell'; shell.className = 'calibration-shell';
    shell.innerHTML = '<div class="calibration-backdrop" data-close="1"></div><section class="calibration-panel" role="dialog" aria-modal="true" aria-labelledby="calibrationTitle"><button class="calibration-close" type="button" data-close="1" aria-label="关闭">×</button><div id="calibrationBody"></div></section>';
    document.body.appendChild(shell);
    shell.addEventListener('click', function(event) { if (event.target.getAttribute('data-close') === '1') close(); });
    return shell;
  }
  function openHtml(html) { var shell = ensureShell(); document.getElementById('calibrationBody').innerHTML = html; shell.classList.add('is-open'); document.body.classList.add('calibration-open'); }
  function close() { var shell = document.getElementById('calibrationShell'); if (shell) shell.classList.remove('is-open'); document.body.classList.remove('calibration-open'); }
  function choiceKey(key) { return 'zhishi_calibration_choice:' + key; }
  function localDataKey(key) { return 'zhishi_calibration_data:' + key; }
  function readLocalEvents(key) { try { return JSON.parse(localStorage.getItem(localDataKey(key)) || '[]'); } catch(e) { return []; } }
  function writeLocalEvents(key, events) { try { localStorage.setItem(localDataKey(key), JSON.stringify(events)); } catch(e) {} }

  function showConsent(key, originalToggle) {
    var storageText=token()?'确认结果只保存在你的账号下':'未登录时确认结果只保存在当前设备';
    openHtml('<header class="calibration-head"><span>第一次问这张命盘前</span><h2 id="calibrationTitle">要不要先做应事校对？</h2><p>系统先找出几个过去最容易发生变化的年份。你从互不重复的现实表现里选最接近的一项，AI以后会优先按你真正的应事方式分析。</p></header><div class="calibration-privacy">不会修改四柱、旺衰、格局和喜用忌；'+storageText+'，也不影响购买记录。</div><div class="calibration-actions"><button type="button" class="calibration-primary" id="calibrationStart">先校对再问</button><button type="button" class="calibration-secondary" id="calibrationSkip">直接问 AI</button></div>');
    document.getElementById('calibrationStart').onclick = function() { start(key, originalToggle); };
    document.getElementById('calibrationSkip').onclick = function() { try { localStorage.setItem(choiceKey(key), 'skip'); } catch(e) {} close(); originalToggle(); };
  }

  function start(key, originalToggle) {
    var data = chartData(), candidates = generateCandidates(data);
    if (!candidates.length) { close(); originalToggle(); return; }
    if (!token()) {
      var localEvents = candidates.map(function(item) { return Object.assign({ answer:null, actual_year:null, note:'' }, item, { event_year:item.year }); });
      writeLocalEvents(key, localEvents); renderEvents(key, localEvents, originalToggle); return;
    }
    openHtml('<div class="calibration-loading">正在从过去十四年的岁运中筛选变化最明显的年份…</div>');
    request('POST', key, { action:'initialize', chart_key:key, chart_signature:signature(data), candidates:candidates })
      .then(function(result) { renderEvents(key, result.events || [], originalToggle); })
      .catch(function(error) { openHtml('<div class="calibration-error">' + (error.message || '校准暂时不可用') + '<button type="button" id="calibrationContinue">先进入 AI</button></div>'); document.getElementById('calibrationContinue').onclick=function(){close();originalToggle()}; });
  }

  function renderEvents(key, events, originalToggle) {
    if (!events.length) { close(); if (originalToggle) originalToggle(); return; }
    var answered = events.filter(function(event) { return event.answer; }).length;
    var html = '<header class="calibration-head"><span>命盘应事校对</span><h2 id="calibrationTitle">我先判断，你选最接近的一项</h2><p>每个年份只选最接近真实经历的一类，再补充具体发生了什么。问题和依据在回答前已经锁定，不会根据你的选择倒推命盘。</p><div class="calibration-progress"><i style="width:' + Math.round(answered / events.length * 100) + '%"></i></div><small>' + answered + ' / ' + events.length + ' 已完成</small></header><div class="calibration-list">';
    events.forEach(function(event) {
      var answer = event.answer || '';
      var options = Array.isArray(event.options) ? event.options : [];
      html += '<article class="calibration-event ' + (options.length?'is-structured':'is-legacy') + '" data-event="' + escapeAttr(event.event_key) + '" data-answer="' + escapeAttr(answer) + '" data-selected-option="' + escapeAttr(event.selected_option||'') + '" data-selected-detail="' + escapeAttr(event.selected_detail||'') + '" data-match-level="' + escapeAttr(event.match_level||'exact') + '"><div class="calibration-event__year">' + event.event_year + '<small>' + (domainNames[event.domain] || '经历') + '</small></div><div class="calibration-event__content"><p>' + escapeHtml(event.prompt) + '</p><details><summary>为什么重点看这一年</summary><ul>' + (event.evidence || []).map(function(text){return '<li>'+escapeHtml(text)+'</li>'}).join('') + '</ul></details>';
      if (options.length) {
        html += '<div class="calibration-options">';
        options.forEach(function(option, optionIndex) {
          html += '<button type="button" data-option="'+escapeAttr(option.key)+'" class="calibration-option '+(event.selected_option===option.key&&answer==='yes'?'is-selected':'')+'"><b>'+(optionIndex+1)+'</b><span><strong>'+escapeHtml(option.label)+'</strong><small>'+escapeHtml(option.detail)+'</small></span></button>';
        });
        html += '</div><div class="calibration-answers calibration-answers--negative"><button data-answer="no" class="' + (answer==='no'?'is-selected':'') + '">都不符合</button><button data-answer="unsure" class="' + (answer==='unsure'?'is-selected':'') + '">记不清</button></div>';
        options.forEach(function(option) {
          var visible = answer==='yes' && event.selected_option===option.key;
          html += '<div class="calibration-followup calibration-followup--structured '+(visible?'is-visible':'')+'" data-followup-for="'+escapeAttr(option.key)+'"><p>'+escapeHtml(option.followup_prompt||'具体更接近哪件事？')+'</p><div class="calibration-detail-options">';
          (option.followup_options||[]).forEach(function(detail) {
            html += '<button type="button" data-detail="'+escapeAttr(detail.key)+'" class="'+(event.selected_detail===detail.key?'is-selected':'')+'">'+escapeHtml(detail.label)+'</button>';
          });
          html += '</div><div class="calibration-match"><span>符合程度</span><button type="button" data-match="exact" class="'+((event.match_level||'exact')==='exact'?'is-selected':'')+'">很符合</button><button type="button" data-match="partial" class="'+(event.match_level==='partial'?'is-selected':'')+'">大致符合</button></div><div class="calibration-note-row"><label>实际年份 <select><option value="'+(event.event_year-1)+'" '+(event.actual_year===event.event_year-1?'selected':'')+'>'+ (event.event_year-1) +'年</option><option value="'+event.event_year+'" '+(!event.actual_year||event.actual_year===event.event_year?'selected':'')+'>'+event.event_year+'年</option><option value="'+(event.event_year+1)+'" '+(event.actual_year===event.event_year+1?'selected':'')+'>'+ (event.event_year+1) +'年</option></select></label><input maxlength="240" placeholder="可选：补充真实情况" value="'+escapeAttr(event.note||'')+'"><button type="button" data-save-note="1">保存补充</button></div></div>';
        });
      } else {
        html += '<div class="calibration-answers"><button data-answer="yes" class="' + (answer==='yes'?'is-selected':'') + '">有</button><button data-answer="no" class="' + (answer==='no'?'is-selected':'') + '">没有</button><button data-answer="unsure" class="' + (answer==='unsure'?'is-selected':'') + '">记不清</button></div><div class="calibration-followup ' + (answer==='yes'?'is-visible':'') + '"><label>实际发生年份 <select><option value="'+(event.event_year-1)+'" '+(event.actual_year===event.event_year-1?'selected':'')+'>'+ (event.event_year-1) +'年</option><option value="'+event.event_year+'" '+(!event.actual_year||event.actual_year===event.event_year?'selected':'')+'>'+event.event_year+'年</option><option value="'+(event.event_year+1)+'" '+(event.actual_year===event.event_year+1?'selected':'')+'>'+ (event.event_year+1) +'年</option></select></label><input maxlength="240" placeholder="可选：补充发生了什么" value="'+escapeAttr(event.note||'')+'"><button data-save-note="1">保存补充</button></div>';
      }
      html += '</div></article>';
    });
    html += '</div><div class="calibration-footer"><div id="calibrationConsistency" class="calibration-consistency">结构化选项会自动避免互相矛盾的记录</div><button type="button" class="calibration-primary" id="calibrationFinish">完成校对，进入 AI</button><p>命理分析仅供传统文化研究与参考。</p></div>';
    openHtml(html);
    document.querySelectorAll('.calibration-event').forEach(function(card) {
      card.querySelectorAll('[data-option]').forEach(function(button) {
        button.onclick = function() { selectStructuredOption(key, card, button.getAttribute('data-option')); };
      });
      card.querySelectorAll('[data-answer]').forEach(function(button) {
        button.onclick = function() { saveAnswer(key, card, button.getAttribute('data-answer')); };
      });
      card.querySelectorAll('[data-detail]').forEach(function(button) {
        button.onclick = function() { card.setAttribute('data-selected-detail',button.getAttribute('data-detail')); syncStructuredCard(card); saveAnswer(key,card,'yes'); };
      });
      card.querySelectorAll('[data-match]').forEach(function(button) {
        button.onclick = function() { card.setAttribute('data-match-level',button.getAttribute('data-match')); syncStructuredCard(card); saveAnswer(key,card,'yes'); };
      });
      card.querySelectorAll('[data-save-note]').forEach(function(save) { save.onclick = function() { saveAnswer(key, card, 'yes', true); }; });
    });
    document.getElementById('calibrationFinish').onclick = function() { try { localStorage.setItem(choiceKey(key), 'done'); } catch(e) {} close(); if (originalToggle) originalToggle(); };
  }

  function selectStructuredOption(key, card, optionKey) {
    var changed = card.getAttribute('data-selected-option') !== optionKey;
    card.setAttribute('data-answer','yes');
    card.setAttribute('data-selected-option',optionKey);
    if (changed) { card.setAttribute('data-selected-detail',''); card.setAttribute('data-match-level','exact'); }
    syncStructuredCard(card);
    saveAnswer(key,card,'yes');
  }

  function syncStructuredCard(card) {
    var answer=card.getAttribute('data-answer')||'', option=card.getAttribute('data-selected-option')||'', detail=card.getAttribute('data-selected-detail')||'', match=card.getAttribute('data-match-level')||'exact';
    card.querySelectorAll('[data-option]').forEach(function(button){button.classList.toggle('is-selected',answer==='yes'&&button.getAttribute('data-option')===option)});
    card.querySelectorAll('[data-answer]').forEach(function(button){button.classList.toggle('is-selected',button.getAttribute('data-answer')===answer)});
    card.querySelectorAll('[data-followup-for]').forEach(function(box){box.classList.toggle('is-visible',answer==='yes'&&box.getAttribute('data-followup-for')===option)});
    card.querySelectorAll('[data-detail]').forEach(function(button){button.classList.toggle('is-selected',button.getAttribute('data-detail')===detail)});
    card.querySelectorAll('[data-match]').forEach(function(button){button.classList.toggle('is-selected',button.getAttribute('data-match')===match)});
  }

  function saveAnswer(key, card, answer, withNote) {
    var structured=card.classList.contains('is-structured');
    if (answer!=='yes') { card.setAttribute('data-answer',answer); card.setAttribute('data-selected-option',''); card.setAttribute('data-selected-detail',''); card.setAttribute('data-match-level',answer==='no'?'none':'unsure'); }
    else card.setAttribute('data-answer','yes');
    if (structured) syncStructuredCard(card);
    var followup = structured ? card.querySelector('.calibration-followup.is-visible') : card.querySelector('.calibration-followup');
    if (!structured) {
      card.querySelectorAll('[data-answer]').forEach(function(button) { button.classList.toggle('is-selected', button.getAttribute('data-answer') === answer); });
      followup.classList.toggle('is-visible', answer === 'yes');
    }
    var year = answer === 'yes' && followup ? Number(followup.querySelector('select').value) : null;
    var note = answer === 'yes' && followup ? followup.querySelector('input').value : '';
    var payload={action:'answer',chart_key:key,event_key:card.getAttribute('data-event'),answer:answer,actual_year:year,note:note,
      selected_option:structured?(card.getAttribute('data-selected-option')||null):null,
      selected_detail:structured?(card.getAttribute('data-selected-detail')||null):null,
      match_level:structured?(card.getAttribute('data-match-level')||'exact'):(answer==='yes'?'exact':answer==='no'?'none':'unsure')};
    if (!token()) {
      var localEvents=readLocalEvents(key), eventKey=card.getAttribute('data-event');
      localEvents.forEach(function(event){if(event.event_key===eventKey){Object.assign(event,payload);delete event.action;delete event.chart_key}});
      writeLocalEvents(key,localEvents); updateProgress();
      if(withNote&&followup){var localSave=followup.querySelector('[data-save-note]');localSave.textContent='已保存';setTimeout(function(){localSave.textContent='保存补充'},1200)}
      return;
    }
    request('POST', key, payload)
      .then(function() { if (withNote) { var save=followup.querySelector('[data-save-note]'); save.textContent='已保存'; setTimeout(function(){save.textContent='保存补充'},1200); } updateProgress(); })
      .catch(function() { alert('保存失败，请稍后重试'); });
  }
  function updateProgress() {
    var total = document.querySelectorAll('.calibration-event').length;
    var done = Array.prototype.filter.call(document.querySelectorAll('.calibration-event'),function(card){return !!card.getAttribute('data-answer')}).length;
    var bar = document.querySelector('.calibration-progress i'), label = document.querySelector('.calibration-progress + small');
    if (bar) bar.style.width = Math.round(done / total * 100) + '%'; if (label) label.textContent = done + ' / ' + total + ' 已完成';
  }
  function escapeHtml(text) { var div=document.createElement('div'); div.textContent=String(text||''); return div.innerHTML; }
  function escapeAttr(text) { return escapeHtml(text).replace(/"/g,'&quot;'); }

  function inspectFirstClick(originalToggle) {
    var data = chartData(), key = chartKey(data);
    if (!data || !key) { originalToggle(); return; }
    var choice = ''; try { choice = localStorage.getItem(choiceKey(key)) || ''; } catch(e) {}
    if (choice) { originalToggle(); return; }
    if (!token()) {
      if (readLocalEvents(key).length) { try { localStorage.setItem(choiceKey(key), 'done'); } catch(e) {} originalToggle(); }
      else showConsent(key, originalToggle);
      return;
    }
    request('GET', key).then(function(result) {
      if (result.ready && (result.events||[]).some(function(event){return !event.answer})) renderEvents(key,result.events||[],originalToggle);
      else if (result.ready) { try { localStorage.setItem(choiceKey(key), 'done'); } catch(e) {} originalToggle(); }
      else showConsent(key, originalToggle);
    }).catch(function() { originalToggle(); });
  }

  function resumeArchiveCalibration() {
    var requested = false;
    try { requested = sessionStorage.getItem('zhishi_open_archive_calibration') === '1'; if (requested) sessionStorage.removeItem('zhishi_open_archive_calibration'); } catch(e) {}
    if (!requested) return;
    var wait = setInterval(function() {
      var data=chartData(), key=chartKey(data); if (!data || !key || !token()) return;
      clearInterval(wait); request('GET', key).then(function(result) {
        if (result.ready) renderEvents(key, result.events || [], null); else showConsent(key, function(){});
      }).catch(function(){});
    }, 250);
    setTimeout(function(){clearInterval(wait)},10000);
  }

  root.ZhishiCalibration = root.ZhishiCalibration || {};
  root.ZhishiCalibration.beforeAI = inspectFirstClick;
  root.ZhishiCalibration.summary = function(data) {
    var key=chartKey(data||chartData()), events=key?readLocalEvents(key):[];
    var weights={};
    var lines=events.filter(function(event){return event.answer==='yes'||event.answer==='no'}).map(function(event){
      var picked=(event.options||[]).filter(function(option){return option.key===event.selected_option})[0];
      var detail=picked&&(picked.followup_options||[]).filter(function(item){return item.key===event.selected_detail})[0];
      var domain=picked?picked.domain:event.domain;
      if(event.answer==='yes'&&picked){var profileKey=domain+':'+picked.manifestation;weights[profileKey]=weights[profileKey]||{score:0,domain:domain,label:picked.label,detail:detail&&detail.label};weights[profileKey].score+=event.match_level==='partial'?1:2}
      var state=event.answer==='yes'?(event.match_level==='partial'?'用户确认部分符合':'用户确认明显发生'):'用户确认没有发生';
      var statement=picked?(picked.label+(detail?'，具体是'+detail.label:'')):event.prompt;
      return (event.actual_year||event.event_year)+'年【'+(domainNames[domain]||'经历')+'】'+state+'：'+statement+(picked&&picked.mechanism_key?'；对应机制='+picked.mechanism_key:'')+(event.note?'；用户补充：'+event.note:'');
    });
    var patterns=Object.keys(weights).map(function(name){return weights[name]}).sort(function(a,b){return b.score-a.score}).slice(0,6);
    if(patterns.length)lines.unshift('【个人应事模型】'+patterns.map(function(item){return (domainNames[item.domain]||'经历')+'更常落在“'+item.label+(item.detail?'－'+item.detail:'')+'”'}).join('；')+'。这是现实反馈形成的取象权重，只调整解释方向，不得改写命盘事实。');
    return lines.join('\n').slice(0,2000);
  };
  root.ZhishiCalibration.open = function() {
    var data=chartData(), key=chartKey(data); if (!data || !key) return;
    request('GET', key).then(function(result) {
      if (result.ready) renderEvents(key, result.events || [], null); else showConsent(key, function(){});
    }).catch(function(){});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resumeArchiveCalibration); else resumeArchiveCalibration();
})(window);
