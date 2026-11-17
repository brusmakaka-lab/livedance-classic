import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {entranceState,EntranceEffect} from '../src/integration/entrance';
import {VisualQueue} from '../src/integration/cast';
import {integrationConfig} from '../src/integration/config';
describe('Entrance presentation',()=>{
 it('bounded reveal and recovery, reduced motion keeps full-size body',()=>{
  for(let age=0;age<=5;age+=.01){const s=entranceState(age);expect(s.scale).toBeGreaterThanOrEqual(.82);expect(s.scale).toBeLessThanOrEqual(1);expect(s.energy).toBeGreaterThanOrEqual(0);expect(s.energy).toBeLessThanOrEqual(1);expect(entranceState(age,true).scale).toBe(1);}
  expect(entranceState(0).visible).toBe(false);expect(entranceState(1.2).visible).toBe(true);expect(entranceState(4.2).camera).toBe(0);expect(entranceState(4.2).energy).toBe(0);
 });
 it('extended Follow yields immediately to VIP and bounded queue survives',()=>{
  const q=new VisualQueue();q.push('follow','first','','',4.2);expect(q.active?.duration).toBe(4.2);
  q.push('vip','vip');q.push('follow','second','','',4.2);expect(q.active?.id).toBe('vip');q.update(8.1);expect(q.active?.id).toBe('second');q.update(4.2);expect(q.active).toBeUndefined();q.clear();expect(q.queue).toEqual([]);
 });
 it('effect geometry reused across events and detached on dispose',()=>{
  const scene=new T.Scene(),effect=new EntranceEffect(scene);const children=[...effect.root.children];
  for(let i=0;i<50;i++){effect.update(1,new T.Vector3(),.6,false,false);effect.clear();}
  expect(effect.root.children).toEqual(children);expect(effect.root.visible).toBe(false);
  effect.update(1,new T.Vector3(),0,false,false);expect(effect.root.visible).toBe(false);effect.dispose();expect(scene.children).toHaveLength(0);
 });
 it('old configuration gains entrance flag and preserves explicit opt-out',()=>{
  expect(integrationConfig({featured:20}).entrance).toBe(true);expect(integrationConfig({entrance:false}).entrance).toBe(false);
 });
});
