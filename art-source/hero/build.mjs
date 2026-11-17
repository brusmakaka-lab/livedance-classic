import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";
import {
  loft,
  ellipsoid,
  tube,
  lock,
  patch,
  morph,
  clamp,
} from "./geometry.mjs";
import { spec, makeClips, clipNames } from "./motion.mjs";
globalThis.FileReader = class {
  result = null;
  onloadend = () => {};
  readAsArrayBuffer(b) {
    b.arrayBuffer().then((v) => {
      this.result = v;
      this.onloadend();
    });
  }
  readAsDataURL(b) {
    b.arrayBuffer().then((v) => {
      this.result = `data:${b.type};base64,${Buffer.from(v).toString("base64")}`;
      this.onloadend();
    });
  }
};
const out = "public/assets/hero";
await mkdir(out, { recursive: true });
const matSpec = {
  Skin: ["#b87d61", 0.66, 0],
  Hair: ["#30283e", 0.62, 0],
  HairLight: ["#51405d", 0.58, 0],
  Jacket: ["#267f86", 0.78, 0],
  Cream: ["#f4dfbc", 0.86, 0],
  Pants: ["#222b40", 0.89, 0],
  Coral: ["#f77864", 0.62, 0],
  Sole: ["#eae9db", 0.76, 0],
  Metal: ["#edc675", 0.3, 0.65],
  EyeWhite: ["#fff6e9", 0.35, 0],
  Iris: ["#407d79", 0.3, 0],
  Dark: ["#211c2b", 0.6, 0],
  Mouth: ["#733f46", 0.56, 0],
};
const manifest = {
  packVersion: 2,
  characterId: "afterglow-runner",
  revision: "hero.1",
  rigVersion: "LiveDanceHumanoid1",
  lods: [],
  animations: clipNames,
  materials: Object.keys(matSpec),
  attachments: ["head", "leftHand", "rightHand"],
  expressions: ["NEUTRAL", "HAPPY", "EXCITED", "SURPRISED", "HYPE", "VIP"],
  textures: [],
  origin:
    "Original authored surfaces, curves and keyframes in art-source/hero. No external models or textures.",
  license:
    "Original project content; redistribution with LiveDance permitted; Three.js MIT license retained.",
};
for (let lod = 0; lod < 3; lod++) {
  const n = [28, 18, 10][lod],
    sub = [3, 2, 1][lod],
    detail = [18, 12, 6][lod],
    root = new T.Group();
  root.name = "AfterglowRunner";
  root.userData = {
    packVersion: 2,
    characterId: manifest.characterId,
    rigVersion: manifest.rigVersion,
    lod,
  };
  const mats = Object.fromEntries(
    Object.entries(matSpec).map(([name, [color, roughness, metalness]]) => {
      const m = new T.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        side: T.DoubleSide,
      });
      m.name = name;
      return [name, m];
    }),
  );
  const bones = spec.map(([name]) => {
      const b = new T.Bone();
      b.name = name;
      return b;
    }),
    index = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  spec.forEach(([name, parent, x, y, z], i) => {
    bones[i].position.set(x, y, z);
    (parent ? bones[index[parent]] : root).add(bones[i]);
  });
  root.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  skeleton.calculateInverses();
  const buckets = new Map();
  function add(g, material, bone = "head", weights) {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute("uv");
    const p = g.getAttribute("position"),
      ids = [],
      ws = [];
    for (let i = 0; i < p.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(p, i),
        w = weights ? weights(v) : [[index[bone], 1]];
      let total = w.reduce((s, a) => s + a[1], 0);
      for (let j = 0; j < 4; j++) {
        ids.push(w[j]?.[0] ?? 0);
        ws.push((w[j]?.[1] ?? 0) / total);
      }
    }
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(ids, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(ws, 4));
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material).push(g);
  }
  const blend = (a, b, t) => [
      [index[a], 1 - clamp(t, 0, 1)],
      [index[b], clamp(t, 0, 1)],
    ],
    torso = (v) => blend("hips", "chest", (v.y - 1.18) / 0.4);
  function line(points, r, mat, bone, weights) {
    add(tube(points, r, detail, lod === 2 ? 4 : 6), mat, bone, weights);
  }
  add(
    loft(
      [
        [1.02, 0.25, 0.17],
        [1.05, 0.29, 0.19],
        [1.12, 0.31, 0.205],
        [1.32, 0.34, 0.22],
        [1.55, 0.37, 0.205],
        [1.7, 0.31, 0.16],
        [1.79, 0.15, 0.11],
        [1.8, 0.09, 0.075],
      ],
      n,
      sub,
    ),
    "Jacket",
    "chest",
    torso,
  );
  add(
    loft(
      [
        [1.025, 0.253, 0.176],
        [1.05, 0.319, 0.213],
        [1.105, 0.324, 0.222],
        [1.13, 0.322, 0.22],
      ],
      n,
      sub,
    ),
    "Pants",
    "hips",
  );
  for (const s of [-1, 1]) {
    add(
      patch(
        (u, v) => {
          const y = 1.14 + v * 0.56,
            x = s * (0.055 + u * (0.19 - 0.08 * v)),
            z =
              0.225 -
              Math.pow(x / 0.39, 2) * 0.07 -
              0.04 * Math.max(0, (y - 1.55) / 0.15);
          return [x, y, z];
        },
        Math.max(4, n / 2),
        detail,
      ),
      "Cream",
      "chest",
      torso,
    );
    line(
      [
        [s * 0.033, 1.11, 0.22],
        [s * 0.034, 1.35, 0.234],
        [s * 0.036, 1.6, 0.215],
        [s * 0.045, 1.76, 0.128],
      ],
      0.009,
      "Coral",
      "chest",
      torso,
    );
    line(
      [
        [s * 0.14, 1.23, 0.225],
        [s * 0.24, 1.28, 0.21],
        [s * 0.28, 1.31, 0.198],
      ],
      0.012,
      "Pants",
      "chest",
      torso,
    );
  }
  line(
    [
      [0, 1.1, 0.234],
      [0, 1.4, 0.248],
      [0, 1.68, 0.215],
    ],
    0.007,
    "Metal",
    "chest",
    torso,
  );
  add(
    ellipsoid(0.025, 1.6, 0.245, 0.018, 0.032, 0.011, n, 8),
    "Metal",
    "chest",
  );
  add(
    loft(
      [
        [1.69, 0.104, 0.1],
        [1.79, 0.119, 0.111],
        [1.85, 0.1, 0.09],
      ],
      n,
      sub,
    ),
    "Cream",
    "neck",
  );
  add(
    loft(
      [
        [1.78, 0.083, 0.073],
        [1.87, 0.09, 0.079],
        [1.98, 0.105, 0.09],
      ],
      n,
      sub,
    ),
    "Skin",
    "neck",
  );
  if (lod < 2) {
    for (const y of [1.06, 1.085]) {
      const pts = [];
      for (let j = 0; j <= 24; j++) {
        let a = (j / 24) * Math.PI * 2;
        pts.push([Math.cos(a) * 0.3, y, Math.sin(a) * 0.2]);
      }
      line(pts, 0.003, "Cream", "hips");
    }
    for (let k = 0; k < 3; k++)
      line(
        [
          [0.1 + k * 0.035, 1.5, 0.23],
          [0.115 + k * 0.035, 1.55 + (k % 2) * 0.025, 0.23],
        ],
        0.012,
        "Coral",
        "chest",
      );
  }
  const head = loft(
    [
      [1.94, 0.035, 0.06, 0, 0.02],
      [1.98, 0.145, 0.15, 0, 0.016],
      [2.08, 0.245, 0.208],
      [2.22, 0.316, 0.26],
      [2.39, 0.32, 0.267],
      [2.52, 0.268, 0.224],
      [2.61, 0.14, 0.125],
      [2.64, 0.001, 0.001],
    ],
    lod === 0 ? 64 : lod === 1 ? 32 : 16,
    lod === 0 ? 6 : sub,
  );
  const hp = head.getAttribute("position");
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i),
      y = hp.getY(i),
      z = hp.getZ(i);
    if (z > 0) {
      const nose =
          0.091 *
          Math.exp(-Math.pow(x / 0.051, 2) - Math.pow((y - 2.235) / 0.077, 2)),
        cheeks =
          0.018 *
          Math.exp(
            -Math.pow((Math.abs(x) - 0.19) / 0.07, 2) -
              Math.pow((y - 2.17) / 0.08, 2),
          );
      hp.setZ(i, z + nose + cheeks);
    }
  }
  head.computeVertexNormals();
  let fg = head.index ? head.toNonIndexed() : head;
  fg.deleteAttribute("uv");
  const ids = [],
    weights = [];
  for (let i = 0; i < fg.getAttribute("position").count; i++) {
    ids.push(index.head, 0, 0, 0);
    weights.push(1, 0, 0, 0);
  }
  fg.setAttribute("skinIndex", new T.Uint16BufferAttribute(ids, 4));
  fg.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
  morph(fg, ["Smile"], (v) => {
    if (v.z > 0.1)
      v.y +=
        0.022 *
        Math.exp(
          -Math.pow((Math.abs(v.x) - 0.18) / 0.1, 2) -
            Math.pow((v.y - 2.17) / 0.1, 2),
        );
    return v;
  });
  const face = new T.SkinnedMesh(fg, mats.Skin);
  face.name = "Face";
  face.updateMorphTargets();
  root.add(face);
  face.bind(skeleton);
  face.frustumCulled = false;
  for (const s of [-1, 1]) {
    add(
      ellipsoid(s * 0.324, 2.265, -0.025, 0.047, 0.088, 0.061, n, detail),
      "Skin",
    );
    add(
      ellipsoid(s * 0.35, 2.267, 0.012, 0.017, 0.05, 0.028, n, detail),
      "Coral",
    );
    if (lod < 2)
      line(
        [
          [s * 0.337, 2.19, 0.035],
          [s * 0.375, 2.165, 0.035],
          [s * 0.372, 2.128, 0.025],
          [s * 0.338, 2.13, 0.032],
        ],
        0.012,
        "Metal",
      );
  }
  function feature(name, g, mat, targets) {
    if (lod === 2) {
      add(g, mat, "head");
      return;
    }
    if (targets) morph(g, Object.keys(targets), (v, key) => targets[key](v));
    const m = new T.Mesh(g, mats[mat]);
    m.name = name;
    if (targets) m.updateMorphTargets();
    m.position.y = -2.3;
    bones[index.head].add(m);
    return m;
  }
  for (const s of [-1, 1]) {
    const ex = s * 0.135,
      ey = 2.32;
    const eye = patch(
      (u, v) => {
        const a = u * Math.PI * 2,
          r = v,
          x = Math.cos(a) * 0.095 * r,
          y =
            Math.sin(a) *
            0.057 *
            r *
            Math.pow(1 - Math.abs(Math.cos(a)) * 0.35, 0.5);
        return [
          ex + x,
          ey + y + s * x * 0.1,
          0.256 + 0.035 * (1 - r * r) - Math.abs(x) * 0.1,
        ];
      },
      n,
      Math.max(4, detail / 2),
    );
    feature("Eye" + (s < 0 ? "L" : "R"), eye, "EyeWhite", {
      Blink: (v) => {
        v.y = ey + (v.y - ey) * 0.06;
        return v;
      },
      Happy: (v) => {
        v.y = ey + (v.y - ey) * 0.78 + 0.008;
        return v;
      },
    });
    feature(
      "Iris" + s,
      ellipsoid(ex, ey, 0.291, 0.036, 0.038, 0.008, n, detail),
      "Iris",
      {
        Blink: (v) => {
          v.y = ey + (v.y - ey) * 0.04;
          return v;
        },
      },
    );
    feature(
      "Pupil" + s,
      ellipsoid(ex, ey, 0.299, 0.018, 0.025, 0.006, n, detail),
      "Dark",
      {
        Blink: (v) => {
          v.y = ey + (v.y - ey) * 0.04;
          return v;
        },
      },
    );
    if (lod < 2) {
      feature(
        "Catch" + s,
        ellipsoid(ex - 0.01, ey + 0.014, 0.305, 0.008, 0.009, 0.003, 12, 6),
        "EyeWhite",
        {
          Blink: (v) => {
            v.y = ey + (v.y - ey) * 0.04;
            return v;
          },
        },
      );
      const lid = [];
      for (let i = 0; i <= detail; i++) {
        let a = (i / detail) * Math.PI;
        lid.push([
          ex + Math.cos(a) * 0.098,
          ey + Math.sin(a) * 0.059 + s * Math.cos(a) * 0.01,
          0.26,
        ]);
      }
      feature("Lid" + s, tube(lid, 0.007, detail, 5), "Hair", {
        Blink: (v) => {
          v.y = ey + (v.y - ey) * 0.05;
          return v;
        },
      });
    }
    feature(
      "Brow" + s,
      tube(
        [
          [ex - s * 0.088, 2.419, 0.253],
          [ex, 2.438, 0.278],
          [ex + s * 0.083, 2.416, 0.246],
        ],
        lod === 2 ? 0.012 : 0.017,
        detail,
        6,
      ),
      "Hair",
      {
        Lift: (v) => {
          v.y += 0.035;
          return v;
        },
        VIP: (v) => {
          v.y += s * (v.x - ex) * 0.22;
          return v;
        },
      },
    );
  }
  const my = 2.105;
  feature(
    "Mouth",
    patch(
      (u, v) => {
        const a = u * Math.PI * 2,
          r = v;
        return [
          Math.cos(a) * 0.082 * r,
          my + Math.sin(a) * 0.017 * r + 0.009 * (Math.cos(a) * r) ** 2,
          0.226 + 0.012 * (1 - r * r),
        ];
      },
      n,
      Math.max(4, detail / 2),
    ),
    "Mouth",
    {
      Smile: (v) => {
        v.y = my + (v.y - my) * 1.6 + 0.017 * (v.x / 0.082) ** 2;
        return v;
      },
      Open: (v) => {
        v.y = my + (v.y - my) * 3.0;
        v.x *= 0.83;
        return v;
      },
    },
  );
  feature(
    "Lip",
    tube(
      [
        [-0.084, my + 0.008, 0.228],
        [0, my - 0.016, 0.24],
        [0.084, my + 0.008, 0.228],
      ],
      0.006,
      detail,
      5,
    ),
    "Coral",
    {
      Smile: (v) => {
        v.y += 0.014 * (v.x / 0.084) ** 2;
        return v;
      },
      Open: (v) => {
        v.y = my + (v.y - my) * 2.6;
        return v;
      },
    },
  );
  if (lod < 2)
    feature(
      "Teeth",
      patch((u, v) => [(u - 0.5) * 0.115, my + 0.015 - v * 0.009, 0.245], 8, 2),
      "EyeWhite",
    );
  add(
    loft(
      [
        [2.26, 0.26, 0.2, 0, -0.07],
        [2.43, 0.335, 0.26, 0, -0.036],
        [2.57, 0.28, 0.23, 0, -0.025],
        [2.66, 0.15, 0.15, 0, -0.005],
        [2.68, 0.005, 0.005],
      ],
      n,
      sub,
    ),
    "Hair",
  );
  const locks = [
    [
      [0.24, 2.42, 0.1],
      [0.25, 2.62, 0.1],
      [0.07, 2.74, 0.19],
      [-0.18, 2.57, 0.25],
    ],
    [
      [0.29, 2.42, -0.03],
      [0.31, 2.61, 0.01],
      [0.16, 2.76, 0.09],
      [-0.11, 2.64, 0.22],
    ],
    [
      [0.28, 2.45, -0.13],
      [0.26, 2.65, -0.07],
      [0.05, 2.74, 0.005],
      [-0.17, 2.6, 0.1],
    ],
    [
      [-0.26, 2.3, -0.035],
      [-0.33, 2.44, 0.005],
      [-0.24, 2.57, 0.12],
      [-0.18, 2.57, 0.24],
    ],
  ];
  locks.forEach((pts, i) =>
    add(
      lock(pts, 0.062, 0.078, detail, lod === 2 ? 5 : 10),
      i === 1 ? "HairLight" : "Hair",
    ),
  );
  if (lod < 2)
    for (let k = 0; k < 4; k++)
      line(
        [
          [0.27 - k * 0.009, 2.5, 0.03 + k * 0.025],
          [0.21 - k * 0.02, 2.65, 0.09 + k * 0.025],
          [0.01 - k * 0.018, 2.69, 0.18 + k * 0.015],
          [-0.14, 2.59, 0.27 - k * 0.008],
        ],
        0.005,
        "HairLight",
      );
  for (const s of [-1, 1]) {
    const side = s < 0 ? "left" : "right",
      aw = (v) =>
        blend(side + "UpperArm", side + "LowerArm", (1.44 - v.y) / 0.2),
      lw = (v) =>
        blend(side + "UpperLeg", side + "LowerLeg", (0.73 - v.y) / 0.2);
    add(
      loft(
        [
          [1.075, 0.074, 0.081, s * 0.456],
          [1.13, 0.091, 0.09, s * 0.45],
          [1.26, 0.103, 0.11, s * 0.447],
          [1.39, 0.115, 0.12, s * 0.43],
          [1.52, 0.146, 0.139, s * 0.394],
          [1.65, 0.15, 0.14, s * 0.35],
          [1.735, 0.09, 0.09, s * 0.3],
        ],
        n,
        sub,
      ),
      "Jacket",
      side + "UpperArm",
      aw,
    );
    add(
      loft(
        [
          [1.046, 0.075, 0.079, s * 0.456],
          [1.075, 0.084, 0.085, s * 0.456],
          [1.127, 0.089, 0.088, s * 0.45],
        ],
        n,
        sub,
      ),
      "Pants",
      side + "LowerArm",
    );
    line(
      [
        [s * 0.38, 1.66, 0.139],
        [s * 0.43, 1.46, 0.124],
        [s * 0.467, 1.25, 0.1],
        [s * 0.468, 1.14, 0.088],
      ],
      0.008,
      "Cream",
      side + "UpperArm",
      aw,
    );
    add(
      loft(
        [
          [0.87, 0.037, 0.026, s * 0.459, 0.02],
          [0.89, 0.058, 0.032, s * 0.459, 0.025],
          [0.96, 0.067, 0.037, s * 0.458, 0.02],
          [1.025, 0.05, 0.034, s * 0.456, 0.01],
          [1.065, 0.042, 0.032, s * 0.455],
        ],
        n,
        sub,
      ),
      "Skin",
      side + "Hand",
    );
    add(
      lock(
        [
          [s * 0.414, 0.985, 0.02],
          [s * 0.38, 0.948, 0.057],
          [s * 0.387, 0.914, 0.06],
        ],
        0.022,
        0.027,
        detail,
        6,
      ),
      "Skin",
      side + "Hand",
    );
    for (let f = 0; f < (lod === 2 ? 2 : 4); f++) {
      let x =
        s * 0.46 + (f - (lod === 2 ? 0.5 : 1.5)) * (lod === 2 ? 0.046 : 0.027);
      add(
        lock(
          [
            [x, 0.903, 0.025],
            [x, 0.857 - Math.abs(f - 1.5) * 0.006, 0.045],
            [x, 0.835 + Math.abs(f - 1.5) * 0.007, 0.065],
          ],
          lod === 2 ? 0.024 : 0.014,
          0.023,
          detail,
          6,
        ),
        "Skin",
        side + "Hand",
      );
    }
    add(
      loft(
        [
          [0.235, 0.091, 0.095, s * 0.17],
          [0.29, 0.101, 0.102, s * 0.17],
          [0.45, 0.112, 0.12, s * 0.17],
          [0.62, 0.14, 0.139, s * 0.17],
          [0.82, 0.168, 0.17, s * 0.17],
          [1.05, 0.18, 0.175, s * 0.16],
          [1.12, 0.162, 0.158, s * 0.155],
        ],
        n,
        sub,
      ),
      "Pants",
      side + "UpperLeg",
      lw,
    );
    line(
      [
        [s * 0.32, 1.02, 0.065],
        [s * 0.315, 0.84, 0.09],
        [s * 0.294, 0.64, 0.08],
        [s * 0.267, 0.32, 0.055],
      ],
      0.009,
      "Coral",
      side + "UpperLeg",
      lw,
    );
    if (lod < 2) {
      line(
        [
          [s * 0.31, 0.92, 0.11],
          [s * 0.32, 0.78, 0.12],
          [s * 0.235, 0.765, 0.162],
        ],
        0.008,
        "Jacket",
        side + "UpperLeg",
      );
      for (const y of [0.255, 0.278])
        line(
          [
            [s * 0.255, y, 0.06],
            [s * 0.17, y, 0.107],
            [s * 0.085, y, 0.06],
          ],
          0.004,
          "Cream",
          side + "LowerLeg",
        );
    }
    const foot = side + "Foot";
    add(
      loft(
        [
          [0.012, 0.1, 0.215, s * 0.17, 0.112],
          [0.025, 0.132, 0.245, s * 0.17, 0.116],
          [0.075, 0.139, 0.25, s * 0.17, 0.116],
          [0.103, 0.128, 0.239, s * 0.17, 0.115],
        ],
        n,
        sub,
      ),
      "Sole",
      foot,
    );
    add(
      loft(
        [
          [0.087, 0.13, 0.237, s * 0.17, 0.115],
          [0.112, 0.133, 0.235, s * 0.17, 0.112],
          [0.128, 0.12, 0.221, s * 0.17, 0.102],
        ],
        n,
        sub,
      ),
      "Coral",
      foot,
    );
    add(
      loft(
        [
          [0.114, 0.119, 0.214, s * 0.17, 0.1],
          [0.155, 0.123, 0.21, s * 0.17, 0.1],
          [0.2, 0.111, 0.175, s * 0.17, 0.067],
          [0.26, 0.088, 0.12, s * 0.17, 0.005],
          [0.28, 0.063, 0.08, s * 0.17, -0.014],
        ],
        n,
        sub,
      ),
      "Cream",
      foot,
    );
    add(
      loft(
        [
          [0.13, 0.086, 0.094, s * 0.17, -0.07],
          [0.23, 0.09, 0.09, s * 0.17, -0.06],
          [0.3, 0.065, 0.065, s * 0.17, -0.057],
        ],
        n,
        sub,
      ),
      "Jacket",
      foot,
    );
    for (const sign of [-1, 1])
      line(
        [
          [s * 0.17 + sign * 0.107, 0.135, 0.255],
          [s * 0.17 + sign * 0.118, 0.16, 0.12],
          [s * 0.17 + sign * 0.087, 0.24, -0.02],
        ],
        0.013,
        "Jacket",
        foot,
      );
    for (let k = 0; k < (lod === 2 ? 2 : 4); k++) {
      let z = 0.06 + k * 0.043,
        y = 0.267 - k * 0.018;
      line(
        [
          [s * 0.17 - 0.054, y, z],
          [s * 0.17, y + 0.007, z + 0.018],
          [s * 0.17 + 0.054, y, z],
        ],
        0.007,
        "Sole",
        foot,
      );
    }
    if (lod === 0)
      for (let k = 0; k < 7; k++)
        line(
          [
            [s * 0.17 - 0.12, 0.04, -0.02 + k * 0.04],
            [s * 0.17 + 0.12, 0.04, -0.02 + k * 0.04],
          ],
          0.003,
          "Pants",
          foot,
        );
  }
  for (const [name, gs] of buckets) {
    const geo = mergeGeometries(gs);
    gs.forEach((g) => g.dispose());
    const mesh = new T.SkinnedMesh(geo, mats[name]);
    mesh.name = "Hero_" + name;
    root.add(mesh);
    mesh.bind(skeleton);
    mesh.frustumCulled = false;
  }
  root.userData.animationSource =
    "Original eight clips, offline two-link leg solve";
  const clips = makeClips();
  root.updateMatrixWorld(true);
  const buffer = await new GLTFExporter().parseAsync(root, {
    binary: true,
    animations: clips,
    onlyVisible: false,
  });
  const file = `hero-lod${lod}.glb`;
  await writeFile(out + "/" + file, Buffer.from(buffer));
  let triangles = 0,
    meshes = 0;
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      meshes++;
      triangles +=
        (o.geometry.index?.count ?? o.geometry.getAttribute("position").count) /
        3;
    }
  });
  manifest.lods.push({
    level: lod,
    file,
    bytes: buffer.byteLength,
    triangles,
    meshes,
  });
  console.log(file, buffer.byteLength, triangles, meshes);
}
await writeFile(out + "/manifest.json", JSON.stringify(manifest, null, 2));
