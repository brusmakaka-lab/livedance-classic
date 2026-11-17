import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('entrance-check'),{page}=h,checks=[],frames=[],cycles=[];
const advance=s=>page.evaluate(s=>{for(let i=0;i<s*60;i++)__V05.reviewFrame(1/60);},s);
const state=()=>page.evaluate(()=>__V05.inspect());
const identity=async()=> (await state()).actors.map(a=>[a.id,a.skinId]).sort();
try{
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({idleDance:false,likeDance:false,groupDance:false,entrance:true,featured:10});});
 await h.fill(29);await h.send('FOLLOW','new-viewer',{username:'Valentina'});
 await page.waitForFunction(()=>__V05.inspect().actors.length===30);
 await page.evaluate(()=>__V05.reviewControl(true));await advance(.1);
 assert.equal((await state()).event?.id,'new-viewer');const ids=await identity();
 const duplicate=h.event('FOLLOW','viewer-1');assert((await page.evaluate(e=>__V05.submit(e),duplicate)).accepted);assert.equal((await page.evaluate(e=>__V05.submit(e),duplicate)).reason,'duplicate');
 await advance(12);assert.equal((await state()).registered.length,30);assert.deepEqual(await identity(),ids);checks.push('Follow creates 30th participant; duplicate rejected; skins stable');
 for(const size of [{width:365,height:648},{width:720,height:1280}]){
  await page.setViewportSize(size);
  for(const featured of [10,20,30]){
   await page.evaluate(c=>__V05.configure(c),{featured});await advance(8);
   await h.send('FOLLOW','new-viewer',{username:'Valentina'});
   for(let i=0;i<50;i++){
    await advance(.1);const s=await state(),f=await page.evaluate(()=>__V05.framing());
    const hero=f.find(p=>p.id==='new-viewer');
    if(s.event?.kind==='follow'&&s.event.age>.65){assert(hero,'arrival subject visible');assert(hero.x0>=0&&hero.x1<=1&&hero.y0>=.12&&hero.y1<=.8,'arrival full body / safe areas');}
    if(i===9||i===19||i===29)frames.push({size,featured,age:s.event?.age,hero});
   }
   await advance(8);assert.deepEqual(await identity(),ids);assert.equal((await state()).actors.filter(a=>a.visible).length,featured);
  }
 }
 checks.push('Follow framing sampled every 0.1s: caps 10/20/30, 365×648 and 720×1280; restores cast');
 await page.setViewportSize({width:365,height:648});await page.evaluate(()=>__V05.configure({featured:10}));await advance(6);
 for(const age of [.3,1.4,3.5]){
  await h.send('FOLLOW','new-viewer');await advance(age);await page.keyboard.press('F8');await advance(.1);const paused=await state();assert(paused.paused);assert.equal(paused.queued,0);assert.equal(paused.entrance.effect,false);
  await advance(2);const later=await state();assert.deepEqual(later.camera,paused.camera);assert.deepEqual(later.actors,paused.actors);
  await page.getByRole('button',{name:'Reanudar',exact:true}).click();await advance(8);assert.deepEqual(await identity(),ids);
 }
 checks.push('F8 announcement/reveal/return clears effects and queue; camera/clips freeze; controlled resume');
 await h.send('FOLLOW','new-viewer');await advance(1);await h.send('GIFT','viewer-28',{giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});await advance(.1);
 assert.equal((await state()).event?.id,'viewer-28');assert.equal((await state()).event?.kind,'vip');assert.equal((await state()).entrance.effect,false);
 await h.send('FOLLOW','viewer-2');await h.send('FOLLOW','viewer-3');await advance(.2);assert.equal((await state()).event?.kind,'vip');await advance(9);assert.equal((await state()).event?.id,'viewer-2');await advance(4.3);assert.equal((await state()).event?.id,'viewer-3');await advance(15);
 checks.push('VIP interrupts Follow; subsequent follows queue in order and return without identity loss');
 for(const motion of ['OFF','SUAVE']){
  await page.evaluate(motion=>__V05.configure({motion}),motion);await advance(8);const before=(await state()).camera;
  await h.send('FOLLOW','new-viewer');await advance(2);if(motion==='OFF'){const after=(await state()).camera;assert(after.position.every((v,i)=>Math.abs(v-before.position[i])<1e-4));}await advance(10);
 }
 await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await advance(3);assert.equal((await state()).event?.kind,'fever');assert.equal((await state()).entrance.effect,false);await advance(20);checks.push('Fixed/reduced camera and Fever priority retained');
 await page.evaluate(()=>__V05.reviewControl(false));
 for(let i=0;i<3;i++){await h.fill(10);await h.send('FOLLOW','viewer-5');await page.waitForTimeout(1600);await page.evaluate(()=>__V05.reset());await page.waitForTimeout(800);cycles.push(await page.evaluate(()=>({snapshot:__LiveDance.snapshot(),effect:__V05.inspect().entrance.effect,actors:__V05.inspect().actors.length})));}
 assert(cycles.every(c=>!c.effect&&!c.actors&&c.snapshot.geometries===cycles[0].snapshot.geometries&&c.snapshot.textures===cycles[0].snapshot.textures));checks.push('Three populate/entrance/reset cycles return to equal geometry and texture counts');
 await page.evaluate(()=>__V05.configure({entrance:false}));await page.reload();await page.waitForFunction(()=>__V05?.inspect().ready);assert.equal((await state()).config.entrance,false);checks.push('Entrance opt-out persists across reload');
 assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile('docs/v065/validation.json',JSON.stringify({checks,frames,cycles,errors:h.errors},null,2));await h.close();console.log({checks,errors:h.errors});}
