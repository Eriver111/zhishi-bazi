(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var store = window.ZhishiPageState, form = document.getElementById('birthForm');
    if (!store || !form) return;
    var restoring = false, changed = false, timer;
    // Dependency order matters: each parent change rebuilds its child options.
    var ids = ['chartName', 'sYear', 'sMonth', 'sDay', 'sHour', 'sMinute',
      'lYear', 'lMonth', 'lDay', 'lHour', 'lMinute', 'province', 'city', 'district',
      'pYearGan', 'pYearZhi', 'pMonthGan', 'pMonthZhi', 'pDayGan', 'pDayZhi', 'pHourGan', 'pHourZhi',
      'solarEnabled', 'zishiHuanri'];
    function refresh() {
      if (window.ZhishiInputFlow) window.ZhishiInputFlow.refresh();
      if (window.ZhishiBirthSheet) window.ZhishiBirthSheet.refresh();
    }
    function save() {
      clearTimeout(timer);
      if (restoring || !changed || store.sync()) return;
      var fields = {};
      ids.forEach(function (id) {
        var el = document.getElementById(id); if (!el) return;
        var option = el.selectedOptions && el.selectedOptions[0];
        fields[id] = { value: el.value, checked: el.checked, clock: option && option.getAttribute('data-clock') };
      });
      var gender = document.querySelector('input[name="gender"]:checked');
      store.set('paipan:draft', { mode: currentMode, gender: gender && gender.value, fields: fields });
    }
    var draft = store.get('paipan:draft');
    if (draft && draft.fields && ['solar', 'lunar', 'pillars'].indexOf(draft.mode) >= 0) {
      restoring = true;
      window.__paipanInputTouched = true;
      // Restore hidden calendar controls before disabling the unused panel.
      ids.forEach(function (id) {
        var el = document.getElementById(id), saved = draft.fields[id]; if (!el || !saved) return;
        if (id === 'sHour' || id === 'lHour') setHourClockSelection(id, saved.value, saved.clock);
        else if (el.type === 'checkbox') el.checked = !!saved.checked;
        else el.value = saved.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      var name = document.getElementById('chartName'); if (name) name.dataset.restored = '1';
      document.querySelectorAll('input[name="gender"]').forEach(function (el) { el.checked = el.value === draft.gender; });
      switchMode(draft.mode);
      restoring = false; changed = true; refresh();
    }
    function edited(e) {
      if (restoring || !e.target.closest || !e.target.closest('#birthForm, .mobile-birth-sheet, [data-mode], [data-sheet-mode]')) return;
      changed = true; window.__paipanInputTouched = true;
      clearTimeout(timer); timer = setTimeout(save, 150);
    }
    document.addEventListener('input', edited);
    document.addEventListener('change', edited);
    document.addEventListener('click', function (e) { if (e.target.closest('[data-mode], [data-sheet-mode]')) edited(e); });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
    store.onReset(function () {
      clearTimeout(timer); changed = false; restoring = true;
      if (window.ZhishiBirthSheet) window.ZhishiBirthSheet.close();
      form.reset(); switchMode('solar');
      ids.forEach(function (id) {
        var el = document.getElementById(id); if (!el) return;
        if (el.tagName === 'SELECT') { el.value = ''; el.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      var name = document.getElementById('chartName'); if (name) { name.value = ''; delete name.dataset.restored; }
      window.__paipanInputTouched = true; restoring = false; refresh();
    });
  });
})();
