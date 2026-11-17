import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BlockAvatar, BlockBatch } from "./rig";
import {
  appearance,
  clips,
  accessories,
  momentAt,
  hash,
  type Clip,
  type Proportion,
  type EventKind,
} from "./core";
import "./lab.css";
const $ = (q: string) => document.querySelector(q) as HTMLElement;
const select = (id: string, label: string, values: readonly string[]) =>
  `<label>${label}<select id="${id}">${values.map((x) => `<option>${x}</option>`).join("")}</select></label>`;
$("#app").innerHTML =
  `<header><strong><i>✦</i> LiveDance <span>BLOCK LAB</span></strong><span class="tag">EXPERIMENT 01 · INDEPENDENT</span></header><main><aside><span class="eyebrow">CHARACTER DIRECTION / 03</span><h1>Small blocks.<br>Big energy.</h1><p>Una identidad propia.<br>Un lugar en la fiesta.</p><label>Viewer ID<input id="viewer" value="bruno.live" maxlength="64" aria-label="Viewer ID"></label><div class="row"><button id="identity">Presentar viewer</button><button id="random" title="Randomize Appearance">↻</button></div>${select("clip", "Coreografía", clips)}${select("mode", "Crowd", ["FREE", "GROUP"])}${select("count", "Personajes", ["1", "10", "20", "30"])}<div class="divider"></div><span class="eyebrow">MOMENTS</span><div class="events"><button data-event="FOLLOW">↗ Follow Entrance</button><button data-event="HERO">✦ Hero Moment</button><button data-event="VIP">♛ VIP Moment</button></div><button id="random10">Randomize 10</button><details><summary>Art / camera lab</summary>${select("proportion", "Proporciones", ["C", "A", "B"])}${select("camera", "Cámara", ["FULL", "WIDE", "ENTRANCE", "FEATURED", "GROUP", "VIP", "BACK", "SIDE"])}${select("lighting", "Iluminación", ["CLUB", "FEATURED", "VIP", "FEVER"])}${select("accessory", "Accesorio", ["AUTO", ...accessories])}<label><input type="checkbox" id="reduce"> Reduce motion</label><button id="pause">Pausa / continuar</button><button id="reset">Reset scene</button></details></aside><section class="preview"><div id="stage"></div><footer><span id="status">FREE DANCE</span><span>9:16 / LIVE CANVAS</span></footer></section><aside class="inspector"><span class="eyebrow">IDENTITY CARD</span><h2 id="name"></h2><p id="palette"></p><div id="swatches"></div><p class="note">Mismo ID, misma apariencia.<br>Un rig. Geometría compartida.</p><div class="divider"></div><span class="eyebrow">ON THE FLOOR</span><div id="roster"></div><details open><summary>Diagnostics</summary><pre id="metrics"></pre></details><a href="/block-compare.html">Comparar A / B / C / D ↗</a><p class="note">Estudio visual original.<br>No modifica LiveDance estable.</p></aside></main>`;
const host = $("#stage"),
  scene = new T.Scene(),
  camera = new T.PerspectiveCamera(40, 9 / 16, 0.05, 100),
  renderer = new T.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
