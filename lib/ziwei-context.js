function starLabel(star) {
  if (!star) return '';
  if (typeof star === 'string') return star;
  return (star.name || '')
    + (star.brightness ? '[' + star.brightness + ']' : '')
    + (star.mutagen ? '化' + star.mutagen : '');
}

function formatScope(scope) {
  if (!scope) return '';
  var line = (scope.name || '运限') + '：' + (scope.heavenlyStem || '') + (scope.earthlyBranch || '');
  if (scope.palaceNames && scope.palaceNames.length) line += '；十二宫顺序：' + scope.palaceNames.join('、');
  if (scope.mutagen && scope.mutagen.length) line += '；四化星：' + scope.mutagen.join('、');
  return line;
}

function buildZiweiContext(data) {
  data = data || {};
  var birth = data.birth || {};
  var context = '=== 紫微斗数命盘（排盘事实）===\n';
  context += '五行局：' + (data.wuxingJu || '未提供') + '\n';
  context += '命宫：' + (data.mingGong || '未提供') + '宫\n';
  context += '身宫：' + (data.bodyPalaceZhi || '未提供') + '宫，落' + (data.bodyPalace || '未提供') + '宫\n';
  context += '命主：' + (data.mingZhu || '未提供') + '；身主：' + (data.shenZhu || '未提供') + '\n';
  context += '出生：' + (birth.year || '') + '年' + (birth.month || '') + '月' + (birth.day || '') + '日 '
    + (birth.gender === 'female' ? '女' : '男') + '\n';
  if (birth.effectiveSolarDate) context += '排盘采用公历：' + birth.effectiveSolarDate + '\n';
  if (birth.lunarDate) context += '对应农历：' + birth.lunarDate + '\n';
  if (birth.chineseDate) context += '干支：' + birth.chineseDate + '\n';
  if (birth.correctedTime) context += '时间校正：' + birth.correctedTime + '\n';

  if (data.sihua && data.sihua.length) {
    context += '生年四化：' + data.sihua.map(function (item) {
      return item.star + '化' + item.hua + '（' + item.palace + '宫）';
    }).join('；') + '\n';
  }

  context += '\n--- 本命十二宫 ---\n';
  (data.palaces || []).forEach(function (palace) {
    var sections = [];
    var major = (palace.major || []).map(starLabel).filter(Boolean);
    var minor = (palace.minor || []).map(starLabel).filter(Boolean);
    if (major.length) sections.push('主星：' + major.join('、'));
    else sections.push('无主星');
    if (minor.length) sections.push('辅星：' + minor.join('、'));
    if (palace.adj && palace.adj.length) sections.push('杂曜：' + palace.adj.join('、'));
    if (palace.cs12) sections.push('长生：' + palace.cs12);
    if (palace.decadal && palace.decadal.range) sections.push('本宫大限年龄：' + palace.decadal.range.join('~'));
    context += palace.name + '宫（' + (palace.hStem || '') + (palace.eBranch || '') + '）：' + sections.join('；') + '\n';
  });

  var current = data.currentHoroscope;
  if (current) {
    context += '\n--- 当前运限（由排盘引擎计算，禁止自行改盘）---\n';
    if (current.asOf) context += '运限日期：' + current.asOf + '\n';
    ['decadal','age','yearly','monthly','daily','hourly'].forEach(function (key) {
      var line = formatScope(current[key]);
      if (line) context += line + '\n';
    });
  } else {
    context += '\n当前运限：未提供，不得推断精确流年、流月或应期。\n';
  }
  return context;
}

module.exports = { buildZiweiContext: buildZiweiContext };
