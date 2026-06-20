/**
 * 报告付费 v3.0 - ¥9.9 解锁完整分析 + 下载
 */
var _baziHash='';
function hashP(p){return [p.year,p.month,p.day,p.hour,p.gender].join('|')}
function isRptUnlocked(){var s=localStorage.getItem('bazi_rpt');if(!s)return false;try{var d=JSON.parse(s);return d.h===_baziHash&&d.e>Date.now()}catch(e){return false}}
function saveRpt(){localStorage.setItem('bazi_rpt',JSON.stringify({h:_baziHash,e:Date.now()+365*86400000}))}
function initPaywall(bp){_baziHash=hashP(bp);if(isRptUnlocked()){unlockRpt();return};autoRestore()}

function startReportPay(){
  fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({money:9.9,name:'八字完整分析报告'})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.pay_url){localStorage.setItem('rpt_ord',d.out_trade_no);window.open(d.pay_url,'_blank');poll(d.out_trade_no)}
    else{alert('创建订单失败')}
  }).catch(function(){alert('网络错误')});
}

function poll(oid){var n=0;var t=setInterval(function(){n++;if(n>90){clearInterval(t);return};fetch('/api/check-order?out_trade_no='+oid).then(function(r){return r.json()}).then(function(d){if(d.paid){clearInterval(t);localStorage.removeItem('rpt_ord');unlockRpt()}}).catch(function(){})},2000)}

function unlockRpt(){
  saveRpt();
  // Show unlock state
  var pw=document.getElementById('reportPaywall');if(pw)pw.style.display='none';
  var ul=document.getElementById('reportUnlocked');if(ul)ul.style.display='block';
  // Open the drawer
  var sec=document.getElementById('paidReportSection');if(sec)sec.classList.add('drawer-open');
  // Render paid content
  if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}}
  var b=document.getElementById('downloadBanner');if(b)b.style.display='flex';
}

function autoRestore(){var oid=localStorage.getItem('rpt_ord');if(oid)poll(oid)}
