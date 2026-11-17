import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';
import {Store} from './skins/store.mjs';import {decodePNG} from './skins/png.mjs';
export const names=['mila.wave','nico.groove','luna.moves','emi.beat','noa.flow','max.vibes','sol.pop','leo.motion','alma.star','cami.sun','alex.neon','vale.beat','kai.disco','zoe.dance','nico.groove'];
export async function server(project,tag,port,library=process.cwd()){
 const root=path.join(project,'temp',tag+'-'+Date.now());await fs.mkdir(root,{recursive:true});
 await fs.cp(path.join(library,'data-rowshow/skins'),path.join(root,'skins'),{recursive:true});
 const store=new Store(path.join(root,'skins'),path.join(project,'public/integration/skins'),()=>0);await store.init();await store.resetSession();
 const samples=[];for(const record of store.state.records){const pixels=decodePNG(await fs.readFile(path.join(root,'skins/blobs',record.hash+'.png')));let total=0,count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>128){total+=pixels[i]+pixels[i+1]+pixels[i+2];count+=3;}samples.push({id:record.id,lum:total/count});}
 samples.sort((a,b)=>a.lum-b.lum);const dark=samples[0];
 const publicIds=store.state.records.filter(r=>['coral','milo','nova'].some(name=>r.name.toLowerCase().includes(name))).map(r=>r.id);
 const fixtures=publicIds.length>=3?publicIds.slice(0,3):store.state.records.slice(0,3).map(r=>r.id);
 for(let i=0;i<61;i++)await store.assign(createHash('sha256').update('phase2:viewer-'+i).digest('hex'),names[i]||'Persona '+(i+1),i===14?dark.id:fixtures[i%fixtures.length]);
 const child=spawn(process.execPath,['scripts/server.mjs'],{cwd:project,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,LIVEDANCE_PORT:String(port),LIVEDANCE_DATA_DIR:path.join(root,'music'),LIVEDANCE_SKIN_DIR:path.join(root,'skins')}});
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/health');if(r.ok){const info=await r.json();if(info.pid!==child.pid)throw Error('Foreign server on port');return {root,url:'http://127.0.0.1:'+port+'/?empty=1&clean=1&diagnostics=1',dark,fixtures,close:()=>child.kill()};}}catch{}await new Promise(r=>setTimeout(r,100));}
 child.kill();throw Error('Server did not start '+output);
}
export function event(sequence,type,id,extra={}){return {schemaVersion:1,source:'simulator',eventId:'polish-'+sequence,viewerId:'viewer-'+id,username:names[id]||'Persona '+(id+1),eventType:type,giftCount:1,timestamp:Date.now(),metadata:{},...extra};}
export async function configure(page){await page.waitForFunction(()=>window.__V05?.inspect().ready);await page.evaluate(()=>{
 const w=__V05.world;w.config.afk=false;w.config.adaptive=false;w.config.quality='MEDIUM';
 __V05.configure({gpuBudget:60,segmentSize:3,profilePhotos:true,backgroundNames:'FULL'});
 Object.assign(__V05.show.entertainment.config,{topOverlay:false,goalsOverlay:false,hypeOverlay:false});
 document.querySelector('#toast').hidden=true;
});}
export async function installAudit(page){await page.evaluate(()=>{
 const show=__V05.show,scene=__V04.debug.scene;window.polishAudit={frames:[],failures:[],checks:0};
 window.auditPolish=function(time){
  const camera=scene.camera,stage=show.container.getBoundingClientRect(),bodies=show.framing(camera),d=show.director;
  const visible=bodies.filter(b=>b.x1>0&&b.x0<1&&b.y1>0&&b.y0<1),owner=show.banner.hidden?'':show.banner.dataset.viewerId;
  const labels=[...show.actors].filter(([,a])=>!a.label.hidden).map(([id,a])=>{const r=a.label.getBoundingClientRect();return {id,x:r.x-stage.x,y:r.y-stage.y,width:r.width,height:r.height,owner:a.label.dataset.viewerId,text:a.label.querySelector('.name-text')?.textContent};});
  // A finished GPU fade leaves an actor allocated until the next update; it is no longer part of the displayed cast.
  const expected=d.viewIds([...show.actors.keys()].filter(id=>!d.rotation.retired?.has(id))),viewKey=expected.join('|');
  if(window.lastAuditView!==viewKey){window.lastAuditView=viewKey;window.lastAuditViewAt=time;}
  const frame={time,expected,retiring:[...(d.rotation.fading?.keys()||[])].map(id=>({id,opacity:d.rotation.opacity(id,d.time)})),retired:[...(d.rotation.retired||[])],phase:window.polishSetup?'setup':'test',owner,kind:show.banner.hidden?'':show.banner.dataset.kind,active:d.active?.id,transition:d.transitionRemaining||0,cut:d.cutRevision||0,visible:bodies,labels,inset:show.arrivalCard.hidden?'':show.arrivalCard.dataset.viewerId,insetOpacity:Number(show.arrivalCard.style.opacity||1),registered:show.world.spawn.dancers.size};
  const fail=(kind,details={})=>polishAudit.failures.push({time,kind,owner,...details});
  if(owner){const b=bodies.find(b=>b.id===owner);if(!b||b.x1<.02||b.x0>.98||b.y1<.02||b.y0>.98)fail('announced-without-body',{bounds:b});
    if(!labels.some(l=>l.id===owner)&&show.world.config.names&&show.config.backgroundNames!=='OFF')fail('protagonist-label-missing');
  }
  if(d.active?.id&&!owner&&!(d.transitionRemaining>0))fail('active-without-fixed-name',{active:d.active.id});
  if(visible.length===0&&show.actors.size&&!window.polishSetup&&!(d.transitionRemaining>0))fail('empty-stage');
  for(const b of visible){if(b.x0<-.012||b.x1>1.012||b.y0<.015||b.y1>.92)fail('body-cut',{id:b.id,bounds:b});
    if(!labels.some(l=>l.id===b.id)&&!d.transitionRemaining&&show.world.config.names&&show.config.backgroundNames!=='OFF')fail('body-without-label',{id:b.id});
  }
  if(!window.polishSetup&&!d.transitionRemaining&&time-window.lastAuditViewAt>1)for(const id of expected)if(!visible.some(b=>b.id===id))fail('selected-body-missing',{id});
  for(const l of labels)if(l.owner!==l.id)fail('wrong-name-owner',{label:l});
  if(show.stage?.vipBinding&&d.active?.kind==='vip'&&show.stage.vipBinding.id!==d.active.id)fail('wrong-vip-effect');
  polishAudit.frames.push(frame);polishAudit.checks++;
  return frame;
 };
 });}
