import { describe, it, expect } from "vitest";
import * as T from "three";
import {
  appearance,
  validateSkin,
  palettes,
  accessories,
  pose,
  clips,
  blendPose,
  momentAt,
  hash,
} from "../src/block/core";
import { BlockAvatar, BlockBatch } from "../src/block/rig";
describe("Block Character Lab isolated engine", () => {
  it("preserves deterministic identity through reuse and Unicode normalization", () => {
    expect(appearance("bruno")).toEqual(appearance("bruno"));
    expect(appearance("é")).toEqual(appearance("e\u0301"));
    const first = new BlockAvatar("bruno");
    const s = first.skin;
    first.dispose();
    expect(new BlockAvatar("bruno").skin).toEqual(s);
  });
  it("rejects empty and oversized IDs", () => {
    expect(() => appearance(" ")).toThrow();
    expect(() => appearance("a".repeat(65))).toThrow();
  });
  it("generates thirty unique valid appearances within curated palettes", () => {
    const skins = Array.from({ length: 30 }, (_, i) =>
      appearance("viewer." + i),
    );
    expect(
      new Set(skins.map((s) => JSON.stringify({ ...s, viewerId: "", seed: 0 })))
        .size,
    ).toBe(30);
    for (const s of skins) {
      expect(validateSkin(s)).toBe(true);
      expect(palettes[s.palette]).toContain(s.top);
    }
  });
  it("validates native skin version, shapes and unsafe color input", () => {
    for (const patch of [
      { version: 2 },
      { tone: "url(file)" },
      { hairStyle: 6 },
      { accessory: "script" },
      { seed: -1 },
      { jacket: 1 },
      { palette: "__proto__" },
    ])
      expect(validateSkin({ ...appearance("test"), ...patch })).toBe(false);
    expect(validateSkin(null)).toBe(false);
  });
  it("has 5 dance clips plus reactions and locomotion", () => {
    for (const c of [
      "Groove",
      "Shuffle",
      "Robot",
      "Hype",
      "Disco",
      "Idle",
      "Walk",
      "Wave",
      "Cheer",
      "VIP",
    ])
      expect(clips).toContain(c);
  });
  it("poses remain finite across all clips", () => {
    for (const c of clips)
      for (let i = 0; i < 121; i++) {
        const a = new BlockAvatar("test");
        a.update(c, i / 60, 1);
        for (const part of a.parts)
          expect(part.node.matrixWorld.elements.every(Number.isFinite)).toBe(
            true,
          );
        a.dispose();
      }
  });
  it("keeps flat foot soles above the floor across all proportions and clips", () => {
    for (const p of ["A", "B", "C"] as const) {
      const a = new BlockAvatar("feet", p);
      for (const c of clips)
        for (let i = 0; i < 90; i++) {
          a.update(c, i / 45, 1);
          for (const f of a.feet) {
            const v = f.getWorldPosition(new T.Vector3());
            expect(v.y - 0.105).toBeGreaterThanOrEqual(-0.001);
          }
        }
      a.dispose();
    }
  });
  it("has distinct full body trajectories for five dances", () => {
    const vals = ["Groove", "Shuffle", "Robot", "Hype", "Disco"].map((c) =>
      JSON.stringify(pose(c as any, 0.32)),
    );
    expect(new Set(vals).size).toBe(5);
  });
  it("synchronizes pose time and differentiates free phases", () => {
    expect(pose("Groove", 2)).toEqual(pose("Groove", 2));
    expect(pose("Groove", 2)).not.toEqual(pose("Groove", 2 + 0.3));
    const a = new BlockAvatar("a"),
      b = new BlockAvatar("b");
    a.update("Disco", 1, 1);
    b.update("Disco", 1, 1);
    expect(a.lastPose).toEqual(b.lastPose);
  });
  it("blends from previous pose on transition instead of snapping", () => {
    const a = new BlockAvatar("blend");
    a.update("Groove", 1, 1);
    const previous = a.lastPose;
    a.update("Hype", 1, 0);
    expect(a.lastPose).toEqual(previous);
    a.update("Hype", 1, 1);
    expect(JSON.stringify(a.lastPose)).toBe(JSON.stringify(pose("Hype", 1)));
  });
  it("keeps only one selected accessory, removes previous attachments", () => {
    const a = new BlockAvatar("attachments");
    a.setAccessory("none");
    const base = a.parts.length;
    for (const acc of accessories) {
      a.setAccessory(acc);
      expect(a.accessory).toBe(acc);
      expect(a.parts.length).toBe(base + a.accessoryParts.length);
    }
    a.setAccessory("none");
    expect(a.parts.length).toBe(base);
  });
  it("renders thirty avatars using one material/geometry and clears instance count", () => {
    const scene = new T.Scene(),
      batch = new BlockBatch(scene),
      as = Array.from({ length: 30 }, (_, i) => new BlockAvatar("viewer." + i));
    batch.update(as);
    expect(batch.mesh.count).toBeGreaterThan(1400);
    expect(batch.mesh.count).toBeLessThan(4096);
    as.forEach((a) => a.dispose());
    batch.update(as);
    expect(batch.mesh.count).toBe(0);
    batch.dispose();
    expect(scene.children).toHaveLength(0);
  });
  it("cleanup is idempotent and releases hierarchy references", () => {
    const a = new BlockAvatar("cleanup");
    a.dispose();
    a.dispose();
    expect(a.root.children).toHaveLength(0);
    expect(a.parts).toHaveLength(0);
    expect(a.disposed).toBe(true);
  });
  it("Follow has complete ordered stages and finishes", () => {
    expect(
      [0, 3, 6, 10, 16, 19].map((t) => momentAt("FOLLOW", t).stage),
    ).toEqual(["APPEAR", "WALK", "WAVE", "SOLO", "JOIN", "DONE"]);
    expect(momentAt("FOLLOW", 19).active).toBe(false);
  });
  it("VIP restores after gathering, solo and return", () => {
    expect([0, 6, 13, 17].map((t) => momentAt("VIP", t).stage)).toEqual([
      "GATHER",
      "SOLO",
      "RETURN",
      "DONE",
    ]);
    expect(momentAt("VIP", 17).active).toBe(false);
  });
  it("native seed is stable and different for different viewers", () => {
    expect(hash("a")).not.toBe(hash("b"));
    expect(hash("a")).toBe(hash("a"));
  });
});
