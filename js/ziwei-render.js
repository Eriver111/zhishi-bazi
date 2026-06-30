var PROV_LNG={'北京':116.4,'天津':117.2,'河北':114.5,'山西':112.5,'内蒙古':111.7,'辽宁':123.4,'吉林':125.3,'黑龙江':126.6,'上海':121.5,'江苏':118.8,'浙江':120.2,'安徽':117.3,'福建':119.3,'江西':115.9,'山东':117.0,'河南':113.7,'湖北':114.3,'湖南':113.0,'广东':113.3,'广西':108.3,'海南':110.3,'重庆':106.5,'四川':104.1,'贵州':106.7,'云南':102.7,'西藏':91.1,'陕西':108.9,'甘肃':103.7,'青海':101.8,'宁夏':106.3,'新疆':87.6,'香港':114.2,'澳门':113.5,'台湾':121.5};
var CITY_LNG={'北京':{'东城':116.42,'海淀':116.30,'朝阳':116.44},'上海':{'黄浦':121.49,'浦东':121.55,'徐汇':121.44},'天津':{'和平':117.20,'河西':117.22,'南开':117.16},'重庆':{'渝中':106.57,'江北':106.58,'沙坪坝':106.46},'广州':{'越秀':113.27,'天河':113.36,'海珠':113.32},'深圳':{'罗湖':114.13,'福田':114.05,'南山':113.93},'成都':{'锦江':104.08,'武侯':104.05,'金牛':104.05},'武汉':{'江岸':114.31,'武昌':114.32,'江汉':114.27},'苏州':{'姑苏':120.62,'虎丘':120.57,'吴中':120.63},'保定':{'竞秀':115.46,'莲池':115.52,'满城':115.32}};
function pad(n){return(n<10?'0':'')+n;}
var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var TG=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];

(function(){
// Province/city/district init only (other fields are now number inputs)
var bj=new Date(Date.now()+8*60*60*1000);
var ps=Object.keys(REGION_DATA),pSel=document.getElementById('zwProv'),cSel=document.getElementById('zwCity'),dSel=document.getElementById('zwDist');
ps.forEach(function(p){var o=document.createElement('option');o.value=p;o.textContent=p;pSel.appendChild(o);});function upCity(){cSel.innerHTML='';dSel.innerHTML='';var cities=REGION_DATA[pSel.value];if(!cities)return;Object.keys(cities).forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;cSel.appendChild(o);});upDist();}
function upDist(){dSel.innerHTML='';var cities=REGION_DATA[pSel.value];if(!cities)return;var dists=cities[cSel.value];if(!dists)return;dists.forEach(function(d){var o=document.createElement('option');o.value=d;o.textContent=d;dSel.appendChild(o);});}
pSel.addEventListener('change',upCity);cSel.addEventListener('change',upDist);upCity();
})();

function getTrueSolar(ch,m,prov,city,dist,y,mo,d){
var lng=PROV_LNG[prov]||116.4;
if(city&&CITY_LNG[city]){lng=CITY_LNG[city][dist]||CITY_LNG[city][Object.keys(CITY_LNG[city])[0]]||lng;}
var om=Math.round((120-lng)*4);
var t=new Date(y,mo-1,d),doy=Math.floor((t-new Date(y,0,0))/86400000);
var b=360/365*(doy-81);
var eot=9.87*Math.sin(2*b*Math.PI/180)-7.53*Math.cos(b*Math.PI/180)-1.5*Math.sin(b*Math.PI/180);
var tm=ch*60+m-om+eot;while(tm<0)tm+=1440;tm%=1440;
var th=Math.floor(tm/60)%24,tm2=Math.floor(tm%60);
var DZ_IDX=[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11];
return{dzIdx:DZ_IDX[th],th:th,tm:tm2};
}

