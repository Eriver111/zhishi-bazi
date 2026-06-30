// 紫微斗数 iztro 渲染引擎

var PROV_LNG={'北京':116.4,'天津':117.2,'河北':114.5,'山西':112.5,'内蒙古':111.7,'辽宁':123.4,'吉林':125.3,'黑龙江':126.6,'上海':121.5,'江苏':118.8,'浙江':120.2,'安徽':117.3,'福建':119.3,'江西':115.9,'山东':117.0,'河南':113.7,'湖北':114.3,'湖南':113.0,'广东':113.3,'广西':108.3,'海南':110.3,'重庆':106.5,'四川':104.1,'贵州':106.7,'云南':102.7,'西藏':91.1,'陕西':108.9,'甘肃':103.7,'青海':101.8,'宁夏':106.3,'新疆':87.6,'香港':114.2,'澳门':113.5,'台湾':121.5};
var CITY_LNG={'北京':{'东城':116.42,'海淀':116.30,'朝阳':116.44},'上海':{'黄浦':121.49,'浦东':121.55,'徐汇':121.44},'天津':{'和平':117.20,'河西':117.22,'南开':117.16},'重庆':{'渝中':106.57,'江北':106.58,'沙坪坝':106.46},'广州':{'越秀':113.27,'天河':113.36,'海珠':113.32},'深圳':{'罗湖':114.13,'福田':114.05,'南山':113.93},'成都':{'锦江':104.08,'武侯':104.05,'金牛':104.05},'杭州':{'上城':120.17,'西湖':120.13,'滨江':120.21},'武汉':{'江岸':114.31,'武昌':114.32,'江汉':114.27},'南京':{'玄武':118.80,'鼓楼':118.77,'秦淮':118.79},'西安':{'新城':108.96,'碑林':108.94,'雁塔':108.93},'苏州':{'姑苏':120.62,'虎丘':120.57,'吴中':120.63},'保定':{'竞秀':115.46,'莲池':115.52,'满城':115.32}};

(function(){
var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var s=document.getElementById('zwH');
for(var i=0;i<24;i++){var dzIdx=Math.floor(i/2)%12;var o=document.createElement('option');o.value=i;o.textContent=i+'点 ('+DZ[dzIdx]+'时)';if(i===8)o.selected=true;s.appendChild(o);}

var bj=new Date(Date.now()+8*60*60*1000);
function fill(id,from,to,cur){var s=document.getElementById(id);for(var i=from;i<=to;i++){var o=document.createElement('option');o.value=i;o.textContent=i;if(i===cur)o.selected=true;s.appendChild(o);}}
fill('zwY',1960,bj.getUTCFullYear(),2000);
fill('zwM',1,12,bj.getUTCMonth()+1);
fill('zwD',1,31,bj.getUTCDate());

var ps=Object.keys(REGION_DATA);
var pSel=document.getElementById('zwProv'),cSel=document.getElementById('zwCity'),dSel=document.getElementById('zwDist');
ps.forEach(function(p){var o=document.createElement('option');o.value=p;o.textContent=p;pSel.appendChild(o);});
pSel.value='广东';
function upCity(){cSel.innerHTML='';dSel.innerHTML='';var cities=REGION_DATA[pSel.value];if(!cities)return;Object.keys(cities).forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;cSel.appendChild(o);});upDist();}
function upDist(){dSel.innerHTML='';var cities=REGION_DATA[pSel.value];if(!cities)return;var dists=cities[cSel.value];if(!dists)return;dists.forEach(function(d){var o=document.createElement('option');o.value=d;o.textContent=d;dSel.appendChild(o);});}
pSel.addEventListener('change',upCity);cSel.addEventListener('change',upDist);upCity();
})();

