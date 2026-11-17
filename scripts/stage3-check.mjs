import { harness } from "./v05-harness.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const h = await harness("stage3");
const { page } = h;
const samples = [];
try {
  for (const n of [1, 10, 30]) {
    await h.fill(n);
    await page.screenshot({
      path: `docs/v06/evidence/cinematic-wide-${n}.png`,
    });
    for (const kind of ["follow", "vip", "fever"]) {
      await page.evaluate(() => {
        window.__V05.show.events.clear();
        window.__V05.show.entertainment.hype.reset();
      });
      if (kind === "follow") await h.send("FOLLOW", "viewer-" + (n - 1));
      if (kind === "vip")
        await h.send("GIFT", "viewer-" + (n - 1), {
          giftId: "galaxy",
          giftName: "Galaxia",
          metadata: { tier: "HIGH" },
        });
      if (kind === "fever")
        await h.send("SIMULATED", "viewer-0", { giftId: "fever-demo" });
      await page.waitForFunction(
        (k) => window.__V05.inspect().event?.kind === k,
        kind,
      );
      const result = await page.evaluate(
        async ({ n, kind }) => {
          const list = [];
          const end =
            performance.now() +
            (kind === "fever" ? 14000 : kind === "vip" ? 10500 : 5500);
          while (performance.now() < end) {
            const s = window.__V05.inspect();
            list.push({
              n,
              kind,
              age: s.event?.age,
              subject: s.event?.id,
              framing: window.__V05.framing(),
              registered: s.registered.length,
            });
            await new Promise((r) => setTimeout(r, 250));
          }
          return list;
        },
        { n, kind },
      );
      samples.push(...result);
      console.log(n, kind, "samples", result.length);
    }
  }
  const cropped = samples.flatMap((s) =>
    s.framing
      .filter((f) => f.x0 < 0 || f.x1 > 1 || f.y0 < 0 || f.y1 > 1)
      .map((f) => ({ ...s, framing: f })),
  );
  const subjectUnsafe = samples.flatMap((s) =>
    s.framing
      .filter(
        (f) =>
          f.id === s.subject &&
          (f.x0 < 0.1 || f.x1 > 0.9 || f.y0 < 0.12 || f.y1 > 0.75),
      )
      .map((f) => ({ ...s, framing: f })),
  );
  await fs.writeFile(
    "docs/v06/stage3-framing.json",
    JSON.stringify({ cropped, subjectUnsafe, samples }, null, 2),
  );
  assert.equal(cropped.length, 0, "cropping");
  assert.equal(subjectUnsafe.length, 0, "subject safe area");
  assert.deepEqual(h.errors, []);
  await fs.writeFile(
    "docs/v06/stage3.json",
    JSON.stringify(
      {
        gate: "PASS",
        samples: samples.length,
        cropped: 0,
        subjectUnsafe: 0,
        errors: h.errors,
      },
      null,
      2,
    ),
  );
  console.log("Stage3 PASS");
} finally {
  await h.close();
}
