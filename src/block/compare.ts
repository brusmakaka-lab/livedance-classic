import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HeroCache, HeroVisual } from "../hero/asset";
import { CharacterCache, GLBRenderer } from "../character-engine/engine";
import { ProceduralAvatar, AvatarBatch } from "../avatars";
import { World, defaults, type Dancer } from "../domain";
import { BlockAvatar, BlockBatch } from "./rig";
import "../hero/lab.css";
document.querySelector("#app")!.innerHTML =
  `<header>LiveDance / A–B–C–D comparison</header><main><aside><h1>Four directions.</h1><p>Same camera, light and time. Original model heights.</p><label>Model<select id="model"><option>BLOCK</option><option>PROCEDURAL</option><option>PROTOTYPE</option><option>HERO</option></select></label><label>View<select id="view"><option>FULL</option><option>CLOSE</option></select></label><a href="/block-lab.html">Return to Block Lab</a><pre id="stats"></pre></aside><section><div id="stage"></div></section></main>`;
const host = document.querySelector("#stage") as HTMLElement,
  scene = new T.Scene(),
  renderer = new T.WebGLRenderer({ antialias: true }),
  camera = new T.PerspectiveCamera(38, 9 / 16, 0.05, 80),
  controls = new OrbitControls(camera, renderer.domElement);
host.append(renderer.domElement);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
scene.background = new T.Color("#e2ddd4");
const hemi = new T.HemisphereLight("#f1f6ff", "#92817a", 2),
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
const w = new World({ ...defaults });
w.bus.emit({
  schemaVersion: 1,
  eventId: "block-comparison",
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
const hc = new HeroCache(),
  oc = new CharacterCache();
await Promise.all([hc.preload(), oc.preload()]);
const bb = new BlockBatch(scene),
  pb = new AvatarBatch(scene);
let current: BlockAvatar | ProceduralAvatar | GLBRenderer | HeroVisual,
  model = "BLOCK",
  view = "FULL";
function configure(o: any) {
  if (o.model) {
    model = o.model;
    current?.dispose();
    current =
      model === "BLOCK"
        ? new BlockAvatar("alma.curly")
        : model === "HERO"
          ? new HeroVisual(hc)
          : model === "PROTOTYPE"
            ? new GLBRenderer(oc)
            : new ProceduralAvatar("alma.curly");
    if (current instanceof GLBRenderer) current.reset("alma.curly");
    scene.add(current.root);
  }
  if (o.view) view = o.view;
  camera.position.set(
    view === "FULL" ? 0 : 0.15,
    view === "FULL" ? 1.45 : 2.15,
    view === "FULL" ? 6.7 : 3.9,
  );
  controls.target.set(0, view === "FULL" ? 1.37 : 1.9, 0);
  controls.update();
}
function render() {
  requestAnimationFrame(render);
  if (current instanceof BlockAvatar) current.update("Idle", 1, 1);
  else if (current instanceof HeroVisual) {
    current.clip = "Idle";
    current.forceLOD = 0;
    current.update(d, 1, 0.016);
  } else if (current instanceof GLBRenderer)
    current.update(d, 1, 0.016, {
      quality: "MEDIUM",
      distance: 5,
      forceLOD: 0,
      forceClip: "Idle",
      expression: "NEUTRAL",
    });
  else current.update(d, 1, 0.016);
  bb.update(current instanceof BlockAvatar ? [current] : []);
  pb.update(current instanceof ProceduralAvatar ? [current] : []);
  controls.update();
  renderer.render(scene, camera);
}
function resize() {
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
configure({ model });
resize();
render();
for (const id of ["model", "view"])
  document
    .querySelector("#" + id)!
    .addEventListener("change", (e) =>
      configure({ [id]: (e.target as HTMLSelectElement).value }),
    );
(window as any).__BlockCompare = {
  configure,
  renderer,
  stats: () => ({
    model,
    view,
    draws: renderer.info.render.calls,
    parts: bb.mesh.count,
    proceduralParts: Object.values(pb.counts).reduce((a, b) => a + b, 0),
  }),
};
