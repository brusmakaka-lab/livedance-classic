import {harness} from './v05-harness.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const h=await harness('showdirector-pause',5562,true),p=h.page;
try{
 await h.fill(6);const before=await p.evaluate(()=>{__V05.show.pause();return __V05.inspect();});
 await p.evaluate(()=>__V05.configure({featured:30,lineup:false,backgroundNames:'COMPACT'}));await p.waitForTimeout(150);
 const paused=await p.evaluate(()=>__V05.inspect());assert.deepEqual(paused.camera,before.camera);assert.equal(paused.actors.filter(a=>a.visible).length,5);assert(!paused.showDirector.active);assert.equal(paused.showDirector.queue.length,0);
 await p.evaluate(()=>{__V05.show.resume();__V05.configure({lineup:true,backgroundNames:'FULL'});});await h.send('GIFT','viewer-5',{username:'VIP final',metadata:{tier:'HIGH'}});await p.waitForTimeout(500);const active=await p.evaluate(()=>__V05.inspect());assert.equal(active.showDirector.active.id,'viewer-5');assert.equal(active.actors.filter(a=>a.visible).length,5);
 await p.keyboard.press('Escape');await p.getByRole('button',{name:'Ajustes',exact:true}).count().catch(()=>0);
 assert.equal(await p.locator('[data-integration="lineup"]').count(),0);assert.equal(await p.locator('[data-integration="featured"]').count(),0);assert.equal(await p.locator('[data-integration="cinematic"]').count(),0);
 assert.deepEqual(h.errors,[]);await fs.writeFile('docs/showdirector/pause-results.json',JSON.stringify({status:'PASS',checks:['Paused camera remains identical','Legacy configuration cannot expand the director cast','F8-style cancellation and resume retain IDs','Resumed VIP uses five actors and correct ID'],errors:h.errors},null,2));console.log('Pause and configuration ownership PASS');
}finally{await h.close();}
