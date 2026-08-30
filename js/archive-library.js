(function(){
  'use strict';
  var content=document.getElementById('archiveContent');
  var count=document.getElementById('archiveCount');
  var search=document.getElementById('archiveSearch');
  var filter='all';
  var charts=[];
  var TG_WX={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  var DZ_WX={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};

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
        trueSolarTime:!(!Number.isInteger(clock)||p.get('report_clock_normalized')==='1')&&p.get('solar')!=='0',ziHourNextDay:p.get('zishi')==='1'
      });
      bazi=BaZiCalculator.calculate(normalized.year,normalized.month,normalized.day,normalized.hour,genderOf(chart),normalized.clock,normalized.dayPillarOffset);
      return ['year','month','day','hour'].map(function(k){return bazi[k].gan+bazi[k].zhi});
    }catch(e){return chart.dayGan&&chart.dayZhi?['—','—',chart.dayGan+chart.dayZhi,'—']:['—','—','—','—']}
  }
  function dateText(chart){
    var p=paramsOf(chart);if(p.get('year'))return p.get('year')+'年'+p.get('month')+'月'+p.get('day')+'日';
    return chart.saved_at?'四柱直排 · 保存于 '+String(chart.saved_at).slice(0,10):'四柱直排';
  }
  function displayName(chart,index){
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
  function render(){
    var q=(search.value||'').trim().toLowerCase();
    var visible=charts.map(function(chart,index){var ps=pillarText(chart);return{chart:chart,index:index,pillars:ps,gender:genderOf(chart),search:[chart.label,dateText(chart),ps.join('')].join(' ').toLowerCase()}})
      .filter(function(item){return(filter==='all'||item.gender===filter)&&(!q||item.search.indexOf(q)>=0)});
    count.textContent=charts.length+' 份档案';content.replaceChildren();
    if(!visible.length){var empty=document.createElement('div');empty.className='archive-empty';empty.innerHTML=charts.length?'没有找到匹配的命盘':'还没有保存命盘<br><a href="/paipan">建立第一份档案</a>';content.appendChild(empty);return}
    var list=document.createElement('div');list.className='archive-list';
    visible.forEach(function(item){
      var row=document.createElement('article');row.className='archive-record';row.tabIndex=0;row.setAttribute('role','link');
      var copy=document.createElement('div'),name=document.createElement('div'),sub=document.createElement('div');name.className='archive-record__name';name.textContent=displayName(item.chart,item.index)+' · '+(item.gender==='female'?'坤造':'乾造');sub.className='archive-record__sub';sub.textContent=dateText(item.chart);copy.append(name,sub);
      var ps=document.createElement('div');ps.className='archive-record__pillars';item.pillars.forEach(function(p){ps.appendChild(coloredPillar(p))});
      var ask=document.createElement('button');ask.type='button';ask.className='archive-record__ai';ask.textContent='继续问 AI';ask.setAttribute('aria-label','继续询问'+displayName(item.chart,item.index)+'的命盘');
      var calibrate=document.createElement('button');calibrate.type='button';calibrate.className='archive-record__calibrate';calibrate.textContent='校对命盘';calibrate.setAttribute('aria-label','校对'+displayName(item.chart,item.index)+'的过往经历');
      var del=document.createElement('button');del.type='button';del.className='archive-record__delete';del.setAttribute('aria-label','删除'+displayName(item.chart,item.index));del.textContent='×';del.addEventListener('click',function(e){e.stopPropagation();deleteChart(item.index)});
      function open(){location.href='/result?'+item.chart.params}
      function openAi(e){e.stopPropagation();try{sessionStorage.setItem('zhishi_open_archive_ai','1')}catch(ex){}open()}
      function openCalibration(e){e.stopPropagation();try{sessionStorage.setItem('zhishi_open_archive_calibration','1')}catch(ex){}open()}
      ask.addEventListener('click',openAi);calibrate.addEventListener('click',openCalibration);row.addEventListener('click',open);row.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});row.append(copy,ps,calibrate,ask,del);list.appendChild(row);
    });content.appendChild(list);
  }
  function deleteChart(index){if(!confirm('确定删除这份命盘档案？'))return;var next=charts.slice();next.splice(index,1);Auth.syncData('saved_charts',JSON.stringify(next)).then(function(){charts=next;render()}).catch(function(){alert('删除失败，请稍后重试')})}
  function load(){
    if(!window.Auth)return setTimeout(load,200);Auth.onLogin(load);Auth.ready(function(){
      if(!Auth.isLoggedIn()){content.innerHTML='<div class="archive-login">请先登录保存命盘档案<br><small>登录后，排过的命盘会保存在这里并可跨设备查看。</small><br><button type="button" id="archiveLogin">立即登录</button></div>';document.getElementById('archiveLogin').onclick=function(){Auth.showModal('login')};return}
      Auth.getData('saved_charts').then(function(raw){try{charts=JSON.parse(raw||'[]')}catch(e){charts=[]}render()}).catch(function(){content.innerHTML='<div class="archive-empty">档案加载失败，请刷新后重试</div>'});
    })
  }
  search.addEventListener('input',render);document.querySelectorAll('[data-filter]').forEach(function(btn){btn.addEventListener('click',function(){filter=btn.dataset.filter;document.querySelectorAll('[data-filter]').forEach(function(b){b.setAttribute('aria-pressed',String(b===btn))});render()})});load();
})();
