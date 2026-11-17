import { it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { normalizeTikTok } from '../connector/normalize.mjs';
import { LiveAdapter } from '../connector/adapter.mjs';
import { EventBus, World, defaults } from '../src/domain';
import { EventIngress } from '../src/ingress';
import { AdmissionGate } from '../src/admission';
import { ViewCast } from '../src/integration/cast';
const raw = (msg = '100', extra = {}) => ({ common: { msgId: msg, roomId: '900' }, user: { id: '123', nickname: 'Río' }, ...extra });
it('v3 nested IDs, nickname changes, separate room namespaces and invalid input', () => {
  const a = normalizeTikTok('follow', raw(), '900');
  const b = normalizeTikTok('follow', raw('101', { user: { id: '123', nickname: 'Otro' } }), '900');
  expect(a.event.source).toBe('tiktok'); expect(a.event.viewerId).toBe(b.event.viewerId);
  expect(() => normalizeTikTok('follow', raw(), '901')).toThrow();
  expect(() => normalizeTikTok('follow', { user: { nickname: 'Río' } }, '900')).toThrow();
});
it('cumulative x1/x5/x10/final/replay delivers only ten gifts and exact delta coins', () => {
  const bus = new EventBus(), ingress = new EventIngress(bus), delivered: any[] = [];
  bus.subscribe(e => delivered.push(e));
  for (const [i, total] of [1, 5, 10, 10, 5].entries()) {
    ingress.submit(normalizeTikTok('gift', raw(String(100+i), { giftId: '42', groupId: '700', repeatCount: total, repeatEnd: i === 3 ? 1 : 0, gift: { type: 1, name: 'Rose', diamondCount: 2 } }), '900'));
    ingress.drain();
  }
  expect(delivered.map(e => e.giftCount)).toEqual([1,4,5]);
  expect(delivered.reduce((n,e) => n+e.coins, 0)).toBe(20);
  expect(ingress.metrics.duplicate).toBe(2);
  expect(() => normalizeTikTok('gift', raw('109', { giftId: '42', repeatCount: 5, repeatEnd: 0 }), '900')).toThrow();
});
it('likes are one bounded visual event with the original count; unknown gifts stay LOW', () => {
  expect(normalizeTikTok('like', raw('111', {count: 17}), '900').event.metadata.likeCount).toBe(17);
  expect(() => normalizeTikTok('like', raw('112', {count: -1}), '900')).toThrow();
  const gift = normalizeTikTok('gift', raw('113', {giftId:'77', repeatCount:1, repeatEnd:1}), '900');
  expect(gift.event.coins).toBeUndefined(); expect(gift.event.metadata.tier).toBeUndefined();
});
it('admission excludes simulated producers in LIVE mode, F8 pauses both paths', () => {
  const bus = new EventBus(), gate = new AdmissionGate(bus), e = normalizeTikTok('follow',raw(),'900').event;
  expect(bus.emit(e)).toBe(false); gate.source = 'tiktok'; expect(bus.emit(e)).toBe(true);
  expect(bus.emit({...e,eventId:'sim',source:'simulator'})).toBe(false);
  gate.pause('F8'); expect(gate.ingress.submit(e).reason).toBe('paused');
  gate.source = 'simulator'; gate.resume(); expect(bus.emit({...e,eventId:'sim2',source:'simulator'})).toBe(true);
});
it('10/20/30 casting and focus preserve registry and contribution scores', () => {
  const w = new World({...defaults}), c = new ViewCast();
  for(let i=1;i<=30;i++) w.bus.emit({...normalizeTikTok('follow',raw(String(100+i),{user:{id:String(i),nickname:'V'+i}}),'900').event});
  const ids = [...w.spawn.dancers.keys()], before = [...w.spawn.dancers.values()].map(d => [d.id,d.contributionScore]);
  c.sync(ids);
  for(const n of [10,20,30,10]) {c.limit=n;c.select();expect(c.visible.length).toBe(Math.min(n, ids.length));c.focus(ids.at(-1));c.focus();}
  expect([...w.spawn.dancers.values()].map(d=>[d.id,d.contributionScore])).toEqual(before);
});
class Fake extends EventEmitter {
  static latest: Fake; roomId = '900'; disconnected = false;
  constructor() {super();Fake.latest=this;}
  async connect(){return {roomId:this.roomId};}
  async disconnect(){this.disconnected=true;}
}
const load = async()=>({TikTokLiveConnection:Fake});
it('adapter bounded queue, replay/ACK, exclusive consumer and stop cleanup', async()=>{
  const a = new LiveAdapter(load);
  try {
    await a.start('palermotusi','owner-test-12345678'); await vi.waitFor(()=>expect(a.state).toBe('CONNECTED'));
    Fake.latest.emit('follow',raw()); Fake.latest.emit('follow',raw());
    expect(a.counts.duplicate).toBe(1);
    const first = a.poll('owner-test-12345678'); expect(first.events).toHaveLength(1);
    expect(a.poll('owner-test-12345678').events).toEqual(first.events);
    expect(()=>a.poll('wrong-owner')).toThrow(); expect(()=>a.poll('owner-test-12345678',999)).toThrow();
    expect(a.poll('owner-test-12345678',first.events[0].sequence).events).toHaveLength(0);
    for(let i=0;i<513;i++) Fake.latest.emit('follow',raw(String(1000+i)));
    expect(a.rows).toHaveLength(512); expect(a.counts.overflow).toBe(1);
    await a.stop(); Fake.latest.emit('follow',raw('99999')); expect(a.rows).toHaveLength(0);
  } finally {await a.dispose();}
});
it('reconnect keeps room dedup; F8 cancels pending retries', async()=>{
  const a=new LiveAdapter(load,{retryMs:10});
  try {
    await a.start('palermotusi','owner-test-12345678');await vi.waitFor(()=>expect(a.state).toBe('CONNECTED'));
    Fake.latest.emit('follow',raw());Fake.latest.emit('disconnected');
    await vi.waitFor(()=>expect(a.attempts).toBe(2));await vi.waitFor(()=>expect(a.state).toBe('CONNECTED'));
    Fake.latest.emit('follow',raw());expect(a.counts.duplicate).toBe(1);
    Fake.latest.emit('disconnected');await a.stop();await new Promise(r=>setTimeout(r,40));expect(a.attempts).toBe(2);
  }finally{await a.dispose();}
});
it('offline is terminal, rate limiting respects provider retry-after', async()=>{
  for(const name of ['UserOfflineError','SignatureRateLimitError']) {
    class Failure extends Fake {async connect(){throw Object.assign(Error(),{name,retryAfter:3600});}}
    const a=new LiveAdapter(async()=>({TikTokLiveConnection:Failure}));
    try {await a.start('palermotusi','owner-test-12345678');await vi.waitFor(()=>expect(a.state).toBe(name==='UserOfflineError'?'OFFLINE':'ERROR'));if(name.startsWith('Signature')) expect(a.nextAllowed-Date.now()).toBeGreaterThan(3590000);}
    finally{await a.dispose();}
  }
});
it('a connection completing after F8 cannot resurrect the source or queue', async()=>{
  let finish: (value: any)=>void = ()=>{};
  class Delayed extends Fake {connect(){return new Promise<any>(resolve=>{finish=resolve;});}}
  const a=new LiveAdapter(async()=>({TikTokLiveConnection:Delayed}),{timeoutMs:1000});
  try {
    await a.start('palermotusi','owner-test-12345678');await vi.waitFor(()=>expect(Fake.latest).toBeInstanceOf(Delayed));
    const old=Fake.latest;await a.stop('F8');finish({roomId:'900'});await new Promise(r=>setTimeout(r,10));
    old.emit('follow',raw());expect(a.state).toBe('DISCONNECTED');expect(a.rows).toHaveLength(0);expect(old.disconnected).toBe(true);
  }finally{await a.dispose();}
});
it('a closed consumer expires its lease without reconnecting', async()=>{
  const a=new LiveAdapter(load,{leaseMs:10});
  try{
    await a.start('palermotusi','owner-test-12345678');await vi.waitFor(()=>expect(a.state).toBe('CONNECTED'));
    await vi.waitFor(()=>expect(a.state).toBe('DISCONNECTED'),{timeout:2000});expect(a.owner).toBe('');
  }finally{await a.dispose();}
});
