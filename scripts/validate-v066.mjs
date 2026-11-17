import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('lineup-check'),{page}=h,checks=[],samples=[],cycles=[];
const advance=s=>page.evaluate(s=>{for(let i=0;i<s*60;i++)__V05.reviewFrame(1/60);},s);
const state=()=>page.evaluate(()=>__V05.inspect());
const identity=async()=> (await state()).actors.map(a=>[a.id,a.skinId]).sort();
try{
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({lineup:true,idleDance:false,likeDance:false,groupDance:false});});
 await h.fill(29);await h.send('FOLLOW','new-viewer',{username:'Valentina'});await page.waitForFunction(()=>__V05.inspect().actors.length===30);
 await page.evaluate(()=>__V05.reviewControl(true));await advance(6);const ids=await identity();
 assert.equal((await state()).visible[0],'new-viewer');assert.equal((await state()).visible.length,5);
 const dup=h.event('FOLLOW','viewer-28');assert((await page.evaluate(e=>__V05.submit(e),dup)).accepted);assert.equal((await page.evaluate(e=>__V05.submit(e),dup)).reason,'duplicate');await advance(6);
 assert.equal((await state()).registered.length,30);assert.deepEqual(await identity(),ids);checks.push('New Follow creates 30th participant; duplicate rejected; five visible, 30 identities retained');
 for(const size of [{width:365,height:648},{width:720,height:1280}]){
  await page.setViewportSize(size);await page.waitForTimeout(250);await advance(1);const camera=(await state()).camera;
  for(const id of ['viewer-27','viewer-26','viewer-25']){
   const before=(await state()).visible;await h.send('FOLLOW',id,{username:id==='viewer-27'?'Nombre muy largo · espectador de prueba':'Ingreso '+id});
   for(let i=0;i<50;i++){
    await advance(.1);const s=await state();assert.deepEqual(s.camera,camera,'Fixed shot must not drift during entry');
    if(i%5===0){const f=await page.evaluate(()=>__V05.framing());samples.push({size,id,age:s.event?.age,frame:f});
     for(const box of f){assert(box.x0>=0&&box.x1<=1&&box.y0>=.205&&box.y1<=.8,JSON.stringify({message:'Full body and compact header',...box,age:s.event?.age}));}
    }
   }
   console.log('arrival framed',size,id);const s=await state();assert.equal(s.visible[0],id);assert.equal(s.actors.filter(a=>a.visible).length,5);if(!before.includes(id))assert(!s.visible.includes(before.at(-1)));assert.deepEqual(await identity(),ids);
  }
 }
 checks.push('Six sequential arrivals: fixed camera, front persists, last exits; full body sampled at both vertical resolutions');
 await h.send('FOLLOW','viewer-24');await advance(1);await h.send('GIFT','viewer-23',{giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});await advance(.1);
 assert.equal((await state()).event?.kind,'vip');assert.equal((await state()).visible[0],'viewer-23');assert.equal((await state()).entrance.effect,false);
 await h.send('FOLLOW','viewer-22');await h.send('FOLLOW','viewer-21');await advance(.1);assert.equal((await state()).queued,2);
 await advance(8);assert.equal((await state()).event?.id,'viewer-22');await advance(4.3);assert.equal((await state()).event?.id,'viewer-21');await advance(6);assert.equal((await state()).visible[0],'viewer-21');assert.deepEqual(await identity(),ids);
 checks.push('VIP priority and correct subject; queued Follow events advance the lineup only when presented');
 await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await advance(2);assert.equal((await state()).event?.kind,'fever');assert.equal((await state()).registered.length,30);await advance(22);
 for(const age of [.3,1.2]){
  await h.send('FOLLOW','viewer-20');await advance(age);await page.keyboard.press('F8');await advance(.1);const stopped=await state();
  assert(stopped.paused);assert.equal(stopped.queued,0);assert.equal(stopped.entrance.effect,false);assert.equal(stopped.lineup.exiting,undefined);
  await advance(2);assert.deepEqual((await state()).camera,stopped.camera);assert.deepEqual((await state()).actors,stopped.actors);
  await page.getByRole('button',{name:'Reanudar',exact:true}).click();await advance(6);assert.deepEqual(await identity(),ids);
 }
 checks.push('Fever retains identities; F8 cancels entrance/exit/queue and freezes camera and clips; resume works');
 await page.evaluate(()=>__V05.configure({lineup:false,featured:10}));await advance(10);assert.equal((await state()).visible.length,10);assert.deepEqual(await identity(),ids);
 await page.evaluate(()=>__V05.configure({lineup:true}));await advance(5);assert.equal((await state()).visible.length,5);assert.deepEqual(await identity(),ids);checks.push('Reversible mode restores normal cast without changing identities');
 await page.evaluate(()=>__V05.reviewControl(false));
 for(let i=0;i<3;i++){await h.fill(10);await h.send('FOLLOW','viewer-9');await page.waitForTimeout(1600);await page.evaluate(()=>__V05.reset());await page.waitForTimeout(600);cycles.push(await page.evaluate(()=>({snapshot:__LiveDance.snapshot(),state:__V05.inspect()})));}
 assert(cycles.every(c=>c.state.actors.length===0&&c.state.lineup.order.length===0&&!c.state.entrance.effect&&c.snapshot.geometries===cycles[0].snapshot.geometries&&c.snapshot.textures===cycles[0].snapshot.textures));checks.push('Three populate/entrance/reset cycles return to equal geometry and texture counts');
 await page.evaluate(()=>__V05.configure({lineup:false}));await page.reload();await page.waitForFunction(()=>__V05?.inspect().ready);assert.equal((await state()).config.lineup,false);checks.push('Mode opt-out survives reload');assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile('docs/v066/validation.json',JSON.stringify({checks,samples,cycles,errors:h.errors},null,2));await h.close();console.log({checks,errors:h.errors});}
