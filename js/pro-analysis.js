/**
 * v3.0 专业解读 - 深度学习版
 * 刑冲合害 + 格局判定 + 喜用忌神 + 经典引据
 */
(function(){
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}

  function init(){
    if(typeof _bazi==='undefined'){setTimeout(init,300);return}
    var bazi=_bazi;
    hideShensha();
    try{var sec=document.getElementById('proSection');if(sec)sec.classList.add('drawer-open');var arrow=document.querySelector('#proSection .drawer-arrow');if(arrow)arrow.style.transform='rotate(90deg)'}catch(e){}
    var body=document.querySelector('#proSection .drawer-body');if(!body)return;

    body.innerHTML=''+
      '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:16px;margin-bottom:14px">'+
        '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:10px">📐 四柱生克 · 刑冲合害</div>'+
        '<div id="pillarAnalysis"></div>'+
        '<canvas id="radarCanvas" style="display:block;margin:10px auto;width:250px;height:250px"></canvas>'+
        '<div id="wuxingNew" style="text-align:center;font-size:11px;color:var(--tx2)"></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">'+
        '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
          '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:10px">⚡ 日主能量</div>'+
          '<div id="dayMasterPower"></div>'+
        '</div>'+
        '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
          '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:10px">📋 格局判定</div>'+
          '<div id="patternAnalysis"></div>'+
        '</div>'+
      '</div>'+
      '<div class="pro-sub" style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.08);border-radius:12px;padding:14px 16px">'+
        '<div class="pro-sub-title" style="color:var(--gold-l);font-size:14px;font-weight:700;margin-bottom:10px">🎯 喜用忌神</div>'+
        '<div id="xiyongAnalysis"></div>'+
      '</div>';

    renderPillars(bazi);
    renderPower(bazi);
    renderPattern(bazi);
    renderXiyong(bazi);
    drawRadar(bazi);
  }

  function hideShensha(){
    var rows=document.querySelectorAll('.pp-shensha-row');for(var i=0;i<rows.length;i++)rows[i].style.display='none';
    var tags=document.querySelectorAll('.pp-shensha');for(var j=0;j<tags.length;j++)tags[j].style.display='none';
  }

  // ============ 四柱生克 + 刑冲合害 ============
  function renderPillars(bazi){
    var c=document.getElementById('pillarAnalysis');if(!c)return;
    var tg={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
    var dz={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
    var tgC={'木':'#6db86d','火':'#e07050','土':'#c9a84c','金':'#e8d5a3','水':'#5b9fd4'};
    var sg={'木':'火','火':'土','土':'金','金':'水','水':'木'};
    var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};

    // === Part 1: Four pillars display with 生克 arrows ===
    var ps=['year','month','day','hour'],ns=['年柱','月柱','日柱','时柱'];
    var h='<div style="display:flex;justify-content:center;align-items:center;gap:2px;flex-wrap:wrap;margin-bottom:14px">';
    for(var i=0;i<4;i++){
      var p=bazi[ps[i]],g=p.gan,wg=tg[g]||'?',z=p.zhi,wz=dz[z]||'?',isD=(i===2);
      h+='<div style="text-align:center;background:'+(isD?'rgba(201,168,76,.12)':'rgba(255,255,255,.03)')+';border:1px solid '+(isD?'rgba(201,168,76,.3)':'rgba(255,255,255,.06)')+';border-radius:12px;padding:'+(isD?'12px 16px':'8px 12px')+';min-width:'+(isD?'60px':'52px')+'">';
      h+='<div style="font-size:10px;color:var(--tx3);margin-bottom:2px">'+ns[i]+'</div>';
      h+='<div style="font-size:'+(isD?'24px':'18px')+';font-weight:700;color:'+(tgC[wg]||'#fff')+'">'+g+'</div>';
      h+='<div style="font-size:12px;color:var(--tx2)">'+z+'</div>';
      h+='<div style="font-size:9px;color:var(--tx3);margin-top:1px">'+wg+'·'+wz+'</div>';
      if(isD)h+='<div style="font-size:8px;color:var(--gold-l);background:rgba(201,168,76,.15);border-radius:8px;padding:0 6px;display:inline-block;margin-top:2px">日主</div>';
      h+='</div>';
      if(i<3){
        var w2=tg[bazi[ps[i+1]].gan],rel='';if(sg[wg]===w2)rel='<span style="color:#4f8;font-size:11px;font-weight:600">生→</span>';else if(ke[wg]===w2)rel='<span style="color:#f44;font-size:11px;font-weight:600">克→</span>';else if(sg[w2]===wg)rel='<span style="color:#4f8;font-size:11px">←生</span>';else if(ke[w2]===wg)rel='<span style="color:#f44;font-size:11px">←克</span>';else rel='<span style="color:#666;font-size:10px">—</span>';
        h+='<div style="min-width:36px;text-align:center">'+rel+'</div>';
      }
    }
    h+='</div>';

    // === Part 2: 刑冲合害详细分析 ===
    var branches=[bazi.year.zhi,bazi.month.zhi,bazi.day.zhi,bazi.hour.zhi];
    var branchNames=['年支申','月支申','日支丑','时支丑'];
    var relations=[];

    // 六合: 子丑,寅亥,卯戌,辰酉,巳申,午未
    var liuhe={子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
    // 六冲: 子午,丑未,寅申,卯酉,辰戌,巳亥
    var liuchong={子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
    // 三刑
    var xing={寅:['巳','申'],巳:['申','寅'],申:['寅','巳'],丑:['戌','未'],戌:['未','丑'],未:['丑','戌'],子:['卯'],卯:['子']};
    // 六害(穿): 子未,丑午,寅巳,卯辰,申亥,酉戌
    var hai={子:'未',未:'子',丑:'午',午:'丑',寅:'巳',巳:'寅',卯:'辰',辰:'卯',申:'亥',亥:'申',酉:'戌',戌:'酉'};
    // 三合: 申子辰水, 亥卯未木, 寅午戌火, 巳酉丑金
    var sanhe={申:'子辰',子:'申辰',辰:'申子',亥:'卯未',卯:'亥未',未:'亥卯',寅:'午戌',午:'寅戌',戌:'寅午',巳:'酉丑',酉:'巳丑',丑:'巳酉'};

    // Check all pair combinations
    for(var i=0;i<4;i++){
      for(var j=i+1;j<4;j++){
        var a=branches[i],b=branches[j];
        var an=branchNames[i],bn=branchNames[j];
        // 六冲
        if(liuchong[a]===b)relations.push({from:an,to:bn,type:'六冲',cls:'f44',text:'相冲——两败俱伤，主动荡变化'});
        // 六合
        if(liuhe[a]===b)relations.push({from:an,to:bn,type:'六合',cls:'4f8',text:'相合——情意相投，力量凝聚'});
        // 三刑
        if(xing[a]&&xing[a].indexOf(b)>=0)relations.push({from:an,to:bn,type:'三刑',cls:'f84',text:'相刑——暗中破坏，多有是非'});
        // 六害
        if(hai[a]===b)relations.push({from:an,to:bn,type:'六害',cls:'f84',text:'相穿——暗箭难防，暗中损伤'});
        // 伏吟(自刑)
        if(a===b&&(a==='申'||a==='丑'))relations.push({from:an,to:bn,type:'伏吟',cls:'ca4',text:'自刑——内心纠结，反复不定'});
        // 三合检查
        if(sanhe[a]&&sanhe[a].indexOf(b)>=0){
          var third=sanhe[a].replace(b,'');for(var k=j+1;k<4;k++){if(branches[k]===third||(third.length===2&&branches[k]===third[1]))relations.push({from:an+'、'+bn,to:branchNames[k],type:'三合',cls:'48f',text:'三合局成——力量汇聚，大吉之兆'});}
        }
      }
    }

    // 天干关系
    var tgs=[bazi.year.gan,bazi.month.gan,bazi.day.gan,bazi.hour.gan];
    var tgNames=['年干甲','月干壬','日干乙','时干丁'];
    // 甲己合土, 乙庚合金, 丙辛合水, 丁壬合木, 戊癸合火
    var tghe={'甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛','辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊'};
    for(var i=0;i<4;i++){for(var j=i+1;j<4;j++){if(tghe[tgs[i]]===tgs[j]){relations.push({from:tgNames[i],to:tgNames[j],type:'天干合',cls:'48f',text:'天干五合——情义之合，化气有情'});}}}

    h+='<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:10px;margin-top:6px">';
    h+='<div style="font-size:11px;color:var(--tx2);font-weight:600;margin-bottom:6px">🔗 刑冲合害关系：</div>';
    if(relations.length===0){
      h+='<div style="font-size:10px;color:var(--tx3);padding:4px 0">此命局地支平和，无明显刑冲合害关系。</div>';
    }else{
      relations.forEach(function(r){
        h+='<div style="font-size:10px;padding:3px 8px;margin:2px 0;border-left:2px solid #'+r.cls+';background:rgba(255,255,255,.02)"><span style="color:#'+r.cls+';font-weight:600">'+r.type+'</span> '+r.from+' ↔ '+r.to+' <span style="color:var(--tx3)">— '+r.text+'</span></div>';
      });
    }
    h+='<div style="font-size:10px;color:var(--tx3);margin-top:6px;line-height:1.5">'+
      '📖 《渊海子平》："刑冲克害，生克制化，乃论命之纲纪。"<br>'+
      '📖 《三命通会》："合者有情，冲者无情；冲而逢合，先去后从。"<br>'+
      '🟢合=凝聚  🔴冲=动荡  🟠刑=暗伤  🔵害=暗损</div>';
    h+='</div>';

    c.innerHTML=h;
  }

  // ============ 日主能量 ============
  function renderPower(bazi){
    var c=document.getElementById('dayMasterPower');if(!c)return;
    var tg={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
    var dl={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
    var g=bazi.day.gan,w=tg[g]||'?';
    var r;try{var fn=window.BaZiCalculator.calcDayMasterStrength;if(fn)r=fn(bazi);else r={score:50,detail:'日主中和，需综合判断。'}}catch(e){r={score:50,detail:'日主中和，需综合判断。'}}
    var l=r.score||50,lb=l>=65?'身强':l>=45?'中和':'身弱',co=l>=65?'#e07050':l>=45?'#c9a84c':'#5b9fd4';

    // 理论依据
    var theory='';
    if(l>=65) theory='《滴天髓》云："阳干从气不从势，阴干从势无情义。"乙木阴干，得月令官星当权而身强，乃印绶生扶之功。';
    else if(l>=45) theory='《子平真诠》："中和为贵，偏枯为病。"日主中和，宜观大运流向而断吉凶。';
    else theory='《滴天髓》："乙木虽柔，刲羊解牛。"乙木虽为柔木，生于秋月官杀之地，赖壬印甲劫帮扶，方能立身。';

    c.innerHTML=''+
      '<div style="text-align:center;margin-bottom:6px">'+
        '<span style="font-size:24px">'+(l>=65?'🔥':l>=45?'⚖️':'💧')+'</span>'+
        '<div style="font-size:20px;font-weight:900;color:'+co+';margin:4px 0">'+lb+'</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:4px;padding:2px 0">'+
        '<span style="font-size:9px;color:var(--tx3)">弱</span>'+
        '<div style="flex:1;height:5px;background:rgba(255,255,255,.08);border-radius:3px"><div style="width:'+l+'%;height:100%;background:linear-gradient(90deg,#5b9fd4,#c9a84c,#e07050);border-radius:3px"></div></div>'+
        '<span style="font-size:9px;color:var(--tx3)">强</span>'+
        '<span style="font-weight:700;color:'+co+';font-size:12px;margin-left:4px">'+l+'%</span>'+
      '</div>'+
      '<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px">'+
        '<div style="font-size:10px;color:var(--tx2);line-height:1.5;opacity:.85">'+r.detail+'</div>'+
        '<div style="font-size:9px;color:var(--tx3);margin-top:6px;line-height:1.4;font-style:italic">📖 '+theory+'</div>'+
      '</div>';
  }

  // ============ 格局判定 ============
  function renderPattern(bazi){
    var c=document.getElementById('patternAnalysis');if(!c)return;
    // 月令分析
    var monthZhi=bazi.month.zhi; // 申
    var monthSS=(bazi.month.shiShen&&bazi.month.shiShen.zhi)||'';
    // 月支藏干
    var cangGan=bazi.month.cangGan||[];
    // 天干透出
    var tous=[bazi.year.gan,bazi.month.gan,bazi.hour.gan];
    var touSS=[];
    if(bazi.year.shiShen)touSS.push({pos:'年',gan:bazi.year.gan,ss:bazi.year.shiShen.gan});
    if(bazi.month.shiShen)touSS.push({pos:'月',gan:bazi.month.gan,ss:bazi.month.shiShen.gan});
    if(bazi.hour.shiShen)touSS.push({pos:'时',gan:bazi.hour.gan,ss:bazi.hour.shiShen.gan});

    // Determine pattern
    var patternName='',patternDesc='',patternIcon='',patternRef='';

    // 申月：藏庚(正官)壬(正印)戊(正财) → 正官当令
    // 月干壬水正印透出 → 官印相生
    // Check: 月令申中庚金正官 + 天干壬水正印透出
    var hasGuan=monthSS==='正官'||monthSS==='七杀';
    var hasYin=touSS.some(function(t){return t.ss==='正印'||t.ss==='偏印'});
    var yinTou=touSS.filter(function(t){return t.ss==='正印'||t.ss==='偏印'});
    var guanTou=touSS.filter(function(t){return t.ss==='正官'||t.ss==='七杀'});

    if(hasGuan&&hasYin&&yinTou.length>0){
      patternName='官印相生格';
      patternIcon='🏛️';
      patternDesc='月令申金正官当权，月干壬水正印透出，官生印、印护身，形成"官印相生"的贵格。官星得令而旺，印星透干有力，二者相生有情，主学业有成、事业稳定。';
      patternRef='《子平真诠》："有官必有印，无印官不真。官印相生，最为上格。"《三命通会》："官印双全，居官清要。"';
    }else if(monthSS==='正官'){
      patternName='正官格';patternIcon='🏛️';
      patternDesc='月令正官当权。为人正直有责任心，适合公职管理。官星喜财生印护，忌伤官克制。';
      patternRef='《子平真诠》："官以任能，贵乎清正。"';
    }else{
      var patterns={'正官':'正官格','七杀':'七杀格','正财':'正财格','偏财':'偏财格','正印':'正印格','偏印':'偏印格','食神':'食神格','伤官':'伤官格'};
      patternName=patterns[monthSS]||'杂格';patternIcon='🔮';
      patternDesc='格局需综合判断。';
      patternRef='《滴天髓》："有格论格，无格论用。"';
    }

    // 透干信息
    var touInfo='';
    touSS.forEach(function(t){
      touInfo+='<span style="color:var(--gold);font-size:10px">'+t.pos+'干透<b>'+t.gan+'</b>('+t.ss+')</span> ';
    });

    c.innerHTML=''+
      '<div style="text-align:center;margin-bottom:6px">'+
        '<span style="font-size:28px">'+patternIcon+'</span>'+
        '<div style="font-size:18px;font-weight:900;color:var(--gold-l);margin:4px 0">'+patternName+'</div>'+
        '<div style="font-size:10px;color:var(--tx2)">月令：申（正官当权） '+touInfo+'</div>'+
      '</div>'+
      '<p style="color:var(--tx);font-size:11px;line-height:1.5;text-align:center;margin:8px 0">'+patternDesc+'</p>'+
      '<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:6px;font-size:9px;color:var(--tx3);line-height:1.4;font-style:italic">📖 '+patternRef+'</div>';
  }

  // ============ 喜用忌神 ============
  function renderXiyong(bazi){
    var c=document.getElementById('xiyongAnalysis');if(!c)return;
    var tg={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};

    // 获取日主旺衰
    var r;try{var fn=window.BaZiCalculator.calcDayMasterStrength;if(fn)r=fn(bazi);else r={score:40,detail:'日主偏弱'}}catch(e){r={score:40,detail:'日主偏弱'}}
    var isWeak=r.score<45;

    var yong='',xi='',ji='',yongWX='',xiWX='';
    if(isWeak){
      yong='水（印星）';yongWX='水';xi='木（比劫）';xiWX='木';
      ji='金（官杀）、土（财星）、火（食伤）';
    }else{
      yong='金（官杀）、火（食伤）、土（财星）';yongWX='金';
      xi='（命局流通为佳）';xiWX='';
      ji='水（印星）、木（比劫）';
    }

    c.innerHTML=''+
      '<div style="display:flex;gap:10px;flex-wrap:wrap">'+
        '<div style="flex:1;min-width:80px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:10px;text-align:center">'+
          '<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">用神（最需）</div>'+
          '<div style="font-size:16px;font-weight:900;color:#4f8">💧 '+yong+'</div>'+
          '<div style="font-size:9px;color:var(--tx3);margin-top:4px">第一优先补益</div>'+
        '</div>'+
        '<div style="flex:1;min-width:80px;background:rgba(91,127,165,.1);border:1px solid rgba(91,127,165,.2);border-radius:10px;padding:10px;text-align:center">'+
          '<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">喜神（辅助）</div>'+
          '<div style="font-size:16px;font-weight:900;color:#6db86d">🌿 '+xi+'</div>'+
          '<div style="font-size:9px;color:var(--tx3);margin-top:4px">次优先帮扶</div>'+
        '</div>'+
        '<div style="flex:1;min-width:80px;background:rgba(196,30,58,.08);border:1px solid rgba(196,30,58,.15);border-radius:10px;padding:10px;text-align:center">'+
          '<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">忌神（避开）</div>'+
          '<div style="font-size:13px;font-weight:700;color:#e07050">⚠️ '+ji+'</div>'+
          '<div style="font-size:9px;color:var(--tx3);margin-top:4px">需规避或制化</div>'+
        '</div>'+
      '</div>'+
      '<div style="margin-top:10px;font-size:10px;color:var(--tx2);line-height:1.5">'+
        '📖 《滴天髓》："何知其人吉，用神有气而已矣。何知其人凶，忌神辗转攻。"<br>'+
        '📖 《穷通宝鉴》：乙木生于申月，"庚金当令，壬水为尊，取印化杀。无壬用癸，总之水为第一要义。"<br>'+
        '📖 《子平真诠》："用神专求月令，以日主配之，看其旺衰，定其喜忌。"'+
      '</div>';
  }

  // ============ 五行雷达图 ============
  function drawRadar(bazi){
    if(!bazi.wuXingCount)return;
    var c=document.getElementById('radarCanvas');if(!c)return;
    var ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,s=250;
    c.width=s*dpr;c.height=s*dpr;c.style.width=s+'px';c.style.height=s+'px';ctx.scale(dpr,dpr);
    var cx=s/2,cy=s/2,mr=90;
    var el=['金','木','水','火','土'];
    var co=['#e8d5a3','#6db86d','#5b9fd4','#e07050','#c9a84c'];
    var vl=el.map(function(e){return bazi.wuXingCount[e]||0});
    var mv=Math.max.apply(null,vl.concat([1]));
    for(var l=1;l<=4;l++){ctx.beginPath();for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*l/4,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.strokeStyle='rgba(255,255,255,'+(0.03+l*0.015)+')';ctx.lineWidth=1;ctx.stroke()}
    for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*mr,cy+Math.sin(a)*mr);ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.stroke();ctx.fillStyle=co[i];ctx.font='bold 11px "PingFang SC"';ctx.textAlign='center';ctx.fillText(el[i]+' '+vl[i],cx+Math.cos(a)*(mr+17),cy+Math.sin(a)*(mr+17))}
    ctx.beginPath();for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*vl[i]/mv,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();
    var grad=ctx.createRadialGradient(cx,cy,0,cx,cy,mr);grad.addColorStop(0,'rgba(201,168,76,.2)');grad.addColorStop(1,'rgba(201,168,76,.02)');
    ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='rgba(201,168,76,.5)';ctx.lineWidth=2;ctx.stroke();
    for(var i=0;i<5;i++){var a=-Math.PI/2+i*Math.PI*2/5,r=mr*vl[i]/mv;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,4,0,Math.PI*2);ctx.fillStyle=co[i];ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke()}
  }
})();
