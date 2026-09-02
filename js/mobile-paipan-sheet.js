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
  var opener=null,mounted=null,wheelTimers={},autoMatching=false;
  var pillarPairs=[['pYearGan','pYearZhi','年柱'],['pMonthGan','pMonthZhi','月柱'],['pDayGan','pDayZhi','日柱'],['pHourGan','pHourZhi','时柱']];
  var stems=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var branches=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var elements={甲:'wood',乙:'wood',丙:'fire',丁:'fire',戊:'earth',己:'earth',庚:'metal',辛:'metal',壬:'water',癸:'water',寅:'wood',卯:'wood',巳:'fire',午:'fire',辰:'earth',戌:'earth',丑:'earth',未:'earth',申:'metal',酉:'metal',亥:'water',子:'water'};

  form.classList.add('mobile-paipan-summary');
  if(card)card.classList.add('mobile-paipan-card');
  if(archiveRow){
    var archiveLabel=archiveRow.querySelector('label');
    if(archiveLabel)archiveLabel.textContent='姓名';
  }
  if(radioGroup)radioGroup.querySelectorAll('.radio span').forEach(function(span){
    span.textContent=span.closest('.radio').querySelector('input').value==='male'?'男':'女';
  });
  if(radioGroup&&!radioGroup.querySelector('input:checked')){
    var defaultMale=radioGroup.querySelector('input[value="male"]');
    if(defaultMale)defaultMale.checked=true;
  }

  var choiceLine=document.createElement('div');
  choiceLine.className='mobile-paipan-choice-line';
  if(radioGroup)choiceLine.appendChild(radioGroup);
  if(mainTabs){mainTabs.classList.add('mobile-paipan-mode-tabs');choiceLine.appendChild(mainTabs);}
  if(archiveRow&&archiveRow.nextSibling)form.insertBefore(choiceLine,archiveRow.nextSibling);
  else form.insertBefore(choiceLine,form.firstChild);

  var summary=document.createElement('div');
  summary.className='mobile-birth-summary-card';
  summary.innerHTML=''
    +'<button type="button" class="mobile-birth-summary-row" data-birth-sheet-open="time"><span>出生时间<small>（必填）</small></span><b data-mobile-time-summary>请选择出生时间</b><i>›</i></button>'
    +'<button type="button" class="mobile-birth-summary-row" data-birth-sheet-open="location"><span>出生地点</span><b data-mobile-location-summary>未知地 北京时间 --</b><i>›</i></button>'
    +'<button type="button" class="mobile-birth-summary-row" data-birth-sheet-open="settings"><span>排盘设置</span><b data-mobile-settings-summary>真太阳时 · 子时换日</b><i>›</i></button>';
  choiceLine.insertAdjacentElement('afterend',summary);

  var overlay=document.createElement('div');
  overlay.className='mobile-birth-sheet-overlay';overlay.hidden=true;
  var sheet=document.createElement('section');
  sheet.className='mobile-birth-sheet';sheet.hidden=true;
  sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','出生信息选择');
  sheet.innerHTML=''
    +'<div class="mobile-birth-sheet-head">'
    +'<div class="mobile-birth-sheet-tabs" role="tablist">'
    +'<button type="button" data-sheet-mode="solar">公历</button>'
    +'<button type="button" data-sheet-mode="lunar">农历</button>'
    +'<button type="button" data-sheet-mode="pillars">四柱</button>'
    +'</div>'
    +'<button type="button" class="mobile-birth-sheet-today">今</button>'
    +'<button type="button" class="mobile-birth-sheet-confirm">确定</button>'
    +'</div><div class="mobile-birth-sheet-title"></div><div class="mobile-birth-sheet-slot"></div>';
  document.body.appendChild(overlay);document.body.appendChild(sheet);

  var slot=sheet.querySelector('.mobile-birth-sheet-slot');
  var sheetTabs=sheet.querySelector('.mobile-birth-sheet-tabs');
  var sheetTitle=sheet.querySelector('.mobile-birth-sheet-title');
  var todayButton=sheet.querySelector('.mobile-birth-sheet-today');

  function activeMode(){
    var tab=mainTabs&&mainTabs.querySelector('.mode-tab.active[data-mode]');
    return tab?tab.getAttribute('data-mode'):(typeof currentMode!=='undefined'?currentMode:'solar');
  }
  function restoreMounted(){
    if(!mounted)return;
    if(mounted.marker.parentNode)mounted.marker.parentNode.insertBefore(mounted.node,mounted.marker);
    mounted.marker.remove();mounted=null;
  }
  function mount(node){
    restoreMounted();slot.innerHTML='';if(!node)return;
    var marker=document.createComment('mobile-birth-sheet-anchor');node.parentNode.insertBefore(marker,node);slot.appendChild(node);mounted={node:node,marker:marker};
  }
  function syncSheetTabs(){
    var mode=activeMode();
    sheet.querySelectorAll('[data-sheet-mode]').forEach(function(btn){
      var on=btn.getAttribute('data-sheet-mode')===mode;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',on?'true':'false');
    });
    todayButton.hidden=mode==='pillars';
  }
  function dispatchValue(target,value){
    if(!target)return;target.value=String(value);target.dispatchEvent(new Event('change',{bubbles:true}));target.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function selectOptions(target){
    if(!target)return[];
    return Array.prototype.map.call(target.options||[],function(option,index){return{value:option.value,label:option.textContent.trim(),sourceIndex:index};}).filter(function(option){return option.value!=='';});
  }
  function refreshDependentDay(target){
    if(!target||!/^(s|l)(Year|Month)$/.test(target.id))return;
    var dayId=target.id.charAt(0)==='s'?'sDay':'lDay';
    defaultValue(dayId,1);
    var oldColumn=slot.querySelector('.mobile-wheel-column[data-target-id="'+dayId+'"]');
    if(oldColumn)oldColumn.replaceWith(buildWheel(document.getElementById(dayId),'日'));
  }
  function highlightWheel(rail,optionIndex,scroll){
    var selected=null;
    rail.querySelectorAll('.mobile-wheel-option').forEach(function(button){
      var on=Number(button.dataset.optionIndex)===Number(optionIndex);button.classList.toggle('selected',on);button.setAttribute('aria-selected',on?'true':'false');if(on)selected=button;
    });
    if(scroll&&selected){
      rail._programmatic=true;rail.scrollTop=selected.offsetTop-48;
      requestAnimationFrame(function(){rail._programmatic=false;});
    }
  }
  function buildWheel(target,label,customOptions){
    var column=document.createElement('div');column.className='mobile-wheel-column';column.dataset.targetId=target&&target.id||'';
    var title=document.createElement('div');title.className='mobile-wheel-label';title.textContent=label;
    var rail=document.createElement('div');rail.className='mobile-wheel-rail';rail.setAttribute('role','listbox');rail.setAttribute('aria-label',label);
    var options=customOptions||selectOptions(target);
    options.forEach(function(option,index){
      var button=document.createElement('button');button.type='button';button.className='mobile-wheel-option';button.dataset.value=String(option.value);button.dataset.optionIndex=String(index);button.textContent=option.label;button.setAttribute('role','option');
      button.addEventListener('click',function(){
        if(target&&option.sourceIndex!==undefined)target.selectedIndex=option.sourceIndex;else if(target)target.value=String(option.value);
        if(target){target.dispatchEvent(new Event('change',{bubbles:true}));target.dispatchEvent(new Event('input',{bubbles:true}));}
        highlightWheel(rail,index,true);refresh();refreshDependentDay(target);
      });rail.appendChild(button);
    });
    ['pointerdown','touchstart','wheel'].forEach(function(type){rail.addEventListener(type,function(){rail._userScrolling=true;},{passive:true});});
    rail.addEventListener('scroll',function(){
      if(rail._programmatic||!rail._userScrolling)return;clearTimeout(wheelTimers[target&&target.id||label]);wheelTimers[target&&target.id||label]=setTimeout(function(){
        var index=Math.max(0,Math.min(options.length-1,Math.round(rail.scrollTop/48)));var option=options[index];
        rail._userScrolling=false;
        if(option){
          if(target&&option.sourceIndex!==undefined)target.selectedIndex=option.sourceIndex;else if(target)target.value=String(option.value);
          if(target){target.dispatchEvent(new Event('change',{bubbles:true}));target.dispatchEvent(new Event('input',{bubbles:true}));}
          highlightWheel(rail,index,true);refresh();refreshDependentDay(target);
        }
      },90);
    },{passive:true});
    column.appendChild(title);column.appendChild(rail);
    requestAnimationFrame(function(){
      var selectedIndex=options.findIndex(function(option){return option.sourceIndex!==undefined?target&&option.sourceIndex===target.selectedIndex:String(option.value)===String(target&&target.value||'');});
      highlightWheel(rail,selectedIndex>=0?selectedIndex:0,true);
    });
    return column;
  }
  function minuteOptions(){var result=[];for(var i=0;i<60;i++)result.push({value:String(i),label:String(i).padStart(2,'0')});return result;}
  function defaultValue(id,preferred){
    var target=document.getElementById(id);if(!target||target.value)return;
    var options=id==='lMinute'?minuteOptions():selectOptions(target);
    var match=options.find(function(option){return String(option.value)===String(preferred);})||options[0];
    if(match)dispatchValue(target,match.value);
  }
  function ensureCalendarDefaults(mode){
    if(mode==='solar'){
      defaultValue('sYear',1990);defaultValue('sMonth',1);defaultValue('sDay',1);defaultValue('sHour',0);defaultValue('sMinute',0);
    }else{
      defaultValue('lYear',1990);defaultValue('lMonth',1);defaultValue('lDay',1);defaultValue('lHour',0);defaultValue('lMinute',0);
    }
  }
  function buildCalendarPicker(mode){
    restoreMounted();slot.innerHTML='';
    ensureCalendarDefaults(mode);
    var wrap=document.createElement('div');wrap.className='mobile-calendar-picker';
    var ids=mode==='solar'?['sYear','sMonth','sDay','sHour','sMinute']:['lYear','lMonth','lDay','lHour','lMinute'];
    var labels=['年','月','日','时','分'];var wheels=document.createElement('div');wheels.className='mobile-wheel-grid';
    ids.forEach(function(id,index){wheels.appendChild(buildWheel(document.getElementById(id),labels[index],id==='lMinute'?minuteOptions():null));});
    wrap.appendChild(wheels);
    if(mode==='solar'){
      var toggle=document.createElement('label');toggle.className='mobile-sheet-inline-toggle';toggle.innerHTML='<span>ⓘ 夏令时</span><input type="checkbox" disabled><i></i>';wrap.appendChild(toggle);
    }
    slot.appendChild(wrap);
  }
  function updatePillarColors(){document.querySelectorAll('#pillarsPanel select').forEach(function(select){select.setAttribute('data-five-element',elements[select.value]||'');});}
  function allPillarFieldsComplete(){return pillarPairs.every(function(pair){return document.getElementById(pair[0]).value&&document.getElementById(pair[1]).value;});}
  function requestPillarCandidates(){
    if(autoMatching||!allPillarFieldsComplete())return;
    autoMatching=true;
    setTimeout(function(){
      if(typeof form.requestSubmit==='function')form.requestSubmit();
      else form.querySelector('.submit').click();
      setTimeout(function(){autoMatching=false;},250);
    },80);
  }
  function buildPillarPicker(activeId){
    restoreMounted();slot.innerHTML='';
    var candidates=document.getElementById('pillarCandidates');var hasCandidates=!!(candidates&&!candidates.hidden);
    var wrap=document.createElement('div');wrap.className='mobile-pillar-picker';wrap.classList.toggle('has-candidates',hasCandidates);var preview=document.createElement('div');preview.className='mobile-pillar-preview';
    pillarPairs.forEach(function(pair){
      var column=document.createElement('div');column.className='mobile-pillar-preview-column';var label=document.createElement('strong');label.textContent=pair[2];column.appendChild(label);
      pair.slice(0,2).forEach(function(id){
        var source=document.getElementById(id);var button=document.createElement('button');button.type='button';button.className='mobile-pillar-orb';button.dataset.target=id;button.dataset.fiveElement=elements[source.value]||'';button.textContent=source.value||'—';button.classList.toggle('active',id===activeId);button.addEventListener('click',function(){buildPillarPicker(id);});column.appendChild(button);
      });preview.appendChild(column);
    });wrap.appendChild(preview);
    if(!hasCandidates){
      var tools=document.createElement('div');tools.className='mobile-pillar-tools';tools.innerHTML='<span>查找范围：</span><button type="button" class="mobile-pillar-range">1801~2099年&nbsp; ⇄</button><button type="button" class="mobile-pillar-clear">⌫ 清除</button>';
      tools.querySelector('.mobile-pillar-clear').addEventListener('click',function(){pillarPairs.forEach(function(pair){dispatchValue(document.getElementById(pair[0]),'');dispatchValue(document.getElementById(pair[1]),'');});buildPillarPicker('pYearGan');refresh();});wrap.appendChild(tools);
      var targetId=activeId||'pYearGan';var isStem=/Gan$/.test(targetId);var choices=document.createElement('div');choices.className='mobile-pillar-choice-grid '+(isStem?'stems':'branches');
      (isStem?stems:branches).forEach(function(value){
        var button=document.createElement('button');button.type='button';button.textContent=value;button.dataset.fiveElement=elements[value]||'';button.classList.toggle('selected',document.getElementById(targetId).value===value);
        button.addEventListener('click',function(){
          dispatchValue(document.getElementById(targetId),value);var flat=[];pillarPairs.forEach(function(pair){flat=flat.concat(pair.slice(0,2));});var next=flat[Math.min(flat.length-1,flat.indexOf(targetId)+1)];buildPillarPicker(next);refresh();requestPillarCandidates();
        });choices.appendChild(button);
      });wrap.appendChild(choices);
    }
    slot.appendChild(wrap);
    if(hasCandidates){
      var marker=document.createComment('mobile-birth-sheet-anchor');candidates.parentNode.insertBefore(marker,candidates);wrap.appendChild(candidates);mounted={node:candidates,marker:marker};
    }
    updatePillarColors();
  }
  function renderTimePicker(){syncSheetTabs();if(activeMode()==='pillars')buildPillarPicker('pYearGan');else buildCalendarPicker(activeMode());}
  function open(kind,trigger){
    opener=trigger||document.activeElement;sheet.dataset.kind=kind;sheetTabs.hidden=kind!=='time';todayButton.hidden=kind!=='time'||activeMode()==='pillars';sheetTitle.textContent=kind==='location'?'选择出生地点':(kind==='settings'?'排盘设置':'');
    if(kind==='time')renderTimePicker();else if(kind==='location')mount(locationFields);else{if(advanced)advanced.open=true;mount(advanced);}
    overlay.hidden=false;sheet.hidden=false;requestAnimationFrame(function(){overlay.classList.add('is-open');sheet.classList.add('is-open');});document.body.classList.add('mobile-birth-sheet-open');
  }
  function close(){
    overlay.classList.remove('is-open');sheet.classList.remove('is-open');document.body.classList.remove('mobile-birth-sheet-open');
    setTimeout(function(){restoreMounted();slot.innerHTML='';overlay.hidden=true;sheet.hidden=true;refresh();if(opener&&opener.focus)opener.focus();},220);
  }
  function valueText(id){var el=document.getElementById(id);if(!el||!el.value)return'';var option=el.selectedOptions&&el.selectedOptions[0];return option?option.textContent.trim():String(el.value);}
  function refresh(){
    var mode=activeMode(),time='请选择出生时间';
    if(mode==='solar'){
      var solar=[valueText('sYear'),valueText('sMonth'),valueText('sDay')].filter(Boolean).join('');var solarHour=valueText('sHour'),solarMinute=valueText('sMinute');if(solar)time=solar+(solarHour?' · '+solarHour:'')+(solarMinute?' '+solarMinute+'分':'');
    }else if(mode==='lunar'){
      var lunar=[valueText('lYear'),valueText('lMonth'),valueText('lDay')].filter(Boolean).join('');var lunarHour=valueText('lHour');if(lunar)time='农历 '+lunar+(lunarHour?' · '+lunarHour:'');
    }else{
      var pillars=pillarPairs.map(function(pair){return(document.getElementById(pair[0]).value||'')+(document.getElementById(pair[1]).value||'');}).filter(Boolean);if(pillars.length)time=pillars.join(' · ');
    }
    var timeOut=summary.querySelector('[data-mobile-time-summary]');if(timeOut)timeOut.textContent=time;
    var place=[valueText('province'),valueText('city'),valueText('district')].filter(function(v){return v&&!/^选择/.test(v)}).join(' ');var placeOut=summary.querySelector('[data-mobile-location-summary]');if(placeOut)placeOut.textContent=place||'未知地 北京时间 --';
    var zi=document.getElementById('zishiHuanri'),solarEnabled=document.getElementById('solarEnabled');var settingOut=summary.querySelector('[data-mobile-settings-summary]');if(settingOut)settingOut.textContent=(solarEnabled&&solarEnabled.checked?'真太阳时':'北京时间')+' · '+(zi&&zi.checked?'子时换日':'子时不换日');
    var locationRow=summary.querySelector('[data-birth-sheet-open="location"]'),settingsRow=summary.querySelector('[data-birth-sheet-open="settings"]');if(locationRow)locationRow.hidden=mode==='pillars';if(settingsRow)settingsRow.hidden=mode==='pillars';updatePillarColors();
  }
  summary.querySelectorAll('[data-birth-sheet-open]').forEach(function(button){button.addEventListener('click',function(){open(button.getAttribute('data-birth-sheet-open'),button);});});
  if(mainTabs)mainTabs.querySelectorAll('[data-mode]').forEach(function(button){button.addEventListener('click',function(){setTimeout(function(){open('time',button);},0);});});
  sheet.querySelectorAll('[data-sheet-mode]').forEach(function(button){button.addEventListener('click',function(){var mode=button.getAttribute('data-sheet-mode');if(typeof switchMode==='function')switchMode(mode);renderTimePicker();refresh();});});
  todayButton.addEventListener('click',function(){
    if(activeMode()!=='solar')return;var now=new Date();dispatchValue(document.getElementById('sYear'),now.getFullYear());dispatchValue(document.getElementById('sMonth'),now.getMonth()+1);dispatchValue(document.getElementById('sDay'),now.getDate());dispatchValue(document.getElementById('sHour'),now.getHours());dispatchValue(document.getElementById('sMinute'),now.getMinutes());buildCalendarPicker('solar');refresh();
  });
  sheet.querySelector('.mobile-birth-sheet-confirm').addEventListener('click',close);overlay.addEventListener('click',close);document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!sheet.hidden)close();});document.addEventListener('change',refresh);document.addEventListener('input',refresh);
  slot.addEventListener('click',function(event){if(event.target.closest('.pillar-action-secondary'))setTimeout(function(){buildPillarPicker('pYearGan');},0);});
  window.ZhishiBirthSheet={open:open,close:close,refresh:refresh};setTimeout(refresh,80);
})();
