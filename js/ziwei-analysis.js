// ==================== 紫微斗数规则化解析引擎 ====================
// 纯计算驱动，不依赖AI。参照 bazi.js 的规则映射模式。

// ==================== 辅助函数 ====================
var ZW_GOOD=['紫微','天府','天相','天梁','天同','太阴','太阳','武曲','文昌','文曲','左辅','右弼','天魁','天钺','禄存'];
var ZW_BAD=['七杀','破军','贪狼','廉贞','巨门','擎羊','陀罗','火星','铃星','地空','地劫'];

function findPalace(zi,name){var r=null;zi.palaces.forEach(function(p){if(p.name===name)r=p;});return r;}
function getMajorStars(p){return(p&&p.majorStars)||[];}
function getMinorStars(p){return(p&&p.minorStars)||[];}
function getAdjStars(p){return(p&&p.adjectiveStars)||[];}
function starNames(arr){return arr.map(function(s){return s.name;});}
function hasStar(p,name){return starNames(getMajorStars(p)).indexOf(name)>=0||starNames(getMinorStars(p)).indexOf(name)>=0||starNames(getAdjStars(p)).indexOf(name)>=0;}
function scoreBright(b){return b==='庙'?15:b==='旺'?10:b==='得'?5:b==='平'?0:b==='不'?-5:b==='陷'?-10:0;}
function getOppZhi(zhi){var dz=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];var i=dz.indexOf(zhi);return i>=0?dz[(i+6)%12]:'';}
function findPalaceByZhi(zi,zhi){var r=null;zi.palaces.forEach(function(p){if(p.earthlyBranch===zhi)r=p;});return r;}

// ==================== 主星性情映射 ====================
var STAR_PERSONALITY={
紫微:'紫微为帝座之星，命宫坐紫微者天生贵气，自尊心强，有领导才能，处事圆融而有主见。格局佳时，一生受人敬重，事业有威权。',
天机:'天机为谋略之星，命宫坐天机者心思缜密，善于策划分析，应变能力极强。但思虑过甚容易优柔寡断，一生变动较多，宜顺势而为。',
太阳:'太阳为光明之星，命宫坐太阳者热情开朗，慷慨大方，天生具有感染力和号召力。但太阳过旺则锋芒太露，宜内敛涵养。',
武曲:'武曲为财帛之星，命宫坐武曲者性格刚毅果决，做事有魄力，理财能力出众。但过于刚硬易与人冲突，需学会柔中带刚。',
天同:'天同为福德之星，命宫坐天同者性情温和，待人宽厚，知足常乐。一生福气不差，但容易安于现状，缺乏进取的冲劲。',
廉贞:'廉贞为权柄之星，命宫坐廉贞者个性强烈，敢爱敢恨，做事认真而有原则。但情绪起伏较大，需要学会控制脾气方能成大事。',
天府:'天府为库藏之星，命宫坐天府者稳重踏实，心胸开阔，有包容力和组织才能。一生财运不弱，但保守有余而开创不足。',
太阴:'太阴为阴柔之星，命宫坐太阴者性情温婉，心思细腻，审美眼光出众。一生异性缘佳，但情绪易受外界影响，需增强内心安定。',
贪狼:'贪狼为欲望之星，命宫坐贪狼者多才多艺，交际手腕高明，人缘极好。但欲望强烈，需注意节制，否则易因贪而失。',
巨门:'巨门为暗曜之星，命宫坐巨门者口才出众，善于思辨，有研究精神和洞察力。但言语犀利容易得罪人，需谨言慎行。',
天相:'天相为辅佐之星，命宫坐天相者正直可靠，处事公正，天生具有服务精神和协调能力。一生贵人多助，但需防过于依赖他人。',
天梁:'天梁为寿星，命宫坐天梁者心地善良，有长者和医者之风，乐于助人。一生有逢凶化吉之福，但有时过于老成持重。',
七杀:'七杀为将星，命宫坐七杀者胆识过人，敢闯敢拼，有开拓精神和领导魄力。但性子刚烈急躁，需学会沉住气方能成大事。',
破军:'破军为先锋之星，命宫坐破军者个性鲜明，不拘一格，有改革创新的勇气。但一生变动较多，需稳扎稳打方能积累成果。'
};

