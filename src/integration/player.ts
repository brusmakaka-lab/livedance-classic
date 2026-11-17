import * as T from "three";
export class Player {
  mixer: T.AnimationMixer;
  actions: Record<string, T.AnimationAction> = {};
  state = "Idle";
  returnTo = "Idle";
  returnTime = 0;
  speed = 1;
  paused = false;
  loop = true;
  transitionAge = 1;
  private hold?: T.AnimationClip;
  constructor(
    public root: T.Object3D,
    public clips: T.AnimationClip[],
  ) {
    this.mixer = new T.AnimationMixer(root);
    for (const c of clips) this.actions[c.name] = this.mixer.clipAction(c);
    this.actions.Idle.play();
    this.mixer.addEventListener("finished", this.finished);
  }
  private finished = (e: { action: T.AnimationAction }) => {
    if (e.action === this.actions.Salute && this.state === "Salute") {
      this.set(this.returnTo);
      this.actions[this.returnTo].time = this.returnTime;
    }
  };
  private clearHold() {
    if (this.hold) {
      this.mixer.uncacheAction(this.hold);
      this.mixer.uncacheClip(this.hold);
      this.hold = undefined;
    }
  }
  set(name: string, immediate = false, force = false) {
    if (!this.actions[name]) throw Error("Unknown clip: " + name);
    if (name === "Salute" && this.state !== "Salute") {
      this.returnTo = this.state;
      this.returnTime = this.actions[this.state].time;
    }
    const next = this.actions[name];
    if (name === this.state && !immediate && !force && next.isRunning()) return;
    // Freeze the evaluated pose before clearing actions: interrupted fades cannot snap to bind pose.
    const tracks: T.KeyframeTrack[] = [];
    if (!immediate)
      this.root.traverse((o) => {
        if ((o as T.Bone).isBone) {
          tracks.push(
            new T.QuaternionKeyframeTrack(
              o.name + ".quaternion",
              [0],
              o.quaternion.toArray(),
            ),
          );
          if (o.name === "Hips")
            tracks.push(
              new T.VectorKeyframeTrack(
                "Hips.position",
                [0],
                o.position.toArray(),
              ),
            );
        }
      });
    this.clearHold();
    this.mixer.stopAllAction();
    next.reset().setEffectiveWeight(1);
    next.setLoop(
      name === "Salute" || !this.loop ? T.LoopOnce : T.LoopRepeat,
      Infinity,
    );
    next.clampWhenFinished = true;
    next.play();
    if (!immediate) {
      this.hold = new T.AnimationClip("TransitionPose", 0.45, tracks);
      this.mixer
        .clipAction(this.hold)
        .setLoop(T.LoopOnce, 1)
        .play()
        .fadeOut(0.45);
      next.fadeIn(0.45);
    }
    this.state = name;
    this.transitionAge = immediate ? 1 : 0;
    this.mixer.update(0);
  }
  update(dt: number) {
    if (this.paused) return;
    const delta = Math.min(Math.max(dt, 0), 0.1) * this.speed;
    this.transitionAge = Math.min(1, this.transitionAge + delta / 0.45);
    this.mixer.update(delta);
    if (this.transitionAge === 1) this.clearHold();
  }
  seek(t: number) {
    const state = this.state;
    this.set(state, true);
    this.actions[state].time = T.MathUtils.clamp(
      t,
      0,
      this.actions[state].getClip().duration,
    );
    this.mixer.update(0);
  }
  restart() {
    this.seek(0);
  }
  setLoop(v: boolean) {
    this.loop = v;
    const a = this.actions[this.state];
    a.setLoop(
      this.state === "Salute" || !v ? T.LoopOnce : T.LoopRepeat,
      Infinity,
    );
  }
  dispose() {
    this.mixer.removeEventListener("finished", this.finished);
    this.clearHold();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
