import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/rowshow';await fs.mkdir(out,{recursive:true});
const h=await harness('rowshow',5592,true),p=h.page,cases=[];
const state=()=>p.evaluate(()=>__V05.inspect());
const tick=seconds=>p.evaluate(seconds=>{for(let i=0;i<Math.ceil(seconds*20);i++)__V05.reviewFrame(.05);},seconds);
const send=(type,id,extra={})=>h.send(type,'viewer-'+id,{username:id%3?'Nombre repetido':'Participante '+id,...extra});
async function settle(n){for(let i=0;i<300;i++){await tick(.05);if((await state()).actors.length===n)return;await p.waitForTimeout(25);}throw Error('Model loading timeout '+n);}
async function capture(name){await p.locator('#stage').screenshot({path:out+'/'+name+'.png'});}
async function fps(){await p.evaluate(()=>__V05.reviewControl(false));const result=await p.evaluate(()=>new Promise(resolve=>{const renderer=__V04.debug.scene.renderer,startFrame=renderer.info.render.frame;const intervals=[];let last=performance.now(),start=last;function frame(t){intervals.push(t-last);last=t;if(t-start<4000)requestAnimationFrame(frame);else{const sorted=intervals.slice(10).sort((a,b)=>a-b);const gl=__V04.debug.scene.renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');resolve({samples:sorted.length,medianFps:1000/sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),drawCalls:renderer.info.render.calls,renderedFrames:renderer.info.render.frame-startFrame,canvas:[renderer.domElement.width,renderer.domElement.height],quality:__V04.debug.scene.quality,loaded:__V05.inspect().actors.length,drawn:__V05.inspect().actors.filter(a=>a.visible).length});}}requestAnimationFrame(frame);}));await p.evaluate(()=>__V05.reviewControl(true));return result;}
try{
 await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({gpuBudget:60,retireBatch:5,segmentSize:3,backgroundNames:'FULL',profilePhotos:true});});
 for(const size of [{width:540,height:960},{width:1080,height:1920}]){
  await p.setViewportSize(size);
  await p.evaluate(()=>{__V05.reset();__V05.world.config.afk=true;__V05.world.config.inactivity=10;});
  for(let i=0;i<60;i++){
    const e=h.event('COMMENT','viewer-'+i,{username:i%3?'Nombre repetido':'Participante '+i});
    const accepted=await p.evaluate(e=>[__V05.submit(e),__V05.submit(e)],e);assert(accepted[0].accepted);assert.equal(accepted[1].reason,'duplicate');
    await tick(.05);await settle(i+1);const s=await state();assert.equal(s.actors.find(a=>a.id==='viewer-'+i).slot,i);assert.equal(s.registered.length,i+1);
    if([19,39,59].includes(i)){
      await tick(7);const settled=await state();assert.equal(settled.showDirector.shot,'WIDE');assert.equal(settled.actors.length,i+1);assert.equal(settled.showDirector.rotation.participants.length,i+1);
      assert(settled.actors.every(a=>a.position[1]===0&&a.scale===1));
      await capture(`ENTRADAS-${i+1}-${size.width}`);
      const frames=await fps();assert(frames.renderedFrames>50);const framing=await p.evaluate(()=>{const s=__V05.show,c=__V04.debug.scene.camera,w=s.container.clientWidth,h=s.container.clientHeight;return s.director.viewIds(s.cast.visible).map(id=>{const a=s.actors.get(id);const root=a.rig.root.position.clone().project(c);const head=a.rig.root.position.clone();head.y+=3;head.project(c);const label=a.label.getBoundingClientRect();return {id,bodyHeightPx:Math.abs(root.y-head.y)*h/2,rootX:(root.x+1)*w/2,labelVisible:!a.label.hidden,labelWidth:label.width,fontSize:getComputedStyle(a.label).fontSize};});});
      assert(framing.length>0);assert(framing.every(x=>x.bodyHeightPx>25));assert(framing.some(x=>x.labelVisible));
      cases.push({entries:i+1,viewport:size,registered:settled.registered.length,actors:settled.actors.length,slots:settled.showDirector.rotation.slots,frames,framing});console.log('PASS entries',i+1,size.width,JSON.stringify(frames));
    }
  }
 }
 // Compare full-row framing against the segmented default at identical viewport.
 await p.setViewportSize({width:540,height:960});await p.evaluate(()=>__V05.configure({segmentSize:20}));await tick(7);await capture('FILA-COMPLETA-20-540');
 await p.evaluate(()=>__V05.configure({segmentSize:3}));await tick(7);await capture('SEGMENTO-3-540');
 await send('GIFT',59,{giftId:'rose',giftName:'Rosa',coins:1});await tick(.5);let s=await state();assert.equal(s.effectiveCue.kind,'gift');assert.equal(s.actors.find(a=>a.id==='viewer-59').dance,'MixamoDance2Loop');await capture('ROSA');await tick(3);assert.equal((await state()).showDirector.shot,'WIDE');
 await send('SIMULATED',0,{giftId:'fever-demo'});await tick(1);const fever=(await state()).effectiveCue;
 await send('GIFT',58,{giftName:'VIP',metadata:{tier:'HIGH'},coins:1000});await tick(1);s=await state();const vip=s.effectiveCue;assert.equal(vip.kind,'vip');assert.equal(s.vipBinding.id,'viewer-58');
 await send('COMMENT',60);await settle(61);await tick(.5);s=await state();assert.equal(s.effectiveCue.presentationId,vip.presentationId);assert(s.showDirector.entrances.some(p=>p.id==='viewer-60'&&p.state==='active'));assert(s.actors.find(a=>a.id==='viewer-60').visible);await capture('VIP-ENTRADA-SIMULTANEA');
 await tick(8);s=await state();assert.equal(s.effectiveCue.presentationId,fever.presentationId);assert.equal(s.effectiveCue.resumes,1);await tick(16);

 for(const batch of [5,10]){
  const beforeTrim=await state(),scores=beforeTrim.stats,expected=beforeTrim.registered.length;
  await p.evaluate(batch=>__V05.configure({gpuBudget:20,retireBatch:batch}),batch);await tick(25);s=await state();
  assert(s.actors.length<=20);assert.equal(s.registered.length,expected);assert.equal(s.showDirector.rotation.slots.length,expected);for(const old of scores)assert.equal(s.stats.find(x=>x.id===old.id).score,old.score);
  assert(s.showDirector.rotation.log.some(x=>x.action==='gpu-retire-batch'&&x.reason===String(batch)));
  cases.push({name:'GPU batch '+batch,loaded:s.actors.length,registered:s.registered.length,retired:s.showDirector.rotation.retired});
  // Restore retired donor and verify original seat and skin assignment.
  await send('GIFT',0,{giftName:'VIP de regreso',metadata:{tier:'HIGH'},coins:1000});
  for(let i=0;i<160;i++){await tick(.05);if((await state()).effectiveCue?.id==='viewer-0')break;await p.waitForTimeout(20);}
  s=await state();assert.equal(s.effectiveCue.id,'viewer-0');assert.equal(s.actors.find(a=>a.id==='viewer-0').slot,0);await tick(10);
  if(batch===5){await p.evaluate(()=>{__V05.reset();__V05.configure({gpuBudget:60});});for(let i=0;i<40;i++)await send('COMMENT',i);await settle(40);await tick(7);}
 }
 // Real-time 60-entry burst: no five-second queue per person, complete identity registry.
 await p.evaluate(()=>{__V05.reset();__V05.configure({gpuBudget:60});__V05.reviewControl(false);});
 const events=Array.from({length:60},(_,i)=>h.event('COMMENT','viewer-'+i));await p.evaluate(events=>events.forEach(e=>__V05.submit(e)),events);await p.waitForFunction(()=>__V05.inspect().actors.length===60,{}, {timeout:40000});
 await p.waitForTimeout(5000);s=await state();assert.equal(s.registered.length,60);assert.equal(s.showDirector.history.filter(x=>x.kind==='welcome'&&x.state==='finished').length,60);cases.push({name:'Burst 60',registered:60,finishedEntrances:60});
 await p.keyboard.press('F8');assert((await state()).paused);await p.getByRole('button',{name:'Reanudar',exact:true}).click();assert(!(await state()).paused);
 assert.deepEqual(h.errors,[]);await fs.writeFile(out+'/simulator-results.json',JSON.stringify({status:'PASS',scope:'Local simulator; no LIVE. Incoming events are COMMENT fixtures, never inferred Join.',cases,errors:h.errors},null,2));console.log('RowShow browser PASS');
}catch(e){await fs.writeFile(out+'/failure.json',JSON.stringify({error:String(e),state:await state(),cases},null,2));await capture('FAILURE');throw e;}finally{await h.close();}
