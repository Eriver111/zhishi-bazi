(function(){
  'use strict';

  var form=document.getElementById('birthForm');
  if(!form||!window.matchMedia||!window.matchMedia('(max-width:720px)').matches)return;

  var card=form.closest('.card');
  var mainTabs=card&&card.querySelector(':scope > .mode-tabs');
  var basic=form.querySelector('.birth-basic-panel');
  var radioGroup=basic&&basic.querySelector('.radio-group');
  var archiveRow=form.querySelector('.archive-name-row');
  var locationFields=form.querySelector('.birth-location-fields');
  var advanced=form.querySelector('.birth-advanced');
  var opener=null,mounted=null;

  form.classList.add('mobile-paipan-summary');
  if(card)card.classList.add('mobile-paipan-card');
  if(archiveRow){
    var archiveLabel=archiveRow.querySelector('label');
    if(archiveLabel)archiveLabel.textContent='姓名';
  }
  if(radioGroup)radioGroup.querySelectorAll('.radio span').forEach(function(span){
    span.textContent=span.closest('.radio').querySelector('input').value==='male'?'男':'女';
  });

  var choiceLine=document.createElement('div');
  choiceLine.className='mobile-paipan-choice-line';
  if(radioGroup)choiceLine.appendChild(radioGroup);
  if(mainTabs){
    mainTabs.classList.add('mobile-paipan-mode-tabs');
    choiceLine.appendChild(mainTabs);
  }

  if(archiveRow&&archiveRow.nextSibling)form.insertBefore(choiceLine,archiveRow.nextSibling);
  else form.insertBefore(choiceLine,form.firstChild);

  var summary=document.createElement('div');
  summary.className='mobile-birth-summary-card';
  summary.innerHTML=''
    +'<button type="button" class="mobile-birth-summary-row" data-birth-sheet-open="time"><span>出生时间</span><b data-mobile-time-summary>请选择出生时间</b><i>›</i></button>'
    +'<button type="button" class="mobile-birth-summary-row" data-birth-sheet-open="location"><span>出生地点</span><b data-mobile-location-summary>未选择</b><i>›</i></button>'
    +'<button type="button" class="mobile-birth-summary-row" data-birth-sheet-open="settings"><span>排盘设置</span><b data-mobile-settings-summary>真太阳时 · 子时换日</b><i>›</i></button>';
  choiceLine.insertAdjacentElement('afterend',summary);

  var overlay=document.createElement('div');
  overlay.className='mobile-birth-sheet-overlay';
  overlay.hidden=true;
  var sheet=document.createElement('section');
  sheet.className='mobile-birth-sheet';
  sheet.hidden=true;
  sheet.setAttribute('role','dialog');
  sheet.setAttribute('aria-modal','true');
  sheet.setAttribute('aria-label','出生信息选择');
  sheet.innerHTML=''
    +'<div class="mobile-birth-sheet-head">'
    +'<div class="mobile-birth-sheet-tabs" role="tablist">'
    +'<button type="button" data-sheet-mode="solar">公历</button>'
    +'<button type="button" data-sheet-mode="lunar">农历</button>'
    +'<button type="button" data-sheet-mode="pillars">四柱</button>'
    +'</div>'
    +'<button type="button" class="mobile-birth-sheet-confirm">确定</button>'
    +'</div>'
    +'<div class="mobile-birth-sheet-title"></div>'
    +'<div class="mobile-birth-sheet-slot"></div>';
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  var slot=sheet.querySelector('.mobile-birth-sheet-slot');
  var sheetTabs=sheet.querySelector('.mobile-birth-sheet-tabs');
  var sheetTitle=sheet.querySelector('.mobile-birth-sheet-title');

  function activeMode(){
    var tab=mainTabs&&mainTabs.querySelector('.mode-tab.active[data-mode]');
    return tab?tab.getAttribute('data-mode'):(typeof currentMode!=='undefined'?currentMode:'solar');
  }

  function restoreMounted(){
    if(!mounted)return;
    if(mounted.marker.parentNode)mounted.marker.parentNode.insertBefore(mounted.node,mounted.marker);
    mounted.marker.remove();
    mounted=null;
  }

  function mount(node){
    restoreMounted();
    if(!node)return;
    var marker=document.createComment('mobile-birth-sheet-anchor');
    node.parentNode.insertBefore(marker,node);
    slot.appendChild(node);
    mounted={node:node,marker:marker};
  }

  function syncSheetTabs(){
    var mode=activeMode();
    sheet.querySelectorAll('[data-sheet-mode]').forEach(function(btn){
      var on=btn.getAttribute('data-sheet-mode')===mode;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-selected',on?'true':'false');
    });
  }

  function updatePillarColors(){
    var elements={甲:'wood',乙:'wood',丙:'fire',丁:'fire',戊:'earth',己:'earth',庚:'metal',辛:'metal',壬:'water',癸:'water',寅:'wood',卯:'wood',巳:'fire',午:'fire',辰:'earth',戌:'earth',丑:'earth',未:'earth',申:'metal',酉:'metal',亥:'water',子:'water'};
    document.querySelectorAll('#pillarsPanel select').forEach(function(select){
      select.setAttribute('data-five-element',elements[select.value]||'');
    });
  }

  function open(kind,trigger){
    opener=trigger||document.activeElement;
    sheet.dataset.kind=kind;
    sheetTabs.hidden=kind!=='time';
    sheetTitle.textContent=kind==='location'?'选择出生地点':(kind==='settings'?'排盘设置':'');
    if(kind==='time'){
      var panelIds={solar:'solarPanel',lunar:'lunarPanel',pillars:'pillarsPanel'};
      mount(document.getElementById(panelIds[activeMode()]));
      syncSheetTabs();
      updatePillarColors();
    }else if(kind==='location'){
      mount(locationFields);
    }else{
      if(advanced)advanced.open=true;
      mount(advanced);
    }
    overlay.hidden=false;
    sheet.hidden=false;
    requestAnimationFrame(function(){overlay.classList.add('is-open');sheet.classList.add('is-open');});
    document.body.classList.add('mobile-birth-sheet-open');
    sheet.querySelector('.mobile-birth-sheet-confirm').focus();
  }

  function close(){
    overlay.classList.remove('is-open');
    sheet.classList.remove('is-open');
    document.body.classList.remove('mobile-birth-sheet-open');
    setTimeout(function(){restoreMounted();overlay.hidden=true;sheet.hidden=true;refresh();if(opener&&opener.focus)opener.focus();},220);
  }

  function valueText(id){
    var el=document.getElementById(id);
    if(!el||!el.value)return'';
    var option=el.selectedOptions&&el.selectedOptions[0];
    return option?option.textContent.trim():String(el.value);
  }

  function refresh(){
    var mode=activeMode(),time='请选择出生时间';
    if(mode==='solar'){
      var solar=[valueText('sYear'),valueText('sMonth'),valueText('sDay')].filter(Boolean).join('');
      var solarHour=valueText('sHour');
      if(solar)time=solar+(solarHour?' · '+solarHour:'');
    }else if(mode==='lunar'){
      var lunar=[valueText('lYear'),valueText('lMonth'),valueText('lDay')].filter(Boolean).join('');
      var lunarHour=valueText('lHour');
      if(lunar)time='农历 '+lunar+(lunarHour?' · '+lunarHour:'');
    }else{
      var ids=[['pYearGan','pYearZhi'],['pMonthGan','pMonthZhi'],['pDayGan','pDayZhi'],['pHourGan','pHourZhi']];
      var pillars=ids.map(function(pair){return(document.getElementById(pair[0]).value||'')+(document.getElementById(pair[1]).value||'');}).filter(Boolean);
      if(pillars.length)time=pillars.join(' · ');
    }
    var timeOut=summary.querySelector('[data-mobile-time-summary]');if(timeOut)timeOut.textContent=time;
    var place=[valueText('province'),valueText('city'),valueText('district')].filter(function(v){return v&&!/^选择/.test(v)}).join(' ');
    var placeOut=summary.querySelector('[data-mobile-location-summary]');if(placeOut)placeOut.textContent=place||'未选择';
    var zi=document.getElementById('zishiHuanri'),solarEnabled=document.getElementById('solarEnabled');
    var settingOut=summary.querySelector('[data-mobile-settings-summary]');
    if(settingOut)settingOut.textContent=(solarEnabled&&solarEnabled.checked?'真太阳时':'北京时间')+' · '+(zi&&zi.checked?'子时换日':'子时不换日');
    var locationRow=summary.querySelector('[data-birth-sheet-open="location"]');
    var settingsRow=summary.querySelector('[data-birth-sheet-open="settings"]');
    if(locationRow)locationRow.hidden=mode==='pillars';
    if(settingsRow)settingsRow.hidden=mode==='pillars';
    updatePillarColors();
  }

  summary.querySelectorAll('[data-birth-sheet-open]').forEach(function(button){button.addEventListener('click',function(){open(button.getAttribute('data-birth-sheet-open'),button);});});
  if(mainTabs)mainTabs.querySelectorAll('[data-mode]').forEach(function(button){button.addEventListener('click',function(){setTimeout(function(){open('time',button);},0);});});
  sheet.querySelectorAll('[data-sheet-mode]').forEach(function(button){button.addEventListener('click',function(){
    var mode=button.getAttribute('data-sheet-mode');
    restoreMounted();
    if(typeof switchMode==='function')switchMode(mode);
    var panelIds={solar:'solarPanel',lunar:'lunarPanel',pillars:'pillarsPanel'};
    mount(document.getElementById(panelIds[mode]));
    syncSheetTabs();refresh();
  });});
  sheet.querySelector('.mobile-birth-sheet-confirm').addEventListener('click',close);
  overlay.addEventListener('click',close);
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!sheet.hidden)close();});
  document.addEventListener('change',refresh);
  document.addEventListener('input',refresh);

  window.ZhishiBirthSheet={open:open,close:close,refresh:refresh};
  setTimeout(refresh,80);
})();
