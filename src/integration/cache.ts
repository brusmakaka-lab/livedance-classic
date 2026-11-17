import * as T from "three";
type Entry = {
  texture: T.Texture;
  materials: T.MeshStandardMaterial[];
  refs: number;
  used: number;
};
/** Texture ownership is independent of per-viewer skeleton ownership. */
export class TextureCache {
  entries = new Map<string, Entry>();
  pending = new Map<string, Promise<void>>();
  disposed = 0;
  loaded = 0;
  constructor(public unusedLimit = 4) {}
  async load(hash: string) {
    if (this.entries.has(hash)) return;
    if (this.pending.has(hash)) return this.pending.get(hash)!;
    const promise = (async () => {
      const texture = await new T.TextureLoader().loadAsync(
        "/api/skins/blob/" + hash,
      );
      texture.colorSpace = T.SRGBColorSpace;
      texture.magFilter = T.NearestFilter;
      texture.minFilter = T.NearestFilter;
      texture.generateMipmaps = false;
      const materials = [0, 1].map(
        (layer) =>
          new T.MeshStandardMaterial({
            map: texture,
            roughness: 0.92,
            alphaTest: layer ? 0.5 : 0,
            side: layer ? T.DoubleSide : T.FrontSide,
          }),
      );
      this.entries.set(hash, {
        texture,
        materials,
        refs: 0,
        used: performance.now(),
      });
      this.loaded++;
    })();
    this.pending.set(hash, promise);
    try {
      await promise;
    } finally {
      this.pending.delete(hash);
    }
  }
  acquire(hash: string) {
    const e = this.entries.get(hash);
    if (!e) throw Error("Textura no cargada");
    e.refs++;
    e.used = performance.now();
    return e.materials;
  }
  release(hash: string) {
    const e = this.entries.get(hash);
    if (!e || e.refs <= 0) throw Error("Referencia de textura inválida");
    e.refs--;
    e.used = performance.now();
  }
  evict(valid?: Set<string>) {
    const free = [...this.entries]
      .filter(([, e]) => e.refs === 0)
      .sort((a, b) => b[1].used - a[1].used);
    free.forEach(([key, e], i) => {
      if ((valid && !valid.has(key)) || i >= this.unusedLimit) {
        e.materials.forEach((m) => m.dispose());
        e.texture.dispose();
        this.entries.delete(key);
        this.disposed++;
      }
    });
  }
  snapshot() {
    return {
      textures: this.entries.size,
      loaded: this.loaded,
      disposed: this.disposed,
      references: [...this.entries.values()].reduce((n, e) => n + e.refs, 0),
      unused: [...this.entries.values()].filter((e) => !e.refs).length,
    };
  }
}
