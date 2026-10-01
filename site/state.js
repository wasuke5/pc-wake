(function (root) {
  'use strict';
  const validModes = new Set(['awake', 'asleep', 'unknown']);

  function normalizeStatus(data, now = Date.now()) {
    const device = data && data.device && typeof data.device === 'object' ? data.device : {};
    const lastSeen = typeof device.lastSeenAt === 'string' ? Date.parse(device.lastSeenAt) : NaN;
    const heartbeatFresh = Number.isFinite(lastSeen) && lastSeen <= now + 30000 && now - lastSeen <= 90000;
    let mode = validModes.has(device.mode) ? device.mode : 'unknown';
    if (mode === 'awake' && !heartbeatFresh) mode = 'unknown';
    const sourceRequest = data && data.request;
    const request = sourceRequest && typeof sourceRequest === 'object' && ['queued', 'sent', 'pending', 'acknowledged', 'expired', 'failed'].includes(sourceRequest.status)
      ? { id: String(sourceRequest.id || ''), status: sourceRequest.status, createdAt: sourceRequest.createdAt, acknowledgedAt: sourceRequest.acknowledgedAt }
      : null;
    const relay = data && data.relay && typeof data.relay === 'object' ? data.relay : {};
    const relayLastSeen = typeof relay.lastSeenAt === 'string' ? Date.parse(relay.lastSeenAt) : NaN;
    const relayFresh = Number.isFinite(relayLastSeen) && relayLastSeen <= now + 30000 && now - relayLastSeen <= 60000;
    return { name: typeof device.name === 'string' && device.name.trim() ? device.name.trim() : 'あなたのPC', mode, lastSeen, request, relay: { online: relay.online === true && relayFresh, lastSeenAt: relay.lastSeenAt || null } };
  }

  function viewState(status) {
    if (status.mode === 'awake') return 'awake';
    if (status.request && ['queued', 'sent', 'pending'].includes(status.request.status)) return 'pending';
    if (status.request && status.request.status === 'failed') return 'failed';
    if (status.request && status.request.status === 'expired') return 'expired';
    if (status.mode === 'asleep') return 'asleep';
    return 'unknown';
  }

  const api = { normalizeStatus, viewState };
  root.WakeState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
