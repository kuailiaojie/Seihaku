/**
 * 🍃 栖白 (Theme Seihaku) - 双端全能响应式目录系统 (Seihaku Desktop Floating TOC & Apple HIG Mobile Sheet)
 * 功能：
 *  - 桌面端：随动磁吸物理指示滑块、环形进度环、顶栏安全偏移平滑滚动
 *  - 移动端：悬浮胶囊入口 (FAB)、元数据快捷入口、Apple HIG 抽屉滑层、高辨识度层级与进度同步
 */

function initSeihakuTOC() {
  const desktopTocNav = document.getElementById("seihaku-toc-nav") || document.getElementById("floating-toc-nav");
  const mobileTocNav = document.getElementById("mobile-toc-nav");
  const indicatorThumb = document.getElementById("toc-indicator-thumb");
  const desktopProgressText = document.getElementById("toc-progress-text");
  const desktopProgressCircle = document.getElementById("toc-progress-val");

  // 移动端专用 DOM 元素
  const mobileTocFab = document.getElementById("mobile-toc-fab");
  const mobileTocFabPercent = document.getElementById("mobile-toc-fab-percent");
  const mobileTocSheetPercent = document.getElementById("mobile-toc-sheet-percent");
  const postMetaTocTrigger = document.getElementById("post-meta-toc-trigger");
  const mobileTocSheet = document.getElementById("mobile-toc-sheet");
  const mobileTocBackdrop = document.getElementById("mobile-toc-backdrop");
  const mobileTocCloseBtn = document.getElementById("mobile-toc-close-btn");
  const mobileTocToTop = document.getElementById("mobile-toc-to-top");

  const desktopLinks = desktopTocNav ? Array.from(desktopTocNav.querySelectorAll("a")) : [];
  const mobileLinks = mobileTocNav ? Array.from(mobileTocNav.querySelectorAll("a")) : [];

  if (desktopLinks.length === 0 && mobileLinks.length === 0) return;

  // 1. 查找正文中的所有目标标题元素 (支持中文、URL 编码、特殊字符)
  function findHeadingElement(href) {
    if (!href || !href.startsWith("#")) return null;
    const rawId = href.slice(1);
    let decodedId = "";
    try {
      decodedId = decodeURIComponent(rawId);
    } catch (e) {
      decodedId = rawId;
    }

    // 优先通过 ID 匹配
    let el = document.getElementById(decodedId) || document.getElementById(rawId);
    if (el) return el;

    // 尝试通过 attribute 选择器匹配
    try {
      el = document.querySelector(`[id="${decodedId}"]`) || document.querySelector(`[id="${rawId}"]`);
      if (el) return el;
    } catch (e) {}

    // 备选方案：通过正文内标题文本匹配
    const allArticleHeadings = document.querySelectorAll(
      ".markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4"
    );
    for (let i = 0; i < allArticleHeadings.length; i++) {
      const h = allArticleHeadings[i];
      const hText = h.textContent.trim().replace(/^#+\s*/, "");
      if (hText === decodedId.trim() || h.id === decodedId || h.id === rawId) {
        return h;
      }
    }
    return null;
  }

  // 建立标题元素与双端链接的统一关联映射
  const headingMap = new Map();
  const allLinks = [...desktopLinks, ...mobileLinks];

  allLinks.forEach(function (link) {
    const href = link.getAttribute("href");
    if (!href) return;
    let entry = headingMap.get(href);
    if (!entry) {
      const elem = findHeadingElement(href);
      if (elem) {
        entry = { elem: elem, href: href, desktopLinks: [], mobileLinks: [] };
        headingMap.set(href, entry);
      }
    }
    if (entry) {
      if (desktopLinks.includes(link)) {
        entry.desktopLinks.push(link);
      }
      if (mobileLinks.includes(link)) {
        entry.mobileLinks.push(link);
      }
    }
  });

  const headingEntries = Array.from(headingMap.values());

  // 2. 双端阅读进度同步计算
  const circumference = 2 * Math.PI * 9; // r=9, ~56.548
  function updateReadingProgress() {
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const totalScroll = docHeight - winHeight;

    let percent = 0;
    if (totalScroll > 0) {
      percent = Math.min(100, Math.max(0, Math.round((scrollTop / totalScroll) * 100)));
    }

    const percentStr = percent + "%";

    // 桌面端进度更新
    if (desktopProgressText) {
      desktopProgressText.textContent = percentStr;
    }
    if (desktopProgressCircle) {
      const offset = circumference - (percent / 100) * circumference;
      desktopProgressCircle.style.strokeDasharray = `${circumference}`;
      desktopProgressCircle.style.strokeDashoffset = `${offset}`;
    }

    // 移动端进度更新 (悬浮胶囊与抽屉顶栏)
    if (mobileTocFabPercent) {
      mobileTocFabPercent.textContent = percentStr;
    }
    if (mobileTocSheetPercent) {
      mobileTocSheetPercent.textContent = percentStr;
    }
  }

  // 3. 滚动追踪与双端高亮同步 (Scroll Spy)
  let lastActiveHref = null;
  function updateTocSpy() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    let activeEntry = null;

    for (let i = 0; i < headingEntries.length; i++) {
      const top = headingEntries[i].elem.getBoundingClientRect().top + scrollY - 110;
      if (scrollY >= top) {
        activeEntry = headingEntries[i];
      } else {
        break;
      }
    }

    if (!activeEntry && headingEntries.length > 0) {
      activeEntry = headingEntries[0];
    }

    // 重置所有激活状态
    desktopLinks.forEach(function (l) {
      l.classList.remove("active");
    });
    mobileLinks.forEach(function (l) {
      l.classList.remove("active");
    });

    if (activeEntry) {
      // 当激活段落变更时，触发波浪线涟漪微动反馈
      if (activeEntry.href !== lastActiveHref) {
        lastActiveHref = activeEntry.href;
        const waveSvg = document.querySelector(".floating-toc-divider .toc-wave-svg");
        if (waveSvg) {
          waveSvg.classList.remove("wave-ripple");
          void waveSvg.offsetWidth; // 触发回流重绘
          waveSvg.classList.add("wave-ripple");
        }
      }

      // 桌面端高亮与磁吸滑块
      activeEntry.desktopLinks.forEach(function (l) {
        l.classList.add("active");
        if (indicatorThumb && desktopTocNav) {
          const navRect = desktopTocNav.getBoundingClientRect();
          const linkRect = l.getBoundingClientRect();
          const topPos = linkRect.top - navRect.top;
          const height = linkRect.height;

          indicatorThumb.style.transform = `translateY(${topPos + 2}px)`;
          indicatorThumb.style.height = `${Math.max(14, height - 4)}px`;
          indicatorThumb.classList.add("visible");
        }
      });

      // 移动端抽屉目录高亮
      activeEntry.mobileLinks.forEach(function (l) {
        l.classList.add("active");
      });
    } else if (indicatorThumb) {
      indicatorThumb.classList.remove("visible");
    }
  }

  // 4. 桌面端锚点平滑跳转
  desktopLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      const href = link.getAttribute("href");
      const targetElem = findHeadingElement(href);
      if (targetElem) {
        e.preventDefault();
        const top = targetElem.getBoundingClientRect().top + window.scrollY - 92;
        window.scrollTo({ top: top, behavior: "smooth" });
        if (history.pushState) {
          history.pushState(null, "", href);
        }
      }
    });
  });

  // 5. 移动端抽屉式目录展开与关闭控制器 (Apple HIG Bottom Sheet Controller)
  if (mobileTocSheet && mobileTocSheet.parentNode !== document.body) {
    if (mobileTocBackdrop) document.body.appendChild(mobileTocBackdrop);
    document.body.appendChild(mobileTocSheet);
  }

  function openMobileToc() {
    if (!mobileTocSheet || !mobileTocBackdrop) return;
    mobileTocBackdrop.classList.add("is-active");
    mobileTocSheet.classList.add("is-active");
    document.body.classList.add("mobile-toc-open");
    document.body.style.overflow = "hidden";

    // 展开时自动将当前激活的目录项平滑居中显示
    setTimeout(function () {
      const activeItem = mobileTocSheet.querySelector(".seihaku-toc-link.active");
      if (activeItem) {
        activeItem.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 120);
  }

  function closeMobileToc() {
    if (!mobileTocSheet || !mobileTocBackdrop) return;
    mobileTocBackdrop.classList.remove("is-active");
    mobileTocSheet.classList.remove("is-active");
    document.body.classList.remove("mobile-toc-open");
    document.body.style.overflow = "";
  }

  if (mobileTocFab) {
    mobileTocFab.addEventListener("click", openMobileToc);
  }

  if (postMetaTocTrigger) {
    postMetaTocTrigger.addEventListener("click", openMobileToc);
  }

  if (mobileTocCloseBtn) {
    mobileTocCloseBtn.addEventListener("click", closeMobileToc);
  }

  if (mobileTocBackdrop) {
    mobileTocBackdrop.addEventListener("click", closeMobileToc);
  }

  if (mobileTocToTop) {
    mobileTocToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
      closeMobileToc();
    });
  }

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mobileTocSheet && mobileTocSheet.classList.contains("is-active")) {
      closeMobileToc();
    }
  });

  // 移动端抽屉内目录点击跳转：平滑滚动到正文并优雅关闭抽屉
  mobileLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      const href = link.getAttribute("href");
      const targetElem = findHeadingElement(href);
      if (targetElem) {
        e.preventDefault();
        const top = targetElem.getBoundingClientRect().top + window.scrollY - 70;
        closeMobileToc();
        // 留出微小延时让手势抽屉缩回，阅读视角平滑滚动
        setTimeout(function () {
          window.scrollTo({ top: top, behavior: "smooth" });
          if (history.pushState) {
            history.pushState(null, "", href);
          }
        }, 160);
      }
    });
  });

  // 6. 滚动监听优化 (requestAnimationFrame)
  let scrollTicking = false;
  window.addEventListener(
    "scroll",
    function () {
      if (!scrollTicking) {
        window.requestAnimationFrame(function () {
          updateReadingProgress();
          updateTocSpy();
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    },
    { passive: true }
  );

  updateReadingProgress();
  setTimeout(updateTocSpy, 160);

  // 7. 桌面端回到顶部按钮
  const topBtn = document.getElementById("toc-top-btn");
  if (topBtn) {
    topBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

window.initSeihakuTOC = initSeihakuTOC;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSeihakuTOC);
} else {
  initSeihakuTOC();
}
