(function(){
  var navHTML = `
<div id="zhishi-nav" class="zhishi-nav">
  <a href="/" class="nav-brand">知时</a>
  <div class="nav-links">
    <a href="/">首页</a>
    <a href="/paipan">排盘</a>
    <a href="/hepan">合盘</a>
    <a href="/pricing" class="nav-cta">💰 付费</a>
  </div>
</div>
<div id="zhishi-mobile-nav" class="zhishi-mobile-nav">
  <a href="/">🏠</a>
  <a href="/paipan">📜</a>
  <a href="/hepan">💞</a>
  <a href="/pricing">💰</a>
</div>
`;
  document.body.classList.add("has-nav","has-mobile-nav");document.body.insertAdjacentHTML('afterbegin', navHTML);
})();
