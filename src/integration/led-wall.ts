import * as T from 'three';
import { LEDState } from './led-state';
/** Three existing panels composed into the vertical header; no audio/video dependency. */
export class LEDWall {
  compact=false;
  root=new T.Group(); geometry=new T.PlaneGeometry(1,1);
  canvases=[0,1,2].map(i=>{const c=document.createElement('canvas');c.width=i===1?768:512;c.height=i===1?96:192;return c;});
  textures=this.canvases.map(c=>{const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.generateMipmaps=false;t.minFilter=T.LinearFilter;return t;});
  materials=this.textures.map(map=>new T.MeshBasicMaterial({map,toneMapped:false,fog:false,depthTest:false,depthWrite:false}));
  last=-1; uploads=0; tick=-1; mode=''; point=new T.Vector3(); corner=new T.Vector3();
  constructor(scene:T.Scene){this.materials.forEach(m=>{const panel=new T.Mesh(this.geometry,m);panel.renderOrder=20;panel.frustumCulled=false;this.root.add(panel);});scene.add(this.root);}
  update(state:LEDState,enabled:boolean,paused:boolean,priority:boolean,camera:T.PerspectiveCamera,time:number,reduced:boolean,mode:string){
    this.root.visible=enabled&&!priority;
    if(!enabled)return;
    this.materials.forEach(m=>m.color.setScalar(paused?.2:.9));
    // Reuse the established screen-space depth policy. Panels occupy 12–25% only.
    const boxes=this.compact?[[.12,.152,.365,.052],[.12,.12,.76,.028],[.515,.152,.365,.052]]:[[.12,.179,.365,.076],[.12,.12,.76,.041],[.515,.179,.365,.076]];
    boxes.forEach(([x,y,w,h],i)=>{
      this.point.set((x+w/2)*2-1,1-(y+h/2)*2,.6).unproject(camera);
      this.corner.set((x+w)*2-1,1-y*2,.6).unproject(camera).sub(this.point).applyQuaternion(camera.quaternion.clone().invert());
      const panel=this.root.children[i];panel.position.copy(this.point);panel.quaternion.copy(camera.quaternion);panel.scale.set(Math.abs(this.corner.x)*2,Math.abs(this.corner.y)*2,1);
    });
    if(paused||priority)return;
    if(this.last!==state.revision){this.last=state.revision;this.side(0,state);this.side(2,state);}
    const tick=reduced?0:Math.floor(time*8);
    if(tick!==this.tick||mode!==this.mode){this.tick=tick;this.mode=mode;this.center(tick/8,mode);}
  }
  base(i:number,accent:string){const c=this.canvases[i],ctx=c.getContext('2d')!;ctx.fillStyle='#0d1b29';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#304455';ctx.lineWidth=3;ctx.strokeRect(2,2,c.width-4,c.height-4);ctx.fillStyle=accent;ctx.fillRect(0,0,6,c.height);return ctx;}
  text(ctx:CanvasRenderingContext2D,text:string,width:number){let value=text;while(ctx.measureText(value).width>width&&value.length>1)value=value.slice(0,-1);return value===text?value:value.slice(0,-1)+'…';}
  side(i:number,state:LEDState){const data=i===0?state.follow:state.gift,accent=i===0?'#8ae1cd':'#edbe81',ctx=this.base(i,accent);ctx.textAlign='left';ctx.fillStyle=accent;ctx.font='600 25px sans-serif';ctx.fillText((i===0?'FOLLOW':'REGALO')+' · '+(data?.source||'EN ESPERA'),26,37);ctx.fillStyle='#f4f4ee';ctx.font='bold 57px sans-serif';ctx.fillText(this.text(ctx,data?.name||'Tu lugar aquí',460),26,108);ctx.fillStyle='#c3ced7';ctx.font='34px sans-serif';ctx.fillText(this.text(ctx,i===0?(data?'¡Bienvenido a la pista!':'Seguí el LIVE'):(state.gift?.gift||'Sin regalos todavía'),460),26,160);this.textures[i].needsUpdate=true;this.uploads++;}
  center(time:number,mode:string){const ctx=this.base(1,'#8ae1cd');ctx.fillStyle='#eaf7f3';ctx.font='bold 34px sans-serif';ctx.fillText('LIVE DANCE',25,58);ctx.fillStyle='#b5c6d3';ctx.font='25px sans-serif';ctx.fillText(mode,272,56);for(let i=0;i<25;i++){const h=8+43*Math.pow(.5+.5*Math.sin(i*.69-time*1.6),2);ctx.fillStyle=i%4?'#54adad':'#ba8bbd';ctx.fillRect(451+i*12,72-h,6,h);}this.textures[1].needsUpdate=true;this.uploads++;}
  dispose(){this.root.removeFromParent();this.geometry.dispose();this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}
