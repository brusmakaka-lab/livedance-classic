import {it,expect} from 'vitest';
import {ShowDirector} from '../src/integration/show-director';
import {HorizontalRows} from '../src/integration/horizontal-rows';
import {rowPlacement} from '../src/integration/rotation-layout';
import {World,defaults,type LiveEvent} from '../src/domain';
const event=(i:number,type:LiveEvent['eventType']='COMMENT',extra:Partial<LiveEvent>={}):LiveEvent=>({schemaVersion:1,source:'simulator',eventId:'e'+i,viewerId:'v'+i,username:'Mismo nombre',eventType:type,giftCount:1,timestamp:0,metadata:{},...extra});
function setup(n:number){const d=new ShowDirector();d.enableRows();const ids=new Set<string>();for(let i=0;i<n;i++){d.receive(event(i));ids.add('v'+i);}d.update(.016,ids,ids);return {d,ids,rows:d.rotation as HorizontalRows};}
it.each([20,40,60])('%i entries preserve permanent horizontal seats and present concurrently',n=>{
 const {d,ids,rows}=setup(n);expect(rows.snapshot()).toHaveLength(n);expect(d.entrances.size).toBe(n);
 expect([...d.entrances.values()].every(p=>p.state==='active'&&p.activations===1)).toBe(true);
 for(let i=0;i<n;i++){expect(rows.slotOf('v'+i)).toBe(i);const v=rowPlacement(i);expect(v.y).toBe(0);if(i%20)expect(v.x).toBeGreaterThan(rowPlacement(i-1).x);if(i>=20)expect(v.z).toBeGreaterThan(rowPlacement(i-20).z);}
 for(let i=0;i<300;i++)d.update(.02,ids,ids);expect(d.history.filter(p=>p.kind==='welcome')).toHaveLength(n);expect(d.shot).toBe('WIDE');expect(rows.participants.size).toBe(n);
});
it('duplicates and equal names do not create new seats, even after another session',()=>{
 const {d,ids,rows}=setup(2);d.receive(event(0));d.receive(event(0,'VIEWER_JOIN',{eventId:'member-new-message'}));d.receive(event(0,'COMMENT',{eventId:'reconnect',sessionId:'next'}));d.update(.02,ids,ids);
 expect(rows.participants.size).toBe(2);expect(rows.snapshot()).toHaveLength(2);expect(d.entrances.size).toBe(2);
});
it('VIP interrupts Fever once and resumes its age; arrivals stay immediate and likes never restart a cue',()=>{
 const {d,ids}=setup(3);d.triggerFever();d.update(.1,ids,ids);const fever=d.active!;const age=fever.age;
 d.receive(event(0,'GIFT',{eventId:'vip',metadata:{tier:'HIGH'}}));d.update(.1,ids,ids);const vip=d.active!;
 d.receive(event(4));ids.add('v4');for(let i=0;i<40;i++)d.receive(event(0,'LIKE_MILESTONE',{eventId:'like-'+i}));d.update(.1,ids,ids);
 expect(d.active?.presentationId).toBe(vip.presentationId);expect(d.entrances.get('v4')?.state).toBe('active');expect(d.entrances.get('v4')?.activations).toBe(1);
 for(let i=0;i<81;i++)d.update(.1,ids,ids);expect(d.active?.presentationId).toBe(fever.presentationId);expect(d.active!.age).toBeGreaterThanOrEqual(age);expect(d.active!.resumes).toBe(1);
});
it.each([5,10] as const)('retires full batches of %i with fade, protects VIP, keeps identity and restores original seat',batch=>{
 const {d,ids,rows}=setup(40);rows.budget=20;rows.batch=batch;
 for(let i=0;i<45;i++)d.update(.1,ids,ids);const protectedId=[...rows.fading.keys()][0];expect(rows.fading.size).toBe(batch);expect(rows.retired.size).toBe(0);expect(rows.opacity(protectedId,rows.fading.get(protectedId)!+.75)).toBeCloseTo(.5);
 for(let i=0;i<100;i++)d.update(.1,ids,ids);expect(rows.retired.size).toBe(20);expect(rows.snapshot()).toHaveLength(40);expect(rows.participants.size).toBe(40);
 const slot=rows.slotOf('v0');d.receive(event(0,'GIFT',{eventId:'return-vip',metadata:{tier:'HIGH'}}));d.update(.1,ids,ids);expect(rows.wants('v0')).toBe(true);expect(rows.slotOf('v0')).toBe(slot);expect(d.active?.kind).toBe('vip');
});
it('retained World keeps more than 60 identities and scores despite low legacy capacity and inactivity',()=>{
 const w=new World({...defaults,maxDancers:5,afk:true,inactivity:10});w.spawn.retainParticipants=true;
 for(let i=0;i<85;i++)w.bus.emit(event(i));w.bus.emit(event(0,'GIFT',{eventId:'score',coins:100,metadata:{tier:'HIGH'}}));
 const score=w.spawn.dancers.get('v0')!.contributionScore;expect(score).toBeGreaterThan(0);
 for(let i=0;i<400;i++)w.update(.1,.1);expect(w.spawn.dancers.size).toBe(85);expect(w.spawn.dancers.get('v0')!.contributionScore).toBe(score);expect(w.spawn.dropped).toBe(0);
});
it('first detected gift/follow presents without synthesizing a join',()=>{
 const d=new ShowDirector();d.enableRows();d.receive(event(0,'GIFT',{giftName:'Rosa'}));d.receive(event(1,'FOLLOW'));
 expect([...d.entrances.values()].map(p=>p.originalEventType)).toEqual(['GIFT','FOLLOW']);expect(d.log.some(p=>p.originalEventType==='VIEWER_JOIN')).toBe(false);
});
it('secondary entrance shot keeps the donor camera and the entrant in their original seats',()=>{
 const {d,ids}=setup(60);d.receive(event(58,'GIFT',{eventId:'cinematic',metadata:{tier:'HIGH'}}));d.update(.1,ids,ids);
 d.receive(event(60));ids.add('v60');d.update(.1,ids,ids);
 const inset=d.arrivalInset(.8)!;expect(d.active?.id).toBe('v58');expect(inset.presentation.id).toBe('v60');expect(d.rotation.slotOf('v60')).toBe(60);
 expect(d.viewIds([...ids])).toEqual(['v57','v58','v59']);expect(inset.camera.position.x).toBe(rowPlacement(60).x);
 d.clear();expect(d.arrivalInset(.8)).toBeUndefined();expect(d.rotation.participants.size).toBe(61);
});
