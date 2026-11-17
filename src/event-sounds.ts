export const soundSlots = { entrance: 'Entrada de participante', follow: 'Nuevo Follow', gift: 'Regalo', vip: 'VIP' };
type Slot = keyof typeof soundSlots;
type Entry = { name: string; data: string };
export const soundSlot = (kind: string): string => kind === 'high' ? 'vip' : kind;
export class EventSounds {
  enabled = true;
  entries: Partial<Record<Slot, Entry>> = {};
  buffers = new Map<string, AudioBuffer>();
  private key = 'LiveDance.eventSounds.v1';
  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(this.key) || '{}');
      this.enabled = s.enabled !== false;
      for (const slot of Object.keys(soundSlots) as Slot[]) {
        const e = s.entries?.[slot];
        if (typeof e?.name === 'string' && e.name.length <= 120 && typeof e.data === 'string' && e.data.length <= 700000 && /^[A-Za-z0-9+/]*={0,2}$/.test(e.data)) this.entries[slot] = e;
      }
    } catch { /* A bad preference cannot stop music or the show. */ }
  }
  private save(entries = this.entries, enabled = this.enabled) {
    try { localStorage.setItem(this.key, JSON.stringify({ version: 1, enabled, entries })); }
    catch { throw Error('No se pudo guardar el sonido en este perfil. Conservamos el ajuste anterior.'); }
  }
  setEnabled(enabled: boolean) { this.save(this.entries, enabled); this.enabled = enabled; }
  async load(c: AudioContext, report: (s: string) => void) {
    for (const [slot, entry] of Object.entries(this.entries)) if (!this.buffers.has(slot)) {
      try {
        const b = Uint8Array.from(atob(entry.data), x => x.charCodeAt(0));
        const decoded = await c.decodeAudioData(b.buffer);
        this.validateDuration(decoded.duration); this.buffers.set(slot, decoded);
      } catch { report('Sonido guardado inválido: ' + slot + '. Se usa el aviso original.'); }
    }
  }
  private validateDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 8) throw Error('Usá un sonido corto, de hasta 8 segundos.');
  }
  async import(slot: string, file: File, c: AudioContext) {
    if (!(slot in soundSlots)) throw Error('Evento inválido');
    if (!/\.(mp3|wav|ogg)$/i.test(file.name) || !file.size || file.size > 512 * 1024) throw Error('Usá MP3, WAV u OGG de hasta 512 KiB.');
    const bytes = await file.arrayBuffer();
    let decoded: AudioBuffer;
    try { decoded = await c.decodeAudioData(bytes.slice(0)); } catch { throw Error('No se pudo leer el sonido. El archivo anterior se conserva.'); }
    this.validateDuration(decoded.duration);
    let raw = ''; for (const byte of new Uint8Array(bytes)) raw += String.fromCharCode(byte);
    const entries = { ...this.entries, [slot]: { name: file.name.slice(0, 120), data: btoa(raw) } };
    this.save(entries); this.entries = entries; this.buffers.set(slot, decoded);
  }
  remove(slot: string) {
    if (!(slot in soundSlots)) return;
    const next = { ...this.entries }; delete next[slot as Slot];
    this.save(next); this.entries = next; this.buffers.delete(slot);
  }
  name(slot: string) { return this.entries[slot as Slot]?.name || 'Aviso original'; }
}
