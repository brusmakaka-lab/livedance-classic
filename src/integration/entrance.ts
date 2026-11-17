import * as T from 'three';
import { smooth } from './show/show-plan';

/** Presentation only: no bone keys, viewer ownership or wall-clock timers. */
export function entranceState(age: number, reduced = false) {
  const reveal = smooth((age - .55) / .65);
  return {
    visible: reduced || age >= .55,
    scale: reduced ? 1 : .82 + .18 * reveal,
    energy: smooth(age / .35) * (1 - smooth((age - 2.2) / 1.1)),
    phase: age < .55 ? 'ANUNCIO' : age < 1.2 ? 'ENTRADA' : age < 3.1 ? 'EN LA PISTA' : 'A BAILAR',
    camera: smooth(age / .7) * (1 - smooth((age - 3.1) / 1.1)),
  };
}

/** Three shared draw calls, no textures, no per-event allocations or extra lights. */
export class EntranceEffect {
  root = new T.Group();
  spiral = false;
  private arcGeometry = new T.TorusGeometry(1.05,.014,4,48,Math.PI*1.15);
  private arcMaterial = new T.MeshBasicMaterial({color:0xa9f7df,transparent:true,opacity:0,depthWrite:false});
  private arcs = [new T.Mesh(this.arcGeometry,this.arcMaterial),new T.Mesh(this.arcGeometry,this.arcMaterial)];
  private ringGeometry = new T.RingGeometry(.95, 1.025, 48);
  private cubeGeometry = new T.BoxGeometry(.065, .065, .065);
  private ringMaterial = new T.MeshBasicMaterial({color:0x66f4dc,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
  private cubeMaterial = new T.MeshBasicMaterial({color:0xffd59a,transparent:true,opacity:0,depthWrite:false});
  private inner = new T.Mesh(this.ringGeometry,this.ringMaterial);
  private outer = new T.Mesh(this.ringGeometry,this.ringMaterial);
  private cubes = new T.InstancedMesh(this.cubeGeometry,this.cubeMaterial,20);
  private dummy = new T.Object3D();
  constructor(scene:T.Scene) {
    for(const [i,ring] of [this.inner,this.outer].entries()){
      ring.rotation.x=-Math.PI/2;ring.position.y=.025+i*.005;this.root.add(ring);
    }
    this.arcs.forEach(a=>{a.rotation.x=Math.PI/2;this.root.add(a);});
    this.cubes.frustumCulled=false;this.root.add(this.cubes);this.root.visible=false;scene.add(this.root);
  }
  update(age:number|undefined,origin:T.Vector3,intensity:number,reduced:boolean,low:boolean) {
    this.root.visible=age!==undefined&&intensity>0;
    if(age===undefined)return;
    const s=entranceState(age,reduced);this.root.visible=s.energy>.001&&intensity>0;
    this.root.position.copy(origin);
    this.arcMaterial.opacity=s.energy*.48*intensity;
    this.arcs.forEach((a,i)=>{a.visible=this.spiral&&!reduced;a.position.y=.2+i*.8+Math.min(age,2)*.6;a.rotation.z=age*2.2+i*Math.PI;});
    this.ringMaterial.opacity=s.energy*.7*intensity;
    this.cubeMaterial.opacity=s.energy*.8*intensity;
    this.inner.scale.setScalar(reduced?1:1+.12*Math.sin(Math.min(age,2.2)*Math.PI));
    this.outer.scale.setScalar(reduced?1.3:1.05+.45*smooth(age/1.3));
    this.cubes.count=reduced?0:low?8:20;
    for(let i=0;i<this.cubes.count;i++){
      const angle=i/this.cubes.count*Math.PI*2+age*.6;
      const radius=1.05+.2*Math.sin(i*2.1);
      this.dummy.position.set(Math.cos(angle)*radius,.12+(i%5)*.28+Math.min(age,2)*.45,Math.sin(angle)*radius);
      this.dummy.rotation.set(age*.5+i,age*.4,age*.3);
      this.dummy.scale.setScalar(.7+(i%3)*.25);this.dummy.updateMatrix();
      this.cubes.setMatrixAt(i,this.dummy.matrix);
    }
    this.cubes.instanceMatrix.needsUpdate=true;
  }
  clear(){this.root.visible=false;}
  dispose(){this.root.removeFromParent();this.cubes.dispose();this.ringGeometry.dispose();this.cubeGeometry.dispose();this.ringMaterial.dispose();this.cubeMaterial.dispose();this.arcGeometry.dispose();this.arcMaterial.dispose();}
}
