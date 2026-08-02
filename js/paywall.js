/**
 * 报告付费 v3.1 - QR弹窗 + 手动解锁 + AI引导入口
 * 八字排盘结果页付费遮罩
 */
var _baziHash='';
var _baziPayParams=null;
function stableReportValue(value){
  if(Array.isArray(value))return value.map(stableReportValue);
  if(value&&typeof value==='object'){
    var result={};
    Object.keys(value).sort().forEach(function(key){result[key]=stableReportValue(value[key])});
    return result;
  }
  return value;
}
function directPillarValue(params,position,ganKey,zhiKey){
  var pillars=params.enteredPillars||params.pillars||{};
  var value=pillars[position];
  if(typeof value==='string')return value;
  if(value&&value.gan&&value.zhi)return String(value.gan)+String(value.zhi);
  return String(params[ganKey]||'')+String(params[zhiKey]||'');
}
function isDirectPillarReport(params){return !!(params&&(params.enteredPillars||params.pillars||params.mode==='pillars'))}
function makeLocalReportKey(params){
  var copy=JSON.parse(JSON.stringify(params||{}));
  if(copy.cal===''||copy.cal==='solar')delete copy.cal;
  if(isDirectPillarReport(copy)){
    copy.mode='pillars';
    copy.enteredPillars={
      year:directPillarValue(copy,'year','yg','yz'),month:directPillarValue(copy,'month','mg','mz'),
      day:directPillarValue(copy,'day','dg','dz'),hour:directPillarValue(copy,'hour','hg','hz')
    };
    delete copy.pillars;
  }
  return JSON.stringify(stableReportValue(copy));
}
function legacyPipeReportKey(params){
  if(isDirectPillarReport(params)||!params)return '';
  var keys=['year','month','day','hour','gender'];
  if(keys.some(function(key){return params[key]===undefined||params[key]===null||params[key]===''}))return '';
  return keys.map(function(key){return params[key]}).join('|');
}
function iru(){var s=localStorage.getItem('bazi_rpt');if(!s)return false;try{var d=JSON.parse(s),legacy=legacyPipeReportKey(_baziPayParams);return d.e>Date.now()&&(d.h===_baziHash||!!legacy&&d.h===legacy)}catch(e){return false}}
function sru(){localStorage.setItem('bazi_rpt',JSON.stringify({h:_baziHash,e:Date.now()+365*86400000}))}
function getBaziPending(){var s=localStorage.getItem('rpt_ord');if(!s)return null;try{var d=JSON.parse(s);return d&&d.oid&&d.h&&d.k?d:null}catch(e){return s.startsWith('credit_')?{oid:s,h:_baziHash,k:'legacy-credit',legacy:true}:null}}

function reportSearchParams(params){
  var query=new URLSearchParams();
  params=params||{};
  Object.keys(params).sort().forEach(function(key){
    var value=params[key];
    if(key==='enteredPillars'||key==='pillars'||value===undefined||value===null||typeof value==='object')return;
    query.set(key,value);
  });
  if(params.enteredPillars||params.pillars||params.mode==='pillars'){
    query.set('mode','pillars');
    query.set('yg',directPillarValue(params,'year','yg','yz').slice(0,1));
    query.set('yz',directPillarValue(params,'year','yg','yz').slice(1));
    query.set('mg',directPillarValue(params,'month','mg','mz').slice(0,1));
    query.set('mz',directPillarValue(params,'month','mg','mz').slice(1));
    query.set('dg',directPillarValue(params,'day','dg','dz').slice(0,1));
    query.set('dz',directPillarValue(params,'day','dg','dz').slice(1));
    query.set('hg',directPillarValue(params,'hour','hg','hz').slice(0,1));
    query.set('hz',directPillarValue(params,'hour','hg','hz').slice(1));
  }
  return query;
}

