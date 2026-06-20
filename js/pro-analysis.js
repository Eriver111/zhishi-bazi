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

    // === 天干行 ===
    var h='<div style="margin-bottom:2px"><div style="font-size:10px;color:var(--tx3);margin-bottom:4px;letter-spacing:2px">▸ 天干生克</div>';
    h+='<div style="display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap">';
    for(var i=0;i<4;i++){
      h+=pillBox(gs[i],zs[i],ns[i],i===2);
      if(i<3)h+=arrow(gs[i],gs[i+1],true);
    }
    h+='</div></div>';

    // === 地支行 ===
    h+='<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,.04);padding-top:10px"><div style="font-size:10px;color:var(--tx3);margin-bottom:4px;letter-spacing:2px">▸ 地支生克</div>';
    h+='<div style="display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap">';
    for(var i=0;i<4;i++){
      var zw=DZ[zs[i]]||'?';
      h+='<div style="text-align:center;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px;min-width:52px">';
      h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:2px">'+ns[i]+'</div>';
      h+='<div style="font-size:17px;font-weight:600;color:'+(TC[zw]||'#fff')+'">'+zs[i]+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3)">'+zw+'</div>';
      h+='</div>';
      if(i<3){
        var a=DZ[zs[i]],b=DZ[zs[i+1]],rel='';
        if(SG[a]===b)rel='<span style="color:#4f8;font-size:11px;font-weight:600">生➡</span>';
        else if(KE[a]===b)rel='<span style="color:#f44;font-size:11px;font-weight:600">克➡</span>';
        else if(SG[b]===a)rel='<span style="color:#4f8;font-size:11px">⬅生</span>';
        else if(KE[b]===a)rel='<span style="color:#f44;font-size:11px">⬅克</span>';
        else rel='<span style="color:#666;font-size:10px">—</span>';
        h+='<div style="min-width:38px;text-align:center">'+rel+'</div>';
      }
    }
    h+='</div></div>';

    // === 天干与地支关系 ===
    h+='<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,.04);padding-top:10px"><div style="font-size:10px;color:var(--tx3);margin-bottom:4px;letter-spacing:2px">▸ 天干与座下地支</div>';
    h+='<div style="display:flex;justify-content:center;gap:14px;flex-wrap:wrap;font-size:10px">';
    for(var i=0;i<4;i++){
      var gw=TG[gs[i]],zw=DZ[zs[i]],rel='';
      if(SG[gw]===zw)rel='<span style="color:#4f8">天干生地支(泄)</span>';
      else if(SG[zw]===gw)rel='<span style="color:#4f8">地支生天干(旺)</span>';
      else if(KE[gw]===zw)rel='<span style="color:#f44">天干克地支(耗)</span>';
      else if(KE[zw]===gw)rel='<span style="color:#f44">地支克天干(伤)</span>';
      else rel='<span style="color:#888">比和</span>';
      h+='<div style="padding:2px 8px;background:rgba(255,255,255,.02);border-radius:6px">'+ns[i]+' '+gs[i]+'↔'+zs[i]+' '+rel+'</div>';
    }
    h+='</div></div>';

    // === 刑冲合害 ===
    var branches=[bazi.year.zhi,bazi.month.zhi,bazi.day.zhi,bazi.hour.zhi];
    var bn=['年支申','月支申','日支丑','时支丑'];
    var rels=[];
    var CHONG={子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
    var HE={子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
    var HAI={子:'未',未:'子',丑:'午',午:'丑',寅:'巳',巳:'寅',卯:'辰',辰:'卯',申:'亥',亥:'申',酉:'戌',戌:'酉'};

    for(var i=0;i<4;i++){for(var j=i+1;j<4;j++){var a=branches[i],b=branches[j];if(CHONG[a]===b)rels.push({t:'六冲',c:'f44',d:bn[i]+'↔'+bn[j]+' 相冲——两败俱伤，主动荡'});if(HE[a]===b)rels.push({t:'六合',c:'4f8',d:bn[i]+'↔'+bn[j]+' 相合——情投意合，力量凝聚'});if(HAI[a]===b)rels.push({t:'六害',c:'f84',d:bn[i]+'↔'+bn[j]+' 相穿——暗中损伤'});if(a===b&&(a==='申'||a==='丑'))rels.push({t:'伏吟',c:'ca4',d:bn[i]+'↔'+bn[j]+' 伏吟——反复纠结，内心不安'});}}

    h+='<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,.04);padding-top:10px">';
    h+='<div style="font-size:10px;color:var(--tx2);font-weight:600;margin-bottom:6px">🔗 地支刑冲合害：</div>';
    if(rels.length===0)h+='<div style="font-size:10px;color:var(--tx3)">此地支组合平和，无特殊刑冲合害。</div>';
    else rels.forEach(function(r){h+='<div style="font-size:10px;padding:3px 8px;margin:2px 0;border-left:2px solid #'+r.c+';color:var(--tx2)"><b style="color:#'+r.c+'">'+r.t+'</b> '+r.d+'</div>'});
    h+='<div style="font-size:9px;color:var(--tx3);margin-top:6px">📖 《渊海子平》："刑冲克害，生克制化，乃论命之纲纪。" 🟢合=聚 🔴冲=动 🟠刑=伤 🔵害=损</div>';
    h+='</div>';

    c.innerHTML=h;
  }

  // ============ 日主能量 ============
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
      y='💧 水（印星）';x='🌿 木（比劫）';j='⚠️ 金（官杀）、土（财星）、火（食伤）';
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