// ==================== 五行局气质 ====================
var WUXING_JU_TEXT={
'水二局':'水主智，命主天生机敏，善于变通，直觉力强。为人处事如水一般灵活，能适应各种环境。',
'木三局':'木主仁，命主性情仁厚，有成长向上的动力。待人真诚，做事有规划，如树木般不断成长。',
'金四局':'金主义，命主刚正不阿，处事果断有原则。执行力强，不拖泥带水，但有时显得过于刚硬。',
'土五局':'土主信，命主稳重可靠，脚踏实地。有耐心和包容心，能承载重任，但有时保守不愿变通。',
'火六局':'火主礼，命主热情奔放，行动力强。有感染力和创造力，但需注意控制急躁，以免三分钟热度。'
};

// ==================== 命主含义 ====================
var SOUL_MEANING={
贪狼:'命主贪狼，一生需通过人际交往和才艺施展来实现自我价值，多才多艺但需专注。',
巨门:'命主巨门，一生以口才和智慧立身，适合从事研究、教育、咨询等需要深度思考的工作。',
禄存:'命主禄存，天生带有福禄之气，一生财运稳定，但需主动求取方能发挥。',
文曲:'命主文曲，才艺出众，以文化、艺术或技艺安身立命，需精益求精。',
廉贞:'命主廉贞，以原则和能力立身，适合从政、管理或专业领域，一生需把握权责平衡。',
武曲:'命主武曲，以实干和理财能力立身，适合金融、技术或管理岗位，一生勤勉有为。',
破军:'命主破军，以创新和改革立身，适合开拓性工作，一生变化较多但精彩纷呈。',
天机:'命主天机，以智慧和谋略立身，一生变动较多，善于在变化中寻找机会。',
天梁:'命主天梁，以善良和责任感立身，有逢凶化吉之福，适合服务或医者之道。',
天同:'命主天同，以温和待人立身，福气不浅，适合和谐稳定的生活方式。',
太阴:'命主太阴，以细腻和审美立身，适合文艺、设计或服务行业，一生异性缘佳。',
文昌:'命主文昌，以学识和文采立身，适合学术、教育或文职工作，贵人多助。'
};

// ==================== 夫妻宫主星 → 配偶类型 ====================
var SPOUSE_TEXT={
紫微:'配偶有领导气质，在婚姻中地位较高，需互相尊重方能长久。',
天机:'配偶聪明灵活，善于应变，但心思多变，婚姻中需要多沟通少猜疑。',
太阳:'配偶开朗大方，性格阳光，在人群中颇受欢迎，但需注意平衡家庭与社交。',
武曲:'配偶刚毅踏实，理财能力强，能为家庭提供稳定保障，但性格稍显刚硬。',
天同:'配偶温和体贴，善解人意，婚姻生活和谐幸福，但需共同进步以免平淡。',
廉贞:'配偶个性鲜明，感情浓烈，婚姻中激情与冲突并存，需要相互包容。',
天府:'配偶稳重顾家，有包容心，婚姻稳定可靠，但需增添生活情趣。',
太阴:'配偶温柔细腻，善解人意，婚姻中感情深厚，但情绪需多加关照。',
贪狼:'配偶有魅力，社交能力强，但桃花较重，婚姻中需要建立信任基础。',
巨门:'配偶口才好，思维敏捷，但容易因言语产生摩擦，沟通是婚姻关键。',
天相:'配偶正直可靠，处事公正，婚姻和谐稳定，有互相扶持的缘分。',
天梁:'配偶心地善良，有责任感，像长者一样照顾家庭，婚姻温馨但需防代沟。',
七杀:'配偶个性强烈，敢作敢为，婚姻中有激情也有挑战，需要互相理解。',
破军:'配偶特立独行，不拘常规，婚姻生活不按常理出牌，需有足够的包容心。'
};

var EMPTY_SPOUSE='夫妻宫无主星，婚姻缘分较弱，配偶特质受对宫官禄宫影响较大。感情之事需顺其自然，不宜强求，晚婚更利于稳定。';

