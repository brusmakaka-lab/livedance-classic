import * as T from "three";
export type Quality = "LOW" | "MEDIUM" | "HIGH";
/** Original concert set. Shared geometry, instanced LEDs; no postprocessing or shadow maps. */
export class Stage {
  resources: (T.BufferGeometry | T.Material | T.Texture)[] = [];
  tiles: T.InstancedMesh;
  shadows: T.InstancedMesh;
  particles: T.Points;
  beams: T.Mesh[] = [];
  spots: T.SpotLight[] = [];
  accents: T.MeshBasicMaterial[] = [];
  staticBatches: T.InstancedMesh[] = [];
  quality: Quality = "MEDIUM";
  particlesEnabled = true;
  lightsEnabled = true;
  effectsEnabled = true;
  rim: T.PointLight;
  count = 1;
  concert = false;
  polish = true;
  silkFloor: T.Mesh;
  arches: T.InstancedMesh;
  silkMaterial: T.ShaderMaterial;
  backdrop: T.InstancedMesh;
  floorColors = [new T.Color("#164753"),new T.Color("#493469")];
  sets: { mesh: T.InstancedMesh; base: T.Matrix4[]; art: T.Matrix4[] }[] = [];
  intensity = 0.65;
  eventAge = 0;
  halo: T.Mesh;
  crown: T.InstancedMesh;
  vipBinding?: {id:string;origin:number[]};
  bindVip(subject?:{id:string;origin:T.Vector3}){
    this.vipBinding=subject ? {id:subject.id,origin:subject.origin.toArray()} : undefined;
    this.halo.userData.viewerId=this.crown.userData.viewerId=subject?.id;
    if(subject){
      this.halo.position.copy(subject.origin).add(new T.Vector3(0,1.75,-1.45));
      this.crown.position.copy(subject.origin);
    }
  }
  celebration: T.InstancedMesh;

