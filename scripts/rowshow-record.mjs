import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const project=process.cwd(),baseline=path.resolve(process.env.LIVEDANCE_BASELINE_DIR||'work/baseline'),out=path.join(project,'docs/rowshow');
const original=path.resolve('E:/LiveDance/LiveDance-v0.6.13.2-GroupRotation');
if(baseline.toLowerCase()===original.toLowerCase())throw Error('Baseline must be an isolated copy; never run the harness in the original.');
try{await fs.access(path.join(baseline,'dist/index.html'));}catch{
 await fs.mkdir(baseline,{recursive:true});
 for(const name of ['scripts','connector','public','dist','package.json'])await fs.cp(path.join(original,name),path.join(baseline,name),{recursive:true,filter:p=>path.basename(p)!=='node_modules'});
 await fs.symlink(path.join(original,'node_modules'),path.join(baseline,'node_modules'),'junction');
}
process.chdir(baseline);const before=await harness('rowshow-before',5594,true);process.chdir(project);const after=await harness('rowshow-after',5595,true);
const context=await after.browser.newContext({bypassCSP:true,viewport:{width:1120,height:1080},recordVideo:{dir:path.join(project,'temp/rowshow-video'),size:{width:1120,height:1080}}}),page=await context.newPage();
const errors=[],timeline=[],states=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')console.log('browser error',msg.text());});
const html=`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#101522;color:#fff;font:17px system-ui}header{height:120px;padding:16px 20px}h1{font-size:23px;margin:0 0 8px}#event{color:#91ecce}main{display:flex;gap:20px;padding:0 10px}section{position:relative}iframe{width:540px;height:960px;border:0}.label{position:absolute;top:6px;left:12px;background:#101522e8;border:1px solid #3b5572;border-radius:6px;padding:5px 10px;font-size:14px;z-index:1}.count{position:absolute;bottom:8px;left:12px;background:#101522ee;border-radius:6px;padding:5px 10px;z-index:1}</style><header><h1>LiveDance · comparación de la misma simulación local</h1><div id="event">Preparando entradas por COMMENT de cuentas nuevas · sin conexión LIVE</div><small>Filas lógicas de 20 · cámara por segmentos de 3 para vertical · audio de la grabación: silencioso</small></header><main><section><div class="label">ANTES · v0.6.13.2 GroupRotation</div><iframe id="before" src="${before.page.url()}"></iframe><div class="count" id="before-count"></div></section><section><div class="label">AHORA · v0.6.14 RowShow</div><iframe id="after" src="${after.page.url()}"></iframe><div class="count" id="after-count"></div></section></main>`;
try{
 await context.route('http://127.0.0.1:5594/**',async route=>{const response=await route.fetch();const headers=response.headers();delete headers['content-security-policy'];delete headers['x-frame-options'];await route.fulfill({response,headers});});
 await page.route('**/rowshow-comparison',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));await page.goto('http://127.0.0.1:5595/rowshow-comparison');
 const frames={before:await (await page.locator('#before').elementHandle()).contentFrame(),after:await (await page.locator('#after').elementHandle()).contentFrame()};
 console.log('frames',page.frames().map(f=>f.url()));for(const f of Object.values(frames)){console.log('frame state',await f.evaluate(()=>({url:location.href,api:!!window.__V05,body:document.body.innerText.slice(0,180),status:window.__V05?.inspect().failure})));await f.waitForFunction(()=>window.__V05?.inspect().ready);await f.evaluate(()=>{__V05.world.config.afk=false;__V05.world.config.adaptive=false;__V05.world.config.quality='MEDIUM';__V05.world.config.maxDancers=60;__V05.world.config.replacement='reject';document.querySelector('#toast').hidden=true;});}
 await frames.after.evaluate(()=>__V05.configure({segmentSize:3,gpuBudget:60,retireBatch:5,profilePhotos:true}));
 await before.page.close();await after.page.close();
 let seq=0;const start=Date.now();
 const event=(type,id,extra={})=>({schemaVersion:1,source:'simulator',eventId:'comparison-'+ ++seq,viewerId:'viewer-'+id,username:id%3?'Nombre repetido':'Participante '+id,eventType:type,giftCount:1,timestamp:Date.now(),metadata:{},...extra});
 async function send(type,id,extra={}){const e=event(type,id,extra);for(const f of Object.values(frames))await f.evaluate(e=>__V05.submit(e),e);}
 async function at(seconds,title,fn){while((Date.now()-start)/1000<seconds)await page.waitForTimeout(100);await page.locator('#event').evaluate((el,title)=>el.textContent=title,title);await fn();timeline.push({seconds:(Date.now()-start)/1000,title});console.log(title);}
 async function sample(){const rows={};for(const [key,f]of Object.entries(frames)){const s=await f.evaluate(()=>__V05.inspect());rows[key]={registered:s.registered.length,loaded:s.actors.length,drawn:s.actors.filter(a=>a.visible).length,shot:s.showDirector.shot,owner:s.effectiveCue?.id,slot:s.effectiveCue?.id?s.showDirector.rotation.participants.find(p=>p.id===s.effectiveCue.id)?.slot:null};await page.locator('#'+key+'-count').evaluate((el,s)=>el.textContent=`${s.registered} identidades · ${s.loaded} modelos · ${s.drawn} en encuadre · ${s.shot}`,rows[key]);}states.push({seconds:(Date.now()-start)/1000,...rows});}
 for(let i=0;i<20;i++){await at(i*.42,`Entrada ${i+1} · fila lógica 1, plaza ${i+1}`,()=>send('COMMENT',i));await sample();}
 await at(12,'Fila 1 completa: 20 plazas conservadas. Empieza fila 2, plaza 1.',()=>send('COMMENT',20));await sample();
 for(let i=21;i<40;i++){await at(12+(i-20)*.14,`Entrada ${i+1} · fila 2, plaza ${i%20+1}`,()=>send('COMMENT',i));}
 await at(19,'Fila 2 completa: 40 identidades. Empieza fila 3, plaza 1.',()=>send('COMMENT',40));await sample();
 for(let i=41;i<60;i++)await at(19+(i-40)*.14,`Entrada ${i+1} · fila 3, plaza ${i%20+1}`,()=>send('COMMENT',i));
 await at(29,'60 entradas · grupo del último segmento · sin expulsión por entrada',async()=>{});await sample();await page.screenshot({path:path.join(out,'COMPARACION-60.png')});
 await at(31,'Rosa · movimiento especial breve del donador',()=>send('GIFT',59,{giftId:'rose',giftName:'Rosa',coins:1}));await page.waitForTimeout(1200);await sample();
 await at(36,'Fever · evento colectivo',()=>send('SIMULATED',0,{giftId:'fever-demo'}));await sample();
 await at(38,'VIP · cámara al donador y coreografía; Fever suspendido',()=>send('GIFT',58,{giftName:'VIP',coins:1000,metadata:{tier:'HIGH'}}));await page.waitForTimeout(1400);await sample();await page.screenshot({path:path.join(out,'COMPARACION-VIP.png')});
 await at(41,'Nueva entrada durante VIP · presenta en su plaza sin quitar la cámara al donador',()=>send('COMMENT',60));await page.waitForTimeout(1500);await sample();
 await at(48,'Fever continúa desde su edad anterior · sin reiniciarlo',async()=>{});await sample();
 await at(58,'Regreso a la vista del último grupo · simulación finalizada',async()=>{});await sample();
 const final=await frames.after.evaluate(()=>__V05.inspect());assert.equal(final.registered.length,61);assert.equal(final.showDirector.rotation.slots.length,61);assert(final.showDirector.history.some(p=>p.kind==='fever'&&p.resumes===1));assert.deepEqual(errors,[]);
 await context.close();await page.video().saveAs(path.join(out,'COMPARACION-ANTES-AHORA.webm'));
 await fs.writeFile(path.join(out,'recording-results.json'),JSON.stringify({status:'PASS',scope:'Same local COMMENT/gift fixtures in both versions. No LIVE. Silent browser recording; performance benchmark measured separately.',timeline,states,final,errors},null,2));
 console.log('Comparison recording PASS');
}catch(e){await page.screenshot({path:path.join(out,'record-debug.png')});console.log('frame debug',await Promise.all(page.frames().map(f=>f.evaluate(()=>({url:location.href,api:!!window.__V05,ready:window.__V05?.inspect().ready,failure:window.__V05?.inspect().failure,body:document.body.innerText.slice(0,180)})).catch(()=>null))));throw e;}finally{await context.close().catch(()=>{});await before.close();await after.close();}
