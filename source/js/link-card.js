/**
 * 🍃 栖白 (Theme Seihaku) - 链接卡片交互与动态补全客户端脚本
 */

(function () {
  'use strict';

  var DEFAULT_SVG_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYThhMjlhIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0iTTEyIDJhMTQuNSAxNC41IDAgMCAwIDAgMjAgMTQuNSAxNC41IDAgMCAwIDAtMjAiLz48cGF0aCBkPSJNMiAxMmgyMCIvPjwvc3ZnPg==';

  function initLinkCards() {
    var cards = document.querySelectorAll('.seihaku-link-card');
    if (!cards || !cards.length) return;

    cards.forEach(function (card) {
      if (card.__seihaku_initialized) return;
      card.__seihaku_initialized = true;

      // 1. 图标与封面容灾处理
      var favicon = card.querySelector('.link-card-favicon');
      if (favicon) {
        favicon.addEventListener('error', function () {
          this.src = DEFAULT_SVG_ICON;
        });
      }

      var coverImg = card.querySelector('.link-card-cover');
      if (coverImg) {
        coverImg.addEventListener('error', function () {
          var box = card.querySelector('.link-card-cover-box');
          if (box) box.style.display = 'none';
        });
      }

      // 2. 针对构建期未抓取成功的卡片进行轻量客户端异步增强
      var isPending = card.getAttribute('data-link-card-pending') === 'true';
      var targetUrl = card.getAttribute('data-url');

      if (isPending && targetUrl && targetUrl.startsWith('http')) {
        hydratePendingCard(card, targetUrl);
      }
    });
  }

  function hydratePendingCard(card, targetUrl) {
    // 优先读取会话缓存，防止重复请求
    var cacheKey = 'seihaku_card_meta_' + targetUrl;
    var cached = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    } catch (e) {}

    if (cached) {
      applyMetadataToCard(card, cached);
      return;
    }

    // 尝试轻量异步解析（若离线或不可达则优雅保持静态兜底）
    if (!navigator.onLine) return;

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 4000);

    // 使用开放元数据代理端点探测
    var apiUrl = 'https://api.microlink.io?url=' + encodeURIComponent(targetUrl);

    fetch(apiUrl, { signal: controller.signal })
      .then(function (res) {
        clearTimeout(timeoutId);
        return res.ok ? res.json() : null;
      })
      .then(function (resData) {
        if (!resData || resData.status !== 'success' || !resData.data) return;
        var meta = resData.data;
        var result = {
          title: meta.title,
          desc: meta.description,
          icon: meta.logo ? meta.logo.url : null,
          cover: meta.image ? meta.image.url : null
        };

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (e) {}

        applyMetadataToCard(card, result);
      })
      .catch(function () {
        // 网络超时或失败时保持当前默认域名卡片，零红屏报错
      });
  }

  function applyMetadataToCard(card, meta) {
    if (!card || !meta) return;

    card.classList.add('hydrated');
    card.removeAttribute('data-link-card-pending');

    if (meta.title) {
      var titleEl = card.querySelector('.link-card-title');
      if (titleEl) titleEl.textContent = meta.title;
    }

    if (meta.desc) {
      var descEl = card.querySelector('.link-card-desc');
      if (descEl) {
        descEl.textContent = meta.desc;
      } else {
        var bodyEl = card.querySelector('.link-card-body');
        if (bodyEl) {
          var newDesc = document.createElement('div');
          newDesc.className = 'link-card-desc';
          newDesc.textContent = meta.desc;
          bodyEl.appendChild(newDesc);
        }
      }
    }

    if (meta.icon) {
      var fav = card.querySelector('.link-card-favicon');
      if (fav) fav.src = meta.icon;
    }

    if (meta.cover && !card.querySelector('.link-card-cover-box')) {
      var coverBox = document.createElement('div');
      coverBox.className = 'link-card-cover-box';
      var img = document.createElement('img');
      img.className = 'link-card-cover';
      img.src = meta.cover;
      img.alt = meta.title || '';
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        coverBox.style.display = 'none';
      });
      coverBox.appendChild(img);

      var actionEl = card.querySelector('.link-card-action');
      if (actionEl) {
        card.insertBefore(coverBox, actionEl);
      } else {
        card.appendChild(coverBox);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLinkCards);
  } else {
    initLinkCards();
  }

  // PJAX 流转无缝兼容
  document.addEventListener('pjax:success', initLinkCards);
  document.addEventListener('pjax:complete', initLinkCards);

  window.initSeihakuLinkCards = initLinkCards;
})();
