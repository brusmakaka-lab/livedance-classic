import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('art-checks'),{page}=h,checks=[],cleanup=[],frames=[];page.setDefaultTimeout(30000);
const state=()=>page.evaluate(()=>__V05.inspect());
const advance=seconds=>page.evaluate(seconds=>{for(let i=0;i<seconds*60;i++)__V05.reviewFrame(1/60);},seconds);
const identities=async()=> (await state()).actors.map(a=>[a.id,a.skinId]).sort();
try{
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({featured:10,idleDance:false,likeDance:false,groupDance:false});});
 await h.fill(30);const original=await identities();assert.equal(original.length,30);
 await page.evaluate(()=>__V05.reviewControl(true));
 await page.evaluate(()=>{__V05.world.spawn.dancers.get('viewer-1').contributionScore=137;});
 const scores=await page.evaluate(()=>[...__V05.world.spawn.dancers.values()].map(d=>[d.id,d.contributionScore]));
 for(const artMode of ['BASE','CONCERT'])for(const featured of [10,20,30]){
  await page.evaluate(c=>__V05.configure(c),{artMode,featured});await advance(7);assert.equal((await state()).actors.filter(a=>a.visible).length,featured);assert.deepEqual(await identities(),original);
  if(artMode==='CONCERT')for(let i=0;i<20;i++){await advance(.5);const f=await page.evaluate(()=>__V05.framing());assert.equal(f.length,featured);assert(f.every(p=>p.x0>=0&&p.x1<=1&&p.y0>=0&&p.y1<=1),'full bodies across 10s of clips');}
 }
 assert.deepEqual(await page.evaluate(()=>[...__V05.world.spawn.dancers.values()].map(d=>[d.id,d.contributionScore])),scores);checks.push('Mode/capacity changes retain 30 IDs, skin assignments and contribution scores including seeded nonzero score');
 await page.evaluate(()=>__V05.configure({artMode:'CONCERT',featured:10}));await advance(7);
 for(const age of [.4,3.5,6.5]){
  await h.send('GIFT','viewer-29',{giftId:'galaxy',giftName:'Galaxia · SIMULATOR',username:'Alejandra_NombreLargo_29',metadata:{tier:'HIGH'}});
  await advance(age);const s=await state();assert.equal(s.event?.id,'viewer-29');assert(s.visible.includes('viewer-29'));
  const frame=await page.evaluate(()=>__V05.framing());frames.push({age,frame});const hero=frame.find(f=>f.id==='viewer-29');assert(hero&&hero.x0>=0&&hero.x1<=1&&hero.y0>=0&&hero.y1<=1,'VIP full body');
  await page.keyboard.press('F8');await advance(.5);assert((await state()).paused);assert.equal((await state()).queued,0);const stopped=await state();await advance(2);const later=await state();assert.deepEqual(later.camera,stopped.camera);assert.deepEqual(later.actors,stopped.actors);assert.deepEqual(await identities(),original);
  await page.getByRole('button',{name:'Reanudar',exact:true}).click();await advance(8);assert(!(await state()).paused);assert.equal((await state()).actors.filter(a=>a.visible).length,10);
 }
 checks.push('VIP off-page viewer29; F8 entry/main/exit freezes camera and clips; explicit resume retains 30 identities');
 const e=h.event('FOLLOW','viewer-1');assert((await page.evaluate(e=>__V05.submit(e),e)).accepted);assert.equal((await page.evaluate(e=>__V05.submit(e),e)).reason,'duplicate');await advance(.2);
 await h.send('GIFT','viewer-28',{giftId:'galaxy',giftName:'Galaxia · SIMULATOR'});await advance(.5);await h.send('GIFT','viewer-27',{giftId:'galaxy',giftName:'Galaxia · SIMULATOR'});await advance(.5);assert.equal((await state()).event?.id,'viewer-28');assert((await state()).queued>=1);await advance(8);assert.equal((await state()).event?.id,'viewer-27');await advance(16);assert.equal((await state()).event,undefined);assert.deepEqual(await identities(),original);
 checks.push('Dedup Follow, VIP priority, sequential VIP queue, return and identity retention');
 for(const settings of [{fixed:true},{fixed:false,motion:'OFF'},{motion:'SUAVE'}]){
  await page.evaluate(c=>__V05.configure(c),settings);await advance(7);const initial=(await state()).camera;
  await h.send('GIFT','viewer-29',{giftId:'galaxy'});await advance(3);
  if(settings.fixed||settings.motion==='OFF'){const c=(await state()).camera;assert(c.position.every((v,i)=>Math.abs(v-initial.position[i])<1e-4));}
  await advance(15);
 }
 checks.push('Fixed camera and motion OFF retained during VIP');
 await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await advance(4);assert.equal((await state()).event?.kind,'fever');assert.deepEqual(await identities(),original);await advance(18);checks.push('Existing Fever remains functional; no new Fever design');
 const models=await page.evaluate(()=>[...__V05.show.actors.values()].map(a=>({model:a.skin.model,layers:a.rig.meshes.length,nearest:a.rig.meshes[0].material.map.magFilter,bones:Object.keys(a.rig.bones).length})));assert(models.some(a=>a.model==='classic'));assert(models.some(a=>a.model==='slim'));assert(models.every(a=>a.layers===2&&a.nearest===1003));
 checks.push('Classic/slim use two skin layers and nearest filtering; unchanged rig/clips');
 await page.evaluate(()=>__V05.reviewControl(false));
 for(let i=0;i<3;i++){await h.fill(30);await h.send('GIFT','viewer-29',{giftId:'galaxy'});await page.waitForTimeout(1500);await page.evaluate(()=>__V05.reset());await page.waitForTimeout(1500);cleanup.push(await page.evaluate(()=>({snapshot:__LiveDance.snapshot(),cache:__V05.inspect().cache,materials:[...__V05.show.actors.values()].filter(a=>a.vipMaterials).length})));}
 assert(cleanup.every(c=>c.snapshot.geometries===cleanup[0].snapshot.geometries&&c.snapshot.textures===cleanup[0].snapshot.textures&&c.materials===0));checks.push('Three populate/VIP/reset cycles return to same GPU resource counts; temporary VIP materials disposed');
 await page.evaluate(()=>__V05.configure({artMode:'BASE',featured:20}));await page.reload();await page.waitForFunction(()=>__V05?.inspect().ready);assert.equal((await state()).config.artMode,'BASE');assert.equal((await state()).config.featured,20);checks.push('Base choice and cap20 survive reload');
 assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile('docs/v064/validation.json',JSON.stringify({checks,cleanup,frames,errors:h.errors},null,2));await h.close();console.log(JSON.stringify({checks,errors:h.errors}));}
