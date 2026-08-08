(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HepanPersonBuilder = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  function parsePersonParams(params, prefix) {
    var year = Number(params[prefix + 'y']);
    var month = Number(params[prefix + 'm']);
    var day = Number(params[prefix + 'd']);
    var hour = Number(params[prefix + 'h']);
    var clock = params[prefix + 'clock'] === undefined ? hour : Number(params[prefix + 'clock']);
    var minute = params[prefix + 'min'] === undefined ? 0 : Number(params[prefix + 'min']);
    var gender = params[prefix + 'g'];
    if (![year, month, day, hour, clock, minute].every(Number.isFinite) || !gender) return null;
    return {
      year: year, month: month, day: day, hour: hour, clock: clock, minute: minute,
      gender: gender, cal: params[prefix + 'cal'] || 'solar',
      prov: params[prefix + 'prov'] || '', city: params[prefix + 'city'] || '', dist: params[prefix + 'dist'] || '',
      trueSolarTime: params[prefix + 'solar'] !== '0',
      ziHourNextDay: params[prefix + 'zishi'] === '1',
    };
  }

  function buildPillar(pillar) {
    return {
      gan: pillar.gan, zhi: pillar.zhi, cangGan: pillar.cangGan || [], nayin: pillar.nayin || '',
      shiShen: {
        ganSS: pillar.shiShen ? pillar.shiShen.gan : '',
        zhiSS: pillar.shiShen ? pillar.shiShen.zhi : '',
      },
    };
  }

  function countFullWuxing(pillars, calculator) {
    var count = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    pillars.forEach(function(pillar) {
      var ganWx = calculator.WU_XING[pillar.gan];
      var zhiWx = calculator.DI_ZHI_WU_XING[pillar.zhi];
      if (ganWx) count[ganWx]++;
      if (zhiWx) count[zhiWx]++;
      (pillar.cangGan || []).forEach(function(gan) {
        var wx = calculator.WU_XING[gan];
        if (wx) count[wx]++;
      });
    });
    return count;
  }

  function buildPerson(name, params, calculator) {
    if (!calculator || typeof calculator.calculateFromBirthInput !== 'function') {
      throw new Error('个人八字专业计算模块未加载');
    }
    var calculated = calculator.calculateFromBirthInput({
      year: params.year, month: params.month, day: params.day, hour: params.hour,
      clock: params.clock, minute: params.minute, gender: params.gender,
      location: params.city || params.dist || params.prov || '',
      trueSolarTime: params.trueSolarTime,
      ziHourNextDay: params.ziHourNextDay,
    });
    var bazi = calculated.bazi;
    var pillars = ['year', 'month', 'day', 'hour'].map(function(position) { return buildPillar(bazi[position]); });
    var facts = calculator.getProfessionalReportFacts(bazi, params.gender);
    return {
      _bazi: bazi,
      _normalizedBirth: calculated.normalized,
      _professionalFacts: facts,
      name: name,
      gender: params.gender,
      dayGan: bazi.day.gan,
      dayZhi: bazi.day.zhi,
      dayMaster: bazi.day.gan,
      dmWuxing: bazi.day.wuXing.gan,
      shenSha: calculator.calculateShenSha(bazi).map(function(item) { return item.name; }),
      pillars: pillars,
      wuxing: countFullWuxing(pillars, calculator),
    };
  }

  return { parsePersonParams: parsePersonParams, buildPerson: buildPerson };
});
