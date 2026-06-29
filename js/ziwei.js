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

  // ============ 3. 定五行局（纳音五行） ============
  // 60甲子纳音表
  var NAYIN_60 = {
    '甲子':'金','乙丑':'金','丙寅':'火','丁卯':'火','戊辰':'木','己巳':'木',
    '庚午':'土','辛未':'土','壬申':'金','癸酉':'金','甲戌':'火','乙亥':'火',
    '丙子':'水','丁丑':'水','戊寅':'土','己卯':'土','庚辰':'金','辛巳':'金',
    '壬午':'木','癸未':'木','甲申':'水','乙酉':'水','丙戌':'土','丁亥':'土',
    '戊子':'火','己丑':'火','庚寅':'木','辛卯':'木','壬辰':'水','癸巳':'水',
    '甲午':'金','乙未':'金','丙申':'火','丁酉':'火','戊戌':'木','己亥':'木',
    '庚子':'土','辛丑':'土','壬寅':'金','癸卯':'金','甲辰':'火','乙巳':'火',
    '丙午':'水','丁未':'水','戊申':'土','己酉':'土','庚戌':'金','辛亥':'金',
    '壬子':'木','癸丑':'木','甲寅':'水','乙卯':'水','丙辰':'土','丁巳':'土',
    '戊午':'火','己未':'火','庚申':'木','辛酉':'木','壬戌':'水','癸亥':'水'
  };
  var WX_JU = { '金':0,'木':1,'水':2,'火':3,'土':4 };
  var JU_NUM=[4,3,2,6,5]; // 金4局,木3局,水2局,火6局,土5局

  function getWuxingJu(mingGan, mingZhi){
    var key=mingGan+mingZhi;
    var wx=NAYIN_60[key]||'水';
    return WX_JU[wx]!==undefined ? WX_JU[wx] : 2;
  }

  // 五行局→局数
  var JU_NUM=[4,3,2,6,5]; // 金4,木3,水2,火6,土5

  // ============ 4. 安紫微星（标准查表法） ============
  // 紫微星位置表：五行局×农历日→地支index
  var ZIWEI_TABLE = {
    '水':[2,1,0,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0],
    '木':[1,0,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11],
    '金':[0,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10],
    '火':[3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0],
    '土':[2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0,11,10,9,8,7,6,5,4,3,2,1,0]
  };
  var JU_WUXING=['金','木','水','火','土']; // ju 0=金,1=木,2=水,3=火,4=土

  function anZiwei(lunarDay, ju){
    var wx=JU_WUXING[ju]||'水';
    var table=ZIWEI_TABLE[wx];
    if(!table||lunarDay<1||lunarDay>table.length) return 2; // 默认寅宫
    return table[lunarDay-1];
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
    var ju=getWuxingJu(mingGan, mingPalace.zhi);
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
