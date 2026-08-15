// AI_REPORT_LAYER 正式回归（2026-08-15 P5-B 收口）：14 盘存证报告重放——新 validator 对生产回复全文复算，
// 与报告中记录的 warnings 逐条对账。预期唯一差异：TH07/PAT07 的 E1-生克方向（晦火生金）误报消失。
// 用法：node _aireport_regression/replay-validator-new.js
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DIR = __dirname;
var apiSource = fs.readFileSync(path.join(ROOT, 'api', 'ai-chat.js'), 'utf8');
var m = apiSource.match(/function runReplyValidation\(chartData, reply\) \{([\s\S]*?)\r?\n\}\r?\n\r?\n\/\*\*/);
if (!m) { console.error('runReplyValidation 提取失败'); process.exit(1); }
var runReplyValidation = new Function('chartData', 'reply', m[1].replace(/^  /gm, ''));

var DISKS = ['S04','TH07','R01','S07','S08','BND02','BND04','PAT01','PAT07','TH01','R06','X04','PAT04','#61'];
var fail = 0;
DISKS.forEach(function (name) {
  var report = fs.readFileSync(path.join(DIR, name + '-report.md'), 'utf8');
  var chart = JSON.parse(fs.readFileSync(path.join(DIR, name + '-chartdata.json'), 'utf8'));
  chart.type = 'bazi';
  // 提取 AI 回复全文：### AI 回复（... 之后到 ### V1 validator warnings 之前
  var rm = report.match(/### AI 回复（[\s\S]*?\n([\s\S]*?)\n### V1 validator warnings/);
  if (!rm) { console.log(name + ' [SKIP] 报告结构未匹配'); fail++; return; }
  var reply = rm[1];
  // 记录在案的 warnings 行
  var recSection = report.slice(report.indexOf('### V1 validator warnings'));
  var recorded = recSection.split(/\r?\n/).filter(function (l) { return /^\- /.test(l); })
    .map(function (l) { return l.replace(/^\- /, '').trim(); }).sort();
  var now = runReplyValidation(chart, reply).sort();
  var same = JSON.stringify(recorded) === JSON.stringify(now);
  var removed = recorded.filter(function (w) { return now.indexOf(w) < 0; });
  var added = now.filter(function (w) { return recorded.indexOf(w) < 0; });
  var status = same ? 'OK-identical' : (added.length === 0 && removed.every(function (w) { return w.indexOf('E1-生克方向') === 0; }) ? 'OK-E1FP-removed' : 'DIFF');
  if (status === 'DIFF') fail++;
  console.log(name + ' [' + status + '] recorded=' + recorded.length + ' now=' + now.length
    + (removed.length ? ' removed=' + JSON.stringify(removed) : '')
    + (added.length ? ' added=' + JSON.stringify(added) : ''));
});
console.log(fail === 0 ? '\nRESULT: PASS（唯一预期差异=E1晦火生金误报消失，无任何新差异）' : '\nRESULT: FAIL ' + fail);
process.exit(fail === 0 ? 0 : 1);
