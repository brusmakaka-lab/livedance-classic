import { LiveAdapter } from '../connector/adapter.mjs';
import fs from 'node:fs/promises';
const live = new LiveAdapter(), owner = 'authorized-probe-palermotusi';
const started = Date.now();
try {
  await live.start('palermotusi', owner);
  // Exactly one attempt. Do not automatically retry an offline/provider failure.
  for (let i = 0; i < 56; i++) {
    await new Promise(r => setTimeout(r, 500));
    live.poll(owner, 0);
    if (live.state !== 'CONNECTING') break;
  }
  const evidence = { date: new Date().toISOString(), username: 'palermotusi', authorized: true, userReportedLive: false, seconds: (Date.now() - started) / 1000, ...live.status(), realFollowVerified: false, realLikeVerified: false, realGiftVerified: false };
  await fs.writeFile('docs/v061/authorized-probe.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await live.dispose(); }
