/**
 * 🍃 Theme Seihaku (栖白) - Interactive Petal Breeze
 * 微风避让落樱轻粒子物理系统：支持光标引力/避让排斥与流体自然沉降
 */

(function () {
  const canvas = document.getElementById("petal-canvas") || document.getElementById("sakura-canvas");
  if (!canvas) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const petalCfg = (window.__SEIHAKU_FEATURES__ && window.__SEIHAKU_FEATURES__.petal_breeze) || {};
  const petalCount = petalCfg.petal_count || 14; // 克制余白原则：默认 14 片轻巧花瓣
  const enableRepel = petalCfg.mouse_repel !== false;
  const petals = [];

  let mouse = { x: -1000, y: -1000, active: false };
  let animId = null;

  class Petal {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : -20;
      this.size = Math.random() * 5 + 6; // 6px ~ 11px
      this.speedX = Math.random() * 0.8 - 0.2; // 随微风微偏
      this.speedY = Math.random() * 0.8 + 0.6; // 轻柔慢坠
      this.angle = Math.random() * Math.PI * 2;
      this.angularSpeed = (Math.random() - 0.5) * 0.02;
      this.flip = Math.random() * Math.PI;
      this.flipSpeed = Math.random() * 0.03 + 0.01;
      this.opacity = Math.random() * 0.35 + 0.35; // 0.35 ~ 0.70 柔和透光
      
      // 物理受力避让速度增量
      this.vx = 0;
      this.vy = 0;
    }

    update() {
      // 鼠标微风交互：当鼠标靠近花瓣时，产生流体微风推离
      if (enableRepel && mouse.active) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repelRadius = 110;

        if (dist < repelRadius && dist > 0) {
          const force = (1 - dist / repelRadius) * 2.2;
          this.vx += (dx / dist) * force;
          this.vy += (dy / dist) * force;
        }
      }

      // 阻尼摩擦力衰减
      this.vx *= 0.92;
      this.vy *= 0.92;

      this.x += this.speedX + this.vx;
      this.y += this.speedY + this.vy;
      this.angle += this.angularSpeed;
      this.flip += this.flipSpeed;

      // 视口边界复位
      if (this.y > height + 30 || this.x > width + 40 || this.x < -40) {
        this.reset(false);
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.scale(Math.cos(this.flip), 1);

      // 栖白自然落樱柔和微光色（自适应当前主题与预设色彩）
      const computedAccent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#dd996e';
      ctx.fillStyle = computedAccent;
      ctx.globalAlpha = this.opacity * 0.58;
      ctx.beginPath();
      // 优雅心形落樱曲线
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-this.size / 2, -this.size / 2, -this.size, this.size / 3, 0, this.size);
      ctx.bezierCurveTo(this.size, this.size / 3, this.size / 2, -this.size / 2, 0, 0);
      ctx.fill();

      ctx.restore();
    }
  }

  // 初始化粒子
  for (let i = 0; i < petalCount; i++) {
    petals.push(new Petal());
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < petals.length; i++) {
      petals[i].update();
      petals[i].draw();
    }
    animId = requestAnimationFrame(render);
  }

  // 鼠标交互监听
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  window.addEventListener("mouseleave", () => {
    mouse.active = false;
  });

  // 窗口大小调整防抖
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }, 150);
  });

  // 页面离开后台节能暂停
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      animId = requestAnimationFrame(render);
    }
  });

  animId = requestAnimationFrame(render);
})();
