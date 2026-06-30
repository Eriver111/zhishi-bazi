// 杂星公式匹配器：以专业盘为标准，暴力测试各种公式
// 参数: year=2004(甲申年,yearGanIdx=0,yearZhiIdx=8), month=6(六月), hour=1(丑时)
var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var yearGanIdx=0, yearZhiIdx=8, lunarMonth=6, hour=1, isMale=true;

// 专业盘杂星位置（地支→星名）
var ref={
  巳:['天厨','劫煞','天德'],
  午:['天姚','旬空'],
  未:['红鸾','天官','台辅','副旬','寡宿'],
  申:['天贵','天巫','截空'],
  酉:['天福','副截','天空','咸池','破碎'],
  戌:['天哭'],
  亥:['天伤','孤辰'],
  子:['恩光','龙池','解神'],
  丑:['天喜','三台','八座','天使','月德'],
  寅:['天刑','凤阁','天才','天虚','年解'],
  卯:['封诰','天月','大耗','龙德'],
  辰:['天寿','蜚廉','阴煞','华盖']
};

// 已知公式（已验证）
var known={};
// 将前十二神（已验）
var JQ=['将星','攀鞍','岁驿','息神','华盖','劫煞','灾煞','天煞','指背','咸池','月煞','亡神'];
for(var ji=0;ji<12;ji++){ known[JQ[ji]]=DZ[(0+ji)%12]; }
// 岁前（已验）
var SQ=['岁建','晦气','丧门','贯索','官符','小耗','大耗','龙德','白虎','天德','吊客','病符'];
for(var si=0;si<12;si++){ known[SQ[si]]=DZ[(yearZhiIdx+si)%12]; if(si===6) known['岁破']=known['大耗']; }

// 候选公式生成器
function testStar(name, formulas){
  var targetZhi=null;
  for(var z in ref){ if(ref[z].indexOf(name)>=0){ targetZhi=z; break; } }
  if(!targetZhi||known[name]) return; // 已知或不在专业盘

  var found=false;
  formulas.forEach(function(f){
    if(found)return;
    var r=f(yearGanIdx,yearZhiIdx,lunarMonth,hour,isMale);
    if(DZ[r]===targetZhi){
      console.log('✓ '+name+' → '+targetZhi+': '+f.toString().replace(/\n/g,' ').slice(0,80));
      known[name]=targetZhi;
      found=true;
    }
  });
  if(!found) console.log('✗ '+name+' → 专业在'+targetZhi+', 候选公式均不匹配');
}

// === 候选公式库 ===

// 天姚
testStar('天姚',[
  function(g,z,m,h){ return (10+h)%12; },      // 从亥起子时顺
  function(g,z,m,h){ return (z+5)%12; },         // 年支+5
  function(g,z,m,h){ return (z+10)%12; },        // 年支+10
  function(g,z,m,h){ return (5+m)%12; },         // 月+5
  function(g,z,m,h){ return (11-m+12)%12; },     // 从亥逆数到月
  function(g,z,m,h){ return (10+g)%12; },        // 年干+10
]);

// 红鸾
testStar('红鸾',[
  function(g,z,m,h){ var t=[3,2,1,0,11,10,9,8,7,6,5,4]; return t[z]; }, // 卯起子年逆
  function(g,z,m,h){ var t=[0,11,10,9,8,7,6,5,4,3,2,1]; return t[z]; },
  function(g,z,m,h){ return (3-z+12)%12; },      // 从卯逆
  function(g,z,m,h){ return (11-z+12)%12; },     // 从亥逆
]);

// 天刑
testStar('天刑',[
  function(g,z,m,h){ return (9+m-1)%12; },        // 从酉顺数月
  function(g,z,m,h){ return (8+m-1)%12; },
  function(g,z,m,h){ return (10+m-1)%12; },
]);

// 天哭
testStar('天哭',[
  function(g,z,m,h){ return (6-h+12)%12; },       // 午起子时逆
  function(g,z,m,h){ return (6+h)%12; },           // 午起子时顺
  function(g,z,m,h){ return (z+2)%12; },           // 年支+2
  function(g,z,m,h){ return (2+m)%12; },
]);

