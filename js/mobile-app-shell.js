(function () {
  'use strict';

  if (window.__ZHISHI_MOBILE_APP_SHELL__) return;
  window.__ZHISHI_MOBILE_APP_SHELL__ = true;

  var path = (location.pathname || '/').replace(/\.html$/, '') || '/';
  var isHome = path === '/' || path === '/index';
  var isPaipan = path === '/paipan';
  var isResult = path === '/result';

  var pageTitles = {
    '/paipan': '八字排盘', '/result': '知时八字', '/ziwei': '紫微斗数',
    '/hepan': '合盘缘分', '/hepan-result': '合盘结果', '/fortune': '今日运势', '/liuyao': '六爻占卜',
    '/meihua': '梅花易数', '/face': 'AI 观面', '/palm': 'AI 观手',
    '/fengshui': '八宅堪舆', '/archives': '命盘档案', '/profile': '个人中心',
    '/pricing': '积分与会员'
  };

  document.body.classList.add(isHome ? 'mobile-page-home' : (isPaipan ? 'mobile-page-paipan' : (isResult ? 'mobile-page-result' : 'mobile-page-inner')));

  var icons = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3.7l8.5 6.8v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M9 20.5v-6h6v6"/></svg>',
    fate: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5c2.4 2.2 3.6 5 3.6 8.5S14.4 18.3 12 20.5M12 3.5C9.6 5.7 8.4 8.5 8.4 12s1.2 6.3 3.6 8.5M3.8 12h16.4"/></svg>',
    divination: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14M7 9h4M13 9h4M5 13h6M13 13h6M7 17h4M13 17h4"/></svg>',
    observe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.5-5.5 9.2-5.5 9.2 5.5 9.2 5.5-3.5 5.5-9.2 5.5S2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };

  var sections = [
    { key: 'home', label: '首页', href: '/' },
    { key: 'fate', label: '命理', href: '/paipan' },
    { key: 'divination', label: '卜筮', href: '/liuyao' },
    { key: 'observe', label: '观相', href: '/face' },
    { key: 'profile', label: '我的', href: '/profile' }
  ];

  function activeKey() {
    if (isHome) return 'home';
    if (/^\/(paipan|ziwei|hepan|hepan-result|result|zw-result)/.test(path)) return 'fate';
    if (/^\/(liuren|liuyao|meihua)/.test(path)) return 'divination';
    if (/^\/(face|palm|fengshui)/.test(path)) return 'observe';
    if (/^\/(profile|archives|pricing|auth)/.test(path)) return 'profile';
    return '';
  }

  function createHeader() {
    var header = document.createElement('header');
    header.className = 'mobile-app-header';
    header.setAttribute('aria-label', '页面导航');

    var left = document.createElement('button');
    left.className = 'mobile-app-header__button';
    if (isHome) {
      left.type = 'button';
      left.setAttribute('aria-label', '打开全部功能');
      left.setAttribute('aria-controls', 'mobileAppDrawer');
      left.setAttribute('aria-expanded', 'false');
      left.innerHTML = icons.menu;
      left.addEventListener('click', openDrawer);
    } else {
      left.type = 'button';
      left.setAttribute('aria-label', '返回上一页');
      left.innerHTML = icons.back;
      left.addEventListener('click', function () {
        if (window.history.length > 1) window.history.back();
        else window.location.href = '/';
      });
    }

    var title = document.createElement(isHome ? 'a' : 'div');
    title.className = isHome ? 'mobile-app-header__brand' : 'mobile-app-header__title';
    if (isHome) title.href = '/';
    title.textContent = isHome ? '知 时' : (pageTitles[path] || document.title.split('-')[0].trim() || '知时');

    var profile = document.createElement('a');
    profile.className = 'mobile-app-header__button';
    profile.href = '/profile';
    profile.setAttribute('aria-label', '进入个人中心');
    profile.innerHTML = icons.profile;

    header.append(left, title, profile);
    document.body.insertBefore(header, document.body.firstChild);
  }

  var drawer;
  var drawerOverlay;
  var drawerTrigger;

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawerTrigger = document.querySelector('[aria-controls="mobileAppDrawer"]');
    if (drawerTrigger) drawerTrigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('mobile-drawer-open');
    var close = drawer.querySelector('.mobile-app-drawer__close');
    if (close) close.focus();
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawerOverlay.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (drawerTrigger) drawerTrigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('mobile-drawer-open');
    if (drawerTrigger) drawerTrigger.focus();
  }

  function createDrawer() {
    drawerOverlay = document.createElement('div');
    drawerOverlay.className = 'mobile-app-drawer__overlay';
    drawerOverlay.addEventListener('click', closeDrawer);

    drawer = document.createElement('aside');
    drawer.id = 'mobileAppDrawer';
    drawer.className = 'mobile-app-drawer';
    drawer.setAttribute('aria-label', '全部功能');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="mobile-app-drawer__head"><div><strong>知 时</strong><span>知天时，见自己</span></div><button class="mobile-app-drawer__close" type="button" aria-label="关闭菜单">' + icons.close + '</button></div>' +
      '<div class="mobile-app-drawer__body">' +
        '<section><h2>命理</h2><div class="mobile-app-drawer__grid"><a href="/paipan"><b>命</b><span>八字排盘</span></a><a href="/ziwei"><b>斗</b><span>紫微斗数</span></a><a href="/hepan"><b>缘</b><span>合盘缘分</span></a><a href="/fortune"><b>运</b><span>今日运势</span></a></div></section>' +
        '<section><h2>卜筮</h2><div class="mobile-app-drawer__grid"><a href="/liuyao"><b>爻</b><span>六爻占卜</span></a><a href="/meihua"><b>梅</b><span>梅花易数</span></a></div></section>' +
        '<section><h2>观相 · 堪舆</h2><div class="mobile-app-drawer__grid"><a href="/face"><b>面</b><span>AI 观面</span></a><a href="/palm"><b>手</b><span>AI 观手</span></a><a href="/fengshui"><b>宅</b><span>八宅堪舆</span></a></div></section>' +
        '<section><h2>账户</h2><div class="mobile-app-drawer__list"><a href="/archives">命盘档案</a><a href="/profile">个人中心</a><a href="/pricing">积分与会员</a></div></section>' +
      '</div>';
    drawer.querySelector('.mobile-app-drawer__close').addEventListener('click', closeDrawer);
    document.body.append(drawerOverlay, drawer);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });
  }

  function createBottomNav() {
    var nav = document.createElement('nav');
    nav.className = 'mobile-app-nav';
    nav.setAttribute('aria-label', '手机端主导航');
    var current = activeKey();

    sections.forEach(function (item) {
      var link = document.createElement('a');
      link.href = item.href;
      link.setAttribute('aria-label', item.label);
      if (item.key === current) link.setAttribute('aria-current', 'page');
      link.innerHTML = icons[item.key] + '<span>' + item.label + '</span>';
      nav.appendChild(link);
    });

    document.body.appendChild(nav);
  }

  function createResultModeTabs() {
    if (!isResult) return;
    var container = document.querySelector('.result-container');
    if (!container || document.querySelector('.mobile-result-tabs')) return;

    var tabs = document.createElement('nav');
    tabs.className = 'mobile-result-tabs';
    tabs.setAttribute('aria-label', '命盘内容');
    var items = [
      { key: 'info', label: '基本信息', target: '.result-header' },
      { key: 'basic', label: '基本排盘', target: '#sizhuSection' },
      { key: 'professional', label: '专业细盘', target: '#sizhuSection' },
      { key: 'notes', label: '断事笔记', target: '#proSection' }
    ];

    function activate(item, button) {
      document.body.classList.remove('mobile-result-view-info', 'mobile-result-view-basic', 'mobile-result-view-professional', 'mobile-result-view-notes');
      document.body.classList.add('mobile-result-view-' + item.key);
      tabs.querySelectorAll('button').forEach(function (tab) {
        var active = tab === button;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      var target = document.querySelector(item.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    items.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', item.key === 'professional' ? 'true' : 'false');
      if (item.key === 'professional') button.className = 'is-active';
      button.addEventListener('click', function () { activate(item, button); });
      tabs.appendChild(button);
    });

    document.body.classList.add('mobile-result-view-professional');
    document.body.insertBefore(tabs, container);
  }

  function syncResultSectionOrder(media) {
    if (!isResult) return;
    var container = document.querySelector('.result-container');
    var sizhu = document.getElementById('sizhuSection');
    var dayun = document.getElementById('dayunSection');
    var liunian = document.getElementById('liunianSection');
    if (!container || !sizhu || !dayun || !liunian) return;

    if (media.matches) {
      // 手机端以本命四柱为阅读起点，大运、流年紧随其后。
      container.insertBefore(sizhu, dayun);
    } else {
      // 宽屏恢复原有顺序，避免改变电脑端既有使用习惯。
      container.insertBefore(dayun, sizhu);
      container.insertBefore(liunian, sizhu);
    }
  }

  var resultMedia = window.matchMedia('(max-width: 700px)');
  syncResultSectionOrder(resultMedia);
  if (resultMedia.addEventListener) {
    resultMedia.addEventListener('change', function () { syncResultSectionOrder(resultMedia); });
  }

  createDrawer();
  createHeader();
  createResultModeTabs();
  createBottomNav();
})();
