const iztro=require('iztro');
module.exports=async function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS')return res.status(200).end();
  try{
    var b=req.body||{},y=+b.y,m=+b.m,d=+b.d,ti=+b.ti||0,g=b.g||'male';
    if(!y||!m||!d){return res.status(400).json({error:'missing birth data'});}
    var z=iztro.astro.bySolar(y+'-'+m+'-'+d,ti,g,true,'zh-CN');
    return res.status(200).json({
      palaces:z.palaces.map(function(p){return{
        name:p.name,heavenlyStem:p.heavenlyStem,earthlyBranch:p.earthlyBranch,
        majorStars:p.majorStars,minorStars:p.minorStars,adjectiveStars:p.adjectiveStars,
        changsheng12:p.changsheng12,boshi12:p.boshi12,jiangqian12:p.jiangqian12,suiqian12:p.suiqian12,
        decadal:p.decadal,ages:p.ages
      };}),fiveElementsClass:z.fiveElementsClass,soul:z.soul,body:z.body,
      earthBranchSoul:z.earthlyBranchOfSoulPalace,earthBranchBody:z.earthlyBranchOfBodyPalace,
      chineseDate:z.chineseDate,lunarDate:z.lunarDate
    });
  }catch(e){return res.status(500).json({error:e.message});}
};
