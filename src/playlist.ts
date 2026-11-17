export interface MusicTrack {
  id: string;
  name: string;
  size: number;
  mime: string;
  duration?: number;
  bpm?: number;
  error?: string;
  missing?: boolean;
  favorite?: boolean;
  tag?: "CHILL" | "GROOVE" | "HYPE" | "CUSTOM";
}
export interface SavedPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  tag: string;
}
export interface PlaylistState {
  collectionsVersion: 1;
  playlists: SavedPlaylist[];
  queue: string[];
  activePlaylist: string | null;
  energySuggestions: boolean;
  version: 2;
  tracks: MusicTrack[];
  currentId: string | null;
  mode: "SEQUENTIAL" | "SHUFFLE";
  repeat: "OFF" | "TRACK" | "PLAYLIST";
  crossfade: 0 | 1 | 2 | 3 | 5;
  ducking: boolean;
  duckAmount: number;
  nowPlaying: boolean;
  beat: boolean;
}
export const playlistDefaults: PlaylistState = {
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
};
export function playlistState(
  input: Partial<PlaylistState> = {},
): PlaylistState {
  return {
    ...playlistDefaults,
    ...input,
    version: 2,
    collectionsVersion: 1,
    playlists: Array.isArray(input.playlists)
      ? input.playlists
          .slice(0, 50)
          .map((p) => ({
            ...p,
            trackIds: [...new Set(p.trackIds)].filter((id) =>
              input.tracks?.some((t) => t.id === id),
            ),
          }))
      : [],
    queue: Array.isArray(input.queue)
      ? input.queue
          .filter((id) => input.tracks?.some((t) => t.id === id))
          .slice(0, 200)
      : [],
    tracks: Array.isArray(input.tracks)
      ? input.tracks.map((t) => ({ ...t }))
      : [],
    mode: input.mode === "SHUFFLE" ? "SHUFFLE" : "SEQUENTIAL",
    repeat: ["TRACK", "PLAYLIST"].includes(input.repeat ?? "")
      ? input.repeat!
      : "OFF",
    crossfade: [0, 1, 2, 3, 5].includes(input.crossfade ?? 0)
      ? (input.crossfade ?? 0)
      : 0,
    duckAmount: Math.max(
      0,
      Math.min(
        0.9,
        Number.isFinite(input.duckAmount) ? input.duckAmount! : 0.55,
      ),
    ),
  };
}
export class PlaylistModel {
  state: PlaylistState;
  private played = new Set<string>();
  private history: string[] = [];
  constructor(
    state: Partial<PlaylistState> = {},
    private random = () => Math.random(),
  ) {
    this.state = playlistState(state);
    if (!this.state.tracks.some((t) => t.id === this.state.currentId))
      this.state.currentId = this.state.tracks[0]?.id ?? null;
    if (this.state.currentId) this.played.add(this.state.currentId);
  }
  get current() {
    return this.state.tracks.find((t) => t.id === this.state.currentId);
  }
  createPlaylist(name: string) {
    if (this.state.playlists.length >= 50) return null;
    const p: SavedPlaylist = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 48) || "Mi playlist",
      trackIds: [],
      tag: "CUSTOM",
    };
    this.state.playlists.push(p);
    return p;
  }
  removeFromPlaylist(list: string, track: string) {
    const p = this.state.playlists.find((p) => p.id === list);
    if (p) p.trackIds = p.trackIds.filter((id) => id !== track);
  }
  enqueue(id: string) {
    if (
      this.state.tracks.some((t) => t.id === id) &&
      this.state.queue.length < 200
    )
      this.state.queue.push(id);
  }
  moveQueue(index: number, target: number) {
    if (index < 0 || index >= this.state.queue.length) return;
    const [id] = this.state.queue.splice(index, 1);
    this.state.queue.splice(
      Math.max(0, Math.min(target, this.state.queue.length)),
      0,
      id,
    );
  }
  get selection() {
    const list = this.state.playlists.find(
      (p) => p.id === this.state.activePlaylist,
    );
    return list
      ? list.trackIds
          .map((id) => this.state.tracks.find((t) => t.id === id))
          .filter((t): t is MusicTrack => !!t)
      : this.state.tracks;
  }
  get playable() {
    return this.selection.filter((t) => !t.error && !t.missing);
  }
  add(tracks: MusicTrack[]) {
    for (const t of tracks)
      if (!this.state.tracks.some((x) => x.id === t.id))
        this.state.tracks.push({ ...t });
    if (!this.state.currentId) this.select(this.state.tracks[0]?.id ?? null);
  }
  select(id: string | null) {
    if (id && !this.state.tracks.some((t) => t.id === id)) return false;
    this.state.currentId = id;
    if (id) this.played.add(id);
    return true;
  }
  remove(id: string) {
    const index = this.state.tracks.findIndex((t) => t.id === id);
    this.state.tracks = this.state.tracks.filter((t) => t.id !== id);
    this.state.queue = this.state.queue.filter((i) => i !== id);
    for (const p of this.state.playlists) this.removeFromPlaylist(p.id, id);
    this.played.delete(id);
    this.history = this.history.filter((i) => i !== id);
    if (this.state.currentId === id)
      this.state.currentId =
        this.state.tracks[Math.min(index, this.state.tracks.length - 1)]?.id ??
        null;
  }
  reorder(id: string, index: number) {
    const at = this.state.tracks.findIndex((t) => t.id === id);
    if (at < 0) return;
    const [track] = this.state.tracks.splice(at, 1);
    this.state.tracks.splice(
      Math.max(0, Math.min(index, this.state.tracks.length)),
      0,
      track,
    );
  }
  setMode(mode: PlaylistState["mode"]) {
    this.state.mode = mode;
    this.played = new Set(this.state.currentId ? [this.state.currentId] : []);
    this.history = [];
  }
  next(automatic = false) {
    const tracks = this.playable,
      old = this.state.currentId;
    while (this.state.queue.length) {
      const id = this.state.queue.shift()!;
      if (
        this.state.tracks.some((t) => t.id === id && !t.error && !t.missing)
      ) {
        if (old && old !== id) this.history.push(old);
        this.history = this.history.slice(-256);
        this.select(id);
        return id;
      }
    }
    if (!tracks.length) return null;
    if (
      automatic &&
      this.state.repeat === "TRACK" &&
      tracks.some((t) => t.id === old)
    )
      return old;
    let next: string | undefined;
    if (this.state.mode === "SHUFFLE") {
      let candidates = tracks.filter((t) => !this.played.has(t.id));
      if (!candidates.length && this.state.repeat === "PLAYLIST") {
        this.played.clear();
        if (old && tracks.length > 1) this.played.add(old);
        candidates = tracks.filter((t) => !this.played.has(t.id));
      }
      next = candidates[Math.floor(this.random() * candidates.length)]?.id;
    } else {
      const at = this.selection.findIndex((t) => t.id === old);
      next = this.selection
        .slice(at + 1)
        .find((t) => !t.error && !t.missing)?.id;
      if (!next && this.state.repeat === "PLAYLIST") next = tracks[0]?.id;
    }
    if (next) {
      if (old && old !== next) this.history.push(old);
      if (this.history.length > 256) this.history.shift();
      this.select(next);
    }
    return next ?? null;
  }
  previous() {
    if (this.state.mode === "SHUFFLE") {
      let id: string | undefined;
      while ((id = this.history.pop()))
        if (this.playable.some((t) => t.id === id)) {
          this.select(id);
          return id;
        }
      return this.state.currentId;
    }
    const tracks = this.playable,
      at = tracks.findIndex((t) => t.id === this.state.currentId),
      id =
        tracks[at - 1]?.id ??
        (this.state.repeat === "PLAYLIST" ? tracks.at(-1)?.id : tracks[0]?.id);
    if (id) this.select(id);
    return id ?? null;
  }
  fail(id: string, message: string) {
    const t = this.state.tracks.find((t) => t.id === id);
    if (t) t.error = message;
  }
}
export function crossfadeDuration(
  requested: number,
  currentDuration: number,
  nextDuration: number,
) {
  return Math.max(
    0,
    Math.min(requested, currentDuration / 2, nextDuration / 2),
  );
}
export function duckGain(enabled: boolean, amount: number, remaining: number) {
  return enabled && remaining > 0 ? 1 - Math.max(0, Math.min(0.9, amount)) : 1;
}
export class MusicLibrary {
  token = "";
  private writes: Promise<unknown> = Promise.resolve();
  async init(): Promise<PlaylistState> {
    const session = await this.request("/api/session");
    this.token = session.token;
    return this.request("/api/music");
  }
  private async request(url: string, options: RequestInit = {}) {
    const r = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(this.token ? { "X-LiveDance-Token": this.token } : {}),
      },
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error ?? `Biblioteca: HTTP ${r.status}`);
    return data;
  }
  save(state: PlaylistState) {
    const snapshot = JSON.stringify(state);
    const op = this.writes
      .catch(() => {})
      .then(() =>
        this.request("/api/music", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: snapshot,
        }),
      );
    this.writes = op;
    return op;
  }
  import(file: File): Promise<MusicTrack> {
    return this.request("/api/music/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
    });
  }
  remove(id: string) {
    return this.request("/api/music/" + encodeURIComponent(id), {
      method: "DELETE",
    });
  }
  clear() {
    return this.request("/api/music", { method: "DELETE" });
  }
  openFolder() {
    return this.request("/api/music/open-folder", { method: "POST" });
  }
  url(id: string) {
    return "/api/music/" + encodeURIComponent(id) + "/audio";
  }
}
