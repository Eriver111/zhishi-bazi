'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateStudyReport } = require('../scripts/real-case-study-report');

test('无印读博反例经过真实学业生成和付费渲染，不被十神计数判为低学历', () => {
  const result = generateStudyReport({ id: 'anonymous-no-seal', pillars: ['辛酉', '戊戌', '甲戌', '丁卯'], gender: 'female' });
  assert.equal(result.ordinary.facts.yinCount, 0);
  assert.equal(result.ordinary.facts.profileKey, 'output_assessment');
  assert.equal(result.paid.facts.educationBand.rank, null);
  assert.equal(result.paid.facts.educationBand.publicKey, 'not-estimated');
  assert.equal(result.paid.facts.chains.find(row => row.id === 'learning_pressure').present, false);
  assert.equal(result.paid.facts.limitations.some(row => row.key === 'weak_body_strong_killers_no_seal'), false);
  for (const output of [result.ordinary.visibleText, result.paid.visibleText]) {
    assert.doesNotMatch(output, /天赋在别处|学习力|自律力|学业需努力|读书考试确实需要比别人|学习容易挑内容|缺少能跟上的方法/);
    assert.match(output, /答案|得分点|解题|作答/);
  }
  assert.doesNotMatch(JSON.stringify(result.paid.facts.educationBand), /高学历|低学历|普通学历/);
});

test('有印无印跨盘均不给虚构的学习力分数，学习方式仍有结构区分', () => {
  const cases = [
    ['辛酉', '戊戌', '甲戌', '丁卯'],
    ['甲子', '癸酉', '甲子', '甲子'],
    ['丁巳', '丙午', '壬寅', '庚子'],
    ['己巳', '丙子', '辛丑', '己亥'],
  ].map((pillars, i) => generateStudyReport({ id: 'cross-' + i, pillars, gender: 'female' }));
  assert.ok(new Set(cases.map(row => row.ordinary.facts.profileKey)).size >= 3);
  for (const row of cases) {
    assert.ok(row.ordinary.facts.evidenceRows.every(evidence => evidence.detail));
    assert.doesNotMatch(row.ordinary.html, />学习力<|>创造力<|>自律力<|width:\d+%|天生|关键时刻容易超常/);
    assert.equal(row.paid.facts.educationBand.publicKey, 'not-estimated');
    assert.ok(row.paid.visibleText.length > 50);
    assert.ok(row.paid.facts.narrative.verdicts.filter(verdict => !verdict.detailOnly).length <= 2);
    assert.match(row.paid.html, /查看|依据|结构/);
  }
});
