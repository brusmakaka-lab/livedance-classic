import { it, expect } from "vitest";
import * as T from "three";
import { CinematicCameraDirector, safePose } from "../src/integration/camera";
import { placement } from "../src/integration/show/show-plan";
it("fits conservative full bodies inside vertical safe areas for 1/10/12 featured", () => {
  for (const n of [1, 10, 12, 20, 30]) {
    const camera = new T.PerspectiveCamera(34, 365 / 648, 0.1, 300),
      d = new CinematicCameraDirector();
    d.update(camera, n, new T.Vector3(), 0, 1 / 60);
    for (let i = 0; i < n; i++)
      for (const x of [-1.5, 1.5])
        for (const y of [-0.15, 3.5])
          for (const z of [-1, 1]) {
            const p = placement(i, n)
              .add(new T.Vector3(x, y, z))
              .project(camera);
            expect((p.x + 1) / 2).toBeGreaterThanOrEqual(0.12);
            expect((p.x + 1) / 2).toBeLessThanOrEqual(0.88);
            expect((1 - p.y) / 2).toBeGreaterThanOrEqual(0.15);
            expect((1 - p.y) / 2).toBeLessThanOrEqual(0.73);
          }
  }
});
it("interruptions preserve bounded translation, acceleration and angular speed", () => {
  const c = new T.PerspectiveCamera(34, 9 / 16, 0.1, 300),
    d = new CinematicCameraDirector();
  d.update(c, 10, new T.Vector3(), 0, 1 / 60);
  for (let i = 0; i < 900; i++) {
    d.event = i < 200 ? "follow" : i < 400 ? "vip" : i < 650 ? "fever" : "";
    d.age = (i % 200) / 60;
    const pos = c.position.clone(),
      rotation = c.quaternion.clone(),
      velocity = d.velocity.clone();
    d.update(c, 10, new T.Vector3(), i / 60, 1 / 60);
    expect(c.position.distanceTo(pos)).toBeLessThanOrEqual(
      d.limits.speed / 60 + 1e-6,
    );
    expect(d.velocity.distanceTo(velocity)).toBeLessThanOrEqual(
      d.limits.acceleration / 60 + 1e-6,
    );
    expect(c.quaternion.angleTo(rotation)).toBeLessThanOrEqual(
      d.limits.angularSpeed / 60 + 1e-6,
    );
    expect(c.position.z).toBeGreaterThan(6);
    expect(Math.abs(c.position.x)).toBeLessThan(3.6);
  }
});
it("OFF is fixed across events and capacity changes; emergency clears momentum", () => {
  const c = new T.PerspectiveCamera(34, 9 / 16, 0.1, 300),
    d = new CinematicCameraDirector();
  d.motion = "OFF";
  d.update(c, 1, new T.Vector3(), 0, 1 / 60);
  const pos = c.position.clone(),
    q = c.quaternion.clone();
  for (let i = 0; i < 100; i++) {
    d.event = "vip";
    d.age = i / 60;
    d.update(c, 30, new T.Vector3(2, 0, -4), i / 60, 1 / 60);
  }
  expect(c.position.distanceTo(pos)).toBeLessThan(1e-9);
  expect(c.quaternion.angleTo(q)).toBeLessThan(1e-7);
  d.velocity.set(2, 3, 4);
  d.stop();
  expect(d.velocity.length()).toBe(0);
});
