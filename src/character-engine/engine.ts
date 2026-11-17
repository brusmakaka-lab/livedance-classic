import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { ProceduralAvatar, type AvatarVisual } from "../avatars";
import { hash, type Dancer, type Quality } from "../domain";
export const PACK = "2.0.0-prototype.1";
export const expressions = [
  "NEUTRAL",
  "HAPPY",
  "EXCITED",
  "SURPRISED",
  "VIP",
  "HYPE",
] as const;
export type RendererMode = "AUTO" | "GLB" | "PROCEDURAL";
export const bones = [
  "root",
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  ...["left", "right"].flatMap((s) =>
    [
      "Shoulder",
      "UpperArm",
      "LowerArm",
      "Hand",
      "UpperLeg",
      "LowerLeg",
      "Foot",
    ].map((b) => s + b),
  ),
];
export const animationMap: Record<string, string> = {
  Idle: "Idle",
  Walk: "Walk",
  Groove: "Groove",
  Disco: "Disco",
  Shuffle: "Shuffle",
  Wave: "WaveDance",
  Bounce: "Bounce",
  Robot: "Robot",
  Spin: "Disco",
  Hype: "Hype",
  JumpDance: "Jump",
  SideStep: "Groove",
  Freestyle: "WaveDance",
  Electro: "Electro",
  HipHop: "Bounce",
  Latin: "Disco",
  ClapGroove: "ClapGroove",
  SmoothStep: "Shuffle",
};
export function identity(id: string) {
  const n = hash(id);
  return {
    palette: n % 4,
    hair: (n >>> 5) % 8,
    accessory: (n >>> 10) % 3,
    height: 0.96 + ((n >>> 13) % 5) * 0.02,
    dance: Object.keys(animationMap).slice(2)[n % 16],
  };
}
export function rendererFor(mode: RendererMode, q: Quality) {
  return mode === "AUTO" ? (q === "LOW" ? "PROCEDURAL" : "GLB") : mode;
}
export function selectLOD(
  distance: number,
  quality: Quality,
  featured = false,
  previous = 1,
) {
  if (featured) return 0;
  if (quality === "LOW") return 2;
  const near = quality === "HIGH" ? 12 : 8,
    far = quality === "HIGH" ? 25 : 18;
  if (previous === 0 && distance < near + 1) return 0;
  if (previous === 2 && distance > far - 1) return 2;
  return distance < near ? 0 : distance > far ? 2 : 1;
}
const skin = ["#b77f60", "#edc3a2", "#795344", "#d99e78"],
  shirt = ["#60bbb5", "#bb8ac6", "#de937e", "#8daecf"];
