import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {ArrivalLineup,lineupPose} from '../src/integration/lineup';
import {CinematicCameraDirector} from '../src/integration/camera';
import {integrationConfig} from '../src/integration/config';
describe('fixed arrival lineup',()=>{
 it('moves the newest to the front without losing the 30 registered identities',()=>{
  const l=new ArrivalLineup(),ids=Array.from({length:30},(_,i)=>'v'+i);l.sync(ids);
  expect(l.visible()).toEqual(ids.slice(0,5));l.promote('v29');
  expect(l.visible()).toEqual(['v29','v0','v1','v2','v3']);expect(new Set(l.order)).toEqual(new Set(ids));
  l.promote('v28');expect(l.visible()).toEqual(['v28','v29','v0','v1','v2']);
 });
 it('keeps order under sync and repeated ids; removes only participants absent from registry',()=>{
  const l=new ArrivalLineup();l.sync(['a','b','a','c']);l.promote('c');l.promote('c');l.sync(['a','b','c','d']);
  expect(l.order).toEqual(['c','a','b','d']);l.sync(['a','b','d']);expect(l.order).toEqual(['a','b','d']);
  l.promote('missing');expect(l.order.length).toBe(3);
 });
 it('temporarily focuses VIP without overwriting the arrival order',()=>{
  const l=new ArrivalLineup();l.sync(['a','b','c','d','e','f']);l.promote('b');const order=[...l.order];
  expect(l.visible('f')[0]).toBe('f');expect(l.order).toEqual(order);expect(l.visible()[0]).toBe('b');
 });
 it('manual next rotates the window without duplicates or data loss',()=>{
  const l=new ArrivalLineup();l.sync(Array.from({length:12},(_,i)=>String(i)));l.next();expect(l.visible()).toEqual(['5','6','7','8','9']);
  expect(new Set(l.order).size).toBe(12);l.sync([]);expect(l.visible()).toEqual([]);
 });
 it('camera remains identical through Follow, VIP and Fever and population changes',()=>{
  const d=new CinematicCameraDirector(),c=new T.PerspectiveCamera(34,365/648,.1,100);d.lineup=true;
  d.update(c,1,new T.Vector3(),0,1/60);const p=c.position.toArray(),q=c.quaternion.toArray();
  for(const event of ['follow','vip','fever',''] as const)for(const age of [0,.8,2,5,10]){
   d.event=event;d.age=age;d.update(c,30,new T.Vector3(2,0,-5),age,1/60);
   expect(c.position.toArray()).toEqual(p);expect(c.quaternion.toArray()).toEqual(q);expect(d.velocity.length()).toBe(0);
  }
  expect(lineupPose(.4).position.z).toBeGreaterThan(lineupPose(365/648).position.z);
 });
 it('is reversible and preserves existing settings',()=>{
  expect(integrationConfig({}).lineup).toBe(true);
  expect(integrationConfig({lineup:false,featured:30,entrance:false})).toMatchObject({lineup:false,featured:30,entrance:false});
 });
});