var _accountAccessFailed=false;
function isAccountLoggedIn(){return typeof Auth!=='undefined'&&Auth.isLoggedIn()}
function showAccountAccessGate(){
  var wrap=document.getElementById('unifiedReport');
  if(!wrap||document.getElementById('rptAccessGate'))return;
  var gate=document.createElement('div');gate.id='rptAccessGate';
  gate.style.cssText='position:absolute;inset:0;z-index:11;display:flex;align-items:center;justify-content:center;background:rgba(14,12,10,.94);color:var(--tx2);font-size:13px;pointer-events:auto;border-radius:12px';
  gate.style.pointerEvents='auto';
  gate.textContent='正在验证购买记录…';
  wrap.appendChild(gate);
}
function removeAccountAccessGate(){var gate=document.getElementById('rptAccessGate');if(gate)gate.remove()}
function restoreAccountAccess(){
  if(!isAccountLoggedIn())return Promise.resolve(false);
  var query=reportSearchParams(_baziPayParams);
  return new Promise(function(resolve){
    var settled=false;
    function finish(value,failed){
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      if(failed)_accountAccessFailed=true;
      resolve(value);
    }
    var timeout=setTimeout(function(){finish(false,true)},8000);
    fetch('/api/reports/access?'+query.toString(),{
      headers:{Authorization:'Bearer '+Auth.getToken()}
    }).then(function(response){return response.ok?response.json():{unlocked:false}})
    .then(function(data){
      if(data.unlocked&&!settled){unlock({persistLocal:true,persistCloud:false});finish(true,false);return}
      finish(false,false);
    }).catch(function(){finish(false,true)});
  });
}

function initPaywall(bp){
  _baziPayParams=JSON.parse(JSON.stringify(bp||{}));
  _baziHash=makeLocalReportKey(_baziPayParams);
  _accountAccessFailed=false;
  if(!renderPaywall(false,true))return Promise.resolve(false);
  if(!isAccountLoggedIn()){
    if(iru()){unlock({persistLocal:false,persistCloud:false});return Promise.resolve(true)}
    renderPaywall(true);
    return Promise.resolve(false);
  }
  showAccountAccessGate();
  return restoreAccountAccess().then(function(restored){
    removeAccountAccessGate();
    if(!restored)renderPaywall(true);
    return restored;
  });
}

function renderPaywall(skipLayout,prepareOnly){
  var secs=['thisYearSection','marriageSection','wealthSection','studySection','fortuneSection'];
  var wrap;
  if(!skipLayout){
    var first=document.getElementById(secs[0]);
    if(!first||document.getElementById('unifiedReport'))return false;

  // 先渲染付费内容
  if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}}
  // 折叠所有板块
  secs.forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('drawer-open')});

  wrap=document.createElement('div');wrap.id='unifiedReport';
  wrap.style.cssText='position:relative;padding-bottom:20px';
  first.parentNode.insertBefore(wrap,first);
  secs.forEach(function(id){var el=document.getElementById(id);if(el)wrap.appendChild(el)});

  }else{
    wrap=document.getElementById('unifiedReport');
    if(!wrap)return false;
  }
  if(prepareOnly)return true;

  if(!isAccountLoggedIn()&&iru()){unlock();return}
  injectQRModal();

  // 计算付费内容实际高度
  var contentH=0;
  secs.forEach(function(id){var el=document.getElementById(id);if(el)contentH+=el.offsetHeight||160;});

  var pw=document.createElement('div');pw.id='rptPaywall';
  pw.style.cssText='position:absolute;top:0;left:0;right:0;height:'+(contentH||500)+'px;background:linear-gradient(180deg,rgba(14,12,10,.88) 0%,rgba(18,16,12,.94) 100%);display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:10;border-radius:12px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)';
  pw.innerHTML='<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px">'
    +'<div style="width:48px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin-bottom:24px"></div>'
    +'<h3 style="color:var(--gold-l);font-size:20px;letter-spacing:4px;margin-bottom:12px">深度命理分析报告</h3>'
    +'<p style="color:var(--tx2);font-size:13px;text-align:center;line-height:2">今年运势 · 婚姻感情 · 财运分析<br>学业分析 · 近5年流年运势</p>'
    +'<div style="font-size:36px;font-weight:900;color:var(--gold-l);margin:16px 0">¥9.9</div>'
    +'<button class="submit-btn" onclick="startRP()" style="max-width:280px;width:100%;padding:14px 32px;font-size:16px;letter-spacing:3px">积分解锁完整报告</button>'
    +'<p style="color:var(--tx3);font-size:11px;margin-top:10px">一次付费 · 永久查看 · 支持下载</p>'
    +'</div>'
    +'<div style="width:100%;padding:20px;background:rgba(24,22,18,.6);border-top:1px solid rgba(180,160,140,.08);text-align:center">'
    +'<p style="color:var(--tx2);font-size:13px;margin-bottom:10px">不想看报告？试试 AI 命理师</p>'
    +'<a href="/ai-chat.html" style="display:inline-block;padding:10px 28px;background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.04));border:1px solid rgba(201,168,76,.25);border-radius:20px;color:var(--gold-l);text-decoration:none;font-size:14px;letter-spacing:2px;font-weight:600;transition:all .3s" onmouseenter="this.style.boxShadow=\'0 0 20px rgba(201,168,76,.15)\'" onmouseleave="this.style.boxShadow=\'none\'">🤖 前2次免费 · 开始对话</a>'
    +'</div>';
  var purchaseNotice=document.createElement('p');
  purchaseNotice.textContent='登录后购买可在个人中心长期查看；游客购买仅保存在本设备。';
  purchaseNotice.style.cssText='color:var(--tx3);font-size:11px;text-align:center;margin:0 20px 12px';
  pw.appendChild(purchaseNotice);
  wrap.appendChild(pw);
  if(_accountAccessFailed){
    var accessStatus=document.createElement('p');
    accessStatus.textContent='购买记录暂时无法验证，请稍后重试。';
    accessStatus.style.cssText='color:var(--tx3);font-size:11px;text-align:center;margin:8px 20px';
    pw.appendChild(accessStatus);
  }
  autoRestore();
}

