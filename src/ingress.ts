import { normalizeEvent, type EventBus, type LiveEvent, type Tier } from "./domain";

export type IngressRule = Readonly<{
  id: string;
  match: { type: LiveEvent["eventType"]; giftId?: string; minDelta?: number };
  action: { tier?: Tier; reaction: "WELCOME" | "SPARK" | "VIP" | "HEART"; cue: "follow" | "gift" | "vip" | "like"; focus: "NONE" | "FEATURED" | "VIP" };
}>;
export const ingressRuleVersion = 1;

// Data only: no user script or provider-specific API is executed by the rule engine.
export const ingressRules: readonly IngressRule[] = [
  { id: "gift-galaxy", match: { type: "GIFT", giftId: "galaxy" }, action: { tier: "HIGH", reaction: "VIP", cue: "vip", focus: "VIP" } },
  { id: "gift-streak-10", match: { type: "GIFT", minDelta: 10 }, action: { tier: "NORMAL", reaction: "SPARK", cue: "gift", focus: "FEATURED" } },
  { id: "gift-default", match: { type: "GIFT" }, action: { reaction: "SPARK", cue: "gift", focus: "NONE" } },
  { id: "follow", match: { type: "FOLLOW" }, action: { reaction: "WELCOME", cue: "follow", focus: "NONE" } },
  { id: "like", match: { type: "LIKE_MILESTONE" }, action: { reaction: "HEART", cue: "like", focus: "NONE" } },
];

export function applyIngressRule(event: LiveEvent, rules = ingressRules): LiveEvent {
  const rule = rules.find((r) =>
    r.match.type === event.eventType &&
    (!r.match.giftId || r.match.giftId === event.giftId) &&
    (!r.match.minDelta || event.giftCount >= r.match.minDelta));
  if (!rule) return event;
  const tier = rule.match.giftId ? rule.action.tier : event.metadata.tier ?? rule.action.tier;
  const focus = event.eventType === "GIFT"
    ? tier === "HIGH" ? "VIP" : tier === "NORMAL" ? "FEATURED" : "NONE"
    : rule.action.focus;
  const cue = event.eventType === "GIFT" && tier === "HIGH" ? "vip" : rule.action.cue;
  return {
    ...event,
    metadata: {
      ...event.metadata,
      tier,
      ruleId: rule.id,
      ruleVersion: ingressRuleVersion,
      reaction: rule.action.reaction,
      cue,
      focus,
    },
  };
}

export type IngressPacket = {
  event: unknown;
  sessionId?: string;
  streak?: { id: string; total: number };
};
export type IngressResult = { accepted: boolean; reason: "queued" | "duplicate" | "invalid" | "paused" | "disconnected" | "full" | "rate_limited" };
type Queued = { event: LiveEvent; key: string; at: number; streakKey?: string; streakTotal?: number };

export class EventIngress {
  readonly capacity = 128;
  readonly maxPerFrame = 8;
  readonly seenLimit = 4096;
  private queue: Queued[] = [];
  private seen = new Set<string>();
  private pending = new Set<string>();
  private streaks = new Map<string, number>();
  private pendingStreaks = new Map<string, number>();
  private buckets = new Map<string, { tokens: number; at: number }>();
  paused = false;
  sessionId = "simulator";
  connection: "CONNECTED" | "DISCONNECTED" | "RECONNECTING" = "CONNECTED";
  metrics = { accepted: 0, delivered: 0, duplicate: 0, invalid: 0, rejectedFull: 0, rateLimited: 0, disconnected: 0, expired: 0, cleared: 0, highWater: 0, reconnects: 0 };
  lastResult: IngressResult = { accepted: true, reason: "queued" };

  constructor(private bus: EventBus, private deliver: (event: LiveEvent) => boolean = bus.emit.bind(bus)) {}

