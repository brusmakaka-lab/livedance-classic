import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('art-benchmark'),{page}=h,metrics=[],out='docs/v064/';page.setDefaultTimeout(30000);
try {
 await page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({idleDance:false,groupDance:false,likeDance:false});});
 for(const size of [{width:365,height:648},{width:720,height:1280}]) {
  await page.setViewportSize(size);
  for(const n of [1,10,20,30]) {
   await page.evaluate(n=>__V05.configure({featured:n<=10?10:n}),n);await h.fill(n);
   for(const artMode of ['BASE','CONCERT']) {
    await page.evaluate(artMode=>__V05.configure({artMode}),artMode);await page.waitForTimeout(6500);
    const framing=await page.evaluate(()=>__V05.framing());
    assert.equal(framing.length,n,'selected capacity must remain visible');
    assert(framing.every(f=>f.x0>=0&&f.x1<=1&&f.y0>=0&&f.y1<=1),'cropped body');
    const result=await page.evaluate(async()=>{
     const raf=[],cpu=[];let prev;const started=performance.now();
     await new Promise(done=>{function tick(t){if(prev!==undefined)raf.push(t-prev);prev=t;cpu.push(__LiveDance.snapshot().cpuMs);if(t-started<30000)requestAnimationFrame(tick);else done();}requestAnimationFrame(tick);});
     const mean=a=>a.reduce((s,n)=>s+n,0)/a.length,sorted=raf.toSorted((a,b)=>a-b),gl=document.querySelector('#stage canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
     return {seconds:(performance.now()-started)/1000,samples:raf.length,fps:1000/mean(raf),rafMean:mean(raf),rafP95:sorted[Math.floor(sorted.length*.95)],cpuMean:mean(cpu),snapshot:__LiveDance.snapshot(),jsHeap:performance.memory?.usedJSHeapSize,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),dpr:devicePixelRatio,browser:navigator.userAgent,recording:false};
    });
    const labels=await page.locator('.integration-name:not([hidden])').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(let i=0;i<labels.length;i++)for(const b of labels.slice(i+1)){const a=labels[i];assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'name overlap');}
    await page.screenshot({path:out+'evidence/'+artMode+'-'+size.width+'-'+n+'.png'});
    metrics.push({size,n,artMode,...result,framing,labels:labels.length});
    await fs.writeFile(out+'performance.json',JSON.stringify({metrics,errors:h.errors,complete:metrics.length===16},null,2));
    console.log(JSON.stringify({size,n,artMode,fps:result.fps,p95:result.rafP95,cpu:result.cpuMean}));
   }
  }
 }
 assert.deepEqual(h.errors,[]);
} finally {await fs.writeFile(out+'performance.json',JSON.stringify({metrics,errors:h.errors,complete:metrics.length===16},null,2));await h.close();}
