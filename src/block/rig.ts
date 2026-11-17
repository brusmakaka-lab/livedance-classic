import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  appearance,
  proportions,
  pose,
  blendPose,
  type Skin,
  type Proportion,
  type Clip,
  type Pose,
  type Accessory,
} from "./core";
type Part = { node: T.Object3D; color: T.Color };
const down = new T.Vector3(0, -1, 0);
export class BlockAvatar {
  root = new T.Group();
  hips = new T.Group();
  body = new T.Group();
  head = new T.Group();
  arms = [new T.Group(), new T.Group()];
  elbows = [new T.Group(), new T.Group()];
  hands = [new T.Group(), new T.Group()];
  thighs = [new T.Group(), new T.Group()];
  knees = [new T.Group(), new T.Group()];
  feet = [new T.Group(), new T.Group()];
  parts: Part[] = [];
  accessoryParts: Part[] = [];
  skin: Skin;
  disposed = false;
  clip: Clip = "Idle";
  previous: Pose = pose("Idle", 0);
  transition = 1;
  lastPose: Pose = pose("Idle", 0);
  accessory: Accessory;
  constructor(
    id: string,
    public proportion: Proportion = "C",
    skin?: Skin,
  ) {
    this.skin = skin ?? appearance(id);
    this.accessory = this.skin.accessory;
    const s = this.skin,
      p = proportions[proportion];
    this.root.name = id;
    this.root.add(this.hips);
    this.hips.add(this.body);
    this.body.position.y = 0.08;
    this.body.add(this.head);
    this.head.position.y = p.torso + 0.15;
    const box = (
      parent: T.Object3D,
      pos: number[],
      size: number[],
      color: string,
    ) => this.box(parent, pos, size, color);
    box(this.hips, [0, 0.02, 0], [p.width * 0.81, 0.2, 0.36], s.pants);
    box(this.body, [0, p.torso + 0.055, 0], [0.22, 0.2, 0.22], s.tone);
    box(
      this.body,
      [0, p.torso * 0.47, 0],
      [p.width, p.torso, 0.38],
      s.jacket ? s.top : s.shirt,
    );
    box(
      this.body,
      [0, p.torso * 0.49, 0.205],
      [0.27, p.torso * 0.82, 0.045],
      s.shirt,
    );
    if (s.jacket) {
      box(
        this.body,
        [-0.19, p.torso * 0.69, 0.24],
        [0.12, 0.29, 0.045],
        s.top,
      ).node.rotation.z = -0.22;
      box(
        this.body,
        [0.19, p.torso * 0.69, 0.24],
        [0.12, 0.29, 0.045],
        s.top,
      ).node.rotation.z = 0.22;
    }
    box(this.body, [0.21, 0.19, 0.218], [0.08, 0.15, 0.04], s.accent);
    box(this.body, [-0.14, 0.45, 0.237], [0.12, 0.04, 0.025], s.accent);
    box(
      this.head,
      [0, p.head * 0.36, 0],
      [p.head, p.head * 0.78, p.head * 0.75],
      s.tone,
    );
    const z = p.head * 0.39;
    for (const side of [-1, 1]) {
      box(
        this.head,
        [side * 0.135, p.head * 0.4, z],
        [0.125, 0.12, 0.035],
        "#fff4dd",
      );
      box(
        this.head,
        [side * 0.13, p.head * 0.4, z + 0.025],
        [0.06, 0.084, 0.025],
        s.eyes,
      );
      box(
        this.head,
        [side * 0.13 - 0.012, p.head * 0.42, z + 0.04],
        [0.019, 0.025, 0.014],
        "#ffffff",
      );
      box(
        this.head,
        [side * 0.14, p.head * 0.53, z + 0.005],
        [0.14, 0.035, 0.035],
        s.hair,
      ).node.rotation.z =
        side * (s.eyeStyle === 1 ? 0.12 : s.eyeStyle === 2 ? -0.1 : 0);
    }
    box(this.head, [0, p.head * 0.26, z + 0.024], [0.07, 0.06, 0.058], s.tone);
    box(
      this.head,
      [0, p.head * 0.15, z + 0.018],
      [0.14, 0.035, 0.027],
      "#8b434b",
    );
    box(
      this.head,
      [0.058, p.head * 0.18, z + 0.018],
      [0.024, 0.04, 0.027],
      "#8b434b",
    );
    for (const side of [-1, 1])
      box(
        this.head,
        [side * (p.head * 0.51), p.head * 0.34, 0],
        [0.065, 0.15, 0.12],
        s.tone,
      );
    box(
      this.head,
      [0, p.head * 0.79, -0.01],
      [p.head * 1.08, 0.15, p.head * 0.82],
      s.hair,
    );
    if (s.hairStyle === 0) {
      for (let i = 0; i < 3; i++)
        box(
          this.head,
          [-0.21 + i * 0.19, p.head * 0.78 + i * 0.025, z - 0.02],
          [0.22, 0.2, 0.16],
          s.hair,
        );
    }
    if (s.hairStyle === 1) {
      box(
        this.head,
        [-p.head * 0.42, p.head * 0.49, -0.02],
        [0.18, 0.48, p.head * 0.78],
        s.hair,
      );
      box(
        this.head,
        [p.head * 0.42, p.head * 0.52, -0.02],
        [0.16, 0.42, p.head * 0.78],
        s.hair,
      );
      box(
        this.head,
        [0, p.head * 0.81, z - 0.01],
        [p.head * 0.85, 0.23, 0.13],
        s.hair,
      );
    }
    if (s.hairStyle === 2) {
      for (let i = 0; i < 3; i++)
        box(
          this.head,
          [-0.24 + i * 0.24, p.head * 0.86, -0.03],
          [0.24, 0.23 + (i === 1 ? 0.08 : 0), p.head * 0.8],
          s.hair,
        );
      box(
        this.head,
        [0, p.head * 0.52, -p.head * 0.34],
        [p.head, 0.38, 0.16],
        s.hair,
      );
    }
    if (s.hairStyle === 3) {
      box(
        this.head,
        [0.17, p.head * 0.88, 0.01],
        [p.head * 0.57, 0.25, p.head * 0.75],
        s.hair,
      );
      box(
        this.head,
        [-0.2, p.head * 0.67, 0.02],
        [0.19, 0.24, p.head * 0.79],
        s.hair,
      );
      box(this.head, [0.27, p.head * 0.7, -0.13], [0.17, 0.3, 0.28], s.hair);
    }
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      this.body.add(this.arms[i]);
      this.arms[i].position.set(side * (p.width / 2 + 0.1), p.torso * 0.84, 0);
      this.arms[i].add(this.elbows[i]);
      this.elbows[i].position.y = -0.3;
      this.elbows[i].add(this.hands[i]);
      this.hands[i].position.y = -0.29;
      box(
        this.arms[i],
        [0, -0.13, 0],
        [0.23, 0.32, 0.29],
        s.jacket ? s.top : s.shirt,
      );
      box(
        this.arms[i],
        [side * 0.123, -0.16, 0.01],
        [0.025, 0.16, 0.2],
        s.accent,
      );
      box(
        this.elbows[i],
        [0, -0.135, 0],
        [0.19, 0.28, 0.235],
        s.jacket ? s.top : s.tone,
      );
      box(this.elbows[i], [0, -0.26, 0], [0.205, 0.065, 0.25], s.accent);
      box(this.hands[i], [0, -0.055, 0.015], [0.2, 0.16, 0.23], s.tone);
      this.hips.add(this.thighs[i]);
      this.thighs[i].position.set(side * 0.2, -0.04, 0);
      this.thighs[i].add(this.knees[i]);
      this.knees[i].position.y = -p.thigh;
      this.knees[i].add(this.feet[i]);
      this.feet[i].position.y = -p.shin;
      box(
        this.thighs[i],
        [0, -p.thigh * 0.45, 0],
        [0.265, p.thigh, 0.32],
        s.pants,
      );
      box(
        this.knees[i],
        [0, -p.shin * 0.45, 0],
        [0.235, p.shin, 0.27],
        s.pants,
      );
      box(
        this.knees[i],
        [side * 0.125, -p.shin * 0.4, 0],
        [0.023, p.shin * 0.63, 0.13],
        s.accent,
      );
      box(this.feet[i], [0, -0.013, 0.08], [0.3, 0.18, 0.48], s.shoes);
      box(this.feet[i], [0, -0.07, 0.08], [0.31, 0.07, 0.5], "#d7dddf");
      box(
        this.feet[i],
        [side * 0.156, 0.02, 0.1],
        [0.025, 0.055, 0.22],
        s.accent,
      );
      box(this.feet[i], [0, 0.082, 0.11], [0.16, 0.022, 0.13], s.top);
    }
    this.setAccessory(this.accessory);
    this.update("Idle", 0, 1);
  }
  box(parent: T.Object3D, pos: number[], size: number[], color: string) {
    const node = new T.Object3D();
    node.position.set(pos[0], pos[1], pos[2]);
    node.scale.set(size[0], size[1], size[2]);
    parent.add(node);
    const part = { node, color: new T.Color(color) };
    this.parts.push(part);
    return part;
  }
  setAccessory(a: Accessory) {
    for (const part of this.accessoryParts) {
      part.node.removeFromParent();
      this.parts.splice(this.parts.indexOf(part), 1);
    }
    this.accessoryParts = [];
    this.accessory = a;
    const start = this.parts.length,
      p = proportions[this.proportion],
      h = p.head;
    const b = (parent: T.Object3D, pos: number[], size: number[], c: string) =>
      this.box(parent, pos, size, c);
    if (a === "glasses") {
      for (const s of [-1, 1]) {
        b(
          this.head,
          [s * 0.14, h * 0.41, h * 0.43],
          [0.24, 0.18, 0.035],
          "#203449",
        );
        b(
          this.head,
          [s * 0.14, h * 0.41, h * 0.452],
          [0.17, 0.11, 0.015],
          "#5c8a95",
        );
      }
      b(
        this.head,
        [0, h * 0.42, h * 0.45],
        [0.09, 0.035, 0.025],
        this.skin.accent,
      );
    }
    if (a === "headphones") {
      for (const s of [-1, 1]) {
        b(
          this.head,
          [s * h * 0.58, h * 0.42, 0],
          [0.13, 0.27, 0.24],
          this.skin.accent,
        );
        b(this.head, [s * h * 0.54, h * 0.7, 0], [0.07, 0.42, 0.11], "#232e42");
      }
      b(this.head, [0, h * 0.98, 0], [h * 1.15, 0.075, 0.11], "#232e42");
    }
    if (a === "cap") {
      b(
        this.head,
        [0, h * 0.88, -0.025],
        [h * 1.13, 0.22, h * 0.86],
        this.skin.accent,
      );
      b(
        this.head,
        [0.04, h * 0.77, h * 0.43],
        [h * 0.95, 0.055, 0.31],
        this.skin.top,
      );
    }
    if (a === "crown") {
      b(this.head, [0, h * 0.96, 0], [h * 1.11, 0.12, h * 0.86], "#f7c65c");
      for (const x of [-0.25, 0, 0.25])
        b(this.head, [x, h * 1.1, 0.19], [0.09, 0.2, 0.09], "#f7c65c");
      b(
        this.head,
        [0, h * 0.99, h * 0.445],
        [0.1, 0.07, 0.023],
        this.skin.accent,
      );
    }
    if (a === "halo") {
      for (const [x, z, sx, sz] of [
        [0, 0.29, 0.7, 0.06],
        [0, -0.29, 0.7, 0.06],
        [-0.32, 0, 0.06, 0.6],
        [0.32, 0, 0.06, 0.6],
      ])
        b(this.head, [x, h * 1.18, z], [sx, 0.06, sz], "#fff0a1");
    }
    if (a === "wings") {
      for (const s of [-1, 1])
        for (let k = 0; k < 3; k++) {
          const v = b(
            this.body,
            [s * (0.42 + k * 0.15), 0.4 - k * 0.09, -0.29],
            [0.15, 0.43 - k * 0.055, 0.065],
            k === 1 ? this.skin.accent : "#c9dded",
          );
          v.node.rotation.z = -s * 0.45;
        }
    }
    this.accessoryParts = this.parts.slice(start);
  }
  update(clip: Clip, time: number, dt: number) {
    if (this.disposed) return;
    if (clip !== this.clip) {
      this.previous = this.lastPose;
      this.clip = clip;
      this.transition = 0;
    }
    this.transition = Math.min(1, this.transition + dt / 0.25);
    const k = this.transition * this.transition * (3 - 2 * this.transition);
    const q = blendPose(this.previous, pose(clip, time), k);
    this.lastPose = q;
    const p = proportions[this.proportion],
      base = p.thigh + p.shin + 0.145;
    this.hips.position.set(q.hips.x, base + q.hips.y, q.hips.z);
    this.body.rotation.copy(q.body);
    this.head.rotation.copy(q.head);
    for (let i = 0; i < 2; i++) {
      this.arms[i].rotation.copy(q.arms[i]);
      this.elbows[i].rotation.x = q.elbows[i];
      this.hands[i].rotation.z = q.hands[i];
      const hip = this.thighs[i].position.clone().add(this.hips.position),
        foot = q.feet[i];
      const delta = foot.clone().sub(hip),
        len = T.MathUtils.clamp(
          delta.length(),
          0.01,
          p.thigh + p.shin - 0.0001,
        ),
        dir = delta.clone().normalize();
      const along =
          (p.thigh * p.thigh - p.shin * p.shin + len * len) / (2 * len),
        height = Math.sqrt(Math.max(0, p.thigh * p.thigh - along * along));
      const bend = new T.Vector3(0, 0, 1)
        .addScaledVector(dir, -dir.z)
        .normalize();
      const knee = hip
        .clone()
        .addScaledVector(dir, along)
        .addScaledVector(bend, height);
      const upper = new T.Quaternion().setFromUnitVectors(
          down,
          knee.clone().sub(hip).normalize(),
        ),
        lower = new T.Quaternion().setFromUnitVectors(
          down,
          foot.clone().sub(knee).normalize(),
        );
      this.thighs[i].quaternion.copy(upper);
      this.knees[i].quaternion.copy(upper.clone().invert().multiply(lower));
      this.feet[i].quaternion.copy(lower).invert();
    }
    this.root.updateMatrixWorld(true);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const p of this.parts) p.node.removeFromParent();
    for (const g of [
      this.root,
      this.hips,
      this.body,
      this.head,
      ...this.arms,
      ...this.elbows,
      ...this.hands,
      ...this.thighs,
      ...this.knees,
      ...this.feet,
    ])
      g.clear();
    this.parts.length = 0;
    this.accessoryParts.length = 0;
  }
}
export class BlockBatch {
  geometry = new RoundedBoxGeometry(1, 1, 1, 1, 0.045);
  material = new T.MeshStandardMaterial({ roughness: 0.78, metalness: 0.03 });
  mesh: T.InstancedMesh;
  disposed = false;
  constructor(scene: T.Scene) {
    this.mesh = new T.InstancedMesh(this.geometry, this.material, 4096);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(this.mesh);
  }
  update(avatars: BlockAvatar[]) {
    let i = 0;
    for (const a of avatars)
      if (!a.disposed && a.root.visible)
        for (const p of a.parts) {
          if (i >= 4096) throw Error("Block instance budget exceeded");
          this.mesh.setMatrixAt(i, p.node.matrixWorld);
          this.mesh.setColorAt(i, p.color);
          i++;
        }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.count = 0;
  }
}