  submit(packet: IngressPacket | unknown, at = Date.now()): IngressResult {
    if (this.paused) return this.result("paused");
    if (this.connection !== "CONNECTED") return this.result("disconnected");
    const wrapped = packet && typeof packet === "object" && "event" in packet ? packet as IngressPacket : { event: packet };
    const sessionId = wrapped.sessionId ?? this.sessionId;
    if (!/^[\w.-]{1,64}$/.test(sessionId)) return this.result("invalid");
    let event: LiveEvent;
    try { event = normalizeEvent(wrapped.event); }
    catch (error) { this.bus.error(error); return this.result("invalid"); }
    const key = `${event.source}:${sessionId}:${event.eventId}`;
    if (this.seen.has(key) || this.pending.has(key)) return this.result("duplicate");
    let streakKey = "";
    let streakTotal = 0;
    if (wrapped.streak) {
      const { id, total } = wrapped.streak;
      if (event.eventType !== "GIFT" || !/^[\w.-]{1,64}$/.test(id) || !Number.isInteger(total) || total < 1 || total > 1000 || !event.giftId)
        return this.result("invalid");
      streakKey = `${sessionId}:${event.viewerId}:${event.giftId}:${id}`;
      streakTotal = total;
      const delta = total - (this.pendingStreaks.get(streakKey) ?? this.streaks.get(streakKey) ?? 0);
      if (delta <= 0) return this.result("duplicate");
      event = { ...event, giftCount: delta,
        coins: event.source === "tiktok" && typeof event.metadata.unitCoins === "number" ? event.metadata.unitCoins * delta : event.coins };
    }
    if (this.queue.length >= this.capacity) return this.result("full");
    const bucket = this.buckets.get(sessionId) ?? { tokens: 120, at };
    const tokens = Math.min(120, bucket.tokens + Math.max(0, at - bucket.at) * 0.06);
    if (tokens < 1) { this.buckets.set(sessionId, { tokens, at }); return this.result("rate_limited"); }
    this.buckets.set(sessionId, { tokens: tokens - 1, at });
    if (streakKey) {
      this.pendingStreaks.set(streakKey, streakTotal);
    }
    event = applyIngressRule({ ...event, sessionId });
    this.queue.push({ event, key, at, streakKey: streakKey || undefined, streakTotal: streakKey ? streakTotal : undefined });
    this.pending.add(key);
    this.metrics.accepted++;
    this.metrics.highWater = Math.max(this.metrics.highWater, this.queue.length);
    return this.lastResult = { accepted: true, reason: "queued" };
  }

  drain(at = Date.now()) {
    let delivered = 0;
    let processed = 0;
    while (processed < this.maxPerFrame && this.queue.length) {
      processed++;
      const item = this.queue.shift()!;
      this.pending.delete(item.key);
      this.seen.add(item.key);
      if (this.seen.size > this.seenLimit) this.seen.delete(this.seen.values().next().value!);
      // Only expendable activity expires. Gifts remain queued until delivered or explicitly cleared.
      if (item.event.eventType !== "GIFT" && at - item.at > 6000) { this.metrics.expired++; continue; }
      if (this.deliver(item.event)) {
        this.metrics.delivered++;
        if (item.streakKey) {
          this.streaks.set(item.streakKey, item.streakTotal!);
          if (this.streaks.size > this.seenLimit) this.streaks.delete(this.streaks.keys().next().value!);
        }
      }
      else this.bus.error(`Ingress delivery rejected: ${item.key}`);
      delivered++;
    }
    if (!this.queue.length) this.pendingStreaks.clear();
    return delivered;
  }

  disconnect() { this.connection = "DISCONNECTED"; }
  reconnect(sessionId = this.sessionId) {
    if (!/^[\w.-]{1,64}$/.test(sessionId)) throw Error("sessionId inválido");
    this.connection = "RECONNECTING";
    this.sessionId = sessionId;
    this.metrics.reconnects++;
    this.connection = "CONNECTED";
  }
  pause() { this.paused = true; this.clear(); }
  resume() { this.paused = false; }
  clear() { this.metrics.cleared += this.queue.length; this.queue = []; this.pending.clear(); this.pendingStreaks.clear(); }
  inspect() { return { ...this.metrics, queued: this.queue.length, capacity: this.capacity, maxPerFrame: this.maxPerFrame, paused: this.paused, connection: this.connection, sessionId: this.sessionId, lastResult: this.lastResult }; }
  private result(reason: IngressResult["reason"]): IngressResult {
    if (reason === "duplicate") this.metrics.duplicate++;
    if (reason === "invalid") this.metrics.invalid++;
    if (reason === "full") this.metrics.rejectedFull++;
    if (reason === "rate_limited") this.metrics.rateLimited++;
    if (reason === "disconnected") this.metrics.disconnected++;
    return this.lastResult = { accepted: false, reason };
  }
}
