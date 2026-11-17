import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('stagealive-phases12',5544),p=h.page,checks=[],metrics=[];
const out='docs/stage-alive';
await fs.mkdir(out,{recursive:true});
const tick=n=>p.evaluate(n=>{for(let i=0;i<n;i++)__V05.reviewFrame(.1);},n);
async function ready(count){for(let i=0;i<40;i++){await tick(5);if(await p.evaluate(n=>__V05.inspect().actors.length===n,count))return;await p.waitForTimeout(60);}throw Error('Actor load timeout '+count);}
const state=()=>p.evaluate(()=>__V05.inspect());
async function labelChecks(){return p.evaluate(()=>{
 const stage=document.querySelector('#stage').getBoundingClientRect();
 const labels=[...document.querySelectorAll('.integration-name:not([hidden])')].map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.viewerId,hero:el.dataset.protagonist==='true',x:r.x-stage.x,y:r.y-stage.y,w:r.width,h:r.height};});
 const hits=[];for(let i=0;i<labels.length;i++)for(const b of labels.slice(i+1)){const a=labels[i];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)hits.push([a.id,b.id]);}
 return {labels,hits};
 });}
try{
 await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({motion:'OFF',backgroundNames:'FULL'});});
 await h.send('VIEWER_JOIN','old',{username:'Cuenta activa'});await ready(1);await tick(60);
 await p.evaluate(()=>{for(let i=0;i<20;i++)__V05.submit({schemaVersion:1,source:'simulator',eventId:'likes-'+i,viewerId:'old',username:'Cuenta activa',eventType:'LIKE_MILESTONE',giftCount:1,timestamp:Date.now(),metadata:{}});});
 await tick(12);assert.equal((await state()).spotlight.started,1);assert.equal((await state()).effectiveCue,undefined);
 await h.send('COMMENT','new',{username:'Nueva persona reconocible'});await ready(2);await tick(8);
 assert.equal((await state()).effectiveCue.id,'new');assert.equal((await state()).effectiveCue.kind,'welcome');
 for(const viewport of [{width:365,height:648},{width:540,height:960},{width:1080,height:1920}]){
   await p.setViewportSize(viewport);await tick(1);
   const sample=await labelChecks();assert(sample.labels.some(l=>l.id==='new'&&l.hero),'Hero name visible');assert.deepEqual(sample.hits,[]);
 }
 await p.setViewportSize({width:540,height:960});await tick(1);
 await p.evaluate(()=>__V05.reviewControl(false));await p.waitForTimeout(120);
 await p.locator('#stage').screenshot({path:out+'/BIENVENIDA.png'});
 await p.evaluate(()=>__V05.reviewControl(true));
 for(let i=0;i<4;i++){await p.evaluate(i=>{__V05.show.actors.get('new').rig.root.rotation.y=i*Math.PI/2;},i);await tick(2);const sample=await labelChecks();assert(sample.labels.some(l=>l.id==='new'&&l.hero));assert.deepEqual(sample.hits,[]);}
 await tick(50);assert.notEqual((await state()).effectiveCue?.id,'new');
 assert(await p.evaluate(()=>__V05.show.actors.get('new').rig.root.position.z<-.5));
 checks.push('Like bursts do not extend focus; first comment produces five-second welcome; name survives rotations, animation and three resolutions; dancer returns behind foreground');
 await p.evaluate(()=>__V05.reset());
 for(let i=0;i<6;i++)await h.send('VIEWER_JOIN','batch-'+i,{username:'Ingreso '+i});
 await ready(6);
 const presented=new Set();for(let i=0;i<330;i++){await tick(1);const s=await state();if(s.effectiveCue?.kind==='welcome')presented.add(s.effectiveCue.id);}
 assert.equal((await state()).spotlight.started,6);assert.equal((await state()).spotlight.completed,6);assert.equal(presented.size,6);
 checks.push('Six simultaneous identified arrivals all receive one bounded welcome, keeping five visible slots');
 await p.evaluate(()=>__V05.reset());
 await h.send('GIFT','vip',{metadata:{tier:'HIGH'},giftName:'VIP fixture',coins:1000});await ready(1);
 await h.send('VIEWER_JOIN','after-vip',{username:'Entrada durante VIP'});await ready(2);
 assert.equal((await state()).effectiveCue.kind,'vip');
 const scores=await p.evaluate(()=>[...__V05.world.spawn.dancers.values()].map(d=>[d.id,d.contributionScore]));
 let vipThenWelcome=false;for(let i=0;i<150;i++){await tick(1);if((await state()).effectiveCue?.id==='after-vip'){vipThenWelcome=true;break;}}
 assert(vipThenWelcome);assert.deepEqual(await p.evaluate(()=>[...__V05.world.spawn.dancers.values()].map(d=>[d.id,d.contributionScore])),scores);
 await p.evaluate(()=>__V05.configure({backgroundNames:'OFF'}));await tick(1);
 const onlyHero=await labelChecks();assert(onlyHero.labels.length===1&&onlyHero.labels[0].hero);
 checks.push('VIP retains initial priority then releases welcome; gift score unchanged; background names can be hidden independently');
 await p.keyboard.press('F8');assert((await state()).paused);assert.equal((await state()).spotlight.active,undefined);
 await p.locator('#emergency-resume').click();await p.evaluate(()=>{__V05.reset();__V05.configure({backgroundNames:'FULL'});});
 let imageRequests=0;
 await p.route('https://p16.tiktokcdn.com/stagealive-*',async route=>{imageRequests++;if(route.request().url().endsWith('bad'))await route.fulfill({status:404,body:''});else await route.fulfill({contentType:'image/png',body:await fs.readFile('public/integration/skins/coral.png')});});
 await h.send('COMMENT','photo',{username:'Foto disponible',avatarUrl:'https://p16.tiktokcdn.com/stagealive-good'});await ready(1);
 assert.equal(imageRequests,0,'Photos are off by default');
 await p.evaluate(()=>__V05.configure({profilePhotos:true}));await tick(10);
 await p.waitForFunction(()=>document.querySelector('[data-viewer-id="photo"] .name-avatar img'));
 const requestsBefore=imageRequests;await tick(15);assert.equal(imageRequests,requestsBefore);
 await h.send('COMMENT','bad-photo',{username:'Fallback',avatarUrl:'https://p16.tiktokcdn.com/stagealive-bad'});await ready(2);await tick(5);
 await p.waitForTimeout(100);assert.equal(await p.locator('[data-viewer-id="bad-photo"] .name-avatar').innerText(),'F');
 await p.evaluate(()=>__V05.configure({profilePhotos:false}));await tick(1);assert.equal(await p.locator('.name-avatar').count(),0);
 checks.push('Optional CDN photos make no requests by default; mocked valid image is cached, missing image falls back to initial, disabling photos removes badges');
 for(const count of [5,8,12]){
   await p.evaluate(()=>__V05.reset());
   for(let i=0;i<count;i++)await h.send('VIEWER_JOIN','perf-'+count+'-'+i);
   await ready(count);
   const result=await p.evaluate(()=>{const samples=[];for(let i=0;i<60;i++){const start=performance.now();__V05.reviewFrame(1/60);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);const s=__V05.inspect();return {registered:s.registered.length,visible:s.actors.filter(a=>a.visible).length,cpuFrameP50Ms:samples[30],cpuFrameP95Ms:samples[57]};});
   await p.evaluate(()=>__V05.reviewControl(false));
   const frameTiming=await p.evaluate(()=>new Promise(resolve=>{const times=[];let last=0;function frame(t){if(last)times.push(t-last);last=t;if(times.length<90){requestAnimationFrame(frame);return;}const samples=times.slice(15).sort((a,b)=>a-b);resolve({rafMedianFps:1000/samples[Math.floor(samples.length/2)],rafP95Ms:samples[Math.floor(samples.length*.95)]});}requestAnimationFrame(frame);}));
   await p.evaluate(()=>__V05.reviewControl(true));
   assert.equal(result.registered,count);assert(result.visible<=6);metrics.push({...result,...frameTiming});
 }
 checks.push('5/8/12 registered participants measured with existing five-slot staging; no phase-4 capacity expansion');
 assert.deepEqual(h.errors,[]);
 await fs.writeFile(out+'/simulator-results.json',JSON.stringify({status:'PASS',scope:'Phases 1 and 2 only; no new real LIVE',checks,metrics,browserErrors:h.errors},null,2));
 console.log(JSON.stringify({status:'PASS',checks,metrics}));
}catch(error){await p.screenshot({path:out+'/FAILURE.png',fullPage:true});await fs.writeFile(out+'/failure.json',JSON.stringify({error:String(error),state:await state(),checks},null,2));throw error;}
finally{await h.close();}
