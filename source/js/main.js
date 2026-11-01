/**
 * 🍃 栖白 (Theme Seihaku) - 核心交互协调器 (Main Coordinator)
 * 功能：阅读进度条、打字机胶囊、文稿微光点亮、全局 Toast、图片防损、平滑回顶
 */

document.addEventListener("DOMContentLoaded", function () {
  /* ----------------------------------------------------------------------------
     1. 阅读进度条 (Reading Progress Bar)
     ---------------------------------------------------------------------------- */
  const progressBar = document.getElementById("reading-progress");
  if (progressBar) {
    window.addEventListener("scroll", function () {
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const totalScroll = docHeight - winHeight;
      if (totalScroll > 0) {
        const percent = Math.min(100, Math.max(0, (scrollTop / totalScroll) * 100));
        progressBar.style.width = percent + "%";
      }
    }, { passive: true });
  }

  /* ----------------------------------------------------------------------------
     2. 首页首屏动态打字机胶囊 (Typewriter Words Cycler)
     ---------------------------------------------------------------------------- */
  const badgeElem = document.getElementById("typewriter-badge-text");
  if (badgeElem) {
    const words = (window.__SEIHAKU_WORDS && window.__SEIHAKU_WORDS.length) 
      ? window.__SEIHAKU_WORDS 
      : ["AI Agents", "Crafted Code", "Apple HIG", "Tranquil Spaces"];
    
    const typeSpeed = window.__SEIHAKU_BADGE_SPEED || 90;
    const pauseDelay = window.__SEIHAKU_BADGE_DELAY || 2400;

    let wordIdx = 0;
    let charIdx = words[0].length;
    let isDeleting = true;

    function badgeLoop() {
      const curWord = words[wordIdx];
      if (isDeleting) {
        badgeElem.textContent = curWord.substring(0, charIdx - 1);
        charIdx--;
      } else {
        badgeElem.textContent = curWord.substring(0, charIdx + 1);
        charIdx++;
      }

      let delay = isDeleting ? Math.round(typeSpeed * 0.5) : typeSpeed;

      if (!isDeleting && charIdx === curWord.length) {
        delay = pauseDelay;
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        wordIdx = (wordIdx + 1) % words.length;
        delay = 350;
      }

      setTimeout(badgeLoop, delay);
    }

    setTimeout(badgeLoop, 2200);
  }

  /* ----------------------------------------------------------------------------
     3. 全局轻量浮动 Toast 提示
     ---------------------------------------------------------------------------- */
  function showToast(msg) {
    let toast = document.getElementById("seihaku-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "seihaku-toast";
      toast.style.cssText = "position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(20px); background: rgba(22, 21, 20, 0.92); color: #fff; border: 0.5px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 8px 18px; font-size: 0.82rem; backdrop-filter: blur(16px); z-index: 9999; box-shadow: 0 8px 30px rgba(0,0,0,0.4); opacity: 0; pointer-events: none; transition: all 0.28s cubic-bezier(0.16,1,0.3,1);";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
    }, 2200);
  }
  window.showSeihakuToast = showToast;

  /* ----------------------------------------------------------------------------
     4. 复制分享链接、复制邮箱与文章赞赏弹窗
     ---------------------------------------------------------------------------- */
  const shareBtn = document.getElementById("toc-share-btn");
  const postShareBtn = document.getElementById("post-share-btn");
  function copyShareLink(btn) {
    navigator.clipboard.writeText(window.location.href).then(function () {
      const msg = (window.__SEIHAKU_I18N__ && window.__SEIHAKU_I18N__.copied) || "已成功复制文章链接";
      showToast(msg);
      if (btn) {
        btn.style.color = "#22c55e";
        setTimeout(() => { btn.style.color = ""; }, 2000);
      }
    });
  }
  if (shareBtn) shareBtn.addEventListener("click", () => copyShareLink(shareBtn));
  if (postShareBtn) postShareBtn.addEventListener("click", () => copyShareLink(postShareBtn));

  [document.getElementById("copy-email-btn"), document.getElementById("about-copy-email-btn")].forEach(function (copyEmailBtn) {
    if (!copyEmailBtn) return;
    copyEmailBtn.addEventListener("click", function () {
      const email = copyEmailBtn.dataset.email || "hello@example.com";
      if (navigator.clipboard) {
        navigator.clipboard.writeText(email).then(function () {
          const copiedLabel = (window.__SEIHAKU_I18N__ && window.__SEIHAKU_I18N__.emailCopied) || "已复制 ✓";
          showToast(copiedLabel + ": " + email);
          const span = copyEmailBtn.querySelector("span");
          const orig = span ? span.textContent : "";
          if (span) span.textContent = copiedLabel;
          copyEmailBtn.classList.add("copied");
          setTimeout(() => {
            if (span) span.textContent = orig;
            copyEmailBtn.classList.remove("copied");
          }, 2000);
        });
      }
    });
  });

  const postRewardBtn = document.getElementById("post-reward-btn");
  const postRewardModal = document.getElementById("post-reward-modal");
  if (postRewardBtn && postRewardModal) {
    postRewardBtn.addEventListener("click", function () {
      const isHidden = postRewardModal.style.display === "none" || !postRewardModal.style.display;
      postRewardModal.style.display = isHidden ? "block" : "none";
    });
  }

  /* ----------------------------------------------------------------------------
     5. 赞赏落樱动效
     ---------------------------------------------------------------------------- */
  function spawnPetals(x, y) {
    for (let i = 0; i < 8; i++) {
      const petal = document.createElement("span");
      petal.textContent = "🌸";
      petal.style.position = "fixed";
      petal.style.left = x + "px";
      petal.style.top = y + "px";
      petal.style.pointerEvents = "none";
      petal.style.fontSize = (Math.random() * 8 + 14) + "px";
      petal.style.zIndex = "99999";
      petal.style.transition = "all 0.9s cubic-bezier(0.16, 1, 0.3, 1)";
      document.body.appendChild(petal);

      const angle = (Math.PI * 2 / 8) * i + (Math.random() - 0.5) * 0.5;
      const dist = Math.random() * 50 + 40;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist - 25;

      requestAnimationFrame(function () {
        petal.style.transform = `translate(${tx}px, ${ty}px) rotate(${Math.random() * 360}deg) scale(0)`;
        petal.style.opacity = "0";
      });

      setTimeout(function () {
        if (petal.parentNode) petal.parentNode.removeChild(petal);
      }, 950);
    }
  }

  /* ----------------------------------------------------------------------------
     6. 纯静态文稿微光点亮与本地持久化
     ---------------------------------------------------------------------------- */
  const tocLikeBtn = document.getElementById("toc-like-btn");
  const postLikeBtn = document.getElementById("post-like-btn");
  const postStorageKey = "seihaku_liked_" + window.location.pathname;
  let postLiked = false;

  try {
    postLiked = localStorage.getItem(postStorageKey) === "true";
  } catch (err) {
    postLiked = false;
  }

  function applyLikedState() {
    if (tocLikeBtn) {
      tocLikeBtn.classList.add("liked");
      tocLikeBtn.style.color = "#f43f5e";
      tocLikeBtn.setAttribute("title", "已为本文点亮微光");
    }
    if (postLikeBtn) {
      postLikeBtn.classList.add("liked");
      const icon = postLikeBtn.querySelector(".heart-icon") || postLikeBtn.querySelector("i");
      if (icon) {
        icon.className = "fas fa-heart heart-icon";
        icon.style.color = "#f43f5e";
      }
      const textSpan = postLikeBtn.querySelector(".like-btn-text") || postLikeBtn.querySelector("span");
      if (textSpan) textSpan.textContent = "已点亮微光";
    }
  }

  if (postLiked) {
    applyLikedState();
  }

  function triggerLike(e) {
    if (postLiked) {
      const alreadyMsg = (window.__SEIHAKU_I18N__ && window.__SEIHAKU_I18N__.liked) || "已为本文点亮微光 🍃";
      showToast(alreadyMsg);
      return;
    }
    postLiked = true;
    try {
      localStorage.setItem(postStorageKey, "true");
    } catch (err) {}

    applyLikedState();

    if (postLikeBtn) {
      postLikeBtn.style.transform = "scale(1.12)";
      setTimeout(() => { postLikeBtn.style.transform = "scale(1)"; }, 250);
    }

    const clickX = e ? e.clientX : window.innerWidth / 2;
    const clickY = e ? e.clientY : window.innerHeight / 2;
    spawnPetals(clickX, clickY);

    if (window.__SEIHAKU_BLOOM) {
      window.__SEIHAKU_BLOOM(clickX, clickY);
    }
    const likedSuccess = (window.__SEIHAKU_I18N__ && window.__SEIHAKU_I18N__.liked) || "微光已点亮 🌸";
    showToast(likedSuccess);
  }

  if (tocLikeBtn) tocLikeBtn.addEventListener("click", triggerLike);
  if (postLikeBtn) postLikeBtn.addEventListener("click", triggerLike);

  /* ----------------------------------------------------------------------------
     7. 平滑返回顶部按钮逻辑
     ---------------------------------------------------------------------------- */
  const backToTopBtn = document.getElementById("footer-back-to-top");
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ----------------------------------------------------------------------------
     8. 全局正文图片破损防御与 GitHub Alert 提示块增强
     ---------------------------------------------------------------------------- */
  const markdownImgs = document.querySelectorAll(".markdown-body img");
  markdownImgs.forEach(function (img) {
    img.addEventListener("error", function () {
      if (img.classList.contains("post-cover-image") || img.closest(".seihaku-link-card")) {
        return;
      }
      img.style.display = "none";
      const fallbackBox = document.createElement("div");
      fallbackBox.className = "markdown-img-fallback";
      fallbackBox.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span>${img.alt || '图像已隐入微澜'}</span>
      `;
      img.parentNode.insertBefore(fallbackBox, img);
    });
  });

  // 9. 为正文数据表格自动注入响应式自适应横向滚动包裹层
  function initResponsiveTables(scope) {
    const root = scope || document;
    root.querySelectorAll(".markdown-body table").forEach(function (table) {
      if (!table.closest(".table-wrapper") && !table.closest(".markdown-table-wrapper") && !table.closest("figure.highlight")) {
        const wrapper = document.createElement("div");
        wrapper.className = "table-wrapper markdown-table-wrapper";
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });
  }
  initResponsiveTables();
  window.initSeihakuTables = initResponsiveTables;

  // 解析 GitHub 风格 Alert 提示块 (> [!NOTE], [!TIP], etc.)
  function initMarkdownAlerts() {
    document.querySelectorAll(".markdown-body blockquote").forEach(function (bq) {
      if (bq.dataset.alertParsed) return;
      bq.dataset.alertParsed = "true";
      const firstP = bq.querySelector("p");
      if (!firstP) return;
      const raw = firstP.innerHTML.trim();
      const match = raw.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*<br\s*\/?>)?/i);
      if (match) {
        const type = match[1].toLowerCase();
        bq.classList.add("markdown-alert", "markdown-alert-" + type);
        const iconMap = {
          note: '<i class="fas fa-info-circle"></i>',
          tip: '<i class="far fa-lightbulb"></i>',
          important: '<i class="fas fa-exclamation-circle"></i>',
          warning: '<i class="fas fa-exclamation-triangle"></i>',
          caution: '<i class="fas fa-fire"></i>'
        };
        const icon = iconMap[type] || '<i class="fas fa-info-circle"></i>';
        firstP.innerHTML = `<span class="alert-title font-mono">${icon} <span>${match[1]}</span></span>` + raw.replace(match[0], "");
      }
    });
  }
  initMarkdownAlerts();
  window.initSeihakuAlerts = initMarkdownAlerts;

  // 10. 分栏选项卡 (Tabs) 切换
  function initSeihakuTabs(scope) {
    const root = scope || document;
    root.querySelectorAll(".seihaku-tabs").forEach(function (tabContainer) {
      if (tabContainer.dataset.tabsBound) return;
      tabContainer.dataset.tabsBound = "true";
      const navBtns = tabContainer.querySelectorAll(".seihaku-tab-btn");
      const panes = tabContainer.querySelectorAll(".seihaku-tab-pane");

      navBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          const targetId = btn.getAttribute("data-target");
          navBtns.forEach((b) => b.classList.remove("is-active"));
          panes.forEach((p) => p.classList.remove("is-active"));
          btn.classList.add("is-active");
          const targetPane = tabContainer.querySelector("#" + targetId);
          if (targetPane) targetPane.classList.add("is-active");

          if (window.gsap) {
            window.gsap.fromTo(btn, { scale: 0.94 }, { scale: 1, duration: 0.25, ease: "back.out(2)" });
          }
        });
      });
    });
  }
  initSeihakuTabs();
  window.initSeihakuTabs = initSeihakuTabs;

  // 11. 密码保护文稿解密
  window.unlockSeihakuPost = function (e) {
    if (e) e.preventDefault();
    const box = document.getElementById("post-protected-box");
    const input = document.getElementById("post-unlock-pwd");
    if (!box || !input) return;
    const pwd = input.value.trim();
    const correctSalt = box.getAttribute("data-salt");
    if (pwd === correctSalt) {
      const cipher = box.getAttribute("data-cipher");
      try {
        const decoded = decodeURIComponent(escape(atob(cipher)));
        const body = document.getElementById("article-body");
        if (body) {
          body.innerHTML = decoded;
          if (window.initSeihakuCodeBlocks) window.initSeihakuCodeBlocks(body);
          if (window.initSeihakuLightbox) window.initSeihakuLightbox();
          if (window.initSeihakuTables) window.initSeihakuTables(body);
          if (window.initSeihakuTabs) window.initSeihakuTabs(body);
        }
        if (window.showSeihakuToast) window.showSeihakuToast("文稿解锁成功");
      } catch (err) {
        console.error(err);
      }
    } else {
      if (window.showSeihakuToast) window.showSeihakuToast("密码错误，请重新输入");
      input.value = "";
      input.focus();
    }
  };

  // 12. 毛玻璃遮罩点击/触控显现
  document.addEventListener("click", function (e) {
    const blurSpan = e.target.closest(".seihaku-blur-text");
    if (blurSpan) {
      blurSpan.classList.toggle("is-unblurred");
    }
  });

  // 13. 复制自动追加版权后缀（Copy Copyright Notice）
  document.addEventListener("copy", function (e) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const text = selection.toString();
    if (text.length > 150 && !e.target.closest("pre, code, .code-mac-enhanced")) {
      const pageTitle = document.title || "";
      const pageUrl = window.location.href;
      const author = (window.__SEIHAKU_I18N__ && window.__SEIHAKU_I18N__.author) || "余白站长";
      const copyrightSuffix = `\n\n----\n作者：${author}\n出处：${pageTitle}\n链接：${pageUrl}\n来源：🍃 栖白 (Theme Seihaku)\n著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。`;
      e.clipboardData.setData("text/plain", text + copyrightSuffix);
      e.preventDefault();
      if (typeof window.showSeihakuToast === "function") {
        window.showSeihakuToast("已复制选中文本并自动附带作者版权出处");
      }
    }
  });

  /* ----------------------------------------------------------------------------
     9. 顶栏二级导航下拉浮岛交互加固 (Hierarchical Dropdown Hover Bridge & Hybrid)
     ---------------------------------------------------------------------------- */
  const navDropdownGroups = document.querySelectorAll(".capsule-dock-group, .capsule-dock-more-group");
  if (navDropdownGroups.length) {
    navDropdownGroups.forEach(function (group) {
      const triggerBtn = group.querySelector(".capsule-dock-group-btn, .capsule-dock-more-btn");
      let leaveTimeout = null;

      // 鼠标移入时保持展开，并关闭其他已展开面板
      group.addEventListener("mouseenter", function () {
        if (leaveTimeout) {
          clearTimeout(leaveTimeout);
          leaveTimeout = null;
        }
        navDropdownGroups.forEach(function (other) {
          if (other !== group) {
            other.classList.remove("is-open");
            const otherBtn = other.querySelector(".capsule-dock-group-btn, .capsule-dock-more-btn");
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
          }
        });
        group.classList.add("is-open");
        if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "true");
      });

      // 鼠标移出时提供 200ms 安全缓冲期，防止在移动指针到下拉卡片时发生意外中断
      group.addEventListener("mouseleave", function () {
        leaveTimeout = setTimeout(function () {
          group.classList.remove("is-open");
          if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "false");
        }, 200);
      });

      // 支持点击切换（兼顾触屏设备、点击箭头或移动端使用）
      if (triggerBtn) {
        triggerBtn.addEventListener("click", function (e) {
          const isChevron = !!e.target.closest(".nav-chevron-icon, .more-chevron-icon");
          const targetHref = triggerBtn.getAttribute("href");
          const isPlaceholder = !targetHref || targetHref === "#" || targetHref === "javascript:void(0);";

          // 如果点击箭头、或链接仅为占位符、或在触屏宽度下，则阻止跳转并切换折叠
          if (isChevron || isPlaceholder || window.innerWidth <= 1024) {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = group.classList.toggle("is-open");
            triggerBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
          }
        });
      }
    });

    // 点击页面任意其他空白区域自动收起所有下拉面板
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".capsule-dock-group, .capsule-dock-more-group")) {
        navDropdownGroups.forEach(function (group) {
          group.classList.remove("is-open");
          const btn = group.querySelector(".capsule-dock-group-btn, .capsule-dock-more-btn");
          if (btn) btn.setAttribute("aria-expanded", "false");
        });
      }
    });

    // ESC 键收起面板
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        navDropdownGroups.forEach(function (group) {
          group.classList.remove("is-open");
          const btn = group.querySelector(".capsule-dock-group-btn, .capsule-dock-more-btn");
          if (btn) btn.setAttribute("aria-expanded", "false");
        });
      }
    });
  }

  /* ----------------------------------------------------------------------------
     9.1 移动端全站抽屉手风琴折叠面板交互 (Mobile Accordion Controller)
     ---------------------------------------------------------------------------- */
  const mobileAccordionSections = document.querySelectorAll(".mobile-accordion-section");
  if (mobileAccordionSections.length) {
    mobileAccordionSections.forEach(function (section) {
      const headerBtn = section.querySelector(".mobile-accordion-header");
      if (!headerBtn) return;

      headerBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        const isExpanded = section.classList.toggle("is-expanded");
        headerBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      });
    });
  }

  /* ----------------------------------------------------------------------------
     10. 移动端全站更多抽屉手势与弹层控制器 (Mobile Bottom Sheet Controller)
     ---------------------------------------------------------------------------- */
  const mobileMoreTrigger = document.getElementById("mobile-more-trigger");
  const mobileSheet = document.getElementById("mobile-more-sheet");
  const mobileBackdrop = document.getElementById("mobile-more-sheet-backdrop");
  const mobileCloseBtn = document.getElementById("mobile-sheet-close-btn");
  const mobileSheetThemeBtn = document.getElementById("mobile-sheet-theme-btn");

  function openMobileSheet() {
    if (mobileSheet && mobileBackdrop) {
      mobileBackdrop.classList.add("is-active");
      mobileSheet.classList.add("is-open");
      document.body.classList.add("mobile-sheet-open");
      document.body.style.overflow = "hidden";
      if (mobileMoreTrigger) mobileMoreTrigger.setAttribute("aria-expanded", "true");
    }
  }

  function closeMobileSheet() {
    if (mobileSheet && mobileBackdrop) {
      mobileSheet.classList.remove("is-open");
      mobileBackdrop.classList.remove("is-active");
      document.body.classList.remove("mobile-sheet-open");
      document.body.style.overflow = "";
      if (mobileMoreTrigger) mobileMoreTrigger.setAttribute("aria-expanded", "false");
    }
  }

  if (mobileMoreTrigger) {
    mobileMoreTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      openMobileSheet();
    });
  }

  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener("click", closeMobileSheet);
  }

  if (mobileBackdrop) {
    mobileBackdrop.addEventListener("click", closeMobileSheet);
  }

  if (mobileSheetThemeBtn) {
    mobileSheetThemeBtn.addEventListener("click", function () {
      if (window.toggleSeihakuTheme) {
        window.toggleSeihakuTheme();
      }
    });
  }

  // 移动端抽屉 Apple HIG 下拉阻尼跟手手势关闭
  if (mobileSheet) {
    const handle = mobileSheet.querySelector(".mobile-sheet-drag-handle") || mobileSheet.querySelector(".mobile-sheet-handle-bar");
    if (handle) {
      let startY = 0;
      let currentY = 0;
      let isDragging = false;

      handle.addEventListener("touchstart", function (e) {
        startY = e.touches[0].clientY;
        isDragging = true;
        mobileSheet.style.transition = "none";
      }, { passive: true });

      handle.addEventListener("touchmove", function (e) {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
          const dampened = Math.pow(diff, 0.88);
          mobileSheet.style.transform = `translateY(${dampened}px)`;
        }
      }, { passive: true });

      handle.addEventListener("touchend", function () {
        if (!isDragging) return;
        isDragging = false;
        mobileSheet.style.transition = "";
        const diff = currentY - startY;
        if (diff > 80) {
          closeMobileSheet();
        }
        mobileSheet.style.transform = "";
      });
    }
  }

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mobileSheet && mobileSheet.classList.contains("is-open")) {
      closeMobileSheet();
    }
  });

  // 全局事件委托：保证在 PJAX 动态替换头部后搜索按钮依然 100% 响应
  document.addEventListener("click", function (e) {
    const searchTrigger = e.target.closest("#header-search-btn, #mobile-sheet-search-btn, #toc-search-btn, #mobile-nav-search-btn");
    if (searchTrigger) {
      e.preventDefault();
      openSearchModal();
    }
  });

  window.openSeihakuSearch = openSearchModal;
  window.closeSeihakuSearch = closeSearchModal;

  /* ----------------------------------------------------------------------------
     11. 全站即时检索面板 (Spotlight Search Modal · ⌘K / Ctrl+K)
     ---------------------------------------------------------------------------- */
  const searchBackdrop = document.getElementById("seihaku-search-backdrop");
  const searchInput = document.getElementById("seihaku-search-input");
  const searchResults = document.getElementById("seihaku-search-results");
  const searchEscBtn = document.getElementById("seihaku-search-esc-btn");
  const headerSearchBtn = document.getElementById("header-search-btn");
  const mobileSearchBtn = document.getElementById("mobile-sheet-search-btn");

  let searchIndexCache = null;
  let searchLoading = false;

  function escapeSearchHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveHitUrl(url) {
    if (!url) return "#";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) return url;
    const metaRoot = document.querySelector('meta[name="site-root"]');
    const siteRoot = metaRoot ? (metaRoot.getAttribute('content') || "") : "";
    let clean = url.replace(/^\/+/, "");
    let target = clean.startsWith("..") ? clean : (siteRoot + clean);
    const parts = target.split(/([?#].*)/s);
    let base = parts[0];
    const suffix = parts.slice(1).join("");
    if (!/\.[a-z0-9]+$/i.test(base)) {
      target = base.replace(/\/+$/, "") + "/index.html" + suffix;
    }
    return target;
  }

  function loadSearchIndex() {
    if (searchIndexCache) return Promise.resolve(searchIndexCache);
    if (window.__SEIHAKU_SEARCH_DATA__ && Array.isArray(window.__SEIHAKU_SEARCH_DATA__)) {
      searchIndexCache = window.__SEIHAKU_SEARCH_DATA__;
      return Promise.resolve(searchIndexCache);
    }
    if (searchLoading) return Promise.resolve([]);
    searchLoading = true;
    const rootMeta = document.querySelector('meta[name="site-root"]');
    const root = rootMeta ? (rootMeta.getAttribute('content') || '') : '';
    const defaultSearchUrl = root ? (root + 'search.json') : '/search.json';
    const searchUrl = (window.__SEIHAKU_FEATURES__ && window.__SEIHAKU_FEATURES__.searchUrl) || defaultSearchUrl;
    return fetch(searchUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        searchIndexCache = Array.isArray(data) ? data : [];
        searchLoading = false;
        return searchIndexCache;
      })
      .catch(() => {
        searchLoading = false;
        return [];
      });
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightKeywords(str, query) {
    if (!str) return "";
    const safeStr = escapeSearchHtml(str);
    const q = (query || "").trim();
    if (!q) return safeStr;
    const reg = new RegExp(`(${escapeRegex(escapeSearchHtml(q))})`, 'gi');
    return safeStr.replace(reg, '<mark class="seihaku-search-mark">$1</mark>');
  }

  let activeHitIndex = -1;
  function updateActiveSearchHit(hits) {
    hits.forEach((h, idx) => {
      if (idx === activeHitIndex) {
        h.classList.add("is-selected");
        h.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else {
        h.classList.remove("is-selected");
      }
    });
  }

  function renderSearchHits(query) {
    if (!searchResults) return;
    const q = (query || "").trim().toLowerCase();
    activeHitIndex = -1;
    loadSearchIndex().then((items) => {
      if (!q) {
        const recent = items.slice(0, 6);
        const emptyHint = (window.__SEIHAKU_I18N__ && window.__SEIHAKU_I18N__.searchEmpty) || "输入关键词检索全站文稿与留白手记";
        if (!recent.length) {
          searchResults.innerHTML = `<div class="seihaku-search-empty font-serif">${emptyHint}</div>`;
          return;
        }
        searchResults.innerHTML = recent
          .map(
            (item) => `
          <a href="${escapeSearchHtml(resolveHitUrl(item.url))}" class="seihaku-search-hit">
            <div class="seihaku-search-hit-top">
              <span class="seihaku-search-hit-title">${escapeSearchHtml(item.title)}</span>
              <span class="seihaku-search-hit-badge">${escapeSearchHtml(item.category || "文稿")}</span>
            </div>
            <div class="seihaku-search-hit-snippet">${escapeSearchHtml(item.summary || "")}</div>
          </a>`
          )
          .join("");
        return;
      }

      const queryWords = q.split(/\s+/).filter(Boolean);
      const matched = items.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const cat = (item.category || "").toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags.map(t => t.toLowerCase()).join(' ') : '';
        const sum = (item.summary || "").toLowerCase();
        const cnt = (item.content || "").toLowerCase();
        const combined = `${title} ${cat} ${tags} ${sum} ${cnt}`;
        return queryWords.every((w) => combined.includes(w));
      });

      function extractSnippet(item, words) {
        const text = item.content || item.summary || "";
        if (!text) return "";
        const lower = text.toLowerCase();
        let hitIdx = -1;
        for (const w of words) {
          const idx = lower.indexOf(w);
          if (idx !== -1 && (hitIdx === -1 || idx < hitIdx)) {
            hitIdx = idx;
          }
        }
        if (hitIdx === -1) {
          return (item.summary || text).slice(0, 140);
        }
        const start = Math.max(0, hitIdx - 35);
        const end = Math.min(text.length, hitIdx + 75);
        let slice = text.slice(start, end).trim();
        if (start > 0) slice = "..." + slice;
        if (end < text.length) slice = slice + "...";
        return slice;
      }

      if (!matched.length) {
        const noResTpl = (window.__SEIHAKU_I18N__ && window.__SEIHAKU_I18N__.searchNoResult) || "未找到与「%s」相关的笔墨记录";
        const noResMsg = noResTpl.replace("%s", escapeSearchHtml(query));
        searchResults.innerHTML = `<div class="seihaku-search-empty font-serif">${noResMsg}</div>`;
        return;
      }

      searchResults.innerHTML = matched
        .slice(0, 15)
        .map(
          (item) => `
        <a href="${escapeSearchHtml(resolveHitUrl(item.url))}" class="seihaku-search-hit">
          <div class="seihaku-search-hit-top">
            <span class="seihaku-search-hit-title">${highlightKeywords(item.title, query)}</span>
            <span class="seihaku-search-hit-badge">${escapeSearchHtml(item.category || "文稿")} · ${escapeSearchHtml(item.date || "")}</span>
          </div>
          <div class="seihaku-search-hit-snippet">${highlightKeywords(extractSnippet(item, queryWords), query)}</div>
        </a>`
        )
        .join("");
    });
  }

  function openSearchModal() {
    if (!searchBackdrop) return;
    closeMobileSheet();
    searchBackdrop.classList.add("is-open");
    searchBackdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    renderSearchHits(searchInput ? searchInput.value : "");
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 60);
    }
  }

  function closeSearchModal() {
    if (!searchBackdrop) return;
    searchBackdrop.classList.remove("is-open");
    searchBackdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeHitIndex = -1;
  }

  if (headerSearchBtn) headerSearchBtn.addEventListener("click", openSearchModal);
  if (mobileSearchBtn) mobileSearchBtn.addEventListener("click", openSearchModal);
  if (searchEscBtn) searchEscBtn.addEventListener("click", closeSearchModal);
  if (searchBackdrop) {
    searchBackdrop.addEventListener("click", function (e) {
      if (e.target === searchBackdrop) closeSearchModal();
    });
  }

  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener("input", function (e) {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        renderSearchHits(e.target.value);
      }, 120);
    });
  }

  window.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (searchBackdrop && searchBackdrop.classList.contains("is-open")) {
        closeSearchModal();
      } else {
        openSearchModal();
      }
    } else if (e.key === "Escape" && searchBackdrop && searchBackdrop.classList.contains("is-open")) {
      closeSearchModal();
    } else if (searchBackdrop && searchBackdrop.classList.contains("is-open")) {
      const hits = searchResults.querySelectorAll(".seihaku-search-hit");
      if (!hits.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeHitIndex = (activeHitIndex + 1) % hits.length;
        updateActiveSearchHit(hits);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeHitIndex = (activeHitIndex - 1 + hits.length) % hits.length;
        updateActiveSearchHit(hits);
      } else if (e.key === "Enter" && activeHitIndex >= 0) {
        e.preventDefault();
        if (hits[activeHitIndex]) {
          hits[activeHitIndex].click();
        }
      }
    }
  });
});
