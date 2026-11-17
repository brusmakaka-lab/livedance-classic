import { hash, type LiveEvent, type World, type Quality } from "./domain";
import type { EntertainmentDirector } from "./entertainment";
import type { PresentationDirector } from "./presentation";

export type MomentKind =
  | "JOIN"
  | "FOLLOW"
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "VIP"
  | "TOP"
  | "GOAL"
  | "FEVER"
  | "LIKE"
  | "COMMENT";
export const priorities: Record<MomentKind, number> = {
  COMMENT: 0,
  LIKE: 1,
  JOIN: 2,
  LOW: 3,
  NORMAL: 4,
  FOLLOW: 5,
  HIGH: 6,
  FEVER: 5,
  GOAL: 8,
  TOP: 9,
  VIP: 10,
};
export const safeRegions = {
  top: [0.08, 0.23],
  gameplay: [0.24, 0.7],
  lower: [0.72, 0.82],
  hud: [0.84, 0.94],
  subject: [0.15, 0.3, 0.85, 0.68],
};
export const cinemaDefaults = {
  version: 1,
  upper: true,
  slides: true,
  hype: true,
  top: true,
  music: true,
  goals: true,
  featured: true,
  branding: true,
  cues: true,
  preset: "BALANCED" as "MINIMAL" | "BALANCED" | "FULL",
};
export function cinemaConfig(input: Partial<typeof cinemaDefaults> = {}) {
  const c = { ...cinemaDefaults };
  for (const k of [
    "upper",
    "slides",
    "hype",
    "top",
    "music",
    "goals",
    "featured",
    "branding",
    "cues",
  ] as const)
    if (typeof input[k] === "boolean") c[k] = input[k]!;
  if (["MINIMAL", "BALANCED", "FULL"].includes(input.preset ?? ""))
    c.preset = input.preset!;
  return c;
}
export type Moment = {
  key: string;
  kind: MomentKind;
  viewer: string;
  name: string;
  detail: string;
  count: number;
  start: number;
  received: number;
  duration: number;
  premium?: boolean;
};
export class UpperBannerQueue {
  active: Moment | null = null;
  queue: Moment[] = [];
  dropped = 0;
  push(m: Moment, now: number) {
    // Same viewer/gift updates one streak; duration is bounded from first arrival.
    if (
      this.active?.key === m.key &&
      priorities[m.kind] >= priorities[this.active.kind]
    ) {
      this.active = {
        ...m,
        start: this.active.start,
        duration: Math.min(6, now - this.active.start + 2),
      };
      return;
    }
    if (m.kind === "FOLLOW") {
      const a = [this.active, ...this.queue].find(
        (x) => x?.kind === "FOLLOW" && now - x.received < 2,
      );
      if (a && a.viewer !== m.viewer) {
        a.count++;
        a.name = `${a.count} nuevos seguidores`;
        a.detail = "La fiesta sigue creciendo";
        a.viewer = "";
        return;
      }
    }
    if (!this.active || priorities[m.kind] > priorities[this.active.kind]) {
      this.active = { ...m, start: now };
      this.queue = this.queue.filter((x) => x.key !== m.key);
      return;
    }
    const i = this.queue.findIndex((x) => x.key === m.key);
    if (i >= 0) this.queue[i] = m;
    else this.queue.push(m);
    this.queue.sort(
      (a, b) =>
        priorities[b.kind] - priorities[a.kind] || b.received - a.received,
    );
    if (this.queue.length > 4) {
      this.dropped += this.queue.length - 4;
      this.queue.length = 4;
    }
  }
  update(now: number) {
    this.queue = this.queue.filter((m) => now - m.received <= 6);
    if (this.active && now >= this.active.start + this.active.duration)
      this.active = null;
    if (!this.active && this.queue.length)
      this.active = { ...this.queue.shift()!, start: now };
  }
  reset() {
    this.active = null;
    this.queue = [];
  }
}
export type GroupMode = "DUO" | "TRIO" | "GROUP" | "ALL";
export const groupBudget = { LOW: 10, MEDIUM: 30, HIGH: 60 };
export class GroupChoreographyDirector {
  members = new Set<string>();
  start = 0;
  end = 0;
  dance: "ClapGroove" | "Electro" | "Hype" = "ClapGroove";
  reason = "";
  trigger(
    w: World,
    mode: GroupMode,
    reason: string,
    duration = 5,
    quality: Quality = "MEDIUM",
  ) {
    const candidates = [...w.spawn.dancers.values()]
      .filter((d) => ["DANCING", "IDLE", "FEATURED", "VIP"].includes(d.state))
      .sort((a, b) => hash(a.id) - hash(b.id));
    const count = Math.min(
      groupBudget[quality],
      mode === "DUO" ? 2 : mode === "TRIO" ? 3 : mode === "GROUP" ? 8 : 60,
    );
    this.members = new Set(candidates.slice(0, count).map((d) => d.id));
    this.start = w.now;
    this.end = w.now + duration;
    this.reason = reason;
    this.dance =
      reason === "FEVER" ? "Electro" : reason === "TOP" ? "Hype" : "ClapGroove";
  }
  update(w: World) {
    for (const id of this.members)
      if (
        !w.spawn.dancers.has(id) ||
        w.spawn.dancers.get(id)!.state === "EXITING"
      )
        this.members.delete(id);
    if (w.now >= this.end) this.reset();
  }
  reset() {
    this.members.clear();
    this.end = 0;
    this.reason = "";
  }
}
export class CinematicPresentation {
  banners = new UpperBannerQueue();
  pending = new Map<string,Moment>();
  group = new GroupChoreographyDirector();
  config = cinemaConfig();
  subject: string | null = null;
  hud = 1;
  cue: (kind: string) => void = () => {};
  private unsubscribe: () => void;
  private top = "";
  private goals = new Set<string>();
  private fever = false;
  private activeKey = "";
  private known = new Set<string>();
  crowd = new Map<
    string,
    { end: number; target: string; kind: "CHEER" | "APPLAUSE" | "JUMP" }
  >();
  constructor(
    private w: World,
    private p: PresentationDirector,
    private e: EntertainmentDirector,
  ) {
    this.unsubscribe = w.bus.subscribe((x) => this.receive(x));
  }
  get legacy() {
    return this.e.config;
  }
  show(
    kind: MomentKind,
    viewer = "",
    name = "",
    detail = "",
    count = 1,
    suffix = "",
  ) {
    const now = this.w.now;
    const moment:Moment = {
        key: `${kind}:${viewer}:${kind === "GOAL" ? detail : suffix}`,
        kind,
        viewer,
        name,
        detail,
        count,
        start: now,
        received: now,
        duration: kind === "LOW" ? 2.3 : kind === "JOIN" ? 3 : 4.5,
        premium: ["HIGH", "VIP"].includes(kind),
      };
    if(viewer&&!this.w.spawn.dancers.has(viewer)) {
      const old=this.pending.get(viewer);
      if(!old||priorities[kind]>=priorities[old.kind])this.pending.set(viewer,moment);
      if(this.pending.size>8)this.pending.delete(this.pending.keys().next().value!);
    } else this.banners.push(moment,now);
  }
  receive(e: LiveEvent) {
    const exists =
      this.known.has(e.viewerId) || this.w.spawn.dancers.has(e.viewerId);
    this.known.add(e.viewerId);
    if (this.known.size > 1000)
      this.known.delete(this.known.values().next().value!);
    if (e.metadata.top && e.eventType !== "GIFT")
      this.show("TOP", e.viewerId, e.username, "Top contributor · celebración");
    else if (e.eventType === "FOLLOW")
      this.show(
        "FOLLOW",
        e.viewerId,
        e.username,
        exists ? "Volvió a encender la fiesta" : "Se unió a la fiesta",
      );
    else if (e.eventType === "GIFT") {
      const kind = e.metadata.top
        ? "VIP"
        : e.metadata.tier === "HIGH"
          ? "VIP"
          : e.metadata.tier === "NORMAL"
            ? e.giftCount >= 10
              ? "HIGH"
              : "NORMAL"
            : e.giftCount>=25 ? "HIGH" : e.giftCount>=10 ? "NORMAL" : "LOW";
      this.show(
        kind,
        e.viewerId,
        e.username,
        `${e.giftName ?? "Gift"} ×${e.giftCount}`,
        e.giftCount,
        e.giftId ?? e.giftName ?? "gift",
      );
      if (e.giftCount >= 25)
        this.group.trigger(
          this.w,
          "GROUP",
          "STREAK",
          5,
          this.w.quality.current,
        );
    } else if (!exists && e.eventType !== "LIKE_MILESTONE")
      this.show("JOIN", e.viewerId, e.username, "Tu lugar en la pista");
    // Existing comments and individual activity never interrupt the camera.
  }
  celebrate(kind: MomentKind, viewer = "") {
    if (["TOP", "GOAL", "VIP"].includes(kind)) {
      const active = [...this.w.spawn.dancers.values()].filter(
        (d) => d.id !== viewer && d.state === "DANCING",
      );
      const cap = this.w.quality.current === "LOW" ? 3 : 8;
      for (const [i, d] of active.slice(0, cap).entries())
        this.crowd.set(d.id, {
          end: this.w.now + 2.4,
          target: viewer,
          kind: i % 3 === 0 ? "JUMP" : i % 3 === 1 ? "APPLAUSE" : "CHEER",
        });
    }
  }
  update(dt: number) {
    const w = this.w,
      now = w.now;
    for(const[id,m]of this.pending){
      if(w.spawn.dancers.has(id)){this.pending.delete(id);this.banners.push({...m,received:now,start:now},now);}
      else if(now-m.received>12)this.pending.delete(id);
    }
    const top = this.e.supporters.top[0];
    if (top?.id !== this.top && top) {
      const had = !!this.top;
      this.top = top.id;
      if (had) {
        this.show("TOP", top.id, top.name, "El nuevo #1 de la fiesta");
        this.group.trigger(w, "TRIO", "TOP", 4, w.quality.current);
      }
    }
    for (const goal of this.e.reached)
      if (!this.goals.has(goal)) {
        this.goals.add(goal);
        this.show(
          "GOAL",
          "",
          "Juntos lo hicimos",
          `${goal.toUpperCase()} · objetivo completado`,
        );
        this.group.trigger(w, "ALL", "GOAL", 5, w.quality.current);
      }
    const fever = this.e.hype.getState(now) === "FEVER";
    if (fever && !this.fever) {
      this.show(
        "FEVER",
        "",
        "La pista es de todos",
        "Una coreografía. Toda la fiesta.",
      );
      this.group.trigger(
        w,
        "ALL",
        "FEVER",
        Math.min(12, this.e.hype.feverUntil - now),
        w.quality.current,
      );
    }
    this.fever = fever;
    this.group.update(w);
    this.banners.update(now);
    const m = this.banners.active,
      key = m ? m.key + ":" + m.start : "";
    if (key !== this.activeKey) {
      this.activeKey = key;
      if (m) {
        this.celebrate(m.kind, m.viewer);
        if (this.config.cues)
          this.cue(
            ["LOW", "NORMAL"].includes(m.kind) ? "gift" : m.kind.toLowerCase(),
          );
        this.e.log(
          "Presentation",
          `${m.kind}: ${m.name}; bounded presentation`,
        );
      }
    }
    this.subject = m?.viewer && w.spawn.dancers.has(m.viewer) ? m.viewer : null;
    this.hud += ((m ? 0 : 1) - this.hud) * (1 - Math.exp(-dt * 5));
    for (const [id, r] of this.crowd) {
      if (now >= r.end || !w.spawn.dancers.has(id)) this.crowd.delete(id);
      else if (!this.e.gifts.moments.has(id))
        this.p.reactions.set(id, {
          kind: r.kind,
          start: r.end - 2.4,
          end: r.end,
        });
    }
    if (m) {
      if(['GOAL','TOP','FEVER'].includes(m.kind))this.p.lights.update('HYPE',dt,now,this.p.bpm);
      else if(m.kind==='FOLLOW')this.p.lights.update('FEATURED',dt,now,this.p.bpm);
      // Identity belongs to lower caption + attached label; LED carries context only.
      this.p.ledTitle =
        m.kind === "FEVER"
          ? "AFTERGLOW"
          : m.kind === "GOAL"
            ? "TOGETHER"
            : m.kind === "VIP"
              ? "GOLDEN HOUR"
              : "MOVE TOGETHER";
      this.p.ledSubtitle =
        m.kind === "FEVER"
          ? `${Math.ceil(this.e.hype.feverUntil - now)}s`
          : "AFTERGLOW SESSIONS";
      if (this.subject) {
        const d = w.spawn.dancers.get(this.subject)!;
        if (m.kind === "FOLLOW" && !["ENTERING", "SPAWNING"].includes(d.state))
          this.p.react(d.id, "WAVE_HELLO", m.start, m.duration);
        if (w.config.cameraAuto)
          this.p.shot =
            m.kind === "VIP"
              ? "VIP"
              : ["ENTERING", "SPAWNING"].includes(d.state)
                ? "ENTRANCE"
                : m.kind === "TOP"
                  ? "TOP"
                  : "FEATURED";
      } else if (w.config.cameraAuto && ["GOAL", "FEVER"].includes(m.kind))
        this.p.shot = "GROUP";
    } else if (this.group.members.size && w.config.cameraAuto && !this.p.vipId)
      this.p.shot = "GROUP";
  }
  reset() {
    this.banners.reset();
    this.pending.clear();
    this.group.reset();
    this.crowd.clear();
    this.known.clear();
    this.subject = null;
    this.hud = 1;
    this.top = "";
    this.goals.clear();
    this.fever = false;
    this.activeKey = "";
  }
  dispose() {
    this.unsubscribe();
    this.reset();
  }
  inspect() {
    return {
      now:this.w.now,
      pending:this.pending.size,
      active: this.banners.active,
      queue: this.banners.queue,
      dropped: this.banners.dropped,
      subject: this.subject,
      hud: this.hud,
      group: {
        members: [...this.group.members],
        start: this.group.start,
        end: this.group.end,
        dance: this.group.dance,
        reason: this.group.reason,
      },
      crowd: this.crowd.size,
      config: this.config,
    };
  }
}
