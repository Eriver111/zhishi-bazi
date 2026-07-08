import re

with open('js/bazi.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Replace藏干 section - only use本气, remove cgKeCount penalty
old1 = """  // ---------- ④ 地支藏干辅助（正负双向，藏干权重约为天干一半） ----------
  ['year','month','day','hour'].forEach(function(pos) {
    var cg = getCangGan(bazi[pos].zhi);
    cg.forEach(function(g) {
      var gwx = WU_XING[g];
      if (gwx === dgWx)            score += 3;  // 藏干比肩（通根）
      else if (SHENGWO[dgWx] === gwx) score += 2;  // 藏干印星
      else if (KEWO[dgWx] === gwx)   score -= 2;  // 藏干官杀（半权）
      else if (WOSHENG[dgWx] === gwx) score -= 1;  // 藏干食伤（半权）
      else if (WOKE[dgWx] === gwx)   score -= 2;  // 藏干财星（半权）
    });
  });
  // 藏干克泄耗过多时的额外惩罚
  var cgKeCount = 0;
  ['year','month','day','hour'].forEach(function(pos) {
    var cg = getCangGan(bazi[pos].zhi);
    cg.forEach(function(g) {
      var gwx = WU_XING[g];
      if (KEWO[dgWx] === gwx || WOSHENG[dgWx] === gwx || WOKE[dgWx] === gwx) cgKeCount++;
    });
  });
  if (cgKeCount >= 6) score -= 5;  // 藏干克泄耗过半，暗箭难防
  else if (cgKeCount >= 4) score -= 2;"""

new1 = """  // ---------- ④ 地支藏干本气辅助（仅取本气，即藏干第一项，权重约为天干一半） ----------
  // 中气、余气不参与旺衰计算，避免过度累加
  ['year','month','day','hour'].forEach(function(pos) {
    var cg = getCangGan(bazi[pos].zhi);
    if (cg.length === 0) return;
    var g = cg[0]; // 只取本气
    var gwx = WU_XING[g];
    if (gwx === dgWx)            score += 3;  // 本气比肩（通根）
    else if (SHENGWO[dgWx] === gwx) score += 2;  // 本气印星
    else if (KEWO[dgWx] === gwx)   score -= 2;  // 本气官杀
    else if (WOSHENG[dgWx] === gwx) score -= 1;  // 本气食伤
    else if (WOKE[dgWx] === gwx)   score -= 2;  // 本气财星
  });"""

assert old1 in content, "Fix 1: old1 not found!"
content = content.replace(old1, new1)
print("✅ Fix 1: 藏干只取本气 + 去掉过耗惩罚")

# Fix 2: Add floor of 5 before level determination
old2 = """  // ---------- ⑨ 分级输出 ----------
  var level, label;
  if (score >= 80)      { level = '极强'; label = '元气充沛'; }
  else if (score >= 60) { level = '偏强'; label = '元气较足'; }
  else if (score >= 40) { level = '中和'; label = '元气均衡'; }
  else if (score >= 30) { level = '偏弱'; label = '元气偏柔'; }
  else                  { level = '极弱'; label = '元气清秀'; }"""

new2 = """  // ---------- ⑨ 分级输出 ----------
  // 分数下限 5，防止极端八字出现负数或零分
  if (score < 5) score = 5;
  var level, label;
  if (score >= 80)      { level = '极强'; label = '元气充沛'; }
  else if (score >= 60) { level = '偏强'; label = '元气较足'; }
  else if (score >= 40) { level = '中和'; label = '元气均衡'; }
  else if (score >= 30) { level = '偏弱'; label = '元气偏柔'; }
  else                  { level = '极弱'; label = '元气清秀'; }"""

assert old2 in content, "Fix 2: old2 not found!"
content = content.replace(old2, new2)
print("✅ Fix 2: 添加分数下限 5")

with open('js/bazi.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ 文件已保存")
