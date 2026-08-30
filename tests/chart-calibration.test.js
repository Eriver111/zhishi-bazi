const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('calibration schema is isolated from payment and locks generated candidates', () => {
  const migration = read('schema-chart-calibration.sql');
  const storage = read('lib/supabase.js');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS chart_calibrations/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS chart_calibration_events/);
  assert.match(migration, /UNIQUE\(calibration_id, event_key\)/);
  assert.doesNotMatch(migration, /orders|payment|credits/i);
  assert.match(storage, /if \(existing\) return existing/);
  assert.match(storage, /answerChartCalibrationEvent/);
});

test('first AI click offers optional calibration and archive can reopen it', () => {
  const client = read('js/chart-calibration.js');
  const archive = read('js/archive-library.js');
  const result = read('result.html');
  assert.match(client, /要不要先校对命盘/);
  assert.match(client, /先校对再问/);
  assert.match(client, /直接问 AI/);
  assert.match(client, /候选在你作答前已经生成并锁定/);
  assert.match(client, /ZhishiCalibration\.beforeAI = inspectFirstClick/);
  assert.match(archive, /校对命盘/);
  assert.match(archive, /zhishi_open_archive_calibration/);
  assert.match(result, /chart-calibration\.js\?v=6/);
});

test('calibration questions require matching Bazi mechanisms instead of broad event examples', () => {
  const client = read('js/chart-calibration.js');
  assert.match(client, /伤官见官\|官逢伤官/);
  assert.match(client, /和领导、单位规定或审核流程发生过明显冲突/);
  assert.match(client, /比肩\|劫财/);
  assert.match(client, /合伙分钱、朋友借钱、同行竞争或替别人承担开支/);
  assert.match(client, /父母挣钱不稳、大额开支或资金周转/);
  assert.match(client, /六合\|流年合日支\|半合\|三合局/);
  assert.match(client, /六冲\|天克地冲/);
  assert.match(client, /刑\|自刑\|六害\|六破/);
  assert.doesNotMatch(client, /投资失利、被人分走钱/);
  assert.match(client, /var scores = \{ study:0, career:0, wealth:0, relationship:0, family:0, change:1 \}/);
  assert.match(client, /seenPrompts\[item\.prompt\]/);
  assert.match(client, /domainCounts\[item\.domain\].*>= 3/);
});

test('confirmed calibration is added to AI context without changing frozen facts', () => {
  const endpoint = read('api/ai-chat.js');
  const integration = read('js/ai-chat-integration.js');
  assert.match(endpoint, /getChartCalibrationSummary/);
  assert.match(endpoint, /不得据此改写四柱、旺衰、格局、喜用忌/);
  assert.match(endpoint, /用户否认的事件应降权/);
  assert.match(integration, /ChatPersistence\.decorate\(body, 'bazi'/);
  assert.match(integration, /requestHeaders\.Authorization/);
});
