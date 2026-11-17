import {HorizontalRows} from './horizontal-rows';
import {rowPlacement} from './rotation-layout';
import * as T from 'three';
import type {LiveEvent} from '../domain';
import type {Cue} from './cast';
import {lineupPose} from './lineup';
import {GroupRotation} from './group-rotation';

export type Shot = 'WIDE'|'HERO'|'EVENT'|'VIP'|'FEVER';
export type Presentation = Cue & {
  presentationId:string; eventId:string; originalEventType:string; viewerId:string;
  state:'pending'|'active'|'finished'|'cancelled'; sequence:number; createdAt:number;
  expiresAt:number; activations:number; resumes:number; suspended:boolean;
};
type Log = {time:number; action:string; presentationId?:string; eventId?:string; viewerId?:string; originalEventType?:string; reason?:string};
/** Sole owner of presentation scheduling, casting decisions and the main camera.
 * It never changes World identity, scoring, audio, skin assignments or ingress. */
export class ShowDirector {
  active?:Presentation;
  queue:Presentation[]=[];
  history:Presentation[]=[];
  log:Log[]=[];
  readonly capacity=64;
  rotation:GroupRotation=new GroupRotation();
  rows=false;
  segmentSize=3;
  readonly arrivalCamera=new T.PerspectiveCamera(38,1,0.1,500);
  entrances=new Map<string,Presentation>();
  lastEntrant?:string;
  enableRows(){this.rows=true;this.rotation=new HorizontalRows();}
  spatial=false;
  validActors=new Set<string>();
  mainFramed=new Set<string>();
  private framedPlan?:string;
  insetFramed?:string;
  transitionRemaining=0;
  cutRevision=0;
  private plan?:Presentation;
  private planOwner?:string;
  private insetOwner?:string;
  private insetSince=0;
  private insetTail?:{p:Presentation;until:number};
  setVisualReady(ids:Set<string>){this.spatial=true;this.validActors=new Set(ids);}
  reportFraming(main:Set<string>,inset?:string){this.mainFramed=new Set(main);this.insetFramed=inset;this.framedPlan=this.transitionRemaining<=0?this.plan?.presentationId:undefined;}
  private recognized(id:string){return !this.spatial||(this.transitionRemaining<=0&&this.mainFramed.has(id))||this.insetFramed===id;}
  get cameraCue(){return this.spatial?this.plan:this.cue;}
  private preparePlan(ready:Set<string>){
    if(this.transitionRemaining>0&&this.plan?.id&&ready.has(this.plan.id))return;
    const special=this.queue.find(p=>(p.priority>1||this.clock>=this.groupUntil)&&(!p.id||ready.has(p.id))&&(!this.active||p.priority>this.active.priority));
    const latest=[...this.entrances.values()].filter(p=>ready.has(p.id)).sort((a,b)=>b.sequence-a.sequence)[0];
    const latestKnown=this.lastEntrant?this.rotation.participants.get(this.lastEntrant):undefined;
    if(latest&&(!latestKnown||this.rotation.participants.get(latest.id)!.joinedOrder>=latestKnown.joinedOrder))this.lastEntrant=latest.id;
    this.plan=special||this.active||latest;
    // Older unrecognized burst entries use the existing secondary view; they do not reverse arrival order.
    if(!special&&!this.active&&latest&&this.lastEntrant!==latest.id)this.plan=undefined;
  }
  get cue(){
    if(this.spatial){
      if(this.transitionRemaining>0)return undefined;
      if(this.active)return !this.active.id||this.mainFramed.has(this.active.id)?this.active:undefined;
      return [...this.entrances.values()].filter(p=>p.state==='active'&&this.mainFramed.has(p.id)).sort((a,b)=>b.sequence-a.sequence)[0];
    }
    return this.active||[...this.entrances.values()].filter(p=>p.state==='active').sort((a,b)=>b.sequence-a.sequence)[0];}
  protectedRows(){return new Set([...this.rotation.protected(this.active,this.queue),...this.entrances.keys(),...this.queue.map(p=>p.id),...(this.lastEntrant?[this.lastEntrant]:[])]);}
  viewIds(ids:string[]){
    if(!this.rows)return ids;
    if(this.spatial)ids=ids.filter(id=>this.validActors.has(id));
    const owner=(this.spatial?this.plan?.id:this.cue?.id)||this.lastEntrant;
    const slot=owner?this.rotation.slotOf(owner):0,row=Math.floor(Math.max(0,slot)/20);
    const size=(this.spatial?this.plan:this.active)?.kind==='vip'?3:this.segmentSize;
    const start=(this.spatial?this.plan:this.active)?.kind==='vip'?Math.max(0,Math.min(17,slot%20-1)):Math.floor((Math.max(0,slot)%20)/size)*size;
    return ids.filter(id=>{const n=this.rotation.slotOf(id);return Math.floor(n/20)===row&&n%20>=start&&n%20<Math.min(20,start+size);});
  }
  private groupUntil=0;
  private vipIds=new Set<string>();
  private known=new Set<string>();
  private seen=new Set<string>();
  private sequence=0;
  private epoch=0;
  private clock=0;
  get time(){return this.clock;}
  private framingKey='';
  target=new T.Vector3(0,1.05,-2.8);
  initialized=false;
  shot:Shot='WIDE';
  started=0;
  dropped=0;
  private note(action:string,p?:Partial<Presentation>,reason?:string){
    this.log.push({time:this.clock,action,presentationId:p?.presentationId,eventId:p?.eventId,viewerId:p?.viewerId,originalEventType:p?.originalEventType,reason});
    if(this.log.length>4096)this.log.shift();
  }
  private remember(set:Set<string>,key:string){set.add(key);if(set.size>4096)set.delete(set.values().next().value!);}
  receive(e:LiveEvent,followDuration=5){
    const key=JSON.stringify([e.source,e.sessionId||'local',e.eventId]);
    const info={presentationId:'p:'+key,eventId:e.eventId,viewerId:e.viewerId,originalEventType:e.eventType};
    this.note('received',info);
    if(this.seen.has(key)){this.note('duplicate',info);return;}
    this.seen.add(key); // Session-wide replay protection; reset only on explicit reset.
    const alreadySeated=this.rotation.participants.has(e.viewerId);
    this.rotation.observe(e,this.clock);
    const identity=JSON.stringify([e.source,e.sessionId||'local',e.viewerId]),first=this.rows?!alreadySeated:!this.known.has(identity);
    if(e.eventType!=='SIMULATED')this.remember(this.known,identity);
    if(this.rows&&first&&e.eventType!=='SIMULATED'){
      const p:Presentation={...info,presentationId:info.presentationId+':entry',kind:'welcome',id:e.viewerId,name:e.username,gift:'',age:0,duration:4.2,priority:1,state:'pending',sequence:++this.sequence,createdAt:this.clock,expiresAt:Infinity,activations:0,resumes:0,suspended:false};
      this.entrances.set(e.viewerId,p);this.note('arrival-pending-model',p);
    }
    if(this.rows&&['GIFT','FOLLOW'].includes(e.eventType))this.rotation.admit(e.viewerId,new Set(),this.clock,e.eventId,'return-for-event');
    let kind:Cue['kind']|undefined;
    if(e.eventType==='SIMULATED'&&e.giftId==='fever-demo')kind='fever';
    else if(e.eventType==='GIFT')kind=e.metadata.tier==='HIGH'||e.metadata.top?'vip':'gift';
    else if(e.eventType==='FOLLOW')kind='follow';
    else if(!this.rows&&first&&['VIEWER_JOIN','COMMENT','LIKE_MILESTONE'].includes(e.eventType))kind='welcome';
    if(!kind){this.note('no-presentation',info,'Known viewer or non-presentational event');return;}
    return this.enqueue(kind,info,kind==='fever'?'La pista es de todos':e.username,`${e.giftName||'Regalo'} ×${e.giftCount}`,followDuration);
  }
  triggerFever(){
    if(this.active?.kind==='fever'||this.queue.some(p=>p.kind==='fever'))return;
    const eventId=`hype:${this.epoch}:${this.sequence+1}`;
    return this.enqueue('fever',{presentationId:eventId,eventId,viewerId:'',originalEventType:'HYPE_THRESHOLD'},'La pista es de todos','',5);
  }
  private enqueue(kind:Cue['kind'],info:Pick<Presentation,'presentationId'|'eventId'|'viewerId'|'originalEventType'>,name:string,gift:string,followDuration:number){
    const duration={welcome:5,follow:Math.max(2.8,Math.min(7,followDuration)),gift:3,vip:8,fever:12}[kind];
    const p:Presentation={...info,kind,id:kind==='fever'?'':info.viewerId,name,gift,age:0,duration,
      priority:{welcome:1,follow:1,gift:1,vip:3,fever:2}[kind],state:'pending',sequence:++this.sequence,createdAt:this.clock,
      expiresAt:this.clock+{welcome:45,follow:30,gift:30,vip:60,fever:45}[kind],activations:0,resumes:0,suspended:false};
    if(this.queue.length>=this.capacity){
      let lower=-1;for(let i=this.queue.length-1;i>=0;i--)if(this.queue[i].priority<p.priority&&!this.queue[i].suspended){lower=i;break;}
      if(lower>=0)this.finish(this.queue.splice(lower,1)[0],'cancelled','Replaced by higher priority');
    }
    if(this.queue.length>=this.capacity||(kind==='welcome'&&this.queue.filter(q=>q.kind==='welcome').length>=30)){
      this.finish(p,'cancelled','Queue capacity');return p;
    }
    this.queue.push(p);this.sort();this.note('queued',p);return p;
  }
  private sort(){this.queue.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);}
  private finish(p:Presentation,state:'finished'|'cancelled',reason?:string){
    this.rotation.finished(p.id,state);
    p.state=state;p.suspended=false;this.note(state,p,reason);this.history.push(p);if(this.history.length>512)this.history.shift();if(state==='cancelled')this.dropped++;
  }
  update(dt:number,registered:Set<string>,ready:Set<string>,vipIds=new Set<string>()){
    const step=Math.max(0,Math.min(.25,dt));this.clock+=step;
    if(this.spatial){this.transitionRemaining=Math.max(0,this.transitionRemaining-step);ready=new Set([...ready].filter(id=>this.validActors.has(id)));this.preparePlan(ready);}
    this.vipIds=vipIds;
    if(this.rows){
      for(const [id,p] of this.entrances){
        if(!ready.has(id)||!registered.has(id)||!this.recognized(id))continue;
        if(p.state==='pending'){p.state='active';p.activations=1;if(!this.spatial)this.lastEntrant=id;this.rotation.presented(id);this.note('activated',p);this.started++;}
        // Recognition time advances only in a complete main shot or the identified secondary view.
        p.age+=step;
        if(p.age>=p.duration){if(this.spatial&&this.insetFramed===id)this.insetTail={p,until:this.clock+.28};this.finish(p,'finished');this.entrances.delete(id);}
      }
      const rows=this.rotation as HorizontalRows;
      rows.trim(ready,this.protectedRows(),this.clock);
    }
    this.rotation.sync(registered,vipIds,this.active,this.queue,this.clock);
    // Registered first arrivals retain their turn; a burst of 30 cannot expire
    // merely because the preceding five-second presentations are still playing.
    this.queue=this.queue.filter(p=>{if(p.expiresAt>=this.clock||(p.kind==='welcome'&&registered.has(p.id)))return true;this.finish(p,'cancelled','Expired');return false;});
    if(this.active){
      if(this.active.id&&!registered.has(this.active.id)){this.finish(this.active,'cancelled','Viewer left');this.active=undefined;}
      else if(this.active.id&&!ready.has(this.active.id)){
        // A skin reload is a readiness suspension, never an invisible active owner.
        this.suspend('Model not ready');
      }else if(!this.spatial||!this.active.id||this.recognized(this.active.id)){this.active.age=Math.min(this.active.duration,this.active.age+step);if(this.active.age>=this.active.duration){this.finish(this.active,'finished');this.active=undefined;this.groupUntil=this.clock+1.5;}}
    }
    const protectedIds=this.rotation.protected(this.active,this.queue);
    const index=this.queue.findIndex(p=>(p.priority>1||this.clock>=this.groupUntil)&&(!p.id||(registered.has(p.id)&&ready.has(p.id)&&this.rotation.canAdmit(p.id,protectedIds))));
    const next=this.queue[index];
    if(next&&(!this.active||next.priority>this.active.priority)){
      if(this.spatial&&next.id&&(!this.mainFramed.has(next.id)||this.transitionRemaining>0||this.framedPlan!==next.presentationId)){
        if(this.active)this.suspend('Preparing higher priority view');
      }else{
      this.queue.splice(index,1);if(this.active)this.suspend('Higher priority');
      if(next.id)this.rotation.admit(next.id,protectedIds,this.clock,next.eventId);
      this.active=next;next.state='active';
      if(next.activations){next.resumes++;this.note('resumed',next);}else{next.activations=1;this.started++;this.rotation.presented(next.id);this.note('activated',next);}
      next.suspended=false;
      }
    }
    this.shot=this.cue?({welcome:'HERO',follow:'HERO',gift:'EVENT',vip:'VIP',fever:'FEVER'} as const)[this.cue.kind]:'WIDE';
    this.rotation.sync(registered,vipIds,this.active,this.queue,this.clock);
    if(this.spatial)this.preparePlan(ready);
    return this.active;
  }
  private suspend(reason:string){
    const p=this.active!;p.state='pending';p.suspended=true;p.expiresAt=this.clock+75;
    this.queue.push(p);this.sort();this.note('suspended',p,reason);this.active=undefined;
  }
  clear(){for(const p of this.entrances.values())this.finish(p,'cancelled','Stopped');this.entrances.clear();if(this.active)this.finish(this.active,'cancelled','Stopped');for(const p of this.queue)this.finish(p,'cancelled','Stopped');this.active=undefined;this.queue=[];this.shot='WIDE';}
  reset(){this.clear();this.known.clear();this.seen.clear();this.rotation.reset();this.lastEntrant=undefined;this.plan=undefined;this.planOwner=undefined;this.mainFramed.clear();this.insetFramed=undefined;this.insetOwner=undefined;this.insetTail=undefined;this.transitionRemaining=0;this.groupUntil=0;this.vipIds.clear();this.epoch++;this.started=this.dropped=0;this.history=[];this.log=[];this.note('reset');}
  select(readyIds:string[],capacity=5){
    const protectedIds=this.rotation.protected(this.active,this.queue);
    this.rotation.configure(capacity,protectedIds,this.clock);
    if(!this.active)this.rotation.refill(new Set(readyIds),protectedIds,this.clock);
    return this.rotation.visible(new Set(readyIds));
  }
  next(readyIds:string[],capacity=5){if(this.active||this.queue.length)return;this.rotation.configure(capacity,this.rotation.protected(this.active,this.queue),this.clock);this.rotation.next(new Set(readyIds),this.rotation.protected(this.active,this.queue),this.clock);}
  stop(){} // F8 freezes the render; scheduling cancellation is explicit in clear().
  initialize(camera:T.PerspectiveCamera,position:T.Vector3,target:T.Vector3){camera.position.copy(position);this.target.copy(target);camera.lookAt(target);}
  resize(camera:T.PerspectiveCamera,aspect:number){camera.aspect=aspect;camera.updateProjectionMatrix();}
  fallback(camera:T.PerspectiveCamera,position:T.Vector3,target:T.Vector3,alpha:number){
    camera.clearViewOffset();camera.fov=46;camera.updateProjectionMatrix();camera.position.lerp(position,alpha);this.target.lerp(target,alpha);camera.lookAt(this.target);camera.updateMatrixWorld();this.initialized=false;
  }
  camera(camera:T.PerspectiveCamera,dt:number,subject:T.Vector3|undefined,options:{reduced:boolean;preview?:boolean;manual?:'WIDE'|'HERO';group?:readonly T.Vector3[];bounds?:readonly T.Vector3[]}){
    if(this.rows&&!options.preview){this.rowCamera(camera,dt,options.reduced,options.group,options.bounds);return;}
    const shot=options.preview?'HERO':this.active?this.shot:options.manual||'WIDE';
    const wide=lineupPose(camera.aspect),position=wide.position.clone(),look=wide.look.clone();
    if(!options.reduced&&subject&&options.preview){
      // The skin-library preview keeps its original close inspection framing.
      const distance=11.8*Math.max(1,(365/648)/camera.aspect);
      position.copy(subject).add(new T.Vector3((subject.x>=0?1:-1)*2.6,3.8,distance));
      look.copy(subject).add(new T.Vector3(0,1.85,0));
    }else if(!options.reduced&&subject&&['HERO','EVENT','VIP'].includes(shot)){
      // Keep more of the surrounding dancers in frame without moving their bodies.
      // VIP rises above its owner so the floor effect and neighbouring dancers remain readable.
      // Scale the entire offset on narrow screens, preserving the VIP viewing angle.
      const portraitScale=Math.max(1,(365/648)/camera.aspect);
      const distance={HERO:18.8,EVENT:19.5,VIP:16.5}[shot as 'HERO'|'EVENT'|'VIP'];
      const aim=1.5,height=shot==='VIP'?13.8:5.3;
      look.copy(subject).add(new T.Vector3(0,aim,0));
      if(options.group&&options.group.length>1){
        // Stable root positions, not animated limbs: neighbours influence composition
        // without introducing frame-to-frame tracking jitter or changing identity.
        const center=new T.Box3().setFromPoints([...options.group]).getCenter(new T.Vector3());
        center.y=look.y;look.lerp(center,.35);
      }
      position.copy(look).add(new T.Vector3((subject.x>=0?1:-1)*1.2,height-aim,distance).multiplyScalar(portraitScale));
    }else if(!options.reduced&&shot==='FEVER'){position.set(1.1,6.2,wide.position.z+1.4);look.set(0,1.1,-5.6);}
    const key=shot+':'+(this.active?.presentationId||'');if(key!==this.framingKey){this.framingKey=key;this.note('camera-target',this.active,shot);}
    camera.fov=34;camera.setViewOffset(1000*camera.aspect,1000,0,60,1000*camera.aspect,1000);camera.updateProjectionMatrix();
    if(!this.initialized){camera.position.copy(wide.position);this.target.copy(wide.look);camera.lookAt(this.target);this.initialized=true;}
    const step=Math.max(0,Math.min(.1,dt)),alpha=1-Math.exp(-step*2.4);
    const travel=position.clone().sub(camera.position).multiplyScalar(alpha).clampLength(0,9*step);camera.position.add(travel);this.target.lerp(look,alpha);
    const desired=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(camera.position,this.target,camera.up));
    camera.quaternion.rotateTowards(desired,.85*step);camera.updateMatrixWorld();
  }
  arrivalInset(aspect:number){
    if(!this.spatial){
      if(!this.active)return;
      const p=[...this.entrances.values()].filter(p=>p.state==='active'&&p.id!==this.active?.id).sort((a,b)=>b.sequence-a.sequence)[0];
      if(!p)return;
      return this.insetPose(p,aspect,1);
    }
    const main=new Set(this.viewIds([...this.validActors]));
    let p:Presentation|undefined;
    if(this.insetTail&&this.insetTail.until>this.clock)p=this.insetTail.p;
    else p=[...this.entrances.values()].filter(p=>this.validActors.has(p.id)&&!main.has(p.id)).sort((a,b)=>a.sequence-b.sequence)[0];
    if(!p){this.insetOwner=undefined;return;}
    if(this.insetOwner!==p.id){this.insetOwner=p.id;this.insetSince=this.clock;}
    const alpha=this.insetTail?.p===p?Math.max(0,(this.insetTail.until-this.clock)/.28):Math.min(1,(this.clock-this.insetSince)/.25);
    return this.insetPose(p,aspect,alpha);
  }
  private insetPose(p:Presentation,aspect:number,opacity:number){
    const origin=rowPlacement(this.rotation.slotOf(p.id)),look=origin.clone().add(new T.Vector3(0,1.15,0));
    this.arrivalCamera.aspect=aspect;this.arrivalCamera.position.copy(look).add(new T.Vector3(0,.8,6.6));
    this.arrivalCamera.lookAt(look);this.arrivalCamera.updateProjectionMatrix();this.arrivalCamera.updateMatrixWorld();
    return {presentation:p,camera:this.arrivalCamera,opacity};
  }
  /** A temporary VIP formation; logical seats and the existing dance remain unchanged. */
  actorPosition(id:string,viewIds:string[]){
    const own=rowPlacement(this.rotation.slotOf(id)),p=this.spatial?this.plan:this.active;
    if(!this.spatial||p?.kind!=='vip'||id===p.id||!viewIds.includes(id))return own;
    const others=viewIds.filter(x=>x!==p.id).sort((a,b)=>this.rotation.slotOf(a)-this.rotation.slotOf(b));
    return rowPlacement(this.rotation.slotOf(p.id)).add(new T.Vector3(others.indexOf(id)===0?-1.25:1.25,0,-1.8));
  }
  private rowCamera(camera:T.PerspectiveCamera,dt:number,reduced:boolean,actual?:readonly T.Vector3[],bounds?:readonly T.Vector3[]){
    const cue=this.spatial?this.plan:this.cue;
    const owner=cue?.id||this.lastEntrant;
    if(this.spatial&&(!owner||!this.validActors.has(owner)))return;
    const slot=owner?Math.max(0,this.rotation.slotOf(owner)):0;
    const vip=cue?.kind==='vip',size=vip?3:this.segmentSize;
    const row=Math.floor(slot/20),column=slot%20,start=vip?Math.max(0,Math.min(17,column-1)):Math.floor(column/size)*size,end=Math.min(19,start+size-1);
    const selected=this.viewIds(this.spatial?[...this.validActors]:[...this.rotation.participants.keys()]);
    const roots=selected.map(id=>this.actorPosition(id,selected));
    const local=rowPlacement(slot),center=roots.length?new T.Box3().setFromPoints(roots).getCenter(new T.Vector3()):rowPlacement(row*20+(start+end)/2);
    const look=(vip?local:center).clone().add(new T.Vector3(0,vip?1.35:1.2,0));
    const fov=38,tan=Math.tan(T.MathUtils.degToRad(fov/2));
    const span=vip?Math.max(4.2,...(actual||roots).map(v=>Math.abs(v.x-local.x)*2+2.1)):Math.max(3.7,...roots.map(v=>Math.abs(v.x-center.x)*2+2.5));
    let distance=Math.max(vip?11.8:15,span/(2*tan*camera.aspect*.90));
    const angle=vip&&!reduced?Math.sin(((cue?.age||0)/8)*Math.PI)*.07:0;
    const back=new T.Vector3(Math.sin(angle),vip?.12:.14,Math.cos(angle)).normalize();
    if(bounds?.length)distance=Math.max(distance,this.requiredDistance(look,back,camera.aspect,fov,bounds));
    const position=look.clone().addScaledVector(back,distance);
    camera.clearViewOffset();camera.fov=fov;camera.far=Math.max(250,distance*4);camera.updateProjectionMatrix();
    const key=row+':'+start+':'+(vip?'vip':'row');
    const windowChanged=this.planOwner?.split(':').slice(0,2).join(':')!==row+':'+start;
    const longMove=this.initialized&&windowChanged&&camera.position.distanceTo(position)>5;
    if(!this.initialized||longMove){
      camera.position.copy(position);if(vip&&this.spatial)camera.position.copy(look).add(new T.Vector3(0,2.2,Math.max(18,distance)));this.target.copy(look);this.initialized=true;
      if(longMove&&this.spatial){this.cutRevision++;this.transitionRemaining=.28;this.mainFramed.clear();this.note('scene-dissolve',cue,key);}
    }else{
      const alpha=1-Math.exp(-Math.max(0,Math.min(.1,dt))*5);
      camera.position.lerp(position,alpha);this.target.lerp(look,alpha);
    }
    this.planOwner=key;camera.lookAt(this.target);camera.updateMatrixWorld();
  }
  private requiredDistance(look:T.Vector3,back:T.Vector3,aspect:number,fov:number,points:readonly T.Vector3[]){
    const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),back).normalize(),up=new T.Vector3().crossVectors(back,right),tan=Math.tan(T.MathUtils.degToRad(fov/2));
    let distance=0;
    for(const point of points){const v=point.clone().sub(look),depth=v.dot(back),y=v.dot(up);distance=Math.max(distance,depth+Math.abs(v.dot(right))/(tan*aspect*.90),depth+(y>=0?y/(tan*.55):-y/(tan*.70)));}
    return distance+.15;
  }
  /** Preserve bodies already in the shot while a new segment or a wider dance is being framed. */
  fitVisible(camera:T.PerspectiveCamera,points:readonly T.Vector3[]){
    if(!points.length)return;
    const back=camera.position.clone().sub(this.target).normalize(),distance=camera.position.distanceTo(this.target),required=this.requiredDistance(this.target,back,camera.aspect,camera.fov,points);
    if(required>distance){camera.position.copy(this.target).addScaledVector(back,required);camera.lookAt(this.target);camera.updateMatrixWorld();}
  }
  inspect(){return {spatial:this.spatial,plan:this.plan,mainFramed:[...this.mainFramed],insetFramed:this.insetFramed,transitionRemaining:this.transitionRemaining,cutRevision:this.cutRevision,rows:this.rows,segmentSize:this.segmentSize,lastEntrant:this.lastEntrant,entrances:[...this.entrances.values()],shot:this.shot,active:this.active,queue:this.queue,history:this.history,log:this.log,started:this.started,dropped:this.dropped,capacity:this.capacity,clock:this.clock,groupUntil:this.groupUntil,rotation:this.rotation.inspect()};}
}
