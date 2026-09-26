(function () {
  'use strict';
  var collection = null;
  var luckSelections = Object.create(null);
  var elementColors = {'金':'#B86A00','木':'#16823B','水':'#1769B0','火':'#D12D24','土':'#70511D'};
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, text, className) { var node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
  function link(text, href, className) { var node=el('a',text,className); node.href=href; return node; }
  function localLink(text, href, className) { var node=link(text,href,className); node.dataset.caseLink='true'; return node; }
  function queryLink(id) { var params=new URLSearchParams(location.search); if(id)params.set('case',id);else params.delete('case'); return '/library-cases'+(params.size?'?'+params.toString():''); }
  function pillars(value) {
    var table=el('dl',undefined,'case-pillars');
    ['年柱','月柱','日柱','时柱'].forEach(function(label,i){var cell=el('div');cell.append(el('dt',label),el('dd',value[i]));table.append(cell);});
    return table;
  }
  function tags(value) { var list=el('div',undefined,'case-tags');value.forEach(function(t){list.append(el('span',t));});return list; }
  function colored(text,element,className){var node=el('span',text,className);node.style.color=elementColors[element];return node;}
  function chartTable(item,index){
    var columns=item.chart.pillars.map(function(p,i){return {label:['年柱','月柱','日柱','时柱'][i],data:p,day:i===2};});
    if(item.chart.luck.length)columns.unshift({label:'大运',data:item.chart.luck[index],luck:true});
    var table=el('table',undefined,'case-chart-table');table.setAttribute('aria-label','案例基础盘面');
    var head=el('thead'),header=el('tr'),first=el('th','日期');first.scope='col';header.append(first);
    columns.forEach(function(c){var th=el('th',c.label,c.day?'case-chart-day':c.luck?'case-chart-luck':'');th.scope='col';header.append(th);});head.append(header);table.append(head);
    var body=el('tbody');
    [['主星','god'],['天干','gan'],['地支','zhi'],['藏干','hidden'],['星运','star'],['自坐','seat']].forEach(function(row){
      var tr=el('tr',undefined,'case-chart-row-'+row[1]),label=el('th',row[0]);label.scope='row';tr.append(label);
      columns.forEach(function(c){
        var td=el('td',undefined,c.day?'case-chart-day':c.luck?'case-chart-luck':'');
        if(row[1]==='hidden')c.data.hidden.forEach(function(h){var pair=el('span',undefined,'case-chart-hidden');pair.append(colored(h.gan,h.element),el('span',h.god));td.append(pair);});
        else if(row[1]==='gan'||row[1]==='zhi')td.append(colored(c.data[row[1]],c.data[row[1]+'Element'],'case-chart-char'));
        else td.textContent=c.data[row[1]];
        tr.append(td);
      });body.append(tr);
    });table.append(body);return table;
  }
  function chartView(item){
    var box=el('section',undefined,'case-chart'),heading=el('h2','基础盘面');box.append(heading);
    var selected=luckSelections[item.id]||0,holder=el('div');holder.append(chartTable(item,selected));box.append(holder);
    var state=el('p',item.luck.length?'当前对照原录行运：'+item.luck[selected]:'原书此例未列行运，仅展示四柱。','case-chart-status');state.setAttribute('role','status');box.append(state);
    if(item.luck.length){
      var title=el('h3','原录行运'),strip=el('div',undefined,'case-chart-luck-strip');strip.setAttribute('role','group');strip.setAttribute('aria-label','选择原录行运');box.append(title,el('p','点选行运，与四柱一起对照。年份、起运年龄未载，不补排流年。','case-caption'));
      item.chart.luck.forEach(function(p,i){var button=el('button');button.type='button';button.setAttribute('aria-label','对照行运 '+item.luck[i]);button.setAttribute('aria-pressed',String(i===selected));button.append(el('span',p.god,'case-luck-god'),colored(p.gan,p.ganElement,'case-luck-char'),colored(p.zhi,p.zhiElement,'case-luck-char'));
        button.onclick=function(){luckSelections[item.id]=i;holder.replaceChildren(chartTable(item,i));Array.from(strip.children).forEach(function(b,j){b.setAttribute('aria-pressed',String(i===j));});state.textContent='当前对照原录行运：'+item.luck[i];};strip.append(button);
      });box.append(strip);
    }
    var help=el('details',undefined,'case-chart-help');help.append(el('summary','盘面怎么看？'),el('p','日柱的天干是日主。主星表示各天干与日主的十神关系；藏干把地支内的天干和对应十神放在一起。星运看日主在各地支的十二长生，自坐看每柱自己的天干在本柱地支的十二长生；两者不能直接等同于旺衰或吉凶。'));
    var legend=el('p',undefined,'case-chart-legend');Object.keys(elementColors).forEach(function(wx){legend.append(colored(wx,wx));});box.append(legend,help);return box;
  }
  function section(title,text,className) { var box=el('section',undefined,className||'case-section');box.append(el('h2',title),el('p',text));return box; }
  function render() {
    if(!collection)return;
    var params=new URLSearchParams(location.search),id=params.get('case'),detail=$('caseDetail');
    $('caseShelf').hidden=!!id;detail.hidden=!id;detail.replaceChildren();
    document.title=id?'案例详情 · 知时藏书阁':'古籍案例库 · 知时藏书阁';
    if(id){
      var item=collection.cases.find(function(c){return c.id===id;});
      detail.append(localLink('‹ 返回案例库',queryLink(),'case-back'));
      if(!item){var missing=el('h1','没有找到这个案例');missing.id='caseTitle';detail.append(missing,el('p','链接可能有误，请返回案例库选择。'));return;}
      var heading=el('h1',item.title);heading.id='caseTitle';heading.tabIndex=-1;
      detail.append(el('p',[item.bookTitle,item.group,item.chapterTitle].filter(Boolean).join(' · '),'eyebrow'),heading,tags(item.tags),chartView(item));
      detail.append(el('p','四柱按原书记录整理，未载完整出生日期及起运年龄。','case-caption'));
      detail.append(section('这例在讨论什么',item.summary),section('白话解读',item.translation));
      var original=el('details',undefined,'case-original');original.append(el('summary','展开原书文字'),el('p',item.original));detail.append(original);
      detail.append(section('阅读与校对提示',item.note,'case-note case-section'),el('p',collection.note,'case-collection-note'));
      if(item.related.length){var related=el('section',undefined,'case-related');related.append(el('h2','对照案例'));item.related.forEach(function(c){related.append(localLink(c.title+' →',queryLink(c.id)));});detail.append(related);}
      var sources=el('div',undefined,'case-sources');sources.append(link('回到本书原文 →',item.sourceLink));
      var external=link('查看来源版本 ↗',item.sourceUrl);external.target='_blank';external.rel='noopener noreferrer';sources.append(external);detail.append(sources);
      document.title=item.title+' · 古籍案例库 · 知时';return;
    }
    $('caseSearch').value=params.get('q')||'';$('caseBook').value=params.get('book')||'';$('caseTag').value=params.get('tag')||'';
    var q=$('caseSearch').value.trim().toLowerCase().replace(/\s/g,''),book=params.get('book')||'',tag=params.get('tag')||'';
    var shown=collection.cases.filter(function(c){return(!book||c.book===book)&&(!tag||c.tags.includes(tag))&&(!q||[c.title,c.summary,c.bookTitle,c.translation,c.tags.join(' '),c.pillars.join('')].join(' ').toLowerCase().replace(/\s/g,'').includes(q));});
    $('caseStatus').textContent=shown.length?'找到 '+shown.length+' 则 · 当前收录 '+collection.cases.length+' 则':'没有匹配的案例，可以清除筛选或换个关键词。';
    var grid=$('caseGrid');grid.replaceChildren();
    shown.forEach(function(c){var card=localLink(undefined,queryLink(c.id),'case-card');card.append(el('p',c.bookTitle+' · '+c.chapterTitle,'case-caption'),el('h2',c.title),pillars(c.pillars),el('p',c.summary),tags(c.tags),el('span','查看盘面与原断 →','book-action'));grid.append(card);});
  }
  function filter() { var p=new URLSearchParams();[['q',$('caseSearch').value.trim()],['book',$('caseBook').value],['tag',$('caseTag').value]].forEach(function(pair){if(pair[1])p.set(pair[0],pair[1]);});history.replaceState(null,'','/library-cases'+(p.size?'?'+p.toString():''));render(); }
  $('caseFilters').onsubmit=function(e){e.preventDefault();filter();};
  $('caseSearch').oninput=function(e){if(!e.isComposing)filter();};$('caseSearch').oncompositionend=filter;$('caseBook').onchange=filter;$('caseTag').onchange=filter;
  $('caseReset').onclick=function(){history.replaceState(null,'','/library-cases');render();};
  document.addEventListener('click',function(e){var a=e.target.closest('a[data-case-link]');if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();history.pushState(null,'',a.href);render();window.scrollTo({top:0,behavior:'instant'});var title=$('caseTitle');if(title)title.focus({preventScroll:true});});
  window.addEventListener('popstate',function(){render();});
  async function init(){
    $('caseLoadError').hidden=true;$('caseStatus').textContent='正在整理案例…';
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
    try{
      var response=await fetch('/books/cases.json?v=2',{signal:controller.signal});if(!response.ok)throw Error('load');
      var value=await response.json();if(!Array.isArray(value.cases))throw Error('format');collection=value;
      $('caseCollectionNote').textContent=value.note;
      $('caseBook').replaceChildren(new Option('全部书籍',''));$('caseTag').replaceChildren(new Option('全部主题',''));
      var books=new Map(),topics=new Set();value.cases.forEach(function(c){books.set(c.book,c.bookTitle);c.tags.forEach(function(t){topics.add(t);});});
      books.forEach(function(title,id){$('caseBook').append(new Option(title,id));});topics.forEach(function(t){$('caseTag').append(new Option(t,t));});
      render();
    }catch(_){$('caseStatus').textContent='';$('caseLoadError').hidden=false;}finally{clearTimeout(timer);}
  }
  $('caseRetry').onclick=init;init();
})();
