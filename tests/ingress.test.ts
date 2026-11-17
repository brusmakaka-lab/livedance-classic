import { describe, expect, it } from "vitest";
import { EventBus, type LiveEvent } from "../src/domain";
import { EventIngress } from "../src/ingress";

const event = (eventId: string, changes: Partial<LiveEvent> = {}): LiveEvent => ({
  schemaVersion: 1, eventId, source: "simulator", viewerId: "viewer-a",
  username: "viewer.a", eventType: "GIFT", giftId: "rose", giftName: "Rose",
  giftCount: 1, timestamp: 100, metadata: {}, ...changes,
});

describe("bounded event ingress", () => {
  it("delivers at most eight events per frame and retains accepted gifts", () => {
    const bus = new EventBus();
    const ingress = new EventIngress(bus);
    for (let i = 0; i < 20; i++) expect(ingress.submit(event(`g-${i}`), 0).accepted).toBe(true);
    expect(ingress.drain(60_000)).toBe(8);
    expect(bus.received).toBe(8);
    expect(ingress.inspect().queued).toBe(12);
    ingress.drain(60_000); ingress.drain(60_000);
    expect(bus.received).toBe(20);
    expect(ingress.metrics.expired).toBe(0);
  });

  it("deduplicates reconnect replays and converts cumulative streaks to deltas once", () => {
    const bus = new EventBus();
    const ingress = new EventIngress(bus);
    const counts: number[] = [];
    bus.subscribe((e) => counts.push(e.giftCount));
    const packet = (id: string, total: number) => ({ event: event(id), sessionId: "fixture-1", streak: { id: "combo-a", total } });
    expect(ingress.submit(packet("a", 3), 0).accepted).toBe(true);
    ingress.drain(0);
    ingress.disconnect();
    expect(ingress.submit(packet("offline", 4), 50).reason).toBe("disconnected");
    ingress.reconnect("fixture-1");
    expect(ingress.submit(packet("a", 3), 100).reason).toBe("duplicate");
    expect(ingress.submit(packet("b", 8), 100).accepted).toBe(true);
    expect(ingress.submit(packet("c", 8), 100).reason).toBe("duplicate");
    ingress.drain(100);
    expect(counts).toEqual([3, 5]);
    expect(ingress.metrics.reconnects).toBe(1);
    expect(ingress.metrics.duplicate).toBe(2);
    ingress.reconnect("fixture-2");
    expect(ingress.submit({ event: event("a"), sessionId: "fixture-2" }, 200).accepted).toBe(true);
    ingress.drain(200);
    expect(bus.received).toBe(3);
  });

  it("returns explicit full and rate-limit reasons without advancing a rejected streak", () => {
    const bus = new EventBus();
    const ingress = new EventIngress(bus);
    for (let i = 0; i < 128; i++) expect(ingress.submit(event(`e-${i}`), i * 20).accepted).toBe(true);
    expect(ingress.submit({ event: event("next"), streak: { id: "combo-next", total: 4 } }, 2600).reason).toBe("full");
    ingress.drain(2600);
    expect(ingress.submit({ event: event("next"), streak: { id: "combo-next", total: 4 } }, 2620).accepted).toBe(true);
    expect(ingress.metrics.rejectedFull).toBe(1);
    const rate = new EventIngress(new EventBus());
    for (let i = 0; i < 120; i++) expect(rate.submit(event(`r-${i}`), 0).accepted).toBe(true);
    expect(rate.submit(event("r-120"), 0).reason).toBe("rate_limited");
    expect(rate.metrics.rateLimited).toBe(1);
  });

  it("applies versioned gift/follow/like rules and accounts for expiry and emergency clearing", () => {
    const bus = new EventBus();
    const ingress = new EventIngress(bus);
    const seen: LiveEvent[] = [];
    bus.subscribe((e) => seen.push(e));
    expect(ingress.submit(event("galaxy", { giftId: "galaxy" }), 0).accepted).toBe(true);
    expect(ingress.submit(event("follow", { eventType: "FOLLOW" }), 0).accepted).toBe(true);
    expect(ingress.submit(event("like", { eventType: "LIKE_MILESTONE" }), 0).accepted).toBe(true);
    expect(ingress.submit(event("high-streak", { giftCount: 10, metadata: { tier: "HIGH" } }), 0).accepted).toBe(true);
    ingress.drain(0);
    expect(seen.map((e) => e.metadata.ruleId)).toEqual(["gift-galaxy", "follow", "like", "gift-streak-10"]);
    expect(seen[0].metadata.tier).toBe("HIGH");
    expect(seen[0].metadata.focus).toBe("VIP");
    expect(seen[3].metadata.tier).toBe("HIGH");
    expect(ingress.submit(event("stale", { eventType: "COMMENT" }), 0).accepted).toBe(true);
    ingress.drain(7000);
    expect(ingress.metrics.expired).toBe(1);
    expect(ingress.submit(event("clear"), 7000).accepted).toBe(true);
    ingress.pause();
    expect(ingress.inspect().queued).toBe(0);
    expect(ingress.metrics.cleared).toBe(1);
    expect(ingress.submit(event("blocked"), 7000).reason).toBe("paused");
    ingress.resume();
    const pending = { event: event("combo-retry"), sessionId: "fixture", streak: { id: "clear-test", total: 7 } };
    expect(ingress.submit(pending, 7100).accepted).toBe(true);
    ingress.clear();
    expect(ingress.submit(pending, 7200).accepted).toBe(true);
    ingress.drain(7200);
    expect(seen.at(-1)?.giftCount).toBe(7);
  });
});
