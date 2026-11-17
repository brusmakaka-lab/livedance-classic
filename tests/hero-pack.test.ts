import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  HeroCache,
  HeroVisual,
  validateManifest,
  validateHero,
  createHeroOrFallback,
  clips,
  expressions,
} from "../src/hero/asset";
const manifest = async () =>
  JSON.parse(await readFile("public/assets/hero/manifest.json", "utf8"));
const load = async (u: string) => {
  const b = await readFile("public" + u);
  return new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
};
let cache: HeroCache;
beforeAll(async () => {
  cache = new HeroCache();
  await cache.preload(load, manifest);
});
afterAll(() => cache.dispose());
it("validates version2 manifest and known rig with three bounded local paths", async () => {
  const m = await manifest();
  expect(() => validateManifest(m)).not.toThrow();
  for (const bad of [
    { ...m, packVersion: 9 },
    { ...m, lods: [{ ...m.lods[0], file: "../private" }, ...m.lods.slice(1)] },
    { ...m, animations: [] },
  ])
    expect(() => validateManifest(bad)).toThrow();
});
it("all LOD GLBs have skinning,8 clips and required face", () => {
  expect(cache.templates).toHaveLength(3);
  for (const t of cache.templates) {
    expect(() => validateHero(t)).not.toThrow();
    expect(t.animations.map((a) => a.name)).toEqual(clips);
  }
});
it("coalesces loads and does not duplicate source models", async () => {
  const c = new HeroCache(),
    loader = vi.fn(load);
  await Promise.all([c.preload(loader, manifest), c.preload(loader, manifest)]);
  expect(loader).toHaveBeenCalledTimes(3);
  c.dispose();
});
it("rejects incomplete assets", async () => {
  const g = await load("/assets/hero/hero-lod2.glb");
  g.animations.pop();
  expect(() => validateHero(g)).toThrow("clip");
});
it("uses one shared skeleton across meshes of each independent clone", () => {
  const a = new HeroVisual(cache),
    b = new HeroVisual(cache),
    s = new Set<T.Skeleton>();
  a.model.traverse((o) => {
    if (o instanceof T.SkinnedMesh) s.add(o.skeleton);
  });
  expect(s.size).toBe(1);
  expect((a.model.getObjectByName("Face") as T.SkinnedMesh).skeleton).not.toBe(
    (b.model.getObjectByName("Face") as T.SkinnedMesh).skeleton,
  );
  a.dispose();
  b.dispose();
});
it("material palettes clone colors without modifying cached source", () => {
  const a = cache.palette(0),
    b = cache.palette(1);
  expect(a.get("Skin")).not.toBe(b.get("Skin"));
  expect((a.get("Skin") as T.MeshStandardMaterial).color.getHex()).not.toBe(
    (b.get("Skin") as T.MeshStandardMaterial).color.getHex(),
  );
  expect(cache.palette(1)).toBe(b);
});
it("LOD swaps preserve rig,clip and identity and restore full features", () => {
  const a = new HeroVisual(cache, "hero");
  const skeleton = (a.model.getObjectByName("Face") as T.SkinnedMesh).skeleton;
  for (const lod of [0, 1, 2, 0]) {
    a.forceLOD = lod;
    a.pose("Groove", 1, 0.016);
    expect(a.lod).toBe(lod);
    expect(a.current).toBe("Groove");
    expect((a.model.getObjectByName("Face") as T.SkinnedMesh).skeleton).toBe(
      skeleton,
    );
  }
  expect(a.model.getObjectByName("Lid1")!.visible).toBe(true);
  a.dispose();
});
it("all expressions drive finite bounded morph weights", () => {
  const a = new HeroVisual(cache);
  for (const e of expressions) {
    a.expression = e;
    for (let i = 0; i < 30; i++) a.pose("Idle", 1 + i * 0.016, 0.016);
    a.model.traverse((o) => {
      if (o instanceof T.Mesh && o.morphTargetInfluences)
        expect(
          o.morphTargetInfluences.every(
            (x) => Number.isFinite(x) && x >= 0 && x <= 1.01,
          ),
        ).toBe(true);
    });
  }
  a.dispose();
});
it("blink varies intervals and SURPRISED holds eyes open", () => {
  const a = new HeroVisual(cache, "hero");
  const starts: number[] = [];
  let last = false;
  for (let i = 0; i < 1600; i++) {
    const t = i * 0.02;
    a.pose("Idle", t, 0.02);
    const eye = a.model.getObjectByName("EyeL") as T.Mesh;
    const now =
      eye.morphTargetInfluences![eye.morphTargetDictionary!.Blink] > 0.2;
    if (now && !last) starts.push(t);
    last = now;
  }
  expect(starts.length).toBeGreaterThan(3);
  expect(
    new Set(starts.slice(1).map((x, i) => Math.round((x - starts[i]) * 10)))
      .size,
  ).toBeGreaterThan(1);
  a.expression = "SURPRISED";
  a.pose("Idle", 40, 0.016);
  const eye = a.model.getObjectByName("EyeL") as T.Mesh;
  expect(eye.morphTargetInfluences![eye.morphTargetDictionary!.Blink]).toBe(0);
  a.dispose();
});
it("animation selection crossfades and missing names fall back to Idle", () => {
  const a = new HeroVisual(cache);
  a.pose("Groove", 1, 0.016);
  a.pose("Wave", 1.02, 0.016);
  expect(a.actions.get("Groove")!.getEffectiveWeight()).toBeGreaterThan(0);
  a.pose("unknown", 1.04, 0.016);
  expect(a.current).toBe("Idle");
  a.dispose();
});
it("no clip contains horizontal root motion", () => {
  for (const c of cache.templates[0].animations)
    for (const t of c.tracks)
      if (t.name === "hips.position")
        for (let i = 0; i < t.values.length; i += 3) {
          expect(t.values[i]).toBe(0);
          expect(t.values[i + 2]).toBe(0);
        }
});
it("missing asset produces usable procedural fallback", async () => {
  const c = new HeroCache();
  await expect(
    c.preload(async () => {
      throw Error("404");
    }, manifest),
  ).rejects.toThrow();
  const a = createHeroOrFallback(c, "hero");
  expect(a).not.toBeInstanceOf(HeroVisual);
  expect(c.logs[0]).toContain("fallback");
  a.dispose();
  c.dispose();
});
it("dispose is idempotent and cannot free another clone geometry", () => {
  const a = new HeroVisual(cache),
    b = new HeroVisual(cache),
    g = (a.model.getObjectByName("Hero_Jacket") as T.Mesh).geometry,
    spy = vi.spyOn(g, "dispose");
  a.dispose();
  a.dispose();
  expect(spy).not.toHaveBeenCalled();
  b.pose("Urban", 1, 0.016);
  expect(b.current).toBe("Urban");
  b.dispose();
  spy.mockRestore();
});
it("cache disposal during preload releases arriving resources", async () => {
  const c = new HeroCache();
  let resolve!: (x: any) => void;
  const g = await load("/assets/hero/hero-lod2.glb");
  const pending = c.preload(() => new Promise((r) => (resolve = r)), manifest);
  await vi.waitFor(() => expect(resolve).toBeDefined());
  c.dispose();
  resolve(g);
  await expect(pending).rejects.toThrow("closed");
  expect(c.templates).toHaveLength(0);
});
it("support sole remains near floor across every sampled clip", () => {
  const g = cache.templates[2],
    mixer = new T.AnimationMixer(g.scene),
    sole = g.scene.getObjectByName("Hero_Sole") as T.SkinnedMesh,
    p = sole.geometry.getAttribute("position");
  for (const clip of g.animations) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).play();
    for (let f = 0; f < 25; f++) {
      action.time = (f / 24) * clip.duration;
      mixer.update(0);
      g.scene.updateMatrixWorld(true);
      sole.skeleton.update();
      let y = Infinity;
      for (let i = 0; i < p.count; i++) {
        const v = new T.Vector3().fromBufferAttribute(p, i);
        sole.applyBoneTransform(i, v);
        y = Math.min(y, v.y);
      }
      expect(y, clip.name + " sole").toBeGreaterThan(-0.007);
      expect(y, clip.name + " contact").toBeLessThan(0.015);
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(g.scene);
});

it("crowd facial material batches are present and visible in the cloned model", () => {
  const a = new HeroVisual(cache);
  a.forceLOD = 2;
  a.pose("Idle", 1, 0.016);
  cache.templates[2].scene.traverse((ref) => {
    if (ref instanceof T.Mesh) {
      const mesh = a.model.getObjectByName(ref.name) as T.Mesh;
      expect(mesh, ref.name).toBeDefined();
      expect(mesh.visible, ref.name).toBe(true);
      expect(mesh.geometry, ref.name).toBe(ref.geometry);
    }
  });
  a.dispose();
});

it('manifest attachment anchors exist in every LOD and reject wrong pack metadata',async()=>{const m=await manifest();for(const g of cache.templates)for(const name of m.attachments)expect(g.scene.getObjectByName(name)).toBeInstanceOf(T.Bone);const g=await load('/assets/hero/hero-lod2.glb');g.scene.getObjectByName('AfterglowRunner')!.userData.packVersion=3;expect(()=>validateHero(g)).toThrow('metadata');});
