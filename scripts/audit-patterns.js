'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const calculator = context.window.BaZiCalculator;

const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const jiazi = Array.from({ length: 60 }, (_, i) => stems[i % 10] + branches[i % 12]);

function chart(values) {
  const rows = values.map(gz => ({ gan:gz[0], zhi:gz[1] }));
  return calculator.buildFromPillars({ year:rows[0], month:rows[1], day:rows[2], hour:rows[3] }, 'male');
}

function rng(seed) {
  let state = seed >>> 0;
  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const random = rng(20260830);
const sampleSize = Number(process.argv[2] || 30000);
const counts = {};
const contradictions = [];
const compoundWithoutConditions = [];
const hardFailureCounts = {};
const emptyCompoundCounts = {};
const representativeCharts = {};

for (let i = 0; i < sampleSize; i++) {
  const values = [0, 1, 2, 3].map(() => jiazi[Math.floor(random() * jiazi.length)]);
  const bazi = chart(values);
  const basePattern = calculator.getPattern(bazi);
  const yongJi = calculator.getYongJi(bazi);
  const pattern = yongJi.resolvedPattern || basePattern;
  const key = pattern.name + '·' + pattern.status;
  counts[key] = (counts[key] || 0) + 1;
  if (!representativeCharts[key]) {
    representativeCharts[key] = {
      pillars:values.join(' '),
      basePattern:basePattern.name + '·' + basePattern.status,
      conditions:(pattern.establishConditions || []).map(row => ({ condition:row.condition, met:row.met, category:row.category })),
      breakReasons:pattern.breakReasons || []
    };
  }
  const hardFailures = (pattern.establishConditions || []).filter(row => row.category === 'HARD_BREAK' && row.met === false);
  if (pattern.status === '成格') hardFailures.forEach(row => {
    const failureKey = pattern.name + '|' + row.condition;
    hardFailureCounts[failureKey] = (hardFailureCounts[failureKey] || 0) + 1;
  });
  if (pattern.status === '成格' && hardFailures.length && contradictions.length < 80) {
    contradictions.push({ pillars:values.join(' '), pattern:key, hardFailures:hardFailures.map(row => row.condition + '：' + row.detail), source:pattern.source });
  }
  if (pattern.type === '同柱复合' && !(pattern.establishConditions || []).length && compoundWithoutConditions.length < 80) {
    compoundWithoutConditions.push({ pillars:values.join(' '), pattern:key, source:pattern.source });
  }
  if (pattern.type === '同柱复合' && !(pattern.establishConditions || []).length) {
    emptyCompoundCounts[key] = (emptyCompoundCounts[key] || 0) + 1;
  }
}

const sortedCounts = Object.fromEntries(Object.entries(counts).sort((a,b) => b[1]-a[1]));
process.stdout.write(JSON.stringify({ sampleSize, counts:sortedCounts, hardFailureCounts, emptyCompoundCounts, contradictions, compoundWithoutConditions, representativeCharts }, null, 2) + '\n');
