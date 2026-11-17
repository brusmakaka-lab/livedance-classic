import {harness} from './v05-harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const h=await harness('arrival-new-follow',5456),checks=[];
try{
 await h.page.evaluate(()=>{__V05.configure({lineup:true,materialize:true,idleDance:false,likeDance:false,groupDance:false});__V05.reset();});
 const e=h.event('FOLLOW','new-viewer',{username:'Primer ingreso'});
 assert((await h.page.evaluate(e=>__V05.submit(e),e)).accepted);
 await h.page.waitForFunction(()=>__V05.inspect().actors.some(a=>a.id==='new-viewer'));
 assert.equal((await h.page.evaluate(e=>__V05.submit(e),e)).reason,'duplicate');
 await h.page.waitForTimeout(4000);
 const first=await h.page.evaluate(()=>__V05.inspect());
 assert.equal(first.registered.length,1);
 assert.equal(first.actors.length,1);
 assert(first.actors[0].skinId);
 checks.push('First Follow creates a participant with skin from an empty scene; duplicate creates none');
 await h.send('FOLLOW','new-viewer',{username:'Primer ingreso'});
 await h.page.waitForTimeout(4000);
 const next=await h.page.evaluate(()=>__V05.inspect());
 assert.deepEqual(next.actors.map(a=>[a.id,a.skinId]),first.actors.map(a=>[a.id,a.skinId]));
 assert.equal(next.actors[0].scale,1);
 assert.equal(next.actors[0].opacity,1);
 checks.push('A later Follow for the same viewer retains skin and a single participant, ending full-size and opaque');
 assert.deepEqual(h.errors,[]);
}finally{
 await fs.writeFile('docs/v067/admission.json',JSON.stringify({checks,errors:h.errors},null,2));
 await h.close();console.log({checks,errors:h.errors});
}
