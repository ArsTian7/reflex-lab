/* =====================================================================
 *  本地存储：个人资料、历史成绩、设置、时区/月份工具
 * ===================================================================== */
(function () {
  'use strict';

  var CFG = window.REFLEX_CONFIG;
  var K = {
    profile: 'reflex.profile.v1',
    history: 'reflex.history.v1',
    settings: 'reflex.settings.v1',
    device: 'reflex.device.v1',
    lastSubmit: 'reflex.lastSubmit.v1',
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ---------- 固定时区（默认 UTC+8）的时间工具 ---------- */
  function offset() { return CFG.monthOffsetMinutes; }

  function shifted(t) { return new Date((t || Date.now()) + offset() * 60000); }

  function monthKeyOf(t) {
    var d = shifted(t);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  }

  function monthLabel(key) {
    var parts = String(key || '').split('-');
    return parts.length === 2 ? parts[0] + ' 年 ' + Number(parts[1]) + ' 月' : key;
  }

  function msToNextMonth() {
    var d = shifted();
    var boundary = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0) - offset() * 60000;
    return Math.max(0, boundary - Date.now());
  }

  function formatTime(iso, withYear) {
    var t = typeof iso === 'number' ? iso : Date.parse(iso);
    if (!t) return '—';
    var d = shifted(t);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var s = pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
    if (withYear || d.getUTCFullYear() !== shifted().getUTCFullYear()) return d.getUTCFullYear() + '-' + s;
    return s;
  }

  /* ---------- 资料 ---------- */
  function getProfile() {
    return read(K.profile, { name: '', avatar: 'preset:cat', deviceId: '' });
  }
  function saveProfile(p) { write(K.profile, p); return p; }

  function deviceId() {
    var id = read(K.device, '');
    if (!id) {
      id = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      write(K.device, id);
    }
    return id;
  }

  /* ---------- 历史成绩 ---------- */
  function getHistory() { return read(K.history, []); }

  function addRun(run) {
    var list = getHistory();
    list.unshift(run);
    if (list.length > 40) list = list.slice(0, 40);
    write(K.history, list);
    return list;
  }

  function personalBest() {
    var list = getHistory().filter(function (r) { return r && r.average > 0; });
    if (!list.length) return null;
    return list.reduce(function (a, b) { return a.average <= b.average ? a : b; });
  }

  /* ---------- 设置 ---------- */
  function getSettings() { return read(K.settings, { sound: true }); }
  function saveSettings(s) { write(K.settings, s); return s; }

  /* ---------- 提交冷却 ---------- */
  function lastSubmitAt() { return read(K.lastSubmit, 0); }
  function markSubmit() { write(K.lastSubmit, Date.now()); }
  function submitCooldownLeft() {
    return Math.max(0, CFG.minSubmitMs - (Date.now() - lastSubmitAt()));
  }

  window.ReflexStore = {
    getProfile: getProfile,
    saveProfile: saveProfile,
    deviceId: deviceId,
    getHistory: getHistory,
    addRun: addRun,
    personalBest: personalBest,
    getSettings: getSettings,
    saveSettings: saveSettings,
    lastSubmitAt: lastSubmitAt,
    markSubmit: markSubmit,
    submitCooldownLeft: submitCooldownLeft,
    monthKeyOf: monthKeyOf,
    monthLabel: monthLabel,
    msToNextMonth: msToNextMonth,
    formatTime: formatTime,
    keys: K,
  };
})();
