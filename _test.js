
// 初始化时辰下拉
(function(){
  var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var sel=document.getElementById('zwH');
  for(var i=0;i<12;i++){ var o=document.createElement('option');o.value=i;o.textContent=DZ[i]+'时('+(i*2)+'-'+(i*2+2)+'点)';if(i===1)o.selected=true;sel.appendChild(o); }
})();

function doPaipan(){
  var y=parseInt(document.getElementById('zwY').value);
  var m=parseInt(document.getElementById('zwM').value);
  var d=parseInt(document.getElementById('zwD').value);
  var h=parseInt(document.getElementById('zwH').value);
  var min=parseInt(document.getElementById('zwMin').value)||0;
  var isMale=document.getElementById('zwG').value==='male';

  // Clear previous
  document.getElementById('zwGrid').innerHTML='';
  document.getElementById('svgLines').innerHTML='';
  document.getElementById('triads').innerHTML='';
  document.getElementById('infoBar').innerHTML='<div class=\"loading\"><div class=\"spinner\"></div><p>排盘中...</p></div>';

  setTimeout(function(){
  try{
  var zw=ZIWEI_CALC.calcZiwei(y,m,d,h,isMale);
  // 附带到渲染参数
  zw._birthYear=y; zw._birthMonth=m; zw._birthDay=d; zw._birthHour=h; zw._birthMin=min; zw._isMale=isMale;
  renderChart(zw);
  }catch(e){
    document.getElementById('infoBar').innerHTML='<p style=\"color:#e07050\">排盘失败: '+e.message+'</p>';
  }
  },50);
}

// 初始加载
setTimeout(function(){ doPaipan(); },100);

