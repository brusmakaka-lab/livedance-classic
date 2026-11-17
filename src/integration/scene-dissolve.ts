import * as T from 'three';

/** A 280 ms dissolve of the previous rendered scene, never a new HUD or an empty travel. */
export class SceneDissolve {
  private texture?:T.FramebufferTexture;
  private size=new T.Vector2();
  private scene=new T.Scene();
  private camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  private material=new T.MeshBasicMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  private quad=new T.Mesh(new T.PlaneGeometry(2,2),this.material);
  private revision=-1;
  private captured=false;
  constructor(){this.scene.add(this.quad);}
  render(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,revision:number,remaining:number){
    const size=renderer.getDrawingBufferSize(new T.Vector2());
    if(!this.texture||!size.equals(this.size)){
      this.texture?.dispose();this.texture=new T.FramebufferTexture(size.x,size.y);this.texture.colorSpace=T.SRGBColorSpace;this.size.copy(size);this.material.map=this.texture;this.material.needsUpdate=true;this.captured=false;
    }
    renderer.render(scene,camera);
    if(remaining>0&&this.captured){
      this.material.opacity=Math.min(1,remaining/.28);
      const clear=renderer.autoClear;renderer.autoClear=false;renderer.render(this.scene,this.camera);renderer.autoClear=clear;
    }
    if(remaining<=0||!this.captured){renderer.copyFramebufferToTexture(this.texture);this.captured=true;}
    this.revision=revision;
  }
  reset(){this.captured=false;this.revision=-1;}
  dispose(){this.texture?.dispose();this.quad.geometry.dispose();this.material.dispose();}
}
