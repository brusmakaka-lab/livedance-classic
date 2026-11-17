import fs from "node:fs/promises";
import path from "node:path";
import { randomInt, randomUUID } from "node:crypto";
import { validateSkin } from "./png.mjs";
const clean = (s, max) =>
  typeof s === "string"
    ? s
        .replace(/[\x00-\x1f\x7f]/g, "")
        .trim()
        .slice(0, max)
    : "";
export class Store {
  constructor(dir, seedDir, random = (n) => randomInt(n)) {
    this.dir = dir;
    this.seedDir = seedDir;
    this.rng = random;
    this.tail = Promise.resolve();
    this.recovery = "none";
  }
  valid(s) {
    const hash = (x) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x),
      str = (x, n) => typeof x === "string" && x.length > 0 && x.length <= n;
    if (
      s?.version !== 1 ||
      !Number.isSafeInteger(s.revision) ||
      s.revision < 0 ||
      !str(s.sessionId, 64) ||
      !Array.isArray(s.records) ||
      s.records.length < 1 ||
      s.records.length > 200 ||
      !Array.isArray(s.viewers) ||
      s.viewers.length > 1000 ||
      !Array.isArray(s.bag)
    )
      return false;
    if (
      !s.records.every(
        (r) =>
          r &&
          hash(r.hash) &&
          ["classic", "slim"].includes(r.model) &&
          r.id === r.hash + "-" + r.model &&
          str(r.name, 64) &&
          str(r.createdAt, 40) &&
          Array.isArray(r.provenance) &&
          r.provenance.length > 0 &&
          r.provenance.every(
            (p) =>
              p &&
              hash(p.originalHash) &&
              str(p.author, 96) &&
              str(p.source, 256) &&
              str(p.license, 256),
          ),
      )
    )
      return false;
    const ids = new Set(s.records.map((r) => r.id));
    if (ids.size !== s.records.length) return false;
    return (
      s.viewers.every(
        (v) =>
          v &&
          typeof v.id === "string" &&
          /^[\p{L}\p{N}_.:@-]{1,64}$/u.test(v.id) &&
          str(v.name, 48) &&
          ids.has(v.skinId),
      ) &&
      new Set(s.viewers.map((v) => v.id)).size === s.viewers.length &&
      s.bag.every((id) => ids.has(id)) &&
      new Set(s.bag).size === s.bag.length &&
      (s.last === null ||
        (typeof s.last === "string" &&
          /^[a-f0-9]{64}-(classic|slim)$/.test(s.last)))
    );
  }
  async init() {
    await fs.mkdir(path.join(this.dir, "originals"), { recursive: true });
    await fs.mkdir(path.join(this.dir, "blobs"), { recursive: true });
    let existing = false;
    try {
      await fs.access(path.join(this.dir, "index.json"));
      existing = true;
    } catch {}
    if (existing) {
      try {
        this.state = JSON.parse(
          await fs.readFile(path.join(this.dir, "index.json"), "utf8"),
        );
        if (!this.valid(this.state)) throw Error("schema");
      } catch {
        try {
          this.state = JSON.parse(
            await fs.readFile(path.join(this.dir, "index.backup.json"), "utf8"),
          );
          if (!this.valid(this.state)) throw Error("schema");
          this.recovery = "backup";
          await this.save(this.state, false);
        } catch {
          throw Error(
            "Índice y backup inválidos. Se preservan archivos; restaurá una copia válida.",
          );
        }
      }
    } else {
      this.state = {
        version: 1,
        revision: 0,
        sessionId: randomUUID(),
        records: [],
        viewers: [],
        bag: [],
        last: null,
      };
      await this.save(this.state, false);
      for (const [file, name, model] of [
        ["coral", "Coral · Campus", "classic"],
        ["nova", "Nova · Night rider", "slim"],
        ["milo", "Milo · Field notes", "classic"],
      ])
        await this.import(
          {
            name,
            model,
            author: "LiveDance SkinLab",
            source: "Fixture original del proyecto",
            license: "Diseño propio del proyecto",
            authorized: true,
          },
          await fs.readFile(path.join(this.seedDir, file + ".png")),
        );
    }
    return this.snapshot();
  }
  snapshot() {
    return structuredClone({ ...this.state, recovery: this.recovery });
  }
  transaction(fn) {
    const next = this.tail.then(async () => {
      const draft = structuredClone(this.state),
        result = await fn(draft);
      draft.revision++;
      await this.save(draft);
      this.state = draft;
      return result;
    });
    this.tail = next.catch(() => {});
    return next;
  }
  async save(s, backup = true) {
    const file = path.join(this.dir, "index.json"),
      tmp = file + ".tmp";
    if (backup)
      await fs.copyFile(file, path.join(this.dir, "index.backup.json"));
    const h = await fs.open(tmp, "w");
    try {
      await h.writeFile(JSON.stringify(s, null, 2));
      await h.sync();
    } finally {
      await h.close();
    }
    await fs.rename(tmp, file);
  }
  async keep(file, bytes) {
    try {
      await fs.writeFile(file, bytes, { flag: "wx" });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  import(meta, bytes) {
    return this.transaction(async (s) => {
      if (meta.authorized !== true)
        throw Error("Confirmá que tenés autorización para usar esta skin");
      const name = clean(meta.name, 64),
        author = clean(meta.author, 96),
        source = clean(meta.source, 256),
        license = clean(meta.license, 256);
      if (!name || !author || !source || !license)
        throw Error("Completá nombre, autor, procedencia y permiso/licencia");
      const v = validateSkin(bytes, meta.model, meta.normalizeAlpha === true),
        id = v.hash + "-" + meta.model;
      const originals = await fs.readdir(path.join(this.dir, "originals"));
      if (
        !originals.includes(v.originalHash + ".png") &&
        originals.length >= 512
      )
        throw Error(
          "Archivo de originales lleno (512). Exportá/gestioná el archivo antes de importar más",
        );
      const found = s.records.find((r) => r.id === id);
      if (!found && s.records.length >= 200)
        throw Error("La biblioteca permite hasta 200 skins");
      await this.keep(
        path.join(this.dir, "originals", v.originalHash + ".png"),
        bytes,
      );
      await this.keep(
        path.join(this.dir, "blobs", v.hash + ".png"),
        v.normalized,
      );
      const provenance = {
        originalHash: v.originalHash,
        author,
        source,
        license,
        importedAt: new Date().toISOString(),
        alpha: v.alpha,
      };
      if (found) {
        if (
          !found.provenance.some(
            (p) =>
              p.originalHash === v.originalHash &&
              p.author === author &&
              p.source === source &&
              p.license === license,
          )
        )
          found.provenance.push(provenance);
        return { id, duplicate: true, alpha: v.alpha };
      }
      s.records.push({
        id,
        hash: v.hash,
        name,
        model: meta.model,
        provenance: [provenance],
        createdAt: new Date().toISOString(),
      });
      s.bag = [];
      return { id, duplicate: false, alpha: v.alpha };
    });
  }
  choose(s) {
    const ids = s.records.map((r) => r.id);
    if (!ids.length) throw Error("Importá al menos una skin");
    s.bag = s.bag.filter((id) => ids.includes(id));
    if (!s.bag.length) {
      s.bag = [...ids];
      for (let i = s.bag.length - 1; i > 0; i--) {
        const j = this.rng(i + 1);
        [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]];
      }
      if (s.bag.length > 1 && s.bag.at(-1) === s.last)
        [s.bag[0], s.bag[s.bag.length - 1]] = [s.bag.at(-1), s.bag[0]];
    }
    s.last = s.bag.pop();
    return s.last;
  }
  assign(id, name, skinId) {
    return this.transaction((s) => {
      id = clean(id, 64);
      name = clean(name, 48);
      if (!/^[\p{L}\p{N}_.:@-]{1,64}$/u.test(id) || !name)
        throw Error("ID válido y nombre son obligatorios");
      let v = s.viewers.find((v) => v.id === id);
      if (v) {
        v.name = name;
        return v;
      }
      if (s.viewers.length >= 1000)
        throw Error("Límite de 1000 espectadores por sesión");
      if (skinId && !s.records.some((r) => r.id === skinId))
        throw Error("Skin no disponible");
      v = { id, name, skinId: skinId || this.choose(s) };
      s.viewers.push(v);
      return v;
    });
  }
  random() {
    return this.transaction((s) => this.choose(s));
  }
  remove(id) {
    return this.transaction(async (s) => {
      const idx = s.records.findIndex((r) => r.id === id);
      if (idx < 0) throw Error("Skin no encontrada");
      if (s.records.length === 1)
        throw Error("Conservá al menos una skin para los espectadores");
      // Preserve attribution with archived originals even after the rolling backup advances.
      const archive = path.join(this.dir, "removed");
      await fs.mkdir(archive, { recursive: true });
      await this.keep(
        path.join(archive, id + "-" + s.revision + ".json"),
        JSON.stringify(
          {
            record: s.records[idx],
            archivedAt: new Date().toISOString(),
            reason:
              "Library removal requested; see current index for membership",
          },
          null,
          2,
        ),
      );
      s.records.splice(idx, 1);
      s.bag = [];
      let reassigned = 0;
      for (const v of s.viewers)
        if (v.skinId === id) {
          v.skinId = this.choose(s);
          reassigned++;
        }
      return { reassigned, originalPreserved: true };
    });
  }
  resetSession() {
    return this.transaction((s) => {
      s.sessionId = randomUUID();
      s.viewers = [];
      s.bag = [];
      s.last = null;
      return s.sessionId;
    });
  }
}
