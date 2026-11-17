import { safeProfilePhoto } from './integration/profile-photo';
export type EventType =
  | "COMMENT"
  | "FOLLOW"
  | "GIFT"
  | "LIKE_MILESTONE"
  | "VIEWER_JOIN"
  | "SIMULATED";
export type Tier = "LOW" | "NORMAL" | "HIGH";
export type DancerState =
  | "SPAWNING"
  | "ENTERING"
  | "IDLE"
  | "DANCING"
  | "FEATURED"
  | "EXITING"
  | "DESPAWNED";
export type Quality = "LOW" | "MEDIUM" | "HIGH";
export type CameraMode = "WIDE" | "MEDIUM" | "FEATURED" | "VIP" | "ORBIT";
export type Dance = "Groove" | "Disco" | "Shuffle" | "Wave";
export type Vec = { x: number; y: number; z: number };
export interface LiveEvent {
  schemaVersion: 1;
  eventId: string;
  source: "simulator" | "tiktok";
  sessionId?: string;
  viewerId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  eventType: EventType;
  giftName?: string;
  giftId?: string;
  giftCount: number;
  coins?: number;
  timestamp: number;
  metadata: { tier?: Tier; top?: boolean; [key: string]: unknown };
}
export const cleanText = (s: unknown, limit = 24) =>
  typeof s === "string"
    ? s
        .replace(/[<>\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, limit)
    : "";
export function normalizeEvent(raw: unknown): LiveEvent {
  if (!raw || typeof raw !== "object") throw Error("Evento inválido");
  const e = raw as Record<string, unknown>;
  if (e.schemaVersion !== 1 || !["simulator", "tiktok"].includes(String(e.source)))
    throw Error("Origen o versión de evento inválidos");
  if (
    ![
      "COMMENT",
      "FOLLOW",
      "GIFT",
      "LIKE_MILESTONE",
      "VIEWER_JOIN",
      "SIMULATED",
    ].includes(String(e.eventType))
  )
    throw Error("Tipo de evento inválido");
  const viewerId = cleanText(e.viewerId, 64),
    eventId = cleanText(e.eventId, 100),
    username = cleanText(e.username);
  if (!viewerId || !eventId || !username)
    throw Error("Falta eventId, viewerId o username");
  const giftCount = e.giftCount === undefined ? 1 : Number(e.giftCount);
  if (!Number.isInteger(giftCount) || giftCount < 1 || giftCount > 1000)
    throw Error("Cantidad fuera de rango 1–1000");
  if (
    typeof e.timestamp !== "number" ||
    !Number.isFinite(e.timestamp) ||
    e.timestamp < 0
  )
    throw Error("Timestamp inválido");
  const metadata =
    e.metadata && typeof e.metadata === "object"
      ? (e.metadata as Record<string, unknown>)
      : {};
  if (
    metadata.tier !== undefined &&
    !["LOW", "NORMAL", "HIGH"].includes(String(metadata.tier))
  )
    throw Error("Tier inválido");
  if (
    e.coins !== undefined &&
    (!Number.isFinite(e.coins) || Number(e.coins) < 0)
  )
    throw Error("Coins inválidos");
  return {
    schemaVersion: 1,
    eventId,
    source: e.source as LiveEvent["source"],
    sessionId: cleanText(e.sessionId, 64) || undefined,
    viewerId,
    username,
    displayName: cleanText(e.displayName),
    avatarUrl: safeProfilePhoto(e.avatarUrl),
    eventType: e.eventType as EventType,
    giftName: cleanText(e.giftName, 40),
    giftId: cleanText(e.giftId, 64),
    giftCount,
    coins: e.coins as number | undefined,
    timestamp: e.timestamp,
    metadata: {
      unitCoins: e.source === "tiktok" && Number.isSafeInteger(metadata.unitCoins) && Number(metadata.unitCoins) >= 0 && Number(metadata.unitCoins) <= 1000000 ? Number(metadata.unitCoins) : undefined,
      likeCount: e.source === "tiktok" && Number.isSafeInteger(metadata.likeCount) && Number(metadata.likeCount) > 0 && Number(metadata.likeCount) <= 100000 ? Number(metadata.likeCount) : undefined,
      tier: metadata.tier as Tier | undefined,
      top: metadata.top === true,
      ruleId: cleanText(metadata.ruleId, 64) || undefined,
      ruleVersion: metadata.ruleVersion === 1 ? 1 : undefined,
      reaction: cleanText(metadata.reaction, 32) || undefined,
      cue: cleanText(metadata.cue, 32) || undefined,
      focus: cleanText(metadata.focus, 32) || undefined,
    },
  };
}
export class EventBus {
  private listeners = new Set<(e: LiveEvent) => void>();
  private seen = new Set<string>();
  history: LiveEvent[] = [];
  errors: string[] = [];
  received = 0;
  subscribe(fn: (e: LiveEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(raw: unknown) {
    try {
      const e = normalizeEvent(raw);
      const key = `${e.source}:${e.sessionId ?? "simulator"}:${e.eventId}`;
      if (this.seen.has(key)) return false;
      this.seen.add(key);
      if (this.seen.size > 2048)
        this.seen.delete(this.seen.values().next().value!);
      this.history.unshift(e);
      this.history.length = Math.min(100, this.history.length);
      this.received++;
      for (const fn of this.listeners) {
        try {
          fn(e);
        } catch (err) {
          this.error(err);
        }
      }
      return true;
    } catch (err) {
      this.error(err);
      return false;
    }
  }
  error(err: unknown) {
    this.errors.unshift(`${new Date().toISOString()} ${String(err)}`);
    this.errors.length = Math.min(50, this.errors.length);
  }
}
export interface Config {
  version: 1;
  quality: Quality;
  adaptive: boolean;
  maxDancers: number;
  inactivity: number;
  replacement: "oldest" | "reject";
  afk: boolean;
  cameraAuto: boolean;
  cameraFrequency: number;
  cameraDuration: number;
  cameraIntensity: number;
  master: number;
  music: number;
  effects: number;
  mute: boolean;
  names: boolean;
  safeAreas: boolean;
  scene: "Afterglow";
  accent: string;
}
export const defaults: Config = {
  version: 1,
  quality: "MEDIUM",
  adaptive: true,
  maxDancers: 30,
  inactivity: 120,
  replacement: "oldest",
  afk: true,
  cameraAuto: true,
  cameraFrequency: 14,
  cameraDuration: 7,
  cameraIntensity: 0.65,
  master: 0.55,
  music: 0.3,
  effects: 0.5,
  mute: true,
  names: true,
  safeAreas: false,
  scene: "Afterglow",
  accent: "#b9ff66",
};
export function validateConfig(value: unknown): Config {
  const v =
    value && typeof value === "object" ? (value as Partial<Config>) : {};
  const c = { ...defaults };
  for (const k of [
    "adaptive",
    "afk",
    "cameraAuto",
    "mute",
    "names",
    "safeAreas",
  ] as const)
    if (typeof v[k] === "boolean") c[k] = v[k];
  const ranges = {
    maxDancers: [1, 60],
    inactivity: [10, 3600],
    cameraFrequency: [5, 90],
    cameraDuration: [2, 20],
    cameraIntensity: [0, 1],
    master: [0, 1],
    music: [0, 1],
    effects: [0, 1],
  };
  for (const k of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const n = v[k];
    if (typeof n === "number" && Number.isFinite(n))
      c[k] = Math.max(ranges[k][0], Math.min(ranges[k][1], n));
  }
  c.maxDancers = Math.round(c.maxDancers);
  if (["LOW", "MEDIUM", "HIGH"].includes(v.quality ?? ""))
    c.quality = v.quality!;
  if (v.replacement === "reject") c.replacement = "reject";
  if (typeof v.accent === "string" && /^#[0-9a-f]{6}$/i.test(v.accent))
    c.accent = v.accent;
  return c;
}
export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
export class ConfigStore {
  static key = "livedance.config.v1";
  warning = "";
  constructor(private storage: StorageLike) {}
  load() {
    try {
      const raw = this.storage.getItem(ConfigStore.key);
      if (!raw) return { ...defaults };
      const v = JSON.parse(raw);
      if (v.version !== 1) throw Error("Versión desconocida");
      return validateConfig(v);
    } catch {
      this.warning = "Configuración inválida: se usaron valores iniciales.";
      return { ...defaults };
    }
  }
  save(c: Config) {
    try {
      this.storage.setItem(ConfigStore.key, JSON.stringify(validateConfig(c)));
      this.warning = "";
      return true;
    } catch {
      this.warning = "No se pudo guardar: almacenamiento no disponible.";
      return false;
    }
  }
}
export const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
export interface Slot {
  id: number;
  position: Vec;
  vip: boolean;
}
export class SlotAllocator {
  slots: Slot[] = [];
  private owners = new Map<number, string>();
  constructor() {
    // Rings grow automatically: center reserved for two featured places.
    let id = 0;
    for (let r = 0; r < 5; r++) {
      const radius = 2.6 + r * 1.7,
        count = 8 + r * 5;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        this.slots.push({
          id: id++,
          position: { x: Math.sin(a) * radius, y: 0, z: Math.cos(a) * radius },
          vip: false,
        });
      }
    }
    this.slots.push(
      { id: 1000, position: { x: -0.95, y: 0, z: 0.2 }, vip: true },
      { id: 1001, position: { x: 0.95, y: 0, z: 0.2 }, vip: true },
    );
  }
  allocate(owner: string, vip = false) {
    const s = this.slots.find((s) => s.vip === vip && !this.owners.has(s.id));
    if (s) this.owners.set(s.id, owner);
    return s;
  }
  release(owner: string) {
    for (const [id, o] of this.owners) if (o === owner) this.owners.delete(id);
  }
  get occupied() {
    return this.owners.size;
  }
}
export interface Dancer {
  id: string;
  viewerId: string;
  username: string;
  displayName?: string;
  modelRef: string;
  state: DancerState;
  position: Vec;
  targetPosition: Vec;
  slot: Slot;
  homeSlot: Slot;
  animationState: Dance | "Idle" | "Walk";
  effectState: string[];
  contributionScore: number;
  createdAt: number;
  lastActiveAt: number;
  stateSince: number;
  vipUntil: number;
  featuredUntil: number;
  phase: number;
  speed: number;
  heading: number;
}
export const transitions: Record<DancerState, DancerState[]> = {
  SPAWNING: ["ENTERING", "EXITING"],
  ENTERING: ["IDLE", "FEATURED", "EXITING"],
  IDLE: ["DANCING", "FEATURED", "EXITING"],
  DANCING: ["FEATURED", "EXITING"],
  FEATURED: ["DANCING", "EXITING"],
  EXITING: ["DESPAWNED"],
  DESPAWNED: [],
};
export function transition(d: Dancer, s: DancerState, now: number) {
  if (!transitions[d.state].includes(s)) return false;
  d.state = s;
  d.stateSince = now;
  return true;
}
export type EffectKind =
  "aura" | "particles" | "spotlight" | "crown" | "scale" | "text";
export interface Effect {
  id: string;
  dancerId: string;
  kind: EffectKind;
  start: number;
  end: number;
  priority: number;
  label?: string;
}
export class EffectManager {
  active = new Map<string, Effect>();
  add(
    dancerId: string,
    kind: EffectKind,
    now: number,
    duration: number,
    priority = 1,
    label?: string,
  ) {
    const id = `${dancerId}:${kind}`,
      old = this.active.get(id);
    if (old && old.end > now && old.priority > priority) return;
    this.active.set(id, {
      id,
      dancerId,
      kind,
      start: now,
      end: now + Math.min(30, Math.max(0.2, duration)),
      priority,
      label,
    });
  }
  forDancer(id: string) {
    return [...this.active.values()].filter((e) => e.dancerId === id);
  }
  has(id: string, kind: EffectKind) {
    return this.active.has(`${id}:${kind}`);
  }
  removeDancer(id: string) {
    for (const [k, e] of this.active)
      if (e.dancerId === id) this.active.delete(k);
  }
  update(now: number, ids: Set<string>) {
    for (const [k, e] of this.active)
      if (e.end <= now || !ids.has(e.dancerId)) this.active.delete(k);
  }
}
export class SpawnManager {
  retainParticipants = false;
  dancers = new Map<string, Dancer>();
  slots = new SlotAllocator();
  queue: LiveEvent[] = [];
  dropped = 0;
  spawned = 0;
  exited = 0;
  nextSpawn = 0;
  onSpawn?: (d: Dancer) => void;
  onDespawn?: (d: Dancer) => void;
  constructor(
    public config: Config,
    private applyEvent: (d: Dancer, e: LiveEvent, now: number) => void,
  ) {}
  ingest(e: LiveEvent, now: number) {
    const d = this.dancers.get(e.viewerId);
    if (d && d.state !== "EXITING") {
      d.lastActiveAt = now;
      d.username = e.username;
      this.applyEvent(d, e, now);
      return;
    }
    if(this.retainParticipants){this.spawn(e,now);return;}
    if (this.queue.length >= 240) {
      this.dropped++;
      return;
    }
    this.queue.push(e);
  }
  private spawn(e: LiveEvent, now: number) {
    const slot = this.retainParticipants
      ? {id: this.spawned, position:{x:0,y:0,z:0},vip:false}
      : this.slots.allocate(e.viewerId);
    if (!slot) {
      this.dropped++;
      return;
    }
    const seed = hash(e.viewerId);
    const d: Dancer = {
      id: e.viewerId,
      viewerId: e.viewerId,
      username: e.username,
      displayName: e.displayName,
      modelRef: "procedural:afterglow-v1",
      state: "SPAWNING",
      position: { x: -8.6, y: 0, z: 6 },
      targetPosition: { ...slot.position },
      slot,
      homeSlot: slot,
      animationState: "Idle",
      effectState: [],
      contributionScore: 0,
      createdAt: now,
      lastActiveAt: now,
      stateSince: now,
      vipUntil: 0,
      featuredUntil: 0,
      phase: (seed % 100) / 15,
      speed: 0.9 + (seed % 21) / 100,
      heading: 0,
    };
    this.dancers.set(d.viewerId, d);
    this.spawned++;
    this.onSpawn?.(d);
    this.applyEvent(d, e, now);
  }
  exit(d: Dancer, now: number) {
    if (this.retainParticipants || d.vipUntil > now || d.state === "EXITING") return false;
    transition(d, "EXITING", now);
    d.targetPosition = { x: 9, y: 0, z: 6 };
    return true;
  }
  feature(d: Dancer, now: number, vip: boolean, duration: number) {
    d.featuredUntil = Math.max(d.featuredUntil, now + duration);
    if (vip) {
      d.vipUntil = now + duration;
      if (!this.retainParticipants && !d.slot.vip) {
        const slot = this.slots.allocate(d.id, true);
        if (slot) {
          d.slot = slot;
          d.targetPosition = { ...slot.position };
        }
      }
    }
    if (d.state === "DANCING" || d.state === "IDLE")
      transition(d, "FEATURED", now);
  }
  update(now: number, dt: number) {
    if(this.retainParticipants){
      for(const d of this.dancers.values()){
        d.state=d.featuredUntil>now?"FEATURED":"DANCING";
        d.animationState="Groove";
      }
      return;
    }
    for (const [id, d] of this.dancers) {
      if (d.state === "SPAWNING" && now - d.stateSince >= 0.15)
        transition(d, "ENTERING", now);
      if (d.state === "IDLE" && now - d.stateSince > 0.35)
        transition(d, d.featuredUntil > now ? "FEATURED" : "DANCING", now);
      if (d.state === "FEATURED" && now >= d.featuredUntil)
        transition(d, "DANCING", now);
      if (d.slot.vip && now >= d.vipUntil) {
        // Release the temporary VIP reservation and allocate a regular place.
        this.slots.release(d.id);
        const home = this.slots.allocate(d.id);
        d.slot = d.homeSlot = home ?? d.homeSlot;
        d.targetPosition = { ...d.slot.position };
      }
      if (now - d.lastActiveAt > this.config.inactivity && this.config.afk)
        this.exit(d, now);
      const dx = d.targetPosition.x - d.position.x,
        dz = d.targetPosition.z - d.position.z,
        dist = Math.hypot(dx, dz);
      if (dist > 0.06) {
        let vx = dx / dist,
          vz = dz / dist;
        // Mild separation during entry/exit, including occupied dance positions.
        for (const o of this.dancers.values()) {
          if (o === d || o.state === "SPAWNING") continue;
          const ox = d.position.x - o.position.x,
            oz = d.position.z - o.position.z,
            od = Math.hypot(ox, oz);
          if (od > 0.01 && od < 0.95) {
            vx += (ox / od) * (0.95 - od) * 2.6;
            vz += (oz / od) * (0.95 - od) * 2.6;
          }
        }
        const vl = Math.hypot(vx, vz) || 1,
          step = Math.min(dist, 2.8 * dt);
        d.position.x += (vx / vl) * step;
        d.position.z += (vz / vl) * step;
        d.heading = Math.atan2(vx, vz);
        d.animationState = "Walk";
      } else {
        d.position = { ...d.targetPosition };
        d.heading = 0;
        if (d.state === "ENTERING") transition(d, "IDLE", now);
        if (d.state === "EXITING") {
          transition(d, "DESPAWNED", now);
          this.slots.release(d.id);
          this.dancers.delete(id);
          this.exited++;
          this.onDespawn?.(d);
          continue;
        }
        d.animationState =
          d.state === "IDLE" || d.state === "SPAWNING"
            ? "Idle"
            : (["Groove", "Disco", "Shuffle", "Wave"] as Dance[])[
                hash(d.id) % 4
              ];
      }
      // Guarantee recovery if avoidance cannot reach a target; exiting still has an animated fade.
      if (d.state === "EXITING" && now - d.stateSince > 12) {
        transition(d, "DESPAWNED", now);
        this.slots.release(d.id);
        this.dancers.delete(id);
        this.exited++;
        this.onDespawn?.(d);
      }
    }
    if (this.dancers.size > this.config.maxDancers) {
      const victim = this.candidate(now);
      if (victim) this.exit(victim, now);
    }
    if (!this.queue.length || now < this.nextSpawn) return;
    const e = this.queue[0],
      existing = this.dancers.get(e.viewerId);
    if (existing) {
      if (existing.state === "EXITING") return;
      this.queue.shift();
      existing.lastActiveAt = now;
      this.applyEvent(existing, e, now);
      return;
    }
    if (this.dancers.size >= this.config.maxDancers) {
      if (this.config.replacement === "reject") {
        this.queue.shift();
        this.dropped++;
        return;
      }
      const victim = this.candidate(now);
      if (victim) this.exit(victim, now);
      return;
    }
    this.queue.shift();
    this.spawn(e, now);
    this.nextSpawn = now + 0.42;
  }
  private candidate(now: number) {
    if ([...this.dancers.values()].some((d) => d.state === "EXITING"))
      return undefined;
    return [...this.dancers.values()]
      .filter((d) => d.vipUntil <= now && d.state !== "EXITING")
      .sort((a, b) => a.lastActiveAt - b.lastActiveAt)[0];
  }
}
export class CameraDirector {
  mode: CameraMode = "WIDE";
  targetId?: string;
  priority = 0;
  until = 0;
  nextCut = 14;
  sequence = 0;
  request(mode: "VIP" | "FEATURED", id: string, now: number, duration: number) {
    const p = mode === "VIP" ? 3 : 2;
    if (now < this.until && p < this.priority) return false;
    this.mode = mode;
    this.targetId = id;
    this.priority = p;
    this.until = now + duration;
    return true;
  }
  wide(now: number, c: Config) {
    this.mode = "WIDE";
    this.priority = 0;
    this.targetId = undefined;
    this.until = 0;
    this.nextCut = now + c.cameraFrequency;
  }
  update(now: number, c: Config, ids: Set<string>) {
    if (!c.cameraAuto) {
      if (this.mode !== "WIDE") this.wide(now, c);
      return;
    }
    if (this.targetId && !ids.has(this.targetId)) {
      this.wide(now, c);
      return;
    }
    if (this.mode !== "WIDE" && now >= this.until) {
      this.wide(now, c);
      return;
    }
    if (c.afk && this.mode === "WIDE" && now >= this.nextCut) {
      this.mode = this.sequence++ % 2 ? "MEDIUM" : "ORBIT";
      this.until = now + c.cameraDuration;
      this.priority = 0;
    }
  }
}
export class QualityController {
  current: Quality;
  lowFor = 0;
  highFor = 0;
  cooldown = 0;
  reason = "Calidad manual";
  constructor(q: Quality) {
    this.current = q;
  }
  update(fps: number, dt: number, enabled: boolean, ceiling: Quality) {
    const levels: Quality[] = ["LOW", "MEDIUM", "HIGH"];
    if (!enabled) {
      this.current = ceiling;
      this.lowFor = this.highFor = 0;
      this.reason = "Calidad manual";
      return this.current;
    }
    if (levels.indexOf(this.current) > levels.indexOf(ceiling))
      this.current = ceiling;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.lowFor = fps < 35 ? this.lowFor + dt : 0;
    this.highFor = fps > 55 ? this.highFor + dt : 0;
    if (!this.cooldown && this.lowFor >= 6) {
      this.current = levels[Math.max(0, levels.indexOf(this.current) - 1)];
      this.cooldown = 15;
      this.lowFor = 0;
      this.reason = "Adaptativa: FPS bajos sostenidos";
    }
    if (
      !this.cooldown &&
      this.highFor >= 30 &&
      levels.indexOf(this.current) < levels.indexOf(ceiling)
    ) {
      this.current = levels[levels.indexOf(this.current) + 1];
      this.cooldown = 30;
      this.highFor = 0;
      this.reason = "Adaptativa: recuperación estable";
    }
    return this.current;
  }
}
export class World {
  now = 0;
  bus = new EventBus();
  effects = new EffectManager();
  camera = new CameraDirector();
  spawn: SpawnManager;
  quality: QualityController;
  onSound?: (kind: string) => void;
  constructor(public config: Config) {
    this.spawn = new SpawnManager(config, (d, e, n) => this.react(d, e, n));
    this.quality = new QualityController(config.quality);
    this.bus.subscribe((e) => this.spawn.ingest(e, this.now));
    this.spawn.onDespawn = (d) => this.effects.removeDancer(d.id);
  }
  react(d: Dancer, e: LiveEvent, n: number) {
    d.contributionScore +=
      e.coins ?? (e.eventType === "GIFT" ? e.giftCount : 0);
    if (e.eventType === "FOLLOW") {
      this.effects.add(d.id, "particles", n, 4, 1);
      this.effects.add(d.id, "text", n, 3, 1, "¡Nuevo follow!");
      this.onSound?.(e.metadata.ruleId ? String(e.metadata.cue) : "follow");
    }
    if (e.eventType === "GIFT") {
      const t = e.metadata.tier ?? "LOW",
        duration = Math.min(20, 8 + Math.log2(e.giftCount) * 2);
      this.effects.add(d.id, "aura", n, duration, t === "HIGH" ? 3 : 1);
      this.effects.add(
        d.id,
        "text",
        n,
        4,
        2,
        `${e.giftName || "Regalo"} ×${e.giftCount}`,
      );
      const focus = e.metadata.ruleId
        ? e.metadata.focus === "VIP" ? "VIP" : e.metadata.focus === "FEATURED" ? "FEATURED" : "NONE"
        : t === "HIGH" ? "VIP" : t === "NORMAL" ? "FEATURED" : "NONE";
      if (focus !== "NONE") {
        this.effects.add(d.id, "spotlight", n, duration, t === "HIGH" ? 3 : 2);
        this.spawn.feature(d, n, t === "HIGH", duration);
        if (this.config.cameraAuto)
          this.camera.request(
            focus,
            d.id,
            n,
            this.config.cameraDuration,
          );
      }
      if (t === "HIGH") {
        this.effects.add(d.id, "scale", n, duration, 3);
        this.effects.add(d.id, "particles", n, 5, 3);
      }
      this.onSound?.(e.metadata.ruleId ? String(e.metadata.cue) : t === "HIGH" ? "vip" : "gift");
    }
    if (e.metadata.top) {
      this.effects.add(d.id, "crown", n, 18, 4);
      this.effects.add(d.id, "text", n, 4, 4, "TOP DANCER");
      if (this.config.cameraAuto)
        this.camera.request("VIP", d.id, n, this.config.cameraDuration);
    }
    if (e.eventType === "LIKE_MILESTONE") {
      this.effects.add(d.id, "particles", n, 4, 1);
      if (e.metadata.ruleId === "like") this.onSound?.("like");
    }
  }
  update(dt: number, elapsed = dt) {
    this.now += elapsed;
    this.spawn.update(this.now, dt);
    const ids = new Set([...this.spawn.dancers.keys()]);
    this.effects.update(this.now, ids);
    for (const d of this.spawn.dancers.values())
      d.effectState = this.effects.forDancer(d.id).map((e) => e.kind);
    this.camera.update(this.now, this.config, ids);
  }
}
