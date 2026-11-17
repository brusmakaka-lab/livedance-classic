import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as T from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {retarget} from './retarget-v065.mjs';
import {getRig,createSkinRig,adaptClips} from '../src/integration/model.ts';
const file=process.env.LIVEDANCE_MIXAMO_FILE || 'C:/Users/Usuario/Documents/Codex/2026-10-08/files-pasted-by-the-user-proyecto/outputs/LiveDance-AnimationLab-phase3B/assets/mixamo-imports/Hip Hop Dancing.fbx';
const report={file,provenance:'User supplied Adobe Mixamo download; no new download',accepted:false};
const buffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();}).catch(e=>this.onerror?.(e));}};
try{
 const bytes=await fs.readFile(file);report.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 const source=new FBXLoader().parse(buffer(bytes),'');
 const gltf=await new GLTFLoader().parseAsync(buffer(await fs.readFile('public/integration/rio-mixamo.glb')),'');
 const result=retarget(source,gltf.scene);report.metrics=result.metrics;
 result.raw.name='MixamoHipHopDeep';result.looped.name='MixamoHipHopDeepLoop';
 const src=getRig(gltf.scene),out={},checks=[];
 for(const model of ['classic','slim']){
  const rig=createSkinRig(src,model,new T.Texture());
  const adapted=adaptClips(src,rig,[result.raw,result.looped]);
  out[model]={clips:adapted.clips.map(c=>T.AnimationClip.toJSON(c)),stats:adapted.stats};
  for(const clip of adapted.clips){
   const mixer=new T.AnimationMixer(rig.root),a=mixer.clipAction(clip).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();
   let minY=Infinity,maxY=-Infinity,maxXZ=0;const pos=new T.Vector3();
   for(let i=0;i<=Math.ceil(clip.duration*60);i++){
    mixer.setTime(Math.min(clip.duration,i/60));rig.root.updateMatrixWorld(true);
    for(const mesh of rig.meshes)for(let j=0;j<mesh.geometry.attributes.position.count;j++){
     mesh.getVertexPosition(j,pos).applyMatrix4(mesh.matrixWorld);
     if(![pos.x,pos.y,pos.z].every(Number.isFinite))throw Error('Non-finite vertex');
     minY=Math.min(minY,pos.y);maxY=Math.max(maxY,pos.y);maxXZ=Math.max(maxXZ,Math.abs(pos.x),Math.abs(pos.z));
    }
   }
   checks.push({model,clip:clip.name,minY,maxY,maxXZ,samples:Math.ceil(clip.duration*60)+1});
   mixer.stopAllAction();mixer.uncacheRoot(rig.root);
  }
 }
 report.checks=checks;
 if(checks.some(c=>c.minY<-.025||c.maxY>3.5||c.maxXZ>1.5))throw Error('Clip outside floor / framing safety budget');
 const exported=await new GLTFExporter().parseAsync(gltf.scene,{binary:true,animations:[result.raw,result.looped]});
 await fs.writeFile('public/integration/hip-hop-deep.glb',Buffer.from(exported));
 await fs.writeFile('public/integration/extra-clips.json',JSON.stringify(out));
 report.accepted=true;
}catch(e){report.error=String(e);}
await fs.writeFile('docs/v065/animation-import.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({accepted:report.accepted,error:report.error,checks:report.checks,sha256:report.sha256}));
