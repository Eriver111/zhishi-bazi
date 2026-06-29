/**
 * /api/divination - 占卜解读（梅花易数/六爻通用）
 * POST: { prompt } → AI 解卦
 */
const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = 'deepseek-chat'; // chat 已经够好——有64卦数据库锚定，模型只负责翻译

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    var prompt = (req.body && req.body.prompt) || '';
    if (!prompt) return res.status(400).json({ error: '缺少卦象信息' });

    var aiResp = await fetch(AI_API_URL, {
      method: 'POST', headers: { 'Content-Type':'application/json','Authorization':'Bearer '+AI_API_KEY },
      body: JSON.stringify({ model:AI_MODEL, messages:[{role:'user',content:prompt}], max_tokens:1000, temperature:0.5 })
    });
    var aiData = await aiResp.json();
    var reading = aiData.choices?.[0]?.message?.content || '卦象已显，静心体悟。';
    // 强力过滤免责声明/模型名称
    reading = reading.replace(/[（(]?以上[^。\n]*?(?:deepseek|生成|参考|AI)[^。\n]*?(?:[。)）]|$)/gi, '');
    reading = reading.replace(/[（(][^)）]*?(?:deepseek|AI|人工智能|模型)[^)）]*[)）]/gi, '');
    reading = reading.replace(/[（(][^)）]*?仅供参考[^)）]*[)）]/gi, '');
    reading = reading.replace(/---[\s\S]*$/, '').trim();
    return res.status(200).json({ reading: reading });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
