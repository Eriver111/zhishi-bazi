/**
 * 付费报告解锁 v3.0 — ¥9.9 完整分析报告 + 下载
 */
var PAID_SECTIONS=['thisYearSection','marriageSection','wealthSection','studySection','fortuneSection'];
var REPORT_PRICE=9.9;
var _baziHash='';
function hashParams(p){return [p.year,p.month,p.day,p.hour,p.gender].join('|')}
function isUnlocked(){var s=localStorage.getItem('bazi_report');if(!s)return false;try{var d=JSON.parse(s);return d.hash===_baziHash&&d.expires>Date.now()}catch(e){return false}}
function saveUnlock(){localStorage.setItem('bazi_report',JSON.stringify({hash:_baziHash,expires:Date.now()+7*86400000}))}
function initPaywall(bp){_baziHash=hashParams(bp);if(isUnlocked()){unlockReport();return};showPaywall();autoRestorePending()}
function showPaywall(){
  var l=document.getElementById('fortuneSection');if(!l||document.getElementById('rpw'))return;
  var c=document.createElement('div');c.id='rpw';c.className='section-drawer';
  c.innerHTML='<div class="drawer-toggle" onclick="document.getElementById('rpw').classList.toggle('drawer-open')"><div class="drawer-arrow">▶</div><h2>📋 完整分析报告</h2></div><div class="drawer-body" style="text-align:center;padding:30px 20px"><p style="color:var(--tx2);margin-bottom:16px">解锁全部5项深度分析 + 可下载PDF报告</p><div style="font-size:32px;font-weight:900;color:var(--gold-l)">¥9.9</div><p style="color:var(--tx3);font-size:12px;margin:8px 0 20px">一次付费 · 7天有效 · 反复查看</p><button class="submit-btn" onclick="startPay()" style="max-width:300px">🔓 解锁完整报告</button><p style="color:var(--tx3);font-size:11px;margin-top:12px">已付费？<a href="javascript:restoreRp()" style="color:var(--gold)">恢复购买</a></p></div>';
  l.parentNode.insertBefore(c,l.nextSibling);
}
function unlockReport(){saveUnlock();var c=document.getElementById('rpw');if(c){c.querySelector('.drawer-body').innerHTML='<p style="color:#4f8;font-size:16px">✅ 报告已解锁</p><button class="submit-btn" onclick="window.openReportInNewTab()" style="max-width:300px">🖨 保存为 PDF</button><button class="submit-btn" onclick="window.downloadReport()" style="max-width:300px;margin-top:8px">📥 下载 HTML</button>';c.classList.add('drawer-open')};PAID_SECTIONS.forEach(function(id){var e=document.getElementById(id);if(e)e.classList.add('drawer-open')});if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}};var b=document.getElementById('downloadBanner');if(b)b.style.display='flex'}
function startPay(){fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({money:9.9,name:'八字完整分析报告'})}).then(function(r){return r.json()}).then(function(d){if(d.pay_url){localStorage.setItem('rpt_ord',d.out_trade_no);window.open(d.pay_url,'_blank');pollPay(d.out_trade_no)}else if(d.test_mode){unlockReport()}else{alert('创建订单失败')}}).catch(function(){alert('网络错误')})}
function pollPay(oid){var n=0;var t=setInterval(function(){n++;if(n>90){clearInterval(t);return};fetch('/api/check-order?out_trade_no='+oid).then(function(r){return r.json()}).then(function(d){if(d.paid){clearInterval(t);localStorage.removeItem('rpt_ord');unlockReport()}}).catch(function(){})},2000)}
function restoreRp(){if(isUnlocked()){unlockReport()}else{alert('未找到购买记录')}}
function autoRestorePending(){var oid=localStorage.getItem('rpt_ord');if(oid)pollPay(oid)}