// ==================== 财帛宫 → 财运描述 ====================
var WEALTH_TEXT={
武曲:'武曲坐财帛，天生有理财头脑，赚钱能力强，财运稳健，适合金融、技术等专业领域积累财富。',
天府:'天府坐财帛，财运充足，善于储蓄和规划，一生衣食无忧，但需避免过于保守错失良机。',
太阴:'太阴坐财帛，财运稳定，适合通过服务、艺术或女性相关行业获利，理财风格偏稳健。',
贪狼:'贪狼坐财帛，赚钱有手段，善于利用人脉和资源，但开销也大，需注意节制以防财来财去。',
廉贞:'廉贞坐财帛，有赚钱的魄力和执行力，但财运起伏较大，需稳扎稳打方能守住财富。',
太阳:'太阳坐财帛，慷慨大方，赚钱光明磊落，但花钱也大手大脚，需学会理财规划。',
巨门:'巨门坐财帛，适合通过口才、研究或技术赚钱，财运来源较隐蔽，需主动开拓。',
天机:'天机坐财帛，财运多变，适合灵活多源的收入方式，不宜固守单一财源。',
天同:'天同坐财帛，不刻意追求财富但福气自来，财运平稳，知足常乐。',
天相:'天相坐财帛，财运稳定，适合通过服务或辅佐他人获利，贵人助力财源。',
天梁:'天梁坐财帛，财运需通过助人或服务得来，不宜投机取巧，积德方能聚财。',
七杀:'七杀坐财帛，有冒险精神和开拓魄力，财运大开大合，需控制风险。',
破军:'破军坐财帛，财运起伏较大，适合创新和改革领域，需有储备应对波动。',
紫微:'紫微坐财帛，财运有贵气，适合通过管理或领导职位获取财富，格局宏大。'
};

var EMPTY_WEALTH='财帛宫无主星，财运受对宫福德宫影响较大，需借助对宫的力量来规划财务。';

// ==================== 命宫评分 ====================
function scorePalaceQuality(p){
  var score=0,detail=[];
  getMajorStars(p).forEach(function(s){
    var b=scoreBright(s.brightness||'');
    score+=b;
    if(b>0)detail.push(s.name+s.brightness+'(+'+b+')');
    else if(b<0)detail.push(s.name+s.brightness+'('+b+')');
  });
  getMinorStars(p).forEach(function(s){
    if(ZW_GOOD.indexOf(s.name)>=0){score+=5;detail.push(s.name+'(+5)');}
    if(ZW_BAD.indexOf(s.name)>=0){score-=5;detail.push(s.name+'(-5)');}
  });
  getAdjStars(p).forEach(function(s){
    if(ZW_GOOD.indexOf(s.name)>=0){score+=3;detail.push(s.name+'(+3)');}
    if(ZW_BAD.indexOf(s.name)>=0){score-=3;detail.push(s.name+'(-3)');}
  });
  if(p.heavenlyStem){
    getMajorStars(p).forEach(function(s){
      if(s.mutagen==='禄'){score+=10;detail.push('化禄(+10)');}
      if(s.mutagen==='权'){score+=8;detail.push('化权(+8)');}
      if(s.mutagen==='科'){score+=6;detail.push('化科(+6)');}
      if(s.mutagen==='忌'){score-=10;detail.push('化忌(-10)');}
    });
  }
  var rating=score>=40?'极佳':score>=20?'良好':score>=0?'中等':score>=-20?'偏弱':'较弱';
  return {score:score,rating:rating,detail:detail.join('，')};
}

// ==================== 1. 命宫总览 ====================
function analyzeMingGong(zi){
  var ming=findPalace(zi,'命宫');
  if(!ming)return {text:'命宫数据缺失，请重新排盘。'};
  var lines=[],stars=getMajorStars(ming);

  if(stars.length===0){
    var opp=findPalaceByZhi(zi,getOppZhi(ming.earthlyBranch));
    lines.push('命宫无主星（空宫），格局以对宫'+(opp?opp.name:'')+'为借镜。这样的人可塑性极强，不受单一格局限制，人生道路更加灵活。');
  } else {
    stars.forEach(function(s){
      var txt=STAR_PERSONALITY[s.name];
      if(txt)lines.push(txt);
    });
  }

  var wuju=zi.fiveElementsClass||'';
  var wuText=WUXING_JU_TEXT[wuju];
  if(wuText)lines.push(wuText);

  if(zi.soul){
    var sm=SOUL_MEANING[zi.soul];
    if(sm)lines.push(sm);
  }

  var shenZhi=zi.earthlyBranchOfBodyPalace;
  var mingZhi=zi.earthlyBranchOfSoulPalace;
  if(shenZhi&&mingZhi&&shenZhi!==mingZhi){
    var shenPal=findPalaceByZhi(zi,shenZhi);
    lines.push('身宫落'+(shenPal?shenPal.name:'他宫')+'，与命宫不同，说明命主的人生重心会从先天性格逐渐转向身宫所在领域，中年之后更为明显。');
  }

  var sq=scorePalaceQuality(ming);
  lines.push('命宫综合评分：'+sq.rating+'（'+sq.score+'分）。');

  return {text:lines.join('\n'),stars:starNames(stars),score:sq};
}

