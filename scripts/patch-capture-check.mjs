import {harness} from './patch-capture-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
process.env.LIVEDANCE_CAPTURE='1';
const out='docs/preview-patch',h=await harness('external-capture',5533,true),p=h.page;
function tone(name,hz){
 const rate=16000,samples=rate*40,b=Buffer.alloc(44+samples*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
 b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*hz*Math.PI*2)*2200),44+i*2);
 return {name,mimeType:'audio/wav',buffer:b};
}
try{
 await p.keyboard.press('Escape');
 await p.locator('nav [data-nav="Audio"]').click();
 await p.getByRole('button',{name:'Activar audio',exact:true}).click();
 await p.locator('#music-file').setInputFiles([tone('Prueba local 330 Hz.wav',330),tone('Prueba local 440 Hz.wav',440)]);
 await p.waitForFunction(()=>__LiveDance.inspect().audio.state.tracks.length===2&&!__LiveDance.inspect().audio.busy);
 await p.locator('.audio-options summary').click();
 await p.getByLabel('Repetir',{exact:true}).selectOption('PLAYLIST');
 await p.getByLabel('Transición entre canciones',{exact:true}).selectOption('3');
 await p.getByRole('button',{name:'Reproducir',exact:true}).click();
 await p.waitForFunction(()=>__LiveDance.inspect().audio.playing);
 await p.evaluate(()=>{__V05.world.config.inactivity=3600;__V05.configure({idleDance:false,likeDance:false,groupDance:false,lineup:true});document.title='LiveDance PreviewPatch - PRUEBA LOCAL';});
 await h.fill(30);
 await p.locator('[data-action="clean"]').first().click();
 await fs.writeFile(out+'/capture-ready.json',JSON.stringify({time:new Date().toISOString(),url:p.url(),root:h.root,title:await p.title(),note:'Awaiting explicit local recording start; not LIVE.'},null,2));
 console.log('CAPTURE READY. Waiting docs/preview-patch/capture-start.json');
 for(;;){try{await fs.access(out+'/capture-start.json');break;}catch{}await p.waitForTimeout(1000);}
 const start=Date.now(),samples=[],events=[];let next=0,cycle=0;
 await p.evaluate(()=>{window.__captureFrames=[];let prev;window.__captureRunning=true;const tick=t=>{if(!window.__captureRunning)return;if(prev!==undefined)__captureFrames.push(t-prev);prev=t;requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 while(Date.now()-start<1805000){
  const age=Date.now()-start;
  if(age>=next){
   if(cycle===8){
    await p.keyboard.press('F8');events.push({age,action:'F8: intentional silence'});
    await p.waitForTimeout(3000);await p.getByRole('button',{name:'Reanudar',exact:true}).click();
    await p.keyboard.press('Escape');await p.locator('nav [data-nav="Audio"]').click();
    await p.getByRole('button',{name:'Activar audio',exact:true}).click();
    await p.getByRole('button',{name:'Reproducir',exact:true}).click();
    await p.locator('[data-action="clean"]').first().click();
    events.push({age:Date.now()-start,action:'explicit event and audio recovery'});
   }
   const kind=cycle%3;
   events.push({age,type:kind===0?'FOLLOW':kind===1?'VIP':'FEVER',result:kind===0?await h.send('FOLLOW','viewer-29',{username:'María José ✨'}):kind===1?await h.send('GIFT','viewer-28',{username:'Álex 🎁',giftName:'Galaxia',metadata:{tier:'HIGH'}}):await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'})});
   cycle++;next+=60000;
  }
  samples.push(await p.evaluate(()=>({at:new Date().toISOString(),metrics:__LiveDance.snapshot(),audio:__LiveDance.inspect().audio,show:__V05.inspect(),heap:performance.memory?.usedJSHeapSize})));
  await fs.writeFile(out+'/capture-live-progress.json',JSON.stringify({seconds:(Date.now()-start)/1000,samples,events,errors:h.errors},null,2));
  await p.waitForTimeout(10000);
 }
 const frames=await p.evaluate(()=>{window.__captureRunning=false;const f=window.__captureFrames,s=f.toSorted((a,b)=>a-b),mean=f.reduce((a,b)=>a+b,0)/f.length;return {samples:f.length,fps:1000/mean,p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1),over50:f.filter(x=>x>50).length};});
 await fs.writeFile(out+'/capture-runtime.json',JSON.stringify({seconds:(Date.now()-start)/1000,frames,samples,events,errors:h.errors,externalRecordingNeedsVerification:true},null,2));
 console.log('30 MINUTE RUNTIME FINISHED. Stop local recording now; browser stays open until capture-stop.json.');
 for(;;){try{await fs.access(out+'/capture-stop.json');break;}catch{}await p.waitForTimeout(1000);}
 assert.deepEqual(h.errors,[]);
}finally{await h.close();}
