import { hash, type World, type Dancer } from "./domain";
export const dances = [
  "Groove",
  "Disco",
  "Shuffle",
  "Wave",
  "Bounce",
  "Robot",
  "Spin",
  "Hype",
  "SideStep",
  "Freestyle",
  "Electro",
  "HipHop",
  "Latin",
  "JumpDance",
  "ClapGroove",
  "SmoothStep",
] as const;
export type Reaction =
  | "CHEER"
  | "JUMP"
  | "WAVE_HELLO"
  | "CELEBRATE"
  | "HEART"
  | "SHOCK"
  | "APPLAUSE"
  | "VIP_POSE"
  | "TOP_POSE"
  | "HYPE_POSE";
export type LightState = "AMBIENT" | "GROOVE" | "FEATURED" | "VIP" | "HYPE";
export const sceneCatalog = [
  { id: "afterglow", name: "Afterglow 3.1", available: true },
  ...["Neon Rooftop", "Festival", "Beach Party", "Halloween", "Christmas"].map(
    (name) => ({
      id: name.toLowerCase().replaceAll(" ", "-"),
      name,
      available: false,
    }),
  ),
];
export interface PresentationConfig {
  scene: "afterglow";
  sceneName: string;
  title: string;
  subtitle: string;
  accent: string;
  branding: boolean;
  topContributor: boolean;
  group: boolean;
  entrance: boolean;
  cameraSmooth: number;
  framing: number;
  lightIntensity: number;
}
export const presentationDefaults: PresentationConfig = {
  scene: "afterglow",
  sceneName: "AFTERGLOW",
  title: "LiveDance",
  subtitle: "MOVE TOGETHER",
  accent: "#77f2d2",
  branding: true,
  topContributor: true,
  group: true,
  entrance: true,
  cameraSmooth: 1.1,
  framing: 1,
  lightIntensity: 0.8,
};
export function presentationConfig(
  value: Partial<PresentationConfig> = {},
): PresentationConfig {
  const c = { ...presentationDefaults, ...value, scene: "afterglow" as const };
  for (const k of ["sceneName", "title", "subtitle"] as const)
    c[k] =
      typeof c[k] === "string" ? c[k].slice(0, 48) : presentationDefaults[k];
  if (!/^#[0-9a-f]{6}$/i.test(c.accent)) c.accent = presentationDefaults.accent;
  for (const k of ["branding", "topContributor", "group", "entrance"] as const)
    c[k] = typeof c[k] === "boolean" ? c[k] : presentationDefaults[k];
  for (const [k, min, max] of [
    ["cameraSmooth", 0.4, 2],
    ["framing", 0.85, 1.15],
    ["lightIntensity", 0.2, 1.2],
  ] as const)
    c[k] = Number.isFinite(c[k])
      ? Math.max(min, Math.min(max, c[k]))
      : presentationDefaults[k];
  return c;
}
export class PresentationStore {
  key = "LiveDance.presentation.v2";
  warning = "";
  constructor(private storage: Pick<Storage, "getItem" | "setItem">) {}
  load() {
    try {
      return presentationConfig(
        JSON.parse(this.storage.getItem(this.key) ?? "{}"),
      );
    } catch {
      this.warning = "Branding inválido: valores iniciales restaurados";
      return presentationConfig();
    }
  }
  save(config: PresentationConfig) {
    try {
      this.storage.setItem(
        this.key,
        JSON.stringify(presentationConfig(config)),
      );
    } catch {
      this.warning = "No se pudo guardar branding";
    }
  }
}
export function visualDance(d: Pick<Dancer, "id" | "animationState">) {
  return d.animationState === "Walk" || d.animationState === "Idle"
    ? d.animationState
    : dances[hash(d.id) % dances.length];
}
export class LightingDirector {
  state: LightState = "AMBIENT";
  intensity = 0.5;
  pulse = 0;
  color = "#77f2d2";
  update(state: LightState, dt: number, time: number, bpm?: number) {
    this.state = state;
    const target = {
      AMBIENT: 0.35,
      GROOVE: 0.6,
      FEATURED: 0.72,
      VIP: 0.9,
      HYPE: 1,
    }[state];
    this.intensity += (target - this.intensity) * (1 - Math.exp(-dt * 2));
    this.pulse = bpm
      ? 0.5 + 0.5 * Math.sin(((time * bpm) / 60) * Math.PI * 2)
      : 0.5 + 0.5 * Math.sin(time * 1.5);
    this.color = {
      AMBIENT: "#83a5bd",
      GROOVE: "#77f2d2",
      FEATURED: "#cfacff",
      VIP: "#ffd28b",
      HYPE: "#ff8bbc",
    }[state];
  }
}
export class PresentationDirector {
  lights = new LightingDirector();
  reactions = new Map<string, { kind: Reaction; start: number; end: number }>();
  private states = new Map<string, string>();
  private seen = new Set<string>();
  vipId: string | null = null;
  top = false;
  ledTitle = "";
  ledSubtitle = "";
  shot = "WIDE";
  shotUntil = 0;
  private entranceId: string | null = null;
  nowPlaying = "";
  bpm?: number;
  beatTime = 0;
  energy = 0;
  entranceStrength = 0;
  entranceName = "";
  beatIntensity = 0.5;
  constructor(public config: PresentationConfig) {}
  update(w: World, dt: number) {
    const now = w.now;
    for (const [id, r] of this.reactions)
      if (r.end <= now || !w.spawn.dancers.has(id)) this.reactions.delete(id);
    for (const id of this.states.keys())
      if (!w.spawn.dancers.has(id)) this.states.delete(id);
    for (const [id, d] of w.spawn.dancers) {
      const prev = this.states.get(id);
      if (prev === "ENTERING" && (d.state === "DANCING" || d.state === "IDLE"))
        this.react(id, "WAVE_HELLO", now, 2.1);
      this.states.set(id, d.state);
    }
    const activeKeys = new Set<string>();
    for (const [key, e] of w.effects.active) {
      const token = key + ":" + e.start;
      activeKeys.add(token);
      if (!this.seen.has(token)) {
        if (e.kind === "aura") this.react(e.dancerId, "JUMP", now, 1.2);
        if (e.kind === "spotlight") this.react(e.dancerId, "CHEER", now, 2.2);
        if (e.kind === "scale" || e.kind === "crown")
          this.react(e.dancerId, "CELEBRATE", now, 3);
        if (e.kind === "particles" && !this.reactions.has(e.dancerId))
          this.react(e.dancerId, "WAVE_HELLO", now, 1.8);
      }
    }
    this.seen = activeKeys;
    const active = [...w.spawn.dancers.values()].filter(
      (d) => !["EXITING", "DESPAWNED"].includes(d.state),
    );
    const priority = w.camera.targetId
      ? active.find((d) => d.id === w.camera.targetId)
      : undefined;
    const crowned = (d: Dancer) =>
      [...w.effects.active.values()].some(
        (e) => e.dancerId === d.id && e.kind === "crown",
      );
    const vip =
      priority && (priority.vipUntil > now || crowned(priority))
        ? priority
        : (active
            .filter((d) => d.vipUntil > now)
            .sort((a, b) => b.vipUntil - a.vipUntil)[0] ??
          active.find(crowned));
    this.vipId = vip?.id ?? null;
    this.top =
      !!vip &&
      [...w.effects.active.values()].some(
        (e) => e.dancerId === vip.id && e.kind === "crown",
      );
    const featured =
      priority && priority.featuredUntil > now
        ? priority
        : active.find((d) => d.featuredUntil > now);
    this.lights.update(
      vip
        ? this.top
          ? "HYPE"
          : "VIP"
        : featured
          ? "FEATURED"
          : active.length
            ? "GROOVE"
            : "AMBIENT",
      dt,
      now,
      this.bpm,
    );
    const subject = vip ?? featured;
    const gift = subject
      ? [...w.effects.active.values()].find(
          (e) => e.dancerId === subject.id && e.kind === "text",
        )?.label
      : undefined;
    this.ledTitle = subject ? subject.username : this.config.sceneName;
    this.ledSubtitle = vip
      ? this.top
        ? "TOP CONTRIBUTOR"
        : "VIP MOMENT"
      : featured
        ? (gift ?? "IN THE SPOTLIGHT")
        : this.nowPlaying
          ? `NOW PLAYING · ${this.nowPlaying}`
          : this.config.subtitle;
    if (["VIP", "FEATURED"].includes(w.camera.mode) || !w.config.cameraAuto) {
      this.shot = w.camera.mode;
      this.shotUntil = 0;
      return;
    }
    if (now < this.shotUntil) return;
    this.entranceId = null;
    const entering = active.find((d) => d.state === "ENTERING");
    if (this.config.entrance && entering && Math.floor(now / 12) % 3 === 1) {
      this.shot = "ENTRANCE";
      this.entranceId = entering.id;
      this.shotUntil = now + 4.5;
    } else if (
      this.config.group &&
      active.length >= 3 &&
      w.camera.mode === "MEDIUM"
    ) {
      this.shot = "GROUP";
      this.shotUntil = now + 5;
    } else this.shot = w.camera.mode;
  }
  get entranceTarget() {
    return this.entranceId;
  }
  followEntrance(id: string, now: number) {
    this.entranceId = id;
    this.shot = "ENTRANCE";
    this.shotUntil = now + 1.5;
  }
  react(id: string, kind: Reaction, start: number, duration: number) {
    this.reactions.set(id, { kind, start, end: start + duration });
  }
  cancel() {
    this.reactions.clear();
    this.states.clear();
    this.seen.clear();
    this.vipId = null;
    this.top = false;
    this.shot = "WIDE";
    this.shotUntil = 0;
    this.entranceId = null;
  }
  inspect() {
    return {
      lighting: this.lights.state,
      intensity: this.lights.intensity,
      vipId: this.vipId,
      top: this.top,
      led: [this.ledTitle, this.ledSubtitle],
      shot: this.shot,
      reactions: [...this.reactions].map(([id, r]) => ({ id, ...r })),
      config: this.config,
    };
  }
}
