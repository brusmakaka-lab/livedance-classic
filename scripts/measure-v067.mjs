import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('arrival-bench'),{page}=h,metrics=[];
try{
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({idleDance:false,likeDance:false,groupDance:false});});
 for(const size of [{width:365,height:648},{width:720,height:1280}]){
  await page.setViewportSize(size);
  for(const n of [1,10,30]){
   await page.evaluate(n=>__V05.configure({featured:n<=10?10:30}),n);await h.fill(n);
   for(const lineup of [true]){
    await page.evaluate(lineup=>{__V05.configure({lineup,entrance:true,materialize:true});__V05.show.events.clear();},lineup);await page.waitForTimeout(2500);
    const initial=await page.evaluate(()=>__V05.framing());assert.equal(initial.length,lineup?Math.min(5,n):n);assert(initial.every(f=>f.x0>=0&&f.x1<=1&&f.y0>=0&&f.y1<=1));
    const events=[h.event('FOLLOW','viewer-'+(n-1)),h.event('FOLLOW','viewer-0'),h.event('FOLLOW','viewer-'+(n-1))];
    const result=await page.evaluate(async events=>{
     const raf=[],cpu=[];let prev,index=0,drawCallsMax=0,trianglesMax=0;const started=performance.now();
     await new Promise(done=>{function tick(t){const age=t-started;if(prev!==undefined)raf.push(t-prev);prev=t;const snap=__LiveDance.snapshot();cpu.push(snap.cpuMs);drawCallsMax=Math.max(drawCallsMax,snap.drawCalls);trianglesMax=Math.max(trianglesMax,snap.triangles);if(index<3&&age>[2000,6000,10000][index])__V05.submit(events[index++]);if(age<15000)requestAnimationFrame(tick);else done();}requestAnimationFrame(tick);});
     const mean=a=>a.reduce((s,n)=>s+n,0)/a.length,sorted=raf.toSorted((a,b)=>a-b),gl=document.querySelector('#stage canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
     return{drawCallsMax,trianglesMax,seconds:(performance.now()-started)/1000,samples:raf.length,fps:1000/mean(raf),rafMean:mean(raf),rafP95:sorted[Math.floor(sorted.length*.95)],rafMax:sorted.at(-1),framesOver50ms:raf.filter(x=>x>50).length,cpuMean:mean(cpu),snapshot:__LiveDance.snapshot(),jsHeap:performance.memory?.usedJSHeapSize,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),dpr:devicePixelRatio,browser:navigator.userAgent,recording:false};
    },events);
    metrics.push({size,n,lineup,visible:initial.length,...result});await fs.writeFile('docs/v067/performance.json',JSON.stringify({metrics,errors:h.errors,complete:metrics.length===6,scenario:'15s: Follow at2/6/10; cap=n. Lineup ON: max five visible (+one transient outgoing), all n registered. Six 15-second samples, not a soak. No capture active.'},null,2));
    console.log(JSON.stringify({size,n,lineup,fps:result.fps,p95:result.rafP95,cpu:result.cpuMean}));
   }
  }
 }
 assert.deepEqual(h.errors,[]);
}finally{await h.close();}

