import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { bones, selectLOD } from "../character-engine/engine";
import { hash, type Dancer } from "../domain";
import { ProceduralAvatar, type AvatarVisual } from "../avatars";
export const clips = [
  "Idle",
  "Walk",
  "Groove",
  "Shuffle",
  "Urban",
  "Wave",
  "Cheer",
  "VIP",
];
export const expressions = [
  "NEUTRAL",
  "HAPPY",
  "EXCITED",
  "SURPRISED",
  "HYPE",
  "VIP",
];
export interface Manifest {
  packVersion: number;
  characterId: string;
  rigVersion: string;
  lods: { level: number; file: string; bytes: number; triangles: number }[];
  animations: string[];
  materials: string[];
  attachments: string[];
  textures: unknown[];
  origin: string;
  license: string;
}
export function validateManifest(m: Manifest) {
  if (
    m.packVersion !== 2 ||
    m.characterId !== "afterglow-runner" ||
    m.rigVersion !== "LiveDanceHumanoid1"
  )
    throw Error("Unsupported Hero manifest");
  if (
    m.lods.length !== 3 ||
    m.lods.some(
      (l, i) => l.level !== i || l.file !== `hero-lod${i}.glb` || l.bytes <= 0,
    )
  )
    throw Error("Invalid LOD path/budget");
  if (
    clips.some((c) => !m.animations.includes(c)) ||
    !m.materials.includes("Skin") ||
    !m.origin ||
    !m.license
  )
    throw Error("Incomplete Hero manifest");
}
export function validateHero(g: GLTF) {
  const meta=g.scene.getObjectByName("AfterglowRunner")?.userData;
  if(meta?.packVersion!==2||meta.rigVersion!=="LiveDanceHumanoid1")throw Error("Hero asset metadata mismatch");
  for (const b of bones)
    if (!(g.scene.getObjectByName(b) instanceof T.Bone))
      throw Error("Hero bone missing " + b);
  if (clips.some((c) => !g.animations.some((a) => a.name === c)))
    throw Error("Hero clip missing");
  let skins = 0;
  g.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh) {
      skins++;
      const w = o.geometry.getAttribute("skinWeight");
      for (let i = 0; i < w.count; i++) {
        const sum = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
        if (Math.abs(sum - 1) > 0.001) throw Error("Bad weights");
      }
    }
  });
  if (
    !skins ||
    !g.scene.getObjectByName("Face") ||
    (!g.scene.getObjectByName("Mouth") &&
      !g.scene.getObjectByName("Hero_Mouth"))
  )
    throw Error("Incomplete Hero asset");
}
export class HeroCache {
  templates: GLTF[] = [];
  manifest?: Manifest;
  materials = new Map<number, Map<string, T.Material>>();
  private pending?: Promise<void>;
  closed = false;
  logs: string[] = [];
  async preload(
    load = (u: string) => new GLTFLoader().loadAsync(u),
    read = async () => {
      const r = await fetch("/assets/hero/manifest.json");
      if (!r.ok) throw Error("Manifest HTTP " + r.status);
      return r.json();
    },
  ) {
    if (this.closed) throw Error("Hero cache closed");
    if (this.templates.length) return;
    if (!this.pending)
      this.pending = (async () => {
        const loaded: GLTF[] = [];
        try {
          const m = await read();
          validateManifest(m);
          this.manifest = m;
          for (const l of m.lods) {
            const g = await load("/assets/hero/" + l.file);
            loaded.push(g);
            if (this.closed) throw Error("Hero cache closed during preload");
            validateHero(g);
          }
          this.templates = loaded;
          this.logs.push("Hero pack ready");
        } catch (e) {
          this.free(loaded);
          this.logs.push("Hero load failed; procedural fallback: " + e);
          throw e;
        } finally {
          this.pending = undefined;
        }
      })();
    return this.pending;
  }
  palette(index: number) {
    index = Math.max(0, Math.min(2, index));
    let palette = this.materials.get(index);
    if (palette) return palette;
    palette = new Map();
    const colors = [
      {
        Skin: "#b87d61",
        Hair: "#30283e",
        HairLight: "#51405d",
        Jacket: "#267f86",
      },
      {
        Skin: "#744936",
        Hair: "#191d29",
        HairLight: "#35424b",
        Jacket: "#854d92",
      },
      {
        Skin: "#e6bfa1",
        Hair: "#75462e",
        HairLight: "#a46b41",
        Jacket: "#3f638d",
      },
    ][index];
    this.templates[0].scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        const m = o.material as T.MeshStandardMaterial;
        if (!palette!.has(m.name)) {
          const c = m.clone();
          if (m.name in colors)
            c.color.set(colors[m.name as keyof typeof colors]);
          palette!.set(m.name, c);
        }
      }
    });
    this.materials.set(index, palette);
    return palette;
  }
  private free(list: GLTF[]) {
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>(),
      ss = new Set<T.Skeleton>();
    for (const g of list)
      g.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          gs.add(o.geometry);
          ms.add(o.material as T.Material);
        }
        if (o instanceof T.SkinnedMesh) ss.add(o.skeleton);
      });
    gs.forEach((x) => x.dispose());
    ms.forEach((x) => x.dispose());
    ss.forEach((x) => x.dispose());
  }
  dispose() {
    this.closed = true;
    this.free(this.templates);
    this.templates = [];
    this.materials.forEach((p) => p.forEach((m) => m.dispose()));
    this.materials.clear();
  }
}
export class HeroVisual implements AvatarVisual {
  root = new T.Group();
  model: T.Object3D;
  mixer: T.AnimationMixer;
  actions = new Map<string, T.AnimationAction>();
  current = "";
  lod = 0;
  expression = "NEUTRAL";
  clip = "Idle";
  paletteIndex = 0;
  forceLOD: number | null = 0;
  mixerMs = 0;
  private skeleton: T.Skeleton;
  private nodes: T.Mesh[] = [];
  private lastAction?: T.AnimationAction;
  private blinkAt = 3.4;
  private blinkStart = -1;
  private blinkCounter = 0;
  disposed = false;
  constructor(
    public cache: HeroCache,
    public id = "hero",
  ) {
    this.model = clone(cache.templates[0].scene);
    this.root.add(this.model);
    this.skeleton = (
      this.model.getObjectByName("Face") as T.SkinnedMesh
    ).skeleton;
    // Crowd LOD bakes small facial parts into material batches on the same head bone.
    cache.templates[2].scene.traverse((ref) => {
      if (
        ref instanceof T.SkinnedMesh &&
        !this.model.getObjectByName(ref.name)
      ) {
        const mesh = new T.SkinnedMesh(ref.geometry, ref.material);
        mesh.name = ref.name;
        this.model.add(mesh);
        mesh.bind(this.skeleton, ref.bindMatrix);
      }
    });
    const extra = new Set<T.Skeleton>();
    this.model.traverse((o) => {
      if (o instanceof T.Mesh) {
        this.nodes.push(o);
        o.frustumCulled = false;
        if (o instanceof T.SkinnedMesh && o.skeleton !== this.skeleton) {
          extra.add(o.skeleton);
          o.skeleton = this.skeleton;
        }
      }
    });
    extra.forEach((s) => s.dispose());
    this.mixer = new T.AnimationMixer(this.model);
    cache.templates[0].animations.forEach((c) =>
      this.actions.set(c.name, this.mixer.clipAction(c)),
    );
    this.blinkAt += (hash(id) % 23) / 11;
  }
  update(d: Dancer, t: number, dt: number) {
    this.pose(
      ["ENTERING", "EXITING", "SPAWNING"].includes(d.state)
        ? "Walk"
        : this.clip,
      t,
      dt,
    );
    this.root.position.set(d.position.x, d.position.y, d.position.z);
    this.root.rotation.y = d.heading;
  }
  pose(clip: string, t: number, dt: number) {
    if (this.disposed) return;
    const action = this.actions.get(clip) ?? this.actions.get("Idle")!;
    if (this.current !== action.getClip().name) {
      action.reset().play();
      this.lastAction?.crossFadeTo(action, 0.25, false);
      this.lastAction = action;
      this.current = action.getClip().name;
    }
    action.time =
      ((t % action.getClip().duration) + action.getClip().duration) %
      action.getClip().duration;
    const start = performance.now();
    this.mixer.update(dt);
    this.mixerMs = performance.now() - start;
    const desired = this.forceLOD ?? selectLOD(16, "MEDIUM");
    this.lod = desired;
    const template = this.cache.templates[desired].scene,
      palette = this.cache.palette(this.paletteIndex);
    if (this.expression === "SURPRISED") {
      this.blinkStart = -1;
      this.blinkAt = t + 1.5;
    } else if (t >= this.blinkAt) {
      this.blinkStart = t;
      this.blinkAt =
        t + 2.8 + (hash(this.id + this.blinkCounter++) % 240) / 100;
    }
    const blink =
      this.blinkStart >= 0
        ? Math.max(
            0,
            Math.sin(Math.min(1, (t - this.blinkStart) / 0.17) * Math.PI),
          )
        : 0;
    const happy = ["HAPPY", "EXCITED", "HYPE"].includes(this.expression),
      open = ["EXCITED", "SURPRISED", "HYPE"].includes(this.expression),
      lift = ["SURPRISED", "EXCITED"].includes(this.expression);
    for (const mesh of this.nodes) {
      const ref = template.getObjectByName(mesh.name) as T.Mesh | undefined;
      mesh.visible = !!ref;
      if (!ref) continue;
      mesh.geometry = ref.geometry;
      mesh.material = palette.get((ref.material as T.Material).name)!;
      if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
        const values: Record<string, number> = {
          Smile: happy ? 1 : 0,
          Happy: happy ? 0.55 : 0,
          Open: open ? 1 : 0,
          Lift: lift ? 1 : 0,
          VIP: this.expression === "VIP" ? 1 : 0,
          Blink: blink,
        };
        for (const [name, i] of Object.entries(mesh.morphTargetDictionary)) {
          const v = values[name] ?? 0;
          mesh.morphTargetInfluences[i] =
            name === "Blink"
              ? v
              : T.MathUtils.lerp(
                  mesh.morphTargetInfluences[i],
                  v,
                  1 - Math.exp(-dt * 14),
                );
        }
      }
      if (mesh.name === "Teeth") mesh.visible = happy;
    }
    this.root.updateMatrixWorld(true);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.skeleton.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
export function createHeroOrFallback(
  cache: HeroCache,
  id: string,
): AvatarVisual {
  return cache.templates.length === 3
    ? new HeroVisual(cache, id)
    : new ProceduralAvatar(id);
}
