import { eventSoundsPanel } from "./sound-panel";
import { CaptureDiagnostics } from "./capture-diagnostics";
const captureDiagnostics = new CaptureDiagnostics();
import {
  CharacterStore,
  characterConfig,
  danceChoices,
  type CharacterConfig,
} from "./characters";
import { AdmissionGate } from "./admission";
import { mountLiveConnector } from "./live-connector";
import { palettes, accessories } from "./block/core";
import "./style.css";
import "./integration/style.css";
import {
  integrationPanel,
  mountIntegration,
  drawSkins,
} from "./integration/ui";
import { recordShow } from "./integration/record";
import { mountCinema, updateCinema } from "./cinematic-ui";
import {
  retentionPanel,
  libraryPanel,
  mountRetention,
  updateParty,
  loadParty,
  refreshLibrary,
} from "./retention-ui";
import {
  ConfigStore,
  defaults,
  validateConfig,
  World,
  SlotAllocator,
  type Config,
  type EventType,
  type Tier,
  type LiveEvent,
} from "./domain";
import { SceneManager } from "./scene";
import { AudioManager } from "./audio";
import { PresentationStore, visualDance } from "./presentation";
import {
  playlistPanel,
  presentationPanel,
  mountStudio,
  updateMusicUI,
} from "./studio";

const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">${path}</svg>`;
const icons = [
  '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"/>',
  '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
  '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  '<path d="m8 3 11 9-11 9z"/>',
  '<rect x="3" y="6" width="13" height="13" rx="2"/><path d="m16 10 5-3v11l-5-3"/>',
  '<path d="M10 3v14m0-11 10-3v11"/><ellipse cx="6" cy="18" rx="4" ry="3"/><ellipse cx="16" cy="15" rx="4" ry="3"/>',
  '<path d="M3 20h18M5 16v-5m7 5V4m7 12V8"/>',
  '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1 1 4-2 2 2 3 3-1 2 3 4-1 1-3 3-1-1-4 2-2-2-3-3 1-2-3z"/>',
];
const sections = [
  "Dashboard",
  "Scene",
  "Dancers",
  "Events",
  "Simulator",
  "Camera",
  "Audio",
  "Performance",
  "Settings",
];
const titles: Record<string, string> = {
  Dashboard: "Tu pista. Su momento.",
  Scene: "Un escenario con identidad.",
  Dancers: "Cada viewer tiene su lugar.",
  Events: "Todo empieza con un evento.",
  Simulator: "Probá cada interacción.",
  Camera: "La acción, siempre en cuadro.",
  Audio: "Dale ritmo a la experiencia.",
  Performance: "Medir antes de escalar.",
  Settings: "Tu estudio, a tu manera.",
};
let storage: Storage;
try {
  storage = localStorage;
} catch {
  storage = {
    getItem: () => null,
    setItem: () => {
      throw Error("Storage blocked");
    },
  } as unknown as Storage;
}
const characterStore = new CharacterStore(storage);
let characterSettings = characterStore.load();
const visualStore = new PresentationStore(storage),
  visualConfig = visualStore.load();
const store = new ConfigStore(storage),
  config = store.load(),
  world = new World(config),
  audio = new AudioManager(config);
config.maxDancers = Math.min(30, config.maxDancers);
const admission = new AdmissionGate(world.bus);
let liveConnector: ReturnType<typeof mountLiveConnector> | undefined;
let scene: SceneManager,
  section = "Dashboard",
  demo = false,
  spam = false,
  stress = false,
  serial = 0,
  lastDemo = 0,
  lastSpam = 0,
  lastStress = 0,
  stressRound = 0,
  spamEnd = 0,
  frame = 0,
  lastTime = performance.now(),
  uiAt = 0,
  sampleAt = 0,
  fps = 0,
  frameMs = 0,
  cpuMs = 0;