// ==================== 2. 事业财运 ====================
function analyzeCareerWealth(zi){
  var career=findPalace(zi,'官禄'),wealth=findPalace(zi,'财帛');
  var lines=[],cStars=getMajorStars(career),wStars=getMajorStars(wealth);

  // 官禄宫
  if(cStars.length===0){
    lines.push('官禄宫无主星，事业发展受对宫夫妻宫影响较大，适合借助伴侣或合作伙伴的力量开拓事业。');
  } else {
    cStars.forEach(function(s){
      var sm=STAR_PERSONALITY[s.name];
      if(sm)lines.push('事业：'+sm.substring(0,sm.indexOf('，')>0?sm.indexOf('，'):40)+'。');
    });
  }

  // 财帛宫
  if(wStars.length===0){
    var wEmpty=EMPTY_WEALTH;
    if(wEmpty)lines.push(wEmpty);
  } else {
    wStars.forEach(function(s){
      var wt=WEALTH_TEXT[s.name];
      if(wt)lines.push('财运：'+wt);
    });
  }

  // 四化影响
  var sihua=window._sihuaCol||[];
  sihua.forEach(function(sh){
    if(sh.palace==='官禄')lines.push('★ 化'+sh.hua+'在官禄：'+(sh.hua==='禄'?'事业顺遂，易得贵人提携':sh.hua==='权'?'事业有权威，能独当一面':sh.hua==='科'?'以专业能力获得认可，名声渐起':'事业压力较大，需稳扎稳打'));
    if(sh.palace==='财帛')lines.push('★ 化'+sh.hua+'在财帛：'+(sh.hua==='禄'?'财运亨通，收入来源稳定':sh.hua==='权'?'主动掌控财务，宜积极理财':sh.hua==='科'?'以专业技能赚取财富，信用良好':'财务需谨慎，避免冲动投资'));
  });

  return {text:lines.join('\n'),careerStars:starNames(cStars),wealthStars:starNames(wStars)};
}

// ==================== 3. 感情婚姻 ====================
function analyzeMarriage(zi){
  var spouse=findPalace(zi,'夫妻');
  if(!spouse)return {text:'夫妻宫数据缺失，请重新排盘。'};
  var lines=[],sStars=getMajorStars(spouse);

  if(sStars.length===0){
    lines.push(EMPTY_SPOUSE);
  } else {
    sStars.forEach(function(s){
      var txt=SPOUSE_TEXT[s.name];
      if(txt)lines.push(txt);
    });
  }

  // 桃花星分布
  var peach=[];
  zi.palaces.forEach(function(p){
    var all=starNames(getMajorStars(p)).concat(starNames(getMinorStars(p))).concat(starNames(getAdjStars(p)));
    var found=[];
    ['贪狼','廉贞','咸池','天姚','红鸾','天喜'].forEach(function(ps){
      if(all.indexOf(ps)>=0)found.push(ps);
    });
    if(found.length)peach.push({palace:p.name,stars:found});
  });

  if(peach.length>0){
    var peachLines=peach.map(function(p){return p.palace+'有'+p.stars.join('、');}).join('；');
    lines.push('桃花星分布：'+peachLines+'。');
    var totalPeach=0;peach.forEach(function(p){totalPeach+=p.stars.length;});
    if(totalPeach>=4)lines.push('桃花星较多，异性缘旺盛，感情经历丰富，需注意把握分寸。');
    else if(totalPeach>=2)lines.push('桃花适中，感情缘分正常，不会过于平淡也不至于太复杂。');
  }

  // 化忌在夫妻
  var sihua=window._sihuaCol||[];
  sihua.forEach(function(sh){
    if(sh.palace==='夫妻'&&sh.hua==='忌'){
      lines.push('★ 化忌入夫妻宫，感情上需付出更多心力，容易因小事产生摩擦，建议多沟通、少计较。');
    }
  });

  return {text:lines.join('\n'),spouseStars:starNames(sStars),peach:peach};
}

