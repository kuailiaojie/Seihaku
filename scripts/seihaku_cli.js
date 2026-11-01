/**
 * 🍃 栖白 (Theme Seihaku) - 交互式脚手架与命令行管理工具
 *
 * 命令支持：
 * 1. hexo seihaku:init    一键初始化全套特色页面与示例数据文件 (source/_data)
 * 2. hexo seihaku:sync    手动触发外部平台（Bilibili、GitHub 等）数据同步
 */

const fs = require('fs');
const path = require('path');
const { syncAll } = require('./platform_sync');

// 页面定义列表：路径、布局、标题、描述
const SEIHAKU_PAGES = [
  { path: 'about/index.md', layout: 'about', title: '关于栖白', desc: '关于作者与本站的余白印记。' },
  { path: 'archives/index.md', layout: 'archive', title: '文稿归档', desc: '字句流转，岁月成篇。' },
  { path: 'bangumis/index.md', layout: 'bangumis', title: '二次元追番录', desc: '记录感动、治愈与沉思的动画作品。' },
  { path: 'categories/index.md', layout: 'categories', title: '分类专栏', desc: '结构化知识沉淀与分类探索。' },
  { path: 'docs/index.md', layout: 'docs', title: '知识文档中心', desc: '系统性知识脉络与工程设计手册。' },
  { path: 'equipments/index.md', layout: 'equipments', title: '我的装备', desc: '工欲善其事，必先利其器。' },
  { path: 'friendcircle/index.md', layout: 'friendcircle', title: '友邻朋友圈', desc: '去中心化 RSS 动态聚合流。' },
  { path: 'friends/index.md', layout: 'friends', title: '友邻聚落', desc: '海内存知己，天涯若比邻。' },
  { path: 'guestbook/index.md', layout: 'guestbook', title: '访客留言', desc: '留下你的回响与微光印记。' },
  { path: 'notes/index.md', layout: 'notes', title: '微语手记', desc: '杂志级沉浸手记与灵感漫步。' },
  { path: 'photos/index.md', layout: 'photos', title: '光影画廊', desc: '定格天地苍茫与微小刹那。' },
  { path: 'portfolio/index.md', layout: 'portfolio', title: '精选项目展厅', desc: '心之所向，素履以往。' },
  { path: 'steam/index.md', layout: 'steam', title: 'Steam 游戏展馆', desc: '在数字虚拟世界中的沉浸探索。' },
  { path: 'tags/index.md', layout: 'tags', title: '标签画廊', desc: '灵感与思维脉络。' },
  { path: 'timeline/index.md', layout: 'timeline', title: '时光足迹', desc: '流年暗中偷换，记录生命痕迹。' }
];

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 注册 hexo seihaku:init 命令
hexo.extend.console.register('seihaku:init', '一键初始化 🍃 栖白 主题的全部页面和示例数据', {
  options: [
    { name: '--force', desc: '覆盖已存在的文件' }
  ]
}, async function (args) {
  const force = !!args.force;
  const sourceDir = hexo.source_dir || path.join(hexo.base_dir, 'source');
  const defaultDataDir = path.join(__dirname, '../default_data');
  const targetDataDir = path.join(sourceDir, '_data');

  console.log('\n🍃 开始初始化「栖白 (Seihaku)」主题全套页面与数据...\n');

  // 1. 初始化 source/_data 数据范例文件
  ensureDir(path.join(targetDataDir, 'dummy.txt'));
  let dataCount = 0;
  if (fs.existsSync(defaultDataDir)) {
    const files = fs.readdirSync(defaultDataDir);
    files.forEach(f => {
      const srcFile = path.join(defaultDataDir, f);
      const destFile = path.join(targetDataDir, f);
      if (!fs.existsSync(destFile) || force) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`  ✓ 创建数据文件: source/_data/${f}`);
        dataCount++;
      } else {
        console.log(`  - 数据文件已存在 (跳过): source/_data/${f}`);
      }
    });
  }

  // 2. 初始化各特色页面
  let pageCount = 0;
  SEIHAKU_PAGES.forEach(p => {
    const fullPath = path.join(sourceDir, p.path);
    if (!fs.existsSync(fullPath) || force) {
      ensureDir(fullPath);
      const content = `---
title: ${p.title}
date: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}
layout: ${p.layout}
---

> ${p.desc}
`;
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`  ✓ 创建页面: source/${p.path} (layout: ${p.layout})`);
      pageCount++;
    } else {
      console.log(`  - 页面已存在 (跳过): source/${p.path}`);
    }
  });

  // 3. 根目录 _config.seihaku.yml 模板初始化（配置与主题版本安全解耦）
  const rootCustomConfig = path.join(hexo.base_dir, '_config.seihaku.yml');
  const themeDefaultConfig = path.join(__dirname, '../_config.yml');
  if (!fs.existsSync(rootCustomConfig) && fs.existsSync(themeDefaultConfig)) {
    try {
      fs.copyFileSync(themeDefaultConfig, rootCustomConfig);
      console.log('  ✓ 创建解耦配置文件: 博客根目录/_config.seihaku.yml');
      console.log('    (提示：未来所有个性化配置请在此文件中修改，升级主题绝不冲突)');
    } catch (e) {
      console.warn('  - 创建 _config.seihaku.yml 失败:', e.message);
    }
  }

  // 4. 依赖检测建议
  console.log('\n📦 检查常用依赖环境:');
  const rootPkgPath = path.join(hexo.base_dir, 'package.json');
  let hasFeed = false;
  if (fs.existsSync(rootPkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      hasFeed = !!deps['hexo-generator-feed'];
    } catch (e) {}
  }
  if (!hasFeed) {
    console.log('  ⚠️  建议安装 RSS 插件以启用 /atom.xml：npm install hexo-generator-feed --save');
  } else {
    console.log('  ✓ hexo-generator-feed 插件已就绪');
  }

  console.log(`\n🎉 初始化完成！共创建/更新 ${pageCount} 个页面，${dataCount} 个示例数据文件。`);
  console.log('💡 推荐规范：所有个性化配置请优先在根目录 `_config.seihaku.yml` 中维护。');
  console.log('运行 hexo server 即可预览 🍃 栖白 纯净美学空间！\n');
});

