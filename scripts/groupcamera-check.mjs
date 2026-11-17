import {harness} from './v05-harness.mjs';
import {installAudit} from './showdirector-audit.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('groupcamera-check',5572,true),p=h.page,out='docs/groupcamera',checks=[];
const state=()=>p.evaluate(()=>__V05.inspect());
const tick=(n,tag)=>p.evaluate(({n,tag})=>{sdAudit.tag=tag;for(let i=0;i<n;i++){__V05.reviewFrame(1/60);checkDirector();}},{n,tag});
const send=(type,id,name,extra={})=>h.send(type,'viewer-'+id,{username:name,...extra});
async function ready(n){for(let i=0;i<150;i++){await tick(6,'loading');if((await state()).actors.length===n)return;await p.waitForTimeout(30);}throw Error('Models not ready');}
async function capture(name){await p.evaluate(()=>{__V05.reviewControl(false);document.querySelector('#toast').hidden=true;});await p.waitForTimeout(50);await p.locator('#stage').screenshot({path:`${out}/${name}.png`});await p.evaluate(()=>{__V05.reviewControl(true);sdAudit.previous=null;});}
try{
 await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({backgroundNames:'FULL',motion:'SUAVE'});});await installAudit(p);
 for(let i=0;i<3;i++)await send('VIEWER_JOIN',i,['Río','Mismo nombre','Mismo nombre'][i]);await ready(3);await tick(180,'first welcome');await capture('HERO');
 const welcome=(await state()).showDirector.active;
 await send('FOLLOW',0,'Río');await tick(1,'follow during welcome');assert.equal((await state()).showDirector.active.presentationId,welcome.presentationId);
 await tick(1500,'three consecutive and queued follow');
 const completed=(await state()).showDirector.history.filter(e=>e.state==='finished');assert.deepEqual(completed.map(e=>e.kind),['welcome','welcome','welcome','follow']);
 assert.deepEqual(completed.slice(0,3).map(e=>e.id),['viewer-0','viewer-1','viewer-2']);checks.push('Three consecutive welcomes and Follow during welcome: FIFO, one active principal, no restart');
 await send('GIFT',1,'Mismo nombre',{metadata:{tier:'HIGH'},giftName:'VIP'});await tick(90,'VIP start');const vip=(await state()).showDirector.active;
 await p.evaluate(()=>{const player=__V05.show.actors.get('viewer-1').player,original=player.set.bind(player);window.vipRestarts=0;player.set=(...args)=>{window.vipRestarts++;return original(...args);};});
 await send('VIEWER_JOIN',3,'Nova');await send('VIEWER_JOIN',4,'Álex');
 for(let i=0;i<25;i++)await send('LIKE_MILESTONE',1,'Mismo nombre');await tick(120,'join and likes during VIP');
 assert.equal((await state()).showDirector.active.presentationId,vip.presentationId);assert.equal(await p.evaluate(()=>vipRestarts),0);await capture('VIP');
 checks.push('Join and 25 repeated likes during VIP: same presentation, no animation reset, arrivals queued');
 await ready(5);await tick(1300,'VIP ends and queue drains');await capture('WIDE');
 await send('SIMULATED',0,'Río',{giftId:'fever-demo'});await tick(120,'Fever start');const fever=(await state()).showDirector.active;assert.equal(fever.kind,'fever');
 await send('GIFT',2,'Mismo nombre',{metadata:{tier:'HIGH'},giftName:'VIP durante Fever'});await tick(1,'VIP suspends Fever');assert.equal((await state()).showDirector.queue.find(p=>p.presentationId===fever.presentationId).suspended,true);
 await tick(200,'second VIP');await capture('VIP-DURANTE-FEVER');await tick(290,'resume Fever');assert.equal((await state()).showDirector.active.presentationId,fever.presentationId);assert.equal((await state()).showDirector.active.activations,1);await capture('FEVER');await tick(680,'Fever complete');
 checks.push('VIP suspends Fever; same Fever presentation resumes with elapsed time retained and activation count one');
 for(let i=5;i<9;i++)await send('VIEWER_JOIN',i,'Participante '+i);await ready(9);await tick(1500,'more than five and replacements');
 assert.equal((await state()).showDirector.queue.length,0);assert.equal((await state()).actors.filter(a=>a.visible).length,5);await capture('REEMPLAZOS');
 await send('GIFT',7,'Participante 7',{metadata:{tier:'NORMAL'},giftName:'Regalo normal'});await tick(125,'normal EVENT');await capture('EVENT');await tick(400,'normal event completes');
 checks.push('Nine registered / five rendered, identity-safe replacement and EVENT camera; no model scaling or movement to fake zoom');
 for(const size of [{width:540,height:960},{width:1080,height:1920}]){
  await p.setViewportSize(size);await p.waitForTimeout(80);await p.evaluate(()=>sdAudit.previous=null);
  for(const mode of ['FULL','COMPACT','OFF']){await p.evaluate(mode=>__V05.configure({backgroundNames:mode}),mode);await send('FOLLOW',7,'Participante 7');await tick(200,'vertical '+size.width+' '+mode);await capture(mode+'-'+size.width);await tick(260,'finish follow');}
 }
 await p.evaluate(()=>__V05.configure({profilePhotos:true,backgroundNames:'FULL'}));await send('FOLLOW',0,'Río');await tick(120,'optional avatar');assert.equal(await p.locator('.integration-banner .name-avatar').count(),1);await tick(340,'avatar end');
 const s=await state(),audit=await p.evaluate(()=>{const a={...sdAudit};delete a.previous;return a;});
 assert.deepEqual(audit.failures,[]);assert.deepEqual(h.errors,[]);assert(Object.values(audit.animations).every(n=>n>20));assert(Object.keys(audit.shots).length===5);assert(s.playback.every(p=>p.starts===1));
 for(const item of [...s.showDirector.history,...s.showDirector.queue,s.showDirector.active].filter(Boolean))assert(item.activations<=1);
 checks.push('WIDE/HERO/EVENT/VIP/FEVER transitions, fixed main label, secondary animation continuity, skins and optional avatar; 365×648 / 540×960 / 1080×1920');
 await fs.writeFile(out+'/simulator-results.json',JSON.stringify({status:'PASS',checks,audit,errors:h.errors,scope:'Local simulator only'},null,2));await fs.writeFile(out+'/presentation-log.json',JSON.stringify(s.showDirector,null,2));console.log(JSON.stringify({status:'PASS',checks,frames:audit.frames,bodySamples:audit.bodySamples}));
}catch(error){await p.screenshot({path:out+'/FAILURE.png'});await fs.writeFile(out+'/failure.json',JSON.stringify({error:String(error),state:await state(),audit:await p.evaluate(()=>sdAudit)},null,2));throw error;}
finally{await h.close();}
