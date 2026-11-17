import * as THREE from "three";
import { visualDance, type Reaction } from "./presentation";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { hash, type Dancer } from "./domain";

export interface AvatarVisual {
  root: THREE.Group;
  update(d: Dancer, t: number, dt: number): void;
  dispose(): void;
}
type Shape = "round" | "box" | "ring";
interface Part {
  node: THREE.Object3D;
  shape: Shape;
  color: THREE.Color;
}
const palette = [
  "#bbfb73",
  "#bc9eff",
  "#ff9689",
  "#62dad5",
  "#ffc573",
  "#e97db2",
  "#78a3ff",
  "#f4e9db",
];
const skins = [
  "#eab894",
  "#bd825e",
  "#85583f",
  "#f6d0ac",
  "#704a39",
  "#d49b76",
];
const hairs = ["#26242e", "#5a3425", "#dcac59", "#442623", "#ece1d1"];
export const facePoses={NEUTRAL:[.012,0],HAPPY:[.025,.12],EXCITED:[.038,.24],SURPRISED:[.055,.32],VIP:[.018,-.25],HYPE:[.045,.18]} as const;
export function appearance(id: string) {
  const n = hash(id);
  return {
    hair: [
      "short",
      "medium",
      "curly",
      "bun",
      "ponytail",
      "fade",
      "styled",
      "long",
      "swept",
    ][n % 9],
    outfit: ["tee", "hoodie", "jacket", "crop-jacket", "party"][(n >>> 4) % 5],
    shoes: (n >>> 10) % 2 ? "sneakers" : "boots",
    accessory: ["none", "glasses", "headphones", "cap", "necklace", "wrist"][
      (n >>> 6) % 6
    ],
  };
}
export class ProceduralAvatar implements AvatarVisual {
  root = new THREE.Group();
  parts: Part[] = [];
  body = new THREE.Group();
  head = new THREE.Group();
  lArm = new THREE.Group();
  rArm = new THREE.Group();
  lFore = new THREE.Group();
  rFore = new THREE.Group();
  lLeg = new THREE.Group();
  rLeg = new THREE.Group();
  lShin = new THREE.Group();
  rShin = new THREE.Group();
  syncStart?: number;
  attention?: number;
  danceOverride?: ReturnType<typeof visualDance>;
  reaction?: { kind: Reaction; start: number; end: number };
  level = 0;
  rank = 0;
  cosmeticLimit = 3;
  private cosmetics: THREE.Object3D[] = [];
  private jumpBlend = 0;
  private mouth!: THREE.Object3D;
  private brows: THREE.Object3D[] = [];
  seed: number;
  scale = 1;
  pose = new Array<number>(15).fill(0);
  constructor(id: string, premiumArt = true) {
    this.seed = hash(id);
    const n = this.seed,
      skin = skins[n % skins.length],
      shirt = palette[(n >>> 4) % palette.length],
      hair = hairs[(n >>> 8) % hairs.length],
      pants = ["#292941", "#3c4d67", "#503956", "#c7c5ad"][(n >>> 12) % 4];
    this.root.add(this.body);
    this.body.position.y = 1.25;
    this.part(this.body, "round", [0, 0.24, 0], [0.37, 0.49, 0.235], shirt);
    this.part(this.body, "round", [0, -0.12, 0], [0.3, 0.23, 0.22], pants);
    this.part(this.body, "round", [0, 0.65, 0], [0.13, 0.19, 0.13], skin);
    this.body.add(this.head);
    this.head.position.y = 0.91;
    this.part(this.head, "round", [0, 0, 0], [0.32, 0.35, 0.29], skin);
    this.part(
      this.head,
      "round",
      [-0.31, -0.025, 0],
      [0.065, 0.105, 0.07],
      skin,
    );
    this.part(
      this.head,
      "round",
      [0.31, -0.025, 0],
      [0.065, 0.105, 0.07],
      skin,
    );
    this.part(this.head, "round", [0, 0.19, -0.02], [0.323, 0.23, 0.29], hair);
    if (n % 3 === 0) {
      this.part(this.head, "round", [0.2, 0.27, 0], [0.17, 0.18, 0.19], hair);
      this.part(this.head, "round", [-0.17, 0.27, 0], [0.18, 0.16, 0.2], hair);
    } else
      this.part(
        this.head,
        "round",
        [-0.17, 0.17, 0.2],
        [0.18, 0.13, 0.12],
        hair,
      );
    for (const x of [-0.108, 0.108]) {
      this.part(
        this.head,
        "round",
        [x, 0.015, 0.259],
        [0.07, 0.071, 0.029],
        "#fffaf1",
      );
      this.part(
        this.head,
        "round",
        [x, 0.006, 0.283],
        [0.035, 0.04, 0.016],
        "#222638",
      );
    }
    this.part(
      this.head,
      "round",
      [0, -0.076, 0.28],
      [0.043, 0.052, 0.048],
      skin,
    );
    this.part(
      this.head,
      "round",
      [0, -0.16, 0.255],
      [0.071, 0.018, 0.019],
      "#7b4142",
    );
    this.part(
      this.body,
      "box",
      [0.12, 0.33, 0.227],
      [0.08, 0.11, 0.012],
      "#ffffff",
    );
    for (const side of [-1, 1]) {
      const arm = side < 0 ? this.lArm : this.rArm,
        fore = side < 0 ? this.lFore : this.rFore,
        leg = side < 0 ? this.lLeg : this.rLeg,
        shin = side < 0 ? this.lShin : this.rShin;
      this.body.add(arm);
      arm.position.set(side * 0.36, 0.52, 0);
      arm.rotation.z = side * 0.12;
      this.part(arm, "round", [0, -0.15, 0], [0.145, 0.235, 0.16], shirt);
      this.part(arm, "round", [0, -0.28, 0], [0.095, 0.19, 0.095], skin);
      arm.add(fore);
      fore.position.y = -0.43;
      this.part(fore, "round", [0, -0.12, 0], [0.085, 0.19, 0.087], skin);
      this.part(fore, "round", [0, -0.33, 0], [0.094, 0.11, 0.075], skin);
      this.body.add(leg);
      leg.position.set(side * 0.17, -0.25, 0);
      this.part(leg, "round", [0, -0.19, 0], [0.135, 0.28, 0.145], pants);
      leg.add(shin);
      shin.position.y = -0.43;
      this.part(shin, "round", [0, -0.18, 0], [0.112, 0.24, 0.116], pants);
      this.part(
        shin,
        "round",
        [0, -0.37, 0.07],
        [0.137, 0.105, 0.225],
        "#ecebdf",
      );
      this.part(shin, "box", [0, -0.425, 0.07], [0.135, 0.03, 0.19], shirt);
    }
    for (const side of [-1, 1]) {
      this.part(
        this.head,
        "box",
        [side * 0.108, 0.105, 0.272],
        [0.068, 0.012, 0.018],
        hair,
      );
      this.part(
        side < 0 ? this.lFore : this.rFore,
        "round",
        [side * 0.06, -0.3, 0.025],
        [0.038, 0.062, 0.04],
        skin,
      );
      if ((n >>> 3) % 3 === 0)
        this.part(
          this.body,
          "box",
          [side * 0.24, 0.26, 0.13],
          [0.12, 0.32, 0.15],
          pants,
        );
    }
    if ((n >>> 5) % 3 === 0) {
      this.part(this.head, "round", [0, 0.4, -0.08], [0.19, 0.2, 0.18], hair);
      this.part(
        this.head,
        "round",
        [0, -0.16, -0.23],
        [0.32, 0.37, 0.16],
        hair,
      );
    }
    if ((n >>> 7) % 4 === 0) {
      this.part(this.head, "box", [0, 0.3, 0.02], [0.32, 0.08, 0.27], shirt);
      this.part(this.head, "box", [0, 0.24, 0.27], [0.31, 0.035, 0.16], shirt);
    }
    if ((n >>> 9) % 4 === 0) {
      for (const side of [-1, 1])
        this.part(
          this.head,
          "box",
          [side * 0.115, 0.027, 0.299],
          [0.085, 0.054, 0.013],
          "#344357",
        );
      this.part(
        this.head,
        "box",
        [0, 0.03, 0.296],
        [0.055, 0.012, 0.012],
        "#344357",
      );
    }
    if ((n >>> 11) % 3 === 0)
      this.part(
        this.body,
        "box",
        [0, 0.36, 0.245],
        [0.2, 0.025, 0.017],
        "#faf0d4",
      );
    this.mouth = this.part(
      this.head,
      "box",
      [0, -0.15, 0.287],
      [0.075, 0.012, 0.013],
      "#754237",
    );
    for (const side of [-1, 1])
      this.brows.push(
        this.part(
          this.head,
          "box",
          [side * 0.11, 0.12, 0.29],
          [0.06, 0.009, 0.012],
          hair,
        ),
      );
    this.cosmetics.push(
      this.part(this.head, "ring", [0, 0.43, 0], [0.3, 0.3, 0.3], "#ffe492"),
    );
    this.cosmetics[0].rotation.x = Math.PI / 2;
    this.cosmetics.push(
      this.part(
        this.body,
        "box",
        [0, 0.25, 0.243],
        [0.04, 0.27, 0.02],
        "#77f2d2",
      ),
    );
    this.cosmetics.push(
      this.part(
        this.head,
        "round",
        [0, 0.51, 0],
        [0.09, 0.12, 0.09],
        "#cfacff",
      ),
    );
    this.body.scale.x = 0.94 + ((n >>> 13) % 5) * 0.03;
    if (n % 4 === 0) {
      this.part(
        this.head,
        "round",
        [-0.345, 0.02, 0],
        [0.077, 0.14, 0.12],
        shirt,
      );
      this.part(
        this.head,
        "round",
        [0.345, 0.02, 0],
        [0.077, 0.14, 0.12],
        shirt,
      );
    }
    if (premiumArt) this.artPass(id, skin, shirt, hair, pants);
  }
  private artPass(
    id: string,
    skin: string,
    shirt: string,
    hair: string,
    pants: string,
  ) {
    const look = appearance(id),
      hairColor = new THREE.Color(hair);
    // Refine the existing rig; shared primitive batches remain unchanged.
    this.head.scale.set(0.96, 1.04, 0.96);
    for (const p of this.parts) {
      const n = p.node;
      if (n.parent === this.head) {
        // Retire duplicate mouth/eyebrows and coarse hair/cap pieces.
        if (n.position.y > 0.15 && n.scale.x > 0.15 && n !== this.cosmetics[0])
          n.visible = false;
        if (n.position.y < -0.1 && n.position.z < 0) n.visible = false;
        if (n.position.y === -0.16 && n.position.z === 0.255) n.visible = false;
        if (n.position.y === 0.105) n.visible = false;
        if (n.position.z > 0.29 && p.shape === "box") n.visible = false;
        if (Math.abs(n.position.x) > 0.33) n.visible = false;
        if (p.color.equals(hairColor) && n.scale.x > 0.15) n.visible = false;
      }
      if (n.parent === this.body && n.position.y === 0.24) {
        n.scale.set(0.34, 0.46, 0.215);
      }
      if (n.parent === this.body && p.shape === "box") n.visible = false;
      if((this.seed>>>7)%3===0 && (n.parent===this.lShin||n.parent===this.rShin)&&n.position.y===-.18)p.color.set(skin);
    }
    this.part(this.head, "round", [0, 0.19, -0.06], [0.31, 0.205, 0.28], hair);
    const style = look.hair;
    if (style === "curly")
      for (let i = 0; i < 5; i++)
        this.part(
          this.head,
          "round",
          [
            Math.sin(i * 2.4) * 0.23,
            0.28 + (i % 2) * 0.055,
            Math.cos(i * 2.4) * 0.19,
          ],
          [0.135, 0.14, 0.14],
          hair,
        );
    else if (style === "bun") {
      this.part(this.head, "round", [0, 0.43, -0.14], [0.16, 0.17, 0.16], hair);
    } else if (style === "ponytail") {
      this.part(
        this.head,
        "round",
        [0.04, 0.03, -0.34],
        [0.13, 0.29, 0.14],
        hair,
      );
    } else if (style === "long" || style === "medium")
      for (const side of [-1, 1])
        this.part(
          this.head,
          "round",
          [side * 0.265, -0.04, -0.11],
          [0.11, style === "long" ? 0.38 : 0.23, 0.19],
          hair,
        );
    else {
      this.part(
        this.head,
        "round",
        [-0.12, 0.29, 0.1],
        [0.23, style === "fade" ? 0.075 : 0.13, 0.19],
        hair,
      );
      this.part(
        this.head,
        "round",
        [0.17, 0.245, 0.08],
        [0.15, 0.1, 0.17],
        hair,
      );
    }
    // A single readable smile, separated eyes with tiny catchlights.
    for (const side of [-1, 1])
      this.part(
        this.head,
        "round",
        [side * 0.108 - 0.01, 0.024, 0.298],
        [0.01, 0.012, 0.007],
        "#ffffff",
      );
    this.mouth.scale.set(0.063, 0.014, 0.013);
    if (look.outfit === "hoodie") {
      this.part(this.body, "ring", [0, 0.65, -0.08], [0.24, 0.17, 0.16], shirt);
      this.part(
        this.body,
        "round",
        [0, 0.02, 0.205],
        [0.18, 0.09, 0.025],
        pants,
      );
    }
    if (look.outfit === "jacket" || look.outfit === "crop-jacket")
      for (const side of [-1, 1])
        this.part(
          this.body,
          "box",
          [side * 0.19, 0.29, 0.16],
          [0.12, look.outfit === "jacket" ? 0.29 : 0.19, 0.1],
          pants,
        );
    if (look.outfit === "party") {
      this.part(
        this.body,
        "box",
        [0, 0.26, 0.221],
        [0.015, 0.31, 0.013],
        "#ffe4a7",
      );
    }
    for (const side of [-1, 1]) {
      const shin = side < 0 ? this.lShin : this.rShin;
      this.part(
        shin,
        "box",
        [0, -0.34, 0.23],
        [0.072, 0.018, 0.018],
        look.shoes === "sneakers" ? shirt : "#e0bc7c",
      );
      if (look.shoes === "boots")
        this.part(
          shin,
          "round",
          [0, -0.26, 0.03],
          [0.118, 0.15, 0.125],
          "#293240",
        );
    }
    if (look.accessory === "glasses") {
      for (const side of [-1, 1])
        this.part(
          this.head,
          "ring",
          [side * 0.112, 0.02, 0.301],
          [0.085, 0.065, 0.04],
          "#253449",
        );
      this.part(
        this.head,
        "box",
        [0, 0.03, 0.302],
        [0.038, 0.01, 0.012],
        "#253449",
      );
    }
    if (look.accessory === "headphones")
      for (const side of [-1, 1])
        this.part(
          this.head,
          "round",
          [side * 0.32, 0.03, 0],
          [0.06, 0.12, 0.105],
          shirt,
        );
    if (look.accessory === "cap") {
      this.part(
        this.head,
        "round",
        [0, 0.265, 0.015],
        [0.325, 0.13, 0.27],
        pants,
      );
      this.part(
        this.head,
        "round",
        [0, 0.23, 0.25],
        [0.29, 0.025, 0.17],
        pants,
      );
    }
    if (look.accessory === "necklace") {
      this.part(
        this.body,
        "ring",
        [0, 0.55, 0.23],
        [0.09, 0.12, 0.04],
        "#edc786",
      );
    }
    if (look.accessory === "wrist")
      this.part(
        this.rFore,
        "ring",
        [0, -0.25, 0],
        [0.1, 0.08, 0.09],
        shirt,
      ).rotation.x = Math.PI / 2;
  }
  part(
    parent: THREE.Object3D,
    shape: Shape,
    pos: number[],
    scale: number[],
    color: string,
  ) {
    const node = new THREE.Object3D();
    node.position.set(...(pos as [number, number, number]));
    node.scale.set(...(scale as [number, number, number]));
    parent.add(node);
    this.parts.push({ node, shape, color: new THREE.Color(color) });
    return node;
  }
  update(d: Dancer, t: number, dt: number) {
    const a =
        this.syncStart !== undefined
          ? (t - this.syncStart) * 3.6
          : t * d.speed * 3.6 + d.phase,
      s = Math.sin(a),
      c = Math.cos(a),
      s2 = Math.sin(a * 2),
      walk = d.animationState === "Walk",
      idle = d.animationState === "Idle";
    const dance = this.danceOverride ?? visualDance(d);
    let jump = 0,
      spin = 0;
    let p = new Array<number>(15).fill(0);
    // Pose values: torso xyz, arms x/z, forearms x, hips x/z, knees x.
    if (walk) {
      p = [
        0.04,
        0,
        0.025 * s,
        0.62 * s,
        -0.12,
        -0.62 * s,
        0.12,
        -0.2,
        -0.2,
        -0.64 * s,
        0,
        0.64 * s,
        0,
        Math.max(0, 0.65 * c),
        Math.max(0, -0.65 * c),
      ];
    } else if (idle) {
      p = [
        0.02 * s,
        0.04 * s,
        0,
        -0.07,
        -0.12,
        -0.07,
        0.12,
        -0.12,
        -0.12,
        0,
        0,
        0,
        0,
        0.04,
        0.04,
      ];
    } else if (dance === "Groove") {
      p = [
        0.08 * c,
        0.17 * s,
        0.13 * s,
        -0.4 + 0.35 * s,
        -0.42,
        -0.4 - 0.35 * s,
        0.42,
        -0.65 - 0.25 * c,
        -0.65 + 0.25 * c,
        0.18 * s,
        -0.07,
        -0.18 * s,
        0.07,
        0.13 + 0.1 * c,
        0.13 - 0.1 * c,
      ];
    } else if (dance === "Disco") {
      p = [
        0.04 * s,
        0.22 * s,
        0.11 * s,
        -0.35,
        -0.45,
        -2.45 + 0.3 * s,
        0.48,
        -0.75,
        -0.2,
        0.26 * s,
        -0.1,
        -0.26 * s,
        0.12,
        0.12,
        0.12,
      ];
    } else if (dance === "Shuffle") {
      p = [
        0.12,
        0.1 * s,
        0.06 * s,
        0.65 * c,
        -0.22,
        -0.65 * c,
        0.22,
        -0.85,
        -0.85,
        0.68 * s,
        -0.07,
        -0.68 * s,
        0.07,
        0.4 * Math.max(0, c),
        0.4 * Math.max(0, -c),
      ];
    } else {
      p = [
        0.08 * s,
        0.25 * s,
        0.15 * c,
        -1.1 + 0.5 * s,
        -0.8 + 0.4 * c,
        -1.1 - 0.5 * s,
        0.8 + 0.4 * c,
        -0.9 + 0.6 * Math.sin(a + 0.8),
        -0.9 + 0.6 * Math.sin(a - 0.8),
        0.12 * s,
        -0.16,
        -0.12 * s,
        0.16,
        0.1,
        0.1,
      ];
    }
    if (!walk && !idle) {
      if (dance === "Bounce") {
        p = [
          0.14,
          0,
          0.04 * s,
          -0.7,
          -0.5,
          -0.7,
          0.5,
          -1.3,
          -1.3,
          0.2,
          0,
          0.2,
          0,
          0.3 + 0.25 * c,
          0.3 + 0.25 * c,
        ];
        jump = 0.12 * Math.abs(s);
      }
      if (dance === "Robot") {
        const step = Math.round(s * 2) / 2;
        p = [
          0.04,
          step * 0.3,
          0,
          -1.2 + step * 0.4,
          -0.5,
          -1.2 - step * 0.4,
          0.5,
          -1.57,
          -0.1,
          0.12 * step,
          0,
          -0.12 * step,
          0,
          0.12,
          0.12,
        ];
      }
      if (dance === "Spin") {
        p = [
          0.03,
          0.2 * s,
          0.03 * c,
          -0.3,
          -1.1,
          -0.3,
          1.1,
          -0.15,
          -0.15,
          0.35 * s,
          0,
          -0.35 * s,
          0,
          0.15,
          0.15,
        ];
        spin = a * 0.32;
      }
      if (dance === "Hype") {
        p = [
          0.1 * s,
          0.12 * c,
          0.09 * s,
          -2.4 + 0.3 * s,
          -0.4,
          -2.4 + 0.3 * s,
          0.4,
          -0.4,
          -0.4,
          0.22 * s,
          -0.1,
          -0.22 * s,
          0.1,
          0.16,
          0.16,
        ];
        jump = 0.1 * Math.max(0, s);
      }
      if (dance === "SideStep") {
        p = [
          0.04,
          0.1 * s,
          0.18 * s,
          -0.2 - 0.4 * s,
          -0.25,
          -0.2 + 0.4 * s,
          0.25,
          -0.7,
          -0.7,
          0.12,
          -0.3 * Math.max(0, s),
          0.12,
          0.3 * Math.max(0, -s),
          0.2,
          0.2,
        ];
      }
      if (dance === "Freestyle") {
        p = [
          0.12 * c,
          0.3 * s,
          0.1 * c,
          -0.6 + 0.8 * s,
          -0.65,
          -0.6 + 0.8 * c,
          0.65,
          -1 + 0.5 * c,
          -1 + 0.5 * s,
          0.4 * s,
          -0.12,
          -0.4 * c,
          0.12,
          0.2 + 0.15 * c,
          0.2 - 0.15 * c,
        ];
      }
      if (dance === "Electro")
        p = [
          0.05,
          0.32 * s,
          0.1 * c,
          -1.4 + 0.8 * c,
          -0.9,
          -1.4 - 0.8 * c,
          0.9,
          -1.5,
          0.1,
          0.35 * s,
          -0.12,
          -0.35 * s,
          0.12,
          0.2,
          0.2,
        ];
      if (dance === "HipHop")
        p = [
          0.24 + 0.12 * c,
          0.3 * s,
          0.12 * s,
          -0.4,
          -0.85,
          -0.8,
          0.6,
          -1.6,
          -1,
          0.4 * s,
          -0.25,
          -0.4 * s,
          0.25,
          0.4 + 0.2 * c,
          0.4 - 0.2 * c,
        ];
      if (dance === "Latin")
        p = [
          0.03,
          0.38 * s,
          0.19 * c,
          -0.6 + 0.5 * c,
          -0.8,
          -0.6 - 0.5 * c,
          0.8,
          -0.4,
          -0.4,
          0.3 * s,
          -0.18,
          -0.3 * s,
          0.18,
          0.14,
          0.14,
        ];
      if (dance === "JumpDance") {
        p = [
          0.08,
          0,
          0,
          -2 + 0.4 * c,
          -0.5,
          -2 + 0.4 * c,
          0.5,
          -0.2,
          -0.2,
          0.1,
          -0.2,
          0.1,
          0.2,
          0.25,
          0.25,
        ];
        jump = 0.3 * Math.abs(s);
      }
      if (dance === "ClapGroove")
        p = [
          0.05,
          0.12 * s,
          0.08 * s,
          -1.1,
          -0.15 - 0.35 * Math.abs(c),
          -1.1,
          0.15 + 0.35 * Math.abs(c),
          -1.1,
          -1.1,
          0.15 * s,
          -0.1,
          -0.15 * s,
          0.1,
          0.1,
          0.1,
        ];
      if (dance === "SmoothStep")
        p = [
          0.08 * c,
          0.2 * Math.sin(a * 0.5),
          0.22 * s,
          -0.2 + 0.3 * s,
          -0.2,
          -0.2 - 0.3 * s,
          0.2,
          -0.35,
          -0.35,
          0.25 * c,
          -0.24 * s,
          -0.25 * c,
          0.24 * s,
          0.1,
          0.1,
        ];
      // Weight shifts and delayed limbs make the related families read differently.
      if (dance === "Wave") {
        p[3] = -1.25 + 0.55 * Math.sin(a);
        p[5] = -1.25 + 0.55 * Math.sin(a - 1.5);
        p[7] = -0.8 + 0.5 * Math.sin(a - 0.7);
        p[8] = -0.8 + 0.5 * Math.sin(a - 2.2);
        p[9] = p[11] = 0.03;
        p[2] = 0.08 * Math.sin(a - 0.5);
      }
      if (dance === "Electro") {
        const hit = Math.tanh(Math.sin(a) * 3);
        p[3] = -1.3 + 0.65 * hit;
        p[5] = -1.3 - 0.65 * hit;
        p[7] = -0.5 - 0.7 * Math.max(0, Math.sin(a - 0.4));
        p[8] = -0.5 - 0.7 * Math.max(0, -Math.sin(a - 0.4));
      }
      if (dance === "SmoothStep") {
        p[0] = -0.06;
        p[9] = 0.4 * Math.max(0, s);
        p[11] = 0.4 * Math.max(0, -s);
        p[13] = 0.35 * Math.max(0, -s);
        p[14] = 0.35 * Math.max(0, s);
        p[3] = 0.2 * s;
        p[5] = -0.2 * s;
      }
      if (dance === "JumpDance") {
        jump = 0.23 * Math.pow(Math.max(0, s), 1.5);
        p[13] = p[14] = 0.12 + 0.32 * Math.max(0, -s);
        p[0] = 0.1 + 0.1 * Math.max(0, -s);
      }
      if (this.reaction && this.reaction.end > t) {
        const r = this.reaction,
          u = (t - r.start) / (r.end - r.start),
          wave = Math.sin((t - r.start) * 10);
        if (r.kind === "WAVE_HELLO") {
          p[5] = -2.3;
          p[6] = 0.5 + 0.3 * wave;
          p[8] = -0.8;
        } else if (r.kind === "HEART") {
          p[3] = p[5] = -1.25;
          p[4] = -0.25;
          p[6] = 0.25;
          p[7] = p[8] = -1.4;
        } else if (r.kind === "SHOCK") {
          p[0] = -0.18;
          p[3] = p[5] = -1.6;
          p[4] = -0.45;
          p[6] = 0.45;
          p[7] = p[8] = -1.7;
        } else if (r.kind === "APPLAUSE") {
          p[3] = p[5] = -1.15;
          p[4] = -0.2 - 0.25 * Math.abs(wave);
          p[6] = 0.2 + 0.25 * Math.abs(wave);
          p[7] = p[8] = -1.2;
        } else if (r.kind === "VIP_POSE") {
          p[1] = 0.15;
          p[3] = -0.6;
          p[4] = -0.65;
          p[5] = -2.5;
          p[6] = 0.2;
          p[7] = -1.6;
          p[8] = -0.1;
        } else if (r.kind === "TOP_POSE") {
          p[3] = p[5] = -0.3;
          p[4] = -1.4;
          p[6] = 1.4;
          p[7] = p[8] = -0.15;
          p[1] = 0.2 * s;
        } else if (r.kind === "HYPE_POSE") {
          p[3] = p[5] = -2.6;
          p[4] = -0.8;
          p[6] = 0.8;
          jump = 0.2 * Math.abs(wave);
        } else if (r.kind === "CHEER") {
          p[3] = -2.4;
          p[5] = -2.4;
          p[4] = -0.4;
          p[6] = 0.4;
        } else if (r.kind === "JUMP") {
          jump = 0.38 * Math.sin(Math.PI * Math.min(1, u));
          p[3] = -1.4;
          p[5] = -1.4;
        } else {
          p[3] = -2.5 + 0.2 * wave;
          p[5] = -2.5 - 0.2 * wave;
          p[1] = 0.3 * wave;
          jump = 0.12 * Math.abs(wave);
        }
      }
    }
    const blend = 1 - Math.exp(-dt * 10);
    for (let i = 0; i < p.length; i++)
      this.pose[i] += (p[i] - this.pose[i]) * blend;
    p = this.pose;
    this.jumpBlend += (jump - this.jumpBlend) * blend;
    jump = this.jumpBlend;
    const expression =
      this.reaction?.end && this.reaction.end > t ? this.reaction.kind : "";
    const face=expression==='SHOCK'?'SURPRISED':expression==='VIP_POSE'||expression==='TOP_POSE'?'VIP':expression==='HYPE_POSE'?'HYPE':expression==='WAVE_HELLO'||expression==='HEART'?'HAPPY':expression?'EXCITED':'NEUTRAL';
    this.head.userData.expression=face;
    this.mouth.scale.y += (facePoses[face][0]-this.mouth.scale.y)*blend;
    this.brows.forEach(
      (b, i) =>
        (b.rotation.z +=
          ((i?1:-1)*facePoses[face][1]-b.rotation.z) *
          blend),
    );
    this.cosmetics.forEach(
      (node, i) =>
        (node.visible =
          i < this.cosmeticLimit &&
          (i === 0 ? this.rank > 0 || this.level >= 1 : this.level >= i + 1)),
    );
    this.body.rotation.set(p[0], p[1] + spin, p[2]);
    this.body.position.y =
      1.25 +
      jump +
      (walk ? 0.035 * Math.abs(s) : idle ? 0.014 * s : 0.06 * Math.sin(a * 2));
    this.head.rotation.set(
      0,
      -p[1] * 0.4 +
        (this.attention === undefined
          ? 0
          : Math.max(
              -0.45,
              Math.min(
                0.45,
                Math.atan2(
                  Math.sin(this.attention - d.heading),
                  Math.cos(this.attention - d.heading),
                ),
              ),
            )),
      -p[2] * 0.5,
    );
    this.lArm.rotation.set(p[3], 0, p[4]);
    this.rArm.rotation.set(p[5], 0, p[6]);
    this.lFore.rotation.x = p[7];
    this.rFore.rotation.x = p[8];
    this.lLeg.rotation.set(p[9], 0, p[10]);
    this.rLeg.rotation.set(p[11], 0, p[12]);
    this.lShin.rotation.x = p[13];
    this.rShin.rotation.x = p[14];
    const enter =
      d.state === "SPAWNING"
        ? Math.min(1, (t - d.createdAt) / 0.15)
        : d.state === "EXITING"
          ? Math.min(
              1,
              Math.hypot(
                d.position.x - d.targetPosition.x,
                d.position.z - d.targetPosition.z,
              ) / 1.5,
            )
          : 1;
    this.scale +=
      ((d.effectState.includes("scale") ? 1.18 : 1) - this.scale) * blend;
    this.root.scale.setScalar(Math.max(0.01, enter) * this.scale);
    this.root.position.set(d.position.x, d.position.y, d.position.z);
    const angle = Math.atan2(
      Math.sin(d.heading - this.root.rotation.y),
      Math.cos(d.heading - this.root.rotation.y),
    );
    this.root.rotation.y += angle * blend;
    this.root.updateMatrixWorld(true);
  }
  dispose() {
    this.parts.length = 0;
    this.root.clear();
  }
}
export class AvatarBatch {
  private focusColor = new THREE.Color();
  meshes: Record<Shape, THREE.InstancedMesh>;
  counts = { round: 0, box: 0, ring: 0 };
  constructor(scene: THREE.Scene) {
    const geometries = {
      round: new THREE.SphereGeometry(1, 12, 8),
      box: new THREE.BoxGeometry(2, 2, 2),
      ring: new THREE.TorusGeometry(1, 0.08, 5, 16),
    };
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.02,
    });
    this.meshes = {} as Record<Shape, THREE.InstancedMesh>;
    for (const k of Object.keys(geometries) as Shape[]) {
      const m = new THREE.InstancedMesh(geometries[k], material, 4000);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = false;
      m.count = 0;
      this.meshes[k] = m;
      scene.add(m);
    }
  }
  update(avatars: Iterable<AvatarVisual>, focus?: AvatarVisual) {
    this.counts = { round: 0, box: 0, ring: 0 };
    for (const a of avatars)
      if (a instanceof ProceduralAvatar)
        for (const p of a.parts) {
          if (!p.node.visible) continue;
          const mesh = this.meshes[p.shape],
            i = this.counts[p.shape]++;
          mesh.setMatrixAt(i, p.node.matrixWorld);
          mesh.setColorAt(
            i,
            focus && a !== focus
              ? this.focusColor.copy(p.color).multiplyScalar(0.28)
              : p.color,
          );
        }
    for (const k of Object.keys(this.meshes) as Shape[]) {
      const m = this.meshes[k];
      m.count = this.counts[k];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
  dispose() {
    for (const m of Object.values(this.meshes)) {
      m.removeFromParent();
      m.dispose();
      m.geometry.dispose();
    }
    (this.meshes.round.material as THREE.Material).dispose();
  }
}
// Optional integration path for an original/licensed GLB. No model is fetched by the MVP.
// Require self-contained GLB, upright +Y, facing +Z, feet y=0, ~2.5 units tall.
export class GLBAvatar implements AvatarVisual {
  root = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = "";
  constructor(template: THREE.Group, clips: THREE.AnimationClip[]) {
    const model = clone(template);
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips)
      this.actions.set(clip.name, this.mixer.clipAction(clip));
  }
  static async load(url: string) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const required = ["Idle", "Walk", "Groove", "Disco", "Shuffle", "Wave"];
    for (const key of required)
      if (!gltf.animations.some((c) => c.name === key))
        throw Error(`GLB: falta clip ${key}`);
    return {
      create: () => new GLBAvatar(gltf.scene, gltf.animations),
      template: gltf.scene,
    };
  }
  update(d: Dancer, _t: number, dt: number) {
    if (this.current !== d.animationState) {
      const next = this.actions.get(d.animationState)!;
      this.actions.get(this.current)?.fadeOut(0.2);
      next.reset().fadeIn(0.2).play();
      next.time = d.phase % Math.max(0.01, next.getClip().duration);
      this.current = d.animationState;
    }
    this.mixer.timeScale = d.speed;
    this.mixer.update(dt);
    this.root.position.set(d.position.x, d.position.y, d.position.z);
    this.root.rotation.y = d.heading;
    this.root.scale.setScalar(d.effectState.includes("scale") ? 1.18 : 1);
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.root.removeFromParent();
  }
}