function getTrueSolar(clockH,minute,prov,city,dist,year,month,day){
var lng=PROV_LNG[prov]||116.4;
if(city&&CITY_LNG[city]){lng=CITY_LNG[city][dist]||CITY_LNG[city][Object.keys(CITY_LNG[city])[0]]||lng;}
var offsetMin=(120-lng)*4;
var t=new Date(year,month-1,day);
var doy=Math.floor((t-new Date(year,0,0))/86400000);
var b=360/365*(doy-81);
var eot=9.87*Math.sin(2*b*Math.PI/180)-7.53*Math.cos(b*Math.PI/180)-1.5*Math.sin(b*Math.PI/180);
var totalMin=(clockH*60)+minute-offsetMin+eot;
while(totalMin<0)totalMin+=1440;totalMin%=1440;
var trueClockH=Math.floor(totalMin/60)%24,trueClockM=Math.floor(totalMin%60);
var DZ_IDX=[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11];
return {dzIdx:DZ_IDX[trueClockH],trueClockH:trueClockH,trueClockM:trueClockM};
}

function pad(n){return(n<10?'0':'')+n;}

function doPaipan(){
var y=parseInt(document.getElementById('zwY').value);
var m=parseInt(document.getElementById('zwM').value);
var d=parseInt(document.getElementById('zwD').value);
var h=parseInt(document.getElementById('zwH').value);
var min=parseInt(document.getElementById('zwMin').value)||0;
var prov=document.getElementById('zwProv').value;
var city=document.getElementById('zwCity').value;
var dist=document.getElementById('zwDist').value;
var gEls=document.getElementsByName('zwGender');
var isMale=true;for(var i=0;i<gEls.length;i++){if(gEls[i].checked)isMale=gEls[i].value==='male';}
if(isNaN(y)||isNaN(m)||isNaN(d)||isNaN(h)){alert('请填写完整出生信息');return;}

var ts=getTrueSolar(h,min,prov,city,dist,y,m,d);
var timeIndex=ts.dzIdx;
var gender=isMale?'male':'female';
var solarDate=y+'-'+m+'-'+d;

var grid=document.getElementById('zwGrid');
var svg=document.getElementById('svgLines');
var td=document.getElementById('triads');
grid.innerHTML='';svg.innerHTML='';td.innerHTML='';
document.getElementById('infoBar').innerHTML='<div class=\"loading\"><div class=\"spinner\"></div><p>排盘中...</p></div>';

setTimeout(function(){
try{
var zw=iztro.astro.bySolar(solarDate,timeIndex,gender,true,'zh-CN');
zw._birthYear=y;zw._birthMonth=m;zw._birthDay=d;
zw._clockHour=h;zw._clockMin=min;
zw._trueSolarH=ts.trueClockH;zw._trueSolarM=ts.trueClockM;
zw._timeIndex=timeIndex;
zw._isMale=isMale;

// Build mapping: earthlyBranch → palace
var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var branchToPalace={};
zw.palaces.forEach(function(p){branchToPalace[p.earthlyBranch]=p;});

// Info bar
var mingZhi=zw.earthlyBranchOfSoulPalace;
var shenZhi=zw.earthlyBranchOfBodyPalace;
var mingPal=null,shenPal='';
for(var k in branchToPalace){if(k===mingZhi)mingPal=branchToPalace[k].name;if(k===shenZhi)shenPal=branchToPalace[k].name;}
document.getElementById('infoBar').innerHTML='命宫：<b>'+mingPal+'</b> | '+zw.fiveElementsClass+' | 身宫：<b>'+shenPal+'</b> | 命主：<b>'+zw.soul+'</b> | 身主：<b>'+zw.body+'</b>'+(isMale?' | 阳男':' | 阴女');

// Grid
var gridZhiOrder=['巳','午','未','申','辰','酉','卯','戌','寅','丑','子','亥'];
var gridArea={'巳':'c12','午':'c11','未':'c10','申':'c9','辰':'c1','酉':'c8','卯':'c2','戌':'c7','寅':'c3','丑':'c4','子':'c5','亥':'c6'};
var starColor={紫微:'#e8d5a3',天府:'#e8d5a3',太阳:'#e07050',武曲:'#e8d5a3',天相:'#5b9fd4',天梁:'#6db86d',七杀:'#e07050',破军:'#e07050',贪狼:'#e8a040',巨门:'#5b9fd4',廉贞:'#e07050',天同:'#6db86d',太阴:'#5b9fd4',天机:'#6db86d'};

gridZhiOrder.forEach(function(zhi){
var p=branchToPalace[zhi];if(!p)return;
var isMing=(zhi===mingZhi),isShen=(zhi===shenZhi);
var cls='palace'+(isMing?' ming':'')+(isShen?' shen':'');

// Build star HTML
var sh='';
var huaLabel='';
// Collect四化 (mutagen on stars)
var allStars=p.majorStars.concat(p.minorStars).concat(p.adjectiveStars||[]);
allStars.forEach(function(s){
if(s.mutagen&&['禄','权','科','忌'].indexOf(s.mutagen)>=0)huaLabel+=s.mutagen;
});

// Major stars first
p.majorStars.forEach(function(s,i){
var clr=starColor[s.name]||'#d0c8b0';
var bl=s.brightness||'';
var isFirst=(i===0);
var starSpan='<span class=\"s'+(isFirst?' major':'')+'\" style=\"color:'+clr+'\">'+s.name+(bl?'<sup class=\"b\" style=\"color:'+(['庙','旺'].indexOf(bl)>=0?'#e04040':bl==='得'?'#e8a040':'#888')+'\">'+bl+'</sup>':'')+'</span>';
if(isFirst&&huaLabel){sh+='<span class=\"star-hua-wrap\">'+starSpan+'<span class=\"s\" style=\"color:#e8a040\">'+huaLabel+'</span></span>';}
else{sh+=starSpan;}
});

// Minor stars
p.minorStars.forEach(function(s){
sh+='<span class=\"s\" style=\"color:#9098a0;font-size:11px\">'+s.name+(s.brightness?'<sup class=\"b\" style=\"color:'+(['庙','旺'].indexOf(s.brightness)>=0?'#e04040':s.brightness==='得'?'#e8a040':'#888')+'\">'+s.brightness+'</sup>':'')+'</span>';
});

// Adjective stars (杂星)
(p.adjectiveStars||[]).forEach(function(s){
sh+='<span class=\"s\" style=\"color:#6a6570;font-size:11px\">'+s.name+(s.brightness?'<sup class=\"b\" style=\"color:#888\">'+s.brightness+'</sup>':'')+'</span>';
});

if(!sh)sh='<span class=\"s\" style=\"color:#555\">—</span>';

// Bottom-left:博士/将前/岁前
var blArr=[p.boshi12||'',p.jiangqian12||'',p.suiqian12||''].filter(Boolean);

// 大限 from stage or horoscope
var dx=p.stage&&p.stage.range?p.stage.range[0]+'~'+p.stage.range[1]:'';

// 小限 from ages
var xx=(p.ages||[]).slice(0,12).filter(function(a){return a<=60;}).join(',');

// 流年: compute from年支
var yearZhi=zw.chineseDate?zw.chineseDate.split(' ')[0].charAt(1):'';
var yearZhiIdx=DZ.indexOf(yearZhi);
if(yearZhiIdx<0)yearZhiIdx=8; // default申
var ln='';
for(var a=1+((DZ.indexOf(zhi)-yearZhiIdx+12)%12);a<=60;a+=12){ln+=a+',';}
ln=ln.replace(/,$/,'');

// Build cell
var cell=document.createElement('div');cell.className=cls;
cell.style.gridArea=gridArea[zhi];
cell.setAttribute('data-zhi',zhi);
var gz=p.heavenlyStem+p.earthlyBranch;
cell.innerHTML='<div class=\"stars\">'+sh+'</div><div class=\"mid\"><div class=\"row1\"><span class=\"ln-label\">流年</span>'+ln.split(',').map(function(n){return '<span>'+n+'</span>';}).join('')+'</div><div class=\"row2\"><span class=\"xx-label\">小限</span>'+xx.split(',').map(function(n){return '<span>'+n+'</span>';}).join('')+'</div><div class=\"daxian\">'+dx+'</div></div><div class=\"bot-l\">'+blArr.map(function(x){return '<span>'+x+'</span>';}).join('')+'</div><div class=\"bot-r\"><span class=\"zs\">'+(p.changsheng12||'')+'</span><span class=\"gz\">'+gz.charAt(0)+'</span><span class=\"gz\">'+gz.charAt(1)+'</span></div><div class=\"pname\">'+p.name+'</div>';
cell.addEventListener('click',function(){showTriLinks(zhi,p.name);});
grid.appendChild(cell);
});

// Center
var center=document.createElement('div');center.className='center-cell';
center.style.cssText='grid-area:2/2/4/4';
var TG2=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var yGan=TG2[(y-4)%10],yZhi=DZ[(y-4)%12];
center.innerHTML='<div class=\"c-title\">'+zw.fiveElementsClass.replace('局','')+'<br>局</div><div class=\"c-info\" style=\"font-size:9px\">'+y+'年'+m+'月'+d+'日 '+DZ[timeIndex]+'时</div><div class=\"c-info\" style=\"font-size:9px\">农历 '+yGan+yZhi+'年</div><div class=\"c-info\" style=\"font-size:9px\">真太阳时 '+pad(ts.trueClockH)+':'+pad(ts.trueClockM)+' · 钟表 '+h+':'+pad(min)+'</div><div class=\"c-info\">命主 '+zw.soul+'</div><div class=\"c-info\">身主 '+zw.body+'</div><div class=\"c-info\" style=\"color:var(--gold-l);font-size:10px;margin-top:2px\">身宫 '+shenPal+'</div>';
grid.appendChild(center);

// Triads
var td=document.getElementById('triads');
var triadsDef={
命宫:{name:'命财官线',palaces:['命宫','财帛','官禄'],summary:'事业成就与人生格局的核心轴线'},
兄弟:{name:'兄疾田线',palaces:['兄弟','疾厄','田宅'],summary:'家庭健康与内在安全感的根基'},
夫妻:{name:'夫子友线',palaces:['夫妻','子女','仆役'],summary:'婚姻子息与人际关系的情感世界'},
子女:{name:'迁福母线',palaces:['迁移','福德','父母'],summary:'外出发展与精神福报的外在支持'}
};
for(var tk in triadsDef){
var t=triadsDef[tk];
var card=document.createElement('div');card.className='triad-card';
card.innerHTML='<div class=\"t-name\">'+t.name+'</div><div class=\"t-palaces\">'+t.palaces.join(' · ')+'</div><div class=\"t-summary\">'+t.summary+'</div>';
td.appendChild(card);
}

}catch(e){console.error(e);document.getElementById('infoBar').innerHTML='<p style=\"color:#e07050\">排盘失败: '+e.message+'</p>';}
},50);
}

