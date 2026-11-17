import {
  CharacterSystem,
  BlockVisual,
  characterDefaults,
  type CharacterConfig,
} from "./characters";
import { IntegrationShow } from "./integration/show";
import { ShowDirector } from "./integration/show-director";
import { CinematicPresentation } from "./cinematic";
import { EntertainmentDirector, effectBudgets } from "./entertainment";
import * as THREE from "three";
import { AfterglowStage, type StageVisual } from "./stage";
import { PresentationDirector, presentationDefaults } from "./presentation";
import { AvatarBatch, ProceduralAvatar, type AvatarVisual } from "./avatars";
import { type Dancer, type Quality, type World } from "./domain";
export const presets = {
  LOW: { ratio: 0.65, shadows: false, particles: 5, lights: 0 },
  MEDIUM: { ratio: 1, shadows: false, particles: 10, lights: 1 },
  HIGH: { ratio: 1.5, shadows: true, particles: 18, lights: 2 },
};
function mesh(g: THREE.BufferGeometry, color: string, roughness = 0.7) {
  return new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.15 }),
  );
}
function textTexture(
  text: string,
  color = "#ffffff",
  width = 512,
  height = 96,
) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  ctx.font = `600 ${height * 0.46}px Segoe UI, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2, width - 24);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function nameTexture(text: string, featured: boolean) {
  const c = document.createElement("canvas"),
    ctx = c.getContext("2d")!;
  ctx.font = "600 28px Segoe UI, sans-serif";
  c.width = Math.ceil(Math.min(410, ctx.measureText(text).width + 26));
  c.height = 46;
  ctx.font = "600 28px Segoe UI, sans-serif";
  ctx.fillStyle = featured ? "#253322dd" : "#101728cc";
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, 46, 12);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = featured ? "#d5ffa4" : "#eef2f9";
  ctx.fillText(text, c.width / 2, 23, c.width - 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export class SceneManager {
  integration: IntegrationShow;
  showDirector = new ShowDirector();
  private wasIntegrated = false;
  presentation = new PresentationDirector({ ...presentationDefaults });
  entertainment: EntertainmentDirector;
  cinema: CinematicPresentation;
  stageVisual!: StageVisual;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 100);
  renderer: THREE.WebGLRenderer;
  avatars = new Map<string, AvatarVisual>();
  labels = new Map<string, THREE.Sprite>();
  effectVisuals = new Map<string, THREE.Object3D>();
  batch: AvatarBatch;
  characters: CharacterSystem;
  keyLight = new THREE.DirectionalLight("#fff1d5", 3);
  accentLights: THREE.PointLight[] = [];
  quality: Quality = "MEDIUM";
  target = new THREE.Vector3(0, 1, 0);
  resizeObserver: ResizeObserver;
  lastWidth = 0;
  lastHeight = 0;
  gpu = "WebGL2";
  disposed = false;
  private temp = new THREE.Vector3();
  private particleTransform = new THREE.Object3D();
  private labelMeta = new Map<string, string>();
  private fxGeom = new THREE.SphereGeometry(0.07, 5, 4);
  private shadowGeo = new THREE.CircleGeometry(0.42, 16);
  private shadows = new Map<string, THREE.Mesh>();
  private shadowMat = new THREE.MeshBasicMaterial({
    color: "#080d18",
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  constructor(
    public container: HTMLElement,
    private world: World,
    characterConfig: CharacterConfig = characterDefaults,
  ) {
    this.entertainment = new EntertainmentDirector(world, this.presentation);
    this.cinema = new CinematicPresentation(
      world,
      this.presentation,
      this.entertainment,
    );
    this.scene.scale.set(0.88, 1, 1.22);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor("#151629");
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-label", "Escena 3D LiveDance");
    this.scene.fog = new THREE.Fog("#151629", 28, 65);
    this.scene.add(new THREE.HemisphereLight("#c4d9ff", "#4f4763", 2.3));
    this.keyLight.position.set(-5, 12, 8);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.keyLight.shadow.camera, {
      left: -12,
      right: 12,
      top: 12,
      bottom: -12,
      near: 1,
      far: 35,
    });
    this.keyLight.shadow.bias = -0.001;
    this.scene.add(this.keyLight);
    for (const [color, x, z] of [
      ["#97ecff", -6, -3],
      ["#ef88d2", 7, 1],
    ] as const) {
      const l = new THREE.PointLight(color, 45, 20, 2);
      l.position.set(x, 5, z);
      this.scene.add(l);
      this.accentLights.push(l);
    }
    this.buildStage();
    this.batch = new AvatarBatch(this.scene);
    this.characters = new CharacterSystem(this.scene, characterConfig, (e) =>
      world.bus.error(e),
    );
    this.showDirector.initialize(this.camera,new THREE.Vector3(0,15,23),this.target);
    const gl = this.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) this.gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.setQuality(world.config.quality);
    this.resize();
    this.integration = new IntegrationShow(
      world,
      this.entertainment,
      container,
      this.showDirector,
    );
  }
  private buildStage() {
    const floor = mesh(new THREE.CircleGeometry(12.2, 64), "#233846", 0.35);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.055;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const vip = mesh(new THREE.CircleGeometry(1.9, 48), "#35494b", 0.3);
    vip.rotation.x = -Math.PI / 2;
    vip.position.y = -0.04;
    this.scene.add(vip);
    this.stageVisual = new AfterglowStage(this.scene);
  }
  setQuality(q: Quality) {
    this.quality = q;
    const p = presets[q];
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.5) * p.ratio,
    );
    this.renderer.shadowMap.enabled = p.shadows;
    this.keyLight.castShadow = p.shadows;
    this.accentLights.forEach((l, i) => (l.visible = i < p.lights));
    this.resize();
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.lastWidth = width;
    this.lastHeight = height;
    this.container.style.setProperty("--ui-scale", String(width / 365));
    this.renderer.setSize(Math.round(width), Math.round(height), false);
    this.showDirector.resize(this.camera,Math.round(width)/Math.round(height));
  }
  update(dt: number) {
    const w = this.world,
      t = w.now;
    this.presentation.update(w, dt);
    this.entertainment.update(dt);
    this.cinema.update(dt);
    this.integration.syncClass();
    if (this.integration.active) {
      if (!this.wasIntegrated) {
        this.configureCharacters(this.characters.config);
        this.wasIntegrated = true;
      }
      if (
        this.integration.update(
          this.camera,
          dt,
          this.quality,
          this.presentation.bpm || 108,
        )
      ) {
        this.integration.renderMain(this.renderer,this.camera);
        this.integration.renderArrivalInset(this.renderer);
        return;
      }
    }
    if (this.wasIntegrated) {
      this.wasIntegrated = false;
    }
    this.stageVisual.update(w, this.presentation, this.quality);
    this.accentLights.forEach((light, i) => {
      light.intensity = 20 + this.presentation.lights.intensity * 30;
      light.color.set(i ? "#bc9fff" : this.presentation.lights.color);
    });
    for (const [id, a] of this.avatars)
      if (!w.spawn.dancers.has(id)) {
        a.dispose();
        this.avatars.delete(id);
        const l = this.labels.get(id);
        if (l) {
          this.disposeObject(l);
          this.labels.delete(id);
        }
        this.labelMeta.delete(id);
        this.shadows.get(id)?.removeFromParent();
        this.shadows.delete(id);
      }
    const ranking = this.entertainment.supporters.top;
    for (const [id, d] of w.spawn.dancers) {
      let a = this.avatars.get(id);
      if (!a) {
        a = this.characters.create(id);
        this.avatars.set(id, a);
        const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.006;
        this.scene.add(shadow);
        this.shadows.set(id, shadow);
      }
      if (a instanceof ProceduralAvatar) {
        a.reaction = this.presentation.reactions.get(id);
        a.danceOverride = this.cinema.group.members.has(id)
          ? this.cinema.group.dance
          : undefined;
        a.syncStart = a.danceOverride ? this.cinema.group.start : undefined;
        const attention = this.cinema.crowd.get(id),
          subject = attention
            ? w.spawn.dancers.get(attention.target)
            : undefined;
        a.attention = subject
          ? Math.atan2(
              subject.position.x - d.position.x,
              subject.position.z - d.position.z,
            )
          : undefined;
        a.level = this.entertainment.supporters.level(
          id,
          this.entertainment.config,
        );
        a.rank = ranking.findIndex((v) => v.id === id) + 1;
        a.cosmeticLimit = effectBudgets[this.quality].cosmetics;
      }
      if (a instanceof BlockVisual)
        a.context = {
          reaction: this.presentation.reactions.get(id),
          groupDance: this.cinema.group.members.has(id)
            ? this.cinema.group.dance
            : undefined,
          groupStart: this.cinema.group.members.has(id)
            ? this.cinema.group.start
            : undefined,
          reduceMotion: this.entertainment.config.reduceMotion,
        };
      try {
        a.update(d, t, dt);
      } catch (error) {
        if (!(a instanceof BlockVisual)) throw error;
        a.dispose();
        a = this.characters.fallback(id, error);
        this.avatars.set(id, a);
        a.update(d, t, dt);
      }
      this.updateLabel(d);
      const shadow = this.shadows.get(id)!;
      shadow.position.set(d.position.x, 0.005, d.position.z);
      shadow.scale.setScalar(a.root.scale.x);
    }
    const focusId = this.cinema.subject ?? w.camera.targetId;
    const focus = this.cinema.subject
      ? this.avatars.get(this.cinema.subject)
      : ["VIP", "FEATURED"].includes(w.camera.mode)
        ? this.avatars.get(w.camera.targetId ?? "")
        : undefined;
    let visibleIds: Set<string> | undefined;
    if (w.camera.mode === "VIP" && focusId && w.spawn.dancers.has(focusId)) {
      const subject = w.spawn.dancers.get(focusId)!;
      const supporting = [...w.spawn.dancers.values()]
        .filter(
          (d) =>
            d.id !== focusId &&
            d.position.z <= subject.position.z + 0.8 &&
            Math.abs(d.position.x - subject.position.x) <= 4.5,
        )
        .sort(
          (a, b) =>
            Math.hypot(
              a.position.x - subject.position.x,
              a.position.z - subject.position.z,
            ) -
            Math.hypot(
              b.position.x - subject.position.x,
              b.position.z - subject.position.z,
            ),
        )
        .slice(0, 8);
      visibleIds = new Set([focusId, ...supporting.map((d) => d.id)]);
    }
    const visibleAvatars = [...this.avatars]
      .filter(([id]) => !visibleIds || visibleIds.has(id))
      .map(([, avatar]) => avatar);
    for (const [id, shadow] of this.shadows)
      shadow.visible = !visibleIds || visibleIds.has(id);
    this.batch.update(visibleAvatars, focus);
    this.characters.update(visibleAvatars, focus);
    this.updateEffects();
    this.updateCamera(dt);
    this.layoutLabels();
    this.renderer.render(this.scene, this.camera);
  }
  configureCharacters(config: CharacterConfig) {
    for (const a of this.avatars.values()) a.dispose();
    this.avatars.clear();
    for (const shadow of this.shadows.values()) shadow.removeFromParent();
    this.shadows.clear();
    this.batch.update([]);
    this.characters.batch?.update([]);
    this.characters.configure(config);
  }
  private updateLabel(d: Dancer) {
    const featured =
        d.featuredUntil > this.world.now || d.vipUntil > this.world.now,
      signature = d.username + (featured ? "*" : "");
    let label = this.labels.get(d.id);
    if (!label || this.labelMeta.get(d.id) !== signature) {
      if (label) this.disposeObject(label);
      label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: nameTexture(`${featured ? "✦ " : ""}${d.username}`, featured),
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      label.renderOrder = 5;
      this.labels.set(d.id, label);
      this.labelMeta.set(d.id, signature);
      this.scene.add(label);
    }
    label.position.set(d.position.x, featured ? 3.12 : 2.83, d.position.z);
    const dist = this.camera.position.distanceTo(label.position),
      height =
        this.entertainment.config.nameSize *
        (featured ? 0.58 : 0.48) *
        Math.max(0.75, dist / 25),
      aspect = (label.material.map!.image as HTMLCanvasElement).width / 46;
    label.scale.set(height * aspect, height, 1);
    const priority =
      this.cinema.subject ??
      (["VIP", "FEATURED"].includes(this.world.camera.mode)
        ? this.world.camera.targetId
        : null);
    label.visible =
      this.world.config.names &&
      d.state !== "SPAWNING" &&
      (!priority || priority === d.id);
    label.material.opacity = featured
      ? 1
      : Math.max(0.45, 1 - Math.max(0, dist - 18) / 35);
  }
  private layoutLabels() {
    const ranks = this.entertainment.supporters.top;
    const bounds: { x: number; y: number; w: number; h: number }[] = [];
    const maxCrowdLabels = 8;
    let crowdLabels = 0;
    const labels = [...this.labels.entries()].sort(([a], [b]) => {
      const ad = this.world.spawn.dancers.get(a)!,
        bd = this.world.spawn.dancers.get(b)!;
      return (
        Number(bd.vipUntil > this.world.now) -
          Number(ad.vipUntil > this.world.now) ||
        Number(bd.featuredUntil > this.world.now) -
          Number(ad.featuredUntil > this.world.now) ||
        (ranks.findIndex((v) => v.id === a) + 1 || 9) -
          (ranks.findIndex((v) => v.id === b) + 1 || 9) ||
        bd.position.z - ad.position.z
      );
    });
    for (const [id, l] of labels) {
      if (!l.visible) continue;
      const dancer = this.world.spawn.dancers.get(id);
      const isPriority =
        !!dancer &&
        (dancer.featuredUntil > this.world.now ||
          dancer.vipUntil > this.world.now);
      this.temp
        .copy(l.position)
        .multiply(this.scene.scale)
        .project(this.camera);
      const distance = this.camera.position.distanceTo(l.position),
        scale =
          this.lastHeight /
          (2 *
            distance *
            Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))),
        rect = {
          x: ((this.temp.x + 1) * this.lastWidth) / 2,
          y: ((1 - this.temp.y) * this.lastHeight) / 2,
          w: l.scale.x * scale,
          h: l.scale.y * scale,
        };
      if (
        this.temp.z > 1 ||
        (!isPriority && crowdLabels >= maxCrowdLabels) ||
        rect.x - rect.w / 2 < this.lastWidth * 0.12 ||
        rect.x + rect.w / 2 > this.lastWidth * 0.88 ||
        rect.y - rect.h / 2 < this.lastHeight * 0.12 ||
        rect.y + rect.h / 2 > this.lastHeight * 0.73 ||
        bounds.some(
          (b) =>
            Math.abs(b.x - rect.x) < (b.w + rect.w) / 2 + 6 &&
            Math.abs(b.y - rect.y) < (b.h + rect.h) / 2 + 8,
        )
      ) {
        l.visible = false;
        continue;
      }
      bounds.push(rect);
      if (!isPriority) crowdLabels++;
    }
  }
  private updateEffects() {
    const w = this.world,
      t = w.now;
    const perKind: Record<string, number> = {};
    const visibleEffects = new Set<string>();
    const cap = this.quality === "LOW" ? 4 : this.quality === "MEDIUM" ? 8 : 12;
    for (const [id, e] of [...w.effects.active].sort(
      ([, a], [, b]) => b.start - a.start,
    )) {
      const limit = e.kind === "text" ? 2 : e.kind === "crown" ? 3 : cap;
      perKind[e.kind] = (perKind[e.kind] ?? 0) + 1;
      if (perKind[e.kind] <= limit) visibleEffects.add(id);
    }
    for (const [id, obj] of this.effectVisuals)
      if (!w.effects.active.has(id) || !visibleEffects.has(id)) {
        this.disposeObject(obj);
        this.effectVisuals.delete(id);
      }
    for (const [id, e] of w.effects.active) {
      if (!visibleEffects.has(id)) continue;
      if (e.kind === "text" && this.cinema.banners.active) {
        const previous = this.effectVisuals.get(id);
        if (previous) {
          this.disposeObject(previous);
          this.effectVisuals.delete(id);
        }
        continue;
      }
      const d = w.spawn.dancers.get(e.dancerId);
      if (!d || e.kind === "scale") continue;
      let obj = this.effectVisuals.get(id);
      if (!obj) {
        if (e.kind === "aura") {
          obj = new THREE.Mesh(
            new THREE.TorusGeometry(0.72, 0.055, 5, 40),
            new THREE.MeshBasicMaterial({
              color: "#b8ff70",
              transparent: true,
              opacity: 0.9,
              depthWrite: false,
            }),
          );
          obj.rotation.x = Math.PI / 2;
        }
        if (e.kind === "spotlight") {
          obj = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 1.1, 4.3, 16, 1, true),
            new THREE.MeshBasicMaterial({
              color: "#daf9a4",
              transparent: true,
              opacity: 0.1,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
        }
        if (e.kind === "crown") {
          const group = new THREE.Group();
          for (let i = 0; i < 5; i++) {
            const tip = new THREE.Mesh(
              new THREE.ConeGeometry(0.1, 0.3, 4),
              new THREE.MeshBasicMaterial({ color: "#ffe492" }),
            );
            const a = (i / 5) * Math.PI * 2;
            tip.position.set(Math.sin(a) * 0.28, 0, Math.cos(a) * 0.28);
            group.add(tip);
          }
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.28, 0.045, 4, 18),
            new THREE.MeshBasicMaterial({ color: "#ffe492" }),
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = -0.12;
          group.add(ring);
          obj = group;
        }
        if (e.kind === "particles") {
          const particles = new THREE.InstancedMesh(
            this.fxGeom,
            new THREE.MeshBasicMaterial({
              color: "#b9ffe2",
              transparent: true,
              depthWrite: false,
            }),
            18,
          );
          particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          particles.frustumCulled = false;
          obj = particles;
        }
        if (e.kind === "text") {
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textTexture(e.label ?? "", "#d8ffac"),
              transparent: true,
              depthTest: false,
              depthWrite: false,
            }),
          );
          sprite.scale.set(2.5, 0.47, 1);
          sprite.renderOrder = 6;
          obj = sprite;
        }
        if (!obj) continue;
        obj.userData.label = e.label;
        this.effectVisuals.set(id, obj);
        this.scene.add(obj);
      }
      const age = t - e.start,
        remaining = Math.min(1, (e.end - t) / 0.6);
      obj.position.set(
        d.position.x,
        e.kind === "spotlight"
          ? 2.15
          : e.kind === "crown"
            ? 3.4
            : e.kind === "text"
              ? 3.6 + age * 0.1
              : 0.06,
        d.position.z,
      );
      if (e.kind === "aura") {
        obj.scale.setScalar(1 + Math.sin(age * 4) * 0.06);
        (
          obj as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
        ).material.opacity = remaining * 0.8;
      }
      if (e.kind === "crown") obj.rotation.y = t;
      if (e.kind === "particles") {
        const particles = obj as THREE.InstancedMesh;
        particles.count = presets[this.quality].particles;
        for (let i = 0; i < particles.count; i++) {
          const a = t * 1.5 + i * 2.4;
          this.particleTransform.position.set(
            Math.sin(a) * (0.7 + i * 0.025),
            0.4 + ((age + i * 0.24) % 1.8) * 1.5,
            Math.cos(a) * (0.7 + i * 0.025),
          );
          this.particleTransform.updateMatrix();
          particles.setMatrixAt(i, this.particleTransform.matrix);
        }
        particles.instanceMatrix.needsUpdate = true;
        (particles.material as THREE.MeshBasicMaterial).opacity = remaining;
      }
      if (e.kind === "text") {
        const sprite = obj as THREE.Sprite;
        sprite.material.opacity = remaining;
        if (obj.userData.label !== e.label) {
          sprite.material.map?.dispose();
          sprite.material.map = textTexture(e.label ?? "", "#d8ffac");
          sprite.material.needsUpdate = true;
          obj.userData.label = e.label;
        }
      }
    }
  }
  private updateCamera(dt: number) {
    const w = this.world,
      c = w.camera,
      t = w.now;
    let radius = 4.6;
    for (const d of w.spawn.dancers.values())
      if (d.state !== "EXITING")
        radius = Math.max(
          radius,
          Math.hypot(d.targetPosition.x, d.targetPosition.z) + 0.6,
        );
    const widthDistance = radius * 4.1 * this.presentation.config.framing;
    let pos = new THREE.Vector3(
        0,
        Math.max(14.5, radius * 2.2),
        Math.max(21, widthDistance),
      ),
      target = new THREE.Vector3(0, 1.8, -2.4);
    if (c.mode === "ORBIT" && !this.entertainment.config.reduceMotion) {
      pos.x = Math.sin(t * 0.09) * radius * 0.25 * w.config.cameraIntensity;
      pos.z += 1;
    }
    if (c.mode === "MEDIUM") {
      pos.multiplyScalar(0.94);
      target.z = -0.6;
    }
    if (
      this.presentation.shot === "GROUP" &&
      !["VIP", "FEATURED"].includes(c.mode)
    ) {
      pos.multiplyScalar(0.93);
      pos.x = Math.sin(t * 0.12) * 1.2;
      target.y = 1.5;
    }
    if (
      this.presentation.shot === "ENTRANCE" &&
      !["VIP", "FEATURED"].includes(c.mode)
    ) {
      const entrant = w.spawn.dancers.get(
        this.presentation.entranceTarget ?? "",
      );
      if (entrant) {
        pos.set(-5, 9, 19);
        target.set(entrant.position.x * 0.88, 1.2, entrant.position.z * 1.22);
      }
    }
    const d = c.targetId ? w.spawn.dancers.get(c.targetId) : undefined;
    if (d && (c.mode === "VIP" || c.mode === "FEATURED")) {
      pos.set(
        d.position.x * 0.88 + 1.4 * w.config.cameraIntensity,
        10.5,
        d.position.z * 1.22 + 17.5,
      );
      target.set(d.position.x * 0.88, 1.55, d.position.z * 1.22);
    }
    if (
      this.presentation.shot === "FEVER" &&
      !this.entertainment.config.reduceMotion
    ) {
      pos.x = Math.sin(t * 0.18) * 2;
      pos.y += 1;
    }
    if (this.presentation.shot === "TOP") {
      const top = w.spawn.dancers.get(this.entertainment.supporters.top[0]?.id);
      if (top) target.set(top.position.x * 0.44, 1.6, top.position.z * 0.6);
    }
    const locked =
      w.config.cameraAuto && this.cinema.subject
        ? w.spawn.dancers.get(this.cinema.subject)
        : undefined;
    if (locked) {
      const x = locked.position.x * 0.88,
        z = locked.position.z * 1.22;
      target.set(x, 1.5, z);
      pos.set(x + 0.45, 7.2, z + 14.4);
    }
    // Additive CameraSafety: bounded distance, height and physical travel speed.
    pos.y = THREE.MathUtils.clamp(pos.y, 5.4, 26);
    pos.z = THREE.MathUtils.clamp(pos.z, 4, 45);
    const delta = pos.clone().sub(this.camera.position);
    if (delta.length() > 9)
      pos.copy(this.camera.position).add(delta.setLength(9));
    const smooth = 1 - Math.exp(-dt * this.presentation.config.cameraSmooth);
    this.showDirector.fallback(this.camera,pos,target,smooth);
    this.target.copy(this.showDirector.target);
  }
  metrics() {
    const r = this.renderer.info.render;
    return {
      drawCalls: r.calls,
      triangles: r.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      width: this.renderer.domElement.width,
      height: this.renderer.domElement.height,
      gpu: this.gpu,
    };
  }
  subjectFrame() {
    if (this.integration.active) {
      const id = this.showDirector.active?.id;
      const a = id ? this.integration.actors.get(id) : undefined;
      if (a) {
        const point = (y: number) => {
          const p = a.rig.root.position
            .clone()
            .add(new THREE.Vector3(0, y, 0))
            .project(this.camera);
          return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
        };
        return { id, head: point(2.8), feet: point(0) };
      }
      return null;
    }
    const d = this.world.spawn.dancers.get(this.cinema.subject ?? "");
    if (!d) return null;
    const point = (y: number) => {
      const v = new THREE.Vector3(d.position.x, y, d.position.z)
        .multiply(this.scene.scale)
        .project(this.camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    };
    return { id: d.id, head: point(3.5), feet: point(0) };
  }
  private disposeObject(obj: THREE.Object3D) {
    obj.removeFromParent();
    obj.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        if (o instanceof THREE.Mesh && o.geometry !== this.fxGeom)
          o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) {
          if ("map" in m && (m as THREE.MeshBasicMaterial).map)
            (m as THREE.MeshBasicMaterial).map!.dispose();
          m.dispose();
        }
      }
    });
  }
  dispose() {
    this.disposed = true;
    this.integration.dispose();
    this.cinema.dispose();
    this.entertainment.dispose();
    this.resizeObserver.disconnect();
    for (const a of this.avatars.values()) a.dispose();
    this.characters.dispose();
    this.batch.dispose();
    this.stageVisual.dispose();
    this.presentation.cancel();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points)
        o.geometry.dispose();
      if ("material" in o) {
        const m = (o as THREE.Mesh).material;
        for (const mat of Array.isArray(m) ? m : [m]) {
          if ("map" in mat) (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
