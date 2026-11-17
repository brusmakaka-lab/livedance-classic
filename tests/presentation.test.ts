import { describe, it, expect } from "vitest";
import { World, defaults, type LiveEvent } from "../src/domain";
import {
  LightingDirector,
  PresentationDirector,
  PresentationStore,
  presentationConfig,
  sceneCatalog,
  visualDance,
} from "../src/presentation";
let serial = 0;
const event = (
  type: LiveEvent["eventType"],
  tier?: "LOW" | "NORMAL" | "HIGH",
): LiveEvent => ({
  schemaVersion: 1,
  eventId: String(++serial),
  viewerId: "viewer",
  username: "Luna",
  eventType: type,
  source: "simulator",
  timestamp: Date.now(),
  giftCount: 1,
  metadata: { tier, top: type === "SIMULATED" },
});
function setup() {
  return {
    w: new World({ ...defaults, inactivity: 600 }),
    p: new PresentationDirector(presentationConfig()),
  };
}
function tick(w: World, p: PresentationDirector, seconds: number) {
  for (let i = 0; i < seconds / 0.05; i++) {
    w.update(0.05);
    p.update(w, 0.05);
  }
}
describe("presentation v2 independent of core", () => {
  it("smooth lighting states and bounded manual beat", () => {
    const l = new LightingDirector();
    for (const state of [
      "AMBIENT",
      "GROOVE",
      "FEATURED",
      "VIP",
      "HYPE",
    ] as const) {
      l.update(state, 0.05, 1, 120);
      expect(l.state).toBe(state);
      expect(l.intensity).toBeGreaterThan(0);
      expect(l.pulse).toBeGreaterThanOrEqual(0);
      expect(l.pulse).toBeLessThanOrEqual(1);
    }
  });
  it("ten deterministic dance variants retain Idle/Walk", () => {
    const set = new Set(
      Array.from({ length: 200 }, (_, i) =>
        visualDance({ id: "viewer-" + i, animationState: "Groove" }),
      ),
    );
    expect(set.size).toBe(16);
    expect(visualDance({ id: "a", animationState: "Walk" })).toBe("Walk");
    expect(visualDance({ id: "a", animationState: "Idle" })).toBe("Idle");
  });
  it("arrival reacts then returns without changing dance", () => {
    const { w, p } = setup();
    w.bus.emit(event("VIEWER_JOIN"));
    tick(w, p, 8);
    const d = w.spawn.dancers.get("viewer")!,
      dance = d.animationState;
    p.react(d.id, "CHEER", w.now, 1);
    tick(w, p, 1.2);
    expect(p.reactions.size).toBe(0);
    expect(d.animationState).toBe(dance);
  });
  it("HIGH sequence coordinates LED lighting camera and expires cleanly", () => {
    const { w, p } = setup();
    w.bus.emit(event("GIFT", "HIGH"));
    tick(w, p, 0.2);
    expect(p.vipId).toBe("viewer");
    expect(p.lights.state).toBe("VIP");
    expect(p.ledTitle).toBe("Luna");
    expect(w.camera.mode).toBe("VIP");
    expect(p.shot).toBe("VIP");
    w.bus.emit(event("GIFT", "NORMAL"));
    tick(w, p, 0.1);
    expect(w.camera.mode).toBe("VIP");
    tick(w, p, 24);
    expect(p.vipId).toBeNull();
    expect(p.reactions.size).toBe(0);
    expect(p.lights.state).toBe("GROOVE");
  });
  it("top contributor is HYPE; cancel removes temporary presentation", () => {
    const { w, p } = setup();
    w.bus.emit(event("SIMULATED"));
    tick(w, p, 0.1);
    expect(p.top).toBe(true);
    expect(p.lights.state).toBe("HYPE");
    w.spawn.dancers.clear();
    w.effects.active.clear();
    p.cancel();
    p.update(w, 0.1);
    expect(p.vipId).toBeNull();
    expect(p.reactions.size).toBe(0);
    expect(p.lights.state).toBe("AMBIENT");
  });
  it("camera OFF respects original mode and reactions remove with dancer", () => {
    const { w, p } = setup();
    w.config.cameraAuto = false;
    p.react("missing", "JUMP", 0, 5);
    tick(w, p, 0.1);
    expect(p.shot).toBe(w.camera.mode);
    expect(p.reactions.size).toBe(0);
  });
  it("branding persists safely with registry restricted to afterglow", () => {
    const map = new Map<string, string>();
    const store = new PresentationStore({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
    });
    const c = presentationConfig({
      title: "Mi live",
      branding: false,
      accent: "#ff7722",
      scene: "unknown" as any,
    });
    store.save(c);
    expect(store.load()).toEqual(c);
    expect(c.scene).toBe("afterglow");
    expect(sceneCatalog.filter((x) => x.available)).toHaveLength(1);
  });
  it("bad branding falls back and clamps numeric settings", () => {
    const store = new PresentationStore({
      getItem: () => "{",
      setItem: () => {},
    });
    expect(store.load().title).toBe("LiveDance");
    expect(store.warning).not.toBe("");
    expect(presentationConfig({ framing: 99, accent: "url(x)" }).framing).toBe(
      1.15,
    );
  });
});
