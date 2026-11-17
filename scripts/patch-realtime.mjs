import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
const variant=process.argv[2]||'patch';
const output='E:/LiveDance/LiveDance-v0.6.11-AudioSkins-test1/docs/preview-patch';
const h=await harness('realtime-'+variant,variant==='base'?5529:5527), results=[];
try {
 await h.page.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({idleDance:false,likeDance:false,groupDance:false});});
 for(const size of [{width:365,height:648},{width:720,height:1280}]) {
  await h.page.setViewportSize(size);
  for(const n of [10,30]) {
   await h.page.evaluate(n=>__V05.configure({featured:n,lineup:true,entrance:true,materialize:true}),n);
   await h.fill(n);
   const events=[];
   for(let cycle=0;cycle<3;cycle++) {
    events.push({at:cycle*45000+2000,event:h.event('FOLLOW','viewer-'+(n-1),{username:'Álex '+(n-1)})});
    events.push({at:cycle*45000+12000,event:h.event('GIFT','viewer-0',{username:'Río 0',giftName:'Estrella',metadata:{tier:'HIGH'},giftCount:1})});
    events.push({at:cycle*45000+26000,event:h.event('SIMULATED','viewer-1',{username:'Luna 1',giftId:'fever-demo'})});
   }
   const result=await h.page.evaluate(async ({events,n})=>{
    const raf=[],cpu=[],resources=[];let prev,index=0,nextSample=0,drawCallsMax=0,trianglesMax=0,visibleMax=0;
    const started=performance.now(),utc=new Date().toISOString();
    await new Promise(done=>{function tick(t){
     const age=t-started;if(prev!==undefined)raf.push(t-prev);prev=t;
     const snap=__LiveDance.snapshot();cpu.push(snap.cpuMs);drawCallsMax=Math.max(drawCallsMax,snap.drawCalls);trianglesMax=Math.max(trianglesMax,snap.triangles);
     if(index<events.length&&age>=events[index].at)__V05.submit(events[index++].event);
     if(age>=nextSample){const s=__V05.inspect();const visible=s.actors.filter(a=>a.visible).length;visibleMax=Math.max(visibleMax,visible);resources.push({seconds:age/1000,heap:performance.memory?.usedJSHeapSize,geometries:snap.geometries,textures:snap.textures,registered:s.actors.length,visible,queued:s.queued});nextSample+=10000;}
     if(age<150000)requestAnimationFrame(tick);else done();
    }requestAnimationFrame(tick);});
    const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,sorted=raf.toSorted((a,b)=>a-b),gl=document.querySelector('#stage canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {started:utc,seconds:(performance.now()-started)/1000,samples:raf.length,fps:1000/mean(raf),rafMean:mean(raf),p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:sorted.at(-1),over50:raf.filter(x=>x>50).length,cpuMean:mean(cpu),drawCallsMax,trianglesMax,visibleMax,resources,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),browser:navigator.userAgent,dpr:devicePixelRatio,quality:'MEDIUM',registered:n,expectedVisible:5,transientOutgoing:1,externalCapture:false};
   },{events,n});
   results.push({size,...result});
   await fs.writeFile(output+'/performance-'+variant+'.json',JSON.stringify({variant,hardware:{cpu:os.cpus()[0]?.model,ram:os.totalmem(),platform:os.platform()},results,errors:h.errors,complete:results.length===4},null,2));
   console.log(JSON.stringify({variant,size,n,seconds:result.seconds,fps:result.fps,p95:result.p95,p99:result.p99,max:result.max,over50:result.over50}));
  }
 }
}finally{await h.close();}
