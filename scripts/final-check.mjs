import { harness } from './v05-harness.mjs';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
const h=await harness('final');const {page}=h;let performanceResult;
try {
 await page.setViewportSize({width:720,height:1280});await h.fill(30);
 performanceResult=await page.evaluate(async()=>{
  const times=[],cpu=[];let prev;await new Promise(resolve=>{const end=performance.now()+8000;function tick(t){if(prev!==undefined)times.push(t-prev);prev=t;cpu.push(window.__LiveDance.snapshot().cpuMs);if(t<end)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});
  const mean=a=>a.reduce((a,b)=>a+b,0)/a.length;return {fps:1000/mean(times),frameMs:mean(times),p95RAF:times.sort((a,b)=>a-b)[Math.floor(times.length*.95)],cpuMs:mean(cpu),metrics:window.__LiveDance.snapshot(),framing:window.__V05.framing()};
 });
 assert.equal(performanceResult.metrics.width,720);assert.equal(performanceResult.metrics.height,1280);
 await h.send('GIFT','viewer-29',{giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});
 const frames=[];
 for(let i=0;i<10;i++){await page.waitForTimeout(1000);frames.push(await page.evaluate(()=>({event:window.__V05.inspect().event,framing:window.__V05.framing(),registered:window.__V05.inspect().registered.length})));}
 assert.ok(frames.every(s=>s.registered===30));assert.ok(frames.every(s=>s.framing.every(f=>f.x0>=0&&f.x1<=1&&f.y0>=0&&f.y1<=1)));
 const subjects=frames.flatMap(s=>s.framing.filter(f=>f.id===s.event?.id));assert.ok(subjects.length>0);assert.ok(subjects.every(f=>f.x0>=.1&&f.x1<=.9&&f.y0>=.12&&f.y1<=.75));
 assert.deepEqual(h.errors,[]);assert.deepEqual(await page.evaluate(()=>window.__LiveDance.inspect().errors),[]);
 await fs.writeFile('docs/v06/final-hd-framing.json',JSON.stringify(frames,null,2));
} finally {await h.close()}
const launch=JSON.parse((await promisify(execFile)(process.execPath,['scripts/launch-v05.mjs','--smoke'],{windowsHide:true})).stdout);
assert.equal(launch.smoke,'PASS');assert.equal(launch.version,'0.6.0-connector.1');assert.equal(launch.port,5380);
const baseline=JSON.parse(await fs.readFile('docs/v06/preservation-baseline.json','utf8')),changed=[];
for(const entry of baseline){const hash=createHash('sha256').update(await fs.readFile(entry.path)).digest('hex');if(hash!==entry.sha256)changed.push(entry.path)}
assert.deepEqual(changed,[]);
await fs.writeFile('docs/v06/launcher-smoke.json',JSON.stringify(launch,null,2));
await fs.writeFile('docs/v06/final-check.json',JSON.stringify({gate:'PASS',performanceResult,sourceFilesChecked:baseline.length,changed,launcher:launch},null,2));
console.log('Final smoke PASS; 30 @720',performanceResult.fps.toFixed(1),'FPS',performanceResult.p95RAF.toFixed(2),'p95');
