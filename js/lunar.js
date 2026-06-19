/**
 * 知时 - 农历/公历互转（自包含，零外部依赖）
 * 数据：1900-2100，来源寿星万年历
 * 编码：lunarInfo[y-1900] 每字节编码闰月+大小月
 *   bit 0-3:  闰月月份(0=无)
 *   bit 4-15: 12个月大小(bit4=腊月..bit15=正月, 1=30d,0=29d)
 *   bit 16:   闰月大小(1=30d)
 */
var LunarCalendar = (function(){
  var lunarInfo = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a4d0,0x0d150,0x0f252,0x0d520];

  var GAN=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var ZHI=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var SX=['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
  var LM=['正','二','三','四','五','六','七','八','九','十','十一','十二'];
  var LD=['','初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];

  // --- 春节表 (公历月,日) ---
  var SPRING=[
    [1,31],[2,19],[2,8],[1,29],[2,16],[2,4],[1,25],[2,13],[2,2],[1,22],[2,10],[1,30],[2,18],[2,6],[1,26],[2,14],[2,3],[1,23],[2,11],[2,1],[2,20],[2,8],[1,28],[2,16],[2,5],[1,24],[2,13],[2,2],[1,23],[2,10],[1,30],[2,17],[2,6],[1,26],[2,14],[2,4],[1,24],[2,11],[1,31],[2,19],[2,8],[1,27],[2,15],[2,5],[1,25],[2,13],[2,2],[1,22],[2,10],[1,29],[2,17],[2,6],[1,27],[2,14],[2,3],[1,24],[2,12],[1,31],[2,18],[2,8],[1,28],[2,15],[2,5],[1,25],[2,13],[2,2],[1,21],[2,9],[1,30],[2,17],[2,6],[1,27],[2,15],[2,3],[1,23],[2,11],[1,31],[2,18],[2,7],[1,28],[2,16],[2,5],[1,25],[2,13],[2,2],[2,20],[2,9],[1,29],[2,17],[2,6],[1,27],[2,15],[2,4],[1,23],[2,10],[1,31],[2,19],[2,7],[1,28],[2,16],[2,5],[1,24],[2,12],[2,1],[1,22],[2,9],[1,29],[2,18],[2,7],[1,26],[2,14],[2,3],[1,23],[2,11],[1,31],[2,19],[2,8],[1,28],[2,15],[2,4],[1,24],[2,12],[2,1],[1,22],[2,10],[1,30],[2,17],[2,6],[1,26],[2,14],[2,3],[1,23],[2,10],[1,31],[2,19],[2,7],[1,27],[2,15],[2,5],[1,25],[2,12],[2,2],[1,22],[2,9],[1,29],[2,17],[2,7],[1,27],[2,14],[2,3],[1,24],[2,12],[2,1],[1,21],[2,9],[1,29],[2,17],[2,5],[1,26],[2,14],[2,3],[1,23],[2,11],[1,31],[2,19],[2,7],[1,27],[2,15],[2,5],[1,24],[2,12],[2,2],[1,22],[2,9],[1,29],[2,18],[2,7],[1,26],[2,14],[2,3],[1,23],[2,10],[1,30],[2,18],[2,7],[1,27],[2,15],[2,5],[1,25],[2,12],[2,1],[1,21],[2,9]
  ];

  function leapMonth(y){return lunarInfo[y-1900]&0xf;}
  function leapDays(y){var m=leapMonth(y);return m?(lunarInfo[y-1900]&0x10000?30:29):0;}
  function monthDays(y,m){return lunarInfo[y-1900]&(0x10000>>m)?30:29;}
  function lYearDays(y){var i,s=348;for(i=0x8000;i>0x8;i>>=1)s+=(lunarInfo[y-1900]&i)?1:0;return s+leapDays(y);}

  function solarDays(y,m){if(m===2)return(y%4===0&&y%100!==0)||(y%400===0)?29:28;return[31,28,31,30,31,30,31,31,30,31,30,31][m-1];}
  function s2d(y,m,d){var t=0,i;for(i=1900;i<y;i++)t+=solarDays(i,2)===29?366:365;for(i=1;i<m;i++)t+=solarDays(y,i);return t+d-31;}
  function d2s(days){var y=1900,m;while(true){var yd=solarDays(y,2)===29?366:365;if(days<yd)break;days-=yd;y++;}for(m=1;m<=12;m++){var md=solarDays(y,m);if(days<md)return{year:y,month:m,day:days+1};days-=md;}return{year:y,month:12,day:31};}

  /** 公历→农历 */
  function solarToLunar(y,m,d){
    var offset=s2d(y,m,d),ly=1900;
    while(ly<=2100){var yd=lYearDays(ly);if(offset<yd)break;offset-=yd;ly++;}
    var leap=leapMonth(ly),lm=1,isLeap=false,i;
    for(i=1;i<=12;i++){
      var md=monthDays(ly,i);
      if(offset<md){lm=i;break;}
      offset-=md;
      if(i===leap){var ld=leapDays(ly);if(offset<ld){lm=i;isLeap=true;break;}offset-=ld;}
    }
    var ld=offset+1;
    var yg=GAN[(ly-4)%10],yz=ZHI[(ly-4)%12];
    return{lYear:ly,lMonth:lm,lDay:ld,isLeap:isLeap,yearGan:yg,yearZhi:yz,animal:SX[(ly-4)%12],yearName:yg+yz+'年',monthName:(isLeap?'闰':'')+LM[lm-1]+'月',dayName:LD[ld]};
  }

  /** 农历→公历（以春节为锚点） */
  function lunarToSolar(ly,lm,ld,isLeap){
    var spr=SPRING[ly-1900];
    var base=Date.UTC(ly,spr[0]-1,spr[1]); // 春节 UTC 时间戳
    var days=0,i,leap=leapMonth(ly);
    for(i=1;i<lm;i++){days+=monthDays(ly,i);if(i===leap)days+=leapDays(ly);}
    if(isLeap&&leap===lm&&lm>1)days+=monthDays(ly,lm);
    days+=ld-1;
    var d=new Date(base+days*86400000);
    return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};
  }

  /** 某年是否有闰月（用于UI） */
  function hasLeapMonth(y){return leapMonth(y)>0;}

  return{solarToLunar:solarToLunar,lunarToSolar:lunarToSolar,hasLeapMonth:hasLeapMonth,leapMonth:leapMonth,monthDays:monthDays,LUNAR_MONTH:LM,LUNAR_DAY:LD,GAN:GAN,ZHI:ZHI,ANIMALS:SX};
})();