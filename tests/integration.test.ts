import { it, expect } from "vitest";
import { ViewCast, VisualQueue } from "../src/integration/cast";
import { integrationConfig } from "../src/integration/config";
import fs from "node:fs/promises";
it("casting preserves 30 IDs while spotlighting a waiting viewer and restoring group", () => {
  const c = new ViewCast(),
    ids = Array.from({ length: 30 }, (_, i) => "viewer-" + i);
  c.sync(ids);
  expect(c.visible).toHaveLength(10);
  const original = [...c.visible];
  c.focus("viewer-29");
  expect(c.visible[0]).toBe("viewer-29");
  c.next();
  expect(c.visible[0]).toBe("viewer-29");
  c.focus();
  expect(c.visible).toEqual(original);
  c.next();
  expect(c.visible).not.toEqual(original);
  expect(c.ids).toEqual(ids);
});
it("removed focus cannot leave orphan casting references", () => {
  const c = new ViewCast();
  c.sync(["a", "b"]);
  c.focus("b");
  c.sync(["a"]);
  expect(c.visible).toEqual(["a"]);
  expect(c.subject).toBeUndefined();
});
it("VIP interrupts Fever, follow cannot interrupt VIP, queue bounded and emergency clears", () => {
  const q = new VisualQueue();
  q.push("fever");
  q.push("vip", "v");
  q.push("follow", "f");
  expect(q.active?.kind).toBe("vip");
  for (let i = 0; i < 100; i++) q.push("gift", "x");
  expect(q.queue).toHaveLength(12);
  expect(q.dropped).toBeGreaterThan(0);
  q.clear();
  expect(q.active).toBeUndefined();
  expect(q.queue).toEqual([]);
});
it("follow duration is 2–3s and config normalizes unsupported values", () => {
  const q = new VisualQueue();
  q.push("follow", "a");
  expect(q.active!.duration).toBeGreaterThanOrEqual(2);
  expect(q.active!.duration).toBeLessThanOrEqual(3);
  q.update(3);
  expect(q.active).toBeUndefined();
  expect(
    integrationConfig({ featured: 30, motion: "bad", intensity: 99 }).featured,
  ).toBe(30);
  expect(integrationConfig({ featured: 12 }).featured).toBe(10);
  expect(integrationConfig({ intensity: 99 }).intensity).toBe(1);
});
it("Mixamo assets and UV rig retain verified original SkinLibrary hashes", async () => {
 const {createHash} = await import('node:crypto');
 const hashes=JSON.parse(await fs.readFile('tests/original-asset-hashes.json','utf8'));
 for(const [file,expected] of Object.entries(hashes))expect(createHash('sha256').update(await fs.readFile(file)).digest('hex')).toBe(expected);
});
