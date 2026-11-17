import { mountSoundControls } from "./sound-panel";
import type { AudioManager } from "./audio";
import {
  presentationConfig,
  type PresentationConfig,
  PresentationStore,
} from "./presentation";
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const repeatLabel = (mode: string) => mode === "TRACK" ? "↻ Repetir canción" : mode === "PLAYLIST" ? "↻ Repetir lista" : "↻ Sin repetir";
export const time = (n: number) =>
  Number.isFinite(n)
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`
    : "0:00";
export function playlistPanel(a: AudioManager) {
  const s = a.state;
  return `<section class="panel"><div class="panel-title"><h2>Reproductor y cola actual</h2><span class="pill" id="playlist-count">${s.tracks.length} / 100</span></div><p class="hint">Copias en data/music · 80 MiB por archivo · 1 GiB total. Tus originales permanecen intactos.</p><div class="field"><label for="music-file">Añadir música · selección múltiple</label><input id="music-file" type="file" multiple accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"></div><div id="playlist-content">${playlistContent(a)}</div><details class="audio-options"><summary>Mezcla, repetición y avisos</summary><div class="grid2"><div class="field"><label for="music-mode">Modo</label><select id="music-mode" data-music="mode">${["SEQUENTIAL", "SHUFFLE"].map((v) => `<option value="${v}" ${s.mode === v ? "selected" : ""}>${v==="SEQUENTIAL"?"En orden":"Aleatorio"}</option>`).join("")}</select></div><div class="field"><label for="music-repeat">Repetir</label><select id="music-repeat" data-music="repeat">${["OFF", "TRACK", "PLAYLIST"].map((v) => `<option value="${v}" ${s.repeat === v ? "selected" : ""}>${v==="OFF"?"Sin repetir":v==="TRACK"?"Canción":"Lista"}</option>`).join("")}</select></div></div><div class="field"><label for="music-crossfade">Transición entre canciones</label><select id="music-crossfade" data-music="crossfade">${[0, 1, 2, 3, 5].map((v) => `<option value="${v}" ${s.crossfade === v ? "selected" : ""}>${v ? `${v} s` : "OFF"}</option>`).join("")}</select></div>${musicSwitch("ducking", "Bajar música durante VIP", s.ducking)}<div class="field"><label for="duck-amount">Reducción de música durante VIP</label><input id="duck-amount" data-music="duckAmount" type="range" min="0" max="0.9" step=".05" value="${s.duckAmount}"></div>${musicSwitch("nowPlaying", "Mostrar canción actual", s.nowPlaying)}${musicSwitch("beat", "BPM manual · EXPERIMENTAL", s.beat)}</details><p class="hint">BPM opcional 40–240 por pista. Pulso de luces suave; no sincroniza la coreografía.</p><div class="row"><button class="small" data-music-action="folder">Abrir carpeta de música</button><button class="small" data-music-action="clear">Eliminar todas</button></div></section>`;
}
function musicSwitch(k: string, label: string, value: boolean) {
  return `<label class="switch-row"><span>${label}</span><input class="switch" aria-label="${label}" type="checkbox" data-music="${k}" ${value ? "checked" : ""}></label>`;
}
function playlistContent(a: AudioManager) {
  return `<div class="now-card"><div class="track-art" aria-hidden="true">♫</div><small>SONANDO AHORA</small><strong>${esc(a.current?.name ?? "Tu próxima canción empieza acá")}</strong><span id="music-status">${esc(a.status)}</span></div><div class="transport"><button data-music-action="previous" title="Anterior" aria-label="Anterior">⏮</button><button class="primary" data-music-action="play" aria-label="${a.playing ? "Pausar" : "Reproducir"}">${a.playing ? "Ⅱ" : "▶"}</button><button data-music-action="next" title="Siguiente" aria-label="Siguiente">⏭</button><button data-music-action="stop" title="Detener" aria-label="Detener">■</button><button data-music-action="repeat" aria-label="Cambiar repetición">${repeatLabel(a.state.repeat)}</button></div><label class="sr-only" for="music-seek">Progreso de música</label><input id="music-seek" type="range" min="0" max="${Number.isFinite(a.duration) ? a.duration : 0}" step=".1" value="${a.position}"><div class="time-row"><span id="music-progress">${time(a.position)}</span><span id="music-duration">${time(a.duration)}</span></div><ol class="playlist" aria-label="Pistas de música">${a.state.tracks.map((t, i) => `<li draggable="true" data-track="${t.id}" class="${a.state.currentId === t.id ? "current" : ""}"><div class="track-info"><button class="track-name" data-play-track="${t.id}" title="Reproducir ${esc(t.name)}">${i + 1}. ${esc(t.name)}</button><small>${t.error || t.missing ? esc(t.error ?? "Archivo ausente") : `${t.duration ? time(t.duration) : "—:—"} · ${(t.size / 1024 / 1024).toFixed(1)} MiB`}</small></div><div class="track-tools"><input type="number" data-bpm="${t.id}" aria-label="BPM ${esc(t.name)}" title="BPM opcional" min="40" max="240" placeholder="BPM" value="${t.bpm ?? ""}"><button data-move-track="${t.id}" data-index="${i - 1}" aria-label="Subir ${esc(t.name)}" ${i === 0 ? "disabled" : ""}>↑</button><button data-move-track="${t.id}" data-index="${i + 1}" aria-label="Bajar ${esc(t.name)}" ${i === a.state.tracks.length - 1 ? "disabled" : ""}>↓</button><button data-remove-track="${t.id}" aria-label="Eliminar ${esc(t.name)}">×</button></div></li>`).join("") || '<li class="empty-playlist">Añadí MP3, WAV u otro formato compatible con Edge. Arrastrá archivos aquí o usá el selector.</li>'}</ol>`;
}
export function presentationPanel(
  c: PresentationConfig,
  kind: "scene" | "camera",
) {
  if (kind === "camera")
    return `<section class="panel"><h2>Composición cinematográfica</h2>${visualSwitch("group", "Planos GROUP", c.group)}${visualSwitch("entrance", "Planos ENTRANCE", c.entrance)}${visualRange("cameraSmooth", "Velocidad de transición", c.cameraSmooth, 0.4, 2, 0.1)}${visualRange("framing", "Distancia general", c.framing, 0.85, 1.15, 0.05)}<p class="hint">Sólo con director automático. Featured y VIP conservan prioridad.</p></section>`;
  return `<section class="panel"><h2>Identidad del escenario</h2>${(["sceneName", "title", "subtitle"] as const).map((k, i) => `<div class="field"><label for="visual-${k}">${["Nombre del escenario", "Texto principal", "Subtítulo"][i]}</label><input id="visual-${k}" data-visual="${k}" maxlength="48" value="${esc(c[k])}"></div>`).join("")}<div class="field"><label for="visual-accent">Acento del escenario</label><input id="visual-accent" type="color" data-visual="accent" value="${c.accent}"></div>${visualSwitch("branding", "Mostrar branding", c.branding)}${visualSwitch("topContributor", "Mostrar Top Contributor", c.topContributor)}${visualRange("lightIntensity", "Intensidad ambiental", c.lightIntensity, 0.2, 1.2, 0.1)}<p class="hint">Afterglow 3.0 activo. Registro preparado para futuras escenas; todavía no seleccionables.</p></section>`;
}
function visualSwitch(k: string, label: string, value: boolean) {
  return `<label class="switch-row"><span>${label}</span><input class="switch" aria-label="${label}" type="checkbox" data-visual="${k}" ${value ? "checked" : ""}></label>`;
}
function visualRange(
  k: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
) {
  return `<div class="field"><label for="visual-${k}">${label}</label><input id="visual-${k}" type="range" data-visual="${k}" value="${value}" min="${min}" max="${max}" step="${step}"></div>`;
}
export function mountStudio(
  a: AudioManager,
  c: PresentationConfig,
  store: PresentationStore,
  toast: (s: string) => void,
) {
  const report = (e: unknown) => toast(String((e as Error).message ?? e));
  const run = (p: Promise<unknown>) => void p.catch(report);
  a.onError = toast;
  mountSoundControls(a, toast);
  a.onChange = () => {
    const node = document.querySelector("#playlist-content");
    if (!node) return;
    // Keep transport nodes alive while metadata/persistence completes: a pointer
    // down/up must never land on two different buttons during a quick skip.
    const template = document.createElement("template");
    template.innerHTML = playlistContent(a);
    const next = template.content;
    for (const selector of [".now-card strong", "#music-status"]) {
      const target = node.querySelector(selector);
      if (target)
        target.textContent = next.querySelector(selector)!.textContent;
    }
    const play = node.querySelector('[data-music-action="play"]')!;
    play.textContent = a.playing ? "Ⅱ" : "▶";
    play.setAttribute("aria-label", a.playing ? "Pausar" : "Reproducir");
    const repeat = node.querySelector('[data-music-action="repeat"]');
    if (repeat) repeat.textContent = repeatLabel(a.state.repeat);
    const repeatSelect = document.querySelector<HTMLSelectElement>("#music-repeat");
    if (repeatSelect) repeatSelect.value = a.state.repeat;
    const list = node.querySelector(".playlist")!,
      fresh = next.querySelector(".playlist")!;
    if (
      list.innerHTML !== fresh.innerHTML &&
      !(
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.dataset.bpm
      )
    )
      list.innerHTML = fresh.innerHTML;
    const count = document.querySelector("#playlist-count");
    if (count) count.textContent = `${a.state.tracks.length} / 100`;
    updateMusicUI(a);
  };
  let dragId = "";
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b) return;
    if (b.dataset.playTrack) run(a.play(b.dataset.playTrack));
    if (b.dataset.removeTrack) run(a.remove(b.dataset.removeTrack));
    if (b.dataset.moveTrack)
      run(a.reorder(b.dataset.moveTrack, Number(b.dataset.index)));
    const action = b.dataset.musicAction;
    if (action === "play") {
      if (a.playing) a.pause();
      else run(a.play());
    }
    if (action === "repeat") run(a.settings({ repeat: a.state.repeat === "OFF" ? "TRACK" : a.state.repeat === "TRACK" ? "PLAYLIST" : "OFF" }));
    if (action === "previous") run(a.previous());
    if (action === "next") run(a.unlock().then(() => a.advance()));
    if (action === "stop") a.stop();
    if (action === "clear") run(a.clear());
    if (action === "folder") run(a.library.openFolder());
  });
  document.addEventListener("change", (e) => {
    const i = e.target as HTMLInputElement;
    if (i.dataset.music)
      run(
        a.settings({
          [i.dataset.music]:
            i.type === "checkbox"
              ? i.checked
              : ["crossfade", "duckAmount"].includes(i.dataset.music)
                ? Number(i.value)
                : i.value,
        }),
      );
    if (i.dataset.bpm) run(a.bpm(i.dataset.bpm, Number(i.value)));
    if (i.id === "music-seek") a.seek(Number(i.value));
    if (i.dataset.visual) {
      Object.assign(
        c,
        presentationConfig({
          ...c,
          [i.dataset.visual]:
            i.type === "checkbox"
              ? i.checked
              : i.type === "range"
                ? Number(i.value)
                : i.value,
        }),
      );
      store.save(c);
      if (store.warning) toast(store.warning);
    }
  });
  document.addEventListener("dragstart", (e) => {
    dragId =
      (e.target as HTMLElement).closest<HTMLElement>("[data-track]")?.dataset
        .track ?? "";
    if (dragId) e.dataTransfer?.setData("text/plain", dragId);
  });
  document.addEventListener("dragover", (e) => {
    if ((e.target as HTMLElement).closest("#playlist-content"))
      e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      "#playlist-content",
    );
    if (!target) return;
    e.preventDefault();
    if (e.dataTransfer?.files.length) run(a.add([...e.dataTransfer.files]));
    else {
      const id = (e.target as HTMLElement).closest<HTMLElement>("[data-track]")
        ?.dataset.track;
      if (id && dragId)
        run(
          a.reorder(
            dragId,
            a.state.tracks.findIndex((t) => t.id === id),
          ),
        );
    }
    dragId = "";
  });
}
export function updateMusicUI(a: AudioManager) {
  const seek = document.querySelector<HTMLInputElement>("#music-seek");
  if (seek && document.activeElement !== seek) {
    seek.max = String(Number.isFinite(a.duration) ? a.duration : 0);
    seek.value = String(a.position);
  }
  const progress = document.querySelector("#music-progress");
  if (progress) progress.textContent = time(a.position);
  const duration = document.querySelector("#music-duration");
  if (duration) duration.textContent = time(a.duration);
  const status = document.querySelector("#audio-status");
  if (status) status.textContent = a.status;
}
