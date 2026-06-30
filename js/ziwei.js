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
    var pos=(yinPos + (lunarMonth-1)) % 12;
    pos=(pos - birthHour + 12) % 12;
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
    var yinGan=(yearGanIdx * 2 + 2) % 10;
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
    '水':[2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6,7],
    '木':[1,2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6],
    '金':[0,1,2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5],
    '火':[3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6,7,8],
    '土':[2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5,6,7]
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
    var tianfuPos=(4 - ziweiPos + 12) % 12; // 天府=寅+寅-紫微
    positions['天府']=tianfuPos;
    var tfOffsets={ '太阴':1,'贪狼':2,'巨门':3,'天相':4,'天梁':5,'七杀':6,'破军':10 };
    for(var k in tfOffsets){
      positions[k]=(tianfuPos + tfOffsets[k]) % 12;
    }
    return positions;
  }

  // ============ 6. 安辅星 ============
  function anMinorStars(yearGanIdx, yearZhiIdx, lunarMonth, birthHour){
    var pos={};
    // 文昌：从戌(10)起子时，逆数到时
    pos['文昌']=(10 - birthHour + 12) % 12;
    // 文曲：从辰(4)起子时，顺数到时
    pos['文曲']=(4 + birthHour) % 12;
    // 左辅：正月起辰(4)，顺数到月
    pos['左辅']=(4 + lunarMonth - 1) % 12;
    // 右弼：正月起戌(10)，逆数到月
    pos['右弼']=(10 - (lunarMonth - 1) + 12) % 12;
    // 天魁天钺：按年干
    var kuiMap={0:1,1:0,2:11,3:11,4:1,5:0,6:7,7:6,8:3,9:3};
    var yueMap={0:7,1:0,2:0,3:11,4:7,5:6,6:1,7:0,8:9,9:9};
    pos['天魁']=kuiMap[yearGanIdx]!==undefined?kuiMap[yearGanIdx]:0;
    pos['天钺']=yueMap[yearGanIdx]!==undefined?yueMap[yearGanIdx]:6;
    // 禄存：按年干
    var lcMap={0:2,1:3,2:5,3:6,4:5,5:6,6:8,7:9,8:11,9:0};
    pos['禄存']=lcMap[yearGanIdx]!==undefined?lcMap[yearGanIdx]:2;
    // 擎羊在禄存前一位，陀罗在禄存后一位
    pos['擎羊']=(pos['禄存']+1)%12;
    pos['陀罗']=(pos['禄存']+11)%12;
    // 火星：按年支分组起子时顺数（申子辰从寅，寅午戌从巳，巳酉丑从申，亥卯未从亥）
    var huoStart={0:2,8:2,4:2, 2:5,6:5,10:5, 5:8,9:8,1:8, 11:11,3:11,7:11};
    pos['火星']=((huoStart[yearZhiIdx]||2) + birthHour) % 12;
    // 铃星：按年支分组起子时顺数（申子辰从戌，寅午戌从巳，巳酉丑从申，亥卯未从亥）
    var lingStart={0:10,8:10,4:10, 2:5,6:5,10:5, 5:8,9:8,1:8, 11:11,3:11,7:11};
    pos['铃星']=((lingStart[yearZhiIdx]||10) + birthHour) % 12;
    // 天马：按年支
    var tmMap={0:2,1:11,2:8,3:5,4:2,5:11,6:8,7:5,8:2,9:11,10:8,11:5};
    pos['天马']=tmMap[yearZhiIdx]||2;
    // 地空：从亥(11)起子时，逆数到时
    pos['地空']=(11 - birthHour + 12) % 12;
    // 地劫：从亥(11)起子时，顺数到时
    pos['地劫']=(11 + birthHour) % 12;
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
    var minorPos=anMinorStars(yearGanIdx, yearZhiIdx, lMonth, hour);

    // 四化
    var yearGan=TG[yearGanIdx];
    var sihua=ZIWEI.sihua[yearGan]||{};

    // 长生十二神：五行局定起点(金巳木亥水申火寅土申)，阳男阴女顺行/阴男阳女逆行
    var CHANG_SHENG=['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
    var csStart={0:5,1:11,2:8,3:2,4:8};
    var csBegin=csStart[ju]||8;
    var isYG='甲丙戊庚壬'.indexOf(TG[yearGanIdx])>=0;
    var csForward=(isYG&&isMale)||(!isYG&&!isMale);
    var changShengByZhi={};
    for(var ci=0;ci<12;ci++){
      var zhiIdx=(csBegin + (csForward?ci:-ci) + 12) % 12;
      changShengByZhi[DZ[zhiIdx]]=CHANG_SHENG[ci];
    }

    // 博士十二神：从禄存宫起博士，顺行
    var BOSHI=['博士','力士','青龙','小耗','将军','奏书','飞廉','喜神','病符','大耗','伏兵','官符'];
    var luCunPos=minorPos['禄存'];
    var boshiByZhi={};
    for(var bi=0;bi<12;bi++){ boshiByZhi[DZ[(luCunPos+bi)%12]]=BOSHI[bi]; }

    // 将前十二神：将星在子(0)，顺行
    var JIANGQIAN=['将星','攀鞍','岁驿','息神','华盖','劫煞','灾煞','天煞','指背','咸池','月煞','亡神'];
    var jqByZhi={};
    for(var ji=0;ji<12;ji++){ jqByZhi[DZ[(0+ji)%12]]=JIANGQIAN[ji]; }

    // 小限：男命从戌(10)起1岁顺行，女命从辰(4)起1岁逆行
    var xxStart=isMale?10:4;
    var xxForward=isMale;
    var xiaoXianByZhi={};
    for(var xi=0;xi<12;xi++){
      var xxAges=[];
      for(var xa=1+xi;xa<=60;xa+=12){ xxAges.push(xa); }
      var xxZhiIdx=(xxStart + (xxForward?xi:-xi) + 12) % 12;
      xiaoXianByZhi[DZ[xxZhiIdx]]=xxAges.join(',');
    }

    // 岁前十二神：从年支起岁建顺行（大耗位替换为岁破=冲太岁）
    var SUIQIAN=['岁建','晦气','丧门','贯索','官符','小耗','大耗','龙德','白虎','天德','吊客','病符'];
    var suiPoIdx=(yearZhiIdx+6)%12; // 岁破=年支相冲
    var sqByZhi={};
    for(var si=0;si<12;si++){
      var sZhi=(yearZhiIdx+si)%12;
      var sName=SUIQIAN[si];
      if(si===6) sName='岁破'; // 大耗位替换为岁破
      sqByZhi[DZ[sZhi]]=sName;
    }


    // 咸池：年支三合局桃花
    var xcMap={0:9,1:2,2:5,3:0,4:9,5:2,6:5,7:0,8:9,9:2,10:5,11:0}; // 申子辰酉,巳酉丑午...
    var xcZhiIdx=xcMap[yearZhiIdx]||9;

    // 杂星注入映射
    var zaByZhi={};

    // ====== 年干系 ======
    zaByZhi[DZ[(7+yearGanIdx)%12]]=(zaByZhi[DZ[(7+yearGanIdx)%12]]||[]).concat(['天官']);
    zaByZhi[DZ[(8+yearGanIdx)%12]]=(zaByZhi[DZ[(8+yearGanIdx)%12]]||[]).concat(['天贵']);
    zaByZhi[DZ[(yearGanIdx*2+8)%12]]=(zaByZhi[DZ[(yearGanIdx*2+8)%12]]||[]).concat(['截空']);
    var xkMap=[6,9,0,3,6,9,0,3,6,9];
    zaByZhi[DZ[xkMap[yearGanIdx]]]=(zaByZhi[DZ[xkMap[yearGanIdx]]]||[]).concat(['旬空']);

    // ====== 年支系 ======
    var gz=yearZhiIdx;
    zaByZhi[DZ[(gz+10)%12]]=(zaByZhi[DZ[(gz+10)%12]]||[]).concat(['天姚']);
    zaByZhi[DZ[(gz+2)%12]]=(zaByZhi[DZ[(gz+2)%12]]||[]).concat(['天哭']);
    zaByZhi[DZ[(gz+6)%12]]=(zaByZhi[DZ[(gz+6)%12]]||[]).concat(['天虚']);
    zaByZhi[DZ[(gz+6)%12]]=(zaByZhi[DZ[(gz+6)%12]]||[]).concat(['天才']);
    zaByZhi[DZ[(gz+3)%12]]=(zaByZhi[DZ[(gz+3)%12]]||[]).concat(['孤辰']);
    zaByZhi[DZ[(gz+3)%12]]=(zaByZhi[DZ[(gz+3)%12]]||[]).concat(['天伤']);
    zaByZhi[DZ[(gz+8)%12]]=(zaByZhi[DZ[(gz+8)%12]]||[]).concat(['天寿']);
    zaByZhi[DZ[(gz+8)%12]]=(zaByZhi[DZ[(gz+8)%12]]||[]).concat(['蜚廉']);
    zaByZhi[DZ[(gz+8)%12]]=(zaByZhi[DZ[(gz+8)%12]]||[]).concat(['阴煞']);
    zaByZhi[DZ[(gz+5)%12]]=(zaByZhi[DZ[(gz+5)%12]]||[]).concat(['天使']);
    zaByZhi[DZ[(gz+5)%12]]=(zaByZhi[DZ[(gz+5)%12]]||[]).concat(['月德']);
    zaByZhi[DZ[(gz+7)%12]]=(zaByZhi[DZ[(gz+7)%12]]||[]).concat(['大耗']);
    zaByZhi[DZ[(gz+1)%12]]=(zaByZhi[DZ[(gz+1)%12]]||[]).concat(['副截']);
    var hlMap=[3,2,1,0,11,10,9,8,7,6,5,4];
    var hlZhi=hlMap[gz];
    zaByZhi[DZ[hlZhi]]=(zaByZhi[DZ[hlZhi]]||[]).concat(['红鸾']);
    zaByZhi[DZ[(hlZhi+6)%12]]=(zaByZhi[DZ[(hlZhi+6)%12]]||[]).concat(['天喜']);
    var gsTab=[10,1,4,5,7,1,10,1,7,5,7,1];
    zaByZhi[DZ[gsTab[gz]]]=(zaByZhi[DZ[gsTab[gz]]]||[]).concat(['寡宿']);
    var xcMap={0:9,1:2,2:5,3:0,4:9,5:2,6:5,7:0,8:9,9:2,10:5,11:0};
    zaByZhi[DZ[xcMap[gz]||9]]=(zaByZhi[DZ[xcMap[gz]||9]]||[]).concat(['咸池']);
    var hgMap={0:4,8:4,4:4,2:6,6:6,10:6,5:10,9:10,1:10,11:0,3:0,7:0};
    zaByZhi[DZ[hgMap[gz]||4]]=(zaByZhi[DZ[hgMap[gz]||4]]||[]).concat(['华盖']);

    // ====== 月支系 ======
    var lm=lMonth;
    zaByZhi[DZ[(9+lm-1)%12]]=(zaByZhi[DZ[(9+lm-1)%12]]||[]).concat(['天刑']);
    zaByZhi[DZ[(lm-1)%12]]=(zaByZhi[DZ[(lm-1)%12]]||[]).concat(['天厨']);
    zaByZhi[DZ[(lm+2)%12]]=(zaByZhi[DZ[(lm+2)%12]]||[]).concat(['天巫']);
    zaByZhi[DZ[(lm+1)%12]]=(zaByZhi[DZ[(lm+1)%12]]||[]).concat(['台辅']);
    zaByZhi[DZ[(lm+9)%12]]=(zaByZhi[DZ[(lm+9)%12]]||[]).concat(['封诰']);
    zaByZhi[DZ[(lm+9)%12]]=(zaByZhi[DZ[(lm+9)%12]]||[]).concat(['天月']);
    zaByZhi[DZ[(lm+6)%12]]=(zaByZhi[DZ[(lm+6)%12]]||[]).concat(['龙池']);
    zaByZhi[DZ[(lm+6)%12]]=(zaByZhi[DZ[(lm+6)%12]]||[]).concat(['恩光']);
    zaByZhi[DZ[(lm+8)%12]]=(zaByZhi[DZ[(lm+8)%12]]||[]).concat(['凤阁']);
    zaByZhi[DZ[(lm+7)%12]]=(zaByZhi[DZ[(lm+7)%12]]||[]).concat(['三台']);
    zaByZhi[DZ[(lm+7)%12]]=(zaByZhi[DZ[(lm+7)%12]]||[]).concat(['八座']);
    zaByZhi[DZ[(yearGanIdx+lm+3)%12]]=(zaByZhi[DZ[(yearGanIdx+lm+3)%12]]||[]).concat(['天福']);
    zaByZhi[DZ[(yearGanIdx+lm+1)%12]]=(zaByZhi[DZ[(yearGanIdx+lm+1)%12]]||[]).concat(['副旬']);

    // ====== 时支系 ======
    zaByZhi[DZ[(hour+8)%12]]=(zaByZhi[DZ[(hour+8)%12]]||[]).concat(['天空']);
    zaByZhi[DZ[(hour+8)%12]]=(zaByZhi[DZ[(hour+8)%12]]||[]).concat(['破碎']);
    zaByZhi[DZ[(hour+11)%12]]=(zaByZhi[DZ[(hour+11)%12]]||[]).concat(['解神']);

    // ====== 特殊 ======
    zaByZhi[DZ[(mingPos+8)%12]]=(zaByZhi[DZ[(mingPos+8)%12]]||[]).concat(['年解']);



    // 将前/岁前也加入星列（有亮度标注）
    for(var zz=0;zz<12;zz++){
      if(jqByZhi[DZ[zz]])zaByZhi[DZ[zz]]=(zaByZhi[DZ[zz]]||[]).concat([jqByZhi[DZ[zz]]]);
      if(sqByZhi[DZ[zz]])zaByZhi[DZ[zz]]=(zaByZhi[DZ[zz]]||[]).concat([sqByZhi[DZ[zz]]]);
      if(boshiByZhi[DZ[zz]])zaByZhi[DZ[zz]]=(zaByZhi[DZ[zz]]||[]).concat([boshiByZhi[DZ[zz]]]);
    }

    // 流年：从年支起1岁，每年顺行一宫
    var liuNianByZhi={};
    for(var li=0;li<12;li++){
      var ages=[];
      for(var a=1+li;a<=60;a+=12){ ages.push(a); }
      liuNianByZhi[DZ[(yearZhiIdx+li)%12]]=ages.join(',');
    }

    // 命主(命宫地支→星)、身主(生年年支→星)
    var MINGZHU_MAP={0:'贪狼',1:'巨门',2:'天机',3:'文曲',4:'廉贞',5:'武曲',6:'破军',7:'武曲',8:'廉贞',9:'文曲',10:'禄存',11:'巨门'};
    var SHENZHU_MAP={0:'火星',1:'天相',2:'天梁',3:'天同',4:'文昌',5:'天机',6:'火星',7:'天相',8:'天梁',9:'天同',10:'文昌',11:'天机'};
    var mingZhu=MINGZHU_MAP[DZ.indexOf(mingPalace.zhi)]||'';
    var shenGongZhiIdx=(2 + (lMonth-1) + hour) % 12; var shenGongZhi=DZ[shenGongZhiIdx]; var shenGongName=""; for(var i=0;i<palaces.length;i++){if(palaces[i].zhi===shenGongZhi){shenGongName=palaces[i].name;break;}}
    var shenZhu=SHENZHU_MAP[yearZhiIdx]||'';

    // 组装结果
    var chart={};
    var starBright={};
    palaces.forEach(function(p,i){
      var gz=palaceGans[i]+p.zhi;
      var stars=[], starInfo=[];
      for(var s in starPos){ if(starPos[s]===p.idx) stars.push(s); }
      // 星曜亮度
      stars.forEach(function(s){
        var bTable=ZIWEI.brightness[s];
        var bLevel=bTable?bTable[DZ.indexOf(p.zhi)]:4;
        starInfo.push({name:s, bright:bLevel, label:ZIWEI.brightnessLabel[bLevel]||''});
      });
      var minors=[];
      for(var s in minorPos){ if(minorPos[s]===p.idx) minors.push(s); }
      var hua=[];
      for(var h in sihua){ if(stars.indexOf(sihua[h])>=0) hua.push(h); }
      chart[p.name]={
        ganZhi:gz, zhi:p.zhi, gan:palaceGans[i],
        stars:stars, starInfo:starInfo, minors:minors, hua:hua,
        changSheng:changShengByZhi[p.zhi]||'',
        boShi:boshiByZhi[p.zhi]||'',
        jiangQian:jqByZhi[p.zhi]||'',
        liuNian:liuNianByZhi[p.zhi]||'',
        xiaoXian:xiaoXianByZhi[p.zhi]||'',
        suiQian:sqByZhi[p.zhi]||'',
        zaXing:[],
        meaning:ZIWEI.palaces[i].meaning
      };
    });
    // 注入杂星到各宫
    // 注入到每个宫位
    palaces.forEach(function(p){
      chart[p.name].zaXing=zaByZhi[p.zhi]||[];
    });

    // 大限：从命宫起，阳男阴女顺行/阴男阳女逆行
    var wuxingJuNum=[4,3,2,6,5]; // 金4木3水2火6土5
    var startAge=wuxingJuNum[ju];
    var tianGan=TG[yearGanIdx];
    var isYangGan='甲丙戊庚壬'.indexOf(tianGan)>=0;
    var goForward=(isYangGan&&isMale)||(!isYangGan&&!isMale);
    var daxian=[];
    for(var di=0;di<12;di++){
      var zhiIdx=(mingPos + (goForward?di:-di) + 12)%12;
      var palName='';
      for(var pi=0;pi<palaces.length;pi++){ if(palaces[pi].idx===zhiIdx){ palName=palaces[pi].name; break; } }
      var age=startAge+di*10;
      daxian.push({name:palName, zhi:DZ[zhiIdx], ageRange:age+'~'+(age+9)});
      if(chart[palName]) chart[palName].daXian=age+'~'+(age+9);
    }
    // 三方四正分析
    var triads = [
      { name:'命财官线', palaces:['命宫','财帛','官禄'], meaning:'事业成就、社会地位、人生格局的核心轴线' },
      { name:'兄疾田线', palaces:['兄弟','疾厄','田宅'], meaning:'家庭健康、手足房产、内在安全感' },
      { name:'夫子友线', palaces:['夫妻','子女','交友'], meaning:'婚姻子息、人际关系、情感世界' },
      { name:'迁福母线', palaces:['迁移','福德','父母'], meaning:'外出发展、精神福报、长辈庇荫' }
    ];
    var triadAnalysis=[];
    triads.forEach(function(td){
      var allStars=[], allMinors=[], allHua=[], palaces=[];
      td.palaces.forEach(function(name){
        var p=chart[name]; if(!p) return;
        palaces.push(name);
        p.stars.forEach(function(s){ if(allStars.indexOf(s)<0) allStars.push(s); });
        p.minors.forEach(function(s){ if(allMinors.indexOf(s)<0) allMinors.push(s); });
        p.hua.forEach(function(h){ if(allHua.indexOf(h)<0) allHua.push(h); });
      });
      var summary='';
      if(allStars.length===0) summary='三合无主星，格局偏弱，需借对宫星曜来看；';
      else{
        var strong=allStars.filter(function(s){ return ['紫微','天府','太阳','武曲','天相','天梁'].indexOf(s)>=0; });
        var weak=allStars.filter(function(s){ return ['巨门','廉贞','破军','贪狼'].indexOf(s)>=0; });
        if(strong.length>=2) summary+='三方汇吉，'+strong.join('/')+'聚首，'+td.name+'有力；';
        else if(weak.length>=2) summary+='三方暗星较多，'+td.name+'需留意波折；';
        else summary+='三方平顺，'+td.name+'发展需自身努力；';
      }
      if(allHua.length) summary+='四化：'+allHua.map(function(h){var lb={lu:'禄',quan:'权',ke:'科',ji:'忌'};return lb[h]||h;}).join('')+'；';
      triadAnalysis.push({name:td.name,palaces:palaces.join('·'),stars:allStars,minors:allMinors,hua:allHua,summary:summary,meaning:td.meaning});
    });

    // 四正（对宫）
    var oppositions=[['命宫','迁移'],['兄弟','交友'],['夫妻','官禄'],['子女','田宅'],['财帛','福德'],['疾厄','父母']];
    var oppAnalysis=[];
    oppositions.forEach(function(pair){
      var p1=chart[pair[0]], p2=chart[pair[1]];
      var s1=p1.stars.join(''), s2=p2.stars.join('');
      var oppSummary='';
      if(!s1&&!s2) oppSummary='借对宫星曜来看';
      else if(s1&&!s2) oppSummary=pair[0]+'星曜入'+pair[1];
      else if(!s1&&s2) oppSummary=pair[1]+'星曜入'+pair[0];
      else oppSummary='本对宫皆有星，格局稳固';
      oppAnalysis.push({name:pair[0]+'←→'+pair[1],palace:p1,palace2:p2,summary:oppSummary});
    });

    return {
      chart:chart,
      mingGong:mingPalace.name,
      mingZhu:mingZhu,
      shenZhu:shenZhu,
      shenGong:shenGongName,
      wuxingJu:['金四局','木三局','水二局','火六局','土五局'][ju],
      sihua:sihua,
      lunarMonth:lMonth, lunarDay:lDay,
      triads:triadAnalysis,
      oppositions:oppAnalysis,
      daxian:daxian
    };
  }

  return { calcZiwei:calcZiwei };
})();
