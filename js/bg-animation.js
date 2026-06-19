/**
 * 首页背景粒子动画 - 星辰流转效果
 */
(function() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let W, H;
    const particles = [];
    const PARTICLE_COUNT = 80;
    
    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    
    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.size = Math.random() * 1.5 + 0.3;
            this.alpha = Math.random() * 0.5 + 0.1;
            this.alphaSpeed = (Math.random() - 0.5) * 0.008;
            this.vx = (Math.random() - 0.5) * 0.15;
            this.vy = (Math.random() - 0.5) * 0.15;
            // 金色系粒子
            const hue = 35 + Math.random() * 20;
            const sat = 60 + Math.random() * 30;
            const light = 50 + Math.random() * 20;
            this.color = `hsla(${hue}, ${sat}%, ${light}%,`;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.alpha += this.alphaSpeed;
            if (this.alpha <= 0.05 || this.alpha >= 0.6) this.alphaSpeed *= -1;
            if (this.x < -10 || this.x > W + 10 || this.y < -10 || this.y > H + 10) {
                this.reset();
            }
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color + this.alpha + ')';
            ctx.fill();
        }
    }
    
    function init() {
        resize();
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(new Particle());
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }
    
    window.addEventListener('resize', resize);
    init();
    animate();
})();