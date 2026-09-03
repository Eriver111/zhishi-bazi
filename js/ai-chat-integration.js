/**
 * AI 命理对话 — 结果页集成模块 v3.0
 * 支持：前2次免费 + 次数包(¥9.9/10次) + 月会员(¥29.9/30天) + 老用户迁移
 */
(function() {
  'use strict';

  // ===== 状态 =====
  var AI = {
    credits: 0,
    code: '',
    messages: [],
    isWaiting: false,
    drawerOpen: false,
    pageType: '',
    isMonthly: false,       // 月会员标记
    monthlyExpires: '',     // 会员到期时间
    mode: 'simple',         // 'simple'=白话版 'pro'=专业版
    freeRemaining: 0,       // 免费剩余次数
    freeId: '',             // 免费用户标识
  };

  var $fab, $badge, $backdrop, $drawer, $messages, $input, $sendBtn, $emptyState,
      $creditsLabel, $buyBar, $inputWrap, $statusLine;

  // 检测页面类型（顶层，所有事件处理器都能访问）
  function detectPageType(){
    // 合盘页也会加载部分个人排盘全局量，必须先识别 _hepanData，
    // 否则会把合盘误当成单人 result，只传其中一人的命盘。
    try{if(typeof window._hepanData!=='undefined'&&window._hepanData!==null)return'hepan'}catch(e){}
    try{if(typeof _bazi!=='undefined'&&_bazi!==null)return'result'}catch(e){}
    try{if(typeof _params!=='undefined'&&_params!==null)return'result'}catch(e){}
    try{if(document.querySelector('.shapan-grid'))return'liuren'}catch(e){}
    try{if(document.title.indexOf('紫微')>=0)return'ziwei'}catch(e){}
    try{if(document.title.indexOf('六壬')>=0)return'liuren'}catch(e){}
    try{if(window.location.href.indexOf('ziwei')>=0)return'ziwei'}catch(e){}
    try{if(window.location.href.indexOf('liuren')>=0)return'liuren'}catch(e){}
    return'result';}

  // ===== 初始化 =====
  function init() {
    AI.pageType = detectPageType();

    // 初始化免费用户标识
    initFreeId();

    waitForData(function() {
      injectUI();
      restoreSession();
      migrateLegacyUsers();
      syncUserCredits();
      resumeArchivedChat();
    });
  }

  function openStandaloneChat() {
    var pt=detectPageType(),cd=buildChartData(),tgt='ai-chat.html';
    if(cd&&pt==='result'&&window.ZhishiCalibration&&typeof window.ZhishiCalibration.summary==='function')cd.calibrationSummary=window.ZhishiCalibration.summary(cd);
    if(pt==='ziwei'){tgt='zw-ai-chat.html';if(cd)try{localStorage.setItem('ai_ziwei_data',JSON.stringify(cd))}catch(ex){}}
    else if(pt==='liuren'){tgt='lr-ai-chat.html';if(cd)try{localStorage.setItem('ai_liuren_data',JSON.stringify(cd))}catch(ex){}}
    else{if(cd)try{localStorage.setItem('ai_chart_data',JSON.stringify(cd))}catch(ex){}}
    window.location.href=tgt;
  }

  function resumeArchivedChat() {
    var shouldResume=false;
    try{shouldResume=sessionStorage.getItem('zhishi_open_archive_ai')==='1';if(shouldResume)sessionStorage.removeItem('zhishi_open_archive_ai')}catch(e){}
    if(shouldResume)setTimeout(openStandaloneChat,0);
  }

  function initFreeId() {
    var id = localStorage.getItem('ai_free_id');
    if (!id) {
      id = 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('ai_free_id', id);
    }
    AI.freeId = id;
    // 从 localStorage 读取已用次数
    var used = parseInt(localStorage.getItem('ai_free_used') || '0');
    var maxFree = 2;
    AI.freeRemaining = Math.max(0, maxFree - used);
  }

  // 登录用户自动同步后端积分（无需兑换码）
  function syncUserCredits() {
    if (typeof Auth === 'undefined') return setTimeout(syncUserCredits, 1000);
    Auth.ready(function() {
      if (!Auth.isLoggedIn()) return;
      fetch('/api/auth/profile', { headers: { 'Authorization': 'Bearer ' + Auth.getToken() } })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.error) return;
          if (d.is_monthly) {
            AI.isMonthly = true;
            AI.credits = -1;
            updateMonthlyDisplay();
          } else if (d.credits > 0) {
            AI.credits = d.credits;
            updateCreditsDisplay(d.credits);
          }
          if (AI.isMonthly || AI.credits > 0) {
            showBuyBar(); // 重新判断是否隐藏购买提示
          }
        })
        .catch(function() {});
    });
  }

  function useFreeCredit() {
    var used = parseInt(localStorage.getItem('ai_free_used') || '0') + 1;
    localStorage.setItem('ai_free_used', used);
    AI.freeRemaining = Math.max(0, 2 - used);
  }

  function waitForData(cb) {
    var maxWait = 50, attempts = 0;
    function check() {
      attempts++;
      var ready = false;
      if (AI.pageType === 'result') ready = (typeof _bazi !== 'undefined' && _bazi !== null);
      else if (AI.pageType === 'hepan') ready = (typeof window._hepanData !== 'undefined' && window._hepanData !== null);
      else ready = true;
      if (ready) { cb(); return; }
      if (attempts > maxWait) { cb(); return; }
      setTimeout(check, 100);
    }
    check();
  }

  // ===== 注入 HTML =====
  function injectUI() {
    var html = '';

    html += '<div id="aiFab" class="ai-fab" title="知时AI">AI';
    html += '<span class="ai-fab-badge" id="aiFabBadge"></span></div>';
    html += '<div class="ai-drawer-backdrop" id="aiBackdrop" onclick="window._aiClose()"></div>';

    html += '<div class="ai-drawer" id="aiDrawer">';
    html += '<div class="ai-drawer-handle"></div>';
    html += '<div class="ai-drawer-header">';
    html += '<span class="ai-drawer-title">知时AI</span>';
    html += '<button class="ai-mode-toggle" id="aiModeToggle" onclick="window._aiToggleMode()" title="切换专业/白话模式">白话</button>';
    html += '<span class="ai-drawer-credits" id="aiCreditsLabel">未激活</span>';
    html += '<button class="ai-drawer-close" onclick="window._aiClose()">✕</button>';
    html += '</div>';

    // 消息区
    html += '<div class="chat-messages-wrap" id="aiMessages">';
    html += '<div class="chat-empty-wrap" id="aiEmpty">';
    html += '<div class="empty-icon">🏮</div>';
    html += '<h4>知时AI</h4>';
    html += '<p id="aiEmptyDesc">首次体验免费，可提问 2 次</p>';
    html += '<code id="aiEmptyCode">免费体验中 · 无需付费</code>';
    html += '</div></div>';

    // 次数用尽时只保留统一购买入口，兑换统一放在个人中心。
    html += '<div class="chat-buy-bar" id="aiBuyBar" style="display:none;flex-wrap:wrap;gap:8px;justify-content:center">';
    html += '<span class="buy-hint" id="aiBuyHint" style="width:100%;text-align:center;font-size:11px">提问次数已用完，可前往 <a href="pricing.html" style="color:var(--gold)">积分方案</a> 购买，兑换码请在 <a href="profile.html" style="color:var(--gold)">个人中心</a> 使用</span>';
    html += '</div>';

    // 输入区
    html += '<div class="chat-input-wrap" id="aiInputWrap">';
    html += '<textarea id="aiInput" placeholder="输入你的问题..." rows="1" onkeydown="window._aiKey(event)"></textarea>';
    html += '<button class="chat-send" id="aiSendBtn" onclick="window._aiSend()">▶</button>';
    html += '</div>';

    html += '</div>'; // .ai-drawer

    var container = document.createElement('div');
    container.innerHTML = html;
    while (container.firstChild) document.body.appendChild(container.firstChild);

    // 缓存 DOM
    $fab = document.getElementById('aiFab');
    $badge = document.getElementById('aiFabBadge');
    $backdrop = document.getElementById('aiBackdrop');
    $drawer = document.getElementById('aiDrawer');
    $messages = document.getElementById('aiMessages');
    $input = document.getElementById('aiInput');
    $sendBtn = document.getElementById('aiSendBtn');
    $emptyState = document.getElementById('aiEmpty');
    $creditsLabel = document.getElementById('aiCreditsLabel');
    $buyBar = document.getElementById('aiBuyBar');
    $inputWrap = document.getElementById('aiInputWrap');
    $statusLine = document.getElementById('aiEmptyCode');

    window._aiToggle = toggle;
    window._aiClose = close;
    window._aiOpen = open;
    window._aiSend = sendMessage;
    window._aiBuy = startPayment;
    window._aiToggleMode = toggleMode;
    window._aiKey = handleKey;

    // 初始状态：显示免费
    updateFreeDisplay();

    // FAB 点击跳转到独立AI对话页
    var fab = document.getElementById('aiFab');
    if (fab) {
      fab.addEventListener('click', function(e){
        if(fab.getAttribute('data-ai-suppress-click')==='1'){e.preventDefault();return}
        if (window.ZhishiCalibration && typeof window.ZhishiCalibration.beforeAI === 'function') {
          window.ZhishiCalibration.beforeAI(openStandaloneChat);
          return;
        }
        openStandaloneChat();
      });
    }
  }

  // ===== 抽屉控制 =====
  function open() {
    console.log('[AI] open() called, drawer:', !!$drawer, 'backdrop:', !!$backdrop);
    if (!$drawer) { console.error('[AI] drawer element missing!'); return; }
    $drawer.classList.add('open');
    if ($backdrop) $backdrop.classList.add('open');
    AI.drawerOpen = true;
    if ($input) $input.focus();
    // 验证月度会员是否过期（每小时一次）
    if (AI.isMonthly && AI.code && Date.now() - _lastMonthlyCheck > 3600000) {
      _lastMonthlyCheck = Date.now();
      fetch('/api/credits?code=' + encodeURIComponent(AI.code)).then(function(r){return r.json()}).then(function(d){
        if (!d.subscription_active && d.credits !== -1) {
          AI.isMonthly = false; AI.credits = d.credits || 0;
          localStorage.setItem('ai_chat_type','credits');
          updateCreditsDisplay(AI.credits);
          alert('月度会员已过期，剩余 ' + AI.credits + ' 次');
          showBuyBar();
        }
      }).catch(function(){});
    }
  }
  var _lastMonthlyCheck = 0;
  function close() {
    if (!$drawer) return;
    $drawer.classList.remove('open');
    if ($backdrop) $backdrop.classList.remove('open');
    AI.drawerOpen = false;
  }
  var _toggleDebounce = 0;
  function toggle() {
    var now = Date.now();
    if (now - _toggleDebounce < 250) { console.log('[AI] toggle() debounced (too fast)'); return; }
    _toggleDebounce = now;
    console.log('[AI] toggle() called, drawerOpen:', AI.drawerOpen);
    AI.drawerOpen ? close() : open();
  }
  function toggleMode() {
    AI.mode = AI.mode === 'simple' ? 'pro' : 'simple';
    var btn = document.getElementById('aiModeToggle');
    if (btn) {
      btn.textContent = AI.mode === 'simple' ? '白话' : '专业';
      btn.className = 'ai-mode-toggle ' + (AI.mode === 'simple' ? 'simple' : 'pro');
    }
  }

  // ===== 发送消息 =====
  function sendMessage() {
    if (AI.isWaiting) return;
    var text = ($input && $input.value || '').trim();
    if (!text) return;

    if (AI.credits <= 0 && !AI.isMonthly && AI.freeRemaining <= 0) {
      showBuyBar(); // 显示分享按钮
      return;
    }

    addMessage('user', text);
    if ($input) $input.value = '';
    showTyping();
    AI.isWaiting = true;
    updateSendBtn();

    var chartData = buildChartData();
    var body = { question: text, chartData: chartData, history: AI.messages.slice(-6), mode: AI.mode };
    if (window.ZhishiCalibration && typeof window.ZhishiCalibration.summary === 'function') {
      body.calibration_summary = window.ZhishiCalibration.summary(chartData);
    }
    if (window.ChatPersistence && chartData) {
      var chatType = chartData.type === 'hepan' ? 'hepan' : detectPageType() === 'result' ? 'bazi' : detectPageType();
      window.ChatPersistence.decorate(body, chatType, chartData, '');
    }

    // 免费模式
    if (AI.freeRemaining > 0 && !AI.isMonthly && AI.credits <= 0) {
      body.free_mode = true;
      body.free_id = AI.freeId;
    } else {
      body.code = AI.code;
    }

    // 服务端生成实测 60-120s（2026-08-15 生产回归 6/12 盘超 60s），30s 超时会导致服务端已完成
    // 却扣分+保存，用户误以为失败而重试 → 双扣。改为 300s 与 Vercel 服务端上限对齐。
    var ctrl=new AbortController();
    var timer=setTimeout(function(){ctrl.abort();hideTyping();addMessage('ai','AI 响应超时（5 分钟），请稍后重试。');AI.isWaiting=false;updateSendBtn()},300000);
    var requestHeaders = { 'Content-Type': 'application/json' };
    if (window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn()) requestHeaders.Authorization = 'Bearer ' + window.Auth.getToken();
    fetch('/api/ai-chat', {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      clearTimeout(timer);hideTyping();
      if (data.error) {
        if (data.free_exhausted) {
          useFreeCredit(); // 确保本地也归零
          updateFreeDisplay();
          showBuyBar();
        }
        addMessage('ai', '抱歉，' + data.error);
      } else {
        addMessage('ai', data.reply);
        if (data.is_free) {
          useFreeCredit();
          updateFreeDisplay();
          if (data.free_remaining <= 0) showBuyBar();
        } else if (data.is_monthly) {
          AI.isMonthly = true;
          AI.monthlyExpires = data.monthly_expires || '';
          updateMonthlyDisplay();
        } else if (data.credits_left !== undefined) {
          AI.credits = data.credits_left;
          updateCreditsDisplay(data.credits_left);
        }
      }
      AI.isWaiting = false;
      updateSendBtn();
    })
    .catch(function(e) {
      clearTimeout(timer);hideTyping();
      addMessage('ai', e.name==='AbortError'?'AI 响应超时（>30秒），请稍后重试或检查 DeepSeek 账户余额。':'网络异常，请稍后重试。');
      AI.isWaiting = false;updateSendBtn();
    });
  }

  // ===== 支付 =====
  function startPayment(mode) {
    mode = mode || 'credit_pack';
    var label = mode === 'monthly' ? '¥29.9 包月30天' : '¥9.9 买10次';

    fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode, money: mode === 'monthly' ? 29.9 : 9.9, name: label })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) { alert('创建订单失败：' + data.error); return; }
      if (data.pay_url) {
        localStorage.setItem('ai_pending_order', data.out_trade_no);
        localStorage.setItem('ai_pending_mode', mode);
        window.open(data.pay_url, '_blank');
        startPolling(data.out_trade_no, mode);
        // 提示用户
        if ($emptyState) {
          document.getElementById('aiEmptyDesc').textContent = '支付完成后自动激活，请稍候...';
        }
      } else if (data.test_mode) {
        var testCode = prompt('【测试模式】输入兑换码（留空自动生成）：');
        if (!testCode) testCode = 'TEST' + Math.random().toString(36).slice(2, 8).toUpperCase();
        if (mode === 'monthly') {
          handleMonthlySuccess(testCode, '30天后');
        } else {
          handlePaymentSuccess(testCode, 10);
        }
      } else {
        localStorage.setItem('ai_pending_order', data.out_trade_no);
        localStorage.setItem('ai_pending_mode', mode);
        startPolling(data.out_trade_no, mode);
      }
    })
    .catch(function(e) { alert('网络错误，请重试'); });
  }

  function startPolling(outTradeNo, mode) {
    var attempts = 0, maxAttempts = 120;
    var poll = setInterval(function() {
      attempts++;
      if (attempts > maxAttempts) { clearInterval(poll); return; }
      fetch('/api/check-order?out_trade_no=' + outTradeNo)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.paid) {
            clearInterval(poll);
            localStorage.removeItem('ai_pending_order');
            localStorage.removeItem('ai_pending_mode');
            if (data._type === 'monthly' || mode === 'monthly') {
              handleMonthlySuccess(data.code, '30天后');
            } else {
              handlePaymentSuccess(data.code, data.credits || 10);
            }
          }
        }).catch(function() {});
    }, 2000);
  }

  function handlePaymentSuccess(code, credits) {
    AI.code = code;
    AI.isMonthly = false;
    AI.credits = credits;
    localStorage.setItem('ai_chat_code', code);
    localStorage.setItem('ai_chat_type', 'credits');

    updateCreditsDisplay(credits);
    showBuyBar(); // 更新购买条
    if ($statusLine) $statusLine.textContent = '已激活 · 剩余 ' + credits + ' 次';
    if ($emptyState) document.getElementById('aiEmptyDesc').textContent = '基于你的八字命盘，尽情提问吧';

    if (AI.messages.length === 0) addGreeting();
  }

  function handleMonthlySuccess(code, expires) {
    AI.code = code;
    AI.isMonthly = true;
    AI.monthlyExpires = expires;
    localStorage.setItem('ai_chat_code', code);
    localStorage.setItem('ai_chat_type', 'monthly');
    localStorage.setItem('ai_chat_expires', expires);

    updateMonthlyDisplay();
    showBuyBar();
    if ($statusLine) $statusLine.textContent = '👑 会员有效 · ' + expires;
    if ($emptyState) document.getElementById('aiEmptyDesc').textContent = '会员期间无限次提问';

    if (AI.messages.length === 0) addGreeting();
  }

  // ===== 状态显示 =====
  function updateFreeDisplay() {
    if ($badge) {
      if (AI.freeRemaining > 0) {
        $badge.textContent = AI.freeRemaining;
        $badge.style.display = 'flex';
        $badge.style.background = '#2d8a4a'; // 绿色表示免费
      } else if (AI.credits <= 0 && !AI.isMonthly) {
        $badge.style.display = 'none';
      }
    }
    if ($creditsLabel) {
      if (AI.freeRemaining > 0) {
        $creditsLabel.innerHTML = '免费体验 <strong style="color:#4adf7a">剩' + AI.freeRemaining + '次</strong>';
      }
    }
    if ($statusLine && AI.freeRemaining > 0) {
      $statusLine.textContent = '免费体验中 · 还剩 ' + AI.freeRemaining + ' 次';
    }
    // 输入框始终可用（免费模式不需要先购买）
    if ($inputWrap) $inputWrap.style.display = 'flex';
    if ($input) $input.disabled = false;
    if ($sendBtn) $sendBtn.disabled = false;
    updateSendBtn();
  }

  function updateCreditsDisplay(count) {
    AI.credits = count;
    if ($badge) {
      if (count > 0) { $badge.textContent = count; $badge.style.display = 'flex'; $badge.style.background = ''; }
      else { $badge.style.display = 'none'; }
    }
    if ($creditsLabel) {
      if (count > 0) $creditsLabel.innerHTML = '剩余 <strong>' + count + '</strong> 次';
      else if (AI.code && !AI.isMonthly) $creditsLabel.innerHTML = '<span style="color:var(--red)">次数已用完</span>';
    }
    if (count > 0) { if ($inputWrap) $inputWrap.style.display = 'flex'; if ($buyBar) $buyBar.style.display = 'none'; }
    updateSendBtn();
  }

  function updateMonthlyDisplay() {
    if ($badge) { $badge.textContent = '∞'; $badge.style.display = 'flex'; $badge.style.background = '#8a6d28'; }
    if ($creditsLabel) $creditsLabel.innerHTML = '👑 <strong>会员</strong> · 无限次';
    if ($inputWrap) $inputWrap.style.display = 'flex';
    if ($input) $input.disabled = false;
    if ($sendBtn) $sendBtn.disabled = false;
    updateSendBtn();
  }

  function showBuyBar() {
    // 隐藏购买提示
    var hint = document.getElementById('aiBuyHint');
    if (hint) hint.style.display = 'none';

    if (AI.isMonthly) {
      if ($buyBar) $buyBar.style.display = 'none';
      if ($input) $input.disabled = false;
      if ($sendBtn) $sendBtn.disabled = false;
      if ($inputWrap) $inputWrap.style.display = 'flex';
      return;
    }
    // 免费用尽且无积分 → 显示购买提示
    if (AI.freeRemaining <= 0 && AI.credits <= 0) {
      if ($buyBar) $buyBar.style.display = 'flex';
      if ($input) $input.disabled = true;
      if ($sendBtn) $sendBtn.disabled = true;
      if ($inputWrap) $inputWrap.style.display = 'flex';
      if (hint) hint.style.display = 'block';
      return;
    }
    // 有免费或有积分 → 启用输入
    if ($buyBar) $buyBar.style.display = 'none';
    if ($input) $input.disabled = false;
    if ($sendBtn) $sendBtn.disabled = false;
    if ($inputWrap) $inputWrap.style.display = 'flex';
  }

  function updateSendBtn() {
    if ($sendBtn) {
      var canSend = AI.freeRemaining > 0 || AI.isMonthly || AI.credits > 0;
      $sendBtn.disabled = AI.isWaiting || !canSend;
    }
  }

  // ===== 排盘上下文（保持不变） =====
  function buildChartData() {
    var pt=detectPageType();
    if (pt==='result') return buildResultContext();
    if (pt==='hepan') return buildHePanContext();
    if (pt==='ziwei'){try{var d=localStorage.getItem('ai_ziwei_data');return d?JSON.parse(d):null}catch(e){return null}}
    if (pt==='liuren'){try{var d=localStorage.getItem('ai_liuren_data');return d?JSON.parse(d):null}catch(e){return null}}
    return null;
  }

  function buildResultContext() {
    var data = {};
    if (typeof _params !== 'undefined' && _params) {
      if (typeof buildAIBirthInfo === 'function') {
        data.birthInfo = buildAIBirthInfo(_params, typeof _bazi !== 'undefined' ? _bazi : null);
      } else {
        var isUnknownDirect = _params.mode === 'pillars' && _params.timing === 'unknown';
        if (isUnknownDirect) {
          data.birthInfo = { gender: _params.gender, mode: _params.mode, timing: _params.timing };
        } else {
          var totalMinutes = Math.round(Number(_params.clock) * 60 + (Number.isInteger(Number(_params.clock)) ? (Number(_params.minute) || 0) : 0));
          var displayHour = Math.floor(totalMinutes / 60) % 24;
          var displayMinute = totalMinutes % 60;
          data.birthInfo = {
            year: _params.year, month: _params.month, day: _params.day,
            hour: displayHour, minute: displayMinute, hourIndex: _params.hour,
            clock: totalMinutes / 60,
            timeText: String(displayHour).padStart(2,'0') + ':' + String(displayMinute).padStart(2,'0'),
            timeBasis: _params.reportClockNormalized ? '真太阳时（购买记录恢复）'
              : (_params.mode === 'pillars' ? '四柱反查时间' : '北京时间'),
            gender: _params.gender
          };
          if (_params.mode) data.birthInfo.mode = _params.mode;
          if (_params.timing) data.birthInfo.timing = _params.timing;
        }
      }
    }
    if (typeof _bazi !== 'undefined' && _bazi) {
      var dayGan = _bazi.day && _bazi.day.gan ? _bazi.day.gan : '';
      data.fourPillars = {};
      ['year','month','day','hour'].forEach(function(pos) {
        var p = _bazi[pos]; if (!p) return;
        // v3.2: 藏干带十神
        var cgWithSS = (p.cangGan || []).map(function(cg) {
          var ss = '';
          if (typeof BaZiCalculator !== 'undefined' && BaZiCalculator.getShiShen && dayGan) {
            try { ss = BaZiCalculator.getShiShen(dayGan, cg); } catch(e) {}
          }
          return { gan: cg, shiShen: ss };
        });
        data.fourPillars[pos] = { gan: p.gan, zhi: p.zhi, ganWX: p.wuXing ? p.wuXing.gan : '', zhiWX: p.wuXing ? p.wuXing.zhi : '', shiShenGan: p.shiShen ? p.shiShen.gan : '', shiShenZhi: p.shiShen ? p.shiShen.zhi : '', nayin: p.nayin || '', cangGan: cgWithSS };
      });
      if (_bazi.wuXingCount) data.wuXingCount = _bazi.wuXingCount;
      if (_bazi.day && _bazi.day.gan) {
        data.dayMaster = { gan: _bazi.day.gan, wuXing: _bazi.day.wuXing ? _bazi.day.wuXing.gan : '' };
        data.dayMaster.yinYang = ['甲','丙','戊','庚','壬'].indexOf(_bazi.day.gan) >= 0 ? '阳' : '阴';
      }
      if (typeof BaZiCalculator !== 'undefined') {
        if (BaZiCalculator.calcDayMasterStrength) {
          try { data.dayMasterStrength = BaZiCalculator.calcDayMasterStrength(_bazi); } catch(e) {}
        }
        // v3.1: 喜用忌神
        if (BaZiCalculator.getYongJi) {
          try {
            data.yongJi = BaZiCalculator.getYongJi(_bazi);
            if (data.yongJi && data.yongJi.resolvedPattern) data.pattern = data.yongJi.resolvedPattern;
          } catch(e) {}
        }
        // 无法完成后置裁决时才退回基础月令格。
        if (!data.pattern && BaZiCalculator.getPattern) {
          try { data.pattern = BaZiCalculator.getPattern(_bazi); } catch(e) {}
        }
        // v3.1: 四柱生克
        if (BaZiCalculator.getPillarRelations) {
          try { data.pillarRelations = BaZiCalculator.getPillarRelations(_bazi); } catch(e) {}
        }
        // v3.2: 地支内部冲合刑害
        if (BaZiCalculator.getBranchRelations) {
          try { data.branchRelations = BaZiCalculator.getBranchRelations(_bazi); } catch(e) {}
        }
        // v3.4: 十二长生
        if (BaZiCalculator.getChangSheng) {
          try {
            var cs = BaZiCalculator.getChangSheng(_bazi.day.gan);
            data.changSheng = {};
            ['year','month','day','hour'].forEach(function(pos) {
              var z = _bazi[pos].zhi;
              data.changSheng[pos] = cs[z] ? cs[z].stage : '?';
            });
          } catch(e) {}
        }
        // v3.4: 从格
        if (BaZiCalculator.getCongGe) {
          try { data.congGe = BaZiCalculator.getCongGe(_bazi); } catch(e) {}
        }
        // v3.4: 天干五合
        if (BaZiCalculator.getGanHe) {
          try { data.ganHe = BaZiCalculator.getGanHe(_bazi); } catch(e) {}
        }
        // v3.4: 地支三会
        if (BaZiCalculator.getSanHui) {
          try { data.sanHui = BaZiCalculator.getSanHui(_bazi); } catch(e) {}
        }
        // v3.4: 藏干深度
        if (BaZiCalculator.getCangGanDepth) {
          try { data.cangGanDepth = BaZiCalculator.getCangGanDepth(_bazi); } catch(e) {}
        }
      }
      // P3-A3 结构层（新增解释层，不覆盖上述既有字段；两层不污染）
      if (typeof StructuralAnalysis !== 'undefined') {
        try {
          var sa = StructuralAnalysis.evaluate(_bazi);
          data.relationEvents = sa.relationEvents;
          data.structuralRisks = sa.structuralRisks;
        } catch(e) {}
      }
      // v6.0 生克事实图 + 取象候选。事实由程序计算，AI负责综合表达，不把候选文案当固定答案。
      if (typeof BaZiChain !== 'undefined' && BaZiChain.interpret && data.yongJi) {
        try {
          var chainInterpretation = BaZiChain.interpret(_bazi, data.yongJi);
          var graphEdges = chainInterpretation.factGraph && chainInterpretation.factGraph.edges || [];
          var specialEdges = graphEdges.filter(function(edge) {
            return ['生','克','同气'].indexOf(edge.type) < 0;
          });
          var energyEdges = graphEdges.filter(function(edge) {
            return (edge.type === '生' || edge.type === '克') && edge.strength >= 0.72;
          }).sort(function(a,b) { return b.strength - a.strength; }).slice(0, 36);
          data.chainAnalysis = {
            version: chainInterpretation.version,
            mechanisms: chainInterpretation.mechanisms,
            paths: chainInterpretation.paths,
            imageryCandidates: chainInterpretation.imagery,
            constraints: chainInterpretation.constraints,
            evidenceEdges: specialEdges.concat(energyEdges).map(function(edge) {
              return {
                type:edge.type, evidence:edge.evidence, strength:edge.strength,
                formedWx:edge.formedWx || null, distance:edge.distance
              };
            })
          };
        } catch(e) { /* 取象增强层不阻断基础命盘 */ }
      }
    }
    // 大运
    if (typeof _daYunData !== 'undefined' && _daYunData && _daYunData.list) {
      data.daYun = { direction: _daYunData.isForward ? '顺行' : '逆行', startAge: _daYunData.qiYunAge, cycles: _daYunData.list.map(function(dy) { return { gan: dy.gan, zhi: dy.zhi, displayAge: dy.displayAge, startYear: dy.startYear, endYear: dy.endYear }; }) };
      // v3.2: 当前大运详情
      if (typeof _currentDaYunIndex !== 'undefined' && _currentDaYunIndex >= 0) {
        var cd = _daYunData.list[_currentDaYunIndex];
        if (cd && _bazi && _bazi.day) {
          try {
            data.currentDaYun = {
              gan: cd.gan, zhi: cd.zhi,
              startYear: cd.startYear, endYear: cd.endYear,
              displayAge: cd.displayAge,
              shiShen: typeof BaZiCalculator !== 'undefined' ? BaZiCalculator.getShiShen(_bazi.day.gan, cd.gan) : ''
            };
          } catch(e) {}
        }
      }
    }
    // v3.2: 当前流年详情
    var thisYear = new Date().getFullYear();
    data.currentYear = thisYear;
    if (typeof BaZiCalculator !== 'undefined' && BaZiCalculator.calculate) {
      try {
        var now = new Date();
        var nowHour = now.getHours() + now.getMinutes() / 60;
        var nowShiChen = Math.floor(((now.getHours() + 1) % 24) / 2);
        var currentChart = BaZiCalculator.calculate(now.getFullYear(), now.getMonth() + 1, now.getDate(), nowShiChen, 'male', nowHour);
        if (currentChart && currentChart.year) {
          data.currentLiuNian = {
            year: now.getFullYear(), gan: currentChart.year.gan, zhi: currentChart.year.zhi,
            shiShen: _bazi && _bazi.day ? BaZiCalculator.getShiShen(_bazi.day.gan, currentChart.year.gan) : ''
          };
        }
        if (currentChart && currentChart.month) {
          data.currentLiuYue = { gan: currentChart.month.gan, zhi: currentChart.month.zhi };
        }
      } catch(e) {}
    }
    if (typeof BaZiCalculator !== 'undefined' && typeof _daYunData !== 'undefined' && _daYunData && _daYunData.list && typeof _currentDaYunIndex !== 'undefined' && _currentDaYunIndex >= 0) {
      try {
        var cd = _daYunData.list[_currentDaYunIndex];
        var dayGanRef = _bazi && _bazi.day ? _bazi.day.gan : '';
        if (cd && dayGanRef) {
          var liuNianList = BaZiCalculator.calculateLiuNian(cd, dayGanRef);
          if (liuNianList) {
            var ln = null;
            // find current year or closest
            for (var i = 0; i < liuNianList.length; i++) {
              if (liuNianList[i].year === thisYear) { ln = liuNianList[i]; break; }
            }
            if (!ln && liuNianList.length > 0) ln = liuNianList[0]; // fallback
            if (ln) {
              if (!data.currentLiuNian) {
                data.currentLiuNian = {
                  year: ln.year, gan: ln.gan, zhi: ln.zhi,
                  shiShen: ln.shiShen || (typeof BaZiCalculator !== 'undefined' ? BaZiCalculator.getShiShen(dayGanRef, ln.gan) : '')
                };
              } else if (!data.currentLiuNian.shiShen) {
                data.currentLiuNian.shiShen = ln.shiShen || BaZiCalculator.getShiShen(dayGanRef, data.currentLiuNian.gan);
              }
            }
          }
        }
      } catch(e) {}
    }
    if (typeof _nativeShenSha !== 'undefined' && _nativeShenSha) data.shenSha = _nativeShenSha.map(function(s) { return { name: s.name || s, type: s.type || '', desc: s.desc || '' }; });

    // v5.0: 宫位远近分析
    if (typeof _bazi !== 'undefined' && _bazi && _bazi.day) {
      try {
        var _dgWx2 = _bazi.day.wuXing ? _bazi.day.wuXing.gan : '';
        var SHENGWO2 = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
        var KEWO2   = { '木':'金','火':'水','土':'木','金':'火','水':'土' };
        var WOKE2   = { '木':'土','火':'金','土':'水','金':'木','水':'火' };
        var _yinWx = SHENGWO2[_dgWx2];
        var _shaWx = KEWO2[_dgWx2];
        var _caiWx = WOKE2[_dgWx2];

        var _mGanWx = _bazi.month.gan ? (typeof WU_XING !== 'undefined' ? WU_XING[_bazi.month.gan] : '') : '';
        var _mZhiWx = _bazi.month.zhi ? (typeof DI_ZHI_WU_XING !== 'undefined' ? DI_ZHI_WU_XING[_bazi.month.zhi] : '') : '';
        var _hGanWx = _bazi.hour.gan ? (typeof WU_XING !== 'undefined' ? WU_XING[_bazi.hour.gan] : '') : '';
        var _yGanWx = _bazi.year.gan ? (typeof WU_XING !== 'undefined' ? WU_XING[_bazi.year.gan] : '') : '';

        var monthDesc = '月柱' + _bazi.month.gan + _bazi.month.zhi + '（提纲），';
        if (_mGanWx === _yinWx) monthDesc += '印星坐提纲，月令生身——得天时之助，贵人之地。';
        else if (_mGanWx === _dgWx2) monthDesc += '比劫当令，自身有力——根基稳固。';
        else if (_mGanWx === _shaWx) monthDesc += '官杀当令克身——压力重重，但若有制化反成权威。';
        else if (_mGanWx === _caiWx) monthDesc += '财星当令耗身——求财心切，但需身强方能担财。';
        else monthDesc += '食伤当令泄秀——才华外露，创意旺盛。';

        var hourDesc = '时柱' + _bazi.hour.gan + _bazi.hour.zhi + '（归息），';
        if (_hGanWx === _yinWx) hourDesc += '晚岁得印星庇护——老来有靠，福泽绵长。';
        else if (_hGanWx === _dgWx2) hourDesc += '比劫归时——晚运平稳，自力更生。';
        else if (_hGanWx === _shaWx) hourDesc += '晚年仍有压力——需防健康，宜早作安排。';
        else if (_hGanWx === _caiWx) hourDesc += '晚岁财星——老来财运，但须身强。';
        else hourDesc += '晚年食伤——儿孙缘厚，晚年享乐。';

        var yearDesc = '年柱' + _bazi.year.gan + _bazi.year.zhi + '（祖业），';
        if (_yGanWx === _yinWx) yearDesc += '祖上印星——家学渊源，长辈庇护。';
        else if (_yGanWx === _shaWx) yearDesc += '祖上官杀——家规严苛或祖上有权威传承。';
        else if (_yGanWx === _caiWx) yearDesc += '祖上财星——家底殷实，但自身需能守成。';
        else yearDesc += '祖业一般，需自身奋斗。';

        var summary = '';
        if (_mGanWx === _yinWx) summary += '提纲为印生身，得月令天时之利；';
        if (_mGanWx === _shaWx && _hGanWx === _yinWx) summary += '提纲官杀制身但归息印星解围——先难后易之命；';
        if (_mGanWx === _shaWx && _hGanWx !== _yinWx) summary += '提纲官杀攻身无印化解——一生压力随身；';

        data.palaceAnalysis = {
          monthDesc: monthDesc,
          hourDesc: hourDesc,
          yearDesc: yearDesc,
          summary: summary || '各宫位分布均衡，无特殊宫位偏颇。'
        };
      } catch(e) { /* 宫位分析非关键路径 */ }
    }

    // v5.0: 大运喜用忌联动分析
    if (typeof _bazi !== 'undefined' && _bazi && typeof _daYunData !== 'undefined' && _daYunData && _daYunData.list) {
      try {
        if (window.BaZiChain && window.BaZiChain.analyzeFortune) {
          var _yj = data.yongJi || (typeof BaZiCalculator !== 'undefined' && BaZiCalculator.getYongJi ? BaZiCalculator.getYongJi(_bazi) : null);
          var _dyList = _daYunData.list.map(function(dy) {
            return { gan: dy.gan, zhi: dy.zhi, displayAge: dy.displayAge, startYear: dy.startYear, endYear: dy.endYear };
          });
          data.fortuneAnalysis = window.BaZiChain.analyzeFortune(_bazi, _dyList, _yj);
        }
      } catch(e) { /* 大运联动分析非关键路径 */ }
    }

    // v5.2: 日支专项分析
    if (typeof _bazi !== 'undefined' && _bazi && _bazi.day) {
      try {
        if (typeof BaZiCalculator !== 'undefined' && BaZiCalculator.analyzeDayBranch) {
          data.dayBranchAnalysis = BaZiCalculator.analyzeDayBranch(_bazi);
        }
      } catch(e) { /* 日支分析非关键路径 */ }
    }

    // v5.2: 流年三方互动分析
    if (typeof _bazi !== 'undefined' && _bazi && data.currentDaYun && data.currentLiuNian) {
      try {
        if (window.BaZiChain && window.BaZiChain.analyzeLiuNian) {
          var _yj2 = data.yongJi || (typeof BaZiCalculator !== 'undefined' && BaZiCalculator.getYongJi ? BaZiCalculator.getYongJi(_bazi) : null);
          data.liuNianAnalysis = window.BaZiChain.analyzeLiuNian(_bazi, data.currentDaYun, data.currentLiuNian, _yj2);
        }
      } catch(e) { /* 流年互动分析非关键路径 */ }
    }

    return data;
  }

  function buildHePanContext() {
    var hd = window._hepanData; if (!hd) return null;
    return { type: 'hepan', relationType: hd.relationType || '情侣', score: hd.result ? hd.result.score : null, analysis: hd.result || null, person1: extractPerson(hd.p1, 'P1', '甲方'), person2: extractPerson(hd.p2, 'P2', '乙方') };
  }

  function extractPerson(p, personId, roleLabel) {
    if (!p) return null; var d = { personId: personId, roleLabel: roleLabel, name: p.name || roleLabel, gender: p.gender || '' };
    d.birthInfo = { name: d.name, gender: d.gender };
    if (p._normalizedBirth) {
      d.birthInfo.year = p._normalizedBirth.year;
      d.birthInfo.month = p._normalizedBirth.month;
      d.birthInfo.day = p._normalizedBirth.day;
      d.birthInfo.clock = p._normalizedBirth.clock;
    }
    if (p.pillars) { d.fourPillars = {}; ['year','month','day','hour'].forEach(function(l,i) { if (p.pillars[i]) d.fourPillars[l] = { gan: p.pillars[i].gan, zhi: p.pillars[i].zhi, nayin: p.pillars[i].nayin || '', cangGan: (p.pillars[i].cangGan || []).map(function(g){ return { gan:g }; }) }; }); }
    if (p.dayGan) d.dayMaster = { gan: p.dayGan, wuXing: p.dmWuxing || '' };
    if (p.wuxing) d.wuXingCount = p.wuxing;
    if (p.shenSha) d.shenSha = p.shenSha.map(function(s) { return { name: s.name || s }; });
    if (p._professionalFacts) {
      d.dayMasterStrength = p._professionalFacts.strength || null;
      d.yongJi = p._professionalFacts.yongJi || null;
      d.pattern = p._professionalFacts.pattern || null;
    }
    return d;
  }

  function addGreeting() {
    var cd = buildChartData();
    var g = '🧧 **知时AI已就绪**\n\n';
    if (cd && cd.dayMaster) { g += '你的日主为**' + cd.dayMaster.gan + '**' + (cd.dayMaster.wuXing ? '（' + cd.dayMaster.wuXing + '）' : '') + (cd.dayMasterStrength && cd.dayMasterStrength.level ? '，命局**' + cd.dayMasterStrength.level + '**' : '') + '。\n\n可以问我任何命理问题：\n• 我的喜用神是什么？\n• 财运事业如何？\n• 今年运势怎么样？\n• 婚姻感情如何？'; }
    else { g += '你可以问我任何八字命理问题。'; }
    if (AI.isMonthly) g = '👑 **会员已激活**\n\n' + g;
    if (AI.freeRemaining > 0) g += '\n\n💡 你还有 ' + AI.freeRemaining + ' 次免费提问机会';
    addMessage('ai', g);
  }

  // ===== 消息 UI =====
  function addMessage(role, content) { AI.messages.push({ role: role, content: content }); if ($emptyState) $emptyState.style.display = 'none'; var div = document.createElement('div'); div.className = 'message ' + (role === 'user' ? 'user' : 'ai'); var a = document.createElement('div'); a.className = 'msg-avatar'; a.textContent = role === 'user' ? '我' : '师'; var b = document.createElement('div'); b.className = 'msg-bubble'; b.innerHTML = renderMarkdown(content); div.appendChild(a); div.appendChild(b); $messages.appendChild(div); $messages.scrollTop = $messages.scrollHeight; }
  function renderMarkdown(t) { if (!t) return ''; var h = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>'); h = h.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>'); return '<p>'+h+'</p>'; }
  function showTyping() { hideTyping(); var d = document.createElement('div'); d.className = 'typing-indicator'; d.id = 'aiTyping'; d.innerHTML = '<span></span><span></span><span></span>'; $messages.appendChild(d); $messages.scrollTop = $messages.scrollHeight; }
  function hideTyping() { var e = document.getElementById('aiTyping'); if (e) e.remove(); }
  function handleKey(ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendMessage(); } }

  // ===== 兑换码 =====
  function redeemCode() {
    var inp = document.getElementById('aiRedeemInput'); var cd = (inp && inp.value || '').trim(); if (!cd) { alert('请输入兑换码'); return; }
    // 防重复：本地检查
    var usedCodes = JSON.parse(localStorage.getItem('ai_used_codes') || '[]');
    if (usedCodes.indexOf(cd) >= 0) { alert('此兑换码已使用过'); return; }
    fetch('/api/credits?code=' + encodeURIComponent(cd)).then(function(r) { return r.json(); }).then(function(d) {
      if (d.error) { alert(d.error); return; }
      // 服务端检查：total_used>0 说明已被使用
      if (d.total_used > 0) { alert('此兑换码已被使用'); return; }
      if (d.credits > 0) {
        var totalCredits = AI.credits + d.credits;
        AI.code = cd; AI.credits = totalCredits;
        if (usedCodes.indexOf(cd) < 0) usedCodes.push(cd);
        localStorage.setItem('ai_used_codes', JSON.stringify(usedCodes));
        localStorage.setItem('ai_chat_code', cd);
        updateCreditsDisplay(totalCredits);
        if ($buyBar) $buyBar.style.display = 'none';
        handlePaymentSuccess(cd, totalCredits);
      }
      else if (d.credits === -1) { AI.code = cd; AI.isMonthly = true; localStorage.setItem('ai_chat_code', cd); localStorage.setItem('ai_chat_type', 'monthly'); updateMonthlyDisplay(); if ($buyBar) $buyBar.style.display = 'none'; handleMonthlySuccess(cd, '激活中'); }
      else { alert('该兑换码已用完或已过期'); }
    }).catch(function() { alert('网络错误'); });
  }

  // ===== 会话恢复 =====
  function restoreSession() {
    var pending = localStorage.getItem('ai_pending_order');
    if (pending) { var mode = localStorage.getItem('ai_pending_mode') || 'credit_pack'; startPolling(pending, mode); return; }

    var savedCode = localStorage.getItem('ai_chat_code');
    var savedType = localStorage.getItem('ai_chat_type');
    if (savedCode) {
      fetch('/api/credits?code=' + encodeURIComponent(savedCode)).then(function(r) { return r.json(); }).then(function(d) {
        if (d.credits > 0) { AI.code = savedCode; updateCreditsDisplay(d.credits); }
        else if (d.credits === -1) { AI.code = savedCode; AI.isMonthly = true; AI.monthlyExpires = localStorage.getItem('ai_chat_expires') || ''; updateMonthlyDisplay(); }
        else { AI.code = savedCode; updateCreditsDisplay(0); }
        showBuyBar();
      }).catch(function() {});
    }
    // 恢复免费状态
    updateFreeDisplay();
  }

  // ===== 老用户迁移 =====
  function migrateLegacyUsers() {
    var oldToken = localStorage.getItem('bazi_paywall');
    if (!oldToken) return;
    // 检查是否已经迁移过
    if (localStorage.getItem('ai_migrated')) return;

    try {
      var payload = oldToken.split('.')[0];
      // 简单解码
      var decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      if (decoded && decoded.exp && decoded.exp > Date.now()) {
        // 老付费用户：给一个有价值的迁移提示
        var migratedCode = 'MIG' + Math.random().toString(36).slice(2, 6).toUpperCase();
        // 弹窗提示
        var migrateMsg = '🎁 **老用户权益升级**\n\n感谢你之前的支持！作为早期付费用户，你已获得：\n• 30 天免费会员（价值 ¥29.9）\n• 20 次额外 AI 提问额度\n\n你的专属兑换码：**' + migratedCode + '**\n\n请前往个人中心兑换。';
        addMessage('ai', migrateMsg);
        open();
        localStorage.setItem('ai_migrated', '1');
      }
    } catch(e) { /* 忽略解析错误 */ }
  }


  function showMyCode(code){var el=document.getElementById('aiMyCode');var d=document.getElementById('aiCodeDisplay');var b=document.getElementById('aiBindPhone');if(el)el.style.display='block';if(d)d.textContent=code||AI.code||'';if(b)b.style.display='block'}
  window._aiCopyCode=function(){var c=AI.code;if(!c)return;if(navigator.clipboard){navigator.clipboard.writeText(c).then(function(){alert('兑换码已复制: '+c)})}else{prompt('复制兑换码:',c)}};
  window._aiBindPhone=function(){var p=document.getElementById('aiPhoneInput').value.trim();if(!/^1d{10}$/.test(p)){alert('请输入正确手机号');return}if(!AI.code){alert('请先激活兑换码');return}var m=document.getElementById('aiBindMsg');if(m)m.textContent='绑定中...';fetch('/api/bind-phone',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:AI.code,phone:p})}).then(function(r){return r.json()}).then(function(d){if(m)m.textContent=d.success?'✅ 已绑定':'❌ 失败';if(d.success)localStorage.setItem('ai_bound_phone',p)})};
  var _origPS=handlePaymentSuccess;handlePaymentSuccess=function(c,cr){_origPS(c,cr);showMyCode(c);var sp=localStorage.getItem('ai_bound_phone');if(sp){var pi=document.getElementById('aiPhoneInput');if(pi)pi.value=sp}};
  var _origMS=handleMonthlySuccess;handleMonthlySuccess=function(c,e){_origMS(c,e);showMyCode(c)};
  var _origRS=restoreSession;restoreSession=function(){var sc=localStorage.getItem('ai_chat_code');if(sc)showMyCode(sc);var sp=localStorage.getItem('ai_bound_phone');if(sp){var pi=document.getElementById('aiPhoneInput');if(pi)pi.value=sp};_origRS();
  };

  // AI按钮拖动
  (function(){
    var fab=null, dragging=false, moved=false, startX=0, startY=0, origLeft=0, origTop=0;
    function initFab(){
      fab=document.getElementById('aiFab'); if(!fab) { setTimeout(initFab,500); return }
      fab.style.touchAction='none';
      fab.addEventListener('pointerdown',function(e){
        dragging=true; moved=false; startX=e.clientX; startY=e.clientY;
        var r=fab.getBoundingClientRect();
        origLeft=r.left; origTop=r.top;
        fab.style.transition='none'; fab.style.cursor='grabbing';
      });
      fab.addEventListener('pointermove',function(e){
        if(!dragging)return;
        var dx=e.clientX-startX, dy=e.clientY-startY;
        if(Math.abs(dx)>5||Math.abs(dy)>5){moved=true;fab.style.right='auto';fab.style.bottom='auto';fab.style.left=(origLeft+dx)+'px';fab.style.top=(origTop+dy)+'px'}
      });
      fab.addEventListener('pointerup',function(e){
        if(!dragging)return;
        dragging=false; fab.style.transition=''; fab.style.cursor='pointer';
        if(moved){fab.setAttribute('data-ai-suppress-click','1');setTimeout(function(){fab.removeAttribute('data-ai-suppress-click')},0);var r=fab.getBoundingClientRect();if(r.top<60)fab.style.top='65px';if(r.left<0)fab.style.left='10px'}
      });
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initFab);else initFab();
  })();


  // 分享功能（合并版：mobile原生分享+桌面复制+API记录）
  window._aiShare=function(){
    var url='https://zhishi.online/?ref='+AI.freeId;
    var done=function(){
      fetch('/api/referral',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:AI.code||'',freeId:AI.freeId,action:'share'})}).catch(function(){});
      alert('链接已分享！好友通过此链接访问后，你将获得 1 次额外免费提问。');
    };
    if(navigator.share){
      navigator.share({title:'知时',text:'AI+传统易学，前两次免费体验',url:url}).then(done).catch(function(){});
    } else if(navigator.clipboard){
      navigator.clipboard.writeText(url).then(done);
    } else {
      prompt('复制链接分享给朋友：',url); done();
    }
  };

  // 检测分享链接来访
  (function(){
    var m=location.search.match(/ref=([^&]+)/);
    if(!m)return;
    var ref=m[1];
    var visitor=AI.freeId||('v_'+Date.now());
    fetch('/api/referral?ref='+ref+'&visitor='+visitor).then(function(r){return r.json()}).then(function(d){
      if(d.success){
        var el=document.getElementById('aiEmpty');
        if(el){el.innerHTML='<div class="chat-empty-wrap"><div class="empty-icon">🎁</div><h4>朋友邀请你来的！</h4><p>你和朋友各获得 1 次额外免费提问</p><code>直接开始提问吧</code></div>'}
        // 刷新免费次数
        AI.freeRemaining=1; updateFreeDisplay(); showBuyBar();
      }
    });
  })();

  window.ZhishiAIContext = window.ZhishiAIContext || {};
  window.ZhishiAIContext.buildChartData = buildChartData;

  // ===== 启动 =====
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
