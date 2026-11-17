import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('polish-v063'),{page}=h,metrics=[],checks=[],cleanup=[],out='docs/v063/';
page.setDefaultTimeout(20000);
const snapshot=()=>page.evaluate(()=>window.__LiveDance.snapshot());
try {
 assert.equal(await page.evaluate(()=>window.__V05.inspect().config.featured),10);
 for(const size of [{width:365,height:648},{width:720,height:1280}]) {
  await page.setViewportSize(size);
  for(const n of [1,10,20,30]) {
   await page.evaluate(n=>window.__V05.configure({featured:n<=10?10:n}),n);await h.fill(n);await page.waitForTimeout(1200);
   const measure=await page.evaluate(async()=>{const raf=[],cpu=[];let prev;await new Promise(done=>{const end=performance.now()+5000;function tick(t){if(prev)raf.push(t-prev);prev=t;cpu.push(window.__LiveDance.snapshot().cpuMs);if(t<end)requestAnimationFrame(tick);else done();}requestAnimationFrame(tick);});const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;return{fps:1000/mean(raf),p95:raf.toSorted((a,b)=>a-b)[Math.floor(raf.length*.95)],cpuMs:mean(cpu),snapshot:window.__LiveDance.snapshot(),heap:performance.memory?.usedJSHeapSize};});
   const labels=await page.locator('.integration-name:not([hidden])').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,text:el.textContent};}));
   for(let i=0;i<labels.length;i++)for(const b of labels.slice(i+1)){const a=labels[i];assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'overlapping names');}
   const framing=await page.evaluate(()=>window.__V05.framing());assert.equal(framing.length,n);assert(framing.every(f=>f.x0>=0&&f.x1<=1&&f.y0>=0&&f.y1<=1),'body cropped');
   if(n===1)assert.equal(labels.length,1,'solo name must be visible');
   if(size.width===365)await page.screenshot({path:out+'evidence/FINAL-'+n+'.png'});
   metrics.push({size,n,...measure,labels:labels.length,framing});console.log(JSON.stringify({size,n,fps:measure.fps,p95:measure.p95,labels:labels.length}));
  }
 }
 checks.push('1/10/20/30 full bodies and disjoint visible names at both resolutions; solo name retained');
 const identities=await page.evaluate(()=>window.__V05.inspect().actors.map(a=>[a.id,a.skinId]));
 await page.setViewportSize({width:365,height:648});await page.evaluate(()=>window.__V05.configure({featured:10}));await page.waitForTimeout(5000);
 assert.equal((await page.evaluate(()=>window.__V05.inspect())).registered.length,30);
 await h.send('FOLLOW','viewer-29',{username:'Alejandra_StarDance'});await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='follow');await page.waitForTimeout(1000);await page.screenshot({path:out+'evidence/FINAL-follow.png'});await page.waitForTimeout(2500);
 const record=page.evaluate(()=>window.__V05.record(20));await page.waitForTimeout(1000);
 await h.send('GIFT','viewer-29',{username:'Alejandra_StarDance',giftId:'galaxy',giftName:'Galaxia · SIMULATOR',metadata:{tier:'HIGH'}});await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='vip');
 for(let i=0;i<6;i++){await page.waitForTimeout(900);const f=await page.evaluate(()=>({state:window.__V05.inspect(),frames:window.__V05.framing()}));assert.equal(f.state.event?.id,'viewer-29');assert(f.frames.every(f=>f.x0>=0&&f.x1<=1&&f.y0>=0&&f.y1<=1));if(i===2)await page.screenshot({path:out+'evidence/FINAL-vip.png'});}
 await page.waitForTimeout(2800);await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='fever');await page.waitForTimeout(3500);await page.screenshot({path:out+'evidence/FINAL-fever.png'});
 await fs.writeFile(out+'evidence/SHOW-SIMULATOR.webm',Buffer.from(await record,'base64'));
 assert.deepEqual(await page.evaluate(()=>window.__V05.inspect().actors.map(a=>[a.id,a.skinId])),identities);checks.push('30 identities survive cap10; Follow/VIP focus viewer-29; Fever preserves assignments; vertical video is SIMULATOR');
 await page.keyboard.press('F8');await page.waitForTimeout(100);const stopped=await page.evaluate(()=>({show:window.__V05.inspect(),uploads:window.__V05.show.ledWall.uploads}));await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__V05.show.ledWall.uploads),stopped.uploads);assert(stopped.show.paused);await page.screenshot({path:out+'evidence/FINAL-f8.png'});await page.getByRole('button',{name:'Reanudar',exact:true}).click();checks.push('F8 freezes central visualizer and mixers; explicit recovery');
 for(let i=0;i<3;i++){await h.fill(30);await page.evaluate(()=>window.__V05.reset());await page.waitForTimeout(1500);cleanup.push(await snapshot());}assert(cleanup.every(s=>s.geometries===cleanup[0].geometries&&s.textures===cleanup[0].textures));checks.push('Three populate/reset cycles return to equal geometry/texture counts');
 await page.evaluate(()=>document.body.classList.remove('clean'));await page.setViewportSize({width:1440,height:1000});await page.locator('[data-nav="Dancers"]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.skin-face').length>=3);assert.equal(await page.locator('.skin-face').count(),3);await page.screenshot({path:out+'evidence/library.png'});checks.push('Seed library face previews render without importing or editing any PNG');
 await page.evaluate(()=>window.__V05.configure({ledWall:false,featured:20}));await page.reload();await page.waitForFunction(()=>window.__V05.inspect().ready);assert.equal(await page.evaluate(()=>window.__V05.inspect().config.ledWall),false);assert.equal(await page.evaluate(()=>window.__V05.inspect().config.featured),20);checks.push('Explicit cap20 and LED OFF persist; defaults do not overwrite choices');
 await fs.writeFile(out+'validation.json',JSON.stringify({checks,metrics,cleanup,errors:h.errors,note:'Local fixtures only; no real TikTok/Studio or hours-long soak.'},null,2));assert.deepEqual(h.errors,[]);console.log(JSON.stringify({checks,errors:h.errors}));
} finally {await fs.writeFile(out+'validation.json',JSON.stringify({checks,metrics,cleanup,errors:h.errors,note:'Local fixtures only; inspect completion checks. No real TikTok/Studio or hours-long soak.'},null,2));await h.close();}
