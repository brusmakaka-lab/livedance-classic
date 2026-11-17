import {harness} from './v05-harness.mjs';import {installRotationAudit} from './grouprotation-audit.mjs';import {installAudit} from './showdirector-audit.mjs';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.cwd(),out=path.join(root,'docs/grouprotation'),baseline=process.argv.includes('--baseline'),label=baseline?'ANTES-GroupCamera':'AHORA-GroupRotation';
if(baseline){const destination=path.join(root,'temp/rotation-baseline'),source='E:/LiveDance/LiveDance-v0.6.13.1-GroupCamera';await fs.mkdir(destination,{recursive:true});for(const name of ['dist','public','connector','scripts','node_modules','package.json'])await fs.cp(path.join(source,name),path.join(destination,name),{recursive:true});process.chdir(destination);}
const h=await harness('rotation-record-'+(baseline?'baseline':'new'),baseline?5584:5583,true);
const context=await h.browser.newContext({viewport:{width:960,height:960},recordVideo:{dir:path.join(root,'temp/rotation-video'),size:{width:960,height:960}}});
const opened=Date.now(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>{let seed=7381;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
const wrapper=`<!doctype html><html lang="es"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#111c2a;color:#edf4fa;font:18px/1.4 system-ui;display:flex}iframe{width:540px;height:960px;border:0;flex:none}aside{width:420px;padding:24px}h1{font-size:25px}h2{font-size:21px;color:#84e5ce}small{color:#9cb0c8}#event{padding:12px;background:#24364d;min-height:80px}#change{border-left:3px solid #81e3ca;padding:12px;margin:18px 0;min-height:116px}#slots div{padding:13px 8px;border-bottom:1px solid #384657}#before{font-size:14px;color:#a9bcd1;white-space:pre-wrap}footer{font-size:13px;margin-top:24px;color:#9cb0c8}</style><iframe id="stage" src="${h.page.url()}"></iframe><aside><small>REGISTRO DE SIMULACIÓN</small><h1>${label}</h1><p id="event">Preparando entradas…</p><h2 id="principal">WIDE · grupo</h2><p id="change">Todavía no hubo reemplazos.</p><div id="slots"></div><h2>Antes del último cambio</h2><div id="before">—</div><footer>Panel de evidencia del ensayo.<br>No forma parte de la interfaz de LiveDance.<br>IDs distintos pueden usar el mismo nombre.</footer></aside></html>`;
try{
 await page.route('**/rotation-review',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:wrapper}));await page.goto(new URL('/rotation-review',h.page.url()).href);
 const app=page.frames().find(f=>f.parentFrame());await app.waitForFunction(()=>window.__V05?.inspect().ready);await h.page.close();
 await app.evaluate(()=>{__V05.world.config.afk=false;__V05.world.config.adaptive=false;__V05.world.config.quality='MEDIUM';__V05.world.config.replacement='reject';__V05.configure({backgroundNames:'FULL'});document.querySelector('#toast').hidden=true;});
 if(baseline)await installAudit(app);else await installRotationAudit(app);
 await app.evaluate(()=>{window.recordIntervals=[];let last=performance.now();function update(now){recordIntervals.push(now-last);checkDirector((now-last)/1000);last=now;if(!window.recordDone)requestAnimationFrame(update);}requestAnimationFrame(update);});
 await page.evaluate(()=>{
  window.occupancyChanges=[];let last=[];
  function show(){const w=document.querySelector('iframe').contentWindow,s=w.__V05.inspect(),d=s.showDirector;
   const slots=d.rotation?d.rotation.slots:Array.from({length:5},(_,slot)=>{const id=s.visible[slot]||null;return {slot,id};});
   const key=slots.map(x=>x.id).join('|');if(key!==last.map(x=>x.id).join('|')){
    const incoming=slots.filter(x=>x.id&&!last.some(y=>y.id===x.id)),outgoing=last.filter(x=>x.id&&!slots.some(y=>y.id===x.id));
    occupancyChanges.push({time:performance.now(),before:last,after:slots,incoming,outgoing});
    document.querySelector('#before').textContent=last.map(x=>'L'+(x.slot+1)+': '+(x.id||'vacío')).join('\n')||'Escenario vacío';
    document.querySelector('#change').textContent='Entra: '+(incoming.map(x=>x.id).join(', ')||'—')+'\nSale: '+(outgoing.map(x=>x.id).join(', ')||'—')+'\nLugar: '+(incoming.map(x=>'L'+(x.slot+1)).join(', ')||'—');document.querySelector('#change').style.whiteSpace='pre-line';
    const box=document.querySelector('#slots');box.replaceChildren(...slots.map(x=>{const row=document.createElement('div');row.textContent='L'+(x.slot+1)+' · '+(x.id||'vacío');return row;}));last=slots;
   }
   document.querySelector('#principal').textContent=d.shot+(d.active?.id?' · '+d.active.id:' · grupo');
   if(!window.recordDone)requestAnimationFrame(show);
  }requestAnimationFrame(show);
 });
 const timeline=[],start=Date.now(),leadSeconds=(start-opened)/1000;
 const send=(type,id,extra={})=>app.evaluate(e=>__V05.submit(e),h.event(type,'viewer-'+id,{username:id%2?'Nombre repetido':'Bailarín '+id,...extra}));
 const actions=Array.from({length:12},(_,i)=>[i*8,'Entrada '+(i+1)+' · viewer-'+i,()=>send('VIEWER_JOIN',i)]);
 actions.push([43,'VIP viewer-1',()=>send('GIFT',1,{metadata:{tier:'HIGH'},giftName:'VIP'})],[44,'Likes repetidos viewer-1',async()=>{for(let i=0;i<20;i++)await send('LIKE_MILESTONE',1);}],[54,'Fever grupal',()=>send('SIMULATED',0,{giftId:'fever-demo'})],[58,'VIP viewer-2 durante Fever',()=>send('GIFT',2,{metadata:{tier:'HIGH'},giftName:'VIP durante Fever'})],[121,baseline?'Follow viewer-0 (ya visible)':'Regresa viewer-0 con Follow',()=>send('FOLLOW',0)]);
 actions.sort((a,b)=>a[0]-b[0]);
 for(const [at,title,action]of actions){while(Date.now()-start<at*1000)await page.waitForTimeout(200);await page.locator('#event').evaluate((el,title)=>el.textContent=title,title);await action();timeline.push({seconds:(Date.now()-start)/1000,title});console.log(label+': '+title);}
 while(Date.now()-start<133000)await page.waitForTimeout(200);
 const result=await app.evaluate(()=>{window.recordDone=true;const a={...sdAudit};delete a.previous;const intervals=recordIntervals.slice(30).sort((a,b)=>a-b);return {director:__V05.inspect().showDirector,audit:a,fps:{median:1000/intervals[Math.floor(intervals.length/2)],p95Ms:intervals[Math.floor(intervals.length*.95)]}};});
 const occupancy=await page.evaluate(()=>{window.recordDone=true;return occupancyChanges;});await page.screenshot({path:path.join(out,label+'.png')});await app.locator('#stage').screenshot({path:path.join(out,label+'-LIMPIA.png')});
 await context.close();await page.video().saveAs(path.join(out,label+'.webm'));
 const finished=result.director.history.filter(p=>p.state==='finished'),checks={twelveWelcomes:finished.filter(p=>p.kind==='welcome').length===12,wideFinal:result.director.shot==='WIDE',feverResumed:finished.some(p=>p.kind==='fever'&&p.resumes===1),identityAndCamera:result.audit.failures.length===0,browser:errors.length===0};
 const report={status:Object.values(checks).every(Boolean)?'PASS':'FAIL',baseline,checks,leadSeconds,timeline,occupancy,...result,errors,scope:'Silent local simulator, no LIVE. Side panel belongs only to recording harness.'};await fs.writeFile(path.join(out,label+'-results.json'),JSON.stringify(report,null,2));assert.equal(report.status,'PASS');console.log(JSON.stringify({status:report.status,fps:result.fps,frames:result.audit.frames}));
}finally{await context.close().catch(()=>{});await h.close();}