function doPaipan(){
var y=+document.getElementById('zwY').value,m=+document.getElementById('zwM').value,d=+document.getElementById('zwD').value;
var h=+document.getElementById('zwH').value,min=+document.getElementById('zwMin').value||0;
if(isNaN(y)||isNaN(m)||isNaN(d)||isNaN(h)){alert('请填写完整出生信息');return;}
var prov=document.getElementById('zwProv').value,city=document.getElementById('zwCity').value,dist=document.getElementById('zwDist').value;
var gEls=document.getElementsByName('zwGender'),isMale=true;
for(var i=0;i<gEls.length;i++){if(gEls[i].checked)isMale=gEls[i].value==='male';}
if(isNaN(y)||isNaN(m)||isNaN(d)||h===''||h===undefined||isNaN(h)){alert('请填写完整出生信息');return;}

var ts=getTrueSolar(h,min,prov,city,dist,y,m,d);
var ti=ts.dzIdx,gender=isMale?'male':'female';
var zi=iztro.astro.bySolar(y+'-'+m+'-'+d,ti,gender,true,'zh-CN');

// Build map
var b2p={};zi.palaces.forEach(function(p){b2p[p.earthlyBranch]=p;});
var mingZhi=zi.earthlyBranchOfSoulPalace,shenZhi=zi.earthlyBranchOfBodyPalace;
var mingPal=b2p[mingZhi]?b2p[mingZhi].name:'',shenPal=b2p[shenZhi]?b2p[shenZhi].name:'';
document.getElementById('infoBar').innerHTML='命宫：<b>'+mingPal+'</b> | '+zi.fiveElementsClass+' | 身宫：<b>'+shenPal+'</b> | 命主：<b>'+zi.soul+'</b> | 身主：<b>'+zi.body+'</b>'+(isMale?' | 阳男':' | 阴女');

// Render 12 palaces
var order=['巳','午','未','申','辰','酉','卯','戌','寅','丑','子','亥'];
var rc={'巳':'1/1','午':'1/2','未':'1/3','申':'1/4','辰':'2/1','酉':'2/4','卯':'3/1','戌':'3/4','寅':'4/1','丑':'4/2','子':'4/3','亥':'4/4'};
var sc={紫微:'#e8d5a3',天府:'#e8d5a3',太阳:'#e07050',武曲:'#e8d5a3',天相:'#5b9fd4',天梁:'#6db86d',七杀:'#e07050',破军:'#e07050',贪狼:'#e8a040',巨门:'#5b9fd4',廉贞:'#e07050',天同:'#6db86d',太阴:'#5b9fd4',天机:'#6db86d'};
var grid=document.getElementById('zwGrid');grid.innerHTML='';
document.getElementById('svgLines').innerHTML='';
document.getElementById('triads').innerHTML='';

order.forEach(function(zhi){
var p=b2p[zhi];if(!p)return;
var isMing=zhi===mingZhi,isShen=zhi===shenZhi;
var cell=document.createElement('div');
cell.className='palace'+(isMing?' ming':'')+(isShen?' shen':'');

var parts=rc[zhi].split('/');
cell.style.gridRow=parts[0];cell.style.gridColumn=parts[1];
cell.setAttribute('data-zhi',zhi);

// Star HTML
var sh='',hl='';
(p.majorStars||[]).forEach(function(s,i){
if(s.mutagen&&['禄','权','科','忌'].indexOf(s.mutagen)>=0)hl+=s.mutagen;
var c=sc[s.name]||'#d0c8b0',bl=s.brightness||'';
var bt=bl?'<sup class=\"b\" style=\"color:'+(['庙','旺'].indexOf(bl)>=0?'#e04040':bl==='得'?'#e8a040':'#888')+'\">'+bl+'</sup>':'';
sh+='<span class=\"s'+(i===0?' major':'')+'\" style=\"color:'+c+'\">'+s.name+bt+(i===0&&hl?'<br>'+hl:'')+'</span>';
});
(p.minorStars||[]).forEach(function(s){
var bl=s.brightness||'',bt=bl?'<sup class=\"b\" style=\"color:#888\">'+bl+'</sup>':'';
sh+='<span class=\"s\" style=\"color:#9098a0;font-size:11px\">'+s.name+bt+'</span>';
});
(p.adjectiveStars||[]).forEach(function(s){
sh+='<span class=\"s\" style=\"color:#6a6570;font-size:11px\">'+s.name+'</span>';
});
if(!sh)sh='<span class=\"s\" style=\"color:#555\">—</span>';

var bl=[p.boshi12||'',p.jiangqian12||'',p.suiqian12||''].filter(Boolean);
var dx=p.decadal&&p.decadal.range?p.decadal.range[0]+'~'+p.decadal.range[1]:'';
var xx=(p.ages||[]).slice(0,8).filter(function(a){return a<=60;}).join(',');
var gz=p.heavenlyStem+p.earthlyBranch;

cell.innerHTML='<div class=\"stars\">'+sh+'</div><div class=\"mid\"><div class=\"row2\"><span class=\"xx-label\">小限</span>'+xx.split(',').map(function(n){return '<span>'+n+'</span>';}).join('')+'</div><div class=\"daxian\">'+dx+'</div></div><div class=\"bot-l\">'+bl.map(function(x){return '<span>'+x+'</span>';}).join('')+'</div><div class=\"bot-r\"><span class=\"zs\">'+(p.changsheng12||'')+'</span><span class=\"gz\">'+gz.charAt(0)+'</span><span class=\"gz\">'+gz.charAt(1)+'</span></div><div class=\"pname\">'+p.name+'</div>';
cell.addEventListener('click',function(){showTriLinks(zhi,p.name);});
grid.appendChild(cell);
});

// Center
var center=document.createElement('div');center.className='center-cell';
center.style.gridRow='2/4';center.style.gridColumn='2/4';
var yGan=TG[(y-4)%10],yZhi=DZ[(y-4)%12];
center.innerHTML='<div class=\"c-title\">'+zi.fiveElementsClass.replace('局','')+'<br>局</div><div class=\"c-info\" style=\"font-size:9px\">'+y+'年'+m+'月'+d+'日 '+DZ[ti]+'时</div><div class=\"c-info\" style=\"font-size:9px\">农历 '+yGan+yZhi+'年</div><div class=\"c-info\" style=\"font-size:9px\">真太阳时 '+pad(ts.th)+':'+pad(ts.tm)+' · 钟表 '+h+':'+pad(min)+'</div><div class=\"c-info\">命主 '+zi.soul+'</div><div class=\"c-info\">身主 '+zi.body+'</div><div class=\"c-info\" style=\"color:var(--gold-l);font-size:10px;margin-top:2px\">身宫 '+shenPal+'</div>';
grid.appendChild(center);

// Triads
var td=document.getElementById('triads');
[{name:'命财官线',p:'命宫 · 财帛 · 官禄',s:'事业成就与人生格局的核心轴线'},{name:'兄疾田线',p:'兄弟 · 疾厄 · 田宅',s:'家庭健康与内在安全感的根基'},{name:'夫子友线',p:'夫妻 · 子女 · 仆役',s:'婚姻子息与人际关系的情感世界'},{name:'迁福母线',p:'迁移 · 福德 · 父母',s:'外出发展与精神福报的外在支持'}].forEach(function(t){
var card=document.createElement('div');card.className='triad-card';
card.innerHTML='<div class=\"t-name\">'+t.name+'</div><div class=\"t-palaces\">'+t.p+'</div><div class=\"t-summary\">'+t.s+'</div>';
td.appendChild(card);
});
}

