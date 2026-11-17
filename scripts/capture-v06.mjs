import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('v06-visual'), {page}=h, frames=[];
page.setDefaultTimeout(30000);
try{
 await page.evaluate(()=>document.body.classList.remove('clean'));
 await page.locator('[data-integration="featured"]').selectOption('30');
 assert.equal((await page.evaluate(()=>window.__V05.inspect())).config.featured,30);
 await page.reload();await page.waitForFunction(()=>window.__V05?.inspect().ready);
 assert.equal((await page.evaluate(()=>window.__V05.inspect())).config.featured,30);
 await page.evaluate(()=>{window.__V05.world.config.afk=false;window.__V05.world.config.adaptive=false;window.__V05.world.config.quality='MEDIUM';window.__V05.world.config.inactivity=3600;});
 await h.fill(30);
 for(const res of [[365,648],[720,1280]]){
  await page.setViewportSize({width:res[0],height:res[1]});
  for(const cap of [20,30]){
   await page.evaluate(featured=>window.__V05.configure({featured}),cap);await page.waitForTimeout(4000);
   await h.send('GIFT','viewer-29',{giftId:'galaxy',giftName:'SIMULACIÓN LOCAL',metadata:{tier:'HIGH'}});
   for(let i=0;i<9;i++){
    await page.waitForTimeout(900);
    const f=await page.evaluate(()=>({event:window.__V05.inspect().event,boxes:window.__V05.framing(),registered:window.__V05.inspect().registered.length}));
    frames.push({res,cap,...f});
    if(i===3)await page.screenshot({path:`docs/v061/evidence/vip-middle-${res[0]}-${cap}.png`});
   }
   await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});
   await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='fever');
   await page.waitForTimeout(3500);await page.screenshot({path:`docs/v061/evidence/fever-middle-${res[0]}-${cap}.png`});
   await page.keyboard.press('F8');await page.getByRole('button',{name:'Reanudar',exact:true}).click();
  }
 }
 // Explicitly labelled local evidence, not a real event recording.
 await page.setViewportSize({width:365,height:648});await page.evaluate(()=>window.__V05.configure({featured:20}));await page.waitForTimeout(4000);
 const recording=page.evaluate(()=>window.__V05.record(18));
 await h.send('GIFT','viewer-29',{giftId:'galaxy',giftName:'SIMULACIÓN LOCAL · NO TIKTOK',metadata:{tier:'HIGH'}});
 await page.waitForTimeout(8500);await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});
 const video=await recording;await fs.writeFile('docs/v061/evidence/SIMULATOR-aforo20-VIP-Fever.webm',Buffer.from(video,'base64'));
 const crops=frames.flatMap(f=>f.boxes.filter(b=>b.x0<0||b.x1>1||b.y0<0||b.y1>1).map(b=>({res:f.res,cap:f.cap,event:f.event,box:b})));
 await fs.writeFile('docs/v061/framing-v06.json',JSON.stringify({frames,crops,errors:h.errors,source:'SIMULATOR — NOT REAL TIKTOK'},null,2));
 assert.ok(frames.every(f=>f.registered===30));assert.deepEqual(crops,[]);assert.deepEqual(h.errors,[]);
 await page.setViewportSize({width:720,height:1280});await page.evaluate(()=>window.__V05.configure({featured:20}));await h.fill(10);
 const confirmation=await page.evaluate(async()=>{
  const raf=[],cpu=[];let previous;await new Promise(resolve=>{const end=performance.now()+10000;function tick(t){if(previous!==undefined)raf.push(t-previous);previous=t;cpu.push(window.__LiveDance.snapshot().cpuMs);if(t<end)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
  const avg=a=>a.reduce((s,n)=>s+n,0)/a.length;return {fps:1000/avg(raf),frameMs:avg(raf),p95RAF:raf.toSorted((a,b)=>a-b)[Math.floor(raf.length*.95)],cpuMs:avg(cpu),metrics:window.__LiveDance.snapshot()};
 });
 await fs.writeFile('docs/v061/confirmation-720-10.json',JSON.stringify({note:'Single targeted repeat of anomalous 720x1280 / 10 participants WIDE result; original sample retained.',seconds:10,...confirmation},null,2));
 console.log(JSON.stringify({samples:frames.length,crops:crops.length,errors:h.errors}));
}finally{await h.close();}
