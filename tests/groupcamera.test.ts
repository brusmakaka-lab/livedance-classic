import {it,expect} from 'vitest';
import * as T from 'three';
import {ShowDirector} from '../src/integration/show-director';
import {lineupPose} from '../src/integration/lineup';
import type {LiveEvent} from '../src/domain';
const owner=new T.Vector3(2.1,0,-10.2),ids=new Set(['owner']);
function shot(kind:'VIEWER_JOIN'|'GIFT',aspect=9/16){
 const d=new ShowDirector(),c=new T.PerspectiveCamera(34,aspect,.1,100);
 d.receive({schemaVersion:1,source:'simulator',eventId:kind,viewerId:'owner',username:'Nombre',eventType:kind,giftCount:1,timestamp:0,metadata:{tier:'HIGH'}} as LiveEvent);d.update(0,ids,ids);return {d,c};
}
function settle(d:ShowDirector,c:T.PerspectiveCamera,opts:{reduced:boolean;preview?:boolean}){for(let i=0;i<600;i++)d.camera(c,1/60,owner,opts);}
it('HERO shows a smaller principal than the old close shot and keeps its body inside the portrait',()=>{
 const {d,c}=shot('VIEWER_JOIN');settle(d,c,{reduced:false});
 const project=(camera:T.PerspectiveCamera)=>[owner.clone(),owner.clone().add(new T.Vector3(0,3.5,0))].map(p=>p.project(camera));
 const old=c.clone();old.position.copy(owner).add(new T.Vector3(2.6,3.8,11.8));old.lookAt(owner.clone().add(new T.Vector3(0,1.85,0)));old.updateMatrixWorld();
 const [feet,head]=project(c),[oldFeet,oldHead]=project(old);
 expect(head.y-feet.y).toBeLessThan((oldHead.y-oldFeet.y)*.8);expect(Math.max(Math.abs(feet.x),Math.abs(head.x),Math.abs(feet.y),Math.abs(head.y))).toBeLessThan(1);
});
it('VIP looks down steeply and keeps that angle across narrow and standard portraits',()=>{
 const angles=[];for(const aspect of [9/16,1/2,3/5]){const {d,c}=shot('GIFT',aspect);settle(d,c,{reduced:false});const forward=c.getWorldDirection(new T.Vector3());const angle=Math.asin(-forward.y);angles.push(angle);expect(angle).toBeGreaterThan(30*Math.PI/180);expect(angle).toBeLessThan(45*Math.PI/180);expect(owner.clone().add(new T.Vector3(0,1.5,0)).project(c).x).toBeCloseTo(0,3);}
 expect(Math.max(...angles)-Math.min(...angles)).toBeLessThan(.001);
});
it('fixed camera and skin preview retain the base framing',()=>{
 const {d,c}=shot('GIFT');settle(d,c,{reduced:true});expect(c.position.distanceTo(lineupPose(c.aspect).position)).toBeLessThan(.001);
 settle(d,c,{reduced:false,preview:true});expect(c.position.distanceTo(owner.clone().add(new T.Vector3(2.6,3.8,11.8*Math.max(1,(365/648)/c.aspect))))).toBeLessThan(.001);expect(d.target.distanceTo(owner.clone().add(new T.Vector3(0,1.85,0)))).toBeLessThan(.001);
});
it('the group influences edge composition without moving actors or losing the principal',()=>{
 const {d,c}=shot('VIEWER_JOIN'),group=[[-1.25,0,-3.6],[1.25,0,-5.2],[-2.1,0,-8],[0,0,-9],[2.1,0,-10.2]].map(p=>new T.Vector3(...p)),before=group.map(p=>p.toArray());
 for(let i=0;i<600;i++)d.camera(c,1/60,owner,{reduced:false,group});
 expect(group.map(p=>p.toArray())).toEqual(before);expect(d.target.x).toBeGreaterThan(0);expect(d.target.x).toBeLessThan(owner.x);expect(d.target.z).toBeGreaterThan(owner.z);
 const principal=owner.clone().add(new T.Vector3(0,1.5,0)).project(c);expect(Math.abs(principal.x)).toBeLessThan(.35);expect(Math.abs(principal.y)).toBeLessThan(.5);
});
