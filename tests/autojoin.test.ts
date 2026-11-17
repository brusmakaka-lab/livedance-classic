import { it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { normalizeTikTok } from '../connector/normalize.mjs';
import { LiveAdapter } from '../connector/adapter.mjs';
import { DiagnosticLog } from '../connector/diagnostics.mjs';
import { World, defaults } from '../src/domain';
import { EventIngress } from '../src/ingress';
import { SkinClient } from '../src/integration/client';
const raw = (msg = '100', user = '123', extra = {}) => ({ common: { msgId: msg, roomId: '900' }, user: { id: user, nickname: 'Luna' }, ...extra });

it('member and join aliases deduplicate by message ID and keep account ID across renames', () => {
  const a = normalizeTikTok('member', raw(), '900');
  const b = normalizeTikTok('join', raw('100','123',{user:{id:'123',nickname:'Otro nombre'}}), '900');
  expect(a.event.eventType).toBe('VIEWER_JOIN');
  expect(b.event.eventId).toBe(a.event.eventId);
  expect(b.event.viewerId).toBe(a.event.viewerId);
});
it('join bursts, replay and follow/chat/identified like keep exactly one dancer per ID', () => {
  const w = new World({...defaults, afk:false}), ingress = new EventIngress(w.bus);
  const packets = [normalizeTikTok('member',raw(),'900'), normalizeTikTok('join',raw(),'900'),
    normalizeTikTok('chat',raw('101'),'900'), normalizeTikTok('follow',raw('102'),'900'),
    normalizeTikTok('like',raw('103','123',{count:20}),'900'), normalizeTikTok('member',raw('104','456'),'900')];
  for (const packet of packets) ingress.submit(packet);
  ingress.drain();
  for(let i=0;i<120;i++) w.update(.05,.05);
  expect(ingress.metrics.duplicate).toBe(1);
  expect(w.spawn.spawned).toBe(2);
  expect([...w.spawn.dancers.keys()].sort()).toEqual(['tt:123','tt:456']);
  expect(w.spawn.dancers.get('tt:123')!.contributionScore).toBe(0);
});
it.each(['chat','follow','like','gift'])('%s creates a dancer even when no join was sent', kind => {
  const w = new World({...defaults, afk:false}), ingress = new EventIngress(w.bus);
  const packet = normalizeTikTok(kind,raw('100','123',{count:3,giftId:'42',repeatCount:1,repeatEnd:1,gift:{diamondCount:2}}),'900');
  ingress.submit(packet); ingress.drain(); w.update(.1,.1);
  expect(w.spawn.dancers.size).toBe(1);
  expect(w.spawn.dancers.get('tt:123')!.contributionScore).toBe(kind==='gift'?2:0);
});
it('anonymous totals, nicknames, unsafe numeric IDs, missing message IDs and wrong room cannot create people', () => {
  for(const payload of [raw('101','',{user:undefined,total:'10000'}),raw('102','',{user:{nickname:'Luna'}}),raw('103','',{user:{id:9007199254740992}})])
    expect(()=>normalizeTikTok('like',payload,'900')).toThrow('missing_user_id');
  expect(()=>normalizeTikTok('member',{user:{id:'123'}},'900')).toThrow('missing_stable_ids');
  expect(()=>normalizeTikTok('member',raw(),'901')).toThrow('wrong_room');
});
it('same name with distinct IDs creates distinct people; new join after removal can re-enter', () => {
  const w = new World({...defaults, afk:false});
  w.bus.emit(normalizeTikTok('member',raw(),'900').event);
  w.bus.emit(normalizeTikTok('member',raw('101','456'),'900').event);
  for(let i=0;i<20;i++)w.update(.1,.1);
  expect(w.spawn.spawned).toBe(2);
  const d=w.spawn.dancers.get('tt:123')!;w.spawn.exit(d,w.now);
  for(let i=0;i<150;i++)w.update(.1,.1);
  expect(w.spawn.dancers.has('tt:123')).toBe(false);
  w.bus.emit(normalizeTikTok('member',raw('102'),'900').event);
  w.update(.1,.1);expect(w.spawn.dancers.has('tt:123')).toBe(true);
});
it('concurrent join and fallback use a single persistent skin assignment', async () => {
  const c = new SkinClient();
  const skin={id:'coral',hash:'hash',name:'Coral',model:'classic',provenance:[]} as const;
  c.state={version:1,revision:0,records:[skin as any],viewers:[],sessionId:'test'};
  c.mutate=vi.fn(async()=>{await Promise.resolve();c.state.viewers.push({id:'key',name:'Luna',skinId:'coral'});return {id:'key'};});
  const [a,b]=await Promise.all([c.ensure('tt:123','Luna'),c.ensure('tt:123','Otro')]);
  expect(a.id).toBe('coral');expect(b).toBe(a);expect(c.mutate).toHaveBeenCalledTimes(1);
  await c.ensure('tt:123','Nuevo nombre');expect(c.mutate).toHaveBeenCalledTimes(1);
});
it('real adapter listeners accept member/chat, count rejected likes, deduplicate alias and respect stop', async () => {
  class Fake extends EventEmitter {static last:Fake;constructor(){super();Fake.last=this;}async connect(){return {roomId:'900'};}async disconnect(){}}
  const logs:any[]=[];
  const a=new LiveAdapter(async()=>({TikTokLiveConnection:Fake}),{onLog:(r:any)=>logs.push(r)});
  try {
    await a.start('testhost','autojoin-owner-1234');await vi.waitFor(()=>expect(a.state).toBe('CONNECTED'));
    Fake.last.emit('member',raw());Fake.last.emit('join',raw());Fake.last.emit('chat',raw('101'));
    Fake.last.emit('like',raw('102','',{user:undefined,count:50}));
    expect(a.counts.member).toBe(1);expect(a.counts.chat).toBe(1);expect(a.counts.duplicate).toBe(1);
    expect(a.received.like).toBe(1);expect(a.counts.anonymousLikes).toBe(1);
    expect(logs.some(r=>r.code==='REJECT_missing_user_id'&&r.kind==='like')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain('Luna');
    const rows=a.poll('autojoin-owner-1234').events;expect(rows).toHaveLength(2);
    await a.stop();Fake.last.emit('member',raw('103'));expect(a.rows).toHaveLength(0);
  } finally {await a.dispose();}
});
it('diagnostic buffers stay bounded even without disk access', () => {
  const log=new DiagnosticLog('unused');clearInterval(log.timer);
  for(let i=0;i<600;i++)log.write({code:'TEST'});
  expect(log.status()).toEqual({pending:512,dropped:88,failed:0});
});
