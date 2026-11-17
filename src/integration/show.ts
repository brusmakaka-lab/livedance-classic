import {SceneDissolve} from './scene-dissolve';
import {HorizontalRows} from './horizontal-rows';
import { displayName } from "./display-name";
import { nameAccent, type NameCandidate } from "./name-layout";
import { TemporalNames } from './temporal-names';
import { MaterializeEffect, materializeState, backgroundDance } from "./materialize";
import {rowPlacement,rotationPlacement} from './rotation-layout';
import { ShowDirector } from './show-director';
import { PresentationPlayback } from './presentation-playback';
import { ProfilePhotoCache } from './profile-photo';
import { EntranceEffect, entranceState } from "./entrance";
import { LEDState } from "./led-state";
import { LEDWall } from "./led-wall";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { World, LiveEvent, Quality } from "../domain";
import type { EntertainmentDirector } from "../entertainment";
import { Stage } from "./show/stage";
import {
  placement,
  showEnvelope,
  showPhase,
  HIP,
  EXCITED,
} from "./show/show-plan";
import {
  getRig,
  cloneRig,
  createSkinRig,
  disposeActor,
  type ActorRig,
} from "./model";
import { FreeDanceDirector } from "./free-dance";
import { Player } from "./player";
import { TextureCache } from "./cache";
import { SkinClient, type Skin } from "./client";
import {
  loadIntegration,
  integrationConfig,
  type IntegrationConfig,
} from "./config";
type Actor = {
  rig: ActorRig;
  player: Player;
  skin: Skin;
  label: HTMLDivElement;
  born: number;
  labelSize?: {key:string;width:number;height:number};
  groupRevision?: number;
  vipMaterials?: T.MeshStandardMaterial[];
  insetMaterials?: T.MeshStandardMaterial[];
  headVertices?:Map<T.SkinnedMesh,number[]>;
  labelAnchor?:{x:number;y:number;revision:number};
  mainVisibleSince?:number;
  mainOpacity?:number;
};
/** Visual adapter: no ownership of World registry, scores, slots or EventIngress. */
export class IntegrationShow {
  config = loadIntegration();
  ledState = new LEDState();
  sourceLabel = () => "SIMULATOR";
  ledWall?: LEDWall;
  freeDance = new FreeDanceDirector();
  scene = new T.Scene();
  client = new SkinClient();
  cache = new TextureCache(4);
  cast = {visible:[] as string[]};
  private nameLayout = new TemporalNames();
  playback = new PresentationPlayback();
  readonly dissolve=new SceneDissolve();
  private labelViewRevision=-1;
  visualReadiness:Record<string,string>={};
  get events(){return this.director;}
  private photos = new Map<string,string>();
  private photoCache = new ProfilePhotoCache();
  bannerKey = "";
  actors = new Map<string, Actor>();
  pending = new Set<string>();
  templates: Record<string, ActorRig> = {};
  clips: Record<string, T.AnimationClip[]> = {};
  catalog: {id:string;label:string;duration:number;role:string}[] = [];
  entranceClip(){return this.clips.classic?.some(c=>c.name===this.config.entranceDance) ? this.config.entranceDance : HIP;}
  danceFor(id:string){
    const choices=[HIP,EXCITED,...this.catalog.filter(c=>c.role==="dance").map(c=>c.id)];
    if(choices.includes(this.config.backgroundDance))return this.config.backgroundDance;
    let hash=0;for(const c of id)hash=(hash*31+c.codePointAt(0)!)>>>0;
    return choices[hash%choices.length];
  }
  stage?: Stage;
  entranceEffect?: EntranceEffect;
  materializeEffect?: MaterializeEffect;
  ready = false;
  loading?: Promise<void>;
  failure = "";
  paused = false;
  disposed = false;
  time = 0;
  epoch = 0;
  lastFever = false;
  previewId?: string;
  previewEntranceDance = false;
  manual: "WIDE" | "HERO" = "WIDE";
  banner: HTMLDivElement;
  labels: HTMLDivElement;
  arrivalCard:HTMLDivElement;
  status: HTMLDivElement;
  unsubscribe: () => void;
  constructor(
    public world: World,
    public entertainment: EntertainmentDirector,
    public container: HTMLElement,
    public director = new ShowDirector(),
  ) {
    this.director.enableRows();
    this.world.spawn.retainParticipants=this.config.enabled;
    this.banner = document.createElement("div");
    this.banner.className = "integration-banner";
    this.labels = document.createElement("div");
    this.labels.className = "integration-labels";
    this.status = document.createElement("div");
    this.status.className = "integration-status";
    this.arrivalCard=document.createElement('div');this.arrivalCard.className='row-arrival-inset';this.arrivalCard.hidden=true;
    container.append(this.labels, this.banner, this.status,this.arrivalCard);
    this.unsubscribe = world.bus.subscribe((e) => this.receive(e));
    if (this.config.enabled) void this.init();
  }
  get active() {
    return this.config.enabled && this.ready && !this.failure && !this.disposed;
  }
  async init() {
    if (this.ready || this.disposed) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        await this.client.init();
        const gltf = await new GLTFLoader().loadAsync(
          "/integration/rio-mixamo.glb",
        );
        if (this.disposed) return;
        const src = getRig(gltf.scene),
          dummy = new T.Texture();
        const baked = await (
          await fetch("/integration/adapted-clips.json")
        ).json();
        let extra:any;
        try {const response=await fetch("/integration/dance-catalog.json");if(!response.ok)throw Error("Catalog unavailable");extra=await response.json();this.catalog=extra.catalog;} catch(e){this.world.bus.error("Dance catalog: "+e+"; existing clips retained");}
        for (const model of ["classic", "slim"] as const) {
          this.templates[model] = createSkinRig(src, model, dummy);
          this.clips[model] = [...baked[model].clips,...(extra?.[model]?.clips || [])].map((c: any) =>
            T.AnimationClip.parse(c),
          );
        }
        // Source geometry is used only to construct templates; no duplicate actor material ownership.
        const geometries = new Set(src.meshes.map((m) => m.geometry)),
          materials = new Set(
            src.meshes.flatMap((m) =>
              Array.isArray(m.material) ? m.material : [m.material],
            ),
          );
        disposeActor(src);
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        dummy.dispose();
        this.stage = new Stage(this.scene);
        this.entranceEffect = new EntranceEffect(this.scene);
        this.materializeEffect = new MaterializeEffect(this.scene);
        this.ledWall = new LEDWall(this.scene);
        this.ready = true;
        this.failure = "";
      } catch (e) {
        this.failure = String(e);
        this.world.bus.error(
          "IntegrationShow: " + e + "; renderer Phase2 conservado",
        );
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }
  configure(raw: Partial<IntegrationConfig>) {
    const was = this.config.enabled;
    this.config = integrationConfig({ ...this.config, ...raw });
    this.world.spawn.retainParticipants=this.config.enabled;
    try {
      localStorage.setItem(
        "LiveDance.integration.rowshow.v1",
        JSON.stringify(this.config),
      );
    } catch {
      this.world.bus.error("No se pudo guardar configuración v0.5");
    }
    if (this.config.enabled && !this.ready) void this.init();
    this.freeDance.cancel();
    if (was !== this.config.enabled) {
      this.reset();
      this.director.initialized = false;
    }
    this.syncClass();
  }
  syncClass() {
    document.body.classList.toggle("integration-active", this.active);
    this.banner.hidden = this.labels.hidden = !this.active;
    this.status.hidden = !this.config.enabled;
    this.status.textContent = this.failure
      ? "Fallo visual: render Phase2 activo"
      : !this.ready
        ? "Cargando skins y escenario…"
        : this.paused
          ? "PAUSA · F8 · identidades conservadas"
          : `${this.cast.visible.length} ${this.config.lineup ? "en fila" : "en pista"} · ${this.world.spawn.dancers.size} participantes`;
  }
  receive(e: LiveEvent) {
    if (!this.config.enabled || this.paused) return;
    if(e.avatarUrl){
      this.photos.set(e.viewerId,e.avatarUrl);

    }
    this.director.receive(e,this.config.materialize?this.config.followSeconds:5);
    this.ledState.receive(e);
    this.freeDance.receive(e, this.config);
    if (e.eventType === "SIMULATED" && e.giftId === "fever-demo") {
      this.entertainment.hype.add(100, this.world.now);
      return;
    }
  }
  async add(id: string, skin?: Skin) {
    if (this.pending.has(id) || this.actors.has(id)) return;
    this.pending.add(id);
    const epoch = this.epoch;
    let chosen: Skin | undefined;
    try {
      const d = this.world.spawn.dancers.get(id),
        record = skin ?? (await this.client.ensure(id, d?.username || id));
      chosen = record;
      await this.cache.load(record.hash);
      if (
        this.disposed ||
        epoch !== this.epoch ||
        !this.client.state.records.some((r) => r.id === record.id) ||
        (id === "__preview__" && record.id !== this.previewId) ||
        (!this.world.spawn.dancers.has(id) && id !== "__preview__")
      )
        return;
      const rig = cloneRig(this.templates[record.model]),
        materials = this.cache.acquire(record.hash);
      rig.meshes.forEach((m, j) => (m.material = materials[j]));
      rig.root.position.copy(rowPlacement(this.director.rotation.slotOf(id)));
      this.scene.add(rig.root);
      rig.root.visible = false;
      const player = new Player(rig.root, this.clips[record.model]);
      player.set(HIP, true);
      player.seek((this.actors.size % 5) * 0.27);
      const label = document.createElement("div");
      label.className = "integration-name";
      label.dataset.viewerId = id;
      const text=document.createElement('span');text.className='name-text';label.append(text);
      label.style.setProperty("--name-accent", nameAccent(id));
      this.labels.append(label);
      this.actors.set(id, {
        rig,
        player,
        skin: record,
        label,
        born: this.time,
      });
    } catch (e) {
      if (
        this.disposed ||
        epoch !== this.epoch ||
        (chosen && !this.client.state.records.some((r) => r.id === chosen!.id))
      )
        return;
      this.failure = String(e);
      this.world.bus.error("Skin assignment/load: " + e + "; fallback Phase2");
    } finally {
      this.pending.delete(id);
      if (
        id === "__preview__" &&
        this.previewId &&
        !this.actors.has(id) &&
        !this.failure &&
        !this.disposed
      ) {
        const latest = this.client.state.records.find(
          (r) => r.id === this.previewId,
        );
        if (latest) void this.add(id, latest);
      }
      this.cache.evict(
        this.client.state
          ? new Set(this.client.state.records.map((r) => r.hash))
          : undefined,
      );
    }
  }
  remove(id: string) {
    const a = this.actors.get(id);
    if (!a) return;
    a.vipMaterials?.forEach((m) => m.dispose());
    a.insetMaterials?.forEach(m=>m.dispose());
    a.player.dispose();
    disposeActor(a.rig);
    this.cache.release(a.skin.hash);
    a.label.remove();
    this.nameLayout.forget(id);
    this.playback.remove(id);
    this.actors.delete(id);
  }
  async previewEntrance() {
    if(this.paused)throw Error("Reanudá el espectáculo antes de probar un baile.");
    if(!this.config.enabled||!this.ready)throw Error("Activá el escenario Minecraft antes de probar un baile.");
    const skin=this.client.state.records.find(r=>r.id===this.previewId)||this.client.state.records[0];
    if(!skin)throw Error("Primero agregá una skin a la biblioteca.");
    await this.preview(skin.id);
    this.previewEntranceDance=true;
  }
  async preview(id?: string) {
    this.previewEntranceDance=false;
    if (id && (this.director.cue || this.director.active || this.director.entrances?.size))
      throw Error(
        "El evento tiene prioridad; esperá a que termine para previsualizar la skin.",
      );
    this.previewId = id;
    this.remove("__preview__");
    if (id) {
      const skin = this.client.state.records.find((r) => r.id === id);
      if (skin) await this.add("__preview__", skin);
    }
  }
  next() {
    this.previewId = undefined;
    this.remove("__preview__");
    this.director.next([...this.world.spawn.dancers.keys()].filter(id=>this.actors.has(id)),this.config.visibleCapacity);
  }
  pause() {
    this.paused = true;
    this.director.clear();
    this.entranceEffect?.clear();
    this.materializeEffect?.clear();
    this.freeDance.cancel();
    this.director.stop();
    this.epoch++;
    this.events.clear();
    
    this.previewId = undefined;
    this.remove("__preview__");
    this.syncClass();
  }
  resume() {
    this.paused = false;
    this.freeDance.cancel();
    this.lastFever = false;
    this.syncClass();
  }
  reset() {
    this.director.reset();this.dissolve.reset();this.playback.reset();this.photos.clear();
    this.nameLayout.clear();
    this.entranceEffect?.clear();
    this.materializeEffect?.clear();
    this.ledState.reset();
    this.freeDance.reset();
    this.epoch++;
    this.events.clear();
    
    this.lastFever = false;
    this.previewId = undefined;
    for (const id of this.actors.keys()) this.remove(id);
    this.cast.visible=[];
    this.cache.evict();
  }
  update(camera: T.PerspectiveCamera, dt: number, quality: Quality, bpm = 108) {
    this.syncClass();
    if (!this.active) return false;
    const rows=this.director.rotation as HorizontalRows;
    rows.budget=this.config.gpuBudget;rows.batch=this.config.retireBatch;this.director.segmentSize=this.config.segmentSize;
    const step = this.paused ? 0 : dt;
    this.time += step;
    if (!this.paused) {
      for (const [id, a] of this.actors)
        if (
          id === "__preview__"
            ? !this.previewId
            : rows.retired.has(id) || !this.world.spawn.dancers.has(id) ||
              this.client.record(id)?.id !== a.skin.id
        )
          this.remove(id);
      for (const [id] of this.world.spawn.dancers)
        if (!this.actors.has(id) && rows.wants(id) && this.pending.size<6) void this.add(id);
      const fever =
        this.entertainment.hype.getState(this.world.now) === "FEVER";
      if (fever && !this.lastFever)
        this.director.triggerFever();
      this.lastFever = fever;
      this.director.select([...this.actors.keys()],this.config.visibleCapacity);
      const seats=this.director.rotation.snapshot();
      const ready=new Set<string>();this.visualReadiness={};
      for(const [id,a] of this.actors){
        const slot=rows.slotOf(id),position=a.rig.root.position;
        const reason=slot<0||seats[slot]?.id!==id?'missing-seat':!a.rig.meshes.length?'missing-model':!position.toArray().every(Number.isFinite)||!a.rig.root.matrixWorld.elements.every(Number.isFinite)?'invalid-transform':a.rig.root.parent!==this.scene?'missing-scene':'ready';
        this.visualReadiness[id]=reason;if(reason==='ready')ready.add(id);
      }
      this.director.setVisualReady(ready);
      this.director.update(step,new Set(this.world.spawn.dancers.keys()),new Set(this.actors.keys()),new Set([...this.world.spawn.dancers.values()].filter(d=>d.vipUntil>this.world.now).map(d=>d.id)));
      const e = this.director.cue;
      if ((e || this.director.entrances.size) && this.previewId) {
        this.previewId = undefined;
        this.remove("__preview__");
      }
    }
    if(!this.previewId && !this.paused){
      this.cast.visible=this.director.select([...this.world.spawn.dancers.keys()].filter(id=>this.actors.has(id)),this.config.visibleCapacity);
    }
    const e = this.director.cameraCue || this.director.cue,
      ids =
        this.previewId && this.actors.has("__preview__")
          ? ["__preview__"]
          : this.cast.visible;
    const viewIds=this.previewId?ids:this.director.viewIds(ids);
    if (!this.paused)
      this.freeDance.update(
        step,
        !!e || this.lastFever || !!this.previewId || !ids.length,
        this.config,
      );
    this.stage!.setConcert(this.config.artMode === "CONCERT");
    this.container.dataset.art = this.config.artMode;
    this.container.dataset.lineup = String(!this.previewId);
    this.stage!.layout(ids.length);
    this.stage!.quality = quality;
    this.stage!.intensity = this.config.intensity;
    this.stage!.polish = this.config.stagePolish;
    this.stage!.eventAge = e?.age || 0;
    const reduced =
      this.config.fixed ||
      this.config.motion === "OFF" ||
      this.entertainment.config.reduceMotion;
    const isEntrance=e?.kind==='follow'||e?.kind==='welcome';
    const material = this.config.materialize && this.config.entrance && isEntrance ? materializeState(e!.age,reduced) : undefined;
    const arrival = material || (this.config.entrance && isEntrance ? entranceState(e!.age, reduced) : undefined);
    const lineupActive = !this.previewId;
    const companions=new Set(e?.kind==='vip'?viewIds.filter(id=>id!==e.id).sort((a,b)=>Math.abs(rows.slotOf(a)-rows.slotOf(e.id))-Math.abs(rows.slotOf(b)-rows.slotOf(e.id))).slice(0,4):[]);
    for (const [id, a] of this.actors) {
      if (!this.paused) a.rig.root.scale.setScalar(1);
      const index = ids.indexOf(id);
      const wasVisible=a.rig.root.visible;
      a.rig.root.visible = viewIds.includes(id);
      a.label.hidden = true;
      if (index < 0) continue;
      const highlighted=!!e && e.kind!=='fever';
      const target = lineupActive ? this.director.actorPosition(id,viewIds) : placement(
        index,
        ids.length,
        this.config.artMode === "CONCERT",
      );
      if(lineupActive && !wasVisible)a.rig.root.position.copy(target);
      else if (!lineupActive && this.time - a.born < 0.1)
        a.rig.root.position.copy(target).add(new T.Vector3(-0.35, 0, 0.1));
      else if (!this.paused)
        a.rig.root.position.lerp(target, 1 - Math.exp(-step * (lineupActive ? 5 : 3)));
      if (arrival && e?.id === id && !this.paused) {
        // The skeletal entrance and its existing particles remain unchanged.
        // A five-second welcome must have a visible, full-sized owner throughout.
        a.rig.root.scale.setScalar(lineupActive ? 1 : material ? material.scale : arrival.scale);
        a.rig.root.visible = viewIds.includes(id) && (lineupActive || arrival.visible);
      }
      const localEntry=this.director.entrances.get(id);
      const localAge=localEntry?.state==='active'?localEntry.age:undefined;
      // Every new body presents in its own permanent position, including bursts.
      if(localAge!==undefined&&!this.paused){a.rig.root.rotation.y=Math.sin(Math.min(1,localAge/1.2)*Math.PI)*.3;}
      else if(!this.paused)a.rig.root.rotation.y=0;
      const clip =
        id === "__preview__" && this.previewEntranceDance ? this.entranceClip() :
        localAge!==undefined && !(e?.kind==='vip'&&e.id===id) ? this.entranceClip() :
        e?.kind==='gift'&&e.id===id ? EXCITED :
        companions.has(id) ? EXCITED :
        arrival && e?.id === id ? this.entranceClip() :
        e?.kind === "vip" && e.id === id
          ? EXCITED
          : e?.kind === "fever"
            ? HIP
            : this.freeDance.groupLeft > 0
              ? EXCITED
              : this.freeDance.clip
                ? this.freeDance.clip
                : this.config.materialize ? this.danceFor(id)
                : index % 3 === 2
                  ? EXCITED
                  : HIP;
      if(!this.paused)this.playback.apply(id,a.player,clip,localAge!==undefined&&!(e?.kind==='vip'&&e.id===id)?localEntry!.presentationId:e&&(e.id===id||e.kind==='fever'||companions.has(id))?e.presentationId:undefined);
      if(!this.paused&&e?.kind==='vip'&&(e.id===id||companions.has(id))){
        const action=a.player.actions[EXCITED];action.time=e.age%action.getClip().duration;
        if(e.id===id)a.rig.root.scale.setScalar(1+.25*Math.min(1,e.age/.6,(e.duration-e.age)/.6));
      }
      a.player.paused = this.paused;
      a.player.update(step);
      a.rig.root.updateMatrixWorld(true);
    }
    const subjectId=e && e.kind!=='fever' ? e.id : undefined;
    const subjectActor=subjectId ? this.actors.get(subjectId) : undefined;
    const hero = (subjectActor || this.actors.get(ids[0]))?.rig.root.position || new T.Vector3();
    const bodyCorners=new Map<string,T.Vector3[]>();
    if(!this.previewId)for(const id of viewIds){const a=this.actors.get(id);if(!a)continue;const box=new T.Box3(),v=new T.Vector3();
      for(const m of a.rig.meshes)for(let i=0;i<m.geometry.attributes.position.count;i++)box.expandByPoint(m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld));
      box.expandByScalar(.12);const corners:T.Vector3[]=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new T.Vector3(x,y,z));bodyCorners.set(id,corners);
    }
    if(!this.paused){
      this.director.camera(camera,step,hero,{reduced,preview:!!this.previewId,manual:this.manual,group:ids.flatMap(id=>{const actor=this.actors.get(id);return actor?.rig.root.visible?[actor.rig.root.position]:[];}),bounds:[...bodyCorners.values()].flat()});
      if(!this.previewId)this.director.fitVisible(camera,viewIds.flatMap(id=>(this.actors.get(id)?.mainOpacity||0)>.05?bodyCorners.get(id)||[]:[]));
    }
    const framed=new Set<string>();
    for(const [id,a] of this.actors){
      if(this.previewId)break;
      if(!viewIds.includes(id)){a.mainVisibleSince=undefined;a.mainOpacity=0;continue;}
      const b=this.screenBounds(id,camera),fits=!!b&&b.x0>=.025&&b.x1<=.975&&b.y0>=.21&&b.y1<=.87;
      a.rig.root.visible=fits;
      if(!fits){a.mainVisibleSince=undefined;a.mainOpacity=0;continue;}
      a.mainVisibleSince??=this.time;
      a.mainOpacity=Math.min(1,Math.max(0,(this.time-a.mainVisibleSince)/.25));
      if(a.mainOpacity>=.95)framed.add(id);
    }
    const insetFrame=this.director.arrivalInset(.85);
    this.director.reportFraming(framed,insetFrame&&insetFrame.opacity>=.95?insetFrame.presentation.id:undefined);
    if(this.labelViewRevision!==this.director.cutRevision){this.nameLayout.clear();this.labelViewRevision=this.director.cutRevision;}
    // Camera-depth fog must not erase the cast when WIDE moves back for 20/30 dancers.
    if (this.scene.fog instanceof T.Fog) {
      const offset = Math.max(0, camera.position.distanceTo(hero) - 20);
      this.scene.fog.near = 24 + offset;
      this.scene.fog.far = 62 + offset;
    }
    // Keep background bodies whole during close shots; registry/casting are unchanged.
    // Conservative animation envelope (same bounds used by the camera), no GPU readback.
    if (this.config.cinematic && !lineupActive)
      for (const id of ids.filter((id) => id !== e?.id && id !== "__preview__")) {
        const a = this.actors.get(id);
        if (!a) continue;
        let safe = true;
        for (const x of [-1.5, 1.5])
          for (const y of [-0.15, 3.5])
            for (const z of [-1, 1]) {
              const p = a.rig.root.position
                .clone()
                .add(new T.Vector3(x, y, z))
                .project(camera);
              if (p.x < -0.84 || p.x > 0.84 || p.y < -0.5 || p.y > 0.78)
                safe = false;
            }
        a.rig.root.visible = safe;
      }
    const energy = e
      ? e.kind === "vip" || e.kind === "fever"
        ? showEnvelope(e.kind, e.age)
        : Math.min(1, e.age / 0.4, (e.duration - e.age) / 0.6)
      : 0;
    // Achromatic background attenuation during VIP; PNGs and shared skin materials stay intact.
    for (const [id, a] of this.actors) {
      const dim =
        this.config.artMode === "CONCERT" && e?.kind === "vip" && id !== e.id && !companions.has(id)
          ? energy * 0.86
          : 0;
      const fadeOut = rows.opacity(id,this.director.time);
      const fadeIn = this.previewId?1:(a.mainOpacity??1);
      const glow = 0;
      const opacity = Math.min(fadeIn,fadeOut);
      if (dim > 0.001 || opacity < .999 || glow > .001) {
        if (!a.vipMaterials) {
          a.vipMaterials = a.rig.meshes.map((m) =>
            (m.material as T.MeshStandardMaterial).clone(),
          );
          a.rig.meshes.forEach((m, i) => (m.material = a.vipMaterials![i]));
        }
        a.vipMaterials.forEach((m,i) => {m.color.setScalar(1-dim);m.opacity=opacity;m.emissive.setHex(0xb1e9a5);m.emissiveIntensity=glow;const shared=this.cache.entries.get(a.skin.hash)!.materials[i];m.transparent=opacity<.999||shared.transparent;m.depthWrite=opacity>=.999&&shared.depthWrite;});
      } else if (a.vipMaterials) {
        const shared = this.cache.entries.get(a.skin.hash)!.materials;
        a.rig.meshes.forEach((m, i) => (m.material = shared[i]));
        a.vipMaterials.forEach((m) => m.dispose());
        a.vipMaterials = undefined;
      }
    }
    if(this.entranceEffect)this.entranceEffect.spiral = !this.config.materialize && lineupActive;
    this.materializeEffect?.update(!this.paused && material ? e!.age : undefined,hero,this.config.intensity,reduced,quality === "LOW");
    this.entranceEffect?.update(!this.paused && arrival ? e!.age : undefined,hero,this.config.intensity,reduced,quality === "LOW");
    this.stage!.effectsEnabled = !this.paused;
    this.stage!.lightsEnabled = !this.paused;
    this.stage!.particlesEnabled = !this.paused;
    this.stage!.bindVip(e?.kind==='vip' && subjectActor?.rig.root.visible ? {id:e.id,origin:subjectActor.rig.root.position} : undefined);
    this.stage!.update(this.time, bpm, reduced, energy, e?.kind || "");
    if(this.ledWall)this.ledWall.compact = lineupActive;

    this.ledWall?.update(
      this.ledState,
      this.config.ledWall,
      this.paused,
      !!e || this.manual === "HERO",
      camera,
      this.time,
      reduced,
      this.sourceLabel(),
    );
    this.container.dataset.led = String(this.ledWall?.root.visible === true);
    this.stage!.contact(
      ids.flatMap((id) => {
        const a = this.actors.get(id);
        return a?.rig.root.visible
          ? [a.rig.bones.LFoot, a.rig.bones.RFoot]
          : [];
      }),
    );
    const width = this.container.clientWidth,
      height = this.container.clientHeight;
    const nameCandidates: NameCandidate[] = [];
    const subject=e && e.kind!=='fever' ? e.id : this.previewId ? '__preview__' : undefined;
    for (const id of [...ids].sort((a,b)=>Number(b===subject)-Number(a===subject))) {
      const a = this.actors.get(id);
      if (!a || !a.rig.root.visible) continue;
      // Stable model anchor: head bones can dip below the body during dances.
      const head=this.screenBounds(id,camera,true);
      const p=head?new T.Vector3(head.x0+head.x1-1,1-head.y0*2,0):(a.rig.bones.Head?a.rig.bones.Head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.5*a.rig.root.scale.y,0)):a.rig.root.localToWorld(new T.Vector3(0,2.25,0))).project(camera);
      if(a.labelAnchor?.revision===this.director.cutRevision){const alpha=1-Math.exp(-Math.min(.1,step)*24);p.x=T.MathUtils.lerp(a.labelAnchor.x,p.x,alpha);p.y=T.MathUtils.lerp(a.labelAnchor.y,p.y,alpha);}
      a.labelAnchor={x:p.x,y:p.y,revision:this.director.cutRevision};
      const gap=Math.max(12,Math.min(32,20*width/540));
      a.label.dataset.anchorY=String((1-p.y)*height/2);
      const hero=id===subject;
      const name =
        id === "__preview__"
          ? "VISTA PREVIA · " + a.skin.name
          : displayName(this.world.spawn.dancers.get(id)?.username, id);
      a.label.title = name;
      a.label.style.opacity=String((a.mainOpacity??1)*rows.opacity(id,this.director.time));
      const text=a.label.querySelector('.name-text')!;
      text.textContent=!hero&&this.config.backgroundNames==='COMPACT' ? Array.from(name).slice(0,10).join('')+(Array.from(name).length>10?'…':'') : name;
      a.label.dataset.protagonist='false';a.label.dataset.owner=String(hero);
      this.photoCache.bind(a.label,this.photos.get(id),this.config.profilePhotos,name);
      const sizeKey=[width,height,text.textContent,hero,this.config.profilePhotos].join('|');
      if(a.labelSize?.key!==sizeKey){
        a.label.hidden=false;a.label.style.visibility='hidden';a.label.style.width='max-content';
        const box=a.label.getBoundingClientRect();a.labelSize={key:sizeKey,width:box.width,height:box.height};
        a.label.style.visibility='';
      }
      a.label.hidden =
        !this.world.config.names ||
        (!hero&&this.config.backgroundNames==='OFF') || this.director.transitionRemaining>0 ||
        p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1 ||
        !Number.isFinite(p.x+p.y+p.z) || p.z < -1 || p.z > 1;
      if (
        !a.label.hidden &&
        viewIds.includes(id)
      )
        nameCandidates.push({
          id,
          x: ((p.x + 1) / 2) * width,
          y: ((1-p.y)/2)*height-gap,
          width:a.labelSize.width,
          height:a.labelSize.height,
          priority:hero?10:0,
        });
      a.label.hidden = true;
    }
    for (const label of this.nameLayout.place(
      nameCandidates,
      width,
      height,
      this.paused ? 0 : step,
      e || this.ledWall?.root.visible ? 0.235 : 0.15,
    )) {
      const el = this.actors.get(label.id)!.label;
      el.style.left = label.x + "px";
      el.style.top = label.y + "px";
      el.style.width = label.width + "px";
      el.hidden = false;
    }
    const shown=this.director.cue;
    this.banner.dataset.entrance = String(!!arrival);
    this.banner.dataset.kind = shown?.kind || "";
    this.banner.dataset.source = this.sourceLabel();
    this.banner.title = this.sourceLabel()==="SIMULATOR" ? "Prueba local del Simulator" : this.sourceLabel();
    this.banner.dataset.phase = showPhase(shown?.kind, shown?.age || 0);
    this.banner.hidden=!shown||this.paused;
    this.banner.dataset.viewerId=shown?.id||'';
    this.banner.dataset.presentationId=shown?.presentationId||'';
    this.banner.style.opacity = String(this.paused ? 0 : 1);
    const enter = shown ? 1-Math.pow(1-Math.min(1,shown.age/.55),3) : 0;
    const leave = shown ? Math.max(0,Math.min(1,(shown.age-shown.duration+.45)/.45)) : 0;
    this.banner.style.transform = 'none';
    this.banner.style.setProperty("--cue-progress",String(shown?Math.max(0,1-shown.age/shown.duration):0));
    const bannerKey = shown
      ? [shown.kind, shown.id, shown.name, shown.gift, arrival?.phase || showPhase(shown.kind, shown.age),this.config.profilePhotos,this.photos.get(shown.id)||''].join("|")
      : "";
    if (bannerKey !== this.bannerKey) {
      this.bannerKey = bannerKey;
      this.banner.replaceChildren();
      if (shown) {
        const small = document.createElement("small"),
          title = document.createElement("strong"),
          detail = document.createElement("span");
        small.textContent =
          shown.kind === "fever"
            ? "FEVER · " + showPhase(shown.kind, shown.age)
            : shown.kind === "vip"
              ? this.config.artMode === "CONCERT"
                ? "VIP · " +
                  showPhase(shown.kind, shown.age)
                : "VIP MOMENT"
              : shown.kind === "follow" || shown.kind === "welcome"
                ? "¡BIENVENIDO A LA PISTA!"
                : "GRACIAS POR EL REGALO";
        title.textContent = displayName(shown.name, shown.id);
        title.title = title.textContent;
        this.photoCache.bind(title,this.photos.get(shown.id),this.config.profilePhotos,title.textContent);
        detail.textContent =
          shown.kind === "fever"
            ? shown.age < 2
              ? "Comienza el espectáculo"
              : shown.age < 8.5
                ? "Clímax colectivo"
                : "Volvemos a la pista"
            : shown.kind === "follow" || shown.kind === "welcome"
              ? arrival ? ({ANUNCIO:"La pista es tuya",ENTRADA:"¡Hacé tu entrada!","EN LA PISTA":"Gracias por sumarte","A BAILAR":"Un nuevo integrante de la fiesta"}[arrival.phase] || "¡A bailar!") : "Tu personaje entra a la fiesta"
              : shown.gift;
        this.banner.append(small, title, detail);
      }
    }
    const inset=this.director.arrivalInset(.85);
    this.arrivalCard.hidden=!inset||this.paused||!!this.previewId;
    this.arrivalCard.style.opacity=String(inset?.opacity??0);
    if(inset){const p=inset.presentation,slot=rows.slotOf(p.id),key=p.id+':'+p.name+':'+slot;if(this.arrivalCard.dataset.identity!==key){this.arrivalCard.textContent=p.name+' · Fila '+(Math.floor(slot/20)+1)+' · Plaza '+(slot%20+1);this.arrivalCard.dataset.identity=key;}this.arrivalCard.dataset.viewerId=p.id;this.photoCache.bind(this.arrivalCard,this.photos.get(p.id),this.config.profilePhotos,p.name);}
    return true;
  }
  screenBounds(id:string,camera:T.PerspectiveCamera,headOnly=false){
    const a=this.actors.get(id);if(!a)return;
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity;
    const v=new T.Vector3();a.rig.root.updateMatrixWorld(true);
    if(headOnly&&!a.headVertices){
      a.headVertices=new Map();
      for(const m of a.rig.meshes){const bone=m.skeleton.bones.indexOf(a.rig.bones.Head),indices=m.geometry.attributes.skinIndex,weights=m.geometry.attributes.skinWeight,list:number[]=[];
        for(let i=0;i<indices.count;i++)if([[indices.getX(i),weights.getX(i)],[indices.getY(i),weights.getY(i)],[indices.getZ(i),weights.getZ(i)],[indices.getW(i),weights.getW(i)]].some(([b,w])=>b===bone&&w>.5))list.push(i);
        a.headVertices.set(m,list);
      }
    }
    for(const m of a.rig.meshes)for(const i of headOnly?a.headVertices!.get(m)!:Array.from({length:m.geometry.attributes.position.count},(_,i)=>i)){
      m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).project(camera);
      x0=Math.min(x0,(v.x+1)/2);x1=Math.max(x1,(v.x+1)/2);y0=Math.min(y0,(1-v.y)/2);y1=Math.max(y1,(1-v.y)/2);z0=Math.min(z0,v.z);z1=Math.max(z1,v.z);
    }
    return [x0,x1,y0,y1,z0,z1].every(Number.isFinite)&&z0>=-1&&z1<=1?{x0,x1,y0,y1}:undefined;
  }
  renderMain(renderer:T.WebGLRenderer,camera:T.PerspectiveCamera){this.dissolve.render(renderer,this.scene,camera,this.director.cutRevision,this.director.transitionRemaining);}
  renderArrivalInset(renderer:T.WebGLRenderer){
    if(this.paused||this.previewId)return;
    const size=renderer.getSize(new T.Vector2()),w=Math.round(size.x*.34),h=Math.round(size.y*.22),x=Math.round(size.x*.05),y=Math.round(size.y*.20);
    const frame=this.director.arrivalInset(w/h);if(!frame)return;
    const actor=this.actors.get(frame.presentation.id);if(!actor)return;
    const viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),test=renderer.getScissorTest(),clear=renderer.autoClear;
    const savedMaterials=actor.rig.meshes.map(m=>m.material);
    const shared=this.cache.entries.get(actor.skin.hash)!.materials;
    const materials=actor.insetMaterials ||= shared.map(m=>m.clone());
    materials.forEach((copy,i)=>{copy.opacity=shared[i].opacity*frame.opacity;copy.transparent=true;copy.depthWrite=frame.opacity>=.999;});
    actor.rig.meshes.forEach((m,i)=>m.material=materials[i]);
    const visibility=[...this.actors].map(([id,a])=>({a,visible:a.rig.root.visible,id}));
    try{
      for(const entry of visibility)entry.a.rig.root.visible=entry.id===frame.presentation.id;
      renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.setScissorTest(true);renderer.autoClear=true;
      renderer.render(this.scene,frame.camera);
    }finally{actor.rig.meshes.forEach((m,i)=>m.material=savedMaterials[i]);for(const entry of visibility)entry.a.rig.root.visible=entry.visible;renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.autoClear=clear;}
  }
  inspect(camera?: T.PerspectiveCamera) {
    return {
      config: this.config,
      visualReadiness:this.visualReadiness,
      leds: {
        follow: this.ledState.follow,
        gift: this.ledState.gift,
        enabled: this.config.ledWall,
        uploads: this.ledWall?.uploads,
        visible: this.ledWall?.root.visible,
      },
      lineup: {enabled:true,order:[...this.cast.visible],capacity:20,segment:this.director.viewIds(this.cast.visible)},
      vipBinding:this.stage?.vipBinding,
      entrance: {enabled:this.config.entrance,effect:this.entranceEffect?.root.visible,materialize:this.materializeEffect?.root.visible,interval:this.config.materialize ? this.config.followSeconds : 4.2},
      freeDance: this.freeDance.inspect(),
      ready: this.ready,
      showDirector: this.director.inspect(),
      // Existing connector export reads this historical field; no connector changes.
      spotlight: this.director.inspect(),
      playback: this.playback.inspect(),
      effectiveCue: this.director.cue,
      labels: [...this.actors].map(([id,a])=>({id,visible:!a.label.hidden,protagonist:a.label.dataset.protagonist==='true',x:parseFloat(a.label.style.left),y:parseFloat(a.label.style.top)})),
      failure: this.failure,
      paused: this.paused,
      arrivalInset:this.arrivalCard.hidden?undefined:this.arrivalCard.dataset.viewerId,
      registered: [...this.world.spawn.dancers.keys()],
      stats: [...this.world.spawn.dancers.values()].map(d=>({id:d.id,score:d.contributionScore})),
      visible: this.cast.visible,
      preview: this.previewId,
      event: this.events.active,
      queued: this.events.queue.length,
      waiting: this.director.queue.filter(p=>p.id&&!this.actors.has(p.id)).length,
      dropped: this.events.dropped,
      started: this.events.started,
      cache: this.cache.snapshot(),
      pending: this.pending.size,
      actors: [...this.actors].map(([id, a]) => ({
        id,
        slot: this.director.rotation.slotOf(id),
        skinId: a.skin.id,
        dance: a.player.state,
        danceTime: a.player.actions[a.player.state]?.time,
        model: a.skin.model,
        visible: a.rig.root.visible,
        position: a.rig.root.position.toArray(),
        scale:a.rig.root.scale.x,
        opacity:(a.rig.meshes[0].material as T.Material).opacity,
      })),
      camera: camera
        ? {
            position: camera.position.toArray(),
            quaternion: camera.quaternion.toArray(),
            target: this.director.target.toArray(),
            viewOffset: camera.view?.enabled === true,
          }
        : undefined,
    };
  }
  framing(camera: T.PerspectiveCamera) {
    const result: any[] = [];
    for (const [id, a] of this.actors) {
      if (!a.rig.root.visible) continue;
      let x0 = 1,
        x1 = 0,
        y0 = 1,
        y1 = 0;
      const v = new T.Vector3();
      a.rig.root.updateMatrixWorld(true);
      for (const mesh of a.rig.meshes)
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh
            .getVertexPosition(i, v)
            .applyMatrix4(mesh.matrixWorld)
            .project(camera);
          x0 = Math.min(x0, (v.x + 1) / 2);
          x1 = Math.max(x1, (v.x + 1) / 2);
          y0 = Math.min(y0, (1 - v.y) / 2);
          y1 = Math.max(y1, (1 - v.y) / 2);
        }
      result.push({ id, x0, x1, y0, y1 });
    }
    return result;
  }
  dispose() {
    this.disposed = true;
    this.entranceEffect?.dispose();
    this.materializeEffect?.dispose();
    this.unsubscribe();
    this.reset();
    for (const r of Object.values(this.templates)) {
      const gs = new Set(r.meshes.map((m) => m.geometry)),
        ms = new Set(
          r.meshes.flatMap((m) =>
            Array.isArray(m.material) ? m.material : [m.material],
          ),
        );
      disposeActor(r);
      gs.forEach((g) => g.dispose());
      ms.forEach((m) => m.dispose());
    }
    this.cache.unusedLimit = 0;
    this.cache.evict();
    this.ledWall?.dispose();
    this.stage?.dispose();
    this.dissolve.dispose();
    this.arrivalCard.remove();
    this.banner.remove();
    this.labels.remove();
    this.status.remove();
  }
}


