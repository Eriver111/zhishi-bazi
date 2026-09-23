(function(){
  'use strict';
  var content=document.getElementById('archiveContent');
  var count=document.getElementById('archiveCount');
  var search=document.getElementById('archiveSearch');
  var filter='all';
  var charts=[];
  var indexed=null,shown=20,observer=null,loadingId=0,deleting=false,loginHook=false,restored=false;
  var mobile=window.matchMedia('(max-width:700px)');
  var touchReady=!!(window.ZhishiTouchSheet&&window.HTMLDialogElement);
  if(touchReady)document.body.classList.add('archive-touch-ready');
  function saveView(){if(window.ZhishiPageState)ZhishiPageState.set('archive-list',{query:search.value,filter:filter,shown:shown,scrollY:window.scrollY});}
  function resetList(){shown=20;render();saveView();}
  function identity(){return window.Auth&&Auth.getUser?String((Auth.getUser()||{}).id||'guest'):'';}
  var TG_WX={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  var DZ_WX={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};

  function isHepan(chart){return !!(chart&&chart.type==='hepan')}
  function paramsOf(chart){return new URLSearchParams(chart&&chart.params||'')}
  function genderOf(chart){return paramsOf(chart).get('gender')||(/坤造/.test(chart.label||'')?'female':'male')}
  function safeNumber(p,key,fallback){var n=Number(p.get(key));return Number.isFinite(n)?n:fallback}
  function pillarText(chart){
    try{
      var p=paramsOf(chart),bazi;
      if(p.get('mode')==='pillars'){
        return [p.get('yg')+p.get('yz'),p.get('mg')+p.get('mz'),p.get('dg')+p.get('dz'),p.get('hg')+p.get('hz')];
      }
      var hour=safeNumber(p,'hour',NaN);if(hour>=12)hour=hour===23?0:Math.floor((hour+1)/2)%12;
      var clock=safeNumber(p,'clock',0);var normalized=BaZiCalculator.normalizeBirthInput({
        year:safeNumber(p,'year',NaN),month:safeNumber(p,'month',NaN),day:safeNumber(p,'day',NaN),hour:hour,
        clock:clock,minute:safeNumber(p,'minute',0),gender:genderOf(chart),prov:p.get('prov')||'',city:p.get('city')||'',dist:p.get('dist')||'',
        clockAlreadyNormalized:!Number.isInteger(clock)||p.get('report_clock_normalized')==='1',
        trueSolarTime:!(!Number.isInteger(clock)||p.get('report_clock_normalized')==='1')&&p.get('solar')!=='0',ziHourNextDay:p.get('zishi')==='1'
      });
      bazi=BaZiCalculator.calculate(normalized.year,normalized.month,normalized.day,normalized.hour,genderOf(chart),normalized.clock,normalized.dayPillarOffset);
      return ['year','month','day','hour'].map(function(k){return bazi[k].gan+bazi[k].zhi});
    }catch(e){return chart.dayGan&&chart.dayZhi?['—','—',chart.dayGan+chart.dayZhi,'—']:['—','—','—','—']}
  }
  function dateText(chart){
    if(isHepan(chart))return (chart.relationType||'合盘')+' · '+(chart.saved_at?'保存于 '+String(chart.saved_at).slice(0,10):'已保存');
    var p=paramsOf(chart);if(p.get('year'))return p.get('year')+'年'+p.get('month')+'月'+p.get('day')+'日';
    return chart.saved_at?'四柱直排 · 保存于 '+String(chart.saved_at).slice(0,10):'四柱直排';
  }
  function displayName(chart,index){
    if(isHepan(chart))return String(chart.p1Name||'甲方').slice(0,20)+' × '+String(chart.p2Name||'乙方').slice(0,20);
    var p=paramsOf(chart),explicit=String(p.get('name')||chart.name||'').trim();
    if(explicit)return explicit.slice(0,20);
    var label=String(chart.label||'').replace(/^\s*(乾造|坤造)\s*[·・]?\s*/,'').trim();
    if(/^\d{4}年/.test(label)||/^[甲乙丙丁戊己庚辛壬癸]/.test(label))return '案例'+(index+1);
    return label||('案例'+(index+1));
  }
  function coloredPillar(text){
    var span=document.createElement('span'),gan=text.charAt(0),zhi=text.charAt(1);
    if(!zhi||text==='——'){span.textContent='—';return span}
    var ganEl=document.createElement('i'),zhiEl=document.createElement('i');
    ganEl.textContent=gan;zhiEl.textContent=zhi;ganEl.className='wx-'+(TG_WX[gan]||'');zhiEl.className='wx-'+(DZ_WX[zhi]||'');
    span.append(ganEl,zhiEl);return span;
  }
  function hepanPillars(chart,key){var value=chart&&chart[key];return Array.isArray(value)&&value.length===4?value:['—','—','—','—']}
  function render(){
    var q=(search.value||'').trim().toLowerCase();
    if(observer){observer.disconnect();observer=null;}
    if(!indexed)indexed=charts.map(function(chart,index){
      var hepan=isHepan(chart),ps=hepan?hepanPillars(chart,'p1Pillars'):pillarText(chart),ps2=hepan?hepanPillars(chart,'p2Pillars'):[];
      return{chart:chart,index:index,type:hepan?'hepan':'personal',pillars:ps,pillars2:ps2,gender:hepan?'':genderOf(chart),search:[displayName(chart,index),chart.label,chart.p1Name,chart.p2Name,dateText(chart),ps.join(''),ps2.join('')].join(' ').toLowerCase()}
    });
    var visible=indexed.filter(function(item){
      var filterMatch=filter==='all'||item.type===filter||item.gender===filter;
      return filterMatch&&(!q||item.search.indexOf(q)>=0)
    });
    count.textContent=charts.length+' 份档案';content.replaceChildren();
    if(!visible.length){var empty=document.createElement('div');empty.className='archive-empty';empty.innerHTML=charts.length?'没有找到匹配的档案':'还没有保存档案<br><a href="/paipan">新建命盘</a>　<a href="/hepan">新建合盘</a>';content.appendChild(empty);return}
    var list=document.createElement('div');list.className='archive-list';content.appendChild(list);
    var rendered=0;
    function appendRow(item){
      var hepan=item.type==='hepan';
      var row=document.createElement('article');row.className='archive-record'+(hepan?' archive-record--hepan':'');row.tabIndex=0;row.setAttribute('role','link');
      var copy=document.createElement('div'),name=document.createElement('div'),sub=document.createElement('div');name.className='archive-record__name';
      name.textContent=displayName(item.chart,item.index)+(hepan?'':' · '+(item.gender==='female'?'坤造':'乾造'));
      if(hepan){var badge=document.createElement('span');badge.className='archive-record__type';badge.textContent='合盘';name.appendChild(badge)}
      sub.className='archive-record__sub';sub.textContent=dateText(item.chart);copy.append(name,sub);
      var ps=document.createElement('div');ps.className='archive-record__pillars';
      if(hepan){
        [['甲方',item.pillars],['乙方',item.pillars2]].forEach(function(group){var pair=document.createElement('div');pair.className='archive-record__pair';pair.dataset.person=group[0];group[1].forEach(function(p){pair.appendChild(coloredPillar(p))});ps.appendChild(pair)})
      }else item.pillars.forEach(function(p){ps.appendChild(coloredPillar(p))});
      var ask=document.createElement('button');ask.type='button';ask.className='archive-record__ai';ask.textContent='继续问 AI';ask.setAttribute('aria-label','继续询问'+displayName(item.chart,item.index)+'的命盘');
      var calibrate=null;if(!hepan){calibrate=document.createElement('button');calibrate.type='button';calibrate.className='archive-record__calibrate';calibrate.textContent='校对命盘';calibrate.setAttribute('aria-label','校对'+displayName(item.chart,item.index)+'的过往经历')}
      var del=document.createElement('button');del.type='button';del.className='archive-record__delete';del.setAttribute('aria-label','删除'+displayName(item.chart,item.index));del.textContent='×';del.addEventListener('click',function(e){e.stopPropagation();deleteChart(item.index)});
      function open(){saveView();location.href=(hepan?'/hepan-result?':'/result?')+item.chart.params}
      function openAi(e){e.stopPropagation();try{sessionStorage.setItem('zhishi_open_archive_ai','1')}catch(ex){}open()}
      function openCalibration(e){e.stopPropagation();try{sessionStorage.setItem('zhishi_open_archive_calibration','1')}catch(ex){}open()}
      var more=document.createElement('button');more.type='button';more.className='archive-record__more';more.textContent='•••';more.setAttribute('aria-label','更多操作：'+displayName(item.chart,item.index));more.setAttribute('aria-haspopup','dialog');
      function actions(e){
        if(e)e.stopPropagation();if(!mobile.matches||!touchReady)return;
        var sheet=ZhishiTouchSheet.open({title:displayName(item.chart,item.index),opener:more});if(!sheet)return;
        var note=document.createElement('p');note.className='touch-sheet__note';note.textContent=dateText(item.chart);sheet.body.append(note);
        function action(label,fn,danger){var b=document.createElement('button');b.type='button';b.className='touch-sheet__action'+(danger?' touch-sheet__action--danger':'');b.textContent=label;b.onclick=function(){b.disabled=true;sheet.close('action').then(function(){if(charts.indexOf(item.chart)>=0)fn();});};sheet.body.append(b);}
        action('查看命盘',open);action('继续问 AI',function(){openAi({stopPropagation:function(){}});});
        if(!hepan)action('校对过往经历',function(){openCalibration({stopPropagation:function(){}});});
        action('删除这份档案',function(){deleteChart(charts.indexOf(item.chart));},true);
      }
      more.addEventListener('click',actions);
      var holdTimer,startPoint,suppressUntil=0;
      function cancelHold(){clearTimeout(holdTimer);holdTimer=null;}
      row.addEventListener('pointerdown',function(e){if(!mobile.matches||!touchReady||e.pointerType!=='touch'||e.target.closest('button'))return;startPoint={x:e.clientX,y:e.clientY};suppressUntil=0;holdTimer=setTimeout(function(){suppressUntil=Date.now()+1000;actions();},500);},{passive:true});
      row.addEventListener('pointermove',function(e){if(startPoint&&Math.hypot(e.clientX-startPoint.x,e.clientY-startPoint.y)>10)cancelHold();},{passive:true});
      ['pointerup','pointercancel','pointerleave'].forEach(function(type){row.addEventListener(type,cancelHold,{passive:true});});
      ask.addEventListener('click',openAi);if(calibrate)calibrate.addEventListener('click',openCalibration);row.addEventListener('click',function(e){if(Date.now()<suppressUntil){suppressUntil=0;e.preventDefault();return;}open();});row.addEventListener('keydown',function(e){if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open()}});row.append(copy,ps);if(calibrate)row.append(calibrate);row.append(ask,del,more);list.appendChild(row);
    }
    var tail=document.createElement('div');tail.className='archive-list-tail';
    var progress=document.createElement('p');progress.setAttribute('role','status');var moreRows=document.createElement('button');moreRows.type='button';moreRows.className='archive-load-more';moreRows.textContent='加载更多档案';tail.append(progress,moreRows);content.append(tail);
    function appendBatch(){var end=Math.min(visible.length,mobile.matches?shown:visible.length);visible.slice(rendered,end).forEach(appendRow);rendered=end;progress.textContent='已显示 '+rendered+' / '+visible.length+' 份';moreRows.hidden=rendered>=visible.length;if(moreRows.hidden&&observer)observer.disconnect();}
    function loadMore(){if(!list.isConnected)return;shown=Math.min(visible.length,shown+20);appendBatch();saveView();}
    moreRows.onclick=loadMore;appendBatch();
    if(mobile.matches&&window.IntersectionObserver&&rendered<visible.length){observer=new IntersectionObserver(function(entries){if(entries.some(function(e){return e.isIntersecting;}))loadMore();},{rootMargin:'160px'});observer.observe(moreRows);}
  }
  function deleteChart(index){var target=charts[index];if(!target||deleting||!confirm('确定删除这份'+(isHepan(target)?'合盘':'命盘')+'档案？'))return;var next=charts.slice(),owner=identity(),ticket=loadingId;next.splice(index,1);deleting=true;Auth.syncData('saved_charts',JSON.stringify(next)).then(function(){if(ticket!==loadingId||owner!==identity())return;charts=next;indexed=null;render();saveView();}).catch(function(){if(ticket===loadingId)alert('删除失败，请稍后重试');}).finally(function(){deleting=false;});}
  function load(){
    if(!window.Auth)return setTimeout(load,200);if(!loginHook){Auth.onLogin(load);loginHook=true;}var ticket=++loadingId;Auth.ready(function(){
      if(ticket!==loadingId)return;
      if(!Auth.isLoggedIn()){content.innerHTML='<div class="archive-login">请先登录保存命盘档案<br><small>登录后，排过的命盘会保存在这里并可跨设备查看。</small><br><button type="button" id="archiveLogin">立即登录</button></div>';document.getElementById('archiveLogin').onclick=function(){Auth.showModal('login')};return}
      var owner=identity();Auth.getData('saved_charts').then(function(raw){if(ticket!==loadingId||owner!==identity()||!Auth.isLoggedIn())return;try{var parsed=JSON.parse(raw||'[]');charts=Array.isArray(parsed)?parsed.filter(function(c){return c&&typeof c==='object';}):[];}catch(e){charts=[]}indexed=null;
        var state=!restored&&window.ZhishiPageState&&ZhishiPageState.get('archive-list');restored=true;
        if(state){search.value=String(state.query||'');filter=['all','personal','hepan','male','female'].indexOf(state.filter)>=0?state.filter:'all';shown=Math.max(20,Math.min(charts.length,Number(state.shown)||20));document.querySelectorAll('[data-filter]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});}
        render();if(state&&Number(state.scrollY)>0)requestAnimationFrame(function(){if(ticket===loadingId)window.scrollTo(0,Number(state.scrollY));});
      }).catch(function(){if(ticket!==loadingId)return;content.replaceChildren();var error=document.createElement('div');error.className='archive-empty';error.textContent='档案加载失败，请重试';var retry=document.createElement('button');retry.type='button';retry.className='archive-load-more';retry.textContent='重新加载';retry.onclick=load;error.append(retry);content.append(error);});
    })
  }
  search.addEventListener('input',resetList);document.querySelectorAll('[data-filter]').forEach(function(btn){btn.addEventListener('click',function(){filter=btn.dataset.filter;document.querySelectorAll('[data-filter]').forEach(function(b){b.setAttribute('aria-pressed',String(b===btn))});resetList()})});
  window.addEventListener('pagehide',saveView);
  window.addEventListener('zhishi:identitychange',function(){loadingId++;charts=[];indexed=null;filter='all';shown=20;search.value='';restored=false;if(observer)observer.disconnect();if(touchReady)ZhishiTouchSheet.close('identity');count.textContent='0 份档案';content.replaceChildren();load();});
  if(mobile.addEventListener)mobile.addEventListener('change',function(){if(window.Auth&&Auth.isLoggedIn())render();});
  load();
})();
