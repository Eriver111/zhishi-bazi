(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeepReportAnchor = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var MIN_YEAR = 1900;
  var MAX_YEAR = 2200;

  function validYear(value) {
    var year = Number(value);
    return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR ? year : 0;
  }

  function chinaYear(now) {
    var date = now || new Date();
    var value = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric'
    }).format(date);
    return Number(value);
  }

  function paidAtYear(value) {
    var raw = String(value || '');
    var date = new Date(raw);
    var year = date.toString() === 'Invalid Date' ? 0 : validYear(chinaYear(date));
    return year || validYear(raw.slice(0, 4));
  }

  function resolve(options) {
    options = options || {};
    var paidYear = paidAtYear(options.paidAt);
    if (paidYear) return paidYear;

    var key = options.chartKey ? 'deep_report_anchor_v1:' + String(options.chartKey) : '';
    var stored = 0;
    if (key && options.storage && typeof options.storage.getItem === 'function') {
      try {
        stored = validYear(options.storage.getItem(key));
      } catch (error) {
        return chinaYear(options.now);
      }
      if (stored) return stored;
    }

    var local = validYear(options.localYear);
    if (local) return local;

    var year = chinaYear(options.now);
    if (key && options.storage && typeof options.storage.setItem === 'function' && validYear(year)) {
      try { options.storage.setItem(key, String(year)); } catch (error) { /* storage is optional */ }
    }
    return year;
  }

  function reportQuery(report) {
    var params = (report && report.report_params) || {};
    var query = new URLSearchParams();
    if (params.mode === 'pillars' && params.pillars) {
      var keys = { year: ['yg', 'yz'], month: ['mg', 'mz'], day: ['dg', 'dz'], hour: ['hg', 'hz'] };
      Object.keys(keys).forEach(function (position) {
        var value = params.pillars[position] || '';
        query.set(keys[position][0], value.charAt(0));
        query.set(keys[position][1], value.charAt(1));
      });
      query.set('mode', 'pillars');
      query.set('timing', params.timing || 'unknown');
    } else {
      if (params.mode === 'lunar') query.set('cal', 'lunar');
      query.set('zishi', params.ziHourRule === 'next-day' ? '1' : '0');
      query.set('solar', params.trueSolarTime === 'disabled' ? '0' : '1');
    }
    ['year', 'month', 'day', 'hour', 'clock', 'minute', 'gender', 'prov', 'city', 'dist']
      .forEach(function (key) {
        if (params[key] !== undefined && params[key] !== '') query.set(key, params[key]);
      });
    if (params.mode !== 'pillars' && Number.isFinite(Number(params.clock)) && !Number.isInteger(Number(params.clock))) {
      query.set('report_clock_normalized', '1');
    }
    return query;
  }

  function paidReportHref(report) {
    var query = reportQuery(report);
    var paidYear = paidAtYear(report && report.paid_at);
    if (paidYear) query.set('report_year', String(paidYear));
    return '/result?' + query.toString();
  }

  return {
    chinaYear: chinaYear,
    paidAtYear: paidAtYear,
    resolve: resolve,
    paidReportHref: paidReportHref
  };
}));