// ==================== 4. 四化点睛 ====================
var SIHUA_INSIGHT={
'命宫':{
  禄:'命宫化禄，天生带有福气和贵人缘，一生机遇较多，善于把握机会。',
  权:'命宫化权，个性强势，有领导能力和掌控欲，适合做决策者。',
  科:'命宫化科，温文尔雅，以才学和修养立身，名声较好。',
  忌:'命宫化忌，一生需经历磨炼方能成长，不宜强求，顺其自然反而有解。'
},
'财帛':{
  禄:'财帛化禄，财运亨通，正财运佳，收入稳定且常有意外之财。',
  权:'财帛化权，对财务有掌控力，适合主动理财和投资，财运靠自己打拼。',
  科:'财帛化科，以专业能力获取财富，信用良好，适合靠名声和技术赚钱。',
  忌:'财帛化忌，财运需谨慎，不宜冒险投资，守成为上。'
},
'官禄':{
  禄:'官禄化禄，事业顺遂，易得贵人赏识和提拔，职场运势佳。',
  权:'官禄化权，事业上有权威和话语权，适合独当一面、自主创业。',
  科:'官禄化科，以专业能力和德行获得认可，事业名声渐起。',
  忌:'官禄化忌，事业上压力较大，需脚踏实地，不宜好高骛远。'
},
'夫妻':{
  禄:'夫妻化禄，感情缘分好，婚姻中能互相滋养，但需防桃花过多。',
  权:'夫妻化权，婚姻中一方较为强势，需要平衡权力关系方能长久。',
  科:'夫妻化科，婚姻和谐，以礼相待，感情细水长流。',
  忌:'夫妻化忌，感情上容易有波折和误会，需要多花心思经营。'
},
'福德':{
  禄:'福德化禄，精神享受丰富，心态乐观，晚年福气好。',
  权:'福德化权，内心有主见和追求，精神世界充实但有时思虑过重。',
  科:'福德化科，内心平和文雅，有精神寄托和修养。',
  忌:'福德化忌，容易钻牛角尖，精神压力较大，需要学会放松。'
},
'迁移':{
  禄:'迁移化禄，外出运佳，适合在外发展，出差旅行常有收获。',
  权:'迁移化权，在外有魄力和影响力，适合到更大的平台发展。',
  科:'迁移化科，在外名声好，以才华和修养获得认可。',
  忌:'迁移化忌，外出需谨慎，在外容易遇到麻烦，不宜贸然变动。'
},
'子女':{
  禄:'子女化禄，子女缘分好，后代能带来福气，也利于合伙投资。',
  权:'子女化权，对子女管教较严，子女有主见和魄力。',
  科:'子女化科，子女有才学，教育运好，师徒缘分佳。',
  忌:'子女化忌，为子女操心较多，需耐心教育，不宜过度保护。'
},
'田宅':{
  禄:'田宅化禄，家运好，房产运佳，适合置业投资。',
  权:'田宅化权，家庭中有话语权，适合主导家庭事务和投资。',
  科:'田宅化科，家宅温馨，邻里和睦，家庭有文化氛围。',
  忌:'田宅化忌，家庭事务需多费心，房产投资需谨慎。'
},
'疾厄':{
  禄:'疾厄化禄，身体素质不差，恢复能力强，但需防口福过度。',
  权:'疾厄化权，意志力强能克服疾病，但容易积劳成疾。',
  科:'疾厄化科，注重养生和调理，健康状况平稳。',
  忌:'疾厄化忌，体质较为敏感，需注意日常保养和定期检查。'
}
};

function analyzeSiHua(){
  var sihua=window._sihuaCol||[];
  if(!sihua.length)return {text:'此命盘无生年四化。',items:[]};
  var items=[];
  sihua.forEach(function(sh){
    var insight=SIHUA_INSIGHT[sh.palace]&&SIHUA_INSIGHT[sh.palace][sh.hua];
    items.push({
      star:sh.star,hua:sh.hua,palace:sh.palace,color:sh.color,
      text:insight||sh.star+'化'+sh.hua+'在'+sh.palace+'，影响着命盘的相关领域。'
    });
  });
  return {items:items};
}

