'use strict';
(() => {
  const API = 'https://daily-chunithm-api.simejikun0210.workers.dev';
  const $ = id => document.getElementById(id);
  let session = null, timer = null, pendingGet = null, generation = 0;
  function stopPolling() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (pendingGet) pendingGet.abort();
    pendingGet = null;
  }
  function reset() { stopPolling(); generation++; session = null; $('daily-stats').hidden = true; }
  function playerId() {
    const key = 'daily-chunithm:player-id';
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    return id;
  }
  async function request(path, body, controller = new AbortController()) {
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(API + path, { method: body ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true } : {}) });
      if (!response.ok) throw Error('HTTP ' + response.status);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function renderRank() {
    const valid = session.correct && Number.isInteger(session.step) && session.step >= 1 && session.step <= 6;
    $('clear-rank').hidden = !valid;
    $('clear-rank').textContent = valid ? `${session.step}枚目で正解` : '';
  }
  async function stats() {
    if (!session || document.hidden || pendingGet) return;
    if (session.date !== session.today()) { stopPolling(); $('stats-message').textContent = '日付が変わったため、この問題の集計は表示できません。'; $('stats-rows').hidden = true; return; }
    const token = generation, controller = new AbortController(); pendingGet = controller;
    try {
      const data = await request('/stats', null, controller);
      if (token !== generation) return;
      if (data.date !== session.date || !Array.isArray(data.counts) || data.counts.length !== 6 || ![...data.counts, data.totalClear, data.failed].every(n => Number.isSafeInteger(n) && n >= 0)) throw Error('Invalid stats');
      $('stats-rows').replaceChildren();
      [...data.counts.map((count, i) => [`${i + 1}枚目で正解`, count]), ['クリア合計', data.totalClear], ['不正解', data.failed]].forEach(([label, count]) => {
        const row = document.createElement('div'); row.className = 'stats-row';
        const title = document.createElement('span'), value = document.createElement('span'); title.textContent = label; value.textContent = `${count}人`; row.append(title, value); $('stats-rows').append(row);
      });
      $('stats-rows').hidden = false; $('stats-message').textContent = '';
    } catch {
      if (pendingGet !== controller) return;
      if (token === generation && !controller.signal.aborted) { $('stats-rows').hidden = true; $('stats-message').textContent = '集計情報を取得できませんでした'; }
      else if (token === generation && !document.hidden) { $('stats-rows').hidden = true; $('stats-message').textContent = '集計情報を取得できませんでした'; }
    } finally { if (pendingGet === controller) pendingGet = null; }
  }
  function poll() {
    stopPolling();
    if (!session || document.hidden) return;
    void stats();
    if (session.date !== session.today()) return;
    timer = setInterval(() => { void stats(); }, 10000);
  }
  async function submit(token, current) {
    if (current.date !== current.today()) { $('stats-message').textContent = '日付が変わったため、結果は送信されません。'; return; }
    try {
      const id = playerId();
      const data = await request(current.correct ? '/clear' : '/failed', current.correct ? {playerId: id, step: current.step} : {playerId: id});
      if (token !== generation) return;
      if (current.correct) {
        if (data.ok !== true || data.date !== current.date || !Number.isSafeInteger(data.rank) || data.rank < 1) throw Error('Invalid rank');
        session.rank = data.rank; current.onRank(data.rank); renderRank();
      }
      // Refresh using GET, not the possibly older aggregate returned by POST.
      if (pendingGet) { pendingGet.abort(); pendingGet = null; }
      void stats();
    } catch {
      if (token === generation) $('rank-message').textContent = '結果を送信できませんでした。';
    }
  }
  function show(options) {
    reset(); session = options;
    $('daily-stats').hidden = false; $('stats-rows').hidden = true;
    $('stats-message').textContent = '集計を読み込んでいます…'; $('rank-message').textContent = '';
    renderRank(); poll();
    if (!options.restoring) void submit(generation, session);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPolling(); else poll(); });
  window.addEventListener('pagehide', stopPolling);
  window.addEventListener('pageshow', () => { if (session) poll(); });
  window.DailyStats = { show, reset };
})();



