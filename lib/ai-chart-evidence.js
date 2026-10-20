'use strict';
const {validateExplicitActionClaims,validatePalaceAbsenceInference}=require('./ai-explicit-action-claims');

// Only literal, fully supplied chart facts. This does not adjudicate root strength.
const positions = ['year', 'month', 'day', 'hour'];
const labels = { year: '年支', month: '月支', day: '日支', hour: '时支' };
const elements = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const branchElements = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' };
const hiddenStems = { 子:['癸'],丑:['己','癸','辛'],寅:['甲','丙','戊'],卯:['乙'],辰:['戊','乙','癸'],巳:['丙','庚','戊'],午:['丁','己'],未:['己','丁','乙'],申:['庚','壬','戊'],酉:['辛'],戌:['戊','辛','丁'],亥:['壬','甲'] };
function chartEvidence(data) {
  if (!data || (data.type && data.type !== 'bazi') || !data.fourPillars) return null;
  const pillars=data.fourPillars;
  if (!positions.every(p=>pillars[p] && elements[pillars[p].gan] && branchElements[pillars[p].zhi])) return null;
  const literal={木:0,火:0,土:0,金:0,水:0}, stems={...literal}, branches={...literal}, dayElement=elements[pillars.day.gan];
  for (const pos of positions) { literal[elements[pillars[pos].gan]]++; literal[branchElements[pillars[pos].zhi]]++; stems[elements[pillars[pos].gan]]++; branches[branchElements[pillars[pos].zhi]]++; }
  const roots=positions.filter(pos=>hiddenStems[pillars[pos].zhi].some(gan=>elements[gan]===dayElement));
  return {literal,stems,branches,roots,dayElement,branchChars:positions.map(pos=>pillars[pos].zhi),rootLabels:roots.map(pos=>labels[pos]+pillars[pos].zhi)};
}
function chartEvidenceContext(data, question) {
  const e=chartEvidence(data); if(!e)return '';
  const ranges=literalDaYunRanges(data).ranges;
  const timing=ranges.length ? '\n【大运公历区间核对】源排盘提供：'+ranges.map(c=>c.gan+c.zhi+'运 '+c.startYear+'—'+c.endYear+'年').join('；')+'。区间按源数据照录，不把年龄当公历年份；边界年的实际交接须看具体交运时刻。岁运天克地冲、伏吟或体感转折不等于刚换大运，不能把运中年份说成前运刚结束、新运刚开始。\n' : '';
  return '\n【字数与根的位置核对】八个表层干支按本五行计数（不含藏干、不加月令权重）：'+Object.entries(e.literal).map(([k,v])=>k+v+'字').join('、')+'。这不是强弱分。\n原局四支按年月日时为：'+e.branchChars.join('、')+'。岁运中的支必须另标来源，不能写成原局已有。\n日主同五行藏干出现于：'+(e.rootLabels.join('、')||'四支均未见')+'。存在不等于有力，受冲合或失令不等于藏干消失；日支单独无根不能覆盖其他支的根。\n'+hiddenGodContext(data)+visibleActorContext(data)+timing+literalIdentityContext(data,question)+singleSpouseRoleContext(data);
}
function visibleActorContext(data) {
  const day=data.fourPillars.day.gan;
  const peers=positions.filter(p=>p!=='day'&&elements[data.fourPillars[p].gan]===elements[day]);
  const names={year:'年干',month:'月干',hour:'时干'};
  return '【作用主体核对】日干'+day+'是本人，不是另一个比肩人物。原局其他透干比劫载体：'+
    (peers.map(p=>names[p]+data.fourPillars[p].gan+'（'+literalGod(day,data.fourPillars[p].gan)+'）').join('、')||'无')+
    '。日主克财与其他比劫克财分开；同类字的数量不是竞争者人数，也不是作用强弱。比劫不自动指定朋友、合伙人或来分钱的人。\n';
}
function literalGod(dayGan,gan) {
  const stems='甲乙丙丁戊己庚辛壬癸', order='木火土金水';
  const delta=(order.indexOf(elements[gan])-order.indexOf(elements[dayGan])+5)%5;
  const opposite=stems.indexOf(gan)%2!==stems.indexOf(dayGan)%2;
  return [['比肩','劫财'],['食神','伤官'],['偏财','正财'],['七杀','正官'],['偏印','正印']][delta][opposite?1:0];
}
// Position-bearing, recomputable identities only. The returned references are
// not evidence that a traditional relation caused a real-world event.
function chartIdentityFacts(data,question) {
  if(!chartEvidence(data))return null;
  const dayGan=data.fourPillars.day.gan,nodes=[];
  const add=(scope,label,pillar)=>{
    if(!pillar||!elements[pillar.gan]||!hiddenStems[pillar.zhi])return;
    nodes.push({id:scope+':gan',scope,label:label+'干',kind:'stem',gan:pillar.gan,god:literalGod(dayGan,pillar.gan)});
    hiddenStems[pillar.zhi].forEach((gan,index)=>nodes.push({id:scope+':zhi:'+gan,scope,label:label+'支',kind:'hidden-stem',zhi:pillar.zhi,gan,mainQi:index===0,god:literalGod(dayGan,gan)}));
  };
  for(const pos of positions)add('natal:'+pos,{year:'年柱',month:'月柱',day:'日柱',hour:'时柱'}[pos],data.fourPillars[pos]);
  const cycles=literalDaYunRanges(data);
  cycles.ranges.forEach(c=>add('dayun:'+c.startYear+'-'+c.endYear,c.gan+c.zhi+'大运',c));
  const requested=data?.timingAdjudication?.requestedYear;
  const wanted=explicitYears(question),annual=[];
  if(requested&&Number.isInteger(Number(requested.year))&&(!wanted.length||wanted.length===1&&wanted[0]===Number(requested.year))){
    const y=Number(requested.year);
    if(elements[requested.liuNian?.gan]&&hiddenStems[requested.liuNian?.zhi]){
      add('annual:'+y,y+'流年',requested.liuNian);
      annual.push({year:y,gan:requested.liuNian.gan,zhi:requested.liuNian.zhi});
    }
    add('requested-dayun:'+y,y+'年所行大运',requested.daYun);
  }
  return {version:'chart-identities-v1',dayGan,nodes,annual,cycles:cycles.ranges,cyclesUnambiguous:cycles.unambiguous,eventEstablished:false};
}
function literalIdentityContext(data,question) {
  const facts=chartIdentityFacts(data,question);if(!facts)return '';
  const scopes=[...new Set(facts.nodes.filter(n=>n.kind==='stem').map(n=>n.scope))];
  const lines=scopes.map(scope=>{
    const parts=facts.nodes.filter(n=>n.scope===scope),stem=parts.find(n=>n.kind==='stem');
    if(scope.startsWith('natal:'))return stem.label+stem.gan+'＝'+stem.god+' ['+stem.id+']';
    const hidden=parts.filter(n=>n.kind==='hidden-stem');
    return stem.label+stem.gan+'＝'+stem.god+'；'+hidden[0].label+hidden[0].zhi+'藏'+hidden.map(n=>n.gan+'＝'+n.god+(n.mainQi?'（本气）':'')).join('、')+' ['+scope+']';
  });
  return '\n【逐字十神身份核对】日干参照固定为'+facts.dayGan+'：\n'+lines.join('\n')+'\n十神正偏按具体天干及阴阳核对；同五行不等于同一十神。地支须区分本气与其他藏干，不能把整支全部藏干写成同一十神。引用关系时先核对这里的字与位置，再分析作用；身份正确不证明考试、收入或家庭事件成立。\n';
}

