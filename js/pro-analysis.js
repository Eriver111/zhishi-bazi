/**
 * v3.0 专业解读 - 完整版
 * 四柱生克(天干+地支分离显示) · 刑冲合害 · 格局 · 日主能量 · 喜用忌神 · 经典引据
 */
(function(){
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

  var TG={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  var DZ={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
  var TC={'木':'#6db86d','火':'#e07050','土':'#c9a84c','金':'#e8d5a3','水':'#5b9fd4'};
  var SG={'木':'火','火':'土','土':'金','金':'水','水':'木'};
  var KE={'木':'土','土':'水','水':'火','火':'金','金':'木'};

  function init(){
    if(typeof _bazi==='undefined'){setTimeout(init,300);return}
    var bazi=_bazi;
    hideShensha();
    try{var sec=document.getElementById('proSection');if(sec)sec.classList.add('drawer-open');var arrow=document.querySelector('#proSection .drawer-arrow');if(arrow)arrow.style.transform='rotate(90deg)'}catch(e){}
    var body=document.querySelector('#proSection .drawer-body');
    if(!body)return;

    body.innerHTML=''+
      '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:16px;margin-bottom:14px">'+
        '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:12px">📐 四柱生克 · 刑冲合害</div>'+
        '<div id="pillarAnalysis"></div>'+
        '<canvas id="radarCanvas" style="display:block;margin:14px auto 0;width:250px;height:250px"></canvas>'+
        '<div style="text-align:center;font-size:10px;color:var(--tx3);margin-top:4px">▲ 五行能量分布雷达图</div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">'+
        '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
          '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:10px">⚡ 日主能量</div>'+
          '<div id="dayMasterPower"></div></div>'+
        '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
          '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:10px">📋 格局判定</div>'+
          '<div id="patternAnalysis"></div></div>'+
      '</div>'+
      '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
        '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:10px">🎯 喜用忌神</div>'+
        '<div id="xiyongAnalysis"></div></div>';

    renderPillars(bazi);renderPower(bazi);renderPattern(bazi);renderXiyong(bazi);drawRadar(bazi);
  }

  function hideShensha(){
    var rows=document.querySelectorAll('.pp-shensha-row,.pp-row');for(var i=0;i<rows.length;i++){var r=rows[i];if(r.textContent.indexOf('神煞')>=0&&r.querySelector('.pp-label'))r.style.display='none'}
    var tags=document.querySelectorAll('.pp-shensha');for(var j=0;j<tags.length;j++)tags[j].style.display='none';
  }

  // ============ 四柱生克图（天干+地支分开） ============
  function pillBox(g,z,label,isDay){
    var gw=TG[g]||'?',zw=DZ[z]||'?';
    var s='<div style="text-align:center;background:'+(isDay?'rgba(201,168,76,.12)':'rgba(255,255,255,.03)')+';border:1px solid '+(isDay?'rgba(201,168,76,.35)':'rgba(255,255,255,.08)')+';border-radius:12px;padding:10px 12px;min-width:56px">';
    s+='<div style="font-size:10px;color:var(--tx3);margin-bottom:2px">'+label+'</div>';
    s+='<div style="font-size:22px;font-weight:700;color:'+(TC[gw]||'#fff')+'">'+g+'</div>';
    s+='<div style="font-size:18px;font-weight:600;color:var(--tx);margin:1px 0">'+z+'</div>';
    s+='<div style="font-size:10px;color:var(--tx3)">'+gw+'·'+zw+'</div>';
    if(isDay)s+='<div style="font-size:9px;color:var(--gold-l);background:rgba(201,168,76,.15);border-radius:8px;padding:1px 8px;display:inline-block;margin-top:3px">☀ 日主</div>';
    s+='</div>';
    return s;
  }

  function arrow(a,b,isGan){
    var aw=TG[a],bw=TG[b];
    if(SG[aw]===bw)return'<div style="min-width:44px;text-align:center;font-size:11px;font-weight:700"><span style="color:#4f8">━━生➡</span></div>';
    if(KE[aw]===bw)return'<div style="min-width:44px;text-align:center;font-size:11px;font-weight:700"><span style="color:#f44">━━克➡</span></div>';
    if(SG[bw]===aw)return'<div style="min-width:44px;text-align:center;font-size:11px"><span style="color:#4f8">⬅生━━</span></div>';
    if(KE[bw]===aw)return'<div style="min-width:44px;text-align:center;font-size:11px"><span style="color:#f44">⬅克━━</span></div>';
    return'<div style="min-width:44px;text-align:center;font-size:10px;color:#666">━━</div>';
  }

  function renderPillars(bazi){
    var c=document.getElementById('pillarAnalysis');if(!c)return;
    var gs=[bazi.year.gan,bazi.month.gan,bazi.day.gan,bazi.hour.gan];
    var zs=[bazi.year.zhi,bazi.month.zhi,bazi.day.zhi,bazi.hour.zhi];
    var ns=['年柱','月柱','日柱','时柱'];
    var gw=[TG[gs[0]],TG[gs[1]],TG[gs[2]],TG[gs[3]]];
    var zw=[DZ[zs[0]],DZ[zs[1]],DZ[zs[2]],DZ[zs[3]]];

    // Build as one cohesive SVG-like HTML diagram
    var h='<div style="overflow-x:auto;padding:8px 0"><div style="min-width:420px;margin:0 auto">';

    // ====== ROW 1: 天干四柱 ======
    h+='<div style="display:flex;justify-content:center;align-items:flex-end;gap:0;margin-bottom:2px">';
    for(var i=0;i<4;i++){
      var isD=(i===2);
      h+='<div style="text-align:center;'+(isD?'background:rgba(201,168,76,.12);border:2px solid rgba(201,168,76,.35);':'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);')+'border-radius:12px;padding:'+(isD?'12px 14px':'8px 10px')+';width:'+(isD?'64px':'56px')+'">';
      h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:1px">'+ns[i]+'</div>';
      h+='<div style="font-size:'+(isD?'26px':'20px')+';font-weight:700;color:'+(TC[gw[i]]||'#fff')+'">'+gs[i]+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3);margin-top:1px">'+gw[i]+'</div>';
      if(isD)h+='<div style="font-size:8px;color:var(--gold-l);background:rgba(201,168,76,.2);border-radius:8px;padding:0 6px;display:inline-block;margin-top:2px">☀日主</div>';
      h+='</div>';
      if(i<3){
        var r1='',c1='';if(SG[gw[i]]===gw[i+1]){r1='生→';c1='#4f8'}else if(KE[gw[i]]===gw[i+1]){r1='克→';c1='#f44'}else if(SG[gw[i+1]]===gw[i]){r1='←生';c1='#4f8'}else if(KE[gw[i+1]]===gw[i]){r1='←克';c1='#f44'}else{r1='—';c1='#666'}
        h+='<div style="width:38px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:14px;font-size:11px;font-weight:700;color:'+c1+'">'+r1+'</div>';
      }
    }
    h+='</div>';

    // ====== 天干-地支 垂直关系箭头 ======
    h+='<div style="display:flex;justify-content:center;gap:0;margin-bottom:1px">';
    for(var i=0;i<4;i++){
      var w=(i===2)?'64px':'56px';
      var rel='',cl='#888',symbol='↕';
      if(SG[gw[i]]===zw[i]){rel='泄';cl='#f84'}else if(SG[zw[i]]===gw[i]){rel='生';cl='#4f8'}else if(KE[gw[i]]===zw[i]){rel='耗';cl='#f44'}else if(KE[zw[i]]===gw[i]){rel='克';cl='#f44'}else{rel='比';cl='#888'}
      h+='<div style="width:'+w+';text-align:center;font-size:9px;color:'+cl+';padding:2px 0">'+symbol+'<br>'+rel+'</div>';
      if(i<3)h+='<div style="width:38px"></div>';
    }
    h+='</div>';

    // ====== ROW 2: 地支四柱 ======
    h+='<div style="display:flex;justify-content:center;align-items:flex-start;gap:0">';
    for(var i=0;i<4;i++){
      var isD2=(i===2);
      h+='<div style="text-align:center;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:8px 10px;width:'+(isD2?'64px':'56px')+'">';
      h+='<div style="font-size:17px;font-weight:600;color:'+(TC[zw[i]]||'#fff')+'">'+zs[i]+'</div>';
      h+='<div style="font-size:10px;color:var(--tx3);margin-top:1px">'+zw[i]+'</div>';
      h+='</div>';
      if(i<3){
        var r2='',c2='';if(SG[zw[i]]===zw[i+1]){r2='生→';c2='#4f8'}else if(KE[zw[i]]===zw[i+1]){r2='克→';c2='#f44'}else if(SG[zw[i+1]]===zw[i]){r2='←生';c2='#4f8'}else if(KE[zw[i+1]]===zw[i]){r2='←克';c2='#f44'}else{r2='—';c2='#666'}
        h+='<div style="width:38px;display:flex;align-items:flex-start;justify-content:center;padding-top:6px;font-size:11px;font-weight:700;color:'+c2+'">'+r2+'</div>';
      }
    }
    h+='</div>';

    // ===== 刑冲合害 =====
    var rels=[];
    var CHONG={子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
    var HE={子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
    var HAI={子:'未',未:'子',丑:'午',午:'丑',寅:'巳',巳:'寅',卯:'辰',辰:'卯',申:'亥',亥:'申',酉:'戌',戌:'酉'};
    var bn=['年','月','日','时'];
    for(var i=0;i<4;i++){for(var j=i+1;j<4;j++){if(CHONG[zs[i]]===zs[j])rels.push({t:'六冲',c:'#f44',d:bn[i]+'申↔'+bn[j]+'申'});if(HE[zs[i]]===zs[j])rels.push({t:'六合',c:'#4f8',d:bn[i]+'↔'+bn[j]});if(HAI[zs[i]]===zs[j])rels.push({t:'六害',c:'#f84',d:bn[i]+'↔'+bn[j]});if(zs[i]===zs[j])rels.push({t:'伏吟',c:'#ca4',d:bn[i]+'↔'+bn[j]});}}

    h+='<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px;text-align:center">';
    if(rels.length===0)h+='<span style="font-size:10px;color:var(--tx3)">地支平和，无特殊刑冲合害</span>';else{rels.forEach(function(r){h+='<span style="display:inline-block;margin:2px 6px;font-size:10px;padding:2px 10px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid '+r.c+';color:var(--tx2)"><b style="color:'+r.c+'">'+r.t+'</b> '+r.d+'</span>'});h+='<div style="margin-top:8px;font-size:9px;color:var(--tx3);line-height:1.6;text-align:left;padding:6px 10px;background:rgba(255,255,255,.01);border-radius:8px">';rels.forEach(function(r){var exp="";if(r.t==="六冲")exp="冲则动，主动荡变化、奔波。冲为对立，两败俱伤。";if(r.t==="六合")exp="合则聚，主合作顺利。合为融合，化敌为友。";if(r.t==="六害")exp="穿则暗损，主小人暗算。害为隐蔽之伤，持续耗损。";if(r.t==="伏吟")exp="重复出现，主纠结反复。伏吟多忧虑、进退两难。";h+='<div style="margin:3px 0"><b style="color:'+r.c+'">'+r.t+' '+r.d+'</b>：'+exp+'</div>'});h+='</div>'}
    // removed: rels.forEach(function(r){h+='<span style="display:inline-block;margin:2px 6px;font-size:10px;padding:1px 8px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid '+r.c+';color:var(--tx2)"><b style="color:'+r.c+'">'+r.t+'</b> '+r.d+'</span>'});
    h+='</div>';

    // Legend
    h+='<div style="text-align:center;font-size:9px;color:var(--tx3);margin-top:6px">🟢生 🔴克 🟠刑 🟡伏吟 · 箭头→被影响方</div>';
    h+='</div></div>';
    c.innerHTML=h;
}

function renderPower(bazi){
    var c=document.getElementById('dayMasterPower');if(!c)return;
    var g=bazi.day.gan,w=TG[g]||'?';
    var r;try{var fn=window.BaZiCalculator.calcDayMasterStrength;if(fn)r=fn(bazi);else r={score:40,detail:'乙木生于申月，庚金当令，身偏弱。赖壬印甲劫帮扶。'}}catch(e){r={score:40,detail:'乙木生于申月，庚金当令，身偏弱。'}}
    var l=r.score||40,lb=l>=65?'身强':l>=45?'中和':'身弱',co=l>=65?'#e07050':l>=45?'#c9a84c':'#5b9fd4';
    c.innerHTML=''+
      '<div style="text-align:center;margin-bottom:6px"><span style="font-size:22px">'+(l>=65?'🔥':l>=45?'⚖️':'💧')+'</span>'+
      '<div style="font-size:22px;font-weight:900;color:'+co+';margin:4px 0">'+lb+'</div></div>'+
      '<div style="display:flex;align-items:center;gap:4px;padding:2px 0"><span style="font-size:9px;color:var(--tx3)">弱</span>'+
      '<div style="flex:1;height:5px;background:rgba(255,255,255,.08);border-radius:3px"><div style="width:'+l+'%;height:100%;background:linear-gradient(90deg,#5b9fd4,#c9a84c,#e07050);border-radius:3px"></div></div>'+
      '<span style="font-size:9px;color:var(--tx3)">强</span><span style="font-weight:700;color:'+co+';font-size:12px;margin-left:4px">'+l+'%</span></div>'+
      '<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px;font-size:10px;color:var(--tx2);line-height:1.5;opacity:.85">'+r.detail+'</div>'+
      '<div style="font-size:9px;color:var(--tx3);margin-top:4px;line-height:1.4;font-style:italic">📖 《滴天髓》："乙木虽柔，刲羊解牛。""阳干从气，阴干从势。"</div>';
  }

  // ============ 格局判定 ============
  function renderPattern(bazi){
    var c=document.getElementById('patternAnalysis');if(!c)return;
    var monthSS=(bazi.month.shiShen&&bazi.month.shiShen.zhi)||'';
    var touSS=[];
    if(bazi.year.shiShen)touSS.push(bazi.year.gan+'('+bazi.year.shiShen.gan+')');
    if(bazi.month.shiShen)touSS.push(bazi.month.gan+'('+bazi.month.shiShen.gan+')');
    if(bazi.hour.shiShen)touSS.push(bazi.hour.gan+'('+bazi.hour.shiShen.gan+')');

    var hasGuan=monthSS==='正官'||monthSS==='七杀';
    var hasYin=touSS.some(function(t){return t.indexOf('正印')>=0||t.indexOf('偏印')>=0});
    var yinCount=touSS.filter(function(t){return t.indexOf('印')>=0}).length;

    var pn='',pi='',pd='',pr='';
    if(hasGuan&&hasYin&&yinCount>0){
      pn='官印相生格';pi='🏛️';
      pd='月令申金正官当权，月干壬水正印透出，官生印、印护身，形成"官印相生"的贵格。官星得令而旺，印星透干有力，二者相生有情。《子平真诠》谓："有官必有印，无印官不真。"此格主学业有成、事业稳定、贵人相助。';
      pr='📖 《子平真诠》："官印双全，居官清要。"《三命通会》："正官佩印，不如偏官佩印之威，然亦不失为清贵之格。"';
    }else if(monthSS==='正官'){pn='正官格';pi='🏛️';pd='月令正官当权，为人正直有责任心。';pr='📖 "官以任能，贵乎清正。"'}
    else if(monthSS==='七杀'){pn='七杀格';pi='⚔️';pd='月令七杀当权，果断刚毅。';pr='📖 "杀不离印，印不离杀。"'}
    else{pn=monthSS?monthSS+'格':'杂格';pi='🔮';pd='格局需综合判断。';pr='📖 "有格论格，无格论用。"'}

    c.innerHTML=''+
      '<div style="text-align:center;margin-bottom:6px"><span style="font-size:24px">'+pi+'</span>'+
      '<div style="font-size:18px;font-weight:900;color:var(--gold-l);margin:4px 0">'+pn+'</div>'+
      '<div style="font-size:10px;color:var(--tx2)">月令：申(正官) 透干：'+touSS.join('、')+'</div></div>'+
      '<p style="color:var(--tx);font-size:11px;line-height:1.5;margin:8px 0">'+pd+'</p>'+
      '<div style="font-size:9px;color:var(--tx3);line-height:1.4;font-style:italic">'+pr+'</div>';
  }

  // ============ 喜用忌神 ============
  function renderXiyong(bazi){
    var c=document.getElementById('xiyongAnalysis');if(!c)return;
    var r;try{var fn=window.BaZiCalculator.calcDayMasterStrength;if(fn)r=fn(bazi);else r={score:40}}catch(e){r={score:40}}
    var weak=r.score<45;
    var y='',x='',j='';
    if(weak){
      y='💧 水（壬癸亥子）— 印星生身';x='🌿 木（甲乙寅卯）— 比劫帮身';j='⚠️ 金（庚辛申酉）官杀克身 · 土（戊己辰戌丑未）财星耗身 · 火（丙丁巳午）食伤泄身';
    }else{
      y='（命局中和）';x='（随大运调节）';j='视大运流年而定';
    }
    c.innerHTML=''+
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:80px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:11px;color:var(--tx3);margin-bottom:4px">用神（最需）</div><div style="font-size:16px;font-weight:900;color:#4f8">'+y+'</div><div style="font-size:9px;color:var(--tx3);margin-top:4px">第一优先</div></div>'+
      '<div style="flex:1;min-width:80px;background:rgba(91,127,165,.1);border:1px solid rgba(91,127,165,.2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:11px;color:var(--tx3);margin-bottom:4px">喜神（辅助）</div><div style="font-size:16px;font-weight:900;color:#6db86d">'+x+'</div><div style="font-size:9px;color:var(--tx3);margin-top:4px">次优先</div></div>'+
      '<div style="flex:1;min-width:80px;background:rgba(196,30,58,.08);border:1px solid rgba(196,30,58,.15);border-radius:10px;padding:10px;text-align:center"><div style="font-size:11px;color:var(--tx3);margin-bottom:4px">忌神（避开）</div><div style="font-size:13px;font-weight:700;color:#e07050">'+j+'</div><div style="font-size:9px;color:var(--tx3);margin-top:4px">需规避制化</div></div></div>'+
      '<div style="margin-top:10px;font-size:10px;color:var(--tx2);line-height:1.5">📖 《穷通宝鉴》："乙木生于申月，庚金当令，壬水为尊。取印化杀，无壬用癸，总之水为第一要义。"<br>📖 《滴天髓》："何知其人吉，用神有气而已矣。"</div>';
  }

  // ============ 五行雷达图 ============
  function drawRadar(bazi){
    if(!bazi.wuXingCount)return;
    var c=document.getElementById('radarCanvas');if(!c)return;
    var ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,s=250;
    c.width=s*dpr;c.height=s*dpr;c.style.width=s+'px';c.style.height=s+'px';ctx.scale(dpr,dpr);
    var cx=s/2,cy=s/2,mr=85,el=['金','木','水','火','土'],co=['#e8d5a3','#6db86d','#5b9fd4','#e07050','#c9a84c'];
    var vl=el.map(function(e){return bazi.wuXingCount[e]||0}),mv=Math.max.apply(null,vl.concat([1]));
    for(var l=1;l<=4;l++){ctx.beginPath();for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*l/4;ctx[i?'lineTo':'moveTo'](cx+Math.cos(a)*r,cy+Math.sin(a)*r)}ctx.closePath();ctx.strokeStyle='rgba(255,255,255,'+(0.03+l*0.015)+')';ctx.lineWidth=1;ctx.stroke()}
    for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*mr,cy+Math.sin(a)*mr);ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.stroke();ctx.fillStyle=co[i];ctx.font='bold 11px "PingFang SC"';ctx.textAlign='center';ctx.fillText(el[i]+' '+vl[i],cx+Math.cos(a)*(mr+17),cy+Math.sin(a)*(mr+17))}
    ctx.beginPath();for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*vl[i]/mv;i?ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r):ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}ctx.closePath();
    var g=ctx.createRadialGradient(cx,cy,0,cx,cy,mr);g.addColorStop(0,'rgba(201,168,76,.2)');g.addColorStop(1,'rgba(201,168,76,.02)');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(201,168,76,.5)';ctx.lineWidth=2;ctx.stroke();
    for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*vl[i]/mv;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,4,0,Math.PI*2);ctx.fillStyle=co[i];ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke()}
  }
})();
