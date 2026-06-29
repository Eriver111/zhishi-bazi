/**
 * 紫微斗数排盘引擎 v1.0
 * 依赖：lunar.js（计算农历）、ziwei-db.js（星曜数据）
 */

var ZIWEI_CALC = (function(){
  var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var TG=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];

  // ============ 1. 安命宫 & 十二宫 ============
  function anMingGong(lunarMonth, birthHour){
    // 从寅宫起正月，逆数到出生月，再从该宫顺数到出生时辰
    var yinPos=2; // 寅在DZ中index=2
    var pos=(yinPos - (lunarMonth-1) + 12) % 12;
    pos=(pos + birthHour) % 12;
    return pos; // 命宫所在地支index
  }

  // 十二宫从命宫逆时针排列
  function get12Palaces(mingPos){
    var palaces=[];
    for(var i=0;i<12;i++){
      var idx=(mingPos - i + 12) % 12;
      palaces.push({ name:ZIWEI.palaces[i].name, short:ZIWEI.palaces[i].short, zhi:DZ[idx], idx:idx });
    }
    return palaces;
  }

  // ============ 2. 定十二宫天干 ============
  function getPalaceGan(yearGanIdx, palaces){
    // 寅宫天干 = (yearGanIdx * 2 + 1) % 10
    var yinIdx=2;
    var yinGan=(yearGanIdx * 2 + 1) % 10;
    return palaces.map(function(p){
      var offset=(p.idx - yinIdx + 12) % 12;
      return TG[(yinGan + offset) % 10];
    });
  }

  // ============ 3. 定五行局 ============
  function getWuxingJu(mingGanIdx, mingZhiIdx){
    // 纳音五行局：命宫天干+地支→五行局
    var nayinMap=[
      [2,2,1,1,0,0,4,4,3,3], // 甲乙
      [0,4,2,1,3,0,4,3,1,2], // 丙丁
      [3,0,4,2,1,3,0,4,2,1], // 戊己
      [1,3,0,4,2,1,3,0,4,2], // 庚辛
      [4,2,1,3,0,4,2,1,3,0]  // 壬癸
    ];
    var row=nayinMap[mingGanIdx];
    if(!row) return 2;
    var ju=row[mingZhiIdx%10];
    return ju!==undefined?ju:2;
    // 0=金四局,1=木三局,2=水二局,3=火六局,4=土五局
  }

  // 五行局→局数
  var JU_NUM=[4,3,2,6,5]; // 金4,木3,水2,火6,土5

  // ============ 4. 安紫微星 ============
  function anZiwei(lunarDay, ju){
    var juNum=JU_NUM[ju]||2;
    var quotient=Math.floor(lunarDay / juNum);
    var remainder=lunarDay % juNum;
    if(remainder===0) remainder=juNum;
    var baseTable=[
      [1,2,3,4,5,6,7,8,9,10,11,0], // 奇数日
      [3,4,6,9,10,1,2,3,4,6,9,10]  // 余数(1-偶数日对应)
    ];
    // 简化：直接算紫微星在哪个地支位置
    var offset;
    if(remainder%2===1) offset=[0,1,0,2,3,1][remainder-1]||0;  // 奇数余
    else offset=[0,0,3,0,1,0][remainder-1]||0; // 偶数余
    if(remainder===0) offset=[0,0,0,2,0,1][juNum-1]||0;
    var ziweiPos=(2 - offset + quotient - 1 + 12) % 12; // 从寅宫(2)起
    return ziweiPos;
  }

  // ============ 5. 安十四主星 ============
  var ZIWEI_XI=['紫微','天机',' ','太阳','武曲','天同',' ','廉贞'];
  var TIANFU_XI=['天府','太阴','贪狼','巨门','天相','天梁','七杀',' ',' ',' ',' ','破军'];

  function anStars(ziweiPos){
    var positions={};
    // 紫微系
    var zOffsets={ '紫微':0,'天机':-1,'太阳':-3,'武曲':-4,'天同':-5,'廉贞':-8 };
    for(var k in zOffsets){
      var pos=(ziweiPos + zOffsets[k] + 12) % 12;
      if(k!==' ') positions[k]=pos;
    }
    // 天府在紫微的对称位
    var tianfuPos=(4 - (ziweiPos - 2) + 12) % 12;
    positions['天府']=tianfuPos;
    var tfOffsets={ '太阴':1,'贪狼':2,'巨门':3,'天相':4,'天梁':5,'七杀':6,'破军':10 };
    for(var k in tfOffsets){
      positions[k]=(tianfuPos + tfOffsets[k]) % 12;
    }
    return positions;
  }

  // ============ 6. 安辅星（简版：按年支+月+时） ============
  function anMinorStars(yearZhiIdx, lunarMonth, birthHour){
    var pos={};
    var m=lunarMonth-1;
    // 文昌
    pos['文昌']=(birthHour===0?10:birthHour-1); // 子时=戌(10),丑=亥(11),寅=子(0)...
    // 文曲
    pos['文曲']=(birthHour===0?4:birthHour+3)%12; // 简化
    // 左辅：正月起辰(4)
    pos['左辅']=(m+4)%12;
    // 右弼：正月起戌(10)
    pos['右弼']=(m+10)%12;
    // 天魁天钺按年干
    // 禄存按年干
    // 擎羊陀罗夹禄存
    // 火星铃星按年支+时
    pos['火星']=(yearZhiIdx+birthHour)%12;
    pos['铃星']=(yearZhiIdx+birthHour+6)%12;
    pos['天马']=(yearZhiIdx+6)%12;
    pos['禄存']=(yearZhiIdx*2)%12;
    pos['擎羊']=(pos['禄存']+1)%12;
    pos['陀罗']=(pos['禄存']+11)%12;
    pos['地空']=(birthHour*2)%12;
    pos['地劫']=(birthHour*2+6)%12;
    pos['天魁']=yearZhiIdx;
    pos['天钺']=(yearZhiIdx+6)%12;
    return pos;
  }

  // ============ 主入口 ============
  function calcZiwei(year, month, day, hour, isMale){
    // 用 lunar.js 转农历
    if(typeof LunarCalendar==='undefined') throw new Error('需要lunar.js');
    var lunar=LunarCalendar.solarToLunar(year,month,day);
    var lMonth=lunar.lMonth, lDay=lunar.lDay;
    if(lunar.isLeap){ /* 闰月处理略 */ }

    var yearGanIdx=(year-4)%10;
    var yearZhiIdx=(year-4)%12;
    var mingPos=anMingGong(lMonth, hour);
    var palaces=get12Palaces(mingPos);
    var palaceGans=getPalaceGan(yearGanIdx, palaces);

    // 命宫天干地支
    var mingPalace=palaces[0];
    var mingGan=palaceGans[0];
    var mingGanIdx=TG.indexOf(mingGan);
    var mingZhiIdx=DZ.indexOf(mingPalace.zhi);
    var ju=getWuxingJu(mingGanIdx, mingZhiIdx);
    var ziweiPos=anZiwei(lDay, ju);
    var starPos=anStars(ziweiPos);
    var minorPos=anMinorStars(yearZhiIdx, lMonth, hour);

    // 四化
    var yearGan=TG[yearGanIdx];
    var sihua=ZIWEI.sihua[yearGan]||{};

    // 组装结果
    var chart={};
    palaces.forEach(function(p,i){
      var gz=palaceGans[i]+p.zhi;
      var stars=[];
      for(var s in starPos){ if(starPos[s]===p.idx) stars.push(s); }
      var minors=[];
      for(var s in minorPos){ if(minorPos[s]===p.idx) minors.push(s); }
      var hua=[];
      for(var h in sihua){ if(stars.indexOf(sihua[h])>=0) hua.push(h); }
      chart[p.name]={
        ganZhi:gz, zhi:p.zhi, gan:palaceGans[i],
        stars:stars, minors:minors, hua:hua,
        meaning:ZIWEI.palaces[i].meaning
      };
    });
    return {
      chart:chart,
      mingGong:mingPalace.name,
      wuxingJu:['金四局','木三局','水二局','火六局','土五局'][ju],
      sihua:sihua,
      lunarMonth:lMonth, lunarDay:lDay
    };
  }

  return { calcZiwei:calcZiwei };
})();