function injectQRModal(){
  if(document.getElementById('qrModal'))return;
  var m=document.createElement('div');m.id='qrModal';
  m.style.cssText='display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);align-items:center;justify-content:center';
  m.innerHTML='<div style="background:var(--card,rgba(24,22,18,.95));border:1px solid var(--bd,rgba(180,160,140,.1));border-radius:16px;padding:28px 24px;text-align:center;max-width:360px;width:90%;position:relative;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)"><button onclick="document.getElementById(\'qrModal\').style.display=\'none\'" style="position:absolute;top:10px;right:14px;background:none;border:none;color:var(--tx2);font-size:22px;cursor:pointer">&times;</button><h3 style="color:var(--gold-l);margin-bottom:8px;letter-spacing:2px">扫码支付 ¥9.9</h3><div id="qrContainer" style="margin:12px auto;width:200px;height:200px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#333">生成二维码中...</div><p style="color:var(--tx2);font-size:12px;margin:8px 0">支付后自动解锁，请勿关闭页面</p><p id="qrStatus" style="color:var(--tx3);font-size:11px">等待支付...</p><button id="qrRetryBtn" class="submit-btn" style="max-width:260px;display:none;margin-top:8px" onclick="startRP()">重新支付</button><button class="submit-btn" style="max-width:260px;margin-top:6px;background:rgba(255,255,255,.04);color:var(--tx);border:1px solid var(--bd)" onclick="manualUnlock()">我已付过款，点此解锁</button></div>';
  document.body.appendChild(m);
}

var _qrTimer=null;

function isMobile(){return /Android|iPhone|iPad|iPod|webOS|Mobile|mobile/i.test(navigator.userAgent)||(typeof window.orientation!=='undefined')||(navigator.maxTouchPoints>0)}

