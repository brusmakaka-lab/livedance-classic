import { inflateSync, deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(b) {
  let c = 0xffffffff;
  for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  t.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), data.length + 8);
  return out;
}
export function encodePNG(rgba) {
  const h = Buffer.alloc(13);
  h.writeUInt32BE(64);
  h.writeUInt32BE(64, 4);
  h[8] = 8;
  h[9] = 6;
  const raw = Buffer.alloc(64 * 257);
  for (let y = 0; y < 64; y++)
    Buffer.from(rgba).copy(raw, y * 257 + 1, y * 256, (y + 1) * 256);
  return Buffer.concat([
    signature,
    chunk("IHDR", h),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const hash = (b) => createHash("sha256").update(b).digest("hex");
const paeth = (a, b, c) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
export function decodePNG(bytes) {
  const b = Buffer.from(bytes);
  if (b.length > 1048576) throw Error("PNG demasiado grande: máximo 1 MiB");
  if (!b.subarray(0, 8).equals(signature))
    throw Error("El archivo no tiene firma PNG");
  let header,
    palette,
    alpha,
    idat = [],
    ended = false,
    afterData = false,
    pos = 8;
  while (pos < b.length) {
    if (pos + 12 > b.length) throw Error("PNG truncado");
    const n = b.readUInt32BE(pos),
      type = b.toString("ascii", pos + 4, pos + 8);
    if (n > b.length - pos - 12) throw Error("Chunk PNG truncado");
    const data = b.subarray(pos + 8, pos + 8 + n);
    if (crc32(b.subarray(pos + 4, pos + 8 + n)) !== b.readUInt32BE(pos + 8 + n))
      throw Error("CRC PNG inválido");
    if (!header && type !== "IHDR") throw Error("Falta cabecera PNG");
    if (["acTL", "fcTL", "fdAT"].includes(type))
      throw Error("No se admiten PNG animados");
    if (type === "IHDR") {
      if (header || n !== 13) throw Error("Cabecera PNG inválida");
      header = Buffer.from(data);
      if (data.readUInt32BE(0) !== 64 || data.readUInt32BE(4) !== 64)
        throw Error("La skin debe medir exactamente 64×64");
      if (data[10] !== 0 || data[11] !== 0 || data[12] > 1)
        throw Error("Compresión o entrelazado PNG inválido");
      if (
        ![0, 2, 3, 4, 6].includes(data[9]) ||
        !(data[9] === 3 ? [1, 2, 4, 8].includes(data[8]) : data[8] === 8)
      )
        throw Error("PNG requiere color de 8 bits o paleta de 1/2/4/8 bits");
    } else if (type === "PLTE") {
      if (idat.length || palette || n === 0 || n % 3 || n > 768)
        throw Error("Paleta PNG inválida");
      palette = Buffer.from(data);
    } else if (type === "tRNS") {
      if (idat.length || alpha) throw Error("Transparencia PNG fuera de orden");
      alpha = Buffer.from(data);
    } else if (type === "IDAT") {
      if (afterData) throw Error("IDAT no consecutivo");
      idat.push(data);
    } else if (type === "IEND") {
      if (n !== 0 || !idat.length) throw Error("Fin PNG inválido");
      pos += 12;
      ended = true;
      break;
    } else {
      if ((type.charCodeAt(0) & 32) === 0)
        throw Error("Chunk crítico PNG no admitido");
      if (idat.length) afterData = true;
    }
    pos += n + 12;
  }
  if (!ended || pos !== b.length)
    throw Error("PNG incompleto o con datos añadidos");
  const depth = header[8],
    type = header[9],
    channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type],
    bits = depth * channels,
    bpp = Math.max(1, Math.ceil(bits / 8));
  if (type === 3 && (!palette || palette.length / 3 > 2 ** depth))
    throw Error("Falta paleta válida");
  if (
    alpha &&
    ((type === 3 && alpha.length > palette.length / 3) ||
      (type === 0 && alpha.length !== 2) ||
      (type === 2 && alpha.length !== 6) ||
      [4, 6].includes(type))
  )
    throw Error("tRNS inválido");
  const passes = header[12]
    ? [
        [0, 0, 8, 8],
        [4, 0, 8, 8],
        [0, 4, 4, 8],
        [2, 0, 4, 4],
        [0, 2, 2, 4],
        [1, 0, 2, 2],
        [0, 1, 1, 2],
      ]
    : [[0, 0, 1, 1]];
  const expected = passes.reduce(
    (sum, [x, y, sx, sy]) =>
      sum +
      (1 + Math.ceil((Math.ceil((64 - x) / sx) * bits) / 8)) *
        Math.ceil((64 - y) / sy),
    0,
  );
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  } catch {
    throw Error("Datos comprimidos PNG inválidos o excesivos");
  }
  if (raw.length !== expected) throw Error("Tamaño descomprimido PNG inválido");
  const rgba = Buffer.alloc(64 * 64 * 4);
  let offset = 0;
  for (const [x0, y0, sx, sy] of passes) {
    const w = Math.ceil((64 - x0) / sx),
      h = Math.ceil((64 - y0) / sy),
      rowLen = Math.ceil((w * bits) / 8);
    let prev = Buffer.alloc(rowLen);
    for (let y = 0; y < h; y++) {
      const f = raw[offset++];
      if (f > 4) throw Error("Filtro PNG inválido");
      const row = Buffer.from(raw.subarray(offset, offset + rowLen));
      offset += rowLen;
      for (let i = 0; i < rowLen; i++) {
        const a = i >= bpp ? row[i - bpp] : 0,
          c = i >= bpp ? prev[i - bpp] : 0,
          up = prev[i];
        row[i] =
          (row[i] + [0, a, up, Math.floor((a + up) / 2), paeth(a, up, c)][f]) &
          255;
      }
      for (let x = 0; x < w; x++) {
        const dst = ((y0 + y * sy) * 64 + x0 + x * sx) * 4,
          k = x * channels;
        let r,
          g,
          bl,
          a = 255;
        if (type === 3) {
          const bit = x * depth,
            index =
              (row[Math.floor(bit / 8)] >> (8 - depth - (bit % 8))) &
              ((1 << depth) - 1);
          if (index * 3 >= palette.length)
            throw Error("Índice PNG fuera de paleta");
          r = palette[index * 3];
          g = palette[index * 3 + 1];
          bl = palette[index * 3 + 2];
          a = alpha?.[index] ?? 255;
        } else if (type === 0 || type === 4) {
          r = g = bl = row[k];
          a =
            type === 4
              ? row[k + 1]
              : alpha && row[k] === alpha.readUInt16BE(0)
                ? 0
                : 255;
        } else {
          r = row[k];
          g = row[k + 1];
          bl = row[k + 2];
          a =
            type === 6
              ? row[k + 3]
              : alpha &&
                  r === alpha.readUInt16BE(0) &&
                  g === alpha.readUInt16BE(2) &&
                  bl === alpha.readUInt16BE(4)
                ? 0
                : 255;
        }
        rgba.set([r, g, bl, a], dst);
      }
      prev = row;
    }
  }
  return rgba;
}
function rects(u, v, w, h, d) {
  return [
    [u, v + d, 2 * w + 2 * d, h],
    [u + d, v, 2 * w, d],
  ];
}
export function validateSkin(bytes, model, normalizeAlpha = false) {
  if (!["classic", "slim"].includes(model))
    throw Error("Elegí classic o slim explícitamente");
  const rgba = decodePNG(bytes),
    arm = model === "slim" ? 3 : 4;
  const base = [
      [0, 0, 8, 8, 8],
      [16, 16, 8, 12, 4],
      [40, 16, arm, 12, 4],
      [32, 48, arm, 12, 4],
      [0, 16, 4, 12, 4],
      [16, 48, 4, 12, 4],
    ],
    outer = [
      [32, 0, 8, 8, 8],
      [16, 32, 8, 12, 4],
      [40, 32, arm, 12, 4],
      [48, 48, arm, 12, 4],
      [0, 32, 4, 12, 4],
      [0, 48, 4, 12, 4],
    ];
  for (const part of base)
    for (const [x, y, w, h] of rects(...part))
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++)
          if (rgba[(yy * 64 + xx) * 4 + 3] !== 255)
            throw Error(
              "La capa base debe ser opaca en todas sus caras; revisá modelo classic/slim",
            );
  let partial = 0,
    visible = 0;
  for (const part of outer)
    for (const [x, y, w, h] of rects(...part))
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) {
          const k = (yy * 64 + xx) * 4 + 3,
            a = rgba[k];
          if (a > 0) visible++;
          if (a > 0 && a < 255) {
            partial++;
            if (normalizeAlpha) rgba[k] = a >= 128 ? 255 : 0;
          }
        }
  if (partial && !normalizeAlpha)
    throw Error(
      "La segunda capa tiene semitransparencia. Activá conversión a recorte para importarla conservando el original",
    );
  const normalized = encodePNG(rgba);
  return {
    normalized,
    hash: hash(normalized),
    originalHash: hash(bytes),
    alpha: { outerVisiblePixels: visible, convertedPixels: partial },
    rgba,
  };
}
