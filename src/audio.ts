import { EventSounds, soundSlot } from "./event-sounds";
import type { Config } from "./domain";

import {
  MusicLibrary,
  PlaylistModel,
  crossfadeDuration,
  duckGain,
  type PlaylistState,
} from "./playlist";

interface Deck {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  id: string | null;
}

export class AudioManager {
  customSounds = new EventSounds();
  private effectSources = new Set<AudioScheduledSourceNode>();
  context?: AudioContext;
  private master?: GainNode;
  private fx?: GainNode;
  private musicGain?: GainNode;
  private duck?: GainNode;

  private decks: Deck[] = [];
  private activeDeck = 0;
  private voices = 0;
  private last = Number.NEGATIVE_INFINITY;
  private lastCue: string | null = null;
  private revision = 0;
  private loading = false;
  private fadeEnd = 0;
  private duckUntil = 0;
  private timer: number;
  private pendingCancel?: () => void;

  library = new MusicLibrary();
  model = new PlaylistModel();
  ready = false;
  playing = false;
  busy = false;
  status = "Silenciado";
  onChange = () => {};
  onError = (message: string) => {
    this.status = message;
    this.onChange();
  };

  constructor(private config: Config) {
    this.timer = window.setInterval(() => this.tick(), 100);
  }

  get state() {
    return this.model.state;
  }
  get current() {
    return this.model.current;
  }
  get position() {
    return this.decks[this.activeDeck]?.element.currentTime ?? 0;
  }
  get duration() {
    return (
      this.decks[this.activeDeck]?.element.duration ||
      this.current?.duration ||
      0
    );
  }

  async init() {
    const saved = await this.library.init();
    this.model = new PlaylistModel(saved);
    this.ready = true;
    this.status =
      (saved as PlaylistState & { warning?: string }).warning ||
      (this.state.tracks.length
        ? "Biblioteca restaurada · pulsá Play"
        : "Biblioteca vacía");
    this.onChange();
  }

  async unlock() {
    if (!this.context) {
      const c = (this.context = new AudioContext());
      this.master = c.createGain();
      this.fx = c.createGain();
      this.musicGain = c.createGain();
      this.duck = c.createGain();
      this.fx.connect(this.master);
      this.musicGain.connect(this.duck);
      this.duck.connect(this.master);
      this.master.connect(c.destination);
      this.decks = [0, 1].map(() => {
        const element = new Audio();
        element.preload = "metadata";
        const source = c.createMediaElementSource(element),
          gain = c.createGain();
        source.connect(gain);
        gain.connect(this.musicGain!);
        const deck = { element, source, gain, id: null };
        element.addEventListener("ended", () => {
          if (this.decks[this.activeDeck] === deck && !this.loading)
            this.safe(this.advance(true));
        });
        element.addEventListener("error", () => {
          if (
            this.playing &&
            !this.loading &&
            this.decks[this.activeDeck] === deck
          ) {
            this.model.fail(deck.id!, "No se pudo decodificar");
            this.safe(this.advance(false));
          }
        });
        return deck;
      });
    }
    await this.context.resume();
    await this.customSounds.load(this.context, this.onError);
    this.apply();
  }

