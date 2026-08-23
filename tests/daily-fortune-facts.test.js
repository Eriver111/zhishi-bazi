const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../api/_bazi-runtime');
const daily = require('../api/_daily-fortune');

test('daily fortune changes date at China Standard Time rather than server local time', () => {
  assert.deepEqual(daily.chinaDateParts(new Date('2026-08-22T16:30:00.000Z')), {year:2026,month:8,day:23});
  assert.deepEqual(daily.chinaDateParts(new Date('2026-08-23T15:59:59.000Z')), {year:2026,month:8,day:23});
});

test('daily branch facts cover clash combine harm punishment and break', () => {
  assert.ok(daily.branchRelations('子','午').some(row => row.type === '六冲'));
  assert.ok(daily.branchRelations('子','丑').some(row => row.type === '六合' && row.resultElement === '土'));
  assert.ok(daily.branchRelations('申','亥').some(row => row.type === '六害'));
  assert.ok(daily.branchRelations('寅','巳').some(row => row.type === '相刑'));
  assert.ok(daily.branchRelations('寅','亥').some(row => row.type === '相破'));
});

test('personal daily facts use frozen yong-xi-ji and keep day stem separate from spouse palace', () => {
  const chart = runtime.chartFromQuery('year=1990&month=5&day=10&hour=6&clock=11&gender=male&solar=0');
  const transit = {
    yearNumber:2026,
    year:runtime.calendar.getYearPillar(2026,8,23,12),
    month:runtime.calendar.getMonthPillar(2026,8,23,12,12),
    day:runtime.calendar.getDayPillar(2026,8,23)
  };
  const facts = daily.buildDailyFacts(runtime.calculator, chart.bazi, chart.gender, transit);
  const frozen = runtime.calculator.getYongJi(chart.bazi);
  assert.deepEqual(Array.from(facts.yongJi.yongShen), Array.from(frozen.yongShen));
  assert.equal(facts.context.at(-1).label, '流日');
  assert.ok(facts.events.some(row => row.layer === '地支' && row.target === '夫妻宫'));
  assert.ok(facts.events.every(row => !(row.layer === '天干' && row.target === '夫妻宫')));
  assert.ok(['偏顺','偏紧','有利变化','需要留意','平稳'].includes(facts.tendency));
  assert.ok(facts.basis.length >= 2);
});

test('fortune page gives guests public almanac and labels personal reasoning separately', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'fortune.html'), 'utf8');
  assert.match(page, /公共黄历 · 建除民俗参考/);
  assert.match(page, /专属今日推演/);
  assert.match(page, /loadPublicHuangli\(publicPrompt/);
  assert.match(page, /推演依据/);
  assert.match(page, /命理推演用于观察当天更容易出现的倾向/);
});