export interface VisualContext {
  quality: Quality;
  distance: number;
  featured?: boolean;
  group?: { clip: string; start: number };
  reaction?: string;
  expression?: string;
  forceClip?: string;
  forceLOD?: number;
  rank?: number;
  level?: number;
  hair?: number;
  palette?: number;
  accessory?: number;
}
export function validatePack(g: GLTF) {
  let metadata: T.Object3D | undefined;
  g.scene.traverse((o) => {
    if (o.userData.characterPackVersion) metadata = o;
  });
  if (metadata?.userData.characterPackVersion !== PACK)
    throw Error("Character Pack version incompatible");
  for (const name of bones)
    if (!(g.scene.getObjectByName(name) instanceof T.Bone))
      throw Error("Rig bone missing: " + name);
  for (const name of [
    "Idle",
    "Walk",
    "Groove",
    "Disco",
    "Shuffle",
    "WaveDance",
    "Bounce",
    "Robot",
    "Electro",
    "ClapGroove",
    "Wave",
    "Cheer",
    "Jump",
    "Celebrate",
    "Heart",
    "Shock",
    "VIP",
    "Top",
    "Hype",
  ])
    if (!g.animations.some((c) => c.name === name))
      throw Error("Clip missing: " + name);
  let skinned = 0;
  g.scene.traverse((o) => {
    if (o instanceof T.Mesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (
        mats.some(
          (m) =>
            !(m instanceof T.MeshStandardMaterial) ||
            !Number.isFinite(m.roughness),
        )
      )
        throw Error("Invalid character material");
    }
    if (o instanceof T.SkinnedMesh) {
      skinned++;
      const ids = o.geometry.getAttribute("skinIndex"),
        weights = o.geometry.getAttribute("skinWeight");
      if (!ids || !weights) throw Error("Skin weights missing");
      for (let i = 0; i < ids.count; i++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) {
          if (ids.getComponent(i, j) >= o.skeleton.bones.length)
            throw Error("Invalid skin joint");
          sum += weights.getComponent(i, j);
        }
        if (Math.abs(sum - 1) > 0.01) throw Error("Unnormalized skin weights");
      }
    }
  });
  if (!skinned) throw Error("No SkinnedMesh");
  for (const clip of g.animations)
    for (const track of clip.tracks)
      if (track.name === "root.position" || track.name === "hips.position") {
        for (let i = 0; i < track.values.length; i += 3)
          if (
            Math.abs(track.values[i]) > 0.001 ||
            Math.abs(track.values[i + 2]) > 0.001
          )
            throw Error("Root motion not allowed");
      }
  for (const name of [
    "Hair_short",
    "Hair_curly",
    "Hair_fade",
    "Hair_bun",
    "Hair_ponytail",
    "Hair_medium",
    "Hair_long",
    "Hair_styled",
    "Crown",
    "Glasses",
  ])
    if (!g.scene.getObjectByName(name))
      throw Error("Required attachment missing: " + name);
}
export class CharacterCache {
  templates: GLTF[] = [];
  private loading?: Promise<void>;
  private geometries = new Map<string, T.BufferGeometry>();
  loads = 0;
  private disposed = false;
  async preload(loader = (url: string) => new GLTFLoader().loadAsync(url)) {
    if (this.disposed) throw Error("Cache disposed");
    if (this.templates.length) return;
    if (!this.loading)
      this.loading = (async () => {
        const result: GLTF[] = [];
        try {
          for (let i = 0; i < 3; i++) {
            const g = await loader(`/assets/characters/v2/lod${i}.glb`);
            result.push(g);
            if (this.disposed) throw Error("Cache disposed during preload");
            validatePack(g);
          }
          this.templates = result;
          this.loads++;
        } catch (e) {
          this.freeTemplates(result);
          throw e;
        }
      })().finally(() => {
        this.loading = undefined;
      });
    return this.loading;
  }
  geometry(lod: number, palette: number) {
    const key = lod + ":" + palette;
    let geometry = this.geometries.get(key);
    if (geometry) return geometry;
    const mesh = this.templates[lod].scene.getObjectByName(
        "Body",
      ) as T.SkinnedMesh,
      base = mesh.geometry;
    geometry = new T.BufferGeometry();
    for (const [k, a] of Object.entries(base.attributes))
      geometry.setAttribute(k, a);
    geometry.setIndex(base.index);
    const color = (base.getAttribute("color") as T.BufferAttribute).clone();
    geometry.setAttribute("color", color);
    const colors: Record<string, string> = {
      skin: skin[palette],
      shirt: shirt[palette],
      pants: ["#29354b", "#34384b", "#3c3949", "#273b46"][palette],
      shoes: ["#e7e4db", "#d4e3df", "#e7d6ce", "#efebdb"][palette],
    };
    for (const r of mesh.userData.regions ?? []) {
      if (!colors[r.region]) continue;
      const c = new T.Color(colors[r.region]);
      for (let i = r.start; i < r.start + r.count; i++)
        color.setXYZ(i, c.r, c.g, c.b);
    }
    this.geometries.set(key, geometry);
    return geometry;
  }
  private freeTemplates(templates: GLTF[]) {
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>(),
      ss = new Set<T.Skeleton>();
    for (const g of templates)
      g.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          gs.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            ms.add(m),
          );
        }
        if (o instanceof T.SkinnedMesh) ss.add(o.skeleton);
      });
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
    ss.forEach((s) => s.dispose());
  }
  stats() {
    return {
      loads: this.loads,
      templates: this.templates.length,
      variantGeometries: this.geometries.size,
    };
  }
  dispose() {
    this.disposed = true;
    this.freeTemplates(this.templates);
    this.geometries.forEach((g) => g.dispose());
    this.geometries.clear();
    this.templates = [];
  }
}
export class GLBRenderer implements AvatarVisual {
  root = new T.Group();
  model: T.Object3D;
  mixer: T.AnimationMixer;
  body: T.SkinnedMesh;
  actions = new Map<string, T.AnimationAction>();
  current = "";
  lod = 1;
  appearance = identity("");
  mixerMs = 0;
  private accumulator = 0;
  private previous?: T.AnimationAction;
  private idle = false;
  id = "";
  constructor(private cache: CharacterCache) {
    this.model = clone(cache.templates[0].scene);
    this.root.add(this.model);
    this.body = this.model.getObjectByName("Body") as T.SkinnedMesh;
    this.model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.frustumCulled = false;
        o.castShadow = false;
      }
    });
    this.mixer = new T.AnimationMixer(this.model);
    for (const clip of cache.templates[0].animations)
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.reset("initial");
  }
  reset(id: string) {
    this.id = id;
    this.appearance = identity(id);
    this.idle = false;
    this.current = "";
    this.previous = undefined;
    this.accumulator = 0;
    this.mixer.stopAllAction();
    this.root.visible = true;
    for (const n of ["Eyes", "Brows", "Mouth"]) {
      const face = this.model.getObjectByName(n);
      if (face) {
        face.scale.set(1, 1, 1);
        face.position.set(0, 0, 0);
        face.rotation.set(0, 0, 0);
      }
    }
  }
  update(
    d: Dancer,
    t: number,
    dt: number,
    ctx: VisualContext = { quality: "MEDIUM", distance: 10 },
  ) {
    if (this.idle) return;
    const a = this.appearance,
      palette = ctx.palette ?? a.palette,
      hair = ctx.hair ?? a.hair;
    const lod =
      ctx.forceLOD ??
      selectLOD(ctx.distance, ctx.quality, ctx.featured, this.lod);
    this.lod = lod;
    this.body.geometry = this.cache.geometry(lod, palette);
    const hairs = [
      "short",
      "curly",
      "fade",
      "bun",
      "ponytail",
      "medium",
      "long",
      "styled",
    ];
    for (let i = 0; i < hairs.length; i++) {
      const n = this.model.getObjectByName("Hair_" + hairs[i]) as T.Mesh;
      n.visible = i === hair;
      const g = this.cache.templates[lod].scene.getObjectByName(
        n.name,
      ) as T.Mesh;
      if (g) n.geometry = g.geometry;
    }
    for (const name of ["Eyes", "Mouth", "Brows"]) {
      const n = this.model.getObjectByName(name);
      if (n) n.visible = lod < 2;
    }
    const crown = this.model.getObjectByName("Crown"),
      glasses = this.model.getObjectByName("Glasses");
    if (crown) crown.visible = ctx.rank === 1 || (ctx.level ?? 0) >= 3;
    if (glasses)
      glasses.visible = (ctx.accessory ?? a.accessory) === 1 && lod < 2;
    const walking = ["SPAWNING", "ENTERING", "EXITING"].includes(d.state),
      reactionMap: Record<string, string> = {
        WAVE_HELLO: "Wave",
        CHEER: "Cheer",
        BIG_CHEER: "Celebrate",
        APPLAUSE: "Celebrate",
        JUMP: "Jump",
        HEART: "Heart",
        SHOCK: "Shock",
      };
    const clip = walking
      ? "Walk"
      : (ctx.forceClip ??
        (ctx.group
          ? (animationMap[ctx.group.clip] ?? ctx.group.clip)
          : ctx.reaction
            ? (reactionMap[ctx.reaction] ?? ctx.reaction)
            : d.vipUntil > t
              ? "VIP"
              : (animationMap[d.animationState] ?? "Groove")));
    const next = this.actions.get(clip) ?? this.actions.get("Idle")!;
    if (this.current !== next.getClip().name) {
      const old = this.previous;
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      if (old) old.crossFadeTo(next, 0.22, false);
      this.previous = next;
      this.current = next.getClip().name;
    }
    this.accumulator += dt;
    this.mixerMs = 0;
    if (lod < 2 || this.accumulator >= 1 / 30) {
      const start = performance.now(),
        step = this.accumulator;
      this.accumulator = 0;
      const phase =
        ctx.group && !walking ? t - ctx.group.start : t * d.speed + d.phase;
      next.time =
        ((phase % next.getClip().duration) + next.getClip().duration) %
        next.getClip().duration;
      this.mixer.update(step);
      this.mixerMs = performance.now() - start;
    }
    const exp =
        ctx.expression ??
        (d.vipUntil > t ? "VIP" : ctx.reaction ? "EXCITED" : "NEUTRAL"),
      mouth = this.model.getObjectByName("Mouth"),
      eyes = this.model.getObjectByName("Eyes"),
      brows = this.model.getObjectByName("Brows");
    const e = expressions.indexOf(exp as (typeof expressions)[number]);
    if (mouth)
      mouth.scale.y = T.MathUtils.lerp(
        mouth.scale.y,
        [1, 1.7, 2.5, 3.7, 1.2, 3][Math.max(0, e)],
        1 - Math.exp(-dt * 12),
      );
    if (eyes)
      eyes.scale.y = (t + (hash(this.id) % 31) / 7) % 4.3 < 0.1 ? 0.15 : 1;
    if (mouth) mouth.position.y = -0.125 * (1 - mouth.scale.y);
    if (eyes) eyes.position.y = 0.02 * (1 - eyes.scale.y);
    if (brows) {
      brows.rotation.z = e === 3 ? 0.12 : e === 4 ? -0.09 : 0;
      brows.position.set(
        0.134 * Math.sin(brows.rotation.z),
        0.134 * (1 - Math.cos(brows.rotation.z)),
        0,
      );
    }
    this.root.position.set(d.position.x, d.position.y, d.position.z);
    this.root.rotation.y = d.heading;
    const scale = a.height * (d.effectState.includes("scale") ? 1.18 : 1);
    this.root.scale.setScalar(scale);
    this.root.updateMatrixWorld(true);
  }
  release() {
    this.idle = true;
    this.mixer.stopAllAction();
    this.current = "";
    this.previous = undefined;
    this.root.removeFromParent();
    this.root.visible = false;
  }
  dispose() {
    this.release();
    this.mixer.uncacheRoot(this.model);
    const skeletons = new Set<T.Skeleton>();
    this.model.traverse((o) => {
      if (o instanceof T.SkinnedMesh) skeletons.add(o.skeleton);
    });
    skeletons.forEach((s) => s.dispose());
    this.root.clear();
  }
}
export interface Handle {
  kind: "GLB" | "PROCEDURAL";
  visual: AvatarVisual;
  update(d: Dancer, t: number, dt: number, ctx: VisualContext): void;
  release(): void;
}
export class CharacterEngine {
  cache = new CharacterCache();
  active = new Set<Handle>();
  pool: GLBRenderer[] = [];
  logs: { component: string; message: string; recovered: boolean }[] = [];
  ready = false;
  created = 0;
  reused = 0;
  maxPool = 8;
  closed = false;
  log(message: string, recovered = true) {
    this.logs.push({ component: "CharacterEngine", message, recovered });
    if (this.logs.length > 50) this.logs.shift();
  }
  async preload(loader?: (url: string) => Promise<GLTF>) {
    try {
      await this.cache.preload(loader);
      this.ready = true;
      this.log("Character Pack loaded " + PACK);
    } catch (e) {
      this.ready = false;
      this.log("Asset failed; PROCEDURAL fallback: " + String(e));
    }
  }
  acquire(id: string, mode: RendererMode, q: Quality): Handle {
    if (this.closed) throw Error("Engine disposed");
    if (this.active.size >= 60)
      throw Error("Character pool active budget exceeded");
    const glb = rendererFor(mode, q) === "GLB" && this.ready;
    let v: GLBRenderer | ProceduralAvatar;
    if (glb) {
      const cached = this.pool.pop();
      if (cached) this.reused++;
      else this.created++;
      v = cached ?? new GLBRenderer(this.cache);
      v.reset(id);
    } else {
      v = new ProceduralAvatar(id);
      if (rendererFor(mode, q) === "GLB")
        this.log("Asset unavailable; temporary PROCEDURAL for " + id);
    }
    const handle: Handle = {
      kind: glb ? "GLB" : "PROCEDURAL",
      visual: v,
      update: (d, t, dt, ctx) => {
        if (v instanceof GLBRenderer) v.update(d, t, dt, ctx);
        else {
          v.danceOverride = ctx.group?.clip as any;
          v.syncStart = ctx.group?.start;
          v.rank = ctx.rank ?? 0;
          v.level = ctx.level ?? 0;
          if (ctx.reaction)
            v.reaction = {
              kind: ctx.reaction as any,
              start: t - 0.1,
              end: t + 1,
            };
          else v.reaction = undefined;
          v.update(d, t, dt);
        }
      },
      release: () => {
        if (!this.active.delete(handle)) return;
        if (v instanceof GLBRenderer) {
          v.release();
          if (this.pool.length < this.maxPool) this.pool.push(v);
          else v.dispose();
        } else v.dispose();
      },
    };
    this.active.add(handle);
    return handle;
  }
  stats() {
    return {
      active: this.active.size,
      pool: this.pool.length,
      created: this.created,
      reused: this.reused,
      ...this.cache.stats(),
    };
  }
  dispose() {
    this.closed = true;
    for (const h of [...this.active]) h.release();
    this.pool.forEach((v) => v.dispose());
    this.pool = [];
    this.cache.dispose();
    this.ready = false;
  }
}
