import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
/** Bounded structured logs. No provider payloads, credentials or chat text. */
export class DiagnosticLog {
  constructor(directory) {
    this.directory = directory; this.pending = []; this.dropped = 0; this.failed = 0;
    this.timer = setInterval(() => void this.flush(), 1000); this.timer.unref();
  }
  write(row) {
    if (this.pending.length >= 512) { this.dropped++; return; }
    this.pending.push(row);
  }
  async flush() {
    if (this.flushing || !this.pending.length) return;
    this.flushing = true;
    const batch = this.pending.splice(0);
    try {
      await mkdir(this.directory, { recursive: true });
      const file = path.join(this.directory, 'tiktok-events.jsonl');
      const size = await stat(file).then(s => s.size, () => 0);
      if (size >= 1024 * 1024) await rename(file, file + '.previous');
      await appendFile(file, batch.map(r => JSON.stringify(r)).join('\n') + '\n');
    } catch { this.failed += batch.length; }
    finally { this.flushing = false; }
  }
  status() { return { pending: this.pending.length, dropped: this.dropped, failed: this.failed }; }
  async close() {
    clearInterval(this.timer);
    while (this.flushing) await new Promise(resolve => setTimeout(resolve, 5));
    await this.flush();
  }
}
