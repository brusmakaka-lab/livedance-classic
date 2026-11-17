import {chromium} from '@playwright/test';import path from 'node:path';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {server,event,configure,installAudit} from './polish-harness.mjs';
const project=process.cwd(),out='docs/rowshow-polish',s=await server(project,'polish-check',5604),browser=await chromium.launch({channel:'msedge',headless:true}),p=await browser.newPage({viewport:{width:540,height:960}}),errors=[],cases=[];
p.on('pageerror',e=>errors.push(e.message));let seq=0;
const send=(type,id,extra={})=>p.evaluate(e=>__V05.submit(e),event(++seq,type,id,extra));
const tick=(seconds,audit=true)=>p.evaluate(({seconds,audit})=>{for(let i=0;i<Math.ceil(seconds*30);i++){__V05.reviewFrame(1/30);if(audit)auditPolish(__V05.world.now);}}, {seconds,audit});
async function loaded(n){for(let i=0;i<400;i++){await tick(.05,false);if(await p.evaluate(n=>__V05.inspect().actors.length===n,n))return;await p.waitForTimeout(20);}throw Error('Models did not load '+n);}
async function setup(n=0){await p.evaluate(()=>{__V05.reset();__V05.configure({gpuBudget:60,backgroundNames:'FULL'});});for(let i=0;i<n;i++)await send('COMMENT',i);if(n){await loaded(n);await tick(.3,false);await p.evaluate(n=>{__V05.show.director.clear();__V05.show.director.lastEntrant='viewer-'+(n-1);},n);await tick(1,false);}await installAudit(p);}
async function capture(name){await p.locator('#stage').screenshot({path:out+'/'+name+'.png'});}
async function save(name){const result=await p.evaluate(()=>polishAudit);cases.push({name,frames:result.frames.length,failures:result.failures});await fs.writeFile(out+'/'+name+'-frames.json',JSON.stringify(result,null,2));console.log(name,'frames',result.frames.length,'failures',result.failures.length,result.failures.slice(0,3));}
try{
 await p.goto(s.url);await configure(p);await p.evaluate(()=>__V05.reviewControl(true));await p.waitForTimeout(100);await installAudit(p);
 for(let i=0;i<5;i++){await send('COMMENT',i);await loaded(i+1);await tick(5.2);await capture('CONSECUTIVA-'+(i+1));}await save('five-consecutive');
 await setup(12);
 const timeline=[
 [1.4,'GIFT',0,{}],[2.4,'GIFT',0,{metadata:{tier:'HIGH'}}],[7.433,'COMMENT',12,{}],[11.9,'GIFT',0,{}],[15.4,'FOLLOW',1,{}],[19.9,'COMMENT',13,{}],[21.9,'GIFT',3,{}],[26.4,'GIFT',6,{}],[30.9,'GIFT',0,{}],[34.9,'GIFT',11,{metadata:{tier:'HIGH'}}],[42.467,'COMMENT',14,{}],[42.9,'GIFT',12,{metadata:{tier:'HIGH'}}],[52.4,'GIFT',3,{}]
 ];
 let at=0;for(const [time,type,id,extra] of timeline){await tick(time-at);at=time;await send(type,id,{giftName:'Demo Spark',...extra});if(type==='COMMENT')await loaded(id+1);await tick(.1);at+=.1;if([2.4,19.9,34.9,42.9].includes(time))await capture('CRONOLOGIA-'+String(time).replace('.','-'));}await tick(56-at);await save('reference-timeline');
 // A slow assignment must leave a populated group and keep the incoming presentation pending.
 await setup(5);let release;
 const gate=new Promise(resolve=>release=resolve);await p.route('**/api/skins/assign',async route=>{if(route.request().postDataJSON()?.viewerId==='viewer-5')await gate;await route.continue();});
 await send('COMMENT',5);await tick(2);let state=await p.evaluate(()=>__V05.inspect());assert.equal(state.showDirector.entrances.find(e=>e.id==='viewer-5').state,'pending');assert(!state.visible.includes('viewer-5'));assert.equal(state.showDirector.lastEntrant,'viewer-4');await capture('CARGA-LENTA-ESPERA');release();await loaded(6);await tick(5);await p.unroute('**/api/skins/assign');await save('slow-model');
 // Hold a missing seat, then restore the same logical seat. This injects an invalid state only in the test.
 await setup(5);await send('GIFT',0);await tick(.04,false);await p.evaluate(()=>__V05.show.director.rotation.participants.get('viewer-0').slot=null);await tick(1);assert.notEqual((await p.evaluate(()=>__V05.inspect())).effectiveCue?.id,'viewer-0');await p.evaluate(()=>__V05.show.director.rotation.participants.get('viewer-0').slot=0);await tick(4);await save('missing-seat');
 await setup(19);await send('COMMENT',19);await loaded(20);await tick(2);await capture('FILA-1-PLAZA-20');assert.equal((await p.evaluate(()=>__V05.inspect())).actors.find(a=>a.id==='viewer-19').slot,19);await tick(3);
 await send('COMMENT',20);await loaded(21);await tick(2);await capture('FILA-2-PLAZA-1');state=await p.evaluate(()=>__V05.inspect());assert.equal(state.actors.find(a=>a.id==='viewer-20').slot,20);assert.equal(state.registered.length,21);await tick(3);await save('row-20-to-21');
 await setup(12);await send('GIFT',11,{metadata:{tier:'HIGH'}});await tick(1);const vip=(await p.evaluate(()=>__V05.inspect())).effectiveCue.presentationId;
 await send('COMMENT',12);await loaded(13);await send('COMMENT',13);await loaded(14);await tick(2);state=await p.evaluate(()=>__V05.inspect());assert.equal(state.effectiveCue.presentationId,vip);await capture('VIP-DOS-ENTRADAS');await tick(10);state=await p.evaluate(()=>__V05.inspect());assert(state.showDirector.history.some(e=>e.id==='viewer-12'&&e.kind==='welcome'&&e.state==='finished'));assert(state.showDirector.history.some(e=>e.id==='viewer-13'&&e.kind==='welcome'&&e.state==='finished'));await save('vip-two-arrivals');
 for(const batch of [5,10]){
  await setup(batch===5?21:30);await send('GIFT',0,{giftName:'Rosa'});await tick(.8);
  await p.evaluate(batch=>__V05.configure({gpuBudget:20,retireBatch:batch}),batch);await tick(.7);await capture('RETIRO-'+batch+'-DURANTE');await tick(4);state=await p.evaluate(()=>__V05.inspect());
  assert.equal(state.registered.length,batch===5?21:30);assert.equal(state.showDirector.rotation.slots.length,state.registered.length);assert(state.showDirector.rotation.retired.length>=batch);assert(state.showDirector.rotation.log.some(l=>l.action==='gpu-retire-batch'&&l.reason===String(batch)));
  const donor=state.showDirector.rotation.retired[0],oldSlot=state.showDirector.rotation.participants.find(r=>r.id===donor).slot;await send('GIFT',Number(donor.split('-')[1]),{metadata:{tier:'HIGH'}});
  for(let i=0;i<200;i++){await tick(.05);if((await p.evaluate(()=>__V05.inspect())).effectiveCue?.id===donor)break;await p.waitForTimeout(15);}state=await p.evaluate(()=>__V05.inspect());assert.equal(state.effectiveCue.id,donor);assert.equal(state.actors.find(a=>a.id===donor).slot,oldSlot);await tick(2);await capture('RETIRO-'+batch+'-REGRESO');await save('retirement-'+batch);
 }
 await setup(5);await send('SIMULATED',0,{giftId:'fever-demo'});await tick(2);const fever=(await p.evaluate(()=>__V05.inspect())).effectiveCue;
 await send('GIFT',1,{metadata:{tier:'HIGH'}});await tick(2);await send('COMMENT',5);await loaded(6);await tick(8);state=await p.evaluate(()=>__V05.inspect());assert.equal(state.effectiveCue.presentationId,fever.presentationId);assert.equal(state.effectiveCue.resumes,1);await save('fever-vip-resume');
 for(const size of [{width:365,height:648},{width:1080,height:1920}]){await p.setViewportSize(size);await p.waitForTimeout(120);await setup(5);await send('GIFT',1,{metadata:{tier:'HIGH'}});await tick(4);await capture('VIP-'+size.width);await save('vertical-'+size.width);}
 await fs.writeFile(out+'/browser-results.json',JSON.stringify({status:cases.every(c=>c.failures.length===0)&&errors.length===0?'PASS':'FAIL',scope:'Local deterministic simulation, no LIVE. Continuous frame checks of the exact report event chronology plus explicit regression cases.',cases,errors,darkFixture:s.dark},null,2));
 assert.equal(cases.flatMap(c=>c.failures).length,0,'Visual criteria failed; see per-frame evidence');assert.deepEqual(errors,[]);console.log('Polish continuous browser audit PASS');
}catch(e){await capture('CHECK-FAILURE');await fs.writeFile(out+'/check-failure.json',JSON.stringify({error:String(e),state:await p.evaluate(()=>__V05.inspect()),audit:await p.evaluate(()=>window.polishAudit)},null,2));throw e;}finally{await browser.close();s.close();}
