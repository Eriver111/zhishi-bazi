'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = { console };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/bazi.js'), 'utf8'), context);
function study(pillars) {
    const chart = Object.fromEntries(['year','month','day','hour'].map((p, i) => [p, {gan:pillars[i][0],zhi:pillars[i][1]}]));
    return context.BaZiCalculator.analyzeStudy(chart);
}
test('透出官杀但四支无根，不得按透干数生成有根断语', () => {
    const result = study(['庚寅','己卯','甲子','乙亥']);
    assert.equal(result.guanScore, 1);
    assert.equal(result.hasGuanRoot, false);
    assert.equal(result.guanRootPositions.length, 0);
    assert.match(result.adviceText, /地支没有同五行藏干作根/);
    assert.doesNotMatch(result.adviceText, /自律性较强|能够按计划坚持学习/);
});
test('地支根气单独记录，不随天干个数推定', () => {
    const result = study(['庚寅','己卯','甲子','癸酉']);
    assert.equal(result.guanScore, 1);
    assert.equal(result.hasGuanRoot, true);
    assert.deepEqual(Array.from(result.guanRootPositions), ['hour']);
});
