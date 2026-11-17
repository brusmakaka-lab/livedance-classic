import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AnimationMixer, Box3 } from "three";
it("original GLB loads with six clips, no external resources and humanoid bounds", async () => {
  const file = await readFile(
    "public/assets/characters/afterglow-original.glb",
  );
  expect(file.toString("utf8", 0, 4)).toBe("glTF");
  const jsonLength = file.readUInt32LE(12),
    json = JSON.parse(file.toString("utf8", 20, 20 + jsonLength));
  expect(json.buffers.every((b: any) => !b.uri)).toBe(true);
  expect(json.images ?? []).toHaveLength(0);
  const model = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    "",
  );
  expect(model.animations.map((c) => c.name)).toEqual([
    "Idle",
    "Walk",
    "Groove",
    "Disco",
    "Shuffle",
    "Wave",
  ]);
  const box = new Box3().setFromObject(model.scene);
  expect(box.max.y - box.min.y).toBeGreaterThan(2);
  expect(box.max.y - box.min.y).toBeLessThan(3);
  const mixer = new AnimationMixer(model.scene);
  for (const c of model.animations) {
    const action = mixer.clipAction(c);
    action.play();
    mixer.update(0.3);
    action.stop();
  }
  mixer.uncacheRoot(model.scene);
});
