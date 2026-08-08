// 紫微斗数证据化解析：只复述 iztro 盘面事实，不另造宫位、亮度或分数。
(function (root) {
  var STAR_TONES = {
    '紫微':'统筹、主导与自我要求', '天机':'思考、策划与变化',
    '太阳':'表达、承担与外显', '武曲':'执行、资源与决断',
    '天同':'协调、体验与缓冲', '廉贞':'边界、原则与取舍',
    '天府':'承载、管理与储备', '太阴':'观察、细节与内在感受',
    '贪狼':'欲望、社交与多元兴趣', '巨门':'辨析、沟通与质疑',
    '天相':'协作、规则与支持', '天梁':'照护、责任与庇荫',
    '七杀':'开创、压力与决断', '破军':'突破、重组与变化'
  };
  var HUA_TONES = {
    '禄':'资源、机会与连接增加',
    '权':'推动、掌控与责任加重',
    '科':'表达、规范与可见度提升',
    '忌':'牵挂、阻力与反复校正'
  };
  var PEACH_STARS = ['贪狼','廉贞','咸池','天姚','红鸾','天喜'];

  function findPalace(zi, name) {
    return ((zi && zi.palaces) || []).find(function (palace) { return palace.name === name; }) || null;
  }

  function starLabel(star) {
    if (!star) return '';
    return star.name + (star.brightness ? '（' + star.brightness + '）' : '')
      + (star.mutagen ? '化' + star.mutagen : '');
  }

  function starList(palace, key) {
    return ((palace && palace[key]) || []).map(starLabel).filter(Boolean);
  }

  function allStarNames(palace) {
    return ['majorStars','minorStars','adjectiveStars'].reduce(function (all, key) {
      return all.concat(((palace && palace[key]) || []).map(function (star) { return star.name; }));
    }, []);
  }

  function palaceTransformations(palaceName) {
    return (root._sihuaCol || []).filter(function (item) { return item.palace === palaceName; });
  }

  function emptyPalaceEvidence(zi, palaceName) {
    var borrowed = root.ZiweiProfessional.getBorrowedOpposite(zi, palaceName);
    var oppositeStars = starList(borrowed.opposite, 'majorStars');
    return palaceName + '无主星，按空宫法借对宫主星作为参照'
      + (borrowed.opposite ? '：对宫' + borrowed.opposite.name + (oppositeStars.length ? '见' + oppositeStars.join('、') : '亦无主星') : '')
      + '。空宫本身不直接等同于吉、凶、强或弱，仍需合看三方四正、四化与星曜亮度。';
  }

  function describePalace(zi, palaceName) {
    var palace = findPalace(zi, palaceName);
    if (!palace) return palaceName + '数据缺失，请重新排盘。';
    var majors = starList(palace, 'majorStars');
    var minors = starList(palace, 'minorStars');
    var lines = [];
    if (!majors.length) lines.push(emptyPalaceEvidence(zi, palaceName));
    else {
      lines.push(palaceName + '主星：' + majors.join('、') + '。');
      var tones = (palace.majorStars || []).map(function (star) {
        return star.name + '侧重' + (STAR_TONES[star.name] || '其本义');
      });
      if (tones.length) lines.push('星曜语义：' + tones.join('；') + '。具体表现需结合庙旺利陷和会照，不单凭星名定吉凶。');
    }
    if (minors.length) lines.push('辅星：' + minors.join('、') + '。');
    palaceTransformations(palaceName).forEach(function (item) {
      lines.push(item.star + '化' + item.hua + '落' + palaceName + '，提示该宫位更集中体现“' + HUA_TONES[item.hua] + '”；这是关注点，不是结果保证。');
    });
    return lines.join('\n');
  }

  function analyzeMingGong(zi) {
    var lines = [describePalace(zi, '命宫')];
    if (zi.fiveElementsClass) lines.push('五行局：' + zi.fiveElementsClass + '。');
    if (zi.soul || zi.body) lines.push('命主：' + (zi.soul || '—') + '；身主：' + (zi.body || '—') + '。');
    var bodyPalace = ((zi.palaces || []).find(function (palace) {
      return palace.earthlyBranch === zi.earthlyBranchOfBodyPalace;
    }) || {}).name;
    if (bodyPalace) lines.push('身宫落' + bodyPalace + '，用于补看后天着力方向，不替代命宫判断。');
    return { text:lines.join('\n') };
  }

  function analyzeCareerWealth(zi) {
    return { text:'【官禄宫】\n' + describePalace(zi, '官禄') + '\n【财帛宫】\n' + describePalace(zi, '财帛') };
  }

  function analyzeMarriage(zi) {
    var lines = [describePalace(zi, '夫妻')];
    var positions = [];
    (zi.palaces || []).forEach(function (palace) {
      var found = allStarNames(palace).filter(function (name) { return PEACH_STARS.indexOf(name) >= 0; });
      if (found.length) positions.push(palace.name + '见' + found.join('、'));
    });
    if (positions.length) lines.push('相关星曜位置：' + positions.join('；') + '。这里只记录分布，不按数量直接推断感情次数或婚期。');
    return { text:lines.join('\n') };
  }

  function analyzeSiHua() {
    var items = (root._sihuaCol || []).map(function (item) {
      return {
        star:item.star, hua:item.hua, palace:item.palace,
        color:item.color || root.ZiweiProfessional.HUA_COLORS[item.hua],
        text:item.star + '化' + item.hua + '落' + item.palace + '，重点观察' + HUA_TONES[item.hua] + '如何在该宫位展开；需与同宫、对宫及三方会照合参。'
      };
    });
    return items.length ? { items:items } : { text:'盘面未取得生年四化数据。', items:[] };
  }

  function evidenceLine(item) {
    var roleName = { target:'本宫', wealth:'三合位一', career:'三合位二', opposite:'对宫' }[item.role] || item.role;
    var major = item.major.map(function (star) { return starLabel(star); });
    var minorHua = item.minor.filter(function (star) { return star.mutagen; }).map(function (star) { return starLabel(star); });
    return roleName + item.palace + '：' + (major.length ? major.join('、') : '无主星')
      + (minorHua.length ? '；辅星四化' + minorHua.join('、') : '');
  }

  function analyzeSurrounded(zi) {
    return ['命宫','夫妻','财帛','官禄'].map(function (name) {
      var evidence = root.ZiweiProfessional.getSurroundedEvidence(zi, name);
      return {
        name:name + '三方四正',
        palaces:evidence.map(function (item) { return item.palace; }).join(' · '),
        summary:evidence.map(evidenceLine).join('；') + '。',
        highlights:(root._sihuaCol || []).filter(function (hua) {
          return evidence.some(function (item) { return item.palace === hua.palace; });
        }).map(function (hua) { return hua.star + '化' + hua.hua + '@' + hua.palace; }).join('，')
      };
    });
  }

  function formatText(text) {
    return (text || '').split('\n').map(function (line) {
      return '<p style="margin:0 0 8px;line-height:1.8;color:var(--tx2);font-size:13px">' + line + '</p>';
    }).join('');
  }

  function buildSection(title, content, color) {
    var section = document.createElement('div');
    section.className = 'zw-analysis-section';
    section.style.cssText = 'margin-top:16px;background:rgba(13,21,37,.55);border:1px solid rgba(201,168,76,.1);border-radius:12px;overflow:hidden';
    section.innerHTML = '<div style="padding:12px 16px;border-bottom:1px solid rgba(201,168,76,.08);font-size:15px;font-weight:bold;letter-spacing:3px;color:' + color + '">' + title + '</div>'
      + '<div style="padding:14px 16px">' + content + '</div>';
    return section;
  }

  function renderZwAnalysis(zi) {
    var container = document.getElementById('zwAnalysis');
    if (!container) {
      container = document.createElement('div');
      container.id = 'zwAnalysis';
      var triads = document.getElementById('triads');
      if (triads && triads.parentNode) triads.parentNode.insertBefore(container, triads.nextSibling);
      else document.body.appendChild(container);
    }
    container.innerHTML = '';
    container.appendChild(buildSection('命宫总览', formatText(analyzeMingGong(zi).text), '#e8d5a3'));
    container.appendChild(buildSection('事业财运', formatText(analyzeCareerWealth(zi).text), '#5b9fd4'));
    container.appendChild(buildSection('感情婚姻', formatText(analyzeMarriage(zi).text), '#e07050'));

    var transformations = analyzeSiHua();
    var huaHtml = transformations.items.length ? transformations.items.map(function (item) {
      return '<div style="margin-bottom:10px;padding:8px 12px;border-left:3px solid ' + item.color + ';background:rgba(255,255,255,.02);border-radius:8px">'
        + '<b style="color:' + item.color + '">' + item.star + '化' + item.hua + '</b><span style="color:var(--tx3);font-size:11px"> @ ' + item.palace + '</span>'
        + '<p style="margin:4px 0 0;font-size:13px;color:var(--tx2)">' + item.text + '</p></div>';
    }).join('') : formatText(transformations.text);
    container.appendChild(buildSection('四化点睛', huaHtml, '#e8a040'));

    var cards = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">';
    analyzeSurrounded(zi).forEach(function (item) {
      cards += '<div style="background:rgba(13,21,37,.6);border:1px solid rgba(91,127,165,.12);border-radius:10px;padding:14px">'
        + '<b style="color:#5b9fd4">' + item.name + '</b><div style="font-size:11px;color:var(--tx3);margin:4px 0">' + item.palaces + '</div>'
        + '<p style="font-size:12px;color:var(--tx2);line-height:1.7;margin:0">' + item.summary + '</p>'
        + (item.highlights ? '<div style="font-size:10px;color:var(--gold-l);margin-top:5px">四化：' + item.highlights + '</div>' : '') + '</div>';
    });
    cards += '</div><p style="font-size:10px;color:var(--tx3);margin:10px 0 0">以上为盘面证据汇总，不以固定加减分替代综合判断。</p>';
    container.appendChild(buildSection('三方四正', cards, '#5b9fd4'));

    var aiFollowup = document.createElement('button');
    aiFollowup.type = 'button';
    aiFollowup.className = 'zw-ai-hook';
    aiFollowup.style.cssText = 'display:block;width:100%;margin-top:16px;padding:12px 14px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.28);border-radius:10px;text-align:center;cursor:pointer;font:inherit;font-size:13px;color:var(--gold);letter-spacing:1px';
    aiFollowup.textContent = '基于当前命盘继续提问 →';
    aiFollowup.addEventListener('click', function () { window.location.href = 'zw-ai-chat.html?t=zw&v=2'; });
    container.appendChild(aiFollowup);
  }

  root.renderZwAnalysis = renderZwAnalysis;
  root.ZiweiAnalysis = {
    describePalace:describePalace,
    analyzeMingGong:analyzeMingGong,
    analyzeCareerWealth:analyzeCareerWealth,
    analyzeMarriage:analyzeMarriage,
    analyzeSiHua:analyzeSiHua,
    analyzeSurrounded:analyzeSurrounded
  };
})(window);
