/**
 * /api/liuren - 大六壬排盘
 * POST body: { year, month, day, hour, minute }
 * 使用 liuren-ts-lib 计算天地盘/四课/三传/神煞
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var b = req.body || {};
    var y = parseInt(b.year), m = parseInt(b.month), d = parseInt(b.day);
    var h = parseInt(b.hour) || 0, min = parseInt(b.minute) || 0;

    if (!y || !m || !d) {
      return res.status(400).json({ error: '请提供完整的出生日期' });
    }

    // 动态导入 ESM 模块
    var liuren = await import('liuren-ts-lib');
    var result = liuren.getLiuRenByDate(new Date(y, m - 1, d, h, min));

    // 提取和格式化数据
    var out = {
      dateInfo: result.dateInfo,
      tianDiPan: result.tianDiPan,
      siKe: result.siKe,
      sanChuan: result.sanChuan,
      dunGan: result.dunGan,
      chuJian: result.chuJian,
      fuJian: result.fuJian,
      jianChu: result.jianChu,
      shenSha: result.shenSha,
      yinYangGuiRen: result.yinYangGuiRen
    };

    return res.status(200).json(out);
  } catch (e) {
    console.error('大六壬排盘失败:', e);
    return res.status(500).json({ error: '排盘失败：' + e.message });
  }
};
