import {harness} from './v05-harness.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const h=await harness('stage-check',5483),p=h.page,checks=[],cycles=[];
const advance=s=>p.evaluate(s=>{for(let i=0;i<Math.ceil(s*30);i++)__V05.reviewFrame(1/30);},s);
try{
 await p.evaluate(()=>__V05.configure({idleDance:false,likeDance:false,groupDance:false}));await h.fill(30);
 await p.evaluate(()=>__V05.reviewControl(true));
 const identity=await p.evaluate(()=>__V05.inspect().actors.map(a=>[a.id,a.skinId]).sort());
 for(let i=0;i<3;i++){
  await h.send('FOLLOW','viewer-29');await advance(7.5);
  await h.send('GIFT','viewer-28',{giftId:'galaxy',giftName:'Galaxia',metadata:{tier:'HIGH'}});await advance(8.5);
  await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});await advance(23);
  assert.deepEqual(await p.evaluate(()=>__V05.inspect().actors.map(a=>[a.id,a.skinId]).sort()),identity);
  cycles.push(await p.evaluate(()=>__LiveDance.snapshot()));
 }
 checks.push('30 participants retain IDs and skins after three Follow/VIP/Fever cycles (accelerated time, not real soak)');
 await p.evaluate(()=>{const s=__V05.show;s.stage.update(1,120,true);window.__still=Array.from(s.stage.backdrop.instanceMatrix.array);s.stage.update(10,120,true);});
 assert(await p.evaluate(()=>JSON.stringify(__still)===JSON.stringify(Array.from(__V05.show.stage.backdrop.instanceMatrix.array))));
 await p.evaluate(()=>__V05.configure({stagePolish:false}));await advance(.1);assert.equal(await p.evaluate(()=>__V05.show.stage.backdrop.visible),false);
 await p.evaluate(()=>__V05.configure({stagePolish:true}));await advance(.1);assert.equal(await p.evaluate(()=>__V05.show.stage.backdrop.visible),true);
 await p.keyboard.press('F8');await advance(.1);const frozen=await p.evaluate(()=>Array.from(__V05.show.stage.backdrop.instanceMatrix.array));await advance(2);
 assert.deepEqual(await p.evaluate(()=>Array.from(__V05.show.stage.backdrop.instanceMatrix.array)),frozen);
 await p.getByRole('button',{name:'Reanudar',exact:true}).click();await advance(1);assert.equal((await p.evaluate(()=>__V05.inspect())).registered.length,30);
 checks.push('Polish reversible; new background stops with reduced motion and F8; controlled recovery retains all 30');
 assert.deepEqual(h.errors,[]);
}finally{await fs.writeFile('docs/v069/stage-check.json',JSON.stringify({checks,cycles,errors:h.errors,note:'Accelerated cycles; heap snapshots are not a real-duration leak test.'},null,2));await h.close();console.log({checks,errors:h.errors});}
