import * as T from "three";
import { ProceduralAvatar, type AvatarVisual } from "./avatars";
import { BlockAvatar, BlockBatch } from "./block/rig";
import {
  appearance,
  palettes,
  accessories,
  type Clip,
  type Skin,
  type Accessory,
} from "./block/core";
import { visualDance, type Reaction } from "./presentation";
import type { Dancer } from "./domain";
export const danceChoices = [
  "AUTO",
  "Groove",
  "Shuffle",
  "Robot",
  "Hype",
  "Disco",
] as const;
export type CharacterConfig = {
  version: 1;
  backend: "PROCEDURAL" | "BLOCK";
  palette: "AUTO" | keyof typeof palettes;
  accessory: "AUTO" | Accessory;
  dance: (typeof danceChoices)[number];
};
export const characterDefaults: CharacterConfig = {
  version: 1,
  backend: "PROCEDURAL",
  palette: "AUTO",
  accessory: "AUTO",
  dance: "AUTO",
};
export function characterConfig(raw: unknown): CharacterConfig {
  const v = (
    raw && typeof raw === "object" ? raw : {}
  ) as Partial<CharacterConfig>;
  if (v.version !== undefined && v.version !== 1)
    return { ...characterDefaults };
  return {
    version: 1,
    backend: v.backend === "BLOCK" ? "BLOCK" : "PROCEDURAL",
    palette:
      v.palette && Object.hasOwn(palettes, v.palette)
        ? (v.palette as keyof typeof palettes)
        : "AUTO",
    accessory: accessories.includes(v.accessory as Accessory)
      ? (v.accessory as Accessory)
      : "AUTO",
    dance: danceChoices.includes(v.dance as any) ? v.dance! : "AUTO",
  };
}
export class CharacterStore {
  key = "LiveDance.characters.v04.phase2";
  warning = "";
  constructor(private storage: Pick<Storage, "getItem" | "setItem">) {}
  load() {
    try {
      return characterConfig(
        JSON.parse(this.storage.getItem(this.key) ?? "{}"),
      );
    } catch {
      this.warning = "Character config inválida; se recuperó PROCEDURAL";
      return { ...characterDefaults };
    }
  }
  save(config: CharacterConfig) {
    try {
      this.storage.setItem(this.key, JSON.stringify(characterConfig(config)));
    } catch {
      this.warning =
        "No se pudo guardar Character config; se mantiene sólo en memoria";
    }
  }
}
export function skinFor(id: string, c: CharacterConfig): Skin {
  const s = appearance(id);
  if (c.palette !== "AUTO") {
    const p = palettes[c.palette];
    Object.assign(s, {
      palette: c.palette,
      top: p[0],
      shirt: p[1],
      pants: p[3],
      shoes: p[4],
      accent: p[5],
    });
  }
  if (c.accessory !== "AUTO") s.accessory = c.accessory;
  return s;
}
export const danceAliases: Record<string, Clip> = {
  Groove: "Groove",
  Disco: "Disco",
  Shuffle: "Shuffle",
  Wave: "Groove",
  Bounce: "Hype",
  Robot: "Robot",
  Spin: "Disco",
  Hype: "Hype",
  SideStep: "Shuffle",
  Freestyle: "Groove",
  Electro: "Robot",
  HipHop: "Groove",
  Latin: "Disco",
  JumpDance: "Hype",
  ClapGroove: "Cheer",
  SmoothStep: "Shuffle",
};
const reactionAliases: Record<Reaction, Clip> = {
  CHEER: "Cheer",
  JUMP: "Hype",
  WAVE_HELLO: "Wave",
  CELEBRATE: "Cheer",
  HEART: "Cheer",
  SHOCK: "Robot",
  APPLAUSE: "Cheer",
  VIP_POSE: "VIP",
  TOP_POSE: "VIP",
  HYPE_POSE: "Hype",
};
export type CharacterContext = {
  reaction?: { kind: Reaction; start: number; end: number };
  groupDance?: string;
  groupStart?: number;
  reduceMotion?: boolean;
};
export function resolveClip(
  d: Dancer,
  t: number,
  c: CharacterConfig,
  ctx: CharacterContext,
): Clip {
  if (
    ["SPAWNING", "ENTERING", "EXITING"].includes(d.state) ||
    d.animationState === "Walk"
  )
    return "Walk";
  if (ctx.reduceMotion) return "Idle";
  if (ctx.reaction && ctx.reaction.end > t)
    return reactionAliases[ctx.reaction.kind];
  if (d.vipUntil > t) return "VIP";
  if (ctx.groupDance) return danceAliases[ctx.groupDance] ?? "Groove";
  if (d.animationState === "Idle") return "Idle";
  return c.dance !== "AUTO"
    ? c.dance
    : (danceAliases[visualDance(d)] ?? "Groove");
}
export class BlockVisual implements AvatarVisual {
  block: BlockAvatar;
  root: T.Group;
  context: CharacterContext = {};
  private previous?: { x: number; z: number };
  private travel = 0;
  constructor(
    id: string,
    public config: CharacterConfig,
  ) {
    this.block = new BlockAvatar(id, "C", skinFor(id, config));
    this.root = this.block.root;
  }
  update(d: Dancer, t: number, dt: number) {
    const clip = resolveClip(d, t, this.config, this.context);
    if (this.previous && clip === "Walk")
      this.travel += Math.hypot(
        d.position.x - this.previous.x,
        d.position.z - this.previous.z,
      );
    this.previous = { x: d.position.x, z: d.position.z };
    this.root.position.set(d.position.x, d.position.y, d.position.z);
    this.root.rotation.y = d.heading;
    const target =
      d.state === "SPAWNING"
        ? Math.max(0.01, Math.min(1, (t - d.stateSince) / 0.65))
        : 1;
    this.root.scale.setScalar(target);
    const clock =
      clip === "Walk"
        ? this.travel / ((0.9 * 112) / 60)
        : this.context.groupStart !== undefined
          ? t - this.context.groupStart
          : t * d.speed + d.phase;
    this.block.update(clip, clock, dt);
  }
  dispose() {
    this.block.dispose();
  }
}
export class CharacterSystem {
  config: CharacterConfig;
  batch: BlockBatch | null = null;
  fallbacks = 0;
  private failed = new Set<string>();
  private focusColor = new T.Color();
  private disposed = false;
  constructor(
    private scene: T.Scene,
    config: CharacterConfig,
    private report: (e: unknown) => void,
  ) {
    this.config = characterConfig(config);
  }
  configure(config: CharacterConfig) {
    this.config = characterConfig(config);
    this.failed.clear();
    if (this.config.backend === "PROCEDURAL") {
      this.batch?.dispose();
      this.batch = null;
    }
  }
  create(id: string): AvatarVisual {
    if (this.config.backend === "BLOCK" && !this.failed.has(id))
      try {
        this.batch ??= new BlockBatch(this.scene);
        return new BlockVisual(id, this.config);
      } catch (e) {
        return this.fallback(id, e);
      }
    return new ProceduralAvatar(id);
  }
  fallback(id: string, error: unknown): ProceduralAvatar {
    this.fallbacks++;
    if (this.failed.size < 30) this.failed.add(id);
    this.report(
      `CharacterSystem: BLOCK falló para ${id}; recuperado con PROCEDURAL. ${String(error)}`,
    );
    return new ProceduralAvatar(id);
  }
  update(avatars: Iterable<AvatarVisual>, focus?: AvatarVisual) {
    if (!this.batch) return;
    const blocks = [...avatars].filter(
      (a): a is BlockVisual => a instanceof BlockVisual,
    );
    this.batch.update(blocks.map((a) => a.block));
    if (focus) {
      let i = 0;
      for (const a of blocks)
        for (const p of a.block.parts) {
          this.batch.mesh.setColorAt(
            i++,
            a === focus
              ? p.color
              : this.focusColor.copy(p.color).multiplyScalar(0.38),
          );
        }
      if (this.batch.mesh.instanceColor)
        this.batch.mesh.instanceColor.needsUpdate = true;
    }
  }
  inspect(avatars: Iterable<AvatarVisual>) {
    const all = [...avatars];
    return {
      config: { ...this.config },
      blocks: all.filter((a) => a instanceof BlockVisual).length,
      procedural: all.filter((a) => a instanceof ProceduralAvatar).length,
      parts: this.batch?.mesh.count ?? 0,
      fallbacks: this.fallbacks,
      failed: [...this.failed],
      batchAllocated: !!this.batch,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.batch?.dispose();
    this.batch = null;
    this.failed.clear();
  }
}
