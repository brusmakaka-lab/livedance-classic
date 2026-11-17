import { it, expect } from "vitest";
import * as T from "three";
import { CinematicCameraDirector } from "../src/integration/camera";
import { placement } from "../src/integration/show/show-plan";
import { integrationConfig } from "../src/integration/config";
import { ViewCast, VisualQueue } from "../src/integration/cast";
it("art settings migrate safely and preserve explicit capacity/base selection", () => {
  expect(integrationConfig({ featured: 20, artMode: "BASE" })).toMatchObject({
    featured: 20,
    artMode: "BASE",
  });
  expect(integrationConfig({})).toMatchObject({
    featured: 10,
    artMode: "CONCERT",
  });
  expect(integrationConfig({ artMode: "unknown", featured: 9 })).toMatchObject({
    featured: 10,
    artMode: "CONCERT",
  });
});
it("concert full-motion envelopes fit at both vertical sizes, fixed and moving", () => {
  for (const [width, height] of [
    [365, 648],
    [720, 1280],
  ])
    for (const fixed of [false, true])
      for (const n of [1, 10, 20, 30]) {
        const camera = new T.PerspectiveCamera(34, width / height, 0.1, 300),
          d = new CinematicCameraDirector();
        d.concert = true;
        d.fixed = fixed;
        d.update(camera, n, new T.Vector3(), 0, 1 / 60);
        for (let i = 0; i < n; i++)
          for (const x of [-1.5, 1.5])
            for (const y of [-0.15, 3.5])
              for (const z of [-1, 1]) {
                const p = placement(i, n, true)
                  .add(new T.Vector3(x, y, z))
                  .project(camera);
                expect((p.x + 1) / 2).toBeGreaterThanOrEqual(0.08);
                expect((p.x + 1) / 2).toBeLessThanOrEqual(0.92);
                expect((1 - p.y) / 2).toBeGreaterThanOrEqual(0.12);
                expect((1 - p.y) / 2).toBeLessThanOrEqual(0.75);
              }
      }
});
it("VIP focus outside selected page preserves all registry IDs, emergency clears pending cues", () => {
  const cast = new ViewCast(),
    q = new VisualQueue(),
    ids = Array.from({ length: 30 }, (_, i) => "viewer-" + i);
  cast.sync(ids);
  cast.focus("viewer-29");
  expect(cast.visible[0]).toBe("viewer-29");
  expect(cast.visible.length).toBe(10);
  expect(cast.ids).toEqual(ids);
  q.push("follow", "viewer-1");
  q.push("vip", "viewer-29");
  q.push("gift", "viewer-3");
  expect(q.active?.id).toBe("viewer-29");
  q.clear();
  cast.focus();
  expect(q.active).toBeUndefined();
  expect(q.queue).toHaveLength(0);
  expect(cast.ids).toEqual(ids);
  expect(cast.visible).toEqual(ids.slice(0, 10));
});
it("legacy camera fits the concert cast when cinematic motion is disabled", () => {
  for (const n of [1, 10, 20, 30]) {
    const c = new T.PerspectiveCamera(34, 365 / 648, 0.1, 300),
      d = new CinematicCameraDirector();
    d.concert = true;
    d.enabled = false;
    d.shot = "WIDE";
    d.update(c, n, new T.Vector3(), 0, 1 / 60);
    c.updateMatrixWorld(); // IntegrationShow performs this after the legacy director.
    for (let i = 0; i < n; i++)
      for (const x of [-1.4, 1.4])
        for (const y of [-0.04, 3.35])
          for (const z of [-0.85, 0.85]) {
            const p = placement(i, n, true)
              .add(new T.Vector3(x, y, z))
              .project(c);
            expect(Math.abs(p.x)).toBeLessThan(1);
            expect(Math.abs(p.y)).toBeLessThan(1);
          }
  }
});
