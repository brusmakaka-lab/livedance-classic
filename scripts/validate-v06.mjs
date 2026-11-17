import { harness } from './v05-harness.mjs';
import { LiveAdapter } from '../connector/adapter.mjs';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const h = await harness('v06-fixtures');
const {page} = h, checks=[];
page.setDefaultTimeout(20000);
class Fixture extends EventEmitter { static current; constructor(){super();Fixture.current=this;} async connect(){return {roomId:'900'};} async disconnect(){} }
const adapter = new LiveAdapter(async()=>({TikTokLiveConnection:Fixture}));
const payload = (msg, extra={})=>({common:{msgId:String(msg),roomId:'900'},user:{id:'123',nickname:'Fixture Río'},...extra});
try {
  const base='http://127.0.0.1:5392';
  const denied = await fetch(base+'/api/live/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(denied.status,403);checks.push('Mutation without token/origin rejected');
  const invalid = await page.evaluate(async()=>{
    const {token}=await(await fetch('/api/session')).json();
    return (await fetch('/api/live/connect',{method:'POST',headers:{'Content-Type':'application/json','x-livedance-token':token},body:JSON.stringify({username:'https://invalid/',owner:'local-fixture-123456'})})).status;
  });
  assert.equal(invalid,400); checks.push('Invalid username rejected before provider access');
  await page.route('**/api/live/**',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').at(-1), b=route.request().postDataJSON()||{};
    try {
      const data=name==='connect'?await adapter.start(b.username,b.owner):name==='poll'?adapter.poll(b.owner,b.ack,b.rejected):name==='disconnect'?(await adapter.stop(),adapter.status()):adapter.status();
      await route.fulfill({json:data});
    }catch(e){await route.fulfill({status:400,json:{error:String(e)}});}
  });
  await page.evaluate(()=>document.body.classList.remove('clean'));
  await page.locator('#live-connect').click();
  await page.waitForFunction(()=>window.__LiveDance.inspect().live.status.state==='CONNECTED');
  Fixture.current.emit('follow',payload(100));Fixture.current.emit('follow',payload(100));
  await page.waitForFunction(()=>window.__V05.inspect().actors.some(a=>a.id==='tt:123'));
  let state=await page.evaluate(()=>window.__V05.inspect());assert.equal(state.registered.length,1);
  const skin=state.actors[0].skinId;checks.push('Follow traverses adapter → poll → EventIngress → World → skin actor; duplicate ignored');
  Fixture.current.emit('like',payload(101,{count:7}));
  for(const [i,n] of [1,5,10,10].entries()) Fixture.current.emit('gift',payload(102+i,{giftId:'42',groupId:'700',repeatCount:n,repeatEnd:i===3?1:0,gift:{type:1,name:'Fixture Rose',diamondCount:2}}));
  await page.waitForFunction(()=>window.__V05.world.spawn.dancers.get('tt:123')?.contributionScore===20);
  assert.equal(await page.evaluate(()=>window.__V05.world.spawn.dancers.get('tt:123').contributionScore),20);
  assert.equal(await page.evaluate(()=>window.__LiveDance.inspect().entertainment.goals.like),7);
  checks.push('Like accepted; cumulative gift streak awards exactly 20 coins once');
  Fixture.current.emit('gift',payload(120,{giftId:'43',groupId:'701',repeatCount:1,repeatEnd:1,gift:{type:0,name:'Fixture VIP',diamondCount:1000}}));
  await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='vip');
  state=await page.evaluate(()=>window.__V05.inspect());assert.equal(state.event.id,'tt:123');assert.equal(state.actors[0].skinId,skin);
  checks.push('VIP selects real-format viewer ID; skin retained');
  await page.waitForTimeout(1500);
  await page.screenshot({path:'docs/v061/evidence/fixture-vip.png'});
  await page.keyboard.press('F8');
  assert.equal(await page.evaluate(()=>window.__LiveDance.inspect().admission.paused),true);
  assert.equal(adapter.state,'DISCONNECTED');
  Fixture.current.emit('follow',payload(130,{user:{id:'456',nickname:'Blocked'}}));
  await page.waitForTimeout(400);assert.equal((await page.evaluate(()=>window.__V05.inspect())).registered.length,1);
  await page.getByRole('button',{name:'Reanudar',exact:true}).click();
  await h.send('VIEWER_JOIN','sim-after-f8');
  await page.waitForFunction(()=>window.__V05.inspect().registered.includes('sim-after-f8'));
  checks.push('F8 disconnects, clears queues, blocks late SDK events; explicit recovery returns to Simulator');
  await page.evaluate(()=>document.body.classList.add('clean'));
  await h.fill(30);
  const before=await page.evaluate(()=>[...window.__V05.world.spawn.dancers.values()].map(d=>[d.id,d.contributionScore]));
  const skins=(await page.evaluate(()=>window.__V05.inspect())).actors.map(a=>[a.id,a.skinId]);
  for(const featured of [10,20,30,20]) {
    await page.evaluate(featured=>window.__V05.configure({featured}),featured);await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(()=>[...window.__V05.world.spawn.dancers.values()].map(d=>[d.id,d.contributionScore])),before);
  }
  await h.send('SIMULATED','viewer-0',{giftId:'fever-demo'});
  await page.waitForFunction(()=>window.__V05.inspect().event?.kind==='fever');
  state=await page.evaluate(()=>window.__V05.inspect());assert.equal(state.registered.length,30);assert.deepEqual(state.actors.map(a=>[a.id,a.skinId]),skins);
  checks.push('Aforo 10/20/30/20 preserves all 30 IDs, scores and skin assignments; Fever preserves registry');
  await page.screenshot({path:'docs/v061/evidence/fixture-fever.png'});
  await page.keyboard.press('F8');await page.getByRole('button',{name:'Reanudar',exact:true}).click();
  assert.deepEqual(h.errors,[]);
  await fs.writeFile('docs/v061/integration-results.json',JSON.stringify({type:'LOCAL FIXTURES — NOT REAL TIKTOK',checks,provider:adapter.status(),browserErrors:h.errors},null,2));
  console.log(JSON.stringify({checks:checks.length,errors:h.errors}));
}finally{await adapter.dispose();await h.close();}
