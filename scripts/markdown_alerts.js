/**
 * 🍃 栖白 (Theme Seihaku) - 构建期 GitHub 风格 Alert 提示块解析器
 * 将 > [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION] 在构建期渲染为语义化 HTML，
 * 消除首屏闪烁 (FOUC)，提升 SEO 表现与初次加载性能。
 */

'use strict';

const iconMap = {
  note: '<i class="fas fa-info-circle"></i>',
  tip: '<i class="far fa-lightbulb"></i>',
  important: '<i class="fas fa-exclamation-circle"></i>',
  warning: '<i class="fas fa-exclamation-triangle"></i>',
  caution: '<i class="fas fa-fire"></i>'
};

hexo.extend.filter.register('after_post_render', function (data) {
  if (!data.content) return data;

  // 匹配形如 <blockquote><p>[!NOTE]<br> 或者 <blockquote>\n<p>[!NOTE] 的块级引用
  data.content = data.content.replace(
    /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*<br\s*\/?>)?([\s\S]*?)<\/blockquote>/gi,
    function (match, typeRaw, body) {
      const type = typeRaw.toLowerCase();
      const icon = iconMap[type] || '<i class="fas fa-info-circle"></i>';
      const label = typeRaw.toUpperCase();

      return `<blockquote class="markdown-alert markdown-alert-${type}" data-alert-parsed="true">
        <p><span class="alert-title font-mono">${icon} <span>${label}</span></span>${body}
      </blockquote>`;
    }
  );

  return data;
});
