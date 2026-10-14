/* =====================================================================
 *  可选的第二种后端：Cloudflare Worker + D1（不想用 Supabase 时用这个）
 *
 *  部署：
 *    npm i -g wrangler
 *    wrangler login
 *    wrangler d1 create reflex-lab          # 把输出的 database_id 填进 wrangler.toml
 *    wrangler d1 execute reflex-lab --file=d1-schema.sql --remote
 *    wrangler deploy
 *  最后把部署出来的 https://xxx.workers.dev 填进 assets/js/config.js 的 rest.baseUrl。
 * ===================================================================== */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const LIMITS = {
  nameMax: 14,
  avatarMax: 20000,
  minMs: 55,
  maxMs: 5000,
  perDevicePerMinute: 8,
  perNamePerMinute: 6,
};

const BOARD_SQL = `
  select name, avatar, average, best, worst,
         early_starts as earlyStarts, trials,
         month_key as monthKey, created_at as createdAt
  from (
    select *, row_number() over (partition by lower(name) order by average asc, created_at asc) as rn
    from scores
  )
  where rn = 1 and (?1 = 'all' or month_key = ?2)
  order by average asc
  limit ?3`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS),
  });
}

function monthKeyUtc8() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

function clean(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/health') return json({ ok: true, monthKey: monthKeyUtc8() });

    /* ---------- 提交成绩 ---------- */
    if (url.pathname === '/scores' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: '请求体不是合法 JSON' }, 400); }

      const name = clean(body.name, LIMITS.nameMax);
      const avatar = String(body.avatar || '');
      const average = Number(body.average);
      const best = Math.round(Number(body.best));
      const worst = Math.round(Number(body.worst));
      const earlyStarts = Math.min(50, Math.max(0, Math.round(Number(body.earlyStarts) || 0)));
      const trials = Math.min(50, Math.max(1, Math.round(Number(body.trials) || 10)));

      if (!name) return json({ error: '昵称不能为空' }, 400);
      if (!avatar || avatar.length > LIMITS.avatarMax) return json({ error: '头像数据不合法' }, 400);
      if (!isFinite(average) || average < LIMITS.minMs || average > LIMITS.maxMs) {
        return json({ error: '平均成绩超出可信范围' }, 400);
      }
      if (!isFinite(best) || best < 40 || !isFinite(worst) || worst > LIMITS.maxMs) {
        return json({ error: '单次成绩超出可信范围' }, 400);
      }

      const monthKey = monthKeyUtc8();
      const deviceId = clean(body.deviceId, 32);

      const recent = await env.DB.prepare(
        `select
           (select count(*) from scores where device_id = ?1 and created_at > datetime('now','-1 minute')) as byDevice,
           (select count(*) from scores where lower(name) = lower(?2) and created_at > datetime('now','-1 minute')) as byName`
      ).bind(deviceId, name).first();

      if (recent.byDevice >= LIMITS.perDevicePerMinute) return json({ error: '提交太频繁，稍后再试' }, 429);
      if (recent.byName >= LIMITS.perNamePerMinute) return json({ error: '这个昵称提交太频繁了' }, 429);

      await env.DB.prepare(
        `insert into scores (name, avatar, average, best, worst, early_starts, trials, month_key, refresh_hz, device_id, raw)
         values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      ).bind(
        name, avatar, Math.round(average * 10) / 10, best, worst, earlyStarts, trials,
        monthKey, Number(body.refreshHz) || null, deviceId, JSON.stringify(body.raw || []).slice(0, 2000)
      ).run();

      const rows = await env.DB.prepare(BOARD_SQL).bind('all', monthKey, 500).all();
      const list = rows.results || [];
      const rank = list.findIndex((r) => String(r.name).toLowerCase() === name.toLowerCase()) + 1;
      return json({ ok: true, rank: rank || null, total: list.length, monthKey });
    }

    /* ---------- 取榜单 ---------- */
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      const scope = url.searchParams.get('scope') === 'month' ? 'month' : 'all';
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));
      const rows = await env.DB.prepare(BOARD_SQL).bind(scope, monthKeyUtc8(), limit).all();
      return json({ rows: rows.results || [], scope: scope, monthKey: monthKeyUtc8() });
    }

    return json({ error: 'not found' }, 404);
  },
};
