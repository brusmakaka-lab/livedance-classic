import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
const h=await harness('v06-final-metric');
try{
 await h.page.setViewportSize({width:720,height:1280});await h.page.evaluate(()=>window.__V05.configure({featured:30}));await h.fill(30);
 await h.send('GIFT','viewer-29',{giftId:'galaxy',giftName:'Fixture',metadata:{tier:'HIGH'}});
 const data=await h.page.evaluate(async()=>{
  const raf=[],cpu=[];let previous;
  await new Promise(resolve=>{const end=performance.now()+10000;function tick(t){if(previous!==undefined)raf.push(t-previous);previous=t;cpu.push(window.__LiveDance.snapshot().cpuMs);if(t<end)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
  const avg=a=>a.reduce((s,n)=>s+n,0)/a.length;
  return {fps:1000/avg(raf),frameMs:avg(raf),p95RAF:raf.toSorted((a,b)=>a-b)[Math.floor(raf.length*.95)],cpuMs:avg(cpu),metrics:window.__LiveDance.snapshot(),show:window.__V05.inspect(),framing:window.__V05.framing()};
 });
 await fs.writeFile('docs/v061/final-metric.json',JSON.stringify({note:'Final build, 30 registered/aforo30, 720x1280 MEDIUM, 10 seconds covering VIP and return. No vertex diagnostics during timing.',...data,errors:h.errors},null,2));
 console.log(JSON.stringify({fps:data.fps,p95RAF:data.p95RAF,cpuMs:data.cpuMs,registered:data.show.registered.length,errors:h.errors}));
}finally{await h.close();}