function renderChart(zw){
  var chart=zw.chart;
  document.getElementById('infoBar').innerHTML='命宫：<b>'+zw.mingGong+'</b> | '+zw.wuxingJu+' | 身宫：<b>'+(zw.shenGong||'—')+'</b> | 命主：<b>'+zw.mingZhu+'</b> | 身主：<b>'+zw.shenZhu+'</b>'+(zw.isMale!==false?' | 阳男':' | 阴女');

(function(){
var zw2=zw, chart2=chart;
var chart=zw.chart;
document.getElementById('infoBar').innerHTML='命宫：<b>'+zw.mingGong+'</b> | '+zw.wuxingJu+' | 身宫：<b>'+(zw.shenGong||'—')+'</b> | 命主：<b>'+zw.mingZhu+'</b> | 身主：<b>'+zw.shenZhu+'</b> | 阳男 | 甲申年六月廿九丑时';

var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var gridZhiOrder=['巳','午','未','申','辰','酉','卯','戌','寅','丑','子','亥'];

var palaceOrder=['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'];
var zhiToPalace={};
palaceOrder.forEach(function(name){ zhiToPalace[chart[name].zhi]=chart[name];zhiToPalace[chart[name].zhi]._name=name; });

var gridArea={'巳':'c12','午':'c11','未':'c10','申':'c9','辰':'c1','酉':'c8','卯':'c2','戌':'c7','寅':'c3','丑':'c4','子':'c5','亥':'c6'};
var starColor={紫微:'#e8d5a3',天府:'#e8d5a3',太阳:'#e07050',武曲:'#e8d5a3',天相:'#5b9fd4',天梁:'#6db86d',七杀:'#e07050',破军:'#e07050',贪狼:'#e8a040',巨门:'#5b9fd4',廉贞:'#e07050',天同:'#6db86d',太阴:'#5b9fd4',天机:'#6db86d'};
var brightLabel=['','庙','旺','得','平','不','陷'];
var grid=document.getElementById('zwGrid');

gridZhiOrder.forEach(function(zhi){
  var p=zhiToPalace[zhi]; if(!p) return;
  var isMing=p._name==='命宫',isShen=p._name===zw.shenGong;
  var cls='palace'+(isMing?' ming':'')+(isShen?' shen':'');

  // 星曜左列：主星+辅星+杂星 竖排
  var sh='';
  var huaLabel='';
  if(p.hua.length){ var lb={lu:'禄',quan:'权',ke:'科',ji:'忌'}; huaLabel=p.hua.map(function(h){return lb[h]||h;}).join(''); }
  if(p.starInfo&&p.starInfo.length){
    p.starInfo.forEach(function(si,i){
      var bl=si.bright>0?brightLabel[si.bright]:'';
      var clr=starColor[si.name]||'#d0c8b0';
      var isFirst=(i===0);
      var starSpan='<span class="s'+(i===0?' major':'')+'" style="color:'+clr+'">'+si.name+(bl?'<sup class="b" style="color:'+(si.bright<=2?'#e04040':si.bright===3?'#e8a040':'#888')+'">'+bl+'</sup>':'')+'</span>';
      if(isFirst&&huaLabel){
        sh+='<span class=\"star-hua-wrap\">'+starSpan+'<span class=\"s\" style=\"color:#e8a040\">'+huaLabel+'</span></span>';
      } else {
        sh+=starSpan;
      }
    });
  }
  // 辅星+亮度
  if(p.minors.length){ sh+=p.minors.map(function(m){
    var bTable=ZIWEI.minorBright[m];
    var bLevel=bTable?bTable[['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].indexOf(p.zhi)]:0;
    var bl=bLevel>0?brightLabel[bLevel]:'';
    return '<span class="s" style="color:#9098a0;font-size:15px">'+m+(bl?'<sup class="b" style="color:'+(bLevel<=2?'#e04040':bLevel===3?'#e8a040':'#888')+'">'+bl+'</sup>':'')+'</span>';
  }).join('');}
  // 杂星
  // 杂星+亮度
  if(p.zaXing&&p.zaXing.length){ sh+=p.zaXing.map(function(zx){
    var zTable=ZIWEI.zaBright[zx];
    var zLevel=zTable?zTable[['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].indexOf(p.zhi)]:0;
    var zl=zLevel>0?brightLabel[zLevel]:'';
    return '<span class="s" style="color:#6a6570;font-size:15px">'+zx+(zl?'<sup class="b" style="color:'+(zLevel<=2?'#e04040':zLevel===3?'#e8a040':'#888')+'">'+zl+'</sup>':'')+'</span>';
  }).join('');}
  if(!sh) sh='<span class="s" style="color:#555">—</span>';

  // 左下：博士 + 将前 + 岁前
  var blArr=[p.boShi||'',p.jiangQian||'',p.suiQian||''].filter(Boolean);

  var cell=document.createElement('div');cell.style.gridArea=gridArea[zhi];cell.className=cls;
  var gz=(p.gan||'')+p.zhi;
  cell.innerHTML=
    '<div class="stars">'+sh+'</div>'+
    '<div class="mid">'+
      '<div class="row1"><span class="ln-label">流年</span>'+(p.liuNian||'').split(',').map(function(n){return '<span>'+n+'</span>';}).join('')+'</div>'+
      '<div class="row2"><span class="xx-label">小限</span>'+(p.xiaoXian||'').split(',').map(function(n){return '<span>'+n+'</span>';}).join('')+'</div>'+
      '<div class="daxian">'+(p.daXian||'')+'</div>'+
    '</div>'+
    '<div class="bot-l">'+blArr.map(function(x){return '<span>'+x+'</span>';}).join('')+'</div>'+
    '<div class="bot-r"><span class="zs">'+(p.changSheng||'')+'</span><span class="gz">'+gz.charAt(0)+'</span><span class="gz">'+gz.charAt(1)+'</span></div>'+
    '<div class="pname">'+p._name+'</div>';
  cell.addEventListener('click',function(){showTriLinks(zhi,p._name);});
  cell.addEventListener('click',function(){showTriLinks(zhi,p._name);});
  grid.appendChild(cell);
});

// Central cell
var center=document.createElement('div');center.className='center-cell';
center.style.cssText='grid-area:2/2/4/4';
var DZ2=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var TG2=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var lunar=LunarCalendar.solarToLunar(zw._birthYear,zw._birthMonth,zw._birthDay);
var lGan=TG2[(zw._birthYear-4)%10], lZhi=DZ2[(zw._birthYear-4)%12];
var clockH=zw._birthHour, clockM=zw._birthMin||0;
// 真太阳时简化计算
var t=new Date(zw._birthYear,zw._birthMonth-1,zw._birthDay);
var doy=Math.floor((t-new Date(zw._birthYear,0,0))/86400000);
var b=360/365*(doy-81);
var eot=9.87*Math.sin(2*b*Math.PI/180)-7.53*Math.cos(b*Math.PI/180)-1.5*Math.sin(b*Math.PI/180);
var totalMin=clockH*60+clockM+Math.round(eot);
while(totalMin<0)totalMin+=1440;totalMin%=1440;
var trueH=Math.floor(totalMin/60)%24,trueM=totalMin%60;
var trueDZIdx=[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11][trueH];
center.innerHTML=
  '<div class="c-title">'+zw.wuxingJu.replace('局','')+'<br>局</div>'+
  '<div class="c-info" style="font-size:9px">'+zw._birthYear+'年'+zw._birthMonth+'月'+zw._birthDay+'日 '+DZ2[zw._birthHour]+'时</div>'+
  '<div class="c-info" style="font-size:9px">农历 '+lGan+lZhi+'年'+lunar.lMonth+'月'+lunar.lDay+'日</div>'+
  '<div class="c-info" style="font-size:9px">真太阳时 '+(trueH<10?\"0\":\"\")+trueH+':'+(trueM<10?\"0\":\"\")+trueM+' · 钟表 '+clockH+':'+(clockM<10?\"0\":\"\")+clockM+'</div>'+
  '<div class="c-info">命主 '+zw.mingZhu+'</div>'+
  '<div class="c-info">身主 '+zw.shenZhu+'</div>'+
  '<div class="c-info" style="color:#e8cf70;font-size:10px;margin-top:2px">身宫 '+zw.shenGong+'</div>'+
  '<div class="c-info" style="font-size:9px">子斗 '+zw.ziDou+'</div>';
grid.appendChild(center);

// === 三方四正连线 ===
var DZ_=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var triadsGroup={0:[0,4,8],1:[1,5,9],2:[2,6,10],3:[3,7,11]}; // 地支三合组

function showTriLinks(zhi,palName){
  var allCells=document.querySelectorAll('.palace');
  allCells.forEach(function(el){el.classList.remove('hl','hl2');});

  // Highlight all三合+对宫 cells
  var zhiIdx=DZ_.indexOf(zhi);
  var oppIdx=(zhiIdx+6)%12;
  var triadGroup=triadsGroup[zhiIdx%4];
  var oppGroup=triadsGroup[oppIdx%4];

  allCells.forEach(function(el){
    var cellZhi=el.dataset.zhi;
    if(!cellZhi)return;
    var ci=DZ_.indexOf(cellZhi);
    if(ci===zhiIdx)el.classList.add('hl');
    else if(ci===oppIdx||triadGroup.indexOf(ci)>=0)el.classList.add('hl');
    else if(oppGroup.indexOf(ci)>=0)el.classList.add('hl2');
  });

  // Draw lines
  drawTriLines(zhiIdx,triadGroup,oppIdx);
}

function drawTriLines(center,triad,opp){
  var svg=document.getElementById('svgLines');
  var grid=document.getElementById('zwGrid');
  var gr=grid.getBoundingClientRect();

  // Get center positions of all relevant cells
  function centerPos(zhi){
    var el=document.querySelector('.palace[data-zhi="'+DZ_[zhi]+'"]');
    if(!el)return null;
    var r=el.getBoundingClientRect();
    return {x:r.left+r.width/2-gr.left, y:r.top+r.height/2-gr.top};
  }

  svg.setAttribute('viewBox','0 0 '+gr.width+' '+gr.height);
  svg.style.width=gr.width+'px';
  svg.style.height=gr.height+'px';

  var html='';
  var cp=centerPos(center);
  if(!cp)return;

  // Lines to三合 partners
  triad.forEach(function(t){
    if(t===center)return;
    var tp=centerPos(t);
    if(tp) html+='<line x1="'+cp.x+'" y1="'+cp.y+'" x2="'+tp.x+'" y2="'+tp.y+'"/>';
  });
  // Line to对宫
  var op=centerPos(opp);
  if(op) html+='<line class="opp" x1="'+cp.x+'" y1="'+cp.y+'" x2="'+op.x+'" y2="'+op.y+'"/>';

  svg.innerHTML=html;
}

// Set data-zhi attributes after grid renders
setTimeout(function(){
  var cells=document.querySelectorAll('.palace');
  var gridOrder=['巳','午','未','申','辰','酉','卯','戌','寅','丑','子','亥'];
  cells.forEach(function(el,i){
    if(i<gridOrder.length)el.dataset.zhi=gridOrder[i];
  });
},100);

// 中央
var center=document.createElement('div');center.className='center-cell';
center.style.cssText='grid-area:2/2/4/4';
center.innerHTML=
  '<div class="c-title">'+zw.wuxingJu.replace('局','')+'<br>局</div>'+'<div class="c-info" style="font-size:9px">2004年8月14日 丑时</div>'+'<div class="c-info" style="font-size:9px">农历 甲申年六月廿九</div>'+'<div class="c-info" style="font-size:9px">真太阳时 1:53 · 钟表 2:16</div>'+
  '<div class="c-info">命主 '+zw.mingZhu+'</div>'+
  '<div class="c-info">身主 '+zw.shenZhu+'</div>'+
  '<div class="c-info" style="color:#e8cf70;font-size:10px;margin-top:2px">身宫 '+zw.shenGong+'</div>'+'<div class="c-info" style="font-size:9px">子斗 '+zw.ziDou+'</div>';
grid.appendChild(center);

// 三方四正
var td=document.getElementById('triads');
zw.triads.forEach(function(t){
  var card=document.createElement('div');card.className='triad-card';
  card.innerHTML='<div class="t-name">'+t.name+'</div><div class="t-palaces">'+t.palaces+'</div><div class="t-summary">'+t.summary+'</div>';
  td.appendChild(card);
});
})(); // end renderChart IIFE
}
