/**
 * 🍃 栖白 (Theme Seihaku) - 统一预加载动画消融控制器
 * 支持：进度条平滑推进、同会话内站内跳转极速放行、超时安全兜底
 */

(function () {
  const SESSION_KEY = "seihaku_preloader_seen";
  const preloader = document.getElementById("seihaku-preloader");
  if (!preloader) return;

  const preloaderBar = document.getElementById("seihaku-preloader-bar");
  let dismissed = false;

  // 若同一会话已展示过预加载动画，则极速消融，避免站内跳转反复阻断阅读体验
  let alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem(SESSION_KEY) === "1";
  } catch (e) {}

  if (alreadySeen) {
    preloader.classList.add("fade-out");
    preloader.style.display = "none";
    return;
  }

  if (preloaderBar) {
    preloaderBar.style.width = "68%";
  }

  function dismissPreloader() {
    if (dismissed) return;
    dismissed = true;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (e) {}

    if (preloaderBar) {
      preloaderBar.style.width = "100%";
    }

    setTimeout(function () {
      preloader.classList.add("fade-out");
      setTimeout(function () {
        if (preloader.parentNode) {
          preloader.style.display = "none";
        }
      }, 460);
    }, 120);
  }

  if (document.readyState === "complete") {
    dismissPreloader();
  } else {
    window.addEventListener("load", dismissPreloader);
    // 安全保底：最长 950ms 自动淡出，杜绝外部字体或资源阻塞视窗
    setTimeout(dismissPreloader, 950);
  }
})();
