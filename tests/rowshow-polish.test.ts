import {it,expect} from 'vitest';
import {ShowDirector} from '../src/integration/show-director';
import {TemporalNames} from '../src/integration/temporal-names';
import {rowPlacement} from '../src/integration/rotation-layout';
import {type LiveEvent} from '../src/domain';
const event=(n:number,type:LiveEvent['eventType']='COMMENT',extra:Partial<LiveEvent>={}):LiveEvent=>({schemaVersion:1,source:'simulator',eventId:'polish-'+n,viewerId:'v'+n,username:'Persona '+n,eventType:type,giftCount:1,timestamp:0,metadata:{},...extra});
it('waits for a valid model, assigned seat and the actual framed owner before activation',()=>{
 const d=new ShowDirector();d.enableRows();d.receive(event(0,'GIFT',{metadata:{tier:'HIGH'}}));const registered=new Set(['v0']);
 d.setVisualReady(new Set());d.update(.1,registered,registered);expect(d.active).toBeUndefined();expect(d.cue).toBeUndefined();
 d.setVisualReady(registered);d.reportFraming(new Set());d.update(.1,registered,registered);expect(d.active).toBeUndefined();
 d.reportFraming(registered);d.update(.1,registered,registered);expect(d.active?.id).toBe('v0');expect(d.active?.age).toBe(0);expect(d.active?.activations).toBe(1);
});
it('slowly loaded later participants do not erase the current group or start an invisible welcome',()=>{
 const d=new ShowDirector();d.enableRows();d.receive(event(0));const ready=new Set(['v0']);d.setVisualReady(ready);d.update(.1,ready,ready);d.reportFraming(ready);d.update(.1,ready,ready);
 d.receive(event(20));d.update(.1,new Set(['v0','v20']),ready);
 expect(d.entrances.get('v20')?.state).toBe('pending');expect(d.entrances.get('v20')?.age).toBe(0);expect(d.lastEntrant).toBe('v0');expect(d.viewIds(['v0','v20'])).toEqual(['v0']);
});
it('a new entry cannot steal the VIP plan; its timer waits for recognized inset frames',()=>{
 const d=new ShowDirector();d.enableRows();d.receive(event(0,'GIFT',{metadata:{tier:'HIGH'}}));const ready=new Set(['v0']);d.setVisualReady(ready);d.update(.1,ready,ready);d.reportFraming(ready);d.update(.1,ready,ready);
 d.receive(event(4));ready.add('v4');d.setVisualReady(ready);for(let i=0;i<6;i++)d.update(.1,ready,ready);
 expect(d.active?.kind).toBe('vip');expect(d.cameraCue?.id).toBe('v0');expect(d.entrances.get('v4')?.age).toBe(0);
 d.reportFraming(new Set(['v0']),'v4');d.update(.1,ready,ready);expect(d.entrances.get('v4')?.age).toBeGreaterThan(0);expect(d.active?.activations).toBe(1);
});
it('labels return to the nearby neutral anchor within half a second after collision frees',()=>{
 const layout=new TemporalNames(),a={id:'a',x:160,y:260,width:150,height:22,priority:10},b={id:'b',x:160,y:260,width:150,height:22};
 let result=layout.place([a,b],540,960,1/60,.15);expect(result.find(p=>p.id==='b')!.y).not.toBe(b.y);
 for(let i=0;i<30;i++)result=layout.place([a,{...b,x:400}],540,960,1/60,.15);
 expect(result.find(p=>p.id==='b')!.y).toBeCloseTo(b.y,2);expect(result.find(p=>p.id==='b')!.x).toBe(400);
});
it('VIP formation is temporary and never changes the twenty-seat roster',()=>{
 const d=new ShowDirector();d.enableRows();for(let i=0;i<21;i++)d.receive(event(i));const ids=new Set(Array.from({length:21},(_,i)=>'v'+i));d.setVisualReady(ids);d.receive(event(19,'GIFT',{eventId:'vip',metadata:{tier:'HIGH'}}));d.update(.1,ids,ids);
 const before=d.rotation.snapshot();const companions=d.viewIds([...ids]);const pose=d.actorPosition('v18',companions);expect(pose.z).not.toBe(rowPlacement(18).z);expect(d.rotation.snapshot()).toEqual(before);expect(d.rotation.slotOf('v20')).toBe(20);
});
