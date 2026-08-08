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

  return {
    HUA_COLORS: HUA_COLORS,
    collectMutagens: collectMutagens,
    getSurroundedEvidence: getSurroundedEvidence,
    getBorrowedOpposite: getBorrowedOpposite,
    getCurrentHoroscope: getCurrentHoroscope
  };
});
