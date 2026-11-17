import { describe, it, expect } from "vitest";
import * as T from "three";
import { World, defaults, type Dancer } from "../src/domain";
import {
  BlockVisual,
  CharacterSystem,
  CharacterStore,
  characterDefaults,
  characterConfig,
  skinFor,
  resolveClip,
  danceAliases,
} from "../src/characters";
import { AdmissionGate } from "../src/admission";
import { ProceduralAvatar } from "../src/avatars";
const event = (id = "x") => ({
  schemaVersion: 1,
  source: "simulator",
  eventId: id,
  viewerId: "viewer",
  username: "Viewer",
  eventType: "FOLLOW",
  giftCount: 1,
  timestamp: 0,
  metadata: {},
});
function dancer() {
  const w = new World({ ...defaults });
  w.bus.emit(event());
  for (let i = 0; i < 250; i++) w.update(0.1);
  return { w, d: w.spawn.dancers.get("viewer")! };
}
describe("v0.4 safe character integration", () => {
  it("defaults and invalid versions return to PROCEDURAL", () => {
    expect(characterConfig(null)).toEqual(characterDefaults);
    expect(characterConfig({ version: 99, backend: "BLOCK" })).toEqual(
      characterDefaults,
    );
    expect(
      characterConfig({
        backend: "BLOCK",
        palette: "__proto__",
        dance: "evil",
        accessory: "evil",
      }),
    ).toEqual({ ...characterDefaults, backend: "BLOCK" });
  });
  it("loads damaged state safely and records storage failures", () => {
    const store = new CharacterStore({
      getItem: () => "{",
      setItem: () => {
        throw Error("quota");
      },
    });
    expect(store.load()).toEqual(characterDefaults);
    expect(store.warning).toBeTruthy();
    store.save(characterDefaults);
    expect(store.warning).toContain("memoria");
  });
  it("versioned config preserves deterministic identity and curated overrides", () => {
    const c = characterConfig({
      backend: "BLOCK",
      palette: "NEON",
      accessory: "halo",
    });
    expect(skinFor("viewer", c)).toEqual(skinFor("viewer", c));
    expect(skinFor("viewer", c).accessory).toBe("halo");
    expect(skinFor("viewer", c).palette).toBe("NEON");
  });
  it("walking and exit beat VIP, reactions and selected dance", () => {
    const { d } = dancer();
    const c = characterConfig({ backend: "BLOCK", dance: "Robot" });
    d.state = "EXITING";
    d.vipUntil = 999;
    expect(
      resolveClip(d, 30, c, {
        reaction: { kind: "WAVE_HELLO", start: 0, end: 100 },
        groupDance: "Disco",
      }),
    ).toBe("Walk");
  });
  it("reaction expires, group clocks override personal dance and idle is preserved", () => {
    const { d } = dancer();
    d.state = "DANCING";
    d.animationState = "Groove";
    const c = characterConfig({ backend: "BLOCK", dance: "Robot" });
    expect(
      resolveClip(d, 30, c, {
        reaction: { kind: "WAVE_HELLO", start: 20, end: 31 },
      }),
    ).toBe("Wave");
    expect(
      resolveClip(d, 32, c, {
        reaction: { kind: "WAVE_HELLO", start: 20, end: 31 },
      }),
    ).toBe("Robot");
    expect(resolveClip(d, 32, c, { groupDance: "Shuffle" })).toBe("Shuffle");
    expect(resolveClip(d, 32, c, { reduceMotion: true })).toBe("Idle");
  });
  it("all legacy dances have explicit aliases", () =>
    expect(Object.keys(danceAliases)).toHaveLength(16));
  it("world position is applied once: roots remain logical under scaled scene", () => {
    const { d } = dancer(),
      scene = new T.Scene();
    scene.scale.set(0.88, 1, 1.22);
    const system = new CharacterSystem(
        scene,
        characterConfig({ backend: "BLOCK" }),
        () => {},
      ),
      a = system.create(d.id) as BlockVisual;
    d.position = { x: 3, y: 0, z: 4 };
    a.update(d, 30, 0.1);
    system.update([a]);
    expect(a.root.parent).toBe(null);
    expect(a.root.position.x).toBe(3);
    const raw = a.block.parts[0].node.matrixWorld.clone(),
      gpu = new T.Matrix4();
    system.batch!.mesh.getMatrixAt(0, gpu);
    expect(gpu.elements[12]).toBeCloseTo(raw.elements[12]);
    scene.updateMatrixWorld(true);
    const rendered = new T.Matrix4().multiplyMatrices(scene.matrixWorld, gpu);
    expect(rendered.elements[12]).toBeCloseTo(raw.elements[12] * 0.88);
    a.dispose();
    system.dispose();
  });
  it("maps measured locomotion distance and restores to selected dance", () => {
    const { d } = dancer(),
      a = new BlockVisual(
        d.id,
        characterConfig({ backend: "BLOCK", dance: "Disco" }),
      );
    d.animationState = "Walk";
    a.update(d, 1, 0.1);
    d.position.x += 0.2;
    a.update(d, 1.1, 0.1);
    expect(a.block.clip).toBe("Walk");
    d.state = "DANCING";
    d.animationState = "Groove";
    a.update(d, 2, 1);
    expect(a.block.clip).toBe("Disco");
    a.dispose();
  });
  it("group phase is identical despite different viewer speeds and seeds", () => {
    const { d } = dancer(),
      c = characterConfig({ backend: "BLOCK" }),
      a = new BlockVisual("a", c),
      b = new BlockVisual("b", c);
    d.state = "DANCING";
    d.animationState = "Groove";
    a.context = b.context = { groupDance: "Disco", groupStart: 5 };
    a.update(d, 6, 1);
    b.update({ ...d, speed: 3, phase: 9 }, 6, 1);
    expect(a.block.lastPose).toEqual(b.block.lastPose);
    a.dispose();
    b.dispose();
  });
  it("thirty fit instance budget and switching to procedural releases block batch", () => {
    const scene = new T.Scene(),
      s = new CharacterSystem(
        scene,
        characterConfig({ backend: "BLOCK" }),
        () => {},
      ),
      all = Array.from({ length: 30 }, (_, i) => s.create("viewer" + i));
    s.update(all);
    expect(s.inspect(all).blocks).toBe(30);
    expect(s.batch!.mesh.count).toBeLessThan(4096);
    all.forEach((a) => a.dispose());
    s.configure(characterDefaults);
    expect(s.batch).toBe(null);
    expect(scene.children).toHaveLength(0);
    expect(s.create("x")).toBeInstanceOf(ProceduralAvatar);
    s.dispose();
    s.dispose();
  });
  it("constructor failure falls back once per identity and is observable", () => {
    const logs: unknown[] = [],
      s = new CharacterSystem(
        new T.Scene(),
        characterConfig({ backend: "BLOCK" }),
        (e) => logs.push(e),
      );
    expect(s.create("x".repeat(65))).toBeInstanceOf(ProceduralAvatar);
    expect(s.fallbacks).toBe(1);
    expect(logs).toHaveLength(1);
    s.create("x".repeat(65));
    expect(s.fallbacks).toBe(1);
    s.dispose();
  });
});
describe("emergency admission boundary", () => {
  it("pause rejects all producers without poisoning dedupe; resume is explicit", () => {
    const w = new World({ ...defaults }),
      g = new AdmissionGate(w.bus);
    g.pause("operator");
    expect(w.bus.emit(event())).toBe(false);
    expect(w.bus.received).toBe(0);
    expect(g.blocked).toBe(1);
    g.resume();
    expect(w.bus.emit(event())).toBe(true);
    expect(w.bus.emit(event())).toBe(false);
  });
  it("still rejects real sources and contains listener failures", () => {
    const w = new World({ ...defaults });
    const g = new AdmissionGate(w.bus);
    expect(w.bus.emit({ ...event(), source: "liveforge" })).toBe(false);
    w.bus.subscribe(() => {
      throw Error("broken listener");
    });
    expect(w.bus.emit(event())).toBe(true);
    g.ingress.drain();
    expect(w.bus.errors.some((e) => e.includes("broken listener"))).toBe(true);
  });
});
