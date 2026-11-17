import {harness} from './v05-harness.mjs';
import {installAudit} from './showdirector-audit.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/groupcamera',h=await harness('groupcamera-record',5572,true);
const context=await h.browser.newContext({viewport:{width:540,height:960},recordVideo:{dir:'temp/groupcamera-video',size:{width:540,height:960}}});
const recordOpened=Date.now(),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.addInitScript(()=>{let seed=7381;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
 await p.goto(h.page.url());await h.page.close();await p.waitForFunction(()=>window.__V05?.inspect().ready);
 await p.evaluate(()=>{const w=__V05.world;w.config.afk=false;w.config.adaptive=false;w.config.quality='MEDIUM';w.config.replacement='reject';__V05.configure({backgroundNames:'FULL',motion:'SUAVE'});document.querySelector('#toast').hidden=true;});
 await installAudit(p);
 await p.evaluate(()=>{window.intervals=[];let last=performance.now();function frame(now){intervals.push(now-last);checkDirector((now-last)/1000);last=now;if(!window.recordDone)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 const timeline=[],start=Date.now(),videoLeadSeconds=(start-recordOpened)/1000,send=(type,id,name,extra={})=>p.evaluate(e=>__V05.submit(e),h.event(type,'viewer-'+id,{username:name,...extra}));
 const actions=[
 [0,'Primera bienvenida',()=>send('VIEWER_JOIN',0,'Río')],
 [1,'Segunda entrada: ID1 Mismo nombre',()=>send('VIEWER_JOIN',1,'Mismo nombre')],
 [2,'Tercera entrada: ID2 Mismo nombre',()=>send('VIEWER_JOIN',2,'Mismo nombre')],
 [3,'Follow durante bienvenida: espera en cola',()=>send('FOLLOW',0,'Río')],
 [7,'VIP ID1',()=>send('GIFT',1,'Mismo nombre',{metadata:{tier:'HIGH'},giftName:'VIP simulado'})],
 [8,'Join durante VIP: Nova espera',()=>send('VIEWER_JOIN',3,'Nova')],
 [9,'Otra entrada durante VIP',()=>send('VIEWER_JOIN',4,'Álex')],
 [10,'25 likes de ID1 durante VIP',async()=>{for(let i=0;i<25;i++)await send('LIKE_MILESTONE',1,'Mismo nombre');}],
 [44,'Fever: plano grupal especial',()=>send('SIMULATED',0,'Río',{giftId:'fever-demo'})],
 [47,'VIP ID2 suspende Fever',()=>send('GIFT',2,'Mismo nombre',{metadata:{tier:'HIGH'},giftName:'VIP durante Fever'})],
 [48,'Sexto registrado',()=>send('VIEWER_JOIN',5,'Cielo')],
 [49,'Séptimo registrado',()=>send('VIEWER_JOIN',6,'Mar')],
 [50,'Octavo registrado',()=>send('VIEWER_JOIN',7,'Tierra')],
 [83,'Regalo normal: plano EVENT',()=>send('GIFT',7,'Tierra',{metadata:{tier:'NORMAL'},giftName:'Rosa'})],
 [93,'Noveno participante y nuevo reemplazo',()=>send('VIEWER_JOIN',8,'Estrella')]
 ];
 for(const [at,name]of [[3.5,'HERO'],[12,'VIP'],[38,'WIDE'],[51,'VIP-SEGUNDO'],[62,'FEVER'],[84.5,'EVENT'],[96.3,'REEMPLAZO']])actions.push([at,'Captura '+name,()=>p.locator('#stage').screenshot({path:out+'/VIDEO-'+name+'.png'})]);
 actions.sort((a,b)=>a[0]-b[0]);
 for(const [at,label,action]of actions){while(Date.now()-start<at*1000)await p.waitForTimeout(200);await p.evaluate(label=>sdAudit.tag=label,label);await action();timeline.push({seconds:(Date.now()-start)/1000,label});console.log(label);}
 while(Date.now()-start<107000)await p.waitForTimeout(200);
 const result=await p.evaluate(()=>{window.recordDone=true;const a={...sdAudit};delete a.previous;const sorted=intervals.slice(30).sort((a,b)=>a-b);return {audit:a,director:__V05.inspect().showDirector,fps:{median:1000/sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)]}};});
 await p.locator('#stage').screenshot({path:out+'/CAPTURA-LIMPIA.png'});await context.close();await p.video().saveAs(out+'/SIMULACION-COMPLETA.webm');
 const finished=result.director.history.filter(p=>p.state==='finished');
 const validations={noAuditFailures:result.audit.failures.length===0,noBrowserErrors:errors.length===0,nineWelcomes:finished.filter(p=>p.kind==='welcome').length===9,feverResumed:finished.some(p=>p.kind==='fever'&&p.resumes===1&&p.activations===1),allFiveShots:Object.keys(result.audit.shots).length===5,queueDrained:result.director.queue.length===0&&!result.director.active};
 const status=Object.values(validations).every(Boolean)?'PASS':'FAIL';
 await fs.writeFile(out+'/recording-results.json',JSON.stringify({status,validations,timeline,videoLeadSeconds,...result,errors,scope:'Real-time local simulator, silent video; no TikTok LIVE validation'},null,2));
 await fs.writeFile(out+'/recording-log.json',JSON.stringify(result.director.log,null,2));
 assert.equal(status,'PASS');console.log(JSON.stringify({status,frames:result.audit.frames,fps:result.fps}));
}finally{await context.close().catch(()=>{});await h.close();}