// 注册 hexo seihaku:sync 命令
hexo.extend.console.register('seihaku:sync', '手动同步 🍃 栖白 外部平台数据 (Bilibili/GitHub)', {}, async function () {
  console.log('\n🍃 开始同步外部平台数据...');
  const themeCfg = hexo.theme.config || {};
  const sourceDir = hexo.source_dir || path.join(hexo.base_dir, 'source');
  await syncAll(themeCfg, sourceDir);
  console.log('🎉 平台数据同步完成！\n');
});

// 注册 hexo seihaku:doctor 简易自检诊断命令
hexo.extend.console.register('seihaku:doctor', '自检 🍃 栖白 运行环境与必要依赖完整性', {}, function () {
  console.log('\n🍃 正在进行「栖白 (Seihaku)」运行环境体检...\n');
  const checks = [];

  // 1. Node & Hexo 环境检测
  checks.push({
    title: `Node.js 运行环境 (${process.version})`,
    pass: parseInt(process.versions.node.split('.')[0], 10) >= 16
  });

  const rootPkgPath = path.join(hexo.base_dir, 'package.json');
  let rootDeps = {};
  if (fs.existsSync(rootPkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      rootDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    } catch (e) {}
  }

  checks.push({
    title: '全站 RSS 订阅生成器 (hexo-generator-feed)',
    pass: !!rootDeps['hexo-generator-feed'],
    tip: 'npm install hexo-generator-feed --save'
  });

  checks.push({
    title: '解耦配置文件 (_config.seihaku.yml)',
    pass: fs.existsSync(path.join(hexo.base_dir, '_config.seihaku.yml')),
    tip: '运行 hexo seihaku:init 自动生成'
  });

  const sourceDataDir = path.join(hexo.base_dir, 'source/_data');
  checks.push({
    title: '特色专栏数据目录 (source/_data)',
    pass: fs.existsSync(sourceDataDir) && fs.readdirSync(sourceDataDir).length > 0,
    tip: '运行 hexo seihaku:init 自动生成示例数据'
  });

  checks.forEach(c => {
    if (c.pass) {
      console.log(`  ✓ ${c.title}`);
    } else {
      console.log(`  ⚠️  ${c.title} (建议: ${c.tip || '未通过'})`);
    }
  });

  console.log('\n体检完成！若各项就绪，请尽情享受写作。\n');
});
