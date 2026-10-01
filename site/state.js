(function (root) {
  'use strict';
  const validModes = new Set(['awake', 'unknown']);

  function normalizeStatus(data, now = Date.now()) {
    const device = data && data.device && typeof data.device === 'object' ? data.device : {};
    const lastSeen = typeof device.lastSeenAt === 'string' ? Date.parse(device.lastSeenAt) : NaN;
    const heartbeatFresh = Number.isFinite(lastSeen) && lastSeen <= now + 30000 && now - lastSeen <= 90000;
    let mode = validModes.has(device.mode) ? device.mode : 'unknown';
    if (mode === 'awake' && !heartbeatFresh) mode = 'unknown';
    const sourceRequest = data && data.request;
    const request = sourceRequest && typeof sourceRequest === 'object' && ['pending', 'acknowledged', 'expired', 'cancelled'].includes(sourceRequest.status)
      ? { id: String(sourceRequest.id || ''), status: sourceRequest.status, createdAt: sourceRequest.createdAt, expiresAt: sourceRequest.expiresAt, acknowledgedAt: sourceRequest.acknowledgedAt }
      : null;
    const schedule = data && data.schedule && typeof data.schedule === 'object' ? data.schedule : {};
    const supported = schedule.mode === 'hourly' && schedule.minute === 0 && schedule.timeZone === 'Asia/Tokyo';
    return {
      name: typeof device.name === 'string' && device.name.trim() ? device.name.trim() : 'あなたのPC', mode, lastSeen, request,
      schedule: { mode: 'hourly', minute: 0, timeZone: 'Asia/Tokyo', enabled: supported && schedule.enabled === true, nextCheckAt: schedule.nextCheckAt || null, agentLastCheckAt: schedule.agentLastCheckAt || null }
    };
  }

  function viewState(status) {
    if (status.request && status.request.status === 'pending') return 'pending';
    if (status.request && status.request.status === 'acknowledged') {
      const receivedAt = Date.parse(status.request.acknowledgedAt || status.request.createdAt);
      return status.mode === 'awake' && Number.isFinite(receivedAt) && status.lastSeen >= receivedAt ? 'awake' : 'acknowledged';
    }
    if (status.request && status.request.status === 'expired') return 'expired';
    if (status.request && status.request.status === 'cancelled') return 'cancelled';
    if (status.mode === 'awake') return 'awake';
    return 'unknown';
  }

  const api = { normalizeStatus, viewState };
  root.WakeState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
