/**
 * 🍃 栖白 (Theme Seihaku) - 静态输出全向相对路径与离线浏览增强过滤器
 * 目标：实现 public/ 生成产物无论在标准 HTTP 服务器、子路径部署 (/blog/)，
 * 还是双击以 file:/// 协议在本地浏览器中直接使用，均能 100% 正常流转、无死链、无 404、无样式与脚本缺失。
 */

'use strict';

const path = require('path');

hexo.extend.filter.register('after_render:html', function (html, data) {
  if (!html || !data || !data.path) return html;

  // 默认开启全向相对路径，保障标准服务器、子目录部署 (/blog/) 与离线双击 (file:///) 100% 正常流转
  const theme = hexo.theme.config || {};
  const feat = theme.features || {};
  if (feat.offline_file_protocol === false) {
    return html;
  }

  // 仅针对 HTML 页面文件进行后处理
  const pagePath = data.path.replace(/\\/g, '/');
  if (!pagePath.endsWith('.html')) return html;

  // 保护 pre 和 code 块，防止技术文章示例代码被误替换
  const codeBlocks = [];
  html = html.replace(/<pre[\s\S]*?<\/pre>/gi, (match) => {
    codeBlocks.push(match);
    return `<!--__SEIHAKU_CODE_BLOCK_${codeBlocks.length - 1}__-->`;
  });

  const dir = path.posix.dirname(pagePath);
  const depth = (dir === '.' || dir === '') ? 0 : dir.split('/').filter(Boolean).length;
  const toRoot = depth === 0 ? '' : '../'.repeat(depth);

  // 1. 注入站点相对根元数据 <meta name="site-root">
  if (!html.includes('name="site-root"')) {
    html = html.replace(/<head[^>]*>/i, '$&\n  <meta name="site-root" content="' + toRoot + '">');
  }

  const isExternal = (u) => /^([a-z]+:|\/\/|#|javascript:|data:)/i.test(u);
  const hasExt = (u) => /\.[a-z0-9]+$/i.test(u.split('?')[0].split('#')[0]);

  function fixRouteUrl(url) {
    if (!url || isExternal(url)) return url;
    let [main, suffix] = url.split(/([?#].*)/s);
    suffix = suffix || '';

    if (main.startsWith('/')) {
      const clean = main.replace(/^\/+/, '');
      if (!clean) {
        return (toRoot ? toRoot + 'index.html' : 'index.html') + suffix;
      }
      if (hasExt(clean)) {
        return (toRoot + clean) + suffix;
      }
      const dirClean = clean.replace(/\/+$/, '');
      return (toRoot + dirClean + '/index.html') + suffix;
    } else {
      if (!hasExt(main)) {
        const dirClean = main.replace(/\/+$/, '');
        return (dirClean + '/index.html') + suffix;
      }
      return url;
    }
  }

  function fixAssetUrl(url) {
    if (!url || isExternal(url)) return url;
    if (url.startsWith('/')) {
      return toRoot + url.replace(/^\/+/, '');
    }
    return url;
  }

  // Rewrite a tags href
  html = html.replace(/<a\b([^>]*?)\bhref=(["'])([^"']+)\2([^>]*)>/gi, (m, pre, q, href, post) => {
    return '<a' + pre + 'href=' + q + fixRouteUrl(href) + q + post + '>';
  });

  // Rewrite link tags href (css, favicon, feeds)
  html = html.replace(/<link\b([^>]*?)\bhref=(["'])([^"']+)\2([^>]*)>/gi, (m, pre, q, href, post) => {
    return '<link' + pre + 'href=' + q + fixAssetUrl(href) + q + post + '>';
  });

  // Rewrite src on img, script, iframe, audio, video, source tags
  html = html.replace(/<(img|script|iframe|audio|video|source)\b([^>]*?)\bsrc=(["'])([^"']+)\3([^>]*)>/gi, (m, tag, pre, q, src, post) => {
    return '<' + tag + pre + 'src=' + q + fixAssetUrl(src) + q + post + '>';
  });

  // Rewrite onerror="this.src='/...'"
  html = html.replace(/onerror=(["'])this\.src=['"]\/([^'"]+)['"]\1/gi, (m, q, p) => {
    return 'onerror=' + q + 'this.src=\'' + toRoot + p + '\'' + q;
  });

  // Rewrite style="background-image: url('/...')"
  html = html.replace(/url\((['"]?)\/([^'")]+)\1\)/gi, (m, q, p) => {
    return 'url(' + (toRoot + p) + ')';
  });

  // Rewrite searchUrl in inline script: "searchUrl":"/search.json"
  html = html.replace(/"searchUrl":\s*"\/([^"]+)"/g, (m, p) => {
    return '"searchUrl": "' + toRoot + p + '"';
  });

  // Rewrite cover / image paths inside JSON data in <script> blocks (e.g. "cover": "/images/...")
  html = html.replace(/"(cover|avatar)":\s*"\/([^"]+)"/g, (m, key, p) => {
    return '"' + key + '": "' + toRoot + p + '"';
  });

  // 还原被保护的代码块
  if (codeBlocks.length > 0) {
    html = html.replace(/<!--__SEIHAKU_CODE_BLOCK_(\d+)__-->/g, (match, idx) => {
      return codeBlocks[parseInt(idx, 10)] || match;
    });
  }

  return html;
});
