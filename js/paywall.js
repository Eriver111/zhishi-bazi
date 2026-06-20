/**
 * 报告付费 v3.0 - ¥9.9 合并分析 + 下载 + AI入口
 */
var _baziHash='';
function hp(p){return [p.year,p.month,p.day,p.hour,p.gender].join('|')}
function iru(){var s=localStorage.getItem('bazi_rpt');if(!s)return false;try{var d=JSON.parse(s);return d.h===_baziHash&&d.e>Date.now()}catch(e){return false}}
function sru(){localStorage.setItem('bazi_rpt',JSON.stringify({h:_baziHash,e:Date.now()+365*86400000}))}

function initPaywall(bp){
  _baziHash=hp(bp);
  // Wrap 5 paid sections in a unified container
  var sections=['thisYearSection','marriageSection','wealthSection','studySection','fortuneSection'];
  var first=document.getElementById(sections[0]);
  if(!first||document.getElementById('unifiedReport'))return;
  
  // Create wrapper
  var wrap=document.createElement('div');wrap.id='unifiedReport';
  wrap.style.cssText='position:relative;margin:16px 0';
  first.parentNode.insertBefore(wrap,first);
  
  // Move sections into wrapper
  sections.forEach(function(id){var el=document.getElementById(id);if(el)wrap.appendChild(el)});
  
  if(iru()){unlock();return}
  
  // Add paywall overlay
  var pw=document.createElement('div');pw.id='rptPaywall';
  pw.style.cssText='position:absolute;inset:0;background:rgba(8,12,20,.92);display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:10;border-radius:12px;backdrop-filter:blur(8px)';
  pw.innerHTML='<div style="font-size:48px">🔒</div><h3 style="color:var(--gold-l);margin:8px 0">深度命理分析报告</h3><p style="color:var(--tx2);font-size:13px;text-align:center;line-height:1.8">今年运势 · 婚姻感情 · 财运分析<br>学业分析 · 近5年流年运势</p><div style="font-size:30px;font-weight:900;color:var(--gold-l);margin:10px 0">¥9.9</div><button class="submit-btn" onclick="startRP()" style="max-width:280px">🔓 解锁完整报告</button><p style="color:var(--tx3);font-size:11px;margin-top:8px">一次付费 · 永久查看 · 支持下载</p><p style="margin-top:18px;color:var(--tx2);font-size:13px">不想看这些？<a href="javascript:window._aiOpen()" style="color:var(--gold);text-decoration:underline;font-weight:600">🤖 试试知时AI · 前2次免费</a></p>';
  wrap.appendChild(pw);
  
  autoRestore();
}

function startRP(){
  fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({money:9.9,name:'八字完整分析报告'})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.pay_url){localStorage.setItem('rpt_ord',d.out_trade_no);window.open(d.pay_url,'_blank');poll(d.out_trade_no)}
    else{alert('创建订单失败')}
  }).catch(function(){alert('网络错误')});
}

function poll(oid){var n=0;var t=setInterval(function(){n++;if(n>90){clearInterval(t);return};fetch('/api/check-order?out_trade_no='+oid).then(function(r){return r.json()}).then(function(d){if(d.paid){clearInterval(t);localStorage.removeItem('rpt_ord');unlock()}}).catch(function(){})},2000)}

function unlock(){
  sru();
  var pw=document.getElementById('rptPaywall');if(pw)pw.remove();
  var wrap=document.getElementById('unifiedReport');if(wrap)wrap.querySelectorAll('.section-drawer').forEach(function(s){s.classList.add('drawer-open')});
  if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}}
  var b=document.getElementById('downloadBanner');if(b)b.style.display='flex';
}

function autoRestore(){var oid=localStorage.getItem('rpt_ord');if(oid)poll(oid)}
