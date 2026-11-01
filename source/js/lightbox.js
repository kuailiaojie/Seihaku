/**
 * 🍃 栖白 (Theme Seihaku) - 原生流体画廊与正文图片相册灯箱 (Fluid Album Lightbox)
 * 特性：
 * 1. 点击图片全屏平滑放大，支持多图连续相册流转 (上一张/下一张)
 * 2. 键盘 ← / → 键切换与移动端左右滑动手势
 * 3. GSAP 物理阻尼平滑换图与相册索引指示器 (X / Y)
 * 4. 自动正文图注渲染 (Auto Figcaption based on img.alt)
 */

(function () {
  'use strict';

  let currentGallery = [];
  let currentIndex = 0;

  function initLightbox() {
    let backdrop = document.getElementById("seihaku-lightbox-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "seihaku-lightbox-backdrop";
      backdrop.className = "seihaku-lightbox-backdrop";
      backdrop.innerHTML = `
        <div class="lightbox-content-box">
          <img id="seihaku-lightbox-img" class="lightbox-img" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="Zoomed image">
          <div id="seihaku-lightbox-caption" class="lightbox-caption font-serif"></div>
          <div id="seihaku-lightbox-counter" class="lightbox-counter font-mono"></div>
        </div>
        <button type="button" class="lightbox-close-btn" id="lightbox-close-btn" aria-label="关闭">&times;</button>
        <button type="button" class="lightbox-nav-btn lightbox-prev-btn" id="lightbox-prev-btn" aria-label="上一张">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button type="button" class="lightbox-nav-btn lightbox-next-btn" id="lightbox-next-btn" aria-label="下一张">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      `;
      document.body.appendChild(backdrop);

      function closeLightbox() {
        backdrop.classList.remove("is-active");
        document.body.style.overflow = "";
      }

      backdrop.addEventListener("click", function (e) {
        const modalImg = document.getElementById("seihaku-lightbox-img");
        const prevBtn = document.getElementById("lightbox-prev-btn");
        const nextBtn = document.getElementById("lightbox-next-btn");
        if (e.target !== modalImg && !prevBtn.contains(e.target) && !nextBtn.contains(e.target)) {
          closeLightbox();
        }
      });

      const closeBtn = document.getElementById("lightbox-close-btn");
      if (closeBtn) closeBtn.addEventListener("click", closeLightbox);

      const prevBtn = document.getElementById("lightbox-prev-btn");
      const nextBtn = document.getElementById("lightbox-next-btn");

      if (prevBtn) {
        prevBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          stepImage(-1);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          stepImage(1);
        });
      }

      window.addEventListener("keydown", function (e) {
        if (!backdrop.classList.contains("is-active")) return;
        if (e.key === "Escape") {
          closeLightbox();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          stepImage(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          stepImage(1);
        }
      });

      // 移动端手势滑动监听
      let touchStartX = 0;
      backdrop.addEventListener("touchstart", function (e) {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
        }
      }, { passive: true });

      backdrop.addEventListener("touchend", function (e) {
        if (e.changedTouches.length === 1) {
          const touchEndX = e.changedTouches[0].clientX;
          const diff = touchStartX - touchEndX;
          if (Math.abs(diff) > 45) {
            if (diff > 0) stepImage(1); // 左滑 -> 下一张
            else stepImage(-1); // 右滑 -> 上一张
          }
        }
      }, { passive: true });
    }

    const modalImg = document.getElementById("seihaku-lightbox-img");
    const modalCap = document.getElementById("seihaku-lightbox-caption");
    const counterEl = document.getElementById("seihaku-lightbox-counter");
    const prevBtn = document.getElementById("lightbox-prev-btn");
    const nextBtn = document.getElementById("lightbox-next-btn");

    function renderActiveImage() {
      if (!currentGallery.length || !modalImg) return;
      const cur = currentGallery[currentIndex];
      modalImg.src = cur.src;
      if (modalCap) modalCap.textContent = cur.alt || "";
      if (counterEl) {
        if (currentGallery.length > 1) {
          counterEl.textContent = `${currentIndex + 1} / ${currentGallery.length}`;
          counterEl.style.display = "block";
        } else {
          counterEl.style.display = "none";
        }
      }

      if (prevBtn && nextBtn) {
        const multi = currentGallery.length > 1;
        prevBtn.style.display = multi ? "flex" : "none";
        nextBtn.style.display = multi ? "flex" : "none";
      }

      if (window.gsap) {
        window.gsap.fromTo(modalImg, { opacity: 0.35, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" });
      }
    }

    function stepImage(dir) {
      if (!currentGallery.length) return;
      currentIndex = (currentIndex + dir + currentGallery.length) % currentGallery.length;
      renderActiveImage();
    }

    // 绑定 Markdown 正文图片与画廊相片
    const targets = Array.from(document.querySelectorAll(".markdown-body img:not(.post-cover-image), .photo-card img, .seihaku-gallery img"));
    currentGallery = targets;

    targets.forEach(function (img, idx) {
      // 自动注入图注 (Figcaption)
      if (img.alt && !img.dataset.captionRendered && img.closest(".markdown-body") && !img.closest("figure")) {
        img.dataset.captionRendered = "true";
        const cap = document.createElement("figcaption");
        cap.className = "image-caption font-serif";
        cap.textContent = img.alt;
        if (img.nextSibling) {
          img.parentNode.insertBefore(cap, img.nextSibling);
        } else {
          img.parentNode.appendChild(cap);
        }
      }

      if (img.dataset.lightboxBound) return;
      img.dataset.lightboxBound = "true";
      img.style.cursor = "zoom-in";

      img.addEventListener("click", function (e) {
        e.stopPropagation();
        currentIndex = idx;
        renderActiveImage();
        backdrop.classList.add("is-active");
        document.body.style.overflow = "hidden";
      });
    });
  }

  window.initSeihakuLightbox = initLightbox;
  document.addEventListener("DOMContentLoaded", initLightbox);
})();
