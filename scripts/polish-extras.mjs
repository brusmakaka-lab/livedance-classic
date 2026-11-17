import {chromium} from '@playwright/test';import path from 'node:path';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {server,event,configure,installAudit} from './polish-harness.mjs';
const project=process.cwd(),out='docs/rowshow-polish',s=await server(project,'polish-extras',5607),browser=await chromium.launch({channel:'msedge',headless:true}),p=await browser.newPage({viewport:{width:540,height:960}}),errors=[],measurements=[];let seq=0;
p.on('pageerror',e=>errors.push(e.message));const send=(type,id,extra={})=>p.evaluate(e=>__V05.submit(e),event(++seq,type,id,extra));
const tick=seconds=>p.evaluate(seconds=>{for(let i=0;i<seconds*30;i++)__V05.reviewFrame(1/30);},seconds);
async function waitLoaded(n){for(let i=0;i<250;i++){await tick(.04);if(await p.evaluate(n=>__V05.inspect().actors.length===n,n))return;await p.waitForTimeout(20);}throw Error('Model readiness timeout');}
async function reset(n){await p.evaluate(()=>{__V05.reset();__V05.configure({gpuBudget:60,backgroundNames:'FULL'});});for(let i=0;i<n;i++)await send('COMMENT',i);await waitLoaded(n);await tick(.4);await p.evaluate(n=>{__V05.show.director.clear();__V05.show.director.lastEntrant='viewer-'+(n-1);},n);await tick(1);}
async function fps(){await p.evaluate(()=>__V05.reviewControl(false));const result=await p.evaluate(()=>new Promise(resolve=>{let start=performance.now(),last=start;const samples=[],renderer=__V04.debug.scene.renderer,frame=renderer.info.render.frame;function sample(now){samples.push(now-last);last=now;if(now-start<4000)requestAnimationFrame(sample);else{const list=samples.slice(10).sort((a,b)=>a-b);resolve({medianFps:1000/list[Math.floor(list.length*.5)],p95Ms:list[Math.floor(list.length*.95)],samples:list.length,renderPasses:renderer.info.render.frame-frame,loaded:__V05.inspect().actors.length,drawn:__V05.inspect().actors.filter(a=>a.visible).length,canvas:[renderer.domElement.width,renderer.domElement.height]});}}requestAnimationFrame(sample);}));await p.evaluate(()=>__V05.reviewControl(true));return result;}
try{
 await p.goto(s.url);await configure(p);await p.evaluate(()=>__V05.reviewControl(true));await p.waitForTimeout(120);
 for(const size of [{width:540,height:960},{width:1080,height:1920}]){
  await p.setViewportSize(size);await p.waitForTimeout(120);await reset(5);
  await send('GIFT',1,{metadata:{tier:'HIGH'},giftName:'VIP'});await tick(2);
  const samples=await p.evaluate(()=>{
   const s=__V05.show,c=__V04.debug.scene.camera,r=s.container.getBoundingClientRect(),result=[];
   for(let i=0;i<120;i++){
    __V05.reviewFrame(1/30);
    for(const [id,a]of s.actors){if(a.label.hidden)continue;const h=s.screenBounds(id,c,true),b=s.screenBounds(id,c),box=a.label.getBoundingClientRect();if(h&&b)result.push({id,headGapPx:h.y0*r.height-(box.bottom-r.top),bodyHeightFraction:b.y1-b.y0,ownName:a.label.dataset.viewerId===id,bounds:b});}
   }return result;
  });
  const hero=samples.filter(r=>r.id==='viewer-1'),gaps=samples.map(r=>r.headGapPx),sorted=[...gaps].sort((a,b)=>a-b);
  measurements.push({case:'names-vip-'+size.width,viewport:size,samples:samples.length,headGapP50:sorted[Math.floor(sorted.length*.5)],headGapP95:sorted[Math.floor(sorted.length*.95)],headGapMin:Math.min(...gaps),headGapMax:Math.max(...gaps),vipBodyHeightMin:Math.min(...hero.map(r=>r.bodyHeightFraction)),vipBodyHeightMax:Math.max(...hero.map(r=>r.bodyHeightFraction)),allNamesOwned:samples.every(r=>r.ownName)});
  assert(samples.every(r=>r.ownName));assert(Math.min(...hero.map(r=>r.bodyHeightFraction))>.25);
  for(const mode of ['FULL','COMPACT','OFF']){await p.evaluate(mode=>__V05.configure({backgroundNames:mode}),mode);await tick(.2);const state=await p.evaluate(()=>__V05.inspect());assert(!await p.evaluate(()=>__V05.show.banner.hidden));if(mode==='OFF')assert.equal(state.labels.filter(l=>l.visible).length,1);}
 }
 await p.setViewportSize({width:540,height:960});await p.waitForTimeout(120);await reset(15);
 const sharedCheck=await p.evaluate(()=>{const s=__V05.show,a=s.actors.get('viewer-14'),shared=s.cache.entries.get(a.skin.hash).materials;return shared.map(m=>({color:m.color.toArray(),opacity:m.opacity}));});
 await send('GIFT',11,{giftName:'VIP',metadata:{tier:'HIGH'}});await tick(1);
 // Re-present the same dark model using a normal Follow while a separate entrance is staged for the inset.
 await send('COMMENT',15);await waitLoaded(16);
 // The existing dark fixture is sent as a fresh ID with the same assigned skin through an isolated store binding.
 await p.evaluate(()=>{const d=__V05.show.director,r=d.rotation.participants.get('viewer-14');d.entrances.set('viewer-14',{presentationId:'dark-probe',eventId:'dark-probe',viewerId:'viewer-14',originalEventType:'COMMENT',id:'viewer-14',name:'nico.groove',gift:'',kind:'welcome',age:0,duration:4.2,priority:1,state:'pending',sequence:0,createdAt:d.time,expiresAt:Infinity,activations:0,resumes:0,suspended:false});});
 await tick(1);await p.locator('#stage').screenshot({path:out+'/DARK-INSET.png'});
 const restored=await p.evaluate(()=>{const s=__V05.show,a=s.actors.get('viewer-14'),shared=s.cache.entries.get(a.skin.hash).materials;return {shared:shared.map(m=>({color:m.color.toArray(),opacity:m.opacity})),temporary:a.insetMaterials?.map(m=>m.color.toArray()),current:a.rig.meshes.map(m=>m.material.color.toArray())};});
 assert.deepEqual(restored.shared,sharedCheck);assert(restored.temporary?.every(c=>c.every(v=>Math.abs(v-1)<1e-8)));measurements.push({case:'dark-inset-material-isolation',sharedUnchanged:true,insetUnattenuated:true,darkSkin:s.dark});
 // Prove the skin preview still draws a body and creates no registered participant.
 await p.evaluate(()=>{__V05.show.director.clear();});await tick(.5);const count=await p.evaluate(()=>__V05.inspect().registered.length);
 await p.evaluate(async()=>__V05.show.preview(__V05.show.client.state.records[0].id));await tick(1);assert(await p.evaluate(()=>__V05.show.actors.get('__preview__').rig.root.visible));assert.equal((await p.evaluate(()=>__V05.inspect())).registered.length,count);await p.locator('#stage').screenshot({path:out+'/SKIN-PREVIEW.png'});await p.evaluate(()=>__V05.show.preview());
 for(const size of [{width:540,height:960},{width:1080,height:1920}]){await p.setViewportSize(size);await p.waitForTimeout(120);for(const n of [5,20,21]){await reset(n);measurements.push({case:'fps-group',viewport:size,participants:n,...await fps()});}}
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/extras-results.json',JSON.stringify({status:'PASS',scope:'Local simulation. Names measured from the skinned head, shader materials checked per view; performance measured without concurrent recording. No LIVE.',measurements,errors},null,2));console.log('Extras PASS',JSON.stringify(measurements));
}finally{await browser.close();s.close();}
