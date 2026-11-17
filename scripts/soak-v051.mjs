import { harness } from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('soak-v051');
const {page}=h, samples=[], cycles=[], checks=[];
const seconds=Number(process.env.LIVEDANCE_SOAK_SECONDS||600);
const read=()=>page.evaluate(()=>({show:window.__V05.inspect(),app:window.__LiveDance.inspect(),metrics:window.__LiveDance.snapshot(),heap:performance.memory?.usedJSHeapSize}));
const nav=async()=>{await page.evaluate(()=>document.body.classList.remove('clean'));await page.locator('nav').getByRole('button',{name:'Audio',exact:true}).click();};
const clean=()=>page.evaluate(()=>document.body.classList.add('clean'));
function tone(name,hz){const rate=8000,n=rate*12,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*hz*Math.PI*2)*1000),44+i*2);return{name,mimeType:'audio/wav',buffer:b};}
let started, baseline, progressTimer;
async function audioPlay(){await nav();await page.getByRole('button',{name:'Activar audio',exact:true}).click();await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>window.__LiveDance.inspect().audio.playing);await clean();}
async function save(status,error){await fs.writeFile('docs/v06/soak.json',JSON.stringify({status,error,requestedSeconds:seconds,elapsedSeconds:started?(Date.now()-started)/1000:0,checks,samples,cycles,errors:h.errors,observer:await page.evaluate(()=>window.__soak??null).catch(()=>null),notes:['Real wall clock; no simulation time acceleration.','Synthetic original WAV tracks. Not real music or OS/OBS audio capture.','JS heap after CDP GC is not process RAM or GPU VRAM.','30 registered / up to 10 featured; clean view 720x1280 MEDIUM.']},null,2));}
try{
 await page.setViewportSize({width:720,height:1280});
 await page.evaluate(()=>{window.__V05.world.config.inactivity=3600;});
 await nav();await page.waitForFunction(()=>window.__LiveDance.inspect().audio.status!=='Silenciado');
 await page.locator('#music-file').setInputFiles([tone('Soak A - original.wav',220),tone('Soak B - original.wav',330)]);
 await page.waitForFunction(()=>window.__LiveDance.inspect().audio.state.tracks.length===2&&!window.__LiveDance.inspect().audio.busy);
 await page.getByLabel('Repeat',{exact:true}).selectOption('PLAYLIST');await page.getByLabel('Crossfade',{exact:true}).selectOption('3');
 for(const [key,value]of [['master','0.4'],['music','0.5'],['effects','0.3']]){const slider=page.locator('#cfg-'+key);await slider.fill(value);await slider.dispatchEvent('change');}
 const config=(await read()).app.config;assert.equal(config.master,.4);assert.equal(config.music,.5);assert.equal(config.effects,.3);checks.push('Master/music/effects controls apply');
 await h.fill(30);await audioPlay();
 baseline=(await read()).show.actors.map(a=>[a.id,a.skinId]).sort();
 await page.evaluate(()=>{window.__soak={ticks:0,maxDecks:0,maxVoices:0,fadingTicks:0,duckedTicks:0,trackChanges:0,cues:{},failures:[],last:null};window.__soakTimer=setInterval(()=>{const s=window.__soak,a=window.__LiveDance.inspect().audio;s.ticks++;s.maxDecks=Math.max(s.maxDecks,a.decks.length);s.maxVoices=Math.max(s.maxVoices,a.voices);if(a.fading)s.fadingTicks++;if(a.duck<.7)s.duckedTicks++;if(a.state.currentId!==s.last){s.trackChanges++;s.last=a.state.currentId;}if(a.voices&&a.lastCue)s.cues[a.lastCue]=(s.cues[a.lastCue]||0)+1;if(a.decks.length>2||a.voices>4)s.failures.push('audio budget exceeded');},100);});
 const before=(await read()).app.entertainment;
 const like=h.event('LIKE_MILESTONE','viewer-0');assert.equal((await page.evaluate(e=>window.__V05.submit(e),like)).accepted,true);assert.equal((await page.evaluate(e=>window.__V05.submit(e),like)).reason,'duplicate');
 await page.waitForFunction(n=>window.__LiveDance.inspect().entertainment.goals.like===n+1,before.goals.like);
 assert.ok((await read()).app.entertainment.hype>before.hype);checks.push('Like milestone raises Hype/goal once after duplicate');
 started=Date.now();
 progressTimer=setInterval(()=>console.log('Soak elapsed',((Date.now()-started)/1000).toFixed(0),'s'),30000);
 const cdp=await page.context().newCDPSession(page);
 for(let step=0;Date.now()-started<seconds*1000;step++){
   const stepStart=Date.now();
   if(step%6===0&&step>0){
     await page.keyboard.press('F8');const stopped=await read();assert.equal(stopped.show.paused,true);assert.equal(stopped.app.audio.playing,false);assert.ok(stopped.app.audio.decks.every(d=>d.paused));assert.equal(stopped.app.config.mute,true);assert.equal((await h.send('FOLLOW','blocked')).reason,'paused');
     const camera=stopped.show.camera;await page.waitForTimeout(500);assert.deepEqual((await read()).show.camera,camera);
     assert.deepEqual(stopped.show.actors.map(a=>[a.id,a.skinId]).sort(),baseline);
     await page.getByRole('button',{name:'Reanudar',exact:true}).click();assert.equal((await read()).app.audio.playing,false);
     await page.evaluate(()=>window.__V05.reset());await page.waitForTimeout(1000);await cdp.send('HeapProfiler.collectGarbage');const empty=await read();assert.equal(empty.show.actors.length,0);assert.equal(empty.show.queued,0);assert.equal(empty.show.pending,0);cycles.push({step,heap:empty.heap,geometries:empty.metrics.geometries,textures:empty.metrics.textures});
     await h.fill(30);assert.deepEqual((await read()).show.actors.map(a=>[a.id,a.skinId]).sort(),baseline);await audioPlay();
   }
   const kind=step%4;
   if(kind===0)await h.send('FOLLOW','viewer-'+step%30);
   if(kind===1)await h.send('GIFT','viewer-29',{giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});
   if(kind===2)await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});
   if(kind===3)await h.send('GIFT','viewer-12',{giftId:'rose',giftName:'Rosa',giftCount:5,metadata:{tier:'NORMAL'}});
   await h.send('LIKE_MILESTONE','viewer-1');
   if(step===1){await page.waitForTimeout(1800);await page.screenshot({path:'docs/v06/evidence/mvp-vip-720.png'});}
   if(step===2){await page.waitForTimeout(1800);await page.screenshot({path:'docs/v06/evidence/mvp-fever-720.png'});}
   await page.waitForTimeout(Math.max(0,Math.min(30000-(Date.now()-stepStart),seconds*1000-(Date.now()-started))));
   await cdp.send('HeapProfiler.collectGarbage');const s=await read();
   assert.equal(s.show.failure,'');assert.equal(s.show.registered.length,30);assert.deepEqual(s.show.actors.map(a=>[a.id,a.skinId]).sort(),baseline);assert.equal(s.app.audio.playing,true);assert.ok(s.show.queued<=12);assert.ok(s.metrics.ingressQueued<=128);assert.deepEqual(s.app.errors,[]);
   samples.push({step,elapsed:(Date.now()-started)/1000,heap:s.heap,metrics:s.metrics,registered:s.show.registered.length,visible:s.show.actors.filter(a=>a.visible).length,queued:s.show.queued,cache:s.show.cache,audio:s.app.audio});await save('RUNNING');
 }
 const observer=await page.evaluate(()=>window.__soak);assert.ok(observer.fadingTicks>0);assert.ok(observer.duckedTicks>0);assert.ok(observer.trackChanges>10);assert.ok(observer.maxVoices>0);assert.deepEqual(observer.failures,[]);assert.deepEqual(h.errors,[]);
 assert.equal(new Set(cycles.map(c=>c.geometries)).size,1);assert.equal(new Set(cycles.map(c=>c.textures)).size,1);
 checks.push('Repeated crossfade, bounded 2 decks / 4 sound voices, VIP ducking','F8 silences/stops, freezes camera, rejects ingress; resume leaves audio off','3 scene resets and rejoins preserve skin identity; empty resource counts stable');
 await save('PASS');console.log('Soak PASS',((Date.now()-started)/1000).toFixed(1),'seconds',samples.length,'samples',cycles.length,'resets');
}catch(e){await save('FAIL',String(e.stack));throw e;}finally{clearInterval(progressTimer);await page.evaluate(()=>clearInterval(window.__soakTimer)).catch(()=>{});await h.close();}
