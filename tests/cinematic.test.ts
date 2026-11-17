import { it, expect } from "vitest";
import {
  UpperBannerQueue,
  CinematicPresentation,
  GroupChoreographyDirector,
  cinemaConfig,
  priorities,
  safeRegions,
  groupBudget,
  type Moment,
} from "../src/cinematic";
import { World, defaults, type LiveEvent } from "../src/domain";
import { PresentationDirector, presentationConfig } from "../src/presentation";
import { EntertainmentDirector } from "../src/entertainment";
import { ProceduralAvatar, appearance } from "../src/avatars";
const m = (kind: Moment["kind"], id = kind): Moment => ({
  key: id,
  kind,
  viewer: id,
  name: id,
  detail: "gift",
  count: 1,
  start: 0,
  received: 0,
  duration: 3,
});
function setup() {
  const w = new World({ ...defaults, inactivity: 600 }),
    p = new PresentationDirector(presentationConfig()),
    e = new EntertainmentDirector(w, p),
    c = new CinematicPresentation(w, p, e);
  return {
    w,
    p,
    e,
    c,
    tick: (n = 1) => {
      for (let i = 0; i < n * 60; i++) {
        w.update(1 / 60);
        p.update(w, 1 / 60);
        e.update(1 / 60);
        c.update(1 / 60);
      }
    },
  };
}
let seq = 0;
const event = (
  id: string,
  type: LiveEvent["eventType"] = "VIEWER_JOIN",
  tier = "LOW",
  count = 1,
): LiveEvent => ({
  schemaVersion: 1,
  eventId: String(++seq),
  viewerId: id,
  username: id,
  eventType: type,
  source: "simulator",
  timestamp: Date.now(),
  giftCount: count,
  metadata: { tier },
});
it("upper VIP preempts and lower cannot replace", () => {
  const q = new UpperBannerQueue();
  q.push(m("LOW"), 0);
  q.push(m("VIP"), 1);
  q.push(m("FOLLOW"), 2);
  expect(q.active?.kind).toBe("VIP");
  expect(q.queue.length).toBe(1);
});
it("priority order is explicit", () =>
  expect(
    ["VIP", "TOP", "GOAL", "HIGH", "FOLLOW", "NORMAL", "LOW"].map(
      (k) => priorities[k as keyof typeof priorities],
    ),
  ).toEqual([10, 9, 8, 6, 5, 4, 3]));
