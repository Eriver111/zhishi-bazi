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
      $creditsLabel, $buyBar, $inputWrap, $redeemRow, $statusLine;

  // ===== 初始化 =====
  function init() {
    // 检测页面类型
    if (typeof _bazi !== 'undefined' || typeof _params !== 'undefined') {
      AI.pageType = 'result';
    } else if (typeof window._hepanData !== 'undefined') {
      AI.pageType = 'hepan';
    }

    // 初始化免费用户标识
    initFreeId();

    waitForData(function() {
      injectUI();
      restoreSession();
      migrateLegacyUsers();
    });
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

    html += '<div id="aiFab" class="ai-fab" title="知时先生">AI';
    html += '<span class="ai-fab-badge" id="aiFabBadge"></span></div>';
    html += '<div class="ai-drawer-backdrop" id="aiBackdrop" onclick="window._aiClose()"></div>';

    html += '<div class="ai-drawer" id="aiDrawer">';
    html += '<div class="ai-drawer-handle"></div>';
    html += '<div class="ai-drawer-header">';
    html += '<span class="ai-drawer-title">知时先生</span>';
    html += '<button class="ai-mode-toggle" id="aiModeToggle" onclick="window._aiToggleMode()" title="切换专业/白话模式">白话</button>';
    html += '<span class="ai-drawer-credits" id="aiCreditsLabel">未激活</span>';
    html += '<button class="ai-drawer-close" onclick="window._aiClose()">✕</button>';
    html += '</div>';

    // 消息区
    html += '<div class="chat-messages-wrap" id="aiMessages">';
    html += '<div class="chat-empty-wrap" id="aiEmpty">';
    html += '<div class="empty-icon">🏮</div>';
    html += '<h4>知时先生</h4>';
    html += '<p id="aiEmptyDesc">首次体验免费，可提问 2 次</p>';
    html += '<code id="aiEmptyCode">免费体验中 · 无需付费</code>';
    html += '</div></div>';

    // 分享/购买条（免费耗尽时显示分享，已购买用户显示积分信息）
    html += '<div class="chat-buy-bar" id="aiBuyBar" style="display:none;flex-wrap:wrap;gap:8px;justify-content:center">';
    html += '<button class="buy-btn" id="aiShareBtn" onclick="window._aiShare()" style="font-size:13px;background:linear-gradient(135deg,#4CAF50,#2d8a4a);color:#fff">分享给好友 · 得1次提问</button>';
    html += '<span class="buy-hint" id="aiBuyHint" style="width:100%;text-align:center;font-size:11px">如需多次提问，请前往 <a href="pricing.html" style="color:var(--gold)">积分方案</a> 购买次数包或会员</span>';
    html += '</div>';

    // 我的兑换码（激活后显示）
    html += '<div id="aiMyCode" style="display:none;padding:8px 16px;border-top:1px solid var(--bd);font-size:12px;color:var(--tx2);text-align:center">';
    html += '🔑 你的兑换码：<strong id="aiCodeDisplay" style="color:var(--gold-l);font-size:14px;letter-spacing:2px;user-select:all"></strong>';
    html += '<button onclick="window._aiCopyCode()" style="margin-left:8px;background:none;border:1px solid var(--bd2);color:var(--gold);padding:2px 8px;border-radius:10px;font-size:11px;cursor:pointer">复制</button>';
    html += '</div>';
    // 手机绑定（找回用）
    html += '<div id="aiBindPhone" style="display:none;padding:4px 16px 8px;text-align:center;font-size:11px;color:var(--tx3)">';
    html += '绑定手机找回：<input type="tel" id="aiPhoneInput" placeholder="输入手机号" maxlength="11" style="width:120px;padding:4px 8px;background:var(--bg-input);border:1px solid var(--bd);border-radius:10px;color:var(--tx);font-size:11px;margin:0 4px">';
    html += '<button onclick="window._aiBindPhone()" style="background:none;border:1px solid var(--bd2);color:var(--gold);padding:2px 8px;border-radius:10px;font-size:11px;cursor:pointer">绑定</button>';
    html += '<span id="aiBindMsg" style="margin-left:4px"></span>';
    html += '</div>';
    // 兑换码输入

    html += '<div class="redeem-row" id="aiRedeemRow">';
    html += '<input type="text" id="aiRedeemInput" placeholder="输入兑换码" maxlength="32">';
    html += '<button onclick="window._aiRedeem()">激活</button>';
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
    $redeemRow = document.getElementById('aiRedeemRow');
    $statusLine = document.getElementById('aiEmptyCode');

    window._aiToggle = toggle;
    window._aiClose = close;
    window._aiOpen = open;
    window._aiSend = sendMessage;
    window._aiBuy = startPayment;
    window._aiRedeem = redeemCode;
    window._aiToggleMode = toggleMode;
    window._aiKey = handleKey;

    // 初始状态：显示免费
    updateFreeDisplay();

    // FAB 点击跳转到独立AI对话页
    var fab = document.getElementById('aiFab');
    if (fab) {
      fab.addEventListener('click', function(e) {
        // 保存排盘数据供AI页使用
        var cd = buildChartData();
        if (cd) { try { localStorage.setItem('ai_chart_data', JSON.stringify(cd)); } catch(ex) {} }
        window.location.href = 'ai-chat.html';
      });
    } else {
      console.error('[AI] FAB element not found!');
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

    // 免费模式
    if (AI.freeRemaining > 0 && !AI.isMonthly && AI.credits <= 0) {
      body.free_mode = true;
      body.free_id = AI.freeId;
    } else {
      body.code = AI.code;
    }

    fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      hideTyping();
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
      hideTyping();
      addMessage('ai', '抱歉，网络出现异常，请稍后重试。');
      AI.isWaiting = false;
      updateSendBtn();
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
    if (AI.isMonthly) {
      if ($buyBar) $buyBar.style.display = 'none';
      return;
    }
    // 免费用尽且无积分 → 显示分享按钮
    if (AI.freeRemaining <= 0 && AI.credits <= 0) {
      if ($buyBar) $buyBar.style.display = 'flex';
      if ($inputWrap) $inputWrap.style.display = 'flex';
      if ($input) $input.disabled = true;
      if ($sendBtn) $sendBtn.disabled = true;
      // 隐藏购买提示，显示分享按钮
      var shareBtn = document.getElementById('aiShareBtn');
      if (shareBtn) shareBtn.style.display = 'inline-block';
      var hint = document.getElementById('aiBuyHint');
      if (hint) hint.style.display = 'block';
      return;
    }
    // 有免费或有积分 → 隐藏分享条，启用输入
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
    if (AI.pageType === 'result') return buildResultContext();
    if (AI.pageType === 'hepan') return buildHePanContext();
    return null;
  }

  function buildResultContext() {
    var data = {};
    if (typeof _params !== 'undefined' && _params) {
      data.birthInfo = { year: _params.year, month: _params.month, day: _params.day, hour: _params.hour, gender: _params.gender };
      if (_params.clock !== undefined) data.birthInfo.clock = _params.clock;
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
        // v3.1: 格局
        if (BaZiCalculator.getPattern) {
          try { data.pattern = BaZiCalculator.getPattern(_bazi); } catch(e) {}
        }
        // v3.1: 喜用忌神
        if (BaZiCalculator.getYongJi) {
          try { data.yongJi = BaZiCalculator.getYongJi(_bazi); } catch(e) {}
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
    if (typeof BaZiCalculator !== 'undefined' && typeof _daYunData !== 'undefined' && _daYunData.list && typeof _currentDaYunIndex !== 'undefined' && _currentDaYunIndex >= 0) {
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
              data.currentLiuNian = {
                year: ln.year, gan: ln.gan, zhi: ln.zhi,
                shiShen: ln.shiShen || (typeof BaZiCalculator !== 'undefined' ? BaZiCalculator.getShiShen(dayGanRef, ln.gan) : '')
              };
            }
          }
        }
      } catch(e) {}
    }
    if (typeof _nativeShenSha !== 'undefined' && _nativeShenSha) data.shenSha = _nativeShenSha.map(function(s) { return { name: s.name || s, type: s.type || '', desc: s.desc || '' }; });
    return data;
  }

  function buildHePanContext() {
    var hd = window._hepanData; if (!hd) return null;
    return { type: 'hepan', relationType: hd.relationType || '情侣', score: hd.result ? hd.result.score : null, person1: extractPerson(hd.p1), person2: extractPerson(hd.p2) };
  }

  function extractPerson(p) {
    if (!p) return null; var d = {};
    if (p.pillars) { d.fourPillars = {}; ['year','month','day','hour'].forEach(function(l,i) { if (p.pillars[i]) d.fourPillars[l] = { gan: p.pillars[i].gan, zhi: p.pillars[i].zhi, nayin: p.pillars[i].nayin || '' }; }); }
    if (p.dayGan) d.dayMaster = { gan: p.dayGan, wuXing: p.dmWuxing || '' };
    if (p.wuxing) d.wuXingCount = p.wuxing;
    if (p.shenSha) d.shenSha = p.shenSha.map(function(s) { return { name: s.name || s }; });
    return d;
  }

  function addGreeting() {
    var cd = buildChartData();
    var g = '🧧 **知时先生已就绪**\n\n';
    if (cd && cd.dayMaster) { g += '你的日主为**' + cd.dayMaster.gan + '**' + (cd.dayMaster.wuXing ? '（' + cd.dayMaster.wuXing + '）' : '') + (cd.dayMasterStrength ? '，命局**' + cd.dayMasterStrength + '**' : '') + '。\n\n可以问我任何命理问题：\n• 我的喜用神是什么？\n• 财运事业如何？\n• 今年运势怎么样？\n• 婚姻感情如何？'; }
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
        var migrateMsg = '🎁 **老用户权益升级**\n\n感谢你之前的支持！作为早期付费用户，你已获得：\n• 30 天免费会员（价值 ¥29.9）\n• 20 次额外 AI 提问额度\n\n你的专属兑换码：**' + migratedCode + '**\n\n请在兑换码输入框中激活。';
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
  var _origRS=restoreSession;restoreSession=function(){var sc=localStorage.getItem('ai_chat_code');if(sc)showMyCode(sc);var sp=localStorage.getItem('ai_bound_phone');if(sp){var pi=document.getElementById('aiPhoneInput');if(pi)pi.value=sp};_origRS()};

  // AI按钮拖动
  (function(){
    var fab=null, dragging=false, startX=0, startY=0, origLeft=0, origTop=0;
    function initFab(){
      fab=document.getElementById('aiFab'); if(!fab) { setTimeout(initFab,500); return }
      fab.style.touchAction='none';
      fab.addEventListener('pointerdown',function(e){
        dragging=true; startX=e.clientX; startY=e.clientY;
        var r=fab.getBoundingClientRect();
        origLeft=r.left; origTop=r.top;
        fab.style.transition='none'; fab.style.cursor='grabbing';
        fab.setPointerCapture(e.pointerId);
      });
      fab.addEventListener('pointermove',function(e){
        if(!dragging)return;
        var dx=e.clientX-startX, dy=e.clientY-startY;
        fab.style.right='auto'; fab.style.bottom='auto';
        fab.style.left=(origLeft+dx)+'px'; fab.style.top=(origTop+dy)+'px';
      });
      fab.addEventListener('pointerup',function(e){
        if(!dragging)return;
        dragging=false; fab.style.transition=''; fab.style.cursor='pointer';
        var r=fab.getBoundingClientRect();
        if(r.top<60)fab.style.top='65px';
        if(r.left<0)fab.style.left='10px';
        if(r.bottom>window.innerHeight-80)fab.style.top=(window.innerHeight-140)+'px';
        if(r.right>window.innerWidth)fab.style.left=(window.innerWidth-r.width-10)+'px';
        if(Math.abs(e.clientX-startX)<5&&Math.abs(e.clientY-startY)<5){window._aiToggle()}
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

  // ===== 启动 =====
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
