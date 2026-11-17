import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const variant=process.argv[2]||'patch',port=variant==='base'?5529:5527;
const out='E:/LiveDance/LiveDance-v0.6.11-AudioSkins-test1/docs/preview-patch';
const h=await harness('visual-'+variant,port,true),p=h.page,results=[];
try {
 for(const size of [{width:365,height:648},{width:720,height:1280}]){
  await p.setViewportSize(size);
  await p.evaluate(()=>{__V05.reviewControl(false);__V05.world.config.inactivity=3600;__V05.configure({idleDance:false,likeDance:false,groupDance:false,lineup:true,followSeconds:7,entranceDance:'MixamoBoxingLoop',backgroundDance:'AUTO'});});
  await h.fill(30);
  await p.evaluate(()=>{
   __V05.reviewControl(true);const s=__V05.show;
   s.events.clear();s.waiting=[];s.actors=new Map([...s.actors].sort(([a],[b])=>Number(a.split('-')[1])-Number(b.split('-')[1])));
   for(let i=0;i<360;i++)__V05.reviewFrame(1/60);
   s.time=0;s.director.initialized=false;
   [...s.actors.values()].forEach((a,i)=>{a.born=-100;a.player.set(i%3===2?'MixamoDance2Loop':'MixamoHipHopLoop',true);a.player.seek((i%5)*.27);});
   __V05.reviewFrame(0);
  });
  const samples=[];
  for(let f=0;f<=780;f++){
   if(f===60)await h.send('FOLLOW','viewer-29',{username:'María José ✨ de Córdoba'});
   if(f===300)await h.send('GIFT','viewer-28',{username:'Álex 🎁 Fernández López',giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});
   if(f===600)await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});
   await p.evaluate(dt=>__V05.reviewFrame(dt),f?1/30:0);
   if(f%15===0)samples.push(await p.evaluate(()=>({framing:__V05.framing(),event:__V05.inspect().event,registered:__V05.inspect().registered.length})));
   if([30,105,330,660].includes(f)){
    const labels=await p.locator('.integration-name:not([hidden])').evaluateAll(els=>els.map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON()})));
    if(variant==='patch'&&[105,330].includes(f))assert.equal(labels.length,0,'Priority banner identifies protagonist; no duplicate floating label over background faces');
    const banner=await p.locator('.integration-banner').evaluate(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON(),font:getComputedStyle(e.querySelector('span')||e).fontSize}));
    await p.waitForTimeout(220); // Let existing CSS opacity settle while controlled 3D time stays fixed.
    await p.screenshot({path:out+'/evidence/'+variant+'-'+size.width+'-t'+f/30+'.png'});
    results.push({size,time:f/30,labels,banner,actors:await p.evaluate(()=>__V05.inspect().actors)});
   }
  }
  assert(samples.every(s=>s.registered===30));
  assert(samples.flatMap(s=>s.framing).every(b=>b.x0>=0&&b.x1<=1&&b.y0>=.205&&b.y1<=.81));
  if(variant==='patch'){
   const names=await p.locator('.integration-name').allTextContents();assert(!names.includes('viewer-0'));assert(names.includes('Participante'));
   assert.equal(await p.evaluate(()=>__V05.world.spawn.dancers.get('viewer-0').username),'viewer-0');
   assert.equal(await p.locator('.integration-status').isVisible(),false);
  }
  results.push({size,samples});
 }
 if(variant==='patch'){
  // Optical zoom is a diagnostic hypothesis only, not a delivered setting.
  const zoom=await p.evaluate(()=>{
   const s=__V05.show,original=s.director.update.bind(s.director);
   const findings=[];let factor=1.1;
   s.director.update=function(...args){original(...args);args[0].zoom=factor;args[0].updateProjectionMatrix();};
   for(const clip of ['MixamoHipHopLoop',...s.catalog.map(c=>c.id)]){
    __V05.configure({backgroundDance:clip});
    for(let i=0;i<360;i++){__V05.reviewFrame(1/30);const top=s.ledWall?.root.visible ? .265 : .225;if(i%6===0)for(const b of __V05.framing())if(b.x0<.04||b.x1>.96||b.y0<top||b.y1>.81)findings.push({clip,t:i/30,top,...b});}
   }
   factor=1;__V05.reviewFrame(0);s.director.update=original;
   return {factor:1.1,safe:findings.length===0,violations:findings,safeArea:{x:[.04,.96],y:[.225,.81]}};
  });
  results.push({zoomHypothesis:zoom});
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.evaluate(()=>{__V05.show.entertainment.config.reduceMotion=true;});
  await h.send('FOLLOW','viewer-29',{username:'María José ✨'});await p.evaluate(()=>__V05.reviewFrame(1/30));
  assert.equal(await p.locator('.integration-banner').evaluate(e=>e.style.transform),'none');
 }
 assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile(out+'/visual-'+variant+'.json',JSON.stringify({results,errors:h.errors,offline:true,note:'Same deterministic five built-in skins, 30 registered, event times and camera. No explicit VIP cleanup. Not performance or audio evidence.'},null,2));await h.close();console.log({variant,entries:results.length,errors:h.errors});}
