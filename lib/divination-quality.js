'use strict';
function cleanReading(raw) {
  let text=String(raw||'').trim();
  text=text.replace(/^```(?:json|text)?\s*/,'').replace(/\s*```$/,'');
  try { const parsed=JSON.parse(text); if(typeof parsed.reading==='string')text=parsed.reading; } catch (_) {}
  return text.replace(/\*\*/g,'').replace(/^#{1,6}\s*/gm,'').trim();
}
function readingIssue(text) {
  if(!text||text.length<10)return '没有完整解读';
  if(/医院|就医|体检|诊断|治疗|用药|服药|药到病除|病来如山|癌症|肿瘤|心脏|肝脏|肾脏|肺部|骨折|重伤/.test(text))return '包含医疗或具体身体伤害内容';
  if(/验收没问题|肯定能成|必定成功|必然成功|保证成功|最终能交差|一定会成功/.test(text))return '将卦象倾向写成现实结果保证';
  if(/(?:说明|表示|意味着)[^。；\n]{0,18}(?:大家|每个人|所有人|你们|组员)[^。；\n]{0,10}(?:实力不差|能力强|地位.{0,2}平等|都想|都要)/.test(text))return '将卦象关系直接当成参与者能力、地位或动机事实';
  if(/待复核|无法给出确定裁决|数据不足无法判断/.test(text))return '用内部占位词替代了实际分析';
  return '';
}
module.exports={cleanReading,readingIssue};