function startRP(){
  var modal=document.getElementById('qrModal');if(modal)modal.style.display='flex';
  var status=document.getElementById('qrStatus');if(status)status.textContent='正在连接支付...';
  var retry=document.getElementById('qrRetryBtn');if(retry)retry.style.display='none';
  var container=document.getElementById('qrContainer');
  if(container)container.innerHTML='<p style=color:var(--tx2)>生成支付二维码...</p>';

  if(!_baziPayParams||!_baziPayParams.year||!_baziPayParams.gender){
    if(status)status.textContent='排盘参数不完整，请返回重新排盘';
    if(retry)retry.style.display='block';
    return;
  }
  var orderBody={
    mode:'credit_pack',
    name:'八字完整分析报告',
    token:typeof Auth!=='undefined'&&Auth.isLoggedIn()?Auth.getToken():''
  };
  console.log('[pay]下单',JSON.stringify(orderBody).slice(0,150));fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(orderBody)})
  .then(function(r){console.log('[pay]status',r.status);return r.json().catch(function(e){console.error('[pay]JSON失败',e);throw e});})
  .then(function(d){console.log('[pay]resp',JSON.stringify(d).slice(0,200));
    if(d.already_unlocked){
      var existingModal=document.getElementById('qrModal');if(existingModal)existingModal.style.display='none';
      unlock({persistLocal:true,persistCloud:false});
      return;
    }
    if(d.error){if(status)status.textContent='错误: '+d.error;if(retry)retry.style.display='block';return}
    if(!d.out_trade_no){if(status)status.textContent='订单信息不完整，请重新支付';if(retry)retry.style.display='block';return}
    localStorage.setItem('rpt_ord',d.out_trade_no||'');
    var payment=window.PaymentFlow?window.PaymentFlow.resolvePayment(d):{payUrl:d.pay_url||'',qrImageUrl:''};
    var payUrl=payment.payUrl;
    if(isMobile()&&payUrl){
      if(status)status.textContent='正在跳转支付宝...';
      // 自动跳转
      window.location.assign(payUrl);
      // 同时放一个手动按钮兜底
      if(container){
        container.innerHTML='<p style="color:var(--gold);font-size:13px;margin:12px 0">正在跳转支付宝...</p><a href="'+payUrl+'" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,var(--gold-d),var(--gold));color:var(--ink);border-radius:24px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:2px">如未跳转，点此手动支付</a>';
      }
    } else {
      if(window.PaymentFlow){
        payment=window.PaymentFlow.renderQr(container,d,{size:200,failureText:'二维码加载失败，请点击“重新支付”'});
      }
      if(!payment.qrImageUrl){
        if(status)status.textContent='支付服务未返回可用二维码，请重新支付';
        if(retry)retry.style.display='block';
        return;
      }
      if(status)status.textContent='请扫码支付 ¥9.9（支付后自动解锁）';
    }
    startQRPoll(pending);
  }).catch(function(e){
    if(status)status.textContent='连接失败，请重试';
    if(retry)retry.style.display='block';
  });
}

function startQRPoll(pending){
  if(!pending||pending.h!==_baziHash)return;
  if(_qrTimer)clearInterval(_qrTimer);
  var n=0;var status=document.getElementById('qrStatus');
  _qrTimer=setInterval(function(){
    n++;if(n>120){clearInterval(_qrTimer);if(status)status.textContent='支付超时，请点击"重新支付"';var retry=document.getElementById('qrRetryBtn');if(retry)retry.style.display='block';return}
    if(status&&n%5===0)status.textContent='等待支付... ('+Math.floor(n/2)+'s)';
    fetch('/api/check-order?expected_type=bazi&out_trade_no='+encodeURIComponent(oid)).then(function(r){return r.json()}).then(function(d){
      if((pending.legacy&&d.paid)||(d.status==='paid'&&d.report_type==='bazi'&&d.report_key===pending.k)){clearInterval(_qrTimer);localStorage.removeItem('rpt_ord');
        var modal=document.getElementById('qrModal');if(modal)modal.style.display='none';unlock();}
    }).catch(function(){});
  },2000);
}

function manualUnlock(){
  var oid=localStorage.getItem('rpt_ord');if(!oid)return;
  fetch('/api/check-order?expected_type=bazi&out_trade_no='+encodeURIComponent(oid)).then(function(r){return r.json()}).then(function(d){
    if((pending.legacy&&d.paid)||(d.status==='paid'&&d.report_type==='bazi'&&d.report_key===pending.k)){clearInterval(_qrTimer);localStorage.removeItem('rpt_ord');
      var modal=document.getElementById('qrModal');if(modal)modal.style.display='none';unlock();}
    else{alert('尚未检测到支付，请确认已付款后重试')}
  }).catch(function(){alert('网络错误，请稍后重试')});
}

function unlock(options){
  options=options||{};
  if(options.persistLocal!==false)sru();
  var pw=document.getElementById('rptPaywall');if(pw)pw.remove();
  var wrap=document.getElementById('unifiedReport');
  if(wrap)wrap.querySelectorAll('.section-drawer').forEach(function(s){s.classList.add('drawer-open')});
  if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}}
  var b=document.getElementById('downloadBanner');if(b)b.style.display='flex';
}

function autoRestore(){var pending=getBaziPending();if(pending&&pending.h===_baziHash)startQRPoll(pending)}
