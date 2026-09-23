(function(){
 'use strict';
 function init(){
  if(!window.ZhishiTouchSheet||typeof REGION_DATA==='undefined'||!window.HTMLDialogElement)return;
  var media=window.matchMedia('(max-width:700px)'),groups=[];
  var paths=[];Object.keys(REGION_DATA).forEach(function(p){Object.keys(REGION_DATA[p]).forEach(function(c){REGION_DATA[p][c].forEach(function(d){paths.push([p,c,d]);});});});
  function valid(v){return !!(REGION_DATA[v[0]]&&REGION_DATA[v[0]][v[1]]&&REGION_DATA[v[0]][v[1]].indexOf(v[2])>=0);}
  function values(group){return group.fields.map(function(field){return field.value;});}
  function refresh(){groups.forEach(function(group){var v=values(group);group.summary.textContent=valid(v)?v.join(' · '):'搜索省、市或区县';group.button.hidden=!!(group.root&&group.root.querySelector('[data-chart-open="location"]'));});}
  function write(field,value){
   if(!Array.from(field.options).some(function(o){return o.value===value;}))throw new Error('地区选项暂未就绪');
   field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));field.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function open(group,opener){
   if(!media.matches)return;
   var original=values(group),draft=original.slice(),stage=!draft[0]?0:!draft[1]?1:2,searchLimit=40;
   var sheet=ZhishiTouchSheet.open({title:group.title,opener:opener});if(!sheet)return;
   var note=document.createElement('p');note.className='touch-sheet__note';note.textContent='选择出生时所在地点，用于真太阳时校正。确认前不会改动表单。';
   var input=document.createElement('input');input.className='touch-place-search';input.type='search';input.placeholder='搜索省、市或区县';input.setAttribute('aria-label','搜索出生地点');input.autocomplete='off';
   var tabs=document.createElement('nav');tabs.className='touch-place-tabs';tabs.setAttribute('aria-label','地区选择步骤');
   var results=document.createElement('div');results.className='touch-place-results';
   var selected=document.createElement('p');selected.className='touch-place-selection';selected.setAttribute('aria-live','polite');
   var confirm=document.createElement('button');confirm.type='button';confirm.className='touch-sheet__primary';confirm.textContent='确认出生地点';
   sheet.body.append(note,input,tabs,results);sheet.footer.append(selected,confirm);
   function render(){
    tabs.replaceChildren();['省份','城市','区县'].forEach(function(label,i){var b=document.createElement('button');b.type='button';b.textContent=draft[i]||label;b.disabled=i>0&&!draft[i-1];if(i===stage)b.setAttribute('aria-current','step');b.onclick=function(){stage=i;input.value='';render();};tabs.append(b);});
    selected.textContent=draft.filter(Boolean).join(' · ')||'请选择出生地点';confirm.disabled=!valid(draft);results.replaceChildren();
    var q=input.value.trim(),rows;
    if(q){rows=paths.filter(function(p){return p.join('').indexOf(q)>=0;});}
    else{var names=stage===0?Object.keys(REGION_DATA):stage===1?Object.keys(REGION_DATA[draft[0]]||{}):(REGION_DATA[draft[0]]||{})[draft[1]]||[];rows=names.map(function(name){return {name:name};});}
    rows.slice(0,q?searchLimit:rows.length).forEach(function(item){
     var b=document.createElement('button');b.type='button';b.className='touch-place-option';
     b.textContent=q?item[2]:item.name;b.setAttribute('aria-pressed',String(q?draft.join('|')===item.join('|'):draft[stage]===item.name));
     if(q){var small=document.createElement('small');small.textContent=item[0]+' · '+item[1];b.append(small);}
     b.onclick=function(){
      if(q){draft=item.slice();stage=2;input.value='';}
      else{draft[stage]=item.name;for(var i=stage+1;i<3;i++)draft[i]='';stage=Math.min(2,stage+1);}
      render();
     };results.append(b);
    });
    if(!rows.length){var empty=document.createElement('p');empty.className='touch-sheet__note';empty.textContent='没有找到匹配地点，可缩短关键词或按省市逐级选择。';results.append(empty);}
    if(q&&rows.length>searchLimit){var more=document.createElement('button');more.type='button';more.className='touch-sheet__action';more.textContent='显示更多匹配地点';more.onclick=function(){searchLimit+=40;render();};results.append(more);}
   }
   input.addEventListener('input',function(){searchLimit=40;render();});
   confirm.onclick=function(){
    if(!valid(draft))return;
    if(values(group).join('|')!==original.join('|')){note.textContent='原表单的地点已更新，请取消后重新打开，避免覆盖新信息。';confirm.disabled=true;return;}
    try{group.fields.forEach(function(field,i){write(field,draft[i]);});}
    catch(_){try{group.fields.forEach(function(field,i){write(field,original[i]);});}catch(ignore){}note.textContent='地区选项暂未就绪，未确认新地点，请取消后重试。';confirm.disabled=true;return;}
    refresh();sheet.close('confirm');
   };
   render();
  }
  [
   {ids:['province','city','district'],title:'出生地点',personal:true},
   {ids:['province-p1','city-p1','district-p1'],title:'甲方出生地点'},
   {ids:['province-p2','city-p2','district-p2'],title:'乙方出生地点'},
   {ids:['zwProv','zwCity','zwDist'],title:'出生地点'}
  ].forEach(function(config){
   var fields=config.ids.map(function(id){return document.getElementById(id);});if(fields.some(function(f){return !f;}))return;
   var rows=Array.from(new Set(fields.map(function(f){return f.closest('.row');}))).filter(Boolean);if(!rows.length)return;
   var button=document.createElement('button');button.type='button';button.className='touch-place-open';button.setAttribute('aria-haspopup','dialog');
   var copy=document.createElement('span'),title=document.createElement('strong'),summary=document.createElement('small'),arrow=document.createElement('i');title.textContent=config.title;arrow.textContent='›';arrow.setAttribute('aria-hidden','true');copy.append(title,summary);button.append(copy,arrow);
   rows[0].before(button);rows.forEach(function(row){row.classList.add('touch-place-native');});
   var group={fields:fields,title:config.title,summary:summary,button:button,root:fields[0].closest('form,#zwBirthCard')};groups.push(group);button.onclick=function(){open(group,button);};
   fields.forEach(function(field){field.addEventListener('invalid',function(e){if(media.matches){e.preventDefault();open(group,config.personal?document.querySelector('[data-birth-sheet-open="location"]')||button:button);}});});
   // The personal form already has a location summary; open one sheet, not nested dialogs.
   if(config.personal)document.addEventListener('click',function(e){var trigger=e.target.closest('[data-birth-sheet-open="location"]');if(trigger&&media.matches){e.preventDefault();e.stopImmediatePropagation();open(group,trigger);}},true);
   else document.addEventListener('click',function(e){var trigger=e.target.closest('[data-chart-open="location"]');if(trigger&&group.root.contains(trigger)&&media.matches){e.preventDefault();e.stopImmediatePropagation();open(group,trigger);}},true);
  });
  document.addEventListener('change',refresh);document.addEventListener('input',refresh);
  document.addEventListener('click',function(){setTimeout(refresh,0);});window.addEventListener('pageshow',refresh);document.addEventListener('DOMContentLoaded',refresh);setTimeout(refresh,0);refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
