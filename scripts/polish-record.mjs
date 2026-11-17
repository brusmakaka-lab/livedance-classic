import {chromium} from '@playwright/test';import path from 'node:path';import fs from 'node:fs/promises';
import {server,event,configure,installAudit} from './polish-harness.mjs';
import {comparisonBaseline} from './polish-baseline.mjs';
const project=process.cwd(),baseline=await comparisonBaseline(project),out=path.join(project,'docs/rowshow-polish');
const before=await server(baseline,'polish-before-record',5605,project),after=await server(project,'polish-after-record',5606,project),browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1120,height:1080},recordVideo:{dir:path.join(project,'temp/polish-video'),size:{width:1120,height:1080}}}),page=await context.newPage(),opened=Date.now(),errors=[],timeline=[],captures=[];page.on('pageerror',e=>errors.push(e.message));
const html=`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#101522;color:#fff;font:17px system-ui}header{height:120px;padding:14px 20px}h1{font-size:23px;margin:0 0 6px}#event{color:#91ecce}main{display:flex;gap:20px;padding:0 10px}section{position:relative}iframe{width:540px;height:960px;border:0}.label{position:absolute;top:-25px;left:12px;background:#101522f0;border:1px solid #3b5572;border-radius:6px;padding:2px 10px;font-size:13px;z-index:1}</style><header><h1>LiveDance · RowShow Polish · misma secuencia de prueba</h1><div id="event">Preparando 12 participantes preexistentes · simulación local</div><small>Los tiempos y rótulos de este borde son evidencia de prueba, fuera del escenario. Sin TikTok LIVE.</small></header><main><section><div class="label">ANTES · 0.6.14 RowShow</div><iframe id="before" src="${before.url}"></iframe></section><section><div class="label">DESPUÉS · 0.6.14.1 RowShowPolish</div><iframe id="after" src="${after.url}"></iframe></section></main>`;
try{
 await context.route('http://127.0.0.1:5605/**',async route=>{const response=await route.fetch(),headers=response.headers();delete headers['content-security-policy'];delete headers['x-frame-options'];await route.fulfill({response,headers});});
 await page.route('**/polish-comparison',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));await page.goto('http://127.0.0.1:5606/polish-comparison');
 const frames={before:await(await page.locator('#before').elementHandle()).contentFrame(),after:await(await page.locator('#after').elementHandle()).contentFrame()};
 for(const f of Object.values(frames)){await configure(f);await f.evaluate(()=>__V05.reviewControl(true));}
 let seq=0;
 async function seed(n){
  for(const f of Object.values(frames))await f.evaluate(n=>{window.polishSetup=true;__V05.reviewControl(true);__V05.reset();document.querySelector('#toast').hidden=true;__V05.configure({gpuBudget:60,retireBatch:5});},n);
  const events=Array.from({length:n},(_,i)=>event(++seq,'COMMENT',i));for(const f of Object.values(frames))await f.evaluate(events=>events.forEach(e=>__V05.submit(e)),events);
  for(let i=0;i<300;i++){for(const f of Object.values(frames))await f.evaluate(()=>__V05.reviewFrame(.05));const counts=await Promise.all(Object.values(frames).map(f=>f.evaluate(()=>__V05.inspect().actors.length)));if(counts.every(count=>count===n))break;await page.waitForTimeout(25);}
  // A mid-session fixture, matching the reference clip's preexisting group; not a claim about those earlier welcomes.
  for(const f of Object.values(frames))await f.evaluate(n=>{for(let i=0;i<12;i++)__V05.reviewFrame(.05);__V05.show.director.clear();__V05.show.director.lastEntrant='viewer-'+(n-1);for(let i=0;i<45;i++)__V05.reviewFrame(.05);__V05.reviewControl(false);window.polishSetup=false;},n);
 }
 await seed(12);for(const f of Object.values(frames)){await installAudit(f);await f.evaluate(()=>{window.recordAudit=true;function sample(){if(!recordAudit)return;auditPolish((performance.now()-(window.polishRecordOrigin||0))/1000);requestAnimationFrame(sample);}requestAnimationFrame(sample);});}
 for(const f of Object.values(frames))await f.evaluate(()=>window.polishRecordOrigin=performance.now());
 const start=Date.now(),leadSeconds=(start-opened)/1000;
 async function at(seconds,label,fn){while(Date.now()-start<seconds*1000)await page.waitForTimeout(50);await page.locator('#event').evaluate((el,label)=>el.textContent=label,label);await fn();timeline.push({target:seconds,actual:(Date.now()-start)/1000,label});console.log(label);}
 async function send(type,id,extra={}){const e=event(++seq,type,id,extra);await Promise.all(Object.values(frames).map(f=>f.evaluate(e=>__V05.submit(e),e)));}
 async function shot(label){captures.push({label,time:(Date.now()-start)/1000});}
 const actions=[
 [1.4,'Regalo a Mila · H03/H07',()=>send('GIFT',0,{giftName:'Demo Spark'})],
 [2.4,'VIP Mila · H01/H02/H06',()=>send('GIFT',0,{giftName:'Demo Spark',metadata:{tier:'HIGH'}})],
 [3.5,'Comparación de nombre, tamaño y cuerpo completo',()=>shot('H01-H02-H06')],
 [7.433,'Kai ingresa durante VIP · vista secundaria',()=>send('COMMENT',12)],
 [10.5,'Relevo al segmento de Kai · H03',()=>shot('H03-RELEVO')],
 [11.9,'Regalo a Mila: regreso entre segmentos',()=>send('GIFT',0,{giftName:'Demo Spark'})],
 [15.4,'Follow de Nico · H01/H07',()=>send('FOLLOW',1)],
 [19.9,'Zoe ingresa durante Follow',()=>send('COMMENT',13)],
 [20.6,'Transición a Zoe · captura de H03',()=>shot('H03-ZOE')],
 [21.9,'Regalo a Emi durante entrada de Zoe',()=>send('GIFT',3,{giftName:'Demo Spark'})],
 [26.4,'Regalo a Sol · cambio de segmento',()=>send('GIFT',6,{giftName:'Demo Spark'})],
 [30.9,'Regalo a Mila · cambio de segmento',()=>send('GIFT',0,{giftName:'Demo Spark'})],
 [34.9,'VIP de Vale · H06',()=>send('GIFT',11,{giftName:'Demo Spark',metadata:{tier:'HIGH'}})],
 [37,'Vale: comparación de protagonismo y etiquetas',()=>shot('H06-VALE')],
 [42.467,'Nico nuevo ID y skin oscura durante VIP · H04/H05',()=>send('COMMENT',14)],
 [42.9,'VIP consecutivo de Kai',()=>send('GIFT',12,{giftName:'Demo Spark',metadata:{tier:'HIGH'}})],
 [44,'Entrada oscura en vista secundaria · H04/H05',()=>shot('H04-H05')],
 [47,'Fin de entrada secundaria: continuidad visual',()=>shot('H04-FIN')],
 [52.4,'Regalo a Emi · último relevo del informe',()=>send('GIFT',3,{giftName:'Demo Spark'})],
 [56,'CASO DE FILAS · preparando 19 participantes preexistentes',()=>seed(19)],
 [60,'Entrada 20 · fila 1, plaza 20',()=>send('COMMENT',19)],
 [62,'Veinte personas registradas · fila 1 completa',()=>shot('FILA1-PLAZA20')],
 [66,'Entrada 21 · fila 2, plaza 1',()=>send('COMMENT',20)],
 [68,'Fila 2 · plaza 1 · cambio 20→21',()=>shot('FILA2-PLAZA1')],
 [71,'Preparación de carga lenta: mismo grupo visible',async()=>{for(const port of [5605,5606])await context.route('http://127.0.0.1:'+port+'/api/skins/assign',async route=>{if(route.request().postDataJSON()?.viewerId==='viewer-21')await page.waitForTimeout(2300);await route.continue();});}],
 [72,'Entra persona 22 · carga de skin demorada 2,3 s',()=>send('COMMENT',21)],
 [73.2,'Modelo pendiente: se conserva el grupo sin anuncio vacío',()=>shot('CARGA-LENTA')],
 [76,'Modelo listo: presentación con nombre y cuerpo',()=>shot('CARGA-LISTA')],
 [82,'Rosa a Mila · preparar retiro visible de acompañantes',()=>send('GIFT',0,{giftId:'rose',giftName:'Rosa',coins:1})],
 [83,'Presupuesto de 20 modelos · lote de 5 · sin borrar identidad',async()=>{for(const f of Object.values(frames))await f.evaluate(()=>__V05.configure({gpuBudget:20,retireBatch:5}));}],
 [83.75,'Fundido gradual de los visuales antiguos',()=>shot('RETIRO-DURANTE')],
 [85,'Lote terminado: las identidades siguen registradas',()=>shot('RETIRO-DESPUES')],
 [88,'VIP de un participante retirado · regresa a su plaza',()=>send('GIFT',1,{giftName:'VIP de regreso',coins:1000,metadata:{tier:'HIGH'}})],
 [91,'Donador restaurado con nombre y skin originales',()=>shot('REGRESO')],
 [98,'Fever · evento grupal conservado',()=>send('SIMULATED',0,{giftId:'fever-demo'})],
 [101,'VIP durante Fever · prioridad sin reinicios',()=>send('GIFT',0,{giftName:'VIP durante Fever',coins:1000,metadata:{tier:'HIGH'}})],
 [105,'VIP principal con cuerpo completo',()=>shot('VIP-FEVER')],
 [111,'Fever reanudado desde su tiempo anterior',()=>shot('FEVER-REANUDADO')],
 [121,'Fin de la simulación local · sin validación LIVE',async()=>{}]
 ];
 for(const [seconds,label,fn] of actions)await at(seconds,label,fn);
 const audits={};for(const [side,f]of Object.entries(frames)){audits[side]=await f.evaluate(()=>{recordAudit=false;return polishAudit;});await fs.writeFile(path.join(out,side+'-record-frames.json'),JSON.stringify(audits[side],null,2));}
 const final=await frames.after.evaluate(()=>__V05.inspect());await context.close();await page.video().saveAs(path.join(out,'COMPARACION-ANTES-DESPUES.webm'));
 const status=audits.after.failures.length===0&&errors.length===0?'PASS':'FAIL';await fs.writeFile(path.join(out,'recording-results.json'),JSON.stringify({status,leadSeconds,timeline,captures,checks:{beforeFrames:audits.before.frames.length,beforeFailures:audits.before.failures.length,afterFrames:audits.after.frames.length,afterFailures:audits.after.failures.length},final,errors,scope:'Local deterministic replay of the supplied report chronology, followed by row 20→21, delayed model, GPU retirement, restoration and Fever/VIP cases. Mid-session fixtures at setup/reset are explicit test preconditions. No real TikTok connection.'},null,2));console.log('Recording',status,JSON.stringify({before:audits.before.failures.length,after:audits.after.failures.length}));
}finally{await context.close().catch(()=>{});await browser.close();before.close();after.close();}
