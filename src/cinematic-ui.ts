import {
  cinemaConfig,
  type CinematicPresentation,
  type MomentKind,
  type GroupMode,
} from "./cinematic";
import type { World } from "./domain";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const titles: Record<MomentKind, string> = {
  JOIN: "TAKE THE FLOOR",
  FOLLOW: "NEW FOLLOWER",
  LOW: "A LITTLE SPARK",
  NORMAL: "IN THE SPOTLIGHT",
  HIGH: "FLOOR IGNITION",
  VIP: "VIP MOMENT",
  TOP: "NEW TOP SUPPORTER",
  GOAL: "GOAL REACHED",
  FEVER: "AFTERGLOW FEVER",
  LIKE: "FEEL THE LOVE",
  COMMENT: "SAY IT WITH A MOVE",
};
const paths: Record<string, string> = {
  FOLLOW: "M4 14l6-6 4 4 6-8M14 4h6v6",
  GIFT: "M4 10h16v11H4zM2 6h20v4H2zM12 6v15M12 6C2 6 5-2 12 6C19-2 22 6 12 6",
  VIP: "M3 6l4 5 5-8 5 8 4-5-2 14H5z",
  TOP: "M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z",
  GOAL: "M4 21V3h14l-3 4 3 4H4",
  FEVER: "M13 2L5 14h6l-1 8 9-13h-7z",
  LIKE: "M12 21L3 12C-2 3 8 0 12 7c4-7 14-4 9 5z",
  COMMENT: "M3 3h18v13H9l-6 5z",
  JOIN: "M12 3v18M3 12h18",
};
export function eventIcon(kind: MomentKind) {
  const path = paths[kind] ?? paths.GIFT;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
export function mountCinema(c: CinematicPresentation, w: World) {
  try {
    c.config = cinemaConfig(
      JSON.parse(localStorage.getItem("LiveDance.cinema.v031") ?? "{}"),
    );
  } catch {
    c.config = cinemaConfig();
  }
  document.addEventListener("change", (event) => {
    const i = event.target as HTMLInputElement;
    if (i.dataset.cinema) {
      const k = i.dataset.cinema as keyof typeof c.config;
      (c.config as any)[k] = k === "preset" ? i.value : i.checked;
      c.config = cinemaConfig(c.config);
      try {
        localStorage.setItem("LiveDance.cinema.v031", JSON.stringify(c.config));
      } catch {
        /* Session remains usable when storage is unavailable. */
      }
    }
  });
  document.addEventListener("click", (event) => {
    const b = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-choreo]",
    );
    if (b)
      c.group.trigger(
        w,
        b.dataset.choreo as GroupMode,
        "SIMULATOR",
        6,
        w.quality.current,
      );
  });
}
export function updateCinema(c: CinematicPresentation, now: number) {
  const retention = document.querySelector(".retention");
  if (retention && !document.querySelector("#cinema-settings"))
    retention.insertAdjacentHTML(
      "beforeend",
      `<details id="cinema-settings"><summary>Presentación cinematográfica</summary><label class="field">Clean View preset<select data-cinema="preset" aria-label="Clean View preset">${["MINIMAL", "BALANCED", "FULL"].map((v) => `<option ${c.config.preset === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>${(["upper", "slides", "hype", "top", "music", "goals", "featured", "branding", "cues"] as const).map((k) => `<label class="switch-row">${{ upper: "Upper Events", slides: "Slides", hype: "Hype module", top: "Top 3 module", music: "Now Playing module", goals: "Goals module", featured: "Featured module", branding: "Branding module", cues: "Sound cues" }[k]}<input type="checkbox" data-cinema="${k}" aria-label="Cinema ${k}" ${c.config[k] ? "checked" : ""}></label>`).join("")}<h3>Group choreography</h3><div class="row">${["DUO", "TRIO", "GROUP", "ALL"].map((m) => `<button data-choreo="${m}">${m}</button>`).join("")}</div></details>`,
    );
  const stage = document.querySelector<HTMLElement>("#stage");
  if (!stage) return;
  stage.dataset.layout = c.config.preset;
  stage.dataset.moment = c.banners.active?.kind ?? "NORMAL";
  stage.style.setProperty("--hud-visibility", String(c.hud));
  const m = c.banners.active,
    upper = document.querySelector<HTMLElement>("#upper-event"),
    lower = document.querySelector<HTMLElement>("#event-slide");
  if (upper) {
    upper.hidden = !m || !c.config.upper;
    if (m) {
      const key = m.key + ":" + m.start;
      upper.dataset.tier = m.kind;
      upper.classList.toggle("leaving", now - m.start > m.duration - 0.5);
      if (upper.dataset.key !== key) {
        upper.dataset.key = key;
        upper.style.animation = "none";
        void upper.offsetWidth;
        upper.style.animation = "";
        upper.innerHTML = `${eventIcon(m.kind)}<div><small>LIVEDANCE / MOMENTS</small><strong>${titles[m.kind]}</strong></div><i class="moment-progress"></i>`;
      }
      upper.style.setProperty(
        "--progress",
        String(Math.max(0, 1 - (now - m.start) / m.duration)),
      );
    }
  }
  if (lower && m) {
    lower.hidden = !c.config.slides || !c.legacy.slides;
    lower.dataset.tier = m.kind;
    lower.dataset.strength = String(
      m.count >= 25 ? 4 : m.count >= 10 ? 3 : m.count >= 5 ? 2 : 1,
    );
    lower.innerHTML = `<span class="slide-symbol">${eventIcon(m.kind)}</span><div><strong>${esc(m.name)}</strong><span>${esc(m.detail)}</span></div>`;
    lower.classList.toggle("leaving", now - m.start > m.duration - 0.5);
  } else if (lower) {
    lower.hidden = true;
  }
  for (const [id, on, secondary] of [
    ["hype-overlay", c.config.hype, false],
    ["ranking-overlay", c.config.top, true],
    ["now-playing-overlay", c.config.music, true],
    ["goals-overlay", c.config.goals, true],
    ["top-overlay", c.config.featured, true],
  ] as const) {
    const n = document.getElementById(id);
    if (n) {
      n.classList.toggle(
        "cinema-off",
        !on ||
          c.config.preset === "MINIMAL" ||
          (id === "goals-overlay" && c.config.preset === "BALANCED"),
      );
      n.style.opacity = String(
        secondary
          ? c.hud
          : m?.kind === "FEVER"
            ? 1
            : m?.kind === "VIP"
              ? 0.45
              : 0.75,
      );
    }
  }
  document
    .querySelector(".broadcast-brand")
    ?.classList.toggle(
      "cinema-off",
      !c.config.branding || c.config.preset === "MINIMAL" || !!m,
    );
  document
    .querySelector("#top-overlay")
    ?.classList.toggle(
      "cinema-off",
      !c.config.featured || !!m || c.config.preset !== "FULL",
    );
}
