import fs from 'node:fs/promises';import crypto from 'node:crypto';
import * as T from 'three';import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {retarget} from './retarget-v065.mjs';import {getRig,createSkinRig,adaptClips,disposeActor} from '../src/integration/model.ts';
const files=['Boxing','Twist Dance','Rumba Dancing','Hip Hop Dancing (2)','Dancing Twerk','Flair','Swing To Land'],reports=[],out={classic:{clips:[]},slim:{clips:[]}},catalog=[];
const buffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
for(const name of files){
 const report={file:'C:/Users/Usuario/Downloads/'+name+'.fbx',name,accepted:false,provenance:'Adobe Mixamo, confirmed by user 2026-10-20'};
 try{
  const bytes=await fs.readFile(report.file);report.bytes=bytes.length;report.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const source=new FBXLoader().parse(buffer(bytes),'');const clip=source.animations[0];
  if(!clip||!clip.tracks.length||clip.duration<=0)throw Error('No valid animation');
  const bones=[];source.traverse(o=>{if(o.isBone)bones.push({name:o.name,parent:o.parent?.name});});
  report.source={duration:clip.duration,tracks:clip.tracks.length,bones,keys:clip.tracks.reduce((n,t)=>n+t.times.length,0),channels:clip.tracks.map(t=>({name:t.name,keys:t.times.length}))};
  const gltf=await new GLTFLoader().parseAsync(buffer(await fs.readFile('public/integration/rio-mixamo.glb')),'');
  const result=retarget(source,gltf.scene);report.metrics=result.metrics;const id='Mixamo'+name.replace(/[^A-Za-z0-9]/g,'')+'Loop';result.looped.name=id;
  const src=getRig(gltf.scene),adaptedByModel={},checks=[];
  for(const model of ['classic','slim']){
   const rig=createSkinRig(src,model,new T.Texture()),adapted=adaptClips(src,rig,[result.looped]),c=adapted.clips[0],mixer=new T.AnimationMixer(rig.root),a=mixer.clipAction(c).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();
   let minY=Infinity,maxY=-Infinity,maxXZ=0,maxX=0,maxZ=0;const p=new T.Vector3();
   for(let i=0;i<=Math.ceil(c.duration*30);i++){
    mixer.setTime(Math.min(c.duration,i/30));rig.root.updateMatrixWorld(true);
    for(const mesh of rig.meshes)for(let j=0;j<mesh.geometry.attributes.position.count;j++){
     mesh.getVertexPosition(j,p).applyMatrix4(mesh.matrixWorld);if(![p.x,p.y,p.z].every(Number.isFinite))throw Error('Non-finite pose');
     minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);maxXZ=Math.max(maxXZ,Math.abs(p.x),Math.abs(p.z));maxX=Math.max(maxX,Math.abs(p.x));maxZ=Math.max(maxZ,Math.abs(p.z));
    }
   }
   checks.push({model,minY,maxY,maxXZ,maxX,maxZ});adaptedByModel[model]=T.AnimationClip.toJSON(c);mixer.stopAllAction();mixer.uncacheRoot(rig.root);disposeActor(rig);
  }
  report.checks=checks;
  if(checks.some(c=>c.minY<-.025||c.maxY>3.5||c.maxX>1.8||c.maxZ>2.4))throw Error('Outside existing floor/framing safety envelope; quarantined');
  for(const model of ['classic','slim'])out[model].clips.push(adaptedByModel[model]);
  catalog.push({id,label:name,duration:result.looped.duration,role:name==='Boxing'?'entrance':'dance'});report.accepted=true;report.clipId=id;
 }catch(e){report.error=String(e);}
 reports.push(report);console.log({name,accepted:report.accepted,duration:report.source?.duration,error:report.error,checks:report.checks});
 await fs.writeFile('docs/v068/import-audit.json',JSON.stringify(reports,null,2));
}
await fs.writeFile('public/integration/dance-catalog.json',JSON.stringify({version:1,catalog,...out}));
