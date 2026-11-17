import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  HeroCache,
  HeroVisual,
  clips,
  expressions,
  createHeroOrFallback,
} from "./asset";
import { CharacterCache, GLBRenderer } from "../character-engine/engine";
import { ProceduralAvatar, AvatarBatch, type AvatarVisual } from "../avatars";
import { World, defaults, type Dancer } from "../domain";
import "./lab.css";
const $ = (q: string) => document.querySelector(q) as HTMLElement,
  params = new URLSearchParams(location.search);
const select = (id: string, label: string, values: string[]) =>
  `<label>${label}<select id="${id}">${values.map((v) => `<option>${v}</option>`).join("")}</select></label>`;
$("#app").innerHTML =
  `<header><a href="#">LiveDance<span> / ART LAB</span></a><small>CHARACTER PACK 2 · UN AVATAR · EVALUACIÓN</small></header><main><aside><span class="eyebrow">HERO STUDY / 01</span><h1>Afterglow<br>Runner.</h1><p>Streetwear de fiesta. Silueta compacta, detalles cálidos y un ritmo propio.</p>${select("model", "Modelo", ["HERO", "PROCEDURAL", "PROTOTYPE"])}${select("camera", "Encuadre", ["FULL", "MEDIUM", "FEATURED", "VIP", "WIDE", "SIDE", "BACK"])}${select("clip", "Movimiento", clips)}${select("expression", "Expresión", expressions)}${select("lighting", "Luz", ["CALM", "GROOVE", "HYPE", "FEVER", "VIP"])}${select("palette", "Materiales", ["ORIGINAL", "PLUM", "BLUE"])}<details><summary>Medición / LOD</summary>${select("lod", "LOD", ["AUTO", "0", "1", "2"])}${select("count", "Copias de prueba", ["1", "10", "20", "30"])}${select("quality", "Calidad", ["MEDIUM", "LOW", "HIGH"])}<button id="pause">Pausa / continuar</button><pre id="stats"></pre></details><a class="party-link" href="/hero-party.html">Probar Follow / VIP en Afterglow</a><p class="hint">Arrastrá para orbitar · rueda para zoom.<br>Las copias son el mismo Hero, no variantes nuevas.</p></aside><section><div id="stage"><span class="stamp">ORIGINAL CHARACTER STUDY</span></div><footer><span id="caption">Preparando modelo…</span><span>NO MIGRA LIVE DANCE</span></footer></section></main>`;
const host = $("#stage"),
  renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor("#e2ddd4");
host.prepend(renderer.domElement);
let batch: AvatarBatch | undefined;
const scene = new T.Scene(),
  camera = new T.PerspectiveCamera(38, 1, 0.05, 80);
scene.background = new T.Color("#e2ddd4");
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1;
controls.maxDistance = 25;
controls.maxPolarAngle = Math.PI * 0.51;
const hemi = new T.HemisphereLight("#f1f6ff", "#92817a", 2.0),
  key = new T.DirectionalLight("#fff0da", 3.2),
  rim = new T.DirectionalLight("#9bccca", 2);
