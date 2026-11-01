/**
 * 🍃 栖白 (Theme Seihaku) - 代码块 macOS 控制微晶圆点、过长代码折叠与聚焦放大视窗
 * 功能：macOS 三色圆点、语言居中、一键复制、代码自动换行、过长折叠展开（GSAP 弹簧物理缓动）、全屏放大聚焦 (Body Portal)
 */

document.addEventListener("DOMContentLoaded", function () {
  let fullscreenBackdrop = document.querySelector(".code-fullscreen-backdrop");
  if (!fullscreenBackdrop) {
    fullscreenBackdrop = document.createElement("div");
    fullscreenBackdrop.className = "code-fullscreen-backdrop";
    document.body.appendChild(fullscreenBackdrop);
  }

  let currentPlaceholder = null;
  let currentlyZoomedBlock = null;
  let wasCollapsedBeforeZoom = false;
  let isExitingZoom = false;

  const i18n = window.__SEIHAKU_I18N__ || {};
  const txtCopy = i18n.codeCopy || "复制";
  const txtCopied = i18n.codeCopied || "已复制";
  const txtZoom = i18n.codeZoom || "放大";
  const txtExpand = i18n.codeExpand || "展开全部代码";
  const txtCollapse = i18n.codeCollapse || "收起代码";
  const txtWrap = i18n.codeWrap || "自动换行";
  const txtUnwrap = i18n.codeUnwrap || "取消换行";

  function restoreZoomedBlock() {
    if (currentlyZoomedBlock && currentPlaceholder && currentPlaceholder.parentNode) {
      const blockToRestore = currentlyZoomedBlock;

      // 1. 彻底清除 GSAP 遗留的动画属性，避免复原后因 transform 残留导致偏位
      if (window.gsap) {
        window.gsap.killTweensOf(blockToRestore);
        window.gsap.set(blockToRestore, { clearProps: "all" });
      }

      // 2. 移除放大状态并重置为正常文档流样式
      blockToRestore.classList.remove("is-code-zoomed");
      blockToRestore.style.transform = "";
      blockToRestore.style.opacity = "";
      blockToRestore.style.scale = "";
      blockToRestore.style.translate = "";
      blockToRestore.style.rotate = "";
      blockToRestore.style.position = "";
      blockToRestore.style.top = "";
      blockToRestore.style.right = "";
      blockToRestore.style.bottom = "";
      blockToRestore.style.left = "";
      blockToRestore.style.inset = "";
      blockToRestore.style.margin = "";
      blockToRestore.style.width = "";
      blockToRestore.style.height = "";
      blockToRestore.style.maxWidth = "";
      blockToRestore.style.maxHeight = "";
      blockToRestore.style.zIndex = "";

      // 3. 复原到原始占位节点位置，完全无缝还原
      currentPlaceholder.parentNode.insertBefore(blockToRestore, currentPlaceholder);
      currentPlaceholder.remove();
      currentPlaceholder = null;

      const fsBtn = blockToRestore.querySelector(".code-mac-fullscreen-btn");
      if (fsBtn) {
        fsBtn.innerHTML = `
          <svg class="fs-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <span class="fs-label">${txtZoom}</span>
        `;
        fsBtn.setAttribute("title", txtZoom);
      }

      // 4. 恢复缩放前的限高折叠状态
      const scrollWrap = blockToRestore.querySelector(".code-scroll-wrapper");
      if (scrollWrap) {
        if (wasCollapsedBeforeZoom && blockToRestore.classList.contains("is-code-collapsed")) {
          const codeCfg = (window.__SEIHAKU_FEATURES__ && window.__SEIHAKU_FEATURES__.code_block) || {};
          const hLimit = typeof codeCfg.height_limit === "number" ? codeCfg.height_limit : 380;
          scrollWrap.style.maxHeight = hLimit + "px";
          scrollWrap.style.overflowY = "hidden";
        } else {
          scrollWrap.style.maxHeight = "";
          scrollWrap.style.overflowY = "";
        }
      }

      currentlyZoomedBlock = null;
    } else {
      const activeBlocks = document.querySelectorAll(".code-mac-enhanced.is-code-zoomed");
      activeBlocks.forEach(function (b) {
        if (window.gsap) {
          window.gsap.killTweensOf(b);
          window.gsap.set(b, { clearProps: "all" });
        }
        b.classList.remove("is-code-zoomed");
        b.style.transform = "";
        b.style.opacity = "";
      });
      currentlyZoomedBlock = null;
    }
    fullscreenBackdrop.classList.remove("is-active");
    document.body.style.overflow = "";
    isExitingZoom = false;
  }

  function exitAllCodeZoom() {
    if (isExitingZoom) return;
    if (!currentlyZoomedBlock) {
      restoreZoomedBlock();
      return;
    }

    isExitingZoom = true;
    const blockToExit = currentlyZoomedBlock;
    if (window.gsap) {
      window.gsap.to(blockToExit, {
        scale: 0.96,
        opacity: 0,
        duration: 0.18,
        ease: "power2.in",
        onComplete: function () {
          restoreZoomedBlock();
        }
      });
    } else {
      restoreZoomedBlock();
    }
  }

  fullscreenBackdrop.addEventListener("click", exitAllCodeZoom);
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      exitAllCodeZoom();
    }
  });

  function setupCodeBlock(block, isHighlight) {
    if (block.dataset.macEnhanced === "true") return;
    block.dataset.macEnhanced = "true";
    block.classList.add("code-mac-enhanced");

    const codeCfg = (window.__SEIHAKU_FEATURES__ && window.__SEIHAKU_FEATURES__.code_block) || {};
    const showMacDots = codeCfg.mac_dots !== false;
    const showCopyBtn = codeCfg.copy_button !== false;
    const enableWordWrap = codeCfg.word_wrap !== false;
    const heightLimit = typeof codeCfg.height_limit === "number" ? codeCfg.height_limit : 380;

    // 检测语言
    let lang = "";
    if (isHighlight) {
      const classNames = block.className.split(/\s+/);
      for (let cls of classNames) {
        if (cls && cls !== "highlight" && !cls.startsWith("code-mac")) {
          lang = cls.toUpperCase();
          break;
        }
      }
    } else {
      const codeElem = block.querySelector("code");
      if (codeElem && codeElem.className) {
        const match = codeElem.className.match(/(?:lang|language)-(\w+)/);
        if (match) lang = match[1].toUpperCase();
      }
    }
    if (!lang) lang = "CODE";

    // 创建 macOS 风格顶栏
    const header = document.createElement("div");
    header.className = "code-mac-header";

    // 1. 左侧三色微晶圆点
    const dots = document.createElement("div");
    dots.className = "code-mac-dots";
    dots.innerHTML = `
      <span class="mac-dot dot-red dot-close" title="双击关闭放大"></span>
      <span class="mac-dot dot-yellow dot-min"></span>
      <span class="mac-dot dot-green dot-max" title="点击放大聚焦"></span>
    `;

    // 2. 中间语言名称
    const langLabel = document.createElement("div");
    langLabel.className = "code-mac-lang font-mono";
    langLabel.textContent = lang;

    // 3. 右侧操作按钮组
    const actions = document.createElement("div");
    actions.className = "code-mac-actions";

    // 3.1 自动换行切换按钮
    let wrapBtn = null;
    if (enableWordWrap) {
      wrapBtn = document.createElement("button");
      wrapBtn.className = "code-mac-btn code-mac-wrap-btn";
      wrapBtn.type = "button";
      wrapBtn.setAttribute("title", txtWrap);
      wrapBtn.innerHTML = `
        <svg class="wrap-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M3 12h15a3 3 0 0 1 0 6h-4"></path>
          <polyline points="16 16 14 18 16 20"></polyline>
        </svg>
        <span class="wrap-label">${txtWrap}</span>
      `;

      wrapBtn.addEventListener("click", function () {
        const targetContainer = isHighlight ? block : (block.closest(".code-pre-container") || block);
        const isWrapped = targetContainer.classList.toggle("is-word-wrapped");
        wrapBtn.classList.toggle("is-active", isWrapped);
        wrapBtn.setAttribute("title", isWrapped ? txtUnwrap : txtWrap);
        const labelEl = wrapBtn.querySelector(".wrap-label");
        if (labelEl) labelEl.textContent = isWrapped ? txtUnwrap : txtWrap;

        if (window.gsap) {
          window.gsap.fromTo(wrapBtn, { scale: 0.88 }, { scale: 1, duration: 0.35, ease: "back.out(2)" });
        }
      });
      actions.appendChild(wrapBtn);
    }

    // 3.2 放大聚焦按钮
    const fsBtn = document.createElement("button");
    fsBtn.className = "code-mac-btn code-mac-fullscreen-btn";
    fsBtn.type = "button";
    fsBtn.setAttribute("title", txtZoom);
    fsBtn.innerHTML = `
      <svg class="fs-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"></polyline>
        <polyline points="9 21 3 21 3 15"></polyline>
        <line x1="21" y1="3" x2="14" y2="10"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
      <span class="fs-label">${txtZoom}</span>
    `;

    function toggleZoom() {
      const targetBlock = isHighlight ? block : (block.closest(".code-pre-container") || block);
      const willZoom = !targetBlock.classList.contains("is-code-zoomed");
      if (willZoom) {
        if (currentlyZoomedBlock) {
          exitAllCodeZoom();
        }
        wasCollapsedBeforeZoom = targetBlock.classList.contains("is-code-collapsed");

        // 使用保留原始高度的占位块，防止底层页面高度崩塌和滚动位置偏位
        const origHeight = targetBlock.offsetHeight;
        currentPlaceholder = document.createElement("div");
        currentPlaceholder.className = "code-zoom-placeholder";
        currentPlaceholder.style.width = "100%";
        currentPlaceholder.style.height = origHeight > 0 ? (origHeight + "px") : "auto";
        currentPlaceholder.style.visibility = "hidden";
        currentPlaceholder.style.pointerEvents = "none";
        targetBlock.parentNode.insertBefore(currentPlaceholder, targetBlock);
        document.body.appendChild(targetBlock);

        targetBlock.classList.add("is-code-zoomed");
        fullscreenBackdrop.classList.add("is-active");
        document.body.style.overflow = "hidden";
        currentlyZoomedBlock = targetBlock;

        const scrollWrap = targetBlock.querySelector(".code-scroll-wrapper");
        if (scrollWrap) {
          scrollWrap.style.maxHeight = "none";
          scrollWrap.style.overflowY = "auto";
        }

        fsBtn.innerHTML = `
          <svg class="fs-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <span class="fs-label">${txtZoom}</span>
        `;
        fsBtn.setAttribute("title", txtZoom);

        if (window.gsap) {
          window.gsap.killTweensOf(targetBlock);
          window.gsap.fromTo(targetBlock, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.28, ease: "power2.out" });
        }
      } else {
        exitAllCodeZoom();
      }
    }

    fsBtn.addEventListener("click", toggleZoom);
    const greenDot = dots.querySelector(".dot-max");
    if (greenDot) greenDot.addEventListener("click", toggleZoom);
    const redDot = dots.querySelector(".dot-close");
    if (redDot) redDot.addEventListener("click", exitAllCodeZoom);

    // 3.3 复制按钮
    const copyBtn = document.createElement("button");
    copyBtn.className = "code-mac-btn code-mac-copy-btn";
    copyBtn.type = "button";
    copyBtn.setAttribute("title", txtCopy);
    copyBtn.innerHTML = `
      <svg class="copy-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span class="copy-label">${txtCopy}</span>
    `;

    copyBtn.addEventListener("click", function () {
      let codeText = "";
      if (isHighlight) {
        const codeTd = block.querySelector("td.code");
        codeText = codeTd ? codeTd.innerText : block.innerText;
      } else {
        const codeElem = block.querySelector("code");
        codeText = codeElem ? codeElem.innerText : block.innerText;
      }

      navigator.clipboard.writeText(codeText).then(function () {
        copyBtn.classList.add("is-copied");
        copyBtn.innerHTML = `
          <svg class="copy-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span class="copy-label" style="color: #22c55e;">${txtCopied}</span>
        `;
        if (window.gsap) {
          window.gsap.fromTo(copyBtn, { scale: 0.88 }, { scale: 1, duration: 0.35, ease: "back.out(2)" });
        }
        setTimeout(function () {
          copyBtn.classList.remove("is-copied");
          copyBtn.innerHTML = `
            <svg class="copy-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="copy-label">${txtCopy}</span>
          `;
        }, 2200);
      });
    });

    actions.appendChild(fsBtn);
    if (showCopyBtn) {
      actions.appendChild(copyBtn);
    }

    if (showMacDots) {
      header.appendChild(dots);
    }
    header.appendChild(langLabel);
    header.appendChild(actions);

    // 内部包裹滚动区
    const scrollWrapper = document.createElement("div");
    scrollWrapper.className = "code-scroll-wrapper";

    let mainContainer = block;

    if (isHighlight) {
      const table = block.querySelector("table");
      if (table) {
        block.insertBefore(header, table);
        scrollWrapper.appendChild(table);
        block.appendChild(scrollWrapper);
      } else {
        block.insertBefore(header, block.firstChild);
      }
    } else {
      const preElem = block.tagName === "PRE" ? block : block.querySelector("pre");
      if (preElem) {
        const container = document.createElement("div");
        container.className = "code-pre-container code-mac-enhanced";
        container.dataset.macEnhanced = "true";
        preElem.parentNode.insertBefore(container, preElem);
        container.appendChild(header);
        scrollWrapper.appendChild(preElem);
        container.appendChild(scrollWrapper);
        mainContainer = container;
      }
    }

    // 4. 过长代码块限高折叠与展开动效 (GSAP 弹簧物理缓动与渐变毛玻璃遮罩)
    if (heightLimit > 0) {
      requestAnimationFrame(function () {
        const scrollH = scrollWrapper.scrollHeight;
        if (scrollH > heightLimit + 48) {
          mainContainer.classList.add("is-code-collapsed");
          scrollWrapper.style.maxHeight = heightLimit + "px";
          scrollWrapper.style.overflowY = "hidden";

          // 统计代码行数
          let lineCount = 0;
          if (isHighlight) {
            lineCount = block.querySelectorAll("td.gutter .line").length;
          }
          if (!lineCount) {
            const rawTxt = isHighlight ? block.innerText : scrollWrapper.innerText;
            lineCount = (rawTxt || "").split("\n").length;
          }
          const expandLabel = lineCount > 1 ? `${txtExpand} (${lineCount} 行)` : txtExpand;

          // 创建底部渐变毛玻璃遮罩及展开按钮
          const mask = document.createElement("div");
          mask.className = "code-collapse-mask";
          mask.innerHTML = `
            <button type="button" class="code-expand-btn">
              <svg class="expand-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <span class="expand-text">${expandLabel}</span>
            </button>
          `;

          // 创建展开后的底部收起条
          const footerBar = document.createElement("div");
          footerBar.className = "code-collapse-footer-bar";
          footerBar.style.display = "none";
          footerBar.innerHTML = `
            <button type="button" class="code-collapse-btn">
              <svg class="collapse-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
              <span class="collapse-text">${txtCollapse}</span>
            </button>
          `;

          mainContainer.appendChild(mask);
          mainContainer.appendChild(footerBar);

          const expandBtn = mask.querySelector(".code-expand-btn");
          const collapseBtn = footerBar.querySelector(".code-collapse-btn");

          expandBtn.addEventListener("click", function () {
            const fullHeight = scrollWrapper.scrollHeight;
            if (window.gsap) {
              window.gsap.to(scrollWrapper, {
                maxHeight: fullHeight + 20,
                duration: 0.42,
                ease: "power2.out",
                onComplete: function () {
                  scrollWrapper.style.maxHeight = "none";
                  scrollWrapper.style.overflowY = "visible";
                }
              });
              window.gsap.to(mask, {
                opacity: 0,
                duration: 0.22,
                ease: "power1.out",
                onComplete: function () {
                  mask.style.display = "none";
                  footerBar.style.display = "flex";
                  window.gsap.fromTo(footerBar, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" });
                }
              });
            } else {
              scrollWrapper.style.maxHeight = "none";
              scrollWrapper.style.overflowY = "visible";
              mask.style.display = "none";
              footerBar.style.display = "flex";
            }
            mainContainer.classList.remove("is-code-collapsed");
            mainContainer.classList.add("is-code-expanded");
          });

          collapseBtn.addEventListener("click", function () {
            const rect = mainContainer.getBoundingClientRect();
            if (rect.top < 80) {
              window.scrollTo({
                top: window.pageYOffset + rect.top - 80,
                behavior: "smooth"
              });
            }
            footerBar.style.display = "none";
            mask.style.display = "flex";
            scrollWrapper.style.overflowY = "hidden";
            if (window.gsap) {
              window.gsap.fromTo(mask, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.out" });
              window.gsap.to(scrollWrapper, {
                maxHeight: heightLimit + "px",
                duration: 0.38,
                ease: "power2.inOut",
                onComplete: function () {
                  mainContainer.classList.remove("is-code-expanded");
                  mainContainer.classList.add("is-code-collapsed");
                }
              });
            } else {
              scrollWrapper.style.maxHeight = heightLimit + "px";
              mainContainer.classList.remove("is-code-expanded");
              mainContainer.classList.add("is-code-collapsed");
            }
          });
        }
      });
    }

  }

  // 初始化指定容器或全站所有代码块（支持动态渲染手记及 PJAX 切换调用）
  window.initSeihakuCodeBlocks = function (root) {
    const scope = root || document;
    scope.querySelectorAll("figure.highlight").forEach((b) => setupCodeBlock(b, true));
    scope.querySelectorAll(".markdown-body pre").forEach((b) => {
      if (!b.closest("figure.highlight") && !b.closest(".code-pre-container")) {
        setupCodeBlock(b, false);
      }
    });
  };

  window.initSeihakuCodeBlocks(document);

  // 测试环境自动化聚焦支持
  if (window.location.hash === "#test-zoom") {
    setTimeout(function () {
      const firstZoomBtn = document.querySelector(".code-mac-fullscreen-btn");
      if (firstZoomBtn) firstZoomBtn.click();
    }, 350);
  }
});
