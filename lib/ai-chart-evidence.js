'use strict';

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
function chartEvidenceContext(data) {
  const e=chartEvidence(data); if(!e)return '';
  const ranges=literalDaYunRanges(data).ranges;
  const timing=ranges.length ? '\n【大运公历区间核对】源排盘提供：'+ranges.map(c=>c.gan+c.zhi+'运 '+c.startYear+'—'+c.endYear+'年').join('；')+'。区间按源数据照录，不把年龄当公历年份；边界年的实际交接须看具体交运时刻。岁运天克地冲、伏吟或体感转折不等于刚换大运，不能把运中年份说成前运刚结束、新运刚开始。\n' : '';
  return '\n【字数与根的位置核对】八个表层干支按本五行计数（不含藏干、不加月令权重）：'+Object.entries(e.literal).map(([k,v])=>k+v+'字').join('、')+'。这不是强弱分。\n原局四支按年月日时为：'+e.branchChars.join('、')+'。岁运中的支必须另标来源，不能写成原局已有。\n日主同五行藏干出现于：'+(e.rootLabels.join('、')||'四支均未见')+'。存在不等于有力，受冲合或失令不等于藏干消失；日支单独无根不能覆盖其他支的根。\n'+timing;
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
    const re=/流年(?:的)?(天干|地支)(?:为|是|：|:)\s*([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])/g;
    let m;
    while((m=re.exec(clause))) {
      const prefix=clause.slice(0,m.index), beforeYears=statementYears(prefix);
      const year=beforeYears.length===1?beforeYears[0]:beforeYears.length>1?null:activeYear;
      if(year!==requested || boundaryScoped || solarYearBoundary(clause) || qualifiedTimingClaim(clause,m))continue;
      const expected=m[1]==='天干'?gan:zhi;
      if(m[2]!==expected)return ['E10-流年干支串位：所问'+requested+'年通常按立春后的'+gan+zhi+'流年讨论，流年'+m[1]+'为'+expected+'，不能写成'+m[2]+'。请分清流年、大运与原局的来源；涉及立春前须另按具体日期核对。'];
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
function validateChartEvidence(data,reply,question) {
  const e=chartEvidence(data);if(!e)return [];
  const warnings=[];
  const clauses=String(reply||'').replace(/\*+/g,'').split(/[。！？；;\n]/);
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
  return [...new Set(warnings.concat(validateDaYunTransition(data,clauses,question),validateActiveDaYun(data,clauses,question),validateAnnualCalendar(clauses,question),validateNatalBranchElements(data,clauses)))];
}
module.exports={chartEvidence,chartEvidenceContext,validateChartEvidence};
