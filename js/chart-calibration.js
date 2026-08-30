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

  function annualDomain(analysis, liuNian, age) {
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
    var domain = Object.keys(scores).sort(function(a,b) { return scores[b] - scores[a]; })[0];
    if (age < 18 && domain === 'career') domain = 'study';
    if (age < 16 && domain === 'wealth') domain = 'family';
    if (age < 14 && domain === 'relationship') domain = 'family';
    return domain;
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
        var domain = annualDomain(analysis, liuNian, age);
        var gz = (liuNian.gan || '') + (liuNian.zhi || '');
        var dyGz = (dy.gan || '') + (dy.zhi || '');
        var evidence = (analysis.triggers || []).slice().sort(function(a,b) {
          var rank = { high:3, medium:2, low:1 }; return (rank[b.severity] || 0) - (rank[a.severity] || 0);
        }).slice(0,3).map(function(t) { return t.detail; });
        evidence.unshift(year + '年' + gz + '，处于' + dyGz + '大运；流年天干为' + analysis.stemRole + '，地支为' + analysis.branchRole + '。');
        out.push({
          event_key: year + '-' + domain + '-' + gz, year: year, domain: domain,
          prompt: predictedPrompt(domain, analysis, age, tenGod), evidence: evidence,
          confidence: score >= 8 ? 'high' : (score >= 4 ? 'medium' : 'low'), _score: score
        });
      }
      out.sort(function(a,b) { return b._score - a._score || b.year - a.year; });
      var seenPrompts = {}, domainCounts = {};
      out = out.filter(function(item) {
        if (seenPrompts[item.prompt] || Number(domainCounts[item.domain] || 0) >= 3) return false;
        seenPrompts[item.prompt] = true;
        domainCounts[item.domain] = Number(domainCounts[item.domain] || 0) + 1;
        return true;
      }).slice(0, 8).sort(function(a,b) { return b.year - a.year; });
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
    openHtml('<header class="calibration-head"><span>第一次问这张命盘前</span><h2 id="calibrationTitle">要不要先校对命盘？</h2><p>系统会先根据岁运断几段已经过去的经历。你只需要回答“有、没有、记不清”，之后 AI 会更清楚同一套命理结构在你身上具体表现在哪一面。</p></header><div class="calibration-privacy">不会修改四柱、旺衰、格局和喜用忌；'+storageText+'，也不影响购买记录。</div><div class="calibration-actions"><button type="button" class="calibration-primary" id="calibrationStart">先校对再问</button><button type="button" class="calibration-secondary" id="calibrationSkip">直接问 AI</button></div>');
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
    var html = '<header class="calibration-head"><span>过往事件校盘</span><h2 id="calibrationTitle">我先断，你来核对</h2><p>以下候选在你作答前已经生成并锁定。年份相差一年也可以按“有”确认，再选择实际年份。</p><div class="calibration-progress"><i style="width:' + Math.round(answered / events.length * 100) + '%"></i></div><small>' + answered + ' / ' + events.length + ' 已确认</small></header><div class="calibration-list">';
    events.forEach(function(event) {
      var answer = event.answer || '';
      html += '<article class="calibration-event" data-event="' + event.event_key + '"><div class="calibration-event__year">' + event.event_year + '<small>' + (domainNames[event.domain] || '经历') + '</small></div><div class="calibration-event__content"><p>' + event.prompt + '</p><details><summary>查看判断依据</summary><ul>' + (event.evidence || []).map(function(text){return '<li>'+escapeHtml(text)+'</li>'}).join('') + '</ul></details><div class="calibration-answers"><button data-answer="yes" class="' + (answer==='yes'?'is-selected':'') + '">有</button><button data-answer="no" class="' + (answer==='no'?'is-selected':'') + '">没有</button><button data-answer="unsure" class="' + (answer==='unsure'?'is-selected':'') + '">记不清</button></div><div class="calibration-followup ' + (answer==='yes'?'is-visible':'') + '"><label>实际发生年份 <select><option value="'+(event.event_year-1)+'" '+(event.actual_year===event.event_year-1?'selected':'')+'>'+ (event.event_year-1) +'年</option><option value="'+event.event_year+'" '+(!event.actual_year||event.actual_year===event.event_year?'selected':'')+'>'+event.event_year+'年</option><option value="'+(event.event_year+1)+'" '+(event.actual_year===event.event_year+1?'selected':'')+'>'+ (event.event_year+1) +'年</option></select></label><input maxlength="240" placeholder="可选：补充发生了什么" value="'+escapeAttr(event.note||'')+'"><button data-save-note="1">保存补充</button></div></div></article>';
    });
    html += '</div><div class="calibration-footer"><button type="button" class="calibration-primary" id="calibrationFinish">完成校对，进入 AI</button><p>命理分析仅供传统文化研究与参考。</p></div>';
    openHtml(html);
    document.querySelectorAll('.calibration-event').forEach(function(card) {
      card.querySelectorAll('[data-answer]').forEach(function(button) {
        button.onclick = function() { saveAnswer(key, card, button.getAttribute('data-answer')); };
      });
      var save = card.querySelector('[data-save-note]'); if (save) save.onclick = function() { saveAnswer(key, card, 'yes', true); };
    });
    document.getElementById('calibrationFinish').onclick = function() { try { localStorage.setItem(choiceKey(key), 'done'); } catch(e) {} close(); if (originalToggle) originalToggle(); };
  }

  function saveAnswer(key, card, answer, withNote) {
    var buttons = card.querySelectorAll('[data-answer]'), followup = card.querySelector('.calibration-followup');
    buttons.forEach(function(button) { button.classList.toggle('is-selected', button.getAttribute('data-answer') === answer); });
    followup.classList.toggle('is-visible', answer === 'yes');
    var year = answer === 'yes' ? Number(followup.querySelector('select').value) : null;
    var note = answer === 'yes' ? followup.querySelector('input').value : '';
    if (!token()) {
      var localEvents=readLocalEvents(key), eventKey=card.getAttribute('data-event');
      localEvents.forEach(function(event){if(event.event_key===eventKey){event.answer=answer;event.actual_year=year;event.note=note}});
      writeLocalEvents(key,localEvents); updateProgress();
      if(withNote){var localSave=followup.querySelector('[data-save-note]');localSave.textContent='已保存';setTimeout(function(){localSave.textContent='保存补充'},1200)}
      return;
    }
    request('POST', key, { action:'answer', chart_key:key, event_key:card.getAttribute('data-event'), answer:answer, actual_year:year, note:note })
      .then(function() { if (withNote) { var save=followup.querySelector('[data-save-note]'); save.textContent='已保存'; setTimeout(function(){save.textContent='保存补充'},1200); } updateProgress(); })
      .catch(function() { alert('保存失败，请稍后重试'); });
  }
  function updateProgress() {
    var total = document.querySelectorAll('.calibration-event').length;
    var done = document.querySelectorAll('.calibration-event .calibration-answers .is-selected').length;
    var bar = document.querySelector('.calibration-progress i'), label = document.querySelector('.calibration-progress + small');
    if (bar) bar.style.width = Math.round(done / total * 100) + '%'; if (label) label.textContent = done + ' / ' + total + ' 已确认';
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
      if (result.ready) { try { localStorage.setItem(choiceKey(key), 'done'); } catch(e) {} originalToggle(); }
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
    return events.filter(function(event){return event.answer==='yes'||event.answer==='no'}).map(function(event){return (event.actual_year||event.event_year)+'年【'+(domainNames[event.domain]||'经历')+'】'+(event.answer==='yes'?'用户确认发生':'用户确认没有发生')+'：'+event.prompt+(event.note?'；用户补充：'+event.note:'')}).join('\n').slice(0,2000);
  };
  root.ZhishiCalibration.open = function() {
    var data=chartData(), key=chartKey(data); if (!data || !key) return;
    request('GET', key).then(function(result) {
      if (result.ready) renderEvents(key, result.events || [], null); else showConsent(key, function(){});
    }).catch(function(){});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resumeArchiveCalibration); else resumeArchiveCalibration();
})(window);
