const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}

function loadLookup() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'pillar-reverse-lookup.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.PillarReverseLookup;
}

function pillarsFor(chart) {
  return ['year', 'month', 'day', 'hour'].reduce((pillars, key) => {
    pillars[key] = { gan: chart[key].gan, zhi: chart[key].zhi };
    return pillars;
  }, {});
}

const calculator = loadCalculator();
const lookup = loadLookup();

test('finds a known source date and returns at most two newest matches', () => {
  const source = calculator.calculate(2024, 3, 18, 3, 'male', 6);
  const matches = lookup.findRecentMatches({
    pillars: pillarsFor(source),
    gender: 'male',
    now: new Date('2026-07-26T00:00:00Z'),
    years: 200,
    calculator
  });

  assert.ok(matches.some((item) => item.year === 2024 && item.month === 3 && item.day === 18));
  assert.ok(matches.length <= 2);
  assert.ok(matches.every((item, index) => index === 0 || matches[index - 1].iso > item.iso));
});

test('zi hour uses a midnight midpoint and an explicit cross-day label', () => {
  assert.equal(lookup.HOUR_MIDPOINTS[0], 0);
  assert.equal(lookup.HOUR_RANGES[0], '23:00—00:59');
});

test('never returns a future or older-than-200-year candidate', () => {
  const now = new Date('2026-07-26T00:00:00Z');
  const source = calculator.calculate(2024, 3, 18, 3, 'male', 6);
  const matches = lookup.findRecentMatches({
    pillars: pillarsFor(source), gender: 'male', now, years: 200, calculator
  });

  assert.ok(matches.every((item) => item.iso <= '2026-07-26'));
  assert.ok(matches.every((item) => item.iso >= '1826-07-26'));
});

test('limits a normal 200-year search to fewer than 5,000 calculator calls', () => {
  const source = calculator.calculate(2024, 3, 18, 3, 'male', 6);
  let calls = 0;
  const countedCalculator = {
    calculate(...args) {
      calls += 1;
      return calculator.calculate(...args);
    }
  };

  lookup.findRecentMatches({
    pillars: pillarsFor(source),
    gender: 'male',
    now: new Date('2026-07-26T00:00:00Z'),
    years: 200,
    calculator: countedCalculator
  });

  assert.ok(calls < 5000, `expected fewer than 5,000 calls, received ${calls}`);
});
