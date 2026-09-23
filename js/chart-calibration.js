(function(root) {
  'use strict';

  var domainNames = { study:'学业', career:'事业', wealth:'财务', relationship:'感情', family:'家庭', health:'身心状态', change:'生活变化' };
  var CANDIDATE_VERSION = 'bazi-cal-v9';
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

  function domainTriggers(domain, analysis) {
    return (analysis.triggers || []).filter(function(t) {
      var text = (t.type || '') + '|' + (t.detail || '');
      if (domain === 'relationship') return t.target === 'day' || /日柱|日支|夫妻/.test(text);
      if (domain === 'family') return t.target === 'year' || t.target === 'month' || /年柱|月柱|父母/.test(text);
      if (domain === 'study') return t.target === 'month' || /月柱|月支|印星|学业/.test(text);
      if (domain === 'career') return t.target === 'month' || t.target === 'hour' || /月柱|时柱|伤官见官|官逢伤官/.test(text);
      if (domain === 'wealth') return /财|比肩|劫财|资金/.test(text);
      if (domain === 'health') return t.target === 'day' || t.target === 'hour' || /天克地冲|六冲|刑|自刑|六害|伏吟/.test(t.type || '');
      return /天克地冲|六冲|刑|自刑|六害|六破|伏吟/.test(t.type || '');
    });
  }

  function domainDirection(domain, analysis) {
    var relevant = domainTriggers(domain, analysis), good = 0, bad = 0;
    relevant.forEach(function(t) {
      var weight = t.severity === 'high' ? 3 : (t.severity === 'medium' ? 2 : 1);
      if (t.isGood === true) good += weight;
      else if (t.isGood === false) bad += weight;
    });
    return good > bad ? 'good' : (bad > good ? 'bad' : 'neutral');
  }

  function parentYearContext(parentAnalysis, analysis, tenGod, dy, liuNian, age) {
    if (!parentAnalysis || !(parentAnalysis.evidence || parentAnalysis.facts)) return null;
    // evidence 是现行结构证据；facts 仅兼容旧档案。亲疏与家庭支持等级在
    // inferences 中，不能再被当成用户已经确认的现实事实。
    var facts = parentAnalysis.evidence || parentAnalysis.facts;
    var inferences = parentAnalysis.inferences || {};
    var yearHits = domainTriggers('family', analysis);
    var dyTenGod = '', branchGods = [];
    try { dyTenGod = BaZiCalculator.getShiShen(_bazi.day.gan, dy.gan) || ''; } catch (e) {}
    try { branchGods = (BaZiCalculator.getCangGan(liuNian.zhi) || []).map(function(g){ return BaZiCalculator.getShiShen(_bazi.day.gan, g); }); } catch (e) {}
    var fatherDirect = /偏财/.test((tenGod || '') + dyTenGod) || branchGods.indexOf('偏财') >= 0;
    var motherDirect = /正印/.test((tenGod || '') + dyTenGod) || branchGods.indexOf('正印') >= 0;
    var fatherHits = (facts.parentStars.father.appearances || []).filter(function(a){ return yearHits.some(function(t){ return t.target === a.pos; }); });
    var motherHits = (facts.parentStars.mother.appearances || []).filter(function(a){ return yearHits.some(function(t){ return t.target === a.pos; }); });
    var target = fatherDirect || fatherHits.length > motherHits.length ? 'father' : (motherDirect || motherHits.length ? 'mother' : 'palace');
    var star = target === 'father' ? facts.parentStars.father : (target === 'mother' ? facts.parentStars.mother : null);
    if (target === 'palace' && !yearHits.length) {
      if (facts.parentStars.father.damageEvents.length > facts.parentStars.mother.damageEvents.length) target = 'father';
      else if (facts.parentStars.mother.damageEvents.length) target = 'mother';
      star = target === 'father' ? facts.parentStars.father : (target === 'mother' ? facts.parentStars.mother : null);
    }
    var relevantHits = target === 'palace' ? yearHits : yearHits.filter(function(t) {
      return (star.appearances || []).some(function(a){ return t.target === a.pos; });
    });
    var good = relevantHits.filter(function(t){return t.isGood === true}).length;
    var bad = relevantHits.filter(function(t){return t.isGood === false}).length;
    var direction = good > bad ? 'good' : (bad > good ? 'bad' : domainDirection('family', analysis));
    var palaceGood = facts.palace.state === 'stable';
    var starGood = star ? star.state === 'strong' : (facts.parentStars.father.state !== 'weak' && facts.parentStars.mother.state !== 'weak');
    var quadrant = palaceGood ? (starGood ? 'palace-good-star-good' : 'palace-good-star-weak') : (starGood ? 'palace-damaged-star-good' : 'palace-damaged-star-weak');
    var consequences = target === 'father'
      ? [{key:'father_work',label:'父亲换工作、收入起伏或事业安排改变'},{key:'family_money',label:'家里收入、支出或经济压力随之变化'},{key:'father_health',label:'父亲检查、治疗或身体状态反复'}]
      : (target === 'mother'
        ? [{key:'mother_role',label:'母亲承担的家事、工作或照顾责任改变'},{key:'mother_health',label:'母亲检查、治疗或身体状态反复'},{key:'home_support',label:'住房、学习或生活安排受到母亲影响'}]
        : [{key:'parent_relation',label:'父母争执、冷淡或相处方式改变'},{key:'home_move',label:'搬家、住房或共同生活安排改变'},{key:'family_money',label:'家庭经济和生活条件随之变化'}]);
    if (age <= 23) consequences.push({key:'study_impact',label:'家庭变化进一步影响转学、升学或学习状态'});
    else consequences.push({key:'work_impact',label:'家庭变化进一步影响你的工作、城市或生活计划'});
    return { target:target, star:star, palace:facts.palace, family:inferences.family || facts.family || null, yearHits:yearHits,
      relevantHits:relevantHits, direction:direction, quadrant:quadrant, consequences:consequences,
      activationScore:yearHits.length + (fatherDirect || motherDirect ? 2 : 0), dyTenGod:dyTenGod, annualTenGod:tenGod };
  }

  function predictedPrompt(domain, analysis, age, tenGod, parentContext) {
    var domainTrend = domainDirection(domain, analysis);
    var good = domainTrend === 'good';
    var bad = domainTrend === 'bad';
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
      if (parentContext) { good = parentContext.direction === 'good'; bad = parentContext.direction === 'bad'; }
      if (parentContext && parentContext.target === 'father') return bad
        ? '这一年父亲的工作、收入或身体状态是否出现过明显波动，需要家里替他操心、出钱或调整安排？'
        : (good ? '这一年父亲的工作和收入是否出现过明显机会，或者他给家庭的实际支持比之前更多？' : '这一年父亲的工作、收入、身体状态或他在家中的角色是否发生过明显变化？');
      if (parentContext && parentContext.target === 'mother') return bad
        ? '这一年母亲是否更劳累、身体状态反复，或家里有一件事主要由她承担，让你明显为她操心？'
        : (good ? '这一年母亲的生活状态是否更稳定，或者她在住房、学习、工作等现实事情上给过你明显帮助？' : '这一年母亲的生活、身体状态或她在家中的责任是否发生过明显变化？');
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
    if (domain === 'health') {
      if (strongChange && bad) return '这一年是否明显睡不好、容易疲惫或压力顶到身体上，曾经做过检查、治疗，或因磕碰扭伤影响正常生活？';
      if (/官|杀/.test(tenGod || '') && bad) return '这一年是否长期处在紧张和赶进度的状态，睡眠、胃口、情绪或体力有一项明显变差？';
      if (/印/.test(tenGod || '') && good) return '这一年身体和作息是否比之前稳定，原有的小毛病得到休养、检查或治疗后明显缓解？';
      return prompts.health;
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
    var task = fetch(url, {
      method: method, cache: 'no-store',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + token() },
      body: method === 'POST' ? JSON.stringify(body) : undefined
    }).then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) { var error = new Error(data.error || '校准读取失败'); error.status = response.status; throw error; }
        return data;
      });
    });
    if(method !== 'GET')return task;
    var timer;
    var timeout=new Promise(function(resolve,reject){timer=setTimeout(function(){reject(new Error('读取超时，请稍后重试'));},12000);});
    return Promise.race([task,timeout]).then(function(data){if(typeof clearTimeout==='function')clearTimeout(timer);return data;},function(error){if(typeof clearTimeout==='function')clearTimeout(timer);throw error;});
  }

  function annualDomainScores(analysis, liuNian, age) {
    var scores = { study:0, career:0, wealth:0, relationship:0, family:0, health:0, change:1 };
    if (analysis && analysis.eventAdjudication && analysis.eventAdjudication.domainRecords) {
      Object.keys(scores).forEach(function(domain) { scores[domain] = -1; });
      analysis.eventAdjudication.domainRecords.forEach(function(record) {
        scores[record.domain] = Number(record.activationScore || 0);
      });
      return scores;
    }
    (analysis.triggers || []).forEach(function(trigger) {
      if (trigger.target === 'day' || /日柱|日支|夫妻/.test(trigger.detail || '')) scores.relationship += 4;
      if (trigger.target === 'year' || /年柱/.test(trigger.detail || '')) scores.family += 3;
      if (trigger.target === 'month' || /月柱|月支/.test(trigger.detail || '')) {
        if (age <= 23) scores.study += 3; else scores.career += 3;
      }
      if (trigger.target === 'hour' || /时柱|时支/.test(trigger.detail || '')) scores.career += 2;
      if (/天克地冲|六冲|刑|六害|六破|伏吟/.test(trigger.type || '')) scores.change += 2;
      if ((trigger.target === 'day' || trigger.target === 'hour') && /天克地冲|六冲|刑|自刑|六害|伏吟/.test(trigger.type || '')) scores.health += 3;
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
    health: [
      {key:'sleep_energy',label:'睡眠、精力或长期疲惫'}, {key:'check_treatment',label:'检查、治疗或旧问题复发'},
      {key:'injury_recovery',label:'磕碰、扭伤或恢复期'}, {key:'stress_body',label:'压力大到影响胃口、情绪或身体状态'}
    ],
    change: [
      {key:'move_city',label:'搬家、异地或长期离开原环境'}, {key:'school_job_change',label:'学校、工作或主要圈子改变'},
      {key:'identity_plan',label:'身份、计划或生活重心改变'}, {key:'forced_restart',label:'原计划被打断后重新开始'}
    ]
  };

  function mechanismKey(domain, analysis, tenGod, parentContext) {
    var triggers = domainTriggers(domain, analysis).map(function(item){return item.type || ''}).join('|');
    if (domain === 'relationship' && /六冲|天克地冲/.test(triggers)) return 'day-palace:clash';
    if (domain === 'relationship' && /六合|半合|三合/.test(triggers)) return 'day-palace:combine';
    if (domain === 'career' && /伤官见官|官逢伤官/.test(triggers)) return 'output-controls-officer';
    if (domain === 'wealth' && /比肩|劫财/.test(tenGod || '')) return 'peer-wealth';
    if (domain === 'family' && parentContext) return 'parent-' + parentContext.target + ':' + (parentContext.yearHits[0] ? String(parentContext.yearHits[0].type || 'activation') : 'natal-state');
    if (domain === 'health') return 'body-pressure:' + String(tenGod || 'annual-trigger');
    return domain + ':' + String(tenGod || 'annual-trigger').replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g,'').slice(0,30);
  }

  function manifestationKey(domain, analysis, tenGod) {
    var direction = domainDirection(domain, analysis);
    if (domain === 'wealth' && /比肩|劫财/.test(tenGod || '')) return direction === 'good' ? 'network-income' : 'partnership-loss';
    if (domain === 'career' && /(伤官见官|官逢伤官)/.test((analysis.triggers || []).map(function(t){return t.type||''}).join('|'))) return 'authority-conflict';
    if (domain === 'relationship') return direction === 'good' ? 'relationship-progress' : (direction === 'bad' ? 'relationship-instability' : 'relationship-change');
    if (domain === 'family') return direction === 'good' ? 'family-support' : (direction === 'bad' ? 'family-pressure' : 'family-change');
    if (domain === 'study') return direction === 'good' ? 'study-progress' : (direction === 'bad' ? 'study-pressure' : 'study-change');
    if (domain === 'career') return direction === 'good' ? 'career-progress' : (direction === 'bad' ? 'career-pressure' : 'career-change');
    if (domain === 'wealth') return direction === 'good' ? 'income-growth' : (direction === 'bad' ? 'money-outflow' : 'money-change');
    if (domain === 'health') return direction === 'good' ? 'health-recovery' : (direction === 'bad' ? 'health-pressure' : 'health-change');
    return 'environment-change';
  }

  function conciseLabel(domain, analysis, tenGod, parentContext) {
    var labels = {study:'升学考试或学习状态',career:'工作岗位或责任变化',wealth:'收入、支出或资金变化',relationship:'感情关系出现转折',family:'父母、住房或家庭变化',health:'身体、睡眠或压力变化',change:'生活环境或人生计划变化'};
    if (domain === 'wealth' && /比肩|劫财/.test(tenGod || '')) return domainDirection(domain, analysis)==='good'?'朋友团队带来赚钱机会':'合伙、人情或竞争带来损失';
    if (domain === 'family' && parentContext) return parentContext.target === 'father' ? '父亲的工作、钱或身体状态变化' : (parentContext.target === 'mother' ? '母亲的生活、身体或家庭角色变化' : '父母关系或家庭根基发生变化');
    if (domain === 'career' && /(伤官见官|官逢伤官)/.test((analysis.triggers || []).map(function(t){return t.type||''}).join('|'))) return '与领导、制度或审核发生冲突';
    return labels[domain] || labels.change;
  }

  function optionEvidence(domain, analysis, parentContext) {
    var evidence = domainTriggers(domain, analysis).slice(0,2).map(function(t){ return t.detail || t.type; }).filter(Boolean);
    if(!evidence.length){var record=(analysis.eventAdjudication && analysis.eventAdjudication.domainRecords||[]).filter(function(item){return item.domain===domain && item.hasIndependentAnnualTrigger;})[0];if(record)evidence=(record.evidence||[]).slice(0,2);}
    if (domain === 'family' && parentContext) {
      var quadrantText = {'palace-good-star-good':'父母宫稳、父母星也有力','palace-good-star-weak':'父母宫尚稳，但被引动的父母星偏弱','palace-damaged-star-good':'父母宫有损，但被引动的父母星仍有力量','palace-damaged-star-weak':'父母宫和被引动的父母星同时承压'};
      if (parentContext.target === 'father' && parentContext.star) evidence.push('原局偏财父星为' + parentContext.star.state + '，属于' + parentContext.star.roleLabel + '；' + quadrantText[parentContext.quadrant] + '。');
      else if (parentContext.target === 'mother' && parentContext.star) evidence.push('原局正印母星为' + parentContext.star.state + '，属于' + parentContext.star.roleLabel + '；' + quadrantText[parentContext.quadrant] + '。');
      else evidence.push('原局' + quadrantText[parentContext.quadrant] + '，本年又直接引动年柱。');
    }
    return evidence.slice(0,3);
  }

  function competingOption(domain, analysis, age, tenGod, parentContext) {
    var option = {
      _triggerKeys: domainTriggers(domain, analysis).map(function(t){return (t.target||'')+':'+(t.type||'');}),
      _independent: !!(analysis.eventAdjudication && (analysis.eventAdjudication.domainRecords||[]).some(function(r){return r.domain===domain && r.hasIndependentAnnualTrigger;})),
      key: domain + ':' + manifestationKey(domain, analysis, tenGod),
      label: conciseLabel(domain, analysis, tenGod, parentContext),
      detail: predictedPrompt(domain, analysis, age, tenGod, parentContext).replace(/^这一年是否/, '').replace(/[？?]$/, ''),
      domain: domain,
      manifestation: manifestationKey(domain, analysis, tenGod),
      mechanism_key: mechanismKey(domain, analysis, tenGod, parentContext),
      evidence: optionEvidence(domain, analysis, parentContext),
      followup_prompt: '如果是这一类，具体更接近哪件事？',
      followup_options: domain === 'family' && parentContext ? parentContext.consequences : (followupSets[domain] || followupSets.change)
    };
    // Old generic choices also need neutral wording when historical employment is unknown.
    var life=analysis.reportLifeContext||analysis.eventAdjudication&&analysis.eventAdjudication.lifeContext;
    if(life&&domain!=='family'&&root.DeepReport&&root.DeepReport.contextScenario){
      var scenario=root.DeepReport.contextScenario(domain,domainDirection(domain,analysis)==='good'?'偏有利':domainDirection(domain,analysis)==='bad'?'偏不利':'条件性',life);
      if(scenario){option.label={study:'学习与准备',career:'任务与协作',wealth:'可支配费用',relationship:'联系与相处',change:'生活安排',health:'精力与节奏'}[domain];option.detail=scenario;option.followup_options=[];option.manifestation+=':scene-'+(root.ReportImagery?root.ReportImagery.resolveScene(life):'daily');option.key=domain+':'+option.manifestation;}
    }
    var professional=root.ZhishiCalibrationModel&&root.ZhishiCalibrationModel.professionalCandidates
      ? root.ZhishiCalibrationModel.professionalCandidates(domain,analysis) : [];
    return professional.length ? Object.assign(option,professional[0]) : option;
  }

  function competingOptions(domain, analysis, age, tenGod, parentContext) {
    var base=competingOption(domain,analysis,age,tenGod,parentContext);
    var candidates=root.ZhishiCalibrationModel&&root.ZhishiCalibrationModel.professionalCandidates
      ? root.ZhishiCalibrationModel.professionalCandidates(domain,analysis):[];
    return candidates.length?candidates.map(function(c){return Object.assign({},base,c);}):[base];
  }

  function dedupeOptionDomains(rankedDomains, scores, parentContext) {
    // Do not re-add a domain discarded during deduplication via a fallback list.
    return rankedDomains.filter(function(name,index,rows){return scores[name]>=0 && rows.indexOf(name)===index;});
  }

  function optionMeaning(option) {
    var owner=option.domain==='family' ? ((option.mechanism_key||'').match(/^parent-([^:]+)/)||[])[1]||'family' : '';
    return [option.domain,option.manifestation||option.key,owner].join(':');
  }
  function optionText(option) { return String(option.detail||'').replace(/[\s，。；、？！,.!?;：:]/g,''); }
  function distinctYearOptions(options) {
    var seenText={};
    return options.filter(function(option){
      if(option.domain!=='change')return true;
      // A broad environment change must not compete with the same triggered school/job/home event.
      return !options.some(function(specific){return ['study','career','family','relationship'].indexOf(specific.domain)>=0 &&
        (option._triggerKeys||[]).some(function(key){return (specific._triggerKeys||[]).indexOf(key)>=0;});});
    }).filter(function(option){var key=optionText(option);if(seenText[key])return false;seenText[key]=true;return true;});
  }
  function selectDistinctCandidates(pool, preserved) {
    preserved=(preserved||[]).filter(function(item){return !!item.answer;});
    var chosen=[],chosenYears={},domainCounts={},meanings={},texts={},repeated=false;
    function register(item) {
      var year=Number(item.year||item.event_year);chosenYears[year]=true;
      domainCounts[item.domain]=Number(domainCounts[item.domain]||0)+1;
      (item.options||[]).forEach(function(option){
        var key=optionMeaning(option);if(!meanings[key])meanings[key]=[];
        meanings[key].push({year:year,option:option});texts[optionText(option)]=true;
      });
    }
    preserved.forEach(register);
    var limit=Math.max(0,5-preserved.length);
    function prepare(item,allowRepeat) {
      if(!item || chosenYears[Number(item.year)] || chosen.length>=limit)return null;
      var repeat=null,options=distinctYearOptions(item.options||[]).filter(function(option){
        var matches=meanings[optionMeaning(option)]||[];
        if(!matches.length && !texts[optionText(option)])return true;
        if(!allowRepeat || repeated || repeat || matches.length!==1 || !option._independent)return false;
        var prior=matches[0];
        // A ±1-year recollection must not count the same episode twice. Older saved options
        // without independent-trigger metadata are not evidence for a repeat invitation.
        if(!prior.option._independent || Math.abs(Number(item.year)-prior.year)<3 ||
          !option.mechanism_key || option.mechanism_key!==prior.option.mechanism_key)return false;
        repeat={year:prior.year,key:option.key};return true;
      }).slice(0,3);
      if(!options.length || (allowRepeat && !repeat))return null;
      if(Number(domainCounts[options[0].domain]||0)>=2)return null;
      var prompt=item.prompt;
      if(repeat && options.some(function(o){return o.key===repeat.key;})) {
        prompt+=' 其中一项与'+repeat.year+'年作跨年对照：两年各有独立触发，核对是否对应相似经历，也可以两年都选不符合。';
      } else repeat=null;
      return Object.assign({},item,{domain:options[0].domain,options:options,prompt:prompt,
        mechanism_key:options[0].mechanism_key,_repeat:repeat});
    }
    function take(item,allowRepeat) {
      var next=prepare(item,allowRepeat);if(!next)return false;
      chosen.push(next);register(next);if(next._repeat)repeated=true;return true;
    }
    // 先保证不同人生阶段均有代表题；题目要有新信息，不为凑满五题重复提问。
    ['school','youth','early-adult','midlife','mature'].forEach(function(stage){
      pool.some(function(item){return item._stage===stage && take(item,false);});
    });
    pool.forEach(function(item){take(item,false);});
    if(chosen.length<limit)pool.some(function(item){return take(item,true);});
    return chosen.sort(function(a,b){return b.year-a.year;}).map(function(item){
      var clean=Object.assign({},item);delete clean._score;delete clean._stage;delete clean._repeat;
      clean.options=item.options.map(function(option){var copy=Object.assign({},option);delete copy._triggerKeys;delete copy._independent;return copy;});
      return clean;
    });
  }

  function generateCandidates(data, preserved) {
    var out = [];
    try {
      if (typeof _bazi === 'undefined' || !_bazi || typeof _daYunData === 'undefined' || !_daYunData || !_daYunData.list) return out;
      var birthYear = Number(new URLSearchParams(location.search).get('year'));
      if (!birthYear && data.birthInfo) birthYear = Number(data.birthInfo.year || String(data.birthInfo.standardTime || '').slice(0,4));
      // 没有真实出生年就无法把岁运落到真实年龄，宁可不出校对题，也不能假定成 20 岁。
      if (!isFinite(birthYear) || birthYear <= 0) return out;
      var nowYear = new Date().getFullYear();
      // 从具备稳定记忆的年龄开始覆盖完整既往人生，不再只看最近十四年。
      var firstYear = birthYear + 6;
      var yongJi = data.yongJi || (BaZiCalculator.getYongJi ? BaZiCalculator.getYongJi(_bazi) : null);
      var mechanismContext={chain:root.BaZiChain.analyze?root.BaZiChain.analyze(_bazi):{},yongJi:yongJi,
        pattern:yongJi&&yongJi.resolvedPattern||data.pattern||{},congGe:data.congGe||false};
      var parentAnalysis = null;
      var structuralRisks=data.structuralRisks;
      if(!Array.isArray(structuralRisks) && root.StructuralAnalysis)structuralRisks=root.StructuralAnalysis.evaluate(_bazi,BaZiCalculator).structuralRisks;
      var dyByYear = {}, liuNianByYear = {};
      try { parentAnalysis = BaZiCalculator.analyzeParents(_bazi, data.birthInfo && data.birthInfo.gender); } catch (e) {}
      // 每步大运只展开一次流年，完整人生扫描仍保持线性开销。
      _daYunData.list.forEach(function(item) {
        var annuals = [];
        try { annuals = BaZiCalculator.calculateLiuNian(item, _bazi.day.gan) || []; } catch (e) {}
        annuals.forEach(function(annual) {
          var annualYear = Number(annual.year);
          if (!isFinite(annualYear)) return;
          dyByYear[annualYear] = item;
          liuNianByYear[annualYear] = annual;
        });
      });
      for (var year = firstYear; year < nowYear; year++) {
        var dy = dyByYear[year] || _daYunData.list.filter(function(item) { return year >= Number(item.startYear) && year <= Number(item.endYear); })[0];
        if (!dy) continue;
        var liuNian = liuNianByYear[year];
        if (!liuNian) continue;
        var age = year - birthYear;
        var fortunePeriod = data.fortuneAnalysis && data.fortuneAnalysis.periods
          ? data.fortuneAnalysis.periods.filter(function(period) {
              return period.gan === dy.gan && period.zhi === dy.zhi
                && (!period.startYear || Number(period.startYear) === Number(dy.startYear));
            })[0]
          : null;
        var analysis = root.BaZiChain.analyzeLiuNian(_bazi, dy, liuNian, yongJi, { age:age, birthYear:birthYear || null, daYunPeriod:fortunePeriod });
        if(root.DeepReport&&root.DeepReport.matchTriggeredRisks)analysis=Object.assign({},analysis,{reportTriggeredRisks:root.DeepReport.matchTriggeredRisks(structuralRisks,liuNian,dy,analysis,BaZiCalculator,year,_bazi.day.gan)});
        // The present occupation is not evidence of a person's occupation in a past year.
        analysis=Object.assign({},analysis,{reportMechanismContext:mechanismContext,reportLifeContext:{status:'unknown',age:age,historical:true}});
        var high = (analysis.triggers || []).filter(function(t) { return t.severity === 'high'; }).length;
        var score = Number(analysis.dangerScore || 0) + Number(analysis.opportunityScore || 0) + high * 2 + Math.min((analysis.triggers || []).length, 4);
        var tenGod = '';
        try { tenGod = BaZiCalculator.getShiShen(_bazi.day.gan, liuNian.gan) || ''; } catch (e) {}
        var parentContext = parentYearContext(parentAnalysis, analysis, tenGod, dy, liuNian, age);
        var scores = annualDomainScores(analysis, liuNian, age);
        if (parentContext) scores.family += Math.min(parentContext.activationScore, 4);
        var rankedDomains = Object.keys(scores).filter(function(name){return scores[name] >= 0}).sort(function(a,b){return scores[b]-scores[a]});
        var domain = rankedDomains[0] || annualDomain(analysis, liuNian, age);
        var optionDomains = dedupeOptionDomains(rankedDomains, scores, parentContext);
        if (analysis.eventAdjudication && Array.isArray(analysis.eventAdjudication.domainRecords)) {
          optionDomains=optionDomains.filter(function(name){return analysis.eventAdjudication.domainRecords.some(function(r){return r.domain===name&&r.hasIndependentAnnualTrigger;});});
        }
        if (!optionDomains.length) continue;
        // Round-robin domains so expanding a rule's variants cannot crowd every other domain out.
        var optionGroups=optionDomains.map(function(name){return competingOptions(name,analysis,age,tenGod,name==='family'?parentContext:null);});
        var options=[];for(var oi=0;oi<Math.max.apply(null,optionGroups.map(function(g){return g.length;}));oi++)optionGroups.forEach(function(g){if(g[oi])options.push(g[oi]);});
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
          confidence: score >= 8 ? 'high' : (score >= 4 ? 'medium' : 'low'), _score: score,
          _stage: age <= 17 ? 'school' : (age <= 25 ? 'youth' : (age <= 35 ? 'early-adult' : (age <= 49 ? 'midlife' : 'mature')))
        });
      }
      out.sort(function(a,b) { return b._score - a._score || b.year - a.year; });
      out = selectDistinctCandidates(out, preserved);
    } catch (error) { console.warn('[calibration] 候选生成失败:', error.message); }
    return out;
  }

  function ensureShell() {
    var shell = document.getElementById('calibrationShell');
    if (shell) return shell;
    shell = document.createElement('div'); shell.id = 'calibrationShell'; shell.className = 'calibration-shell';
    shell.innerHTML = '<div class="calibration-backdrop" data-close="1"></div><section class="calibration-panel" role="dialog" aria-modal="true" aria-labelledby="calibrationTitle"><button class="calibration-close" type="button" data-close="1" aria-label="关闭">×</button><div id="calibrationBody"></div></section>';
    document.body.appendChild(shell);
    shell.addEventListener('click', function(event) { if (event.target.getAttribute('data-close') === '1') { close(); if (reportDismiss) reportDismiss(); } });
    return shell;
  }
  function openHtml(html) { var shell = ensureShell(); document.getElementById('calibrationBody').innerHTML = html; shell.classList.add('is-open'); document.body.classList.add('calibration-open'); }
  function close() { var shell = document.getElementById('calibrationShell'); if (shell) shell.classList.remove('is-open'); document.body.classList.remove('calibration-open'); }
  function choiceKey(key) { return 'zhishi_calibration_choice:' + key; }
  function localDataKey(key) { return 'zhishi_calibration_data:' + key; }
  function readLocalEvents(key) { try { var rows=JSON.parse(localStorage.getItem(localDataKey(key)) || '[]');return Array.isArray(rows)?rows:[]; } catch(e) { return []; } }
  function prepareLocalEvents(key, data) {
    var existing=readLocalEvents(key), version='';
    try{version=localStorage.getItem('zhishi_calibration_version:'+key)||'';}catch(e){}
    if(!existing.length || version===CANDIDATE_VERSION)return existing;
    if(typeof _bazi==='undefined' || !_bazi || typeof _daYunData==='undefined' || !_daYunData || !_daYunData.list)return existing;
    var answered=existing.filter(function(event){return !!event.answer;});
    var fresh=generateCandidates(data,answered).map(function(item){return Object.assign({answer:null,actual_year:null,note:''},item,{event_year:item.year});});
    // Never replace saved answers with newly generated wording, even when the old set repeats.
    if(!fresh.length && !answered.length)return existing;
    var upgraded=answered.concat(fresh).sort(function(a,b){return Number(b.event_year)-Number(a.event_year);});
    if(!writeLocalEvents(key,upgraded))return existing;
    try{localStorage.setItem('zhishi_calibration_version:'+key,CANDIDATE_VERSION);}catch(e){}
    return upgraded;
  }
  function writeLocalEvents(key, events) { try { localStorage.setItem(localDataKey(key), JSON.stringify(events)); return true; } catch(e) { return false; } }

  function showConsent(key, originalToggle) {
    var storageText=token()?'确认结果只保存在你的账号下':'未登录时确认结果只保存在当前设备';
    openHtml('<header class="calibration-head"><span>第一次问这张命盘前</span><h2 id="calibrationTitle">要不要先做应事校对？</h2><p>系统先找出几个过去最容易发生变化的年份。你从互不重复的现实表现里选最接近的一项，AI以后会优先按你真正的应事方式分析。</p></header><div class="calibration-privacy">不会修改四柱、旺衰、格局和喜用忌；'+storageText+'，也不影响购买记录。</div><div class="calibration-actions"><button type="button" class="calibration-primary" id="calibrationStart">先校对再问</button><button type="button" class="calibration-secondary" id="calibrationSkip">直接问 AI</button></div>');
    document.getElementById('calibrationStart').onclick = function() { start(key, originalToggle); };
    document.getElementById('calibrationSkip').onclick = function() { try { localStorage.setItem(choiceKey(key), 'skip'); } catch(e) {} close(); originalToggle(); };
  }

  function start(key, originalToggle) {
    var data = chartData(), candidates = generateCandidates(data);
    if (!candidates.length) { calibrationUnavailable('当前没有可定位的往事年份，可以先阅读报告。', originalToggle); return; }
    if (!token()) {
      var localEvents = candidates.map(function(item) { return Object.assign({ answer:null, actual_year:null, note:'' }, item, { event_year:item.year }); });
      var existing=prepareLocalEvents(key,data);
      if(existing.length)localEvents=existing;
      if(writeLocalEvents(key, localEvents)){try{localStorage.setItem('zhishi_calibration_version:'+key,CANDIDATE_VERSION);}catch(e){}} renderEvents(key, localEvents, originalToggle); return;
    }
    openHtml('<div class="calibration-loading">正在从你已经走过的人生阶段中筛选辨识度最高的年份…</div>');
    attachReportSkip();
    request('POST', key, { action:'initialize', chart_key:key, chart_signature:signature(data), candidate_version:CANDIDATE_VERSION, candidates:candidates })
      .then(function(result) { renderEvents(key, result.events || [], originalToggle); })
      .catch(function(error) { if(!originalToggle || !originalToggle.isActive || originalToggle.isActive())calibrationUnavailable(error.message || '校准暂时不可用', originalToggle); });
  }

  function renderEvents(key, events, originalToggle) {
    if(originalToggle && originalToggle.isActive && !originalToggle.isActive())return;
    if (!events.length) { close(); if (originalToggle) originalToggle(); return; }
    var answered = events.filter(function(event) { return event.answer; }).length;
    var html = '<header class="calibration-head"><span>命盘应事校对</span><h2 id="calibrationTitle">核对你经历过的事</h2><p>每个年份只选最接近真实经历的一类，再补充具体发生了什么。问题和依据在回答前已经锁定，不会根据你的选择倒推命盘。</p><div class="calibration-progress"><i style="width:' + Math.round(answered / events.length * 100) + '%"></i></div><small>' + answered + ' / ' + events.length + ' 已完成</small></header><div class="calibration-list">';
    events.forEach(function(event) {
      var answer = event.answer || '';
      var options = Array.isArray(event.options) ? event.options : [];
      html += '<article class="calibration-event ' + (options.length?'is-structured':'is-legacy') + '" data-event="' + escapeAttr(event.event_key) + '" data-answer="' + escapeAttr(answer) + '" data-selected-option="' + escapeAttr(event.selected_option||'') + '" data-selected-detail="' + escapeAttr(event.selected_detail||'') + '" data-match-level="' + escapeAttr(event.match_level||'exact') + '"><div class="calibration-event__year">' + event.event_year + '<small>' + (domainNames[event.domain] || '经历') + '</small></div><div class="calibration-event__content"><p>' + escapeHtml(event.prompt) + '</p><details><summary>为什么重点看这一年</summary><ul>' + (event.evidence || []).map(function(text){return '<li>'+escapeHtml(text)+'</li>'}).join('') + '</ul></details>';
      if (options.length) {
        html += '<div class="calibration-options">';
        options.forEach(function(option, optionIndex) {
          html += '<button type="button" data-option="'+escapeAttr(option.key)+'" class="calibration-option '+(event.selected_option===option.key&&answer==='yes'?'is-selected':'')+'"><b>'+(optionIndex+1)+'</b><span><strong>'+escapeHtml(option.label)+'</strong></span></button>';
        });
        html += '</div><div class="calibration-answers calibration-answers--negative"><button data-answer="no" class="' + (answer==='no'?'is-selected':'') + '">都不符合</button><button data-answer="unsure" class="' + (answer==='unsure'?'is-selected':'') + '">记不清</button></div>';
        options.forEach(function(option) {
          var visible = answer==='yes' && event.selected_option===option.key;
          html += '<div class="calibration-followup calibration-followup--structured '+(visible?'is-visible':'')+'" data-followup-for="'+escapeAttr(option.key)+'"><div class="calibration-locked-judgment"><strong>系统原判断</strong><p>'+escapeHtml(option.detail)+'</p>'+(option.evidence&&option.evidence.length?'<small>依据：'+escapeHtml(option.evidence.join('；'))+'</small>':'')+'</div><p>'+escapeHtml(option.followup_prompt||'具体更接近哪件事？')+'</p><div class="calibration-detail-options">';
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
    html += '</div><div class="calibration-footer"><div id="calibrationConsistency" class="calibration-consistency">不同年份可以有不同经历；不符合请如实选择。</div><button type="button" class="calibration-primary" id="calibrationFinish">' + escapeHtml(originalToggle && originalToggle.finishLabel || '完成校对，进入 AI') + '</button><p>命理分析仅供传统文化研究与参考。</p></div>';
    openHtml(html);
    attachReportSkip();
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
    document.getElementById('calibrationFinish').onclick = function() {
      var button=this;button.disabled=true;button.textContent='正在确认保存…';
      Promise.all(Object.keys(saveQueues).filter(function(k){return k.indexOf(key+':')===0;}).map(function(k){return saveQueues[k];})).then(function(){
        if(Object.keys(saveErrors).some(function(k){return k.indexOf(key+':')===0;})){button.disabled=false;button.textContent='有答案未保存，请重选后再完成';return;}
        try { localStorage.setItem(choiceKey(key), 'done'); } catch(e) {}
        close();if(originalToggle)originalToggle();
      });
    };
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

  var saveQueues = {}, saveErrors = {};
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
      if(!writeLocalEvents(key,localEvents)){saveErrors[key+':'+eventKey]=true;alert('当前设备无法保存，请允许本地存储后重新作答');return;}
      delete saveErrors[key+':'+eventKey]; updateProgress();
      if(withNote&&followup){var localSave=followup.querySelector('[data-save-note]');localSave.textContent='已保存';setTimeout(function(){localSave.textContent='保存补充'},1200)}
      return;
    }
    var queueKey=key+':'+payload.event_key;
    saveQueues[queueKey]=(saveQueues[queueKey]||Promise.resolve()).then(function(){return request('POST',key,payload);})
      .then(function(){delete saveErrors[queueKey];if(withNote&&followup){var save=followup.querySelector('[data-save-note]');save.textContent='已保存';}updateProgress();})
      .catch(function(){saveErrors[queueKey]=true;alert('保存失败，请重新选择该题后再完成复核');});
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
      if (result.ready && result.calibration && result.calibration.candidate_version !== CANDIDATE_VERSION) {
        var candidates = generateCandidates(data, result.events || []);
        return request('POST', key, { action:'initialize', chart_key:key, chart_signature:signature(data), candidate_version:CANDIDATE_VERSION, candidates:candidates }).then(function(upgraded) {
          if ((upgraded.events||[]).some(function(event){return !event.answer})) renderEvents(key,upgraded.events||[],originalToggle);
          else { try { localStorage.setItem(choiceKey(key), 'done'); } catch(e) {} originalToggle(); }
        });
      }
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

  var reportSessions = Object.create(null), reportDismiss = null, reportSkip = null;
  function reportScope() {
    var data = chartData(), key = chartKey(data);
    var user = root.Auth && root.Auth.getUser ? root.Auth.getUser() : null;
    // Authenticated accounts without a resolved identity must not share guest state.
    if (!key || (token() && !(user && user.id))) return '';
    return (user && user.id ? String(user.id) : 'guest') + ':' + key;
  }
  function lifeStorageKey(scope) { return 'zhishi_report_life_v1:' + scope; }
  function readLifeContext(scope) {
    try { return JSON.parse(localStorage.getItem(lifeStorageKey(scope)) || '{}') || {}; } catch(e) { return {}; }
  }
  function attachReportSkip() {
    if (!reportSkip) return;
    var body = document.getElementById('calibrationBody');
    var skip = document.createElement('button');
    skip.type='button';skip.id='calibrationReportSkip';skip.className='calibration-secondary';
    skip.textContent='暂时跳过，查看报告';skip.onclick=reportSkip;body.appendChild(skip);
  }
  function calibrationUnavailable(message, done) {
    openHtml('<div class="calibration-error" role="alert">'+escapeHtml(message)+'</div><button type="button" class="calibration-primary" id="calibrationContinue">'+escapeHtml(done && done.finishLabel || '继续')+'</button>');
    document.getElementById('calibrationContinue').onclick=function(){close();if(done)done();};
  }
  // Called only after the existing payment entitlement check. Duplicate unlock callbacks share one gate.
  function beforeReport(onReady, force) {
    var scope=reportScope();
    if(!scope) return true; // Missing chart/account context must never trap a paid user.
    var session=reportSessions[scope];
    if(!session && !force){try{if(sessionStorage.getItem('zhishi_report_ready_v1:'+scope)==='1')session=reportSessions[scope]={done:true,pending:false,context:readLifeContext(scope)};}catch(e){}}
    if(session && session.done && !force) return true;
    if(session && session.pending) return false;
    session={pending:true,done:false,context:readLifeContext(scope)};
    reportSessions[scope]=session;
    var finish=function(){
      if(scope!==reportScope() || reportSessions[scope]!==session)return;
      session.pending=false;session.done=true;reportDismiss=null;reportSkip=null;
      try{sessionStorage.setItem('zhishi_report_ready_v1:'+scope,'1');}catch(e){}
      close();if(onReady)onReady();
    };
    reportDismiss=function(){session.pending=false;reportDismiss=null;reportSkip=null;};
    reportSkip=finish;
    var birth=chartData().birthInfo||{},birthYear=Number(birth.year||String(birth.standardTime||'').slice(0,4));
    if(!birthYear)birthYear=Number(new URLSearchParams(location.search).get('year'));
    var life=root.DeepReport && root.DeepReport.resolveLifeContext ? root.DeepReport.resolveLifeContext(session.context,birthYear,new Date().getFullYear()) : {};
    var choices=[['unknown','暂不填写，按年龄范围展开'],['student','目前在读'],['exam','正在备考或进修'],['working','已结束学业，目前工作中'],['transition','已结束学业，求职或调整中'],['home','以居家事务或照料安排为主'],['retired','已经退休']];
    openHtml('<header class="calibration-head"><span>报告已解锁 · 第一步</span><h2 id="calibrationTitle">先核对经历，再看报告</h2><p>先确认当前状态，再回答几道往事问题。报告会据此选择适合你现阶段的内容。</p>'+(life.age==null?'':'<p>当前年龄约 '+life.age+' 岁，实际状态以你的选择为准。</p>')+'</header><div class="calibration-list"><label for="reportLifeStatus">你现在处于哪种状态？</label><select id="reportLifeStatus" class="report-life-select">'+choices.map(function(item){return '<option value="'+item[0]+'" '+((session.context.status||'unknown')===item[0]?'selected':'')+'>'+item[1]+'</option>';}).join('')+'</select>'+'<p>学业已结束时，后续不再展开升学考试预测。过去的升学经历仍可用于复核。</p><p>当前状态仅保存在此设备的当前账号与命盘下；可随时修改。</p></div><div class="calibration-actions"><button type="button" class="calibration-primary" id="reportLifeNext">下一步：核对往事</button><button type="button" class="calibration-secondary" id="reportLifeSkip">暂时跳过，查看报告</button></div>');
    var capture=function(){
      session.context={status:document.getElementById('reportLifeStatus').value};
      try{localStorage.setItem(lifeStorageKey(scope),JSON.stringify(session.context));}catch(e){}
    };
    document.getElementById('reportLifeSkip').onclick=function(){capture();finish();};
    document.getElementById('reportLifeNext').onclick=function(){
      capture();this.disabled=true;
      root.ZhishiCalibration.open({finishLabel:'完成复核，生成报告',onComplete:finish,
        isActive:function(){return reportSessions[scope]===session && session.pending && scope===reportScope();},
        onError:function(message){calibrationUnavailable(message,finish);}});
    };
    return false;
  }

  root.ZhishiCalibration = root.ZhishiCalibration || {};
  root.ZhishiCalibration.beforeReport = beforeReport;
  root.ZhishiCalibration.reportPending = function(){var scope=reportScope();return !!(scope && reportSessions[scope] && !reportSessions[scope].done);};
  root.ZhishiCalibration.reportContext = function(){var scope=reportScope();return scope && reportSessions[scope] ? reportSessions[scope].context : readLifeContext(scope);};
  root.ZhishiCalibration.beforeAI = inspectFirstClick;
  root.ZhishiCalibration.summary = function(data) {
    var key=chartKey(data||chartData()), events=key?readLocalEvents(key):[];
    var profile=root.ZhishiCalibrationModel ? root.ZhishiCalibrationModel.buildCalibrationProfile(events) : {patterns:[],tentativePatterns:[],deniedPatterns:[],events:[]};
    events=profile.events;
    var weights={}, denied={};
    var lines=events.filter(function(event){return event.answer==='yes'||event.answer==='no'}).map(function(event){
      var picked=(event.options||[]).filter(function(option){return option.key===event.selected_option})[0];
      var detail=picked&&(picked.followup_options||[]).filter(function(item){return item.key===event.selected_detail})[0];
      var domain=picked?picked.domain:event.domain;
      if(event.answer==='yes'&&picked){var profileKey=domain+':'+picked.manifestation;weights[profileKey]=weights[profileKey]||{score:0,count:0,domain:domain,label:picked.label,detail:detail&&detail.label};weights[profileKey].score+=event.match_level==='partial'?1:2;weights[profileKey].count+=1}
      if(event.answer==='no'){(event.options||[]).forEach(function(option){var mechanism=option.mechanism_key||(option.domain+':general'),deniedKey=option.domain+':'+mechanism;if(!denied[deniedKey])denied[deniedKey]={domain:option.domain,label:option.label,mechanism:mechanism,years:[]};if(denied[deniedKey].years.indexOf(event.event_year)<0)denied[deniedKey].years.push(event.event_year)})}
      var state=event.answer==='yes'?(event.match_level==='partial'?'用户确认部分符合':'用户确认明显发生'):'用户确认没有发生';
      var rejected=event.answer==='no'?(event.options||[]):[];
      var statement=picked?(picked.label+(detail?'，具体是'+detail.label:'')):(rejected.length?'本题全部候选均不符合：'+rejected.map(function(option){return option.label}).join('、'):event.prompt);
      var mechanism=picked&&picked.mechanism_key?'；对应机制='+picked.mechanism_key:(rejected.length?'；已否认机制='+rejected.map(function(option){return option.mechanism_key||(option.domain+':general')}).join(','):'');
      return (event.actual_year||event.event_year)+'年【'+(domainNames[domain]||'经历')+'】'+state+'：'+statement+mechanism+(event.note?'；用户补充：'+event.note:'');
    });
    var patterns=profile.patterns,tentative=profile.tentativePatterns,deniedPatterns=profile.deniedPatterns.map(function(p){return {domain:p.domain,label:p.label,mechanism:p.mechanismKey,years:p.years};});
    if(deniedPatterns.length)lines.unshift('【已排除的应事方式】'+deniedPatterns.map(function(item){return (domainNames[item.domain]||'经历')+'的“'+item.label+'”〔'+item.mechanism+'〕在'+item.years.join('、')+'年被用户明确否认'}).join('；')+'。只降低这些具体机制，不要把整个领域一并排除。');
    if(tentative.length)lines.unshift('【单次校对线索】'+tentative.map(function(item){return (domainNames[item.domain]||'经历')+'曾落在“'+item.label+(item.detail?'－'+item.detail:'')+'”'}).join('；')+'。这些仅命中一次，只能作为弱提示，不能概括为用户的稳定规律。');
    if(patterns.length)lines.unshift('【个人应事模型】'+patterns.map(function(item){return (domainNames[item.domain]||'经历')+'更常落在“'+item.label+(item.detail?'－'+item.detail:'')+'”'}).join('；')+'。这些表现得到不同年份的反馈支持，可优先作为解释线索，但不构成未来事件保证；只调整解释方向，不得改写命盘事实。');
    var life=root.ZhishiCalibration.reportContext();
    if(life.status && life.status !== 'unknown')lines.unshift('【当前生活状态】'+({student:'在读',exam:'备考或进修',working:'已结束学业并工作',transition:'已结束学业，求职或调整中',home:'以居家事务或照料安排为主',retired:'已退休'}[life.status]||'未填写')+'；后续按实际状态选择场景，不把既往反馈当成未来保证。');
    return lines.join('\n').slice(0,2000);
  };
  function futureReviewCandidates(facts) {
    var out=[],data=chartData();
    if(!data||typeof _bazi==='undefined'||!_bazi)return out;
    var birthYear=Number(data.birthInfo && (data.birthInfo.year || String(data.birthInfo.standardTime||'').slice(0,4)));
    if(!birthYear)birthYear=Number(new URLSearchParams(location.search).get('year'));
    if(!birthYear)return out;
    var parents=BaZiCalculator.analyzeParents(_bazi,data.birthInfo&&data.birthInfo.gender);
    (facts&&facts.fiveYear&&facts.fiveYear.years||[]).forEach(function(row){
      if(!row.daYun||row.daYunStatus!=='active'||!row.pillar)return;
      var age=Number(row.year)-birthYear,ln=Object.assign({year:Number(row.year)},row.pillar);
      // Consume the report's already adjudicated annual facts; do not run a second timing engine after feedback.
      var core=facts.core||{};
      var analysis=row.dynamic&&Object.assign({},row.dynamic,{reportLifeContext:row.lifeContext||{status:'unknown',age:age},reportTriggeredRisks:row.triggeredRisks||[],reportMechanismContext:{chain:core.chain||{},yongJi:core.yongJi||{},pattern:core.pattern||{},congGe:core.congGe}});
      if(!analysis)return;
      var tenGod=BaZiCalculator.getShiShen(_bazi.day.gan,ln.gan);
      var parentContext=parentYearContext(parents,analysis,tenGod,row.daYun,ln,age);
      (analysis.eventAdjudication&&analysis.eventAdjudication.domainRecords||[]).forEach(function(record){
        if(!record.hasIndependentAnnualTrigger)return;
        var professional=root.ZhishiCalibrationModel&&root.ZhishiCalibrationModel.professionalCandidates
          ? root.ZhishiCalibrationModel.professionalCandidates(record.domain,analysis) : [];
        var options=professional.length?professional:[competingOption(record.domain,analysis,age,tenGod,record.domain==='family'?parentContext:null)];
        options.forEach(function(option){out.push(Object.assign({},option,{year:Number(row.year),hasIndependentAnnualTrigger:true}));});
      });
    });
    // The same school mechanism can be supported by both task and study records.
    // Prefer its study landing rather than repeating it as a second prediction.
    return out.filter(function(c){return c.domain!=='career'||!out.some(function(other){return other.year===c.year&&other.domain==='study'&&other.mechanism_key===c.mechanism_key&&other.manifestation===c.manifestation;});});
  }
  root.ZhishiCalibration.getReportReview = function(facts) {
    var data=chartData(),key=chartKey(data);
    if(!key||!root.ZhishiCalibrationModel)return Promise.resolve(null);
    var fetchEvents=token()?request('GET',key).then(function(r){return r.events||[];}):Promise.resolve(readLocalEvents(key));
    return fetchEvents.then(function(events){return root.ZhishiCalibrationModel.buildReportReview(events,futureReviewCandidates(facts));});
  };
  root.ZhishiCalibration.open = function(options) {
    options=options||{};
    var done=typeof options.onComplete==='function'?options.onComplete:function(){};
    done.finishLabel=options.finishLabel||'完成校对';
    done.isActive=options.isActive||function(){return true;};
    var data=chartData(),key=chartKey(data);
    if(!data||!key){if(options.onError)options.onError('当前命盘信息尚未就绪，请稍后重试');return;}
    if(!token()){
      var local=prepareLocalEvents(key,data);
      if(local.length)renderEvents(key,local,done);else start(key,done);
      return;
    }
    request('GET',key).then(function(result){
      if(!done.isActive())return;
      if(result.ready&&result.calibration&&result.calibration.candidate_version!==CANDIDATE_VERSION){
        var candidates=generateCandidates(data, result.events || []);
        return request('POST',key,{action:'initialize',chart_key:key,chart_signature:signature(data),candidate_version:CANDIDATE_VERSION,candidates:candidates})
          .then(function(upgraded){if(done.isActive())renderEvents(key,upgraded.events||[],done);});
      }
      if(result.ready)renderEvents(key,result.events||[],done);else start(key,done);
    }).catch(function(error){
      if(!done.isActive())return;
      if(options.onError)options.onError(error.message||'复核暂时不可用');
      else openHtml('<div class="calibration-error">'+escapeHtml(error.message||'复核暂时不可用')+'</div>');
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resumeArchiveCalibration); else resumeArchiveCalibration();
})(window);
