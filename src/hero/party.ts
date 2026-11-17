import { HeroCache, HeroVisual } from "./asset";
import { SceneManager } from "../scene";
import { World, defaults, type LiveEvent } from "../domain";
import { ProceduralAvatar } from "../avatars";
import { updateCinema } from "../cinematic-ui";
import "../style.css";
const el = document.querySelector("#hero-party")!;
el.innerHTML = `<div style="display:flex;justify-content:center;gap:24px;padding:28px"><aside style="width:230px"><h1>Hero / Afterglow</h1><a href="/">Volver al Hero Lab</a><p>Presentación original v0.3.1. Sólo se sustituye el avatar en este laboratorio.</p>${["Follow", "Gift", "Featured", "VIP", "Top"].map((x) => `<button data-event="${x}" style="display:block;margin:15px 0">${x}</button>`).join("")}<p id="state"></p></aside><div id="stage" class="stage" style="width:450px;height:800px;position:relative"><div class="broadcast-top"><div class="broadcast-brand">LiveDance<span>HERO STUDY</span></div><span class="sim-badge">SIMULACIÓN</span></div><div id="upper-event" class="upper-event" hidden></div><div id="event-slide" class="event-slide" hidden></div></div></div>`;
const cache = new HeroCache();
await cache.preload();
const world = new World({
    ...defaults,
    adaptive: false,
    quality: "MEDIUM",
    cameraAuto: true,
    afk: false,
    inactivity: 3600,
  }),
  scene = new SceneManager(
    document.querySelector("#stage") as HTMLElement,
    world,
  ),
  heroes = new Map<string, HeroVisual>();
let seq = 0;
function emit(type: LiveEvent["eventType"], tier?: string) {
  world.bus.emit({
    schemaVersion: 1,
    eventId: "hero-party-" + seq++,
    source: "simulator",
    viewerId: "afterglow.runner",
    username: "Afterglow Runner",
    eventType: type,
    timestamp: Date.now(),
    giftCount: 1,
    giftName: "Hero Spark",
    metadata: { tier },
  });
}
function event(kind: string) {
  scene.presentation.cancel();
  scene.cinema.reset();
  scene.entertainment.reset();
  world.now += 60;
  const d = world.spawn.dancers.values().next().value;
  if (d) {
    d.vipUntil = 0;
    d.featuredUntil = 0;
    d.state = "DANCING";
  }
  if (kind === "Follow") emit("FOLLOW");
  else if (kind === "Gift") emit("GIFT", "LOW");
  else if (kind === "VIP") emit("GIFT", "HIGH");
  else if (kind === "Featured") emit("GIFT", "NORMAL");
  else if (kind === "Top") {
    scene.entertainment.supporters.add(
      "afterglow.runner",
      "Afterglow Runner",
      500,
    );
    scene.cinema.show(
      "TOP",
      "afterglow.runner",
      "Afterglow Runner",
      "Hero study",
    );
  }
}
document.addEventListener("click", (e) => {
  const kind = (e.target as HTMLElement).closest<HTMLElement>("[data-event]")
    ?.dataset.event;
  if (kind) event(kind);
});
let prev = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  world.update(dt, dt);
  scene.update(dt);
  for (const [id, a] of scene.avatars) {
    if (!(a instanceof ProceduralAvatar)) continue;
    const hero = new HeroVisual(cache, id);
    a.dispose();
    heroes.set(id, hero);
    scene.scene.add(hero.root);
    scene.avatars.set(id, {
      root: hero.root,
      update: (d, t, dt) => {
        const reaction = scene.presentation.reactions.get(id);
        hero.clip = d.vipUntil > t ? "VIP" : reaction ? "Wave" : "Groove";
        hero.expression =
          d.vipUntil > t ? "VIP" : reaction ? "HAPPY" : "NEUTRAL";
        hero.forceLOD =
          heroes.size === 1 || scene.cinema.subject === id ? 0 : 2;
        hero.update(d, t, dt);
      },
      dispose: () => {
        hero.dispose();
        heroes.delete(id);
      },
    });
  }
  updateCinema(scene.cinema, world.now);
  document.querySelector("#state")!.textContent =
    scene.cinema.banners.active?.kind ?? "NORMAL";
  requestAnimationFrame(loop);
}
emit("VIEWER_JOIN");
requestAnimationFrame(loop);
(window as any).__HeroParty = { world, scene, heroes, event };
addEventListener("pagehide", () => {
  scene.dispose();
  cache.dispose();
});
