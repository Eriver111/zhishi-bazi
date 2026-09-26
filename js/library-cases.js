(function () {
  'use strict';
  var collection = null;
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
      detail.append(el('p',[item.bookTitle,item.group,item.chapterTitle].filter(Boolean).join(' · '),'eyebrow'),heading,tags(item.tags),pillars(item.pillars));
      detail.append(el('p','四柱按原书记录整理，未载完整出生日期及起运年龄。','case-caption'));
      if(item.luck.length)detail.append(section('原录所列行运',item.luck.join(' → ')+'\n按来源次序列出，不代表完整连续的大运表。','case-luck case-section'));
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
    shown.forEach(function(c){var card=localLink(undefined,queryLink(c.id),'case-card');card.append(el('p',c.bookTitle+' · '+c.chapterTitle,'case-caption'),el('h2',c.title),pillars(c.pillars),el('p',c.summary),tags(c.tags),el('span','对照阅读 →','book-action'));grid.append(card);});
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
      var response=await fetch('/books/cases.json?v=1',{signal:controller.signal});if(!response.ok)throw Error('load');
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