  apply() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master!.gain.setTargetAtTime(
      this.config.mute ? 0 : this.config.master,
      t,
      0.03,
    );
    this.fx!.gain.setTargetAtTime(this.config.effects, t, 0.03);
    this.musicGain!.gain.setTargetAtTime(this.config.music, t, 0.03);
  }

  private safe(promise: Promise<unknown>) {
    void promise.catch((e) => this.onError(String(e.message ?? e)));
  }

  async persist() {
    await this.library.save(this.state);
  }

  async add(files: File[]) {
    if (!this.ready || this.busy)
      throw Error("Esperá a que termine la operación de biblioteca");
    this.busy = true;
    const errors: string[] = [];
    try {
      await this.persist();
      for (const file of files) {
        try {
          this.model.add([await this.library.import(file)]);
        } catch (e) {
          errors.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      await this.persist();
      this.status = errors.length
        ? errors.join(" · ")
        : `${files.length} pista(s) importada(s)`;
      this.onChange();
    } finally {
      this.busy = false;
    }
    return errors;
  }

  async load(file: File) {
    await this.unlock();
    const errors = await this.add([file]);
    if (errors.length) throw Error(errors.join(" · "));
    const track = this.state.tracks.at(-1);
    if (track) {
      await this.play(track.id);
      this.status = `Música local: ${file.name}`;
      this.onChange();
    }
  }

  async play(id?: string) {
    if (this.busy) return;
    await this.unlock();
    if (id) {
      this.model.select(id);
      if (this.current) {
        delete this.current.error;
        this.current.missing = false;
      }
    }
    const current = this.current;
    if (!current) return;
    const deck = this.decks[this.activeDeck];
    if (deck.id === current.id && deck.element.readyState >= 1 && !id) {
      await deck.element.play();
      this.playing = true;
      this.status = `Reproduciendo: ${current.name}`;
      this.onChange();
      return;
    }
    await this.start(current.id, 0);
  }

  private cancelPending() {
    this.revision++;
    this.pendingCancel?.();
    this.pendingCancel = undefined;
    this.loading = false;
  }

  private cancelFade() {
    this.fadeEnd = 0;
    if (!this.context) return;
    this.decks.forEach((d, i) => {
      d.gain.gain.cancelScheduledValues(this.context!.currentTime);
      d.gain.gain.setValueAtTime(
        i === this.activeDeck ? 1 : 0,
        this.context!.currentTime,
      );
      if (i !== this.activeDeck) d.element.pause();
    });
  }

  private async start(id: string, requested: number): Promise<void> {
    this.cancelPending();
    const revision = this.revision;
    this.loading = true;
    this.cancelFade();
    const old = this.decks[this.activeDeck],
      incoming = this.decks[1 - this.activeDeck],
      track = this.state.tracks.find((t) => t.id === id);
    if (!track) {
      this.loading = false;
      return;
    }
    incoming.element.pause();
    incoming.id = id;
    incoming.element.src = this.library.url(id);
    incoming.gain.gain.setValueAtTime(0, this.context!.currentTime);

    try {
      await new Promise<void>((resolve, reject) => {
        const done = (error?: Error) => {
            clearTimeout(timeout);
            incoming.element.removeEventListener("loadedmetadata", ok);
            incoming.element.removeEventListener("error", bad);
            if (this.pendingCancel === cancel) this.pendingCancel = undefined;
            error ? reject(error) : resolve();
          },
          ok = () => done(),
          bad = () =>
            done(Error("Archivo ausente, dañado o formato no decodificable")),
          cancel = () => done(Error("Cancelado"));
        const timeout = window.setTimeout(
          () => done(Error("Tiempo de carga agotado")),
          8000,
        );
        this.pendingCancel = cancel;
        incoming.element.addEventListener("loadedmetadata", ok, { once: true });
        incoming.element.addEventListener("error", bad, { once: true });
        incoming.element.load();
      });
      if (revision !== this.revision) return;

      await incoming.element.play();
      if (revision !== this.revision) {
        incoming.element.pause();
        return;
      }
      track.duration = incoming.element.duration;
      delete track.error;
      track.missing = false;
      const c = this.context!,
        time = c.currentTime,
        fade = this.playing
          ? crossfadeDuration(
              requested,
              old.element.duration || 0,
              track.duration || 0,
            )
          : 0;

      incoming.gain.gain.setValueAtTime(fade ? 0 : 1, time);
      old.gain.gain.setValueAtTime(fade ? 1 : 0, time);
      if (fade) {
        incoming.gain.gain.linearRampToValueAtTime(1, time + fade);
        old.gain.gain.linearRampToValueAtTime(0, time + fade);
        this.fadeEnd = time + fade;
      } else old.element.pause();
      this.activeDeck = 1 - this.activeDeck;
      this.model.select(id);
      this.playing = true;
      this.status = `Reproduciendo: ${track.name}`;
      await this.persist();
      this.onChange();
    } catch (error) {
      if (revision !== this.revision) return;
      incoming.element.pause();
      if ((error as Error).name === "NotAllowedError") {
        this.pause();
        this.status = "Pulsá Play para habilitar audio";
        this.onChange();
        return;
      }
      this.model.fail(id, (error as Error).message);
      this.status = `Omitida: ${track.name}`;
      const next = this.model.next(false);
      await this.persist();
      if (next) {
        await this.start(next, 0);
      } else {
        this.stop();
        this.status = "No quedan pistas reproducibles";
        this.onChange();
      }
    } finally {
      if (revision === this.revision) this.loading = false;
    }
  }

  pause() {
    this.cancelPending();
    this.cancelFade();
    this.decks.forEach((d) => d.element.pause());
    this.playing = false;
    this.status = "Pausado";
    this.onChange();
  }

  stopEffects() {
    for (const source of this.effectSources) { try { source.stop(); } catch {} }
    this.effectSources.clear();
  }

  stop() {
    this.pause();
    this.decks.forEach((d) => {
      if (d.element.readyState >= 1) d.element.currentTime = 0;
    });
    this.duckUntil = 0;
    this.status = "Detenido";
    this.onChange();
  }

  seek(seconds: number) {
    this.cancelPending();
    this.cancelFade();
    const d = this.decks[this.activeDeck];
    if (d && Number.isFinite(d.element.duration))
      d.element.currentTime = Math.max(
        0,
        Math.min(seconds, d.element.duration),
      );
    this.onChange();
  }

  async advance(automatic = false, early = false) {
    if (this.loading || this.busy) return;
    const next = this.model.next(automatic);
    if (next) await this.start(next, automatic ? this.state.crossfade : 0);
    else if (!early) {
      this.stop();
      this.status = "Fin de playlist";
      this.onChange();
    }
  }

  async previous() {
    const id = this.model.previous();
    if (id) {
      await this.unlock();
      await this.start(id, 0);
    }
  }

  async remove(id: string) {
    if (this.busy) return;
    this.busy = true;
    const resume = this.playing,
      current = id === this.state.currentId;
    try {
      await this.persist();
      if (current) this.stop();
      else {
        this.cancelPending();
        this.cancelFade();
      }
      await this.library.remove(id);
      this.model.remove(id);
      for (const d of this.decks)
        if (d.id === id) {
          d.element.pause();
          d.element.removeAttribute("src");
          d.element.load();
          d.id = null;
        }
      await this.persist();
      this.onChange();
    } finally {
      this.busy = false;
    }
    if (current && resume && this.current) await this.play();
  }

  async clear() {
    if (this.busy) return;
    this.busy = true;
    try {
      this.stop();
      await this.persist();
      await this.library.clear();
      this.model = new PlaylistModel({
        ...this.state,
        tracks: [],
        currentId: null,
      });
      for (const d of this.decks) {
        d.element.removeAttribute("src");
        d.element.load();
        d.id = null;
      }
      await this.persist();
      this.onChange();
    } finally {
      this.busy = false;
    }
  }

  async reorder(id: string, index: number) {
    if (this.busy) return;
    this.model.reorder(id, index);
    await this.persist();
    this.onChange();
  }

  async settings(values: Partial<PlaylistState>) {
    if (values.mode) this.model.setMode(values.mode);
    Object.assign(this.state, values);
    if (values.crossfade !== undefined) this.cancelFade();
    await this.persist();
    this.onChange();
  }

  async bpm(id: string, bpm: number) {
    const track = this.state.tracks.find((t) => t.id === id);
    if (track) {
      track.bpm =
        Number.isFinite(bpm) && bpm >= 40 && bpm <= 240 ? bpm : undefined;
      await this.persist();
    }
  }

  private tick() {
    const c = this.context;
    if (!c) return;
    this.duck!.gain.setTargetAtTime(
      duckGain(
        this.state.ducking,
        this.state.duckAmount,
        this.duckUntil - c.currentTime,
      ),
      c.currentTime,
      0.12,
    );
    if (this.fadeEnd && c.currentTime >= this.fadeEnd) this.cancelFade();
    if (
      this.playing &&
      !this.loading &&
      !this.fadeEnd &&
      this.state.crossfade > 0 &&
      Number.isFinite(this.duration) &&
      this.duration - this.position <=
        Math.min(this.state.crossfade, this.duration / 2) &&
      this.position > 0
    )
      this.safe(this.advance(true, true));
  }

  sound(kind: string) {
    const c = this.context;
    if (["vip", "high"].includes(kind) && c)
      this.duckUntil = c.currentTime + 3.5;
    if (
      !c ||
      c.state !== "running" ||
      this.config.mute ||
      !this.customSounds.enabled ||
      this.voices >= 4 ||
      c.currentTime - this.last < 0.12
    )
      return;
    this.last = c.currentTime;
    this.lastCue = kind;
    this.voices++;
    const custom = this.customSounds.buffers.get(soundSlot(kind));
    if (custom) {
      const source = c.createBufferSource(); source.buffer = custom; source.connect(this.fx!);
      this.effectSources.add(source);
      source.onended = () => { source.disconnect(); this.effectSources.delete(source); this.voices = Math.max(0, this.voices - 1); };
      source.start(); return;
    }
    const osc = c.createOscillator(),
      gain = c.createGain(),
      note =
        kind === "fever"
          ? 880
          : kind === "goal"
            ? 784
            : kind === "top"
              ? 698
              : kind === "high"
                ? 587
                : kind === "vip"
                  ? 660
                  : kind === "follow"
                    ? 523
                    : kind === "gift"
                      ? 440
                      : 330;
    osc.frequency.setValueAtTime(note, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      note * 1.5,
      c.currentTime + 0.18,
    );
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.fx!);
    this.effectSources.add(osc);
    osc.start();
    osc.stop(c.currentTime + 0.42);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.effectSources.delete(osc);
      this.voices = Math.max(0, this.voices - 1);
    };
  }

  inspect() {
    return {
      state: this.state,
      voices: this.voices,
      eventSounds: { enabled: this.customSounds.enabled, loaded: [...this.customSounds.buffers.keys()] },
      lastCue: this.lastCue,
      busy: this.busy,
      playing: this.playing,
      position: this.position,
      duration: this.duration,
      loading: this.loading,
      fading: !!this.fadeEnd,
      duck: this.duck?.gain.value ?? 1,
      decks: this.decks.map((d) => ({
        id: d.id,
        paused: d.element.paused,
        gain: d.gain.gain.value,
      })),
      status: this.status,
    };
  }

  dispose() {
    this.stopEffects();
    this.stop();
    clearInterval(this.timer);
    this.decks.forEach((d) => {
      d.source.disconnect();
      d.element.removeAttribute("src");
      d.element.load();
    });
    void this.context?.close();
  }
}
