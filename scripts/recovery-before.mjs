import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
if(JSON.parse(await fs.readFile('package.json','utf8')).name==='livedance-stage-recovery')throw Error('Baseline evidence must be captured on a disposable, unmodified StageAlive copy, before building Recovery. Do not overwrite the supplied baseline.');
const h=await harness('recovery-before',5556,true),p=h.page,out='docs/stage-recovery';
const tick=n=>p.evaluate(n=>{for(let i=0;i<n;i++)__V05.reviewFrame(.1);},n);
const observations=[];
async function ready(n){for(let i=0;i<100;i++){await tick(1);if(await p.evaluate(n=>__V05.inspect().actors.length===n,n))return;await p.waitForTimeout(40);}throw Error('load timeout');}
async function capture(name){await p.evaluate(()=>{document.querySelector('#toast').hidden=true;__V05.reviewControl(false);});await p.waitForTimeout(80);await p.locator('#stage').screenshot({path:`${out}/before-${name}.png`});await p.evaluate(()=>__V05.reviewControl(true));}
async function sample(name){const data=await p.evaluate(()=>{const s=__V05.inspect(),stage=__V05.show.stage;return {...s,vipHalo:stage.halo.position.toArray(),vipCrown:stage.crown.position.toArray()};});observations.push({name,...data});return data;}
try{
 await fs.mkdir(out,{recursive:true});await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({backgroundNames:'FULL',motion:'SUAVE'});});
 for(const n of [1,3,5]){
  await p.evaluate(()=>__V05.reset());for(let i=0;i<n;i++)await h.send('VIEWER_JOIN','viewer-'+i,{username:['Río','Luna','Sol','Nova','Álex'][i]});await ready(n);await tick(300);await sample('steady-'+n);await capture('steady-'+n);
 }
 await h.send('COMMENT','viewer-5',{username:'Mismo nombre'});await ready(6);await tick(12);await sample('welcome');await capture('welcome');
 await h.send('GIFT','viewer-3',{username:'Mismo nombre',giftName:'VIP fixture',coins:1000,metadata:{tier:'HIGH'}});await tick(2);await sample('vip-transition');await capture('vip-transition');await tick(125);
 for(let i=6;i<9;i++)await h.send('VIEWER_JOIN','viewer-'+i,{username:'Participante '+i});await ready(9);
 let tiny=[],missing=[],maxVisible=0;
 for(let i=0;i<160;i++){
  await tick(1);const s=await p.evaluate(()=>__V05.inspect());
  const visible=s.actors.filter(a=>a.visible);maxVisible=Math.max(maxVisible,visible.length);
  if(visible.some(a=>a.scale<.7))tiny.push({frame:i,cue:s.effectiveCue,actors:visible.filter(a=>a.scale<.7)});
  if(visible.length>=5&&s.labels.filter(a=>a.visible).length<5)missing.push(i);
  if(i===49)await capture('replacement');
 }
 await fs.writeFile(`${out}/before.json`,JSON.stringify({observations,tinyFrames:tiny,maxVisible,framesWithMissingLabels:missing.length,errors:h.errors},null,2));
 console.log(JSON.stringify({labels:observations.map(s=>[s.name,s.actors.filter(a=>a.visible).length,s.labels.filter(a=>a.visible).length]),tinyFrames:tiny.length,maxVisible,missing:missing.length,errors:h.errors}));
}finally{await h.close();}
