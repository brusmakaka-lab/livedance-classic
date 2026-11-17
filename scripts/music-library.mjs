import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
export const limits = {
  file: 80 * 1024 * 1024,
  total: 1024 * 1024 * 1024,
  tracks: 100,
};
const types = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};
const initial = () => ({
  version: 2,
  collectionsVersion: 1,
  playlists: [],
  queue: [],
  activePlaylist: null,
  energySuggestions: false,
  tracks: [],
  currentId: null,
  mode: "SEQUENTIAL",
  repeat: "OFF",
  crossfade: 0,
  ducking: true,
  duckAmount: 0.55,
  nowPlaying: true,
  beat: false,
});
export class MusicStore {
  constructor(root) {
    this.root = path.resolve(root);
    this.directory = path.join(this.root, "music");
    this.index = path.join(this.root, "playlist.json");
    this.queue = Promise.resolve();
    this.state = initial();
    this.warning = "";
  }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try {
      const value = JSON.parse(await readFile(this.index, "utf8"));
      if (value.version !== 2 || !Array.isArray(value.tracks))
        throw Error("Índice inválido");
      if (!value.collectionsVersion) {
        await writeFile(
          this.index + ".v02-backup",
          JSON.stringify(value, null, 2),
          { flag: "wx" },
        ).catch((e) => {
          if (e.code !== "EEXIST") throw e;
        });
      }
      this.state = {
        ...initial(),
        ...value,
        tracks: value.tracks.filter(
          (t) =>
            /^[a-f0-9-]{36}$/.test(t.id) &&
            typeof t.file === "string" &&
            path.basename(t.file) === t.file,
        ),
      };
    } catch (e) {
      if (e.code !== "ENOENT") {
        this.warning =
          "Índice dañado: se conservó una copia .corrupt y los archivos de música.";
        try {
          await rename(this.index, this.index + ".corrupt-" + Date.now());
        } catch {}
      }
    }
    return this.snapshot();
  }
  run(fn) {
    const operation = this.queue.catch(() => {}).then(fn);
    this.queue = operation;
    return operation;
  }
  async persist() {
    await writeFile(this.index + ".tmp", JSON.stringify(this.state, null, 2));
    await rename(this.index + ".tmp", this.index);
  }
  async snapshot() {
    const tracks = await Promise.all(
      this.state.tracks.map(async (t) => {
        let missing = false;
        try {
          const f = await stat(this.file(t));
          missing = !f.isFile() || f.size !== t.size;
        } catch {
          missing = true;
        }
        const { file, ...publicTrack } = t;
        return { ...publicTrack, missing };
      }),
    );
    return { ...this.state, tracks, warning: this.warning, limits };
  }
  file(track) {
    const p = path.resolve(this.directory, track.file);
    if (!p.startsWith(this.directory + path.sep)) throw Error("Ruta inválida");
    return p;
  }
  async import(name, bytes) {
    return this.run(async () => {
      const ext = path.extname(name).toLowerCase(),
        mime = types[ext];
      if (!mime) throw Error("Formato no admitido");
      if (!bytes.length || bytes.length > limits.file)
        throw Error("El archivo debe tener entre 1 byte y 80 MiB");
      if (
        this.state.tracks.length >= limits.tracks ||
        this.state.tracks.reduce((n, t) => n + t.size, 0) + bytes.length >
          limits.total
      )
        throw Error("Límite de biblioteca: 100 pistas / 1 GiB");
      // Validate container signatures before storing; browser decoding performs the final check.
      const signature = bytes.toString("ascii", 0, 12),
        valid =
          ext === ".wav"
            ? signature.startsWith("RIFF") && signature.slice(8) === "WAVE"
            : ext === ".mp3"
              ? bytes.toString("ascii", 0, 3) === "ID3" || bytes[0] === 0xff
              : ext === ".ogg"
                ? signature.startsWith("OggS")
                : ext === ".flac"
                  ? signature.startsWith("fLaC")
                  : ext === ".m4a"
                    ? bytes.toString("ascii", 4, 8) === "ftyp"
                    : ext === ".webm"
                      ? bytes
                          .subarray(0, 4)
                          .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
                      : bytes[0] === 0xff;
      if (!valid)
        throw Error("Archivo dañado o extensión no coincide con el contenido");
      const id = randomUUID(),
        track = {
          id,
          name: path
            .basename(name)
            .replace(/[<>\x00-\x1f]/g, "")
            .slice(0, 120),
          size: bytes.length,
          mime,
          file: id + ext,
        };
      await writeFile(this.file(track), bytes, { flag: "wx" });
      this.state.tracks.push(track);
      if (!this.state.currentId) this.state.currentId = id;
      await this.persist();
      const { file, ...result } = track;
      return result;
    });
  }
  async update(value) {
    return this.run(async () => {
      if (!value || !Array.isArray(value.tracks))
        throw Error("Playlist inválida");
      const ids = value.tracks.map((t) => t.id);
      if (
        ids.length !== this.state.tracks.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !this.state.tracks.some((t) => t.id === id))
      )
        throw Error("La biblioteca cambió; recargá antes de guardar");
      this.state.tracks = ids.map((id) => {
        const t = this.state.tracks.find((t) => t.id === id),
          v = value.tracks.find((t) => t.id === id);
        return {
          ...t,
          favorite: typeof v.favorite === "boolean" ? v.favorite : undefined,
          tag: ["CHILL", "GROOVE", "HYPE", "CUSTOM"].includes(v.tag)
            ? v.tag
            : undefined,
          bpm:
            Number.isFinite(v.bpm) && v.bpm >= 40 && v.bpm <= 240
              ? v.bpm
              : undefined,
          duration:
            Number.isFinite(v.duration) && v.duration > 0
              ? v.duration
              : undefined,
          error:
            typeof v.error === "string" ? v.error.slice(0, 100) : undefined,
        };
      });
      if (["SEQUENTIAL", "SHUFFLE"].includes(value.mode))
        this.state.mode = value.mode;
      if (["OFF", "TRACK", "PLAYLIST"].includes(value.repeat))
        this.state.repeat = value.repeat;
      if ([0, 1, 2, 3, 5].includes(value.crossfade))
        this.state.crossfade = value.crossfade;
      for (const k of ["ducking", "nowPlaying", "beat"])
        if (typeof value[k] === "boolean") this.state[k] = value[k];
      if (Number.isFinite(value.duckAmount))
        this.state.duckAmount = Math.max(0, Math.min(0.9, value.duckAmount));
      if (Array.isArray(value.playlists))
        this.state.playlists = value.playlists
          .slice(0, 50)
          .filter(
            (p) => p && typeof p.id === "string" && Array.isArray(p.trackIds),
          )
          .map((p) => ({
            id: p.id.slice(0, 64),
            name: String(p.name ?? "Playlist").slice(0, 48),
            tag: ["CHILL", "GROOVE", "HYPE", "CUSTOM"].includes(p.tag)
              ? p.tag
              : "CUSTOM",
            trackIds: [...new Set(p.trackIds)]
              .filter((id) => ids.includes(id))
              .slice(0, 100),
          }));
      if (Array.isArray(value.queue))
        this.state.queue = value.queue
          .filter((id) => ids.includes(id))
          .slice(0, 200);
      this.state.activePlaylist = this.state.playlists.some(
        (p) => p.id === value.activePlaylist,
      )
        ? value.activePlaylist
        : null;
      this.state.energySuggestions = value.energySuggestions === true;
      this.state.collectionsVersion = 1;
      this.state.currentId = ids.includes(value.currentId)
        ? value.currentId
        : (ids[0] ?? null);
      await this.persist();
      return this.snapshot();
    });
  }
  async remove(id) {
    return this.run(async () => {
      const removed = id
        ? this.state.tracks.filter((t) => t.id === id)
        : this.state.tracks.slice();
      this.state.tracks = this.state.tracks.filter((t) => !removed.includes(t));
      if (!this.state.tracks.some((t) => t.id === this.state.currentId))
        this.state.currentId = this.state.tracks[0]?.id ?? null;
      this.state.queue = this.state.queue.filter((id) =>
        this.state.tracks.some((t) => t.id === id),
      );
      for (const p of this.state.playlists)
        p.trackIds = p.trackIds.filter((id) =>
          this.state.tracks.some((t) => t.id === id),
        );
      await this.persist();
      for (const t of removed)
        try {
          await unlink(this.file(t));
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
      return this.snapshot();
    });
  }
  async stream(id, req, res) {
    const track = this.state.tracks.find((t) => t.id === id);
    if (!track) {
      res.writeHead(404);
      return res.end();
    }
    let info;
    try {
      info = await stat(this.file(track));
    } catch {
      res.writeHead(404);
      return res.end();
    }
    const size = info.size;
    let start = 0,
      end = size - 1,
      status = 200;
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` });
        return res.end();
      }
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else start = Number(match[1]);
      if (match[1] && match[2]) end = Math.min(size - 1, Number(match[2]));
      if (start > end || start >= size) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` });
        return res.end();
      }
      status = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    }
    res.setHeader("Content-Type", track.mime);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", end - start + 1);
    res.writeHead(status);
    if (req.method === "HEAD") return res.end();
    const stream = createReadStream(this.file(track), { start, end });
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  }
  open() {
    if (process.platform !== "win32")
      throw Error("Abrir carpeta está disponible en Windows");
    const child = spawn("explorer.exe", [this.directory], {
      shell: false,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.on("error", () => {});
    child.unref();
    return { opened: true, directory: this.directory };
  }
}
export async function body(req, max) {
  const chunks = [];
  let count = 0;
  for await (const chunk of req) {
    count += chunk.length;
    if (count > max) throw Error("Solicitud demasiado grande");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
