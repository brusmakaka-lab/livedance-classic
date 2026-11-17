import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export type Model = "classic" | "slim";
export type ActorRig = {
  root: T.Group;
  bones: Record<string, T.Bone>;
  meshes: T.SkinnedMesh[];
};
export function getRig(root: T.Group): ActorRig {
  const bones: Record<string, T.Bone> = {},
    meshes: T.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as T.Bone).isBone) bones[o.name] = o as T.Bone;
    if ((o as T.SkinnedMesh).isSkinnedMesh) meshes.push(o as T.SkinnedMesh);
  });
  const s = meshes[0]?.skeleton;
  for (const m of meshes.slice(1))
    if (
      m.skeleton !== s &&
      m.skeleton.bones.every((b, i) => b === s.bones[i])
    ) {
      m.skeleton.dispose();
      m.skeleton = s;
    }
  return { root, bones, meshes };
}
export function cloneRig(r: ActorRig) {
  return getRig(clone(r.root) as T.Group);
}
export function disposeActor(r: ActorRig) {
  new Set(r.meshes.map((m) => m.skeleton)).forEach((s) => s.dispose());
  r.root.removeFromParent();
  r.root.clear();
}
export const skinSpecs = [
  {
    id: "coral",
    name: "Coral / Campus",
    model: "classic" as Model,
    color: "#f27863",
  },
  {
    id: "nova",
    name: "Nova / Night rider",
    model: "slim" as Model,
    color: "#ad92f2",
  },
  {
    id: "milo",
    name: "Milo / Field notes",
    model: "classic" as Model,
    color: "#b9d48c",
  },
];
// Unfolded 64×64 atlas: +X, -X, +Y, -Y, +Z, -Z. Anatomical right is screen-left.
export function faceRects(
  u: number,
  v: number,
  w: number,
  h: number,
  d: number,
) {
  return [
    [u + w + d, v + d, d, h],
    [u, v + d, d, h],
    [u + d, v, w, d],
    [u + d + w, v, w, d],
    [u + d, v + d, w, h],
    [u + w + 2 * d, v + d, w, h],
  ];
}
function smooth(a: number, b: number, x: number) {
  const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
type Influence = [string, number][];
function blend(a: string, b: string, t: number): Influence {
  return [
    [a, 1 - t],
    [b, t],
  ];
}
function weights(part: string, y: number, z: number): Influence {
  if (part === "head") return [["Head", 1]];
  if (part === "body") {
    if (y < 1.12) return blend("Hips", "Spine", smooth(1.0, 1.08, y));
    return blend("Spine", "Chest", smooth(1.12, 1.2, y));
  }
  const s = part[0];
  if (part.endsWith("arm")) {
    if (y > 1.78) return blend(s + "Arm", "Chest", smooth(1.84, 1.92, y));
    if (y > 1.32) return blend(s + "Forearm", s + "Arm", smooth(1.4, 1.48, y));
    return blend(s + "Hand", s + "Forearm", smooth(1.04, 1.12, y));
  }
  if (y > 0.35) return blend(s + "Shin", s + "Thigh", smooth(0.44, 0.52, y));
  if (y > 0.15) return blend(s + "Foot", s + "Shin", smooth(0.16, 0.29, y));
  return blend(s + "Foot", s + "Toe", smooth(0.02, 0.14, z));
}
export function createSkinRig(
  source: ActorRig,
  model: Model,
  texture: T.Texture,
): ActorRig {
  const r = cloneRig(source);
  r.meshes[0].skeleton.pose();
  for (const m of r.meshes) m.removeFromParent();
  new Set(r.meshes.map((m) => m.skeleton)).forEach((s) => s.dispose());
  r.meshes = [];
  const b = r.bones;
  b.Hips.position.set(0, 0.96, 0);
  b.Chest.position.set(0, 0.16, 0);
  b.Neck.position.set(0, 0.8, 0);
  const armWidth = model === "slim" ? 3 : 4;
  for (const s of ["L", "R"]) {
    const sign = s === "L" ? -1 : 1;
    b[s + "Clavicle"].position.set(sign * (0.32 + armWidth * 0.04), 0.72, 0);
    b[s + "Forearm"].position.set(0, -0.4, 0);
    b[s + "Hand"].position.set(0, -0.4, 0);
    b[s + "Thigh"].position.set(sign * 0.16, 0, 0);
    b[s + "Shin"].position.set(0, -0.48, 0);
    b[s + "Foot"].position.set(0, -0.4, 0);
    b[s + "Toe"].position.set(0, 0, 0.12);
  }
  r.root.updateMatrixWorld(true);
  const ordered = Object.values(b),
    skeleton = new T.Skeleton(ordered);
  type Part = {
    part: string;
    w: number;
    h: number;
    d: number;
    x: number;
    y: number;
    uv: number[][];
  };
  const parts: Part[] = [
    {
      part: "head",
      w: 8,
      h: 8,
      d: 8,
      x: 0,
      y: 2.24,
      uv: [
        [0, 0],
        [32, 0],
      ],
    },
    {
      part: "body",
      w: 8,
      h: 12,
      d: 4,
      x: 0,
      y: 1.44,
      uv: [
        [16, 16],
        [16, 32],
      ],
    },
    {
      part: "Larm",
      w: armWidth,
      h: 12,
      d: 4,
      x: -(0.32 + armWidth * 0.04),
      y: 1.44,
      uv: [
        [40, 16],
        [40, 32],
      ],
    },
    {
      part: "Rarm",
      w: armWidth,
      h: 12,
      d: 4,
      x: 0.32 + armWidth * 0.04,
      y: 1.44,
      uv: [
        [32, 48],
        [48, 48],
      ],
    },
    {
      part: "Lleg",
      w: 4,
      h: 12,
      d: 4,
      x: -0.16,
      y: 0.48,
      uv: [
        [0, 16],
        [0, 32],
      ],
    },
    {
      part: "Rleg",
      w: 4,
      h: 12,
      d: 4,
      x: 0.16,
      y: 0.48,
      uv: [
        [16, 48],
        [0, 48],
      ],
    },
  ];
  for (let layer = 0; layer < 2; layer++) {
    const gs: T.BufferGeometry[] = [];
    for (const p of parts) {
      const expand = layer ? (p.part === "head" ? 0.08 : 0.04) : 0;
      const g = new T.BoxGeometry(
        p.w * 0.08 + expand,
        p.h * 0.08 + expand,
        p.d * 0.08 + expand,
        1,
        p.part === "head" ? 1 : 24,
        2,
      );
      const pos = g.getAttribute("position"),
        uv = g.getAttribute("uv"),
        idx = new Uint16Array(pos.count * 4),
        ws = new Float32Array(pos.count * 4);
      const rect = faceRects(p.uv[layer][0], p.uv[layer][1], p.w, p.h, p.d);
      // Groups cover independent face vertices even when the cuboid is subdivided.
      for (const group of g.groups) {
        const face = group.materialIndex!,
          seen = new Set<number>();
        const [x, y, w, h] = rect[face];
        for (let j = group.start; j < group.start + group.count; j++) {
          const i = g.index!.getX(j);
          if (seen.has(i)) continue;
          seen.add(i);
          const u = uv.getX(i),
            v = uv.getY(i);
          uv.setXY(
            i,
            (x + u * w) / 64,
            1 - (y + (face === 3 ? v : 1 - v) * h) / 64,
          );
        }
      }
      for (let i = 0; i < pos.count; i++) {
        const yy = pos.getY(i) + p.y,
          zz = pos.getZ(i);
        pos.setXYZ(i, pos.getX(i) + p.x, yy, zz);
        // Layer inflation must not change the weights at matching surface coordinates.
        const bindY = p.y + ((yy - p.y) * (p.h * 0.08)) / (p.h * 0.08 + expand);
        for (const [j, [name, w]] of weights(
          p.part,
          bindY,
          (zz * (p.d * 0.08)) / (p.d * 0.08 + expand),
        ).entries()) {
          idx[i * 4 + j] = ordered.indexOf(b[name]);
          ws[i * 4 + j] = w;
        }
      }
      g.clearGroups();
      g.setAttribute("skinIndex", new T.BufferAttribute(idx, 4));
      g.setAttribute("skinWeight", new T.BufferAttribute(ws, 4));
      gs.push(g);
    }
    const geometry = mergeGeometries(gs)!;
    gs.forEach((g) => g.dispose());
    const material = new T.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0,
      alphaTest: layer ? 0.5 : 0,
      side: layer ? T.DoubleSide : T.FrontSide,
    });
    const mesh = new T.SkinnedMesh(geometry, material);
    mesh.name = layer ? "SkinOuter" : "SkinBase";
    mesh.frustumCulled = false;
    r.root.add(mesh);
    mesh.bind(skeleton);
    r.meshes.push(mesh);
  }
  r.root.name = "Skin_" + model;
  r.root.updateMatrixWorld(true);
  return r;
}
export function footSamples(r: ActorRig) {
  return r.meshes
    .filter((m) => m.name !== "SkinOuter")
    .map((m) => {
      const ids: number[] = [],
        a = m.geometry.getAttribute("skinIndex"),
        w = m.geometry.getAttribute("skinWeight");
      for (let i = 0; i < a.count; i++)
        for (let j = 0; j < 4; j++)
          if (
            w.getComponent(i, j) > 0.05 &&
            /Foot|Toe/.test(m.skeleton.bones[a.getComponent(i, j)].name)
          ) {
            ids.push(i);
            break;
          }
      return { m, ids };
    });
}
export function footMin(samples: ReturnType<typeof footSamples>) {
  let min = Infinity;
  const v = new T.Vector3();
  for (const { m, ids } of samples)
    for (const i of ids) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      min = Math.min(min, v.y);
    }
  return min;
}
/** Keep every quaternion/key time; adapt only hip translation to canonical lengths and original contact height. */
export function adaptClips(
  source: ActorRig,
  target: ActorRig,
  clips: T.AnimationClip[],
) {
  const src = cloneRig(source),
    dst = cloneRig(target),
    sm = new T.AnimationMixer(src.root),
    dm = new T.AnimationMixer(dst.root);
  const sf = footSamples(src),
    df = footSamples(dst),
    stats: { clip: string; samples: number; maxCorrection: number }[] = [];
  const output = clips.map((original) => {
    const clip = original.clone(),
      hip = clip.tracks.find((t) => t.name === "Hips.position");
    if (!hip) throw Error("Missing Hips.position");
    for (let i = 1; i < hip.values.length; i += 3) hip.values[i] -= 0.07;
    const sa = sm.clipAction(original).setLoop(T.LoopOnce, 1).play(),
      da = dm.clipAction(clip).setLoop(T.LoopOnce, 1).play();
    sa.clampWhenFinished = da.clampWhenFinished = true;
    const corrections: number[] = [];
    for (const time of hip.times) {
      sm.setTime(time);
      dm.setTime(time);
      src.root.updateMatrixWorld(true);
      dst.root.updateMatrixWorld(true);
      corrections.push(footMin(sf) - footMin(df));
    }
    for (let i = 0; i < corrections.length; i++)
      hip.values[i * 3 + 1] += corrections[i];
    stats.push({
      clip: clip.name,
      samples: corrections.length,
      maxCorrection: Math.max(...corrections.map(Math.abs)),
    });
    sm.stopAllAction();
    dm.stopAllAction();
    sm.uncacheRoot(src.root);
    dm.uncacheRoot(dst.root);
    return clip;
  });
  disposeActor(src);
  disposeActor(dst);
  return { clips: output, stats };
}
