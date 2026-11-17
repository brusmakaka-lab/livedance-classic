import type { LiveEvent } from '../domain';
import { HIP, EXCITED } from './show/show-plan';
export type FreeDanceConfig = { likeDance: boolean; groupDance: boolean; idleDance: boolean };
/** Receives only delivered, deduplicated EventBus events. Never owns scores or viewers. */
export class FreeDanceDirector {
  totals = new Map<string, number>();
  source = ''; likes = 0; idle = 0; cooldown = 0; groupLeft = 0;
  pending: 'single' | 'group' | undefined; pendingAge = 0;
  clip: string | undefined; revision = 0; groupRevision = 0; last = 'waiting';
  receive(e: LiveEvent, config: FreeDanceConfig) {
    const key = e.source + ':' + (e.sessionId || 'local');
    if (key !== this.source) { this.cancel(); this.source = key; this.likes = this.totals.get(key) || 0; }
    if (e.eventType === 'FOLLOW' || e.eventType === 'GIFT') this.idle = 0;
    if (e.eventType !== 'LIKE_MILESTONE') return;
    const count = Number(e.metadata.likeCount ?? (e.source === 'simulator' ? 1 : 0));
    if (!Number.isSafeInteger(count) || count < 1 || count > 100000) return;
    const before = this.totals.get(key) || 0, after = before + count;
    this.totals.set(key, after); this.likes = after;
    if (this.totals.size > 8) this.totals.delete(this.totals.keys().next().value!);
    // One coalesced cue; group wins when a batch crosses both thresholds.
    const group = Math.floor(after / 500) > Math.floor(before / 500);
    const single = Math.floor(after / 100) > Math.floor(before / 100);
    if (group && config.groupDance) { this.pending = 'group'; this.pendingAge = 0; }
    else if (single && config.likeDance && this.pending !== 'group') { this.pending = 'single'; this.pendingAge = 0; }
  }
  cancel() { this.pending = undefined; this.pendingAge = 0; this.groupLeft = 0; this.idle = 0; this.cooldown = 15; }
  reset() { this.cancel(); this.totals.clear(); this.source = ''; this.likes = 0; this.clip = undefined; this.last = 'waiting'; }
  update(dt: number, blocked: boolean, config: FreeDanceConfig) {
    dt = Math.max(0, Math.min(dt, .1));
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.pendingAge += dt;
    if (this.pendingAge > 30 || (this.pending === 'group' ? !config.groupDance : !config.likeDance)) this.pending = undefined;
    if (!config.groupDance) this.groupLeft = 0;
    if (blocked) { this.idle = 0; this.groupLeft = 0; return; }
    this.groupLeft = Math.max(0, this.groupLeft - dt);
    this.idle += dt;
    if (this.cooldown > 0 || this.groupLeft > 0) return;
    if (this.pending === 'group') {
      this.groupLeft = 12; this.groupRevision++; this.last = '500 likes · grupo';
    } else if (this.pending === 'single' || (config.idleDance && this.idle >= 60)) {
      this.clip = this.clip ? (this.clip === HIP ? EXCITED : HIP) : (Math.random() < .5 ? HIP : EXCITED);
      this.revision++; this.last = this.pending ? '100 likes · cambio' : '60 s · cambio';
    } else return;
    this.pending = undefined; this.idle = 0; this.cooldown = 15;
  }
  inspect() { return { source: this.source, likes: this.likes, pending: this.pending, groupLeft: this.groupLeft, cooldown: this.cooldown, idle: this.idle, clip: this.clip, revision: this.revision, groupRevision: this.groupRevision, last: this.last }; }
}