// Tri-link
var triadsGroup={0:[0,4,8],1:[1,5,9],2:[2,6,10],3:[3,7,11]};
window.showTriLinks=function(zhi){
var all=document.querySelectorAll('.palace');all.forEach(function(el){el.classList.remove('hl','hl2');});
var zi=DZ.indexOf(zhi),opp=(zi+6)%12,tg=triadsGroup[zi%4];
all.forEach(function(el){var cz=el.getAttribute('data-zhi');if(!cz)return;var ci=DZ.indexOf(cz);if(ci===zi)el.classList.add('hl');else if(tg.indexOf(ci)>=0)el.classList.add('hl');else if(ci===opp)el.classList.add('hl2');});
drawLines(zi,tg,opp);
};
function drawLines(ci,tg,opp){
var svg=document.getElementById('svgLines'),gr=document.getElementById('zwGrid').getBoundingClientRect();
function cp(z){var el=document.querySelector('.palace[data-zhi=\"'+DZ[z]+'\"]');if(!el)return null;var r=el.getBoundingClientRect();return{x:r.left+r.width/2-gr.left,y:r.top+r.height/2-gr.top};}
svg.setAttribute('viewBox','0 0 '+gr.width+' '+gr.height);svg.style.width=gr.width+'px';svg.style.height=gr.height+'px';
var h='',cpp=cp(ci);if(!cpp)return;
tg.forEach(function(t){if(t===ci)return;var tp=cp(t);if(tp)h+='<line x1=\"'+cpp.x+'\" y1=\"'+cpp.y+'\" x2=\"'+tp.x+'\" y2=\"'+tp.y+'\"/>';});
var op=cp(opp);if(op)h+='<line class=\"opp\" x1=\"'+cpp.x+'\" y1=\"'+cpp.y+'\" x2=\"'+op.x+'\" y2=\"'+op.y+'\"/>';
svg.innerHTML=h;
}
