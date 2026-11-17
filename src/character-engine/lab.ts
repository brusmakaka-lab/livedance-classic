import * as THREE from 'three';
import {
  CharacterEngine,
  GLBRenderer,
  animationMap,
  expressions,
  identity,
  rendererFor,
  type RendererMode,
  type Handle,
  type VisualContext,
} from "./engine";
import {
  World,
  defaults,
  SlotAllocator,
  type Dancer,
  type Quality,
  type LiveEvent,
} from "../domain";
import { SceneManager } from "../scene";
import { ProceduralAvatar } from "../avatars";
import * as T from "three";
import "./lab.css";
const params = new URLSearchParams(location.search),
  $ = (q: string) => document.querySelector(q) as HTMLElement;
let mode = (params.get("renderer") ?? "PROCEDURAL") as RendererMode,
  quality = (params.get("quality") ?? "MEDIUM") as Quality,
  cam = "WIDE",
  rotation = 0,
  zoom = 8,
  expression = "AUTO",
  forceClip = "",
  forceLOD = -1,
  palette = -1,
  hair = -1,
  accessory = -1,
  light = "CALM",
  frozen: number | null = null;
const select = (id: string, label: string, values: string[], value: string) =>
  `<label>${label}<select id="${id}">${values.map((v) => `<option ${v === value ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
$("#lab").innerHTML =
  `<header><b>LiveDance / Character Lab</b><span>PROTOTIPO AISLADO · SIMULACIÓN · NO ES v0.3.2 RELEASE</span></header><main><aside><h1>Character Engine 2.0</h1><p>Mismo escenario y gameplay. Comparación de renderers antes de decidir una migración.</p>${select("renderer", "Renderer", ["PROCEDURAL", "GLB", "AUTO"], mode)}${select("quality", "Quality", ["LOW", "MEDIUM", "HIGH"], quality)}<label>Viewer seed<input id="seed" value="alma.curly"></label><div class="buttons">${[1, 10, 20, 30].map((n) => `<button data-count="${n}">${n} avatars</button>`).join("")}</div>${select("camera", "Camera", ["WIDE", "CLOSE", "DIRECTOR"], "WIDE")}<label>Rotate<input id="rotate" type="range" min="-180" max="180" value="0"></label><label>Zoom<input id="zoom" type="range" min="5" max="15" value="8" step=".1"></label>${select("expression", "Expression", ["AUTO", ...expressions], "AUTO")}${select("animation", "Animation", ["AUTO", ...new Set(Object.values(animationMap)), "Wave", "Cheer", "Jump", "Celebrate", "Heart", "Shock", "VIP", "Top"], "AUTO")}${select("lod", "LOD", ["AUTO", "0", "1", "2"], "AUTO")}${select("light", "Lighting", ["CALM", "GROOVE", "HYPE", "FEVER", "VIP"], "CALM")}<details><summary>Variantes de laboratorio</summary>${select("palette", "Skin / outfit palette", ["SEED", "0", "1", "2", "3"], "SEED")}${select("hair", "Hair", ["SEED", "0", "1", "2", "3", "4", "5", "6", "7"], "SEED")}${select("accessory", "Accessory", ["SEED", "0", "1", "2"], "SEED")}</details><div class="buttons">${["Follow", "LOW", "VIP", "Top", "Goal", "Fever", "Reaction", "DUO", "TRIO", "GROUP", "ALL", "Exit", "Reset"].map((x) => `<button data-event="${x}">${x}</button>`).join("")}</div><button id="warm">Warmup bounded</button><button id="freeze">Freeze / resume</button><p id="loading">Precargando pack…</p><pre id="stats"></pre><details><summary>Diagnostics</summary><pre id="logs"></pre></details></aside><section><div id="stage"><span class="badge">SIMULACIÓN · CHARACTER LAB</span><div id="upper"></div><div id="lower"></div></div><p id="caption"></p></section></main>`;
const engine = new CharacterEngine(),
  world = new World({
    ...defaults,
    quality,
    adaptive: false,
    inactivity: 3600,
    cameraAuto: false,
    maxDancers: 30,
  }),
  scene = new SceneManager($("#stage"), world),
  handles = new Map<string, Handle>();
scene.presentation.config.branding = false;
const originalCamera = (scene as any).updateCamera.bind(scene);
(scene as any).updateCamera = (dt: number) => {
  if (cam === "DIRECTOR") {
    world.config.cameraAuto = true;
    originalCamera(dt);
    return;
  }
  world.config.cameraAuto = false;
  if (cam === "WIDE") {
    originalCamera(dt);
    return;
  }
  const d = world.spawn.dancers.values().next().value as Dancer | undefined;
  const x = (d?.position.x ?? 0) * 0.88,
    z = (d?.position.z ?? 0) * 1.22;
  scene.target.set(x, 1.4, z);
  scene.showDirector.initialize(scene.camera,new THREE.Vector3(
    x + Math.sin(rotation) * zoom,
    3.5,
    z + Math.cos(rotation) * zoom,
  ),scene.target);
};
let family = rendererFor(mode, quality);
let serial = 0;
const seed = () => ($("#seed") as HTMLInputElement).value;
function event(
  type: LiveEvent["eventType"],
  id = seed(),
  tier?: "LOW" | "NORMAL" | "HIGH",
) {
  world.bus.emit({
    schemaVersion: 1,
    eventId: "lab-" + serial++,
    source: "simulator",
    viewerId: id,
    username: id,
    eventType: type,
    giftCount: 1,
    giftName: "Lab Spark",
    timestamp: Date.now(),
    metadata: { tier },
  });
}
function reset() {
  frozen = null;
  scene.presentation.cancel();
  scene.entertainment.reset();
  scene.cinema.reset();
  world.spawn.dancers.clear();
  world.spawn.queue = [];
  world.spawn.slots = new SlotAllocator();
  world.effects.active.clear();
  scene.update(0.001);
  handles.clear();
}
function spawn(n: number) {
  family = rendererFor(mode, quality);
  if (family === "GLB" && !engine.ready && !params.get("fault"))
    void engine.preload();
  reset();
  for (let i = 0; i < n; i++)
    event("VIEWER_JOIN", i ? seed() + "-" + i : seed());
}
function context(d: Dancer): VisualContext {
  const a = scene.cinema.group;
  return {
    quality,
    distance: scene.camera.position.distanceTo(
      new T.Vector3(d.position.x * 0.88, 1.3, d.position.z * 1.22),
    ),
    featured: scene.cinema.subject === d.id || cam === "CLOSE",
    group: a.members.has(d.id) ? { clip: a.dance, start: a.start } : undefined,
    reaction: scene.presentation.reactions.get(d.id)?.kind,
    expression: expression === "AUTO" ? undefined : expression,
    forceClip: forceClip || undefined,
    forceLOD: forceLOD < 0 ? undefined : forceLOD,
    rank:
      scene.entertainment.supporters.top.findIndex((v) => v.id === d.id) + 1,
    level: scene.entertainment.supporters.level(
      d.id,
      scene.entertainment.config,
    ),
    palette: palette < 0 ? undefined : palette,
    hair: hair < 0 ? undefined : hair,
    accessory: accessory < 0 ? undefined : accessory,
  };
}
function replace() {
  if (family !== "GLB" || !engine.ready) return;
  for (const [id, a] of scene.avatars) {
    if (!(a instanceof ProceduralAvatar)) continue;
    const h = engine.acquire(id, family, quality);
    if (h.kind !== "GLB") {
      h.release();
      continue;
    }
    a.dispose();
    handles.set(id, h);
    scene.scene.add(h.visual.root);
    scene.avatars.set(id, {
      root: h.visual.root,
      update: (d, t, dt) => h.update(d, t, dt, context(d)),
      dispose: () => {
        h.release();
        handles.delete(id);
      },
    });
  }
}
const errors: string[] = [];
addEventListener("error", (e) => errors.push(e.message));
addEventListener("unhandledrejection", (e) => errors.push(String(e.reason)));
let prev = performance.now(),
  ui = 0,
  frames: number[] = [],
  mixers: number[] = [],
  coldLoad = 0;
const started = performance.now();
if (rendererFor(mode, quality) === "GLB")
  await engine.preload(
    params.get("fault")
      ? async (url) => {
          if (params.get("fault") === "missing")
            throw Error("Injected missing asset");
          if (params.get("fault") === "corrupt") {
            const { GLTFLoader } =
              await import("three/addons/loaders/GLTFLoader.js");
            return new GLTFLoader().parseAsync(new ArrayBuffer(12), "");
          }
          throw Error("Injected " + params.get("fault"));
        }
      : undefined,
  );
coldLoad = performance.now() - started;
$("#loading").textContent = engine.ready
  ? `Pack ready · ${coldLoad.toFixed(0)}ms · 20 bones / 19 clips / 3 LOD`
  : mode === "PROCEDURAL"
    ? "Procedural baseline · pack not loaded"
    : "Fallback PROCEDURAL · ver Diagnostics";
function stats() {
  const sorted = [...frames].sort((a, b) => a - b),
    avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
  const materials = new Set<T.Material>();
  scene.scene.traverse((o) => {
    if (o instanceof T.Mesh)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
  });
  const lods = [0, 0, 0];
  for (const h of handles.values())
    if (h.visual instanceof GLBRenderer) lods[h.visual.lod]++;
  return {
    mode,
    actualGLB: handles.size,
    count: world.spawn.dancers.size,
    quality,
    camera: cam,
    fps: 1000 / Math.max(0.01, avg),
    frameMs: avg,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    max: sorted.at(-1) ?? 0,
    mixerMs: mixers.reduce((a, b) => a + b, 0) / Math.max(1, mixers.length),
    ...scene.metrics(),
    materials: materials.size,
    heap: (performance as any).memory?.usedJSHeapSize ?? null,
    lods,
    engine: engine.stats(),
    coldLoad,
    group: {
      members: [...scene.cinema.group.members],
      clip: scene.cinema.group.dance,
      start: scene.cinema.group.start,
    },
    clips: [...handles.values()].map((h) => (h.visual as GLBRenderer).current),
    times: [...handles.values()].map((h) => {
      const v = h.visual as GLBRenderer;
      return v.actions.get(v.current)?.time ?? 0;
    }),
    dancers: [...world.spawn.dancers.values()].map((d) => ({
      id: d.id,
      state: d.state,
      position: d.position,
    })),
    errors: [...errors, ...world.bus.errors],
  };
}
function loop(now: number) {
  const dt = Math.min(0.1, (now - prev) / 1000);
  if (now - prev < 1000) frames.push(now - prev);
  prev = now;
  if (frames.length > 180) frames.shift();
  if (frozen === null) world.update(dt, dt);
  else world.now = frozen;
  if (forceClip === "Idle")
    for (const d of world.spawn.dancers.values())
      if (d.state === "DANCING") d.animationState = "Idle";
  scene.update(frozen === null ? dt : 0.016);
  replace();
  let cost = 0;
  for (const h of handles.values()) cost += (h.visual as GLBRenderer).mixerMs;
  mixers.push(cost);
  if (mixers.length > 180) mixers.shift();
  if (now - ui > 400) {
    ui = now;
    const m = scene.cinema.banners.active;
    $("#upper").textContent = m?.kind ?? "";
    $("#lower").textContent = m ? m.name + " · " + m.detail : "";
    $("#stats").textContent = JSON.stringify(
      stats(),
      (k, v) =>
        ["dancers", "clips", "times", "errors"].includes(k) ? undefined : v,
      2,
    );
    $("#logs").textContent = JSON.stringify(engine.logs, null, 2);
    $("#caption").textContent =
      `${mode} · ${quality} · ${scene.quality} · ${expression}`;
  }
  requestAnimationFrame(loop);
}
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  if (b.dataset.count) spawn(Number(b.dataset.count));
  const x = b.dataset.event,
    id = world.spawn.dancers.keys().next().value ?? seed();
  if (x === "Reset") reset();
  else if (x === "Follow") event("FOLLOW", id);
  else if (x === "LOW" || x === "VIP")
    event("GIFT", id, x === "LOW" ? "LOW" : "HIGH");
  else if (x === "Top") {
    scene.entertainment.supporters.add(id, id, 500);
    scene.cinema.show("TOP", id, id, "Lab Top");
  } else if (x === "Goal")
    scene.entertainment.goal("like", scene.entertainment.config.likeGoal);
  else if (x === "Fever") scene.entertainment.hype.add(100, world.now);
  else if (x === "Reaction")
    for (const d of world.spawn.dancers.values())
      scene.presentation.react(d.id, "CHEER", world.now, 4);
  else if (x === "Exit") {
    const d = world.spawn.dancers.get(id);
    if (d) world.spawn.exit(d, world.now);
  } else if (x && ["DUO", "TRIO", "GROUP", "ALL"].includes(x))
    scene.cinema.group.trigger(world, x as any, "LAB", 8, quality);
  if (b.id === "freeze") frozen = frozen === null ? world.now : null;
  if (b.id === "warm") void warmup();
});
document.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === "rotate") rotation = (Number(el.value) * Math.PI) / 180;
  if (el.id === "zoom") zoom = Number(el.value);
});
document.addEventListener("change", (e) => {
  const el = e.target as HTMLSelectElement;
  switch (el.id) {
    case "renderer":
      mode = el.value as RendererMode;
      if (rendererFor(mode, quality) === "GLB" && !engine.ready)
        void engine.preload();
      spawn(Math.max(1, world.spawn.dancers.size));
      break;
    case "quality":
      quality = el.value as Quality;
      world.config.quality = quality;
      scene.setQuality(quality);
      break;
    case "camera":
      cam = el.value;
      break;
    case "expression":
      expression = el.value;
      break;
    case "animation":
      forceClip = el.value === "AUTO" ? "" : el.value;
      break;
    case "lod":
      forceLOD = el.value === "AUTO" ? -1 : Number(el.value);
      break;
    case "palette":
      palette = el.value === "SEED" ? -1 : Number(el.value);
      break;
    case "hair":
      hair = el.value === "SEED" ? -1 : Number(el.value);
      break;
    case "accessory":
      accessory = el.value === "SEED" ? -1 : Number(el.value);
      break;
    case "light":
      light = el.value;
      scene.keyLight.color.set(
        light === "VIP" ? "#ffe3a0" : light === "FEVER" ? "#e8baff" : "#fff1d5",
      );
      break;
  }
});
async function warmup() {
  if (!engine.ready) return;
  const start = performance.now(),
    h = engine.acquire("warmup", "GLB", quality);
  scene.scene.add(h.visual.root);
  h.visual.root.position.set(0, 0, 0);
  await scene.renderer.compileAsync(scene.scene, scene.camera);
  h.release();
  engine.log(
    "Warmup completed " + (performance.now() - start).toFixed(1) + "ms",
  );
}
(window as any).__CharacterLab = {
  stats,
  spawn,
  reset,
  engine,
  world,
  scene,
  handles,
  warmup,
  freeze: (time: number | null) => {
    frozen = time;
  },
  configure: (o: any) => {
    if (o.cam) cam = o.cam;
    if (o.expression) expression = o.expression;
    if (o.clip !== undefined) forceClip = o.clip;
    if (o.lod !== undefined) forceLOD = o.lod;
    if (o.palette !== undefined) palette = o.palette;
    if (o.hair !== undefined) hair = o.hair;
    if (o.accessory !== undefined) accessory = o.accessory;
  },
  clearSamples: () => {
    frames = [];
    mixers = [];
  },
  event,
};
spawn(Number(params.get("count") ?? 1));
requestAnimationFrame(loop);
addEventListener("pagehide", () => {
  scene.dispose();
  engine.dispose();
});
