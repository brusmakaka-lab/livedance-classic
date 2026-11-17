import { normalizeTikTok } from './normalize.mjs';
import { createHash } from 'node:crypto';
const loadSDK = () => import('tiktok-live-connector');
/** In-memory, single-consumer bridge. No credentials, raw payloads or replay spool on disk. */
export class LiveAdapter {
  constructor(load = loadSDK, { leaseMs = 15000, timeoutMs = 25000, retryMs = 10000, onLog = () => {} } = {}) {
    Object.assign(this, { load, leaseMs, timeoutMs, retryMs, onLog });
    this.state = 'DISCONNECTED'; this.owner = ''; this.username = ''; this.roomId = '';
    this.generation = 0; this.sequence = 0; this.ack = 0; this.issued = 0; this.rows = []; this.seen = new Set();
    this.counts = { member: 0, join: 0, chat: 0, follow: 0, like: 0, likeUnits: 0, gift: 0, duplicate: 0, invalid: 0, anonymousLikes: 0, overflow: 0, cleared: 0, acknowledged: 0, ingressRejected: 0 };
    this.received = {}; this.lastReceived = {};
    this.logs = []; this.attempts = 0; this.nextAllowed = 0; this.lease = 0;
    this.watchdog = setInterval(() => { if (this.owner && Date.now() > this.lease) void this.stop('CLIENT_TIMEOUT'); }, 1000);
    this.watchdog.unref?.();
  }
  log(code, details = {}) {
    const row = { at: Date.now(), component: 'TikTokAdapter', code, ...details };
    this.logs.push(row); this.logs = this.logs.slice(-100);
    try { this.onLog(row); } catch { /* Diagnostics cannot interrupt admission. */ }
  }
  status() { return { state: this.state, username: this.username, roomId: this.roomId, queue: this.rows.length, counts: { ...this.counts }, received: { ...this.received }, lastReceived: { ...this.lastReceived }, attempts: this.attempts, nextAllowed: this.nextAllowed, logs: [...this.logs], unofficial: true, signer: 'Euler Stream' }; }
  async start(username, owner) {
    username = String(username ?? '').replace(/^@/, '');
    if (!/^[A-Za-z0-9_.]{2,24}$/.test(username) || !/^[a-zA-Z0-9-]{16,64}$/.test(owner)) throw Error('Usuario o consumidor inválido');
    if (this.owner && this.owner !== owner) throw Error('Otro estudio controla la conexión; desconectalo primero');
    if (Date.now() < this.nextAllowed) throw Error('Esperá el cooldown antes de reintentar');
    await this.stop('RESTART');
    this.owner = owner; this.username = username; this.lease = Date.now() + this.leaseMs; this.attempts = 0;
    this.nextAllowed = Date.now() + 15000;
    void this.connect(this.generation);
    return this.status();
  }
  async connect(generation) {
    this.state = 'CONNECTING'; this.attempts++;
    let client, timer;
    try {
      const { TikTokLiveConnection } = await this.load();
      if (generation !== this.generation) return;
      client = new TikTokLiveConnection(this.username, { processInitialData: false, fetchRoomInfoOnConnect: true, enableExtendedGiftInfo: false, authenticateWs: false, useMobile: false, signApiKey: process.env.EULER_API_KEY || undefined, webClientOptions: { timeout: { request: 12000 }, retry: { limit: 0 } } });
      this.client = client;
      for (const kind of ['member', 'join', 'chat', 'follow', 'like', 'gift']) client.on(kind, (raw) => {
        if (generation === this.generation && client === this.client && this.state === 'CONNECTED') this.receive(kind, raw);
      });
      client.on('error', () => { if (generation === this.generation) this.log('SDK_ERROR'); });
      client.on('streamEnd', () => { if (generation === this.generation && client === this.client) void this.stop('STREAM_ENDED'); });
      client.on('disconnected', () => { if (generation === this.generation && client === this.client && this.state === 'CONNECTED') this.retry(generation, 'SOCKET_CLOSED'); });
      const pending = client.connect();
      // A late connect after F8/timeout must close its own socket, never revive the session.
      pending.then(() => { if (generation !== this.generation || this.client !== client) void client.disconnect().catch(() => {}); }, () => {});
      const result = await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(Error(), { name: 'ConnectTimeoutError' })), this.timeoutMs); })]);
      if (generation !== this.generation || this.client !== client) return;
      this.roomId = String(result.roomId || client.roomId);
      if (!/^[1-9]\d{0,29}$/.test(this.roomId)) throw Error('InvalidRoom');
      this.state = 'CONNECTED'; this.log('CONNECTED');
    } catch (error) {
      if (generation !== this.generation) return;
      this.client = null;
      void client?.disconnect().catch(() => {});
      const name = String(error?.constructor?.name !== 'Error' ? error?.constructor?.name : error?.name || 'Error');
      this.log('FAILURE_' + name.replace(/[^a-zA-Z]/g, '').slice(0, 60));
      for (const inner of [error, error?.cause, ...(Array.isArray(error?.errors) ? error.errors : [])]) {
        if (typeof inner?.code === 'string' && /^[A-Z_0-9]{1,40}$/.test(inner.code)) this.log(inner.code);
        const status = inner?.response?.statusCode || inner?.statusCode;
        if (Number.isInteger(status)) this.log('HTTP_' + status);
      }
      // Do not log provider URLs, signed queries, tokens or arbitrary response bodies.
      if (/Offline/.test(name)) { this.state = 'OFFLINE'; this.log('USER_OFFLINE'); }
      else if (/Signature|SignAPI|Premium|Authenticated|InvalidUnique|InvalidResponse/.test(name)) {
        this.state = 'ERROR'; this.nextAllowed = Date.now() + Math.max(60000, Number(error.retryAfter) * 1000 || 0); this.log(name.replace(/[^a-zA-Z]/g, '').slice(0, 60));
      } else this.retry(generation, /Timeout/.test(name) ? 'CONNECT_TIMEOUT' : 'CONNECTION_FAILED');
    } finally { clearTimeout(timer); }
  }
  retry(generation, code) {
    this.log(code);
    if (this.attempts >= 3) { this.state = 'ERROR'; this.log('RETRY_LIMIT_REACHED'); return; }
    this.state = 'RECONNECTING';
    this.nextAllowed = Date.now() + this.retryMs * 2 ** (this.attempts - 1);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { if (generation === this.generation && this.owner) void this.connect(generation); }, this.nextAllowed - Date.now());
    this.retryTimer.unref?.();
  }
  receive(kind, raw) {
    const supported = ['member', 'join', 'chat', 'follow', 'like', 'gift'];
    if (!supported.includes(kind)) return;
    this.received[kind] = (this.received[kind] || 0) + 1;
    this.lastReceived[kind] = Date.now();
    const diagnostic = { kind, hasUserId: typeof raw?.user?.id === 'string' && /^[1-9]\d{0,29}$/.test(raw.user.id), hasMessageId: typeof raw?.common?.msgId === 'string' && /^[1-9]\d{0,29}$/.test(raw.common.msgId) };
    try {
      const packet = normalizeTikTok(kind, raw, this.roomId);
      diagnostic.viewerKey = createHash('sha256').update('phase2:' + packet.event.viewerId).digest('hex');
      const key = packet.sessionId + ':' + packet.event.eventId;
      if (this.seen.has(key)) { this.counts.duplicate++; this.log('DUPLICATE', { ...diagnostic, eventId: packet.event.eventId }); return; }
      if (this.rows.length >= 512) { this.counts.overflow++; this.log('QUEUE_FULL_EVENT_REJECTED'); return; }
      this.seen.add(key); if (this.seen.size > 4096) this.seen.delete(this.seen.values().next().value);
      this.rows.push({ sequence: ++this.sequence, packet }); this.counts[kind]++;
      this.log('EVENT_QUEUED', { ...diagnostic, eventId: packet.event.eventId, sequence: this.sequence, queue: this.rows.length });
      if (kind === "like") this.counts.likeUnits += packet.event.metadata.likeCount;
    } catch (error) {
      this.counts.invalid++;
      if (kind === 'like' && error?.message === 'missing_user_id') this.counts.anonymousLikes++;
      const reasons = ['missing_user_id', 'missing_stable_ids', 'wrong_room', 'invalid_like_count', 'invalid_gift', 'missing_streak_id'];
      this.log(reasons.includes(error?.message) ? 'REJECT_' + error.message : 'INVALID_PROVIDER_EVENT_REJECTED', diagnostic);
    }
  }
  poll(owner, ack = 0, rejected = 0) {
    if (!this.owner || owner !== this.owner) throw Error('Consumidor no autorizado');
    if (!Number.isSafeInteger(ack) || ack < 0 || ack > this.issued || !Number.isSafeInteger(rejected) || rejected < 0 || rejected > 32) throw Error('ACK inválido');
    this.lease = Date.now() + this.leaseMs;
    if (ack > this.ack) {
      this.counts.acknowledged += this.rows.filter(r => r.sequence <= ack).length;
      this.counts.ingressRejected += rejected;
      if (rejected) this.log('INGRESS_REJECTED');
      this.rows = this.rows.filter(r => r.sequence > ack); this.ack = ack;
    }
    const events = this.rows.slice(0, 32);
    this.issued = Math.max(this.issued, events.at(-1)?.sequence || 0);
    return { ...this.status(), events };
  }
  async stop(reason = 'MANUAL_STOP') {
    this.generation++; clearTimeout(this.retryTimer);
    const client = this.client; this.client = null;
    this.state = 'DISCONNECTED'; this.owner = ''; this.counts.cleared += this.rows.length;
    this.rows = []; this.ack = this.sequence; this.issued = this.sequence; this.log(reason);
    // Local admission is stopped immediately; SDK teardown may finish asynchronously.
    void client?.disconnect().catch(() => {});
  }
  async dispose() { clearInterval(this.watchdog); await this.stop('SHUTDOWN'); }
}