// ==================== 5. 三方吉凶 ====================
var TRIAD_AXES=[
  {name:'命财官线',palaces:['命宫','财帛','官禄'],desc:'事业成就与人生格局的核心轴线'},
  {name:'兄疾田线',palaces:['兄弟','疾厄','田宅'],desc:'家庭健康与内在安全感的根基'},
  {name:'夫子友线',palaces:['夫妻','子女','仆役'],desc:'婚姻子息与人际关系的情感世界'},
  {name:'迁福母线',palaces:['迁移','福德','父母'],desc:'外出发展与精神福报的外在支持'}
];

function scoreTriadAxis(zi,axisPalaces){
  var score=0,highlights=[];
  axisPalaces.forEach(function(pName){
    var p=findPalace(zi,pName);if(!p)return;
    getMajorStars(p).forEach(function(s){
      var b=scoreBright(s.brightness||'');score+=b;
      if(s.mutagen==='禄'){score+=10;highlights.push(pName+'化禄');}
      else if(s.mutagen==='权'){score+=8;highlights.push(pName+'化权');}
      else if(s.mutagen==='科'){score+=6;highlights.push(pName+'化科');}
      else if(s.mutagen==='忌'){score-=10;highlights.push(pName+'化忌');}
    });
    getMinorStars(p).forEach(function(s){
      if(ZW_GOOD.indexOf(s.name)>=0)score+=5;
      if(ZW_BAD.indexOf(s.name)>=0)score-=5;
    });
  });
  var rating=score>=40?'大吉':score>=20?'吉':score>=0?'平':score>=-20?'中平':'凶';
  return {score:score,rating:rating,highlights:highlights};
}

function analyzeTriads(zi){
  return TRIAD_AXES.map(function(axis){
    var result=scoreTriadAxis(zi,axis.palaces);
    var summary='';
    if(result.rating==='大吉')summary='三方汇聚吉星，格局有力，此轴线为命盘之优势所在。';
    else if(result.rating==='吉')summary='三方吉多凶少，整体运势向好，遇到困难也能化解。';
    else if(result.rating==='平')summary='三方吉凶参半，需要通过努力来平衡，不宜躺平。';
    else if(result.rating==='中平')summary='三方煞星较多，此领域需要加倍努力，但克服困难后成长更大。';
    else summary='三方凶星聚集，此轴线为命盘之挑战所在，需谨慎应对，寻求化解之道。';
    return {
      name:axis.name,palaces:axis.palaces.join(' · '),desc:axis.desc,
      score:result.score,rating:result.rating,summary:summary,
      highlights:result.highlights.join('，')
    };
  });
}

