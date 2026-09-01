(function(){
  'use strict';
  var activePid='p1';
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function close(){var el=document.getElementById('hepanArchivePicker');if(el)el.remove()}
  function usable(chart){
    if(!chart||chart.type==='hepan'||!chart.params)return false;
    try{var p=new URLSearchParams(chart.params);return !!(p.get('year')&&p.get('month')&&p.get('day')&&p.get('hour')!==null&&p.get('gender')&&p.get('prov')&&p.get('city')&&p.get('dist'))}catch(e){return false}
  }
  function label(chart,p){return String(chart.name||p.get('name')||chart.label||'未命名档案').trim().slice(0,20)}
  function render(charts){
    close();var mask=document.createElement('div');mask.id='hepanArchivePicker';mask.className='archive-picker-mask';
    var list=(charts||[]).filter(usable);
    var html='<section class="archive-picker-sheet" role="dialog" aria-modal="true" aria-label="从命盘档案选择"><div class="archive-picker-head"><strong>选择'+(activePid==='p1'?'甲方':'乙方')+'档案</strong><button class="archive-picker-close" type="button" aria-label="关闭">×</button></div><div class="archive-picker-list">';
    if(!list.length) html+='<div class="archive-picker-empty">还没有可用的个人命盘档案。<br>先完成一次八字排盘，登录后会自动保存。</div>';
    list.forEach(function(chart,i){var p=new URLSearchParams(chart.params);html+='<button type="button" class="archive-picker-item" data-index="'+i+'"><span><strong>'+esc(label(chart,p))+'</strong><small>'+esc(p.get('year')+'年'+p.get('month')+'月'+p.get('day')+'日 · '+(p.get('gender')==='male'?'男':'女')+' · '+p.get('city'))+'</small></span><span>选用 ›</span></button>'});
    html+='</div></section>';mask.innerHTML=html;document.body.appendChild(mask);
    mask.querySelector('.archive-picker-close').onclick=close;mask.onclick=function(e){if(e.target===mask)close()};
    mask.querySelectorAll('.archive-picker-item').forEach(function(btn){btn.onclick=function(){fill(list[parseInt(btn.dataset.index,10)]);close()}});
  }
  function fill(chart){
    var p=new URLSearchParams(chart.params);
    var data={name:label(chart,p),sYear:p.get('year'),sMonth:p.get('month'),sDay:p.get('day'),sHour:p.get('hour'),sMinute:p.get('minute')||'',gender:p.get('gender'),prov:p.get('prov'),city:p.get('city'),dist:p.get('dist'),calMode:'solar',zishi:p.get('zishi')!=='0',solar:p.get('solar')!=='0'};
    if(activePid==='p1')modeP1='solar';else modeP2='solar';
    applyPersonData(activePid,data);switchModeForPersonUI(activePid,'solar');
    if(window.ZhishiInputFlow)window.ZhishiInputFlow.refresh();
    if(typeof showToast==='function')showToast('已从档案填入'+data.name);
  }
  function open(pid){
    activePid=pid;if(typeof Auth==='undefined')return;
    Auth.ready(function(){if(!Auth.isLoggedIn()){Auth.showModal('login');return}render([]);Auth.getData('saved_charts').then(function(raw){var charts=[];try{charts=JSON.parse(raw||'[]')}catch(e){}render(charts)}).catch(function(){render([])})});
  }
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('[data-archive-pick]').forEach(function(btn){btn.addEventListener('click',function(){open(btn.getAttribute('data-archive-pick'))})})});
})();
