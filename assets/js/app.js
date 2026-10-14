/* =====================================================================
 *  主逻辑：把测试引擎、资料、排行榜串起来
 * ===================================================================== */
(function () {
  'use strict';

  var CFG = window.REFLEX_CONFIG;
  var S = window.ReflexStore;
  var T = window.ReflexTest;
  var UI = window.ReflexUI;
  var A = window.ReflexAvatars;
  var B = window.ReflexBoard;
  var el = UI.el;

  var profile = S.getProfile();
  var lastResult = null;
  var refreshHz = null;
  var runTrials = [];
  var submittedRun = null;
  var submitting = false;
  var cache = { all: [], month: [] };
  var scope = 'all';
  var mobileDismissed = false;

  /* ================= 基础工具 ================= */
  /* 顶栏那些可选的小标签：元素缺失时也不要让整个页面挂掉 */
  function setText(id, text) {
    var node = el(id);
    if (node) node.textContent = text;
  }

  function platform() {
    try {
      if (navigator.userAgentData && navigator.userAgentData.platform) return navigator.userAgentData.platform;
      return navigator.platform || '';
    } catch (e) { return ''; }
  }

  function cleanName(v) {
    return String(v || '')
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 14);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* ================= 顶部状态 ================= */
  function paintBackend() {
    var st = B.status();
    el('chipBackendText').textContent = st.text;
    el('chipBackend').className = 'chip ' + (st.online ? 'is-online' : 'is-local');
    el('offlineBanner').hidden = st.online;
    if (st.fellBack) {
      UI.toast('config.js 里的后端配置不完整，已回落到本地模式。', 'warn', 5200);
    }
  }

  function paintIdentity() {
    var chip = el('chipIdentity');
    if (profile.name) {
      chip.textContent = '身份：' + profile.name;
      chip.className = 'chip is-online';
    } else {
      chip.textContent = '身份：未设置';
      chip.className = 'chip is-local';
    }
  }

  function paintProfile() {
    el('nameInput').value = profile.name || '';
    UI.renderAvatarPreview(profile.avatar);
    UI.renderAvatarGrid(profile.avatar, function (val) {
      profile.avatar = val;
      profile = S.saveProfile(profile);
      UI.renderAvatarPreview(val);
      paintIdentity();
      UI.toast('头像已更新为「' + A.label(val) + '」', 'ok', 1800);
    });
    paintIdentity();
  }

  /* ================= 排行榜 ================= */
  function paintBoard() {
    var rows = cache[scope] || [];
    UI.renderBoard(rows, el('boardSearch').value, profile.name);
    UI.renderMyRanks(cache.all || [], cache.month || [], profile.name);
    setText('boardCount', rows.length ? ('共 ' + rows.length + ' 位玩家上榜') : '榜单为空');
    setText('boardSub', scope === 'month'
      ? ('统计 ' + S.monthLabel(S.monthKeyOf()) + ' 的成绩（UTC+8）')
      : '按 10 次平均反应速度排名，越小越快');
  }

  function skeleton() {
    var body = el('boardBody');
    var html = '';
    for (var i = 0; i < 6; i++) {
      html += '<tr class="sk"><td colspan="6"><span class="sk-bar"></span></td></tr>';
    }
    body.innerHTML = html;
    el('boardEmpty').hidden = true;
    el('podium').hidden = true;
    setText('boardUpdated', '正在读取榜单…');
  }

  function refreshAll(silent) {
    if (!silent) skeleton();
    var jobs = ['all', 'month'].map(function (s) {
      return B.fetch(s).then(function (rows) { cache[s] = rows; }, function (err) { cache[s] = []; throw err; });
    });
    return Promise.all(jobs).then(function () {
      paintBoard();
      setText('boardUpdated', '更新于 ' + S.formatTime(Date.now()) + '（UTC+8）');
      return true;
    }).catch(function (err) {
      UI.renderBoard([], '', '');
      el('boardEmpty').hidden = false;
      el('boardEmpty').querySelector('p').textContent = '榜单读取失败：' + friendlyError(err);
      setText('boardUpdated', '读取失败');
      if (!silent) UI.toast('榜单读取失败：' + friendlyError(err), 'error', 5200);
      return false;
    });
  }

  function friendlyError(err) {
    var msg = String((err && err.message) || err || '未知错误');
    var code = err && err.status;
    if (code === 401 || code === 403) return '密钥无效或权限被拒绝';
    if (code === 404) return '找不到数据表或视图，请先在数据库里执行 supabase/schema.sql';
    if (code === 429) return '请求太频繁，稍后再试';
    if (msg.indexOf('Failed to fetch') >= 0 || msg.indexOf('NetworkError') >= 0) return '网络不可达（地址写错或被拦截）';
    if (msg.length > 90) return msg.slice(0, 90) + '…';
    return msg;
  }

  /* ================= 提交成绩 ================= */
  function buildEntry(result) {
    return {
      name: profile.name,
      avatar: profile.avatar,
      average: result.average,
      best: result.best,
      worst: result.worst,
      earlyStarts: result.earlyStarts,
      trials: result.count,
      monthKey: S.monthKeyOf(),
      refreshHz: refreshHz,
      platform: platform(),
    };
  }

  function trySubmit(auto) {
    if (!lastResult) { UI.setSubmitState('先完成一次 10 次测试。', 'warn'); return; }
    if (submitting) return;
    if (submittedRun === lastResult.finishedAt) { UI.toast('这一次成绩已经提交过了。', 'warn'); return; }
    if (!profile.name) {
      UI.setSubmitState('先填写昵称并保存资料，才能上榜。', 'warn');
      UI.toast('请先设置一个昵称', 'warn');
      el('nameInput').focus();
      el('nameInput').classList.add('shake');
      setTimeout(function () { el('nameInput').classList.remove('shake'); }, 700);
      return;
    }
    var left = S.submitCooldownLeft();
    if (left > 0) {
      UI.setSubmitState('冷却中，还有 ' + Math.ceil(left / 1000) + ' 秒可以再次提交。', 'warn');
      if (!auto) UI.toast('提交太频繁，请等 ' + Math.ceil(left / 1000) + ' 秒', 'warn');
      return;
    }
    if (lastResult.average < CFG.minValidMs || lastResult.average > CFG.maxValidMs) {
      UI.setSubmitState('这次成绩超出可信范围，未被接受。', 'error');
      return;
    }

    submitting = true;
    el('btnSubmit').disabled = true;
    UI.setSubmitState(auto ? '正在自动提交…' : '正在提交…');

    B.submit(buildEntry(lastResult)).then(function (res) {
      submitting = false;
      submittedRun = lastResult.finishedAt;
      S.markSubmit();
      el('btnSubmit').disabled = false;
      var rankTxt = res && res.rank ? ('总榜第 ' + res.rank + ' 名') : '已提交';
      UI.setSubmitState('提交成功 · ' + rankTxt + (res && res.total ? '（共 ' + res.total + ' 人）' : ''), 'ok');
      UI.toast('🎉 成绩已上榜 · ' + rankTxt, 'ok', 4200);
      return refreshAll(true);
    }).catch(function (err) {
      submitting = false;
      el('btnSubmit').disabled = false;
      var msg = friendlyError(err);
      UI.setSubmitState('提交失败：' + msg, 'error');
      UI.toast('提交失败：' + msg, 'error', 5200);
    });
  }

  /* ================= 测试流程 ================= */
  function paintDots() {
    var idx = runTrials.length;
    UI.renderDots(runTrials, idx < CFG.trials ? idx : -1, CFG.trials);
    setText('chipTrial', '第 ' + Math.min(runTrials.length + (engine.getState() === 'done' ? 0 : 1), CFG.trials) + ' / ' + CFG.trials + ' 次');
  }

  var engine = T.create(el('stage'), {
    start: function () {
      runTrials = [];
      lastResult = null;
      UI.renderStats(null);
      setText('runLabel', '进行中…');
      el('btnSubmit').disabled = true;
      UI.setSubmitState('测试进行中，完成 10 次后自动上榜。');
      UI.renderDots([], 0, CFG.trials);
      setText('chipTrial', '第 1 / ' + CFG.trials + ' 次');
      el('btnStart').textContent = '测试中…';
      el('btnStart').disabled = true;
    },
    state: function (state, payload) {
      UI.setStage(state, payload || {});
      if (state === 'ready') {
        UI.renderDots(runTrials, runTrials.length, CFG.trials);
        setText('chipTrial', '第 ' + payload.trial + ' / ' + payload.total + ' 次');
      }
      if (state === 'trialDone') {
        UI.renderDots(runTrials, -1, CFG.trials);
        setText('chipTrial', '已完成 ' + runTrials.length + ' / ' + CFG.trials + ' 次');
      }
    },
    trial: function (index, ms) {
      runTrials.push(ms);
      UI.renderDots(runTrials, -1, CFG.trials);
    },
    early: function () {
      UI.beep(190, 150, 'square', 0.05);
      UI.toast('抢跑！该次不算，重新等待变绿', 'warn', 1800);
    },
    invalid: function (ms) {
      UI.beep(160, 170, 'square', 0.05);
      UI.toast(ms && ms < CFG.minValidMs ? '点击快过人类极限，该次无效，重测' : '这次太慢了，重测该次', 'warn', 2000);
    },
    finish: function (result) {
      lastResult = result;
      UI.renderStats(result);
      UI.renderDots(result.trials, -1, CFG.trials);
      setText('chipTrial', '已完成 ' + CFG.trials + ' / ' + CFG.trials + ' 次');
      setText('runLabel', '平均 ' + UI.fmt(result.average, 1) + 'ms · ' + result.grade.label);
      el('btnStart').textContent = '再测一次';
      el('btnStart').disabled = false;
      el('btnSubmit').disabled = false;
      UI.beep(660, 120, 'sine', 0.05);
      setTimeout(function () { UI.beep(880, 140, 'sine', 0.045); }, 130);

      S.addRun({
        average: result.average,
        best: result.best,
        early: result.earlyStarts,
        at: result.finishedAt,
      });
      UI.renderSparkline(S.getHistory());
      var pb = S.personalBest();
      if (pb) setText('chipBest', '我的最好 ' + UI.fmt(pb.average, 1) + 'ms');

      if (profile.name) trySubmit(true);
      else {
        UI.setSubmitState('填写昵称并保存资料后，成绩就能上榜。', 'warn');
        UI.toast('设置昵称后即可上榜 →', 'warn', 4200);
      }
    },
    reset: function () {
      runTrials = [];
      UI.renderStats(null);
      UI.renderDots([], -1, CFG.trials);
      setText('chipTrial', '第 0 / ' + CFG.trials + ' 次');
      setText('runLabel', '待开始');
      el('btnStart').textContent = '开始测试';
      el('btnStart').disabled = false;
      el('btnSubmit').disabled = !lastResult;
      UI.setSubmitState(lastResult ? '可以直接提交上一次的成绩。' : '完成一次测试后即可提交。');
    },
  });

  /* 全屏模式的额外样式 */
  function syncFullscreen() {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    document.body.classList.toggle('is-fs', !!fs);
  }

  /* ================= 事件绑定 ================= */
  function bind() {
    el('btnStart').addEventListener('click', function () { engine.start(); });
    el('btnReset').addEventListener('click', function () { engine.reset(); });
    el('btnFullscreen').addEventListener('click', function () {
      var stage = el('stage');
      var fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else if (stage.requestFullscreen) {
        stage.requestFullscreen().catch(function () { UI.toast('浏览器不允许全屏', 'warn'); });
      } else if (stage.webkitRequestFullscreen) {
        stage.webkitRequestFullscreen();
      }
    });
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);

    el('btnSaveProfile').addEventListener('click', saveProfileFromInput);
    el('nameInput').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); saveProfileFromInput(); }
    });

    el('btnUpload').addEventListener('click', function () { el('fileInput').click(); });
    el('fileInput').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) { UI.toast('图片请小于 6MB', 'warn'); return; }
      UI.toast('正在压缩头像…', 'ok', 1500);
      A.compressImage(file, function (err, dataUrl) {
        if (err || !dataUrl) { UI.toast('图片处理失败，换一张试试', 'error'); return; }
        profile.avatar = dataUrl;
        profile = S.saveProfile(profile);
        UI.renderAvatarPreview(dataUrl);
        UI.renderAvatarGrid('__none__', pickAvatar);
        UI.toast('已使用自定义头像', 'ok', 2000);
      });
      ev.target.value = '';
    });

    el('btnSubmit').addEventListener('click', function () { trySubmit(false); });
    el('btnShare').addEventListener('click', function () {
      if (!lastResult) { UI.toast('先完成一次测试', 'warn'); return; }
      var r = lastResult;
      var text = '我的反应速度平均值 ' + UI.fmt(r.average, 1) + 'ms（10 次，最快 ' + Math.round(r.best) +
        'ms），评级：' + r.grade.label + '。来 Reaction Lab 挑战我：' + location.href.split('?')[0];
      copyText(text).then(function (ok) {
        UI.toast(ok ? '成绩文案已复制，去粘贴给朋友吧' : '复制失败，请手动选择文字', ok ? 'ok' : 'warn');
      });
    });

    el('tabAll').addEventListener('click', function () { setScope('all'); });
    el('tabMonth').addEventListener('click', function () { setScope('month'); });
    el('btnRefresh').addEventListener('click', function () {
      var btn = el('btnRefresh');
      btn.classList.add('spin');
      refreshAll(true).then(function () { setTimeout(function () { btn.classList.remove('spin'); }, 400); });
    });
    var searchTimer = null;
    el('boardSearch').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(paintBoard, 140);
    });

    el('btnSound').addEventListener('click', function () {
      var s = S.getSettings();
      s.sound = !s.sound;
      S.saveSettings(s);
      el('btnSound').textContent = s.sound ? '🔊' : '🔇';
      el('btnSound').setAttribute('aria-pressed', String(s.sound));
      if (s.sound) UI.beep(720, 100, 'sine', 0.05);
      UI.toast(s.sound ? '提示音已开启' : '提示音已关闭', 'ok', 1500);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        var t = ev.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { t.blur(); return; }
        engine.reset();
        UI.toast('已重置', 'ok', 1200);
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && engine.isBusy()) {
        engine.reset();
        UI.toast('检测到切换窗口，本次测试已取消（避免成绩不准）', 'warn', 3600);
      }
      if (!document.hidden) refreshAll(true);
    });

    el('btnIgnoreMobile').addEventListener('click', function () {
      mobileDismissed = true;
      el('mobileBlock').classList.remove('show');
    });
    window.addEventListener('resize', checkViewport);
  }

  function pickAvatar(val) {
    profile.avatar = val;
    profile = S.saveProfile(profile);
    UI.renderAvatarPreview(val);
  }

  function saveProfileFromInput() {
    var name = cleanName(el('nameInput').value);
    if (!name) {
      el('nameNote').textContent = '昵称不能为空，1–14 个字符。';
      el('nameNote').className = 'field-note state-error';
      el('nameInput').classList.add('shake');
      setTimeout(function () { el('nameInput').classList.remove('shake'); }, 700);
      return;
    }
    profile.name = name;
    profile = S.saveProfile(profile);
    el('nameInput').value = name;
    el('nameNote').textContent = '已保存。排行榜以昵称区分玩家，同名视为同一人。';
    el('nameNote').className = 'field-note state-ok';
    paintIdentity();
    UI.toast('资料已保存 · ' + name, 'ok', 2200);
    if (lastResult && submittedRun !== lastResult.finishedAt) trySubmit(false);
    refreshAll(true);
  }

  function setScope(s) {
    scope = s;
    el('tabAll').classList.toggle('is-active', s === 'all');
    el('tabMonth').classList.toggle('is-active', s === 'month');
    el('tabAll').setAttribute('aria-selected', String(s === 'all'));
    el('tabMonth').setAttribute('aria-selected', String(s === 'month'));
    paintBoard();
  }

  function checkViewport() {
    var narrow = window.innerWidth < 900;
    if (narrow && !mobileDismissed) el('mobileBlock').classList.add('show');
    else el('mobileBlock').classList.remove('show');
  }

  function tickMonth() {
    var ms = S.msToNextMonth();
    var d = Math.floor(ms / 86400000);
    var h = Math.floor((ms % 86400000) / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    setText('monthCountdown', '本月榜单还有 ' + d + ' 天 ' + h + ' 小时 ' + m + ' 分换榜');
  }

  /* ================= 启动 ================= */
  function init() {
    try {
      boot();
    } catch (e) {
      console.error('[Reaction Lab] 初始化失败', e);
      UI.toast('页面初始化出错：' + ((e && e.message) || e) + '（试试刷新或换 Chrome/Edge）', 'error', 9000);
    }
  }

  function boot() {
    paintBackend();
    paintProfile();
    UI.setStage('idle', {});
    setText('chipBest', '我的最好 —');

    var pb = S.personalBest();
    if (pb) setText('chipBest', '我的最好 ' + UI.fmt(pb.average, 1) + 'ms');
    UI.renderSparkline(S.getHistory());
    UI.renderStats(null);
    UI.renderDots([], -1, CFG.trials);
    setText('chipTrial', '第 0 / ' + CFG.trials + ' 次');
    el('btnSubmit').disabled = true;

    var s = S.getSettings();
    el('btnSound').textContent = s.sound ? '🔊' : '🔇';
    el('btnSound').setAttribute('aria-pressed', String(s.sound));

    bind();
    checkViewport();
    tickMonth();
    setInterval(tickMonth, 30000);

    refreshAll(false);

    var measured = false;
    setTimeout(function () {
      if (!measured) setText('chipRefresh', '刷新率未知（不影响测试）');
    }, 3000);

    T.measureRefreshRate(function (hz, frame) {
      measured = true;
      refreshHz = hz;
      setText('chipRefresh', '刷新率 ≈ ' + hz + 'Hz · 每帧 ' + frame.toFixed(1) + 'ms');
      if (hz < 50) {
        UI.toast('检测到刷新率较低，成绩颗粒度会变粗（每帧 ' + frame.toFixed(0) + 'ms）', 'warn', 4200);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
