import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('material-check'),{page}=h,checks=[],frames=[],cycles=[];
const advance=s=>page.evaluate(s=>{for(let i=0;i<s*60;i++)__V05.reviewFrame(1/60);},s);
const state=()=>page.evaluate(()=>__V05.inspect());
const identity=async()=> (await state()).actors.map(a=>[a.id,a.skinId]).sort();
try{
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({lineup:true,materialize:true,idleDance:false,likeDance:false,groupDance:false});});await h.fill(30);
 await page.evaluate(()=>__V05.reviewControl(true));const ids=await identity(),camera=(await state()).camera;
 const initialDance=Object.fromEntries((await state()).actors.filter(a=>a.visible).map(a=>[a.id,a.dance]));
 for(const [i,name]of ['Valentina','Mateo','Álex','Nora'].entries())await h.send('FOLLOW','viewer-'+(29-i),{username:name});
 const trace=await page.evaluate(()=>{
  const starts=[],frames=[];let prev;
  for(let f=0;f<1050;f++){
   __V05.reviewFrame(1/60);const s=__V05.show,e=s.events.active;
   if(e&&e!==prev){starts.push({id:e.id,time:f/60,duration:e.duration});prev=e;}
   if(f%15===0)frames.push({time:f/60,event:e?{id:e.id,age:e.age}:null,state:__V05.inspect(),bounds:__V05.framing()});
  }return{starts,frames};
 });
 assert.equal(trace.starts.length,4);for(let i=1;i<4;i++)assert(Math.abs(trace.starts[i].time-trace.starts[i-1].time-3.5)<.04);
 for(const sample of trace.frames){assert.deepEqual(sample.state.camera,camera);for(const box of sample.bounds)assert(box.x0>=0&&box.x1<=1&&box.y0>=.205&&box.y1<=.8,JSON.stringify(box));}
 frames.push(...trace.frames);assert.equal((await state()).event,undefined);assert.equal((await state()).registered.length,30);assert.deepEqual(await identity(),ids);
 checks.push('Four accepted Follow events play in order every 3.5 seconds; no automatic rotation after queue drains; fixed camera and full bodies');
 await page.evaluate(()=>__V05.show.next());await advance(3);for(const a of (await state()).actors.filter(a=>a.visible&&initialDance[a.id]))assert.equal(a.dance,initialDance[a.id]);checks.push('Background clip remains attached to identity when slots change');
 const dup=h.event('FOLLOW','viewer-20');assert((await page.evaluate(e=>__V05.submit(e),dup)).accepted);assert.equal((await page.evaluate(e=>__V05.submit(e),dup)).reason,'duplicate');await advance(.6);
 assert((await state()).entrance.materialize);const subject=(await state()).actors.find(a=>a.id==='viewer-20');assert(subject.scale>0&&subject.scale<1);
 await h.send('GIFT','viewer-19',{giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});await advance(.1);assert.equal((await state()).event?.kind,'vip');assert.equal((await state()).visible[0],'viewer-19');assert.equal((await state()).entrance.materialize,false);await advance(10);checks.push('Duplicate rejected; visible growth; VIP interrupts materialization and focuses correct viewer');
 for(const age of [.6,1.2]){await h.send('FOLLOW','viewer-18');await advance(age);await page.keyboard.press('F8');await advance(.1);const s=await state();assert(s.paused);assert(!s.entrance.materialize&&!s.entrance.effect);assert.equal(s.queued,0);await advance(1);assert.deepEqual((await state()).actors,s.actors);await page.getByRole('button',{name:'Reanudar',exact:true}).click();await advance(5);assert((await state()).actors.filter(a=>a.visible).every(a=>a.scale===1&&a.opacity===1));assert.deepEqual(await identity(),ids);}
 checks.push('F8 clears effects and queue during growth/glow; animation freezes; resume restores size and opacity');
 await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await advance(2);assert.equal((await state()).event?.kind,'fever');await advance(22);assert.deepEqual(await identity(),ids);checks.push('Fever and recovery retain all identities');
 await page.setViewportSize({width:720,height:1280});await page.waitForTimeout(250);await advance(1);await h.send('FOLLOW','viewer-17');
 const big=await page.evaluate(()=>{const out=[];for(let i=0;i<240;i++){__V05.reviewFrame(1/60);if(i%10===0)out.push(__V05.framing());}return out;});for(const shot of big)for(const box of shot)assert(box.x0>=0&&box.x1<=1&&box.y0>=.205&&box.y1<=.8);checks.push('Full-body framing also sampled at 720×1280');
 await page.evaluate(()=>__V05.configure({motion:'OFF'}));await h.send('FOLLOW','viewer-16');await advance(.6);assert.equal((await state()).actors.find(a=>a.id==='viewer-16').scale,1);await advance(5);checks.push('Reduced motion avoids growing/shrinking the avatar');
 await page.evaluate(()=>__V05.reviewControl(false));for(let i=0;i<3;i++){await h.fill(10);await h.send('FOLLOW','viewer-9');await page.waitForTimeout(1000);await page.evaluate(()=>__V05.reset());await page.waitForTimeout(400);cycles.push(await page.evaluate(()=>({snapshot:__LiveDance.snapshot(),state:__V05.inspect()})));}
 assert(cycles.every(c=>!c.state.actors.length&&!c.state.entrance.materialize&&c.snapshot.geometries===cycles[0].snapshot.geometries&&c.snapshot.textures===cycles[0].snapshot.textures));checks.push('Three reset cycles return to equal geometry/texture counts');
 await page.evaluate(()=>__V05.configure({materialize:false}));await page.reload();await page.waitForFunction(()=>__V05?.inspect().ready);assert.equal((await state()).config.materialize,false);checks.push('Opt-out persists');assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile('docs/v067/validation.json',JSON.stringify({checks,frames,cycles,errors:h.errors},null,2));await h.close();console.log({checks,errors:h.errors});}
