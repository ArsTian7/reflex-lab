/* =====================================================================
 *  管理后台逻辑
 *  · 所有破坏性操作都走数据库里的 SECURITY DEFINER 函数，密码在服务端用 bcrypt 校验
 *  · 前端只带 publishable key（本来就可公开），拿不到密码哈希，也绕不过校验
 * ===================================================================== */
(function () {
  'use strict';

  var CFG = window.REFLEX_CONFIG || {};
  var SB = CFG.supabase || {};
  var A = window.ReflexAvatars;
  var BASE = String(SB.url || '').replace(/\/+$/, '');
  var KEY = SB.anonKey || '';
  var SESSION_KEY = 'reflex.admin.pwd';

  var el = function (id) { return document.getElementById(id); };
  var pwd = '';
  var rows = [];
  var bans = [];

  /* ---------------- 小工具 ---------------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function toast(msg, kind, ms) {
    var box = el('toasts');
    var node = document.createElement('div');
    node.className = 'toast' + (kind ? ' toast-' + kind : '');
    node.textContent = msg;
    box.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('in'); });
    setTimeout(function () {
      node.classList.remove('in');
      setTimeout(function () { node.remove(); }, 320);
    }, ms || 3600);
  }

  function fmt(v, d) {
    return v == null || isNaN(v) ? '—' : Number(v).toFixed(d == null ? 1 : d);
  }

  function formatTime(iso) {
    var t = Date.parse(iso);
    if (!t) return '—';
    var d = new Date(t + 8 * 3600000); /* 统一按 UTC+8 显示 */
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + ' ' +
      p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
  }

  function short(s, n) {
    s = String(s || '');
    return s.length > (n || 12) ? s.slice(0, n || 12) + '…' : s;
  }

  function errText(err) {
    var msg = String((err && err.message) || err || '未知错误');
    var code = err && err.code;
    if (code === 'PGRST202' || msg.indexOf('Could not find the function') >= 0) {
      return '数据库里还没有管理员函数：请先在 Supabase 的 SQL Editor 里执行 supabase/admin.sql';
    }
    if (code === '28P01') return '密码错误';
    if (msg.indexOf('还没有设置管理员密码') >= 0) return msg;
    if (msg.indexOf('次数过多') >= 0) return msg;
    if (msg.indexOf('封禁') >= 0) return msg;
    if (err && err.status === 0) return '网络连不上 Supabase，检查网络后重试';
    return msg.length > 120 ? msg.slice(0, 120) + '…' : msg;
  }

  /* ---------------- 请求 ---------------- */
  function headers(extra) {
    return Object.assign({
      'apikey': KEY,
      'Authorization': 'Bearer ' + KEY,
      'Content-Type': 'application/json',
    }, extra || {});
  }

  function rpc(name, args) {
    return fetch(BASE + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(args || {}),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { /* 非 JSON */ }
        if (!res.ok) {
          var err = new Error((data && (data.message || data.hint)) || text || ('HTTP ' + res.status));
          err.code = data && data.code;
          throw err;
        }
        return data;
      });
    }, function () {
      var err = new Error('网络请求失败');
      err.status = 0;
      throw err;
    });
  }

  function getJson(path) {
    return fetch(BASE + '/rest/v1/' + path, { headers: headers(), cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t); });
        return res.json();
      }, function () {
        var err = new Error('网络请求失败');
        err.status = 0;
        throw err;
      });
  }

  /* ---------------- 登录 ---------------- */
  function paintBackendChip() {
    var chip = el('chipBackend');
    if (!BASE || !KEY) {
      chip.textContent = 'config.js 还没填 Supabase 地址';
      chip.className = 'chip is-local';
      return false;
    }
    chip.textContent = '在线 · Supabase';
    chip.title = BASE;
    chip.className = 'chip is-online';
    return true;
  }

  function login() {
    var v = el('pwd').value;
    if (!v) { el('loginNote').textContent = '请输入密码'; el('loginNote').className = 'field-note state-error'; return; }
    el('btnLogin').disabled = true;
    el('loginNote').textContent = '正在校验…';
    el('loginNote').className = 'field-note';

    rpc('admin_verify', { p_password: v }).then(function () {
      pwd = v;
      try { sessionStorage.setItem(SESSION_KEY, v); } catch (e) { /* 忽略 */ }
      el('btnLogin').disabled = false;
      el('loginPanel').hidden = true;
      el('console').hidden = false;
      el('chipWho').textContent = '已登录（本次会话）';
      el('chipWho').className = 'chip is-online';
      el('pwOld').value = v;
      el('loginNote').textContent = '登录成功后密码只在本次会话中记住，关掉标签页就失效。';
      el('loginNote').className = 'field-note';
      toast('登录成功', 'ok', 2000);
      return loadAll();
    }).catch(function (err) {
      el('btnLogin').disabled = false;
      var msg = errText(err);
      el('loginNote').textContent = msg;
      el('loginNote').className = 'field-note state-error';
      el('pwd').classList.add('shake');
      setTimeout(function () { el('pwd').classList.remove('shake'); }, 700);
      toast(msg, 'error', 5000);
    });
  }

  function logout() {
    pwd = '';
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* 忽略 */ }
    el('console').hidden = true;
    el('loginPanel').hidden = false;
    el('pwd').value = '';
    el('chipWho').textContent = '未登录';
    el('chipWho').className = 'chip';
    el('loginNote').textContent = '已退出。密码只在本次会话中记住。';
    el('loginNote').className = 'field-note';
  }

  /* ---------------- 数据 ---------------- */
  function loadAll() {
    return Promise.all([
      getJson('scores?select=id,player_name,avatar,average_ms,best_ms,worst_ms,false_starts,trials,month_key,device_id,created_at&order=created_at.desc&limit=1000'),
      getJson('banned_players?select=id,name,device_id,reason,created_at&order=created_at.desc&limit=500'),
    ]).then(function (res) {
      rows = res[0] || [];
      bans = res[1] || [];
      renderRows();
      renderBans();
      return true;
    }).catch(function (err) {
      var msg = errText(err);
      toast(msg, 'error', 6000);
      el('statLine').textContent = '读取失败：' + msg;
      return false;
    });
  }

  function isBanned(row) {
    var nm = String(row.player_name || '').trim().toLowerCase();
    var dev = String(row.device_id || '');
    return bans.some(function (b) {
      var bn = String(b.name || '').trim().toLowerCase();
      var bd = String(b.device_id || '');
      return (bn && bn === nm) || (bd && dev && bd === dev);
    });
  }

  function renderRows() {
    var q = String(el('search').value || '').trim().toLowerCase();
    var list = q ? rows.filter(function (r) {
      return String(r.player_name || '').toLowerCase().indexOf(q) >= 0 ||
        String(r.device_id || '').toLowerCase().indexOf(q) >= 0;
    }) : rows;

    var months = {};
    var players = {};
    rows.forEach(function (r) {
      months[r.month_key] = (months[r.month_key] || 0) + 1;
      players[String(r.player_name || '').trim().toLowerCase()] = 1;
    });
    var nowKey = (function () {
      var d = new Date(Date.now() + 8 * 3600000);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
    })();
    el('statLine').textContent = '共 ' + rows.length + ' 条成绩 · ' + Object.keys(players).length + ' 位玩家 · 本月 ' +
      (months[nowKey] || 0) + ' 条 · 黑名单 ' + bans.length + ' 条';

    el('empty').hidden = list.length > 0;
    el('rows').innerHTML = list.map(function (r) {
      var banned = isBanned(r);
      return '<tr class="' + (banned ? 'is-banned' : '') + '">' +
        '<td class="mono">' + r.id + '</td>' +
        '<td><div class="pl"><span class="mini-av" style="width:26px;height:26px">' + A.html(r.avatar) + '</span>' +
          '<span class="pl-name">' + escapeHtml(r.player_name) + (banned ? ' <i class="you" style="background:#ff8f8f">已封</i>' : '') + '</span></div></td>' +
        '<td class="c-num"><b class="ms">' + fmt(r.average_ms) + '</b></td>' +
        '<td class="c-num">' + Math.round(r.best_ms) + '</td>' +
        '<td class="c-num ' + (r.false_starts ? 'warn' : '') + '">' + (r.false_starts || 0) + '</td>' +
        '<td class="mono">' + escapeHtml(r.month_key) + '</td>' +
        '<td class="mono" title="' + escapeHtml(r.device_id || '') + '">' + escapeHtml(short(r.device_id, 12)) + '</td>' +
        '<td class="c-time">' + formatTime(r.created_at) + '</td>' +
        '<td class="c-act"><span class="row-actions">' +
          '<button class="mini-btn danger" data-act="del-row" data-id="' + r.id + '">删这条</button>' +
          '<button class="mini-btn danger" data-act="del-player" data-name="' + escapeHtml(r.player_name) + '">删他全部</button>' +
          '<button class="mini-btn warn" data-act="ban" data-name="' + escapeHtml(r.player_name) + '" data-device="' + escapeHtml(r.device_id || '') + '">封禁</button>' +
        '</span></td>' +
        '</tr>';
    }).join('');
  }

  function renderBans() {
    el('banEmpty').hidden = bans.length > 0;
    el('bans').innerHTML = bans.map(function (b) {
      return '<tr>' +
        '<td class="mono">' + b.id + '</td>' +
        '<td>' + (b.name ? escapeHtml(b.name) : '<span class="dim">—</span>') + '</td>' +
        '<td class="mono" title="' + escapeHtml(b.device_id || '') + '">' + (b.device_id ? escapeHtml(short(b.device_id, 12)) : '<span class="dim">—</span>') + '</td>' +
        '<td>' + (b.reason ? escapeHtml(b.reason) : '<span class="dim">—</span>') + '</td>' +
        '<td class="c-time">' + formatTime(b.created_at) + '</td>' +
        '<td class="c-act"><span class="row-actions"><button class="mini-btn" data-act="unban" data-id="' + b.id + '">解封</button></span></td>' +
        '</tr>';
    }).join('');
  }

  /* ---------------- 操作 ---------------- */
  function onRowsClick(ev) {
    var btn = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!btn) return;
    var a = btn.getAttribute('data-act');

    if (a === 'del-row') {
      var id = Number(btn.getAttribute('data-id'));
      if (!confirm('确定删除 ID ' + id + ' 这条成绩？此操作不可撤销。')) return;
      btn.disabled = true;
      rpc('admin_delete_score', { p_password: pwd, p_id: id }).then(function (n) {
        toast('已删除 ' + n + ' 条', 'ok');
        return loadAll();
      }).catch(function (err) { btn.disabled = false; toast(errText(err), 'error', 6000); });
      return;
    }

    if (a === 'del-player') {
      var name = btn.getAttribute('data-name');
      var count = rows.filter(function (r) { return String(r.player_name) === String(name); }).length;
      if (!confirm('删除「' + name + '」的全部 ' + count + ' 条成绩？')) return;
      btn.disabled = true;
      rpc('admin_delete_player', { p_password: pwd, p_name: name }).then(function (n) {
        toast('已删除「' + name + '」的 ' + n + ' 条成绩', 'ok');
        return loadAll();
      }).catch(function (err) { btn.disabled = false; toast(errText(err), 'error', 6000); });
      return;
    }

    if (a === 'ban') {
      var bn = btn.getAttribute('data-name');
      var bd = btn.getAttribute('data-device') || '';
      var reason = prompt('封禁「' + bn + '」（同时封禁该设备），可以填个原因：', '成绩异常');
      if (reason === null) return;
      if (!confirm('确认封禁「' + bn + '」？他之后无法再用这个昵称或设备提交成绩。')) return;
      btn.disabled = true;
      rpc('admin_ban_player', { p_password: pwd, p_name: bn, p_device: bd || null, p_reason: reason || null }).then(function () {
        toast('已封禁「' + bn + '」', 'ok');
        return loadAll();
      }).catch(function (err) { btn.disabled = false; toast(errText(err), 'error', 6000); });
    }
  }

  function onBansClick(ev) {
    var btn = ev.target.closest ? ev.target.closest('[data-act="unban"]') : null;
    if (!btn) return;
    var id = Number(btn.getAttribute('data-id'));
    if (!confirm('解除 ID ' + id + ' 的封禁？')) return;
    btn.disabled = true;
    rpc('admin_unban', { p_password: pwd, p_ban_id: id }).then(function () {
      toast('已解封', 'ok');
      return loadAll();
    }).catch(function (err) { btn.disabled = false; toast(errText(err), 'error', 6000); });
  }

  function changePassword() {
    var cur = el('pwOld').value;
    var a = el('pwNew').value;
    var b = el('pwNew2').value;
    var note = el('pwNote');
    if (!a || a.length < 6) { note.textContent = '新密码至少 6 位'; note.className = 'field-note state-error'; return; }
    if (a !== b) { note.textContent = '两次输入的新密码不一致'; note.className = 'field-note state-error'; return; }

    el('btnChangePwd').disabled = true;
    note.textContent = '正在修改…';
    note.className = 'field-note';
    rpc('admin_change_password', { p_current: cur, p_new: a }).then(function () {
      el('btnChangePwd').disabled = false;
      pwd = a;
      try { sessionStorage.setItem(SESSION_KEY, a); } catch (e) { /* 忽略 */ }
      el('pwOld').value = a;
      el('pwNew').value = '';
      el('pwNew2').value = '';
      note.textContent = '密码已更新，下次登录请用新密码。';
      note.className = 'field-note state-ok';
      toast('密码已更新', 'ok');
    }).catch(function (err) {
      el('btnChangePwd').disabled = false;
      note.textContent = errText(err);
      note.className = 'field-note state-error';
      toast(errText(err), 'error', 6000);
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    if (!paintBackendChip()) {
      el('loginNote').textContent = '请先在 assets/js/config.js 里配置 Supabase 的 url 与 anonKey。';
      el('loginNote').className = 'field-note state-error';
      el('btnLogin').disabled = true;
      return;
    }
    el('btnLogin').addEventListener('click', login);
    el('pwd').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') login(); });
    el('btnLogout').addEventListener('click', logout);
    el('btnReload').addEventListener('click', function () { loadAll().then(function (ok) { if (ok) toast('已刷新', 'ok', 1500); }); });
    el('search').addEventListener('input', renderRows);
    el('rows').addEventListener('click', onRowsClick);
    el('bans').addEventListener('click', onBansClick);
    el('btnChangePwd').addEventListener('click', changePassword);

    var saved = '';
    try { saved = sessionStorage.getItem(SESSION_KEY) || ''; } catch (e) { /* 忽略 */ }
    if (saved) {
      el('pwd').value = saved;
      el('loginNote').textContent = '检测到本次会话已登录过，正在重新校验…';
      login();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
