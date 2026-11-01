/**
 * 🍃 栖白 (Theme Seihaku) - GitHub 开源项目动态展厅客户端交互引擎
 * 支持：纯客户端零配置直连 GitHub API、Star/Fork 数据实时刷新、骨架屏平滑渐入
 */

function initSeihakuPortfolio() {
  const container = document.getElementById("portfolio-grid");
  if (!container) return;

  const username = container.dataset.ghUser;
  const source = container.dataset.source || "github";
  const sortType = container.dataset.sort || "stars";
  const limit = parseInt(container.dataset.limit || "12", 10);
  const excludeForks = container.dataset.excludeForks !== "false";

  const hasStaticCards = container.querySelectorAll(".portfolio-card").length > 0;

  // 如果已经有静态生成的卡片且不是强制纯 GitHub，则只做轻量数据增强
  if (hasStaticCards && source !== "github") {
    return;
  }

  // 如果没有用户名，直接展示空状态
  if (!username) {
    if (!hasStaticCards) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-tertiary);">
          暂未配置 GitHub 用户名，请在主题 _config.yml 中设置 portfolio.github.username。
        </div>
      `;
    }
    return;
  }

  // 纯客户端拉取 GitHub Repos
  const apiUrl = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`;

  fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github.v3+json"
    }
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`GitHub API HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((repos) => {
      if (!Array.isArray(repos) || repos.length === 0) {
        if (!hasStaticCards) {
          container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-tertiary);">
              未找到该 GitHub 用户的公开开源项目。
            </div>
          `;
        }
        return;
      }

      let filtered = repos;
      if (excludeForks) {
        filtered = filtered.filter((r) => !r.fork);
      }

      // 排序
      filtered.sort((a, b) => {
        if (sortType === "stars") {
          return b.stargazers_count - a.stargazers_count;
        }
        return new Date(b.updated_at) - new Date(a.updated_at);
      });

      const selected = filtered.slice(0, limit);

      // 渲染卡片
      const cardsHtml = selected
        .map((r) => {
          const coverUrl = `https://opengraph.githubassets.com/1/${r.full_name}`;
          const language = r.language || "Open Source";
          const desc = r.description || "暂无项目描述。于方寸留白处探索代码美学。";
          const topics = Array.isArray(r.topics) && r.topics.length ? r.topics.slice(0, 4) : [language];
          const hasHomepage = r.homepage && r.homepage.trim().length > 0;

          const techTags = topics
            .map(
              (t) =>
                `<span class="tech-tag-pill" style="font-size: 0.72rem; padding: 2px 7px;">${escapeHtml(t)}</span>`
            )
            .join("");

          const previewBtn = hasHomepage
            ? `
              <a href="${escapeHtml(r.homepage)}" class="portfolio-link-btn" target="_blank" rel="noopener noreferrer">
                <span>在线预览</span>
                <i class="fas fa-external-link-alt" style="font-size: 0.8em;"></i>
              </a>
            `
            : "";

          return `
            <div class="portfolio-card fade-in">
              <div class="portfolio-cover-frame">
                <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(r.name)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=700&q=80';">
              </div>
              <div class="portfolio-content-body">
                <span class="portfolio-badge-pill">${escapeHtml(language)}</span>
                <h3 class="portfolio-item-title">${escapeHtml(r.name)}</h3>
                <p class="portfolio-item-desc">${escapeHtml(desc)}</p>

                <div class="tech-tag-group" style="margin-bottom: 16px;">
                  ${techTags}
                </div>

                <div class="portfolio-links-row">
                  ${previewBtn}
                  <a href="${escapeHtml(r.html_url)}" class="portfolio-link-btn" style="color: var(--text-secondary); ${hasHomepage ? "margin-left: 12px;" : ""}" target="_blank" rel="noopener noreferrer">
                    <i class="fab fa-github"></i>
                    <span>源码仓库</span>
                  </a>
                  <span style="margin-left: auto; font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-tertiary);">
                    ⭐ ${r.stargazers_count} · 🍴 ${r.forks_count}
                  </span>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      container.innerHTML = cardsHtml;
    })
    .catch((err) => {
      console.warn("[Portfolio Engine] Client GitHub fetch failed:", err);
      // 如果本来没有静态内容，展示降级提示
      if (!hasStaticCards) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-tertiary);">
            <p>GitHub 数据获取暂歇或受到速率限制，请稍候刷新。</p>
            <a href="https://github.com/${encodeURIComponent(username)}" target="_blank" style="color: var(--color-accent); font-family: var(--font-mono); font-size: 0.85rem; margin-top: 8px; display: inline-block;">前往 GitHub @${escapeHtml(username)} 个人主页 →</a>
          </div>
        `;
      }
    });

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

window.initSeihakuPortfolio = initSeihakuPortfolio;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSeihakuPortfolio);
} else {
  initSeihakuPortfolio();
}