// Tri-link
var triadsGroup={0:[0,4,8],1:[1,5,9],2:[2,6,10],3:[3,7,11]};
var DZ3=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
window.showTriLinks=function(zhi){
var allCells=document.querySelectorAll('.palace');
allCells.forEach(function(el){el.classList.remove('hl','hl2');});
var zhiIdx=DZ3.indexOf(zhi);
var oppIdx=(zhiIdx+6)%12;
var triadGroup=triadsGroup[zhiIdx%4];
allCells.forEach(function(el){
var cellZhi=el.getAttribute('data-zhi');
if(!cellZhi)return;
var ci=DZ3.indexOf(cellZhi);
if(ci===zhiIdx)el.classList.add('hl');
else if(triadGroup.indexOf(ci)>=0)el.classList.add('hl');
else if(ci===oppIdx)el.classList.add('hl2');
});
drawTriLines(zhiIdx,triadGroup,oppIdx);
};
function drawTriLines(ci,triad,opp){
var svg=document.getElementById('svgLines');
var gr=document.getElementById('zwGrid').getBoundingClientRect();
function cp(z){var el=document.querySelector('.palace[data-zhi=\"'+DZ3[z]+'\"]');if(!el)return null;var r=el.getBoundingClientRect();return{x:r.left+r.width/2-gr.left,y:r.top+r.height/2-gr.top};}
svg.setAttribute('viewBox','0 0 '+gr.width+' '+gr.height);
svg.style.width=gr.width+'px';svg.style.height=gr.height+'px';
var html='';var cpp=cp(ci);if(!cpp)return;
triad.forEach(function(t){if(t===ci)return;var tp=cp(t);if(tp)html+='<line x1=\"'+cpp.x+'\" y1=\"'+cpp.y+'\" x2=\"'+tp.x+'\" y2=\"'+tp.y+'\"/>';});
var op=cp(opp);if(op)html+='<line class=\"opp\" x1=\"'+cpp.x+'\" y1=\"'+cpp.y+'\" x2=\"'+op.x+'\" y2=\"'+op.y+'\"/>';
svg.innerHTML=html;
}
