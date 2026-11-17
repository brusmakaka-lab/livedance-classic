import type { AudioManager } from "./audio";
import {
  validateEntertainment,
  type EntertainmentDirector,
} from "./entertainment";
import { time } from "./studio";
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
let search = "",
  favorites = false,
  selected = "";
export function retentionPanel(section: string) {
  if (
    !["Dashboard", "Simulator", "Scene", "Settings", "Dancers"].includes(
      section,
    )
  )
    return "";
  return `<section class="panel retention"><h2>Party control <span class="pill">SIMULACIÓN</span></h2><div id="party-status" role="status"></div><div class="hype-track"><i id="hype-fill"></i></div><div id="supporters-list"></div>${["Dashboard", "Simulator"].includes(section) ? `<div class="row"><button data-party="hype10">Hype +10</button><button data-party="hype50">Hype +50</button><button data-party="fever">Trigger Fever</button></div><details><summary>Interacciones y progresión</summary><div class="row">${[1, 5, 10, 25].map((n) => `<button data-multiplier="${n}">Gift x${n}${n === 25 ? "+" : ""}</button>`).join("")}</div><div class="row"><button data-party="entrance">Entrance</button><button data-party="reaction">Reacción</button><button data-party="support">Support +25</button><button data-party="promote">Promote Top 1</button></div><div class="row">${["like", "follow", "gift"].map((g) => `<button data-goal="${g}">${g[0].toUpperCase() + g.slice(1)} Goal</button>`).join("")}</div></details>` : ""}<details><summary>Ajustes de fiesta y Clean View</summary><div id="party-settings"></div></details></section>`;
}
const settingsLabels: Record<string, string> = {
  hypeOverlay: "Mostrar Hype",
  topOverlay: "Mostrar Top 3",
  goalsOverlay: "Mostrar Goals",
  vipOverlay: "Mostrar VIP / Featured",
  goalsEnabled: "Activar Goals",
  nameSize: "Tamaño usernames",
  beatIntensity: "Beat Visual Intensity",
  feverDuration: "Duración Fever (s)",
  cooldown: "Cooldown Fever (s)",
  decay: "Hype decay / s",
  grooveThreshold: "Umbral GROOVE",
  hypeThreshold: "Umbral HYPE",
  hypePlusThreshold: "Umbral HYPE+",
  level1: "Score nivel 1",
  level2: "Score nivel 2",
  level3: "Score nivel 3",
  likeGoal: "Like Goal objetivo",
  followGoal: "Follow Goal objetivo",
  giftGoal: "Gift Goal objetivo",
  commentWeight: "Peso Comment",
  followWeight: "Peso Follow",
  likeWeight: "Peso Like",
  lowWeight: "Peso LOW",
  normalWeight: "Peso NORMAL",
  highWeight: "Peso HIGH",
  reduceMotion: "Reduce motion",
  slides: "Event slides",
  ambient: "Reacciones ambientales",
  giftDuration: "Duración slides (s)",
};
export function loadParty(e: EntertainmentDirector) {
  try {
    const value = JSON.parse(
      localStorage.getItem("LiveDance.entertainment.v3") ?? "{}",
    );
    Object.assign(e.config, validateEntertainment(value ?? {}));
  } catch {
    e.log("config", "Lectura falló; se recuperó con defaults");
  }
}
export function partySettings(e: EntertainmentDirector) {
  const node = document.querySelector("#party-settings");
  if (!node || node.childElementCount) return;
  node.innerHTML = Object.entries(e.config)
    .map(([k, v]) =>
      typeof v === "boolean"
        ? `<label class="switch-row"><span>${settingsLabels[k] ?? k}</span><input type="checkbox" data-party-setting="${k}" aria-label="${settingsLabels[k] ?? k}" ${v ? "checked" : ""}></label>`
        : `<label class="field">${settingsLabels[k] ?? k}<input type="number" step=".1" min="0" max="10000" data-party-setting="${k}" value="${v}"></label>`,
    )
    .join("");
}
export function updateParty(e: EntertainmentDirector, now: number) {
  partySettings(e);
  const state = e.hype.getState(now),
    text = `${state} · ${Math.round(e.hype.value)} / 100${state === "FEVER" ? ` · ${Math.ceil(e.hype.feverUntil - now)}s` : ""}`;
  const set = (selector: string, text: string) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  };
  set("#party-status", text);
  set("#hype-overlay", text);
  const fill = document.querySelector<HTMLElement>("#hype-fill");
  if (fill) fill.style.width = e.hype.value + "%";
  const top = e.supporters.top
    .map((s, i) => `${i + 1}. ${s.name} · ${s.score}`)
    .join("  /  ");
  set("#supporters-list", top || "La fiesta todavía no tiene supporters");
  set("#ranking-overlay", top);
  set(
    "#goals-overlay",
    `Likes ${e.goals.like}/${e.config.likeGoal} · Follows ${e.goals.follow}/${e.config.followGoal} · Gifts ${e.goals.gift}/${e.config.giftGoal}`,
  );
  for (const [id, on] of [
    ["hype-overlay", e.config.hypeOverlay],
    ["ranking-overlay", e.config.topOverlay],
    ["goals-overlay", e.config.goalsOverlay],
  ] as const) {
    const node = document.getElementById(id);
    if (node) node.hidden = !on || (id === "ranking-overlay" && !top);
  }
  document.body.classList.toggle("reduce-motion", e.config.reduceMotion);
  const slide = document.querySelector<HTMLElement>("#event-slide"),
    s = e.slides.active;
  if (slide) {
    slide.hidden = !s || !e.config.slides;
    if (s) {
      const key = s.key + ":" + s.start;
      if (slide.dataset.key !== key) {
        slide.dataset.key = key;
        slide.innerHTML = `<span class="slide-symbol">${s.priority >= 4 ? "✦" : "↗"}</span><div><strong>${esc(s.title)}</strong><span>${esc(s.subtitle)}</span></div>`;
        slide.style.animation = "none";
        void slide.offsetWidth;
        slide.style.animation = "";
      }
      slide.dataset.strength = String(s.strength ?? 1);
      slide.classList.toggle("leaving", now - s.start! > s.duration - 0.5);
    }
  }
}
export function libraryPanel(a: AudioManager) {
  return `<section class="panel"><h2>Biblioteca · Listas · Cola</h2><label class="field">Buscar canciones<input id="library-search" placeholder="Nombre de pista" value="${esc(search)}"></label><label class="switch-row">Sólo favoritos<input id="library-favorites" type="checkbox" ${favorites ? "checked" : ""}></label><details open><summary>Listas guardadas</summary><div class="row"><input id="playlist-new-name" aria-label="Nombre de la lista" placeholder="Party / Electronic / Latin / Chill" maxlength="48"><button data-library="create">Crear</button></div><div id="collections-content">${collections(a)}</div></details><details open><summary>Biblioteca</summary><div id="library-content">${libraryRows(a)}</div></details><details open><summary>A continuación</summary><div id="queue-content">${queueRows(a)}</div><button data-library="clear-queue">Limpiar cola</button></details><label class="switch-row">Sugerir listas por energía<input id="energy-suggestions" type="checkbox" ${a.state.energySuggestions ? "checked" : ""}></label><p class="hint" id="energy-suggestion">Las sugerencias nunca interrumpen la canción actual.</p></section>`;
}
function collections(a: AudioManager) {
  return `<select id="saved-playlist" aria-label="Lista seleccionada"><option value="">Biblioteca completa</option>${a.state.playlists.map((p) => `<option value="${esc(p.id)}" ${selected === p.id ? "selected" : ""}>${esc(p.name)} (${p.trackIds.length})</option>`).join("")}</select><div class="row"><button data-library="activate">Usar al terminar canción</button><button data-library="rename">Renombrar</button><button data-library="delete">Eliminar lista</button></div><label>Categoría de la lista<select id="playlist-tag">${["CHILL", "GROOVE", "HYPE", "CUSTOM"].map((t) => `<option ${a.state.playlists.find((p) => p.id === selected)?.tag === t ? "selected" : ""}>${t}</option>`).join("")}</select></label><p class="hint">Activa: ${esc(a.state.playlists.find((p) => p.id === a.state.activePlaylist)?.name ?? "Biblioteca completa")}</p>`;
}
function libraryRows(a: AudioManager) {
  const list = a.state.playlists.find((p) => p.id === selected);
  return (
    a.state.tracks
      .filter(
        (t) =>
          (!favorites || t.favorite) &&
          t.name.toLowerCase().includes(search.toLowerCase()),
      )
      .map(
        (t) =>
          `<div class="library-row"><strong>${esc(t.name)}</strong><div class="row"><button data-favorite="${t.id}" aria-label="Favorito ${esc(t.name)}">${t.favorite ? "★" : "☆"}</button><button data-enqueue="${t.id}">+ Queue</button>${list ? `<button data-membership="${t.id}">${list.trackIds.includes(t.id) ? "Quitar de playlist" : "+ Playlist"}</button>` : ""}<select data-track-tag="${t.id}" aria-label="Tag ${esc(t.name)}">${["CUSTOM", "CHILL", "GROOVE", "HYPE"].map((tag) => `<option ${t.tag === tag ? "selected" : ""}>${tag}</option>`).join("")}</select></div></div>`,
      )
      .join("") ||
    '<p class="hint">Sin resultados. Importá archivos arriba.</p>'
  );
}
function queueRows(a: AudioManager) {
  return `<p class="hint">${a.state.queue.length} en cola · ${time(a.state.queue.reduce((n, id) => n + (a.state.tracks.find((t) => t.id === id)?.duration ?? 0), 0))} conocidos · Library ${time(a.state.tracks.reduce((n, t) => n + (t.duration ?? 0), 0))} conocidos</p>${a.state.queue.map((id, i) => `<div class="queue-row"><span>${esc(a.state.tracks.find((t) => t.id === id)?.name ?? "Ausente")}</span><button data-queue-up="${i}" aria-label="Subir en cola ${i + 1}" ${i === 0 ? "disabled" : ""}>↑</button><button data-queue-remove="${i}" aria-label="Quitar de cola ${i + 1}">×</button></div>`).join("") || '<p class="hint">Cola vacía: continúa la playlist activa.</p>'}`;
}
export function refreshLibrary(a: AudioManager) {
  for (const [id, html] of [
    ["collections-content", collections(a)],
    ["library-content", libraryRows(a)],
    ["queue-content", queueRows(a)],
  ]) {
    const n = document.getElementById(id);
    if (
      n &&
      !(
        n.contains(document.activeElement) &&
        (document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLSelectElement)
      ) &&
      n.innerHTML !== html
    )
      n.innerHTML = html;
  }
}
export function mountRetention(
  e: EntertainmentDirector,
  a: AudioManager,
  toast: (s: string) => void,
) {
  const save = () =>
    void a
      .persist()
      .then(() => {
        a.onChange();
        refreshLibrary(a);
      })
      .catch((err) => toast(`Playlist: ${err.message}`));
  document.addEventListener("click", (event) => {
    const b = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!b) return;
    const p = a.state.playlists.find((p) => p.id === selected);
    if (b.dataset.favorite) {
      const t = a.state.tracks.find((t) => t.id === b.dataset.favorite);
      if (t) t.favorite = !t.favorite;
      save();
    }
    if (b.dataset.enqueue) {
      a.model.enqueue(b.dataset.enqueue);
      save();
    }
    if (b.dataset.membership && p) {
      if (p.trackIds.includes(b.dataset.membership))
        a.model.removeFromPlaylist(p.id, b.dataset.membership);
      else p.trackIds.push(b.dataset.membership);
      save();
    }
    if (b.dataset.queueUp !== undefined) {
      a.model.moveQueue(+b.dataset.queueUp, +b.dataset.queueUp - 1);
      save();
    }
    if (b.dataset.queueRemove !== undefined) {
      a.state.queue.splice(+b.dataset.queueRemove, 1);
      save();
    }
    const action = b.dataset.library;
    if (action) {
      const input =
        document.querySelector<HTMLInputElement>("#playlist-new-name");
      if (action === "create") {
        selected =
          a.model.createPlaylist(input?.value ?? "Mi playlist")?.id ?? "";
        if (input) input.value = "";
      }
      if (action === "rename" && p) {
        if (input?.value.trim()) p.name = input.value.trim().slice(0, 48);
        else toast("Escribí el nuevo nombre en el campo de playlist");
      }
      if (action === "delete" && p) {
        a.state.playlists = a.state.playlists.filter((x) => x !== p);
        if (a.state.activePlaylist === selected) a.state.activePlaylist = null;
        selected = "";
      }
      if (action === "activate") {
        a.state.activePlaylist = selected || null;
        a.model.setMode(a.state.mode);
        toast("Selección aplicada a la próxima canción");
      }
      if (action === "clear-queue") a.state.queue = [];
      save();
    }
  });
  document.addEventListener("change", (event) => {
    const i = event.target as HTMLInputElement;
    if (i.dataset.partySetting) {
      const key = i.dataset.partySetting as keyof typeof e.config;
      const old = e.config[key];
      const v = typeof old === "boolean" ? i.checked : Number(i.value);
      if (typeof v === "boolean" || Number.isFinite(v)) {
        (e.config as any)[key] =
          typeof v === "number" ? Math.max(0, Math.min(10000, v)) : v;
        e.config.feverDuration = Math.max(
          20,
          Math.min(30, e.config.feverDuration),
        );
        e.config.cooldown = Math.max(10, e.config.cooldown);
        e.config.nameSize = Math.max(0.6, Math.min(1.5, e.config.nameSize));
        e.config.beatIntensity = Math.min(1, e.config.beatIntensity);
        Object.assign(e.config, validateEntertainment(e.config));
        try {
          localStorage.setItem(
            "LiveDance.entertainment.v3",
            JSON.stringify(e.config),
          );
        } catch {
          toast("Ajustes: no se pudo guardar; sesión conservada");
        }
      }
    }
    if (i.id === "saved-playlist") {
      selected = i.value;
      refreshLibrary(a);
    }
    if (i.id === "playlist-tag") {
      const p = a.state.playlists.find((p) => p.id === selected);
      if (p) p.tag = i.value;
      save();
    }
    if (i.dataset.trackTag) {
      const t = a.state.tracks.find((t) => t.id === i.dataset.trackTag);
      if (t) t.tag = i.value as any;
      save();
    }
    if (i.id === "library-favorites") {
      favorites = i.checked;
      refreshLibrary(a);
    }
    if (i.id === "energy-suggestions") {
      a.state.energySuggestions = i.checked;
      save();
    }
  });
  document.addEventListener("input", (event) => {
    const i = event.target as HTMLInputElement;
    if (i.id === "library-search") {
      search = i.value;
      refreshLibrary(a);
    }
  });
}
