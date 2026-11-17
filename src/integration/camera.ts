import * as T from "three";
import { lineupPose } from "./lineup";
import { CameraDirector } from "./show/directors";
import { placement, smooth, showEnvelope } from "./show/show-plan";

/** Same camera and semantic shot contract as Phase3G. Only the trajectory is new. */
export class CinematicCameraDirector extends CameraDirector {
  enabled = true;
  entrance = false;
  lineup = false;
  private previousConcert = false;
  fixed = false;
  motion: "OFF" | "SUAVE" | "DINAMICO" = "SUAVE";
  velocity = new T.Vector3();
  lookVelocity = new T.Vector3();
  limits = {
    speed: 12,
    acceleration: 24,
    angularSpeed: 0.65,
    minZ: 7,
    maxX: 3.5,
  };
  private desiredRotation = new T.Quaternion();
  private matrix = new T.Matrix4();
  private fixedPose?: { position: T.Vector3; look: T.Vector3 };
  stop() {
    this.velocity.set(0, 0, 0);
    this.lookVelocity.set(0, 0, 0);
  }
  private move(
    current: T.Vector3,
    velocity: T.Vector3,
    goal: T.Vector3,
    dt: number,
    speed: number,
  ) {
    const acceleration = goal
      .clone()
      .sub(current)
      .multiplyScalar(16)
      .addScaledVector(velocity, -8);
    acceleration.clampLength(0, this.limits.acceleration);
    velocity.addScaledVector(acceleration, dt).clampLength(0, speed);
    current.addScaledVector(velocity, dt);
  }
  update(
    camera: T.PerspectiveCamera,
    count: number,
    hero: T.Vector3,
    time: number,
    dt: number,
    reduced = false,
  ) {
    if (this.previousConcert !== this.concert) {
      this.fixedPose = undefined;
      this.previousConcert = this.concert;
    }
    if (!this.enabled) {
      if (camera.view?.enabled) camera.clearViewOffset();
      this.stop();
      this.fixedPose = undefined;
      super.update(camera, count, hero, time, dt, reduced);
      return;
    }
    // Optical framing leaves room for the caption and bottom TikTok controls.
    camera.setViewOffset(
      1000 * camera.aspect,
      1000,
      0,
      60,
      1000 * camera.aspect,
      1000,
    );
    if (this.lineup) {
      const pose = lineupPose(camera.aspect);
      camera.position.copy(pose.position);
      this.target.copy(pose.look);
      camera.lookAt(this.target);
      camera.updateMatrixWorld();
      this.stop(); this.initialized = true; this.fixedPose = undefined;
      return;
    }
    const fixed = this.fixed || this.motion === "OFF" || reduced;
    const amount = this.motion === "DINAMICO" ? 1 : 0.5;
    const wide = safePose(
      count,
      camera.aspect,
      camera.fov,
      undefined,
      this.concert ? 0.46 : 0.32,
      0,
      this.concert,
    );
    let pose = wide;
    const heroPose = safePose(
      1,
      camera.aspect,
      camera.fov,
      hero,
      0.12,
      this.event === "vip"
        ? Math.sin((Math.min(5, Math.max(0, this.age - 1.2)) * Math.PI) / 5) *
            0.1 *
            amount *
            this.intensity
        : 0,
    );
    if (this.normalShot === "HERO") pose = heroPose;
    if (
      this.event === "vip" ||
      this.event === "follow" ||
      this.event === "gift"
    ) {
      const weight =
        this.event === "vip"
          ? showEnvelope("vip", this.age)
          : this.event === "follow" && this.entrance
            ? smooth(this.age / .7) * (1 - smooth((this.age - 3.1) / 1.1))
            : smooth(this.age / 0.65) * (1 - smooth((this.age - 1.9) / 0.9));
      pose = {
        position: pose.position.clone().lerp(heroPose.position, weight),
        look: pose.look.clone().lerp(heroPose.look, weight),
      };
    } else if (this.event === "fever") {
      const envelope = showEnvelope("fever", this.age);
      const concert = safePose(
        count,
        camera.aspect,
        camera.fov,
        undefined,
        0.32 - 0.055 * envelope * amount,
        Math.sin(this.age * 0.38) * 0.045 * envelope * amount * this.intensity,
        this.concert,
      );
      pose = {
        position: pose.position.clone().lerp(concert.position, envelope),
        look: pose.look.clone().lerp(concert.look, envelope),
      };
    }
    if (fixed) {
      // A truly static, capacity-safe view; events never change this pose.
      this.fixedPose ??= safePose(
        30,
        camera.aspect,
        camera.fov,
        undefined,
        this.concert ? 0.46 : 0.32,
        0,
        this.concert,
      );
      pose = this.fixedPose;
    } else this.fixedPose = undefined;
    pose.position.z = Math.max(this.limits.minZ, pose.position.z);
    pose.position.x = T.MathUtils.clamp(
      pose.position.x,
      -this.limits.maxX,
      this.limits.maxX,
    );
    pose.position.y = Math.max(2, pose.position.y);
    const delta = Math.min(0.05, Math.max(0, dt));
    if (!this.initialized) {
      camera.position.copy(pose.position);
      this.target.copy(pose.look);
      this.stop();
      camera.lookAt(this.target);
      this.initialized = true;
    } else {
      for (let remaining = delta; remaining > 0;) {
        const step = Math.min(remaining, 1 / 120);
        remaining -= step;
        this.move(
          camera.position,
          this.velocity,
          pose.position,
          step,
          this.limits.speed,
        );
        this.move(this.target, this.lookVelocity, pose.look, step, 8);
      }
      this.matrix.lookAt(camera.position, this.target, camera.up);
      this.desiredRotation.setFromRotationMatrix(this.matrix);
      camera.quaternion.rotateTowards(
        this.desiredRotation,
        this.limits.angularSpeed * delta,
      );
    }
    camera.updateMatrixWorld();
  }
}

/** Conservative full-motion box, classic/slim, with vertical caption/control margins. */
export function safePose(
  count: number,
  aspect: number,
  fov: number,
  origin?: T.Vector3,
  pitch = 0.32,
  yaw = 0,
  concert = false,
) {
  const points: T.Vector3[] = [];
  for (let i = 0; i < Math.max(1, Math.min(30, count)); i++) {
    const root = origin ?? placement(i, count, concert);
    for (const x of [-1.5, 1.5])
      for (const y of [-0.15, 3.5])
        for (const z of [-1, 1])
          points.push(root.clone().add(new T.Vector3(x, y, z)));
  }
  const look = new T.Box3().setFromPoints(points).getCenter(new T.Vector3());
  const back = new T.Vector3(yaw, pitch, 1).normalize();
  const right = new T.Vector3()
    .crossVectors(new T.Vector3(0, 1, 0), back)
    .normalize();
  const up = new T.Vector3().crossVectors(back, right);
  const tanY = Math.tan(T.MathUtils.degToRad(fov / 2)),
    tanX = tanY * aspect;
  let distance = 9;
  for (const point of points) {
    const v = point.clone().sub(look),
      depth = v.dot(back);
    distance = Math.max(
      distance,
      depth + Math.abs(v.dot(right)) / (tanX * 0.72),
      depth + Math.abs(v.dot(up)) / (tanY * 0.53),
    );
  }
  return { position: look.clone().addScaledVector(back, distance), look };
}
