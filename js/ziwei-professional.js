(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZiweiProfessional = api;
})(typeof window !== 'undefined' ? window : this, function () {
  var HUA_COLORS = { '禄':'#4CAF50', '权':'#FF9800', '科':'#2196F3', '忌':'#F44336' };

  function allStars(palace) {
    return [
      { scope:'major', stars:(palace && palace.majorStars) || [] },
      { scope:'minor', stars:(palace && palace.minorStars) || [] }
    ];
  }

  function collectMutagens(zi) {
    var result = [];
    ((zi && zi.palaces) || []).forEach(function (palace) {
      allStars(palace).forEach(function (group) {
        group.stars.forEach(function (star) {
          if (!star || !HUA_COLORS[star.mutagen]) return;
          result.push({
            star: star.name,
            hua: star.mutagen,
            palace: palace.name,
            zhi: palace.earthlyBranch,
            scope: group.scope,
            brightness: star.brightness || '',
            color: HUA_COLORS[star.mutagen]
          });
        });
      });
    });
    var order = { '禄':0, '权':1, '科':2, '忌':3 };
    return result.sort(function (a, b) { return order[a.hua] - order[b.hua]; });
  }

  function palaceFact(role, palace) {
    if (!palace) return null;
    return {
      role: role,
      palace: palace.name,
      zhi: palace.earthlyBranch,
      major: (palace.majorStars || []).map(function (star) {
        return { name:star.name, brightness:star.brightness || '', mutagen:star.mutagen || '' };
      }),
      minor: (palace.minorStars || []).map(function (star) {
        return { name:star.name, brightness:star.brightness || '', mutagen:star.mutagen || '' };
      })
    };
  }

  function getSurroundedEvidence(zi, palaceName) {
    if (!zi || typeof zi.surroundedPalaces !== 'function') return [];
    var surrounded = zi.surroundedPalaces(palaceName);
    return [
      palaceFact('target', surrounded.target),
      palaceFact('wealth', surrounded.wealth),
      palaceFact('career', surrounded.career),
      palaceFact('opposite', surrounded.opposite)
    ].filter(Boolean);
  }

  function getBorrowedOpposite(zi, palaceName) {
    var evidence = getSurroundedEvidence(zi, palaceName);
    var targetFact = evidence.find(function (item) { return item.role === 'target'; }) || null;
    var oppositeFact = evidence.find(function (item) { return item.role === 'opposite'; }) || null;
    var findPalace = function (name) {
      return ((zi && zi.palaces) || []).find(function (palace) { return palace.name === name; }) || null;
    };
    var target = findPalace(targetFact ? targetFact.palace : palaceName);
    var opposite = findPalace(oppositeFact ? oppositeFact.palace : '');
    return {
      isEmpty: !!(target && (!target.majorStars || target.majorStars.length === 0)),
      target: target,
      opposite: opposite,
      evidence: evidence
    };
  }

  function getCurrentHoroscope(zi, date) {
    if (!zi || typeof zi.horoscope !== 'function') return null;
    try { return zi.horoscope(date || new Date()); }
    catch (error) { return null; }
  }

  function compactScope(scope) {
    if (!scope) return null;
    return {
      name: scope.name || '',
      index: scope.index,
      heavenlyStem: scope.heavenlyStem || '',
      earthlyBranch: scope.earthlyBranch || '',
      palaceNames: (scope.palaceNames || []).slice(),
      mutagen: (scope.mutagen || []).slice()
    };
  }

  function normalizePalaceName(name) {
    return String(name || '').replace(/宫$/, '');
  }

  function buildChatData(zi, birth, normalized, horoscope) {
    birth = birth || {};
    normalized = normalized || {};
    var soulBranch = zi.earthlyBranchOfSoulPalace || '';
    var bodyBranch = zi.earthlyBranchOfBodyPalace || '';
    var bodyPalace = normalizePalaceName(((zi.palaces || []).find(function (palace) {
      return palace.earthlyBranch === bodyBranch;
    }) || {}).name);
    var current = horoscope ? {
      asOf: horoscope.solarDate || '',
      lunarDate: horoscope.lunarDate || '',
      decadal: compactScope(horoscope.decadal),
      age: compactScope(horoscope.age),
      yearly: compactScope(horoscope.yearly),
      monthly: compactScope(horoscope.monthly),
      daily: compactScope(horoscope.daily),
      hourly: compactScope(horoscope.hourly)
    } : null;

    return {
      type: 'ziwei',
      birth: {
        year: birth.y,
        month: birth.m,
        day: birth.d,
        hour: birth.h,
        minute: birth.min || 0,
        gender: birth.isMale ? 'male' : 'female',
        prov: birth.prov || '',
        city: birth.city || '',
        dist: birth.dist || '',
        calendar: birth.calendar || 'solar',
        useTrueSolarTime: birth.useTrueSolarTime !== false,
        ziHourNextDay: birth.ziHourNextDay === true,
        effectiveSolarDate: normalized.solarDate || zi.solarDate || '',
        lunarDate: zi.lunarDate || '',
        chineseDate: zi.chineseDate || '',
        correctedTime: normalized.summary || ''
      },
      mingGong: soulBranch,
      bodyPalace: bodyPalace,
      bodyPalaceZhi: bodyBranch,
      wuxingJu: zi.fiveElementsClass || '',
      mingZhu: zi.soul || '',
      shenZhu: zi.body || '',
      sihua: collectMutagens(zi).map(function (item) {
        return Object.assign({}, item, { palace: normalizePalaceName(item.palace) });
      }),
      currentHoroscope: current,
      palaces: (zi.palaces || []).map(function (palace) {
        return {
          index: palace.index,
          name: normalizePalaceName(palace.name),
          hStem: palace.heavenlyStem,
          eBranch: palace.earthlyBranch,
          major: (palace.majorStars || []).map(function (star) {
            return { name:star.name, brightness:star.brightness || '', mutagen:star.mutagen || '' };
          }),
          minor: (palace.minorStars || []).map(function (star) {
            return { name:star.name, brightness:star.brightness || '', mutagen:star.mutagen || '' };
          }),
          adj: (palace.adjectiveStars || []).map(function (star) { return star.name; }),
          cs12: palace.changsheng12 || '',
          boshi12: palace.boshi12 || '',
          jiangqian12: palace.jiangqian12 || '',
          suiqian12: palace.suiqian12 || '',
          decadal: palace.decadal || null,
          ages: (palace.ages || []).slice()
        };
      })
    };
  }

  function getPalaceTriadGroups() {
    return [
      { name:'命财官线', palaces:['命宫','财帛','官禄'], summary:'事业成就与人生格局的核心轴线' },
      { name:'兄疾田线', palaces:['兄弟','疾厄','田宅'], summary:'家庭健康与内在安全感的根基' },
      { name:'夫迁福线', palaces:['夫妻','迁移','福德'], summary:'关系模式、外部环境与精神感受的联动' },
      { name:'子友父线', palaces:['子女','仆役','父母'], summary:'子女、合作人际与长辈支持的联动' }
    ];
  }

  return {
    HUA_COLORS: HUA_COLORS,
    collectMutagens: collectMutagens,
    getSurroundedEvidence: getSurroundedEvidence,
    getBorrowedOpposite: getBorrowedOpposite,
    getCurrentHoroscope: getCurrentHoroscope,
    normalizePalaceName: normalizePalaceName,
    buildChatData: buildChatData,
    getPalaceTriadGroups: getPalaceTriadGroups
  };
});
