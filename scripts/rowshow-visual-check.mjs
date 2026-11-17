import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('rowshow-visual',5596,true),p=h.page,out='docs/rowshow',cases=[];
const tick=s=>p.evaluate(s=>{for(let i=0;i<s*20;i++)__V05.reviewFrame(.05);},s);
try{
 await p.setViewportSize({width:540,height:960});await p.waitForTimeout(120);await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({segmentSize:3,gpuBudget:60});});
 const png=await fs.readFile('public/integration/skins/coral.png');await p.route('https://p16.tiktokcdn.com/rowshow-fixture.png',r=>r.fulfill({contentType:'image/png',body:png}));
 for(let i=0;i<60;i++)await h.send('COMMENT','viewer-'+i,{username:'Participante '+i,avatarUrl:'https://p16.tiktokcdn.com/rowshow-fixture.png'});
 for(let i=0;i<200;i++){await tick(.05);if((await p.evaluate(()=>__V05.inspect().actors.length))===60)break;await p.waitForTimeout(30);}await tick(8);assert.equal(await p.evaluate(()=>__V05.inspect().registered.length),60);
 await p.waitForTimeout(100);assert(await p.evaluate(()=>document.querySelectorAll('.name-avatar img').length>0));
 for(const size of [{width:365,height:648},{width:540,height:960},{width:1080,height:1920}]){
  await p.setViewportSize(size);await p.waitForTimeout(120);
  for(const segment of [3,5,20]){
   await p.evaluate(segment=>__V05.configure({segmentSize:segment}),segment);await tick(8);
   const framing=await p.evaluate(()=>({bounds:__V05.framing(),labels:__V05.inspect().labels.filter(l=>l.visible).map(l=>{const a=__V05.show.actors.get(l.id),r=a.label.getBoundingClientRect();return {id:l.id,width:r.width,height:r.height,font:getComputedStyle(a.label).fontSize};})}));
   const heights=framing.bounds.map(b=>(b.y1-b.y0)*size.height),summary={viewport:size,segment,actualDancerHeightsPx:heights,labels:framing.labels};cases.push(summary);
   if(segment===3){assert(heights.every(n=>n>45));assert(framing.labels.every(l=>parseFloat(l.font)>=9));}
   if(size.width===540)await p.locator('#stage').screenshot({path:out+'/ENCUADRE-'+segment+'-540.png'});
  }
 }
 await p.setViewportSize({width:540,height:960});await p.waitForTimeout(120);await p.evaluate(()=>__V05.configure({segmentSize:3}));await tick(8);
 await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await tick(1);
 await h.send('GIFT','viewer-58',{username:'Participante 58',giftName:'VIP',metadata:{tier:'HIGH'},coins:1000});await tick(1);
 await h.send('COMMENT','viewer-60',{username:'Nueva persona',avatarUrl:'https://p16.tiktokcdn.com/rowshow-fixture.png'});
 for(let i=0;i<100;i++){await tick(.05);if(await p.evaluate(()=>__V05.inspect().arrivalInset==='viewer-60'))break;await p.waitForTimeout(20);}
 const s=await p.evaluate(()=>__V05.inspect());assert.equal(s.arrivalInset,'viewer-60');assert.equal(s.effectiveCue.id,'viewer-58');assert.equal(s.vipBinding.id,'viewer-58');assert(s.actors.filter(a=>['viewer-57','viewer-58','viewer-59'].includes(a.id)).every(a=>a.dance==='MixamoDance2Loop'));
 await p.locator('#stage').screenshot({path:out+'/VIP-ENTRADA-SIMULTANEA.png'});
 // Count actual renders and FPS including the secondary entrance camera.
 await p.evaluate(()=>__V05.reviewControl(false));const perf=await p.evaluate(()=>new Promise(resolve=>{let last=performance.now(),start=last;const times=[];const r=__V04.debug.scene.renderer,frame=r.info.render.frame;function step(t){times.push(t-last);last=t;if(t-start<2200)requestAnimationFrame(step);else{times.sort((a,b)=>a-b);resolve({medianFps:1000/times[Math.floor(times.length/2)],p95FrameMs:times[Math.floor(times.length*.95)],renderedFrames:r.info.render.frame-frame});}}requestAnimationFrame(step);}));cases.push({name:'VIP plus simultaneous arrival inset',performance:perf,owner:s.effectiveCue.id,arrival:s.arrivalInset});
 assert.deepEqual(h.errors,[]);await fs.writeFile(out+'/visual-results.json',JSON.stringify({status:'PASS',scope:'Local browser; avatar image intercepted with a local PNG fixture, no external account/image validation. Actual skinned-mesh pixel bounds.',cases,errors:h.errors},null,2));console.log('Visual checks PASS',JSON.stringify(perf));
}catch(e){await p.screenshot({path:out+'/VISUAL-FAILURE.png'});throw e;}finally{await h.close();}
