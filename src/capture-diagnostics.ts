/** Passive RAF diagnostics: no second renderer or background simulation loop. */
export class CaptureDiagnostics {
  frames = 0; last = 0; maxGapMs = 0; gaps = 0;
  history: { at: number; kind: string; gapMs?: number; visibility: string }[] = [];
  constructor() { document.addEventListener('visibilitychange', () => this.record('visibility')); }
  record(kind: string, gapMs?: number) {
    this.history.push({ at: Date.now(), kind, gapMs, visibility: document.visibilityState });
    if (this.history.length > 24) this.history.shift();
  }
  frame(now: number) {
    if (this.last) { const gap = now - this.last; this.maxGapMs = Math.max(this.maxGapMs, gap); if (gap > 250) { this.gaps++; this.record('raf-gap', Math.round(gap)); } }
    this.last = now; this.frames++;
  }
  inspect() {
    const canvas = document.querySelector<HTMLCanvasElement>('#stage canvas'), rect = canvas?.getBoundingClientRect();
    return { frames: this.frames, sinceFrameMs: Math.round(performance.now()-this.last), maxGapMs: Math.round(this.maxGapMs), gaps: this.gaps, visibility: document.visibilityState, focus: document.hasFocus(), clean: document.body.classList.contains('clean'), viewport: [innerWidth,innerHeight], cssSize: rect ? [rect.width,rect.height] : null, bufferSize: canvas ? [canvas.width,canvas.height] : null, history: this.history.slice() };
  }
}
