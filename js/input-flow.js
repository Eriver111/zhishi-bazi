(function(){
  'use strict';
  function text(id){var el=document.getElementById(id);return el&&el.selectedOptions&&el.selectedOptions[0]?el.selectedOptions[0].textContent.trim():''}
  function checked(id){var el=document.getElementById(id);return !!(el&&el.checked)}
  function refreshSettings(scope){
    var suffix=scope?'-'+scope:'';
    var z=checked('zishiHuanri'+suffix),s=checked('solarEnabled'+suffix);
    var details=scope?document.querySelector('#'+scope+'Section .birth-advanced'):document.querySelector('#birthForm .birth-advanced');
    var out=details&&details.querySelector('[data-settings-summary]');
    if(out) out.textContent=(s?'真太阳时':'北京时间')+'、'+(z?'子时换日':'子时不换日');
  }
  function refreshPaipan(){
    var out=document.querySelector('[data-birth-summary]');if(!out)return;
    var gender=document.querySelector('input[name="gender"]:checked');
    var date=[text('sYear'),text('sMonth'),text('sDay')].filter(Boolean).join('');
    var place=[text('city'),text('district')].filter(function(v){return v&&!/^选择/.test(v)}).join('');
    var bits=[gender?(gender.value==='male'?'男':'女'):'',date,text('sHour'),place].filter(function(v){return v&&!/^选择/.test(v)});
    out.textContent=bits.length?bits.join(' · '):'填写出生信息后即可起盘';
    refreshSettings('');
  }
  function personBrief(pid){
    var gender=document.querySelector('input[name="gender-'+pid+'"]:checked');
    var name=(document.getElementById('name-'+pid)||{}).value||(pid==='p1'?'甲方':'乙方');
    var lunar=pid==='p1'?(typeof modeP1!=='undefined'&&modeP1==='lunar'):(typeof modeP2!=='undefined'&&modeP2==='lunar');
    var prefix=lunar?'l':'s';
    var date=[text(prefix+'Year-'+pid),text(prefix+'Month-'+pid),text(prefix+'Day-'+pid)].filter(function(v){return v&&!/^选择/.test(v)}).join('');
    return [name,gender?(gender.value==='male'?'男':'女'):'',date].filter(Boolean).join(' · ');
  }
  function personComplete(pid){
    var lunar=pid==='p1'?(typeof modeP1!=='undefined'&&modeP1==='lunar'):(typeof modeP2!=='undefined'&&modeP2==='lunar');
    var prefix=lunar?'l':'s';
    var ids=[prefix+'Year-',prefix+'Month-',prefix+'Day-',prefix+'Hour-','province-','city-','district-'];
    var filled=ids.every(function(prefix){var el=document.getElementById(prefix+pid);return !!(el&&el.value)});
    return filled&&!!document.querySelector('input[name="gender-'+pid+'"]:checked');
  }
  function refreshPersonProgress(pid){
    var section=document.getElementById(pid+'Section');
    var progress=section&&section.querySelector('[data-person-progress="'+pid+'"]');
    var complete=personComplete(pid);
    if(section)section.classList.toggle('is-complete',complete);
    if(progress)progress.textContent=complete?'已完整 · '+personBrief(pid):personBrief(pid);
  }
  function setPersonOpen(pid,open,scroll){
    var section=document.getElementById(pid+'Section');if(!section)return;
    section.classList.toggle('is-collapsed',!open);
    var head=section.querySelector('[data-person-toggle]');if(head){head.setAttribute('aria-expanded',open?'true':'false');var state=head.querySelector('b');if(state)state.textContent=open?'收起':'展开'}
    if(open&&scroll)setTimeout(function(){section.scrollIntoView({behavior:'smooth',block:'start'})},340);
  }
  function refreshHepan(){
    var out=document.querySelector('[data-hepan-summary]');if(out)out.textContent=personBrief('p1')+' × '+personBrief('p2');
    refreshPersonProgress('p1');refreshPersonProgress('p2');
    refreshSettings('p1');refreshSettings('p2');
  }
  document.addEventListener('DOMContentLoaded',function(){
    var paipan=!!document.getElementById('birthForm');
    var root=document.getElementById('birthForm')||document.querySelector('.hepan-wrap');if(!root)return;
    if(!paipan&&window.matchMedia&&window.matchMedia('(max-width:720px)').matches){
      setTimeout(function(){
        var dock=document.querySelector('.mobile-submit-dock');
        if(dock&&dock.parentNode!==document.body)document.body.insertBefore(dock,document.querySelector('.mobile-app-nav'));
      },0);
    }
    var refresh=paipan?refreshPaipan:refreshHepan;
    root.addEventListener('change',refresh);root.addEventListener('input',refresh);
    if(!paipan&&window.matchMedia&&window.matchMedia('(max-width:720px)').matches){
      setPersonOpen('p1',true,false);setPersonOpen('p2',false,false);
      root.querySelectorAll('[data-person-toggle]').forEach(function(head){head.addEventListener('click',function(){var pid=head.getAttribute('data-person-toggle');var section=document.getElementById(pid+'Section');setPersonOpen(pid,section.classList.contains('is-collapsed'),false)})});
      root.querySelectorAll('[data-person-next]').forEach(function(btn){btn.addEventListener('click',function(){var next=btn.getAttribute('data-person-next');var prev=next==='p1'?'p2':'p1';setPersonOpen(prev,false,false);setPersonOpen(next,true,true)})});
    }
    setTimeout(refresh,80);window.ZhishiInputFlow={refresh:refresh};
  });
})();
