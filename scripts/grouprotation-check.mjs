import {harness} from './v05-harness.mjs';import {installRotationAudit} from './grouprotation-audit.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('grouprotation-check',5582,true),p=h.page,out='docs/grouprotation',cases=[];
const state=()=>p.evaluate(()=>__V05.inspect());
async function tick(seconds){await p.evaluate(seconds=>{for(let i=0;i<Math.ceil(seconds*20);i++){__V05.reviewFrame(.05);checkDirector(.05);}},seconds);}
const send=(type,id,extra={})=>h.send(type,'viewer-'+id,{username:id%2?'Nombre repetido':'Participante '+id,...extra});
async function ready(n){for(let i=0;i<180;i++){await tick(.1);if((await state()).actors.length===n)return;await p.waitForTimeout(30);}throw Error('Models not ready '+n);}
async function reset(){await p.evaluate(()=>{__V05.reset();__V05.reviewControl(true);__V05.world.config.afk=false;});await installRotationAudit(p);}
async function capture(name){await p.evaluate(()=>{__V05.reviewControl(false);document.querySelector('#toast').hidden=true;});await p.waitForTimeout(50);await p.locator('#stage').screenshot({path:out+'/'+name+'.png'});await p.evaluate(()=>{__V05.reviewControl(true);sdAudit.previous=null;});}
async function saveCase(name){const s=await state(),audit=await p.evaluate(()=>{const a={...sdAudit};delete a.previous;return a;});assert.deepEqual(audit.failures,[]);cases.push({name,audit,director:s.showDirector});}
try{
 await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({backgroundNames:'FULL',visibleCapacity:5,motion:'SUAVE'});});await installRotationAudit(p);
 const occupancy=[];
 for(let i=0;i<30;i++){
  const before=(await state()).showDirector.rotation.slots;const e=h.event('VIEWER_JOIN','viewer-'+i,{username:i%2?'Nombre repetido':'Participante '+i});await p.evaluate(e=>{__V05.submit(e);__V05.submit(e);},e);
  await ready(i+1);await tick(3.5);if([0,2,4,5,11,29].includes(i))await capture('ENTRADA-'+(i+1));await tick(4.6);
  const s=await state(),row=s.showDirector.rotation.log.filter(r=>r.action==='admitted').at(-1);assert.equal(row.incoming,'viewer-'+i);assert.equal(row.slot,i%5);if(i>=5)assert.equal(row.outgoing,'viewer-'+(i-5));assert.equal(s.showDirector.shot,'WIDE');assert.equal(s.actors.length,i+1);
  occupancy.push({entry:i+1,viewerId:'viewer-'+i,before,after:s.showDirector.rotation.slots,change:row});console.log('Entrada '+(i+1)+' -> lugar '+(row.slot+1));
 }
 let s=await state();assert.equal(s.showDirector.history.filter(p=>p.kind==='welcome'&&p.state==='finished').length,30);assert.equal(s.showDirector.rotation.participants.filter(r=>r.slot===null).length,25);
 const beforeLikes=s.showDirector.started;for(let i=0;i<20;i++)await send('LIKE_MILESTONE',29);await tick(1);assert.equal((await state()).showDirector.started,beforeLikes);
 await send('FOLLOW',0);await tick(.2);assert.equal((await state()).showDirector.active.id,'viewer-0');assert.equal((await state()).showDirector.rotation.participants.find(r=>r.id==='viewer-0').joinedOrder,1);await tick(8);await p.evaluate(()=>__V05.next());await tick(.1);assert((await state()).actors.find(a=>a.id==='viewer-1').visible);
 await fs.writeFile(out+'/occupancy-30.json',JSON.stringify(occupancy,null,2));await saveCase('30 successive arrivals, duplicate events, likes and displaced returns');
 await reset();for(let i=0;i<30;i++)await send('VIEWER_JOIN',i);await ready(30);await tick(205);s=await state();assert.equal(s.showDirector.history.filter(p=>p.kind==='welcome'&&p.state==='finished').length,30);assert.equal(s.showDirector.dropped,0);await saveCase('Burst of 30: every registered welcome completes');
 await reset();for(let i=0;i<5;i++){await send('VIEWER_JOIN',i);await ready(i+1);await tick(7);}
 await send('SIMULATED',0,{giftId:'fever-demo'});await tick(1);const fever=(await state()).showDirector.active;await send('GIFT',1,{metadata:{tier:'HIGH'},giftName:'VIP'});await tick(1);const vip=(await state()).showDirector.active;
 await send('VIEWER_JOIN',5);await ready(6);for(let i=0;i<25;i++)await send('LIKE_MILESTONE',1);await tick(2);assert.equal((await state()).showDirector.active.presentationId,vip.presentationId);assert(!(await state()).actors.find(a=>a.id==='viewer-5').visible);await capture('VIP-PROTEGIDO');await tick(5.1);assert.equal((await state()).showDirector.active.presentationId,fever.presentationId);await tick(18);s=await state();assert(s.showDirector.history.some(p=>p.id==='viewer-5'&&p.state==='finished'));assert.equal(s.showDirector.history.find(p=>p.presentationId===fever.presentationId).resumes,1);await saveCase('VIP, Fever, pending join and repeated likes');
 for(const size of [{width:540,height:960},{width:1080,height:1920}]){await p.setViewportSize(size);await p.waitForTimeout(60);await p.evaluate(()=>sdAudit.previous=null);for(const mode of ['FULL','COMPACT','OFF']){await p.evaluate(mode=>__V05.configure({backgroundNames:mode}),mode);await send('FOLLOW',5);await tick(3.5);await capture(mode+'-'+size.width);await tick(5);}}
 await saveCase('Name modes and vertical resolutions');assert.deepEqual(h.errors,[]);
 await fs.writeFile(out+'/simulator-results.json',JSON.stringify({status:'PASS',cases,errors:h.errors,scope:'Local simulator, no real LIVE'},null,2));console.log('GroupRotation simulator PASS');
}catch(e){await fs.writeFile(out+'/failure.json',JSON.stringify({error:String(e),state:await state(),audit:await p.evaluate(()=>sdAudit)},null,2));await p.screenshot({path:out+'/FAILURE.png'});throw e;}finally{await h.close();}
