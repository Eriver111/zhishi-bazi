(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZiweiInput = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root) {
  var YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];
  var BRANCH_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  function validateSolarDate(year, month, day) {
    if (![year, month, day].every(Number.isInteger)) return false;
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    var date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function clockHourToBranchIndex(hour) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('hour must be 0-23');
    return hour === 23 ? 0 : Math.floor((hour + 1) / 2);
  }

  function formatSolarDate(year, month, day) {
    return year + '-' + month + '-' + day;
  }

  function normalizeBirth(input) {
    var year = Number(input.year), month = Number(input.month), day = Number(input.day);
    var hour = Number(input.hour), minute = Number(input.minute || 0);
    if (!validateSolarDate(year, month, day)) throw new RangeError('出生日期无效');
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute) || minute < 0 || minute >= 60) {
      throw new RangeError('出生时间无效');
    }

    var calculator = input.calculator || (root && root.BaZiCalculator);
    if (!calculator || typeof calculator.normalizeBirthInput !== 'function') {
      throw new Error('八字出生时间计算模块未加载');
    }
    var useTrueSolarTime = input.useTrueSolarTime !== false;
    var normalized = calculator.normalizeBirthInput({
      year: year,
      month: month,
      day: day,
      hour: clockHourToBranchIndex(hour),
      clock: hour,
      minute: minute,
      gender: input.gender,
      location: input.location || input.dist || input.city || input.prov || '',
      trueSolarTime: useTrueSolarTime,
      ziHourNextDay: input.ziHourNextDay === true,
    });
    var solarInfo = normalized.solarInfo;
    var trueHour = solarInfo ? solarInfo.trueHour : hour;
    var trueMinute = solarInfo ? solarInfo.trueMinute : minute;
    var solarMinutes = solarInfo ? solarInfo.solarMinutes : hour * 60 + minute;
    var dayOffset = solarInfo ? solarInfo.dayOffset : 0;
    var timeIndex = normalized.hour === 0 && normalized.dayPillarOffset && trueHour === 23 ? 12 : normalized.hour;
    var chartDate = new Date(normalized.year, normalized.month - 1, normalized.day);
    if (normalized.hour === 0 && normalized.dayPillarOffset && trueHour !== 23) {
      chartDate.setDate(chartDate.getDate() + 1);
    }
    var summary = (useTrueSolarTime && solarInfo ? '真太阳时 ' : '北京时间 ')
      + String(trueHour).padStart(2, '0') + ':' + String(trueMinute).padStart(2, '0')
      + ' · ' + BRANCH_NAMES[normalized.hour] + '时'
      + (normalized.dayPillarOffset ? ' · 已启用子时换日' : '')
      + (dayOffset ? ' · 跨日校正' : '');

    return {
      year: normalized.year,
      month: normalized.month,
      day: normalized.day,
      solarDate: formatSolarDate(chartDate.getFullYear(), chartDate.getMonth() + 1, chartDate.getDate()),
      timeIndex: timeIndex,
      branchIndex: normalized.hour,
      trueHour: trueHour,
      trueMinute: trueMinute,
      solarMinutes: solarMinutes,
      dayOffset: dayOffset,
      dayPillarOffset: normalized.dayPillarOffset,
      isZiHour: normalized.hour === 0,
      longitudeOffsetMinutes: solarInfo ? solarInfo.lngOffsetMin : 0,
      eotMinutes: solarInfo ? solarInfo.eotMin : 0,
      solarInfo: solarInfo,
      summary: summary,
    };
  }

  function getSoulBodyBranches(astrolabe) {
    return {
      soul: astrolabe && astrolabe.earthlyBranchOfSoulPalace || '',
      body: astrolabe && astrolabe.earthlyBranchOfBodyPalace || '',
    };
  }

  function getGenderDesignation(chineseDate, gender) {
    var yearStem = String(chineseDate || '').trim().charAt(0);
    var polarity = YANG_STEMS.indexOf(yearStem) >= 0 ? '阳' : '阴';
    return polarity + (gender === 'female' ? '女' : '男');
  }

  return {
    validateSolarDate: validateSolarDate,
    clockHourToBranchIndex: clockHourToBranchIndex,
    normalizeBirth: normalizeBirth,
    getSoulBodyBranches: getSoulBodyBranches,
    getGenderDesignation: getGenderDesignation,
  };
});
