import * as T from "three";
export const palettes = {
  NEON: ["#172333", "#a9ffcc", "#17ae9e", "#192e44", "#f7faf2", "#ff628f"],
  PASTEL: ["#e1b9de", "#fff4df", "#b3becf", "#666485", "#fff2db", "#65d5cd"],
  STREET: ["#d9864a", "#e9ddc4", "#374758", "#202b38", "#f7e8d2", "#92d3bc"],
  DARK: ["#282c46", "#b5bdc7", "#67678b", "#1e2638", "#9496b2", "#d4ed75"],
  PARTY: ["#874cbb", "#fff3df", "#ef7291", "#392a63", "#f1d587", "#62dfd0"],
} as const;
export const accessories = [
  "none",
  "glasses",
  "headphones",
  "cap",
  "crown",
  "halo",
  "wings",
] as const;
export type Accessory = (typeof accessories)[number];
export type Skin = {
  version: 1;
  viewerId: string;
  palette: keyof typeof palettes;
  tone: string;
  eyes: string;
  hair: string;
  hairStyle: number;
  eyeStyle: number;
  jacket: boolean;
  top: string;
  shirt: string;
  pants: string;
  shoes: string;
  accent: string;
  accessory: Accessory;
  seed: number;
};
export function hash(s: string) {
  let h = 2166136261;
  for (const c of s.normalize("NFC")) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function appearance(id: string): Skin {
  id = id.normalize("NFC").trim();
  if (!id || id.length > 64) throw Error("viewerId: 1–64 characters");
  const seed = hash(id);
  let x = seed;
  const next = () => {
    x += 0x6d2b79f5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <A>(a: readonly A[]) => a[Math.floor(next() * a.length)];
  const palette = pick(Object.keys(palettes) as (keyof typeof palettes)[]),
    p = palettes[palette];
  return {
    version: 1,
    viewerId: id,
    seed,
    palette,
    tone: pick([
      "#e9ad86",
      "#c68865",
      "#935b43",
      "#693f34",
      "#f3c3a1",
      "#ae7254",
    ]),
    eyes: pick(["#263248", "#284b49", "#5b3b3f"]),
    hair: pick([
      "#252739",
      "#593835",
      "#bf7442",
      "#edc981",
      "#d9c5df",
      "#3c6772",
    ]),
    hairStyle: Math.floor(next() * 4),
    eyeStyle: Math.floor(next() * 3),
    jacket: next() > 0.25,
    top: p[0],
    shirt: p[1],
    pants: p[3],
    shoes: p[4],
    accent: p[5],
    accessory: pick(accessories),
  };
}
export function validateSkin(s: unknown): s is Skin {
  if (!s || typeof s !== "object") return false;
  const v = s as Skin;
  return (
    v.version === 1 &&
    typeof v.viewerId === "string" &&
    v.viewerId.trim().length > 0 &&
    v.viewerId.length <= 64 &&
    Object.hasOwn(palettes, v.palette) &&
    ["tone", "eyes", "hair", "top", "shirt", "pants", "shoes", "accent"].every(
      (k) => /^#[0-9a-f]{6}$/i.test((v as any)[k]),
    ) &&
    [0, 1, 2, 3].includes(v.hairStyle) &&
    [0, 1, 2].includes(v.eyeStyle) &&
    typeof v.jacket === "boolean" &&
    accessories.includes(v.accessory) &&
    Number.isInteger(v.seed) &&
    v.seed >= 0 &&
    v.seed <= 0xffffffff
  );
}
export const proportions = {
  A: { head: 0.64, width: 0.66, thigh: 0.38, shin: 0.37, torso: 0.57 },
  B: { head: 0.56, width: 0.58, thigh: 0.51, shin: 0.49, torso: 0.66 },
  C: { head: 0.7, width: 0.63, thigh: 0.43, shin: 0.42, torso: 0.6 },
};
export type Proportion = keyof typeof proportions;
export const clips = [
  "Idle",
  "Walk",
  "Groove",
  "Shuffle",
  "Robot",
  "Hype",
  "Disco",
  "Wave",
  "Cheer",
  "VIP",
] as const;
export type Clip = (typeof clips)[number];
export type Pose = {
  hips: T.Vector3;
  body: T.Euler;
  head: T.Euler;
  arms: [T.Euler, T.Euler];
  elbows: [number, number];
  hands: [number, number];
  feet: [T.Vector3, T.Vector3];
  yaw: number;
};
const sin = Math.sin,
  cos = Math.cos,
  pi = Math.PI;
export function pose(clip: Clip, time: number): Pose {
  const b = (time * 2 * pi * 112) / 60,
    s = sin(b),
    c = cos(b),
    up = Math.max(0, s),
    down = Math.max(0, -s);
  const p: Pose = {
    hips: new T.Vector3(0, -0.018, 0),
    body: new T.Euler(),
    head: new T.Euler(),
    arms: [new T.Euler(0.05, 0, -0.1), new T.Euler(-0.05, 0, 0.1)],
    elbows: [-0.22, -0.22],
    hands: [0, 0],
    feet: [new T.Vector3(-0.2, 0.11, 0), new T.Vector3(0.2, 0.11, 0)],
    yaw: 0,
  };
  if (clip === "Idle") {
    p.hips.y = -0.02 + 0.007 * sin(b * 0.25);
    p.head.y = 0.08 * sin(b * 0.14);
    return p;
  }
  if (clip === "Walk") {
    const stride = 0.27;
    p.hips.y = -0.035 + 0.012 * cos(2 * b);
    p.body.y = 0.06 * s;
    p.head.y = -p.body.y;
    for (let i = 0; i < 2; i++) {
      const phase = ((((time * 112) / 60 + i * 0.5) % 1) + 1) % 1;
      const swing = Math.max(0, (phase - 0.6) / 0.4);
      const z =
        phase < 0.6
          ? stride * (1 - (2 * phase) / 0.6)
          : -stride + 2 * stride * (swing * swing * (3 - 2 * swing));
      p.feet[i].set(
        i === 0 ? -0.2 : 0.2,
        0.11 + 0.14 * Math.sin(Math.PI * swing),
        z,
      );
    }
    p.arms[0].x = -0.45 * c;
    p.arms[1].x = 0.45 * c;
    p.elbows = [-0.35, -0.35];
    return p;
  }
  const bounce = 0.035 * (1 - cos(2 * b));
  p.hips.y = -0.02 - bounce;
  p.hips.x = 0.055 * s;
  p.body.z = -0.07 * s;
  p.head.z = 0.045 * s;
  p.head.y = -0.07 * s;
  if (clip === "Groove") {
    p.body.y = 0.16 * s;
    p.body.x = 0.08;
    p.arms[0].set(0.32 + 0.27 * c, 0.15, -0.42 - 0.2 * s);
    p.arms[1].set(0.32 - 0.27 * c, -0.15, 0.42 - 0.2 * s);
    p.elbows = [-1.15 - 0.24 * s, -1.15 + 0.24 * s];
    p.feet[0].z = 0.035 * s;
    p.feet[1].z = -0.035 * s;
  } else if (clip === "Shuffle") {
    p.hips.x = 0.09 * s;
    p.body.y = 0.16 * s;
    p.feet[0].set(-0.22, 0.11 + 0.15 * up, 0.24 * c);
    p.feet[1].set(0.22, 0.11 + 0.15 * down, -0.24 * c);
    p.arms[0].set(-0.55 * c, 0, -0.22);
    p.arms[1].set(0.55 * c, 0, 0.22);
    p.elbows = [-0.8 - 0.25 * s, -0.8 + 0.25 * s];
  } else if (clip === "Robot") {
    const tick = Math.round(sin(b * 0.5) * 3) / 3,
      q = Math.round(cos(b * 0.5) * 3) / 3;
    p.hips.x = 0.055 * tick;
    p.hips.y = -0.05;
    p.body.y = 0.22 * tick;
    p.body.z = 0.1 * q;
    p.head.y = -0.35 * tick;
    p.head.z = -0.12 * q;
    p.arms[0].set(-0.4 - 0.6 * q, 0, -0.65);
    p.arms[1].set(-0.4 + 0.6 * q, 0, 0.65);
    p.elbows = [-1.4 - 0.6 * tick, -1.4 + 0.6 * tick];
    p.hands = [0.5 * q, -0.5 * q];
  } else if (clip === "Hype" || clip === "Cheer") {
    const lift = Math.max(0, sin(b * 0.5));
    p.hips.y = -0.07 + 0.15 * lift;
    p.feet.forEach((f) => (f.y = 0.11 + 0.1 * lift));
    p.body.x = -0.08 * lift;
    p.arms[0].set(-0.18, 0, -1.85 - 0.6 * lift);
    p.arms[1].set(-0.18, 0, 1.85 + 0.6 * lift);
    p.elbows = [-0.6 + 0.25 * c, -0.6 - 0.25 * c];
    p.head.x = -0.1;
    p.hands = [0.15 * s, -0.15 * s];
  } else if (clip === "Disco") {
    p.hips.x = 0.1 * s;
    p.body.y = 0.2 * s;
    p.body.z = 0.12 * s;
    p.arms[0].set(0.1, 0, -0.55);
    p.arms[1].set(-0.15, 0, 1.8 + 0.5 * s);
    p.elbows = [-1.6, -0.25];
    p.head.y = 0.2;
    p.feet[1].x = 0.24 + 0.08 * up;
  } else if (clip === "Wave") {
    p.hips.x = -0.06;
    p.body.z = 0.06;
    p.arms[1].set(-0.15, 0, 2.0 + 0.16 * sin(b * 0.6));
    p.elbows[1] = -0.65 + 0.22 * sin(b * 1.1);
    p.hands[1] = 0.35 * sin(b * 1.2);
    p.head.z = -0.09;
    p.arms[0].z = -0.2;
  } else if (clip === "VIP") {
    p.hips.x = 0.08 * s;
    p.body.y = 0.25 * s;
    p.body.x = -0.05;
    p.arms[0].set(-0.25, 0, -1.0 - 0.45 * s);
    p.arms[1].set(-0.25, 0, 1.0 - 0.45 * s);
    p.elbows = [-1.0 - 0.45 * c, -1.0 + 0.45 * c];
    p.head.y = -0.16 * s;
    p.head.x = -0.08;
  }
  return p;
}
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const e = (x: T.Euler, y: T.Euler) =>
    new T.Euler(
      T.MathUtils.lerp(x.x, y.x, t),
      T.MathUtils.lerp(x.y, y.y, t),
      T.MathUtils.lerp(x.z, y.z, t),
    );
  return {
    hips: a.hips.clone().lerp(b.hips, t),
    body: e(a.body, b.body),
    head: e(a.head, b.head),
    arms: [e(a.arms[0], b.arms[0]), e(a.arms[1], b.arms[1])],
    elbows: [
      T.MathUtils.lerp(a.elbows[0], b.elbows[0], t),
      T.MathUtils.lerp(a.elbows[1], b.elbows[1], t),
    ],
    hands: [
      T.MathUtils.lerp(a.hands[0], b.hands[0], t),
      T.MathUtils.lerp(a.hands[1], b.hands[1], t),
    ],
    feet: [
      a.feet[0].clone().lerp(b.feet[0], t),
      a.feet[1].clone().lerp(b.feet[1], t),
    ],
    yaw: T.MathUtils.lerp(a.yaw, b.yaw, t),
  };
}
export type EventKind = "FOLLOW" | "HERO" | "VIP";
export function momentAt(kind: EventKind, seconds: number) {
  const duration = kind === "FOLLOW" ? 18 : 16;
  const stage =
    seconds < 0
      ? "NONE"
      : seconds >= duration
        ? "DONE"
        : kind === "FOLLOW"
          ? seconds < 2
            ? "APPEAR"
            : seconds < 5
              ? "WALK"
              : seconds < 8
                ? "WAVE"
                : seconds < 13
                  ? "SOLO"
                  : "JOIN"
          : seconds < 3
            ? "GATHER"
            : seconds < 11
              ? "SOLO"
              : "RETURN";
  return {
    kind,
    seconds,
    duration,
    stage,
    active: seconds >= 0 && seconds < duration,
    ring: kind !== "FOLLOW" && seconds < 13,
    clip: (stage === "WALK" ||
    stage === "JOIN" ||
    stage === "GATHER" ||
    stage === "RETURN"
      ? "Walk"
      : stage === "WAVE"
        ? "Wave"
        : stage === "SOLO"
          ? kind === "VIP"
            ? "VIP"
            : "Disco"
          : "Idle") as Clip,
  };
}