const samples: number[] = [];
const measurements: Record<string, unknown>[] = [];
let toastTimer = 0;
let renderRecoveryUsed = false;
function switchRow(key: keyof Config, title: string, sub = "") {
  return `<label class="switch-row"><span>${title}${sub ? `<small>${sub}</small>` : ""}</span><input class="switch" type="checkbox" data-config="${key}" aria-label="${title}" ${config[key] ? "checked" : ""}></label>`;
}
function range(
  key: keyof Config,
  label: string,
  min: number,
  max: number,
  step: number,
) {
  return `<div class="field"><label for="cfg-${key}">${label} <span data-value="${key}">${config[key]}</span></label><input id="cfg-${key}" type="range" data-config="${key}" min="${min}" max="${max}" step="${step}" value="${config[key]}"></div>`;
}
function select(key: keyof Config, label: string, options: string[]) {
  return `<div class="field"><label for="cfg-${key}">${label}</label><select id="cfg-${key}" data-config="${key}">${options.map((o) => `<option ${config[key] === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
}
const sectionLabels:Record<string,string>={Dashboard:"Inicio",Scene:"Escenario",Dancers:"Participantes",Events:"Eventos",Simulator:"Simulador",Camera:"Cámara",Audio:"Audio",Performance:"Rendimiento",Settings:"Ajustes"};
function mountStudioLayout() {
  const workspace=document.querySelector<HTMLElement>(".workspace")!;
  const inspector=document.querySelector<HTMLElement>("#inspector")!;
  const controls=document.createElement("div");
  controls.className="studio-controls";
  controls.setAttribute("aria-label","Controles del estudio");
  controls.tabIndex=0;
  const nodes=[".live-connector",".metrics","#inspector",".live-feed",".bottom-note"].map(selector=>{
    const node=document.querySelector<HTMLElement>(selector)!;
    const anchor=document.createComment("studio-layout");
    node.before(anchor);
    return {node,anchor};
  });
  const desktop=matchMedia("(min-width:851px)");
  const arrange=()=>{
    if(desktop.matches){
      workspace.append(controls);
      for(const {node} of nodes)controls.append(node);
    }else{
      for(const {node,anchor} of nodes)anchor.after(node);
      controls.remove();
    }
  };
  desktop.addEventListener("change",arrange);
  arrange();
  // The preview and the scrollable controls share the remaining viewport height.
  const fit=()=>{
    workspace.style.setProperty("--studio-height",Math.max(0,innerHeight-workspace.getBoundingClientRect().top-16)+"px");
  };
  new ResizeObserver(fit).observe(document.querySelector(".topbar")!);
  window.addEventListener("resize",fit);
  new MutationObserver(fit).observe(document.body,{attributes:true,attributeFilter:["class"]});
  // Section replacement resets only the control pane, never the preview/document.
  new MutationObserver(()=>{
    if(desktop.matches && controls.contains(inspector))
      controls.scrollTop=inspector.offsetTop-controls.offsetTop;
  }).observe(inspector,{childList:true});
  fit();
}
function renderShell() {
  $("#app").innerHTML =
    `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-symbol">↗</span><span class="brand-text">Live<em>Dance</em></span></div><div class="release-version">STUDIO / v0.6.14.1 ROW SHOW</div><div class="nav-caption">ESTUDIO</div><nav class="nav" aria-label="Secciones">${sections.map((s, i) => `<button data-nav="${s}" class="${s === section ? "active" : ""}" title="${sectionLabels[s] || s}">${icon(icons[i])}<span class="nav-label">${sectionLabels[s] || s}</span></button>`).join("")}</nav><div class="sidebar-bottom"><span class="dot"></span> Estudio local<br>0.6.14.1<br><span style="color:#546176">TikTok: ver panel de conexión</span></div></aside><main class="main"><header class="topbar"><div><div class="eyebrow">LIVEDANCE / <span id="section-name">INICIO</span></div><h1 id="page-title">${titles.Dashboard}</h1></div><div class="actions"><span class="pill lime"><span class="dot"></span>LOCAL · TEST</span><button data-action="clean">↗ Vista limpia</button><button class="primary" data-action="demo" id="demo-button">▷ Iniciar demo AFK</button></div></header><section class="metrics" aria-label="Métricas de sesión"><div class="metric"><div class="metric-label">PARTICIPANTES <span>♧</span></div><div class="metric-value"><span data-stat="dancers">0</span> <small>/ <span data-stat="capacity">60</span></small></div><div class="metric-foot"><span data-stat="queue">0</span> en cola · slots automáticos</div></div><div class="metric"><div class="metric-label">RENDER EN VIVO <span>↗</span></div><div class="metric-value"><span data-stat="fps">—</span> <small>FPS</small></div><div class="metric-foot"><span data-stat="frameMs">—</span> ms / frame</div></div><div class="metric"><div class="metric-label">DIRECTOR DE CÁMARA <span>◉</span></div><div class="metric-value" style="font-size:20px" data-stat="camera">WIDE</div><div class="metric-foot" data-stat="afk">AFK activo · movimiento suave</div></div><div class="metric"><div class="metric-label">CALIDAD ACTUAL <span>◇</span></div><div class="metric-value" style="font-size:20px" data-stat="quality">MEDIUM</div><div class="metric-foot" data-stat="adaptive">Adaptativa activa</div></div></section><div class="workspace"><section class="preview-card"><div class="card-head"><span><span class="dot"></span> Vista del escenario <span class="sub">/ Afterglow</span></span><span class="pill">9:16 · VERTICAL</span></div><div class="preview-well"><div id="stage" class="stage"><div class="broadcast-top"><div class="broadcast-brand">LiveDance<span>AFTERGLOW SESSIONS</span></div><span class="sim-badge">SIMULACIÓN</span></div><div class="party-overlays"><div id="hype-overlay" hidden></div><div id="ranking-overlay" hidden></div><div id="goals-overlay" hidden></div></div><div id="upper-event" class="upper-event" hidden aria-live="polite"></div><div id="event-slide" class="event-slide" hidden aria-live="polite"></div><div class="broadcast-bottom"><div id="now-playing-overlay" class="now-playing-overlay" hidden></div><div id="top-overlay" class="top-overlay" hidden></div></div><div class="safe-area ${config.safeAreas ? "show" : ""}" id="safe-area"><span>ÁREA SEGURA ORIENTATIVA</span></div></div></div><div class="stage-footer"><span><b>●</b> <span data-stat="resolution">—</span> render interno</span><span data-stat="effects">0</span><span>efectos · WebGL2</span></div></section><aside class="inspector" id="inspector" aria-label="Panel de control"></aside></div><section class="live-feed"><div class="card-head"><span>Actividad reciente <span class="sub">/ eventos de esta sesión</span></span><button class="small ghost" data-nav="Events">Ver todos ↗</button></div><div class="feed-list" id="feed"></div></section><footer class="bottom-note"><span>ENTORNO DE PRUEBA · TODOS LOS EVENTOS SON FICTICIOS</span><span>Hecho para moverse. Diseñado para evolucionar.</span></footer></main></div><button class="exit-clean" data-action="clean">Volver al estudio · Esc</button><div class="toast" role="status" id="toast" hidden></div>`;
  renderPanel();
}
function simulatorForm() {
  return `<div class="grid2"><div class="field"><label for="username">Nombre del espectador</label><input id="username" value="luna.moves" maxlength="24"></div><div class="field"><label for="viewerId">Identificador del espectador</label><input id="viewerId" value="viewer-luna" maxlength="64"></div></div><div class="grid2"><div class="field"><label for="giftName">Regalo</label><input id="giftName" value="Neon Spark" maxlength="40"></div><div class="field"><label for="giftCount">Cantidad ×N</label><input id="giftCount" type="number" min="1" max="1000" value="1"></div></div><div class="field"><label for="tier">Nivel del regalo</label><select id="tier"><option value="LOW">Bajo</option><option value="NORMAL">Normal</option><option value="HIGH">Alto / VIP</option></select></div><div class="button-grid"><button data-event="VIEWER_JOIN">Ingresar</button><button data-event="COMMENT">Comentario</button><button data-event="FOLLOW">Seguir</button></div><h3>Enviá un regalo</h3><div class="gift-grid"><button data-gift="LOW"><b>✧</b>Aura · Bajo</button><button data-gift="NORMAL"><b>◉</b>Solo · Normal</button><button data-gift="HIGH"><b>♛</b>VIP · Alto</button></div><div class="row" style="margin-top:10px"><button class="small" data-action="custom-gift">Regalo ×N</button><button class="small" data-action="top">✦ Máximo apoyo</button><button class="small" data-event="LIKE_MILESTONE">Me gusta</button></div>`;
}
function bulkControls() {
  return `<h3>Poblá la pista</h3><div class="button-grid"><button data-bulk="1">+ 1 espectador</button><button data-bulk="10">+ 10 espectadores</button><button data-bulk="30">+ 30 espectadores</button></div>`;
}
const simulatorDraft: Record<string, string> = {};
function renderPanel() {
  for (const id of ["username", "viewerId", "giftName", "giftCount", "tier"]) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) simulatorDraft[id] = input.value;
  }
  let html = "";
  if (section === "Dashboard" || section === "Simulator")
    html = `<section class="panel"><div class="panel-title"><h2>Simulador</h2><span class="pill lime">SANDBOX</span></div><p class="hint">Creá espectadores e interacciones. Cada evento toma vida en la pista.</p>${simulatorForm()}${bulkControls()}${section === "Simulator" ? `<div class="divider"></div><div class="row"><button class="small" data-action="spam" id="spam-button">${spam ? "Detener spam" : "Spam controlado"}</button><button class="small" data-action="stress" id="stress-button">${stress ? "Detener stress" : "Stress progresivo"}</button></div><p class="hint">Spam: 5/s durante 30 s. Stress: +10 cada 15 s hasta 60 intentos; respeta la capacidad.</p>` : ""}</section><section class="panel"><div class="panel-title"><h2>Piloto automático</h2><span class="pill">AFK</span></div>${switchRow("afk", "Modo AFK", "Cámara, animación y retiro por inactividad")}${switchRow("cameraAuto", "Director automático", "Prioriza regalos y vuelve al plano general")}<div class="status-box"><span class="dot"></span><span id="automation-status">${demo ? "Demo generando actividad ficticia." : "Listo para recibir eventos del Simulador."}</span></div></section>`;
  if (section === "Scene")
    html = `<section class="panel"><h2>Afterglow</h2><p class="hint">Club circular original. Portal abierto, luz suave y un centro reservado para dos VIP.</p><div class="status-box">Escenario procedural · sin assets descargados</div>${switchRow("names", "Mostrar usernames")}${switchRow("safeAreas", "Ver áreas seguras", "Guía orientativa, depende de la interfaz de captura")}<div class="field"><label for="accent">Acento de interfaz</label><input id="accent" type="color" data-config="accent" value="${config.accent}"></div><h3>Preview vertical</h3><p class="hint">Composición lógica 1080 × 1920. El render interno sigue el tamaño de ventana y el preset. En vista limpia, usá una ventana 1080 × 1920 para captura a esa medida.</p><button class="full" data-action="clean">Abrir vista limpia</button></section><section class="panel"><h2>Entrada y posiciones</h2><p class="hint">Con filas activas: 20 plazas horizontales de izquierda a derecha. Al completar una fila comienza otra. Ajustá el encuadre y el límite visual en Filas de 20.</p></section>`;
  if (section === "Dancers")
    html = `<section class="panel"><h2>Dancers en escena</h2><p class="hint">${scene?.integration.active ? "Skins Minecraft asociadas a cada espectador. Bailes Hip Hop y Excited; hasta 30 participantes registrados, aunque el aforo visible sea menor." : "Apariencia y baile derivados del viewerId. Animaciones y reacciones del motor original."}</p>${bulkControls()}<div class="roster" id="roster"></div></section><section class="panel"><h2>Avatares intercambiables</h2><p class="hint">${scene?.integration.active ? "Buscá una skin en la biblioteca y seleccionála para verla de cuerpo completo. Admite classic, slim y segunda capa; la vista previa no crea un espectador." : "Humanoides originales con articulaciones y mezcla de poses."}</p></section>`;
  if (section === "Events")
    html = `<section class="panel"><div class="panel-title"><h2>Event stream</h2><button class="small" data-action="export-events">Exportar</button></div><p class="hint">Últimos 100 eventos entregados. Ingress: 128 en espera, hasta 8 por frame. Rechazos y replays se muestran en Performance; los regalos aceptados no caducan.</p><div class="event-list" id="events-list"></div></section><section class="panel"><h2>Registro de errores</h2><div class="event-list" id="errors-list"></div><button class="small full" data-action="export-errors">Exportar diagnóstico</button></section>`;
  if (section === "Camera")
    html = `<section class="panel"><h2>Dirección de cámara</h2><p class="hint">Planos suaves con prioridad VIP → Featured → automático. Cada acercamiento tiene retorno a WIDE.</p>${switchRow("cameraAuto", "Director automático")}${switchRow("afk", "Modo AFK")}${range("cameraFrequency", "Intervalo entre planos (s)", 5, 90, 1)}${range("cameraDuration", "Duración del plano (s)", 2, 20, 1)}${range("cameraIntensity", "Intensidad de movimiento", 0, 1, 0.05)}<button class="full" data-action="wide">Volver a WIDE</button><div class="status-box">Plano: <b data-stat="camera">WIDE</b></div></section><section class="panel"><h2>Composición</h2><p class="hint">WIDE · MEDIUM · ORBIT · GROUP · ENTRANCE · FEATURED · VIP · TOP · FEVER. El radio de la pista ajusta la distancia general. No hay cortes instantáneos.</p></section>`;
  if (section === "Audio")
    html = `<section class="panel"><h2>Volumen y sonido</h2><button class="primary full" data-action="audio">Activar audio</button>${switchRow("mute", "Silenciar audio")}${range("master", "Volumen general", 0, 1, 0.05)}${range("music", "Música", 0, 1, 0.05)}${range("effects", "Efectos", 0, 1, 0.05)}<div class="row"><button class="small" data-action="test-audio">Probar sonido</button><button class="small" data-action="stop-music">Detener música</button></div><p class="hint" id="audio-status">${escape(audio.status)}</p></section>` + playlistPanel(audio) + eventSoundsPanel(audio) + `<details class="panel audio-library"><summary>Biblioteca y listas guardadas</summary>${libraryPanel(audio)}</details>`;
  if (section === "Performance")
    html = `<section class="panel"><div class="panel-title"><h2>Monitor de rendimiento</h2><span class="pill lime">EN VIVO</span></div><div class="sparkline" id="sparkline"></div><table class="stat-table"><tbody>${[
      ["fps", "FPS (ventana reciente)"],
      ["frameMs", "Frame time medio"],
      ["p95", "Frame time p95"],
      ["drawCalls", "Draw calls"],
      ["triangles", "Triángulos"],
      ["dancers", "Dancers activos"],
      ["effects", "Efectos activos"],
      ["queue", "Eventos pendientes"],
      ["ingressQueued", "Ingress en espera / 128"],
      ["ingressDelivered", "Ingress entregados"],
      ["ingressRejected", "Ingress rechazados por presión"],
      ["ingressDuplicate", "Replays / duplicados"],
      ["ingressExpired", "Actividad caducada"],
      ["ingressCleared", "Eventos limpiados al detener"],
      ["ingressHighWater", "Pico de cola"],
      ["ingressConnection", "Estado de fixture"],
      ["dropped", "Descartados por capacidad/cola"],
      ["geometries", "Geometrías"],
      ["textures", "Texturas"],
      ["resolution", "Resolución interna"],
    ]
      .map(([k, l]) => `<tr><td>${l}</td><td data-stat="${k}">—</td></tr>`)
      .join(
        "",
      )}</tbody></table><p class="hint" id="gpu-info"></p><button class="full" data-action="export-metrics">Exportar métricas JSON</button></section><section class="panel"><h2>Quality control</h2>${select("quality", "Preset máximo", ["LOW", "MEDIUM", "HIGH"])}${switchRow("adaptive", "Calidad adaptativa", "Reduce tras 6 s por debajo de 35 FPS")}<p class="hint" data-stat="qualityReason"></p><p class="hint">Recupera tras 30 s estables sobre 55 FPS. LOW: resolución 65%, sin sombras. MEDIUM: 100%. HIGH: 150%, sombras. Sin postprocesado obligatorio.</p></section>`;
  if (section === "Settings")
    html = `<section class="panel"><h2>Configuración local</h2><p class="hint">Se guardan ajustes en este perfil. Los viewers y eventos no persisten.</p><div class="field"><label for="cfg-maxDancers">Capacidad del render anterior (filas conservan identidades)</label><input id="cfg-maxDancers" data-config="maxDancers" type="number" min="1" max="30" value="${config.maxDancers}"></div><div class="field"><label for="cfg-inactivity">Inactividad antes de salida (segundos)</label><input id="cfg-inactivity" data-config="inactivity" type="number" min="10" max="3600" value="${config.inactivity}"></div>${select("replacement", "Capacidad llena", ["oldest", "reject"])}<p class="hint">Estos ajustes se aplican al render anterior. Con filas activas, las identidades permanecen; el límite de GPU se configura en Filas de 20.</p>${select("quality", "Preset máximo", ["LOW", "MEDIUM", "HIGH"])}${switchRow("adaptive", "Calidad adaptativa")}${switchRow("afk", "Modo AFK")}<div class="status-box" id="save-status">Ajustes guardados automáticamente</div><div class="divider"></div><button class="full" data-action="reset-scene">Reiniciar escena de prueba</button><button class="full ghost" style="margin-top:8px" data-action="defaults">Restaurar ajustes iniciales</button></section><section class="panel"><h2>Integraciones</h2><p class="hint">TikTok: consultar estado en el panel superior.<br>LiveForge: contrato preliminar, sin bridge activo.<br>Servidor: sólo localhost.<br>OBS / Live Studio: pendiente de validación manual.</p></section>`;
  if (section === "Scene") html += presentationPanel(visualConfig, "scene");
  if (section === "Camera") html += presentationPanel(visualConfig, "camera");
  html += retentionPanel(section);
  if (section === "Dancers" || section === "Settings") html += characterPanel();
  html += integrationPanel(section, scene?.integration);

  $("#inspector").innerHTML = html;
  $("#inspector").scrollTop = 0;
  if (scene) drawSkins(scene.integration);
  for (const [id, value] of Object.entries(simulatorDraft)) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = value;
  }
  updateUI();
}
function toast(s: string) {
  $("#toast").textContent = s;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ($("#toast").hidden = true), 4000);
}
function makeEvent(
  type: EventType,
  overrides: Partial<LiveEvent> = {},
): LiveEvent {
  serial++;
  if (overrides.viewerId?.startsWith("demo-") && (!overrides.source || overrides.source === "simulator")) scene?.integration.client.markDemo(overrides.viewerId);
  return {
    schemaVersion: 1,
    eventId: `sim-${Date.now()}-${serial}`,
    source: "simulator",
    viewerId: "viewer-luna",
    username: "luna.moves",
    eventType: type,
    giftCount: 1,
    timestamp: Date.now(),
    metadata: {},
    ...overrides,
  };
}
function formEvent(type: EventType, tier?: Tier, top = false) {
  const value = (id: string, fallback: string) =>
    document.getElementById(id)
      ? $<HTMLInputElement>("#" + id).value
      : fallback;
  const event = makeEvent(type, {
    viewerId: value("viewerId", "viewer-luna"),
    username: value("username", "luna.moves"),
    giftName: value("giftName", "Neon Spark"),
    giftCount: Number(value("giftCount", "1")),
    metadata: { tier: tier ?? (value("tier", "LOW") as Tier), top },
  });
  if (world.bus.emit(event))
    toast(`${type}${tier ? " · " + tier : ""} enviado a ${event.username}`);
  else
    toast(
      `Evento rechazado: ${admission.paused ? "pausa" : admission.ingress.lastResult.reason}`,
    );
}
const names = [
  "mila.wave",
  "nico.groove",
  "luna.moves",
  "kai.disco",
  "sol.shuffle",
  "leo.vibes",
  "emi.flow",
  "noa.rhythm",
  "zoe.dance",
  "max.afterglow",
  "cami.sun",
  "alex.neon",
  "vale.beat",
  "teo.steps",
  "ruby.sky",
  "ian.funk",
];
function bulk(n: number) {
  let accepted = 0;
  for (let i = 0; i < n; i++) {
    const next = serial + 1;
    if (
      world.bus.emit(
        makeEvent("VIEWER_JOIN", {
          viewerId: `viewer-${next}`,
          username:
            names[(next - 1) % names.length] + (next > 16 ? `.${next}` : ""),
        }),
      )
    )
      accepted++;
  }
  toast(
    `${accepted}/${n} viewers simulados admitidos${accepted < n ? ` · ${n - accepted} rechazados` : ""}`,
  );
}
function save() {
  Object.assign(config, validateConfig(config));
  config.maxDancers = Math.min(30, config.maxDancers);
  document.documentElement.style.setProperty("--accent", config.accent);
  $("#safe-area").classList.toggle("show", config.safeAreas);
  audio.apply();
  store.save(config);
  if (store.warning) toast(store.warning);
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function resetScene() {
  demoPlan = [];
  scene.integration.reset();
  admission.ingress.clear();
  scene.presentation.cancel();
  scene.entertainment.reset();
  scene.cinema.reset();
  world.spawn.dancers.clear();
  world.spawn.queue = [];
  world.spawn.slots = new SlotAllocator();
  world.effects.active.clear();
  world.camera.wide(world.now, config);
  demo = spam = stress = false;
  $("#demo-button").textContent = "▷ Iniciar demo AFK";
  toast("Escena reiniciada; ajustes conservados");
}
document.addEventListener("click", async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button");
  if (!b) return;
  try {
    if (b.dataset.party || b.dataset.goal || b.dataset.multiplier) {
      const party = scene.entertainment,
        action = b.dataset.party;
      const id = $<HTMLInputElement>("#viewerId")?.value || "viewer-luna";
      const name = $<HTMLInputElement>("#username")?.value || "luna.moves";
      if (action === "hype10" || action === "hype50")
        party.hype.add(action === "hype10" ? 10 : 50, world.now);
      if (action === "fever") {
        if (scene.integration.config.enabled) {
          world.bus.emit(
            makeEvent("SIMULATED", {
              viewerId: id,
              username: name,
              giftId: "fever-demo",
            }),
          );
          return;
        }
        party.hype.add(100, world.now);
        if (party.hype.getState(world.now) !== "FEVER")
          toast("Fever en cooldown");
      }
      if (action === "entrance") formEvent("VIEWER_JOIN");
      if (action === "reaction")
        scene.presentation.react(id, "SHOCK", world.now, 3);
      if (action === "support" || action === "promote") {
        if (!world.spawn.dancers.has(id)) formEvent("VIEWER_JOIN");
        party.supporters.add(
          id,
          world.spawn.dancers.get(id)?.username ?? name,
          action === "support"
            ? 25
            : (party.supporters.top[0]?.score ?? 0) + 50,
        );
      }
      if (b.dataset.goal) {
        const kind = b.dataset.goal as "like" | "follow" | "gift";
        party.goal(kind, party.config[`${kind}Goal`]);
      }
      if (b.dataset.multiplier) {
        const input = $<HTMLInputElement>("#giftCount");
        if (input) input.value = b.dataset.multiplier;
        formEvent("GIFT");
      }
    }
    if (b.dataset.nav) {
      section = b.dataset.nav;
      $("#section-name").textContent = (sectionLabels[section] || section).toUpperCase();
      $("#page-title").textContent = titles[section];
      document
        .querySelectorAll("[data-nav]")
        .forEach((n) =>
          n.classList.toggle(
            "active",
            (n as HTMLElement).dataset.nav === section,
          ),
        );
      renderPanel();
      return;
    }
    if (b.dataset.bulk) {
      bulk(Number(b.dataset.bulk));
      return;
    }
    if (b.dataset.event) {
      formEvent(b.dataset.event as EventType);
      return;
    }
    if (b.dataset.gift) {
      formEvent("GIFT", b.dataset.gift as Tier);
      return;
    }
    const action = b.dataset.action;
    if (action === "retry") {
      location.reload();
      return;
    }
    if (action === "clean") {
      document.body.classList.toggle("clean");
      scene.resize();
    }
    if (action === "demo") {
      demo = !demo;
      if (demo) {
        await scene.integration.preview();
        scene.integration.client.beginDemo();
        config.afk = true;
        save();
        lastDemo = world.now - 2;
      }
      $("#demo-button").textContent = demo
        ? "Ⅱ Detener demo AFK"
        : "▷ Iniciar demo AFK";
      renderPanel();
      toast(
        demo
          ? "Demo AFK activa · eventos ficticios"
          : "Demo detenida; la escena continúa",
      );
    }
    if (action === "custom-gift") formEvent("GIFT");
    if (action === "top") formEvent("SIMULATED", undefined, true);
    if (action === "spam") {
      spam = !spam;
      spamEnd = world.now + 30;
      renderPanel();
      toast(
        spam ? "Spam controlado activo: 5 eventos/s, 30 s" : "Spam detenido",
      );
    }
    if (action === "stress") {
      stress = !stress;
      stressRound = 0;
      lastStress = world.now - 15;
      renderPanel();
      toast(stress ? "Stress progresivo activo" : "Stress detenido");
    }
    if (action === "wide") {
      world.camera.wide(world.now, config);
      scene.presentation.shotUntil = 0;
    }
    if (action === "audio") {
      config.mute = false;
      await audio.unlock();
      save();
      renderPanel();
    }
    if (action === "test-audio") {
      await audio.unlock();
      audio.sound("vip");
      toast(
        config.mute
          ? "Desactivá Silenciar audio para escuchar"
          : "Sonido de prueba",
      );
    }
    if (action === "stop-music") {
      audio.stop();
      renderPanel();
    }
    if (action === "export-metrics")
      download("LiveDance-metrics.json", {
        version: "0.6.14.1",
        date: new Date().toISOString(),
        environment: scene.gpu,
        config,
        samples: measurements,
      });
    if (action === "export-events")
      download("LiveDance-events.json", world.bus.history);
    if (action === "export-errors")
      download("LiveDance-diagnostic.json", {
        errors: world.bus.errors,
        entertainment: scene.entertainment.inspect(),
        showDirector: scene.integration.director.inspect(),
        audio: audio.inspect(),
        metrics: snapshot(),
        config,
      });
    if (action === "reset-scene") resetScene();
    if (action === "defaults") {
      Object.assign(config, defaults);
      world.quality.current = config.quality;
      save();
      renderPanel();
      toast("Ajustes iniciales restaurados");
    }
    if (b.dataset.feature) {
      const d = world.spawn.dancers.get(b.dataset.feature);
      if (d)
        world.bus.emit(
          makeEvent("GIFT", {
            viewerId: d.id,
            username: d.username,
            giftName: "Spotlight",
            metadata: { tier: "NORMAL" },
          }),
        );
    }
  } catch (err) {
    world.bus.error(err);
    toast(String(err));
  }
});
document.addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  try {
    if (input.dataset.config) {
      const key = input.dataset.config as keyof Config;
      const value =
        input.type === "checkbox"
          ? input.checked
          : ["range", "number"].includes(input.type)
            ? Number(input.value)
            : input.value;
      Object.assign(config, { [key]: value });
      save();
      if (key === "quality") world.quality.current = config.quality;
      const label = document.querySelector(`[data-value="${key}"]`);
      if (label) label.textContent = String(config[key]);
      if (input.type === "number") input.value = String(config[key]);
    }
    if (input.id === "music-file" && input.files?.[0]) {
      if (input.files.length === 1) await audio.load(input.files[0]);
      else await audio.add([...input.files]);
      $("#audio-status").textContent = audio.status;
    }
  } catch (err) {
    world.bus.error(err);
    toast(String(err));
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.body.classList.remove("clean");
    scene?.resize();
  }
});
window.addEventListener("error", (e) => world.bus.error(e.message));
window.addEventListener("unhandledrejection", (e) => world.bus.error(e.reason));
function stat(key: string, value: unknown) {
  document
    .querySelectorAll(`[data-stat="${key}"]`)
    .forEach((n) => (n.textContent = String(value)));
}
function snapshot() {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    capture: captureDiagnostics.inspect(),
    time: world.now,
    fps: Math.round(fps),
    frameMs: Number(frameMs.toFixed(2)),
    cpuMs,
    p95: Number((sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2)),
    dancers: world.spawn.dancers.size,
    capacity: scene?.integration.active ? "∞" : config.maxDancers,
    queue: world.spawn.queue.length,
    effects: world.effects.active.size,
    camera: scene?.integration.active
      ? scene.integration.paused
        ? "PAUSA"
        : scene.integration.director.shot
      : world.camera.mode,
    quality: world.quality.current,
    dropped: world.spawn.dropped,
    spawned: world.spawn.spawned,
    exited: world.spawn.exited,
    events: world.bus.received,
    ingressQueued: admission.ingress.inspect().queued,
    ingressDelivered: admission.ingress.metrics.delivered,
    ingressRejected:
      admission.ingress.metrics.rejectedFull +
      admission.ingress.metrics.rateLimited +
      admission.ingress.metrics.disconnected,
    ingressDuplicate: admission.ingress.metrics.duplicate,
    ingressExpired: admission.ingress.metrics.expired,
    ingressCleared: admission.ingress.metrics.cleared,
    ingressHighWater: admission.ingress.metrics.highWater,
    ingressConnection: admission.ingress.connection,
    demo,
    spam,
    stress,
    ...scene?.metrics(),
    characters: scene?.characters.inspect(scene.avatars.values()),
    admission: admission.inspect(),
    ingress: admission.ingress.inspect(),
  };
}
function updateUI() {
  if (scene) {
    updateParty(scene.entertainment, world.now);
    refreshLibrary(audio);
    const suggestion = document.querySelector("#energy-suggestion");
    if (suggestion && audio.state.energySuggestions) {
      const tag =
        scene.entertainment.hype.value >= 50
          ? "HYPE"
          : scene.entertainment.hype.value >= 25
            ? "GROOVE"
            : "CHILL";
      suggestion.textContent =
        "Sugerencia " +
        tag +
        ": " +
        (audio.state.playlists
          .filter((p) => p.tag === tag)
          .map((p) => p.name)
          .join(", ") || "asigná este tag a una playlist") +
        ". Se aplica sólo al seleccionarla.";
    }
  }
  updateMusicUI(audio);
  const brand = document.querySelector<HTMLElement>(".broadcast-brand");
  if (brand) {
    brand.hidden = !visualConfig.branding;
    brand.innerHTML =
      escape(visualConfig.title) +
      `<span>${escape(visualConfig.subtitle)}</span>`;
  }
  const now = document.querySelector<HTMLElement>("#now-playing-overlay");
  if (now) {
    now.hidden = !audio.state.nowPlaying || !audio.playing;
    now.textContent = "♫ " + (audio.current?.name ?? "");
  }
  const top = document.querySelector<HTMLElement>("#top-overlay");
  if (top) {
    const moment = scene?.presentation.top
      ? "TOP"
      : scene?.presentation.vipId
        ? "VIP"
        : scene?.presentation.lights.state === "FEATURED"
          ? "FEATURED"
          : "";
    top.hidden =
      !moment ||
      (moment === "TOP"
        ? !visualConfig.topContributor
        : !scene?.entertainment.config.vipOverlay);
    top.textContent =
      "✦ " + moment + " · " + (scene?.presentation.ledTitle ?? "");
  }

  if (scene) updateCinema(scene.cinema, world.now);
  const s = snapshot();
  for (const [k, v] of Object.entries(s)) stat(k, v);
  stat("resolution", scene ? `${s.width} × ${s.height}` : "—");
  stat("afk", config.afk ? "AFK activo · movimiento suave" : "AFK desactivado");
  stat("adaptive", config.adaptive ? "Adaptativa activa" : "Preset manual");
  stat("qualityReason", world.quality.reason);
  const feed = document.getElementById("feed");
  if (feed)
    feed.innerHTML =
      world.bus.history
        .slice(0, 3)
        .map(
          (e) =>
            `<div class="feed-item"><span>${new Date(e.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span><i>${e.eventType === "GIFT" ? "✧" : e.eventType === "FOLLOW" ? "♡" : "↗"}</i> ${escape(e.username)} · ${e.eventType === "GIFT" ? escape(e.giftName) + " ×" + e.giftCount : escape(e.eventType)}</div>`,
        )
        .join("") ||
      '<span class="hint">La pista está lista. Creá tu primer viewer.</span>';
  if (section === "Dancers")
    $("#roster").innerHTML =
      [...world.spawn.dancers.values()]
        .map(
          (d) =>
            `<div class="roster-item"><span class="avatar-dot">${escape(d.username[0]?.toUpperCase())}</span><span>${escape(d.username)}<small>${d.state} · ${visualDance(d)} · Lv${scene.entertainment.supporters.level(d.id, scene.entertainment.config)} · Score ${scene.entertainment.supporters.viewers.get(d.id)?.score ?? 0}${d.vipUntil > world.now ? " · VIP" : ""}</small></span><button class="small" data-feature="${escape(d.id)}">Solo</button></div>`,
        )
        .join("") || '<p class="hint">Todavía no hay dancers.</p>';
  if (section === "Events") {
    $("#events-list").innerHTML =
      world.bus.history
        .map(
          (e) =>
            `<div class="event-card"><b>${escape(e.eventType)} ${e.metadata.tier ?? ""}</b> · ${escape(e.username)}<br><small>${escape(e.eventId)}${e.giftName ? " · " + escape(e.giftName) + " ×" + e.giftCount : ""}</small></div>`,
        )
        .join("") || '<p class="hint">Sin eventos.</p>';
    $("#errors-list").innerHTML =
      world.bus.errors
        .map((e) => `<div class="event-card warning">${escape(e)}</div>`)
        .join("") || '<p class="hint">Sin errores registrados.</p>';
  }
  if (section === "Performance") {
    $("#gpu-info").textContent = scene?.gpu ?? "";
    $("#sparkline").innerHTML = measurements
      .slice(-35)
      .map(
        (m) =>
          `<i style="height:${Math.min(100, (Number(m.fps) / 60) * 100)}%"></i>`,
      )
      .join("");
  }
  if (document.getElementById("automation-status"))
    $("#automation-status").textContent = demo
      ? "Demo generando actividad ficticia."
      : "Listo para recibir eventos del Simulador.";
}
function automation() {
  if (demo && world.now - lastDemo >= 2.5) {
    lastDemo = world.now;
    const ds = [...world.spawn.dancers.values()].filter(
      (d) => d.state !== "EXITING",
    );
    if (ds.length < 12 || Math.random() < 0.2) {
      const id = serial + 1;
      world.bus.emit(
        makeEvent("VIEWER_JOIN", {
          viewerId: `demo-${id}`,
          username: names[id % names.length],
        }),
      );
    } else {
      const d = ds[Math.floor(Math.random() * ds.length)];
      world.bus.emit(
        makeEvent(Math.random() < 0.25 ? "FOLLOW" : "GIFT", {
          viewerId: d.id,
          username: d.username,
          giftName: "Demo Spark",
          metadata: {
            tier:
              Math.random() < 0.14
                ? "HIGH"
                : Math.random() < 0.4
                  ? "NORMAL"
                  : "LOW",
          },
        }),
      );
    }
  }
  if (spam) {
    if (world.now >= spamEnd) {
      spam = false;
      if (section === "Simulator") renderPanel();
    } else if (world.now - lastSpam >= 0.2) {
      lastSpam = world.now;
      const d = [...world.spawn.dancers.values()][
        serial % Math.max(1, world.spawn.dancers.size)
      ];
      world.bus.emit(
        makeEvent("FOLLOW", {
          viewerId: d?.id ?? "spam-viewer",
          username: d?.username ?? "spam.viewer",
        }),
      );
    }
  }
  if (stress && world.now - lastStress >= 15) {
    lastStress = world.now;
    bulk(10);
    stressRound++;
    if (stressRound >= 6) {
      stress = false;
      if (section === "Simulator") renderPanel();
      toast("Stress finalizado: 60 intentos. Revisá las métricas.");
    }
  }
}
var controlledReview = false;
function loop(now: number) {
  if (controlledReview) { lastTime=now; requestAnimationFrame(loop); return; }
  const cpuStart = performance.now();
  if (scene.disposed) return;
  const elapsed = Math.max(0, (now - lastTime) / 1000);
  lastTime = now;
  const dt = Math.min(0.1, elapsed);
  if (elapsed < 1 && elapsed > 0) {
    samples.push(elapsed * 1000);
    if (samples.length > 120) samples.shift();
  }
  if (!admission.paused) automation();
  if (!admission.paused) runIntegrationDemo();
  if (!admission.paused) admission.ingress.drain(Date.now());
  if (!admission.paused) world.update(dt, elapsed);
  scene.presentation.nowPlaying =
    audio.state.nowPlaying && audio.playing ? (audio.current?.name ?? "") : "";
  scene.presentation.bpm =
    audio.playing && audio.state.beat ? audio.current?.bpm : undefined;
  try {
    scene.update(admission.paused ? 0 : dt);
  } catch (error) {
    world.bus.error(
      `Frame renderer: ${String(error)}; se activa parada y retorno a PROCEDURAL`,
    );
    panic("Error de render: sesión detenida; revisá diagnóstico");
    scene.integration.configure({ enabled: false });
    if (renderRecoveryUsed) {
      scene.disposed = true;
      emergencyStatus("Error de render repetido. Recargá la escena.");
      return;
    }
    renderRecoveryUsed = true;
    characterSettings = characterConfig({
      ...characterSettings,
      backend: "PROCEDURAL",
    });
    scene.configureCharacters(characterSettings);
    try {
      scene.update(0);
    } catch (second) {
      world.bus.error(
        `Frame renderer: recuperación fallida; requiere recarga. ${String(second)}`,
      );
      scene.disposed = true;
      emergencyStatus("No se pudo recuperar WebGL. Recargá la escena.");
      return;
    }
  }
  captureDiagnostics.frame(now);
  frame++;
  if (now - uiAt > 500) {
    uiAt = now;
    frameMs = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
    // Ignore the first few frames: RAF can begin with a near-zero delta.
    fps = samples.length >= 10 ? 1000 / Math.max(0.1, frameMs) : 0;
    updateUI();
  }
  if (now - sampleAt > 1000) {
    const seconds = Math.min(2, (now - sampleAt) / 1000);
    sampleAt = now;
    const q = world.quality.update(
      fps,
      seconds,
      config.adaptive,
      config.quality,
    );
    if (scene.quality !== q) scene.setQuality(q);
    measurements.push(snapshot());
    if (measurements.length > 3600) measurements.shift();
  }
  cpuMs = performance.now() - cpuStart;
  requestAnimationFrame(loop);
}
try {
  renderShell();
  scene = new SceneManager($("#stage"), world, characterSettings);
  scene.integration.sourceLabel = () => admission.source === "tiktok" ? "TIKTOK" : "SIMULATOR";
  mountIntegration(scene.integration, toast, startIntegrationDemo, async () => {
    const blob = await recordShow(scene.renderer.domElement, scene.integration),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "LiveDance-v051-sin-audio.webm";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  mountEmergency();
  liveConnector = mountLiveConnector(admission, () => {
    scene.integration.freeDance.cancel();
    scene.integration.ledState.reset();
    demo = spam = stress = false; demoPlan = []; world.spawn.queue = [];
    $("#demo-button").textContent = "▷ Iniciar demo AFK";
  });
  renderPanel();
  scene.presentation.config = visualConfig;
  loadParty(scene.entertainment);
  mountStudioLayout();
  mountStudio(audio, visualConfig, visualStore, toast);
  mountRetention(scene.entertainment, audio, toast);
  mountCinema(scene.cinema, world);
  scene.cinema.cue = (k) => audio.sound(k);
  void audio.init().catch((e) => toast(`Biblioteca: ${e.message}`));
  // Presentation owns event cues: duplicate core callbacks would consume the
  // audio throttle before the active HIGH/VIP cue can play.
  world.onSound = undefined;
  world.spawn.onSpawn = undefined;
  save();
  scene.renderer.domElement.addEventListener("webglcontextlost", (e) => {
    void liveConnector?.stop();
    e.preventDefault();
    admission.pause("WebGL context perdido");
    audio.stop();
    config.mute = true;
    audio.apply();
    emergencyStatus("WebGL perdido. Recargá la escena para recuperar.");
    world.bus.error(
      "WebGL context perdido; audio detenido, admisión cerrada; recuperación mediante recarga",
    );
    toast("Contexto WebGL perdido. Recargá la aplicación.");
    scene.disposed = true;
  });
  Object.defineProperty(window, "__LiveDance", {
    value: {
      snapshot,
      capture: () => captureDiagnostics.inspect(),
      inspect: () => ({
        live: liveConnector?.inspect(),
        spawn: { spawned: world.spawn.spawned, dropped: world.spawn.dropped, queued: world.spawn.queue.length, capacity: world.config.maxDancers, replacement: world.config.replacement, afk: world.config.afk, inactivity: world.config.inactivity },
        characters: scene.characters.inspect(scene.avatars.values()),
        admission: admission.inspect(),
        dancers: [...world.spawn.dancers.values()].map((d) => ({
          ...d,
          visualDance: visualDance(d),
        })),
        entertainment: scene.entertainment.inspect(),
        audio: audio.inspect(),
        presentation: scene.presentation.inspect(),
        cinema: { ...scene.cinema.inspect(), framing: scene.subjectFrame() },
        effects: [...world.effects.active.values()],
        errors: [...world.bus.errors],
        config: { ...config },
        events: world.bus.history.slice(0, 100),
        metrics: measurements.slice(),
      }),
    },
    writable: false,
  });
  if (new URLSearchParams(location.search).has("clean"))
    document.body.classList.add("clean");
  if (!new URLSearchParams(location.search).has("empty")) bulk(8);
  if (store.warning || characterStore.warning)
    toast(store.warning || characterStore.warning);
  lastTime = performance.now();
  requestAnimationFrame(loop);
} catch (err) {
  world.bus.error(err);
  $("#app").innerHTML =
    `<div class="error-screen"><h1>No se pudo iniciar la escena 3D</h1><p>LiveDance requiere WebGL2 y aceleración gráfica. Revisá el navegador y los controladores.</p><p>${escape(err)}</p><button data-action="retry">Reintentar</button></div>`;
}
window.addEventListener("beforeunload", () => {
  audio.dispose();
  scene?.dispose();
});

function characterPanel() {
  const field = (
    key: keyof CharacterConfig,
    label: string,
    values: readonly string[],
  ) =>
    `<div class="field"><label for="character-${key}">${label}</label><select id="character-${key}" data-character="${key}">${values.map((v) => `<option ${characterSettings[key] === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>`;
  return `<section class="panel"><h2>Renderer anterior · Phase2</h2><p class="hint">BLOCK optativo. Cambiar el aspecto conserva IDs y slots. Cinco bailes nativos; los demás usan equivalencias documentadas.</p>${field("backend", "Motor de personajes", ["PROCEDURAL", "BLOCK"])}${field("palette", "Paleta BLOCK", ["AUTO", ...Object.keys(palettes)])}${field("accessory", "Accesorio BLOCK", ["AUTO", ...accessories])}${field("dance", "Baile BLOCK", danceChoices)}<p class="hint">AUTO conserva identidad determinística. Reacciones y caminar tienen prioridad sobre el baile elegido.</p></section>`;
}
function setCharacters(value: unknown) {
  characterSettings = characterConfig(value);
  scene.configureCharacters(characterSettings);
  characterStore.save(characterSettings);
  if (characterStore.warning) toast(characterStore.warning);
}
document.addEventListener("change", (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.dataset.character)
    setCharacters({ ...characterSettings, [el.dataset.character]: el.value });
});
function emergencyStatus(reason: string) {
  document.body.classList.add("emergency");
  const status = document.getElementById("emergency-status");
  if (status) status.textContent = reason;
}
function panic(reason = "Parada de emergencia: cola vaciada, audio detenido") {
  admission.pause(reason);
  void liveConnector?.stop(true);
  demoPlan = [];
  demo = spam = stress = false;
  world.spawn.queue = [];
  world.effects.active.clear();
  scene.presentation.cancel();
  scene.entertainment.hype.reset();
  scene.entertainment.slides.reset();
  scene.entertainment.gifts.moments.clear();
  scene.entertainment.entrances.clear();
  scene.cinema.reset();
  scene.integration.pause();
  for (const d of world.spawn.dancers.values()) {
    d.vipUntil = d.featuredUntil = world.now;
  }
  $("#demo-button").textContent = "▷ Iniciar demo AFK";
  audio.stopEffects();
  audio.stop();
  config.mute = true;
  audio.apply();
  emergencyStatus(reason);
}
function resume() {
  if (scene.disposed) {
    emergencyStatus("Recargá la escena antes de reanudar");
    return;
  }
  renderRecoveryUsed = false;
  admission.resume();
  world.camera.wide(world.now, config);
  scene.integration.resume();
  document.body.classList.remove("emergency");
  $("#emergency-status").textContent = "Simulador · v0.6.14.1 ROW SHOW";
  toast("Admisión reabierta. Audio sigue silenciado; demo detenida.");
}
function mountEmergency() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="phase-controls"><span id="emergency-status" role="status">Simulador · v0.6.14.1 ROW SHOW</span><button id="emergency-stop">Parada · F8</button><button id="emergency-resume">Reanudar</button><button id="emergency-reload">Recargar escena</button></div>`,
  );
  $("#emergency-stop").onclick = () => panic();
  $("#emergency-resume").onclick = resume;
  $("#emergency-reload").onclick = () => location.reload();
  document.addEventListener(
    "click",
    (e) => {
      if (!admission.paused) return;
      const b = (e.target as HTMLElement).closest<HTMLElement>("button");
      if (
        !b ||
        b.closest(".phase-controls") ||
        b.dataset.nav ||
        b.dataset.action === "clean"
      )
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
  addEventListener("keydown", (e) => {
    if (e.key === "F8") {
      e.preventDefault();
      panic();
    }
  });
  Object.defineProperty(window, "__V04", {
    value: {
      configure: setCharacters,
      panic,
      resume,
      inspect: () => ({
        characters: scene.characters.inspect(scene.avatars.values()),
        admission: admission.inspect(),
      }),
      ...(new URLSearchParams(location.search).has("diagnostics")
        ? {
            debug: {
              world,
              scene,
              ingress: admission.ingress,
              clearSamples: () => {
                samples.length = 0;
              },
              failBlock: (id: string) => {
                const a = scene.avatars.get(id);
                if (a)
                  a.update = () => {
                    throw Error("Injected Block update failure");
                  };
              },
            },
          }
        : {}),
    },
  });
  Object.defineProperty(window, "__V05", {
    value: {
      inspect: () => scene.integration.inspect(scene.camera),
      configure: (c: any) => scene.integration.configure(c),
      framing: () => scene.integration.framing(scene.camera),
      next: () => scene.integration.next(),
      demo: startIntegrationDemo,
      record: async (seconds: number) => {
        const blob = await recordShow(
          scene.renderer.domElement,
          scene.integration,
          seconds,
        );
        return new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve((r.result as string).split(",")[1]);
          r.readAsDataURL(blob);
        });
      },
      ...(new URLSearchParams(location.search).has("diagnostics")
        ? {
            submit: (e: unknown) => admission.ingress.submit(e),
            reset: resetScene,
            world,
            show: scene.integration,
            reviewControl: (enabled: boolean) => { controlledReview=enabled; },
            reviewFrame: (dt: number) => {
              if (!controlledReview) throw Error("Review control is not active");
              if (!admission.paused) { admission.ingress.drain(Date.now()); world.update(dt,dt); }
              scene.update(admission.paused ? 0 : dt);
            },
          }
        : {}),
    },
  });
}

var demoPlan: { at: number; type: EventType; overrides: Partial<LiveEvent> }[] =
  [];
function startIntegrationDemo() {
  if (admission.paused) {
    toast("Reanudá explícitamente antes de iniciar la demo");
    return;
  }
  scene.integration.configure({ enabled: true });
  resetScene();
  scene.integration.client.beginDemo();
  config.afk = false;
  const t = world.now;
  demoPlan = [
    ...Array.from({ length: 10 }, (_, i) => ({
      at: t + i * 0.5,
      type: "VIEWER_JOIN" as EventType,
      overrides: { viewerId: "demo-" + i, username: names[i] },
    })),
    {
      at: t + 6,
      type: "FOLLOW",
      overrides: { viewerId: "demo-follow", username: "luna.live" },
    },
    {
      at: t + 10,
      type: "GIFT",
      overrides: {
        viewerId: "demo-follow",
        username: "luna.live",
        giftName: "Galaxia",
        giftId: "galaxy",
        metadata: { tier: "HIGH" },
      },
    },
    {
      at: t + 19,
      type: "SIMULATED",
      overrides: {
        viewerId: "demo-follow",
        username: "luna.live",
        giftId: "fever-demo",
      },
    },
  ];
  toast(
    "Demo: diez participantes, Follow, VIP y Fever. F8 detiene sin borrar identidades.",
  );
}
function runIntegrationDemo() {
  while (demoPlan?.length && demoPlan[0].at <= world.now) {
    const cue = demoPlan.shift()!;
    world.bus.emit(makeEvent(cue.type, cue.overrides));
  }
}
