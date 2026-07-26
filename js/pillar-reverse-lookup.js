/**
 * Finds recent Gregorian dates whose four calculated pillars match a direct
 * pillar entry. This deliberately uses a single representative instant for
 * each shichen: the midpoint, with Zi represented by midnight on its display
 * date.
 */
(function() {
    var POSITIONS = ['year', 'month', 'day', 'hour'];
    var HOUR_NAMES = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
    var HOUR_MIDPOINTS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    var HOUR_RANGES = ['23:00—00:59', '01:00—02:59', '03:00—04:59', '05:00—06:59', '07:00—08:59', '09:00—10:59', '11:00—12:59', '13:00—14:59', '15:00—16:59', '17:00—18:59', '19:00—20:59', '21:00—22:59'];

    function isPillar(value) {
        return value && typeof value.gan === 'string' && typeof value.zhi === 'string';
    }

    function validPillars(pillars) {
        return pillars && POSITIONS.every(function(position) {
            return isPillar(pillars[position]);
        });
    }

    function samePillar(left, right) {
        return left && right && left.gan === right.gan && left.zhi === right.zhi;
    }

    function sameChart(chart, pillars) {
        return POSITIONS.every(function(position) {
            return samePillar(chart[position], pillars[position]);
        });
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month, 0)).getUTCDate();
    }

    function isoDate(year, month, day) {
        return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }

    function getCalculator(calculator) {
        if (typeof calculator === 'function') return calculator;
        return calculator && typeof calculator.calculate === 'function' ? calculator.calculate.bind(calculator) : null;
    }

    function getNowDate(now) {
        if (now && typeof now.getUTCFullYear === 'function') {
            return {
                year: now.getUTCFullYear(),
                month: now.getUTCMonth() + 1,
                day: now.getUTCDate()
            };
        }
        var date = new Date();
        return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
    }

    function findRecentMatches(options) {
        options = options || {};
        var pillars = options.pillars;
        var calculate = getCalculator(options.calculator);
        if (!validPillars(pillars) || !calculate) return [];

        var hourIndex = HOUR_NAMES.map(function(name) { return name.charAt(0); }).indexOf(pillars.hour.zhi);
        if (hourIndex < 0) return [];

        var now = getNowDate(options.now);
        var years = Number.isFinite(options.years) ? Math.max(0, Math.floor(options.years)) : 200;
        var lower = { year: now.year - years, month: now.month, day: now.day };
        var lowerIso = isoDate(lower.year, lower.month, lower.day);
        var nowIso = isoDate(now.year, now.month, now.day);
        var clock = HOUR_MIDPOINTS[hourIndex];
        var candidateYears = {};

        for (var year = lower.year - 1; year <= now.year; year++) {
            var sample = calculate(year, 7, 1, hourIndex, options.gender, clock);
            if (samePillar(sample.year, pillars.year)) {
                candidateYears[year] = true;
                candidateYears[year + 1] = true;
            }
        }

        var matches = [];
        Object.keys(candidateYears).forEach(function(yearString) {
            var year = Number(yearString);
            for (var month = 1; month <= 12; month++) {
                var lastDay = daysInMonth(year, month);
                for (var day = 1; day <= lastDay; day++) {
                    var iso = isoDate(year, month, day);
                    if (iso < lowerIso || iso > nowIso) continue;

                    var chart = calculate(year, month, day, hourIndex, options.gender, clock);
                    if (sameChart(chart, pillars)) {
                        matches.push({
                            year: year,
                            month: month,
                            day: day,
                            hourIndex: hourIndex,
                            clock: clock,
                            hourName: HOUR_NAMES[hourIndex],
                            hourRange: HOUR_RANGES[hourIndex],
                            iso: iso
                        });
                    }
                }
            }
        });

        var seen = {};
        return matches
            .sort(function(left, right) { return right.iso.localeCompare(left.iso); })
            .filter(function(match) {
                var key = match.iso + ':' + match.hourIndex;
                if (seen[key]) return false;
                seen[key] = true;
                return true;
            })
            .slice(0, 2);
    }

    window.PillarReverseLookup = {
        HOUR_MIDPOINTS: HOUR_MIDPOINTS,
        HOUR_RANGES: HOUR_RANGES,
        findRecentMatches: findRecentMatches
    };
})();
