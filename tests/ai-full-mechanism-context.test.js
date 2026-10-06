'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildChartContext } = require('../api/ai-chat')._test;

function context(chainAnalysis) {
  return buildChartContext({type:'bazi',yongJi:{},chainAnalysis});
}

test('AI receives the seventh bound mechanism, its actual nodes and adjudicated state',()=>{
  const rows=Array.from({length:7},(_,i)=>({name:'机制'+i,strength:'中',sourceNodeId:'year.gan',targetNodeId:'month.hidden.'+i,actionStage:i===6?'blocked':'effective',evidence:['依据'+i]}));
  const text=context({mechanisms:rows.slice(0,6),fullMechanisms:rows});
  assert.match(text,/机制6/);
  assert.match(text,/year\.gan→month\.hidden\.6；阶段blocked/);
  assert.match(text,/依据6/);
  assert.match(text,/effective只表示原局机制/);
  assert.match(text,/年度是否增强、破坏或解除限制/);
});

test('explicit empty full ledger does not fall back to a stale display summary',()=>{
  assert.doesNotMatch(context({mechanisms:[{name:'旧候选'}],fullMechanisms:[]}),/旧候选/);
});

test('legacy clients retain their evidence without inventing an effective stage',()=>{
  const text=context({mechanisms:[{name:'官杀生印',evidence:['壬生甲']} ]});
  assert.match(text,/官杀生印/);
  assert.match(text,/壬生甲/);
  assert.match(text,/未作有效制化裁决/);
});
