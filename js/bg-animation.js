/**
 * 墨渊星汉 — 背景动画引擎 v2.0
 * 底层星图缓慢旋转 + 中层金色粒子飘浮 + 流星随机划过
 */
(function() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, centerX, centerY;
    const isMobile = window.innerWidth < 768;

    // 粒子配置（移动端减半）
    const STAR_COUNT = isMobile ? 60 : 120;
    const GOLD_COUNT = isMobile ? 40 : 80;
    const METEOR_INTERVAL = isMobile ? 15000 : 8000;

    const stars = [];
    const goldParticles = [];
    const meteors = [];
    let lastMeteorTime = 0;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        centerX = W / 2;
        centerY = H / 2;
    }

    // ===== 星点粒子（旋转星图） =====
    class Star {
        constructor() {
            this.reset(true);
        }
        reset(initial) {
            // 极坐标：围绕中心旋转
            this.angle = Math.random() * Math.PI * 2;
            this.radius = Math.random() * Math.max(W, H) * 0.7 + 50;
            this.size = Math.random() * 1.2 + 0.3;
            // 蓝白系星光
            const brightness = 60 + Math.random() * 40;
            this.color = `hsla(${200 + Math.random() * 40}, ${30 + Math.random() * 30}%, ${brightness}%,`;
            this.alpha = Math.random() * 0.6 + 0.1;
            this.alphaSpeed = (Math.random() - 0.5) * 0.003;
            this.twinklePhase = Math.random() * Math.PI * 2;
            this.twinkleSpeed = 0.005 + Math.random() * 0.02;
            // 旋转速度（极慢，营造星河流转感）
            this.orbitSpeed = (Math.random() - 0.5) * 0.00008;
            if (initial) {
                this.x = centerX + Math.cos(this.angle) * this.radius;
                this.y = centerY + Math.sin(this.angle) * this.radius * 0.6;
            }
        }
        update() {
            this.angle += this.orbitSpeed;
            this.twinklePhase += this.twinkleSpeed;
            this.alpha += this.alphaSpeed;
            if (this.alpha <= 0.05 || this.alpha >= 0.7) this.alphaSpeed *= -1;

            this.x = centerX + Math.cos(this.angle) * this.radius;
            this.y = centerY + Math.sin(this.angle) * this.radius * 0.6;

            if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) {
                this.reset(false);
            }
        }
        draw() {
            const twinkle = 1 + Math.sin(this.twinklePhase) * 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * twinkle, 0, Math.PI * 2);
            ctx.fillStyle = this.color + this.alpha + ')';
            ctx.fill();
        }
    }

    // ===== 金色粒子（保留原有基因，增强） =====
    class GoldParticle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.size = Math.random() * 1.8 + 0.4;
            this.alpha = Math.random() * 0.45 + 0.08;
            this.alphaSpeed = (Math.random() - 0.5) * 0.006;
            this.vx = (Math.random() - 0.5) * 0.12;
            this.vy = (Math.random() - 0.5) * 0.12;
            const hue = 36 + Math.random() * 18;
            const sat = 55 + Math.random() * 35;
            const light = 48 + Math.random() * 22;
            this.color = `hsla(${hue}, ${sat}%, ${light}%,`;
            // 光晕半径
            this.glowRadius = this.size * 3 + Math.random() * 4;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.alpha += this.alphaSpeed;
            if (this.alpha <= 0.04 || this.alpha >= 0.55) this.alphaSpeed *= -1;
            if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) {
                this.reset();
            }
        }
        draw() {
            // 光晕
            const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.glowRadius);
            glow.addColorStop(0, this.color + (this.alpha * 1.5) + ')');
            glow.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
            // 核心
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color + this.alpha + ')';
            ctx.fill();
        }
    }

    // ===== 流星 =====
    class Meteor {
        constructor() {
            this.reset();
        }
        reset() {
            // 从左上区域出现，向右下划过
            this.x = Math.random() * W * 0.6;
            this.y = Math.random() * H * 0.3;
            this.len = 40 + Math.random() * 100;
            this.speed = 4 + Math.random() * 8;
            this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3;
            this.alpha = 0.7 + Math.random() * 0.3;
            this.decay = 0.015 + Math.random() * 0.025;
            this.active = true;
            // 金白系流星
            const hue = 40 + Math.random() * 30;
            this.color = `hsla(${hue}, 60%, 70%,`;
        }
        update() {
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
            this.alpha -= this.decay;
            if (this.alpha <= 0 || this.x > W + 100 || this.y > H + 100) {
                this.active = false;
            }
        }
        draw() {
            const grad = ctx.createLinearGradient(
                this.x, this.y,
                this.x - Math.cos(this.angle) * this.len,
                this.y - Math.sin(this.angle) * this.len
            );
            grad.addColorStop(0, this.color + this.alpha + ')');
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(
                this.x - Math.cos(this.angle) * this.len,
                this.y - Math.sin(this.angle) * this.len
            );
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
    }

    // ===== 初始化 =====
    function init() {
        resize();
        for (let i = 0; i < STAR_COUNT; i++) stars.push(new Star());
        for (let i = 0; i < GOLD_COUNT; i++) goldParticles.push(new GoldParticle());
        lastMeteorTime = Date.now();
    }

    // ===== 绘制底层渐变 =====
    function drawBackground() {
        const bg = ctx.createRadialGradient(centerX, centerY * 0.4, 0, centerX, centerY, Math.max(W, H) * 0.8);
        bg.addColorStop(0, '#0d1525');
        bg.addColorStop(0.5, '#0a101d');
        bg.addColorStop(1, '#060a12');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
    }

    // ===== 动画循环 =====
    function animate(timestamp) {
        // 绘制星空底色
        drawBackground();

        // 星点层
        stars.forEach(s => { s.update(); s.draw(); });

        // 金色粒子层
        goldParticles.forEach(p => { p.update(); p.draw(); });

        // 流星（定时生成）
        if (timestamp - lastMeteorTime > METEOR_INTERVAL && meteors.length < 3) {
            meteors.push(new Meteor());
            lastMeteorTime = timestamp;
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
            meteors[i].update();
            meteors[i].draw();
            if (!meteors[i].active) meteors.splice(i, 1);
        }

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        resize();
        // 更新星点位置
        stars.forEach(s => { s.radius = Math.random() * Math.max(W, H) * 0.7 + 50; });
    });

    init();
    requestAnimationFrame(animate);
})();
