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

    // 拼音→汉字映射（liuren-ts-lib 返回拼音 key）
    var PY2CN={zi:'子',chou:'丑',yin:'寅',mao:'卯',chen:'辰',si:'巳',wu:'午',wei:'未',shen:'申',you:'酉',xu:'戌',hai:'亥'};
    function cnKeys(obj){if(!obj||typeof obj!=='object')return obj;var r={};Object.keys(obj).forEach(function(k){r[PY2CN[k]||k]=obj[k];});return r;}

    // 提取和格式化数据（key 转为中文）
    var out = {
      dateInfo: result.dateInfo,
      tianDiPan: {diPan:cnKeys(result.tianDiPan.diPan),tianPan:cnKeys(result.tianDiPan.tianPan),tianJiang:cnKeys(result.tianDiPan.tianJiang)},
      siKe: result.siKe,
      sanChuan: result.sanChuan,
      dunGan: cnKeys(result.dunGan),
      chuJian: cnKeys(result.chuJian),
      fuJian: cnKeys(result.fuJian),
      jianChu: cnKeys(result.jianChu),
      shenSha: result.shenSha,
      yinYangGuiRen: result.yinYangGuiRen?{yangGuiRen:cnKeys(result.yinYangGuiRen.yangGuiRen),yinGuiRen:cnKeys(result.yinYangGuiRen.yinGuiRen)}:null
    };

    return res.status(200).json(out);
  } catch (e) {
    console.error('大六壬排盘失败:', e);
    return res.status(500).json({ error: '排盘失败：' + e.message });
  }
};
