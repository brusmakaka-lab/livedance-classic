import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PresentationDirector } from "./presentation";
import type { Quality, World } from "./domain";
export interface StageVisual {
  update(w: World, p: PresentationDirector, quality: Quality): void;
  dispose(): void;
}
// Static architecture is merged by material. Every animated resource is created once.
export class AfterglowStage implements StageVisual {
  root = new THREE.Group();
  private canvas = document.createElement("canvas");
  private texture: THREE.CanvasTexture;
  private panel: THREE.Mesh;
  private glow: THREE.MeshBasicMaterial;
  private beams: THREE.Mesh[] = [];
  private lastDraw = -1;
  private lastText = "";
  private vipRing: THREE.Mesh;
  private crown: THREE.Group;
  private dust: THREE.Points;
  private bars: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private portal!: THREE.Mesh;
  private portalDepth: THREE.Mesh[] = [];
  private floorPulse!: THREE.InstancedMesh;
  private sparks: THREE.InstancedMesh;
  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    const groups = new Map<string, THREE.BufferGeometry[]>();
    const add = (
      geometry: THREE.BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number,
      ry = 0,
    ) => {
      geometry.rotateY(ry);
      geometry.translate(x, y, z);
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color)!.push(geometry);
    };
    add(new THREE.CylinderGeometry(12.6, 13, 0.8, 64), "#182330", 0, -0.48, 0);
    add(
      new THREE.CylinderGeometry(12.9, 13.2, 0.16, 64),
      "#34404d",
      0,
      -0.92,
      0,
    );
    for (let i = 0; i < 3; i++)
      add(
        new THREE.BoxGeometry(15 - i * 0.5, 0.28, 2.8 - i * 0.6),
        "#243248",
        0,
        0.14 + i * 0.28,
        -9.1 - i * 0.1,
      );
    add(new THREE.BoxGeometry(13.6, 7.7, 0.6), "#172032", 0, 4.1, -10.7);
    add(new THREE.BoxGeometry(14, 0.15, 0.85), "#405569", 0, 8, -10.6);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        add(
          new THREE.BoxGeometry(0.5, 6.8 - i * 0.5, 1),
          "#28354b",
          side * (7.5 + i * 1.45),
          3.2,
          -9 + i * 0.9,
        );
        add(
          new THREE.BoxGeometry(0.045, 5.6 - i * 0.5, 0.07),
          "#77cfcc",
          side * (7.5 + i * 1.45),
          3.6,
          -8.45 + i * 0.9,
        );
      }
      add(
        new THREE.BoxGeometry(1.2, 3.3, 1.2),
        "#111b28",
        side * 6.6,
        2.05,
        -8,
      );
      for (const y of [1.35, 2.6]) {
        const g = new THREE.TorusGeometry(0.38, 0.055, 5, 20);
        add(g, "#63717c", side * 6.6, y, -7.38);
      }
      for (let i = 0; i < 4; i++)
        add(
          new THREE.BoxGeometry(1.2, 0.12, 0.4),
          "#496570",
          side * (8.2 + i * 0.35),
          0.05,
          -5 + i * 1.5,
        );
    }
    add(new THREE.BoxGeometry(5.3, 1.4, 1.25), "#101b29", 0, 1.5, -8.4);
    add(new THREE.BoxGeometry(5.55, 0.12, 1.5), "#6a8493", 0, 2.23, -8.4);
    add(new THREE.BoxGeometry(4.7, 0.045, 0.03), "#77cfcc", 0, 1.25, -7.76);
    // Layered side lounges, overhead truss and footlights share existing materials.
    for (const side of [-1, 1]) {
      add(
        new THREE.BoxGeometry(2.2, 0.7, 7),
        "#243248",
        side * 10.3,
        0.3,
        -1.5,
      );
      add(
        new THREE.BoxGeometry(0.06, 0.06, 7),
        "#77cfcc",
        side * 9.15,
        0.7,
        -1.5,
      );
      for (let i = 0; i < 5; i++) {
        add(
          new THREE.BoxGeometry(0.35, 0.25, 0.4),
          "#405569",
          side * 8.2,
          0.12,
          -5 + i * 2.1,
        );
        add(
          new THREE.BoxGeometry(0.22, 0.025, 0.28),
          "#77cfcc",
          side * 8.2,
          0.26,
          -5 + i * 2.1,
        );
      }
      add(
        new THREE.BoxGeometry(0.3, 9, 0.3),
        "#28354b",
        side * 7.3,
        4.5,
        -10.2,
      );
    }
    add(new THREE.BoxGeometry(14.6, 0.25, 0.4), "#405569", 0, 9, -10.2);
    // Booth contours, decks and mixer: static pieces merged into existing materials.
    for (const side of [-1, 1]) {
      add(
        new THREE.BoxGeometry(0.16, 1.25, 1.45),
        "#405569",
        side * 2.72,
        1.57,
        -8.4,
      );
      add(
        new THREE.CylinderGeometry(0.5, 0.5, 0.08, 24),
        "#111b28",
        side * 1.55,
        2.34,
        -8.35,
      );
      add(
        new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16),
        "#77cfcc",
        side * 1.55,
        2.36,
        -8.35,
      );
      add(
        new THREE.BoxGeometry(0.04, 0.06, 0.5),
        "#63717c",
        side * 2.05,
        2.36,
        -8.35,
      );
    }
    add(new THREE.BoxGeometry(1.1, 0.09, 0.85), "#111b28", 0, 2.34, -8.4);
    for (let i = 0; i < 5; i++) {
      add(
        new THREE.BoxGeometry(0.035, 0.04, 0.38),
        "#63717c",
        (i - 2) * 0.16,
        2.4,
        -8.35,
      );
      add(
        new THREE.BoxGeometry(0.085, 0.07, 0.06),
        "#77cfcc",
        (i - 2) * 0.16,
        2.43,
        -8.4 + Math.sin(i) * 0.12,
      );
    }
    // VIP is recognizable in repose. Never changes walkable slots or height.
    add(new THREE.CylinderGeometry(1.85, 1.9, 0.1, 40), "#34404d", 0, -0.08, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      add(
        new THREE.BoxGeometry(0.2, 0.025, 0.06),
        "#77cfcc",
        Math.sin(a) * 1.85,
        0.005,
        Math.cos(a) * 1.85,
        -a,
      );
    }
    for (const [color, geometries] of groups) {
      const combined = mergeGeometries(geometries);
      geometries.forEach((g) => g.dispose());
      const m = new THREE.Mesh(
        combined,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.48,
          metalness: 0.3,
        }),
      );
      m.receiveShadow = true;
      this.root.add(m);
    }
    this.glow = new THREE.MeshBasicMaterial({
      color: "#77f2d2",
      transparent: true,
      opacity: 0.7,
    });
    for (const r of [2, 12.35]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.035, 5, 96),
        this.glow,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.01;
      this.root.add(ring);
    }
    this.portal = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.045, 5, 40),
      new THREE.MeshBasicMaterial({
        color: "#77f2d2",
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    this.portal.position.set(-8.6, 1.6, 6);
    this.root.add(this.portal);
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(this.portal.geometry, this.portal.material);
      ring.position.copy(this.portal.position);
      ring.position.z -= 0.35 * (i + 1);
      ring.scale.setScalar(0.94 - i * 0.06);
      this.root.add(ring);
      this.portalDepth.push(ring);
    }
    this.floorPulse = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.68, 0.012, 0.025),
      this.glow,
      24,
    );
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      this.dummy.position.set(Math.sin(a) * 4.9, 0.018, Math.cos(a) * 4.9);
      this.dummy.rotation.set(0, -a, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.floorPulse.setMatrixAt(i, this.dummy.matrix);
    }
    this.root.add(this.floorPulse);
    // Runway marks and portal guide arrival without changing any walkable coordinates.
    const marks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.9, 0.015, 0.07),
      this.glow,
      8,
    );
    for (let i = 0; i < 8; i++) {
      this.dummy.position.set(-8.6, 0.015, 4.3 + i * 0.42);
      this.dummy.updateMatrix();
      marks.setMatrixAt(i, this.dummy.matrix);
    }
    this.root.add(marks);
    const floorLines = new THREE.BufferGeometry();
    const lines: number[] = [];
    for (let i = 0; i < 13; i++) {
      const x = (i - 6) * 1.7;
      lines.push(x, -0.035, -7, x, -0.035, 8, -10, -0.035, x, 10, -0.035, x);
    }
    floorLines.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(lines, 3),
    );
    this.root.add(
      new THREE.LineSegments(
        floorLines,
        new THREE.LineBasicMaterial({
          color: "#7794a0",
          transparent: true,
          opacity: 0.09,
        }),
      ),
    );
    this.sparks = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.06),
      new THREE.MeshBasicMaterial({
        color: "#8fffcf",
        transparent: true,
        opacity: 0.8,
      }),
      120,
    );
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparks.frustumCulled = false;
    this.sparks.count = 0;
    this.root.add(this.sparks);
    this.canvas.width = 1024;
    this.canvas.height = 384;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.panel = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 4.68),
      new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }),
    );
    this.panel.position.set(0, 5.1, -10.32);
    this.root.add(this.panel);
    this.bars = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.18, 1, 0.1),
      this.glow,
      28,
    );
    this.bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.bars);
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 2.3, 7, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? "#bc9fff" : "#77f2d2",
          transparent: true,
          opacity: 0.035,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      beam.position.set((i - 1.5) * 4, 4, -7);
      this.root.add(beam);
      this.beams.push(beam);
    }
    this.vipRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.065, 6, 40),
      new THREE.MeshBasicMaterial({
        color: "#ffd28b",
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.vipRing.rotation.x = Math.PI / 2;
    this.root.add(this.vipRing);
    this.crown = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: "#ffd28b" });
    for (let i = 0; i < 5; i++) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 4), gold);
      tip.position.set(
        Math.sin((i * Math.PI * 2) / 5) * 0.28,
        0,
        Math.cos((i * Math.PI * 2) / 5) * 0.28,
      );
      this.crown.add(tip);
    }
    this.root.add(this.crown);
    const positions = [];
    for (let i = 0; i < 80; i++)
      positions.push(
        Math.sin(i * 13.43) * 13,
        1 + (i % 17) * 0.4,
        -5 + Math.cos(i * 8.3) * 8,
      );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#90d9ce",
        size: 0.035,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.root.add(this.dust);
  }
  update(w: World, p: PresentationDirector, q: Quality) {
    const t = w.now,
      light = p.lights,
      amp =
        light.intensity *
        p.config.lightIntensity *
        (1 + p.energy * 0.2 + light.pulse * p.beatIntensity * 0.12);
    this.portal.visible = p.entranceStrength > 0;
    this.portalDepth.forEach(
      (r, i) =>
        (r.visible =
          this.portal.visible && (q === "HIGH" || (q === "MEDIUM" && i === 0))),
    );
    this.floorPulse.visible = q !== "LOW";
    this.floorPulse.scale.setScalar(1 + light.pulse * p.beatIntensity * 0.015);
    this.portal.scale.setScalar(1 + Math.sin(t * 2) * 0.04);
    (this.portal.material as THREE.MeshBasicMaterial).opacity =
      p.entranceStrength * 0.75;
    (this.portal.material as THREE.MeshBasicMaterial).color.set(
      p.entranceStrength === 1 ? "#ffd28b" : "#77f2d2",
    );
    this.glow.color.set(
      light.state === "GROOVE" ? p.config.accent : light.color,
    );
    this.glow.opacity = Math.min(0.95, 0.4 + amp * 0.4);
    this.beams.forEach((b, i) => {
      b.visible = q === "HIGH" || (q === "MEDIUM" && i < 2);
      b.rotation.z = Math.sin(t * 0.22 + i * 2) * 0.28;
      (b.material as THREE.MeshBasicMaterial).opacity =
        (0.018 + amp * 0.035) * (1 + light.pulse * 0.2);
    });
    this.dust.geometry.setDrawRange(
      0,
      q === "LOW" ? 20 : q === "MEDIUM" ? 45 : 80,
    );
    this.dust.rotation.y = t * 0.012;
    for (let i = 0; i < 28; i++) {
      const height =
        0.12 + (0.5 + 0.5 * Math.sin(t * 1.4 + i * 0.65)) * amp * 0.65;
      this.dummy.position.set((i - 13.5) * 0.17, 1.5, -7.75);
      this.dummy.scale.set(1, height, 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.bars.setMatrixAt(i, this.dummy.matrix);
    }
    this.bars.instanceMatrix.needsUpdate = true;
    let spark = 0;
    for (const e of w.effects.active.values()) {
      if (e.kind !== "aura" || t - e.start > 2) continue;
      const dancer = w.spawn.dancers.get(e.dancerId);
      if (!dancer) continue;
      for (let i = 0; i < (q === "LOW" ? 2 : 4) && spark < 120; i++) {
        const age = t - e.start,
          a = i * 2.4 + age * 1.8;
        this.dummy.position.set(
          dancer.position.x + Math.cos(a) * 0.65,
          0.15 + age * 0.7,
          dancer.position.z + Math.sin(a) * 0.65,
        );
        this.dummy.scale.setScalar(Math.max(0.1, 1 - age / 2));
        this.dummy.updateMatrix();
        this.sparks.setMatrixAt(spark++, this.dummy.matrix);
      }
    }
    this.sparks.count = spark;
    this.sparks.instanceMatrix.needsUpdate = true;
    const vip = p.vipId ? w.spawn.dancers.get(p.vipId) : undefined;
    this.vipRing.visible = !!vip;
    this.crown.visible = !!vip && !p.top;
    if (vip) {
      this.vipRing.position.set(vip.position.x, 0.04, vip.position.z);
      this.vipRing.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
      this.crown.position.set(
        vip.position.x,
        3.25 + Math.sin(t * 2) * 0.06,
        vip.position.z,
      );
      this.crown.rotation.y = t * 0.4;
    }
    const text =
      p.ledTitle +
      "|" +
      p.ledSubtitle +
      "|" +
      p.config.branding +
      "|" +
      p.config.accent;
    if (
      t - this.lastDraw > (q === "LOW" ? 0.3 : 0.12) ||
      text !== this.lastText
    ) {
      this.lastDraw = t;
      this.lastText = text;
      const ctx = this.canvas.getContext("2d")!;
      ctx.fillStyle = "#101e31";
      ctx.fillRect(0, 0, 1024, 384);
      const gradient = ctx.createLinearGradient(0, 0, 1024, 384);
      gradient.addColorStop(0, "#183f4a");
      gradient.addColorStop(0.55, "#232340");
      gradient.addColorStop(1, "#462c51");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1024, 384);
      ctx.strokeStyle = p.config.accent;
      ctx.globalAlpha = 0.17 + amp * 0.08;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        for (let x = 0; x <= 1024; x += 16) {
          const y = 192 + Math.sin(x / 150 + t * 0.4 + i * 0.15) * (40 + i * 9);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.fillStyle = light.color;
      ctx.font = "600 21px Segoe UI";
      ctx.fillText(
        vip
          ? "✦  " + (p.top ? "TOP CONTRIBUTOR" : "VIP MOMENT") + "  ✦"
          : p.config.branding
            ? `${p.config.sceneName.toUpperCase().split("").join(" ")}   S E S S I O N S`
            : "",
        512,
        90,
        925,
      );
      if (p.config.branding || vip || light.state === "FEATURED") {
        ctx.fillStyle = "#f1faf7";
        ctx.font = "800 78px Segoe UI";
        ctx.fillText(p.ledTitle, 512, 204, 925);
        ctx.font = "500 25px Segoe UI";
        ctx.fillStyle = "#b9d9db";
        ctx.fillText(p.ledSubtitle.slice(0, 80), 512, 262, 915);
      }
      ctx.fillStyle = p.config.accent;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(440, 301, 144, 3);
      ctx.globalAlpha = 1;
      this.texture.needsUpdate = true;
    }
  }
  dispose() {
    this.root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Points ||
        o instanceof THREE.LineSegments
      ) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.texture.dispose();
  }
}