// 天虚
testStar('天虚',[
  function(g,z,m,h){ return (6+h)%12; },
  function(g,z,m,h){ return (6-h+12)%12; },
  function(g,z,m,h){ return (z+6)%12; },
]);

// 天喜
testStar('天喜',[
  function(g,z,m,h){ return (DZ.indexOf(known['红鸾']||'?')+6)%12; },
  function(g,z,m,h){ var t=[9,8,7,6,5,4,3,2,1,0,11,10]; return t[z]; },
]);

// 旬空
testStar('旬空',[
  function(g,z,m,h){ var xk={0:[6,7],1:[8,9],2:[10,11],3:[0,1],4:[2,3],5:[4,5],6:[6,7],7:[8,9],8:[10,11],9:[0,1]}; var v=xk[g]; return v?DZ.indexOf(ref.indexOf('旬空')===-1?'?':ref['旬空']):0; },
  function(g,z,m,h){ var xk={0:7,1:9,2:11,3:1,4:3,5:5,6:7,7:9,8:11,9:1}; return xk[g]; },
  function(g,z,m,h){ return 6; }, // 午
]);

// 截空
testStar('截空',[
  function(g,z,m,h){ return (g*2+8)%12; },
  function(g,z,m,h){ var t={0:8,1:10,2:0,3:2,4:4}; return t[g]||8; },
]);

// 天厨
testStar('天厨',[
  function(g,z,m,h){ return (4+m)%12; },
  function(g,z,m,h){ return (m+3)%12; },
  function(g,z,m,h){ return (8+g)%12; },
]);

// 孤辰寡宿
testStar('孤辰',[
  function(g,z,m,h){ var t={0:11,8:11,4:11, 2:3,6:3,10:3, 5:7,9:7,1:7, 11:0,3:0,7:0}; return t[z]; },
]);
testStar('寡宿',[
  function(g,z,m,h){ var t={0:3,8:3,4:3, 2:7,6:7,10:7, 5:11,9:11,1:11, 11:5,3:5,7:5}; return t[z]; },
]);

// 龙池凤阁
testStar('龙池',[
  function(g,z,m,h){ return (z+8)%12; },
  function(g,z,m,h){ return (8+z)%12; },
]);
testStar('凤阁',[
  function(g,z,m,h){ return (z+2)%12; },
  function(g,z,m,h){ return (2+z)%12; },
]);

// 天巫
testStar('天巫',[
  function(g,z,m,h){ return (z+4)%12; },
  function(g,z,m,h){ return (8+m)%12; },
]);

// 天贵
testStar('天贵',[
  function(g,z,m,h){ return (8+g)%12; },
  function(g,z,m,h){ return (g+7)%12; },
]);

// 恩光
testStar('恩光',[
  function(g,z,m,h){ return (2+m)%12; },
  function(g,z,m,h){ return (m+1)%12; },
]);

// 天官
testStar('天官',[
  function(g,z,m,h){ return (g+6)%12; },
  function(g,z,m,h){ return (7+g)%12; },
]);

// 天福
testStar('天福',[
  function(g,z,m,h){ return (g+8)%12; },
  function(g,z,m,h){ return (9+m)%12; },
]);

// 天才
testStar('天才',[
  function(g,z,m,h){ return (z+5)%12; },
  function(g,z,m,h){ return (2+h)%12; },
]);

// 天寿
testStar('天寿',[
  function(g,z,m,h){ return (z+3)%12; },
  function(g,z,m,h){ return (4+m)%12; },
]);

// 天伤
testStar('天伤',[
  function(g,z,m,h){ return (z+10)%12; },
  function(g,z,m,h){ return (11+h)%12; },
]);

// 天使
testStar('天使',[
  function(g,z,m,h){ return (z+7)%12; },
  function(g,z,m,h){ return (8+g)%12; },
]);

// 月德
testStar('月德',[
  function(g,z,m,h){ return (g+4)%12; },
  function(g,z,m,h){ return (5+m)%12; },
]);

// 解神
testStar('解神',[
  function(g,z,m,h){ return (0+h)%12; },
  function(g,z,m,h){ return (h+2)%12; },
]);

console.log('');
console.log('=== 剩余未匹配杂星 ===');
for(var z in ref){
  ref[z].forEach(function(s){
    if(!known[s]) console.log('  '+s+' 在'+z);
  });
}
