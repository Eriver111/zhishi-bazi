// Build display-only facts with the same functions used by the normal chart.
// No reverse birth-date lookup, strength, pattern or event prediction is run.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let calculator;
function getCalculator(){
  if(!calculator){const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/bazi.js'),'utf8'),context,{filename:'bazi.js',timeout:5000});calculator=context.window.BaZiCalculator;}
  return calculator;
}
function column(value,dayGan,isDay){
  const calc=getCalculator(),gan=value[0],zhi=value[1];
  if(!calc.TIAN_GAN.includes(gan)||!calc.DI_ZHI.includes(zhi)||value.length!==2||calc.TIAN_GAN.indexOf(gan)%2!==calc.DI_ZHI.indexOf(zhi)%2)throw Error('Invalid display pillar');
  return {gan,zhi,ganElement:calc.WU_XING[gan],zhiElement:calc.DI_ZHI_WU_XING[zhi],god:isDay?'日主':calc.getShiShen(dayGan,gan),
    hidden:Array.from(calc.getCangGan(zhi),g=>({gan:g,element:calc.WU_XING[g],god:calc.getShiShen(dayGan,g)})),
    star:calc.getChangSheng(dayGan)[zhi].stage,seat:calc.getChangSheng(gan)[zhi].stage};
}
function buildChart(pillars,luck){
  if(!Array.isArray(pillars)||pillars.length!==4||!pillars.every(p=>typeof p==='string')||!Array.isArray(luck))throw Error('Invalid display chart');
  const dayGan=pillars[2][0];
  return {pillars:pillars.map((p,i)=>column(p,dayGan,i===2)),luck:luck.map(p=>column(p,dayGan,false))};
}
module.exports={buildChart};