// ==================== 渲染函数 ====================
function renderZwAnalysis(zi){
  var container=document.getElementById('zwAnalysis');
  if(!container){container=document.createElement('div');container.id='zwAnalysis';var triads=document.getElementById('triads');if(triads&&triads.parentNode)triads.parentNode.insertBefore(container,triads.nextSibling);else document.body.appendChild(container);}
  container.innerHTML='';

  // === 命宫总览 ===
  var ming=analyzeMingGong(zi);
  container.appendChild(buildSection('命宫总览',formatText(ming.text),'#e8d5a3'));

  // === 事业财运 ===
  var cw=analyzeCareerWealth(zi);
  container.appendChild(buildSection('事业财运',formatText(cw.text),'#5b9fd4'));

  // === 感情婚姻 ===
  var mar=analyzeMarriage(zi);
  container.appendChild(buildSection('感情婚姻',formatText(mar.text),'#e07050'));

  // === 四化点睛 ===
  var shData=analyzeSiHua();
  var shHTML='';
  if(shData.items.length){
    shData.items.forEach(function(item){
      shHTML+='<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;padding:8px 12px;background:rgba(255,255,255,.02);border-radius:8px;border-left:3px solid '+item.color+'">';
      shHTML+='<span style="color:'+item.color+';font-weight:bold;font-size:16px;min-width:24px">'+item.star.charAt(0)+'</span>';
      shHTML+='<div><span style="color:'+item.color+';font-weight:bold">'+item.star+'化'+item.hua+'</span><span style="color:var(--tx3);font-size:11px"> @ '+item.palace+'</span>';
      shHTML+='<p style="margin:4px 0 0;font-size:13px;color:var(--tx2)">'+item.text+'</p></div></div>';
    });
  } else {
    shHTML='<p style="color:var(--tx3)">'+shData.text+'</p>';
  }
  container.appendChild(buildSection('四化点睛',shHTML,'#e8a040'));

  // === 三方吉凶（替代原有triads） ===
  var triadsData=analyzeTriads(zi);
  var triadsHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  var ratingColors={大吉:'#4CAF50',吉:'#c9a84c',平:'#8a8580',中平:'#e07050',凶:'#F44336'};
  triadsData.forEach(function(t){
    triadsHTML+='<div style="background:rgba(13,21,37,.6);border:1px solid rgba(91,127,165,.08);border-radius:10px;padding:14px">';
    triadsHTML+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
    triadsHTML+='<span style="font-size:14px;color:var(--gold-l);letter-spacing:2px;font-weight:700">'+t.name+'</span>';
    triadsHTML+='<span style="font-size:12px;font-weight:700;color:'+(ratingColors[t.rating]||'#8a8580')+'">'+t.rating+' ('+(t.score>0?'+':'')+t.score+')</span>';
    triadsHTML+='</div>';
    triadsHTML+='<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">'+t.palaces+'</div>';
    triadsHTML+='<div style="font-size:13px;color:var(--tx2);line-height:1.7">'+t.summary+'</div>';
    triadsHTML+='</div>';
  });
  triadsHTML+='</div>';
  container.appendChild(buildSection('三方吉凶',triadsHTML,'#5b9fd4'));
}

function buildSection(title,content,accentColor){
  var sec=document.createElement('div');
  sec.className='zw-section';
  sec.style.cssText='background:var(--card);border:1px solid var(--bd);border-radius:var(--radius);padding:16px 18px;margin-bottom:10px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)';
  var id='zwsec_'+Math.random().toString(36).slice(2,8);

  var header=document.createElement('div');
  header.className='zw-sec-header';
  header.style.cssText='cursor:pointer;display:flex;align-items:center;gap:8px;margin-bottom:8px;user-select:none';

  var arrow=document.createElement('span');
  arrow.className='zw-sec-arrow';
  arrow.style.cssText='display:inline-block;transition:transform .3s;color:var(--gold);font-size:12px';
  arrow.textContent='▼';

  var titleSpan=document.createElement('span');
  titleSpan.style.cssText='font-size:14px;color:'+(accentColor||'var(--gold-l)')+';letter-spacing:3px;font-weight:700';
  titleSpan.textContent=title;

  header.appendChild(arrow);
  header.appendChild(titleSpan);

  var body=document.createElement('div');
  body.id=id;
  body.style.cssText='font-size:13px;color:var(--tx2);line-height:2;text-align:justify';
  body.innerHTML=content;

  header.addEventListener('click',function(){
    if(body.style.display==='none'){
      body.style.display='block';arrow.style.transform='rotate(0deg)';
    } else {
      body.style.display='none';arrow.style.transform='rotate(-90deg)';
    }
  });

  var aiHook=document.createElement('div');
  aiHook.className='zw-ai-hook';
  aiHook.style.cssText='margin-top:12px;padding:10px 14px;background:rgba(201,168,76,.06);border:1px dashed var(--bd2);border-radius:8px;text-align:center;cursor:pointer;font-size:13px;color:var(--gold);transition:all .25s';
  aiHook.textContent='查看AI完整解读 →';
  aiHook.addEventListener('mouseenter',function(){this.style.background='rgba(201,168,76,.12)';this.style.color='var(--gold-l)';});
  aiHook.addEventListener('mouseleave',function(){this.style.background='rgba(201,168,76,.06)';this.style.color='var(--gold)';});
  aiHook.addEventListener('click',function(){window.open('/ai-chat?t=zw','_blank');});

  sec.appendChild(header);
  sec.appendChild(body);
  sec.appendChild(aiHook);
  return sec;
}

function formatText(txt){
  if(!txt)return'';
  return txt.split('\n').filter(Boolean).map(function(line){
    if(line.indexOf('★')===0)return'<p style="color:var(--gold-l);margin:4px 0">'+line+'</p>';
    return'<p style="margin:4px 0">'+line+'</p>';
  }).join('');
}
