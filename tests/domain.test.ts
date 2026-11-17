import { describe, it, expect } from "vitest";
import {
  CameraDirector,
  ConfigStore,
  defaults,
  EffectManager,
  EventBus,
  hash,
  normalizeEvent,
  QualityController,
  SlotAllocator,
  transition,
  validateConfig,
  World,
  type LiveEvent,
  type Config,
} from "../src/domain";
let sequence = 0;
const event = (
  id = "a",
  type: LiveEvent["eventType"] = "VIEWER_JOIN",
  extra: Partial<LiveEvent> = {},
): LiveEvent => ({
  schemaVersion: 1,
  eventId: `event-${++sequence}`,
  source: "simulator",
  viewerId: id,
  username: "User " + id,
  eventType: type,
  giftCount: 1,
  timestamp: Date.now(),
  metadata: {},
  ...extra,
});
const config = (v: Partial<Config> = {}) => ({ ...defaults, ...v });
function tick(w: World, seconds: number) {
  for (let t = 0; t < seconds; t += 0.05) w.update(0.05);
}
describe("Event contract / EventBus", () => {
  it("sanitizes names and rejects malformed input", () => {
    expect(
      normalizeEvent(event("a", "COMMENT", { username: "<test>\u0001" }))
        .username,
    ).toBe("test");
    expect(() => normalizeEvent({ ...event(), eventType: "HACK" })).toThrow();
    expect(() => normalizeEvent({ ...event(), giftCount: Infinity })).toThrow();
    expect(() => normalizeEvent({ ...event(), source: "unknown-provider" })).toThrow();
    expect(normalizeEvent({ ...event(), source: "tiktok" }).source).toBe("tiktok");
    expect(() =>
      normalizeEvent({ ...event(), metadata: { tier: "BAD" } }),
    ).toThrow();
  });
  it("deduplicates, isolates failing subscribers and supports unsubscribe", () => {
    const b = new EventBus();
    let count = 0;
    b.subscribe(() => {
      throw Error("listener");
    });
    const off = b.subscribe(() => count++);
    const e = event();
    expect(b.emit(e)).toBe(true);
    expect(b.emit(e)).toBe(false);
    expect(count).toBe(1);
    expect(b.errors).toHaveLength(1);
    off();
    b.emit(event());
    expect(count).toBe(1);
  });
  it("bounds history and errors during spam", () => {
    const b = new EventBus();
    for (let i = 0; i < 3000; i++) b.emit(event());
    for (let i = 0; i < 100; i++) b.emit({});
    expect(b.history).toHaveLength(100);
    expect(b.errors).toHaveLength(50);
  });
});
describe("Slots and lifecycle", () => {
  it("generates separated unique slots and reserves VIP center", () => {
    const a = new SlotAllocator(),
      slots = Array.from({ length: 60 }, (_, i) => a.allocate("d" + i)!);
    expect(new Set(slots.map((s) => s.id)).size).toBe(60);
    for (const s of slots)
      for (const t of slots)
        if (s !== t)
          expect(
            Math.hypot(
              s.position.x - t.position.x,
              s.position.z - t.position.z,
            ),
          ).toBeGreaterThan(1.5);
    expect(slots.every((s) => !s.vip)).toBe(true);
    expect(a.allocate("vip", true)?.vip).toBe(true);
    a.release("d0");
    expect(a.allocate("new")?.id).toBe(0);
  });
  it("walks from entry, passes idle, then dances", () => {
    const w = new World(config());
    w.bus.emit(event());
    w.update(0.05);
    const d = w.spawn.dancers.get("a")!;
    expect(d.state).toBe("SPAWNING");
    const start = { ...d.position };
    tick(w, 1);
    expect(d.state).toBe("ENTERING");
    expect(d.animationState).toBe("Walk");
    expect(d.position.x).not.toBe(start.x);
    tick(w, 8);
    expect(d.state).toBe("DANCING");
    expect(
      Math.hypot(
        d.position.x - d.slot.position.x,
        d.position.z - d.slot.position.z,
      ),
    ).toBeLessThan(0.08);
    expect(transition(d, "SPAWNING", w.now)).toBe(false);
  });
  it("deduplicates viewers across queued interactions", () => {
    const w = new World(config());
    for (let i = 0; i < 10; i++) w.bus.emit(event("same", "COMMENT"));
    tick(w, 7);
    expect(w.spawn.dancers.size).toBe(1);
    expect(w.spawn.queue).toHaveLength(0);
  });
  it("spawns 30 with non-overlapping final positions", () => {
    const w = new World(config());
    for (let i = 0; i < 30; i++) w.bus.emit(event("id" + i));
    tick(w, 40);
    expect(w.spawn.dancers.size).toBe(30);
    expect(w.spawn.queue).toHaveLength(0);
    for (const d of w.spawn.dancers.values()) expect(d.state).toBe("DANCING");
    const ds = [...w.spawn.dancers.values()];
    for (const a of ds)
      for (const b of ds)
        if (a !== b)
          expect(
            Math.hypot(
              a.position.x - b.position.x,
              a.position.z - b.position.z,
            ),
          ).toBeGreaterThan(1.4);
  });
  it("replaces only after exit and never exceeds capacity", () => {
    const w = new World(config({ maxDancers: 2 }));
    for (let i = 0; i < 8; i++) w.bus.emit(event("id" + i));
    for (let t = 0; t < 80; t += 0.05) {
      w.update(0.05);
      expect(w.spawn.dancers.size).toBeLessThanOrEqual(2);
    }
    expect(w.spawn.exited).toBeGreaterThan(0);
    expect(w.spawn.queue).toHaveLength(0);
  });
  it("protects VIP at capacity and eventually drains the queue", () => {
    const w = new World(config({ maxDancers: 1 }));
    w.bus.emit(event("vip", "GIFT", { metadata: { tier: "HIGH" } }));
    tick(w, 1);
    w.bus.emit(event("new"));
    tick(w, 4);
    expect(w.spawn.dancers.has("vip")).toBe(true);
    expect(w.spawn.dancers.get("vip")!.state).not.toBe("EXITING");
    tick(w, 25);
    expect(w.spawn.dancers.has("new")).toBe(true);
    expect(w.spawn.dancers.size).toBe(1);
  });
  it("retires inactive dancers and clears slots and effects", () => {
    const w = new World(config({ inactivity: 10 }));
    w.bus.emit(event("a", "GIFT", { metadata: { tier: "HIGH" } }));
    tick(w, 35);
    expect(w.spawn.dancers.size).toBe(0);
    expect(w.spawn.slots.occupied).toBe(0);
    expect(w.effects.active.size).toBe(0);
  });
  it("reject policy and bounded queue work", () => {
    const w = new World(config({ maxDancers: 1, replacement: "reject" }));
    for (let i = 0; i < 500; i++) w.bus.emit(event("a" + i));
    expect(w.spawn.queue.length).toBeLessThanOrEqual(240);
    tick(w, 20);
    expect(w.spawn.dancers.size).toBe(1);
    expect(w.spawn.dropped).toBeGreaterThan(0);
  });
  it("reducing capacity protects VIP and converges after expiration", () => {
    const w = new World(config({ maxDancers: 3 }));
    for (let i = 0; i < 3; i++)
      w.bus.emit(event("a" + i, "GIFT", { metadata: { tier: "HIGH" } }));
    tick(w, 2);
    w.config.maxDancers = 1;
    tick(w, 2);
    expect(w.spawn.dancers.size).toBe(3);
    tick(w, 40);
    expect(w.spawn.dancers.size).toBe(1);
  });
  it("uses elapsed time for cleanup after tab suspension", () => {
    const w = new World(config());
    w.bus.emit(event("a", "FOLLOW"));
    tick(w, 1);
    w.update(0.1, 120);
    expect(w.effects.active.size).toBe(0);
    expect(w.spawn.dancers.get("a")?.state).toBe("EXITING");
  });
});
describe("Effects and camera", () => {
  it("replaces same kind with priority, expires and removes orphan effects", () => {
    const e = new EffectManager();
    e.add("a", "aura", 0, 5, 3);
    e.add("a", "aura", 1, 1, 1);
    expect(e.active.size).toBe(1);
    expect(e.forDancer("a")[0].end).toBe(5);
    e.add("b", "text", 0, 10);
    e.update(4, new Set(["a"]));
    expect(e.active.size).toBe(1);
    e.update(6, new Set(["a"]));
    expect(e.active.size).toBe(0);
  });
  it("all gift tiers, follow, top and like generate effects", () => {
    const w = new World(config());
    w.bus.emit(event());
    tick(w, 0.6);
    w.bus.emit(event("a", "FOLLOW"));
    expect(w.effects.has("a", "particles")).toBe(true);
    w.bus.emit(event("a", "GIFT", { metadata: { tier: "LOW" } }));
    expect(w.effects.has("a", "aura")).toBe(true);
    w.bus.emit(event("a", "GIFT", { metadata: { tier: "NORMAL" } }));
    expect(w.camera.mode).toBe("FEATURED");
    w.bus.emit(event("a", "GIFT", { metadata: { tier: "HIGH" } }));
    expect(w.effects.has("a", "scale")).toBe(true);
    expect(w.camera.mode).toBe("VIP");
    w.bus.emit(event("a", "SIMULATED", { metadata: { top: true } }));
    expect(w.effects.has("a", "crown")).toBe(true);
    tick(w, 35);
    expect(w.effects.active.size).toBe(0);
  });
  it("VIP cannot be interrupted by a lower priority and returns wide", () => {
    const c = new CameraDirector(),
      cfg = config();
    c.request("VIP", "v", 0, 5);
    expect(c.request("FEATURED", "f", 1, 10)).toBe(false);
    c.update(5, cfg, new Set(["v", "f"]));
    expect(c.mode).toBe("WIDE");
    c.update(20, cfg, new Set());
    expect(c.mode).toBe("ORBIT");
    c.update(28, cfg, new Set());
    expect(c.mode).toBe("WIDE");
  });
  it("missing targets and disabled auto resolve to wide", () => {
    const c = new CameraDirector();
    c.request("VIP", "v", 0, 5);
    c.update(1, config(), new Set());
    expect(c.mode).toBe("WIDE");
    c.request("FEATURED", "v", 1, 5);
    c.update(2, config({ cameraAuto: false }), new Set(["v"]));
    expect(c.mode).toBe("WIDE");
  });
});
describe("Configuration and quality", () => {
  it("clamps, rejects NaN, ignores unknown values and preserves valid settings", () => {
    const c = validateConfig({
      maxDancers: 999,
      inactivity: NaN,
      quality: "ULTRA",
      master: -1,
    });
    expect(c.maxDancers).toBe(60);
    expect(c.inactivity).toBe(120);
    expect(c.quality).toBe("MEDIUM");
    expect(c.master).toBe(0);
    expect(hash("viewer")).toBe(hash("viewer"));
  });
  it("roundtrips and recovers from corrupt or unavailable storage", () => {
    let str: string | null = null;
    const s = new ConfigStore({
      getItem: () => str,
      setItem: (_, v) => {
        str = v;
      },
    });
    s.save(config({ maxDancers: 22, mute: false }));
    expect(s.load().maxDancers).toBe(22);
    expect(s.load().mute).toBe(false);
    str = "{broken";
    expect(s.load()).toEqual(defaults);
    expect(s.warning).not.toBe("");
    const bad = new ConfigStore({
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    });
    expect(bad.load()).toEqual(defaults);
    expect(bad.save(config())).toBe(false);
  });
  it("degrades after sustained low fps, avoids thrashing, recovers slowly", () => {
    const q = new QualityController("HIGH");
    for (let i = 0; i < 5; i++) q.update(20, 1, true, "HIGH");
    expect(q.current).toBe("HIGH");
    q.update(20, 1, true, "HIGH");
    expect(q.current).toBe("MEDIUM");
    for (let i = 0; i < 10; i++) q.update(20, 1, true, "HIGH");
    expect(q.current).toBe("MEDIUM");
    for (let i = 0; i < 31; i++) q.update(60, 1, true, "HIGH");
    expect(q.current).toBe("HIGH");
    q.update(10, 1, false, "LOW");
    expect(q.current).toBe("LOW");
  });
});
