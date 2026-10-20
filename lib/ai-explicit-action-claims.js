'use strict';
// Narrow, literal assertions and explicitly stated invalid implications.
// No event labels, case IDs, outcome probabilities or verdicts belong here.
const stems='甲乙丙丁戊己庚辛壬癸',branches='子丑寅卯辰巳午未申酉戌亥';
const wx=Object.fromEntries([...stems].map((g,i)=>[g,'木火土金水'[Math.floor(i/2)]]));
const generates={木:'火',火:'土',土:'金',金:'水',水:'木'},controls={木:'土',火:'金',土:'水',金:'木',水:'火'};
const owner='(?:(?:流年|大运|原局|日主|日元|天干|[年月日时](?:柱|干|支)|你|的)\\s*){0,4}';
const adverbs='(?:(?:都|又|同时|直接|正好|继续|再次|来|去|会|正|在|就)\\s*){0,4}';
const godNote='(?:[（(][^）)\\n]{0,35}[）)])?';
const strip=text=>String(text||'').replace(/```[\s\S]*?```|^\s*>.*$/gm,'').replace(/“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"|'[^']*'/g,s=>' '.repeat(s.length)).replace(/[*#`]/g,'');
function qualified(text,index,length){
 const prefix=text.slice(0,index),local=prefix.split(/[，,；;]/).at(-1),after=text.slice(index+length);
 return /[?？]/.test(text)||/藏干|合化|化气|化成|化为|假设|假如|如果|倘若|例如|举例|引文|原文|上轮|上次|曾说/.test(text)||
  /(?:不能说|不是|并非|没有|并未|不应|不代表|不等于|不要|若|是否|尚未|此前把|误把)[^，,]*$/.test(local)||
  /^\s*[，,]?\s*(?:(?:的|这一|这个|这种)?(?:说法|判断|关系|表述))?(?:是|并)?(?:不成立|错误|错的|有误|不对|不正确)/.test(after);
}
function actual(a,b){
 if(generates[wx[a]]===wx[b])return a+'生'+b;
 if(generates[wx[b]]===wx[a])return b+'生'+a;
 if(controls[wx[a]]===wx[b])return a+'克'+b;
 if(controls[wx[b]]===wx[a])return b+'克'+a;
 return a+'与'+b+'同五行';
}
function validPunishment(a,b){return a===b?'辰午酉亥'.includes(a):['子卯','寅巳申','丑未戌'].some(g=>g.includes(a)&&g.includes(b));}
function literalGod(day,gan){
 const delta=('木火土金水'.indexOf(wx[gan])-'木火土金水'.indexOf(wx[day])+5)%5;
 return [['比肩','劫财'],['食神','伤官'],['偏财','正财'],['七杀','正官'],['偏印','正印']][delta][stems.indexOf(day)%2===stems.indexOf(gan)%2?0:1];
}
function validateExplicitActionClaims(data,reply){
 if(!data?.fourPillars||(data.type&&data.type!=='bazi'))return [];
 const text=strip(reply),warnings=[];
 const warnAction=(a,b,kind)=>warnings.push('E10-明确字对作用错误：'+a+wx[a]+'不能写成'+kind+b+wx[b]+'；按本五行为'+actual(a,b)+'。请撤回依赖此错误方向的中间推论和主判断，重新检查完整依据；纠错不意味着相反事件成立。');
 for(const clause of text.match(/[^。！？；;\n]+[。！？；;\n]?/g)||[]){
  const t='(['+stems+'])(?:[木火土金水])?'+godNote;let m;
  const re=new RegExp(t+'\\s*'+adverbs+'(生|克)(?:制|住|着|了)?\\s*'+owner+t,'g');
  while((m=re.exec(clause))){
   if(qualified(clause,m.index,m[0].length))continue;
   if((m[2]==='生'?generates:controls)[wx[m[1]]]!==wx[m[3]])warnAction(m[1],m[3],m[2]);
  }
  const passive=new RegExp(t+'\\s*被\\s*'+owner+t+'\\s*'+adverbs+'(生|克)(?:制|住|着|了)?','g');
  while((m=passive.exec(clause))){if(!qualified(clause,m.index,m[0].length)&&(m[3]==='生'?generates:controls)[wx[m[2]]]!==wx[m[1]])warnAction(m[2],m[1],m[3]);}
  const same=new RegExp(t+'\\s*(?:与|和|跟)\\s*'+owner+t+'\\s*(?:是|为|属于)?同(?:气|五行)','g');
  while((m=same.exec(clause)))if(!qualified(clause,m.index,m[0].length)&&wx[m[1]]!==wx[m[2]])warnAction(m[1],m[2],'同气于');
  // Several natal columns described as one exposed stem. Do not confuse
  // this with the main hidden stem of two branches (e.g. two 寅藏甲).
  const grouped=/((?:[年月日时](?:柱|干)\s*(?:、|和|与|及|，)\s*)+[年月日时](?:柱|干))\s*(?:都|均|全)是\s*([甲乙丙丁戊己庚辛壬癸])(?:[木火土金水])?/g;
  while((m=grouped.exec(clause))){
   if(qualified(clause,m.index,m[0].length))continue;
   const pos={年:'year',月:'month',日:'day',时:'hour'},wrong=[];
   for(const p of m[1].matchAll(/([年月日时])(?:柱|干)/g)){
    const actual=data.fourPillars[pos[p[1]]]?.gan;
    if(actual&&actual!==m[2])wrong.push(p[1]+'干实际为'+actual);
   }
   if(wrong.length)warnings.push('E10-多柱天干归属错误：'+m[0]+'与冻结四柱不符，'+wrong.join('、')+'。同一地支的藏干不等于柱上透干；撤回依赖错误位置的性格或家庭事件结论，按真实位置重审。');
  }
  const groupedGod=/((?:[年月日时](?:柱|干)\s*(?:、|和|与|及|，)\s*)+[年月日时](?:柱|干))\s*(?:都|均|全)是\s*(比肩|劫财|食神|伤官|正财|偏财|正官|七杀|正印|偏印)/g;
  while((m=groupedGod.exec(clause))){
   const day=data.fourPillars.day?.gan;
   if(!wx[day]||qualified(clause,m.index,m[0].length)||/藏干|本气|地支|柱中/.test(clause))continue;
   const pos={年:'year',月:'month',日:'day',时:'hour'},wrong=[];
   for(const p of m[1].matchAll(/([年月日时])(?:柱|干)/g)){
    const gan=data.fourPillars[pos[p[1]]]?.gan;
    if(wx[gan]&&literalGod(day,gan)!==m[2])wrong.push(p[1]+'干'+gan+'为'+literalGod(day,gan));
   }
   if(wrong.length)warnings.push('E10-多柱十神归属错误：'+m[0]+'与日干'+day+'对应的透干身份不符，'+wrong.join('、')+'。逐柱核对，不把同一种十神套到所有柱上；撤回依赖此错误归属的性格、家庭或事件推论。');
  }
  const pair='(['+branches+'])(?:[木火土金水])?';
  for(const re of [new RegExp(pair+'\\s*(?:与|和|跟)?\\s*'+owner+pair+'\\s*'+adverbs+'(?:构成|形成)?(?:相刑|自刑|互刑|三刑)','g'),
   new RegExp(pair+'\\s*'+adverbs+'刑(?:了)?\\s*'+owner+pair,'g')]){
   while((m=re.exec(clause)))if(!qualified(clause,m.index,m[0].length)&&!validPunishment(m[1],m[2]))warnings.push('E10-明确地支刑配对错误：'+m[1]+m[2]+'不在子卯、寅巳申、丑未戌的刑组或辰午酉亥自刑内。撤回依赖此配对的事件推论；这里只核对组员，不判效力与吉凶。');
  }
 }
 // Heading and immediately following explicit endpoints, not an unrestricted
 // search across paragraphs. The quoted pair in the captured reply is not needed.
 for(const block of text.split(/\n\s*\n/)){
  const re=/^(?:[一二三四五六七八九十0-9]+[、.．]\s*)?夫妻宫被刑[。：:]?\s*流年(?:地支)?([子丑寅卯辰巳午未申酉戌亥])(?:[木火土金水])?(?:与|和)(?:你的|你)?日支([子丑寅卯辰巳午未申酉戌亥])/;
  const m=re.exec(block.trim());
  if(m&&m[2]===data.fourPillars.day?.zhi&&!validPunishment(m[1],m[2]))warnings.push('E10-夫妻宫刑的依据错误：标题称夫妻宫被刑，但随后列出的流年'+m[1]+'与日支'+m[2]+'不构成刑组。撤回该依据及依赖它的结果，不替换成另一种事件来圆说。');
 }
 return [...new Set(warnings)];
}
function validatePalaceAbsenceInference(data,reply){
 if(!data?.fourPillars||(data.type&&data.type!=='bazi'))return [];
 // Keep short quoted conclusion labels; a full quoted faulty inference
 // remains excluded as a quotation, just like literal-claim validation.
 const phraseText=String(reply||'').replace(/“([^”]{1,25})”|「([^」]{1,25})」/g,(all,a,b)=>/夫妻宫|日支/.test(a||b)?all:(a||b));
 const text=strip(phraseText),warnings=[];
 for(const block of text.split(/\n\s*\n/)){
  if(/假如|如果|假设|举例|上轮|引文|原文/.test(block))continue;
  const absence=/(?:(?:夫妻宫|日支)[^。！？\n]{0,80}(?:没有|并无|未见|未被|没被)[^。！？\n]{0,24}(?:冲|合|刑|害)|(?:没有|并无|未见)[^。！？\n]{0,12}(?:冲|合|刑|害)(?:动|到|及)?(?:你的|你|的)?(?:夫妻宫|日支))/.exec(block);
  if(!absence)continue;
  const tail=block.slice(absence.index+absence[0].length,absence.index+absence[0].length+240);
  if(/不等于|不代表|不能据此|不足以(?:证明|排除|判断)|无法据此/.test(tail))continue;
  const inference=/(?:所以|因此|意味着|说明|反而|更符合|更像)[^。！？\n]{0,110}(?:不会(?:结婚|成婚|登记|分手)|不是(?:结婚|成婚|分手|结束|婚姻登记)|而不是[^。！？\n]{0,10}(?:结束|结婚|成婚|登记|分手|破裂|变化)|排除(?:结婚|成婚|登记|分手)|(?:感情|婚恋)[^。！？\n]{0,15}不是主线)/.exec(tail);
  if(inference&&!qualified(tail,inference.index,inference[0].length))warnings.push('E10-以宫位无接触排除事件：没有日支直接冲合刑害，不构成不会结婚、不会分手或只能恋爱开始的充分依据。撤回这条排除理由，比较配偶星及岁运实际作用与独立证据；可以保留有其他依据的主判断，但不能默认反断结婚，也不能把候选菜单当答案。');
 }
 return warnings.length?[warnings[0]]:[];
}
module.exports={validateExplicitActionClaims,validatePalaceAbsenceInference};
