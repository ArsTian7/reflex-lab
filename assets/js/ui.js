/* =====================================================================
 *  渲染层：DOM 小工具、提示、统计、榜单表格、领奖台、走势图
 * ===================================================================== */
(function () {
  'use strict';

  var A = window.ReflexAvatars;
  var S = window.ReflexStore;
  var T = window.ReflexTest;

  function el(id) { return document.getElementById(id); }
  function money(n) { return n == null ? '—' : String(n); }

  function fmt(v, digits) {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toFixed(digits == null ? 1 : digits);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ---------- 提示条 ---------- */
  var toastBox = null;
  function toast(msg, kind, ms) {
    if (!toastBox) toastBox = el('toasts');
    if (!toastBox) return;
    var node = document.createElement('div');
    node.className = 'toast' + (kind ? ' toast-' + kind : '');
    node.innerHTML = msg;
    toastBox.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('in'); });
    setTimeout(function () {
      node.classList.remove('in');
      setTimeout(function () { node.remove(); }, 320);
    }, ms || 3200);
  }

  /* ---------- 提示音（仅用于抢跑与完成，不参与计时） ---------- */
  var audioCtx = null;
  function beep(freq, dur, type, gain) {
    var settings = S.getSettings();
    if (!settings.sound) return;
    try {
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain == null ? 0.06 : gain, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur / 1000);
      osc.connect(g).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur / 1000);
    } catch (e) { /* 静默失败 */ }
  }

  /* ---------- 测试台 ---------- */
  function setStage(state, payload) {
    var stage = el('stage');
    if (!stage) return;
    stage.className = 'stage state-' + state;
    var hint = el('stageHint');
    var sub = el('stageSub');
    var tag = el('stageTag');
    tag.hidden = true;

    if (state === 'idle') {
      hint.textContent = '点击开始';
      sub.textContent = '10 次测试，取平均值';
      stage.setAttribute('aria-label', '反应测试区域，点击开始');
    } else if (state === 'ready') {
      hint.textContent = '等待变绿…';
      sub.textContent = '第 ' + payload.trial + ' / ' + payload.total + ' 次 · 变绿立刻点击';
      stage.setAttribute('aria-label', '红色，等待变绿');
    } else if (state === 'go') {
      hint.textContent = '';
      sub.textContent = '';
      stage.setAttribute('aria-label', '现在点击');
      var ripple = el('stageRipple');
      if (ripple) {
        ripple.classList.remove('fire');
        void ripple.offsetWidth;
        ripple.classList.add('fire');
      }
    } else if (state === 'early') {
      hint.textContent = '太早了';
      sub.textContent = '该次作废 · 已抢跑 ' + payload.earlyStarts + ' 次，重新等待变绿';
      stage.setAttribute('aria-label', '抢跑，本次作废');
    } else if (state === 'invalid') {
      hint.textContent = '无效点击';
      sub.textContent = '这次成绩不计入，重测该次';
      stage.setAttribute('aria-label', '无效点击');
    } else if (state === 'trialDone') {
      hint.textContent = fmt(payload.ms, 1);
      sub.textContent = 'ms · 第 ' + payload.trial + ' 次完成';
      tag.hidden = false;
      tag.textContent = payload.ms < 250 ? '很快！' : (payload.ms < 320 ? '不错' : '还有提升空间');
      stage.setAttribute('aria-label', '本次成绩 ' + Math.round(payload.ms) + ' 毫秒');
    } else if (state === 'done') {
      hint.textContent = '测试完成';
      sub.textContent = '平均 ' + fmt(payload.average, 1) + ' ms · 最快 ' + Math.round(payload.best) + ' ms';
      stage.setAttribute('aria-label', '测试完成');
    }
  }

  /* ---------- 10 次成绩格子 ---------- */
  function renderDots(values, currentIndex, total) {
    var box = el('trialDots');
    if (!box) return;
    var html = '';
    for (var i = 0; i < total; i++) {
      var v = values[i];
      var cls = v == null ? (i === currentIndex ? 'is-current' : '') : ('is-done ' + T.speedClass(v));
      html += '<li class="dot ' + cls + '"><span class="dot-i">' + (i + 1) + '</span>' +
        '<span class="dot-v">' + (v == null ? '—' : Math.round(v)) + '</span></li>';
    }
    box.innerHTML = html;
  }

  /* ---------- 统计面板 ---------- */
  function renderStats(result) {
    if (!result) {
      el('statAvg').textContent = '—';
      el('statBest').textContent = '—';
      el('statWorst').textContent = '—';
      el('statSd').textContent = '—';
      el('statEarly').textContent = '0';
      var g = el('statGrade');
      g.textContent = '—';
      g.className = 'stat-v stat-grade';
      return;
    }
    el('statAvg').textContent = fmt(result.average, 1);
    el('statBest').textContent = Math.round(result.best);
    el('statWorst').textContent = Math.round(result.worst);
    el('statSd').textContent = fmt(result.sd, 0);
    el('statEarly').textContent = String(result.earlyStarts);
    var grade = el('statGrade');
    grade.textContent = result.grade.label;
    grade.className = 'stat-v stat-grade ' + result.grade.cls;
  }

  /* ---------- 历史走势 ---------- */
  function renderSparkline(history) {
    var svg = el('sparkline');
    var meta = el('sparkMeta');
    if (!svg) return;
    var runs = (history || []).slice(0, 20).reverse().filter(function (r) { return r && r.average; });
    if (runs.length < 2) {
      svg.innerHTML = '<line x1="0" y1="32" x2="300" y2="32" stroke="rgba(255,255,255,.10)" stroke-width="1.5" stroke-dasharray="4 5"/>';
      meta.textContent = runs.length ? '再来一次就能看到走势' : '暂无数据';
      return;
    }
    var vals = runs.map(function (r) { return r.average; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var pad = Math.max(8, (max - min) * 0.25);
    var lo = min - pad, hi = max + pad;
    var stepX = 300 / (runs.length - 1);
    var pts = vals.map(function (v, i) {
      var y = 58 - ((v - lo) / (hi - lo)) * 50;
      return (i * stepX).toFixed(1) + ',' + y.toFixed(1);
    });
    var last = vals[vals.length - 1];
    var lastY = 58 - ((last - lo) / (hi - lo)) * 50;
    var diff = last - vals[0];
    meta.textContent = '共 ' + vals.length + ' 次 · 最好 ' + Math.round(min) + 'ms';
    svg.innerHTML =
      '<defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="rgba(56,225,198,.34)"/><stop offset="1" stop-color="rgba(56,225,198,0)"/>' +
      '</linearGradient></defs>' +
      '<polygon points="0,64 ' + pts.join(' ') + ' 300,64" fill="url(#sparkFill)"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#38e1c6" stroke-width="2" ' +
      'vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="300" cy="' + lastY.toFixed(1) + '" r="3" fill="#38e1c6"/>' +
      '<text x="0" y="11" class="spark-txt">' + (diff <= 0 ? '↓ 比最初快 ' + Math.abs(Math.round(diff)) + 'ms' : '↑ 比最初慢 ' + Math.round(diff) + 'ms') + '</text>';
  }

  /* ---------- 头像选择器 ---------- */
  function renderAvatarGrid(current, onPick) {
    var box = el('avatarGrid');
    if (!box) return;
    box.innerHTML = A.PRESETS.map(function (p) {
      var val = 'preset:' + p.id;
      return '<button type="button" class="av' + (val === current ? ' is-active' : '') + '" data-avatar="' + val +
        '" title="' + p.label + '" aria-pressed="' + (val === current) + '">' + A.svg(p.id) +
        '<span class="av-name">' + p.label + '</span></button>';
    }).join('');
    box.onclick = function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.av') : null;
      if (!btn) return;
      var val = btn.getAttribute('data-avatar');
      Array.prototype.forEach.call(box.querySelectorAll('.av'), function (n) {
        n.classList.remove('is-active');
        n.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      onPick(val);
    };
  }

  function renderAvatarPreview(value) {
    var box = el('avatarPreview');
    if (box) box.innerHTML = A.html(value, { border: true });
  }

  function meAvatarHtml(value, size) {
    return '<span class="mini-av" style="width:' + size + 'px;height:' + size + 'px">' + A.html(value) + '</span>';
  }

  /* ---------- 排行表格 ---------- */
  function rankBadge(i) {
    if (i === 0) return '<span class="rank rank-1">1</span>';
    if (i === 1) return '<span class="rank rank-2">2</span>';
    if (i === 2) return '<span class="rank rank-3">3</span>';
    return '<span class="rank">' + (i + 1) + '</span>';
  }

  function renderBoard(rows, query, myName) {
    var body = el('boardBody');
    var empty = el('boardEmpty');
    if (!body) return;

    var q = String(query || '').trim().toLowerCase();
    var list = q ? rows.filter(function (r) { return String(r.name).toLowerCase().indexOf(q) >= 0; }) : rows;

    if (!list.length) {
      body.innerHTML = '';
      empty.hidden = false;
      empty.querySelector('p').textContent = q ? '没有找到匹配的玩家，换个关键词试试。' : '榜单还空着，来当第一个上榜的人吧。';
      renderPodium([]);
      return;
    }
    empty.hidden = true;
    var me = String(myName || '').trim().toLowerCase();
    body.innerHTML = list.map(function (r, i) {
      var isMe = me && String(r.name).toLowerCase() === me;
      var grade = T.speedClass(r.average);
      return '<tr class="' + (isMe ? 'is-me' : '') + '">' +
        '<td class="c-rank">' + rankBadge(i) + '</td>' +
        '<td class="c-player"><div class="pl">' + meAvatarHtml(r.avatar, 30) +
        '<span class="pl-name">' + escapeHtml(r.name) + (isMe ? '<i class="you">你</i>' : '') + '</span></div></td>' +
        '<td class="c-num"><b class="ms ' + grade + '">' + fmt(r.average, 1) + '</b><span class="unit">ms</span></td>' +
        '<td class="c-num">' + Math.round(r.best) + '</td>' +
        '<td class="c-num ' + (r.earlyStarts ? 'warn' : '') + '">' + (r.earlyStarts || 0) + '</td>' +
        '<td class="c-time">' + S.formatTime(r.createdAt) + '</td>' +
        '</tr>';
    }).join('');
    renderPodium(list);
  }

  function renderPodium(rows) {
    var box = el('podium');
    if (!box) return;
    var top = rows.slice(0, 3);
    if (top.length < 3) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var order = [1, 0, 2]; /* 银 金 铜 的视觉顺序 */
    box.innerHTML = order.map(function (idx) {
      var r = top[idx];
      if (!r) return '';
      var cls = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : 'bronze');
      return '<div class="pod ' + cls + '">' +
        '<div class="pod-av">' + A.html(r.avatar) + '<span class="pod-medal">' + (idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉') + '</span></div>' +
        '<div class="pod-name">' + escapeHtml(r.name) + '</div>' +
        '<div class="pod-ms">' + fmt(r.average, 1) + '<span>ms</span></div>' +
        '<div class="pod-bar"></div></div>';
    }).join('');
  }

  /* ---------- 我的排名 ---------- */
  function renderMyRanks(all, month, name) {
    var box = el('myRanks');
    if (!box) return;
    var me = String(name || '').trim().toLowerCase();
    if (!me) { box.innerHTML = '<span class="dim">设置昵称后可以看到自己的总榜 / 月榜名次</span>'; return; }
    function find(rows) {
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].name).toLowerCase() === me) return { rank: i + 1, row: rows[i] };
      }
      return null;
    }
    var a = find(all), m = find(month);
    var parts = [];
    parts.push(a ? '<b>总榜 #' + a.rank + '</b>（' + fmt(a.row.average, 1) + 'ms）' : '<span class="dim">总榜：还没有成绩</span>');
    parts.push(m ? '<b>月榜 #' + m.rank + '</b>（' + fmt(m.row.average, 1) + 'ms）' : '<span class="dim">月榜：本月还没有成绩</span>');
    box.innerHTML = parts.join('<span class="sep">·</span>');
  }

  function setSubmitState(text, kind) {
    var node = el('submitState');
    node.textContent = text;
    node.className = 'field-note' + (kind ? ' state-' + kind : '');
  }

  window.ReflexUI = {
    el: el,
    fmt: fmt,
    money: money,
    escapeHtml: escapeHtml,
    toast: toast,
    beep: beep,
    setStage: setStage,
    renderDots: renderDots,
    renderStats: renderStats,
    renderSparkline: renderSparkline,
    renderAvatarGrid: renderAvatarGrid,
    renderAvatarPreview: renderAvatarPreview,
    renderBoard: renderBoard,
    renderPodium: renderPodium,
    renderMyRanks: renderMyRanks,
    setSubmitState: setSubmitState,
  };
})();
