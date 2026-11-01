/**
 * 🍃 栖白 (Theme Seihaku) - 文档中心交互引擎 (Docs Center Engine)
 * 功能：
 * 1. 文档主界面：项目卡片及分目录大纲即时关键词搜索过滤 (Portal Instant Filter)
 * 2. 文档阅读工作台：左侧细粒度分目录过滤、滚动追踪高亮 (Scrollspy)、移动端抽屉手势
 * 3. 锚点平滑滚动与哈希同步
 */

(function () {
  'use strict';

  function initDocsEngine() {
    const docsContainer = document.querySelector('.seihaku-docs-workstation');
    if (!docsContainer) return;

    // =========================================================================
    // 1. 文档中心主界面交互 (Portal Filter)
    // =========================================================================
    const portalFilterInput = document.getElementById('docs-portal-filter');
    const portalCards = document.querySelectorAll('.doc-portal-card');

    if (portalFilterInput && portalCards.length > 0) {
      portalFilterInput.addEventListener('input', function (e) {
        const query = (e.target.value || '').trim().toLowerCase();
        portalCards.forEach(function (card) {
          const text = (card.textContent || '').toLowerCase();
          const match = !query || text.includes(query);
          card.style.display = match ? 'flex' : 'none';
        });
      });
    }

    // =========================================================================
    // 2. 具体文档工作台交互 (Workstation Engine)
    // =========================================================================
    const filterInput = document.getElementById('docs-filter-input');
    const navItems = document.querySelectorAll('.docs-nav-link');
    const navGroups = document.querySelectorAll('.docs-nav-group');
    const mobileToggle = document.getElementById('docs-mobile-toggle');
    const sidebar = document.getElementById('docs-sidebar');
    const backdrop = document.getElementById('docs-drawer-backdrop');
    const rightAnchors = document.querySelectorAll('.docs-anchor-link');

    // 目录关键词过滤 (Instant Filter)
    if (filterInput) {
      filterInput.addEventListener('input', function (e) {
        const query = (e.target.value || '').trim().toLowerCase();
        navGroups.forEach(function (group) {
          let hasVisibleInGroup = false;
          const links = group.querySelectorAll('.docs-nav-link');
          links.forEach(function (link) {
            const text = (link.textContent || '').toLowerCase();
            const match = !query || text.includes(query);
            const parentItem = link.closest('.docs-nav-item') || link;
            parentItem.style.display = match ? 'block' : 'none';
            if (match) hasVisibleInGroup = true;
          });
          group.style.display = hasVisibleInGroup ? 'block' : 'none';
        });
      });
    }

    // 移动端抽屉导航交互 (Mobile Drawer with GSAP)
    function openDrawer() {
      if (!sidebar) return;
      sidebar.classList.add('is-drawer-open');
      if (backdrop) backdrop.classList.add('is-active');
      document.body.style.overflow = 'hidden';
      if (window.gsap) {
        window.gsap.fromTo(sidebar, { x: -310 }, { x: 0, duration: 0.32, ease: 'power2.out' });
      }
    }

    function closeDrawer() {
      if (!sidebar) return;
      if (window.gsap && sidebar.classList.contains('is-drawer-open')) {
        window.gsap.to(sidebar, {
          x: -310,
          duration: 0.24,
          ease: 'power2.in',
          onComplete: function () {
            sidebar.classList.remove('is-drawer-open');
            sidebar.style.transform = '';
            if (backdrop) backdrop.classList.remove('is-active');
            document.body.style.overflow = '';
          }
        });
      } else {
        sidebar.classList.remove('is-drawer-open');
        if (backdrop) backdrop.classList.remove('is-active');
        document.body.style.overflow = '';
      }
    }

    if (mobileToggle) mobileToggle.addEventListener('click', openDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // 滚动监听高亮章节 (Scrollspy)
    const contentHeadings = Array.from(document.querySelectorAll('.docs-content-body h2[id], .docs-content-body h3[id]'));
    function updateActiveHeading() {
      if (contentHeadings.length === 0) return;
      const scrollPos = window.pageYOffset + 120;
      let currentId = '';

      for (let i = 0; i < contentHeadings.length; i++) {
        const h = contentHeadings[i];
        if (h.offsetTop <= scrollPos) {
          currentId = h.id;
        } else {
          break;
        }
      }

      if (currentId) {
        navItems.forEach(function (item) {
          const href = item.getAttribute('href');
          const isActive = href === '#' + currentId;
          item.classList.toggle('is-active', isActive);
          if (isActive && !item.classList.contains('is-drawer-open')) {
            const parentGroup = item.closest('.docs-nav-group');
            if (parentGroup) parentGroup.style.display = 'block';
          }
        });

        rightAnchors.forEach(function (anchor) {
          const href = anchor.getAttribute('href');
          const isActive = href === '#' + currentId;
          anchor.classList.toggle('is-active', isActive);
        });
      }
    }

    let scrollTimeout = null;
    window.addEventListener('scroll', function () {
      if (!scrollTimeout) {
        scrollTimeout = setTimeout(function () {
          updateActiveHeading();
          scrollTimeout = null;
        }, 60);
      }
    }, { passive: true });

    updateActiveHeading();

    // 点击导航项平滑滚动，并在移动端自动收起抽屉
    const allDocLinks = document.querySelectorAll('.docs-nav-link, .docs-subnav-link, .docs-anchor-link');
    allDocLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          const targetElem = document.getElementById(href.slice(1));
          if (targetElem) {
            e.preventDefault();
            const top = targetElem.getBoundingClientRect().top + window.pageYOffset - 84;
            window.scrollTo({ top: top, behavior: 'smooth' });
            history.pushState(null, '', href);
            if (window.innerWidth <= 960) {
              closeDrawer();
            }
          }
        }
      });
    });
  }

  window.initSeihakuDocs = initDocsEngine;
  document.addEventListener('DOMContentLoaded', initDocsEngine);
})();
