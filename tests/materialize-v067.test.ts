import {describe,it,expect,vi} from 'vitest';
import * as T from 'three';
import {materializeState,backgroundDance,ARRIVAL_INTERVAL,MaterializeEffect} from '../src/integration/materialize';
import {VisualQueue} from '../src/integration/cast';
import {integrationConfig} from '../src/integration/config';
describe('materialization and spaced ingress',()=>{
 it('reveals uniformly from ground then restores full size, opacity and no glow',()=>{
  expect(materializeState(.3).visible).toBe(false);expect(materializeState(.55).scale).toBeLessThan(.5);
  let last=0;for(let i=0;i<120;i++){const s=materializeState(i/60);expect(s.scale).toBeGreaterThanOrEqual(last);expect(s.opacity).toBeGreaterThanOrEqual(0);expect(s.opacity).toBeLessThanOrEqual(1);last=s.scale;}
  expect(materializeState(3.5)).toMatchObject({visible:true,scale:1,opacity:1,glow:0,energy:0});
 });
 it('Reduce motion eliminates scaling and glow',()=>{for(const age of [0,.5,.6,1,3])expect(materializeState(age,true)).toMatchObject({visible:true,scale:1,opacity:1,glow:0});});
 it('presents queued arrivals at 3.5 seconds and never starts an unsolicited rotation',()=>{
  const q=new VisualQueue();for(const id of ['a','b','c'])q.push('follow',id,'','',ARRIVAL_INTERVAL);
  const starts=[['a',0]];let prev=q.active;
  for(let f=1;f<900;f++){q.update(1/60);if(q.active&&q.active!==prev)starts.push([q.active.id,f/60]);prev=q.active;}
  expect(starts.length).toBe(3);expect(starts[1][1]).toBeCloseTo(3.5,1);expect(starts[2][1]).toBeCloseTo(7,1);expect(q.active).toBeUndefined();
 });
 it('VIP can interrupt and emergency can clear the queue',()=>{const q=new VisualQueue();q.push('follow','a','','',ARRIVAL_INTERVAL);q.update(.5);q.push('vip','vip');q.push('follow','b','','',ARRIVAL_INTERVAL);expect(q.active?.id).toBe('vip');q.clear();q.update(30);expect(q.active).toBeUndefined();expect(q.queue).toHaveLength(0);});
 it('keeps background clip stable per identity, with two existing clips across a cast',()=>{const ids=Array.from({length:30},(_,i)=>'viewer-'+i),a=ids.map(backgroundDance);expect(new Set(a).size).toBe(2);expect([...ids].reverse().map(backgroundDance).reverse()).toEqual(a);expect(integrationConfig({materialize:false}).materialize).toBe(false);});
 it('bounds the effect to four meshes, clears it, and disposes each owned resource once',()=>{
  const scene=new T.Scene(),fx=new MaterializeEffect(scene),disposals=new Map();
  fx.root.traverse(o=>{if(o instanceof T.Mesh){for(const r of [o.geometry,o.material,o.material.map].filter(Boolean)){if(!disposals.has(r)){const fn=vi.fn();r.addEventListener('dispose',fn);disposals.set(r,fn);}}}});
  expect(fx.root.children).toHaveLength(4);fx.update(.8,new T.Vector3(),.6,false,false);expect(fx.root.visible).toBe(true);
  fx.update(.8,new T.Vector3(),0,false,false);expect(fx.root.visible).toBe(false);fx.update(3,new T.Vector3(),.6,false,false);expect(fx.root.visible).toBe(false);
  fx.dispose();expect(scene.children).toHaveLength(0);for(const fn of disposals.values())expect(fn).toHaveBeenCalledTimes(1);
 });
});
