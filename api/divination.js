/**
 * /api/divination - 占卜解读（梅花易数/六爻通用）
 * POST: { prompt } → AI 解卦
 */
const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat'; // 默认chat，可在.env覆盖

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    var prompt = (req.body && req.body.prompt) || '';
    if (!prompt) return res.status(400).json({ error: '缺少卦象信息' });

    var aiResp = await fetch(AI_API_URL, {
      method: 'POST', headers: { 'Content-Type':'application/json','Authorization':'Bearer '+AI_API_KEY },
      body: JSON.stringify({ model:AI_MODEL, messages:[{role:'user',content:prompt}], max_tokens:1500, temperature:0.5 })
    });
    var aiData = await aiResp.json();
    var reading = aiData.choices?.[0]?.message?.content || '卦象已显，静心体悟。';
    // 简单过滤常见免责尾巴
    reading = reading.replace(/（以上[^）]*）/g, '').replace(/\(以上[^)]*\)/g, '');
    reading = reading.replace(/温馨提示[^。\n]*[。\n]/g, '');
    reading = reading.replace(/---[\s\S]*$/, '').trim();
    if(!reading||reading.length<5) reading = '卦象已显，静心体悟。';
    return res.status(200).json({ reading: reading });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
