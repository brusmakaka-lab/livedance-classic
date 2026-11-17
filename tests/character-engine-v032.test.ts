import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as T from "three";
import {
  CharacterEngine,
  CharacterCache,
  GLBRenderer,
  validatePack,
  rendererFor,
  selectLOD,
  identity,
  animationMap,
  PACK,
  expressions,
} from "../src/character-engine/engine";
import { World, defaults, type Dancer } from "../src/domain";
const load = async (url: string) => {
  const f = await readFile("public" + url);
  return new GLTFLoader().parseAsync(
    f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength),
    "",
  );
};
let cache: CharacterCache;
beforeAll(async () => {
  cache = new CharacterCache();
  await cache.preload(load);
});
afterAll(() => cache.dispose());
const dancer = () => {
  const w = new World({ ...defaults });
  w.bus.emit({
    schemaVersion: 1,
    eventId: "t",
    source: "simulator",
    viewerId: "a",
    username: "a",
    eventType: "FOLLOW",
    giftCount: 1,
    timestamp: 0,
    metadata: {},
  });
  for (let i = 0; i < 150; i++) w.update(0.1, 0.1);
  return { ...w.spawn.dancers.get("a")!, animationState: "Groove" } as Dancer;
};
it("loads three self-contained skinned LODs with known pack/rig and19 clips", () => {
  expect(cache.templates).toHaveLength(3);
  for (const g of cache.templates) {
    expect(() => validatePack(g)).not.toThrow();
    expect(g.animations).toHaveLength(19);
  }
  expect(cache.templates[0].scene.getObjectByName("Body")).toBeInstanceOf(
    T.SkinnedMesh,
  );
});
it("renderer selection is stable and AUTO LOW stays procedural", () => {
  expect(rendererFor("AUTO", "LOW")).toBe("PROCEDURAL");
  expect(rendererFor("AUTO", "MEDIUM")).toBe("GLB");
  expect(rendererFor("PROCEDURAL", "HIGH")).toBe("PROCEDURAL");
});
it("appearance is deterministic, varied and bounded", () => {
  expect(identity("alice")).toEqual(identity("alice"));
  const ids = Array.from({ length: 100 }, (_, i) => identity("viewer" + i));
  expect(new Set(ids.map((x) => x.hair)).size).toBe(8);
  expect(ids.every((x) => x.height >= 0.96 && x.height <= 1.04)).toBe(true);
});
it("cache coalesces parallel preload", async () => {
  const c = new CharacterCache(),
    loader = vi.fn(load);
  await Promise.all([c.preload(loader), c.preload(loader)]);
  expect(loader).toHaveBeenCalledTimes(3);
  expect(c.loads).toBe(1);
  c.dispose();
});
it("variants share position/skin buffers but keep separate colors", () => {
  const a = cache.geometry(0, 0),
    b = cache.geometry(0, 1);
  expect(a.getAttribute("position")).toBe(b.getAttribute("position"));
  expect(a.getAttribute("skinWeight")).toBe(b.getAttribute("skinWeight"));
  expect(a.getAttribute("color")).not.toBe(b.getAttribute("color"));
  expect(cache.geometry(0, 0)).toBe(a);
});
it("LOD has hysteresis and Featured boost", () => {
  expect(selectLOD(8.5, "MEDIUM", false, 0)).toBe(0);
  expect(selectLOD(30, "MEDIUM", true, 2)).toBe(0);
  expect(selectLOD(30, "MEDIUM")).toBe(2);
  expect(selectLOD(2, "LOW")).toBe(2);
});
it("clones have independent bones and shared geometry", () => {
  const a = new GLBRenderer(cache),
    b = new GLBRenderer(cache);
  expect(a.body.skeleton).not.toBe(b.body.skeleton);
  expect(a.body.skeleton.bones[0]).not.toBe(b.body.skeleton.bones[0]);
  expect(a.body.geometry).toBe(b.body.geometry);
  a.dispose();
  b.dispose();
});
it("all old dance names map to a valid GLB clip", () => {
  for (const clip of Object.values(animationMap))
    expect(cache.templates[0].animations.some((c) => c.name === clip)).toBe(
      true,
    );
});
it("navigation retains Walk priority over reaction/group", () => {
  const a = new GLBRenderer(cache),
    d = dancer();
  d.state = "EXITING";
  a.update(d, 20, 0.016, {
    quality: "MEDIUM",
    distance: 3,
    group: { clip: "Electro", start: 10 },
    reaction: "CHEER",
  });
  expect(a.current).toBe("Walk");
  a.dispose();
});
it("group uses same clip and phase, independent of viewer phase/speed", () => {
  const a = new GLBRenderer(cache),
    b = new GLBRenderer(cache),
    d = dancer(),
    ctx = {
      quality: "MEDIUM" as const,
      distance: 3,
      group: { clip: "Electro", start: 20 },
    };
  a.update(d, 21, 0.016, ctx);
  b.update({ ...d, phase: 5, speed: 1.4 }, 21, 0.016, ctx);
  expect(a.current).toBe("Electro");
  expect(a.actions.get("Electro")!.time).toBe(b.actions.get("Electro")!.time);
  a.update(d, 23, 0.016, { quality: "MEDIUM", distance: 3 });
  expect(a.current).toBe("Groove");
  a.dispose();
  b.dispose();
});
it("blend preserves previous action while transitioning", () => {
  const a = new GLBRenderer(cache),
    d = dancer();
  a.update(d, 20, 0.016, { quality: "MEDIUM", distance: 3, forceClip: "Idle" });
  a.update(d, 20.016, 0.016, {
    quality: "MEDIUM",
    distance: 3,
    forceClip: "Walk",
  });
  expect(a.actions.get("Idle")!.getEffectiveWeight()).toBeGreaterThan(0);
  expect(a.actions.get("Walk")!.isRunning()).toBe(true);
  a.dispose();
});
it("unknown animation recovers with Idle", () => {
  const a = new GLBRenderer(cache);
  a.update(dancer(), 20, 0.016, {
    quality: "MEDIUM",
    distance: 3,
    forceClip: "missing",
  });
  expect(a.current).toBe("Idle");
  a.dispose();
});
it("expressions, blink and accessories use known head anchors", () => {
  const a = new GLBRenderer(cache),
    d = dancer();
  for (const expression of expressions)
    a.update(d, 21, 0.1, {
      quality: "MEDIUM",
      distance: 3,
      expression,
      rank: 1,
    });
  expect(a.model.getObjectByName("Mouth")!.scale.y).toBeGreaterThan(1);
  expect(a.model.getObjectByName("Crown")!.visible).toBe(true);
  expect(a.model.getObjectByName("Crown")!.parent!.name).toBe("head");
  a.release();
  a.reset("new");
  expect(a.model.getObjectByName("Mouth")!.scale.y).toBe(1);
  a.dispose();
});
it("pool is bounded, reusable and release is idempotent", async () => {
  const e = new CharacterEngine();
  e.cache = cache;
  e.ready = true;
  const hs = Array.from({ length: 12 }, (_, i) =>
    e.acquire("v" + i, "GLB", "MEDIUM"),
  );
  hs.forEach((h) => {
    h.release();
    h.release();
  });
  expect(e.active.size).toBe(0);
  expect(e.pool.length).toBe(8);
  const h = e.acquire("new", "GLB", "MEDIUM");
  expect(e.reused).toBe(1);
  h.release();
  e.pool.forEach((a) => a.dispose());
  e.pool = [];
});
it("release does not destroy resources used by another avatar", () => {
  const a = new GLBRenderer(cache),
    b = new GLBRenderer(cache),
    spy = vi.spyOn(a.body.geometry, "dispose");
  a.dispose();
  expect(spy).not.toHaveBeenCalled();
  b.update(dancer(), 22, 0.016);
  expect(b.current).toBe("Groove");
  b.dispose();
  spy.mockRestore();
});
it("missing asset recovers procedurally with component diagnostic", async () => {
  const e = new CharacterEngine();
  await e.preload(async () => {
    throw Error("404 missing");
  });
  const h = e.acquire("a", "GLB", "MEDIUM");
  expect(h.kind).toBe("PROCEDURAL");
  expect(e.logs[0].message).toContain("fallback");
  h.release();
  e.dispose();
});
it("corrupt GLB recovers without throwing into scene", async () => {
  const e = new CharacterEngine();
  await e.preload(() => new GLTFLoader().parseAsync(new ArrayBuffer(12), ""));
  expect(e.ready).toBe(false);
  expect(e.acquire("a", "GLB", "MEDIUM").kind).toBe("PROCEDURAL");
  e.dispose();
});
it.each(["version", "clip", "material", "accessory"])(
  "rejects incompatible %s and recovers",
  async (fault) => {
    const e = new CharacterEngine();
    await e.preload(async (u) => {
      const g = await load(u);
      if (fault === "version")
        g.scene.traverse((o) => {
          if (o.userData.characterPackVersion)
            o.userData.characterPackVersion = "other";
        });
      if (fault === "clip")
        g.animations = g.animations.filter((c) => c.name !== "Walk");
      if (fault === "material")
        (g.scene.getObjectByName("Body") as T.Mesh).material =
          new T.MeshBasicMaterial();
      if (fault === "accessory")
        g.scene.getObjectByName("Crown")!.removeFromParent();
      return g;
    });
    expect(e.ready).toBe(false);
    expect(e.logs[0].recovered).toBe(true);
    e.dispose();
  },
);
it("rejects root motion on known rig", async () => {
  const g = await load("/assets/characters/v2/lod0.glb");
  g.animations[0].tracks.push(
    new T.VectorKeyframeTrack("root.position", [0, 1], [0, 0, 0, 2, 0, 0]),
  );
  expect(() => validatePack(g)).toThrow("Root motion");
});
it("all nineteen clips deform finite vertices without moving navigation root", () => {
  const a = new GLBRenderer(cache),
    d = dancer(),
    point = new T.Vector3();
  for (const clip of a.actions.keys()) {
    a.update(d, 20, 0.03, { quality: "HIGH", distance: 2, forceClip: clip });
    a.root.updateMatrixWorld(true);
    a.body.skeleton.update();
    for (const i of [0, 100, 1000]) {
      point.fromBufferAttribute(a.body.geometry.getAttribute("position"), i);
      a.body.applyBoneTransform(i, point);
      expect([point.x, point.y, point.z].every(Number.isFinite)).toBe(true);
    }
    expect(a.root.position.x).toBe(d.position.x);
  }
  a.dispose();
});

