/**
 * 🍃 栖白 (Theme Seihaku) - 平台数据与友邻 RSS 同步钩子
 * 在 Hexo 生成静态站点前，若开启对应 auto_sync 则自动拉取最新 Bilibili、GitHub 与友邻朋友圈 RSS 数据
 * 完全内聚在主题内部，零外部依赖
 */

const path = require('path');
const { syncAll } = require('./platform_sync');

hexo.extend.filter.register('before_generate', async function () {
  if (hexo.__seihaku_platform_synced) return;
  hexo.__seihaku_platform_synced = true;

  const themeCfg = hexo.theme.config || {};
  const platforms = themeCfg.platforms || {};
  const portfolio = themeCfg.portfolio || {};
  const fcCfg = themeCfg.friendcircle || {};
  const friendsCfg = themeCfg.friends || {};

  const shouldSyncBili = platforms.bilibili && platforms.bilibili.enable && platforms.bilibili.auto_sync;
  const shouldSyncGitHub = (portfolio.github && portfolio.github.auto_sync) || (platforms.github && platforms.github.auto_sync);
  const shouldSyncFriendcircle = fcCfg.enable !== false && fcCfg.auto_sync !== false && (
    (Array.isArray(fcCfg.sources) && fcCfg.sources.length > 0) ||
    (Array.isArray(friendsCfg.list) && friendsCfg.list.some(f => f.rss || f.feed))
  );

  if (shouldSyncBili || shouldSyncGitHub || shouldSyncFriendcircle) {
    try {
      const sourceDir = hexo.source_dir || path.join(hexo.base_dir, 'source');
      await syncAll(themeCfg, sourceDir);
    } catch (e) {
      hexo.log.warn('[Theme Seihaku Sync] Error syncing platform data:', e.message);
    }
  }
});