  dummy = new T.Object3D();
  v = new T.Vector3();
  color = new T.Color();
  eventColor = new T.Color();
  feverColors = [new T.Color("#47d8ba"), new T.Color("#b651a9")];
  vipColors = [new T.Color("#e6b868"), new T.Color("#0c192b")];
  constructor(public scene: T.Scene) {
    scene.background = new T.Color("#080d1a");
    scene.fog = new T.Fog("#080d1a", 24, 62);
    scene.add(new T.HemisphereLight("#d4dfff", "#293348", 1.6));
    const key = new T.DirectionalLight("#fff7ef", 2.35);
    key.position.set(-3, 6, 7);
    scene.add(key);
    const fill = new T.DirectionalLight("#abcfe9", 1.45);
    fill.position.set(5, 4, -2);
    scene.add(fill);
    this.rim = new T.PointLight("#ef7899", 22, 18, 2);
    this.rim.position.set(0, 4, -3);
    scene.add(this.rim);
    const box = new T.BoxGeometry(1, 1, 1);
    this.resources.push(box);
    const material = (color: string, light = false) => {
      const m = light
        ? new T.MeshBasicMaterial({ color })
        : new T.MeshStandardMaterial({
            color,
            roughness: 0.6,
            metalness: 0.25,
          });
      this.resources.push(m);
      return m;
    };
    const ink = material("#142237"),
      steel = material("#334359"),
      dark = material("#0d1423");
    const cyan = material("#41bdb6", true) as T.MeshBasicMaterial,
      coral = material("#db796d", true) as T.MeshBasicMaterial;
    this.accents = [cyan, coral];
    // Original light fins: one draw call, shared box geometry, no textures or shadows.
    const finMat = material("#ffffff",true);
    this.backdrop = new T.InstancedMesh(box,finMat,24);
    this.backdrop.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.backdrop.frustumCulled = false;
    scene.add(this.backdrop);
    const batches = new Map<T.Material, T.Matrix4[]>();
    const cube = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      m: T.Material,
    ) => {
      const o = new T.Object3D();
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      o.updateMatrix();
      if (!batches.has(m)) batches.set(m, []);
      batches.get(m)!.push(o.matrix.clone());
      return o;
    };
    cube(0, -0.23, 100, 68, 0.45, 300, ink);
    // Recessed LED runway with restrained brightness, rather than a bright floor wash.
    const tileGeo = new T.PlaneGeometry(0.77, 0.77),
      tileMat = new T.MeshBasicMaterial({ color: 0xffffff });
    this.resources.push(tileGeo, tileMat);
    this.tiles = new T.InstancedMesh(tileGeo, tileMat, 455);
    this.tiles.instanceMatrix.setUsage(T.StaticDrawUsage);
    for (let i = 0; i < 455; i++) {
      this.dummy.position.set(
        ((i % 13) - 6) * 0.84,
        0.002,
        3.4 - Math.floor(i / 13) * 0.84,
      );
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.tiles.setMatrixAt(i, this.dummy.matrix);
      this.tiles.setColorAt(i, new T.Color("#152637"));
    }
    scene.add(this.tiles);
    const silkGeo=new T.PlaneGeometry(68,300);
    this.silkMaterial=new T.ShaderMaterial({
      uniforms:{time:{value:0},intensity:{value:.6},energy:{value:0},tint:{value:new T.Color("#43c5c0")}},
      vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:`varying vec2 vUv;uniform float time,intensity,energy;uniform vec3 tint;
      void main(){
        vec2 p=(vUv-.5)*vec2(2.,2.7);float r=length(p*vec2(1.,.8));
        float sweep=pow(.5+.5*sin(p.y*6.-time*.45+p.x*2.),5.);
        float rings=exp(-abs(r-.45)*90.)*.22+exp(-abs(r-.83)*70.)*.14+exp(-abs(r-1.16)*60.)*.08;
        vec3 palette=mix(vec3(.025,.32,.31),vec3(.27,.075,.39),smoothstep(-.8,.8,p.x));
        vec3 col=vec3(.009,.017,.032)+palette*(.1+sweep*.24*intensity+rings);
        col=mix(col,tint*.42,energy*(.45+.2*sweep));
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
    });
    this.silkFloor=new T.Mesh(silkGeo,this.silkMaterial);
    this.silkFloor.rotation.x=-Math.PI/2;this.silkFloor.position.set(0,.004,-10);
    scene.add(this.silkFloor);this.resources.push(silkGeo,this.silkMaterial);
    for (const side of [-1, 1]) {
      cube(side * 5.7, 0.02, -10.2, 0.045, 0.035, 30, cyan);
      cube(side * 6.2, -0.07, -10.2, 0.8, 0.3, 30, steel);
      // Speaker stacks create scale without covering the dancer.
      for (const z of [-5, -12]) {
        cube(side * 5, 1, z, 0.9, 2, 1, dark);
        for (let j = 0; j < 3; j++)
          cube(side * 5, 0.4 + j * 0.55, z + 0.51, 0.68, 0.39, 0.03, steel);
      }
    }
    // Three nested portals and raised wings give depth; no large text sign.
    for (let j = 0; j < 3; j++) {
      const z = -9 - j * 9,
        w = 5.6 + j * 0.55,
        h = 5.7 + j * 0.8;
      for (const side of [-1, 1]) {
        cube(side * w, h / 2, z, 0.28, h, 0.35, steel);
        cube(
          side * (w - 0.19),
          h / 2,
          z + 0.22,
          0.045,
          h,
          0.04,
          j % 2 ? coral : cyan,
        );
      }
      if (j === 2) cube(0, h, z, w * 2 + 0.3, 0.28, 0.35, steel);
      if (j === 2)
        cube(0, h - 0.18, z + 0.23, w * 2, 0.04, 0.045, j % 2 ? coral : cyan);
    }
    for (let i = 0; i < 12; i++) {
      const height = 1.4 + ((i * 7) % 5) * 0.36;
      cube((i - 5.5) * 0.87, height / 2, -29, 0.6, height, 0.55, steel);
      cube(
        (i - 5.5) * 0.87,
        height + 0.03,
        -28.7,
        0.6,
        0.035,
        0.05,
        i % 3 ? cyan : coral,
      );
    }
    // A compact central tunnel remains visible in the full-body hero shot.
    cube(0, 3.5, -32, 18, 7, 0.3, ink);
    for (let j = 0; j < 3; j++) {
      const z = -26 - j * 1.5,
        w = 2.4 + j * 0.25,
        h = 4.4 + j * 0.45;
      for (const side of [-1, 1]) {
        cube(side * w, h / 2, z, 0.16, h, 0.22, steel);
        cube(
          side * (w - 0.1),
          h / 2,
          z + 0.15,
          0.035,
          h,
          0.035,
          j % 2 ? coral : cyan,
        );
      }
      cube(0, h, z, w * 2, 0.16, 0.22, steel);
      cube(0, h - 0.1, z + 0.15, w * 2, 0.035, 0.035, j % 2 ? coral : cyan);
    }
    const beamGeo = new T.ConeGeometry(0.85, 7, 12, 1, true);
    beamGeo.translate(0, -3.5, 0);
    this.resources.push(beamGeo);
    for (let i = 0; i < 6; i++) {
      const color = new T.Color(i % 2 ? "#ec8b9d" : "#50c7d4");
      const mat = new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        uniforms: { tint: { value: color }, alpha: { value: 0.055 } },
        vertexShader:
          "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying vec2 vUv;uniform vec3 tint;uniform float alpha;void main(){float f=sin(vUv.x*3.14159265)*pow(vUv.y,.65);gl_FragColor=vec4(tint,alpha*f);}",
      });
      this.resources.push(mat);
      const beam = new T.Mesh(beamGeo, mat);
      beam.position.set(
        (i % 2 ? 1 : -1) * (2.3 + Math.floor(i / 2) * 1.1),
        5.5,
        -5 - Math.floor(i / 2) * 4,
      );
      scene.add(beam);
      this.beams.push(beam);
      cube(beam.position.x, 6.15, beam.position.z, 0.4, 0.3, 0.4, steel);
    }
    for (let i = 0; i < 2; i++) {
      const light = new T.SpotLight(
        i ? "#ffb090" : "#63e7d8",
        38,
        20,
        0.48,
        0.8,
        2,
      );
      light.position.set(i ? 4 : -4, 6, -3);
      scene.add(light, light.target);
      this.spots.push(light);
    }
    const haloGeo = new T.RingGeometry(1.65, 1.7, 64),
      haloMat = new T.MeshBasicMaterial({
        color: "#ffd187",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: T.DoubleSide,
      });
    this.halo = new T.Mesh(haloGeo, haloMat);
    this.halo.position.set(0, 1.75, -1.45);
    scene.add(this.halo);
    const crownGeo = new T.BoxGeometry(0.13, 0.13, 0.05),
      crownMat = new T.MeshBasicMaterial({
        color: "#ffd187",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
    this.crown = new T.InstancedMesh(crownGeo, crownMat, 7);
    for (let i = 0; i < 7; i++) {
      this.dummy.position.set(
        (i - 3) * 0.24,
        3.55 - Math.abs(i - 3) * 0.09,
        -1.45,
      );
      this.dummy.rotation.set(0, 0, Math.PI / 4);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.crown.setMatrixAt(i, this.dummy.matrix);
    }
    scene.add(this.crown);
    const barGeo = new T.BoxGeometry(0.1, 1, 0.1),
      barMat = new T.MeshBasicMaterial({
        color: "#a0ffdb",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
    this.celebration = new T.InstancedMesh(barGeo, barMat, 24);
    this.celebration.frustumCulled = false;
    scene.add(this.celebration);
    this.resources.push(haloGeo, haloMat, crownGeo, crownMat, barGeo, barMat);
    const positions = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      positions[i * 3] = Math.sin(i * 12.43) * 5.5;
      positions[i * 3 + 1] = 0.6 + (i % 23) * 0.21;
      positions[i * 3 + 2] = -2 - (i % 17) * 0.8;
    }
    const pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(positions, 3));
    const pm = new T.PointsMaterial({
      color: "#f0c59d",
      size: 0.025,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.resources.push(pg, pm);
    this.particles = new T.Points(pg, pm);
    scene.add(this.particles);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!,
      g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,.7)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(canvas),
      sg = new T.PlaneGeometry(1, 1),
      sm = new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      });
    this.resources.push(tex, sg, sm);
    this.shadows = new T.InstancedMesh(sg, sm, 60);
    this.shadows.count = 0;
    scene.add(this.shadows);
    const baseBatches = new Map(batches);
    batches.clear();
    // A bounded stage, rear wall and wings replace the repeated runway portals.
    cube(0, -0.23, -10, 21, 0.45, 29, ink);
    cube(0, 3.1, -25, 21, 6.2, 0.35, ink);
    for (const side of [-1, 1]) {
      cube(side * 9.8, 2.6, -22, 0.45, 5.2, 1.1, steel);
      cube(side * 9.45, 2.6, -21.4, 0.07, 5.2, 0.07, cyan);
      cube(side * 8.8, 0.1, -11, 0.08, 0.08, 24, cyan);
      cube(side * 8.3, 1.2, -16, 1.05, 2.4, 1.2, dark);
      for (let j = 0; j < 3; j++)
        cube(side * 8.3, 0.5 + j * 0.65, -15.38, 0.75, 0.45, 0.04, steel);
    }
    cube(0, 6.1, -23, 19, 0.24, 0.5, steel);
    cube(0, 5.92, -22.7, 18.7, 0.045, 0.04, cyan);
    // Segmented front apron: a visible edge, not a full-length corridor.
    // Continuous front floor keeps the lower vertical area clean.
    const archGeo=new T.TorusGeometry(4.8,.035,6,64,Math.PI);
    const archMat=material("#405b73",true);
    this.resources.push(archGeo);
    this.arches=new T.InstancedMesh(archGeo,archMat,3);
    for(let i=0;i<3;i++){
      this.dummy.position.set(0,0,-20-i*2);
      this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1+i*.2);this.dummy.updateMatrix();
      this.arches.setMatrixAt(i,this.dummy.matrix);
    }
    scene.add(this.arches);
    for (const [material, matrices] of baseBatches) {
      const mesh = new T.InstancedMesh(
        box,
        material,
        Math.max(matrices.length, batches.get(material)?.length || 0),
      );
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.count = matrices.length;
      this.sets.push({
        mesh,
        base: matrices,
        art: batches.get(material) || [],
      });
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.staticBatches.push(mesh);
    }
  }
  setConcert(value: boolean) {
    if (value === this.concert) return;
    this.concert = value;
    for (const { mesh, base, art } of this.sets) {
      const matrices = value ? art : base;
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.count = matrices.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < 455; i++) {
      const cols = value ? 19 : 13;
      this.dummy.position.set(
        ((i % cols) - (cols - 1) / 2) * (value ? 0.89 : 0.84),
        0.002,
        3.4 - Math.floor(i / cols) * (value ? 1.05 : 0.84),
      );
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.set(value ? 1.02 : 1, value ? 1.22 : 1, 1);
      this.dummy.updateMatrix();
      this.tiles.setMatrixAt(i, this.dummy.matrix);
    }
    this.tiles.instanceMatrix.needsUpdate = true;
    this.tiles.computeBoundingSphere();
  }
  layout(count: number) {
    this.count = count;
  }
  contact(feet: T.Object3D[]) {
    feet.forEach((f, i) => {
      f.getWorldPosition(this.v);
      this.dummy.position.set(this.v.x, 0.012, this.v.z + 0.08);
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.set(0.7, 0.8, 1);
      this.dummy.updateMatrix();
      this.shadows.setMatrixAt(i, this.dummy.matrix);
    });
    this.shadows.count = feet.length;
    this.shadows.instanceMatrix.needsUpdate = true;
  }
  update(t: number, bpm: number, reduced: boolean, energy = 0, event = "") {
    const pulse = reduced
      ? 0.35
      : 0.5 + 0.5 * Math.sin(((t * bpm) / 60) * Math.PI * 2);
    const polish = this.polish && this.concert;
    const motion = reduced || !this.effectsEnabled ? 0 : t;
    const movement = polish ? this.intensity : 0;
    const boost = this.effectsEnabled
      ? Math.max(0, energy) * this.intensity
      : 0;
    this.arches.visible=this.concert;
    this.silkFloor.visible=polish;
    this.tiles.visible=!polish;
    this.silkMaterial.uniforms.time.value=motion;
    this.silkMaterial.uniforms.intensity.value=this.intensity;
    this.silkMaterial.uniforms.energy.value=(event==="vip"||event==="fever")?boost:0;
    this.silkMaterial.uniforms.tint.value.copy(event==="vip"?this.vipColors[0]:this.feverColors[0]);
    const fever = event === "fever" ? boost : 0;
    const vip = event === "vip" ? boost : 0;
    this.backdrop.visible = polish;
    if(polish){
      for(let i=0;i<24;i++){
        const side=i%2?1:-1, row=Math.floor(i/2);
        const wave=.5+.5*Math.sin(row*.6-motion*.7);
        const h=1.1+row*.16+wave*.8*movement;
        this.dummy.position.set(side*(3.5+row*.36),1.6+h/2,-20-row*.2);
        this.dummy.rotation.set(0,0,side*-.16);
        this.dummy.scale.set(.045,h,.09);
        this.dummy.updateMatrix();this.backdrop.setMatrixAt(i,this.dummy.matrix);
        this.color.copy(this.feverColors[i%2]).multiplyScalar(.3+wave*.22*this.intensity);
        this.color.lerp(this.vipColors[0],vip*.6);
        this.backdrop.setColorAt(i,this.color);
      }
      this.backdrop.instanceMatrix.needsUpdate=true;
      this.backdrop.instanceColor!.needsUpdate=true;
    }
    this.halo.visible = this.crown.visible = vip > 0.001 && !!this.vipBinding;
    (this.halo.material as T.MeshBasicMaterial).opacity = vip * 0.85;
    (this.crown.material as T.MeshBasicMaterial).opacity = vip;
    this.halo.scale.setScalar(
      1 + (reduced ? 0 : Math.sin(this.eventAge * 1.4) * 0.035),
    );
    this.celebration.visible = fever > 0.001;
    (this.celebration.material as T.MeshBasicMaterial).opacity = fever * 0.8;
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1,
        row = Math.floor(i / 2),
        h =
          0.5 +
          ((reduced ? 0.5 : Math.sin(this.eventAge * 2.2 - row * 0.7)) * 0.5 +
            0.5) *
            2.4;
      this.dummy.position.set(side * 5.45, h / 2, -1 - row * 1.3);
      this.dummy.rotation.set(0, 0, side * 0.12);
      this.dummy.scale.set(1, h, 1);
      this.dummy.updateMatrix();
      this.celebration.setMatrixAt(i, this.dummy.matrix);
    }
    this.celebration.instanceMatrix.needsUpdate = true;
    this.rim.visible = this.lightsEnabled;
    this.rim.intensity = this.lightsEnabled ? 18 + boost * 16 : 0;
    this.rim.color
      .set(this.concert ? "#67cfda" : "#ef7899")
      .lerp(this.vipColors[0], vip)
      .lerp(this.feverColors[1], fever);
    this.spots.forEach((s, i) => {
      s.visible = this.lightsEnabled && this.quality !== "LOW";
      s.intensity =
        this.lightsEnabled && this.quality !== "LOW" ? 30 + boost * 18 : 0;
      s.color
        .set(i ? "#ffb090" : "#63e7d8")
        .lerp(this.vipColors[0], vip)
        .lerp(this.feverColors[i % 2], fever);
      s.target.position.set(
        (i ? 1 : -1) * (0.6 + (reduced ? 0 : Math.sin(t * 0.45) * (1.2+movement*1.2))),
        0,
        -2 - (polish ? 2 + Math.sin(motion*.32+i)*2*movement : 0),
      );
    });
    for (let i = 0; i < 455; i++) {
      const cols = this.concert ? 19 : 13;
      const row = Math.floor(i / cols),
        col = i % cols;
      const wave =
        0.5 + 0.5 * Math.sin(row * 0.65 + col * 0.55 - t * (reduced ? 0 : 1.5));
      this.color.set((row + col) % 7 === 0 ? "#314c65" : "#1c303e");
      this.color.multiplyScalar(
        0.45 + wave * 0.3 + boost * 0.28 + pulse * 0.08,
      );
      if(polish){
        const band = .5+.5*Math.sin(row*.53-col*.3-motion*.72);
        this.eventColor.copy(this.floorColors[0]).lerp(this.floorColors[1],.5+.5*Math.sin(row*.21+col*.37));
        this.eventColor.multiplyScalar(.55 + Math.pow(band,4)*1.1*this.intensity);
        this.color.lerp(this.eventColor,.85);
      }
      if (fever) {
        const flow = reduced
          ? 0.5
          : 0.5 + 0.5 * Math.sin(row * 0.65 - this.eventAge * 0.85);
        this.eventColor
          .copy(this.feverColors[0])
          .lerp(this.feverColors[1], flow);
        this.color.lerp(this.eventColor, fever * 0.4);
      }
      if (vip) {
        const radius = Math.hypot(
          (col - (cols - 1) / 2) * (this.concert ? 0.89 : 0.84),
          3.4 - row * (this.concert ? 1.05 : 0.84),
        );
        this.color.lerp(
          this.vipColors[radius < 2 ? 0 : 1],
          vip * (radius < 2 ? 0.65 : 0.75),
        );
      }
      if (this.concert)
        this.color.multiplyScalar(0.65 + (row % 5 === 0 ? 0.14 : 0));
      this.tiles.setColorAt(i, this.color);
    }
    this.tiles.instanceColor!.needsUpdate = true;
    this.beams.forEach((b, i) => {
      b.visible =
        this.effectsEnabled &&
        i < (this.quality === "LOW" ? 2 : this.quality === "MEDIUM" ? 4 : 6);
      b.rotation.set(
        0.2 + (reduced ? 0 : Math.sin(t * 0.25 + i) * (0.18+movement*.12)),
        0,
        (i % 2 ? 1 : -1) * (0.2 + (reduced ? 0 : Math.sin(t * 0.3 + i) * (0.15+movement*.16))),
      );
      (b.material as T.ShaderMaterial).uniforms.alpha.value =
        (0.08 + boost * 0.15) * this.intensity;
      (b.material as T.ShaderMaterial).uniforms.tint.value
        .set(i % 2 ? "#ec8b9d" : "#50c7d4")
        .lerp(this.vipColors[0], vip)
        .lerp(this.feverColors[i % 2], fever);
      if (fever && !reduced)
        b.rotation.z +=
          (i % 2 ? 1 : -1) *
          Math.sin(this.eventAge * 0.9 + i * 0.4) *
          0.22 *
          fever;
    });
    this.particles.visible = this.particlesEnabled && this.intensity > 0;
    this.particles.geometry.setDrawRange(
      0,
      this.quality === "LOW" ? 24 : this.quality === "MEDIUM" ? 80 : 160,
    );
    this.particles.rotation.y = reduced ? 0 : Math.sin(t * 0.09) * 0.08;
    const pm = this.particles.material as T.PointsMaterial;
    pm.size = 0.025 + fever * 0.055 + vip * 0.025;
    pm.opacity = (0.35 + fever * 0.5) * this.intensity;
    pm.color
      .set("#f0c59d")
      .lerp(this.vipColors[0], vip)
      .lerp(this.feverColors[0], fever);
    const p = this.particles.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const base = 0.6 + (i % 23) * 0.21;
      p.setY(i, base + (reduced ? 0 : Math.sin(t * 0.65 + i) * 0.55 * fever));
    }
    p.needsUpdate = true;
    this.accents[0].color.set("#41bdb6").lerp(this.feverColors[1], fever * 0.7);
    this.accents[1].color.set("#db796d").lerp(this.vipColors[0], vip);
  }
  dispose() {
    this.staticBatches.forEach((m) => m.dispose());
    this.arches.dispose();
    this.backdrop.dispose();
    this.tiles.dispose();
    this.shadows.dispose();
    this.crown.dispose();
    this.celebration.dispose();
    this.resources.forEach((r) => r.dispose());
    this.scene.clear();
  }
}
