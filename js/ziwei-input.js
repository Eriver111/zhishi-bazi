(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZiweiInput = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  var YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];

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

  function equationOfTimeMinutes(year, month, day) {
    var date = new Date(year, month - 1, day);
    var dayOfYear = Math.floor((date - new Date(year, 0, 0)) / 86400000);
    var angle = 360 / 365 * (dayOfYear - 81) * Math.PI / 180;
    return 9.87 * Math.sin(2 * angle) - 7.53 * Math.cos(angle) - 1.5 * Math.sin(angle);
  }

  function formatSolarDate(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }

  function normalizeBirth(input) {
    var year = Number(input.year), month = Number(input.month), day = Number(input.day);
    var hour = Number(input.hour), minute = Number(input.minute || 0);
    if (!validateSolarDate(year, month, day)) throw new RangeError('出生日期无效');
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute) || minute < 0 || minute >= 60) {
      throw new RangeError('出生时间无效');
    }

    var rawMinutes = hour * 60 + minute;
    var eotMinutes = 0;
    var longitudeOffsetMinutes = 0;
    if (input.useTrueSolarTime !== false) {
      var longitude = Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : 120;
      longitudeOffsetMinutes = (longitude - 120) * 4;
      eotMinutes = equationOfTimeMinutes(year, month, day);
      rawMinutes += longitudeOffsetMinutes + eotMinutes;
    }

    var dayOffset = Math.floor(rawMinutes / 1440);
    var solarMinutes = ((rawMinutes % 1440) + 1440) % 1440;
    var trueHour = Math.floor(solarMinutes / 60);
    var trueMinute = Math.floor(solarMinutes % 60);
    var adjustedDate = new Date(year, month - 1, day + dayOffset);
    var timeIndex = trueHour === 23 ? 12 : clockHourToBranchIndex(trueHour);

    return {
      solarDate: formatSolarDate(adjustedDate),
      timeIndex: timeIndex,
      trueHour: trueHour,
      trueMinute: trueMinute,
      solarMinutes: solarMinutes,
      dayOffset: dayOffset,
      longitudeOffsetMinutes: longitudeOffsetMinutes,
      eotMinutes: eotMinutes,
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
    equationOfTimeMinutes: equationOfTimeMinutes,
    normalizeBirth: normalizeBirth,
    getSoulBodyBranches: getSoulBodyBranches,
    getGenderDesignation: getGenderDesignation,
  };
});
