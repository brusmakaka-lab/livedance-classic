/** World owns participants. This module only selects IDs for rendering. */
export class ViewCast {
  ids: string[] = [];
  visible: string[] = [];
  page = 0;
  limit = 10;
  subject?: string;
  sync(ids: string[]) {
    this.ids = [...new Set(ids)].slice(0, 30);
    if (this.subject && !this.ids.includes(this.subject))
      this.subject = undefined;
    this.select();
  }
  select() {
    const n = this.ids.length;
    this.visible = n
      ? Array.from(
          { length: Math.min(n, this.limit) },
          (_, i) => this.ids[(this.page * this.limit + i) % n],
        )
      : [];
    if (this.subject && this.ids.includes(this.subject))
      this.visible = [
        this.subject,
        ...this.visible.filter((x) => x !== this.subject),
      ].slice(0, this.limit);
  }
  focus(id?: string) {
    this.subject = id;
    this.select();
  }
  next() {
    if (this.subject) return;
    this.page++;
    this.select();
  }
}
export type Cue = {
  kind: "follow" | "gift" | "vip" | "fever" | "welcome";
  id: string;
  name: string;
  gift: string;
  age: number;
  duration: number;
  priority: number;
};
export class VisualQueue {
  active?: Cue;
  queue: Cue[] = [];
  dropped = 0;
  started = 0;
  push(kind: Cue["kind"], id = "", name = "", gift = "", followDuration = 2.8) {
    const duration = { welcome: 5, follow: Math.max(2.8, Math.min(7, followDuration)), gift: 3, vip: 8, fever: 12 }[kind],
      priority = { welcome: 1, follow: 1, gift: 1, vip: 3, fever: 2 }[kind],
      cue = { kind, id, name, gift, age: 0, duration, priority };
    if (!this.active || priority > this.active.priority) {
      this.active = cue;
      this.started++;
      return true;
    }
    if (this.queue.length >= 12) {
      this.dropped++;
      return false;
    }
    this.queue.push(cue);
    this.queue.sort((a, b) => b.priority - a.priority);
    return true;
  }
  update(dt: number) {
    if (!this.active) {
      this.active = this.queue.shift();
      if (this.active) this.started++;
      else return;
    }
    this.active.age += Math.max(0, dt);
    if (this.active.age >= this.active.duration) {
      this.active = this.queue.shift();
      if (this.active) this.started++;
    }
  }
  clear() {
    this.active = undefined;
    this.queue = [];
  }
}
