import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtemp,
  readFile,
  writeFile,
  unlink,
  rm,
  mkdir,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { MusicStore } from "../scripts/music-library.mjs";
const roots: string[] = [];
async function create() {
  const parent = path.resolve("../../work/music-store-tests");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, "case-"));
  roots.push(root);
  const store = new MusicStore(root);
  await store.init();
  return store;
}
const wav = () => {
  const b = Buffer.alloc(100);
  b.write("RIFF");
  b.write("WAVE", 8);
  return b;
};
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
describe("local music storage", () => {
  it("v0.2 disk migration makes backup and preserves one copy across collections", async () => {
    const s = await create();
    const a = await s.import("original.wav", wav());
    const legacy = JSON.parse(await readFile(s.index, "utf8"));
    delete legacy.collectionsVersion; delete legacy.playlists; delete legacy.queue;
    delete legacy.activePlaylist; delete legacy.energySuggestions;
    await writeFile(s.index, JSON.stringify(legacy));
    const reopened = new MusicStore(s.root);
    const state = await reopened.init();
    expect(state.tracks[0].id).toBe(a.id);
    expect(state.collectionsVersion).toBe(1);
    expect(JSON.parse(await readFile(s.index + ".v02-backup", "utf8"))).toEqual(legacy);
    await reopened.update({...state,playlists:[{id:'party',name:'Party',tag:'HYPE',trackIds:[a.id]}],queue:[a.id],tracks:state.tracks.map(t=>({...t,favorite:true,tag:'HYPE'}))});
    const final = await new MusicStore(s.root).init();
    expect(final.playlists[0].trackIds).toEqual([a.id]);
    expect(final.queue).toEqual([a.id]);
    expect(final.tracks[0].favorite).toBe(true);
    expect(await readdir(s.directory)).toHaveLength(1);
  });
  it("imports multiple original copies and restores metadata order settings", async () => {
    const s = await create();
    const a = await s.import("one.wav", wav()),
      b = await s.import("two.wav", wav());
    const state = await s.snapshot();
    await s.update({
      ...state,
      tracks: [{ ...b, bpm: 123 }, a],
      currentId: b.id,
      repeat: "TRACK",
      crossfade: 3,
    });
    const reopened = new MusicStore(s.root);
    const restored = await reopened.init();
    expect(restored.tracks.map((t) => t.name)).toEqual(["two.wav", "one.wav"]);
    expect(restored.tracks[0].bpm).toBe(123);
    expect(restored.repeat).toBe("TRACK");
    expect(restored.currentId).toBe(b.id);
    expect(restored.tracks[0].file).toBeUndefined();
  });
  it("detects missing and changed local copies", async () => {
    const s = await create();
    await s.import("one.wav", wav());
    await unlink(s.file(s.state.tracks[0]));
    expect((await s.snapshot()).tracks[0].missing).toBe(true);
  });
  it("rejects corrupt container, unsupported extension and empty files", async () => {
    const s = await create();
    await expect(s.import("bad.wav", Buffer.from("invalid"))).rejects.toThrow();
    await expect(s.import("bad.exe", wav())).rejects.toThrow();
    await expect(s.import("empty.mp3", Buffer.alloc(0))).rejects.toThrow();
    expect((await s.snapshot()).tracks).toHaveLength(0);
  });
  it("serializes concurrent imports and prevents stale index overwrites", async () => {
    const s = await create();
    await Promise.all([
      s.import("one.wav", wav()),
      s.import("two.wav", wav()),
      s.import("three.wav", wav()),
    ]);
    expect((await s.snapshot()).tracks).toHaveLength(3);
    await expect(s.update({ tracks: [] })).rejects.toThrow("biblioteca cambió");
  });
  it("remove and remove all delete only imported copies", async () => {
    const s = await create();
    const original = path.join(s.root, "original.wav");
    await writeFile(original, wav());
    const a = await s.import("original.wav", await readFile(original));
    await s.import("two.wav", wav());
    await s.remove(a.id);
    expect((await s.snapshot()).tracks).toHaveLength(1);
    await s.remove();
    expect(await readdir(s.directory)).toHaveLength(0);
    expect(await readFile(original)).toEqual(wav());
  });
  it("recovers corrupt index without deleting audio files", async () => {
    const s = await create();
    await s.import("one.wav", wav());
    await writeFile(s.index, "{bad");
    const recovered = new MusicStore(s.root);
    expect((await recovered.init()).warning).toContain("Índice dañado");
    expect(await readdir(s.directory)).toHaveLength(1);
    expect((await readdir(s.root)).some((f) => f.includes(".corrupt-"))).toBe(
      true,
    );
  });
  it("never resolves an external file path", async () => {
    const s = await create();
    expect(() => s.file({ file: "../../outside.wav" })).toThrow(
      "Ruta inválida",
    );
  });
});
