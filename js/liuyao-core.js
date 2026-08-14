/**
 * 六爻装卦引擎 — 八宫·纳甲·六亲·六神·世应
 */
var LIUYAO = (function(){
  var TG=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var DZ_WX={子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
  var TRI_WX={乾:'金',兑:'金',离:'火',震:'木',巽:'木',坎:'水',艮:'土',坤:'土'};
  var LIUSHEN=['青龙','朱雀','勾陈','腾蛇','白虎','玄武'];
  var LIUSHEN_WX={青龙:'木',朱雀:'火',勾陈:'土',腾蛇:'土',白虎:'金',玄武:'水'};
  var LIUSHEN_ORDER=['青龙','朱雀','勾陈','腾蛇','白虎','玄武'];

  // 八宫卦全表：{卦名,宫,五行,世爻位置(1-6),卦型}
  var GONG_GUA = {
    '乾为天':{gong:'乾',wx:'金',shi:6,type:'八纯'},'天风姤':{gong:'乾',wx:'金',shi:1,type:'一世'},
    '天山遁':{gong:'乾',wx:'金',shi:2,type:'二世'},'天地否':{gong:'乾',wx:'金',shi:3,type:'三世'},
    '风地观':{gong:'乾',wx:'金',shi:4,type:'四世'},'山地剥':{gong:'乾',wx:'金',shi:5,type:'五世'},
    '火地晋':{gong:'乾',wx:'金',shi:4,type:'游魂'},'火天大有':{gong:'乾',wx:'金',shi:3,type:'归魂'},
    '坎为水':{gong:'坎',wx:'水',shi:6,type:'八纯'},'水泽节':{gong:'坎',wx:'水',shi:1,type:'一世'},
    '水雷屯':{gong:'坎',wx:'水',shi:2,type:'二世'},'水火既济':{gong:'坎',wx:'水',shi:3,type:'三世'},
    '泽火革':{gong:'坎',wx:'水',shi:4,type:'四世'},'雷火丰':{gong:'坎',wx:'水',shi:5,type:'五世'},
    '地火明夷':{gong:'坎',wx:'水',shi:4,type:'游魂'},'地水师':{gong:'坎',wx:'水',shi:3,type:'归魂'},
    '艮为山':{gong:'艮',wx:'土',shi:6,type:'八纯'},'山火贲':{gong:'艮',wx:'土',shi:1,type:'一世'},
    '山天大畜':{gong:'艮',wx:'土',shi:2,type:'二世'},'山泽损':{gong:'艮',wx:'土',shi:3,type:'三世'},
    '火泽睽':{gong:'艮',wx:'土',shi:4,type:'四世'},'天泽履':{gong:'艮',wx:'土',shi:5,type:'五世'},
    '风泽中孚':{gong:'艮',wx:'土',shi:4,type:'游魂'},'风山渐':{gong:'艮',wx:'土',shi:3,type:'归魂'},
    '震为雷':{gong:'震',wx:'木',shi:6,type:'八纯'},'雷地豫':{gong:'震',wx:'木',shi:1,type:'一世'},
    '雷水解':{gong:'震',wx:'木',shi:2,type:'二世'},'雷风恒':{gong:'震',wx:'木',shi:3,type:'三世'},
    '地风升':{gong:'震',wx:'木',shi:4,type:'四世'},'水风井':{gong:'震',wx:'木',shi:5,type:'五世'},
    '泽风大过':{gong:'震',wx:'木',shi:4,type:'游魂'},'泽雷随':{gong:'震',wx:'木',shi:3,type:'归魂'},
    '巽为风':{gong:'巽',wx:'木',shi:6,type:'八纯'},'风天小畜':{gong:'巽',wx:'木',shi:1,type:'一世'},
    '风火家人':{gong:'巽',wx:'木',shi:2,type:'二世'},'风雷益':{gong:'巽',wx:'木',shi:3,type:'三世'},
    '天雷无妄':{gong:'巽',wx:'木',shi:4,type:'四世'},'火雷噬嗑':{gong:'巽',wx:'木',shi:5,type:'五世'},
    '山雷颐':{gong:'巽',wx:'木',shi:4,type:'游魂'},'山风蛊':{gong:'巽',wx:'木',shi:3,type:'归魂'},
    '离为火':{gong:'离',wx:'火',shi:6,type:'八纯'},'火山旅':{gong:'离',wx:'火',shi:1,type:'一世'},
    '火风鼎':{gong:'离',wx:'火',shi:2,type:'二世'},'火水未济':{gong:'离',wx:'火',shi:3,type:'三世'},
    '山水蒙':{gong:'离',wx:'火',shi:4,type:'四世'},'风水涣':{gong:'离',wx:'火',shi:5,type:'五世'},
    '天水讼':{gong:'离',wx:'火',shi:4,type:'游魂'},'天火同人':{gong:'离',wx:'火',shi:3,type:'归魂'},
    '坤为地':{gong:'坤',wx:'土',shi:6,type:'八纯'},'地雷复':{gong:'坤',wx:'土',shi:1,type:'一世'},
    '地泽临':{gong:'坤',wx:'土',shi:2,type:'二世'},'地天泰':{gong:'坤',wx:'土',shi:3,type:'三世'},
    '雷天大壮':{gong:'坤',wx:'土',shi:4,type:'四世'},'泽天夬':{gong:'坤',wx:'土',shi:5,type:'五世'},
    '水天需':{gong:'坤',wx:'土',shi:4,type:'游魂'},'水地比':{gong:'坤',wx:'土',shi:3,type:'归魂'},
    '兑为泽':{gong:'兑',wx:'金',shi:6,type:'八纯'},'泽水困':{gong:'兑',wx:'金',shi:1,type:'一世'},
    '泽地萃':{gong:'兑',wx:'金',shi:2,type:'二世'},'泽山咸':{gong:'兑',wx:'金',shi:3,type:'三世'},
    '水山蹇':{gong:'兑',wx:'金',shi:4,type:'四世'},'地山谦':{gong:'兑',wx:'金',shi:5,type:'五世'},
    '雷山小过':{gong:'兑',wx:'金',shi:4,type:'游魂'},'雷泽归妹':{gong:'兑',wx:'金',shi:3,type:'归魂'}
  };

  // 以上卦、下卦直接定位卦名。卦名不能靠首尾文字推断，例如坤上震下是“地雷复”。
  var GUA_BY_TRIGRAM = {
    '乾乾':'乾为天','乾兑':'天泽履','乾离':'天火同人','乾震':'天雷无妄','乾巽':'天风姤','乾坎':'天水讼','乾艮':'天山遁','乾坤':'天地否',
    '兑乾':'泽天夬','兑兑':'兑为泽','兑离':'泽火革','兑震':'泽雷随','兑巽':'泽风大过','兑坎':'泽水困','兑艮':'泽山咸','兑坤':'泽地萃',
    '离乾':'火天大有','离兑':'火泽睽','离离':'离为火','离震':'火雷噬嗑','离巽':'火风鼎','离坎':'火水未济','离艮':'火山旅','离坤':'火地晋',
    '震乾':'雷天大壮','震兑':'雷泽归妹','震离':'雷火丰','震震':'震为雷','震巽':'雷风恒','震坎':'雷水解','震艮':'雷山小过','震坤':'雷地豫',
    '巽乾':'风天小畜','巽兑':'风泽中孚','巽离':'风火家人','巽震':'风雷益','巽巽':'巽为风','巽坎':'风水涣','巽艮':'风山渐','巽坤':'风地观',
    '坎乾':'水天需','坎兑':'水泽节','坎离':'水火既济','坎震':'水雷屯','坎巽':'水风井','坎坎':'坎为水','坎艮':'水山蹇','坎坤':'水地比',
    '艮乾':'山天大畜','艮兑':'山泽损','艮离':'山火贲','艮震':'山雷颐','艮巽':'山风蛊','艮坎':'山水蒙','艮艮':'艮为山','艮坤':'山地剥',
    '坤乾':'地天泰','坤兑':'地泽临','坤离':'地火明夷','坤震':'地雷复','坤巽':'地风升','坤坎':'地水师','坤艮':'地山谦','坤坤':'坤为地'
  };

  // 纳支：内卦地支[初爻,二爻,三爻]，外卦地支[四爻,五爻,上爻]
  var NAZHI = {
    '乾':{inner:['子','寅','辰'],outer:['午','申','戌']},
    '坎':{inner:['寅','辰','午'],outer:['申','戌','子']},
    '艮':{inner:['辰','午','申'],outer:['戌','子','寅']},
    '震':{inner:['子','寅','辰'],outer:['午','申','戌']},
    '巽':{inner:['丑','亥','酉'],outer:['未','巳','卯']},
    '离':{inner:['卯','丑','亥'],outer:['酉','未','巳']},
    '坤':{inner:['未','巳','卯'],outer:['丑','亥','酉']},
    '兑':{inner:['巳','卯','丑'],outer:['亥','酉','未']}
  };

  // 纳甲
  var NAJIA_INNER={乾:'甲',震:'庚',坎:'戊',艮:'丙',巽:'辛',离:'己',坤:'乙',兑:'丁'};
  var NAJIA_OUTER={乾:'壬',震:'庚',坎:'戊',艮:'丙',巽:'辛',离:'己',坤:'癸',兑:'丁'};

  // 六亲判定：宫五行 vs 爻五行
  function getLiuQin(gongWX, yaoWX){
    var sheng={'木':'火','火':'土','土':'金','金':'水','水':'木'};
    if(gongWX===yaoWX) return '兄弟';
    if(sheng[yaoWX]===gongWX) return '父母';  // 爻生宫
    if(sheng[gongWX]===yaoWX) return '子孙';  // 宫生爻
    if(gongWX===sheng[sheng[sheng[yaoWX]]]) return '妻财'; // 宫克爻
    if(yaoWX===sheng[sheng[sheng[gongWX]]]) return '官鬼'; // 爻克宫
    // 简化：我克=妻财，克我=官鬼
    var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};
    if(ke[gongWX]===yaoWX) return '妻财';
    if(ke[yaoWX]===gongWX) return '官鬼';
    return '兄弟';
  }

  // 根据八卦三爻确定是哪一卦
  function getTrigram(y1,y2,y3){
    var bins={'111':'乾','110':'兑','101':'离','100':'震','011':'巽','010':'坎','001':'艮','000':'坤'};
    return bins[y1+''+y2+''+y3];
  }

  // 主入口
  function zhuangGua(lines, dayGanIdx, monthZhi, options){
    // lines: 6个爻(0=阴,1=阳), 从初爻(底)到上爻(顶)
    // 找上下卦
    var upper=lines.slice(3,6); // 四五六爻
    var lower=lines.slice(0,3); // 一二三爻
    // 三爻从下到上（y1=底,y2=中,y3=顶）
    var upperTri=getTrigram(upper[0],upper[1],upper[2]); // 四爻(底),五爻(中),上爻(顶)
    var lowerTri=getTrigram(lower[0],lower[1],lower[2]); // 初爻(底),二爻(中),三爻(顶)
    var gName=GUA_BY_TRIGRAM[upperTri+lowerTri];
    var guaInfo=gName?GONG_GUA[gName]:null;
    if(!guaInfo) throw new Error('无法识别上下卦：'+upperTri+'上'+lowerTri+'下');
    var gongWX=guaInfo.wx;
    var liuQinGongWX=options&&options.liuQinGongWX?options.liuQinGongWX:gongWX;
    var shiYao=guaInfo.shi;
    var yingYao=shiYao+3;if(yingYao>6)yingYao-=6;

    // 纳支
    var innerDZ=NAZHI[lowerTri]?NAZHI[lowerTri].inner:['子','寅','辰'];
    var outerDZ=NAZHI[upperTri]?NAZHI[upperTri].outer:['午','申','戌'];
    var yaoDZ=innerDZ.concat(outerDZ); // [初,二,三,四,五,上]

    // 纳甲天干
    var innerGan=NAJIA_INNER[lowerTri]||'甲';
    var outerGan=NAJIA_OUTER[upperTri]||'壬';
    var yaoGan=[innerGan,innerGan,innerGan,outerGan,outerGan,outerGan];

    // 六亲 & 五行
    var liuqin=[], yaowx=[];
    for(var i=0;i<6;i++){
      var wx=DZ_WX[yaoDZ[i]]||'土';
      yaowx.push(wx);
      liuqin.push(getLiuQin(liuQinGongWX,wx));
    }

    // 月建五行
    var monthWX=DZ_WX[monthZhi]||'土';

    // 六神（根据日干起例）
    var shenOrder={'甲':0,'乙':0,'丙':1,'丁':1,'戊':2,'己':3,'庚':4,'辛':4,'壬':5,'癸':5};
    var dayGan=TG[dayGanIdx%10];
    var startShen=shenOrder[dayGan]||0;
    var liushen=[];
    for(var i=0;i<6;i++){ liushen.push(LIUSHEN_ORDER[(startShen + i) % 6]); }

    // 月建生克 & 旺衰（月令 vs 爻五行）
    var WANG_SHUAI={木:{春:'旺',夏:'休',季:'囚',秋:'死',冬:'相'},火:{春:'相',夏:'旺',季:'休',秋:'囚',冬:'死'},土:{春:'死',夏:'相',季:'旺',秋:'休',冬:'囚'},金:{春:'囚',夏:'死',季:'相',秋:'旺',冬:'休'},水:{春:'休',夏:'囚',季:'死',秋:'相',冬:'旺'}};
    var SEASON={'寅':'春','卯':'春','辰':'季','巳':'夏','午':'夏','未':'季','申':'秋','酉':'秋','戌':'季','亥':'冬','子':'冬','丑':'季'};
    var season=SEASON[monthZhi]||'季';
    var wangShuai=[];
    for(var i=0;i<6;i++){ wangShuai.push(WANG_SHUAI[yaowx[i]][season]||'平'); }

    // 月建与每一爻的直接关系；比单纯“春夏秋冬旺相休囚死”更适合六爻判断。
    var monthState=[];
    var monthSheng={'木':'火','火':'土','土':'金','金':'水','水':'木'};
    var monthKe={'木':'土','土':'水','水':'火','火':'金','金':'木'};
    for(var i=0;i<6;i++){
      if(yaoDZ[i]===monthZhi) monthState.push('临月建');
      else if(yaowx[i]===monthWX) monthState.push('得月扶');
      else if(monthSheng[monthWX]===yaowx[i]) monthState.push('得月生');
      else if(monthSheng[yaowx[i]]===monthWX) monthState.push('泄于月');
      else if(monthKe[monthWX]===yaowx[i]) monthState.push('月克');
      else if(monthKe[yaowx[i]]===monthWX) monthState.push('克月');
      else monthState.push('月令关系待定');
    }

    // 十二长生：月支是"旺"，爻支顺排十二宫
    var CHANG_SHENG=['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
    var DZ_IDX={子:0,丑:1,寅:2,卯:3,辰:4,巳:5,午:6,未:7,申:8,酉:9,戌:10,亥:11};
    var changSheng=[];
    for(var i=0;i<6;i++){
      var offset=(DZ_IDX[yaoDZ[i]] - DZ_IDX[monthZhi] + 12) % 12;
      changSheng.push(CHANG_SHENG[offset]);
    }

    return {
      guaName:gName, gong:guaInfo.gong, gongWX:gongWX, guaType:guaInfo.type,
      liuQinGongWX:liuQinGongWX,
      shiYao:shiYao, yingYao:yingYao,
      yaoDZ:yaoDZ, yaoGan:yaoGan, yaoWX:yaowx, liuqin:liuqin, liushen:liushen,
      monthZhi:monthZhi, monthWX:monthWX,
      wangShuai:wangShuai, monthState:monthState, changSheng:changSheng
    };
  }

  // ============ 伏神查找：八纯卦六亲（以宫五行为准） ============
  var PURE_GUA_QIN = {
    乾:{kids:[1,1,0,3,2,0]},  // 0=父母,1=子孙,2=妻财,3=官鬼,4=兄弟 (index into ['父母','子孙','妻财','官鬼','兄弟'])
    // kids order by六亲index: 0父母 1子孙 2妻财 3官鬼 4兄弟
    // 乾宫金: 子水(子孙1) 寅木(妻财2) 辰土(父母0) 午火(官鬼3) 申金(兄弟4) 戌土(父母0)
    // 艮宫土: 辰土(兄弟4) 午火(父母0) 申金(子孙1) 戌土(兄弟4) 子水(妻财2) 寅木(官鬼3)
  };
  // 八纯卦各爻的六亲，索引对应父/孙/财/官/兄
  var CHUN_GUA = {
    '乾为天':{qin:[1,2,0,3,4,0], dz:['子','寅','辰','午','申','戌'], gan:['甲','甲','甲','壬','壬','壬']},
    '坎为水':{qin:[1,3,2,0,3,4], dz:['寅','辰','午','申','戌','子'], gan:['戊','戊','戊','戊','戊','戊']},
    '艮为山':{qin:[4,0,1,4,2,3], dz:['辰','午','申','戌','子','寅'], gan:['丙','丙','丙','丙','丙','丙']},
    '震为雷':{qin:[0,4,2,1,3,2], dz:['子','寅','辰','午','申','戌'], gan:['庚','庚','庚','庚','庚','庚']},
    '巽为风':{qin:[2,0,3,2,1,4], dz:['丑','亥','酉','未','巳','卯'], gan:['辛','辛','辛','辛','辛','辛']},
    '离为火':{qin:[0,1,3,2,1,4], dz:['卯','丑','亥','酉','未','巳'], gan:['己','己','己','己','己','己']},
    '坤为地':{qin:[4,0,3,4,2,1], dz:['未','巳','卯','丑','亥','酉'], gan:['乙','乙','乙','癸','癸','癸']},
    '兑为泽':{qin:[3,2,0,1,4,0], dz:['巳','卯','丑','亥','酉','未'], gan:['丁','丁','丁','丁','丁','丁']}
  };
  var QIN_NAMES=['父母','子孙','妻财','官鬼','兄弟'];

  function getFuShen(guaName, liuqin, yaoWX){
    var gong=GONG_GUA[guaName]?GONG_GUA[guaName].gong:null;
    if(!gong) return [];
    // 找该宫的八纯卦名
    var pureKey=Object.keys(CHUN_GUA).find(function(k){ return k.indexOf(gong)===0; });
    if(!pureKey) return [];
    var pure=CHUN_GUA[pureKey];
    var missing=[];
    // 找缺失的六亲
    QIN_NAMES.forEach(function(q){
      if(liuqin.indexOf(q)<0) missing.push(q);
    });
    var result=[];
    missing.forEach(function(q){
      var qIdx=QIN_NAMES.indexOf(q);
      // 在八纯卦中找这个六亲在哪几爻
      for(var i=0;i<6;i++){
        if(pure.qin[i]===qIdx){
          var feiQin=liuqin[i]||'?';
          var wx=DZ_WX[pure.dz[i]]||'?';
          var feiWX=yaoWX&&yaoWX[i]?yaoWX[i]:'?';
          var sheng={'木':'火','火':'土','土':'金','金':'水','水':'木'};
          var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};
          var rel='';
          if(feiWX===wx) rel='比和';
          else if(sheng[feiWX]===wx) rel='飞来生伏';
          else if(sheng[wx]===feiWX) rel='伏去生飞';
          else if(ke[feiWX]===wx) rel='飞来克伏';
          else if(ke[wx]===feiWX) rel='伏克飞神';
          result.push({qin:q, ganZhi:pure.gan[i]+pure.dz[i], wx:wx, yaoIdx:i+1, feiQin:feiQin, feiWX:feiWX, rel:rel});
          break;
        }
      }
    });
    return result;
  }

  function getHuaRelation(originalWX, changedWX){
    var sheng={'木':'火','火':'土','土':'金','金':'水','水':'木'};
    var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};
    if(originalWX===changedWX) return '比和';
    if(sheng[changedWX]===originalWX) return '化回头生';
    if(ke[changedWX]===originalWX) return '化回头克';
    if(sheng[originalWX]===changedWX) return '化泄气';
    if(ke[originalWX]===changedWX) return '化出所克';
    return '关系待定';
  }

  function getCalendarContext(year, month, day, hour){
    if(typeof BaZiCalculator==='undefined'||!BaZiCalculator.calculate){
      throw new Error('干支历法引擎未加载');
    }
    var chart=BaZiCalculator.calculate(year,month,day,0,'male',hour,0);
    var dayIndex=-1;
    for(var i=0;i<60;i++){
      if(i%10===chart.day.ganIndex&&i%12===chart.day.zhiIndex){dayIndex=i;break;}
    }
    if(dayIndex<0) throw new Error('无法确定日干支序号');
    var kongByXun=[['戌','亥'],['申','酉'],['午','未'],['辰','巳'],['寅','卯'],['子','丑']];
    var xunKong=kongByXun[Math.floor(dayIndex/10)];
    return {
      yearGan:chart.year.gan,yearZhi:chart.year.zhi,
      monthGan:chart.month.gan,monthZhi:chart.month.zhi,
      dayGan:chart.day.gan,dayZhi:chart.day.zhi,
      dayGanIdx:chart.day.ganIndex,dayIndex:dayIndex,
      xunKong:xunKong,yuePo:DZ[(chart.month.zhiIndex+6)%12]
    };
  }

  function getDayState(yaoZhi, dayZhi){
    var yaoWX=DZ_WX[yaoZhi];
    var dayWX=DZ_WX[dayZhi];
    var sheng={'木':'火','火':'土','土':'金','金':'水','水':'木'};
    var ke={'木':'土','土':'水','水':'火','火':'金','金':'木'};
    var liuHe={子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
    var yaoIdx=DZ.indexOf(yaoZhi);
    var dayIdx=DZ.indexOf(dayZhi);
    if(yaoZhi===dayZhi) return '临日辰';
    if(yaoIdx>=0&&dayIdx>=0&&(yaoIdx-dayIdx+12)%12===6) return '日冲';
    if(liuHe[dayZhi]===yaoZhi) return '日合';
    if(yaoWX===dayWX) return '得日扶';
    if(sheng[dayWX]===yaoWX) return '得日生';
    if(sheng[yaoWX]===dayWX) return '泄于日';
    if(ke[dayWX]===yaoWX) return '日克';
    if(ke[yaoWX]===dayWX) return '克日';
    return '日令关系待定';
  }

  function formatProfessionalFacts(input){
    var original=input.original;
    var changed=input.changed;
    var movingLines=input.movingLines||[];
    var calendar=input.calendar;
    var hidden=input.hidden||[];
    var text='';
    text+='年柱：'+calendar.yearGan+calendar.yearZhi+'年\n';
    text+='月建：'+calendar.monthGan+calendar.monthZhi+'月\n';
    text+='日辰：'+calendar.dayGan+calendar.dayZhi+'日\n';
    text+='旬空：'+calendar.xunKong.join('')+'\n';
    text+='月破：'+calendar.yuePo+'\n';
    text+='本卦：'+original.guaName+'（'+original.gong+'宫·属'+original.gongWX+'·'+original.guaType+'卦）\n';
    text+='世爻：第'+original.shiYao+'爻；应爻：第'+original.yingYao+'爻\n';
    for(var i=0;i<6;i++){
      var tags=[];
      if(i+1===original.shiYao) tags.push('世');
      if(i+1===original.yingYao) tags.push('应');
      if(calendar.xunKong.indexOf(original.yaoDZ[i])>=0) tags.push('旬空');
      if(original.yaoDZ[i]===calendar.yuePo) tags.push('月破');
      if(movingLines.indexOf(i+1)>=0) tags.push('动爻');
      text+='第'+(i+1)+'爻：'+original.liuqin[i]+original.yaoGan[i]+original.yaoDZ[i]
        +original.yaoWX[i]+'，六神'+original.liushen[i]+'，月令关系'+original.monthState[i]
        +'，日令关系'+getDayState(original.yaoDZ[i],calendar.dayZhi)
        +(tags.length?'【'+tags.join('、')+'】':'')+'\n';
    }
    hidden.forEach(function(item){
      var feiZhi=original.yaoDZ[item.yaoIdx-1]||'';
      text+='伏神：第'+item.yaoIdx+'爻'+item.qin+item.ganZhi+item.wx+'，飞神'
        +item.feiQin+feiZhi+item.feiWX+'，'+item.rel+'\n';
    });
    if(changed){
      text+='变卦：'+changed.guaName+'（变爻六亲沿用本卦'+original.gongWX+'宫口径）\n';
      movingLines.forEach(function(lineNo){
        var idx=lineNo-1;
        text+='第'+lineNo+'爻动：'+original.liuqin[idx]+original.yaoGan[idx]+original.yaoDZ[idx]+original.yaoWX[idx]
          +'→'+changed.liuqin[idx]+changed.yaoGan[idx]+changed.yaoDZ[idx]+changed.yaoWX[idx]
          +'，'+getHuaRelation(original.yaoWX[idx],changed.yaoWX[idx])+'\n';
      });
    }else{
      text+='变卦：无\n';
    }
    return text;
  }

  return {
    zhuangGua:zhuangGua,
    getFuShen:getFuShen,
    getHuaRelation:getHuaRelation,
    getCalendarContext:getCalendarContext,
    getDayState:getDayState,
    formatProfessionalFacts:formatProfessionalFacts
  };
})();
