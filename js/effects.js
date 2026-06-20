/**
 * 知时 — 动态效果库 v2.0
 * 排盘逐柱浮现 + 五行环形图
 */
(function() {
  'use strict';

  // ===== 排盘逐柱浮现 =====
  // 在 result.html 的 bazi 表格渲染后调用
  window.revealPillars = function(selector, delay) {
    delay = delay || 250;
    var cols = document.querySelectorAll(selector || '.pp-col');
    if (!cols.length) return;
    cols.forEach(function(col, i) {
      col.style.opacity = '0';
      col.style.transform = 'translateY(20px)';
      col.style.transition = 'all 0.6s cubic-bezier(0.22, 0.61, 0.36, 1)';
      setTimeout(function() {
        col.style.opacity = '1';
        col.style.transform = 'translateY(0)';
      }, i * delay);
    });
  };

  // ===== 五行环形图 =====
  // 在 result.html 的五行分析区域调用
  window.drawWuxingRing = function(canvasId, wuxingCount) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !wuxingCount) return;

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    var cx = size / 2, cy = size / 2;
    var outerR = 80, innerR = 50;

    // 五行配置：颜色、起始角度
    var elements = [
      { name: '金', color: '#e8d5a3', angle: -Math.PI/2 },
      { name: '木', color: '#7ec87e', angle: -Math.PI/2 + Math.PI*2/5 },
      { name: '水', color: '#6baddf', angle: -Math.PI/2 + Math.PI*4/5 },
      { name: '火', color: '#e8755a', angle: -Math.PI/2 + Math.PI*6/5 },
      { name: '土', color: '#c9a84c', angle: -Math.PI/2 + Math.PI*8/5 }
    ];

    // 计算最大值用于归一化
    var maxCount = Math.max.apply(null, Object.values(wuxingCount).concat([1]));

    // 清除
    ctx.clearRect(0, 0, size, size);

    // 绘制环形段
    var totalAngle = Math.PI * 2;
    var gapAngle = 0.06; // 段间距
    var segAngle = (totalAngle - gapAngle * 5) / 5;

    elements.forEach(function(el, i) {
      var count = wuxingCount[el.name] || 0;
      var ratio = count / maxCount;
      var thickness = innerR + (outerR - innerR) * Math.max(ratio, 0.15);

      var startAngle = el.angle;
      var endAngle = startAngle + segAngle;

      ctx.beginPath();
      ctx.arc(cx, cy, thickness, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();

      // 渐变填充
      var grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      grad.addColorStop(0, el.color + '40');
      grad.addColorStop(1, el.color + (0.3 + ratio * 0.7).toString(16).slice(0, 4));
      ctx.fillStyle = grad;
      ctx.fill();

      // 文字标签
      var labelAngle = startAngle + segAngle / 2;
      var labelR = outerR + 22;
      var lx = cx + Math.cos(labelAngle) * labelR;
      var ly = cy + Math.sin(labelAngle) * labelR;
      ctx.fillStyle = el.color;
      ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.name + ' ' + count, lx, ly);
    });

    // 中心文字
    ctx.fillStyle = '#e2dcc8';
    ctx.font = 'bold 14px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('五行', cx, cy - 8);
    ctx.fillText('分布', cx, cy + 10);
  };

  // ===== 数字跳动动画 =====
  // 用于五行计数从 0 跳到目标值
  window.animateNumber = function(el, target, duration) {
    duration = duration || 800;
    var start = 0;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  // ===== 卡片悬浮视差 =====
  window.initParallax = function(selector) {
    var cards = document.querySelectorAll(selector || '.feat-card, .card');
    cards.forEach(function(card) {
      card.addEventListener('mousemove', function(e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = 'perspective(800px) rotateY(' + (x * 4) + 'deg) rotateX(' + (-y * 4) + 'deg) translateY(-4px)';
      });
      card.addEventListener('mouseleave', function() {
        card.style.transform = 'perspective(800px) rotateY(0) rotateX(0) translateY(0)';
      });
    });
  };

  // 页面加载后自动初始化视差
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.initParallax(); });
  } else {
    window.initParallax();
  }
})();
