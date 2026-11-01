/**
 * 🍃 栖白 (Theme Seihaku) - 多项目文档中心辅助引擎 (Multi-Project Docs Helper Engine)
 * 功能：
 * 1. seihaku_doc_projects() - 解析全站文档项目知识库与判断当前页面形态 (主界面 vs 分文档工作台)
 * 2. seihaku_parse_doc_toc() - 动态解析任意文档 Markdown 内容的 H2/H3 目录结构
 */

'use strict';

hexo.extend.helper.register('seihaku_doc_projects', function () {
  const site = this.site || {};
  const page = this.page || {};
  const rawList = (site.data && site.data.docs) ? site.data.docs : [];

  const currentPath = (page.path || '').replace(/index\.html$/, '').replace(/^\/|\/$/g, '');
  const isDocsHome = Boolean(page.doc_home) || currentPath === 'docs' || currentPath === '';

  let activeProject = null;
  const projects = rawList.map((item, index) => {
    const projUrl = item.url || `/docs/${item.id || ''}/`;
    const cleanUrl = projUrl.replace(/^\/|\/$/g, '');

    const isMatch = !isDocsHome && (
      (item.id && page.doc_project === item.id) ||
      (cleanUrl && currentPath === cleanUrl) ||
      (cleanUrl && cleanUrl !== 'docs' && currentPath.startsWith(cleanUrl))
    );

    const proj = {
      id: item.id || `doc-${index}`,
      title: item.title || '未命名文档',
      icon: item.icon || 'fas fa-book',
      desc: item.desc || '',
      url: projUrl,
      tag: item.tag || '通用',
      articles_count: item.articles_count || 0,
      updated_at: item.updated_at || '',
      chapters: item.chapters || [],
      is_current: false
    };

    if (isMatch && !activeProject) {
      proj.is_current = true;
      activeProject = proj;
    }
    return proj;
  });

  return {
    is_home: isDocsHome,
    projects: projects,
    current: activeProject
  };
});

hexo.extend.helper.register('seihaku_parse_doc_toc', function (content) {
  if (!content) return [];
  const headingRegex = /<h([23])\s+[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi;
  const items = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1], 10);
    const id = match[2];
    const rawTitle = match[3].replace(/<[^>]+>/g, '').trim();

    // 匹配如 01. 或 1. 或 一、 等前缀
    const numMatch = rawTitle.match(/^(\d+[\.、]\s*|第[一二三四五六七八九十]+[章节部分][\s：:]*)/);
    let indexStr = '';
    let displayTitle = rawTitle;
    if (numMatch) {
      indexStr = numMatch[0];
      displayTitle = rawTitle.slice(indexStr.length).trim();
    }

    if (level === 2) {
      items.push({
        level: 2,
        id: id,
        title: displayTitle,
        fullTitle: rawTitle,
        indexStr: indexStr,
        children: []
      });
    } else if (level === 3 && items.length > 0) {
      items[items.length - 1].children.push({
        level: 3,
        id: id,
        title: displayTitle,
        fullTitle: rawTitle
      });
    }
  }

  return items;
});
