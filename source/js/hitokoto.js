/**
 * 🍃 栖白 (Theme Seihaku) - 一言 (Hitokoto) 独立诗韵系统
 * 功能：文学/哲学/名作一言拉取、无感平滑切换、自动定时轮播、悬浮暂停、平滑刷新动效
 */

document.addEventListener("DOMContentLoaded", function () {
  const hitokotoText = document.getElementById("seihaku-hitokoto-text");
  const hitokotoFrom = document.getElementById("seihaku-hitokoto-from");
  const hitokotoRefreshBtn = document.getElementById("hitokoto-refresh-btn");
  const hitokotoContainer = document.querySelector(".seihaku-hitokoto-strip");

  if (!hitokotoText) return;

  // 文学经典名句兜底库（杜绝任何站名或单一默认语句）
  const POETIC_FALLBACKS = [
    { text: "万物皆有裂痕，那是光照进来的地方。", from: "莱昂纳德·科恩" },
    { text: "山川是不卷收的文章，日月是不熄灭的见证。", from: "山河岁月" },
    { text: "流水不争先，争的是滔滔不绝。", from: "道德经" },
    { text: "素履以往，渺沧海之一粟；微光成炬，照夜行之扁舟。", from: "木心" },
    { text: "白不是一种颜色，而是一种可以容纳一切可能性的敏感度。", from: "原研哉" },
    { text: "草在结它的种子，风在摇它的叶子，我们站着，不说话，就十分美好。", from: "顾城" },
    { text: "风会吹灭蜡烛，却会助长山火。", from: "塔勒布" },
    { text: "生活是种律动，须有光有影，有左有右，有晴有雨。", from: "老舍" },
    { text: "与其寻找风景，不如成为风景。", from: "席慕蓉" },
    { text: "时间是一条河，带我沉沦，但我即是那条河。", from: "博尔赫斯" },
    { text: "眼睛为她下着雨，心却为她打着伞，这就是爱情。", from: "泰戈尔" },
    { text: "你若盛开，清风自来；心若浮沉，浅笑安然。", from: "三毛" }
  ];

  let lastIdx = -1;
  let autoRefreshTimer = null;
  const hitokotoCfg = (window.__SEIHAKU_FEATURES__ && window.__SEIHAKU_FEATURES__.hitokoto) || {};
  const AUTO_REFRESH = hitokotoCfg.auto_refresh !== false;
  const REFRESH_INTERVAL = hitokotoCfg.interval || 8500; // 自动刷新周期 (默认 8.5秒)

  function renderQuote(text, source) {
    hitokotoText.classList.add("fade-out");
    setTimeout(function () {
      hitokotoText.textContent = text;
      if (hitokotoFrom) {
        hitokotoFrom.textContent = source ? ` —— ${source}` : "";
      }
      hitokotoText.classList.remove("fade-out");
    }, 200);
  }

  function useFallback() {
    let idx;
    do {
      idx = Math.floor(Math.random() * POETIC_FALLBACKS.length);
    } while (idx === lastIdx && POETIC_FALLBACKS.length > 1);
    lastIdx = idx;
    const item = POETIC_FALLBACKS[idx];
    renderQuote(item.text, item.from);
  }

  function fetchHitokoto(isManual = false) {
    if (hitokotoRefreshBtn) {
      hitokotoRefreshBtn.classList.add("is-spinning");
      setTimeout(function () {
        hitokotoRefreshBtn.classList.remove("is-spinning");
      }, 550);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    // 请求文学、诗词、哲学、散文类优质一言
    fetch("https://v1.hitokoto.cn/?c=d&c=i&c=k&c=h&c=a&c=b&encode=json", {
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("Hitokoto response not ok");
        return res.json();
      })
      .then(function (data) {
        if (data && data.hitokoto) {
          const author = data.from_who || data.from || "";
          renderQuote(data.hitokoto, author);
        } else {
          useFallback();
        }
      })
      .catch(function () {
        clearTimeout(timeoutId);
        useFallback();
      });

    // 如果手动点击刷新，重置自动计时器
    if (isManual) {
      restartAutoRefresh();
    }
  }

  // 启动自动轮播刷新
  function startAutoRefresh() {
    stopAutoRefresh();
    if (!AUTO_REFRESH) return;
    autoRefreshTimer = setInterval(function () {
      fetchHitokoto(false);
    }, REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function restartAutoRefresh() {
    stopAutoRefresh();
    startAutoRefresh();
  }

  // 1. 鼠标悬停长廊时暂停刷新，移开时恢复（方便读者静心阅读当前句子）
  if (hitokotoContainer) {
    hitokotoContainer.addEventListener("mouseenter", stopAutoRefresh);
    hitokotoContainer.addEventListener("mouseleave", startAutoRefresh);
  }

  // 2. 手动刷新按钮交互
  if (hitokotoRefreshBtn) {
    hitokotoRefreshBtn.addEventListener("click", function () {
      fetchHitokoto(true);
    });
  }

  // 3. 页面初次加载时立即拉取真实一言，开启自动循环刷新
  fetchHitokoto(false);
  startAutoRefresh();
});
