import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('rotation-capacity',5585,true),p=h.page,out='docs/grouprotation',results=[];
try{
 await p.evaluate(()=>__V05.reviewControl(true));for(let i=0;i<10;i++)await h.send('VIEWER_JOIN','viewer-'+i,{username:'Participante '+i});
 for(let i=0;i<150;i++){await p.evaluate(()=>{for(let j=0;j<20;j++)__V05.reviewFrame(.05);});if(await p.evaluate(()=>__V05.inspect().actors.length===10))break;await p.waitForTimeout(40);}
 await p.evaluate(()=>{for(let i=0;i<1500;i++)__V05.reviewFrame(.05);});
 for(const width of [540,1080]){await p.setViewportSize({width,height:width*16/9});await p.waitForTimeout(80);
  for(const capacity of [6,8,10])for(const layout of ['ROWS','ARC']){
   await p.evaluate(({capacity,layout})=>{__V05.configure({visibleCapacity:capacity,groupLayout:layout});for(let i=0;i<120;i++)__V05.reviewFrame(.05);__V05.reviewControl(false);window.measureIntervals=[];let last=performance.now();window.measureDone=false;const generation=window.measureGeneration=(window.measureGeneration||0)+1;function frame(now){if(generation!==window.measureGeneration||measureDone)return;if(now>last)measureIntervals.push(now-last);last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);},{capacity,layout});
   await p.waitForTimeout(2500);
   await p.waitForFunction(()=>measureIntervals.length>=45);
   const result=await p.evaluate(()=>{window.measureDone=true;const s=__V05.inspect(),f=__V05.framing(),intervals=measureIntervals.slice(15).sort((a,b)=>a-b),labels=[...__V05.show.actors.values()].filter(a=>!a.label.hidden).map(a=>a.label.getBoundingClientRect());let overlaps=0;for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];if(Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top))overlaps++;}return {shot:s.showDirector.shot,visible:s.actors.filter(a=>a.visible).length,uniqueSlots:new Set(s.actors.filter(a=>a.visible).map(a=>a.slot)).size,fullBodies:f.filter(f=>f.x0>=0&&f.x1<=1&&f.y0>=.15&&f.y1<=.96).length,labels:s.labels.filter(l=>l.visible).length,labelOverlaps:overlaps,fps:1000/intervals[Math.floor(intervals.length/2)],samples:intervals.length,framing:f};});
   assert.equal(result.visible,capacity);assert.equal(result.uniqueSlots,capacity);assert.equal(result.shot,'WIDE');await p.locator('#stage').screenshot({path:`${out}/EVAL-${capacity}-${layout}-${width}.png`});results.push({width,capacity,layout,...result});console.log(JSON.stringify({width,capacity,layout,full:result.fullBodies,labels:result.labels,fps:result.fps}));await p.evaluate(()=>__V05.reviewControl(true));
  }
 }
 assert.deepEqual(h.errors,[]);await fs.writeFile(out+'/capacity-results.json',JSON.stringify({status:'MEASURED',defaultCapacity:5,experimental:true,scope:'WIDE only; these presets are not promoted to a validated LIVE capacity',results,errors:h.errors},null,2));
}finally{await h.close();}
