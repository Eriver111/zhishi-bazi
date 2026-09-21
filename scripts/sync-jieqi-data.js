// Regenerate the offline calendar with: node scripts/sync-jieqi-data.js
// lunar-javascript 1.7.7, https://github.com/6tail/lunar-javascript (MIT).
const fs = require('node:fs');
const path = require('node:path');
const { Solar } = require('lunar-javascript');
const names = ['立春','惊蛰','清明','立夏','芒种','小暑','立秋','白露','寒露','立冬','大雪','小寒'];
const rows = [];
for (let year = 1899; year <= 2101; year++) {
  const table = Solar.fromYmdHms(year, 6, 1, 12, 0, 0).getLunar().getJieQiTable();
  const next = Solar.fromYmdHms(year + 1, 6, 1, 12, 0, 0).getLunar().getJieQiTable();
  rows.push('    ' + year + ': [' + names.map(name => {
    const t = (name === '小寒' ? next : table)[name];
    return (Date.UTC(t.getYear(), t.getMonth()-1, t.getDay(), t.getHour(), t.getMinute(), t.getSecond()) - Date.UTC(year, 0, 1)) / 1000;
  }).join(',') + ']');
}
const block = '// BEGIN GENERATED JIEQI DATA\n' +
  '// Beijing civil seconds since January 1; 1899–2101, lunar-javascript 1.7.7 (MIT).\n' +
  '// See scripts/sync-jieqi-data.js and docs/licenses/lunar-javascript-LICENSE.\n' +
  'var PRECISE_JIEQI_SECONDS = {\n' + rows.join(',\n') + '\n};\n// END GENERATED JIEQI DATA';
const file = path.join(__dirname, '..', 'js', 'bazi.js');
let source = fs.readFileSync(file, 'utf8');
if (source.includes('// BEGIN GENERATED JIEQI DATA')) {
  source = source.replace(/\/\/ BEGIN GENERATED JIEQI DATA[\s\S]*?\/\/ END GENERATED JIEQI DATA/, block);
} else {
  source = source.replace('function getJieQiDates(year) {', block + '\n\nfunction getJieQiDates(year) {');
}
fs.writeFileSync(file, source);
