import * as T from "three";
export const mapping = {
  Hips: "Hips",
  Spine: "Spine1",
  Chest: "Spine2",
  Neck: "Neck",
  Head: "Head",
  LClavicle: "RightShoulder",
  LArm: "RightArm",
  LForearm: "RightForeArm",
  LHand: "RightHand",
  RClavicle: "LeftShoulder",
  RArm: "LeftArm",
  RForearm: "LeftForeArm",
  RHand: "LeftHand",
  LThigh: "RightUpLeg",
  LShin: "RightLeg",
  LFoot: "RightFoot",
  RThigh: "LeftUpLeg",
  RShin: "LeftLeg",
  RFoot: "LeftFoot",
};
const v = () => new T.Vector3(),
  q = () => new T.Quaternion(),
  down = new T.Vector3(0, -1, 0);
export function retarget(source, target) {
  const sb = {},
    tb = {};
  source.traverse((o) => {
    if (o.isBone) sb[o.name.replace(/^mixamorig/, "")] = o;
  });
  target.traverse((o) => {
    if (o.isBone) tb[o.name] = o;
  });
  for (const [to, from] of Object.entries(mapping))
    if (!tb[to] || !sb[from]) throw Error(`Missing mapping ${from} → ${to}`);
  const meshes = [];
  target.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
  });
  meshes[0].skeleton.pose();
  source.updateMatrixWorld(true);
  target.updateMatrixWorld(true);
  const bind = {};
  for (const name of Object.values(mapping))
    bind[name] = sb[name].getWorldQuaternion(q());
  const sourceHipRest = sb.Hips.position.clone(),
    sourceLegLength =
      sb.RightUpLeg.getWorldPosition(v()).distanceTo(
        sb.RightLeg.getWorldPosition(v()),
      ) +
      sb.RightLeg.getWorldPosition(v()).distanceTo(
        sb.RightFoot.getWorldPosition(v()),
      );
  const scale = 0.96 / sourceLegLength;
  // Target model names L/R are screen-side, opposite Mixamo's anatomical names.
  // A pose → T pose reference, without changing inverse bind matrices or geometry.
  tb.LArm.rotation.z = -Math.PI / 2;
  tb.RArm.rotation.z = Math.PI / 2;
  target.updateMatrixWorld(true);
  const offsets = {};
  for (const [to, from] of Object.entries(mapping))
    offsets[to] = bind[from]
      .clone()
      .invert()
      .multiply(tb[to].getWorldQuaternion(q()));
  meshes[0].skeleton.pose();
  target.updateMatrixWorld(true);
  const ordered = [];
  target.traverse((o) => {
    if (o.isBone) ordered.push(o);
  });
  const clip = source.animations[0],
    duration = clip.duration,
    frames = Math.round(duration * 30) + 1;
  const mixer = new T.AnimationMixer(source),
    action = mixer.clipAction(clip).setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const samples = [];
  for (let i = 0; i < frames; i++) {
    const t = Math.min(i / 30, duration);
    mixer.setTime(t);
    source.updateMatrixWorld(true);
    const rotations = {},
      positions = {};
    for (const [name, b] of Object.entries(sb)) {
      rotations[name] = b.getWorldQuaternion(q());
      positions[name] = b.getWorldPosition(v());
    }
    samples.push({ t, rotations, positions });
  }
  const center = samples[0].positions.Hips.clone();
  center.y = 0;
  const footNames = ["RightFoot", "LeftFoot"],
    mins = footNames.map((n) =>
      Math.min(...samples.map((s) => s.positions[n].y)),
    );
  const rawFeet = samples.map((s) =>
    footNames.map((n, i) => {
      const p = s.positions[n].clone().sub(center).multiplyScalar(scale);
      p.x +=
        (i ? 1 : -1) *
        (0.23 -
          Math.abs(sb[i ? "LeftUpLeg" : "RightUpLeg"].position.x) * scale);
      return p;
    }),
  );
  const contacts = footNames.map((name, side) =>
    samples.map((s, i) => {
      const a = rawFeet[Math.max(0, i - 1)][side],
        b = rawFeet[Math.min(frames - 1, i + 1)][side];
      const speed = Math.hypot(b.x - a.x, b.z - a.z) * 15;
      return s.positions[name].y < mins[side] + 3 && speed < 0.24;
    }),
  );
  const locks = [[], []];
  for (let side = 0; side < 2; side++) {
    let start = -1;
    for (let i = 0; i <= frames; i++) {
      if (i < frames && contacts[side][i]) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        if (i - start >= 3) {
          const anchor = v();
          for (let k = start; k < i; k++) anchor.add(rawFeet[k][side]);
          anchor.divideScalar(i - start);
          // Integrate the no-slip constraint at the current support corner.
          // The fulcrum can migrate heel-to-toe as the imported foot rotates.
          const rotationAt = (k) =>
            samples[k].rotations[footNames[side]]
              .clone()
              .multiply(offsets[side ? "RFoot" : "LFoot"])
              .normalize();
          const supportPath = [rawFeet[start][side].clone()];
          for (let k = start + 1; k < i; k++) {
            const previous = rotationAt(k - 1),
              current = rotationAt(k);
            const mid = previous.clone().slerp(current, 0.5);
            // Flat soles have an area of support, not a numerically arbitrary
            // corner. Center that axis within a 0.002 scene-unit height tolerance.
            const axisX = new T.Vector3(1, 0, 0).applyQuaternion(mid).y;
            const axisZ = new T.Vector3(0, 0, 1).applyQuaternion(mid).y;
            const solePoint = new T.Vector3(
              Math.abs(axisX) * 0.35 < 0.002 ? 0 : -Math.sign(axisX) * 0.175,
              -0.1175,
              Math.abs(axisZ) * 0.55 < 0.002
                ? 0.08
                : axisZ > 0
                  ? -0.195
                  : 0.355,
            );
            supportPath.push(
              supportPath
                .at(-1)
                .clone()
                .add(solePoint.clone().applyQuaternion(previous))
                .sub(solePoint.clone().applyQuaternion(current)),
            );
          }
          const centering = v();
          for (let k = start; k < i; k++)
            centering.add(rawFeet[k][side]).sub(supportPath[k - start]);
          centering.divideScalar(i - start);
          supportPath.forEach((p) => p.add(centering));
          locks[side].push({ start, end: i - 1, anchor, supportPath });
        } else for (let k = start; k < i; k++) contacts[side][k] = false;
        start = -1;
      }
    }
  }
  const values = {};
  for (const b of ordered) values[b.name] = [];
  const hips = [],
    times = [];
  let maxHipCorrection = 0,
    maxReachError = 0,
    maxLockCorrection = 0,
    maxRotationTransferError = 0;
  const perFrame = [];
  const floorHeight = (rotation) => {
    let min = Infinity;
    for (const x of [-0.185, 0.185])
      for (const y of [-0.118, 0.13])
        for (const z of [-0.195, 0.355])
          min = Math.min(
            min,
            new T.Vector3(x, y, z).applyQuaternion(rotation).y,
          );
    return -min + 0.006;
  };
  for (let i = 0; i < frames; i++) {
    const s = samples[i];
    meshes[0].skeleton.pose();
    tb.Hips.position.copy(s.positions.Hips).sub(center).multiplyScalar(scale);
    // Mixamo's upper-leg origins sit below Hips; Río's origins are at its pelvis.
    const thighOffset =
      (s.positions.RightUpLeg.y + s.positions.LeftUpLeg.y) * 0.5 -
      s.positions.Hips.y;
    tb.Hips.position.y =
      (s.positions.Hips.y + thighOffset) * scale +
      0.123 -
      (mins[0] + mins[1]) * 0.5 * scale;
    target.updateMatrixWorld(true);
    for (const b of ordered) {
      const from = mapping[b.name];
      if (!from) continue;
      const world = s.rotations[from].clone().multiply(offsets[b.name]);
      b.quaternion
        .copy(b.parent.getWorldQuaternion(q()).invert())
        .multiply(world);
      b.updateMatrixWorld(true);
      if (!/Thigh|Shin|Foot/.test(b.name))
        maxRotationTransferError = Math.max(
          maxRotationTransferError,
          world
            .clone()
            .normalize()
            .angleTo(b.getWorldQuaternion(q()).normalize()),
        );
    }
    const targets = footNames.map((name, side) => {
      const p = rawFeet[i][side].clone(),
        rotation = s.rotations[name]
          .clone()
          .multiply(offsets[side ? "RFoot" : "LFoot"]);
      const lock = locks[side].find((l) => i >= l.start && i <= l.end);
      if (lock) {
        const u = Math.min(1, (i - lock.start) / 5, (lock.end - i) / 5),
          blend = u * u * (3 - 2 * u),
          before = p.clone();
        const support = lock.supportPath[i - lock.start];
        p.x = T.MathUtils.lerp(p.x, support.x, blend);
        p.z = T.MathUtils.lerp(p.z, support.z, blend);
        maxLockCorrection = Math.max(
          maxLockCorrection,
          Math.hypot(p.x - before.x, p.z - before.z),
        );
      }
      const lift = contacts[side][i]
        ? 0
        : Math.max(0, (s.positions[name].y - mins[side]) * scale);
      p.y = floorHeight(rotation) + lift;
      return { p, rotation };
    });
    const originalY = tb.Hips.position.y;
    for (let side = 0; side < 2; side++) {
      const hip = tb[side ? "RThigh" : "LThigh"].getWorldPosition(v()),
        f = targets[side].p,
        dx = hip.x - f.x,
        dz = hip.z - f.z,
        vertical = Math.sqrt(Math.max(0.01, 0.955 ** 2 - dx * dx - dz * dz));
      tb.Hips.position.y = Math.min(
        tb.Hips.position.y,
        f.y + vertical - (hip.y - tb.Hips.position.y),
      );
      target.updateMatrixWorld(true);
    }
    maxHipCorrection = Math.max(
      maxHipCorrection,
      originalY - tb.Hips.position.y,
    );
    for (let side = 0; side < 2; side++) {
      const prefix = side ? "R" : "L",
        sn = side ? "Left" : "Right",
        thigh = tb[prefix + "Thigh"],
        shin = tb[prefix + "Shin"],
        foot = tb[prefix + "Foot"],
        hip = thigh.getWorldPosition(v()),
        f = targets[side].p;
      const delta = f.clone().sub(hip),
        distance = delta.length(),
        len = T.MathUtils.clamp(distance, 0.02, 0.9599),
        dir = delta.normalize();
      maxReachError = Math.max(maxReachError, Math.abs(distance - len));
      const along = (0.49 ** 2 - 0.47 ** 2 + len ** 2) / (2 * len),
        height = Math.sqrt(Math.max(0, 0.49 ** 2 - along ** 2));
      const sourceHip = s.positions[sn + "UpLeg"],
        sourceKnee = s.positions[sn + "Leg"],
        sourceFoot = s.positions[sn + "Foot"];
      const sourceDir = sourceFoot.clone().sub(sourceHip).normalize(),
        pole = sourceKnee.clone().sub(sourceHip);
      pole.addScaledVector(sourceDir, -pole.dot(sourceDir));
      if (pole.lengthSq() < 0.001) pole.set(0, 0, 1);
      pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      const knee = hip
          .clone()
          .addScaledVector(dir, along)
          .addScaledVector(pole, height),
        upper = q().setFromUnitVectors(down, knee.clone().sub(hip).normalize()),
        lower = q().setFromUnitVectors(down, f.clone().sub(knee).normalize());
      thigh.quaternion
        .copy(thigh.parent.getWorldQuaternion(q()).invert())
        .multiply(upper);
      shin.quaternion.copy(upper).invert().multiply(lower);
      foot.quaternion.copy(lower).invert().multiply(targets[side].rotation);
      tb[prefix + "Toe"].quaternion.identity();
    }
    target.updateMatrixWorld(true);
    times.push(s.t);
    hips.push(...tb.Hips.position.toArray());
    for (const b of ordered) {
      const a = b.quaternion.clone();
      const arr = values[b.name];
      if (
        arr.length &&
        new T.Quaternion().fromArray(arr, arr.length - 4).dot(a) < 0
      )
        a.set(-a.x, -a.y, -a.z, -a.w);
      arr.push(...a.toArray());
    }
    perFrame.push({
      t: s.t,
      hips: tb.Hips.position.toArray(),
      feet: ["LFoot", "RFoot"].map((n) =>
        tb[n].getWorldPosition(v()).toArray(),
      ),
      contact: contacts.map((a) => a[i]),
    });
  }
  const tracks = [
    new T.VectorKeyframeTrack("Hips.position", times, hips),
    ...ordered.map(
      (b) =>
        new T.QuaternionKeyframeTrack(
          b.name + ".quaternion",
          times,
          values[b.name],
        ),
    ),
  ];
  const raw = new T.AnimationClip("MixamoHipHop", duration, tracks);
  // Preserve every imported sample; loop seam is a separate optional clip, clearly reported.
  const looped = raw.clone();
  looped.name = "MixamoHipHopLoop";
  const seam = 0.3;
  for (const tr of looped.tracks) {
    const size = tr.getValueSize();
    for (let i = 0; i < tr.times.length; i++) {
      const u = T.MathUtils.clamp(
          (tr.times[i] - (duration - seam)) / seam,
          0,
          1,
        ),
        w = u * u * (3 - 2 * u);
      if (!w) continue;
      if (size === 4) {
        const a = q().fromArray(tr.values, i * 4),
          b = q().fromArray(tr.values, 0);
        a.slerp(b, w).toArray(tr.values, i * 4);
      } else
        for (let j = 0; j < size; j++)
          tr.values[i * size + j] = T.MathUtils.lerp(
            tr.values[i * size + j],
            tr.values[j],
            w,
          );
    }
  }
  const metrics = {
    sourceClip: clip.name,
    duration,
    frames,
    sampleFPS: 30,
    sourceLegLength,
    scale,
    mapping,
    sourceInitialCenter: center.toArray(),
    contacts: locks.map((ls) =>
      ls.map((l) => ({
        start: l.start / 30,
        end: l.end / 30,
        anchor: l.anchor.toArray(),
        supportPath: l.supportPath.map((p) => p.toArray()),
      })),
    ),
    maxHipCorrection,
    maxReachError,
    maxLockCorrection,
    maxRotationTransferError,
    seamSeconds: seam,
    perFrame,
  };
  mixer.stopAllAction();
  mixer.uncacheRoot(source);
  meshes[0].skeleton.pose();
  target.updateMatrixWorld(true);
  if (maxReachError > 0.005 || maxHipCorrection > 0.2)
    throw Error(
      "Retarget exceeds safe adaptation budget: " +
        JSON.stringify({ maxReachError, maxHipCorrection }),
    );
  return { raw, looped, metrics };
}
