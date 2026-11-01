/**
 * 🍃 栖白 (Theme Seihaku) - 智能链接卡片解析引擎 (Link Card Preview Engine)
 * 
 * 功能特性：
 * 1. 标签插件：支持 {% linkcard url %} 以及 {% linkcard url "title" "desc" "icon" "cover" %}
 *    同时支持键值对语法：{% linkcard url="..." title="..." desc="..." icon="..." cover="..." %}
 * 2. 独立链接自动解析：自动将 Markdown 正文中独立的单行链接或带 "card" 标识的链接转为优雅卡片
 * 3. 智能元数据抓取：构建期自动提取 OpenGraph (og:title, og:description, og:image) 与 Favicon
 * 4. 站内文章智能关联：支持内链（如 /2026/10/28/post/），自动读取站内标题、摘要与封面，零网络请求
 * 5. 双重持久缓存：自动将抓取的卡片存入 source/_data/link_cards.json，离线构建秒级响应
 * 6. 优雅降级与前端增强：外链超时或离线时自动降级为域名卡片，前端异步补全，绝不阻塞构建
 */

'use strict';

const fs = require('fs');
const path = require('path');

let linkCache = {};
let isCacheLoaded = false;
let isCacheDirty = false;

// 1. 本地持久化缓存管理
function getCacheFilePath() {
  return path.join(hexo.source_dir, '_data', 'link_cards.json');
}

function loadCache() {
  if (isCacheLoaded) return;
  const filePath = getCacheFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      linkCache = JSON.parse(raw);
    } catch (e) {
      linkCache = {};
    }
  }
  isCacheLoaded = true;
}

function saveCache() {
  if (!isCacheDirty) return;
  const filePath = getCacheFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(linkCache, null, 2), 'utf8');
    isCacheDirty = false;
  } catch (e) {
    hexo.log.warn('🍃 [Seihaku:LinkCard] 保存 link_cards.json 缓存失败:', e.message);
  }
}

hexo.on('generateBefore', function () {
  loadCache();
});

hexo.on('generateAfter', function () {
  saveCache();
});

// 2. 实用辅助工具函数
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

