/**
 * 🍃 栖白 (Theme Seihaku) - 核心构建辅助函数、数据适配器与全站检索索引生成器
 * 功能：
 * 1. 自动合并站点根目录 _config.seihaku.yml（实现用户配置与主题版本安全解耦）
 * 2. seihaku_site_stats(): 统一计算全站字数、文章篇数、运行天数与年份跨度
 * 3. seihaku_post_stats(post): 统一计算单篇文章字数与阅读时长
 * 4. seihaku_normalized_notes(): 统一标准化手记数据 (适配 notes.yml 与 notes_api_data)
 * 5. seihaku_sorted_posts(posts): 首页与专栏置顶文章智能排序 (支持 sticky / pin)
 * 6. seihaku_search_json Generator: 自动生成轻量级 /search.json 供全站 ⌘K 搜索面板使用
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// 递归深度对象合并
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// 1. 自动无感合并站点根目录 _config.seihaku.yml (升级绝不冲突)
hexo.on('generateBefore', function () {
  const rootCustomConfig = path.join(hexo.base_dir, '_config.seihaku.yml');
  if (fs.existsSync(rootCustomConfig)) {
    try {
      const content = fs.readFileSync(rootCustomConfig, 'utf8');
      const customCfg = yaml.load(content);
      if (customCfg && typeof customCfg === 'object') {
        deepMerge(hexo.theme.config, customCfg);
        hexo.log.info('🍃 [Seihaku] 已成功合并站点根目录 _config.seihaku.yml 配置');
      }
    } catch (err) {
      hexo.log.warn('🍃 [Seihaku] 加载 _config.seihaku.yml 失败:', err.message);
    }
  }
});

function stripHtmlTags(str) {
  if (!str) return '';
  return String(str)
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countPostWords(rawHtml) {
  if (!rawHtml) return 0;
  // 剥离代码块与标签，精准统计 CJK 字数与英文词数
  const noCode = String(rawHtml).replace(/<pre[\s\S]*?<\/pre>/gi, ' ').replace(/<code[\s\S]*?<\/code>/gi, ' ');
  const plain = noCode.replace(/<[^>]+>/g, ' ');
  const cnChars = (plain.match(/[\u4e00-\u9fa5\u3040-\u30ff]/g) || []).length;
  const enWords = (plain.replace(/[\u4e00-\u9fa5\u3040-\u30ff]/g, ' ').match(/[a-zA-Z0-9_\-]+/g) || []).length;
  return cnChars + enWords;
}

// 2. 全站统计计算
hexo.extend.helper.register('seihaku_site_stats', function () {
  const site = this.site;
  const theme = this.theme || {};
  const footerCfg = theme.footer || {};

  let totalWords = 0;
  if (site && site.posts) {
    site.posts.forEach(function (p) {
      if (p.content) {
        totalWords += countPostWords(p.content);
      }
    });
  }

  const wordsInWan = (totalWords / 10000).toFixed(1);
  const sinceYear = parseInt(footerCfg.since, 10) || 2024;
  const currentYear = new Date().getFullYear();
  const yearDisplay = sinceYear === currentYear ? String(currentYear) : `${sinceYear} - ${currentYear}`;

  let diffDays = 1;
  if (footerCfg.custom_days) {
    diffDays = footerCfg.custom_days;
  } else if (footerCfg.start_date) {
    const sDate = new Date(footerCfg.start_date);
    if (!isNaN(sDate.getTime())) {
      diffDays = Math.max(1, Math.ceil((Date.now() - sDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
  } else {
    const startDate = new Date(sinceYear, 0, 1);
    diffDays = Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return {
    postCount: site && site.posts ? site.posts.length : 0,
    totalWords: totalWords,
    wordsInWan: wordsInWan,
    sinceYear: sinceYear,
    currentYear: currentYear,
    yearDisplay: yearDisplay,
    diffDays: diffDays
  };
});

// 3. 单篇文章字数与阅读时长（中英混排精准算法）
hexo.extend.helper.register('seihaku_post_stats', function (post) {
  if (!post || !post.content) {
    return { wordCount: 0, readTime: 1 };
  }
  const noCode = String(post.content).replace(/<pre[\s\S]*?<\/pre>/gi, ' ').replace(/<code[\s\S]*?<\/code>/gi, ' ');
  const plain = noCode.replace(/<[^>]+>/g, ' ');
  const cnChars = (plain.match(/[\u4e00-\u9fa5\u3040-\u30ff]/g) || []).length;
  const enWords = (plain.replace(/[\u4e00-\u9fa5\u3040-\u30ff]/g, ' ').match(/[a-zA-Z0-9_\-]+/g) || []).length;
  const totalCount = cnChars + enWords;
  const readTime = Math.max(1, Math.round((cnChars / 350) + (enWords / 160)));
  return {
    wordCount: totalCount,
    readTime: readTime
  };
});

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 4. 标准化手记数据流适配器 (纯粹规范化 source/_data/notes.yml，100% 本地自主解耦)
function getNormalizedNotes(dataRef) {
  const data = dataRef || {};
  const rawNotes = (data.notes && Array.isArray(data.notes)) ? data.notes : [];
  const topicsMap = {};
  const normalizedNotes = rawNotes.map(function (item, idx) {
    const nid = item.nid || (idx + 1);
    const tagName = item.tag || '手记';
    topicsMap[tagName] = (topicsMap[tagName] || 0) + 1;
    const createdDate = item.date || item.time || new Date().toISOString();
    const cleanTitle = (item.title || (item.content ? stripHtmlTags(item.content).slice(0, 24) : '手记')).replace(/^「|」$/g, '');
    const coverUrl = item.cover || '/images/covers/drifting-through-the-world.png';

    return {
      nid: nid,
      title: cleanTitle,
      topic: {
        name: tagName,
        slug: encodeURIComponent(tagName)
      },
      created: typeof createdDate === 'string' ? createdDate : new Date(createdDate).toISOString(),
      content: item.content || item.text || '',
      summary: item.summary || (item.content ? stripHtmlTags(item.content).slice(0, 140) : ''),
      meta: {
        cover: coverUrl
      }
    };
  });

  const topics = Object.keys(topicsMap).map(function (name) {
    return {
      name: name,
      count: topicsMap[name],
      slug: encodeURIComponent(name)
    };
  });

  return {
    notes: normalizedNotes,
    topics: topics
  };
}

hexo.extend.helper.register('seihaku_normalized_notes', function () {
  const data = (this.site && this.site.data) || {};
  return getNormalizedNotes(data);
});

// 5. 置顶文章排序辅助函数
hexo.extend.helper.register('seihaku_sorted_posts', function (posts) {
  if (!posts) return [];
  const list = posts.toArray ? posts.toArray() : (Array.isArray(posts) ? posts.slice() : []);
  return list.sort(function (a, b) {
    const stickyA = a.sticky || (a.pin ? 100 : 0) || 0;
    const stickyB = b.sticky || (b.pin ? 100 : 0) || 0;
    if (stickyA !== stickyB) {
      return stickyB - stickyA;
    }
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });
});

// 6. 自动生成全站静态搜索索引 (/search.json)
hexo.extend.generator.register('seihaku_search_json', function (locals) {
  const urlFor = hexo.extend.helper.get('url_for').bind(hexo);
  const items = [];

  if (locals.posts) {
    locals.posts.sort('-date').forEach(function (post) {
      if (post.published === false) return;
      const catName = post.categories && post.categories.length ? post.categories.data[0].name : '文稿';
      const tags = post.tags && post.tags.length ? post.tags.data.map(t => t.name) : [];
      const fullText = stripHtmlTags(post.content || post.excerpt);
      const excerptText = stripHtmlTags(post.excerpt || post.content);
      const dateStr = post.date && typeof post.date.format === 'function'
        ? post.date.format('YYYY-MM-DD')
        : '';
      const postRoute = post.path.replace(/\/+$/, '') + '/index.html';
      items.push({
        type: 'post',
        title: post.title || '无题',
        url: urlFor(postRoute),
        date: dateStr,
        category: catName,
        tags: tags,
        summary: excerptText.slice(0, 180),
        content: fullText.slice(0, 3000)
      });
    });
  }

  // 同时索引手记数据 (Notes)
  const normNotes = getNormalizedNotes(locals.data);
  if (normNotes && Array.isArray(normNotes.notes)) {
    normNotes.notes.forEach(function (note) {
      const cleanTitle = (note.title || '手记').replace(/^「|」$/g, '');
      const topicName = note.topic && note.topic.name ? note.topic.name : '手记';
      const rawText = stripHtmlTags(note.text || note.content || '');
      items.push({
        type: 'note',
        title: cleanTitle,
        url: urlFor('/notes/index.html?nid=' + note.nid),
        date: (note.created || '').slice(0, 10),
        category: topicName,
        tags: [topicName, '手记'],
        summary: (note.summary || rawText).slice(0, 140),
        content: rawText.slice(0, 1500)
      });
    });
  }

  const jsonStr = JSON.stringify(items);
  return [
    {
      path: 'search.json',
      data: jsonStr
    },
    {
      path: 'js/search-data.js',
      data: 'window.__SEIHAKU_SEARCH_DATA__ = ' + jsonStr + ';'
    }
  ];
});

// 7. 自动生成全站 Atom 订阅源 (/atom.xml) 兜底杜绝 404 (若已安装 hexo-generator-feed 则自动放行)
if (!hexo.extend.generator.list()['feed']) {
  hexo.extend.generator.register('seihaku_atom_feed', function (locals) {
    const cleanBase = (hexo.config.url || 'http://localhost:4000').replace(/\/+$/, '');
    let posts = [];
    if (locals.posts) {
      const list = locals.posts.sort('-date');
      posts = list.toArray ? list.toArray().slice(0, 20) : (Array.isArray(list) ? list.slice(0, 20) : []);
    }
    const firstPost = posts[0];
    const updated = (firstPost && firstPost.date) ? new Date(firstPost.date).toISOString() : new Date().toISOString();

    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<feed xmlns="http://www.w3.org/2005/Atom">\n';
    xml += `  <title>${escapeXml(hexo.config.title || '栖白')}</title>\n`;
    xml += `  <link href="${cleanBase}/atom.xml" rel="self"/>\n`;
    xml += `  <link href="${cleanBase}/"/>\n`;
    xml += `  <updated>${updated}</updated>\n`;
    xml += `  <id>${cleanBase}/</id>\n`;
    xml += `  <author><name>${escapeXml(hexo.config.author || '栖白')}</name></author>\n`;

    posts.forEach(function (p) {
      const cleanPath = String(p.path || '').replace(/^\/+/, '');
      const postUrl = `${cleanBase}/${cleanPath}`;
      const pDate = new Date(p.date).toISOString();
      const pTitle = escapeXml(p.title || '无题');
      const pSummary = escapeXml(stripHtmlTags(p.excerpt || p.content || '').slice(0, 200));
      xml += '  <entry>\n';
      xml += `    <title>${pTitle}</title>\n`;
      xml += `    <link href="${postUrl}"/>\n`;
      xml += `    <id>${postUrl}</id>\n`;
      xml += `    <published>${pDate}</published>\n`;
      xml += `    <updated>${p.updated ? new Date(p.updated).toISOString() : pDate}</updated>\n`;
      xml += `    <summary type="html">${pSummary}</summary>\n`;
      xml += '  </entry>\n';
    });

    xml += '</feed>\n';
    return {
      path: 'atom.xml',
      data: xml
    };
  });
}

// 8. 全站多级导航菜单标准化解析器 (支持一级精简 + 二级折叠/下拉)
hexo.extend.helper.register('seihaku_nav_menu', function () {
  const theme = this.theme || {};
  const isHome = typeof this.is_home === 'function' ? this.is_home() : false;
  const isPost = typeof this.is_post === 'function' ? this.is_post() : false;
  const isArchive = typeof this.is_archive === 'function' ? this.is_archive() : false;
  const isCategory = typeof this.is_category === 'function' ? this.is_category() : false;
  const isTag = typeof this.is_tag === 'function' ? this.is_tag() : false;
  const isCurrent = typeof this.is_current === 'function' ? this.is_current.bind(this) : () => false;

  function checkPathActive(url) {
    if (!url || url === '#' || url === 'javascript:void(0);') return false;
    const clean = url.replace(/^\/+|\/+$/g, '');
    if (url === '/' || clean === '') return isHome;
    if (clean === 'archives') return isArchive || isPost;
    if (clean === 'categories') return isCurrent('categories') || isCategory;
    if (clean === 'tags') return isCurrent('tags') || isTag;
    return isCurrent(clean) || isCurrent(clean + '/');
  }

  const rawMenu = theme.menu || {};
  const normalized = [];

  for (const [key, val] of Object.entries(rawMenu)) {
    let item = {
      name: key,
      url: '',
      icon: '',
      desc: '',
      children: [],
      isActive: false
    };

    if (typeof val === 'string') {
      const parts = val.split('||').map(s => s.trim());
      item.url = parts[0] || '/';
      item.icon = parts[1] || '';
      item.desc = parts[2] || '';
    } else if (val && typeof val === 'object') {
      item.url = val.url || '';
      item.icon = val.icon || '';
      item.desc = val.desc || '';

      const rawChildren = val.children || val.items || [];
      if (Array.isArray(rawChildren)) {
        item.children = rawChildren.map(c => {
          const childUrl = c.url || '';
          return {
            name: c.name || '',
            url: childUrl,
            icon: c.icon || 'fas fa-compass',
            desc: c.desc || '',
            isActive: checkPathActive(childUrl)
          };
        });
      } else if (typeof rawChildren === 'object') {
        for (const [cKey, cVal] of Object.entries(rawChildren)) {
          let childObj = { name: cKey, url: '', icon: 'fas fa-compass', desc: '', isActive: false };
          if (typeof cVal === 'string') {
            const parts = cVal.split('||').map(s => s.trim());
            childObj.url = parts[0] || '/';
            childObj.icon = parts[1] || 'fas fa-compass';
            childObj.desc = parts[2] || '';
          } else if (cVal && typeof cVal === 'object') {
            childObj.url = cVal.url || '/';
            childObj.icon = cVal.icon || 'fas fa-compass';
            childObj.desc = cVal.desc || '';
          }
          childObj.isActive = checkPathActive(childObj.url);
          item.children.push(childObj);
        }
      }
    }

    const selfActive = item.url ? checkPathActive(item.url) : false;
    const childActive = item.children.some(c => c.isActive);
    item.isActive = selfActive || childActive;

    normalized.push(item);
  }

  // 兜底方案
  if (normalized.length === 0) {
    normalized.push({
      name: '首页',
      url: '/',
      icon: 'fas fa-home',
      desc: '',
      children: [],
      isActive: isHome
    });
    normalized.push({
      name: '文稿',
      url: '/archives',
      icon: 'fas fa-feather-alt',
      desc: '笔墨文存与知识体系',
      children: [
        { name: '全部文稿', url: '/archives', icon: 'fas fa-archive', desc: '岁月沉淀的万字长文', isActive: isArchive || isPost },
        { name: '随笔手记', url: '/notes', icon: 'far fa-comment-dots', desc: '随时记下的灵感微光', isActive: isCurrent('notes') }
      ],
      isActive: isArchive || isPost || isCurrent('notes')
    });
  }

  return normalized;
});

// 9. 统一第三方 CDN 静态资源映射辅助函数 (支持 cdnjs | unpkg | jsdelivr | loli | local 及自定义覆盖)
const SEIHAKU_CDN_RESOURCES = {
  fontawesome_css: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    unpkg: 'https://unpkg.com/@fortawesome/fontawesome-free@6.5.1/css/all.min.css',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css',
    loli: 'https://cdnjs.loli.net/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    local: '/lib/font-awesome/all.min.css'
  },
  katex_css: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css',
    unpkg: 'https://unpkg.com/katex@0.16.9/dist/katex.min.css',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
    loli: 'https://cdnjs.loli.net/ajax/libs/KaTeX/0.16.9/katex.min.css',
    local: '/lib/katex/katex.min.css'
  },
  katex_js: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js',
    unpkg: 'https://unpkg.com/katex@0.16.9/dist/katex.min.js',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
    loli: 'https://cdnjs.loli.net/ajax/libs/KaTeX/0.16.9/katex.min.js',
    local: '/lib/katex/katex.min.js'
  },
  katex_auto_render: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js',
    unpkg: 'https://unpkg.com/katex@0.16.9/dist/contrib/auto-render.min.js',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
    loli: 'https://cdnjs.loli.net/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js',
    local: '/lib/katex/auto-render.min.js'
  },
  mermaid_esm: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.esm.min.mjs',
    unpkg: 'https://unpkg.com/mermaid@10.9.0/dist/mermaid.esm.min.mjs',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.esm.min.mjs',
    loli: 'https://cdnjs.loli.net/ajax/libs/mermaid/10.9.0/mermaid.esm.min.mjs',
    local: '/lib/mermaid/mermaid.esm.min.mjs'
  },
  pjax_js: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/pjax/0.2.8/pjax.min.js',
    unpkg: 'https://unpkg.com/pjax@0.2.8/pjax.js',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/pjax@0.2.8/pjax.min.js',
    loli: 'https://cdnjs.loli.net/ajax/libs/pjax/0.2.8/pjax.min.js',
    local: '/lib/pjax/pjax.min.js'
  },
  waline_css: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/waline/3.1.2/waline.css',
    unpkg: 'https://unpkg.com/@waline/client@v3/dist/waline.css',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/@waline/client@v3/dist/waline.css',
    loli: 'https://unpkg.com/@waline/client@v3/dist/waline.css',
    local: '/lib/waline/waline.css'
  },
  waline_js: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/waline/3.1.2/waline.js',
    unpkg: 'https://unpkg.com/@waline/client@v3/dist/waline.js',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/@waline/client@v3/dist/waline.js',
    loli: 'https://unpkg.com/@waline/client@v3/dist/waline.js',
    local: '/lib/waline/waline.js'
  },
  twikoo_js: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/twikoo/1.6.40/twikoo.all.min.js',
    unpkg: 'https://unpkg.com/twikoo@1.6.40/dist/twikoo.all.min.js',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/twikoo@1.6.40/dist/twikoo.all.min.js',
    loli: 'https://cdnjs.loli.net/ajax/libs/twikoo/1.6.40/twikoo.all.min.js',
    local: '/lib/twikoo/twikoo.all.min.js'
  },
  gsap_js: {
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
    unpkg: 'https://unpkg.com/gsap@3.12.5/dist/gsap.min.js',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
    loli: 'https://cdnjs.loli.net/ajax/libs/gsap/3.12.5/gsap.min.js',
    local: '/lib/gsap/gsap.min.js'
  }
};

hexo.extend.helper.register('seihaku_cdn', function (name) {
  const cdnCfg = (this.theme && this.theme.cdn) || {};
  const custom = cdnCfg.custom_urls || {};
  if (custom[name]) return custom[name];

  const provider = cdnCfg.provider || 'cdnjs';
  const entry = SEIHAKU_CDN_RESOURCES[name];
  if (!entry) return '';

  const url = entry[provider] || entry['cdnjs'] || entry['unpkg'] || '';
  if (provider === 'local' && !/^https?:\/\//i.test(url)) {
    const urlFor = hexo.extend.helper.get('url_for').bind(this);
    return urlFor(url);
  }
  return url;
});

// 10. 智能相关文章推荐 (Related Posts)
// 基于标签 (权重 2) 与分类 (权重 3) 重合度加权计算，保障推荐关联性
hexo.extend.helper.register('seihaku_related_posts', function (currentPost, limit) {
  const maxLimit = typeof limit === 'number' ? limit : 3;
  if (!currentPost) return [];
  const site = this.site;
  if (!site || !site.posts) return [];

  const currTags = (currentPost.tags && currentPost.tags.length) ? currentPost.tags.data.map(t => t.name) : [];
  const currCat = (currentPost.categories && currentPost.categories.length) ? currentPost.categories.data[0].name : '';

  const scored = [];
  site.posts.forEach(function (p) {
    if (p._id === currentPost._id || p.published === false) return;
    let score = 0;

    // 分类匹配
    if (currCat && p.categories && p.categories.length && p.categories.data[0].name === currCat) {
      score += 3;
    }

    // 标签重合度
    if (currTags.length && p.tags && p.tags.length) {
      p.tags.data.forEach(function (t) {
        if (currTags.includes(t.name)) {
          score += 2;
        }
      });
    }

    if (score > 0) {
      scored.push({ post: p, score: score });
    }
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.post.date).getTime() - new Date(a.post.date).getTime();
  });

  const results = scored.slice(0, maxLimit).map(item => item.post);

  // 若相关文章不足，由最新文章补充
  if (results.length < maxLimit) {
    site.posts.sort('-date').forEach(function (p) {
      if (results.length >= maxLimit) return;
      if (p._id !== currentPost._id && p.published !== false && !results.some(r => r._id === p._id)) {
        results.push(p);
      }
    });
  }

  return results;
});

// 11. 系列文章合集解析器 (Post Series)
hexo.extend.helper.register('seihaku_post_series', function (currentPost) {
  if (!currentPost || !currentPost.series) return null;
  const site = this.site;
  if (!site || !site.posts) return null;

  const seriesName = currentPost.series;
  const seriesPosts = [];

  site.posts.forEach(function (p) {
    if (p.series === seriesName && p.published !== false) {
      seriesPosts.push(p);
    }
  });

  if (seriesPosts.length <= 1) return null;

  // 按 series_order 或 date 升序
  seriesPosts.sort(function (a, b) {
    const orderA = typeof a.series_order === 'number' ? a.series_order : 0;
    const orderB = typeof b.series_order === 'number' ? b.series_order : 0;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const currentIndex = seriesPosts.findIndex(p => p._id === currentPost._id);

  return {
    name: seriesName,
    total: seriesPosts.length,
    currentIndex: currentIndex >= 0 ? currentIndex + 1 : 1,
    posts: seriesPosts
  };
});



