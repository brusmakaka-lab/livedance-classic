import * as T from "three";
import { widePose, showEnvelope } from "./show-plan";
export type Shot = "WIDE" | "HERO" | "EVENT";
export type Kind = "follow" | "gift" | "vip" | "fever";
export class QualityGovernor {
  slowWindows = 0;
  sample(p95: number, quality: "LOW" | "MEDIUM" | "HIGH", enabled: boolean) {
    this.slowWindows = enabled && p95 > 22 ? this.slowWindows + 1 : 0;
    if (this.slowWindows < 3 || quality === "LOW") return quality;
    this.slowWindows = 0;
    return quality === "HIGH" ? "MEDIUM" : "LOW";
  }
}
export type ShowEvent = {
  kind: Kind;
  id: number;
  age: number;
  duration: number;
  priority: number;
  viewerId?: number;
  username: string;
  gift: string;
};
const rules = { follow: [1, 2.4], gift: [2, 3], vip: [3, 8], fever: [4, 12] };
/** One presentation at a time; bounded queue; high priority can interrupt. */
export class EventDirector {
  active?: ShowEvent;
  queue: ShowEvent[] = [];
  nextId = 1;
  dropped = 0;
  completed = 0;
  constructor(
    public onStart: (e: ShowEvent) => void,
    public onEnd: (e: ShowEvent) => void,
  ) {}
  push(
    kind: Kind,
    data: { viewerId?: number; username?: string; gift?: string } = {},
  ) {
    const [priority, duration] = rules[kind];
    const clean = (s: string) =>
      s
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, 28);
    const event = {
      kind,
      id: this.nextId++,
      age: 0,
      priority,
      duration,
      viewerId: data.viewerId,
      username: clean(data.username || "Invitado"),
      gift: clean(data.gift || "Estrella VIP"),
    };
    if (!this.active) {
      this.start(event);
      return true;
    }
    if (priority > this.active.priority) {
      this.onEnd(this.active);
      this.start(event);
      return true;
    }
    if (this.queue.length >= 12) {
      this.dropped++;
      return false;
    }
    this.queue.push(event);
    this.queue.sort((a, b) => b.priority - a.priority || a.id - b.id);
    return true;
  }
  private start(e: ShowEvent) {
    this.active = e;
    this.onStart(e);
  }
  update(dt: number) {
    if (!this.active) return;
    this.active.age += Math.max(0, dt);
    if (this.active.age >= this.active.duration) {
      const old = this.active;
      this.active = undefined;
      this.completed++;
      this.onEnd(old);
      const next = this.queue.shift();
      if (next) this.start(next);
    }
  }
  reset() {
    if (this.active) this.onEnd(this.active);
    this.active = undefined;
    this.queue.length = 0;
  }
  get energy() {
    if (!this.active) return 0;
    const e = this.active;
    return e.kind === "vip" || e.kind === "fever"
      ? showEnvelope(e.kind, e.age)
      : Math.min(1, e.age / 0.5, (e.duration - e.age) / 0.65);
  }
}
export class CameraDirector {
  concert = false;
  shot: Shot = "HERO";
  target = new T.Vector3(0, 1.35, 0);
  initialized = false;
  event = "";
  age = 0;
  intensity = 0.65;
  normalShot: Shot = "WIDE";
  update(
    camera: T.PerspectiveCamera,
    count: number,
    hero: T.Vector3,
    time: number,
    dt: number,
    reduced = false,
  ) {
    const wide = widePose(count, camera.aspect, camera.fov, 0, this.concert);
    const heroPosition = hero
      .clone()
      .add(new T.Vector3(this.shot === "EVENT" ? 0.8 : 0.35, 2.4, 10.2));
    const heroLook = hero.clone().add(new T.Vector3(0, 1.42, 0));
    const normal =
      this.normalShot === "WIDE"
        ? wide
        : { position: heroPosition, look: heroLook };
    let position = (
      this.shot === "WIDE" ? wide.position : heroPosition
    ).clone();
    let look = (this.shot === "WIDE" ? wide.look : heroLook).clone();
    const envelope = showEnvelope(this.event, this.age);
    if (this.event === "vip") {
      if (!reduced)
        heroPosition.x += Math.sin(this.age * 0.38) * 0.35 * this.intensity;
      position.copy(normal.position).lerp(heroPosition, envelope);
      look.copy(normal.look).lerp(heroLook, envelope);
    } else if (this.event === "fever") {
      const concert = widePose(
        count,
        camera.aspect,
        camera.fov,
        reduced
          ? 0
          : Math.sin(this.age * 0.33) * 0.035 * this.intensity * envelope,
        this.concert,
      );
      position.copy(normal.position).lerp(concert.position, envelope);
      look.copy(normal.look).lerp(concert.look, envelope);
    }
    const alpha = this.initialized
      ? 1 - Math.exp(-dt * (reduced ? 3.5 : 2.6))
      : 1;
    camera.position.lerp(position, alpha);
    this.target.lerp(look, alpha);
    camera.lookAt(this.target);
    this.initialized = true;
  }
}
