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
    var date=[text('sYear-'+pid),text('sMonth-'+pid),text('sDay-'+pid)].filter(function(v){return v&&!/^选择/.test(v)}).join('');
    return [name,gender?(gender.value==='male'?'男':'女'):'',date].filter(Boolean).join(' · ');
  }
  function refreshHepan(){
    var out=document.querySelector('[data-hepan-summary]');if(out)out.textContent=personBrief('p1')+' × '+personBrief('p2');
    refreshSettings('p1');refreshSettings('p2');
  }
  document.addEventListener('DOMContentLoaded',function(){
    var paipan=!!document.getElementById('birthForm');
    var root=document.getElementById('birthForm')||document.querySelector('.hepan-wrap');if(!root)return;
    if(window.matchMedia&&window.matchMedia('(max-width:720px)').matches){
      setTimeout(function(){
        var dock=document.querySelector('.mobile-submit-dock');
        if(dock&&dock.parentNode!==document.body)document.body.insertBefore(dock,document.querySelector('.mobile-app-nav'));
      },0);
    }
    var refresh=paipan?refreshPaipan:refreshHepan;
    root.addEventListener('change',refresh);root.addEventListener('input',refresh);
    setTimeout(refresh,80);window.ZhishiInputFlow={refresh:refresh};
  });
})();
