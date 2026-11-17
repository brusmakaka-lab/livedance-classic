import * as T from "three";
export const HIP = "MixamoHipHopLoop",
  EXCITED = "MixamoDance2Loop";
/** Stable ensemble assignments. No generated motion or speed randomization. */
export function assignment(index: number, selected: string, mixed: boolean) {
  return {
    clip:
      mixed && index % 3 === 2 ? (selected === HIP ? EXCITED : HIP) : selected,
    offset: mixed && index ? (index % 5) * 0.37 : 0,
  };
}
export function placement(index: number, count: number, concert = false) {
  if (concert && index && count <= 10) {
    const spots = [
      [-2.6, -3.8],
      [2.6, -3.8],
      [-3.5, -7.6],
      [0, -7.1],
      [3.5, -7.6],
      [-2.25, -11.5],
      [2.25, -11.5],
      [-3.5, -15.2],
      [1, -15.2],
    ];
    const [x, z] = spots[index - 1];
    return new T.Vector3(x, 0, z);
  }
  if (concert && index) {
    const columns = count <= 12 ? 3 : count <= 20 ? 4 : 5;
    const row = Math.floor((index - 1) / columns),
      col = (index - 1) % columns;
    const actual = Math.min(columns, count - 1 - row * columns);
    const x = (col - (actual - 1) / 2) * 3.3 + (row % 2 ? 0.28 : -0.28);
    return new T.Vector3(
      x,
      0,
      -3.8 - row * 4.1 - (Math.abs(x) < 1.9 ? 0.9 : 0),
    );
  }
  if (!index) return new T.Vector3();
  if (count > 12) {
    const width = count <= 20 ? 4 : 5;
    const row = Math.floor((index - 1) / width),
      columns = Math.min(width, count - 1 - row * width);
    return new T.Vector3(
      (((index - 1) % width) - (columns - 1) / 2) * (width === 4 ? 3.6 : 3.2),
      0,
      width === 4 ? -4.8 - row * 4.7 : -3.5 - row * 4,
    );
  }
  let remaining = Math.min(count, 12) - 1,
    n = index - 1,
    row = 0;
  while (remaining > 0) {
    const columns = Math.min(row % 2 ? 3 : 2, remaining);
    if (n < columns)
      return new T.Vector3(
        (n - (columns - 1) / 2) * (row % 2 ? 3.1 : 4.4),
        0,
        -4.1 - row * 4.3,
      );
    n -= columns;
    remaining -= columns;
    row++;
  }
  return new T.Vector3(0, 0, -40);
}
const envelopes = new Map<string, T.Vector3[]>();
/** Fit conservative full-motion envelopes, including head accessories, in the vertical safe area. */
export function widePose(
  count: number,
  aspect: number,
  fov: number,
  sway = 0,
  concert = false,
) {
  const key = count + ":" + concert;
  let points = envelopes.get(key);
  if (!points) {
    points = [];
    for (let i = 0; i < Math.min(count, 30); i++) {
      const p = placement(i, count, concert);
      for (const x of [-1.4, 1.4])
        for (const y of [-0.04, 3.35])
          for (const z of [-0.85, 0.85])
            points.push(p.clone().add(new T.Vector3(x, y, z)));
    }
    envelopes.set(key, points);
  }
  const bounds = new T.Box3().setFromPoints(points),
    look = bounds.getCenter(new T.Vector3());
  const back = new T.Vector3(sway, 0.46, 0.888).normalize();
  const right = new T.Vector3()
    .crossVectors(new T.Vector3(0, 1, 0), back)
    .normalize();
  const up = new T.Vector3().crossVectors(back, right);
  const tanY = Math.tan(T.MathUtils.degToRad(fov / 2)),
    tanX = tanY * aspect;
  let distance = 9;
  const v = new T.Vector3();
  for (const p of points) {
    v.copy(p).sub(look);
    const depth = v.dot(back);
    distance = Math.max(
      distance,
      depth + Math.abs(v.dot(right)) / (tanX * 0.88),
      depth + Math.abs(v.dot(up)) / (tanY * 0.84),
    );
  }
  return { position: look.clone().addScaledVector(back, distance), look };
}
export const smooth = (x: number) => {
  const t = T.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
export function showEnvelope(kind: string | undefined, age: number) {
  if (kind === "vip")
    return smooth(age / 1.2) * (1 - smooth((age - 5.7) / 2.3));
  if (kind === "fever")
    return smooth(age / 2) * (1 - smooth((age - 8.5) / 3.5));
  return 0;
}
export function showPhase(kind: string | undefined, age: number) {
  if (kind === "vip")
    return age < 1.2 ? "ENTRADA" : age < 5.7 ? "PROTAGONISTA" : "REGRESO";
  if (kind === "fever")
    return age < 2 ? "INICIO" : age < 8.5 ? "CLÍMAX" : "SALIDA";
  return "NORMAL";
}
