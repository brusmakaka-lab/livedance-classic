import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/stage-recovery',h=await harness('recovery-record',5556,true);
const context=await h.browser.newContext({viewport:{width:540,height:960},recordVideo:{dir:'temp/recovery-video',size:{width:540,height:960}}});
const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.addInitScript(()=>{let seed=7381;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
 await p.goto(h.page.url());await h.page.close();await p.waitForFunction(()=>window.__V05?.inspect().ready);
 await p.evaluate(()=>{const w=__V05.world;w.config.afk=false;w.config.adaptive=false;w.config.quality='MEDIUM';w.config.replacement='reject';__V05.configure({backgroundNames:'FULL',motion:'SUAVE'});document.querySelector('#toast').hidden=true;
  window.recordAudit={frames:0,failures:[],cues:[],intervals:[],maxVisible:0};let last=performance.now(),cue='';
  function audit(now){const a=window.recordAudit,s=__V05.inspect(),v=s.actors.filter(x=>x.visible),e=s.effectiveCue,labels=s.labels.filter(x=>x.visible),fail=m=>{if(a.failures.length<30)a.failures.push({t:now,message:m});};a.frames++;a.intervals.push(now-last);last=now;a.maxVisible=Math.max(a.maxVisible,v.length);
   if(v.length>5)fail('sixth actor');if(s.actors.length>=5&&v.length!==5)fail('missing ready actor');if(v.some(x=>x.scale!==1))fail('tiny actor');
   if(v.some(x=>!labels.some(l=>l.id===x.id)))fail('missing label');
   for(const l of labels){const actor=__V05.show.actors.get(l.id),name=__V05.world.spawn.dancers.get(l.id)?.username;if(actor.label.querySelector('.name-text').textContent!==name)fail('name identity');}
   if(e?.kind==='welcome'){const owner=v.find(x=>x.id===e.id);if(!owner||Math.hypot(owner.position[0],owner.position[2])>.002||!labels.some(l=>l.id===e.id&&l.protagonist))fail('welcome owner');}
   if(e?.kind==='vip'){const owner=v.find(x=>x.id===e.id),stage=__V05.show.stage;if(!owner||stage.halo.userData.viewerId!==e.id||stage.crown.userData.viewerId!==e.id||stage.crown.position.toArray().some((x,i)=>Math.abs(x-owner.position[i])>1e-7))fail('VIP identity or position');}
   const key=e?e.kind+':'+e.id:'normal';if(key!==cue){a.cues.push({time:now/1000,cue:key,age:e?.age});cue=key;}if(!window.recordDone)requestAnimationFrame(audit);
  }requestAnimationFrame(audit);
 });
 const timeline=[],start=Date.now(),send=async(type,id,name,extra={})=>{await p.evaluate(e=>__V05.submit(e),h.event(type,'viewer-'+id,{username:name,...extra}));};
 const actions=[
 [0,'Una persona',()=>send('VIEWER_JOIN',0,'Río')],
 [6,'Segunda bienvenida',()=>send('VIEWER_JOIN',1,'Mismo nombre')],
 [7,'Tres registrados; bienvenida consecutiva',()=>send('VIEWER_JOIN',2,'Mismo nombre')],
 [16,'Cuarta bienvenida',()=>send('VIEWER_JOIN',3,'Nova')],
 [17,'Cinco registrados',()=>send('VIEWER_JOIN',4,'Álex')],
 [18,'VIP ID1, mismo nombre que ID2, durante bienvenida',()=>send('GIFT',1,'Mismo nombre',{giftName:'VIP fixture',coins:1000,metadata:{tier:'HIGH'}})],
 [32,'30 likes de Río',async()=>{for(let i=0;i<30;i++)await send('LIKE_MILESTONE',0,'Río');}],
 [40,'Sexto registrado; reemplazo',()=>send('VIEWER_JOIN',5,'Cielo')],
 [41,'Séptimo registrado',()=>send('VIEWER_JOIN',6,'Mar')],
 [42,'Octavo registrado',()=>send('VIEWER_JOIN',7,'Tierra')],
 [76,'Fever simulado',()=>send('SIMULATED',0,'Río',{giftId:'fever-demo'})],
 [91,'Cambio de grupo visible',()=>p.evaluate(()=>__V05.show.next())]
 ];
 for(const [at,label,action]of actions){while(Date.now()-start<at*1000)await p.waitForTimeout(200);await action();timeline.push({seconds:(Date.now()-start)/1000,label});console.log(label);}
 while(Date.now()-start<98000)await p.waitForTimeout(200);
 const result=await p.evaluate(()=>{window.recordDone=true;return {audit:recordAudit,state:__V05.inspect()};});
 await p.locator('#stage').screenshot({path:out+'/CAPTURA-LIMPIA.png'});
 await context.close();await p.video().saveAs(out+'/SIMULACION-COMPLETA.webm');
 const sorted=result.audit.intervals.slice(30).sort((a,b)=>a-b);const fps={median:1000/sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)]};delete result.audit.intervals;
 const report={status:result.audit.failures.length||errors.length?'FAIL':'PASS',durationSeconds:(Date.now()-start)/1000,timeline,fps,...result,errors,scope:'Real-time simulator recording; silent video, no LIVE/OBS validation'};
 await fs.writeFile(out+'/recording-results.json',JSON.stringify(report,null,2));assert.deepEqual(result.audit.failures,[]);assert.deepEqual(errors,[]);assert.equal(result.state.spotlight.completed,8);assert(result.audit.cues.some(c=>c.cue.startsWith('fever')));console.log(JSON.stringify({status:'PASS',frames:result.audit.frames,fps}));
}finally{await context.close().catch(()=>{});await h.close();}