function cleanText(str) {
  if (!str) return '';
  return decodeHtmlEntities(str).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractHost(urlStr) {
  try {
    const u = new URL(urlStr, 'https://example.com');
    return u.hostname || '';
  } catch {
    return '';
  }
}

// 3. 站内文稿/页面自动识别与关联 (零网络请求，极速解析)
function findInternalPostOrPage(targetUrl) {
  if (!targetUrl) return null;
  const siteUrl = hexo.config.url || '';
  let cleanUrl = targetUrl;
  if (siteUrl && cleanUrl.startsWith(siteUrl)) {
    cleanUrl = cleanUrl.slice(siteUrl.length);
  }
  if (!cleanUrl.startsWith('/') && !cleanUrl.startsWith('./') && !cleanUrl.startsWith('../')) {
    return null;
  }

  const normalized = cleanUrl
    .replace(/^[./]+/, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/(?:index)?\.html$/, '');

  // 检索文章数据库
  const allPosts = hexo.locals.get('posts');
  if (allPosts && allPosts.length) {
    for (let i = 0; i < allPosts.length; i++) {
      const post = allPosts.data[i];
      const pNorm = (post.path || '')
        .replace(/^\/+|\/+$/g, '')
        .replace(/(?:index)?\.html$/, '');
      if (pNorm === normalized || post.slug === normalized) {
        const urlHelper = hexo.extend.helper.get('url_for').bind(hexo);
        const resolvedUrl = urlHelper(post.path);
        const postCover = post.cover || (post.photos && post.photos.length ? post.photos[0] : '');
        let postDesc = post.description || '';
        if (!postDesc) {
          if (post.excerpt) {
            postDesc = cleanText(post.excerpt);
          } else if (post._content) {
            const rawBeforeMore = post._content.split(/<!--\s*more\s*-->/i)[0];
            postDesc = cleanText(rawBeforeMore).slice(0, 120);
          } else if (post.content) {
            postDesc = cleanText(post.content).slice(0, 120);
          }
        }
        return {
          url: resolvedUrl,
          title: post.title || '无题',
          desc: postDesc,
          cover: postCover ? urlHelper(postCover) : '',
          icon: urlHelper((hexo.theme.config.author && hexo.theme.config.author.avatar) || '/images/avatar.svg'),
          host: hexo.config.title || '站内文稿',
          isInternal: true
        };
      }
    }
  }

  // 检索独立页面数据库
  const allPages = hexo.locals.get('pages');
  if (allPages && allPages.length) {
    for (let i = 0; i < allPages.length; i++) {
      const page = allPages.data[i];
      const pgNorm = (page.path || '')
        .replace(/^\/+|\/+$/g, '')
        .replace(/(?:index)?\.html$/, '');
      if (pgNorm === normalized) {
        const urlHelper = hexo.extend.helper.get('url_for').bind(hexo);
        const resolvedUrl = urlHelper(page.path);
        return {
          url: resolvedUrl,
          title: page.title || normalized,
          desc: page.description || (page._content ? cleanText(page._content).slice(0, 110) : (page.content ? cleanText(page.content).slice(0, 110) : '')),
          cover: page.cover ? urlHelper(page.cover) : '',
          icon: urlHelper((hexo.theme.config.author && hexo.theme.config.author.avatar) || '/images/avatar.svg'),
          host: hexo.config.title || '站内页面',
          isInternal: true
        };
      }
    }
  }

  return null;
}

// 4. 外链网页元数据抓取 (支持 og:title, og:desc, og:image, favicon)
async function fetchWebMetadata(url, timeoutMs = 2800) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; SeihakuLinkCard/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7'
      }
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<meta\s+property=["'](?:og:title|twitter:title)["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+content=["']([^"']+)["']\s+property=["'](?:og:title|twitter:title)["']/i) ||
                       html.match(/<title>([^<]+)<\/title>/i);

    const descMatch = html.match(/<meta\s+property=["'](?:og:description|twitter:description)["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["'](?:og:description|twitter:description)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);

    const imgMatch = html.match(/<meta\s+property=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i) ||
                     html.match(/<meta\s+content=["']([^"']+)["']\s+property=["'](?:og:image|twitter:image)["']/i);

    const iconMatch = html.match(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) ||
                      html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);

    const host = extractHost(url);
    const title = cleanText(titleMatch ? titleMatch[1] : host);
    const desc = cleanText(descMatch ? descMatch[1] : url);
    let cover = imgMatch ? imgMatch[1].trim() : '';
    let icon = iconMatch ? iconMatch[1].trim() : '';

    if (cover) {
      try { cover = new URL(cover, url).href; } catch { cover = ''; }
    }
    if (icon) {
      try { icon = new URL(icon, url).href; } catch { icon = ''; }
    }
    if (!icon && host) {
      icon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    }

    return { title, desc, cover, icon, host, updatedAt: Date.now() };
  } catch (err) {
    return null;
  }
}

// 5. 核心元数据求解器 (结合用户指定、本地缓存、站内检索与实时网络)
async function resolveCardData(targetUrl, userTitle, userDesc, userIcon, userCover) {
  if (!targetUrl) return null;
  loadCache();

  const cfg = (hexo.theme.config && hexo.theme.config.link_card) || {};
  const isEnabled = cfg.enable !== false;
  if (!isEnabled) return null;

  // 5.1 尝试匹配站内文章或页面
  const internal = findInternalPostOrPage(targetUrl);
  if (internal) {
    return {
      url: internal.url,
      title: userTitle || internal.title,
      desc: userDesc || internal.desc,
      icon: userIcon || internal.icon,
      cover: userCover || internal.cover,
      host: internal.host,
      isInternal: true
    };
  }

  const host = extractHost(targetUrl);

  // 5.2 若用户显式提供了标题与描述，直接使用
  if (userTitle && (userDesc || userCover)) {
    return {
      url: targetUrl,
      title: userTitle,
      desc: userDesc || targetUrl,
      icon: userIcon || (host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : ''),
      cover: userCover || '',
      host: host || 'link',
      isInternal: false
    };
  }

  // 5.3 检查本地持久化缓存
  if (linkCache[targetUrl]) {
    const cached = linkCache[targetUrl];
    return {
      url: targetUrl,
      title: userTitle || cached.title || host,
      desc: userDesc || cached.desc || targetUrl,
      icon: userIcon || cached.icon || (host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : ''),
      cover: userCover || cached.cover || '',
      host: cached.host || host || 'link',
      isInternal: false
    };
  }

  // 5.4 构建期实时抓取
  if (cfg.fetch_meta !== false) {
    const timeout = cfg.timeout || 2800;
    const fetched = await fetchWebMetadata(targetUrl, timeout);
    if (fetched) {
      linkCache[targetUrl] = fetched;
      isCacheDirty = true;
      return {
        url: targetUrl,
        title: userTitle || fetched.title,
        desc: userDesc || fetched.desc,
        icon: userIcon || fetched.icon,
        cover: userCover || fetched.cover,
        host: fetched.host,
        isInternal: false
      };
    }
  }

  // 5.5 优雅降级 (Fallback + 前端异步补全标记)
  return {
    url: targetUrl,
    title: userTitle || host || targetUrl,
    desc: userDesc || targetUrl,
    icon: userIcon || (host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : ''),
    cover: userCover || '',
    host: host || 'link',
    isInternal: false,
    isPending: true
  };
}

// 6. 渲染统一的语义化 Apple HIG 风格卡片 HTML
function renderLinkCard(card) {
  if (!card || !card.url) return '';
  const isInternal = card.isInternal === true;
  const targetAttr = isInternal ? '' : ' target="_blank" rel="noopener noreferrer"';
  const pendingAttr = card.isPending ? ' data-link-card-pending="true"' : '';
  const escapedUrl = escapeHtml(card.url);
  const escapedTitle = escapeHtml(card.title || card.host || '链接');
  const escapedDesc = escapeHtml(card.desc || '');
  const escapedIcon = escapeHtml(card.icon || '');
  const escapedCover = escapeHtml(card.cover || '');
  const escapedHost = escapeHtml(card.host || 'link');

  const defaultFavicon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYThhMjlhIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0iTTEyIDJhMTQuNSAxNC41IDAgMCAwIDAgMjAgMTQuNSAxNC41IDAgMCAwIDAtMjAiLz48cGF0aCBkPSJNMiAxMmgyMCIvPjwvc3ZnPg==';

  const badgeHtml = isInternal
    ? `<span class="link-card-internal-badge"><i class="fas fa-bookmark" style="font-size:0.68em; margin-right:3px;"></i>${escapedHost}</span>`
    : `<span class="link-card-host font-mono">${escapedHost}</span>`;

  const actionIcon = isInternal
    ? '<i class="fas fa-arrow-right"></i>'
    : '<i class="fas fa-arrow-up-right-from-square"></i>';

  const coverHtml = escapedCover
    ? `<div class="link-card-cover-box"><img class="link-card-cover" src="${escapedCover}" alt="${escapedTitle}" loading="lazy" onerror="this.parentElement.style.display='none'"/></div>`
    : '';

  return `<div class="seihaku-link-card-wrap">
  <a class="seihaku-link-card" href="${escapedUrl}"${targetAttr}${pendingAttr} data-url="${escapedUrl}">
    <div class="link-card-body">
      <div class="link-card-site">
        <img class="link-card-favicon" src="${escapedIcon || defaultFavicon}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${defaultFavicon}'"/>
        ${badgeHtml}
      </div>
      <div class="link-card-title">${escapedTitle}</div>
      ${escapedDesc ? `<div class="link-card-desc">${escapedDesc}</div>` : ''}
    </div>
    ${coverHtml}
    <div class="link-card-action" aria-hidden="true">${actionIcon}</div>
  </a>
</div>`;
}

// 7. 参数解析器 (支持键值对命名参数与位置参数)
function parseCardArgs(args) {
  let url = '', title = '', desc = '', icon = '', cover = '';
  if (!args || !args.length) return { url, title, desc, icon, cover };

  const isNamed = args.some(arg => /^(url|link|href|title|name|desc|description|tip|icon|avatar|cover|img|image)=/i.test(arg));
  if (isNamed) {
    args.forEach(arg => {
      const match = arg.match(/^([a-z_]+)=(.*)$/i);
      if (match) {
        let key = match[1].toLowerCase();
        let val = match[2].replace(/^["']|["']$/g, '').trim();
        if (key === 'link' || key === 'href') key = 'url';
        if (key === 'name') key = 'title';
        if (key === 'description' || key === 'tip') key = 'desc';
        if (key === 'avatar') key = 'icon';
        if (key === 'img' || key === 'image') key = 'cover';
        if (key === 'url') url = val;
        if (key === 'title') title = val;
        if (key === 'desc') desc = val;
        if (key === 'icon') icon = val;
        if (key === 'cover') cover = val;
      }
    });
  } else {
    url = (args[0] || '').replace(/^["']|["']$/g, '').trim();
    title = (args[1] || '').replace(/^["']|["']$/g, '').trim();
    desc = (args[2] || '').replace(/^["']|["']$/g, '').trim();
    icon = (args[3] || '').replace(/^["']|["']$/g, '').trim();
    cover = (args[4] || '').replace(/^["']|["']$/g, '').trim();
  }

  return { url, title, desc, icon, cover };
}

// 8. 注册 Hexo 标签插件: {% linkcard ... %} 与 {% link_card ... %}
const tagHandler = async function (args) {
  const parsed = parseCardArgs(args);
  if (!parsed.url) return '';
  const cardData = await resolveCardData(parsed.url, parsed.title, parsed.desc, parsed.icon, parsed.cover);
  return renderLinkCard(cardData);
};

hexo.extend.tag.register('linkcard', tagHandler, { async: true });
hexo.extend.tag.register('link_card', tagHandler, { async: true });
hexo.extend.tag.register('cardlink', tagHandler, { async: true });

// 9. Markdown 预处理过滤器: 支持 @[card](url) 与 [card:url] 扩展语法
hexo.extend.filter.register('before_post_render', function (data) {
  if (!data || !data.content) return data;
  const cfg = (hexo.theme.config && hexo.theme.config.link_card) || {};
  if (cfg.enable === false) return data;

  // @[card](url) 或 @[card](url "title")
  data.content = data.content.replace(/@\[card\]\(([^)\s]+)(?:\s+["']([^"']+)["'])?\)/g, (m, url, title) => {
    return title ? `{% linkcard "${url}" "${title}" %}` : `{% linkcard "${url}" %}`;
  });

  // [card:url]
  data.content = data.content.replace(/\[card:([^\]\s]+)\]/g, (m, url) => {
    return `{% linkcard "${url}" %}`;
  });

  return data;
});

// 10. 后处理过滤器: 自动检测单行独立链接并转换为卡片
hexo.extend.filter.register('after_post_render', async function (data) {
  if (!data || !data.content) return data;
  const cfg = (hexo.theme.config && hexo.theme.config.link_card) || {};
  if (cfg.enable === false) return data;

  const autoCard = cfg.auto_card !== false;

  // 正则匹配在单独段落 <p> 中只包含单个 <a> 标签的情况
  const pRegex = /<p>\s*<a\s+([^>]*?)href=(["'])(https?:\/\/[^"'>\s]+|\/[^"'>\s]+)\2([^>]*)>(.*?)<\/a>\s*<\/p>/gi;
  const matches = [...data.content.matchAll(pRegex)];

  for (const match of matches) {
    const fullTag = match[0];
    const preAttr = match[1] || '';
    const url = match[3];
    const postAttr = match[4] || '';
    const text = (match[5] || '').trim();
    const allAttrs = (preAttr + ' ' + postAttr).toLowerCase();

    // 排除锚点、无卡片标记与特殊协议
    if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      continue;
    }
    if (allAttrs.includes('no-card') || allAttrs.includes('class="no-card"') || allAttrs.includes('data-no-card')) {
      continue;
    }

    const isExplicitCard = /title=["']card["']/i.test(allAttrs) || 
                          text.toLowerCase() === 'card' || 
                          text === '卡片' || 
                          allAttrs.includes('class="link-card"');

    // 如果未开启 auto_card，并且没有显式标记 card，则跳过
    if (!autoCard && !isExplicitCard) {
      continue;
    }

    // 提取自定义标题（若链接文字不是纯 URL 也不是 card，则作为自定义标题）
    let customTitle = '';
    const cleanUrlText = url.replace(/\/$/, '').toLowerCase();
    const cleanTextLower = text.replace(/\/$/, '').toLowerCase();
    if (!isExplicitCard && cleanTextLower !== cleanUrlText && !text.startsWith('http://') && !text.startsWith('https://')) {
      customTitle = text;
    }

    try {
      const cardData = await resolveCardData(url, customTitle, '', '', '');
      if (cardData) {
        const cardHtml = renderLinkCard(cardData);
        data.content = data.content.replace(fullTag, cardHtml);
      }
    } catch (e) {
      hexo.log.warn(`🍃 [Seihaku:LinkCard] 解析链接卡片失败 (${url}):`, e.message);
    }
  }

  return data;
});
