import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
const results=[];
for(const materialize of [false,true]){
 const h=await harness('cold-'+materialize,5458);
 try{
  await h.page.evaluate(materialize=>__V05.configure({materialize,lineup:true,idleDance:false,likeDance:false,groupDance:false}),materialize);
  await h.fill(1);
  const events=[h.event('FOLLOW','viewer-0'),h.event('FOLLOW','viewer-0')];
  const r=await h.page.evaluate(async events=>{
   const frames=[],long=[];let previous,index=0;const start=performance.now();
   await new Promise(done=>{function tick(t){
    const age=t-start;
    if(previous!==undefined){const dt=t-previous;frames.push(dt);if(dt>45){const s=__V05.inspect();long.push({at:age,dt,event:s.event,snapshot:__LiveDance.snapshot()});}}
    previous=t;
    if(index<2&&age>[1000,5000][index])__V05.submit(events[index++]);
    if(age<9500)requestAnimationFrame(tick);else done();
   }requestAnimationFrame(tick);});
   return{duration:(performance.now()-start)/1000,fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),max:Math.max(...frames),long};
  },events);
  results.push({materialize,...r,errors:h.errors});console.log({materialize,fps:r.fps,max:r.max,long:r.long.map(x=>({at:x.at,dt:x.dt,event:x.event}))});
 }finally{await h.close();}
}
await fs.writeFile('docs/v067/first-event-comparison.json',JSON.stringify({results,note:'Fresh browser context per mode; one registered/visible character; two Follow events at 1s and 5s. Runtime shader/caching and OS load may differ. Not a production-capture test.'},null,2));
