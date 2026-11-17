import { SlideDirector } from "./slides";
import { hash, type LiveEvent, type World } from "./domain";
import type { PresentationDirector, Reaction } from "./presentation";

export const effectBudgets = {
  LOW: { particles: 5, beams: 0, lights: 0, cosmetics: 2 },
  MEDIUM: { particles: 10, beams: 2, lights: 1, cosmetics: 3 },
  HIGH: { particles: 18, beams: 4, lights: 2, cosmetics: 3 },
};
export const entertainmentDefaults = {
  reduceMotion: false,
  slides: true,
  ambient: true,
  giftDuration: 4,
  hypeOverlay: true,
  topOverlay: true,
  goalsOverlay: false,
  vipOverlay: true,
  goalsEnabled: true,
  nameSize: 1,
  beatIntensity: 0.5,
  feverDuration: 25,
  cooldown: 45,
  decay: 0.7,
  grooveThreshold: 25,
  hypeThreshold: 50,
  hypePlusThreshold: 80,
  level1: 10,
  level2: 40,
  level3: 100,
  likeGoal: 20,
  followGoal: 10,
  giftGoal: 25,
  commentWeight: 1,
  followWeight: 4,
  likeWeight: 2,
  lowWeight: 3,
  normalWeight: 7,
  highWeight: 16,
};
export type EntertainmentConfig = typeof entertainmentDefaults;
export function validateEntertainment(
  input: Partial<EntertainmentConfig> = {},
) {
  const c = { ...entertainmentDefaults };
  for (const k of Object.keys(c) as (keyof EntertainmentConfig)[]) {
    const v = input[k];
    if (
      typeof v === typeof c[k] &&
      (typeof v !== "number" || Number.isFinite(v))
    )
      (c as any)[k] =
        typeof v === "number" ? Math.max(0, Math.min(10000, v)) : v;
  }
  c.feverDuration = Math.max(20, Math.min(30, c.feverDuration));
  c.cooldown = Math.max(10, c.cooldown);
  c.nameSize = Math.max(0.6, Math.min(1.5, c.nameSize));
  c.beatIntensity = Math.min(1, c.beatIntensity);
  c.giftDuration = Math.max(2, Math.min(8, c.giftDuration));
  for (const k of ["likeGoal", "followGoal", "giftGoal"] as const)
    c[k] = Math.max(1, c[k]);
  c.level2 = Math.max(c.level1, c.level2);
  c.level3 = Math.max(c.level2, c.level3);
  c.grooveThreshold = Math.max(1,Math.min(97,c.grooveThreshold));
  c.hypeThreshold = Math.max(c.grooveThreshold+1,Math.min(98,c.hypeThreshold));
  c.hypePlusThreshold = Math.max(c.hypeThreshold+1,Math.min(99,c.hypePlusThreshold));
  return c;
}
export class HypeMeter {
  value = 0;
  feverUntil = 0;
  cooldownUntil = 0;
  energy = 0;
  constructor(public config: EntertainmentConfig) {}
  getState(now: number) {
    return now < this.feverUntil
      ? "FEVER"
      : this.value >= this.config.hypePlusThreshold
        ? "HYPE+"
        : this.value >= this.config.hypeThreshold
          ? "HYPE"
          : this.value >= this.config.grooveThreshold
            ? "GROOVE"
            : "CALM";
  }
  add(amount: number, now: number) {
    if (now < this.feverUntil) return;
    this.value = Math.max(
      0,
      Math.min(now < this.cooldownUntil ? 99 : 100, this.value + amount),
    );
    if (this.value === 100) {
      this.feverUntil = now + this.config.feverDuration;
      this.cooldownUntil = this.feverUntil + this.config.cooldown;
    }
  }
  update(now: number, dt: number) {
    if (this.feverUntil && now >= this.feverUntil) {
      this.feverUntil = 0;
      this.value = 45;
    }
    if (!this.feverUntil)
      this.value = Math.max(0, this.value - this.config.decay * dt);
    const target = this.feverUntil ? 1 : this.value / 100;
    this.energy += (target - this.energy) * (1 - Math.exp(-dt * 0.8));
  }
  reset() {
    this.value = this.feverUntil = this.cooldownUntil = this.energy = 0;
  }
}
export type Supporter = { id: string; name: string; score: number };
export class TopSupporters {
  viewers = new Map<string, Supporter>();
  add(id: string, name: string, amount: number) {
    const viewer = this.viewers.get(id) ?? { id, name, score: 0 };
    viewer.name = name;
    viewer.score = Math.min(1e9, viewer.score + Math.max(0, amount));
    this.viewers.set(id, viewer);
    if (this.viewers.size > 1000) {
      const last = [...this.viewers.values()].sort(
        (a, b) => a.score - b.score,
      )[0];
      this.viewers.delete(last.id);
    }
  }
  get top() {
    return [...this.viewers.values()]
      .filter((v) => v.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, 3);
  }
  level(id: string, c: EntertainmentConfig) {
    const s = this.viewers.get(id)?.score ?? 0;
    return s >= c.level3 ? 3 : s >= c.level2 ? 2 : s >= c.level1 ? 1 : 0;
  }
}
export function multiplier(count: number) {
  return count >= 25 ? 4 : count >= 10 ? 3 : count >= 5 ? 2 : 1;
}
export class GiftDirector {
  moments = new Map<
    string,
    {
      kind: Reaction;
      start: number;
      end: number;
      strength: number;
      premium: boolean;
    }
  >();
  receive(e: LiveEvent, now: number) {
    if (e.eventType !== "GIFT") return;
    const strength = multiplier(e.giftCount),
      premium = e.metadata.tier === "HIGH";
    const previous = this.moments.get(e.viewerId);
    if (previous?.premium && previous.end > now && !premium) return;
    this.moments.set(e.viewerId, {
      kind: e.metadata.top
        ? "TOP_POSE"
        : premium
          ? "VIP_POSE"
          : e.metadata.tier === "NORMAL"
            ? "APPLAUSE"
            : "HEART",
      start: now,
      end: now + (premium ? 6 : 2.5),
      strength,
      premium,
    });
    if (this.moments.size > 60)
      this.moments.delete(this.moments.keys().next().value!);
  }
}
export class EntertainmentDirector {
  slides = new SlideDirector();
  diagnostics: { component: string; message: string; at: number }[] = [];
  private lastFever = false;
  private lastSong = "";
  log(component: string, message: string) {
    this.diagnostics.push({ component, message, at: this.world.now });
    if (this.diagnostics.length > 120) this.diagnostics.shift();
  }
  config: EntertainmentConfig;
  hype: HypeMeter;
  supporters = new TopSupporters();
  gifts = new GiftDirector();
  entrances = new Map<string, { premium: boolean; end: number }>();
  goals = { like: 0, follow: 0, gift: 0 };
  reached = new Set<string>();
  private unsubscribe: () => void;
  private previousTop = "";
  private topUntil = 0;
  private ambientAt = 0;
  constructor(
    private world: World,
    private p: PresentationDirector,
    config = { ...entertainmentDefaults },
  ) {
    this.config = config;
    this.hype = new HypeMeter(config);
    this.unsubscribe = world.bus.subscribe((e) => this.receive(e));
  }
  receive(e: LiveEvent) {
    const c = this.config,
      now = this.world.now;
    const weight =
      e.eventType === "GIFT"
        ? (e.metadata.tier === "HIGH"
            ? c.highWeight
            : e.metadata.tier === "NORMAL"
              ? c.normalWeight
              : c.lowWeight) * multiplier(e.giftCount)
        : e.eventType === "FOLLOW"
          ? c.followWeight
          : e.eventType === "COMMENT"
            ? c.commentWeight
            : e.eventType === "LIKE_MILESTONE"
              ? c.likeWeight
              : 0;
    this.hype.add(weight, now);
    this.supporters.add(e.viewerId, e.username, weight);
    this.gifts.receive(e, now);
    if (e.eventType === "GIFT" || e.eventType === "FOLLOW") {
      const priority = e.metadata.top
        ? 6
        : e.metadata.tier === "HIGH"
          ? 5
          : e.eventType === "FOLLOW"
            ? 2
            : e.metadata.tier === "NORMAL"
              ? Math.min(4, 2 + multiplier(e.giftCount))
              : multiplier(e.giftCount);
      this.slides.show(
        {
          key: "event:" + e.viewerId,
          title: e.username,
          subtitle:
            e.eventType === "FOLLOW"
              ? "WELCOME · FOLLOW"
              : `${e.metadata.top ? "TOP SUPPORTER" : e.metadata.tier === "HIGH" ? "VIP MOMENT" : (e.giftName ?? "GIFT")} · x${e.giftCount}`,
          priority,
          duration: this.config.giftDuration,
          strength: multiplier(e.giftCount),
        },
        now,
      );
      this.log(
        "GiftDirector",
        `${e.eventType} · ${e.viewerId} · x${e.giftCount}`,
      );
    }
    if (!this.world.spawn.dancers.has(e.viewerId) || e.eventType === "FOLLOW") {
      this.entrances.set(e.viewerId, {
        premium: e.eventType === "GIFT" || e.eventType === "FOLLOW",
        end: now + 12,
      });
      if (this.entrances.size > 60)
        this.entrances.delete(this.entrances.keys().next().value!);
    }
    if (e.eventType === "LIKE_MILESTONE") this.goal("like", Number(e.metadata.likeCount) || 1);
    if (e.eventType === "FOLLOW") this.goal("follow", 1);
    if (e.eventType === "GIFT") this.goal("gift", e.giftCount);
  }
  goal(kind: keyof EntertainmentDirector["goals"], amount: number) {
    if (!this.config.goalsEnabled) return;
    this.goals[kind] += amount;
    if (
      this.goals[kind] >= this.config[`${kind}Goal`] &&
      !this.reached.has(kind)
    ) {
      this.reached.add(kind);
      this.slides.show(
        {
          key: "goal:" + kind,
          title: "GOAL REACHED",
          subtitle: kind.toUpperCase() + " · PARTY TOGETHER",
          priority: 4,
          duration: 4,
        },
        this.world.now,
      );
      this.log("Goals", kind + " reached");
      this.hype.add(
        kind === "gift" ? 100 : kind === "follow" ? 35 : 20,
        this.world.now,
      );
      for (const d of this.world.spawn.dancers.values())
        this.p.react(d.id, "HYPE_POSE", this.world.now, 3);
    }
  }
  update(dt: number) {
    const w = this.world,
      now = w.now;
    this.hype.update(now, dt);
    this.slides.update(now);
    const activeFever = this.hype.getState(now) === "FEVER";
    if (activeFever !== this.lastFever) {
      this.lastFever = activeFever;
      this.log("Fever", activeFever ? "started" : "ended; cooldown active");
      if (activeFever)
        this.slides.show(
          {
            key: "fever",
            title: "AFTERGLOW FEVER",
            subtitle: "THE WHOLE FLOOR IS YOURS",
            priority: 4,
            duration: 4,
          },
          now,
        );
    }
    if (this.p.nowPlaying !== this.lastSong) {
      this.lastSong = this.p.nowPlaying;
      if (this.lastSong)
        this.slides.show(
          {
            key: "song",
            title: "NOW PLAYING",
            subtitle: this.lastSong,
            priority: 0,
            duration: 3,
          },
          now,
        );
    }
    for (const [id, m] of this.gifts.moments) {
      if (m.end <= now) {
        this.gifts.moments.delete(id);
        continue;
      }
      const d = w.spawn.dancers.get(id);
      if (d && !["ENTERING", "SPAWNING", "EXITING"].includes(d.state))
        this.p.reactions.set(id, { kind: m.kind, start: m.start, end: m.end });
    }
    for (const [id, e] of this.entrances)
      if (e.end <= now) this.entrances.delete(id);
    const entering = [...w.spawn.dancers.values()].find((d) =>
      ["SPAWNING", "ENTERING"].includes(d.state),
    );
    this.p.entranceStrength = entering
      ? this.entrances.get(entering.id)?.premium
        ? 1
        : 0.5
      : 0;
    this.p.entranceName = entering?.username ?? "";
    if (entering && w.config.cameraAuto && this.p.config.entrance && !['VIP','FEATURED'].includes(w.camera.mode))
      this.p.followEntrance(entering.id,now);
    const top = this.supporters.top[0];
    if ((top?.id ?? "") !== this.previousTop) {
      const promotion = !!this.previousTop;
      this.previousTop = top?.id ?? "";
      this.log("ranking", "Top1: " + this.previousTop);
      if (top && promotion)
        this.slides.show(
          {
            key: "top",
            title: top.name,
            subtitle: "TOP SUPPORTER · #1",
            priority: 3,
            duration: 3,
          },
          now,
        );
      this.topUntil = now + 4;
      if (top && w.spawn.dancers.has(top.id))
        this.p.react(top.id, "TOP_POSE", now, 3);
    }
    const fever = this.hype.getState(now) === "FEVER";
    this.p.energy = this.hype.energy;
    this.p.beatIntensity = this.config.beatIntensity;
    if (
      !this.p.vipId &&
      ![...w.spawn.dancers.values()].some((d) => d.featuredUntil > now)
    ) {
      if (fever) {
        this.p.ledTitle = "AFTERGLOW FEVER";
        this.p.ledSubtitle = `${Math.ceil(this.hype.feverUntil - now)}s · MOVE TOGETHER`;
      } else if (top && now < this.topUntil) {
        this.p.ledTitle = top.name;
        this.p.ledSubtitle = "TOP SUPPORTER · #1";
      }
      if (this.hype.energy > 0.5)
        this.p.lights.update("HYPE", dt, now, this.p.bpm);
      if (w.config.cameraAuto && !["ENTRANCE"].includes(this.p.shot)) {
        if (fever) this.p.shot = "FEVER";
        else if (top && now < this.topUntil && w.spawn.dancers.has(top.id))
          this.p.shot = "TOP";
      }
    }
    if (this.config.ambient && now > this.ambientAt) {
      this.ambientAt = now + (fever ? 2.5 : 6);
      const active = [...w.spawn.dancers.values()].filter(
        (d) => d.state === "DANCING" && !this.p.reactions.has(d.id),
      );
      const d = active[Math.floor(now) % Math.max(1, active.length)];
      if (d)
        this.p.react(
          d.id,
          fever ? "HYPE_POSE" : hash(d.id) % 2 ? "APPLAUSE" : "WAVE_HELLO",
          now,
          2,
        );
    }
  }
  reset() {
    this.slides.reset();
    this.lastFever = false;
    this.lastSong = "";
    this.log("cleanup", "Directors reset; no active timers");
    this.hype.reset();
    this.supporters.viewers.clear();
    this.gifts.moments.clear();
    this.entrances.clear();
    this.reached.clear();
    this.goals = { like: 0, follow: 0, gift: 0 };
    this.previousTop = "";
    this.topUntil = 0;
    this.ambientAt = 0;
    this.p.energy = 0;
    this.p.entranceStrength = 0;
    this.p.entranceName = "";
  }
  dispose() {
    this.unsubscribe();
    this.reset();
  }
  inspect() {
    return {
      slides: { active: this.slides.active, queued: this.slides.queue.length },
      diagnostics: this.diagnostics,
      hype: this.hype.value,
      state: this.hype.getState(this.world.now),
      feverUntil: this.hype.feverUntil,
      cooldownUntil: this.hype.cooldownUntil,
      top: this.supporters.top,
      goals: this.goals,
      gifts: this.gifts.moments.size,
      entrances: this.entrances.size,
      config: this.config,
    };
  }
}
