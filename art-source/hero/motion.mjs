import * as T from "three";
export const clipNames = [
  "Idle",
  "Walk",
  "Groove",
  "Shuffle",
  "Urban",
  "Wave",
  "Cheer",
  "VIP",
];
export const spec = [
  ["root", null, 0, 0, 0],
  ["hips", "root", 0, 1.1, 0],
  ["spine", "hips", 0, 0.25, 0],
  ["chest", "spine", 0, 0.3, 0],
  ["neck", "chest", 0, 0.2, 0],
  ["head", "neck", 0, 0.45, 0],
  ...["left", "right"].flatMap((s, i) => {
    const x = i ? 1 : -1;
    return [
      [s + "Shoulder", "chest", x * 0.22, 0.03, 0],
      [s + "UpperArm", s + "Shoulder", x * 0.13, 0, 0],
      [s + "LowerArm", s + "UpperArm", x * 0.09, -0.33, 0],
      [s + "Hand", s + "LowerArm", x * 0.015, -0.3, 0],
      [s + "UpperLeg", "hips", x * 0.17, -0.06, 0],
      [s + "LowerLeg", s + "UpperLeg", 0, -0.43, 0],
      [s + "Foot", s + "LowerLeg", 0, -0.43, 0.055],
    ];
  }),
];
// Offline planar two-link leg solve. Feet remain planted during groove/idle;
// Walk has a support sweep and a lifted return, appropriate for in-place navigation.
export function legPose(hipY, ankleY, ankleZ) {
  const dy = hipY - (ankleY - 0.01),
    dz = ankleZ,
    L1 = 0.43,
    L2 = Math.hypot(0.43, 0.055),
    d = Math.min(L1 + L2 - 0.0001, Math.hypot(dy, dz));
  const k = Math.acos(
    T.MathUtils.clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1),
  );
  const upper =
      Math.atan2(-dz, dy) - Math.atan2(L2 * Math.sin(k), L1 + L2 * Math.cos(k)),
    knee = k + Math.atan2(0.055, 0.43);
  return [upper, knee, -upper - knee];
}
export function makeClips() {
  return clipNames.map((name) => {
    const duration = {
        Idle: 4,
        Walk: 1.1,
        Groove: 2.1,
        Shuffle: 1.8,
        Urban: 2.4,
        Wave: 2.4,
        Cheer: 2.0,
        VIP: 3.2,
      }[name],
      N = 121,
      qs = Object.fromEntries(spec.map((s) => [s[0], []])),
      hips = [],
      times = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1),
        a = u * Math.PI * 2,
        s = Math.sin(a),
        c = Math.cos(a),
        q = Object.fromEntries(spec.map((s) => [s[0], [0, 0, 0]]));
      let bob = -0.025,
        hipX = 0;
      let footZ = [0.055, 0.055],
        footY = [0.18, 0.18];
      q.chest = [0.01 * s, 0.018 * s, 0.013 * s];
      q.head = [
        0.018 * Math.sin(a - 0.4),
        0.035 * Math.sin(a - 0.8),
        0.012 * s,
      ];
      if (name === "Idle") {
        bob = -0.024 + 0.005 * s;
        q.leftUpperArm[2] = -0.035;
        q.rightUpperArm[2] = 0.035;
      }
      if (name === "Walk") {
        bob = -0.035 + 0.014 * Math.cos(a * 2);
        for (let side = 0; side < 2; side++) {
          const phase = (u + side * 0.5) % 1;
          footZ[side] =
            0.055 +
            (phase < 0.5 ? 0.18 - 0.72 * phase : -0.18 + 0.72 * (phase - 0.5));
          footY[side] =
            0.18 +
            (phase < 0.5 ? 0 : 0.105 * Math.sin((phase - 0.5) * Math.PI * 2));
        }
        q.leftUpperArm = [-0.3 * s, 0, -0.06];
        q.rightUpperArm = [0.3 * s, 0, 0.06];
        q.leftLowerArm[0] = -0.13;
        q.rightLowerArm[0] = -0.13;
        q.chest[1] = 0.07 * s;
      }
      if (name === "Groove") {
        bob = -0.065 + 0.035 * Math.cos(2 * a);
        q.spine[2] = 0.065 * s;
        q.chest = [0.04 * Math.cos(a - 0.5), 0.16 * s, -0.09 * s];
        q.leftUpperArm = [-0.32 - 0.12 * c, 0, -0.24 - 0.13 * s];
        q.rightUpperArm = [-0.32 + 0.12 * c, 0, 0.24 - 0.13 * s];
        q.leftLowerArm[0] = -0.72 + 0.2 * Math.sin(a - 0.4);
        q.rightLowerArm[0] = -0.72 - 0.2 * Math.sin(a - 0.4);
        q.head[1] = -0.07 * s;
      }
      if (name === "Shuffle") {
        bob = -0.045 + 0.018 * Math.cos(a * 2);
        for (let side = 0; side < 2; side++) {
          const x = a + side * Math.PI;
          footZ[side] = 0.055 + 0.17 * Math.cos(x);
          footY[side] = 0.18 + 0.075 * Math.max(0, Math.sin(x));
        }
        q.chest = [0.06, 0.08 * s, 0.035 * s];
        q.leftUpperArm = [-0.35 * s, 0, -0.12];
        q.rightUpperArm = [0.35 * s, 0, 0.12];
        q.leftLowerArm[0] = -0.45;
        q.rightLowerArm[0] = -0.45;
      }
      if (name === "Urban") {
        const hit = Math.pow((Math.sin(a * 2) + 1) / 2, 3);
        bob = -0.09 + 0.055 * hit;
        q.chest = [0.04 + 0.09 * hit, 0.23 * Math.sin(a - 0.2), 0.07 * s];
        q.leftUpperArm = [-0.5 - 0.35 * s, -0.15, -0.48];
        q.rightUpperArm = [-0.5 + 0.35 * s, 0.15, 0.48];
        q.leftLowerArm[0] = -1.0 - 0.35 * c;
        q.rightLowerArm[0] = -1.0 + 0.35 * c;
        q.head[0] = -0.09 * hit;
      }
      if (name === "Wave") {
        const e = Math.sin(Math.PI * u) ** 2;
        bob = -0.025;
        q.rightUpperArm = [-0.18 * e, 0, 2.0 * e];
        q.rightLowerArm = [-0.2 * e, 0, 0.6 * e];
        q.rightHand[2] = 0.3 * Math.sin(a * 3) * e;
        q.chest[2] = -0.045 * e;
        q.head[2] = -0.08 * e;
      }
      if (name === "Cheer") {
        const e = 0.5 - 0.5 * c;
        bob = -0.04 - 0.045 * Math.sin(a) ** 2;
        q.leftUpperArm = [-0.35 * e, 0, -2.3 * e];
        q.rightUpperArm = [-0.35 * e, 0, 2.3 * e];
        q.leftLowerArm[0] = -0.25 * e;
        q.rightLowerArm[0] = -0.25 * e;
        q.chest[0] = -0.07 * e;
      }
      if (name === "VIP") {
        bob = -0.04 + 0.006 * s;
        q.chest[1] = -0.12;
        q.head[1] = 0.17;
        q.head[2] = -0.06;
        q.leftUpperArm = [-0.1, 0, -0.48];
        q.leftLowerArm = [-1.1, 0, 0.32];
        q.rightUpperArm = [-0.2, 0, 0.2];
        q.rightLowerArm = [-0.45, 0, -0.28];
      }
      for (let side = 0; side < 2; side++) {
        const prefix = side ? "right" : "left",
          l = legPose(1.04 + bob, footY[side], footZ[side]);
        q[prefix + "UpperLeg"][0] = l[0];
        q[prefix + "LowerLeg"][0] = l[1];
        q[prefix + "Foot"][0] = l[2];
      }
      times.push(u * duration);
      hips.push(hipX, 1.1 + bob, 0);
      for (const [bone, rot] of Object.entries(q)) {
        const quat = new T.Quaternion().setFromEuler(new T.Euler(...rot));
        qs[bone].push(quat.x, quat.y, quat.z, quat.w);
      }
    }
    const tracks = spec.map(
      (s) =>
        new T.QuaternionKeyframeTrack(s[0] + ".quaternion", times, qs[s[0]]),
    );
    tracks.push(new T.VectorKeyframeTrack("hips.position", times, hips));
    return new T.AnimationClip(name, duration, tracks);
  });
}
