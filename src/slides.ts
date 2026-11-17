export type Slide = {
  key: string;
  title: string;
  subtitle: string;
  priority: number;
  duration: number;
  strength?: number;
  start?: number;
};
export class SlideDirector {
  active: Slide | null = null;
  queue: Slide[] = [];
  show(slide: Slide, now: number) {
    if (
      !this.active ||
      slide.priority > this.active.priority ||
      (slide.key === this.active.key && slide.priority === this.active.priority)
    ) {
      this.active = { ...slide, start: now };
      this.queue = this.queue.filter((s) => s.key !== slide.key);
    } else {
      const at = this.queue.findIndex((s) => s.key === slide.key);
      if (at >= 0) this.queue[at] = { ...slide };
      else this.queue.push({ ...slide });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.queue.length = Math.min(this.queue.length, 8);
    }
  }
  update(now: number) {
    if (this.active && now >= this.active.start! + this.active.duration)
      this.active = null;
    if (!this.active && this.queue.length)
      this.active = { ...this.queue.shift()!, start: now };
  }
  reset() {
    this.active = null;
    this.queue = [];
  }
}
