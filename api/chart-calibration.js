/**
 * GET  /api/chart-calibration?chart_key=...
 * POST /api/chart-calibration { action:'initialize'|'answer', ... }
 *
 * 候选事件在首次初始化后锁定；回答接口不能改写候选内容和证据。
 */
const { requireAuth } = require('../lib/auth.js');
const {
  getChartCalibration,
  initializeChartCalibration,
  answerChartCalibrationEvent
} = require('../lib/supabase.js');

function send(res, status, body) { return res.status(status).json(body); }
function safeChartKey(value) {
  return String(value || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 96);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  var user = requireAuth(req);
  if (!user) return send(res, 401, { error: '请先登录后校准命盘' });

  try {
    if (req.method === 'GET') {
      var queryKey = safeChartKey(req.query && req.query.chart_key);
      if (!queryKey) return send(res, 400, { error: '缺少命盘标识' });
      var stored = await getChartCalibration(user.uid, queryKey);
      return send(res, 200, { ready: !!stored, calibration: stored && stored.calibration, events: stored && stored.events || [] });
    }

    if (req.method !== 'POST') return send(res, 405, { error: '不支持此请求方式' });
    var body = req.body || {};
    var chartKey = safeChartKey(body.chart_key);
    if (!chartKey) return send(res, 400, { error: '缺少命盘标识' });

    if (body.action === 'initialize') {
      var initialized = await initializeChartCalibration(user.uid, chartKey, body.chart_signature, body.candidates);
      if (!initialized) return send(res, 503, { error: '校准存储尚未就绪，请先完成数据库迁移' });
      return send(res, 200, { ready: true, calibration: initialized.calibration, events: initialized.events || [] });
    }

    if (body.action === 'answer') {
      var event = await answerChartCalibrationEvent(user.uid, chartKey, body.event_key, body.answer, body.actual_year, body.note);
      if (!event) return send(res, 400, { error: '该校准题不存在或保存失败' });
      return send(res, 200, { success: true, event: event });
    }

    return send(res, 400, { error: '未知操作' });
  } catch (error) {
    console.error('[chart-calibration] 请求失败:', error.message);
    return send(res, 500, { error: '命盘校准暂时不可用' });
  }
};
