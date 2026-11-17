import { describe, it, expect } from "vitest";
import {
  PlaylistModel,
  playlistState,
  crossfadeDuration,
  duckGain,
} from "../src/playlist";
const tracks = ["a", "b", "c"].map((id) => ({
  id,
  name: id + ".wav",
  size: 128,
  mime: "audio/wav",
}));
describe("playlist v2", () => {
  it("add multiple without duplicates and select first", () => {
    const m = new PlaylistModel();
    m.add(tracks);
    m.add([tracks[0]]);
    expect(m.state.tracks).toHaveLength(3);
    expect(m.current?.id).toBe("a");
  });
  it("remove current chooses neighbor; clear leaves null", () => {
    const m = new PlaylistModel({ tracks });
    m.remove("a");
    expect(m.current?.id).toBe("b");
    m.remove("b");
    m.remove("c");
    expect(m.current).toBeUndefined();
    expect(m.state.currentId).toBeNull();
  });
  it("reorder retains current and clamps bounds", () => {
    const m = new PlaylistModel({ tracks });
    m.reorder("a", 2);
    expect(m.state.tracks.map((t) => t.id)).toEqual(["b", "c", "a"]);
    expect(m.current?.id).toBe("a");
    m.reorder("c", -9);
    expect(m.state.tracks[0].id).toBe("c");
  });
  it("sequential next previous and OFF ends", () => {
    const m = new PlaylistModel({ tracks });
    expect(m.next()).toBe("b");
    expect(m.previous()).toBe("a");
    expect(m.next(true)).toBe("b");
    expect(m.next(true)).toBe("c");
    expect(m.next(true)).toBeNull();
  });
  it("repeat TRACK only affects automatic transitions", () => {
    const m = new PlaylistModel({ tracks, repeat: "TRACK" });
    expect(m.next(true)).toBe("a");
    expect(m.next(false)).toBe("b");
  });
  it("repeat PLAYLIST wraps in both directions", () => {
    const m = new PlaylistModel({ tracks, repeat: "PLAYLIST" });
    expect(m.previous()).toBe("c");
    expect(m.next(true)).toBe("a");
  });
  it("shuffle exhausts without duplicates and previous returns history", () => {
    const m = new PlaylistModel({ tracks, mode: "SHUFFLE" }, () => 0);
    expect(m.next()).toBe("b");
    expect(m.next()).toBe("c");
    expect(m.next()).toBeNull();
    expect(m.previous()).toBe("b");
  });
  it("shuffle cycles avoid immediate repeated track", () => {
    const m = new PlaylistModel(
      { tracks, mode: "SHUFFLE", repeat: "PLAYLIST" },
      () => 0.9,
    );
    const results = Array.from({ length: 10 }, () => m.next());
    expect(results.every((x, i) => !i || results[i - 1] !== x)).toBe(true);
  });
  it("shuffle one track can repeat playlist", () => {
    const m = new PlaylistModel({
      tracks: [tracks[0]],
      mode: "SHUFFLE",
      repeat: "PLAYLIST",
    });
    expect(m.next(true)).toBe("a");
  });
  it("missing and corrupt files skipped with bounded empty result", () => {
    const m = new PlaylistModel({
      tracks: [{ ...tracks[0], missing: true }, tracks[1], tracks[2]],
      repeat: "PLAYLIST",
    });
    expect(m.next()).toBe("b");
    m.fail("b", "decode");
    expect(m.next()).toBe("c");
    m.fail("c", "decode");
    expect(m.next()).toBeNull();
  });
  it("skips failed middle track forward rather than replaying earlier track", () => {
    const m = new PlaylistModel({ tracks, currentId: "b" });
    m.fail("b", "decode");
    expect(m.next()).toBe("c");
  });
  it("restores saved current, order, BPM and modes", () => {
    const m = new PlaylistModel({
      tracks,
      currentId: "b",
      mode: "SHUFFLE",
      repeat: "TRACK",
      crossfade: 3,
    });
    const copy = new PlaylistModel(JSON.parse(JSON.stringify(m.state)));
    expect(copy.state).toEqual(m.state);
  });
  it("validates invalid current and options", () => {
    const m = new PlaylistModel({ tracks, currentId: "no" });
    expect(m.current?.id).toBe("a");
    expect(
      playlistState({ crossfade: 99 as any, duckAmount: 8 }).crossfade,
    ).toBe(0);
    expect(playlistState({ duckAmount: 8 }).duckAmount).toBe(0.9);
  });
  it("crossfade limited to half of either track including short clips", () => {
    expect(crossfadeDuration(5, 2, 8)).toBe(1);
    expect(crossfadeDuration(0, 20, 20)).toBe(0);
    expect(crossfadeDuration(3, 20, 20)).toBe(3);
  });
  it("duck gain returns smoothly targeted normal after expiry and OFF", () => {
    expect(duckGain(true, 0.6, 1)).toBeCloseTo(0.4);
    expect(duckGain(true, 0.6, 0)).toBe(1);
    expect(duckGain(false, 0.6, 1)).toBe(1);
  });
});
