/**
 * 🍃 Theme Seihaku (栖白) - 色彩外观管理器 (Theme Switcher)
 * 支持深色/浅色模式平滑切换，避免首屏闪烁，并与系统外观偏好联动
 */

(function () {
  const STORAGE_KEY = "seihaku_theme_preference";

  function getSystemPreference() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getSavedTheme() {
    const urlParam = new URLSearchParams(window.location.search).get('theme');
    if (urlParam === 'light' || urlParam === 'dark') return urlParam;
    return localStorage.getItem(STORAGE_KEY) || getSystemPreference();
  }

  function updateIcons(theme) {
    const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    const desktopBtn = document.getElementById("theme-toggle-btn");
    if (desktopBtn) {
      desktopBtn.innerHTML = theme === "dark" ? sunSvg : moonSvg;
      desktopBtn.setAttribute("aria-label", theme === "dark" ? "切换至浅色模式" : "切换至深色模式");
    }

    const mobileBtns = [
      document.getElementById("mobile-theme-toggle"),
      document.getElementById("mobile-sheet-theme-btn")
    ];
    mobileBtns.forEach(function (mobileBtn) {
      if (!mobileBtn) return;
      const icon = mobileBtn.querySelector("i");
      if (icon) {
        icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
      }
      mobileBtn.setAttribute("aria-label", theme === "dark" ? "切换至浅色模式" : "切换至深色模式");
    });
  }

  function syncThirdPartyTheme(theme) {
    try {
      const giscusTheme = theme === "dark" ? "noborder_dark" : "noborder_light";
      const giscusFrame = document.querySelector("iframe.giscus-frame");
      if (giscusFrame && giscusFrame.contentWindow) {
        giscusFrame.contentWindow.postMessage(
          { giscus: { setConfig: { theme: giscusTheme } } },
          "https://giscus.app"
        );
      }
    } catch (e) {}
  }

  // 监听来自 Giscus 的初始化消息握手，确保无论何时加载均同步为当前主题
  window.addEventListener("message", function (event) {
    if (event.origin !== "https://giscus.app") return;
    if (!(typeof event.data === "object" && event.data && event.data.giscus)) return;
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    syncThirdPartyTheme(currentTheme);
  });

  window.syncSeihakuCommentsTheme = syncThirdPartyTheme;

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    updateIcons(theme);
    syncThirdPartyTheme(theme);
  }

  window.updateSeihakuThemeIcons = updateIcons;

  window.toggleSeihakuTheme = function () {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  // 全局事件委托：彻底防御 PJAX DOM 替换导致的主题切换按钮失效
  document.addEventListener("click", function (e) {
    const toggleBtn = e.target.closest("#theme-toggle-btn, #mobile-theme-toggle, #mobile-sheet-theme-btn");
    if (toggleBtn) {
      e.preventDefault();
      window.toggleSeihakuTheme();
    }
  });

  // Initial apply before render
  applyTheme(getSavedTheme());

  window.addEventListener("DOMContentLoaded", function () {
    applyTheme(getSavedTheme());

    // 监听系统色彩偏好变更
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  });

  // 监听 PJAX 完成事件，刷新图标状态
  document.addEventListener("pjax:complete", function () {
    updateIcons(document.documentElement.getAttribute("data-theme") || "light");
  });
})();
