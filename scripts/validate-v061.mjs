import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('v061'), {page}=h, checks=[], metrics=[];
const out='docs/v061/';
try{
 await h.fill(10);
 await page.evaluate(()=>{window.__V05.world.config.inactivity=3600;});
 const before=await page.evaluate(()=>window.__V05.inspect().actors.map(a=>[a.id,a.skinId]));
 const likes=async(id,count)=>page.evaluate(({id,count})=>window.__V05.submit({sessionId:'tt.fixture',event:{schemaVersion:1,source:'tiktok',eventId:id,viewerId:'viewer-0',username:'FIXTURE ONLY',eventType:'LIKE_MILESTONE',giftCount:1,timestamp:Date.now(),metadata:{likeCount:count}}}),{id,count});
 await likes('like-100',100);await likes('like-100',100);
 await page.waitForFunction(()=>window.__V05.inspect().freeDance.revision===1,{},{timeout:25000});
 assert.equal(await page.evaluate(()=>window.__V05.inspect().freeDance.likes),100);checks.push('100 accepted fixture likes → dance change; duplicate ignored');
 await likes('like-500',400);
 await page.waitForFunction(()=>window.__V05.inspect().freeDance.groupLeft>0,{},{timeout:25000});
 const group=await page.evaluate(()=>window.__V05.inspect());assert(group.actors.filter(a=>a.visible).every(a=>a.dance==='MixamoDance2Loop'));checks.push('500 → Excited group, synchronized visible dancers');
 await page.screenshot({path:out+'evidence/fixture-500-group.png'});
 await h.send('GIFT','viewer-9',{giftId:'galaxy',giftName:'FIXTURE VIP',metadata:{tier:'HIGH'}});
 await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='vip');assert.equal(await page.evaluate(()=>window.__V05.inspect().freeDance.groupLeft),0);checks.push('VIP cancels group and focuses viewer-9');
 assert.deepEqual(await page.evaluate(()=>window.__V05.inspect().actors.map(a=>[a.id,a.skinId])),before);
 await page.keyboard.press('F8');let stopped=await page.evaluate(()=>window.__V05.inspect());assert(stopped.paused);assert(!stopped.freeDance.pending);assert.equal(stopped.freeDance.groupLeft,0);
 await page.waitForTimeout(500);assert.deepEqual((await page.evaluate(()=>window.__V05.inspect())).actors.map(a=>[a.dance,a.danceTime]),stopped.actors.map(a=>[a.dance,a.danceTime]));
 await page.getByRole('button',{name:'Reanudar',exact:true}).click();checks.push('F8 freezes mixer, discards automatic cues; explicit resume; skins retained');
 await page.evaluate(()=>window.__V05.configure({idleDance:false,likeDance:false,groupDance:false}));await page.reload();await page.waitForFunction(()=>window.__V05.inspect().ready);assert.equal(await page.evaluate(()=>window.__V05.inspect().config.idleDance),false);checks.push('Three feature toggles persist');
 for(const size of [{width:365,height:648},{width:720,height:1280}]){
  await page.setViewportSize(size);
  for(const n of [1,10,30]){
   await h.fill(n);
   const row=await page.evaluate(async()=>{let prev;const times=[],cpu=[];await new Promise(done=>{const end=performance.now()+5000;const frame=t=>{if(prev)times.push(t-prev);prev=t;cpu.push(window.__LiveDance.snapshot().cpuMs);if(t<end)requestAnimationFrame(frame);else done();};requestAnimationFrame(frame);});const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;return{fps:1000/mean(times),p95:times.toSorted((a,b)=>a-b)[Math.floor(times.length*.95)],cpuMs:mean(cpu),snapshot:window.__LiveDance.snapshot(),heap:performance.memory?.usedJSHeapSize};});
   metrics.push({size,n,...row}); console.log(JSON.stringify({size,n,fps:row.fps,p95:row.p95}));
  }
 }
 await page.setViewportSize({width:300,height:900});await page.waitForTimeout(500);const capture=await page.evaluate(()=>window.__LiveDance.capture());assert(Math.abs(capture.cssSize[0]/capture.cssSize[1]-9/16)<.002);checks.push('Narrow clean capture keeps 9:16');
 await fs.writeFile(out+'free-dance-results.json',JSON.stringify({checks,metrics,capture,errors:h.errors,note:'Local fixtures only. Headless GPU; no TikTok Studio capture.'},null,2));console.log(JSON.stringify({checks,metrics:metrics.map(({size,n,fps,p95,cpuMs})=>({size,n,fps,p95,cpuMs})),errors:h.errors}));assert.equal(h.errors.length,0);
}finally{await h.close();}