it("dispose during async preload frees the arriving template and cannot revive engine", async () => {
  const e = new CharacterEngine();
  let resolve!: (g: GLTF) => void;
  const pending = e.preload(() => new Promise<GLTF>((r) => (resolve = r)));
  e.dispose();
  const g = await load("/assets/characters/v2/lod0.glb");
  const spy = vi.spyOn(
    (g.scene.getObjectByName("Body") as T.Mesh).geometry,
    "dispose",
  );
  resolve(g);
  await pending;
  expect(e.ready).toBe(false);
  expect(e.cache.templates).toHaveLength(0);
  expect(spy).toHaveBeenCalledOnce();
  expect(() => e.acquire("x", "GLB", "MEDIUM")).toThrow("disposed");
});

it("expression scaling preserves mouth and blink centers on face", () => {
  const a = new GLBRenderer(cache);
  a.reset("a");
  a.update(dancer(), 21, 1, {
    quality: "HIGH",
    distance: 2,
    expression: "SURPRISED",
  });
  const mouth = a.model.getObjectByName("Mouth")!;
  mouth.updateMatrix();
  const point = new T.Vector3(0, -0.125, 0.239).applyMatrix4(mouth.matrix);
  expect(point.y).toBeCloseTo(-0.125, 6);
  const eyes = a.model.getObjectByName("Eyes")!;
  eyes.updateMatrix();
  expect(new T.Vector3(0, 0.02, 0.245).applyMatrix4(eyes.matrix).y).toBeCloseTo(
    0.02,
    6,
  );
  a.release();
  a.reset("b");
  expect(mouth.position.y).toBe(0);
  a.dispose();
});
