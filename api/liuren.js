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

    var validDate = Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) &&
      Number.isInteger(h) && Number.isInteger(min) && y >= 1900 && y <= 2100 &&
      m >= 1 && m <= 12 && d >= 1 && d <= 31 && h >= 0 && h <= 23 && min >= 0 && min <= 59;
    var calendarCheck = validDate ? new Date(Date.UTC(y, m - 1, d)) : null;
    validDate = validDate && calendarCheck.getUTCFullYear() === y && calendarCheck.getUTCMonth() === m - 1 && calendarCheck.getUTCDate() === d;
    if (!validDate) {
      return res.status(400).json({ error: '请提供有效的起课日期与时间' });
    }

    // 动态导入 ESM 模块
    var liuren = await import('liuren-ts-lib');
    // Date 的本地字段保持用户输入的中国民用时间；算法读取的是年月日时字段，而不是 UTC 时间戳。
    var result = liuren.getLiuRenByDate(new Date(y, m - 1, d, h, min, 0, 0));

    if (!result || !result.dateInfo || !result.tianDiPan || !result.siKe || !result.sanChuan) {
      throw new Error('排盘库返回的数据不完整');
    }

    // 拼音→汉字映射（liuren-ts-lib 返回拼音 key）
    var PY2CN={zi:'子',chou:'丑',yin:'寅',mao:'卯',chen:'辰',si:'巳',wu:'午',wei:'未',shen:'申',you:'酉',xu:'戌',hai:'亥'};
    function cnKeys(obj){if(!obj||typeof obj!=='object')return obj;if(Array.isArray(obj))return obj.map(cnKeys);var r={};Object.keys(obj).forEach(function(k){var nk=PY2CN[k]||k;var v=obj[k];r[nk]=(typeof v==='string')?(PY2CN[v]||v):v;});return r;}

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
