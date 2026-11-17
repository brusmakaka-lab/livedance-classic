import { harness } from './v05-harness.mjs';
import { LiveAdapter } from '../connector/adapter.mjs';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
class Fake extends EventEmitter { static last; constructor(){super();Fake.last=this;} async connect(){return {roomId:'900'};} async disconnect(){} }
const adapter = new LiveAdapter(async()=>({TikTokLiveConnection:Fake}));
const raw=(msg,user='123',extra={})=>({common:{msgId:msg,roomId:'900'},user:{id:user,nickname:'Cuenta '+user},...extra});
const h=await harness('autojoin-check',5540), p=h.page, checks=[];
try {
  await p.route('**/api/live/*',async route=>{
    const endpoint=new URL(route.request().url()).pathname.split('/').at(-1);
    const body=route.request().postDataJSON();let data;
    if(endpoint==='connect'){
      data=await adapter.start(body.username,body.owner);
      for(let i=0;i<30 && adapter.state!=='CONNECTED';i++)await new Promise(r=>setTimeout(r,5));
    } else if(endpoint==='poll')data=adapter.poll(body.owner,body.ack,body.rejected);
    else if(endpoint==='disconnect'){await adapter.stop();data=adapter.status();}
    else data=adapter.status();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await p.keyboard.press('Escape');
  await p.locator('#live-connect').click();
  await p.waitForFunction(()=>__LiveDance.inspect().live.status.state==='CONNECTED');
  Fake.last.emit('member',raw('100'));
  Fake.last.emit('join',raw('100')); // Same event through alias.
  Fake.last.emit('member',raw('101')); // Distinct join, same person.
  Fake.last.emit('chat',raw('102','123',{user:{id:'123',nickname:'Nombre cambiado'}}));
  await p.waitForFunction(()=>__V05.inspect().actors.some(a=>a.id==='tt:123'),null,{timeout:20000});
  const first=await p.evaluate(()=>__V05.inspect().actors.find(a=>a.id==='tt:123'));
  Fake.last.emit('follow',raw('103','124'));
  Fake.last.emit('chat',raw('104','125'));
  Fake.last.emit('gift',raw('105','126',{giftId:'42',repeatCount:1,repeatEnd:1,gift:{name:'Fixture',diamondCount:2}}));
  Fake.last.emit('like',raw('106','127',{count:17}));
  Fake.last.emit('like',raw('107','',{user:undefined,count:500,total:'500'}));
  await p.waitForFunction(()=>__V05.inspect().actors.length===5,null,{timeout:20000});
  const snapshot=await p.evaluate(()=>({show:__V05.inspect(),app:__LiveDance.inspect()}));
  assert.equal(snapshot.show.actors.find(a=>a.id==='tt:123').skinId,first.skinId);
  assert.equal(snapshot.app.dancers.length,5);
  assert.equal(snapshot.app.spawn.spawned,5);
  assert.equal(adapter.counts.duplicate,1);assert.equal(adapter.counts.anonymousLikes,1);
  assert.equal(snapshot.app.dancers.find(d=>d.id==='tt:126').contributionScore,2);
  const skins=await p.evaluate(async()=>await(await fetch('/api/skins')).json());
  assert.equal(skins.viewers.length,5);assert(snapshot.show.actors.every(a=>a.skinId));
  checks.push('Fake SDK → real adapter → LIVE panel polling → ingress → world → persistent skin API → five rendered actors');
  checks.push('member/join replay and distinct join messages preserve one person/skin; chat/follow/gift/identified like work without a join; anonymous like creates nobody');
  const downloadPromise=p.waitForEvent('download');await p.locator('#live-diagnostics').click();
  const download=await downloadPromise;await download.saveAs('docs/auto-join/diagnostic-simulator.json');
  await p.screenshot({path:'docs/auto-join/SIMULADOR.png',fullPage:true});
  await p.keyboard.press('F8');
  await p.waitForFunction(()=>!__LiveDance.inspect().live.active);
  assert.equal(adapter.state,'DISCONNECTED');
  const before=adapter.rows.length;Fake.last.emit('member',raw('108','999'));assert.equal(adapter.rows.length,before);
  checks.push('Diagnostic download and emergency F8 disconnect pass');
  assert.deepEqual(h.errors,[]);
  await fs.writeFile('docs/auto-join/simulator-results.json',JSON.stringify({status:'PASS',mode:'SIMULATED SDK; no real TikTok LIVE',checks,counts:adapter.counts,show:snapshot.show,spawn:snapshot.app.spawn,browserErrors:h.errors},null,2));
  console.log(JSON.stringify({status:'PASS',checks}));
} finally {await adapter.dispose();await h.close();}