function identityClaimClauses(reply,question,dayGan) {
  const alternate=text=>/合盘|换太极|换日主|换参照|改参照|(?:不同|另一|其他)(?:的)?(?:取法|口径)|不按传统|重(?:排|定)十神/.test(text)||
    [...text.matchAll(/([甲乙丙丁戊己庚辛壬癸])[木火土金水]?(?:日主|日干|日元|为(?:日主|日干|日元|参照|太极))/g)].some(m=>m[1]!==dayGan);
  const other=text=>/对方|另一(?:位|个|张)?(?:人|命主|命盘|八字|盘)|其他人|别人|[他她]的(?:命盘|八字|日主|日干|大运)|(?:丈夫|妻子|配偶|朋友|孩子|父亲|母亲)(?:的)?(?:命盘|八字|日主|日干|大运)/.test(text);
  const own=text=>/(?:回到|再看|对于|针对)(?:你|您|本人)(?:这个|这张)?(?:盘|命局|命盘|八字)|(?:本盘|本命|你的|您的|本人)(?:日主|日干|日元|大运|命盘|八字)|以本盘/.test(text);
  let context=alternate(String(question||''))||other(String(question||''))?'other':'current';
  const text=String(reply||'').replace(/^\s*>.*$/gm,'').replace(/```[\s\S]*?```|“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"|'[^']*'/g,s=>' '.repeat(s.length)).replace(/\*+/g,'');
  const result=[];
  for(const clause of text.match(/[^。！？；;\n]+[。！？；;\n]?/g)||[]){
    if(alternate(clause)||other(clause)){context='other';continue;}
    if(own(clause))context='current';
    if(/(?:引用|原文|引文|举例|例如|假设|(?:老师|作者|师傅|书上|原帖)(?:说|写|认为))[：:]\s*$/.test(clause)){context='quoted';continue;}
    if(context==='current'&&!/[?？]|[吗么]\s*[。！；;\n]?\s*$/.test(clause))result.push(clause);
  }
  return result;
}
function qualifiedIdentityClaim(clause,m) {
  const before=clause.slice(0,m.index),localPrefix=before.split(/[，,]|但是|不过|然而|但/).pop();
  const start=before.length-localPrefix.length,local=clause.slice(start),scoped={0:m[0],index:m.index-start};
  const after=local.slice(scoped.index+m[0].length).replace(/^[，,\s]+/,'');
  return isQualified(local,scoped)||/(?:假如|如果|假设|假定|假若|倘若|若|例如|举例|只看)[^。；]*$/.test(before)||
    /有人说|上(?:一)?轮|上(?:一)?次|曾说|原文|引文|引用|你问|您问|是否|是不是|误(?:写|说)|错误示范/.test(before)||
    /(?:老师|作者|师傅|书上|原帖)(?:曾|之前)?(?:说|写|认为|提到)/.test(localPrefix)||
    /并未|没有|不存在|未必|不一定|可能|也许|或许/.test(localPrefix)||
    /^(?:(?:这(?:个|种|一)?|的)?(?:说法|判断|论断|表述|句子|句话))?(?:这)?(?:是|并)?(?:不对|错误|错的|不成立|不准确|不正确|有误|需要纠正)/.test(after);
}
function validateLiteralIdentities(data,reply,question) {
  const facts=chartIdentityFacts(data,question);if(!facts)return [];
  const names='比肩|劫财|食神|伤官|偏财|正财|七杀|偏官|正官|偏印|枭神|正印';
  const chars='甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
  const normalize=g=>g==='偏官'?'七杀':g==='枭神'?'偏印':g;
  const warnings=[];
  for(const clause of identityClaimClauses(reply,question,facts.dayGan)){
    const re=new RegExp('(['+chars+'])(?:[木火土金水])?\\s*(?:(本气|余气|中气)\\s*)?(?:是|为|就是|属于|属|代表|对应|作|作为|[（(：:])?\\s*(?:你的|本命的|本盘的)?\\s*('+names+')','g');
    let m;while((m=re.exec(clause))){
      if(qualifiedIdentityClaim(clause,m))continue;
      // In "己土生辛金（食神生财）" the parentheses name the whole
      // relation, not 辛's identity. Still check "辛金（食神）" and
      // explicit "辛金是食神" claims, including inside longer sentences.
      if (new RegExp('[（(]\\s*(?:'+names+')$').test(m[0]) &&
          /^(?:生|克|制|合|泄|耗|冲|化|见|夺)(?:比肩|劫财|食神|伤官|偏财|正财|七杀|偏官|正官|偏印|枭神|正印|比劫|食伤|官杀|财|印|官|杀|食|伤|身)[）)]/.test(clause.slice(re.lastIndex))) continue;
      const ch=m[1],prefix=clause.slice(0,m.index),claim=normalize(m[3]);
      // A transformed element, another carrier, and a stem added only as a
      // hypothetical are not identities of the supplied natal/annual facts.
      if(/合化|化气|化成|化为|成局后|合局后/.test(prefix)||
        /^[甲乙丙丁戊己庚辛壬癸]$/.test(ch)&&/[甲乙丙丁戊己庚辛壬癸][、与和及]\s*$/.test(prefix))continue;
      let expected=[],refs=[];
      if(elements[ch]){
        refs=facts.nodes.filter(n=>n.gan===ch);
        if(refs.length)expected=[literalGod(facts.dayGan,ch)];
      }else{
        refs=facts.nodes.filter(n=>n.kind==='hidden-stem'&&n.zhi===ch);
        if(!refs.length||m[2]&&m[2]!=='本气')continue;
        // Unqualified multi-stem branches can legitimately refer to any of
        // their hidden stems. Only an explicit 本气 claim selects the first.
        const stems=m[2]==='本气'?hiddenStems[ch].slice(0,1):hiddenStems[ch];
        expected=stems.map(gan=>literalGod(facts.dayGan,gan));
      }
      if(!expected.length||expected.includes(claim))continue;
      const actual=elements[ch]?ch+'为'+expected[0]:ch+(m[2]==='本气'?'本气':'藏')+(m[2]==='本气'?hiddenStems[ch].slice(0,1):hiddenStems[ch]).map(gan=>gan+'（'+literalGod(facts.dayGan,gan)+'）').join('、');
      warnings.push('E10-逐字十神身份错误：以本盘日干'+facts.dayGan+'为参照，'+actual+'，不能写成“'+m[0]+'”。引用 '+[...new Set(refs.map(n=>n.id))].slice(0,6).join('、')+'。正偏十神不可互换；请撤回依赖该错误身份的作用链和结果推论，按实际载体重新核对，不仅替换术语。这里只核对字面身份，不认定现实事件。');
    }
  }
  return [...new Set(warnings)];
}
function validateDaYunEndpoints(data,reply,question) {
  const facts=chartIdentityFacts(data,question);if(!facts?.cyclesUnambiguous)return [];
  const wanted=explicitYears(question);let activeYear=wanted.length===1?wanted[0]:null;
  const warnings=[];
  for(const clause of identityClaimClauses(reply,question,facts.dayGan)){
    const re=/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])(?:大)?运(?:的)?\s*(最后一年|第一年|末年|起始年|结束年)|([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])(?:大)?运\s*(?:在|于)?\s*((?:18|19|20|21)\d{2})年?\s*(开始|结束|走完)/g;
    let m;while((m=re.exec(clause))){
      if(qualifiedIdentityClaim(clause,m)||solarYearBoundary(clause)||/交运时刻|交运日期|实岁|虚岁|排法|口径|体感|比喻/.test(clause))continue;
      const name=(m[1]||m[4])+(m[2]||m[5]),matches=facts.cycles.filter(c=>c.gan+c.zhi===name);
      if(matches.length!==1)continue;
      const cycle=matches[0],before=statementYears(clause.slice(0,m.index)),after=statementYears(clause.slice(m.index+m[0].length));
      const year=m[6]?Number(m[6]):before.length===1?before[0]:before.length>1?null:after.length===1?after[0]:after.length>1?null:activeYear;
      const beginning=/第一|起始|开始/.test(m[3]||m[7]),expected=beginning?cycle.startYear:cycle.endYear;
      // Calendar endpoints do not contain an exact handover date. Preserve
      // adjacent-year interpretations rather than pretending this is precise.
      if(!year||Math.abs(year-expected)<2)continue;
      warnings.push('E10-大运端点年份错误：源排盘 '+name+'运 ['+cycle.startYear+'—'+cycle.endYear+']，不能把'+year+'年说成该运'+(beginning?'第一年/开始年':'最后一年/结束年')+'。引用 dayun:'+cycle.startYear+'-'+cycle.endYear+'。实际交运时刻未由年度区间给出；请撤回基于该错误端点的压力或成败解释，重新核对，不能仅改年份后维持原因果。');
    }
    const years=statementYears(clause);if(years.length)activeYear=years.length===1?years[0]:null;
  }
  return [...new Set(warnings)];
}
function hiddenGodContext(data) {
  return '【藏干十神位置核对】以本盘日干'+data.fourPillars.day.gan+'为参照：'+positions.map(pos=>{
    const zhi=data.fourPillars[pos].zhi;
    return labels[pos]+zhi+'藏'+hiddenStems[zhi].map(gan=>gan+'（'+literalGod(data.fourPillars.day.gan,gan)+'）').join('、');
  }).join('；')+'。同五行根气可含异阴阳藏干，但不能据此改写正偏十神或父母星的实际位置；存在、受制和亲疏不是同一结论。\n';
}
function validateHiddenGodLocations(data,clauses) {
  const names='比肩|劫财|食神|伤官|偏财|正财|七杀|偏官|正官|偏印|枭神|正印';
  const roleNames=names+'|比劫|食伤|财星|官杀|官星|杀星|印星|印绶';
  const specificNames=new Set(names.split('|'));
  const positionByLabel={年支:'year',月支:'month',日支:'day',时支:'hour'}, warnings=[];
  const normalize=god=>god==='偏官'?'七杀':god==='枭神'?'偏印':god;
  const check=(clause,match,god,label,namedZhi)=>{
    const prefix=clause.slice(0,match.index);
    if(isQualified(clause,match) || /对方|另一人|另一张|其他人|另一个命盘|换(?:一个)?日主|改以|改用|假定|假若|倘若|(?:若|如)[^，,]*$/.test(prefix) ||
      /(?:以|改以)[^，,]{0,16}(?:日主|日干|日元|参照)|流年|大运|流月|流日|岁运/.test(prefix) || /[吗么]\s*$/.test(clause))return;
    const zhi=data.fourPillars[positionByLabel[label]].zhi;
    const actual=hiddenStems[zhi].map(gan=>({gan,god:literalGod(data.fourPillars.day.gan,gan)}));
    if((namedZhi&&namedZhi!==zhi)||!actual.some(x=>x.god===normalize(god)))warnings.push(
      'E10-藏干十神位置错误：以本盘'+data.fourPillars.day.gan+'日干为参照，'+label+zhi+'实际藏'+actual.map(x=>x.gan+'（'+x.god+'）').join('、')+
      '，不能写成“'+match[0]+'”。同五行根气不等于该正偏十神藏在此处；请重新核对依赖此位置的论证，不能仅替换星名后保留原结论。');
  };
  for(const clause of clauses) {
    // General role names also end the preceding subject. For example, in
    // “偏财当令，官杀在年支午”, 午 belongs to 官杀, not to 偏财.
    const gods=[...clause.matchAll(new RegExp(roleNames,'g'))];
    for(let i=0;i<gods.length;i++) {
      const god=gods[i], start=god.index+god[0].length;
      if(!specificNames.has(god[0]))continue;
      // A role and its asserted location must share one short statement, with
      // no intervening role. Root/长生 locations are a different kind of claim.
      const span=clause.slice(start,Math.min(gods[i+1]?.index??clause.length,start+65));
      const location=/(?:落在|位于|藏在|藏于|见于|在)\s*(年支|月支|日支|时支)\s*([子丑寅卯辰巳午申酉戌亥未])?/.exec(span);
      if(!location||/根|长生|墓库|禄旺|养地|生旺|如果|假如|假设|若|可能|或许|也许|是否|是不是|会不会|不在|并非|没有|并未|不曾|并不|不一定|不\s*$/.test(span.slice(0,location.index)))continue;
      check(clause,{0:god[0]+span.slice(0,location.index+location[0].length),index:god.index},god[0],location[1],location[2]);
    }
    const reverse=new RegExp('(年支|月支|日支|时支)\\s*([子丑寅卯辰巳午未申酉戌亥])?\\s*(?:中|里)?(?:的)?(?:藏有|藏着|藏|含有)\\s*('+names+')','g');
    let m;while((m=reverse.exec(clause)))check(clause,m,m[3],m[1],m[2]);
  }
  return warnings;
}
function singleSpouseRoleContext(data) {
  const gender=data?.birthInfo?.gender;
  if(!['male','female'].includes(gender))return '';
  return '\n【本盘传统配偶星角色核对】源排盘记录为'+(gender==='male'?'男命，财星对应妻星/配偶星，同时也有财物与资源含义':'女命，官杀对应夫星/配偶星，同时也有制度与职权含义')+
    '。这是本项目的传统取象口径；同一节点的多种角色不是多条独立证据，不能仅此断结婚或离婚，不据称谓推断现实伴侣身份或性取向。讨论另一张盘或另换参照须明确标明。\n';
}
function literalDaYunRanges(data) {
  const cycles=data && data.daYun && data.daYun.cycles;
  if(!Array.isArray(cycles) || !cycles.length) return {ranges:[],unambiguous:false};
  const isYear=v=>/^(?:18|19|20|21)\d{2}$/.test(String(v)) && Number.isInteger(Number(v));
  const ranges=cycles.filter(c=>c && elements[c.gan] && branchElements[c.zhi] && isYear(c.startYear) && isYear(c.endYear) && Number(c.endYear)>=Number(c.startYear))
    .map(c=>({gan:c.gan,zhi:c.zhi,startYear:Number(c.startYear),endYear:Number(c.endYear)})).sort((a,b)=>a.startYear-b.startYear);
  return {ranges,unambiguous:ranges.length===cycles.length && ranges.every((c,i)=>!i || c.startYear>ranges[i-1].endYear)};
}
function explicitYears(text) {
  return [...new Set(Array.from(String(text||'').matchAll(/(?:^|[^\d])((?:18|19|20|21)\d{2})(?!\d)/g),m=>Number(m[1])))];
}
function statementYears(text) {
  // A supplied decade's parenthesized calendar range is background, not a
  // switch away from the requested year for the next annual assertion.
  return explicitYears(String(text||'').replace(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:大)?运\s*[（(]\s*(?:18|19|20|21)\d{2}\s*[—–~～-]\s*(?:18|19|20|21)\d{2}年?\s*[）)]/g,''));
}
function qualifiedTimingClaim(clause,match) {
  const prefix=clause.slice(0,match.index);
  return isQualified(clause,match) || /以后|将来|未来|届时|接下来|下一步|明年|后年|去年|前年|可能|也许|或许|是否|是不是|假设|并未|没有|尚未|不曾|好像|似乎/.test(prefix) || /(?:若|倘若)[^，,]*$/.test(prefix) || /[吗么]\s*$/.test(clause);
}
function validateActiveDaYun(data, clauses, question) {
  const years=explicitYears(question), evidence=literalDaYunRanges(data);
  if(years.length!==1 || !evidence.unambiguous)return [];
  const requested=years[0];let activeYear=requested;
  for(const clause of clauses) {
    // Only assertive active-cycle wording. Listing a future cycle or discussing
    // a cycle's properties is not a claim that the user was in it that year.
    const re=/(?:正(?:在)?走|走(?:的)?(?:是|为)|(?:当时|那年|这一年|那时)(?:正)?(?:在|走|是)(?:的)?(?:是|为)?|(?:所走|所处)(?:的)?(?:大运|运)?(?:是|为)?|(?:当时|那年|这一年|那时)(?:的)?大运(?:是|为)|(?:处于|处在)|(?:是|为)(?=\s*[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:大)?运(?:之?中|内)))\s*([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])(?:大)?运/g;
    let m;
    while((m=re.exec(clause))) {
      const prefix=clause.slice(0,m.index), beforeYears=statementYears(prefix);
      const year=beforeYears.length===1?beforeYears[0]:beforeYears.length>1?null:activeYear;
      if(year!==requested || qualifiedTimingClaim(clause,m))continue;
      const cycle=evidence.ranges.find(c=>year>=c.startYear && year<=c.endYear);
      if(!cycle || year-cycle.startYear<1 || cycle.endYear-year<1)continue;
      if(m[1]+m[2]!==cycle.gan+cycle.zhi)return ['E10-所行大运串位：所问'+year+'年位于源排盘'+cycle.gan+cycle.zhi+'大运（'+cycle.startYear+'—'+cycle.endYear+'年），不能写成正走'+m[1]+m[2]+'运。以该年实际大运重新核对论证，不要仅替换干支名称。'];
    }
    const mentioned=statementYears(clause);
    if(mentioned.length)activeYear=mentioned.length===1?mentioned[0]:null;
  }
  return [];
}
function solarYearBoundary(text) {
  // A Gregorian January/February date, lunar-year convention or solar-term
  // boundary needs an actual date. Do not guess which sexagenary year applies.
  return /立春|交节|春节|农历|正月|(?:^|[^\d])(?:0?[12]|一|二)月|(?:18|19|20|21)\d{2}[-\/]0?[12][-\/]/.test(String(text||''));
}
function validateAnnualCalendar(clauses,question) {
  const years=explicitYears(question);
  if(years.length!==1 || solarYearBoundary(question))return [];
  const requested=years[0], gan='甲乙丙丁戊己庚辛壬癸'[(requested-4)%10], zhi='子丑寅卯辰巳午未申酉戌亥'[(requested-4)%12];
  let activeYear=requested,boundaryScoped=false;
  for(const clause of clauses) {
    const re=/流年(?:的)?(天干|地支)(?:为|是|：|:)\s*([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])|流年([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])?|流年([子丑寅卯辰巳午未申酉戌亥])(?=[木火土金水，,。；;冲合刑害破生克与和]|$)/g;
    let m;
    while((m=re.exec(clause))) {
      const prefix=clause.slice(0,m.index), beforeYears=statementYears(prefix);
      const year=beforeYears.length===1?beforeYears[0]:beforeYears.length>1?null:activeYear;
      if(year!==requested || boundaryScoped || solarYearBoundary(clause) || qualifiedTimingClaim(clause,m))continue;
      const assertions=m[1]?[[m[1],m[2]]]:m[3]?[['天干',m[3]],...(m[4]?[['地支',m[4]]]:[])]:[['地支',m[5]]];
      for(const [layer,char] of assertions){
        const expected=layer==='天干'?gan:zhi;
        if(char!==expected)return ['E10-流年干支串位：所问'+requested+'年通常按立春后的'+gan+zhi+'流年讨论，流年'+layer+'为'+expected+'，不能写成'+char+'。请分清流年、大运与原局的来源；涉及立春前须另按具体日期核对。'];
      }
    }
    const mentioned=statementYears(clause);
    if(mentioned.length) { activeYear=mentioned.length===1?mentioned[0]:null; boundaryScoped=solarYearBoundary(clause); }
    else if(solarYearBoundary(clause)) boundaryScoped=true;
  }
  return [];
}
function validateNatalBranchElements(data,clauses) {
  const positionByLabel={年支:'year',月支:'month',日支:'day',时支:'hour'}, warnings=[];
  for(const clause of clauses) {
    // Resolve each named natal position separately. A following half-combine
    // does not make the preceding claim “年支、时支的水” true for a fire 年支.
    const re=/((?:年支|月支|日支|时支)(?:(?:、|与|和|及)(?:年支|月支|日支|时支))*)(?:的(?:本五行)?(?:都|均)?(?:是|为|属|属于)?|本五行(?:是|为|属)|(?:都|均)?(?:是|为|属于|属))\s*([木火土金水])/g;
    let m;
    while((m=re.exec(clause))) {
      const prefix=clause.slice(0,m.index), suffix=clause.slice(m.index+m[0].length);
      // These discuss hidden stems, transformed qi, another date/person or a
      // hypothetical chart, not the natal branch's literal surface element.
      if(isQualified(clause,m) || /藏干|暗藏|所藏|合化|合成|会成|化成|化为|成局后|合局后|半合后|对方|另一人|其他人|假定|假若/.test(prefix) || /(?:若|倘若)[^，,]*$/.test(prefix) ||
        /(?:流年|大运|岁运|流月|流日)[^，,]{0,12}$/.test(prefix) || explicitYears(prefix).length ||
        /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:年)?的?\s*$/.test(prefix) ||
        /^\s*(?:藏干|的藏干|(?:是|属于|来自|源于|指|指的是)藏干|(?:是|指|指的是)(?:合化|合成|会成|化成|化为)后|[（(][^）)]{0,30}(?:藏干|合化|合成|会成|化成|化为))/.test(suffix) ||
        /[吗么]\s*$/.test(clause))continue;
      const named=m[1].match(/年支|月支|日支|时支/g);
      const wrong=named.filter(label=>branchElements[data.fourPillars[positionByLabel[label]].zhi]!==m[2]);
      if(wrong.length)warnings.push('E10-原局支五行串位：'+wrong.map(label=>label+data.fourPillars[positionByLabel[label]].zhi+'属'+branchElements[data.fourPillars[positionByLabel[label]].zhi]).join('、')+'，不能把所列位置一并写成'+m[2]+'。藏干或合化之气须另标明，不能改写表层支的本五行。');
    }
  }
  return warnings;
}
function validateDaYunTransition(data,clauses,question) {
  // Require one explicitly requested calendar year and supplied, non-overlapping
  // calendar ranges. Never infer a year from age or repair a boundary-year claim.
  const years=explicitYears(question), evidence=literalDaYunRanges(data);
  if(years.length!==1 || !evidence.unambiguous) return [];
  const year=years[0], cycle=evidence.ranges.find(c=>year>=c.startYear && year<=c.endYear);
  if(!cycle || year-cycle.startYear<2 || cycle.endYear-year<2) return [];
  let replyYear=year;
  for(const clause of clauses) {
    const mentioned=explicitYears(clause);
    if(mentioned.length) replyYear=mentioned.length===1 ? mentioned[0] : null;
    if(replyYear!==year || /以后|将来|届时|待到|等到|明年|后年|去年|前年/.test(clause)) continue;
    const transition=/刚(?:刚)?(?:换(?:了)?(?:大)?运|交(?:了)?运)|(?:正(?:好|处(?:在|于)?)?|恰好)(?:在|是)?(?:换(?:大)?运|交运)(?:的)?(?:节点|交界|交接)?|(?:是|属于)(?:换(?:大)?运|交运)(?:年|节点)|(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:大)?运|旧运|新运|上一步大运|下一步大运)[）)]?(?:刚(?:刚)?|才)(?:结束|开始|走完|接手)|(?:刚(?:刚)?|才)(?:走完|开始|进入|交入|交到)(?:了)?(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:大)?运|新大运)/g;
    let match;
    while((match=transition.exec(clause))) {
      const before=clause.slice(0,match.index).split(/[，,]|但是|不过|然而|但/).pop();
      const after=clause.slice(match.index+match[0].length);
      if(isQualified(clause,match) || /并未|并没有|没有|尚未|不在|没在|谈不上|好像|仿佛|好比|感觉|如同|比喻|可能|也许|或许|是否|是不是|似乎|会不会/.test(before) ||
        /^(?:一般|一样|般|那样|似的|的)?(?:感觉|体感|过渡感|比喻)/.test(after) || /只是比喻|并非实际交运|不是实际换运|[吗么]\s*$/.test(clause)) continue;
      return ['E10-换运年份错误：所问'+year+'年在源排盘'+cycle.gan+cycle.zhi+'大运（'+cycle.startYear+'—'+cycle.endYear+'年）内部，距区间两端均至少2年；不能断言该年刚换运、前运刚结束或新运刚开始。岁运天克地冲不等于换大运。'];
    }
  }
  return [];
}
function isQualified(clause, match) {
  const prefix=clause.slice(0,match.index);
  const before=prefix.split(/[，,]|但是|不过|然而|但/).pop();
  const after=clause.slice(match.index+match[0].length).replace(/^[，,\s]+/,'');
  const quoted=/[“「‘"']/.test(before) && /[”」’"']/.test(after);
  return quoted || /有人说|上(?:一)?轮|上(?:一)?次|此前(?:说|写)|曾(?:经)?说|引用/.test(prefix) ||
    /(?:假如|如果|假设|只看)[^。；]*$/.test(prefix) ||
    /不能|不可|不是|并非|不要|别把|不等于|不代表|不意味着|例如|举例|所谓|视同|视作/.test(before) ||
    /^(?:[”」']?)(?:的(?:说法|判断)|这个说法|这句话)?(?:不对|错误|是错|不成立|没有依据)/.test(after) ||
    /^(?:视作|当作|视为|说成)[^，。；]{0,16}(?:不对|错误|是错|不成立)/.test(after);
}

// Literal two-endpoint assertions only. These tables describe canonical
// relations, not whether a contact is effective or predicts a life event.
function validateLiteralRelations(clauses,reply,question) {
  const generates={木:'火',火:'土',土:'金',金:'水',水:'木'};
  const controls={木:'土',土:'水',水:'火',火:'金',金:'木'};
  const clashes={子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳'};
  const combines={子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
  const harms={子:'未',未:'子',丑:'午',午:'丑',寅:'巳',巳:'寅',卯:'辰',辰:'卯',申:'亥',亥:'申',酉:'戌',戌:'酉'};
  const breaks={子:'酉',酉:'子',丑:'辰',辰:'丑',寅:'亥',亥:'寅',卯:'午',午:'卯',巳:'申',申:'巳',未:'戌',戌:'未'};
  // Membership only: accept any two distinct members, including the two
  // endpoints sometimes called 拱局. This does not certify formation or qi.
  const partialGroups={半合:['申子辰','亥卯未','寅午戌','巳酉丑'],半会:['寅卯辰','巳午未','申酉戌','亥子丑']};
  const chars='甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥', branches='子丑寅卯辰巳午未申酉戌亥';
  const owner='(?:(?:你的|你|本人的|原局的|流年的|大运的|原局|流年|大运|天干|地支|日主|日元|[年月日时](?:柱|干|支)|的)\\s*){0,5}';
  const token='(['+chars+'])([木火土金水])';
  const branch='(['+branches+'])(?:[木火土金水])?';
  const annotation='(?:(?:这个(?:印星|财星|官星|杀星|食神|伤官|比肩|劫财|正印|偏印|正财|偏财|正官|七杀))|[（(][^）)]{0,60}[）)]){0,2}';
  // Bounded wording between literal endpoints, never an arbitrary prose gap.
  // E.g. 亥直接冲日支子 is the same pair assertion as 亥冲子.
  const branchAdverbs='(?:(?:直接|正好|恰好|继续|再次|同时|相互|互相|明显|已经|正在|仍然|依然|就|便|会|来|去|又)\\s*){0,3}';
  const alternateLiteralObject=/藏干|暗藏|所藏|支中|合化|合成|会成|化成|化为|化气/;
  const element=ch=>elements[ch]||branchElements[ch];
  const named=ch=>ch+element(ch);
  const warnings=[];
  function qualified(clause,m) {
    const prefix=clause.slice(0,m.index), after=clause.slice(m.index+m[0].length).replace(/^[，,\s]+/,'');
    // Do not resolve an indirect reference, transformed qi or a hidden stem
    // into its visible carrier. Skipping ambiguous prose is intentional.
    return isQualified(clause,m) || alternateLiteralObject.test(clause) ||
      /误(?:写|说)(?:成|为)|错误(?:地)?(?:写|说)(?:成|为)|错误示范|原文|引文/.test(prefix) ||
      /(?:假定|假若|倘若|若|是否|是不是|并未|没有)[^，,]*$/.test(prefix) || /[吗么]\s*$/.test(clause) ||
      /^(?:这(?:个|种)?)?(?:说法|判断|论断)?(?:是)?(?:错的|错误的|不成立|不准确|不正确|不对|需要纠正)/.test(after);
  }
  function actualRelation(a,b) {
    const x=element(a),y=element(b);
    if(generates[x]===y)return named(a)+'生'+named(b);
    if(generates[y]===x)return named(b)+'生'+named(a);
    if(controls[x]===y)return named(a)+'克'+named(b);
    if(controls[y]===x)return named(b)+'克'+named(a);
    return named(a)+'与'+named(b)+'同五行';
  }
  function checkElement(clause,m,a,b,kind) {
    if(qualified(clause,m))return;
    const table=kind==='生'?generates:controls;
    if(table[element(a)]!==element(b))warnings.push('E10-明示五行生克方向错误：'+named(a)+'不能按本五行写成'+kind+named(b)+'；正确关系是'+actualRelation(a,b)+'。合化和藏干须另标对象；请撤回依赖此错误方向的推论，重新核对整个论证，不要仅替换一个字。');
  }
  function checkBranch(clause,m,a,b,kind) {
    const before=clause.slice(0,m.index),localPrefix=before.split(/[，,]|但是|不过|然而|但/).pop();
    const start=before.length-localPrefix.length,local=clause.slice(start),scoped={0:m[0],index:m.index-start};
    const after=local.slice(scoped.index+scoped[0].length).replace(/^[，,\s]+/,'');
    // 未 in 并未/尚未/从未 is a negation, not the 未 branch endpoint.
    if(a==='未'&&(/(?:并|尚|还|仍|从|曾|也|都|均)\s*$/.test(before)||/^未来/.test(m[0])))return;
    if(/[?？]/.test(clause)||alternateLiteralObject.test(clause)||qualified(local,scoped)||
      /(?:假如|如果|假设|假定|假若|倘若|若|只看)[^。；]*$/.test(before)||
      /^(?:(?:的|这一|这种|这个)?(?:说法|判断|论断|表述))?(?:是|并)?(?:不成立|不正确|不准确|错误|错的|有误|不存在)/.test(after))return;
    const label=/冲/.test(kind)?'六冲':/害/.test(kind)?'六害':/破/.test(kind)?'六破':'六合';
    const table={'六冲':clashes,'六合':combines,'六害':harms,'六破':breaks}[label];
    if(table[a]!==b)warnings.push('E10-明示地支'+label+'配对错误：'+a+'与'+b+'不是'+label+'；固定配对是'+a+table[a]+'、'+b+table[b]+'。两支本五行关系为'+actualRelation(a,b)+'，五行生克不能冒充'+label+'。请撤回依赖错误配对的推论并重新核对整个论证，不要仅替换关系名。');
  }
  function checkPartialGroup(clause,m,a,b,kind) {
    // A correction in one comma clause must not excuse a later independent
    // assertion. Keep quoted spans intact when narrowing the qualifier scope.
    if(Array.from(clause.matchAll(/“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"|'[^']*'/g)).some(q=>m.index>=q.index&&m.index+m[0].length<=q.index+q[0].length))return;
    const before=clause.slice(0,m.index), localPrefix=before.split(/[，,]|但是|不过|然而|但/).pop();
    if(new RegExp('['+branches+'](?:[木火土金水])?\\s*(?:、|与|和|跟|同)\\s*$').test(before))return;
    if(/(?:有人说|上(?:一)?轮说|上(?:一)?次说|引用|原文|引文)[，,:：\s]*$/.test(before))return;
    const start=before.length-localPrefix.length, local=clause.slice(start), scoped={0:m[0],index:m.index-start};
    const after=local.slice(scoped.index+scoped[0].length).replace(/^[，,\s]+/,'');
    if(isQualified(local,scoped)||/误(?:写|说)(?:成|为)|错误(?:地)?(?:写|说)(?:成|为)|错误示范|原文|引文|并未|没有|不存在|(?:假定|假若|倘若|若|是否|是不是)[^，,]*$/.test(localPrefix)||/[吗么]\s*$/.test(local)||
      /^(?:这(?:个|种)?)?(?:说法|判断|论断)?(?:是)?(?:错的|错误的|不成立|不准确|不正确|不对|需要纠正)/.test(after))return;
    const label=kind==='半合'?'半合':'半会', groups=partialGroups[label];
    if(a!==b&&groups.some(g=>g.includes(a)&&g.includes(b)))return;
    warnings.push('E10-明示地支'+label+'组别错误：'+a+'与'+b+'不属于同一'+(label==='半合'?'三合':'三会')+'组的两个不同地支；对应组为'+groups.join('、')+'。仅核对组员，不判定合化、成局或现实吉凶。请撤回依赖错误组别的推论并重新核对整个论证，不要仅替换关系名。');
  }
  // Ten-god names share these family relations only when their day-master
  // reference is the same. This does not identify a stem's 正/偏 polarity,
  // decide whether an action works, or interpret 制印/财运 as literal 克.
  const godFamily={比肩:'比劫',劫财:'比劫',比劫:'比劫',食神:'食伤',伤官:'食伤',食伤:'食伤',正财:'财',偏财:'财',财星:'财',财:'财',正官:'官杀',七杀:'官杀',偏官:'官杀',官杀:'官杀',官星:'官杀',杀星:'官杀',正印:'印',偏印:'印',印星:'印',印:'印'};
  const godGenerates={比劫:'食伤',食伤:'财',财:'官杀',官杀:'印',印:'比劫'};
  const godControls={比劫:'财',财:'印',印:'食伤',食伤:'官杀',官杀:'比劫'};
  const godToken='(比肩|劫财|比劫|食神|伤官|食伤|正财|偏财|财星|正官|七杀|偏官|官杀|官星|杀星|正印|偏印|印星|财(?![运务政产经富力路源物会])|印(?![章刷度象迹记刻]))';
  const changedGodReference=/合盘|两(?:人|盘|命)|双方|各自|对方|另一(?:人|命|盘)|其他人|别人|男方|女方|他(?:的|命|盘)|她(?:的|命|盘)|[甲乙丙丁]命(?:的|中)|(?:丈夫|妻子|配偶|父亲|母亲|孩子|儿子|女儿|伴侣|朋友)(?:的|日主|日元|正|偏|七杀|比肩|劫财|食神|伤官)|(?:改|换|另|不同|重新)[^。；]{0,12}参照|新的?参照|太极|换日主|改日主|重(?:定|排)十神|(?:换|改)(?:成|以|用)[^。；]{0,12}(?:日主|日元)|以[^。；]{0,20}(?:为|作)(?:日主|日元)|(?:把|将)[^。；]{0,20}(?:当作?|视为|作为)(?:日主|日元)/;
  function ambiguousGodOwner(text) {
    // A named person or an unrecognized possessive is not silently treated as
    // the current chart. Skipping adjectival possessives is also intentional.
    const possessive=new RegExp('([^\\s，,。；;：:的]{1,24})的\\s*'+godToken,'g');
    let match;
    while((match=possessive.exec(text)))if(!/(?:你|您|我|本人|原局|本局|本命|命局|流年|大运|岁运|日主|日元|[年月日时](?:柱|干|支))$/.test(match[1]))return true;
    return false;
  }
  function actualGodRelation(a,b) {
    const x=godFamily[a],y=godFamily[b];
    if(godGenerates[x]===y)return a+'生'+b;
    if(godGenerates[y]===x)return b+'生'+a;
    if(godControls[x]===y)return a+'克'+b;
    if(godControls[y]===x)return b+'克'+a;
    return a+'与'+b+'同五行';
  }
  function checkGod(clause,m,a,b,kind) {
    if(/[?？]/.test(clause)||alternateLiteralObject.test(clause)||Array.from(clause.matchAll(/“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"|'[^']*'/g)).some(q=>m.index>=q.index&&m.index+m[0].length<=q.index+q[0].length))return;
    const before=clause.slice(0,m.index),localPrefix=before.split(/[，,]|但是|不过|然而|但/).pop();
    if(/(?:有人说|上(?:一)?轮说|上(?:一)?次说|引用|原文|引文)[，,:：\s]*$/.test(before)||/(?:假如|如果|假设|假定|假若|倘若|若|只看)[^。；]*$/.test(before))return;
    const start=before.length-localPrefix.length,local=clause.slice(start),scoped={0:m[0],index:m.index-start};
    const after=local.slice(scoped.index+scoped[0].length).replace(/^[，,\s]+/,'');
    if(qualified(local,scoped)||/不存在[^，,]*$/.test(localPrefix)||
      /^(?:(?:的|这一|这种|这个)?(?:说法|判断|论断|表述))?(?:是|并)?(?:错误|错的|不成立|不准确|不正确|不对|不存在|非如此|有误|不是正确说法)/.test(after)||
      /^(?:应(?:该|当)?|需要)(?:纠正|改(?:为|成))|^(?:准确|正确)(?:地)?(?:说|说法)(?:应(?:该|当)?)?(?:是|为)/.test(after))return;
    const table=kind==='生'?godGenerates:godControls;
    if(table[godFamily[a]]!==godFamily[b])warnings.push('E10-明示十神生克方向错误：以同一日主为参照，'+a+'不能按十神本五行关系写成'+kind+b+'；正确关系是'+actualGodRelation(a,b)+'。这里只核对名称间的生克方向，不判作用是否有效、正偏身份或现实结果。请撤回依赖错误方向的推论，重新核对整个论证，不要仅替换一个字。');
  }
  for(const clause of clauses) {
    let m;
    // Both element names must be explicit; “相克” is symmetric wording and
    // does not tell us which endpoint the writer claims is the controller.
    const direct=new RegExp(token+'\\s*(?:直接|正好|继续|来|去)?\\s*(生|克)(?:制|住|着)?\\s*'+owner+token,'g');
    while((m=direct.exec(clause)))checkElement(clause,m,m[1],m[4],m[3]);
    const passive=new RegExp(token+'\\s*被\\s*'+owner+token+'\\s*(生|克)(?:制|住|着)?','g');
    while((m=passive.exec(clause)))checkElement(clause,m,m[3],m[1],m[5]);
    const partial='(半会|半合|三会(?:[木火土金水](?:局|方)?|局|方)?的?(?:一部分|局部|部分))';
    const partialTail='(?:[木火土金水](?:局|方|势|气)?)?(?:的)?(?:牵引|关系|结构)?';
    const partialVerb='(?:(?:两|二)(?:支|字))?\\s*(?:形成|构成|发生|属于|是|为|有)?\\s*';
    const partialSuffix=new RegExp(branch+'\\s*'+annotation+'\\s*(?:与|和|跟|同|、)\\s*'+owner+branch+'\\s*'+annotation+'\\s*'+partialVerb+partial+partialTail,'g');
    while((m=partialSuffix.exec(clause)))checkPartialGroup(clause,m,m[1],m[2],m[3]);
    const partialAdjacent=new RegExp('(['+branches+'])(['+branches+'])\\s*'+partialVerb+partial+partialTail,'g');
    while((m=partialAdjacent.exec(clause))) {
      // Do not extract the last two members of an explicit three-branch list.
      if(m.index>0&&branches.includes(clause[m.index-1]))continue;
      checkPartialGroup(clause,m,m[1],m[2],m[3]);
    }
    const partialPrefix=new RegExp(branch+'\\s*(半会|半合)\\s*'+owner+branch,'g');
    while((m=partialPrefix.exec(clause)))checkPartialGroup(clause,m,m[1],m[3],m[2]);
  }
  // Mask complete quoted spans before splitting so an internal full stop
  // cannot turn a quoted example into our own assertion. Retain question
  // punctuation, unlike the legacy clauses used by the other fact checks.
  const branchText=String(reply||'').replace(/\*+/g,'').replace(/^\s*>.*$/gm,'')
    .replace(/```[\s\S]*?```|“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"|'[^']*'/g,q=>' '.repeat(q.length));
  for(const clause of branchText.match(/[^。！？；;\n]+[。！？；;\n]?/g)||[]){
    let m;
    const prefix=new RegExp(branch+'\\s*'+annotation+'\\s*'+branchAdverbs+'(六冲|冲|六合|六害|害|六破|破)(?:了|着|到)?\\s*'+owner+branch,'g');
    while((m=prefix.exec(clause)))checkBranch(clause,m,m[1],m[3],m[2]);
    const suffix=new RegExp(branch+'\\s*'+annotation+'\\s*(?:与|和|跟|同)\\s*'+owner+branch+'\\s*'+annotation+'\\s*'+branchAdverbs+'(?:形成|构成|发生)?\\s*'+branchAdverbs+'(六冲|相冲|六合|六害|相害|六破|相破)','g');
    while((m=suffix.exec(clause)))checkBranch(clause,m,m[1],m[2],m[3]);
    const adjacent=new RegExp('(['+branches+'])(['+branches+'])\\s*'+branchAdverbs+'(六冲|相冲|六合|六害|相害|六破|相破)','g');
    while((m=adjacent.exec(clause)))checkBranch(clause,m,m[1],m[2],m[3]);
  }
  // Preserve question punctuation for this narrow addition. Cross-person or
  // changed-reference prose is deliberately skipped, including a reference
  // established in an earlier sentence or in the user's question.
  const godContext=String(reply||'')+'\n'+String(question||'');
  const otherGodCenter=/以(?!同一日主|本命日主|日主|日元)[^。；]{1,20}为中心(?:论|看|取|定|排)十神/.test(godContext);
  if(!changedGodReference.test(godContext)&&!otherGodCenter&&!ambiguousGodOwner(godContext)) {
    // Mask whole quoted spans BEFORE splitting; quoted punctuation must not
    // turn the second half of somebody else's sentence into an assertion.
    const godText=String(reply||'').replace(/\*+/g,'').replace(/“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"|'[^']*'/g,q=>' '.repeat(q.length));
    const godClauses=godText.match(/[^。！？；;\n]+[。！？；;\n]?/g)||[];
    for(const rawClause of godClauses) {
      if(/[?？]/.test(rawClause))continue;
      const clause=rawClause.replace(/[。！；;\n]$/,'');
      let m;
      const godDirect=new RegExp(godToken+'\\s*(?:直接|正好|继续|来|去)?\\s*(生|克)\\s*'+owner+godToken,'g');
      while((m=godDirect.exec(clause)))checkGod(clause,m,m[1],m[3],m[2]);
      const godPassive=new RegExp(godToken+'\\s*被\\s*'+owner+godToken+'\\s*(生|克)(?![制住着服定])','g');
      while((m=godPassive.exec(clause)))checkGod(clause,m,m[2],m[1],m[3]);
    }
  }
  return [...new Set(warnings)];
}
function validateSingleSpouseRole(data,reply,question) {
  // Only this project's established traditional role convention, for one
  // explicitly sexed chart. No inference about partner identity/orientation,
  // marital status, event occurrence, or the efficacy of a ten-god contact.
  const gender=data?.birthInfo?.gender;
  if(!['male','female'].includes(gender))return [];
  const q=String(question||'');
  const alternativeReference=/合盘|双方|两(?:人|盘|命)|各自|换太极|换日主|重(?:定|排)十神|换参照|改参照|以[^。；]{1,16}为(?:太极|日主|日元|参照)|以(?!同一日主|本命日主|日主|日元)[^。；]{1,16}为中心(?:重新)?(?:论|看|取|定|排)十神|同性|性取向|男男|女女|同婚|(?:特殊|不同|另一|其他)(?:的)?(?:取法|口径)|不按传统/;
  if(alternativeReference.test(q))return [];
  const godToken='(正官|七杀|偏官|官杀|官星|杀星|正财|偏财|财星|正印|偏印|印星|枭神|食神|伤官|食伤|比肩|劫财|比劫)';
  const roleToken='(夫星|丈夫星|妻星|妻子星|配偶星)';
  // A personally assigned "感情星" can conceal the same spouse-role swap.
  // Keep this alias narrow: an explicit current-owner identity involving the
  // two conventional spouse-star families. Generic emotional expression,
  // palace discussion, or a ten-god's influence on romance is not this claim.
  const spouseFamilyToken='(正官|七杀|偏官|官杀|官星|杀星|正财|偏财|财星)';
  const personalOwner='(?:(?:你|您|本人|本命|此命|命主)(?:这(?:个|张)?盘)?的|(?:本盘|这张盘|这个命盘)的)';
  const romanceRoleToken='(感情星|婚恋星)';
  const owner='(?:(?:你|您|本人|本命|此命|命主)(?:的)?\\s*)?';
  const families={正官:'官杀',七杀:'官杀',偏官:'官杀',官杀:'官杀',官星:'官杀',杀星:'官杀',正财:'财',偏财:'财',财星:'财'};
  const own=text=>/(?:你|您|本人)的|(?:你|您)(?:是|为|属于|这个|这位)(?:男|女)|(?:回到|再看|对于|针对)(?:你|您|本人)(?:这个)?(?:盘|命局|命盘|八字)|当前(?:本人)?(?:命盘|命局)/.test(text);
  const other=text=>{
    if(/对方|另一(?:位|个|张)?(?:人|命主|命盘|八字|盘)|其他人|别人|男方|女方|[他她](?:的|这个|那张)|(?:丈夫|妻子|配偶|老公|老婆|男朋友|女朋友|男友|女友|伴侣|朋友|孩子|父亲|母亲)(?:的)?(?:命盘|八字|命局|盘|日主|日元|夫星|妻星|配偶星)|(?:我|你|您)(?:的)?(?:丈夫|妻子|老公|老婆|男朋友|女朋友|男友|女友|伴侣|朋友|父亲|母亲|爸爸|妈妈)|(?:站在|就|对)(?:他|她|妻子|丈夫|配偶|老公|老婆|伴侣|朋友)(?:的角度|而言|来说)/.test(text))return true;
    // Unknown named possessives are not silently assigned to the current user.
    for(const m of text.matchAll(/([^\s，,。；;：:的]{1,16})的(?:命盘|八字|命局|盘|夫星|妻星|配偶星)/g))
      if(!/(?:你|您|本人|本命|此命|命主|原局)$/.test(m[1]))return true;
    return false;
  };
  const generic=text=>/男命|女命|男性|女性|男生|女生|男女命|男女各|理论|通用讲解|一般取法/.test(text)&&!own(text);
  let context=other(q)?'other':generic(q)?'generic':'current';
  // Mask quotes before sentence splitting so quoted punctuation does not leak
  // somebody else's role assertion into the current person's claims.
  const text=String(reply||'').replace(/```[\s\S]*?```|“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"|'[^']*'/g,s=>' '.repeat(s.length)).replace(/\*+/g,'');
  const clauses=text.match(/[^。！？；;\n]+[。！？；;\n]?/g)||[];
  for(const clause of clauses) {
    if(alternativeReference.test(clause)){context='other';continue;}
    if(other(clause)){context='other';continue;}
    // A quoted or other-person sentence may itself say "your star". Only an
    // explicit return to this chart resets that inherited reference context.
    if(own(clause)&&(context==='current'||/(?:回到|再看|对于|针对)(?:你|您|本人)|(?:你|您)(?:是|为|属于|这个|这位)(?:男|女)/.test(clause)))context='current';
    else if(generic(clause)){context='generic';continue;}
    if(/(?:引用|原文|引文|举例|例如|假设|(?:老师|作者|师傅|书上|原帖)(?:说|写|认为))[：:]\s*$/.test(clause)){context='quoted';continue;}
    if(context!=='current'||/[?？]/.test(clause)||/[吗么]\s*[。！；;\n]?\s*$/.test(clause))continue;
    const patterns=[
      {re:new RegExp(godToken+'\\s*(?:为|是|代表|就是|作为|属于)\\s*'+owner+roleToken,'g'),reverse:false},
      {re:new RegExp(roleToken+'\\s*(?:为|是|就是|属)\\s*'+owner+godToken,'g'),reverse:true},
      {re:new RegExp(godToken+'\\s*[（(]\\s*'+owner+roleToken+'\\s*[）)]','g'),reverse:false},
      {re:new RegExp(spouseFamilyToken+'\\s*(?:(?:透出|透干|出现)\\s*[，,]?\\s*)?(?:为|是|正是|就是|代表|作为)\\s*'+personalOwner+'\\s*'+romanceRoleToken,'g'),reverse:false},
      {re:new RegExp(personalOwner+'\\s*'+romanceRoleToken+'\\s*(?:为|是|就是|属)\\s*'+spouseFamilyToken,'g'),reverse:true}
    ];
    for(const {re,reverse} of patterns){
      let m;
      while((m=re.exec(clause))) {
        const before=clause.slice(0,m.index),localPrefix=before.split(/[，,]|但是|不过|然而|但/).pop();
        const start=before.length-localPrefix.length,local=clause.slice(start),scoped={0:m[0],index:m.index-start};
        const after=local.slice(scoped.index+m[0].length).replace(/^[，,\s]+/,'');
        if(isQualified(local,scoped)||/(?:假如|如果|假设|假定|假若|倘若|若|例如|举例|只看)[^。；]*$/.test(before)||
          /有人说|上(?:一)?轮|上(?:一)?次|曾说|原文|引文|引用|你问|您问|是否|是不是|误(?:写|说)|错误示范/.test(before)||
          /(?:老师|作者|师傅|书上|原帖)(?:曾|之前)?(?:说|写|认为|提到)/.test(localPrefix)||
          /并未|没有|不存在/.test(localPrefix)||
          /不代表(?:你|您|本人)|并非(?:说|指|针对)(?:你|您|本人)/.test(after)||
          /^(?:(?:这(?:个|种|一)?|的)?(?:说法|判断|论断|表述|句子|句话))?(?:这)?(?:是|并)?(?:不对|错误|错的|不成立|不准确|不正确|有误|需要纠正)/.test(after))continue;
        const god=m[reverse?2:1],role=m[reverse?1:2],expected=gender==='male'?'财':'官杀';
        const oppositeTitle=gender==='male'?/^(?:夫星|丈夫星)$/.test(role):/^(?:妻星|妻子星)$/.test(role);
        if(families[god]===expected&&!oppositeTitle)continue;
        return ['E10-本人配偶星角色串位：源排盘明确为'+(gender==='male'?'男命':'女命')+'；按本项目传统口径，'+
          (gender==='male'?'财星对应妻星/配偶星':'官杀对应夫星/配偶星')+'，不能把“'+m[0]+'”直接套作本人的角色。'+
          '请撤回依赖该角色的论证，从原局与岁运重新核对，不要仅替换称谓或锁定原事件。这里只核对既定角色口径，不判断婚事是否发生，不推断伴侣身份、性取向或家庭事实。'];
      }
    }
  }
  return [];
}
function validateDayMasterOwnership(data, clauses, reply) {
  const gan=data.fourPillars.day.gan;
  const assertion=new RegExp('(?:日主(?:天干)?|日干|日柱(?:天干)?)'+gan+'[木火土金水]?(?:比肩)?(?:[（(][^）)\\n，,]{0,12})?(?:就是|都是|也是|代表|是|属于|视为)(?:你的|来)?(?:同辈|合伙人|竞争者|同行|朋友)','g');
  for(const clause of clauses){
    assertion.lastIndex=0;let match;
    while((match=assertion.exec(clause)))if(!isQualified(clause,match))return [
      'E10-日主归属错误：日干'+gan+'是命主本人，不能把这个日干节点解释为分钱的同辈、合伙人或竞争者。其他位置的比劫须逐字另列，不能与日主重复计为他人夺财；请重审据此得出的钱被分走结论，而非只改一个称呼。'
    ];
  }
  // Check the captured cross-sentence form: day stem is in an explicitly
  // counted group, then the whole group becomes other people taking money.
  // Do not adjudicate whether the remaining peer carriers actually cause loss.
  const text=String(reply||'').replace(/\*+/g,'').replace(/^\s*>.*$/gm,'')
    .replace(/```[\s\S]*?```|“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"/g,s=>' '.repeat(s.length));
  const groupCount='(?:[二两三四五六七八九十0-9]+)(?:条线|股(?:力量)?|个(?:木|火|土|金|水|同类|比劫|比肩)?|处比劫)';
  const group=new RegExp(groupCount+'[^。；;\\n]{0,30}(?:克|合|制)[^。；;\\n]{0,16}财','g');
  const selfPattern=new RegExp('(?:日柱(?:天干)?|日干|日主(?:天干)?)'+gan+'[木火土金水]?');
  const ownElement=elements[gan],wealthElement='木火土金水'[('木火土金水'.indexOf(ownElement)+2)%5];
  for(const paragraph of text.split(/\n\s*\n/)){
    if(!selfPattern.test(paragraph)||/对方|另一(?:人|张盘|个命盘)|换日主|举例|假设|如果|若把|错误示范|不能把|不能将|不能说/.test(paragraph))continue;
    if(/(?:日主|日干|日柱)[^。；]{0,12}(?:是|为|属于)(?:你自己|命主本人|本人|自己)|其余|其他位置才|不含日主|排除日主|不是人数/.test(paragraph))continue;
    // Equivalent formulation without counting: named day/peer stems are
    // grouped by their element, then their control is equated with theft.
    const equivalence=new RegExp('都是'+ownElement+'[，,、\\s]*'+ownElement+'克'+wealthElement+'[，,、\\s]*(?:等于|意味着|说明)[^。；;\\n]{0,18}(?:被抢|被分走|被别人拿走)');
    const matched=equivalence.exec(paragraph);
    if(matched){
      const listed=paragraph.slice(Math.max(0,matched.index-100),matched.index);
      if(selfPattern.test(listed)&&/(?:年柱|月柱|时柱|年干|月干|时干)[甲乙丙丁戊己庚辛壬癸]/.test(listed)&&!isQualified(paragraph,matched))return [
        'E10-日主归属错误：所列同类天干包含日干'+gan+'本人，不能把整组“'+ownElement+'克'+wealthElement+'”等同于财被别人抢走。分开本人承财与其他比劫作用，撤回依赖这条等同关系的失财结论，重新核对实际依据；不预设纠正后应转好或转坏。'
      ];
    }
    let m;group.lastIndex=0;
    while((m=group.exec(paragraph))){
      const listed=paragraph.slice(Math.max(0,m.index-110),m.index);
      if(!selfPattern.test(listed)||!/(?:年柱|月柱|时柱|年干|月干|时干)[甲乙丙丁戊己庚辛壬癸]/.test(listed)||isQualified(paragraph,m))continue;
      const tail=paragraph.slice(m.index+m[0].length,m.index+m[0].length+180);
      const people=/(?:这[几三四两二]?个|这[几三四两二]?股|它们|都是|同类竞争者|一群同类|比肩就是|比劫就是)/.test(tail);
      const loss=/(?:被别人|被合作方|被同辈|别人来|来分钱|参与分钱|抢走|分掉|分薄|分走)/.test(tail);
      if(people&&loss&&!/不能|不代表|不等于|并非|不是.*竞争者|并不|未必/.test(tail))return [
        'E10-日主归属错误：论证把日干'+gan+'与其他比劫合为一组，再把整组解释为他人夺财。日干是本人；本人承财和其他载体触财必须分开，字数也不是竞争者人数。请撤回依赖该混算的钱被分走结论，重新比较剩余依据，而不是只换称谓；纠正归属不预设结果应转好或转坏。'
      ];
    }
  }
  return [];
}
// Literal root absence only. Do not adjudicate strong roots, usable roots or
// whether a clash/combine has removed their effect. Same-element hidden stems
// count as roots under the calculator's existing rule, including opposite yin/yang.
function validateNamedRootAbsence(data,reply,question) {
  const warnings=[];
  for(const clause of identityClaimClauses(reply,question,data.fourPillars.day.gan)){
    const re=/([甲乙丙丁戊己庚辛壬癸])[木火土金水]?(?:(?:本身|本来|原本|自身))?(?:(?:在)?(?:原局|命里|命局|全局|四支|地支|局中|局内|本局))?(?:完全|全然|彻底|根本)?(?:没(?:有)?根|无根|不通根)/g;
    let m;
    while((m=re.exec(clause))){
      // The existing day-master guard already emits this exact absence error.
      if(/日主$/.test(clause.slice(0,m.index))&&/^[甲乙丙丁戊己庚辛壬癸][木火土金水]?(?:(?:在)?(?:原局|命局|全局|本身))?(?:完全|全然|彻底)?无根$/.test(m[0]))continue;
      if(qualifiedIdentityClaim(clause,m)||/(?:只看|仅看|单看|坐下|坐支|本柱|此柱|该柱|这一柱)[^，,。；]*$/.test(clause.slice(0,m.index)))continue;
      const roots=positions.flatMap(pos=>hiddenStems[data.fourPillars[pos].zhi]
        .filter(gan=>elements[gan]===elements[m[1]])
        .map(gan=>labels[pos]+data.fourPillars[pos].zhi+'藏'+gan));
      if(roots.length)warnings.push('E10-具名天干根气范围错误：'+m[1]+'的同五行原局藏根见'+roots.join('、')+
        '，按现行同五行通根口径不能写成“'+m[0]+'”。异阴阳藏干仍是根，藏而未透不等于无根；这里只确认字面存在，不判根强、根完整或岁运作用有效。请撤回依赖无根的生扶不足或成败解释，重新比较实际根气及受制条件，不得自动将结果翻成相反方向。');
    }
  }
  return warnings;
}

// Only explicit visible-layer assertions, never the efficacy of hidden stems.
function validateVisibleGodClaims(data,reply,question) {
  const facts=chartIdentityFacts(data,question);if(!facts)return [];
  const natal=facts.nodes.filter(n=>n.kind==='stem'&&n.scope.startsWith('natal:'));
  const years=explicitYears(question),requested=data?.timingAdjudication?.requestedYear;
  const year=years.length===1?years[0]:years.length?null:Number(requested?.year);
  const cycle=facts.cyclesUnambiguous&&facts.cycles.find(c=>year>c.startYear&&year<c.endYear);
  const complete=Number.isInteger(year)&&Number(requested?.year)===year&&
    facts.annual.some(a=>a.year===year)&&cycle&&
    requested?.daYun?.gan===cycle.gan&&requested?.daYun?.zhi===cycle.zhi&&
    !solarYearBoundary(question);
  const scoped=complete?facts.nodes.filter(n=>n.kind==='stem'&&(
    n.scope.startsWith('natal:')||n.scope==='annual:'+year||n.scope==='dayun:'+cycle.startYear+'-'+cycle.endYear)):null;
  const names='比肩|劫财|食神|伤官|偏财|正财|七杀|偏官|正官|偏印|枭神|正印';
  const normalized=g=>g==='偏官'?'七杀':g==='枭神'?'偏印':g;
  // Quotes around a mechanism name are terminology, while quoted sentences
  // remain excluded by identityClaimClauses, as are other people's charts.
  const text=String(reply||'').replace(/[“「‘](官伤相战|伤官见官)[”」’]/g,'$1');
  const warnings=[];let activeYear=year;
  for(const clause of identityClaimClauses(text,question,facts.dayGan)){
    const mentioned=statementYears(clause);if(mentioned.length)activeYear=mentioned.length===1?mentioned[0]:null;
    if(mentioned.length&&activeYear!==year||solarYearBoundary(clause))continue;
    const re=new RegExp('(?:(原局|原命局|本命|流年|大运)(?:的|里|中)?\\s*)?('+names+')(?:[甲乙丙丁戊己庚辛壬癸][木火土金水]?)?\\s*(?:已经|直接|也|已)?(?:透干|透出|透在天干上?|透于天干上?)','g');
    const mechanism=/(?:(原局|原命局|本命|流年|大运))?天干(?:上)?\s*(?:就是|形成|出现|呈现|构成|是|为|有)?\s*(官伤相战|伤官见官)/g;
    const claims=[];let m;
    while((m=re.exec(clause)))claims.push({match:m,scope:m[1],gods:[normalized(m[2])]});
    while((m=mechanism.exec(clause)))claims.push({match:m,scope:m[1],gods:['正官','伤官']});
    for(const claim of claims){
      const {match,scope}=claim;
      if(qualifiedIdentityClaim(clause,match)||qualifiedTimingClaim(clause,match))continue;
      const after=clause.slice(match.index+match[0].length).replace(/^[，,\s]+/,'');
      if(/^(?:(?:不能|不该|不应)(?:这样|这么|如此)说|是指|指的是|的意思是|就是指)/.test(after))continue;
      if(!scope&&/什么是|是什么意思|如何理解|怎么理解|(?:解释|说明).{0,12}(?:含义|概念)|定义/.test(String(question||''))&&
        !/(?:我的|本盘|这盘|我这)/.test(String(question||''))&&!/本盘|你的|您的|你这|本人/.test(clause))continue;
      const before=clause.slice(0,match.index);
      if(/藏干|暗藏|支中|合化|化气|化成|化为|成局后|合局后/.test(before.split(/[，,]/).pop()))continue;
      const ownNatal=/^(?:原局|原命局|本命)$/.test(scope||'');
      let nodes=ownNatal?natal:scoped;
      if(!nodes||(!ownNatal&&activeYear!==year))continue;
      // A named different decade is outside the active-year projection.
      const named=[...clause.matchAll(/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])大?运/g)];
      if(!ownNatal&&named.some(n=>n[1]!==cycle.gan||n[2]!==cycle.zhi))continue;
      if(scope==='流年')nodes=nodes.filter(n=>n.scope==='annual:'+year);
      if(scope==='大运')nodes=nodes.filter(n=>n.scope.startsWith('dayun:'));
      const missing=claim.gods.filter(g=>!nodes.some(n=>n.god===g));
      if(!missing.length)continue;
      warnings.push('E10-十神透藏层次错误：'+(ownNatal?'原局':year+'年实际原局、在行大运和流年')+'的相关透干为'+nodes.map(n=>n.label+n.gan+'（'+n.god+'）').join('、')+'；未见'+missing.join('、')+'透在所称天干层，不能写成“'+match[0]+'”。藏干参与作用不等于已透干，也不能借其他大运的透干补当前年份。请按实际显藏重新核对该论证，不因纠正显藏就自动反转事件判断。');
    }
  }
  return [...new Set(warnings)];
}

function validateChartEvidence(data,reply,question) {
  const e=chartEvidence(data);if(!e)return [];
  const warnings=[];
  const clauses=String(reply||'').replace(/\*+/g,'').split(/[。！？；;\n]/);
  warnings.push(...validateDayMasterOwnership(data,clauses,reply));
  const digits={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
  for(const clause of clauses) {
    // Only an explicit possessive location claim; “原局未见…” is not a 未 branch assertion.
    const located=/原局(?:里|中)?的([子丑寅卯辰巳午未申酉戌亥](?:、[子丑寅卯辰巳午未申酉戌亥])*)(?=$|[\s、，,与和及木火土金水凑形构相被受逢三六])/g;
    let location;
    while((location=located.exec(clause))) {
      const missing=location[1].split('、').filter(zhi=>!e.branchChars.includes(zhi));
      if(missing.length&&!isQualified(clause,location)) warnings.push('E10-岁运原局串位：原局四支为'+e.branchChars.join('、')+'，没有'+missing.join('、')+'；请核对它来自大运还是流年，不能写成原局已有。');
    }
    // Quoted errors and explicitly named weighted/hidden counts are outside this narrow check.
    if(!/加权|参考值|参考分|权重|藏干|大运|流年|流月|岁运|运中/.test(clause)) {
      const re=/([木火土金水])(?:有|共有|一共|总共|：|:)\s*([0-9]+|[零一二两三四五六七八九十])个|(?:有|共有|一共|总共)\s*([0-9]+|[零一二两三四五六七八九十])个([木火土金水])/g;
      let m;
      while((m=re.exec(clause))) {
        const element=m[1]||m[4], raw=m[2]||m[3], count=Object.hasOwn(digits,raw)?digits[raw]:Number(raw);
        const suffix=clause.slice(m.index+m[0].length);
        // A root, exposed stem or hidden stem is a different counting object.
        // Matching only “木有一个” in “木有一个根” would reject a correct reply.
        if (/^\s*(?:根|透干|藏干|天干|地支|同五行根|本气|中气|余气|墓库)/.test(suffix)) continue;
        const parenthetical=/^\s*[（(]\s*(天干|地支|全局|干支)\s*[）)]/.exec(suffix);
        const scope=clause.slice(0,m.index).replace(/天干(?:和|与|及)?地支|天干、地支/g,'干支').match(/天干|地支|全局|八字|干支|总计|合计/g);
        const key=parenthetical?.[1]||scope?.at(-1),expected=key==='天干'?e.stems: key==='地支'?e.branches:e.literal;
        if(count!==expected[element]&&!isQualified(clause,m)) warnings.push('E10-五行字数错误：'+(key||'表层干支')+element+'为'+expected[element]+'字；加权参考值不能写成字数，撤回该数字断言。');
      }
    }
    if(e.roots.length) {
      const re=/日主(?:[甲乙丙丁戊己庚辛壬癸][木火土金水]?)?(?:(?:在)?(?:原局|命局|全局|本身))?(?:完全|全然|彻底)?无根/g;let m;
      while((m=re.exec(clause))) if(!isQualified(clause,m)) warnings.push('E10-根气范围错误：日主同五行藏干见'+e.rootLabels.join('、')+'，不能因日支无根或根受制断全局无根；只说明具体位置和作用限制。');
    }
  }
  return [...new Set(warnings.concat(validateExplicitActionClaims(data,reply),validatePalaceAbsenceInference(data,reply),validateNamedRootAbsence(data,reply,question),validateHiddenGodLocations(data,clauses),validateDaYunTransition(data,clauses,question),validateActiveDaYun(data,clauses,question),validateAnnualCalendar(clauses,question),validateNatalBranchElements(data,clauses),validateLiteralRelations(clauses,reply,question),validateSingleSpouseRole(data,reply,question),validateLiteralIdentities(data,reply,question),validateDaYunEndpoints(data,reply,question),validateVisibleGodClaims(data,reply,question)))];
}
module.exports={chartEvidence,chartEvidenceContext,validateChartEvidence,chartIdentityFacts};
