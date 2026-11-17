import type { IntegrationShow } from "./show";
export async function recordShow(
  canvas: HTMLCanvasElement,
  show: IntegrationShow,
  seconds = 14,
) {
  const c = document.createElement("canvas");
  c.width = canvas.width;
  c.height = canvas.height;
  const ctx = c.getContext("2d")!,
    stream = c.captureStream(30),
    mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm;codecs=vp8",
    rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 7000000,
    }),
    chunks: Blob[] = [];
  let running = true;
  const draw = () => {
    if (!running) return;
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    const k = c.width / 365;
    ctx.save();
    ctx.scale(k, k);
    const e = show.director.cue;
    for (const a of show.actors.values()) {
      if (a.label.hidden) continue;
      const ratio = 365 / canvas.clientWidth;
      const x = parseFloat(a.label.style.left) * ratio, y = parseFloat(a.label.style.top) * ratio;
      const width = parseFloat(a.label.style.width) * ratio;
      if (![x,y,width].every(Number.isFinite)) continue;
      ctx.fillStyle = "#0a1321e8";ctx.fillRect(x-width/2,y-17,width,17);
      ctx.fillStyle = a.label.style.getPropertyValue("--name-accent");ctx.fillRect(x-width/2,y-17,2,17);
      ctx.fillStyle = "#f6f3ee";ctx.font = "600 10px system-ui";
      let label = a.label.textContent || "";
      while (ctx.measureText(label).width > width-12 && label.length > 1) label = label.slice(0,-1);
      ctx.fillText(label,x-width/2+6,y-4);
    }
    if (e || show.paused) {
    ctx.fillStyle = "#101b29da";
    ctx.fillRect(40, 73, 285, 64);
    ctx.fillStyle = e?.kind === "vip" ? "#ffdc90" : "#9fdbc9";
    ctx.font = "600 10px system-ui";
    ctx.fillText(
      show.paused
        ? "F8 · PAUSA SEGURA"
        : e
          ? e.kind.toUpperCase() + " · " + show.sourceLabel()
          : "LIVEDANCE · INTEGRATIONLAB",
      48,
      88,
    );
    ctx.font = "600 17px system-ui";
    ctx.fillStyle = "#f7f1dd";
    ctx.fillText(
      show.paused ? "Identidades conservadas" : e?.name || "La fiesta continúa",
      48,
      109,
      268,
    );
    ctx.font = "10px system-ui";
    ctx.fillText(
      e?.kind === "follow" ? "Tu personaje entra a la fiesta" : e?.gift ||
        `${show.world.spawn.dancers.size} registrados · ${show.cast.visible.length} destacados`,
      48,
      127,
      268,
    );
    }
    ctx.restore();
    requestAnimationFrame(draw);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    rec.onerror = reject;
  });
  try {
    draw();
    rec.start();
    await new Promise((r) =>
      setTimeout(r, Math.max(1, Math.min(60, seconds)) * 1000),
    );
    rec.stop();
    return await done;
  } finally {
    running = false;
    stream.getTracks().forEach((t) => t.stop());
  }
}