it("streak updates one active presentation with bounded life", () => {
  const q = new UpperBannerQueue();
  q.push(m("LOW"), 0);
  for (let i = 0; i < 25; i++) q.push({ ...m("LOW"), count: i + 1 }, i * 0.2);
  expect(q.active?.count).toBe(25);
  expect(q.queue).toHaveLength(0);
  q.update(7);
  expect(q.active).toBeNull();
});
it("follows aggregate without an infinite banner backlog", () => {
  const q = new UpperBannerQueue();
  for (let i = 0; i < 20; i++) q.push(m("FOLLOW", String(i)), 0.5);
  expect(q.active?.count).toBe(20);
  expect(q.queue).toHaveLength(0);
});
it("queue caps and TTL discard stale presentations without touching world", () => {
  const q = new UpperBannerQueue();
  q.push(m("VIP"), 0);
  for (let i = 0; i < 50; i++) q.push(m("LOW", String(i)), 1);
  expect(q.queue).toHaveLength(4);
  q.update(10);
  expect(q.active).toBeNull();
  expect(q.queue).toHaveLength(0);
});
it("same viewer LOW cannot replace VIP", () => {
  const q = new UpperBannerQueue();
  q.push({ ...m("VIP"), key: "a" }, 0);
  q.push({ ...m("LOW"), key: "a" }, 1);
  expect(q.active?.kind).toBe("VIP");
});
it("new Follow spawns once and existing Follow presents without duplication", () => {
  const s = setup();
  s.w.bus.emit(event("a", "FOLLOW"));
  s.tick(12);
  expect(s.w.spawn.dancers.size).toBe(1);
  s.w.bus.emit(event("a", "FOLLOW"));
  s.tick(0.2);
  expect(s.w.spawn.dancers.size).toBe(1);
  expect(s.c.subject).toBe("a");
  expect(s.p.reactions.get("a")?.kind).toBe("WAVE_HELLO");
});
it("premium first gift tracks entering viewer while preserving VIP priority", () => {
  const s = setup();
  s.w.bus.emit(event("a", "GIFT", "HIGH"));
  s.tick(0.3);
  expect(s.c.banners.active?.premium).toBe(true);
  expect(s.c.subject).toBe("a");
  expect(s.p.shot).toBe("VIP");
});
it("existing comments do not schedule presentation", () => {
  const s = setup();
  s.w.bus.emit(event("a"));
  s.tick(14);
  s.w.bus.emit(event("a", "COMMENT"));
  s.tick(0.1);
  expect(s.c.banners.active).toBeNull();
});
it("reset clears portal flags, banners, group and crowd", () => {
  const s = setup();
  s.w.bus.emit(event("a", "FOLLOW"));
  s.tick(1);
  s.c.reset();
  s.e.reset();
  expect(s.c.inspect()).toMatchObject({
    active: null,
    queue: [],
    crowd: 0,
    subject: null,
  });
  expect(s.p.entranceStrength).toBe(0);
});
it("DUO/TRIO/GROUP/ALL select bounded existing members", () => {
  const s = setup();
  for (let i = 0; i < 12; i++) s.w.bus.emit(event(String(i)));
  s.tick(20);
  for (const [mode, count] of [
    ["DUO", 2],
    ["TRIO", 3],
    ["GROUP", 8],
    ["ALL", 12],
  ] as const) {
    s.c.group.trigger(s.w, mode, "SIM");
    expect(s.c.group.members.size).toBe(count);
  }
});
it("choreography returns without changing original dancer state", () => {
  const s = setup();
  s.w.bus.emit(event("a"));
  s.tick(12);
  const d = s.w.spawn.dancers.get("a")!,
    animation = d.animationState,
    phase = d.phase;
  s.c.group.trigger(s.w, "ALL", "FEVER", 2);
  expect(s.c.group.dance).toBe("Electro");
  s.tick(3);
  expect(s.c.group.members.size).toBe(0);
  expect(d.animationState).toBe(animation);
  expect(d.phase).toBe(phase);
});
it("exit removes choreography member", () => {
  const s = setup();
  s.w.bus.emit(event("a"));
  s.tick(12);
  s.c.group.trigger(s.w, "ALL", "SIM");
  s.w.spawn.dancers.clear();
  s.c.group.update(s.w);
  expect(s.c.group.members.size).toBe(0);
});
it("VIP creates bounded crowd reaction and expires", () => {
  const s = setup();
  for (let i = 0; i < 12; i++) s.w.bus.emit(event(String(i)));
  s.tick(20);
  s.c.show("VIP", "1", "one");
  s.tick(0.1);
  expect(s.c.crowd.size).toBeGreaterThan(0);
  expect(s.c.crowd.size).toBeLessThanOrEqual(8);
  s.tick(3);
  expect(s.c.crowd.size).toBe(0);
});
it("Top ceremony happens on leader change only", () => {
  const s = setup();
  s.w.bus.emit(event('a'));s.w.bus.emit(event('b'));s.tick(12);
  s.e.supporters.add("a", "A", 10);
  s.tick(1);
  s.e.supporters.add("b", "B", 20);
  s.tick(0.1);
  const start = s.c.banners.active?.start;
  expect(s.c.banners.active?.kind).toBe("TOP");
  s.e.supporters.add("b", "B", 10);
  s.tick(0.1);
  expect(s.c.banners.active?.start).toBe(start);
});
it("Goal starts once and HUD restores smoothly", () => {
  const s = setup();
  s.e.goal("like", 20);
  s.tick(0.5);
  expect(s.c.banners.active?.kind).toBe("GOAL");
  expect(s.c.hud).toBeLessThan(0.2);
  s.tick(5);
  expect(s.c.hud).toBeGreaterThan(0.8);
});
it("Fever starts synchronized distinct choreography", () => {
  const s = setup();
  s.w.bus.emit(event("a"));
  s.tick(12);
  s.e.hype.add(100, s.w.now);
  s.tick(0.1);
  expect(s.c.group.reason).toBe("FEVER");
  expect(s.c.group.dance).toBe("Electro");
});
it("presets validate and old config gets safe defaults", () => {
  expect(cinemaConfig()).toMatchObject({ preset: "BALANCED", upper: true });
  expect(cinemaConfig({ preset: "MINIMAL", top: false })).toMatchObject({
    preset: "MINIMAL",
    top: false,
  });
  expect(cinemaConfig({ preset: "bad" as any })).toEqual(cinemaConfig());
});
it("safe areas have no overlap and contain subject", () => {
  expect(safeRegions.top[1]).toBeLessThan(safeRegions.gameplay[0]);
  expect(safeRegions.gameplay[1]).toBeLessThan(safeRegions.lower[0]);
  expect(safeRegions.subject[3]).toBeLessThan(safeRegions.gameplay[1]);
});
it("appearance is deterministic and varied", () => {
  expect(appearance("Ana")).toEqual(appearance("Ana"));
  expect(
    new Set(Array.from({ length: 90 }, (_, i) => appearance(String(i)).hair))
      .size,
  ).toBe(9);
});
it("art pass retains instancing part budget and selective accessories", () => {
  const a = new ProceduralAvatar("Ana"),
    b = new ProceduralAvatar("Ana", false);
  expect(a.parts.filter((p) => p.node.visible).length).toBeLessThan(80);
  expect(a.parts.length).toBeLessThan(100);
  a.dispose();
  b.dispose();
});
it("quality bounds all group resources", () => {
  expect(groupBudget).toEqual({ LOW: 10, MEDIUM: 30, HIGH: 60 });
});
it('presentation waits for a queued subject and does not expire before spawn',()=>{const s=setup();s.c.show('VIP','later','Later','gift');expect(s.c.banners.active).toBeNull();expect(s.c.pending.size).toBe(1);s.tick(3);s.w.bus.emit(event('later'));s.tick(.3);expect(s.c.banners.active?.kind).toBe('VIP');expect(s.c.pending.size).toBe(0);expect(s.c.subject).toBe('later');});
it('unspawned presentation is bounded and cleaned after TTL',()=>{const s=setup();for(let i=0;i<20;i++)s.c.show('FOLLOW','missing'+i);expect(s.c.pending.size).toBe(8);s.tick(13);expect(s.c.pending.size).toBe(0);});
it('group phase is actually shared by avatars and released to their original phase',()=>{const s=setup();s.w.bus.emit(event('a'));s.tick(12);const d=s.w.spawn.dancers.get('a')!,a=new ProceduralAvatar('a'),b=new ProceduralAvatar('b');a.danceOverride=b.danceOverride='Electro';a.syncStart=b.syncStart=0;for(let i=1;i<30;i++){a.update(d,i/30,1/30);b.update({...d,phase:d.phase+1,speed:1.5},i/30,1/30);}expect(a.pose).toEqual(b.pose);a.syncStart=b.syncStart=undefined;a.danceOverride=b.danceOverride=undefined;a.update(d,2,.1);b.update({...d,phase:d.phase+1},2,.1);expect(a.pose).not.toEqual(b.pose);a.dispose();b.dispose();});
it('Follow and Goal coordinate light states without allocating new lights',()=>{const s=setup();s.w.bus.emit(event('a','FOLLOW'));s.tick(.3);expect(s.p.lights.state).toBe('FEATURED');s.e.goal('like',20);s.tick(.1);expect(s.p.lights.state).toBe('HYPE');});
