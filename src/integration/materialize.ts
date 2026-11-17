import * as T from 'three';
import {smooth, HIP, EXCITED} from './show/show-plan';

export const ARRIVAL_INTERVAL = 3.5;
/** Uniform root reveal: imported bone motion is never rewritten. */
export function materializeState(age:number,reduced=false){
 const reveal=smooth((age-.48)/.32);
 return {visible:reduced||age>=.48,scale:reduced?1:Math.max(.015,reveal),opacity:reduced?1:Math.min(1,reveal*2),
  glow:reduced?0:smooth((age-.35)/.16)*(1-smooth((age-.8)/.65)),
  energy:smooth((age-.25)/.2)*(1-smooth((age-1.35)/.8)),
  phase:age<.48?'ANUNCIO':age<.85?'ENTRADA':age<2.5?'EN LA PISTA':'A BAILAR'};
}
export function backgroundDance(id:string){let n=0;for(const c of id)n=(n*31+c.codePointAt(0)!)|0;return(n&1)?EXCITED:HIP;}

function ribbonGeometry(){
 const p:number[]=[],indices:number[]=[];
 for(let i=0;i<=80;i++){
  const t=i/80,a=t*Math.PI*2.4,r=.91-.13*t,y=t*1.55;
  for(const dy of [-.032,.032])p.push(Math.cos(a)*r,y+dy,Math.sin(a)*r);
  if(i<80){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);return g;
}
/** Original analytic glow/ribbons. No downloaded image, postprocessing or added lights. */
export class MaterializeEffect{
 root=new T.Group();
 private groundGeometry=new T.PlaneGeometry(3.4,3.4);
 private columnGeometry=new T.CylinderGeometry(.75,.96,2.8,20,1,true);
 private ribbonGeometry=ribbonGeometry();
 private glowTexture:T.DataTexture;
 private groundMaterial:T.MeshBasicMaterial;
 private columnMaterial=new T.MeshBasicMaterial({color:0xa9f2d2,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
 private ribbonMaterial=new T.MeshBasicMaterial({color:0xe5f4a1,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
 private ground:T.Mesh;
 private column=new T.Mesh(this.columnGeometry,this.columnMaterial);
 private ribbons=[new T.Mesh(this.ribbonGeometry,this.ribbonMaterial),new T.Mesh(this.ribbonGeometry,this.ribbonMaterial)];
 constructor(scene:T.Scene){
  const pixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   const r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5),i=(y*64+x)*4;
   pixels[i]=100;pixels[i+1]=255;pixels[i+2]=187;
   pixels[i+3]=Math.round(255*Math.max(0,1-r)**1.6);
  }
  this.glowTexture=new T.DataTexture(pixels,64,64,T.RGBAFormat);this.glowTexture.needsUpdate=true;
  this.groundMaterial=new T.MeshBasicMaterial({map:this.glowTexture,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
  this.ground=new T.Mesh(this.groundGeometry,this.groundMaterial);this.ground.rotation.x=-Math.PI/2;this.ground.position.y=.035;
  this.column.position.y=1.4;this.root.add(this.ground,this.column,...this.ribbons);this.root.visible=false;scene.add(this.root);
 }
 update(age:number|undefined,origin:T.Vector3,intensity:number,reduced:boolean,low:boolean){
  if(age===undefined||intensity===0){this.clear();return;}
  const s=materializeState(age,reduced);this.root.visible=s.energy>.001;this.root.position.copy(origin);
  this.groundMaterial.opacity=s.energy*intensity*.85;
  this.column.visible=!reduced&&!low;this.columnMaterial.opacity=s.glow*intensity*.065;
  this.ribbonMaterial.opacity=s.energy*intensity*.74;
  this.ribbons.forEach((r,i)=>{r.visible=!reduced&&(!low||i===0);r.rotation.y=age*3.8+i*Math.PI;r.position.y=.04+i*.1+Math.max(0,age-.5)*.45;});
 }
 clear(){this.root.visible=false;}
 dispose(){this.root.removeFromParent();this.groundGeometry.dispose();this.columnGeometry.dispose();this.ribbonGeometry.dispose();this.glowTexture.dispose();this.groundMaterial.dispose();this.columnMaterial.dispose();this.ribbonMaterial.dispose();}
}
