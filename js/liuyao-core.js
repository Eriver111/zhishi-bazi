/**
 * 六爻装卦引擎 — 八宫·纳甲·六亲·六神·世应
 */
var LIUYAO = (function(){
  var TG=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var DZ=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var DZ_WX={子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
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
  function zhuangGua(lines, dayGanIdx, monthZhi){
    // lines: 6个爻(0=阴,1=阳), 从初爻(底)到上爻(顶)
    // 找上下卦
    var upper=lines.slice(3,6); // 四五六爻
    var lower=lines.slice(0,3); // 一二三爻
    var upperTri=getTrigram(upper[2],upper[1],upper[0]); // 上卦(从上到下看)
    var lowerTri=getTrigram(lower[2],lower[1],lower[0]); // 下卦
    var gName=upperTri+'为'+lowerTri;
    // 从八宫表找精确卦名
    var found=false;
    for(var k in GONG_GUA){
      // 简单匹配：首字相同
      if(k.indexOf(upperTri)>=0 && k.indexOf(lowerTri)>=0){ gName=k; found=true; break; }
    }
    if(!found){
      for(var k in GONG_GUA){ if(k.split('为')[0]===upperTri&&k.split('为')[1]===lowerTri){ gName=k; break; } }
    }
    var guaInfo=GONG_GUA[gName] || {gong:upperTri,wx:'土',shi:3,type:'三世'};
    var gongWX=guaInfo.wx;
    var shiYao=guaInfo.shi;
    var yingYao=(shiYao+2)%6; if(yingYao===0) yingYao=6;

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
      liuqin.push(getLiuQin(gongWX,wx));
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
      shiYao:shiYao, yingYao:yingYao,
      yaoDZ:yaoDZ, yaoGan:yaoGan, yaoWX:yaowx, liuqin:liuqin, liushen:liushen,
      monthZhi:monthZhi, monthWX:monthWX,
      wangShuai:wangShuai, changSheng:changSheng
    };
  }

  return { zhuangGua:zhuangGua };
})();
