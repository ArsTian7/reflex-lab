/* =====================================================================
 *  Reaction Lab · 站点配置
 *  改完直接刷新页面即可生效，不需要任何构建步骤。
 * ===================================================================== */
window.REFLEX_CONFIG = {
  /* 排行榜数据源：
   *   'local'    —— 默认。数据存在浏览器里，只有自己看得到，适合本地预览。
   *   'supabase' —— 推荐。填下面的 url / anonKey，全站共享的在线排行榜。见 README 第 3 节。
   *   'rest'     —— 自建 HTTP 接口（仓库内 server/ 有现成的 Cloudflare Worker）。
   */
  backend: 'supabase',

  supabase: {
    url: 'https://iukxmvpzxjbbymaehjft.supabase.co',          // 已接通
    anonKey: 'sb_publishable_DtWS1EnKV6x_rvm_isZQxA_ORg8wYu1', // publishable key，可公开；权限由数据库 RLS 控制
    table: 'scores',
    viewAll: 'leaderboard_all',
    viewMonth: 'leaderboard_month',
  },

  rest: {
    baseUrl: '',        // 例：https://reflex-lab.your-name.workers.dev
  },

  /* 测试参数 */
  trials: 10,           // 每次测试的次数，取平均值
  minValidMs: 55,       // 低于这个值视为无效点击（人类极限之下），该次重测
  maxValidMs: 5000,     // 高于这个值视为走神，该次重测
  waitMinMs: 1100,      // 红灯最短等待
  waitMaxMs: 3200,      // 红灯最长等待

  /* 排行榜 */
  boardLimit: 100,          // 榜单最多显示多少名
  monthOffsetMinutes: 480,  // 月榜按 UTC+8（480 分钟）的自然月切换
  minSubmitMs: 120000,      // 同一浏览器的提交冷却（毫秒）
  repoUrl: 'https://github.com/ArsTian7/reflex-lab',
};
