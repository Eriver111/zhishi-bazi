/**
 * 认证模块 — 登录/注册/迁移/数据同步
 * v4.0
 */
var Auth = (function () {
  var _token = null;
  var _user = null;
  var _inited = false;

  // ============ 初始化 ============
  function init() {
    if (_inited) return;
    _inited = true;
    _token = localStorage.getItem('ai_auth_token');
    injectNavUser();
    if (_token) verifyAndRestore();
    checkMigration();
  }

  // ============ Token/User 管理 ============
  function getToken() { return _token; }
  function getUser() { return _user; }
  function isLoggedIn() { return !!_token && !!_user; }

  function setAuth(token, user) {
    _token = token;
    _user = user;
    try { localStorage.setItem('ai_auth_token', token); } catch (e) {}
    updateNavUI();
  }

  function logout() {
    _token = null;
    _user = null;
    try { localStorage.removeItem('ai_auth_token'); } catch (e) {}
    updateNavUI();
  }

  function verifyAndRestore() {
    fetch('/api/auth/verify', { headers: { 'Authorization': 'Bearer ' + _token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.valid && d.user) {
          _user = d.user;
          updateNavUI();
        } else {
          logout();
        }
      })
      .catch(function () { /* 网络问题，保持登录态 */ });
  }

  // ============ 登录/注册 ============
  function login(email, password) {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) { return r.json(); });
  }

  function register(email, password, phone, code) {
    return fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, phone: phone || undefined, code: code || '' })
    }).then(function (r) { return r.json(); });
  }

  // ============ 数据同步 ============
  function syncData(key, value) {
    if (!_token) return Promise.resolve();
    return fetch('/api/auth/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token },
      body: JSON.stringify({ key: key, value: value })
    }).then(function (r) { return r.json(); });
  }

  function getData(key) {
    if (!_token) return Promise.resolve(null);
    var url = '/api/auth/get-data' + (key ? '?key=' + encodeURIComponent(key) : '');
    return fetch(url, { headers: { 'Authorization': 'Bearer ' + _token } })
      .then(function (r) { return r.json(); })
      .then(function (d) { return key ? d.value : d.data; });
  }

  function loadData() {
    if (!_token) return Promise.resolve({});
    return getData().then(function (data) { return data || {}; });
  }

  // ============ 迁移 ============
  function migrate() {
    if (!_token) return;
    var codes = [];
    try {
      var c = localStorage.getItem('ai_chat_code');
      if (c) codes.push(c);
      var bc = localStorage.getItem('bazi_code');
      if (bc && codes.indexOf(bc) < 0) codes.push(bc);
    } catch (e) { }

    var reports = {};
    try {
      var br = localStorage.getItem('bazi_rpt');
      if (br) reports.bazi_rpt = br;
      var hr = localStorage.getItem('hepan_rpt');
      if (hr) reports.hepan_rpt = hr;
    } catch (e) { }

    var baziParams = null;
    try {
      var bp = localStorage.getItem('last_bazi_params');
      if (bp) baziParams = bp;
    } catch (e) { }

    var freeId = null;
    try { freeId = localStorage.getItem('ai_free_id'); } catch (e) { }

    var phone = null;
    try { phone = localStorage.getItem('ai_bound_phone'); } catch (e) { }

    return fetch('/api/auth/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token },
      body: JSON.stringify({
        codes: codes,
        reports: reports,
        bazi_params: baziParams,
        free_id: freeId,
        bound_phone: phone,
        ai_chat_code: localStorage.getItem('ai_chat_code') || ''
      })
    }).then(function (r) { return r.json(); });
  }

  function checkMigration() {
    if (_token) return;
    var hasData = false;
    try {
      if (localStorage.getItem('ai_chat_code')) hasData = true;
      if (localStorage.getItem('bazi_rpt')) hasData = true;
      if (localStorage.getItem('hepan_rpt')) hasData = true;
      if (localStorage.getItem('bazi_code')) hasData = true;
    } catch (e) { }
    if (!hasData) return;

    var dismissed = localStorage.getItem('migrate_dismissed');
    if (dismissed) {
      var ts = parseInt(dismissed);
      if (Date.now() - ts < 3 * 86400000) return; // 3天内不再提示
    }

    showBanner();
  }

  // ============ fetch 包装 ============
  function authFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    if (_token) options.headers['Authorization'] = 'Bearer ' + _token;
    return fetch(url, options);
  }

  // ============ UI：导航栏用户区 ============
  function injectNavUser() {
    // 桌面导航
    var nav = document.getElementById('zhishi-nav');
    if (!nav) return setTimeout(injectNavUser, 200);
    if (!document.getElementById('nav-user-area')) {
      var div = document.createElement('div');
      div.id = 'nav-user-area';
      div.className = 'nav-user';
      div.innerHTML =
        '<button class="btn-auth primary" id="btn-auth-register" onclick="Auth.showModal(\'register\')">注册</button>' +
        '<button class="btn-auth" id="btn-auth-login" onclick="Auth.showModal(\'login\')">登录</button>';
      nav.appendChild(div);
    }

    // 移动端底部导航
    var mobileNav = document.getElementById('zhishi-mobile-nav');
    if (mobileNav && !document.getElementById('mobile-nav-auth')) {
      var mdiv = document.createElement('div');
      mdiv.id = 'mobile-nav-auth';
      mdiv.style.cssText = 'display:flex;align-items:center;gap:6px';
      mdiv.innerHTML =
        '<a href="#" onclick="Auth.showModal(\'register\');return false" style="color:var(--gold-l)">注册</a>' +
        '<a href="#" onclick="Auth.showModal(\'login\');return false">登录</a>';
      mobileNav.appendChild(mdiv);
    }
  }

  function updateNavUI() {
    // 桌面导航
    var area = document.getElementById('nav-user-area');
    if (area) {
      if (isLoggedIn()) {
        var initial = (_user && _user.email) ? _user.email.charAt(0).toUpperCase() : 'U';
        area.innerHTML =
          '<div class="user-info" onclick="Auth.showProfile()">' +
          '<div class="user-avatar">' + initial + '</div>' +
          '<span>' + ((_user && _user.email) ? _user.email.split('@')[0] : '用户') + '</span>' +
          '</div>' +
          '<button class="btn-auth" onclick="Auth.logout()">退出</button>';
      } else {
        area.innerHTML =
          '<button class="btn-auth primary" id="btn-auth-register" onclick="Auth.showModal(\'register\')">注册</button>' +
          '<button class="btn-auth" id="btn-auth-login" onclick="Auth.showModal(\'login\')">登录</button>';
      }
    }

    // 移动端导航
    var marea = document.getElementById('mobile-nav-auth');
    if (marea) {
      if (isLoggedIn()) {
        var minitial = (_user && _user.email) ? _user.email.charAt(0).toUpperCase() : 'U';
        marea.innerHTML =
          '<a href="#" onclick="Auth.showProfile();return false" style="display:flex;align-items:center;gap:4px">' +
          '<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--gold-d),var(--gold));align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--ink)">' + minitial + '</span>' +
          '<span style="font-size:11px">' + ((_user && _user.email) ? _user.email.split('@')[0] : '我') + '</span>' +
          '</a>';
      } else {
        marea.innerHTML =
          '<a href="#" onclick="Auth.showModal(\'register\');return false" style="color:var(--gold-l)">注册</a>' +
          '<a href="#" onclick="Auth.showModal(\'login\');return false">登录</a>';
      }
    }
  }

  // ============ UI：登录/注册弹窗 ============
  var _currentMode = 'login';

  function showModal(mode) {
    _currentMode = mode || 'login';
    var overlay = document.getElementById('authOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'authOverlay';
      overlay.className = 'auth-overlay';
      document.body.appendChild(overlay);
    }
    renderModal(overlay);
    overlay.classList.add('show');
    overlay.onclick = function (e) { if (e.target === overlay) closeModal(); };
  }

  function closeModal() {
    var overlay = document.getElementById('authOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  var _sendCooldown = 0;
  var _sendTimer = null;

  function renderModal(overlay) {
    var isLogin = _currentMode === 'login';
    var title = isLogin ? '登录' : '注册';
    var subtitle = isLogin ? '登录后同步你的排盘数据和对话历史' : '创建账户，永久保存你的命理数据';
    var btnText = isLogin ? '登录' : '注册';
    var switchText = isLogin
      ? '还没有账户？<a onclick="Auth.showModal(\'register\')">立即注册</a>，送3次免费提问'
      : '已有账户？<a onclick="Auth.showModal(\'login\')">直接登录</a>';

    var codeHTML = '';
    if (!isLogin) {
      codeHTML =
        '<div class="auth-field"><label>邮箱验证码</label>' +
        '<div style="display:flex;gap:10px">' +
        '<input type="text" id="authCode" placeholder="6位验证码" maxlength="6" style="flex:1">' +
        '<button id="authSendCode" onclick="Auth.sendCode()" style="white-space:nowrap;padding:10px 16px;font-size:12px;font-weight:600;background:rgba(201,168,76,.1);color:var(--gold-l);border:1px solid rgba(201,168,76,.25);border-radius:8px;cursor:pointer;font-family:inherit;min-width:90px">发送验证码</button>' +
        '</div></div>';
    }

    var pwToggle = '<span onclick="var p=document.getElementById(\'authPassword\');var t=p.type===\'password\'?\'text\':\'password\';p.type=t;this.textContent=t===\'password\'?\'👁\':\'🙈\'" style="position:absolute;right:12px;top:34px;cursor:pointer;font-size:18px;user-select:none" title="显示密码">👁</span>';
    var cpwToggle = isLogin ? '' : '<span onclick="var p=document.getElementById(\'authPassword2\');var t=p.type===\'password\'?\'text\':\'password\';p.type=t;this.textContent=t===\'password\'?\'👁\':\'🙈\'" style="position:absolute;right:12px;top:34px;cursor:pointer;font-size:18px;user-select:none" title="显示密码">👁</span>';

    overlay.innerHTML =
      '<div class="auth-modal">' +
      '<button class="auth-close" onclick="Auth.closeModal()">&times;</button>' +
      '<div class="auth-title">' + title + '</div>' +
      '<div class="auth-subtitle">' + subtitle + '</div>' +
      '<div class="auth-field"><label>邮箱</label><input type="email" id="authEmail" placeholder="请输入邮箱"></div>' +
      '<div class="auth-field" style="position:relative"><label>密码</label><input type="password" id="authPassword" placeholder="至少6位">' + pwToggle + '</div>' +
      (isLogin ? '' : '<div class="auth-field" style="position:relative"><label>确认密码</label><input type="password" id="authPassword2" placeholder="再次输入密码">' + cpwToggle + '</div>') +
      (isLogin ? '' : '<div class="auth-field"><label>手机号（选填，用于找回）</label><input type="tel" id="authPhone" placeholder="如 13812345678"></div>') +
      codeHTML +
      '<div class="auth-error" id="authError"></div>' +
      (!isLogin ? '<div class="auth-bonus">🎁 注册即送 <strong>3 次</strong> 免费 AI 提问</div>' : '') +
      '<button class="auth-btn" id="authSubmitBtn" onclick="Auth.doSubmit()">' + btnText + '</button>' +
      '<div class="auth-switch">' + switchText + '</div>' +
      '</div>';
  }

  function sendCode() {
    var email = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value;
    var pw2El = document.getElementById('authPassword2');
    var password2 = pw2El ? pw2El.value : '';
    var err = document.getElementById('authError');
    var btn = document.getElementById('authSendCode');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErr(err, '请先输入正确的邮箱地址'); return;
    }
    if (password.length < 6) { showErr(err, '密码至少 6 位'); return; }
    if (password !== password2) { showErr(err, '两次密码不一致'); return; }
    if (_sendCooldown > 0) return;
    hideErr(err);
    btn.disabled = true;
    btn.textContent = '发送中...';

    fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { showErr(err, d.error); btn.disabled = false; btn.textContent = '发送验证码'; return; }
        if (d.dev_code) { document.getElementById('authCode').value = d.dev_code; }
        _sendCooldown = 60;
        btn.textContent = _sendCooldown + 's 后重发';
        btn.style.opacity = '0.5';
        _sendTimer = setInterval(function () {
          _sendCooldown--;
          if (_sendCooldown <= 0) {
            clearInterval(_sendTimer);
            btn.disabled = false;
            btn.textContent = '发送验证码';
            btn.style.opacity = '1';
          } else {
            btn.textContent = _sendCooldown + 's 后重发';
          }
        }, 1000);
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = '发送验证码';
        showErr(err, '网络错误，请稍后重试');
      });
  }

  function doSubmit() {
    var email = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value;
    var pw2El = document.getElementById('authPassword2');
    var password2 = pw2El ? pw2El.value : '';
    var phoneEl = document.getElementById('authPhone');
    var phone = phoneEl ? phoneEl.value.trim() : '';
    var codeEl = document.getElementById('authCode');
    var code = codeEl ? codeEl.value.trim() : '';
    var errEl = document.getElementById('authError');
    var btn = document.getElementById('authSubmitBtn');

    if (!email || !password) { showErr(errEl, '请填写邮箱和密码'); return; }
    if (password.length < 6) { showErr(errEl, '密码至少 6 位'); return; }
    if (_currentMode === 'register' && password !== password2) { showErr(errEl, '两次密码不一致'); return; }
    if (_currentMode === 'register' && !code) { showErr(errEl, '请输入邮箱验证码'); return; }

    btn.disabled = true;
    btn.textContent = '处理中...';
    hideErr(errEl);

    var promise = _currentMode === 'login' ? login(email, password) : register(email, password, phone || undefined, code);

    promise.then(function (d) {
      if (d.error) {
        showErr(errEl, d.error);
        btn.disabled = false;
        btn.textContent = _currentMode === 'login' ? '登录' : '注册';
        return;
      }
      setAuth(d.token, d.user);
      closeModal();

      // 注册成功提示
      if (_currentMode === 'register' && d.bonus) {
        showToast('注册成功！已赠送 ' + d.bonus + ' 次免费提问');
      }

      // 自动迁移本地数据
      migrate().then(function (m) {
        if (m && m.success) {
          try { localStorage.setItem('ai_migrated', '1'); } catch (e) { }
          var banner = document.getElementById('migrateBanner');
          if (banner) banner.style.display = 'none';
        }
      }).catch(function () { });
    }).catch(function () {
      showErr(errEl, '网络错误，请稍后重试');
      btn.disabled = false;
      btn.textContent = _currentMode === 'login' ? '登录' : '注册';
    });
  }

  function showProfile() {
    if (!_user) return;
    var msg = '📧 ' + _user.email + '\n📅 注册时间：' + (_user.created_at || '未知');
    alert(msg);
  }

  // ============ UI：迁移横幅 ============
  function showBanner() {
    var banner = document.getElementById('migrateBanner');
    if (banner) { banner.style.display = 'flex'; return; }
    banner = document.createElement('div');
    banner.id = 'migrateBanner';
    banner.className = 'migrate-banner';
    banner.innerHTML =
      '<span class="banner-text">你有<strong>未保存的排盘数据和兑换码</strong>，注册账户可永久保存</span>' +
      '<button class="banner-btn" onclick="Auth.showModal(\'register\');var b=document.getElementById(\'migrateBanner\');if(b)b.style.display=\'none\'">立即注册</button>' +
      '<button class="banner-dismiss" onclick="var b=document.getElementById(\'migrateBanner\');b.style.display=\'none\';localStorage.setItem(\'migrate_dismissed\',Date.now())">&times;</button>';
    document.body.appendChild(banner);
    setTimeout(function () { banner.style.display = 'flex'; }, 1000);
  }

  // ============ 小工具 ============
  function showToast(msg) {
    var t = document.createElement('div');
    t.className = 'auth-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2500);
    setTimeout(function () { t.remove(); }, 2800);
  }
  function showErr(el, msg) { if (el) { el.textContent = msg; el.style.display = 'block'; } }
  function hideErr(el) { if (el) { el.style.display = 'none'; } }

  // 暴露到全局
  return {
    init: init,
    getToken: getToken,
    getUser: getUser,
    isLoggedIn: isLoggedIn,
    login: login,
    register: register,
    logout: logout,
    setAuth: setAuth,
    syncData: syncData,
    getData: getData,
    loadData: loadData,
    migrate: migrate,
    fetch: authFetch,
    showModal: showModal,
    closeModal: closeModal,
    doSubmit: doSubmit,
    sendCode: sendCode,
    showProfile: showProfile
  };
})();

// 自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { Auth.init(); });
} else {
  Auth.init();
}
