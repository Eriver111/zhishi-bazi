/**
 * Normalizes user-entered BaZi pillars for use by both the input and result pages.
 */
(function() {
    var GANS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
    var ZHIS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    var POSITIONS = ['year', 'month', 'day', 'hour'];
    var LABELS = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
    var QUERY_KEYS = {
        year: ['yg', 'yz'], month: ['mg', 'mz'], day: ['dg', 'dz'], hour: ['hg', 'hz']
    };

    function isValidPair(gan, zhi) {
        var ganIndex = GANS.indexOf(gan);
        var zhiIndex = ZHIS.indexOf(zhi);
        return ganIndex >= 0 && zhiIndex >= 0 && ganIndex % 2 === zhiIndex % 2;
    }

    function readPillar(value) {
        if (typeof value === 'string' && value.length === 2) {
            return { gan: value.charAt(0), zhi: value.charAt(1) };
        }
        if (value && typeof value === 'object') {
            return { gan: value.gan, zhi: value.zhi };
        }
        return null;
    }

    function normalize(raw) {
        var input = raw && typeof raw === 'object' ? raw : {};
        var pillars = {};
        var errors = {};

        POSITIONS.forEach(function(position) {
            var pillar = readPillar(input[position]);
            var label = LABELS[position];
            if (!pillar || typeof pillar.gan !== 'string' || typeof pillar.zhi !== 'string') {
                errors[position] = label + '格式不正确';
            } else if (GANS.indexOf(pillar.gan) < 0 || ZHIS.indexOf(pillar.zhi) < 0) {
                errors[position] = label + '干支不正确';
            } else if (!isValidPair(pillar.gan, pillar.zhi)) {
                errors[position] = label + '干支阴阳不匹配';
            } else {
                pillars[position] = { gan: pillar.gan, zhi: pillar.zhi };
            }
        });

        return { ok: Object.keys(errors).length === 0, errors: errors, pillars: pillars };
    }

    function toSearchParams(pillars) {
        var normalized = normalize(pillars);
        var params = new URLSearchParams();
        if (!normalized.ok) return params;
        POSITIONS.forEach(function(position) {
            var keys = QUERY_KEYS[position];
            params.set(keys[0], normalized.pillars[position].gan);
            params.set(keys[1], normalized.pillars[position].zhi);
        });
        return params;
    }

    function fromSearchParams(searchParams) {
        if (!searchParams || typeof searchParams.get !== 'function') return null;
        var raw = {};
        POSITIONS.forEach(function(position) {
            var keys = QUERY_KEYS[position];
            raw[position] = { gan: searchParams.get(keys[0]), zhi: searchParams.get(keys[1]) };
        });
        var normalized = normalize(raw);
        return normalized.ok ? normalized.pillars : null;
    }

    window.PillarInput = {
        normalize: normalize,
        toSearchParams: toSearchParams,
        fromSearchParams: fromSearchParams
    };
})();
