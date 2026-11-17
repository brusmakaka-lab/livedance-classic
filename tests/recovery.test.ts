import {it,expect} from 'vitest';
import * as T from 'three';
import {TemporalNames} from '../src/integration/temporal-names';
import {Stage} from '../src/integration/show/stage';

it('label corrections are limited per frame, retain every ID and remain bounded around their anchors',()=>{
 const layout=new TemporalNames();
 let previous=new Map<string,number>();
 for(let i=0;i<180;i++){
  const candidates=Array.from({length:5},(_,j)=>({id:'id-'+j,x:140+(j%2)*95,y:200+Math.sin(i/9+j)*2,width:130,height:22,priority:j===3?10:0}));
  const placed=layout.place(candidates,365,648,1/60,.235);expect(placed).toHaveLength(5);expect(placed[0].id).toBe('id-3');
  for(const label of placed){const c=candidates.find(c=>c.id===label.id)!;const offset=label.y-c.y;
   expect(Math.abs(offset)).toBeLessThanOrEqual(64.01);
   if(previous.has(c.id))expect(Math.abs(offset-previous.get(c.id)!)).toBeLessThanOrEqual(55/60+.001);
   previous.set(c.id,offset);
  }
 }
});
it('a name remains attached to its own anchor across draw-order and protagonist changes',()=>{
 const l=new TemporalNames(),a={id:'id-a',x:110,y:240,width:70,height:22},b={id:'id-b',x:260,y:240,width:70,height:22};
 l.place([a,b],365,648,.016);const result=l.place([{...b,x:235,priority:10},{...a,x:130}],365,648,.016);
 expect(result.find(n=>n.id===a.id)?.x).toBe(130);expect(result.find(n=>n.id===b.id)?.x).toBe(235);
});
it('projection at the upper safe-area boundary does not discard an otherwise visible name',()=>{
 const l=new TemporalNames();const r=l.place([{id:'rear',x:180,y:137,width:90,height:22}],365,648,.016,.235);
 expect(r).toHaveLength(1);expect(r[0].y-22).toBeGreaterThanOrEqual(648*.235);
});
it('VIP halo and crown track an explicit ID and origin including during movement',()=>{
 // Bind the existing effects independently of Stage's browser-only canvas floor.
 const s=Object.create(Stage.prototype) as Stage;
 const geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();
 s.halo=new T.Mesh(geometry,material);s.crown=new T.InstancedMesh(geometry,material,7);
 for(const id of ['different-id-one','different-id-two'])for(const x of [-1.4,-.6,0]){
  const origin=new T.Vector3(x,0,-3*x);s.bindVip({id,origin});
  expect(s.halo.userData.viewerId).toBe(id);expect(s.crown.userData.viewerId).toBe(id);
  expect(s.halo.position.clone().sub(new T.Vector3(0,1.75,-1.45)).distanceTo(origin)).toBeLessThan(1e-8);
  expect(s.crown.position.distanceTo(origin)).toBeLessThan(1e-8);
 }
 s.bindVip();expect(s.vipBinding).toBeUndefined();expect(s.halo.userData.viewerId).toBeUndefined();s.crown.dispose();geometry.dispose();material.dispose();
});
