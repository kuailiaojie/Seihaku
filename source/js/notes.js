/**
 * 🍃 栖白 (Theme Seihaku) - Yohaku 跨端手记阅读系统
 * 功能核心：
 * 1. 杂志级手记名录导航（专栏分类筛选 + 实时标题关键词过滤）
 * 2. 100% 对齐文章目录规范的随动悬浮 TOC（磁吸物理滑块、自然波浪分割线、环形进度、动作组）
 * 3. 规范级 AI 智能摘要客户端（支持外部 Gemini / OpenAI / DeepSeek / 自定义 API 接入）
 */

(function () {
  'use strict';

  // 1. 全局配置与状态
  const rawConfig = window.__YOHAKU_CONFIG__ || {};
  const config = {
    source: rawConfig.source || 'local',
    initialNid: rawConfig.initialNid || null,
    defaultTopic: rawConfig.defaultTopic || '手记',
    aiSummary: rawConfig.aiSummary || {
      enable: true,
      provider: 'gemini',
      apiKey: '',
      apiUrl: '',
      model: 'gemini-1.5-flash',
      modelLabel: 'Gemini 1.5',
      prompt: '请用简练精辟的2-3句话总结以下手记的核心洞察：'
    }
  };

  let allNotes = [];
  let allTopics = [];
  let currentTopic = 'all';
  let searchQuery = '';
  let currentNote = null;
  let isSerifMode = true;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 静态相对路径与通用协议解析适配器 (彻底支持 file:/// 离线双击与标准 HTTP 部署)
  function resolveAssetUrl(url) {
    if (!url || /^([a-z]+:|\/\/|data:)/i.test(url)) return url;
    if (url.startsWith('/')) {
      const rootMeta = document.querySelector('meta[name="site-root"]');
      let root = rootMeta ? (rootMeta.getAttribute('content') || '') : '';
      if (!root && window.location.protocol === 'file:') {
        const pathSegments = window.location.pathname.replace(/^\/+/,'').split('/');
        const depth = Math.max(0, pathSegments.length - 1);
        root = depth > 0 ? '../'.repeat(depth) : '';
      }
      return root + url.replace(/^\/+/, '');
    }
    return url;
  }

  // 2. 节气格式化与日期推算
  function formatChineseDate(dateStr) {
    if (!dateStr) return '近期流转 · 留白';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '近期流转 · 留白';
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[d.getDay()];

    const terms = [
      { name: '小寒', m: 1, d: 5 }, { name: '大寒', m: 1, d: 20 },
      { name: '立春', m: 2, d: 4 }, { name: '雨水', m: 2, d: 19 },
      { name: '惊蛰', m: 3, d: 5 }, { name: '春分', m: 3, d: 20 },
      { name: '清明', m: 4, d: 4 }, { name: '谷雨', m: 4, d: 20 },
      { name: '立夏', m: 5, d: 5 }, { name: '小满', m: 5, d: 21 },
      { name: '芒种', m: 6, d: 5 }, { name: '夏至', m: 6, d: 21 },
      { name: '小暑', m: 7, d: 7 }, { name: '大暑', m: 7, d: 23 },
      { name: '立秋', m: 8, d: 7 }, { name: '处暑', m: 8, d: 23 },
      { name: '白露', m: 9, d: 7 }, { name: '秋分', m: 9, d: 23 },
      { name: '寒露', m: 10, d: 8 }, { name: '霜降', m: 10, d: 23 },
      { name: '立冬', m: 11, d: 7 }, { name: '小雪', m: 11, d: 22 },
      { name: '大雪', m: 12, d: 7 }, { name: '冬至', m: 12, d: 22 }
    ];
    let term = '芒种';
    for (const t of terms) {
      if (month > t.m || (month === t.m && day >= t.d)) {
        term = t.name;
      }
    }
    return `${year}年${month}月${day}日${weekday} · ${term}`;
  }

  // 3. 初始化加载
  function init() {
    // A. 优先加载页面内置缓存数据
    const embeddedScript = document.getElementById('yohaku-notes-data');
    if (embeddedScript && embeddedScript.textContent.trim()) {
      try {
        const cache = JSON.parse(embeddedScript.textContent);
        if (cache.notes && cache.notes.length) {
          allNotes = cache.notes;
        }
        if (cache.topics && cache.topics.length) {
          allTopics = cache.topics;
        }
      } catch (e) {
        console.warn('[Seihaku Notes] Cache parse fallback:', e);
      }
    }

    resolveInitialState();
    renderUI();
    setupEventListeners();
  }

  function resolveInitialState() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramNid = urlParams.get('nid') || (window.location.hash.match(/nid-(\d+)/) || [])[1];
    const targetNid = paramNid ? parseInt(paramNid, 10) : config.initialNid;

    if (allNotes.length > 0) {
      if (targetNid) {
        const matched = allNotes.find(n => n.nid === targetNid);
        if (matched) currentNote = matched;
      }
      if (!currentNote) currentNote = allNotes[0];
    }
  }

  // 4. UI 渲染主入口
  function renderUI() {
    renderNavList();
    renderTopicSelector();
    if (currentNote) {
      renderMainReader(currentNote);
    }
  }

  // 渲染左侧手记导航列表 (带搜索过滤与专栏筛选)
  function renderNavList() {
    const listEl = document.getElementById('yohaku-nav-list');
    const totalCountEl = document.getElementById('notes-total-count');
    if (!listEl) return;

    let filtered = allNotes;
    if (currentTopic && currentTopic !== 'all') {
      filtered = allNotes.filter(n => n.topic && (n.topic.name === currentTopic || n.topic.slug === currentTopic));
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(n => (n.title || '').toLowerCase().includes(q));
    }

    if (totalCountEl) {
      totalCountEl.textContent = `共 ${filtered.length} 篇手记`;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <li style="padding: 24px 12px; text-align: center; color: var(--text-tertiary); font-size: 0.82rem;">
          未检索到匹配手记
        </li>
      `;
      return;
    }

    listEl.innerHTML = filtered.map((note, idx) => {
      const isActive = currentNote && currentNote.nid === note.nid;
      const cleanTitle = escapeHtml((note.title || '').replace(/^「|」$/g, ''));
      const padIndex = (idx + 1) < 10 ? '0' + (idx + 1) : (idx + 1);
      const topicName = escapeHtml(note.topic ? note.topic.name : '手记');

      return `
        <li class="yohaku-nav-item ${isActive ? 'active' : ''}" data-nid="${note.nid}" title="${cleanTitle}">
          <div class="nav-item-indicator" aria-hidden="true"></div>
          <div class="nav-item-body">
            <div class="nav-item-meta">
              <span class="nav-item-idx font-mono">#${padIndex}</span>
              <span class="nav-item-topic font-mono">${topicName}</span>
            </div>
            <span class="nav-item-title font-serif">${cleanTitle}</span>
          </div>
        </li>
      `;
    }).join('');

    // 绑定条目点击
    listEl.querySelectorAll('.yohaku-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const nid = parseInt(item.getAttribute('data-nid'), 10);
        const target = allNotes.find(n => n.nid === nid);
        if (target) selectNote(target);
      });
    });
  }

  // 渲染左侧专栏下拉菜单
  function renderTopicSelector() {
    const labelEl = document.getElementById('current-topic-label');
    const dropdownEl = document.getElementById('yohaku-topic-dropdown');
    if (!labelEl || !dropdownEl) return;

    const topicStats = {};
    allNotes.forEach(n => {
      const tName = n.topic ? n.topic.name : '其他';
      topicStats[tName] = (topicStats[tName] || 0) + 1;
    });

    const activeTopicName = (currentTopic && currentTopic !== 'all')
      ? currentTopic
      : (currentNote && currentNote.topic ? currentNote.topic.name : '全部专栏');

    labelEl.textContent = activeTopicName === 'all' ? '全部专栏' : activeTopicName;

    let optionsHtml = `
      <button type="button" class="yohaku-topic-option ${currentTopic === 'all' ? 'active' : ''}" data-topic="all">
        <span>全部手记</span>
        <span class="font-mono">${allNotes.length}</span>
      </button>
    `;

    const topicList = allTopics.length > 0 ? allTopics.map(t => t.name) : Object.keys(topicStats);
    topicList.forEach(tName => {
      const cnt = topicStats[tName] || 0;
      optionsHtml += `
        <button type="button" class="yohaku-topic-option ${currentTopic === tName ? 'active' : ''}" data-topic="${tName}">
          <span>${tName}</span>
          <span class="font-mono">${cnt}</span>
        </button>
      `;
    });

    dropdownEl.innerHTML = optionsHtml;

    dropdownEl.querySelectorAll('.yohaku-topic-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = btn.getAttribute('data-topic');
        setTopic(selected);
        dropdownEl.classList.remove('show');
        const trigger = document.getElementById('notes-topic-filter-btn');
        if (trigger) trigger.classList.remove('open');
      });
    });
  }

  function setTopic(topicName) {
    currentTopic = topicName;
    renderNavList();
    renderTopicSelector();
    let filtered = allNotes;
    if (currentTopic !== 'all') {
      filtered = allNotes.filter(n => n.topic && (n.topic.name === currentTopic || n.topic.slug === currentTopic));
    }
    if (filtered.length > 0 && (!currentNote || !filtered.some(n => n.nid === currentNote.nid))) {
      selectNote(filtered[0]);
    }
  }

  function selectNote(note) {
    if (!note) return;
    currentNote = note;

    try {
      history.replaceState(null, '', `#nid-${note.nid}`);
    } catch (e) {}

    renderNavList();
    renderTopicSelector();
    renderMainReader(note);

    if (window.innerWidth < 860) {
      const readerCard = document.getElementById('yohaku-reader-card');
      if (readerCard) readerCard.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // 渲染主体阅读卡片
  function renderMainReader(note) {
    const cardEl = document.getElementById('yohaku-reader-card');
    if (!cardEl) return;

    // A. 封面与分类 Tag
    const coverImg = document.getElementById('yohaku-cover-img');
    const topicPill = document.getElementById('yohaku-topic-pill');

    const defaultCover = resolveAssetUrl('/images/covers/drifting-through-the-world.png');
    const coverUrl = (note.meta && note.meta.cover)
      ? resolveAssetUrl(note.meta.cover)
      : defaultCover;

    if (coverImg) {
      coverImg.src = coverUrl;
      coverImg.onerror = function() {
        this.src = defaultCover;
      };
    }
    if (topicPill) {
      topicPill.textContent = note.topic ? note.topic.name : '深夜尘世';
    }

    // B. 标题与元数据
    const titleEl = document.getElementById('yohaku-reader-title');
    if (titleEl) titleEl.textContent = (note.title || '').replace(/^「|」$/g, '');

    const dateTermEl = document.getElementById('yohaku-date-term');
    if (dateTermEl) {
      dateTermEl.textContent = formatChineseDate(note.created_at || note.created, note.nid);
    }

    const statsEl = document.getElementById('yohaku-stats');
    if (statsEl) {
      if (note.read_count || note.like_count) {
        const readCount = note.read_count ? note.read_count.toLocaleString() : '0';
        const likeCount = note.like_count || 0;
        statsEl.textContent = `${readCount} 阅读 · ${likeCount} 喜欢`;
      } else {
        statsEl.textContent = '流年印记 · 留白沉思';
      }
    }

    // C. AI 智析摘要
    renderAISummary(note);

    // D. 正文渲染 (使用 marked.js 并触发代码块 macOS 顶栏增强)
    const bodyEl = document.getElementById('yohaku-article-body');
    if (bodyEl) {
      const rawText = note.text || note.content || '';
      if (window.marked && typeof window.marked.parse === 'function') {
        bodyEl.innerHTML = window.marked.parse(rawText);
      } else {
        bodyEl.innerHTML = fallbackMarkdown(rawText);
      }
      if (typeof window.initSeihakuCodeBlocks === 'function') {
        window.initSeihakuCodeBlocks(bodyEl);
      }
    }

    // E. 渲染 100% 对齐文章目录规范的随动目录 TOC
    renderFloatingToc(note);

    // F. 点赞状态还原
    const likeBtn = document.getElementById('yohaku-like-btn');
    const tocLikeBtn = document.getElementById('notes-toc-like-btn');
    const liked = localStorage.getItem(`yohaku_liked_${note.nid}`);
    
    if (likeBtn) {
      if (liked) {
        likeBtn.classList.add('liked');
        likeBtn.querySelector('span').textContent = '已点亮微光';
      } else {
        likeBtn.classList.remove('liked');
        likeBtn.querySelector('span').textContent = '点亮微光';
      }
    }
    if (tocLikeBtn) {
      if (liked) {
        tocLikeBtn.classList.add('liked');
      } else {
        tocLikeBtn.classList.remove('liked');
      }
    }
  }

  // 简易 Markdown 回退解析
  function fallbackMarkdown(text) {
    return text
      .split('\n\n')
      .map(block => {
        block = block.trim();
        if (block.startsWith('## ')) return `<h2>${block.replace('## ', '')}</h2>`;
        if (block.startsWith('### ')) return `<h3>${block.replace('### ', '')}</h3>`;
        if (block.startsWith('> ')) return `<blockquote><p>${block.replace('> ', '')}</p></blockquote>`;
        return `<p>${block}</p>`;
      })
      .join('');
  }

  // ==============================================================================
  // 5. AI 智能摘要系统 & 外部 API 接入客户端 (AISummaryClient)
  // ==============================================================================
  function renderAISummary(note) {
    const summaryTextEl = document.getElementById('yohaku-summary-text');
    if (!summaryTextEl) return;

    if (note.summary) {
      summaryTextEl.textContent = note.summary;
      return;
    }

    // 本地快速语义提炼
    const raw = (note.text || note.content || '')
      .replace(/#+\s+.+/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/[>*`_-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const fallbackText = raw.slice(0, 160) + (raw.length > 160 ? '...' : '');
    summaryTextEl.textContent = fallbackText || '于方寸留白处，栖息万物微光。';
  }

  // 调用外部 AI API 实时生成摘要
  async function callExternalAISummary() {
    const summaryCard = document.getElementById('notes-summary-card');
    const loadingOverlay = document.getElementById('ai-summary-loading');
    const refreshBtn = document.getElementById('ai-summary-refresh-btn');
    const summaryTextEl = document.getElementById('yohaku-summary-text');
    if (!currentNote || !summaryTextEl) return;

    const aiCfg = config.aiSummary || {};
    const apiKey = aiCfg.apiKey || '';
    const apiUrl = aiCfg.apiUrl || '';
    const provider = aiCfg.provider || 'gemini';
    const model = aiCfg.model || 'gemini-1.5-flash';
    const promptPrefix = aiCfg.prompt || '请用通顺优雅的2-3句话总结以下长篇文稿的核心洞察：';

    // 如果未配置外部安全代理 API，提供轻量非阻塞提示
    if (!apiUrl) {
      if (window.showSeihakuToast) {
        window.showSeihakuToast('当前使用本地静态智析摘要（可在 _config.yml 配置代理端点 api_url）');
      }
      return;
    }

    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (refreshBtn) refreshBtn.classList.add('refreshing');

    try {
      const articleText = (currentNote.text || currentNote.content || '').slice(0, 4000);
      let summaryResult = '';

      if (provider === 'gemini') {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${promptPrefix}\n\n${articleText}` }]
            }]
          })
        });
        const data = await res.json();
        summaryResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // OpenAI / DeepSeek / 通用兼容代理接口
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: promptPrefix },
              { role: 'user', content: articleText }
            ],
            temperature: 0.7
          })
        });
        const data = await res.json();
        summaryResult = data.choices?.[0]?.message?.content || '';
      }

      if (summaryResult) {
        typewriterRender(summaryTextEl, summaryResult.trim());
        currentNote.summary = summaryResult.trim();
        if (window.showSeihakuToast) window.showSeihakuToast('AI 智析摘要已刷新 ✨');
      } else {
        throw new Error('未获取到外部 AI 返回的有效摘要内容');
      }

    } catch (err) {
      console.error('[AI Summary API Error]', err);
      if (window.showSeihakuToast) {
        window.showSeihakuToast('调用外部 AI 代理端点失败，请检查网络连接');
      }
    } finally {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (refreshBtn) refreshBtn.classList.remove('refreshing');
    }
  }

  // 打字机流式渲染
  function typewriterRender(elem, text) {
    elem.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
      elem.textContent += text.charAt(i);
      i++;
      if (i >= text.length) {
        clearInterval(timer);
      }
    }, 20);
  }

  // ==============================================================================
  // 6. 100% 对齐文章目录规范的随动目录 (Floating TOC Engine)
  // ==============================================================================
  let headingsList = [];

  function renderFloatingToc(note) {
    const tocContainer = document.getElementById('notes-toc-tree-content');
    const indicatorThumb = document.getElementById('notes-toc-indicator-thumb');
    if (!tocContainer) return;

    const rawText = note.text || note.content || '';
    const parsedHeadings = [];
    const lines = rawText.split('\n');

    lines.forEach((line, idx) => {
      const m = line.match(/^(#{2,3})\s+(.+)$/);
      if (m) {
        parsedHeadings.push({
          level: m[1].length,
          title: m[2].trim(),
          id: `section-${idx}`
        });
      }
    });

    const bodyEl = document.getElementById('yohaku-article-body');
    if (bodyEl) {
      const domHeadings = bodyEl.querySelectorAll('h2, h3');
      domHeadings.forEach((dh, i) => {
        if (parsedHeadings[i]) {
          dh.id = parsedHeadings[i].id;
        }
      });
    }

    if (!parsedHeadings.length) {
      tocContainer.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-tertiary); padding-left: 4px;">漫笔随思，无分级章节</div>';
      headingsList = [];
      if (indicatorThumb) indicatorThumb.classList.remove('visible');
      updateTocReadingProgress(0);
      return;
    }

    // 格式与 Hexo 文章渲染的 ol.seihaku-toc 完全一致！
    let tocHtml = '<ol class="seihaku-toc">';
    parsedHeadings.forEach(h => {
      const levelClass = h.level === 3 ? 'seihaku-toc-level-3' : 'seihaku-toc-level-2';
      tocHtml += `
        <li class="seihaku-toc-item ${levelClass}">
          <a class="seihaku-toc-link" href="#${h.id}" title="${h.title}">${h.title}</a>
        </li>
      `;
    });
    tocHtml += '</ol>';
    tocContainer.innerHTML = tocHtml;

    // 查找并收集 DOM 锚点
    headingsList = [];
    const links = tocContainer.querySelectorAll('.seihaku-toc-link');
    links.forEach(link => {
      const href = link.getAttribute('href');
      const targetId = href.replace('#', '');
      const elem = document.getElementById(targetId);
      if (elem) {
        headingsList.push({ elem: elem, link: link });
      }

      // 点击平滑跳转 (带顶栏安全高度预留)
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const top = elem.getBoundingClientRect().top + window.scrollY - 92;
        window.scrollTo({ top: top, behavior: 'smooth' });
        try {
          history.pushState(null, '', href);
        } catch (err) {}
      });
    });

    // 初始触发一次目录高亮和进度计算
    updateTocSpy();
    updateTocReadingProgress();
  }

  // 环形进度圈与百分比计算 (与 post.ejs / toc.js 统一规范)
  const circumference = 2 * Math.PI * 9; // r=9, ~56.548
  function updateTocReadingProgress(forcedPercent) {
    const textEl = document.getElementById('notes-progress-text');
    const circleVal = document.getElementById('notes-progress-val');
    const cardEl = document.getElementById('yohaku-reader-card');

    let percent = 0;
    if (typeof forcedPercent === 'number') {
      percent = forcedPercent;
    } else if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      const totalHeight = cardEl.scrollHeight;
      const windowH = window.innerHeight;
      const scrollFromTop = -rect.top;
      const scrollableDistance = totalHeight - windowH;
      if (scrollableDistance > 0) {
        percent = Math.min(100, Math.max(0, Math.round((scrollFromTop / scrollableDistance) * 100)));
      } else {
        percent = rect.bottom < windowH ? 100 : 0;
      }
    }

    if (textEl) textEl.textContent = `${percent}%`;
    if (circleVal) {
      const offset = circumference - (percent / 100) * circumference;
      circleVal.style.strokeDasharray = `${circumference}`;
      circleVal.style.strokeDashoffset = `${offset}`;
    }
  }

  // 目录滚动监听与随动磁吸物理指示滑块
  let lastActiveNoteHref = null;
  function updateTocSpy() {
    const tocNav = document.getElementById('notes-toc-nav');
    const indicatorThumb = document.getElementById('notes-toc-indicator-thumb');
    if (!headingsList.length) return;

    const scrollY = window.scrollY || document.documentElement.scrollTop;
    let activeItem = null;

    for (let i = 0; i < headingsList.length; i++) {
      const top = headingsList[i].elem.getBoundingClientRect().top + scrollY - 110;
      if (scrollY >= top) {
        activeItem = headingsList[i];
      } else {
        break;
      }
    }

    if (!activeItem && headingsList.length > 0) {
      activeItem = headingsList[0];
    }

    headingsList.forEach(item => {
      item.link.classList.remove('active');
    });

    if (activeItem && activeItem.link) {
      const curHref = activeItem.link.getAttribute('href');
      if (curHref !== lastActiveNoteHref) {
        lastActiveNoteHref = curHref;
        const noteWaveSvg = document.querySelector('.notes-toc-divider .toc-wave-svg');
        if (noteWaveSvg) {
          noteWaveSvg.classList.remove('wave-ripple');
          void noteWaveSvg.offsetWidth;
          noteWaveSvg.classList.add('wave-ripple');
        }
      }

      activeItem.link.classList.add('active');

      if (indicatorThumb && tocNav) {
        const navRect = tocNav.getBoundingClientRect();
        const linkRect = activeItem.link.getBoundingClientRect();
        const topPos = linkRect.top - navRect.top;
        const height = linkRect.height;

        indicatorThumb.style.transform = `translateY(${topPos + 2}px)`;
        indicatorThumb.style.height = `${Math.max(14, height - 4)}px`;
        indicatorThumb.classList.add('visible');
      }
    } else if (indicatorThumb) {
      indicatorThumb.classList.remove('visible');
    }
  }

  // ==============================================================================
  // 7. 交互绑定
  // ==============================================================================
  function setupEventListeners() {
    // 专栏下拉菜单切换
    const topicTrigger = document.getElementById('notes-topic-filter-btn');
    const topicDropdown = document.getElementById('yohaku-topic-dropdown');
    if (topicTrigger && topicDropdown) {
      topicTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = topicDropdown.classList.toggle('show');
        topicTrigger.classList.toggle('open', isOpen);
      });

      document.addEventListener('click', () => {
        topicDropdown.classList.remove('show');
        topicTrigger.classList.remove('open');
      });
    }

    // 搜索过滤
    const searchInput = document.getElementById('notes-search-input');
    const clearBtn = document.getElementById('notes-search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
        renderNavList();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        clearBtn.style.display = 'none';
        renderNavList();
      });
    }

    // AI 摘要复制
    const copySummaryBtn = document.getElementById('ai-summary-copy-btn');
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', () => {
        const text = document.getElementById('yohaku-summary-text')?.textContent || '';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            const span = copySummaryBtn.querySelector('span');
            const orig = span.textContent;
            span.textContent = '已复制 ✓';
            setTimeout(() => { span.textContent = orig; }, 1800);
          });
        }
      });
    }

    // AI 外部 API 智析按钮
    const refreshSummaryBtn = document.getElementById('ai-summary-refresh-btn');
    if (refreshSummaryBtn) {
      refreshSummaryBtn.addEventListener('click', callExternalAISummary);
    }

    // 字体排印切换
    const fontBtn = document.getElementById('yohaku-font-btn');
    if (fontBtn) {
      fontBtn.addEventListener('click', toggleFontMode);
    }

    // 正文与目录点赞交互
    const likeBtn = document.getElementById('yohaku-like-btn');
    const tocLikeBtn = document.getElementById('notes-toc-like-btn');
    if (likeBtn) likeBtn.addEventListener('click', handleLike);
    if (tocLikeBtn) tocLikeBtn.addEventListener('click', handleLike);

    // 分享链接复制
    const shareBtn = document.getElementById('notes-toc-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(window.location.href).then(() => {
            if (window.showSeihakuToast) {
              window.showSeihakuToast('已复制当前手记链接到剪贴板 🍃');
            }
          });
        }
      });
    }

    // 回到顶部
    const topBtn = document.getElementById('notes-toc-top-btn');
    if (topBtn) {
      topBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 滚动优化监听 (requestAnimationFrame)
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateTocReadingProgress();
          updateTocSpy();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  function toggleFontMode() {
    isSerifMode = !isSerifMode;
    const cardEl = document.getElementById('yohaku-reader-card');
    const labelEl = document.getElementById('yohaku-font-label');
    if (!cardEl || !labelEl) return;

    if (isSerifMode) {
      cardEl.classList.remove('font-sans-mode');
      cardEl.classList.add('font-serif-mode');
      labelEl.textContent = '宋体';
    } else {
      cardEl.classList.remove('font-serif-mode');
      cardEl.classList.add('font-sans-mode');
      labelEl.textContent = '黑体';
    }
  }

  function handleLike() {
    if (!currentNote) return;
    const key = `yohaku_liked_${currentNote.nid}`;
    const likeBtn = document.getElementById('yohaku-like-btn');
    const tocLikeBtn = document.getElementById('notes-toc-like-btn');
    const isLiked = localStorage.getItem(key);

    if (isLiked) {
      localStorage.removeItem(key);
      if (likeBtn) {
        likeBtn.classList.remove('liked');
        likeBtn.querySelector('span').textContent = '点亮微光';
      }
      if (tocLikeBtn) tocLikeBtn.classList.remove('liked');
      currentNote.like_count = Math.max(0, (currentNote.like_count || 1) - 1);
    } else {
      localStorage.setItem(key, 'true');
      if (likeBtn) {
        likeBtn.classList.add('liked');
        likeBtn.querySelector('span').textContent = '已点亮微光';
      }
      if (tocLikeBtn) tocLikeBtn.classList.add('liked');
      currentNote.like_count = (currentNote.like_count || 0) + 1;
    }

    const statsEl = document.getElementById('yohaku-stats');
    if (statsEl) {
      const readCount = currentNote.read_count ? currentNote.read_count.toLocaleString() : '1';
      statsEl.textContent = `${readCount} 阅读 · ${currentNote.like_count} 喜欢`;
    }
  }

  window.initSeihakuNotes = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
