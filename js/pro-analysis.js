/**
 * v3.0 专业解读增强 - 独立文件
 * 替换 proSection 为四柱生克+雷达图+日主能量+格局
 */
(function(){
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

  function init(){
    if(typeof _bazi==='undefined'){setTimeout(init,300);return}
    var bazi=_bazi;
    try{
      document.getElementById('proSection').classList.add('drawer-open');
      var arrow=document.querySelector('#proSection .drawer-arrow');
      if(arrow)arrow.style.transform='rotate(90deg)';
    }catch(e){}

    var body=document.querySelector('#proSection .drawer-body');
    if(!body)return;

    body.innerHTML=''+
      '<div class="pro-sub"><div class="pro-sub-title">四柱生克分析</div><div id="pillarAnalysis"></div></div>'+
      '<div class="pro-sub"><div class="pro-sub-title">五行能量</div><canvas id="radarCanvas" style="display:block;margin:10px auto;width:280px;height:280px"></canvas><div id="wuxingNew"></div></div>'+
      '<div class="pro-sub"><div class="pro-sub-title">日主能量</div><div id="dayMasterPower"></div></div>'+
      '<div class="pro-sub"><div class="pro-sub-title">命局格局</div><div id="patternAnalysis"></div></div>';

    renderPillars(bazi);
    renderPower(bazi);
    renderPat(bazi);
    drawRadar(bazi);
  }

  function renderPillars(bazi){
    var c=document.getElementById('pillarAnalysis');if(!c)return;
    var m={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
    var cl={'木':'#6db86d','火':'#e07050','土':'#c9a84c','金':'#e8d5a3','水':'#5b9fd4'};
    var sg={'木':'火','火':'土','土':'金','金':'水','水':'木'};
    var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};
    var ps=['year','month','day','hour'],ns=['年柱','月柱','日柱','时柱'];
    var h='<div style="display:flex;justify-content:center;align-items:center;gap:4px;flex-wrap:wrap;padding:8px 0">';
    for(var i=0;i<4;i++){
      var p=bazi[ps[i]],g=p.gan,w=m[g]||'?';
      h+='<div style="text-align:center;background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:10px;padding:8px 12px;min-width:55px">';
      h+='<div style="font-size:10px;color:var(--tx3)">'+ns[i]+'</div>';
      h+='<div style="font-size:20px;font-weight:700;color:'+(cl[w]||'#fff')+'">'+g+'</div>';
      h+='<div style="font-size:13px;color:var(--tx2)">'+p.zhi+'</div>';
      if(i===2)h+='<div style="font-size:9px;color:var(--gold-l)">☀日主</div>';
      h+='</div>';
      if(i<3){var w2=m[bazi[ps[i+1]].gan],rel='';if(sg[w]===w2)rel='<span style="color:#4f8;font-size:14px">生➡</span>';else if(ke[w]===w2)rel='<span style="color:#f44;font-size:14px">克➡</span>';else if(sg[w2]===w)rel='<span style="color:#4f8;font-size:14px">⬅生</span>';else if(ke[w2]===w)rel='<span style="color:#f44;font-size:14px">⬅克</span>';else rel='<span style="color:#888">—</span>';h+='<div style="min-width:30px;text-align:center">'+rel+'</div>';}
    }
    h+='</div><div style="text-align:center;font-size:10px;color:var(--tx3);margin-bottom:8px">🟢相生 🔴相克 箭头→被影响方</div>';
    c.innerHTML=h;
  }

  function renderPower(bazi){
    var c=document.getElementById('dayMasterPower');if(!c)return;
    var m={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
    var g=bazi.day.gan,w=m[g]||'?';
    var r;try{var fn=window.BaZiCalculator.calcDayMasterStrength;if(fn)r=fn(bazi);else r={score:50,detail:'日主中和'}}catch(e){r={score:50,detail:'日主中和'}}
    var l=r.score||50,lb=l>=65?'身强':l>=45?'中和':'身弱',co=l>=65?'#e44':l>=45?'#ca4':'#48f';
    c.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><span style="font-size:11px;color:var(--tx3)">身弱</span><div style="flex:1;height:8px;background:rgba(255,255,255,.1);border-radius:4px"><div style="width:'+l+'%;height:100%;background:'+co+';border-radius:4px"></div></div><span style="font-size:11px;color:var(--tx3)">身强</span><span style="font-weight:700;color:'+co+';font-size:15px;margin-left:8px">'+lb+'</span></div><p style="color:var(--tx2);font-size:11px;margin-top:4px">'+r.detail+'</p>';
  }

  function renderPat(bazi){
    var c=document.getElementById('patternAnalysis');if(!c)return;
    var ss=(bazi.month.shiShen&&bazi.month.shiShen.zhi)||'';
    var pt={'正官':{n:'正官格',d:'月令正官当权。为人正直有责任心。'},'七杀':{n:'七杀格',d:'月令七杀当权。果断刚毅。杀需制化。'},'正财':{n:'正财格',d:'月令正财当权。务实稳健善理财。'},'偏财':{n:'偏财格',d:'月令偏财当权。慷慨大方。'},'正印':{n:'正印格',d:'月令正印当权。温厚善良学识渊博。'},'偏印':{n:'偏印格',d:'月令偏印当权。思维独特善钻研。'},'食神':{n:'食神格',d:'月令食神当权。温和聪慧有才华。'},'伤官':{n:'伤官格',d:'月令伤官当权。聪明机敏创造力强。'},'建禄':{n:'建禄格',d:'日主得禄位，自身强旺。'},'羊刃':{n:'羊刃格',d:'日主得帝旺，气势极强。'}};
    var p=pt[ss]||{n:'杂格',d:'格局不显，需结合天干透出与地支合局综合判断。'};
    c.innerHTML='<p style="color:var(--gold-l);font-size:15px;font-weight:700;margin-bottom:4px">'+p.n+'</p><p style="color:var(--tx2);font-size:12px">'+p.d+'</p>';
  }

  function drawRadar(bazi){
    if(!bazi.wuXingCount)return;
    var c=document.getElementById('radarCanvas');if(!c)return;
    var ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,s=280;
    c.width=s*dpr;c.height=s*dpr;c.style.width=s+'px';c.style.height=s+'px';ctx.scale(dpr,dpr);
    var cx=s/2,cy=s/2,mr=100;
    var el=['金','木','水','火','土'];
    var co=['#e8d5a3','#6db86d','#5b9fd4','#e07050','#c9a84c'];
    var vl=el.map(function(e){return bazi.wuXingCount[e]||0});
    var mv=Math.max.apply(null,vl.concat([1]));
    for(var l=1;l<=4;l++){ctx.beginPath();for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*l/4,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.strokeStyle='rgba(255,255,255,'+(0.04+l*0.02)+')';ctx.lineWidth=1;ctx.stroke()}
    for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*mr,cy+Math.sin(a)*mr);ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.stroke();ctx.fillStyle=co[i];ctx.font='bold 13px PingFang SC';ctx.textAlign='center';ctx.fillText(el[i]+' '+vl[i],cx+Math.cos(a)*(mr+20),cy+Math.sin(a)*(mr+20))}
    ctx.beginPath();for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*vl[i]/mv,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.fillStyle='rgba(201,168,76,0.12)';ctx.fill();ctx.strokeStyle='rgba(201,168,76,0.5)';ctx.lineWidth=2;ctx.stroke();
    for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*vl[i]/mv;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,4,0,Math.PI*2);ctx.fillStyle=co[i];ctx.fill()}
  }
})();
