import {it,expect} from 'vitest';
import {ShowDirector} from '../src/integration/show-director';
import {integrationConfig} from '../src/integration/config';
import {rotationPlacement} from '../src/integration/rotation-layout';
import type {LiveEvent} from '../src/domain';
let serial=0;
const event=(id:string,type:LiveEvent['eventType']='VIEWER_JOIN'):LiveEvent=>({schemaVersion:1,source:'simulator',viewerId:id,username:'Mismo nombre',eventId:String(++serial),timestamp:serial,eventType:type,giftCount:1,metadata:type==='GIFT'?{tier:'HIGH'}:{}});
const all=new Set(Array.from({length:30},(_,i)=>String(i)));
function advance(d:ShowDirector,seconds:number,vip=new Set<string>()){for(let i=0;i<seconds*20;i++){d.update(.05,all,all,vip);d.select([...all]);}}
function filled(){const d=new ShowDirector();for(let i=0;i<5;i++){d.receive(event(String(i)));advance(d,7);}return d;}
it('30 successive identities rotate FIFO through every slot and retain displaced users',()=>{
 const d=new ShowDirector();for(let i=0;i<30;i++){const e=event(String(i));d.receive(e);d.receive(e);advance(d,7);expect(d.shot).toBe('WIDE');expect(new Set(d.select([...all])).size).toBe(Math.min(i+1,5));}
 const rows=d.rotation.log.filter(r=>r.action==='admitted');expect(rows.slice(5).map(r=>r.slot)).toEqual(Array.from({length:25},(_,i)=>i%5));expect(rows.slice(5).map(r=>r.outgoing)).toEqual(Array.from({length:25},(_,i)=>String(i)));
 expect(d.history.filter(p=>p.state==='finished')).toHaveLength(30);expect(d.rotation.participants.size).toBe(30);expect([...d.rotation.participants.values()].filter(r=>r.slot===null)).toHaveLength(25);
 expect([...d.rotation.participants.values()].every(r=>r.presentations===1)).toBe(true);
});
it('a burst of thirty registered arrivals is fully presented without TTL losses',()=>{
 const d=new ShowDirector();for(const id of all)d.receive(event(id));advance(d,205);expect(d.history.filter(p=>p.state==='finished')).toHaveLength(30);expect(d.dropped).toBe(0);expect(d.queue).toHaveLength(0);expect(d.shot).toBe('WIDE');
});
it('likes update interaction data without duplicating users or protecting them from FIFO',()=>{
 const d=filled();const old=d.rotation.participants.get('0')!.lastInteraction;
 for(let i=0;i<20;i++)d.receive(event('0','LIKE_MILESTONE'));d.receive(event('5'));advance(d,7);
 expect(d.rotation.participants.get('0')!.lastInteraction).toBeGreaterThan(old);expect(d.rotation.participants.get('0')!.slot).toBeNull();expect(d.rotation.participants.size).toBe(6);expect(d.history.filter(p=>p.id==='0')).toHaveLength(1);
});
it('VIP and a suspended welcome are protected; joins do not restart VIP',()=>{
 const d=filled();d.receive(event('0','FOLLOW'));advance(d,1);const follow=d.active!;
 d.receive(event('5','GIFT'));advance(d,.1);const vip=d.active!;expect(vip.kind).toBe('vip');expect(d.rotation.participants.get('0')!.slot).toBe(0);expect(d.rotation.participants.get('1')!.slot).toBeNull();
 d.receive(event('6'));advance(d,2);expect(d.active).toBe(vip);expect(vip.activations).toBe(1);advance(d,6.1);expect(d.shot).toBe('WIDE');advance(d,1.6);expect(d.active).toBe(follow);expect(follow.activations).toBe(1);
});
it('when all visible participants are VIP, a new welcome waits until an eligible place exists',()=>{
 const d=filled(),vip=new Set(['0','1','2','3','4']);d.receive(event('5'));advance(d,3,vip);expect(d.active).toBeUndefined();expect(d.rotation.slotOf('5')).toBe(-1);advance(d,.1);expect(d.active?.id).toBe('5');expect(d.rotation.slotOf('5')).toBe(0);
});
it('Fever keeps the cast; VIP interrupts and resumes Fever once, then the join can enter',()=>{
 const d=filled();d.receive({...event('0','SIMULATED'),giftId:'fever-demo'});advance(d,1);const fever=d.active!,before=d.select([...all]);d.receive(event('5'));advance(d,1);expect(d.select([...all])).toEqual(before);d.receive(event('6','GIFT'));advance(d,.1);expect(d.active?.kind).toBe('vip');advance(d,8.1);expect(d.active).toBe(fever);expect(fever.activations).toBe(1);advance(d,18);expect(d.history.some(p=>p.id==='5'&&p.state==='finished')).toBe(true);
});
it('displaced identities return on a new presentation or manual FIFO, preserving their join order',()=>{
 const d=filled();d.receive(event('5'));advance(d,7);const joined=d.rotation.participants.get('0')!.joinedOrder;d.receive(event('0','FOLLOW'));advance(d,8);expect(d.rotation.slotOf('0')).toBe(1);expect(d.rotation.participants.get('0')!.joinedOrder).toBe(joined);
 d.next([...all]);expect(d.rotation.slotOf('1')).toBe(2);expect(d.rotation.participants.get('1')!.presentations).toBe(1);
});
it('departures leave other IDs in the same physical slots',()=>{
 const d=filled(),remaining=new Set(['0','2','3','4']);d.update(.1,remaining,remaining);d.select([...remaining]);expect(d.rotation.slotOf('2')).toBe(2);expect(d.rotation.slotOf('4')).toBe(4);expect(d.rotation.slotOf('1')).toBe(-1);
});
it('evaluation capacities are bounded and have unique rows and arc positions; default five stays unchanged',()=>{
 expect(integrationConfig({}).visibleCapacity).toBe(5);expect(integrationConfig({visibleCapacity:20}).visibleCapacity).toBe(5);
 for(const capacity of [6,8,10])for(const layout of ['ROWS','ARC'] as const){const points=Array.from({length:capacity},(_,i)=>rotationPlacement(i,capacity,layout));expect(new Set(points.map(p=>p.toArray().join(','))).size).toBe(capacity);for(const a of points)for(const b of points)if(a!==b)expect(a.distanceTo(b)).toBeGreaterThan(1.9);}
});
it('participant presentation metadata retains cancellation after F8 or an expired missing model',()=>{
 const d=filled();d.receive(event('0','GIFT'));advance(d,1);d.clear();expect(d.rotation.participants.get('0')!.presentation).toBe('cancelled');expect(d.rotation.participants.get('0')!.vip).toBe(false);advance(d,.1);expect(d.rotation.participants.get('0')!.presentation).toBe('cancelled');
 d.receive(event('missing'));advance(d,46);expect(d.rotation.participants.get('missing')!.presentation).toBe('cancelled');
});
