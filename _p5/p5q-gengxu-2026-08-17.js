// 用户提问盘核查（2026-08-17）：乾造 庚寅 丙戌 庚子 乙酉 —— 网站判定「印星化杀格」是否属实 + 完整推理链。
// 纯证据零引擎改动。输出 _p5/p5q-gengxu-2026-08-17.json；控制台仅 ASCII 摘要（GBK 安全 + 仓库三件套纪律）。
var fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
var cp = require('child_process');
var ROOT = path.join(__dirname, '..');

var raw = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'));
var sha = crypto.createHash('sha256').update(raw).digest('hex');
var gitRoot = 'NA';
try { gitRoot = cp.execSync('git rev-parse --show-toplevel', { cwd: ROOT }).toString().trim(); } catch (e) {}
console.log('pwd=' + process.cwd());
console.log('git_root=' + gitRoot);
console.log('bazi_js_sha256=' + sha);

function load(src) { var ctx = { window: {} }; vm.runInNewContext(src, ctx); return ctx.window.BaZiCalculator; }
var ENG = load(raw.toString('utf8'));

function build(gz, sex) {
  var p = gz.split(' ');
  return ENG.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] }, month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] }, hour: { gan: p[3][0], zhi: p[3][1] }
  }, sex || 'male', null);
}

var b = build('庚寅 丙戌 庚子 乙酉', 'male');
var out = {
  chart: '庚寅 丙戌 庚子 乙酉 乾造',
  strength: ENG.calcDayMasterStrength(b),
  cong: ENG.getCongGe(b),
  pattern: ENG.getPattern(b),
  yongJi: ENG.getYongJi(b)
};
fs.writeFileSync(path.join(__dirname, 'p5q-gengxu-2026-08-17.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('strength_score=' + out.strength.score);
console.log('strength_level=' + JSON.stringify(out.strength.level));
console.log('pattern_name=' + JSON.stringify(out.pattern.name));
console.log('pattern_status=' + JSON.stringify(out.pattern.status));
console.log('cong_isCong=' + out.cong.isCong);
console.log('json_written=OK');
