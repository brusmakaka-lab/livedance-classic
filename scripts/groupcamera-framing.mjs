import {harness} from './v05-harness.mjs';
import {installAudit} from './showdirector-audit.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('groupcamera-framing',5573,true),p=h.page,out='docs/groupcamera',samples=[];
// Advance idle intervals in bounded 100 ms steps; measured poses still use 60 Hz.
async function tick(n){await p.evaluate(n=>{for(let i=0;i<n;i+=6)__V05.reviewFrame(Math.min(6,n-i)/60);},n);}
try{
 await p.evaluate(()=>{__V05.reviewControl(true);__V05.configure({backgroundNames:'FULL',motion:'SUAVE'});});
 for(const size of [{width:365,height:648},{width:540,height:960},{width:360,height:720},{width:1080,height:1920}]){
  await p.setViewportSize(size);await p.waitForTimeout(60);
  for(const count of [1,3,5]){
   console.log(`Measuring ${size.width}x${size.height}, ${count} actors`);
   await p.evaluate(()=>{__V05.reset();__V05.world.config.afk=false;});
   for(let i=0;i<count;i++)await h.send('VIEWER_JOIN','viewer-'+i,{username:'Bailarín '+i});
   for(let i=0;i<150;i++){await tick(6);if(await p.evaluate(n=>__V05.inspect().actors.length===n,count))break;await p.waitForTimeout(30);}
   await tick(1900);
   for(let id=0;id<count;id++)for(const type of ['FOLLOW','GIFT']){
    await h.send(type,'viewer-'+id,{username:'Bailarín '+id,metadata:{tier:'HIGH'}});await tick(210);
    for(let i=0;i<3;i++){
     const result=await p.evaluate(()=>{
      const scene=__V04.debug.scene,show=__V05.show,camera=scene.camera,e=show.director.active,actor=show.actors.get(e.id),owner=actor.rig.root.position;
      const legacy=camera.clone(),vip=e.kind==='vip',offset=owner.clone().set((owner.x>=0?1:-1)*2.6,3.8,(vip?10.8:11.8)*Math.max(1,(365/648)/camera.aspect));legacy.position.copy(owner).add(offset);legacy.lookAt(owner.clone().add(owner.clone().set(0,vip?2.3:1.85,0)));legacy.updateMatrixWorld();
      const before=show.framing(legacy),after=show.framing(camera),full=f=>f.x0>=0&&f.x1<=1&&f.y0>=.18&&f.y1<=.96;
      return {shot:show.director.shot,id:e.id,before,after,fullBefore:before.filter(full).length,fullAfter:after.filter(full).length,principalFull:full(after.find(f=>f.id===e.id)),pitchDegrees:Math.asin(-camera.getWorldDirection(owner.clone()).y)*180/Math.PI};
     });samples.push({size,count,...result});await p.evaluate(()=>{for(let j=0;j<12;j++)__V05.reviewFrame(1/60);});
    }
    if(size.width===540&&(id===0||id===count-1)){
     await p.evaluate(()=>{__V05.reviewControl(false);document.querySelector('#toast').hidden=true;});await p.waitForTimeout(50);await p.locator('#stage').screenshot({path:`${out}/${type==='GIFT'?'VIP':'HERO'}-${count}-ID${id}.png`});await p.evaluate(()=>__V05.reviewControl(true));
    }
    await tick(500);
   }
  }
 }
 const group=samples.filter(s=>s.count===5),mean=(key)=>group.reduce((sum,s)=>sum+s[key],0)/group.length;
 const summary={samples:samples.length,meanFullBefore:mean('fullBefore'),meanFullAfter:mean('fullAfter'),principalFailures:samples.filter(s=>!s.principalFull),errors:h.errors};
 await fs.writeFile(out+'/framing-results.json',JSON.stringify({summary,samples,baseline:'Settled v0.6.13 camera pose projected onto the same animated meshes; original source parameters, no second application or changed actors'},null,2));
 assert.deepEqual(h.errors,[]);assert.equal(summary.principalFailures.length,0);assert(summary.meanFullAfter>summary.meanFullBefore+.5);
 console.log(JSON.stringify({...summary,principalFailures:summary.principalFailures.length}));
}finally{await h.close();}
