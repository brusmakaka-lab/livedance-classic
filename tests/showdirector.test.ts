import {it,expect} from 'vitest';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {ShowDirector} from '../src/integration/show-director';
import {PresentationPlayback} from '../src/integration/presentation-playback';
import {Player} from '../src/integration/player';
import type {LiveEvent} from '../src/domain';
let serial=0;
const event=(eventType:LiveEvent['eventType'],viewerId='a',extra:Partial<LiveEvent>={}):LiveEvent=>({schemaVersion:1,source:'simulator',sessionId:'test',eventId:'test-'+ ++serial,viewerId,username:'Mismo nombre',eventType,giftCount:1,timestamp:0,metadata:{},...extra});
const ids=new Set(['a','b','c','d','e','f','g']);
const advance=(d:ShowDirector,seconds:number)=>{for(let i=0;i<Math.round(seconds*100);i++)d.update(.01,ids,ids);};
it('Join and repeated likes during VIP cannot cut or restart it',()=>{
 const d=new ShowDirector();d.receive(event('GIFT','a',{metadata:{tier:'HIGH'}}));d.update(0,ids,ids);advance(d,1);const p=d.active!;
 d.receive(event('VIEWER_JOIN','b'));for(let i=0;i<50;i++)d.receive(event('LIKE_MILESTONE','a'));advance(d,2);
 expect(d.active).toBe(p);expect(p.age).toBeCloseTo(3);expect(p.activations).toBe(1);expect(d.queue.map(p=>p.id)).toEqual(['b']);
});
it('three consecutive entries preserve FIFO and five-second durations',()=>{
 const d=new ShowDirector();for(const id of ['a','b','c'])d.receive(event('VIEWER_JOIN',id));d.update(0,ids,ids);expect(d.active?.id).toBe('a');advance(d,5.02);expect(d.shot).toBe('WIDE');advance(d,1.51);expect(d.active?.id).toBe('b');advance(d,6.53);expect(d.active?.id).toBe('c');advance(d,5.02);
 expect(d.active).toBeUndefined();expect(d.history.map(p=>p.id)).toEqual(['a','b','c']);expect(d.history.every(p=>p.duration===5&&p.activations===1)).toBe(true);
});
it('Follow waits during a welcome, rather than restarting it',()=>{
 const d=new ShowDirector();d.receive(event('VIEWER_JOIN'));d.update(0,ids,ids);advance(d,2);const p=d.active;d.receive(event('FOLLOW'));advance(d,1);expect(d.active).toBe(p);expect(d.queue[0].kind).toBe('follow');advance(d,2.02);expect(d.shot).toBe('WIDE');advance(d,1.51);expect(d.active?.kind).toBe('follow');
});
it('VIP suspends Fever and resumes the same presentation and elapsed time',()=>{
 const d=new ShowDirector();d.receive(event('SIMULATED','a',{giftId:'fever-demo'}));d.update(0,ids,ids);advance(d,2);const fever=d.active!;
 d.receive(event('GIFT','b',{metadata:{tier:'HIGH'}}));d.update(0,ids,ids);expect(fever.state).toBe('pending');expect(fever.age).toBeCloseTo(2);d.receive(event('VIEWER_JOIN','c'));advance(d,8.02);
 expect(d.active).toBe(fever);expect(fever.activations).toBe(1);expect(fever.resumes).toBe(1);expect(fever.age).toBeCloseTo(2.01,1);expect(d.queue[0].id).toBe('c');
});
it('different IDs with equal display names remain distinct and replays never reactivate',()=>{
 const d=new ShowDirector(),e=event('VIEWER_JOIN','a');d.receive(e);d.receive(event('VIEWER_JOIN','b'));d.receive(e);advance(d,14);d.receive(e);expect(d.history.map(p=>p.viewerId)).toEqual(['a','b']);expect(d.queue).toHaveLength(0);expect(d.log.filter(l=>l.action==='duplicate')).toHaveLength(2);
});
it('pending limits and expiration cancel stale welcomes with diagnostic reasons',()=>{
 const d=new ShowDirector();for(let i=0;i<30;i++)d.receive(event('VIEWER_JOIN','unknown-'+i));expect(d.queue).toHaveLength(30);advance(d,46);expect(d.queue).toHaveLength(0);expect(d.history.filter(p=>p.state==='cancelled')).toHaveLength(30);expect(d.log.some(l=>l.reason==='Expired')).toBe(true);
});
it('first gift produces a single presentation retaining its original event type and ID',()=>{
 const d=new ShowDirector(),e=event('GIFT');d.receive(e);d.update(0,ids,ids);expect(d.queue).toHaveLength(0);expect(d.active).toMatchObject({eventId:e.eventId,originalEventType:'GIFT',viewerId:'a',kind:'gift',state:'active'});
});
it('readiness blocks missing models; removing the owner cancels safely',()=>{
 const d=new ShowDirector();d.receive(event('VIEWER_JOIN'));d.update(.1,ids,new Set());expect(d.active).toBeUndefined();d.update(.1,ids,ids);expect(d.active?.id).toBe('a');d.update(.1,new Set(),new Set());expect(d.active).toBeUndefined();expect(d.history[0].state).toBe('cancelled');
});
it('F8 cancellation leaves no queued or active principal presentation',()=>{
 const d=new ShowDirector();d.receive(event('VIEWER_JOIN'));d.receive(event('GIFT','b',{metadata:{tier:'HIGH'}}));d.update(0,ids,ids);d.clear();expect(d.queue).toHaveLength(0);expect(d.active).toBeUndefined();expect(d.history.every(p=>p.state==='cancelled')).toBe(true);
});
it('casting retains existing positions and replaces only one ID when the owner is offscreen',()=>{
 const d=new ShowDirector();for(const id of ['a','b','c','d','e']){d.receive(event('VIEWER_JOIN',id));advance(d,7);}expect(d.select([...ids])).toEqual(['a','b','c','d','e']);d.receive(event('GIFT','g',{metadata:{tier:'HIGH'}}));d.update(0,ids,ids);expect(d.select([...ids])).toEqual(['g','b','c','d','e']);d.receive(event('VIEWER_JOIN','f'));d.update(.1,ids,ids);expect(d.select([...ids])).toEqual(['g','b','c','d','e']);
});
it('camera transitions remain finite and physically bounded, following real owner positions',()=>{
 const d=new ShowDirector(),c=new T.PerspectiveCamera(34,9/16,.1,100);d.camera(c,1/60,undefined,{reduced:false});const initial=c.position.clone();
 d.receive(event('GIFT','a',{metadata:{tier:'HIGH'}}));d.update(0,ids,ids);
 const owner=new T.Vector3(-2,0,-8);
 for(let i=0;i<300;i++){const old=c.position.clone(),q=c.quaternion.clone();d.camera(c,1/60,owner,{reduced:false});expect(c.position.distanceTo(old)).toBeLessThanOrEqual(.150001);expect(q.angleTo(c.quaternion)).toBeLessThanOrEqual(.85/60+.00001);expect(c.position.toArray().every(Number.isFinite)).toBe(true);}
 expect(c.position.distanceTo(initial)).toBeGreaterThan(4);expect(d.target.distanceTo(owner.clone().add(new T.Vector3(0,1.5,0)))).toBeLessThan(.001);
});
it('animation resumes its saved time once per presentation, independent of camera and lower events',()=>{
 const root=new T.Object3D(),clips=['Idle','A','B'].map(name=>new T.AnimationClip(name,10,[])),p=new Player(root,clips),memory=new PresentationPlayback();
 memory.apply('a',p,'A','presentation1');p.update(.1);const time=p.actions.A.time;memory.apply('a',p,'B','presentation2');p.update(.1);memory.apply('a',p,'A','presentation1');expect(p.actions.A.time).toBeCloseTo(time);
 for(let i=0;i<10;i++){memory.apply('a',p,'A','presentation1');p.update(.1);}expect(p.actions.A.time).toBeGreaterThan(time+.9);expect(memory.inspect().every(r=>r.starts===1)).toBe(true);p.dispose();
});
it('the integrated renderer and SceneManager delegate main camera mutations to ShowDirector',()=>{
 for(const file of ['src/scene.ts','src/integration/show.ts','src/character-engine/lab.ts']){
 const source=readFileSync(file,'utf8');expect(source).not.toMatch(/(?:this\.|scene\.)?camera\.(?:position|quaternion)\.(?:set|copy|lerp|slerp|add)\(/);expect(source).not.toMatch(/camera\.lookAt\(/);expect(source).not.toMatch(/camera\.(?:fov|aspect)\s*=/);
 }
 expect(readFileSync('src/integration/show.ts','utf8')).not.toContain('new VisualQueue');expect(readFileSync('src/integration/show.ts','utf8')).not.toContain('new ArrivalSpotlight');
});
