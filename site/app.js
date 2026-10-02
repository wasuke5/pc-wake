(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY_STORAGE = 'pc-wake-pair-key-v1';
  const base = String((window.WAKE_CONFIG || {}).apiBase || '').replace(/\/+$/, '');
  const unavailableReason = String((window.WAKE_CONFIG || {}).unavailableReason || 'PC側の定期確認とサーバーの接続準備を進めています。');
  const endpointReady = /^https:\/\//i.test(base) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base);
  let key = '';
  let status = null;
  let busy = false;
  let refreshing = false;
  let connection = 'unpaired';
  let connectionMessage = '';
  let installPrompt = null;
  let swRegistration = null;
  let pollTimer = null;
  let waitingWorker = null;
  const tokyoDateTime = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const tokyoTime = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  try { key = localStorage.getItem(KEY_STORAGE) || ''; } catch (_) { /* Still works in this tab without persistent storage. */ }
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('key')) {
    const incoming = (fragment.get('key') || '').trim();
    history.replaceState(null, '', location.pathname + location.search);
    if (incoming) setKey(incoming);
  }

  function setKey(value) {
    key = value;
    try { localStorage.setItem(KEY_STORAGE, value); } catch (_) { /* Keep session pairing. */ }
  }

  function setConnection(value, message = '') {
    connection = value;
    connectionMessage = message;
    render();
  }

  function render() {
    const online = navigator.onLine;
    const ready = online && connection === 'ready';
    const current = status ? WakeState.normalizeStatus({ device: { name: status.name, mode: status.mode, lastSeenAt: Number.isFinite(status.lastSeen) ? new Date(status.lastSeen).toISOString() : null }, request: status.request, schedule: status.schedule }) : null;
    const scheduleReady = ready && current && current.schedule.enabled;
    const state = current ? WakeState.viewState(current) : 'unknown';
    $('offlineBanner').hidden = online;
    $('deviceName').textContent = status ? status.name : 'あなたのPC';
    $('pairButton').hidden = !endpointReady || !!key;
    $('changePairButton').hidden = !endpointReady || !key;
    $('refreshButton').disabled = !key || !endpointReady || refreshing || !online;
    $('wakeButton').classList.toggle('loading', busy);
    $('wakeButton').classList.toggle('is-pending', state === 'pending' && scheduleReady);
    $('wakeButton').disabled = !key || !endpointReady || !scheduleReady || busy || state === 'pending' || state === 'awake';
    let buttonLabel = '次の毎時00分に起動を予約';
    if (busy) buttonLabel = '起動要求を送信中…';
    else if (!online) buttonLabel = 'インターネット接続を確認';
    else if (!endpointReady) buttonLabel = '接続の準備中';
    else if (!key) buttonLabel = '先にこのスマホを登録';
    else if (connection === 'unauthorized') buttonLabel = '登録を確認してください';
    else if (connection === 'error') buttonLabel = '接続を確認してください';
    else if (refreshing || connection === 'checking') buttonLabel = 'PCの状態を確認中…';
    else if (state === 'pending') buttonLabel = scheduleReady ? '起動要求を送信済み' : 'PCの定期確認が無効です';
    else if (state === 'awake' && ready) buttonLabel = 'PCはオンラインです';
    else if (!scheduleReady) buttonLabel = 'PCの定期確認を確認してください';
    $('wakeButtonLabel').textContent = buttonLabel;
    $('connectionDot').dataset.state = scheduleReady ? 'ready' : 'idle';
    let pill = '状態を確認中';
    let message = 'PCの状態を確認しています。';
    let tone = 'neutral';
    if (!online) { pill = 'オフライン'; message = '現在の接続状態を確認できません。'; }
    else if (!endpointReady) { pill = '接続を準備中'; message = unavailableReason; }
    else if (!key) { pill = 'このスマホを登録'; message = '最初に、このスマホをPCとつなぎます。'; }
    else if (connection === 'unauthorized') { pill = '登録を確認してください'; message = '登録コードを確認し、もう一度登録してください。'; }
    else if (connection === 'error') { pill = '接続できません'; message = connectionMessage || '接続を確認して、もう一度試してください。'; }
    else if (connection === 'ready') {
      if (state === 'pending') { pill = '00分の起動予約済み'; message = scheduleReady ? '起動要求を保存しました。PCはまだ受信していません。次の毎時00分に復帰して要求を確認します。' : '受付済みですが、PC側の定期確認が無効です。'; tone = 'pending'; }
      else if (state === 'awake') { pill = 'オンライン'; message = current.request && current.request.status === 'acknowledged' ? 'PCが要求を受信し、現在の応答も確認できました。' : 'PCからの新しい応答を確認しました。'; tone = 'awake'; }
      else if (state === 'acknowledged') { pill = 'PCが要求を受信'; message = 'PCがこの要求を受信しました。現在の接続状態は未確認です。'; }
      else if (!scheduleReady) { pill = '定期確認が無効です'; message = 'PC側の毎時00分の確認設定を確認してください。'; }
      else if (state === 'expired') { pill = '要求の有効期限切れ'; message = '有効期限内にPCの受信を確認できませんでした。もう一度要求できます。'; }
      else if (state === 'cancelled') { pill = '要求を取り消しました'; message = '新しく起動をリクエストできます。'; }
      else { pill = '起動予約できます'; message = '下のボタンを押すと要求を保存します。PCは次の毎時00分にスリープから復帰して、この要求を確認します。'; }
    }
    $('statusText').textContent = pill;
    $('statusPill').dataset.state = tone;
    document.querySelector('.computer-visual').dataset.state = tone;
    document.querySelector('.wake-card').dataset.state = tone;
    const flowStage = !scheduleReady ? -1 : state === 'pending' ? 1 : state === 'awake' || state === 'acknowledged' ? 2 : 0;
    document.querySelectorAll('[data-flow-step]').forEach((step, index) => {
      step.classList.toggle('is-active', index === flowStage);
      step.classList.toggle('is-complete', index < flowStage);
      if (index === flowStage) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    $('mainMessage').textContent = message;
    $('timingText').textContent = !endpointReady ? '接続の準備が完了すると使えます。' : !key ? '設定用リンクから、初回登録をしてください。' : '毎時00分にPCが復帰 · 最長約1時間待ち';
    const nextCheck = current ? Date.parse(current.schedule.nextCheckAt) : NaN;
    $('scheduleInfo').hidden = !key || !endpointReady;
    $('scheduleInfo').textContent = Number.isFinite(nextCheck) ? '次回のPC復帰 ' + tokyoTime.format(new Date(nextCheck)) + '（日本時間）' : '次回のPC復帰時刻を確認中';
    $('nextHeading').textContent = '起動予約はシアン色のボタンから';
    $('nextMessage').textContent = 'タップすると起動要求を保存。PCは毎時00分に復帰して受信します。要求がなければ、Windowsの設定に従って再びスリープします。';
    $('lastSeen').hidden = !status || !Number.isFinite(status.lastSeen);
    if (!$('lastSeen').hidden) {
      $('lastSeen').textContent = 'PCの最終応答 ' + tokyoDateTime.format(new Date(status.lastSeen)) + '（日本時間）';
    }
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(base + path, { ...options, signal: controller.signal, cache: 'no-store', credentials: 'omit', headers: { Authorization: 'Bearer ' + key, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
      if (response.status === 401 || response.status === 403) {
        const error = new Error('登録コードが無効です。'); error.code = 'unauthorized'; throw error;
      }
      if (!response.ok) throw new Error(response.status === 429 ? '少し待ってから、もう一度試してください。' : '接続できませんでした。もう一度試してください。');
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('応答がありません。接続を確認して、もう一度試してください。');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async function refresh(showChecking = false) {
    if (!key || !endpointReady || !navigator.onLine || refreshing || busy) { render(); return; }
    refreshing = true;
    if (showChecking) setConnection('checking'); else render();
    try {
      status = WakeState.normalizeStatus(await api('/api/status'));
      setConnection('ready');
    } catch (error) {
      setConnection(error.code === 'unauthorized' ? 'unauthorized' : 'error', error.message);
    } finally { refreshing = false; render(); schedulePoll(); }
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    if (key && endpointReady && !document.hidden) pollTimer = setTimeout(() => refresh(), 10000);
  }

  $('wakeButton').addEventListener('click', async () => {
    if ($('wakeButton').disabled) return;
    busy = true; render();
    try {
      const data = await api('/api/wake', { method: 'POST', body: '{}' });
      if (!data.request || !['pending', 'acknowledged', 'expired', 'cancelled'].includes(data.request.status)) throw new Error('受付結果を確認できませんでした。状態を更新してください。');
      status = status || WakeState.normalizeStatus({});
      status.request = data.request;
      if (typeof data.nextCheckAt === 'string') status.schedule.nextCheckAt = data.nextCheckAt;
      setConnection('ready');
    } catch (error) { setConnection(error.code === 'unauthorized' ? 'unauthorized' : 'error', error.message); }
    finally { busy = false; render(); schedulePoll(); }
  });

  $('refreshButton').addEventListener('click', () => refresh(true));
  function openPair() { if (!endpointReady) return; $('pairError').hidden = true; $('pairKey').value = ''; $('pairDialog').showModal(); }
  $('pairButton').addEventListener('click', openPair);
  $('changePairButton').addEventListener('click', openPair);
  $('closePairButton').addEventListener('click', () => $('pairDialog').close());
  $('pairForm').addEventListener('submit', event => {
    event.preventDefault();
    let incoming = $('pairKey').value.trim();
    if (/^https?:\/\//i.test(incoming)) {
      try { incoming = (new URLSearchParams(new URL(incoming).hash.slice(1)).get('key') || '').trim(); } catch (_) { incoming = ''; }
    }
    if (incoming.length < 16 || /\s/.test(incoming)) {
      $('pairError').textContent = '設定用の登録コードを、そのまま貼り付けてください。'; $('pairError').hidden = false; return;
    }
    setKey(incoming); status = null; $('pairKey').value = ''; $('pairDialog').close(); refresh(true);
  });

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (standalone) $('installCard').hidden = true;
  else if (iOS) $('installHint').textContent = 'Safariでこのページを開き、共有ボタン（□↑）→「ホーム画面に追加」を選んでください。';
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('installButton').hidden = false; });
  $('installButton').addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null; $('installButton').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('installCard').hidden = true; installPrompt = null; });
  window.addEventListener('online', () => refresh(true));
  window.addEventListener('offline', render);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(pollTimer); else refresh(); });

  if ('serviceWorker' in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
    window.addEventListener('load', async () => {
      try {
        swRegistration = await navigator.serviceWorker.register('./sw.js');
        function applyAvailableUpdate() {
          if (swRegistration.waiting && navigator.serviceWorker.controller) {
            waitingWorker = swRegistration.waiting;
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        }
        applyAvailableUpdate();
        swRegistration.addEventListener('updatefound', () => {
          const installing = swRegistration.installing;
          if (installing) installing.addEventListener('statechange', () => { if (installing.state === 'installed') applyAvailableUpdate(); });
        });
        if (navigator.onLine) await swRegistration.update();
      } catch (_) { /* Wake remains available even without offline installation support. */ }
    });
    $('updateButton').addEventListener('click', () => { if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' }); });
  }

  render();
  if (key && endpointReady) refresh(true);
}());
