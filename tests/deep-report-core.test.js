const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const DeepReport = require(path.join(root, 'js', 'deep-report.js'));

function sampleChart() {
  return {
    year: { gan: '甲', zhi: '子' },
    month: { gan: '丁', zhi: '卯' },
    day: { gan: '己', zhi: '未' },
    hour: { gan: '庚', zhi: '午' },
  };
}

function fakeDependencies(calls) {
  return {
    calculator: {
      getProfessionalReportFacts() {
        if (calls) calls.professional += 1;
        return {
          strength: { score: 51, level: '中和' },
          pattern: { name: '杀印相生格', status: '成格', congGe: false },
          yongJi: { yongShen: ['木'], xiShen: ['木'], jiShen: [] },
          actionChains: ['先看制化', '再看应期'],
        };
      },
    },
    structural: {
      evaluate() {
        if (calls) calls.structural += 1;
        return {
          relationEvents: [{ type: '六冲' }],
          structuralRisks: [{ type: '关键用神/格局节点受冲' }],
        };
      },
    },
    chain: {
      analyze() {
        if (calls) calls.chain += 1;
        return { adjustments: [], hints: [], ganChain: [], zhiChain: [] };
      },
    },
  };
}

test('buildFacts consumes each authoritative source once and is deterministic', () => {
  const calls = { professional: 0, structural: 0, chain: 0 };
  const first = DeepReport.buildFacts(sampleChart(), 'male', { anchorYear: 2026, deps: fakeDependencies(calls) });
  const second = DeepReport.buildFacts(sampleChart(), 'male', { anchorYear: 2026, deps: fakeDependencies() });

  assert.equal(calls.professional, 1);
  assert.equal(calls.structural, 1);
  assert.equal(calls.chain, 1);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(Object.keys(first), [
    'schemaVersion', 'anchorYear', 'chartIdentity', 'core',
    'wealth', 'relationship', 'study', 'currentYear', 'fiveYear',
  ]);
  assert.equal(Object.isFrozen(first.core), true);
});

test('deep report source does not contain independent strength or pattern scoring', () => {
  const source = fs.readFileSync(path.join(root, 'js', 'deep-report.js'), 'utf8');
  assert.doesNotMatch(source, /score\s*[+\-]=|function\s+calcDayMasterStrength|function\s+getPattern/);
});
