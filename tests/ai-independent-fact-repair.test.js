'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../api/ai-chat.js'),'utf8'),scope={};
vm.runInNewContext(src.slice(src.indexOf('function buildV2Instruction('),src.indexOf('async function v2SelfCorrect(')),scope);
const plain=x=>JSON.parse(JSON.stringify(x));
const base=[{role:'system',content:'冻结命盘'},{role:'user',content:'我确实参加考试'},{role:'assistant',content:'之前已确认参与'},
 {role:'user',content:'2011年最终是否考取？'}];
test('literal fact correction preserves chart/history/current question but does not resend the wrong event story',()=>{
 const before=JSON.stringify(base),wrong='没考上。错误根气推导的临场故事',warning='E10-具名天干根气范围错误：辛有巳藏庚，不能称无根。';
 const out=plain(scope.buildV2Messages(base,wrong,[warning]));
 assert.deepEqual(out.filter(m=>m!==out[out.length-2]),base);
 assert.equal(out.at(-1).content,base.at(-1).content);assert.equal(out.at(-2).role,'system');
 assert(out.at(-2).content.includes(warning));assert(!JSON.stringify(out).includes(wrong));
 assert.match(out.at(-2).content,/不预设应当改判成功或失败/);assert.equal(JSON.stringify(base),before);
});
test('mixed or other validation issues retain targeted draft repair instead of losing its error context',()=>{
 for(const warnings of [['E1-合盘身份错误'],['E6-无证据粉饰'],['E10-逐字事实错误','E9-事件身份错误'],[]]){
  const out=plain(scope.buildV2Messages(base,'原答',warnings));
  assert.equal(out.at(-2).content,'原答');assert.equal(out.at(-1).role,'user');
  assert.match(out.at(-1).content,/修正上述错误依据及所有依赖它的推论/);
 }
});
test('single correction contains all literal failures and does not mutate or remove earlier history',()=>{
 const warnings=['E10-十神错误','E10-根气错误'];
 const out=plain(scope.buildV2Messages(base,'错误结论',warnings));
 for(const w of warnings)assert(out.at(-2).content.includes(w));
 assert.equal(out.filter(m=>m.role==='assistant').length,1);assert.equal(out.length,base.length+1);
});
