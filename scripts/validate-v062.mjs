import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('led-v062'),{page}=h,checks=[],metrics=[],out='docs/v062/';
try{
 await h.fill(10);assert.equal(await page.evaluate(()=>window.__V05.inspect().leds.follow),undefined);checks.push('Waiting state');
 await h.send('FOLLOW','viewer-0',{username:'Luna'});await h.send('GIFT','viewer-1',{username:'Río',giftName:'Rosa',giftCount:5});
 await page.waitForFunction(()=>window.__V05.inspect().leds.gift?.gift==='Rosa ×5');
 let led=await page.evaluate(()=>window.__V05.inspect().leds);assert.equal(led.follow.source,'SIMULATOR');assert.equal(led.gift.source,'SIMULATOR');checks.push('Simulator Follow/Gift + explicit source');
 await page.waitForTimeout(6500);await page.screenshot({path:out+'evidence/led-simulator-10.png'});
 const accepted=await page.evaluate(()=>window.__V05.submit({sessionId:'tt.fixture',event:{schemaVersion:1,source:'tiktok',eventId:'fixture-real-format',viewerId:'viewer-0',username:'FIXTURE',eventType:'FOLLOW',giftCount:1,timestamp:Date.now(),metadata:{}}}));
 await page.waitForFunction(()=>window.__V05.inspect().leds.follow?.source==='LIVE');checks.push('TikTok-format fixture reaches LED after EventIngress (not a real LIVE)');
 await page.keyboard.press('F8');await page.waitForTimeout(100);let paused=await page.evaluate(()=>({show:window.__V05.inspect(),colors:window.__V05.show.ledWall.materials.map(m=>m.color.r),uploads:window.__V05.show.ledWall.uploads}));
 assert(paused.show.paused);assert(paused.colors.every(x=>x===.18));await h.send('FOLLOW','blocked',{username:'Blocked'});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__V05.show.ledWall.uploads),paused.uploads);
 await page.getByRole('button',{name:'Reanudar',exact:true}).click();await h.send('FOLLOW','viewer-0',{username:'Luna'});await page.waitForFunction(()=>window.__V05.inspect().leds.follow?.name==='Luna');checks.push('F8 dims/freezes LED; blocked events ignored; explicit recovery works');
 await h.send('GIFT','viewer-1',{giftName:'VIP fixture',metadata:{tier:'HIGH'}});await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='vip');assert.equal(await page.evaluate(()=>window.__V05.show.ledWall.materials[0].color.r),.32);checks.push('VIP retains priority and dims LEDs');
 await page.keyboard.press('F8');await page.getByRole('button',{name:'Reanudar',exact:true}).click();await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='fever');assert.equal(await page.evaluate(()=>window.__V05.show.ledWall.materials[0].color.r),.32);checks.push('Fever retains priority');
 await page.keyboard.press('F8');await page.getByRole('button',{name:'Reanudar',exact:true}).click();
 for(const size of [{width:365,height:648},{width:720,height:1280}])for(const n of [10,20]){
  await page.setViewportSize(size);await h.fill(n);
  for(const enabled of [false,true]){
   await page.evaluate(enabled=>window.__V05.configure({ledWall:enabled}),enabled);await page.waitForTimeout(300);
   const row=await page.evaluate(async()=>{let prev;const samples=[],cpu=[];await new Promise(done=>{const end=performance.now()+3000;function tick(t){if(prev)samples.push(t-prev);prev=t;cpu.push(window.__LiveDance.snapshot().cpuMs);if(t<end)requestAnimationFrame(tick);else done();}requestAnimationFrame(tick);});const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;return{fps:1000/mean(samples),p95:samples.toSorted((a,b)=>a-b)[Math.floor(samples.length*.95)],cpu:mean(cpu),snapshot:window.__LiveDance.snapshot()};});
   metrics.push({size,n,enabled,...row});console.log(JSON.stringify({size,n,enabled,fps:row.fps,p95:row.p95}));
  }
 }
 await page.setViewportSize({width:365,height:648});await h.fill(10);await h.send('FOLLOW','viewer-0',{username:'Luna'});await h.send('GIFT','viewer-1',{username:'Río',giftName:'Rosa',giftCount:5});await page.waitForTimeout(6500);
 const uploads=await page.evaluate(()=>window.__V05.show.ledWall.uploads);
 const start=await page.evaluate(()=>window.__LiveDance.capture());const video=await page.evaluate(()=>window.__V05.record(6));const end=await page.evaluate(()=>({capture:window.__LiveDance.capture(),metrics:window.__LiveDance.snapshot(),uploads:window.__V05.show.ledWall.uploads}));
 await fs.writeFile(out+'evidence/LED-SIMULATOR.webm',Buffer.from(video,'base64'));assert(end.capture.frames-start.frames>100);assert.equal(end.uploads,uploads);checks.push('6 s canvas recording advances; no per-frame texture uploads');
 await page.screenshot({path:out+'evidence/led-final-vertical.png'});
 await page.evaluate(()=>window.__V05.configure({ledWall:false}));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__V05.inspect().leds.visible),false);await page.reload();await page.waitForFunction(()=>window.__V05.inspect().ready);assert.equal(await page.evaluate(()=>window.__V05.inspect().config.ledWall),false);checks.push('LED OFF persists');
 await fs.writeFile(out+'results.json',JSON.stringify({checks,metrics,recording:{seconds:6,frameDelta:end.capture.frames-start.frames,metrics:end.metrics},errors:h.errors,note:'Local fixtures and canvas capture, no TikTok Studio/real LIVE validation.'},null,2));assert.deepEqual(h.errors,[]);console.log(JSON.stringify({checks,errors:h.errors}));
}finally{await h.close();}
