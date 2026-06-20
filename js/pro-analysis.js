/**
 * v3.0 专业解读增强 + 神煞清理
 * 美化四柱生克 / 雷达图 / 日主能量 / 格局
 */
(function(){
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

  function init(){
    // 等数据就绪
    if(typeof _bazi==='undefined'){setTimeout(init,300);return}
    var bazi=_bazi;

    // 隐藏神煞行
    hideShensha();

    // 打开专业解读
    try{
      var sec=document.getElementById('proSection');
      if(sec)sec.classList.add('drawer-open');
      var arrow=document.querySelector('#proSection .drawer-arrow');
      if(arrow)arrow.style.transform='rotate(90deg)';
    }catch(e){}

    var body=document.querySelector('#proSection .drawer-body');
    if(!body)return;

    // 替换内容
    body.innerHTML=''+
      '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px;margin-bottom:14px">'+
        '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:8px;letter-spacing:1px">📐 四柱生克分析</div>'+
        '<div id="pillarAnalysis"></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">'+
        '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
          '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:8px;letter-spacing:1px">⚡ 日主能量</div>'+
          '<div id="dayMasterPower"></div>'+
        '</div>'+
        '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
          '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:8px;letter-spacing:1px">📋 命局格局</div>'+
          '<div id="patternAnalysis"></div>'+
        '</div>'+
      '</div>'+
      '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
        '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:4px;letter-spacing:1px">🎯 五行能量分布</div>'+
        '<canvas id="radarCanvas" style="display:block;margin:8px auto;width:260px;height:260px"></canvas>'+
        '<div id="wuxingNew" style="text-align:center;font-size:11px;color:var(--tx2);margin-top:4px"></div>'+
      '</div>';

    renderPillars(bazi);
    renderPower(bazi);
    renderPat(bazi);
    drawRadar(bazi);
  }

  function hideShensha(){
    // 隐藏四柱盘面中的神煞行
    var rows=document.querySelectorAll('.pp-shensha-row,.pp-row');
    for(var i=0;i<rows.length;i++){
      var r=rows[i];
      if(r.textContent.indexOf('神煞')>=0&&r.querySelector('.pp-label')){
        r.style.display='none';
      }
    }
    // 隐藏大运流年中的神煞标签
    var tags=document.querySelectorAll('.pp-shensha');
    for(var j=0;j<tags.length;j++){tags[j].style.display='none'}
  }

  function renderPillars(bazi){
    var c=document.getElementById('pillarAnalysis');if(!c)return;
    var m={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
    var cl={'木':'#6db86d','火':'#e07050','土':'#c9a84c','金':'#e8d5a3','水':'#5b9fd4'};
    var sg={'木':'火','火':'土','土':'金','金':'水','水':'木'};
    var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};
    var ps=['year','month','day','hour'],ns=['年柱','月柱','日柱','时柱'];
    var h='<div style="display:flex;justify-content:center;align-items:center;gap:2px;flex-wrap:wrap">';
    for(var i=0;i<4;i++){
      var p=bazi[ps[i]],g=p.gan,w=m[g]||'?';
      var isDay=(i===2);
      h+='<div style="text-align:center;background:'+(isDay?'rgba(201,168,76,.1)':'rgba(255,255,255,.03)')+';border:1px solid '+(isDay?'rgba(201,168,76,.3)':'rgba(255,255,255,.06)')+';border-radius:12px;padding:'+(isDay?'12px 16px':'10px 14px')+';min-width:'+(isDay?'60px':'55px')+'">';
      h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:2px">'+ns[i]+'</div>';
      h+='<div style="font-size:'+(isDay?'24px':'20px')+';font-weight:700;color:'+(cl[w]||'#fff')+'">'+g+'</div>';
      h+='<div style="font-size:13px;color:var(--tx2);margin:1px 0">'+p.zhi+'</div>';
      if(isDay)h+='<div style="font-size:9px;color:var(--gold-l);background:rgba(201,168,76,.15);border-radius:8px;padding:1px 6px;display:inline-block">☀ 日主</div>';
      h+='</div>';
      if(i<3&&i!==2){var w2=m[bazi[ps[i+1]].gan],rel='';if(sg[w]===w2)rel='<span style="color:#4f8;font-size:16px;font-weight:700">→生→</span>';else if(ke[w]===w2)rel='<span style="color:#f44;font-size:16px;font-weight:700">→克→</span>';else if(sg[w2]===w)rel='<span style="color:#4f8;font-size:16px;font-weight:700">←生←</span>';else if(ke[w2]===w)rel='<span style="color:#f44;font-size:16px;font-weight:700">←克←</span>';else rel='<span style="color:#666">—</span>';h+='<div style="min-width:40px;text-align:center;font-size:10px">'+rel+'</div>';}
    }
    h+='</div><div style="text-align:center;font-size:10px;color:var(--tx3);margin-top:8px;letter-spacing:1px">🟢 相生  🔴 相克  ·  箭头方向 = 影响方向</div>';
    c.innerHTML=h;
  }

  function renderPower(bazi){
    var c=document.getElementById('dayMasterPower');if(!c)return;
    var m={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
    var g=bazi.day.gan,w=m[g]||'?';
    var r;try{var fn=window.BaZiCalculator.calcDayMasterStrength;if(fn)r=fn(bazi);else r={score:50,detail:'日主中和'}}catch(e){r={score:50,detail:'日主中和'}}
    var l=r.score||50,lb=l>=65?'身强':l>=45?'中和':'身弱',co=l>=65?'#e07050':l>=45?'#c9a84c':'#5b9fd4';
    var emoji=l>=65?'🔥':l>=45?'⚖️':'💧';
    var tag=l>=65?'日主强旺，能担财官':l>=45?'日主中和，运势平稳':'日主偏弱，需印比帮扶';
    c.innerHTML=''+
      '<div style="text-align:center;margin-bottom:8px">'+
        '<span style="font-size:28px">'+emoji+'</span>'+
        '<div style="font-size:22px;font-weight:900;color:'+co+';margin:4px 0">'+lb+'</div>'+
        '<div style="font-size:11px;color:var(--tx2)">'+tag+'</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:6px;padding:2px 0">'+
        '<span style="font-size:10px;color:var(--tx3)">弱</span>'+
        '<div style="flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden">'+
          '<div style="width:'+l+'%;height:100%;background:linear-gradient(90deg,#5b9fd4,#c9a84c,#e07050);border-radius:3px"></div>'+
        '</div>'+
        '<span style="font-size:10px;color:var(--tx3)">强</span>'+
        '<span style="font-weight:700;color:'+co+';font-size:12px;margin-left:4px">'+l+'%</span>'+
      '</div>'+
      '<p style="color:var(--tx2);font-size:10px;margin-top:6px;line-height:1.5;opacity:.8">'+r.detail+'</p>';
  }

  function renderPat(bazi){
    var c=document.getElementById('patternAnalysis');if(!c)return;
    var ss=(bazi.month.shiShen&&bazi.month.shiShen.zhi)||'';
    var pt={'正官':{n:'正官格',icon:'🏛️',d:'月令正官当权。为人正直有责任心，适合公职管理。"官以任能，贵乎清正。"'},'七杀':{n:'七杀格',icon:'⚔️',d:'月令七杀当权。果断刚毅有魄力。杀需制化——食神制杀出武将，印化杀出文贵。'},'正财':{n:'正财格',icon:'💰',d:'月令正财当权。务实稳健善理财。财宜食伤来生，官星来护，富贵可期。'},'偏财':{n:'偏财格',icon:'💎',d:'月令偏财当权。慷慨大方，商业嗅觉敏锐，适合投资经营。'},'正印':{n:'正印格',icon:'📚',d:'月令正印当权。温厚善良学识渊博。印喜官杀来生，忌财星破印。'},'偏印':{n:'偏印格',icon:'🔬',d:'月令偏印当权。思维独特善钻研，适合技术学术方向。'},'食神':{n:'食神格',icon:'🎨',d:'月令食神当权。温和聪慧有才华。"食神有气胜财官。"'},'伤官':{n:'伤官格',icon:'💡',d:'月令伤官当权。聪明机敏创造力强。伤官需印制或生财。'},'建禄':{n:'建禄格',icon:'🏔️',d:'日主得禄位，自身强旺。禄喜财官，不宜再行比劫。'},'羊刃':{n:'羊刃格',icon:'🗡️',d:'日主得帝旺，气势极强。"羊刃驾杀，威震边疆。"'}};
    var p=pt[ss]||{n:'杂格',icon:'🔮',d:'格局不显，需结合天干透出与地支合局综合判断。'};
    c.innerHTML=''+
      '<div style="text-align:center;margin-bottom:6px">'+
        '<span style="font-size:28px">'+p.icon+'</span>'+
        '<div style="font-size:18px;font-weight:900;color:var(--gold-l);margin:4px 0">'+p.n+'</div>'+
      '</div>'+
      '<p style="color:var(--tx2);font-size:11px;line-height:1.5;text-align:center;opacity:.9">'+p.d+'</p>';
  }

  function drawRadar(bazi){
    if(!bazi.wuXingCount)return;
    var c=document.getElementById('radarCanvas');if(!c)return;
    var ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,s=260;
    c.width=s*dpr;c.height=s*dpr;c.style.width=s+'px';c.style.height=s+'px';ctx.scale(dpr,dpr);
    var cx=s/2,cy=s/2,mr=95;
    var el=['金','木','水','火','土'];
    var co=['#e8d5a3','#6db86d','#5b9fd4','#e07050','#c9a84c'];
    var vl=el.map(function(e){return bazi.wuXingCount[e]||0});
    var mv=Math.max.apply(null,vl.concat([1]));
    // Grid
    for(var l=1;l<=4;l++){ctx.beginPath();for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*l/4,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.strokeStyle='rgba(255,255,255,'+(0.03+l*0.015)+')';ctx.lineWidth=1;ctx.stroke()}
    // Axes + labels
    for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*mr,cy+Math.sin(a)*mr);ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.stroke();ctx.fillStyle=co[i];ctx.font='bold 12px "PingFang SC","Microsoft YaHei"';ctx.textAlign='center';ctx.fillText(el[i]+' '+vl[i],cx+Math.cos(a)*(mr+18),cy+Math.sin(a)*(mr+18))}
    // Data area
    ctx.beginPath();for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*vl[i]/mv,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();
    var grad=ctx.createRadialGradient(cx,cy,0,cx,cy,mr);
    grad.addColorStop(0,'rgba(201,168,76,.2)');grad.addColorStop(1,'rgba(201,168,76,.02)');
    ctx.fillStyle=grad;ctx.fill();
    ctx.strokeStyle='rgba(201,168,76,.6)';ctx.lineWidth=2;ctx.stroke();
    // Dots
    for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*vl[i]/mv;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,5,0,Math.PI*2);ctx.fillStyle=co[i];ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke()}
  }
})();
