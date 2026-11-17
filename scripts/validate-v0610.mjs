import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('dance-check'),{page}=h,checks=[],bounds=[];
const advance=s=>page.evaluate(s=>{for(let i=0;i<Math.ceil(s*60);i++)__V05.reviewFrame(1/60);},s);
try{
 await page.evaluate(()=>__V05.configure({idleDance:false,likeDance:false,groupDance:false}));await h.fill(10);await page.evaluate(()=>__V05.reviewControl(true));
 const catalog=(await page.evaluate(()=>__V05.show.catalog)).filter(c=>c.role==="entrance");assert.equal(catalog.length,1);
 for(const size of [{width:365,height:648},{width:720,height:1280}]){
  await page.setViewportSize(size);await page.waitForTimeout(250);
  for(const c of catalog){
   await page.evaluate(c=>{__V05.configure({backgroundDance:c.role==='entrance'?'AUTO':c.id,entranceDance:c.id});__V05.show.events.clear();__V05.show.waiting=[];},c);
   await h.send('FOLLOW','viewer-9');
   const frames=await page.evaluate(seconds=>{const frames=[];for(let i=0;i<Math.ceil(seconds*30);i++){__V05.reviewFrame(1/30);if(i%6===0)frames.push({t:i/30,b:__V05.framing()});}return frames;},Math.max(c.duration+1,8));
   for(const frame of frames)for(const b of frame.b)assert(b.x0>=0&&b.x1<=1&&b.y0>=.205&&b.y1<=.81,JSON.stringify({clip:c.label,size,t:frame.t,b}));
   bounds.push({clip:c.label,size,samples:frames.length});
   if(size.width===365){await h.send('FOLLOW','viewer-9');await advance(1.3);await page.screenshot({path:'docs/v0610/evidence/'+c.id+'.png'});await advance(8);}
  }
 }
 checks.push('Boxing clip: sampled full-body framing at both vertical resolutions, 10 registered/five visible');
 await page.evaluate(()=>{__V05.configure({entranceDance:'MixamoBoxingLoop',backgroundDance:'AUTO',followSeconds:7});__V05.show.events.clear();});
 const event=h.event('FOLLOW','viewer-8');assert((await page.evaluate(e=>__V05.submit(e),event)).accepted);assert.equal((await page.evaluate(e=>__V05.submit(e),event)).reason,'duplicate');await h.send('FOLLOW','viewer-7');await advance(1);
 let state=await page.evaluate(()=>__V05.inspect());assert.equal(state.actors.find(a=>a.id==='viewer-8').dance,'MixamoBoxingLoop');assert.equal(state.event.id,'viewer-8');
 assert(!await page.locator('.integration-banner').innerText().then(s=>s.includes('SIMULATOR')));
 assert.equal(await page.locator('.integration-banner').getAttribute('data-source'),'SIMULATOR');
 await advance(5.8);assert.equal((await page.evaluate(()=>__V05.inspect())).event.id,'viewer-8');await advance(.4);assert.equal((await page.evaluate(()=>__V05.inspect())).event.id,'viewer-7');
 checks.push('Boxing entrance, seven-second queue, duplicate rejection and source retained outside welcome copy');
 await h.send('GIFT','viewer-6',{giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});await advance(.1);assert.equal((await page.evaluate(()=>__V05.inspect())).event.kind,'vip');
 await page.keyboard.press('F8');await advance(.1);state=await page.evaluate(()=>__V05.inspect());assert(state.paused);assert.equal(state.queued,0);assert(!state.entrance.materialize);
 await page.getByRole('button',{name:'Reanudar',exact:true}).click();await advance(8);assert.equal((await page.evaluate(()=>__V05.inspect())).registered.length,10);
 await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await advance(1);assert.equal((await page.evaluate(()=>__V05.inspect())).event.kind,'fever');await advance(23);
 checks.push('VIP interruption, F8 and explicit recovery, Fever retains participants');
 await page.evaluate(()=>{__V05.configure({followSeconds:5,entranceDance:'MixamoRumbaDancingLoop'});__V05.reviewControl(false);});await page.reload();await page.waitForFunction(()=>__V05?.inspect().ready);
 state=await page.evaluate(()=>__V05.inspect());assert.equal(state.config.followSeconds,5);assert.equal(state.config.entranceDance,'MixamoRumbaDancingLoop');
 checks.push('Duration and entrance choice persist');assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile('docs/v0610/validation.json',JSON.stringify({checks,bounds,errors:h.errors},null,2));await h.close();console.log({checks,errors:h.errors});}
