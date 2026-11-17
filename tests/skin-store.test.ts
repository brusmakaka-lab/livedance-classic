import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { decodePNG, encodePNG, validateSkin, crc32 } from "../scripts/skins/png.mjs";
import { Store } from "../scripts/skins/store.mjs";
const file = async (name = "coral") =>
  fs.readFile("public/integration/skins/" + name + ".png");
const chunk = (type, data) => {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length);
  b.write(type, 4);
  data.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
  return b;
};
function pngRaw(type, depth, raw, palette, alpha, interlace = 0) {
  const h = Buffer.alloc(13);
  h.writeUInt32BE(64);
  h.writeUInt32BE(64, 4);
  h[8] = depth;
  h[9] = type;
  h[12] = interlace;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    ...(palette ? [chunk("PLTE", palette)] : []),
    ...(alpha ? [chunk("tRNS", alpha)] : []),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
async function setup() {
  await fs.mkdir("temp", { recursive: true });
  const dir = await fs.mkdtemp(path.resolve("temp/store-"));
  const store = new Store(dir, path.resolve("public/integration/skins"), () => 0);
  await store.init();
  return { store, dir };
}
describe("PNG validation", () => {
  it("accepts original RGBA classic and slim and round-trips normalized pixels", async () => {
    for (const [name, model] of [
      ["coral", "classic"],
      ["nova", "slim"],
      ["milo", "classic"],
    ]) {
      const b = await file(name),
        v = validateSkin(b, model);
      expect(v.rgba.length).toBe(16384);
      expect(decodePNG(v.normalized)).toEqual(decodePNG(b));
      expect(v.alpha.convertedPixels).toBe(0);
    }
  });
  it("rejects fake, oversized, truncated, bad CRC and appended content", async () => {
    const b = await file(),
      bad = Buffer.from(b);
    bad[bad.length - 1] ^= 1;
    for (const x of [
      Buffer.from("not png"),
      Buffer.alloc(1048577),
      b.subarray(0, -3),
      bad,
      Buffer.concat([b, Buffer.from("extra")]),
    ])
      expect(() => decodePNG(x)).toThrow();
  });
  it("rejects dimensions before inflate", async () => {
    const b = Buffer.from(await file());
    b.writeUInt32BE(128, 16);
    b.writeUInt32BE(crc32(b.subarray(12, 29)), 29);
    expect(() => decodePNG(b)).toThrow("64×64");
  });
  it("rejects transparent base and invalid model", async () => {
    const pixels = decodePNG(await file());
    pixels[(8 * 64 + 8) * 4 + 3] = 0;
    expect(() => validateSkin(encodePNG(pixels), "classic")).toThrow("opaca");
    expect(() => validateSkin(awaitNothing(), "auto")).toThrow();
    function awaitNothing() {
      return Buffer.alloc(0);
    }
  });
  it("requires consent to normalize partial outer alpha and preserves base", async () => {
    const pixels = decodePNG(await file());
    pixels[(8 * 64 + 40) * 4 + 3] = 100;
    const bytes = encodePNG(pixels);
    expect(() => validateSkin(bytes, "classic")).toThrow("semitransparencia");
    const v = validateSkin(bytes, "classic", true);
    expect(v.alpha.convertedPixels).toBe(1);
    expect(v.rgba[(8 * 64 + 40) * 4 + 3]).toBe(0);
    expect(decodePNG(bytes)[(8 * 64 + 40) * 4 + 3]).toBe(100);
  });
  it("accepts RGB, palette with alpha, grayscale and Adam7 RGBA", () => {
    const rgb = pngRaw(
      2,
      8,
      Buffer.concat(
        Array.from({ length: 64 }, () =>
          Buffer.concat([Buffer.from([0]), Buffer.alloc(192, 201)]),
        ),
      ),
    );
    expect(decodePNG(rgb)[3]).toBe(255);
    const pal = pngRaw(
      3,
      1,
      Buffer.concat(
        Array.from({ length: 64 }, () =>
          Buffer.concat([Buffer.from([0]), Buffer.alloc(8, 255)]),
        ),
      ),
      Buffer.from([0, 0, 0, 3, 4, 5]),
      Buffer.from([0, 255]),
    );
    expect([...decodePNG(pal).subarray(0, 4)]).toEqual([3, 4, 5, 255]);
    const gray = pngRaw(
      0,
      8,
      Buffer.concat(
        Array.from({ length: 64 }, () =>
          Buffer.concat([Buffer.from([0]), Buffer.alloc(64, 77)]),
        ),
      ),
    );
    expect([...decodePNG(gray).subarray(0, 4)]).toEqual([77, 77, 77, 255]);
    const passes = [
        [0, 0, 8, 8],
        [4, 0, 8, 8],
        [0, 4, 4, 8],
        [2, 0, 4, 4],
        [0, 2, 2, 4],
        [1, 0, 2, 2],
        [0, 1, 1, 2],
      ],
      rows = [];
    for (const [x, y, sx, sy] of passes)
      for (let yy = y; yy < 64; yy += sy) {
        const row = [0];
        for (let xx = x; xx < 64; xx += sx) row.push(xx, yy, 127, 255);
        rows.push(Buffer.from(row));
      }
    const image = decodePNG(pngRaw(6, 8, Buffer.concat(rows), null, null, 1));
    expect([
      ...image.subarray((33 * 64 + 17) * 4, (33 * 64 + 17) * 4 + 4),
    ]).toEqual([17, 33, 127, 255]);
  });
  it("rejects APNG and decompression bombs", async () => {
    const b = await file(),
      anim = Buffer.concat([
        b.subarray(0, 33),
        chunk("acTL", Buffer.alloc(8)),
        b.subarray(33),
      ]);
    expect(() => decodePNG(anim)).toThrow("animados");
    expect(() => decodePNG(pngRaw(6, 8, Buffer.alloc(500000)))).toThrow(
      "excesivos",
    );
  });
});
describe("Library transactions and sessions", () => {
  it("rejects malformed metadata, duplicate IDs and dangling viewer references on recovery", async () => {
    const { store, dir } = await setup();
    await store.assign("one", "One");
    const valid = store.snapshot();
    for (const mutate of [
      (s) => (s.records[0].provenance = null),
      (s) => s.records.push(s.records[0]),
      (s) => (s.viewers[0].skinId = "missing"),
      (s) => s.bag.push("missing"),
      (s) => (s.revision = -1),
    ]) {
      const broken = structuredClone(valid);
      mutate(broken);
      expect(store.valid(broken)).toBe(false);
    }
    const broken = structuredClone(valid);
    broken.viewers[0].skinId = "missing";
    await fs.writeFile(path.join(dir, "index.json"), JSON.stringify(broken));
    const recovered = new Store(dir, path.resolve("public/integration/skins"));
    await recovered.init();
    expect(recovered.recovery).toBe("backup");
    expect(recovered.snapshot().records.length).toBe(3);
  });
  it("persists seeds and deduplicates PNG while keeping original provenance", async () => {
    const { store, dir } = await setup();
    const result = await store.import(
      {
        name: "again",
        model: "classic",
        author: "Test",
        source: "authorized fixture",
        license: "own",
        authorized: true,
      },
      await file(),
    );
    expect(result.duplicate).toBe(true);
    expect(store.snapshot().records.length).toBe(3);
    expect((await fs.readdir(path.join(dir, "originals"))).length).toBe(3);
    const reopened = new Store(dir, path.resolve("public/integration/skins"));
    await reopened.init();
    expect(reopened.snapshot().records).toEqual(store.snapshot().records);
  });
  it("bag has no immediate repeats including refill, deterministic random injectable", async () => {
    const { store } = await setup();
    const ids = [];
    for (let i = 0; i < 30; i++) ids.push(await store.random());
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    for (let i = 0; i < ids.length; i += 3)
      expect(new Set(ids.slice(i, i + 3)).size).toBe(3);
  });
  it("preserves ID assignment across name changes, concurrent imports and restart", async () => {
    const { store, dir } = await setup();
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        store.assign("id-" + i, "Viewer " + i),
      ),
    );
    const before = store.snapshot();
    await store.assign("id-1", "Renamed");
    expect(store.snapshot().viewers[1].skinId).toBe(before.viewers[1].skinId);
    const re = new Store(dir, path.resolve("public/integration/skins"));
    await re.init();
    expect(re.snapshot().viewers).toEqual(store.snapshot().viewers);
    expect(re.snapshot().sessionId).toBe(before.sessionId);
  });
  it("deleting active skin reassigns only affected viewers and preserves originals", async () => {
    const { store, dir } = await setup();
    for (let i = 0; i < 10; i++) await store.assign("v" + i, "v" + i);
    const before = store.snapshot(),
      id = before.viewers[0].skinId;
    const originalFiles = await fs.readdir(path.join(dir, "originals"));
    const r = await store.remove(id);
    expect(r.reassigned).toBe(
      before.viewers.filter((v) => v.skinId === id).length,
    );
    expect(store.snapshot().viewers.length).toBe(10);
    for (const v of before.viewers.filter((v) => v.skinId !== id))
      expect(store.snapshot().viewers.find((x) => x.id === v.id).skinId).toBe(
        v.skinId,
      );
    expect(await fs.readdir(path.join(dir, "originals"))).toEqual(
      originalFiles,
    );
    await store.assign("new-id", "New viewer");
    await store.random();
    const archived = await fs.readdir(path.join(dir, "removed"));
    const record = JSON.parse(
      await fs.readFile(path.join(dir, "removed", archived[0]), "utf8"),
    ).record;
    expect(record).toEqual(before.records.find((s) => s.id === id));
  });
  it("failed validation leaves index unchanged and missing authorization rejected", async () => {
    const { store, dir } = await setup(),
      before = await fs.readFile(path.join(dir, "index.json"), "utf8");
    await expect(
      store.import({ authorized: false }, await file()),
    ).rejects.toThrow("autorización");
    expect(await fs.readFile(path.join(dir, "index.json"), "utf8")).toBe(
      before,
    );
    await expect(store.assign("../escape", "bad")).rejects.toThrow("ID válido");
  });
  it("new session clears assignments, retains skins; final skin cannot be removed", async () => {
    const { store } = await setup();
    await store.assign("a", "A");
    const id = store.snapshot().sessionId;
    await store.resetSession();
    expect(store.snapshot().sessionId).not.toBe(id);
    expect(store.snapshot().viewers).toEqual([]);
    for (const r of store.snapshot().records.slice(0, 2))
      await store.remove(r.id);
    await expect(store.remove(store.snapshot().records[0].id)).rejects.toThrow(
      "al menos una",
    );
    const one = await store.random();
    expect(await store.random()).toBe(one);
  });
  it("recovers a valid backup without silently recreating corrupt data", async () => {
    const { store, dir } = await setup();
    await store.assign("one", "One");
    await store.assign("two", "Two");
    await fs.writeFile(path.join(dir, "index.json"), "{bad");
    const restored = new Store(dir, path.resolve("public/integration/skins"));
    await restored.init();
    expect(restored.recovery).toBe("backup");
    expect(restored.snapshot().viewers.map((v) => v.id)).toEqual(["one"]);
    await fs.writeFile(path.join(dir, "index.json"), "bad");
    await fs.writeFile(path.join(dir, "index.backup.json"), "bad");
    await expect(
      new Store(dir, path.resolve("public/integration/skins")).init(),
    ).rejects.toThrow("preservan");
  });
});

