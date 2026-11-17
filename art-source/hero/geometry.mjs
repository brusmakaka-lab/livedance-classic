import * as T from "three";
export const clamp = T.MathUtils.clamp;
export function loft(rows, n = 24, sub = 2) {
  const curve = new T.CatmullRomCurve3(
    rows.map((r) => new T.Vector3(r[1], r[0], r[2])),
  );
  const centers = new T.CatmullRomCurve3(
    rows.map((r) => new T.Vector3(r[3] ?? 0, r[0], r[4] ?? 0)),
  );
  const p = [],
    idx = [],
    count = (rows.length - 1) * sub;
  for (let i = 0; i <= count; i++) {
    const a = curve.getPoint(i / count),
      c = centers.getPoint(i / count);
    for (let j = 0; j <= n; j++) {
      const t = (j / n) * Math.PI * 2;
      p.push(
        c.x + Math.cos(t) * Math.max(0.001, a.x),
        a.y,
        c.z + Math.sin(t) * Math.max(0.001, a.z),
      );
    }
  }
  for (let i = 0; i < count; i++)
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j,
        b = a + n + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  for (const [row, top] of [
    [0, false],
    [count, true],
  ]) {
    const c = centers.getPoint(row / count),
      a = curve.getPoint(row / count),
      ci = p.length / 3;
    p.push(c.x, a.y, c.z);
    for (let j = 0; j < n; j++) {
      const v = row * (n + 1) + j;
      idx.push(ci, top ? v + 1 : v, top ? v : v + 1);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function ellipsoid(x, y, z, rx, ry, rz, n = 20, h = 12) {
  const g = new T.SphereGeometry(1, n, h);
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}
export function tube(points, r = 0.01, segments = 18, sides = 6) {
  return new T.TubeGeometry(
    new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
    segments,
    r,
    sides,
    false,
  );
}
// Sculpted leaf-shaped lock following a curve, wide at middle, pointed ends.
export function lock(points, width, depth, steps = 14, sides = 8) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
    frames = curve.computeFrenetFrames(steps, false),
    p = [],
    idx = [];
  for (let i = 0; i <= steps; i++) {
    let u = i / steps,
      c = curve.getPoint(u),
      w = Math.pow(Math.sin(Math.PI * (0.07 + u * 0.9)), 0.65);
    for (let j = 0; j <= sides; j++) {
      let a = (j / sides) * Math.PI * 2,
        v = c
          .clone()
          .addScaledVector(frames.normals[i], Math.cos(a) * width * w)
          .addScaledVector(frames.binormals[i], Math.sin(a) * depth * w);
      p.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j,
        b = a + sides + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function patch(fn, nu = 24, nv = 12) {
  const p = [],
    idx = [];
  for (let i = 0; i <= nv; i++)
    for (let j = 0; j <= nu; j++) p.push(...fn(j / nu, i / nv));
  for (let i = 0; i < nv; i++)
    for (let j = 0; j < nu; j++) {
      let a = i * (nu + 1) + j,
        b = a + nu + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function morph(g, names, transform) {
  const p = g.getAttribute("position");
  g.morphTargetsRelative = true;
  g.morphAttributes.position = names.map((name, index) => {
    const arr = [];
    for (let i = 0; i < p.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(p, i),
        out = transform(v.clone(), name, index);
      arr.push(out.x - v.x, out.y - v.y, out.z - v.z);
    }
    const a = new T.Float32BufferAttribute(arr, 3);
    a.name = name;
    return a;
  });
  return g;
}
