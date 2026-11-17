import * as T from 'three';

/** A presentation window, never an owner of participants, skins or scores. */
export class ArrivalLineup {
  order: string[] = [];
  readonly capacity = 5;
  sync(ids: string[]) {
    const valid = [...new Set(ids)].slice(0, 30);
    this.order = [...this.order.filter(id => valid.includes(id)), ...valid.filter(id => !this.order.includes(id))];
  }
  promote(id: string) {
    if (!this.order.includes(id)) return;
    this.order = [id, ...this.order.filter(x => x !== id)];
  }
  settle(id: string) {
    if(this.order.includes(id)) this.order=[...this.order.filter(x=>x!==id),id];
  }
  visible(subject?: string) {
    const order = subject && this.order.includes(subject)
      ? [subject, ...this.order.filter(id => id !== subject)] : this.order;
    return order.slice(0, this.capacity);
  }
  next() {
    const n = Math.min(this.capacity, this.order.length);
    this.order = [...this.order.slice(n), ...this.order.slice(0, n)];
  }
}

// Staggered depth keeps the waiting dancers recognizable in a vertical frame.
const slots = [[0,0],[-1.45,-3.9],[1.45,-5.5],[-2.1,-8.6],[2.1,-10.2]];
export function lineupPlacement(index: number) {
  const [x,z] = slots[Math.max(0,Math.min(4,index))];
  return new T.Vector3(x,0,z);
}
/** The foreground is reserved for timed presentations, never for a like total. */
export function settledPlacement(index: number) {
  const slots=[[-1.25,-3.6],[1.25,-5.2],[-2.1,-8],[0,-9],[2.1,-10.2]];
  const [x,z]=slots[Math.max(0,Math.min(4,index))];
  return new T.Vector3(x,0,z);
}
export function lineupPose(aspect: number) {
  // Same shot for 1–30 registered participants, arrivals, VIP and Fever.
  const distance = Math.max(14.2, 14.2 * (365/648) / aspect);
  return {position:new T.Vector3(0,4.7,distance),look:new T.Vector3(0,1.05,-2.8)};
}
