import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('recovery-check',5556,true),p=h.page,out='docs/stage-recovery',checks=[],metrics=[];
let frames=0,maxCorrectionJump=0;const previous=new Map();
const tick=n=>p.evaluate(n=>{for(let i=0;i<n;i++)__V05.reviewFrame(1/60);},n);
const state=()=>p.evaluate(()=>__V05.inspect());
async function ready(n){for(let i=0;i<100;i++){await tick(6);if((await state()).actors.length===n)return;await p.waitForTimeout(40);}throw Error('load '+n);}
async function sample(tag,track=false){
 const data=await p.evaluate(()=>{
  const s=__V05.inspect(),show=__V05.show,stage=document.querySelector('#stage'),w=stage.clientWidth,h=stage.clientHeight;
  const labels=[...show.actors].filter(([id,a])=>!a.label.hidden).map(([id,a])=>{
   return {id,text:a.label.querySelector('.name-text').textContent,hero:a.label.dataset.protagonist==='true',x:parseFloat(a.label.style.left),y:parseFloat(a.label.style.top),rect:{w:a.label.offsetWidth,h:a.label.offsetHeight},anchor:a.label.dataset.anchorY?Number(a.label.dataset.anchorY):undefined};
  });
  return {s,labels,width:w,height:h,halo:{id:show.stage.halo.userData.viewerId,position:show.stage.halo.position.toArray(),visible:show.stage.halo.visible},crown:{id:show.stage.crown.userData.viewerId,position:show.stage.crown.position.toArray(),visible:show.stage.crown.visible}};
 });
 frames++;
 const visible=data.s.actors.filter(a=>a.visible),ids=visible.map(a=>a.id),e=data.s.effectiveCue;
 assert.equal(new Set(ids).size,ids.length);assert(visible.length<=5,tag+' sixth actor');
 if(data.s.actors.length>=5)assert.equal(visible.length,5,tag+' empty seat with ready actors');
 for(const a of visible)assert.equal(a.scale,1,tag+' miniature '+a.id);
 if(data.s.config.backgroundNames!=='OFF')assert.deepEqual(data.labels.map(l=>l.id).sort(),ids.slice().sort(),tag+' missing/misattributed labels');
 for(const l of data.labels){
  assert(l.x>=0&&l.x<=data.width&&l.y>=l.rect.h&&l.y<=data.height,tag+' invalid label projection');
  const text=await p.evaluate(id=>__V05.world.spawn.dancers.get(id).username,l.id);
  assert(data.s.config.backgroundNames==='COMPACT'&&!l.hero ? l.text.startsWith(Array.from(text).slice(0,10).join('')) : l.text===text,tag+' name/ID mismatch');
  if(track&&l.anchor!==undefined){
   const offset=(l.y-l.anchor)*365/data.width,old=previous.get(l.id);
   if(old!==undefined)maxCorrectionJump=Math.max(maxCorrectionJump,Math.abs(offset-old));
   previous.set(l.id,offset);
  }
 }
 if(e&&e.kind==='welcome'){
  const actor=visible.find(a=>a.id===e.id);assert(actor,tag+' hidden welcome owner');
  assert(Math.hypot(actor.position[0],actor.position[2])<.002,tag+' welcome is not at original foreground');
  assert(data.labels.some(l=>l.id===e.id&&l.hero),tag+' missing protagonist name');
  assert.equal(e.duration,5);
 }
 if(e?.kind==='vip'){
  const actor=visible.find(a=>a.id===e.id);assert(actor);
  assert.equal(data.halo.id,e.id);assert.equal(data.crown.id,e.id);assert.equal(data.s.vipBinding.id,e.id);
  assert(data.labels.some(l=>l.id===e.id&&l.hero));
  assert(data.crown.position.every((n,i)=>Math.abs(n-actor.position[i])<1e-7));
  assert(data.halo.position.every((n,i)=>Math.abs(n-actor.position[i]-[0,1.75,-1.45][i])<1e-7));
 }
 return data;
}
async function capture(name){await p.evaluate(()=>{document.querySelector('#toast').hidden=true;__V05.reviewControl(false);});await p.waitForTimeout(80);await p.locator('#stage').screenshot({path:`${out}/after-${name}.png`});await p.evaluate(()=>__V05.reviewControl(true));}
async function fps(count){await p.evaluate(()=>__V05.reviewControl(false));const value=await p.evaluate(()=>new Promise(resolve=>{const t=[];let last;const f=x=>{if(last)t.push(x-last);last=x;if(t.length<105)return requestAnimationFrame(f);const a=t.slice(15).sort((a,b)=>a-b);resolve({medianFps:1000/a[45],p95Ms:a[85]});};requestAnimationFrame(f);}));await p.evaluate(()=>__V05.reviewControl(true));metrics.push({count,...value});}
try{
 await fs.mkdir(out,{recursive:true});await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({backgroundNames:'FULL',motion:'SUAVE'});});
 let camera;
 for(const n of [1,3,5]){
  await p.evaluate(()=>__V05.reset());for(let i=0;i<n;i++)await h.send('VIEWER_JOIN','viewer-'+i,{username:['Río','Luna','Sol','Nova','Álex'][i]});await ready(n);
  let presented=new Set();
  for(let i=0;i<n*300+40;i++){await tick(1);if(i%6===0){const d=await sample('arrivals-'+n);if(d.s.effectiveCue?.kind==='welcome')presented.add(d.s.effectiveCue.id);}}
  assert.equal(presented.size,n);const s=await state();assert.equal(s.spotlight.completed,n);
  camera??=s.camera;assert.deepEqual(s.camera,camera);await capture('steady-'+n);await fps(n);
 }
 checks.push('1/3/5: every ready welcome owner is full size at the original foreground, with the matching name and five-second duration; constant original camera');
 await h.send('COMMENT','viewer-5',{username:'Mismo nombre'});await ready(6);await tick(60);await sample('welcome');await capture('welcome');
 const age=(await state()).effectiveCue.age;
 await h.send('GIFT','viewer-3',{username:'Mismo nombre',giftName:'VIP fixture',coins:1000,metadata:{tier:'HIGH'}});
 for(let i=0;i<120;i++){await tick(1);await sample('VIP moving during welcome');}
 await capture('vip-transition');
 await p.evaluate(()=>{for(let i=0;i<150;i++)__V05.submit({schemaVersion:1,source:'simulator',viewerId:'viewer-0',username:'Río',eventId:'likes-recovery-'+i,eventType:'LIKE_MILESTONE',giftCount:1,timestamp:Date.now(),metadata:{}});});
 let resumed=false;
 for(let i=0;i<2200;i++){await tick(1);if(i%6===0){const d=await sample('vip-return');if(d.s.effectiveCue?.kind==='welcome'&&d.s.effectiveCue.id==='viewer-5')resumed=true;if(d.s.spotlight.completed===6)break;}}
 await tick(60);
 assert(resumed);assert.equal((await state()).spotlight.started,6);assert.equal((await state()).spotlight.completed,6);
 const returned=(await state()).actors.find(a=>a.id==='viewer-5');assert(returned.visible&&returned.position[2]<-1);
 checks.push('VIP preempts and releases an existing welcome; two different IDs with identical names keep distinct body/name/halo/crown ownership, including moving frames; burst of 150 like attempts (120 admitted by the existing limiter) does not steal or extend welcome; owner returns visibly behind foreground');
 for(let i=6;i<9;i++)await h.send('VIEWER_JOIN','viewer-'+i,{username:'Participante '+i});await ready(9);
 for(let i=0;i<2200;i++){await tick(1);if(i%6===0){const d=await sample('replacement-nine');if(d.s.spotlight.completed===9)break;}if(i===400)await capture('replacement');}
 assert.equal((await state()).spotlight.completed,9);
 await p.evaluate(()=>__V05.show.next());await tick(1);await sample('manual-page');
 checks.push('Nine registered participants, exactly five ready visible throughout replacement and manual page changes; no artificial exit wait, no shrinking sixth actor');
 await h.send('SIMULATED','viewer-0',{username:'Río',giftId:'fever-demo'});await tick(150);await sample('fever');await capture('fever');await tick(700);
 for(const viewport of [{width:365,height:648},{width:540,height:960},{width:1080,height:1920}])for(const mode of ['FULL','COMPACT']){
  await p.setViewportSize(viewport);await p.waitForTimeout(60);await p.evaluate(mode=>__V05.configure({backgroundNames:mode}),mode);
  previous.clear();for(let i=0;i<120;i++){await tick(1);await sample('labels-'+mode,true);}
  await capture(mode.toLowerCase()+'-'+viewport.width);
 }
 checks.push('Fever and FULL/COMPACT labels in 365x648, 540x960 and 1080x1920; every visible ID retains its name');
 await p.evaluate(()=>__V05.configure({backgroundNames:'OFF'}));await h.send('FOLLOW','viewer-8',{username:'Participante 8'});await tick(70);const off=await sample('names-off');assert.equal(off.labels.length,1);assert(off.labels[0].hero);
 assert(maxCorrectionJump<=55/60+.02,'Corrective label motion must remain bounded each frame');
 assert.deepEqual(h.errors,[]);
 const result={status:'PASS',checks,frames,metrics,maxCorrectionJump,errors:h.errors,scope:'Simulator only; no real LIVE or OBS encoding'};
 await fs.writeFile(`${out}/simulator-results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await p.screenshot({path:`${out}/FAILURE.png`});await fs.writeFile(`${out}/failure.json`,JSON.stringify({error:String(error),state:await state()},null,2));throw error;}
finally{await h.close();}