key.position.set(-3, 5, 5);
rim.position.set(3, 3, -3);
scene.add(hemi, key, rim);
const floor = new T.Mesh(
  new T.PlaneGeometry(100, 100),
  new T.MeshStandardMaterial({ color: "#d6d0c7", roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.012;
scene.add(floor);
const base = new T.Mesh(
  new T.CylinderGeometry(0.92, 0.98, 0.075, 64),
  new T.MeshStandardMaterial({ color: "#bbb9b3", roughness: 0.85 }),
);
base.position.y = -0.06;
scene.add(base);
const cache = new HeroCache(),
  oldCache = new CharacterCache(),
  errors: string[] = [],
  models: AvatarVisual[] = [],
  shadows: T.Mesh[] = [];
let model = params.get("model") ?? "HERO",
  quality = "MEDIUM",
  count = 1,
  view = "FULL",
  clip = "Idle",
  expression = "NEUTRAL",
  palette = 0,
  lod = -1,
  time = 0,
  freeze: number | null = null,
  frames: number[] = [],
  mixers: number[] = [],
  prev = performance.now();
const w = new World({ ...defaults });
w.bus.emit({
  schemaVersion: 1,
  eventId: "hero-fixture",
  source: "simulator",
  viewerId: "alma.curly",
  username: "alma.curly",
  eventType: "FOLLOW",
  giftCount: 1,
  timestamp: 0,
  metadata: {},
});
for (let i = 0; i < 250; i++) w.update(0.1, 0.1);
const d = {
  ...w.spawn.dancers.get("alma.curly")!,
  state: "DANCING",
  animationState: "Idle",
  heading: 0,
  position: { x: 0, y: 0, z: 0 },
  vipUntil: 0,
} as Dancer;
try {
  await cache.preload(
    params.has("fault")
      ? async () => {
          throw Error("Injected missing asset");
        }
      : undefined,
  );
} catch (e) {
  errors.push("Recovered: " + e);
}
await oldCache.preload();
function resize() {
  const ratio = quality === "HIGH" ? 1.5 : quality === "LOW" ? 0.65 : 1;
  renderer.setPixelRatio(ratio);
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
function frame(v: string) {
  view = v;
  const poses: Record<string, number[]> = {
    FULL: [0, 1.45, 6.7, 1.37],
    WIDE: [0, 3.7, count > 1 ? 15 : 8, 1.25],
    MEDIUM: [0, 2.0, 3.7, 1.7],
    FEATURED: [0.65, 2.38, 2.7, 2.15],
    VIP: [0.15, 2.36, 2.35, 2.3],
    SIDE: [5.1, 1.9, 0, 1.37],
    BACK: [0, 1.9, -5.1, 1.37],
  };
  const a = poses[v] ?? poses.FULL;
  camera.position.set(a[0], a[1], a[2]);
  controls.target.set(0, a[3], 0);
  controls.update();
}
function clear() {
  models.forEach((m) => m.dispose());
  models.length = 0;
  shadows.forEach((m) => {
    m.removeFromParent();
    m.geometry.dispose();
    (m.material as T.Material).dispose();
  });
  shadows.length = 0;
}
function spawn(n = 1) {
  clear();
  count = n;
  base.visible = count === 1;
  for (let i = 0; i < n; i++) {
    const m =
      model === "HERO"
        ? createHeroOrFallback(cache, "hero-" + i)
        : model === "PROTOTYPE"
          ? new GLBRenderer(oldCache)
          : new ProceduralAvatar("alma.curly");
    if (m instanceof ProceduralAvatar && !batch) batch = new AvatarBatch(scene);
    if (m instanceof GLBRenderer) m.reset("alma.curly");
    models.push(m);
    scene.add(m.root);
    const sh = new T.Mesh(
      new T.CircleGeometry(0.32, 24),
      new T.MeshBasicMaterial({
        color: "#343a3d",
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
      }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.001;
    scene.add(sh);
    shadows.push(sh);
  }
  if (count > 1) frame("WIDE");
}
function configure(o: any) {
  if (o.model !== undefined) model = o.model;
  if (o.count !== undefined || o.model !== undefined) spawn(o.count ?? count);
  if (o.view) frame(o.view);
  if (o.clip) clip = o.clip;
  if (o.expression) expression = o.expression;
  if (o.palette !== undefined) palette = o.palette;
  if (o.lod !== undefined) lod = o.lod;
  if (o.quality) {
    quality = o.quality;
    resize();
  }
  if (o.lighting) {
    const lights: Record<string, string> = {
      CALM: "#9bccca",
      GROOVE: "#55ddd1",
      HYPE: "#f778b3",
      FEVER: "#a377f7",
      VIP: "#ffc475",
    };
    rim.color.set(lights[o.lighting] ?? lights.CALM);
    key.color.set(o.lighting === "VIP" ? "#fff0bf" : "#fff0da");
    rim.intensity = o.lighting === "CALM" ? 2 : 2.8;
  }
  if (o.freeze !== undefined) freeze = o.freeze;
}
function stats() {
  const a = [...frames].sort((a, b) => a - b),
    mean = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length),
    mats = new Set<T.Material>();
  scene.traverse((o) => {
    if (o instanceof T.Mesh)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        mats.add(m),
      );
  });
  return {
    model,
    count,
    quality,
    view,
    clip,
    expression,
    lod,
    frameMs: mean,
    fps: 1000 / Math.max(0.01, mean),
    p95: a[Math.floor(a.length * 0.95)] ?? 0,
    max: a.at(-1) ?? 0,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    materials: mats.size,
    mixerMs: mixers.reduce((a, b) => a + b, 0) / Math.max(1, mixers.length),
    heap: (performance as any).memory?.usedJSHeapSize ?? null,
    width: renderer.domElement.width,
    height: renderer.domElement.height,
    proceduralParts: batch
      ? Object.values(batch.counts).reduce((a, b) => a + b, 0)
      : 0,
    actualHero: models.filter((m) => m instanceof HeroVisual).length,
    errors,
  };
}
function loop(now: number) {
  const dt = Math.min(0.08, (now - prev) / 1000);
  frames.push(now - prev);
  if (frames.length > 180) frames.shift();
  prev = now;
  time += dt;
  const t = freeze ?? time;
  let mixer = 0;
  models.forEach((m, i) => {
    const pos =
      count === 1
        ? { x: 0, y: 0, z: 0 }
        : { x: ((i % 6) - 2.5) * 1.1, y: 0, z: (Math.floor(i / 6) - 2) * 1.25 };
    const dd = {
      ...d,
      position: pos,
      animationState:
        clip === "Idle" ? "Idle" : clip === "Walk" ? "Walk" : "Groove",
    } as Dancer;
    if (m instanceof HeroVisual) {
      m.clip = clip;
      m.expression = expression;
      m.paletteIndex = palette;
      m.forceLOD =
        lod >= 0
          ? lod
          : count > 1
            ? 2
            : ["VIP", "FEATURED"].includes(view)
              ? 0
              : 1;
      m.update(dd, t + i * 0.09, freeze === null ? dt : 0.016);
      mixer += m.mixerMs;
    } else if (m instanceof GLBRenderer)
      m.update(dd, t, dt, {
        quality: "MEDIUM",
        distance: 5,
        forceLOD: lod >= 0 ? lod : 0,
        forceClip: clip === "Urban" ? "Electro" : clip,
        expression,
      });
    else m.update(dd, t, dt);
    shadows[i].position.x = pos.x;
    shadows[i].position.z = pos.z;
  });
  batch?.update(models);
  controls.update();
  renderer.render(scene, camera);
  mixers.push(mixer);
  if (mixers.length > 180) mixers.shift();
  if (Math.floor(now / 350) !== Math.floor((now - dt * 1000) / 350)) {
    $("#stats").textContent = JSON.stringify(stats(), null, 2);
    $("#caption").textContent =
      `${model} / ${clip} / ${expression} · ${count === 1 ? "HERO STUDY" : count + " COPIAS"}`;
  }
  requestAnimationFrame(loop);
}
document.addEventListener("change", (e) => {
  const el = e.target as HTMLSelectElement;
  configure(
    el.id === "model"
      ? { model: el.value }
      : el.id === "camera"
        ? { view: el.value }
        : el.id === "count"
          ? { count: Number(el.value) }
          : el.id === "lod"
            ? { lod: el.value === "AUTO" ? -1 : Number(el.value) }
            : el.id === "palette"
              ? { palette: el.selectedIndex }
              : { [el.id]: el.value },
  );
});
$("#pause").onclick = () => {
  freeze = freeze === null ? time : null;
};
addEventListener("error", (e) => errors.push(e.message));
addEventListener("unhandledrejection", (e) => errors.push(String(e.reason)));
spawn(1);
frame("FULL");
resize();
requestAnimationFrame(loop);
(window as any).__HeroLab = {
  configure,
  stats,
  models,
  cache,
  oldCache,
  scene,
  renderer,
  camera,
  controls,
  clear,
  clearSamples: () => {
    frames = [];
    mixers = [];
  },
  dispose: () => {
    clear();
    cache.dispose();
    oldCache.dispose();
  },
};
addEventListener("pagehide", () => {
  clear();
  cache.dispose();
  oldCache.dispose();
  batch?.dispose();
  controls.dispose();
  renderer.dispose();
});
