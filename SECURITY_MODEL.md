# Seihaku (hexo-theme-seihaku) threat model

## System overview
Seihaku is a Hexo (>=7) blog theme distributed via npm/GitHub Packages. It has no server of its own: code runs in two places.
1. **Build time** on the blog author's machine or CI (`hexo generate` / `hexo server`): Node scripts under `scripts/` register Hexo filters, helpers, tags, generators and console commands, and fetch external data (Bilibili, GitHub, friend RSS/Atom feeds) into `source/_data/*.json`.
2. **Run time** in site visitors' browsers: EJS templates under `layout/` render static HTML; `source/js/*` adds search, notes, link cards, portfolio, hitokoto, AI summary, comments, lightbox, theme toggle.

No infrastructure repository: the maintainer confirmed security review covers the theme only (the deployed blog and its hosting are out of scope).

## Components
| Component | Code | Side of trust boundary |
|---|---|---|
| **Build sync** | `scripts/platform_sync.js`, `scripts/platform_sync_hook.js`, `scripts/seihaku_cli.js` | Build machine; consumes untrusted network data (Bilibili API, GitHub API, friend RSS/Atom feeds) and writes files under `source/_data` |
| **Build plugins** | `scripts/link_card.js`, `scripts/tag_plugins.js`, `scripts/markdown_alerts.js`, `scripts/theme_helpers.js`, `scripts/docs_helper.js`, `scripts/html_relativizer.js` | Build machine; transform author content into HTML, search.json, atom.xml, CDN URLs |
| **Templates** | `layout/**/*.ejs` | Generated HTML served to visitors; many `<%- %>` raw outputs (e.g. `layout/friendcircle.ejs` renders RSS-derived `item.avatar`/`item.url`, `layout/post.ejs` password box) |
| **Client JS** | `source/js/**` (incl. vendored `source/js/vendor/marked.min.js`) | Visitor browser; fetches hitokoto, microlink, GitHub API, AI endpoint; uses `innerHTML` widely |
| **Config & defaults** | `_config.yml`, `default_data/**`, `languages/**`, `source/css/**` | Author-controlled configuration and sample data |
| **Packaging & CI** | `package.json`, `index.js`, `.github/workflows/npm-publish-github-packages.yml` | npm publication / supply chain |

## Entry points and who can reach them
- Friend RSS/Atom/JSON feeds (`friendcircle.sources`, `friends.list[].rss`) parsed with regexes in `scripts/platform_sync.js` → `source/_data/friendcircle.json` → `layout/friendcircle.ejs`. Reachable by **any friend-site owner, or whoever controls/compromises their domain**.
- Bilibili and GitHub API responses (build time, `scripts/platform_sync.js`; run time, `source/js/portfolio.js`). Reachable by a compromised or spoofed upstream (MITM on plain http).
- microlink.io metadata for link cards (`source/js/link-card.js`) and favicons from Google; hitokoto API (`source/js/hitokoto.js`). Reachable by those third parties or anyone controlling the linked page's metadata.
- CDN-loaded scripts/styles chosen by `seihaku_cdn` (`scripts/theme_helpers.js`): FontAwesome, KaTeX, Mermaid, pjax, Waline, Twikoo — loaded without SRI. Reachable by a compromised CDN.
- Comment systems (Waline/Twikoo/Giscus) and analytics (busuanzi, Umami, GA, Baidu) — third-party scripts in visitor pages.
- AI summary refresh (`source/js/notes.js`, `layout/post.ejs`): visitor browser POSTs article text to `ai_summary.api_url`.
- Visitor-controlled input: search box (`source/js/main.js`), URL/hash, localStorage (likes, theme).
- Author content: posts, front-matter, `_config.yml`, `source/_data/*.yml` — **trusted** (maintainer decision).

## Assets
- Visitors' browsers and sessions on the blog origin (XSS impact: defacement, phishing, abuse of comment-system sessions).
- The author's build machine / CI (code execution or arbitrary file write during `hexo generate`).
- Secrets in `_config.yml`: `ai_summary.api_key`, `portfolio.github.token`, `platforms.github.token`, analytics tokens — must not be emitted into generated HTML/JS.
- Integrity of the published npm package and the GitHub Actions `GITHUB_TOKEN` (packages: write).
- Password-protected post content — **accepted risk** (see below).

## Attacker profiles (maintainer: all in scope)
1. Website visitors (anonymous, internet).
2. Owners of friend RSS feeds / linked sites, or attackers who take over those domains.
3. Compromised or malicious third-party APIs and CDNs (hitokoto, microlink, Bilibili, GitHub, cdnjs/jsdelivr/unpkg/loli, comment/analytics providers), including network MITM where http is used.
4. Supply-chain attackers targeting people installing the theme from npm (package contents, CI workflow, dependencies such as `js-yaml`).

## Existing controls
- `escapeHtml` in `scripts/link_card.js` and `source/js/portfolio.js`; `escapeSearchHtml` in `source/js/main.js` search rendering.
- `cleanXmlText` strips tags from RSS titles/snippets (but not URLs/avatars).
- 10 s request timeout in `fetchJson`; 4 s abort for microlink.
- `rel="noopener noreferrer"` on external links in templates.
- `api_key` is not passed into the client config blocks in `layout/notes.ejs` / `layout/post.ejs` (only provider, api_url, model, prompt).

## Out of scope / accepted risk (maintainer decisions)
- **Author-written content is trusted**: posts, front-matter, `_config.yml`, `source/_data/*.yml`, notes data. Raw HTML/script from the author (e.g. `page.content`, marked rendering of notes, tag plugins) is not a vulnerability by itself.
- **Password-protected posts are a casual soft lock**: `layout/post.ejs` ships the password (`data-salt`) and base64 content to the client; bypass/leak of protected content is accepted risk.
- The deployed blog's hosting/infrastructure is out of scope (theme only).

## Open questions
- Whether real sites enable friend-circle auto sync with third-party feeds by default (`friendcircle.auto_sync` defaults on when sources exist).
- Whether any adopters use plain-http feed or API URLs.
