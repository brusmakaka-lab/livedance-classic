export type Skin = {
  id: string;
  hash: string;
  name: string;
  model: "classic" | "slim";
  provenance: { author: string; source: string; license: string }[];
};
export type SkinState = {
  version: 1;
  revision: number;
  records: Skin[];
  viewers: { id: string; name: string; skinId: string }[];
  sessionId: string;
  recovery?: string;
};
export class SkinClient {
  state!: SkinState;
  demoIds = new Set<string>();
  demoBindings = new Map<string, string>();
  private demoGeneration = 0;
  beginDemo() { this.demoGeneration++; this.demoBindings.clear(); }
  markDemo(id: string) { this.demoIds.add(id); }
  token = "";
  bindings = new Map<string, string>();
  pending = new Map<string, Promise<Skin>>();
  async init() {
    this.token = (await (await fetch("/api/session")).json()).token;
    await this.refresh();
  }
  async refresh() {
    const res = await fetch("/api/skins");
    if (!res.ok) throw Error("SkinLibrary no disponible");
    this.state = await res.json();
  }
  async mutate(action: string, body: unknown) {
    const res = await fetch("/api/skins/" + action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LiveDance-Token": this.token,
        },
        body: JSON.stringify(body),
      }),
      data = await res.json();
    if (!res.ok) throw Error(data.error);
    if (!this.state || data.state.revision >= this.state.revision)
      this.state = data.state;
    return data.result;
  }
  record(id: string) {
    if (this.demoIds.has(id)) return this.state?.records.find(r => r.id === this.demoBindings.get(id));
    const key = this.bindings.get(id),
      v = this.state?.viewers.find((v) => v.id === key);
    return this.state?.records.find((r) => r.id === v?.skinId);
  }
  async ensure(id: string, name: string) {
    const found = this.record(id);
    if (found) return found;
    if (this.pending.has(id)) return this.pending.get(id)!;
    const task = (async () => {
      if (this.demoIds.has(id)) {
        const generation = this.demoGeneration;
        const skinId = await this.mutate("random", {});
        if (generation !== this.demoGeneration) throw Error("Demo anterior cancelada");
        this.demoBindings.set(id, skinId);
        const record = this.record(id);
        if (!record) throw Error("Skin de demo no disponible");
        return record;
      }
      const result = await this.mutate("assign", { viewerId: id, name });
      this.bindings.set(id, result.id);
      const r = this.record(id);
      if (!r) throw Error("Asignación de skin inválida");
      return r;
    })();
    this.pending.set(id, task);
    try {
      return await task;
    } finally {
      this.pending.delete(id);
    }
  }
}
