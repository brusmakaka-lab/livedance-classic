import type {LiveEvent} from '../domain';

export type Participant = {
  id:string; name:string; joinedAt:number; joinedOrder:number; lastInteraction:number;
  registered:boolean; everRegistered:boolean; presentation:string; vip:boolean;
  slot:number|null; visibleOrder:number; displacedOrder:number; presentations:number;
};
type CueState={id:string;kind:string;state:string;suspended:boolean};
export type Occupancy = {slot:number;id:string|null;name:string|null}[];
export type RotationLog = {sequence:number;time:number;action:string;eventId?:string;incoming?:string;outgoing?:string;slot?:number;reason?:string;before:Occupancy;after:Occupancy};

/** Participant identity survives a turn outside the stage. Slots never act as IDs. */
export class GroupRotation {
  participants=new Map<string,Participant>();
  capacity=5;
  private slots:(string|null)[]=Array(5).fill(null);
  private joined=0; private admitted=0; private displaced=0; private sequence=0;
  log:RotationLog[]=[];
  snapshot():Occupancy{return this.slots.map((id,slot)=>({slot,id,name:id?this.participants.get(id)?.name||id:null}));}
  private note(time:number,action:string,before:Occupancy,extra:Partial<RotationLog>={}){
    this.log.push({sequence:++this.sequence,time,action,before,after:this.snapshot(),...extra});
    if(this.log.length>4096)this.log.shift();
  }
  observe(e:LiveEvent,time:number){
    if(e.eventType==='SIMULATED'||!e.viewerId)return;
    const before=this.snapshot(),old=this.participants.get(e.viewerId);
    if(old){old.name=e.username;old.lastInteraction=Math.max(old.lastInteraction,e.timestamp);}
    else this.participants.set(e.viewerId,{id:e.viewerId,name:e.username,joinedAt:e.timestamp,joinedOrder:++this.joined,lastInteraction:e.timestamp,registered:false,everRegistered:false,presentation:'waiting',vip:false,slot:null,visibleOrder:0,displacedOrder:0,presentations:0});
    this.note(time,old?'interaction':'arrival',before,{eventId:e.eventId,incoming:e.viewerId});
  }
  sync(registered:Set<string>,vip:Set<string>,active:CueState|undefined,queue:CueState[],time:number){
    for(const r of this.participants.values()){
      r.registered=registered.has(r.id);r.everRegistered ||= r.registered;
      const pending=queue.filter(p=>p.id===r.id);
      r.presentation=active?.id===r.id?'active':pending.some(p=>p.suspended)?'suspended':pending.length?'pending':['finished','cancelled'].includes(r.presentation)?r.presentation:r.presentations?'finished':'waiting';
      r.vip=vip.has(r.id)||(active?.id===r.id&&active.kind==='vip')||pending.some(p=>p.kind==='vip');
      if(!r.registered&&r.everRegistered&&r.slot!==null){const before=this.snapshot(),slot=r.slot;this.slots[slot]=null;r.slot=null;r.displacedOrder=++this.displaced;this.note(time,'unregistered',before,{outgoing:r.id,slot});}
    }
  }
  protected(active:CueState|undefined,queue:CueState[]){
    return new Set([...this.participants.values()].filter(r=>r.vip||active?.id===r.id||queue.some(p=>p.id===r.id&&p.suspended)).map(r=>r.id));
  }
  configure(capacity:number,protectedIds:Set<string>,time:number){
    if(![5,6,8,10].includes(capacity)||capacity===this.capacity)return;
    if(this.slots.slice(capacity).some(id=>id&&protectedIds.has(id)))return;
    const before=this.snapshot();
    for(const id of this.slots.slice(capacity))if(id){const r=this.participants.get(id)!;r.slot=null;r.displacedOrder=++this.displaced;}
    this.slots=Array.from({length:capacity},(_,i)=>this.slots[i]||null);this.capacity=capacity;
    this.note(time,'capacity',before,{reason:String(capacity)});
  }
  private eligible(protectedIds:Set<string>){return [...this.participants.values()].filter(r=>r.slot!==null&&!protectedIds.has(r.id)).sort((a,b)=>a.visibleOrder-b.visibleOrder||a.joinedOrder-b.joinedOrder)[0];}
  canAdmit(id:string,protectedIds:Set<string>){return this.participants.has(id)&&(this.participants.get(id)!.slot!==null||this.slots.includes(null)||!!this.eligible(protectedIds));}
  admit(id:string,protectedIds:Set<string>,time:number,eventId?:string,reason='presentation'){
    const r=this.participants.get(id);if(!r)return false;if(r.slot!==null)return true;
    let slot=this.slots.indexOf(null);const victim=slot<0?this.eligible(protectedIds):undefined;
    if(slot<0&&!victim)return false;
    const before=this.snapshot();
    if(victim){slot=victim.slot!;victim.slot=null;victim.displacedOrder=++this.displaced;}
    this.slots[slot]=id;r.slot=slot;r.visibleOrder=++this.admitted;
    this.note(time,'admitted',before,{eventId,incoming:id,outgoing:victim?.id,slot,reason});return true;
  }
  presented(id:string){const r=this.participants.get(id);if(r)r.presentations++;}
  finished(id:string,state:'finished'|'cancelled'){const r=this.participants.get(id);if(r){r.presentation=state;r.vip=false;}}
  visible(ready:Set<string>){return this.slots.filter((id):id is string=>!!id&&ready.has(id));}
  slotOf(id:string){return this.participants.get(id)?.slot??-1;}
  refill(ready:Set<string>,protectedIds:Set<string>,time:number){
    const waiting=[...this.participants.values()].filter(r=>r.registered&&r.presentations>0&&r.slot===null&&ready.has(r.id)).sort((a,b)=>a.displacedOrder-b.displacedOrder);
    for(const r of waiting){if(!this.slots.includes(null))break;this.admit(r.id,protectedIds,time,undefined,'vacancy-return');}
  }
  next(ready:Set<string>,protectedIds:Set<string>,time:number){
    const r=[...this.participants.values()].filter(r=>r.registered&&r.presentations>0&&r.slot===null&&ready.has(r.id)).sort((a,b)=>a.displacedOrder-b.displacedOrder)[0];
    if(r)this.admit(r.id,protectedIds,time,undefined,'manual-return');
  }
  reset(){this.participants.clear();this.slots=Array(this.capacity).fill(null);this.log=[];this.joined=this.admitted=this.displaced=this.sequence=0;}
  inspect(){return {capacity:this.capacity,slots:this.snapshot(),participants:[...this.participants.values()],log:this.log};}
}
