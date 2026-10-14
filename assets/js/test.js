/* =====================================================================
 *  反应测试引擎
 *
 *  计时要点（决定了成绩是否可与其他网站对比）：
 *   1. 用 performance.now()，亚毫秒分辨率；
 *   2. 变绿那一帧的起点用 requestAnimationFrame 回调时间取，贴近"屏幕真正变色"的时刻，
 *      避免把逻辑时间当成视觉时间导致成绩虚高；
 *   3. 监听 pointerdown 而不是 click —— click 要等鼠标抬起才触发，会凭空多出几十毫秒；
 *   4. 红灯阶段点击 = 抢跑，该次作废并重测，不污染平均值。
 * ===================================================================== */
(function () {
  'use strict';

  var CFG = window.REFLEX_CONFIG;
  var now = function () { return performance.now(); };

  function percentileGrade(ms) {
    if (!ms) return { label: '—', cls: '' };
    if (ms < 200) return { label: '闪电', cls: 'g-great' };
    if (ms < 230) return { label: '极快', cls: 'g-great' };
    if (ms < 260) return { label: '优秀', cls: 'g-good' };
    if (ms < 300) return { label: '良好', cls: 'g-good' };
    if (ms < 360) return { label: '正常', cls: 'g-mid' };
    return { label: '再练练', cls: 'g-slow' };
  }

  function speedClass(ms) {
    if (ms == null) return '';
    if (ms < 200) return 'g-great';
    if (ms < 250) return 'g-good';
    if (ms < 320) return 'g-mid';
    return 'g-slow';
  }

  function create(stageEl, handlers) {
    handlers = handlers || {};
    var emit = function (name, a, b) { if (handlers[name]) handlers[name](a, b); };

    var state = 'idle';
    var trials = [];
    var earlyStarts = 0;
    var invalidCount = 0;
    var trialIndex = 0;
    var t0 = null;
    var timer = null;
    var locked = false;

    function setState(s, payload) {
      state = s;
      emit('state', s, payload || {});
    }

    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

    function randomWait() {
      var span = CFG.waitMaxMs - CFG.waitMinMs;
      return CFG.waitMinMs + Math.random() * span;
    }

    function arm() {
      clearTimer();
      t0 = null;
      locked = false;
      setState('ready', { trial: trialIndex + 1, total: CFG.trials });
      timer = setTimeout(go, randomWait());
    }

    function go() {
      clearTimer();
      /* 先用逻辑时刻兜底，再用下一帧的时间校准到"屏幕真正变色"的时刻。
         这样即使某台机器掉帧、rAF 迟迟不来，玩家的点击也不会被白白判成无效。 */
      t0 = now();
      locked = true;
      setState('go');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (state === 'go') t0 = now();
        });
      });
    }

    function record(ms) {
      locked = false;
      trials.push(ms);
      trialIndex++;
      emit('trial', trialIndex, ms, trials.length);

      if (trialIndex >= CFG.trials) {
        finish();
        return;
      }
      setState('trialDone', { ms: ms, trial: trialIndex });
      timer = setTimeout(function () {
        if (state === 'trialDone') arm();
      }, 780);
    }

    function finish() {
      var sum = 0, min = Infinity, max = -Infinity;
      trials.forEach(function (v) { sum += v; if (v < min) min = v; if (v > max) max = v; });
      var avg = sum / trials.length;
      var variance = trials.reduce(function (acc, v) { return acc + (v - avg) * (v - avg); }, 0) / trials.length;
      var result = {
        trials: trials.slice(),
        count: trials.length,
        average: avg,
        best: min,
        worst: max,
        sd: Math.sqrt(variance),
        earlyStarts: earlyStarts,
        invalidCount: invalidCount,
        grade: percentileGrade(avg),
        finishedAt: new Date().toISOString(),
      };
      setState('done', result);
      emit('finish', result);
    }

    /* ---------- 输入处理 ---------- */
    function onInput(source, ev) {
      if (locked && state === 'go' && t0 != null) {
        var ms = now() - t0;
        if (ms < 0) ms = 0;
        if (ms < CFG.minValidMs) {
          invalidCount++;
          emit('invalid', ms);
          setState('invalid', { ms: ms });
          clearTimer();
          timer = setTimeout(function () { if (state === 'invalid') arm(); }, 900);
          return;
        }
        if (ms > CFG.maxValidMs) {
          invalidCount++;
          emit('invalid', ms);
          setState('invalid', { ms: ms });
          timer = setTimeout(function () { if (state === 'invalid') arm(); }, 900);
          return;
        }
        record(ms);
        return;
      }

      if (state === 'ready') {
        earlyStarts++;
        clearTimer();
        locked = false;
        emit('early', earlyStarts);
        setState('early', { trial: trialIndex + 1, earlyStarts: earlyStarts });
        timer = setTimeout(function () { if (state === 'early') arm(); }, 900);
        return;
      }

      if (state === 'idle' || state === 'done') {
        start();
        return;
      }
    }

    function onPointerDown(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (ev.isPrimary === false) return;
      ev.preventDefault();
      onInput('pointer');
    }

    function onKeyDown(ev) {
      if (ev.repeat) return;
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'NumpadEnter') {
        ev.preventDefault();
        onInput('key');
      }
    }

    if (stageEl) {
      stageEl.addEventListener('pointerdown', onPointerDown);
      stageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    document.addEventListener('keydown', onKeyDown);

    /* ---------- 对外接口 ---------- */
    function start() {
      if (state === 'ready' || state === 'go' || state === 'early' || state === 'invalid') return;
      clearTimer();
      trials = [];
      trialIndex = 0;
      earlyStarts = 0;
      invalidCount = 0;
      emit('start');
      arm();
    }

    function reset() {
      clearTimer();
      t0 = null;
      locked = false;
      trials = [];
      trialIndex = 0;
      earlyStarts = 0;
      invalidCount = 0;
      setState('idle');
      emit('reset');
    }

    function destroy() {
      clearTimer();
      document.removeEventListener('keydown', onKeyDown);
    }

    return {
      start: start,
      reset: reset,
      destroy: destroy,
      getState: function () { return state; },
      getTrials: function () { return trials.slice(); },
      getEarlyStarts: function () { return earlyStarts; },
      isBusy: function () { return state === 'ready' || state === 'go'; },
    };
  }

  /* 估算显示器刷新率，让用户知道计时颗粒度 */
  function measureRefreshRate(cb) {
    var stamps = [];
    var last = now();
    var count = 0;
    function step(t) {
      stamps.push(t - last);
      last = t;
      count++;
      if (count < 90) { requestAnimationFrame(step); return; }
      var mid = stamps.slice(10).sort(function (a, b) { return a - b; });
      var median = mid[Math.floor(mid.length / 2)] || 16.7;
      cb(Math.round(1000 / median), median);
    }
    requestAnimationFrame(step);
  }

  window.ReflexTest = {
    create: create,
    grade: percentileGrade,
    speedClass: speedClass,
    measureRefreshRate: measureRefreshRate,
  };
})();
