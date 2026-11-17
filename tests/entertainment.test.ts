import { describe, it, expect } from "vitest";
import {
  HypeMeter,
  entertainmentDefaults,
  TopSupporters,
  GiftDirector,
  multiplier,
  effectBudgets,
  EntertainmentDirector,
} from "../src/entertainment";
import { SlideDirector } from "../src/slides";
import { World, defaults, type LiveEvent } from "../src/domain";
import {
  PresentationDirector,
  presentationConfig,
  dances,
} from "../src/presentation";
import { PlaylistModel, playlistState } from "../src/playlist";
const config = () => ({ ...entertainmentDefaults });
const event = (count = 1): LiveEvent => ({
  schemaVersion: 1,
  eventId: "x",
  source: "simulator",
  viewerId: "a",
  username: "Ana",
  eventType: "GIFT",
  giftCount: count,
  timestamp: 1,
  metadata: { tier: "HIGH" },
});
describe("Entertainment v3", () => {
  it("an empty ranking does not emit diagnostics every frame", () => {
    const w=new World({...defaults}),p=new PresentationDirector(presentationConfig()),e=new EntertainmentDirector(w,p);
    for(let i=0;i<120;i++){w.update(1/60);p.update(w,1/60);e.update(1/60);}
    expect(e.diagnostics).toEqual([]);e.dispose();
  });
  it("hype accumulates and decays without negative values", () => {
    const h = new HypeMeter(config());
    h.add(50, 0);
    h.update(1, 1);
    expect(h.value).toBeCloseTo(49.3);
    h.update(1000, 1000);
    expect(h.value).toBe(0);
  });
  it("Fever starts at100 and cannot extend itself", () => {
    const h = new HypeMeter(config());
    h.add(100, 10);
    expect(h.feverUntil).toBe(35);
    h.add(100, 20);
    expect(h.feverUntil).toBe(35);
    expect(h.getState(20)).toBe("FEVER");
  });
  it("Fever returns and enforces cooldown", () => {
    const h = new HypeMeter(config());
    h.add(100, 0);
    h.update(26, 1);
    expect(h.getState(26)).not.toBe("FEVER");
    h.add(100, 27);
    expect(h.value).toBe(99);
    h.add(100, 71);
    expect(h.getState(71)).toBe("FEVER");
  });
  it("energy fades smoothly after Fever", () => {
    const h = new HypeMeter(config());
    h.add(100, 0);
    h.update(2, 2);
    const energy = h.energy;
    h.update(26, 0.1);
    expect(Math.abs(energy - h.energy)).toBeLessThan(0.1);
  });
  it("support score determines stable Top3", () => {
    const s = new TopSupporters();
    s.add("a", "A", 10);
    s.add("b", "B", 40);
    s.add("c", "C", 100);
    expect(s.top.map((v) => v.id)).toEqual(["c", "b", "a"]);
    s.add("a", "A", 100);
    expect(s.top[0].id).toBe("a");
  });
  it("cosmetic levels respect configured thresholds", () => {
    const s = new TopSupporters();
    for (const [n, l] of [
      [0, 0],
      [10, 1],
      [40, 2],
      [100, 3],
    ]) {
      s.viewers.clear();
      s.add("a", "A", n);
      expect(s.level("a", config())).toBe(l);
    }
  });
  it("gift multipliers are discrete and bounded", () =>
    expect([1, 5, 10, 25, 1000].map(multiplier)).toEqual([1, 2, 3, 4, 4]));
  it("GiftDirector replaces same viewer moment", () => {
    const g = new GiftDirector();
    g.receive(event(), 0);
    g.receive(event(25), 1);
    expect(g.moments.size).toBe(1);
    expect(g.moments.get("a")?.kind).toBe("VIP_POSE");
    expect(g.moments.get("a")?.strength).toBe(4);
  });
  it("budgets increase deliberately by quality", () => {
    expect(effectBudgets.LOW.beams).toBe(0);
    expect(effectBudgets.HIGH.lights).toBe(2);
    expect(effectBudgets.MEDIUM.particles).toBe(10);
  });
  it("Goals fire once, reset clears transient state", () => {
    const w = new World({ ...defaults });
    const p = new PresentationDirector(presentationConfig());
    const e = new EntertainmentDirector(w, p);
    e.goal("like", 20);
    const v = e.hype.value;
    e.goal("like", 20);
    expect(e.hype.value).toBe(v);
    e.reset();
    expect(e.reached.size).toBe(0);
    expect(e.slides.active).toBeNull();
    e.dispose();
  });
  it("EventBus dedup prevents duplicate score", () => {
    const w = new World({ ...defaults });
    const p = new PresentationDirector(presentationConfig());
    const e = new EntertainmentDirector(w, p);
    w.bus.emit(event());
    w.bus.emit(event());
    expect(e.supporters.top[0].score).toBe(16);
    e.dispose();
  });
  it("reaction expires and returns to dance", () => {
    const w = new World({ ...defaults });
    w.bus.emit(event());
    w.update(0.1);
    const p = new PresentationDirector(presentationConfig());
    p.react("a", "HEART", 0, 2);
    w.now = 3;
    p.update(w, 0.1);
    expect([...p.reactions.values()].some((r) => r.kind === "HEART")).toBe(
      false,
    );
  });
  it("16 distinct dance names retain legacy first four", () => {
    expect(new Set(dances).size).toBe(16);
    expect(dances.slice(0, 4)).toEqual(["Groove", "Disco", "Shuffle", "Wave"]);
  });
});
describe("slides", () => {
  const slide = (key: string, priority = 1) => ({
    key,
    title: key,
    subtitle: "test",
    priority,
    duration: 2,
  });
  it("VIP preempts LOW but LOW cannot cover VIP", () => {
    const s = new SlideDirector();
    s.show(slide("low"), 0);
    s.show(slide("vip", 5), 1);
    s.show(slide("low2"), 1);
    expect(s.active?.key).toBe("vip");
    expect(s.queue).toHaveLength(1);
  });
  it("streak coalesces, queue bounded and priority sorted", () => {
    const s = new SlideDirector();
    s.show(slide("vip", 9), 0);
    for (let i = 0; i < 20; i++) s.show(slide("x" + i, i % 4), 0);
    s.show(slide("x19", 3), 0);
    expect(s.queue.length).toBe(8);
    expect(s.queue[0].priority).toBe(3);
  });
  it("expiry advances queue and reset cleans all", () => {
    const s = new SlideDirector();
    s.show(slide("a"), 0);
    s.show(slide("b"), 1);
    s.update(3);
    expect(s.active?.key).toBe("b");
    s.update(6);
    expect(s.active).toBeNull();
    s.reset();
    expect(s.queue).toHaveLength(0);
  });
});
describe("Library and playlists migration", () => {
  const tracks = ["a", "b", "c"].map((id) => ({
    id,
    name: id,
    size: 8,
    mime: "audio/wav",
    bpm: 120,
  }));
  it("v02 data migrates preserving track/order/settings", () => {
    const s = playlistState({
      version: 2,
      tracks,
      currentId: "b",
      crossfade: 3,
      beat: true,
    });
    expect(s.tracks).toEqual(tracks);
    expect(s.currentId).toBe("b");
    expect(s.crossfade).toBe(3);
    expect(s.playlists).toEqual([]);
    expect(s.collectionsVersion).toBe(1);
  });
  it("collections reference one library copy and removal preserves file", () => {
    const m = new PlaylistModel({ tracks });
    const p = m.createPlaylist("Party")!;
    p.trackIds = ["a", "b"];
    m.removeFromPlaylist(p.id, "a");
    expect(m.state.tracks).toHaveLength(3);
    expect(p.trackIds).toEqual(["b"]);
  });
  it("Up Next reorder takes precedence without changing playlist", () => {
    const m = new PlaylistModel({ tracks });
    m.enqueue("b");
    m.enqueue("c");
    m.moveQueue(1, 0);
    expect(m.next()).toBe("c");
    expect(m.next()).toBe("b");
    expect(m.state.tracks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
  it("favorite/tag/BPM persist in normalized state", () => {
    const m = new PlaylistModel({ tracks });
    m.state.tracks[0].favorite = true;
    m.state.tracks[0].tag = "HYPE";
    const n = playlistState(m.state);
    expect(n.tracks[0]).toMatchObject({
      favorite: true,
      tag: "HYPE",
      bpm: 120,
    });
  });
  it("active collection schedules next without interrupting current", () => {
    const m = new PlaylistModel({ tracks });
    const p = m.createPlaylist("Chill")!;
    p.trackIds = ["c"];
    m.state.activePlaylist = p.id;
    expect(m.current?.id).toBe("a");
    expect(m.next()).toBe("c");
  });
  it("removed tracks are pruned from collections and queue", () => {
    const m = new PlaylistModel({ tracks });
    const p = m.createPlaylist("P")!;
    p.trackIds = ["a"];
    m.enqueue("a");
    m.remove("a");
    expect(p.trackIds).toEqual([]);
    expect(m.state.queue).toEqual([]);
  });
});
