import type { EventBus } from "./domain";
import { EventIngress } from "./ingress";
/** Single bounded admission boundary for simulator and replay fixtures. */
export class AdmissionGate {
  source: "simulator" | "tiktok" = "simulator";
  paused = false;
  reason = "";
  blocked = 0;
  readonly ingress: EventIngress;
  constructor(bus: EventBus) {
    this.ingress = new EventIngress(bus);
    bus.emit = (raw) => this.submit(raw);
  }
  submit(raw: unknown) {
    if ((raw as { source?: string })?.source !== this.source) { this.blocked++; return false; }
    if (this.paused) {
      this.blocked++;
      return false;
    }
    return this.ingress.submit(raw).accepted;
  }
  pause(reason: string) {
    this.paused = true;
    this.reason = reason;
    this.ingress.pause();
  }
  resume() {
    this.paused = false;
    this.reason = "";
    this.ingress.resume();
  }
  inspect() {
    return { paused: this.paused, reason: this.reason, blocked: this.blocked, ingress: this.ingress.inspect() };
  }
}
