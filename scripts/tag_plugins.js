/**
 * 🍃 栖白 (Theme Seihaku) - 富文本标签外挂体系 (Tag Plugins)
 * 包含：
 * 1. 分栏选项卡 ({% tabs %})
 * 2. 手风琴折叠框 ({% folding %})
 * 3. 行内毛玻璃遮罩 ({% blur %} / {% psw %})
 * 4. 多图网格画廊 ({% gallery %})
 */

'use strict';

// 1. 分栏选项卡 (Tabs)
// 用法：
// {% tabs my_tabs %}
// <!-- tab Python -->
// print("Hello World")
// <!-- endtab -->
// <!-- tab Rust -->
// println!("Hello World");
// <!-- endtab -->
// {% endtabs %}
hexo.extend.tag.register('tabs', function (args, content) {
  const tabBlockId = (args[0] || 'tab-' + Math.random().toString(36).slice(2, 8)).trim();
  const rawTabs = content.split(/<!--\s*tab\s*(.*?)\s*-->/g);

  const tabsList = [];
  for (let i = 1; i < rawTabs.length; i += 2) {
    const title = (rawTabs[i] || 'Tab').trim();
    const rawContent = (rawTabs[i + 1] || '').replace(/<!--\s*endtab\s*-->/g, '').trim();
    const renderedContent = hexo.render.renderSync({ text: rawContent, engine: 'markdown' });
    tabsList.push({
      title: title,
      content: renderedContent
    });
  }

  if (tabsList.length === 0) {
    return content;
  }

  let navHtml = '';
  let contentHtml = '';

  tabsList.forEach(function (tab, idx) {
    const paneId = `${tabBlockId}-${idx}`;
    const activeClass = idx === 0 ? ' is-active' : '';
    navHtml += `<button type="button" class="seihaku-tab-btn font-mono${activeClass}" data-target="${paneId}">${tab.title}</button>`;
    contentHtml += `<div class="seihaku-tab-pane${activeClass}" id="${paneId}">${tab.content}</div>`;
  });

  return `<div class="seihaku-tabs" id="${tabBlockId}">
    <div class="seihaku-tabs-nav">${navHtml}</div>
    <div class="seihaku-tabs-content">${contentHtml}</div>
  </div>`;
}, { ends: true });


// 2. 手风琴折叠框 (Folding)
// 用法：
// {% folding [title] %}
// 内容...
// {% endfolding %}
// 或带颜色:
// {% folding blue [title] %}
// 内容...
// {% endfolding %}
hexo.extend.tag.register('folding', function (args, content) {
  let color = 'default';
  let title = '点击展开查看';

  if (args.length === 1) {
    title = args[0];
  } else if (args.length >= 2) {
    const validColors = ['blue', 'green', 'yellow', 'red', 'purple', 'cyan'];
    if (validColors.includes(args[0].toLowerCase())) {
      color = args[0].toLowerCase();
      title = args.slice(1).join(' ');
    } else {
      title = args.join(' ');
    }
  }

  const renderedContent = hexo.render.renderSync({ text: content.trim(), engine: 'markdown' });

  return `<details class="seihaku-folding folding-${color}">
    <summary class="folding-title font-sans">
      <span class="folding-arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
      <span class="folding-label">${title}</span>
    </summary>
    <div class="folding-content">${renderedContent}</div>
  </details>`;
}, { ends: true });


// 3. 行内毛玻璃/黑幕遮罩 ({% blur 文本内容 %} 或 {% psw 文本内容 %})
// 鼠标悬停或点击时消除虚化，还原文字
hexo.extend.tag.register('blur', function (args) {
  const text = args.join(' ');
  return `<span class="seihaku-blur-text" title="点击或鼠标悬浮显现">${text}</span>`;
});

hexo.extend.tag.register('psw', function (args) {
  const text = args.join(' ');
  return `<span class="seihaku-blur-text" title="点击或鼠标悬浮显现">${text}</span>`;
});


// 4. 文章内多图网格画廊 ({% gallery [columns] %})
// 用法：
// {% gallery 3 %}
// ![](img1.jpg)
// ![](img2.jpg)
// {% endgallery %}
hexo.extend.tag.register('gallery', function (args, content) {
  const cols = parseInt(args[0], 10) || 3;
  const renderedContent = hexo.render.renderSync({ text: content.trim(), engine: 'markdown' });
  return `<div class="seihaku-gallery gallery-cols-${cols}">${renderedContent}</div>`;
}, { ends: true });
