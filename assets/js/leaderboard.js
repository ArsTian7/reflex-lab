/* =====================================================================
 *  排行榜数据层
 *
 *  三种后端，用 config.js 里的 backend 一行切换：
 *    local    —— localStorage，只有自己看得到（默认，方便预览）
 *    supabase —— 直连 Supabase REST，无需自建服务器（推荐）
 *    rest     —— 自建接口，仓库 server/ 里有现成的 Cloudflare Worker
 *
 *  统一数据结构（camelCase）：
 *    { name, avatar, average, best, worst, earlyStarts, trials, monthKey, createdAt }
 * ===================================================================== */
(function () {
  'use strict';

  var CFG = window.REFLEX_CONFIG;
  var S = window.ReflexStore;
  var LOCAL_KEY = 'reflex.scores.local.v1';

  function lower(s) { return String(s || '').trim().toLowerCase(); }

  /* 带超时的 fetch：地址写错或网络不通时，别让用户一直盯着骨架屏 */
  function fetchT(url, opts, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 12000);
    var o = Object.assign({}, opts || {});
    if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (err) {
      clearTimeout(timer);
      var e = new Error(err && err.name === 'AbortError' ? '请求超时（12 秒）' : '网络请求失败');
      e.status = 0;
      throw e;
    });
  }

  /* ---------- 通用：同名只留最快的一次平均成绩 ---------- */
  function bestPerName(rows) {
    var map = {};
    rows.forEach(function (r) {
      var key = lower(r.name);
      if (!key) return;
      var cur = map[key];
      if (!cur || r.average < cur.average) map[key] = r;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function byAverage(a, b) {
    if (a.average !== b.average) return a.average - b.average;
    return Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);
  }

  function shape(rows, scope) {
    var out = bestPerName(rows);
    if (scope === 'month') {
      var mk = S.monthKeyOf();
      out = out.filter(function (r) { return r.monthKey === mk; });
    }
    out.sort(byAverage);
    return out.slice(0, CFG.boardLimit);
  }

  /* =====================================================
   *  本地模式
   * ===================================================== */
  var LOCAL = (function () {
    var DEMO = [
      { name: '闪电小王', avatar: 'preset:cat', average: 187, best: 164 },
      { name: 'Pixel', avatar: 'preset:penguin', average: 198, best: 172 },
      { name: '不吃香菜', avatar: 'preset:panda', average: 209, best: 183 },
      { name: 'Kuro', avatar: 'preset:owl', average: 218, best: 191 },
      { name: '芋泥啵啵', avatar: 'preset:rabbit', average: 226, best: 198 },
      { name: 'Mika', avatar: 'preset:fox', average: 234, best: 205 },
      { name: '键盘杀手', avatar: 'preset:chick', average: 247, best: 219 },
      { name: 'Nova', avatar: 'preset:frog', average: 258, best: 231 },
      { name: '午后困觉', avatar: 'preset:bear', average: 271, best: 240 },
      { name: '阿柴本柴', avatar: 'preset:shiba', average: 284, best: 252 },
      { name: 'Lulu', avatar: 'preset:koala', average: 299, best: 268 },
      { name: '小粉猪', avatar: 'preset:pig', average: 316, best: 283 },
    ];

    function seed() {
      var list = read();
      if (list && list.length) return list;
      var mk = S.monthKeyOf();
      var prev = S.monthKeyOf(Date.now() - 32 * 86400000);
      var rows = DEMO.map(function (d, i) {
        var isPrev = i % 4 === 3;
        var t = Date.now() - (i * 5 + 2) * 3600000 - (isPrev ? 32 * 86400000 : 0);
        return {
          name: d.name, avatar: d.avatar,
          average: d.average, best: d.best, worst: d.average + 60 + i * 4,
          earlyStarts: (i % 3), trials: CFG.trials,
          monthKey: isPrev ? prev : mk,
          createdAt: new Date(t).toISOString(),
          demo: true,
        };
      });
      write(rows);
      return rows;
    }

    function read() {
      try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); }
      catch (e) { return null; }
    }
    function write(rows) {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows)); } catch (e) { /* 忽略 */ }
    }

    return {
      fetch: function (scope) {
        return Promise.resolve(shape(seed(), scope));
      },
      submit: function (entry) {
        var rows = seed();
        rows.forEach(function (r) { if (lower(r.name) === lower(entry.name)) delete r.demo; });
        rows.push(Object.assign({}, entry));
        write(rows);
        var ranked = shape(rows, 'all');
        var rank = ranked.findIndex(function (r) { return lower(r.name) === lower(entry.name); }) + 1;
        return Promise.resolve({ ok: true, rank: rank || null, total: ranked.length });
      },
      clearMine: function (name) {
        write(seed().filter(function (r) { return lower(r.name) !== lower(name); }));
      },
    };
  })();

  /* =====================================================
   *  Supabase（直连 REST，无需自建服务器）
   * ===================================================== */
  var SB = (function () {
    function conf() { return CFG.supabase || {}; }
    function keyIssue() {
      var k = String(conf().anonKey || '');
      if (!conf().url || !k) return 'missing';
      /* secret / service_role 属于服务端密钥，放进前端等于把数据库钥匙公开 */
      if (/^sb_secret_/i.test(k) || k.indexOf('service_role') >= 0) return 'secret';
      return null;
    }
    function ready() { return keyIssue() === null; }
    function base() { return String(conf().url).replace(/\/+$/, '') + '/rest/v1'; }
    function headers(extra) {
      var h = {
        'apikey': conf().anonKey,
        'Authorization': 'Bearer ' + conf().anonKey,
        'Content-Type': 'application/json',
      };
      return Object.assign(h, extra || {});
    }
    function fail(res, text) {
      var err = new Error(text || ('HTTP ' + res.status));
      err.status = res.status;
      return err;
    }
    function mapRow(r) {
      return {
        name: r.player_name,
        avatar: r.avatar,
        average: Number(r.average_ms),
        best: Number(r.best_ms),
        worst: Number(r.worst_ms),
        earlyStarts: Number(r.false_starts || 0),
        trials: Number(r.trials || CFG.trials),
        monthKey: r.month_key,
        createdAt: r.created_at,
      };
    }

    return {
      fetch: function (scope) {
        var view = scope === 'month' ? (conf().viewMonth || 'leaderboard_month') : (conf().viewAll || 'leaderboard_all');
        var q = base() + '/' + view +
          '?select=player_name,avatar,average_ms,best_ms,worst_ms,false_starts,trials,month_key,created_at' +
          '&order=average_ms.asc&limit=' + CFG.boardLimit;
        return fetchT(q, { headers: headers(), cache: 'no-store' }).then(function (res) {
          if (!res.ok) return res.text().then(function (t) { throw fail(res, t); });
          return res.json();
        }).then(function (rows) {
          return rows.map(mapRow).sort(byAverage);
        });
      },
      submit: function (entry) {
        var body = {
          player_name: entry.name,
          avatar: entry.avatar,
          average_ms: Number(entry.average.toFixed(1)),
          best_ms: Math.round(entry.best),
          worst_ms: Math.round(entry.worst),
          false_starts: entry.earlyStarts,
          trials: entry.trials,
          month_key: entry.monthKey,
          platform: entry.platform || '',
          refresh_hz: entry.refreshHz || null,
          device_id: S.deviceId(),
          raw: entry.trials,
        };
        return fetchT(base() + '/' + (conf().table || 'scores'), {
          method: 'POST',
          headers: headers({ 'Prefer': 'return=minimal' }),
          body: JSON.stringify(body),
        }).then(function (res) {
          if (!res.ok) return res.text().then(function (t) { throw fail(res, t); });
          return { ok: true };
        }).then(function () {
          return SB.fetch('all');
        }).then(function (rows) {
          var rank = rows.findIndex(function (r) { return lower(r.name) === lower(entry.name); }) + 1;
          var mine = rows[rank - 1];
          return {
            ok: true,
            rank: mine && mine.average === Math.round(entry.average * 10) / 10 ? rank : (rank || null),
            total: rows.length,
            isNewBest: !!mine && Math.abs(mine.average - entry.average) < 0.05,
          };
        });
      },
      ready: ready,
      keyIssue: keyIssue,
    };
  })();

  /* =====================================================
   *  自建 REST 接口（server/ 里的 Cloudflare Worker）
   * ===================================================== */
  var REST = (function () {
    function conf() { return CFG.rest || {}; }
    function ready() { return !!conf().baseUrl; }
    function base() { return String(conf().baseUrl).replace(/\/+$/, ''); }

    return {
      fetch: function (scope) {
        var url = base() + '/leaderboard?scope=' + (scope === 'month' ? 'month' : 'all') + '&limit=' + CFG.boardLimit;
        return fetchT(url, { cache: 'no-store' }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        }).then(function (data) {
          var rows = (data.rows || data || []).map(function (r) {
            return {
              name: r.name || r.playerName,
              avatar: r.avatar,
              average: Number(r.average != null ? r.average : r.averageMs),
              best: Number(r.best != null ? r.best : r.bestMs),
              worst: Number(r.worst != null ? r.worst : r.worstMs),
              earlyStarts: Number(r.earlyStarts || 0),
              trials: Number(r.trials || CFG.trials),
              monthKey: r.monthKey,
              createdAt: r.createdAt,
            };
          });
          return rows.sort(byAverage);
        });
      },
      submit: function (entry) {
        return fetchT(base() + '/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: entry.name, avatar: entry.avatar,
            average: Number(entry.average.toFixed(1)), best: Math.round(entry.best),
            worst: Math.round(entry.worst), earlyStarts: entry.earlyStarts,
            trials: entry.trials, monthKey: entry.monthKey,
            deviceId: S.deviceId(), refreshHz: entry.refreshHz || null, raw: entry.trials,
          }),
        }).then(function (res) {
          if (!res.ok) return res.text().then(function (t) { throw new Error(t || ('HTTP ' + res.status)); });
          return res.json();
        });
      },
      ready: ready,
    };
  })();

  /* ---------- 选择一个实现 ---------- */
  var chosen = CFG.backend;
  var impl = LOCAL;
  var fellBack = false;

  var fallReason = null;

  if (chosen === 'supabase') {
    if (SB.ready()) impl = SB;
    else { fellBack = true; fallReason = SB.keyIssue() === 'secret' ? 'secret' : 'missing'; }
  } else if (chosen === 'rest') {
    if (REST.ready()) impl = REST; else { fellBack = true; fallReason = 'missing'; }
  }

  function describe() {
    if (fellBack) {
      return {
        mode: 'local', online: false, fellBack: true, reason: fallReason,
        text: fallReason === 'secret' ? '本地模式（密钥用错了）' : '本地模式（缺配置）',
      };
    }
    if (impl === SB) return { mode: 'supabase', online: true, text: '在线 · Supabase', fellBack: false, reason: null };
    if (impl === REST) return { mode: 'rest', online: true, text: '在线 · 自建接口', fellBack: false, reason: null };
    return { mode: 'local', online: false, text: '本地模式', fellBack: false, reason: null };
  }

  window.ReflexBoard = {
    fetch: function (scope) { return impl.fetch(scope || 'all'); },
    submit: function (entry) { return impl.submit(entry); },
    clearMine: LOCAL.clearMine,
    status: describe,
    _shape: shape,
    _bestPerName: bestPerName,
    _byAverage: byAverage,
  };
})();
