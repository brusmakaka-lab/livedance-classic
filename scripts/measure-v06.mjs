import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const previous=process.argv.includes('--resume')?JSON.parse(await fs.readFile('docs/v061/benchmark-v06.json','utf8')):{rows:[]};
const h=await harness('v06-aforo'),{page}=h,rows=previous.rows,cycles=[];
await page.evaluate(()=>{window.__V05.world.config.inactivity=3600;});
const start=Date.now();
const cdp=await page.context().newCDPSession(page);
async function save(){await fs.writeFile('docs/v061/benchmark-v06.json',JSON.stringify({rows,cycles,errors:h.errors,elapsedSeconds:(Date.now()-start)/1000,notes:['MEDIUM; hardware Edge; DPR1. CPU=JS update+render submission, not GPU time. Heap=JS, not VRAM.','Aforo is maximum cast: background bodies can be hidden during close shots. Registry is preserved.','Performance uses simulator; independent of live-provider availability. No recording/framing computations in timed samples.']},null,2));}
async function measure(kind,n,cap,res,seconds){
 const m=await page.evaluate(async seconds=>{
   const raf=[],cpu=[],visible=[];let prev;
   await new Promise(resolve=>{const end=performance.now()+seconds*1000;function tick(t){if(prev!==undefined)raf.push(t-prev);prev=t;cpu.push(window.__LiveDance.snapshot().cpuMs);visible.push(window.__V05.inspect().actors.filter(a=>a.visible).length);if(t<end)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
   const avg=a=>a.reduce((s,n)=>s+n,0)/a.length, p95=a=>a.toSorted((a,b)=>a-b)[Math.floor(a.length*.95)];
   return {fps:1000/avg(raf),frameMs:avg(raf),p95RAF:p95(raf),cpuMs:avg(cpu),cpuP95:p95(cpu),visibleMin:Math.min(...visible),visibleMax:Math.max(...visible),metrics:window.__LiveDance.snapshot(),heap:performance.memory?.usedJSHeapSize,show:window.__V05.inspect()};
 },seconds);
 assert.equal(m.show.registered.length,n);assert.equal(m.metrics.width,res[0]);assert.equal(m.metrics.height,res[1]);assert.equal(m.show.failure,'');
 const boxes=await page.evaluate(()=>window.__V05.framing());
 const cropped=boxes.filter(b=>b.x0<0||b.x1>1||b.y0<0||b.y1>1);
 let overlapPairs=0,maxOverlap=0;
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j],area=Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
   const fraction=area/Math.min((a.x1-a.x0)*(a.y1-a.y0),(b.x1-b.x0)*(b.y1-b.y0));if(fraction>.2)overlapPairs++;maxOverlap=Math.max(maxOverlap,fraction||0);
 }
 const old=rows.findIndex(r=>r.kind===kind&&r.n===n&&r.cap===cap&&r.res[0]===res[0]);if(old>=0)rows.splice(old,1);
 rows.push({kind,n,cap,res,seconds,...m,framing:{boxes,cropped,overlapPairsAbove20Percent:overlapPairs,maxOverlap}});
 await page.screenshot({path:`docs/v061/evidence/aforo-${res[0]}-${n}-${cap}-${kind}.png`});
 await save();console.log(kind,n,cap,res[0],m.fps.toFixed(1),m.p95RAF.toFixed(2),'visible',m.visibleMin,m.visibleMax,'overlaps',overlapPairs,'cropped',cropped.length);
}
try{
 for(const res of [[365,648],[720,1280]]){
  await page.setViewportSize({width:res[0],height:res[1]});
  for(const n of [1,10,30]){
   if(rows.some(r=>r.kind==='WIDE'&&r.n===n&&r.cap===20&&r.res[0]===res[0]))continue;
   await page.evaluate(()=>window.__V05.configure({featured:20}));await h.fill(n);
   await measure('WIDE',n,20,res,5);
  }
  for(const cap of [10,20,30]){
   if(['WIDE','VIP','FEVER'].every(kind=>rows.some(r=>r.kind===kind&&r.n===30&&r.cap===cap&&r.res[0]===res[0])))continue;
   if((await page.evaluate(()=>window.__V05.inspect())).registered.length!==30)await h.fill(30);
   // Independent benchmark cases: clear Fever cooldown with the supported emergency/recovery flow.
   await page.keyboard.press('F8');await page.getByRole('button',{name:'Reanudar',exact:true}).click();
   await page.evaluate(featured=>window.__V05.configure({featured}),cap);await page.waitForTimeout(4500);
   await measure('WIDE',30,cap,res,5);
   await h.send('GIFT','viewer-29',{giftId:'galaxy',giftName:'Fixture VIP',metadata:{tier:'HIGH'}});
   await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='vip');
   await measure('VIP',30,cap,res,8);await page.waitForTimeout(3000);
   await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});
   await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='fever');
   await measure('FEVER',30,cap,res,12);await page.waitForTimeout(3000);
  }
 }
 for(let i=0;i<3;i++){
  await h.fill(30);await page.keyboard.press('F8');assert.equal((await page.evaluate(()=>window.__V05.inspect())).registered.length,30);
  await page.getByRole('button',{name:'Reanudar',exact:true}).click();await page.evaluate(()=>window.__V05.reset());await page.waitForTimeout(1500);
  await cdp.send('HeapProfiler.collectGarbage');
  cycles.push(await page.evaluate(()=>({heap:performance.memory?.usedJSHeapSize,metrics:window.__LiveDance.snapshot(),show:window.__V05.inspect()})));
 }
 assert.deepEqual(h.errors,[]);assert.equal(new Set(cycles.map(c=>c.metrics.geometries)).size,1);assert.equal(new Set(cycles.map(c=>c.metrics.textures)).size,1);
 await save();
}finally{await h.close();}
