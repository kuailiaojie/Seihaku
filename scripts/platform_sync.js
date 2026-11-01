/**
 * 🍃 栖白 (Theme Seihaku) - 平台数据自动化同步引擎 (内置于主题)
 * 支持能力：
 * 1. 哔哩哔哩 (Bilibili): 填入 UID 自动同步追番 (/bangumis)
 * 2. GitHub: 填入用户名同步开源项目 (/portfolio)
 * 3. 友邻朋友圈 (Friendcircle RSS): 自动从友邻配置的 RSS/Atom 订阅源聚合最新文章 (/friendcircle)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 通用 HTTP GET 请求封装（含 10s 超时防御）
function fetchJson(url, headers = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...headers
    };
    const req = client.get(url, { headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timeout (${timeoutMs}ms): ${url}`));
    });
    req.on('error', reject);
  });
}

// 文本与 XML 数据清洗
function cleanXmlText(str) {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 友好的相对时间转换
function formatRelativeTime(dateInput) {
  if (!dateInput) return '近期';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '近期';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay < 0) return '刚刚';
  if (diffMin < 5) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay === 1) return '昨天';
  if (diffDay < 30) return `${diffDay} 天前`;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 支持 301/302 重定向与防超时的文本抓取
function fetchFeedText(url, headers = {}, timeoutMs = 8000, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    function request(curUrl, redirectCount) {
      if (redirectCount > maxRedirects) {
        return reject(new Error(`Too many redirects: ${url}`));
      }
      try {
        const parsedUrl = new URL(curUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const reqHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SeihakuRSS/1.0',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
          ...headers
        };
        const req = client.get(curUrl, { headers: reqHeaders }, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            const nextUrl = new URL(res.headers.location, curUrl).toString();
            return request(nextUrl, redirectCount + 1);
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode} from ${curUrl}`));
          }
          let data = '';
          res.setEncoding('utf8');
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        });
        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error(`Request timeout (${timeoutMs}ms): ${curUrl}`));
        });
        req.on('error', reject);
      } catch (err) {
        reject(err);
      }
    }
    request(url, 0);
  });
}

// 解析 RSS 2.0 / Atom 1.0 / JSON Feed 统一为文章列表
function parseFeed(rawText, meta = {}) {
  const articles = [];
  if (!rawText || typeof rawText !== 'string') return articles;

  // 1. JSON Feed 兼容
  if (rawText.trim().startsWith('{')) {
    try {
      const json = JSON.parse(rawText);
      if (json && Array.isArray(json.items)) {
        json.items.forEach(item => {
          const rawDate = item.date_published || item.date_modified || '';
          const parsedTime = Date.parse(rawDate);
          articles.push({
            author: (item.author && item.author.name) || meta.author || meta.name || '友邻',
            avatar: meta.avatar || '/images/avatar.svg',
            site_name: meta.name || meta.title || '友邻博客',
            title: cleanXmlText(item.title) || '无标题',
            snippet: cleanXmlText(item.summary || item.content_text || '').slice(0, 140),
            time: formatRelativeTime(rawDate),
            timestamp: isNaN(parsedTime) ? 0 : parsedTime,
            url: item.url || meta.url || '#'
          });
        });
        return articles;
      }
    } catch (e) {}
  }

  // 2. Atom 1.0 格式
  const isAtom = /<feed[\s>]/i.test(rawText) || /<entry[\s>]/i.test(rawText);
  if (isAtom) {
    const entryMatches = rawText.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    entryMatches.forEach(entryXml => {
      const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? cleanXmlText(titleMatch[1]) : '无标题';

      let link = '';
      const linkMatch = entryXml.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i) ||
                        entryXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      if (linkMatch) {
        link = (linkMatch[1] || '').trim();
      }

      const dateMatch = entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
                        entryXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
      const rawDate = dateMatch ? cleanXmlText(dateMatch[1]) : '';
      const parsedTime = Date.parse(rawDate);

      const summaryMatch = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
                           entryXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
      const snippet = summaryMatch ? cleanXmlText(summaryMatch[1]).slice(0, 140) : '';

      const authorMatch = entryXml.match(/<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i);
      const author = authorMatch ? cleanXmlText(authorMatch[1]) : (meta.author || meta.name || '友邻');

      if (title || link) {
        articles.push({
          author: author,
          avatar: meta.avatar || '/images/avatar.svg',
          site_name: meta.name || meta.title || '友邻博客',
          title: title,
          snippet: snippet,
          time: formatRelativeTime(rawDate),
          timestamp: isNaN(parsedTime) ? 0 : parsedTime,
          url: link || meta.url || '#'
        });
      }
    });
    return articles;
  }

  // 3. RSS 2.0 格式
  const itemMatches = rawText.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  itemMatches.forEach(itemXml => {
    const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? cleanXmlText(titleMatch[1]) : '无标题';

    let link = '';
    const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ||
                      itemXml.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i) ||
                      itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    if (linkMatch) {
      link = cleanXmlText(linkMatch[1]);
    }

    const dateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
                      itemXml.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
    const rawDate = dateMatch ? cleanXmlText(dateMatch[1]) : '';
    const parsedTime = Date.parse(rawDate);

    const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
                      itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
    const snippet = descMatch ? cleanXmlText(descMatch[1]).slice(0, 140) : '';

    const authorMatch = itemXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) ||
                        itemXml.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
    const author = authorMatch ? cleanXmlText(authorMatch[1]) : (meta.author || meta.name || '友邻');

    if (title || link) {
      articles.push({
        author: author,
        avatar: meta.avatar || '/images/avatar.svg',
        site_name: meta.name || meta.title || '友邻博客',
        title: title,
        snippet: snippet,
        time: formatRelativeTime(rawDate),
        timestamp: isNaN(parsedTime) ? 0 : parsedTime,
        url: link || meta.url || '#'
      });
    }
  });

  return articles;
}

// 1. 同步 Bilibili 追番数据
async function syncBilibili(biliCfg, sourceDir) {
  if (!biliCfg || !biliCfg.enable || !biliCfg.vmid) {
    return;
  }
  const vmid = String(biliCfg.vmid).trim();
  const pageSize = biliCfg.page_size || 30;
  const type = biliCfg.type || 1; // 1: 番剧, 2: 影视剧
  console.log(`[Seihaku Bilibili] 正在从 B 站 API 同步追番数据 (UID: ${vmid}) ...`);

  try {
    const url = `https://api.bilibili.com/x/space/bangumi/follow/list?type=${type}&follow_status=0&pn=1&ps=${pageSize}&vmid=${vmid}`;
    const res = await fetchJson(url, { 'Referer': 'https://space.bilibili.com/' });

    if (res.json && res.json.code === 0 && res.json.data && res.json.data.list) {
      const rawList = res.json.data.list;
      const total = res.json.data.total;
      console.log(`[Seihaku Bilibili] 成功获取 ${rawList.length} 条追番数据 (用户总追踪: ${total})`);

      const formatted = rawList.map(item => {
        let status = 'finished';
        if (item.is_finish === 0) {
          status = 'watching';
        } else if (item.progress && item.progress.includes('看到')) {
          status = 'watching';
        } else if (item.follow_status === 1) {
          status = 'wish';
        } else {
          status = 'finished';
        }

        let totalEps = item.total_count || 12;
        let currentEp = totalEps;
        if (status === 'watching') {
          if (item.progress) {
            const m = item.progress.match(/第(\d+)话/) || item.progress.match(/第(\d+)集/);
            if (m) currentEp = parseInt(m[1], 10);
            else currentEp = Math.max(1, Math.round(totalEps * 0.7));
          } else {
            currentEp = Math.max(1, Math.round(totalEps * 0.7));
          }
        } else {
          currentEp = totalEps;
        }

        const cover = (item.cover || '').replace(/^http:/, 'https:');

        return {
          id: item.season_id,
          title: item.title,
          status: status,
          rating: item.rating ? item.rating.score : 9.5,
          rating_count: item.rating ? item.rating.count : 0,
          total_eps: totalEps,
          current_ep: currentEp,
          progress_text: item.progress || (item.new_ep ? item.new_ep.index_show : `全${totalEps}话`),
          cover: cover,
          summary: (item.evaluate || item.summary || item.subtitle || '').replace(/\r?\n/g, ' ').slice(0, 150),
          type: (item.styles || []).join(' / ') || item.season_type_name || '动画',
          year: item.publish && item.publish.release_date_show ? item.publish.release_date_show.slice(0, 4) : '2024',
          url: item.url || `https://www.bilibili.com/bangumi/play/ss${item.season_id}`,
          danmaku: item.stat ? item.stat.danmaku : 0,
          view: item.stat ? item.stat.view : 0,
          badge: item.badge || ''
        };
      });

      const dataDir = path.join(sourceDir, '_data');
      ensureDirExists(dataDir);
      const outPath = path.join(dataDir, 'bangumis.json');
      fs.writeFileSync(outPath, JSON.stringify(formatted, null, 2), 'utf8');
      console.log(`[Seihaku Bilibili] 已写入本地数据文件: ${outPath}`);
    } else {
      console.warn('[Seihaku Bilibili] API 返回异常:', res.json ? res.json.message : res.status);
    }
  } catch (err) {
    console.warn('[Seihaku Bilibili] 同步失败:', err.message);
  }
}

// 2. 同步 GitHub 开源项目数据
async function syncGitHub(ghCfg, sourceDir) {
  if (!ghCfg || (!ghCfg.enable && !ghCfg.username)) {
    return;
  }
  const username = String(ghCfg.username || '').trim();
  if (!username) return;

  const limit = ghCfg.limit || 12;
  const sort = ghCfg.sort || 'stars';
  const excludeForks = ghCfg.exclude_forks !== false;
  const pinned = ghCfg.pinned || [];

  console.log(`[Seihaku GitHub] 正在同步 ${username} 的开源项目数据 ...`);
  const headers = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (ghCfg.token || process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${ghCfg.token || process.env.GITHUB_TOKEN}`;
  }

  try {
    const url = `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`;
    const res = await fetchJson(url, headers);

    if (res.json && Array.isArray(res.json)) {
      let repos = res.json;

      if (excludeForks) {
        repos = repos.filter(r => !r.fork);
      }

      repos.sort((a, b) => {
        const aPinned = pinned.includes(a.name) ? 1 : 0;
        const bPinned = pinned.includes(b.name) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        if (sort === 'stars') {
          return b.stargazers_count - a.stargazers_count;
        }
        return new Date(b.updated_at) - new Date(a.updated_at);
      });

      const formatted = repos.slice(0, limit).map(r => ({
        title: r.name,
        tag: r.language || 'Open Source',
        desc: r.description || '暂无项目描述。于方寸留白处探索代码美学。',
        cover: `https://opengraph.githubassets.com/1/${r.full_name}`,
        url: r.homepage || r.html_url,
        github: r.html_url,
        tech: (r.topics && r.topics.length > 0) ? r.topics : [r.language].filter(Boolean),
        metrics: `⭐ ${r.stargazers_count} · 🍴 ${r.forks_count}`
      }));

      const dataDir = path.join(sourceDir, '_data');
      ensureDirExists(dataDir);
      const outPath = path.join(dataDir, 'portfolio_github.json');
      fs.writeFileSync(outPath, JSON.stringify(formatted, null, 2), 'utf8');
      console.log(`[Seihaku GitHub] 成功同步 ${formatted.length} 个精选开源项目至 ${outPath}`);
    } else {
      console.warn(`[Seihaku GitHub] API 未返回仓库列表: ${res.json ? (res.json.message || JSON.stringify(res.json)) : res.status}`);
    }
  } catch (err) {
    console.warn('[Seihaku GitHub] 项目同步失败:', err.message);
  }
}

// 3. 友邻朋友圈 RSS 自动抓取与聚合
async function syncFriendcircle(fcCfg, friendsCfg, sourceDir) {
  if (fcCfg && fcCfg.auto_sync === false) {
    return;
  }

  const limit = (fcCfg && fcCfg.limit) || 20;
  const sources = [];

  // 1. 从 fcCfg.sources 读取
  if (fcCfg && Array.isArray(fcCfg.sources)) {
    fcCfg.sources.forEach(s => {
      if (s && (s.rss || s.feed)) {
        sources.push({
          name: s.name || s.site_name || s.title || '友邻',
          author: s.author || s.name || '友邻',
          avatar: s.avatar || '/images/avatar.svg',
          url: s.url || s.link || '#',
          rss: s.rss || s.feed
        });
      }
    });
  }

  // 2. 从 friendsCfg.list 读取包含 rss 的友链
  if (friendsCfg && Array.isArray(friendsCfg.list)) {
    friendsCfg.list.forEach(s => {
      if (s && (s.rss || s.feed)) {
        if (!sources.some(existing => existing.rss === (s.rss || s.feed))) {
          sources.push({
            name: s.name || '友邻',
            author: s.author || s.name || '友邻',
            avatar: s.avatar || '/images/avatar.svg',
            url: s.link || s.url || '#',
            rss: s.rss || s.feed
          });
        }
      }
    });
  }

  // 3. 从本地 source/_data/friends.yml 或 links.yml 读取
  const dataDir = path.join(sourceDir, '_data');
  const friendsYmlPath = path.join(dataDir, 'friends.yml');
  if (fs.existsSync(friendsYmlPath)) {
    try {
      const parsed = yaml.load(fs.readFileSync(friendsYmlPath, 'utf8'));
      if (Array.isArray(parsed)) {
        parsed.forEach(s => {
          if (s && (s.rss || s.feed) && !sources.some(existing => existing.rss === (s.rss || s.feed))) {
            sources.push({
              name: s.name || '友邻',
              author: s.author || s.name || '友邻',
              avatar: s.avatar || '/images/avatar.svg',
              url: s.link || s.url || '#',
              rss: s.rss || s.feed
            });
          }
        });
      }
    } catch (e) {}
  }

  const linksYmlPath = path.join(dataDir, 'links.yml');
  if (fs.existsSync(linksYmlPath)) {
    try {
      const parsed = yaml.load(fs.readFileSync(linksYmlPath, 'utf8'));
      if (parsed && Array.isArray(parsed.categories)) {
        parsed.categories.forEach(cat => {
          if (Array.isArray(cat.links)) {
            cat.links.forEach(s => {
              if (s && (s.rss || s.feed) && !sources.some(existing => existing.rss === (s.rss || s.feed))) {
                sources.push({
                  name: s.name || '友邻',
                  author: s.author || s.name || '友邻',
                  avatar: s.avatar || '/images/avatar.svg',
                  url: s.url || s.link || '#',
                  rss: s.rss || s.feed
                });
              }
            });
          }
        });
      }
    } catch (e) {}
  }

  if (sources.length === 0) {
    return;
  }

  console.log(`[Seihaku FriendCircle] 正在从 ${sources.length} 个友邻 RSS 订阅源实时抓取最新文章...`);

  const allArticles = [];
  await Promise.allSettled(sources.map(async (source) => {
    try {
      const rawText = await fetchFeedText(source.rss);
      const items = parseFeed(rawText, source);
      if (items.length > 0) {
        allArticles.push(...items);
        console.log(`[Seihaku FriendCircle] ✓ 成功解析来自「${source.name}」的 ${items.length} 篇最新文章`);
      }
    } catch (err) {
      console.warn(`[Seihaku FriendCircle] ⚠️ 抓取「${source.name}」(${source.rss}) 失败: ${err.message}`);
    }
  }));

  if (allArticles.length > 0) {
    allArticles.sort((a, b) => b.timestamp - a.timestamp);
    const result = allArticles.slice(0, limit);

    ensureDirExists(dataDir);
    const outJsonPath = path.join(dataDir, 'friendcircle_rss.json');
    fs.writeFileSync(outJsonPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`[Seihaku FriendCircle] 聚合完成！共保留 ${result.length} 篇最新动态，已写入: ${outJsonPath}`);
  }
}

// 主同步流程
async function syncAll(themeConfig, sourceDir) {
  const platforms = (themeConfig && themeConfig.platforms) || {};
  const portfolio = (themeConfig && themeConfig.portfolio) || {};
  const friendcircle = (themeConfig && themeConfig.friendcircle) || {};
  const friends = (themeConfig && themeConfig.friends) || {};

  if (platforms.bilibili) await syncBilibili(platforms.bilibili, sourceDir);

  const ghConfig = portfolio.github || platforms.github;
  if (ghConfig && (ghConfig.enable || portfolio.source === 'github' || portfolio.source === 'both')) {
    await syncGitHub(ghConfig, sourceDir);
  }

  await syncFriendcircle(friendcircle, friends, sourceDir);
}

module.exports = { syncAll, syncBilibili, syncGitHub, syncFriendcircle, parseFeed, fetchFeedText };