renderer.setPixelRatio(1);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
host.append(renderer.domElement);
scene.background = new T.Color("#091727");
scene.fog = new T.Fog("#091727", 24, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 1.8;
controls.maxDistance = 36;
const hemi = new T.HemisphereLight("#e3f9ff", "#28354f", 2.1),
  key = new T.DirectionalLight("#ffe4cd", 3.3),
  rim = new T.DirectionalLight("#59dcd1", 2.3);
key.position.set(-3, 6, 7);
rim.position.set(4, 4, -4);
scene.add(hemi, key, rim);
const ownedGeometry: T.BufferGeometry[] = [],
  ownedMaterials: T.Material[] = [],
  textures: T.Texture[] = [];
function material(c: string, lit = true) {
  const m = lit
    ? new T.MeshStandardMaterial({ color: c, roughness: 0.83 })
    : new T.MeshBasicMaterial({ color: c });
  ownedMaterials.push(m);
  return m;
}
function object(
  g: T.BufferGeometry,
  m: T.Material,
  x: number,
  y: number,
  z: number,
) {
  ownedGeometry.push(g);
  const o = new T.Mesh(g, m);
  o.position.set(x, y, z);
  scene.add(o);
  return o;
}
const floor = object(
  new T.CircleGeometry(24, 80),
  material("#13283a"),
  0,
  -0.016,
  0,
);
floor.rotation.x = -Math.PI / 2;
for (const r of [2.5, 5.6, 8.3]) {
  const o = object(
    new T.RingGeometry(r, r + 0.028, 80),
    material("#2d5963", false),
    0,
    -0.012,
    0,
  );
  o.rotation.x = -Math.PI / 2;
}
const backMat = material("#20374b"),
  lightMat = material("#64e1ca", false);
for (let i = 0; i < 9; i++) {
  object(
    new T.BoxGeometry(0.36, 2.3 + (i % 3) * 0.5, 0.4),
    backMat,
    (i - 4) * 1.4,
    1,
    -7,
  );
  object(
    new T.BoxGeometry(0.12, 1.7, 0.04),
    lightMat,
    (i - 4) * 1.4,
    1.2,
    -6.76,
  );
}
const portal = new T.Group();
portal.position.set(-1.6, 0, 2);
scene.add(portal);
const portalMat = material("#7aefcf", false);
for (const [x, y, w, h] of [
  [-0.62, 1.45, 0.055, 2.9],
  [0.62, 1.45, 0.055, 2.9],
  [0, 2.9, 1.3, 0.055],
]) {
  const g = new T.BoxGeometry(w, h, 0.06);
  ownedGeometry.push(g);
  const m = new T.Mesh(g, portalMat);
  m.position.set(x, y, 0);
  portal.add(m);
}
portal.visible = false;
const beamMat = new T.MeshBasicMaterial({
  color: "#7bf4d2",
  transparent: true,
  opacity: 0.045,
  depthWrite: false,
  side: T.DoubleSide,
});
ownedMaterials.push(beamMat);
const beam = object(
  new T.CylinderGeometry(0.64, 0.74, 4.5, 32, 1, true),
  beamMat,
  0,
  2.25,
  0,
);
beam.visible = false;
const discMat = new T.MeshBasicMaterial({
  color: "#a9fadd",
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
});
ownedMaterials.push(discMat);
const disc = object(new T.RingGeometry(0.7, 0.74, 64), discMat, 0, 0.007, 0);
disc.rotation.x = -Math.PI / 2;
disc.visible = false;
const shadowG = new T.CircleGeometry(0.38, 20),
  shadowM = new T.MeshBasicMaterial({
    color: "#03080d",
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
ownedGeometry.push(shadowG);
ownedMaterials.push(shadowM);
const shadowBatch = new T.InstancedMesh(shadowG, shadowM, 30);
shadowBatch.frustumCulled = false;
shadowBatch.count = 0;
scene.add(shadowBatch);
function labelTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  return c;
}
const labelCanvas = labelTexture(),
  labelTex = new T.CanvasTexture(labelCanvas);
labelTex.colorSpace = T.SRGBColorSpace;
textures.push(labelTex);
const labelMat = new T.SpriteMaterial({
  map: labelTex,
  depthTest: false,
  depthWrite: false,
  transparent: true,
});
ownedMaterials.push(labelMat);
const label = new T.Sprite(labelMat);
label.scale.set(2.1, 0.525, 1);
label.renderOrder = 10;
scene.add(label);
let cameraMoving = false;
let labelKey = "";
function writeLabel(id: string, event: string) {
  if (id + "|" + event === labelKey) return;
  labelKey = id + "|" + event;
  const c = labelCanvas.getContext("2d")!;
  c.clearRect(0, 0, 1024, 256);
  c.fillStyle = "#0c172de8";
  c.beginPath();
  c.roundRect(12, 12, 1000, 222, 38);
  c.fill();
  c.textAlign = "center";
  c.fillStyle = event.includes("VIP") ? "#f9d47d" : "#a0eed2";
  c.font = "bold 35px Segoe UI";
  c.fillText(event, 512, 80);
  c.fillStyle = "#fff8ed";
  let size = 70;
  do {
    c.font = `bold ${size--}px Segoe UI`;
  } while (c.measureText("@" + id).width > 940 && size > 20);
  c.fillText("@" + id, 512, 177, 940);
  labelTex.needsUpdate = true;
}
const batch = new BlockBatch(scene),
  avatars: BlockAvatar[] = [];
let ids = ["bruno.live"],
  proportion: Proportion = "C",
  clip: Clip = "Groove",
  mode = "FREE",
  view = "FULL",
  lighting = "CLUB",
  time = 0,
  freeze: number | null = null,
  reduce = false,
  active: { kind: EventKind; start: number } | null = null,
  frames: number[] = [],
  previous = performance.now(),
  disposed = false,
  raf = 0,
  random = 0;
const positions: T.Vector3[] = [];
const cameraTarget = new T.Vector3(),
  cameraDesired = new T.Vector3();
function frame(v: string, instant = true) {
  cameraMoving = !instant;
  view = v;
  const n = avatars.length;
  const poses: Record<string, number[]> = {
    FULL: [0.55, 1.75, 6.7, 1.35],
    WIDE: [0, n > 20 ? 9 : 6, n > 20 ? 25 : 20, 1.0],
    GROUP: [0, 5.5, 20, 1.0],
    ENTRANCE: [-1.6, 2.8, 10, 1.4],
    FEATURED: [0.6, 2.6, 7.6, 1.45],
    VIP: [0.2, 2.5, 7.4, 1.55],
    BACK: [0, 1.8, -6.7, 1.35],
    SIDE: [6.7, 1.8, 0, 1.35],
  };
  const p = poses[v] || poses.FULL;
  cameraDesired.set(v === "ENTRANCE" && !active ? 0 : p[0], p[1], p[2]);
  cameraTarget.set(
    v === "ENTRANCE" && active ? -1.6 : 0,
    p[3],
    v === "ENTRANCE" && active
      ? 2
      : ["WIDE", "GROUP"].includes(v)
        ? (-Math.floor((n - 1) / 5) * 1.65) / 2
        : 0,
  );
  if (["WIDE", "GROUP"].includes(v)) cameraDesired.z += cameraTarget.z;
  if (instant) {
    camera.position.copy(cameraDesired);
    controls.target.copy(cameraTarget);
    controls.update();
  }
}
function clear() {
  avatars.forEach((a) => a.dispose());
  avatars.length = 0;
  positions.length = 0;
  batch.update([]);
  shadowBatch.count = 0;
  active = null;
  beam.visible = portal.visible = disc.visible = label.visible = false;
}
function spawn(next: string[]) {
  clear();
  ids = [...new Set(next)].slice(0, 30);
  for (let i = 0; i < ids.length; i++) {
    const a = new BlockAvatar(ids[i], proportion);
    avatars.push(a);
    scene.add(a.root);
    const x = ids.length === 1 ? 0 : ((i % 5) - 2) * 1.48,
      z = ids.length === 1 ? 0 : -Math.floor(i / 5) * 1.65;
    positions.push(new T.Vector3(x, 0, z));
    a.root.position.copy(positions[i]);
  }
  if (ids.length > 1) frame("WIDE");
  else frame("FULL");
  identity();
}
function identity() {
  const s = avatars[0]?.skin;
  if (!s) return;
  $("#name").textContent = "@" + s.viewerId;
  $("#palette").textContent = s.palette + " / " + s.accessory;
  $("#swatches").innerHTML = [
    s.tone,
    s.hair,
    s.top,
    s.shirt,
    s.pants,
    s.shoes,
    s.accent,
  ]
    .map((c) => `<i style="background:${c}"></i>`)
    .join("");
  $("#roster").textContent = ids
    .slice(0, 10)
    .map((x) => "@" + x)
    .join("  ·  ");
  ($("#count") as HTMLSelectElement).value = String(ids.length);
}
function event(kind: EventKind) {
  if (active && avatars[0]) avatars[0].setAccessory(avatars[0].skin.accessory);
  if (!avatars.length) spawn(["bruno.live"]);
  if (avatars.length === 1)
    spawn([ids[0], ...Array.from({ length: 9 }, (_, i) => "guest." + (i + 1))]);
  active = { kind, start: time };
  if (kind === "VIP") avatars[0].setAccessory("crown");
  frame(kind === "FOLLOW" ? "ENTRANCE" : "GROUP", false);
}
function configure(o: any) {
  if (o.proportion) proportion = o.proportion;
  if (o.ids || o.count !== undefined || o.proportion)
    spawn(
      o.ids ??
        Array.from({ length: o.count ?? ids.length }, (_, i) =>
          i === 0 ? (o.viewerId ?? ids[0] ?? "bruno.live") : "viewer." + i,
        ),
    );
  if (o.viewerId && !o.ids && o.count === undefined)
    spawn([o.viewerId, ...ids.slice(1)]);
  if (o.clip) clip = o.clip;
  if (o.mode) mode = o.mode;
  if (o.view) frame(o.view);
  if (o.freeze !== undefined) freeze = o.freeze;
  if (o.reduce !== undefined) reduce = o.reduce;
  if (o.accessory)
    avatars[0]?.setAccessory(
      o.accessory === "AUTO" ? avatars[0].skin.accessory : o.accessory,
    );
  if (o.lighting) {
    lighting = o.lighting;
    key.color.set(lighting === "VIP" ? "#ffe6b5" : "#ffe4cd");
    rim.color.set(lighting === "FEVER" ? "#fa65a5" : "#59dcd1");
    rim.intensity = lighting === "FEVER" ? 3 : 2.3;
  }
  if (o.event) event(o.event);
  if (o.eventTime !== undefined && active)
    active.start = (freeze ?? time) - o.eventTime;
  for (const [id, value] of Object.entries({
    clip,
    mode,
    camera: view,
    proportion,
    lighting,
  })) {
    ($("#" + id) as HTMLSelectElement).value = String(value);
  }
  identity();
}
function stats() {
  const a = [...frames].sort((x, y) => x - y),
    mean = frames.reduce((x, y) => x + y, 0) / Math.max(1, frames.length);
  const m = new Set<T.Material>();
  scene.traverse((o) => {
    const v = o as T.Mesh;
    if (v.material)
      (Array.isArray(v.material) ? v.material : [v.material]).forEach((x) =>
        m.add(x),
      );
  });
  return {
    count: avatars.length,
    appearances: new Set(
      avatars.map((a) => JSON.stringify({ ...a.skin, viewerId: "", seed: 0 })),
    ).size,
    clip,
    mode,
    view,
    lighting,
    instances: batch.mesh.count,
    fps: 1000 / mean,
    mean,
    p95: a[Math.floor(a.length * 0.95)] ?? 0,
    samples: a.length,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    materials: m.size,
    textures: renderer.info.memory.textures,
    heap: (performance as any).memory?.usedJSHeapSize ?? null,
    event: active
      ? momentAt(active.kind, (freeze ?? time) - active.start)
      : null,
  };
}
const shadowDummy = new T.Object3D(),
  v = new T.Vector3();
function render(now: number) {
  if (disposed) return;
  raf = requestAnimationFrame(render);
  const elapsed = Math.min(0.05, (now - previous) / 1000);
  frames.push(now - previous);
  if (frames.length > 600) frames.shift();
  previous = now;
  if (freeze === null) time += elapsed;
  const t = freeze ?? time,
    dt = freeze === null ? elapsed : 1;
  const ev = active ? momentAt(active.kind, t - active.start) : null;
  if (ev && !ev.active) {
    avatars[0]?.setAccessory(avatars[0].skin.accessory);
    active = null;
    frame(avatars.length === 1 ? "FULL" : "WIDE", false);
  }
  portal.visible = !!(ev?.active && ev.kind === "FOLLOW" && ev.seconds < 5);
  beam.visible = disc.visible = !!ev?.active;
  beamMat.color.set(ev?.kind === "VIP" ? "#ffd27c" : "#7bf4d2");
  discMat.color.copy(beamMat.color);
  for (let i = 0; i < avatars.length; i++) {
    const a = avatars[i];
    let motion = clip;
    v.copy(positions[i]);
    let yaw = 0,
      scale = 1,
      walkTime: number | null = null;
    if (ev?.active) {
      if (i === 0) {
        motion = ev.clip;
        if (ev.kind === "FOLLOW") {
          if (ev.stage === "APPEAR") {
            v.set(-1.6, 0, 2);
            scale = T.MathUtils.smoothstep(ev.seconds, 0.15, 0.65);
          } else if (ev.stage === "WALK") {
            v.lerpVectors(
              new T.Vector3(-1.6, 0, 2),
              new T.Vector3(0, 0, 0.7),
              T.MathUtils.smoothstep(ev.seconds, 2, 5),
            );
            yaw = Math.atan2(1.6, -1.3);
            walkTime =
              v.distanceTo(new T.Vector3(-1.6, 0, 2)) / ((0.9 * 112) / 60);
          } else if (ev.stage === "JOIN") {
            v.lerpVectors(
              new T.Vector3(0, 0, 0.7),
              positions[i],
              T.MathUtils.smoothstep(ev.seconds, 13, 18),
            );
            yaw = Math.atan2(positions[i].x, positions[i].z - 0.7);
            walkTime =
              v.distanceTo(new T.Vector3(0, 0, 0.7)) / ((0.9 * 112) / 60);
          } else v.set(0, 0, 0.7);
        } else {
          const enter = T.MathUtils.smoothstep(ev.seconds, 0, 3),
            exit = T.MathUtils.smoothstep(ev.seconds, 11, 16);
          v.lerpVectors(
            positions[i],
            new T.Vector3(0, 0, 0.7),
            enter * (1 - exit),
          );
        }
      } else if (i < 10) {
        const angle = -1.2 + ((i - 1) * 2.4) / 8;
        const ring = new T.Vector3(
          Math.sin(angle) * 3.5,
          0,
          -Math.cos(angle) * 2.2 - 1.3,
        );
        const enter = T.MathUtils.smoothstep(ev.seconds, 0, 3),
          exit = T.MathUtils.smoothstep(
            ev.seconds,
            ev.kind === "FOLLOW" ? 13 : 11,
            ev.duration,
          );
        v.lerp(ring, enter * (1 - exit));
        motion =
          enter < 1 || exit > 0 ? "Walk" : i % 3 === 0 ? "Cheer" : "Groove";
        yaw = -Math.atan2(ring.x, 1 - ring.z) * 0.35;
      }
    }
    a.root.position.copy(v);
    a.root.rotation.y = yaw;
    a.root.scale.setScalar(scale);
    const phase =
      mode === "GROUP" || (ev?.active && i === 0)
        ? 0
        : (hash(a.skin.viewerId) % 1000) / 157;
    a.update(reduce ? "Idle" : motion, walkTime ?? t + phase, dt);
    shadowDummy.position.set(v.x, 0.001, v.z);
    shadowDummy.rotation.set(-Math.PI / 2, 0, 0);
    shadowDummy.scale.set(1.2 * scale, 0.85 * scale, 1);
    shadowDummy.updateMatrix();
    shadowBatch.setMatrixAt(i, shadowDummy.matrix);
  }
  shadowBatch.count = avatars.length;
  shadowBatch.instanceMatrix.needsUpdate = true;
  batch.update(avatars);
  const subject = avatars[0];
  label.visible = !!subject && (avatars.length === 1 || !!ev?.active);
  if (subject) {
    label.position.copy(subject.root.position).add(new T.Vector3(0, 2.9, 0));
    writeLabel(
      subject.skin.viewerId,
      ev?.active
        ? ev.kind === "FOLLOW"
          ? "NEW FOLLOWER"
          : ev.kind === "VIP"
            ? "VIP SPOTLIGHT"
            : "YOUR MOMENT"
        : "LIVE DANCE BLOCKS",
    );
    beam.position.set(subject.root.position.x, 2.25, subject.root.position.z);
    disc.position.set(subject.root.position.x, 0.007, subject.root.position.z);
    disc.scale.setScalar(reduce ? 1 : 1 + 0.055 * Math.sin(t * 5));
  }
  if (ev?.active && ev.kind === "FOLLOW" && ev.seconds < 13 && subject) {
    cameraTarget.set(subject.root.position.x, 1.45, subject.root.position.z);
    cameraDesired.set(
      subject.root.position.x + 0.35,
      2.65,
      subject.root.position.z + 7.8,
    );
  }
  if (active || cameraMoving) {
    const k = reduce ? 1 : 1 - Math.exp(-elapsed * 2.7);
    camera.position.lerp(cameraDesired, k);
    controls.target.lerp(cameraTarget, k);
    if (camera.position.distanceTo(cameraDesired) < 0.01) cameraMoving = false;
  }
  if (
    ev?.active &&
    ev.seconds > (ev.kind === "FOLLOW" ? 13 : 11) &&
    !["GROUP", "WIDE"].includes(view)
  )
    frame("GROUP", false);
  if (
    ev?.active &&
    ev.seconds > 3 &&
    ev.seconds < 11 &&
    (view === "ENTRANCE" || view === "GROUP")
  )
    frame(ev.kind === "VIP" ? "VIP" : "FEATURED", false);
  controls.update();
  renderer.render(scene, camera);
  if (Math.floor(now / 500) !== Math.floor((now - elapsed * 1000) / 500)) {
    $("#metrics").textContent =
      `${stats().fps.toFixed(1)} FPS · ${stats().p95.toFixed(1)} ms p95\n${avatars.length} viewers / ${batch.mesh.count} parts\n${renderer.info.render.calls} draws / ${renderer.info.render.triangles.toLocaleString()} tris`;
    $("#status").textContent = ev?.active
      ? ev.kind + " / " + ev.stage
      : mode + " DANCE";
  }
}
function resize() {
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
}
const observer = new ResizeObserver(resize);
observer.observe(host);
for (const id of [
  "clip",
  "mode",
  "count",
  "proportion",
  "camera",
  "lighting",
  "accessory",
])
  $("#" + id).addEventListener("change", (e) =>
    configure({
      [id === "camera" ? "view" : id]: (e.target as HTMLSelectElement).value,
    }),
  );
$("#identity").onclick = () => {
  const id = ($("#viewer") as HTMLInputElement).value.trim();
  if (id) configure({ viewerId: id });
};
$("#random").onclick = () => {
  const id = "guest." + Date.now().toString(36) + "." + ++random;
  ($("#viewer") as HTMLInputElement).value = id;
  configure({ viewerId: id });
};
$("#random10").onclick = () =>
  configure({
    ids: Array.from({ length: 10 }, (_, i) => "party." + ++random + "." + i),
  });
$("#pause").onclick = () => (freeze = freeze === null ? time : null);
$("#reset").onclick = () => {
  freeze = null;
  configure({
    ids: ["bruno.live"],
    clip: "Groove",
    mode: "FREE",
    proportion: "C",
    view: "FULL",
  });
};
$("#reduce").onchange = (e) =>
  (reduce = (e.target as HTMLInputElement).checked);
document
  .querySelectorAll("[data-event]")
  .forEach((e) =>
    e.addEventListener("click", () =>
      event((e as HTMLElement).dataset.event as EventKind),
    ),
  );
function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(raf);
  observer.disconnect();
  clear();
  batch.dispose();
  shadowBatch.dispose();
  ownedGeometry.forEach((g) => g.dispose());
  ownedMaterials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
  controls.dispose();
  renderer.dispose();
}
spawn(ids);
resize();
raf = requestAnimationFrame(render);
(window as any).__BlockLab = {
  configure,
  event,
  stats,
  avatars,
  batch,
  scene,
  camera,
  renderer,
  controls,
  clear,
  dispose,
  clearSamples: () => (frames = []),
  appearance,
  poseTime: () => freeze ?? time,
};
